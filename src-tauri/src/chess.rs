use std::{
    collections::HashMap,
    fmt::Display,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};

use derivative::Derivative;
use governor::{Quota, RateLimiter};
use log::{info, warn};
use nonzero_ext::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, uci::UciMove, ByColor, CastlingMode, Chess, Color, EnPassantMode,
    Position, Role,
};
use specta::Type;
use tauri_specta::Event;
use vampirc_uci::{
    parse_one,
    uci::{Score, ScoreValue},
    UciInfoAttribute, UciMessage, UciOptionConfig,
};

use crate::{
    db::{DatabaseRepository, GameQuery, PositionQueryJs},
    engine::{
        parse_fen_and_apply_moves, resolve_engine_options, spawn_registered, AdmissionLease,
        EngineActor, EngineDeadlines, EngineKey, EngineLog, EngineOption, EngineRequestId, GoMode,
        ResolvedEngineOption, SupervisedEngine,
    },
    error::Error,
    infra::{
        blocking::BLOCKING_GATEWAY,
        path_authority::{
            DatabaseHandle, EngineExecutable, EngineHandle, PathAuthority, PathOperation,
        },
    },
    progress::{begin_progress, update_progress_with_state, ProgressState},
    AppState, SearchCache,
};
use tokio::sync::OwnedSemaphorePermit;
use tokio_util::sync::CancellationToken;

pub struct EngineProcess {
    base: Arc<EngineActor>,
    last_depth: u32,
    best_moves: Vec<BestMoves>,
    last_best_moves: Vec<BestMoves>,
    last_progress: f32,
    options: EngineOptions,
    resource_leases: Vec<crate::infra::path_authority::EngineResourceLease>,
    go_mode: GoMode,
    running: bool,
    request_id: Option<EngineRequestId>,
    real_multipv: u16,
    start: Instant,
}

fn resolve_engine_executable(
    state: &AppState,
    engine: &EngineHandle,
    operation: PathOperation,
) -> Result<EngineExecutable, Error> {
    let mut authority = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    authority
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .engine_executable(engine, operation)
}

impl EngineProcess {
    async fn new(
        supervisor: Arc<crate::engine::EngineSupervisor>,
        key: EngineKey,
        executable: EngineExecutable,
        engine_id: String,
        executable_ref: crate::infra::path_authority::PathRef,
        prepared_admission: Option<AdmissionLease>,
    ) -> Result<(Self, crate::engine::SupervisedEngine), Error> {
        let (supervised, ()) = spawn_registered(
            supervisor,
            key,
            executable,
            engine_id,
            executable_ref,
            prepared_admission,
            |actor| async move { actor.init_uci().await },
        )
        .await?;
        Ok((
            Self {
                base: supervised.actor.clone(),
                last_depth: 0,
                best_moves: Vec::new(),
                last_best_moves: Vec::new(),
                last_progress: 0.0,
                options: EngineOptions::default(),
                resource_leases: Vec::new(),
                real_multipv: 0,
                go_mode: GoMode::Infinite,
                running: false,
                request_id: None,
                start: Instant::now(),
            },
            supervised,
        ))
    }

    async fn set_option<T>(&mut self, name: &str, value: T) -> Result<(), Error>
    where
        T: Display,
    {
        self.base.set_option(name, &value.to_string()).await
    }

    async fn set_options(
        &mut self,
        options: EngineOptions,
        resolved: Vec<ResolvedEngineOption>,
    ) -> Result<(), Error> {
        let fen_changed = options.fen != self.options.fen;
        let fen: Fen = options.fen.parse()?;
        let setup = fen.as_setup();
        let castling_mode = CastlingMode::detect(setup);
        let pos = parse_fen_and_apply_moves(&options.fen, &options.moves)?;

        if fen_changed {
            if castling_mode.is_chess960() {
                self.set_option("UCI_Chess960", "true").await?;
            } else {
                self.set_option("UCI_Chess960", "false").await?;
            }
        }

        if resolved.len() != options.extra_options.len() {
            return Err(Error::Conflict(
                "resolved engine options do not match requested options".into(),
            ));
        }
        let mut first_seen = Vec::new();
        let mut last_index = HashMap::new();
        for (index, option) in options.extra_options.iter().enumerate() {
            let name = option.name().to_string();
            if !last_index.contains_key(&name) {
                first_seen.push(name.clone());
            }
            last_index.insert(name, index);
        }
        let mut resolved_by_index: Vec<_> = resolved.into_iter().map(Some).collect();
        let mut to_send = Vec::with_capacity(first_seen.len());
        let mut next_resource_leases = Vec::new();
        for name in first_seen {
            let Some(index) = last_index.get(&name).copied() else {
                continue;
            };
            let Some(mut resolved) = resolved_by_index[index].take() else {
                return Err(Error::Conflict(
                    "resolved engine option was consumed more than once".into(),
                ));
            };
            next_resource_leases.append(&mut resolved.resources);
            to_send.push(resolved);
        }

        let multipv = to_send
            .iter()
            .find(|option| option.name == "MultiPV")
            .map(|option| {
                option
                    .value
                    .parse::<u16>()
                    .map_err(|_| Error::InvalidInput("MultiPV must be a positive integer".into()))
            })
            .transpose()?
            .unwrap_or(1);
        if multipv == 0 {
            return Err(Error::InvalidInput("MultiPV must be at least one".into()));
        }

        self.real_multipv = multipv.min(pos.legal_moves().len() as u16);

        for option in &to_send {
            let current = options
                .extra_options
                .iter()
                .rev()
                .find(|configured| configured.name() == option.name);
            let previous = self
                .options
                .extra_options
                .iter()
                .rev()
                .find(|configured| configured.name() == option.name);
            if current != previous && option.name != "UCI_Chess960" {
                self.base
                    .set_option_with_resources(&option.name, &option.value, &option.resource_values)
                    .await?;
            }
        }

        if fen_changed || options.moves != self.options.moves {
            self.set_position(&options.fen, &options.moves).await?;
        }
        // UCI applies setoption lazily in many engines. A ready barrier makes
        // the following position/go belong to this exact configuration.
        self.base.ensure_ready().await?;
        self.resource_leases = next_resource_leases;
        self.last_depth = 0;
        self.options = options.clone();
        self.best_moves.clear();
        self.last_best_moves.clear();
        Ok(())
    }

    async fn set_position(&mut self, fen: &str, moves: &[String]) -> Result<(), Error> {
        self.base.set_position(fen, moves).await?;
        self.options.fen = fen.to_string();
        self.options.moves = moves.to_owned();
        Ok(())
    }

    async fn go(&mut self, mode: &GoMode) -> Result<(), Error> {
        self.go_mode = mode.clone();
        self.request_id = Some(self.base.start_search(mode).await?);
        self.running = true;
        self.start = Instant::now();
        Ok(())
    }

    async fn next_line(&mut self) -> Result<Option<String>, Error> {
        let request_id = self.request_id.ok_or(Error::EngineNotInitialized)?;
        self.base.next_search_line(request_id).await
    }

    async fn next_line_cancellable(
        &mut self,
        cancelled: &AtomicBool,
    ) -> Result<Option<String>, Error> {
        let request_id = self.request_id.ok_or(Error::EngineNotInitialized)?;
        self.base
            .next_search_line_cancellable(request_id, cancelled)
            .await
    }
}

#[derive(Clone, Serialize, Debug, Derivative, Type)]
#[derivative(Default)]
pub struct BestMoves {
    nodes: u64,
    depth: u32,
    score: Score,
    #[serde(rename = "uciMoves")]
    uci_moves: Vec<String>,
    #[serde(rename = "sanMoves")]
    san_moves: Vec<String>,
    #[derivative(Default(value = "1"))]
    multipv: u16,
    nps: u64,
}

#[derive(Serialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct BestMovesPayload {
    pub best_lines: Vec<BestMoves>,
    pub engine: String,
    pub tab: String,
    pub fen: String,
    pub moves: Vec<String>,
    pub progress: f64,
    pub generation: String,
}

fn invert_score(score: Score) -> Score {
    let new_value = match score.value {
        ScoreValue::Cp(x) => ScoreValue::Cp(-x),
        ScoreValue::Mate(x) => ScoreValue::Mate(-x),
    };
    let new_wdl = score.wdl.map(|(w, d, l)| (l, d, w));
    Score {
        value: new_value,
        wdl: new_wdl,
        ..score
    }
}

fn parse_uci_attrs(
    attrs: Vec<UciInfoAttribute>,
    fen: &Fen,
    moves: &[String],
) -> Result<BestMoves, Error> {
    let mut best_moves = BestMoves::default();
    let mut score_seen = false;

    let mut pos = parse_fen_and_apply_moves(&fen.to_string(), moves)?;
    let turn = pos.turn();

    for a in attrs {
        match a {
            UciInfoAttribute::Pv(m) => {
                for mv in m {
                    let uci: UciMove = mv.to_string().parse()?;
                    let m = uci.to_move(&pos)?;
                    let san = SanPlus::from_move_and_play_unchecked(&mut pos, &m);
                    best_moves.san_moves.push(san.to_string());
                    best_moves.uci_moves.push(uci.to_string());
                }
            }
            UciInfoAttribute::Nps(nps) => {
                best_moves.nps = nps;
            }
            UciInfoAttribute::Nodes(nodes) => {
                best_moves.nodes = nodes;
            }
            UciInfoAttribute::Depth(depth) => {
                best_moves.depth = depth;
            }
            UciInfoAttribute::MultiPv(multipv) => {
                best_moves.multipv = multipv;
            }
            UciInfoAttribute::Score(score) => {
                best_moves.score = score;
                score_seen = true;
            }
            _ => (),
        }
    }

    if best_moves.san_moves.is_empty() || !score_seen {
        return Err(Error::NoMovesFound);
    }

    if turn == Color::Black {
        best_moves.score = invert_score(best_moves.score);
    }

    Ok(best_moves)
}

fn score_is_bound(score: &Score) -> bool {
    score.lower_bound == Some(true) || score.upper_bound == Some(true)
}

/// A finished MultiPV set removed from `collected`. Ingest clears the collector
/// on a complete set; callers do not. Mixed-depth and shallower sets still
/// complete the sequence, but callers publish only when `publishable`.
struct CompleteMultiPv {
    depth: u32,
    nodes: u64,
    publishable: bool,
    lines: Vec<BestMoves>,
}

/// Shared UCI `info` aggregation for the interactive and report paths.
/// Bound scores are not evaluations (`64fad3d6`); out-of-sequence MultiPV
/// lines are dropped; a complete set is one whose last line is `real_multipv`.
fn ingest_info_line(
    collected: &mut Vec<BestMoves>,
    last_depth: u32,
    real_multipv: u16,
    line: BestMoves,
) -> Option<CompleteMultiPv> {
    if score_is_bound(&line.score) {
        return None;
    }
    let multipv = line.multipv;
    let depth = line.depth;
    let nodes = line.nodes;
    if multipv as usize != collected.len() + 1 {
        return None;
    }
    collected.push(line);
    if multipv != real_multipv {
        return None;
    }
    let publishable = collected.iter().all(|x| x.depth == depth) && depth >= last_depth;
    let lines = std::mem::take(collected);
    Some(CompleteMultiPv {
        depth,
        nodes,
        publishable,
        lines,
    })
}

#[derive(Deserialize, Debug, Clone, Type, Derivative, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derivative(Default)]
pub struct EngineOptions {
    pub fen: String,
    pub moves: Vec<String>,
    pub extra_options: Vec<EngineOption>,
}

#[tauri::command]
#[specta::specta]
pub async fn kill_engines(
    tab: String,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let analyses = state
        .operations
        .cancel_analyses_for_tab(window.label(), &tab)?;
    let mut failures = Vec::new();
    for id in analyses {
        let key = EngineKey::new("analysis".into(), id)?;
        if let Some(process) = state.engine_supervisor.get_exact(&key) {
            state
                .engine_supervisor
                .cancel_exact(&key, process.generation);
            if let Err(error) = state
                .engine_supervisor
                .terminate_exact(&key, process.generation)
                .await
            {
                failures.push(error.to_string());
            }
        }
    }
    if let Err(error) = state.engine_supervisor.terminate_tab(&tab).await {
        failures.push(error.to_string());
    }
    if failures.is_empty() {
        Ok(())
    } else {
        Err(Error::Conflict(failures.join("; ")))
    }
}

async fn retire_engine_with_supervisor(
    engine: String,
    supervisor: &crate::engine::EngineSupervisor,
) -> Result<(), Error> {
    supervisor.retire_engine(engine).await
}

#[tauri::command]
#[specta::specta]
pub async fn retire_engine(engine: String, state: tauri::State<'_, AppState>) -> Result<(), Error> {
    retire_engine_with_supervisor(engine, &state.engine_supervisor).await
}

#[tauri::command]
#[specta::specta]
pub async fn kill_engine(
    engine: String,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let key = EngineKey::new(tab, engine)?;
    if let Some(process) = state.engine_supervisor.get_exact(&key) {
        state
            .engine_supervisor
            .terminate_exact(&key, process.generation)
            .await?;
    }
    Ok(())
}
#[tauri::command]
#[specta::specta]
pub async fn stop_engine(
    engine: String,
    tab: String,
    expected_generation: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let key = EngineKey::new(tab, engine)?;
    let generation = expected_generation
        .as_deref()
        .map(|value| {
            value
                .parse::<u64>()
                .map_err(|_| Error::InvalidInput("invalid engine generation".into()))
        })
        .transpose()?;
    state
        .engine_supervisor
        .stop_generation(&key, generation)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn prepare_engine_search(
    id: String,
    engine: EngineHandle,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, Error> {
    let executable_ref = engine.id.clone();
    resolve_engine_executable(&state, &engine, PathOperation::EngineExecute)?;
    let key = EngineKey::new(tab, id.clone())?;
    state
        .engine_supervisor
        .prepare_engine_search(key, id, executable_ref)
        .await
}

fn classify_interactive_search_result(
    run_result: Result<(), Error>,
    cancelled: bool,
) -> Result<(), Error> {
    if !cancelled {
        return run_result;
    }
    match run_result {
        Ok(())
        | Err(Error::Cancellation | Error::AnalysisCancelled | Error::EngineDisconnected) => {
            Err(Error::Cancellation)
        }
        Err(error) => Err(error),
    }
}

fn interactive_best_moves_payload(
    process: &EngineProcess,
    engine: &str,
    tab: &str,
    generation: u64,
    best_lines: Vec<BestMoves>,
    progress: f64,
) -> BestMovesPayload {
    BestMovesPayload {
        best_lines,
        engine: engine.to_owned(),
        tab: tab.to_owned(),
        fen: process.options.fen.clone(),
        moves: process.options.moves.clone(),
        progress,
        generation: generation.to_string(),
    }
}

fn emit_live_interactive_best_moves<R: tauri::Runtime>(
    supervised: &SupervisedEngine,
    app: &tauri::AppHandle<R>,
    payload: BestMovesPayload,
) -> Result<bool, Error> {
    // Publication barrier: the same lock `mark_cancelled` takes. Stop/kill
    // cannot return while a dequeued line is still free to emit.
    supervised.try_publish(|| {
        payload.emit(app)?;
        Ok(())
    })
}

async fn process_interactive_search_output<R: tauri::Runtime>(
    process: &mut EngineProcess,
    engine: &str,
    tab: &str,
    supervised: &SupervisedEngine,
    app: &tauri::AppHandle<R>,
) -> Result<(), Error> {
    let limiter = RateLimiter::direct(Quota::per_second(nonzero!(5u32)));
    loop {
        let Some(line) = process.next_line().await? else {
            break;
        };
        #[cfg(test)]
        observe_dequeued_search_line(&line);
        match parse_one(&line) {
            UciMessage::Info(attrs) => {
                match parse_uci_attrs(attrs, &process.options.fen.parse()?, &process.options.moves)
                {
                    Ok(best_moves) => {
                        if let Some(set) = ingest_info_line(
                            &mut process.best_moves,
                            process.last_depth,
                            process.real_multipv,
                            best_moves,
                        ) {
                            if set.publishable && limiter.check().is_ok() {
                                let progress = (match process.go_mode {
                                    GoMode::Depth(depth) => {
                                        (set.depth as f64 / depth as f64) * 100.0
                                    }
                                    GoMode::Time(time) => {
                                        (process.start.elapsed().as_millis() as f64 / time as f64)
                                            * 100.0
                                    }
                                    GoMode::Nodes(nodes) => {
                                        (set.nodes as f64 / nodes as f64) * 100.0
                                    }
                                    GoMode::PlayersTime(_) => 99.99,
                                    GoMode::Infinite => 99.99,
                                })
                                .clamp(0.0, 100.0);
                                let published = emit_live_interactive_best_moves(
                                    supervised,
                                    app,
                                    interactive_best_moves_payload(
                                        process,
                                        engine,
                                        tab,
                                        supervised.generation,
                                        set.lines.clone(),
                                        progress,
                                    ),
                                )?;
                                if published {
                                    process.last_depth = set.depth;
                                    process.last_best_moves = set.lines;
                                    process.last_progress = progress as f32;
                                }
                            }
                        }
                    }
                    Err(Error::NoMovesFound) => {}
                    Err(error) => {
                        warn!("Failed to parse info line: {}, error: {:?}", line, error);
                    }
                }
            }
            UciMessage::BestMove { .. } => {
                let published = emit_live_interactive_best_moves(
                    supervised,
                    app,
                    interactive_best_moves_payload(
                        process,
                        engine,
                        tab,
                        supervised.generation,
                        process.last_best_moves.clone(),
                        100.0,
                    ),
                )?;
                if published {
                    process.last_progress = 100.0;
                }
            }
            _ => {}
        }
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_engine_logs(
    engine: String,
    tab: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<EngineLog>, Error> {
    let key = EngineKey::new(tab, engine)?;
    get_engine_logs_from_supervisor(&state.engine_supervisor, &key).await
}

async fn get_engine_logs_from_supervisor(
    supervisor: &crate::engine::EngineSupervisor,
    key: &EngineKey,
) -> Result<Vec<EngineLog>, Error> {
    if let Some(process) = supervisor.get_exact(key) {
        process.actor.logs().await
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
#[specta::specta]
// Tauri injects `app` and `state`; the remaining Specta arguments stay explicit
// because grouping them would change the generated renderer invoke contract.
#[allow(clippy::too_many_arguments)]
pub async fn get_best_moves(
    id: String,
    engine: EngineHandle,
    tab: String,
    go_mode: GoMode,
    options: EngineOptions,
    generation: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<(f32, Vec<BestMoves>)>, Error> {
    get_best_moves_core(
        id,
        engine,
        tab,
        go_mode,
        options,
        generation,
        app,
        state.inner().clone(),
    )
    .await
}

// Keep the command's independently validated engine, tab and generation fields visible at this
// internal boundary; grouping them would hide which values participate in stale-result checks.
#[allow(clippy::too_many_arguments)]
async fn get_best_moves_core<R: tauri::Runtime>(
    id: String,
    engine: EngineHandle,
    tab: String,
    go_mode: GoMode,
    options: EngineOptions,
    generation: String,
    app: tauri::AppHandle<R>,
    state: AppState,
) -> Result<Option<(f32, Vec<BestMoves>)>, Error> {
    let executable_ref = engine.id.clone();
    let key = EngineKey::new(tab.clone(), id.clone())?;
    let admission = state
        .engine_supervisor
        .consume_engine_search(key.clone(), id.clone(), executable_ref.clone(), &generation)
        .await?;
    let executable = resolve_engine_executable(&state, &engine, PathOperation::EngineExecute)?;
    let mut resolved = {
        let mut authority = state
            .pgn_path_authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
        resolve_engine_options(
            authority
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?,
            &options.extra_options,
        )?
    };
    let child_leases = resolved
        .iter_mut()
        .flat_map(|option| std::mem::take(&mut option.resources))
        .collect();

    let (mut process, supervised) = EngineProcess::new(
        state.engine_supervisor.clone(),
        key.clone(),
        executable.with_resource_leases(child_leases),
        id.clone(),
        executable_ref,
        Some(admission),
    )
    .await?;

    let run_result: Result<(), Error> = async {
        process.set_options(options.clone(), resolved).await?;
        process.go(&go_mode).await?;
        process_interactive_search_output(&mut process, &id, &tab, &supervised, &app).await
    }
    .await;
    let run_result =
        classify_interactive_search_result(run_result, supervised.cancelled.load(Ordering::SeqCst));
    info!(
        "Engine process finished: tab: {}, engine: {}",
        tab, engine.id.id
    );
    let cleanup = state
        .engine_supervisor
        .terminate_exact(&key, supervised.generation)
        .await;
    match (run_result, cleanup) {
        (Ok(()), Ok(())) => Ok(None),
        (Err(primary), Ok(())) => Err(primary),
        (Ok(()), Err(cleanup)) => Err(cleanup),
        (Err(primary), Err(cleanup)) => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: cleanup.to_string(),
        }),
    }
}

#[derive(Serialize, Debug, Default, Type)]
pub struct MoveAnalysis {
    best: Vec<BestMoves>,
    novelty: bool,
    is_sacrifice: bool,
}

#[derive(Deserialize, Debug, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisOptions {
    pub fen: String,
    pub moves: Vec<String>,
    pub annotate_novelties: bool,
    pub reference_db: Option<DatabaseHandle>,
    pub reversed: bool,
}

const REPORT_MULTIPV: u16 = 2;

fn restore_inherited_resource_provenance(
    option: &mut ResolvedEngineOption,
    inherited_values: &HashMap<String, String>,
    inherited_resource_values: &HashMap<String, Vec<String>>,
) {
    let Some(value) = inherited_values.get(&option.name) else {
        return;
    };
    option.value = value.clone();
    // The initial lease owns the child access, but the individual values remain
    // provenance for delayed transcript echoes. Freshly resolving the same
    // handle may produce different descriptor numbers.
    if let Some(resource_values) = inherited_resource_values.get(&option.name) {
        option.resource_values = resource_values.clone();
    }
    option.resources.clear();
}

fn prepare_report_options(
    uci_options: &[EngineOption],
    inherited_values: &HashMap<String, String>,
) -> (Vec<EngineOption>, HashMap<String, String>) {
    let mut order = Vec::new();
    let mut effective = HashMap::new();
    for option in uci_options {
        let name = option.name().to_string();
        if !effective.contains_key(&name) {
            order.push(name.clone());
        }
        effective.insert(name, option.clone());
    }
    let mut report_options = order
        .into_iter()
        .filter_map(|name| effective.remove(&name))
        .collect::<Vec<_>>();
    let report_multipv = REPORT_MULTIPV.to_string();
    if let Some(option) = report_options
        .iter_mut()
        .find(|option| option.name() == "MultiPV")
    {
        *option = EngineOption::String {
            name: "MultiPV".into(),
            value: report_multipv.clone(),
        };
    } else {
        report_options.push(EngineOption::String {
            name: "MultiPV".into(),
            value: report_multipv.clone(),
        });
    }
    let mut report_inherited_values = inherited_values.clone();
    report_inherited_values.insert("MultiPV".into(), report_multipv);
    (report_options, report_inherited_values)
}

#[tauri::command]
#[specta::specta]
pub fn prepare_analysis(
    tab: String,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<String, Error> {
    state.operations.prepare_analysis(window.label(), &tab)
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_analysis(
    id: String,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    state.operations.cancel_analysis(&id, window.label())?;
    let key = EngineKey::new("analysis".into(), id)?;
    if let Some(process) = state.engine_supervisor.get_exact(&key) {
        state
            .engine_supervisor
            .cancel_exact(&key, process.generation);
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
// Specta commands are a flat parameter list; grouping them would change the
// generated invoke contract (`engineId` is a new required argument).
#[allow(clippy::too_many_arguments)]
pub async fn analyze_game(
    id: String,
    tab: String,
    engine: EngineHandle,
    engine_id: String,
    go_mode: GoMode,
    options: AnalysisOptions,
    uci_options: Vec<EngineOption>,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Vec<MoveAnalysis>, Error> {
    let label = format!("analyze_game {id}");
    let operation = state
        .operations
        .claim_analysis(&id, window.label(), &tab, &label)?;
    let cancellation = operation.token();
    let state = state.inner().clone();
    crate::infra::operations::run_native_operation(
        operation,
        "analyze_game",
        analyze_game_core(
            id,
            engine,
            engine_id,
            go_mode,
            options,
            uci_options,
            state,
            app,
            cancellation,
        ),
    )
    .await
}

fn analysis_terminal_state(error: &Error) -> ProgressState {
    if matches!(error, Error::Cancellation | Error::AnalysisCancelled) {
        ProgressState::Cancelled
    } else {
        ProgressState::Failed
    }
}

fn ensure_analysis_not_cancelled(cancellation: &CancellationToken) -> Result<(), Error> {
    if cancellation.is_cancelled() {
        Err(Error::AnalysisCancelled)
    } else {
        Ok(())
    }
}

fn ensure_analysis_owner_active(
    supervised: &crate::engine::SupervisedEngine,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    if supervised.cancelled.load(Ordering::SeqCst) {
        Err(Error::AnalysisCancelled)
    } else {
        ensure_analysis_not_cancelled(cancellation)
    }
}

#[cfg(test)]
type AnalysisLineHook = Box<dyn FnMut(&str)>;

#[cfg(test)]
type AnalysisReplayPlyHook = Box<dyn FnMut(usize)>;

#[cfg(test)]
std::thread_local! {
    static ANALYSIS_LINE_DEQUEUED_HOOK: std::cell::RefCell<Option<AnalysisLineHook>> =
        const { std::cell::RefCell::new(None) };
    static ANALYSIS_REPLAY_PLY_HOOK: std::cell::RefCell<Option<AnalysisReplayPlyHook>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
fn observe_dequeued_search_line(line: &str) {
    ANALYSIS_LINE_DEQUEUED_HOOK.with(|slot| {
        if let Some(hook) = slot.borrow_mut().as_mut() {
            hook(line);
        }
    });
}

fn collect_report_positions(
    fen: Fen,
    moves: &[String],
    reversed: bool,
    cancellation: &CancellationToken,
) -> Result<Vec<(Fen, Vec<String>, bool)>, Error> {
    ensure_analysis_not_cancelled(cancellation)?;
    let setup = fen.as_setup().clone();
    let castling_mode = CastlingMode::detect(&setup);
    let mut chess: Chess = setup.position(castling_mode)?;
    let mut fens: Vec<(Fen, Vec<String>, bool)> = vec![(fen, vec![], false)];

    for (i, m) in moves.iter().enumerate() {
        ensure_analysis_not_cancelled(cancellation)?;
        let uci = UciMove::from_ascii(m.as_bytes())?;
        let played = uci.to_move(&chess)?;
        let previous_pos = chess.clone();
        chess.play_unchecked(&played);
        let current_pos = chess.clone();
        if !chess.is_game_over() {
            let prev_eval = naive_eval(&previous_pos);
            let cur_eval = -naive_eval(&current_pos);
            #[cfg(test)]
            ANALYSIS_REPLAY_PLY_HOOK.with(|slot| {
                if let Some(hook) = slot.borrow_mut().as_mut() {
                    hook(i);
                }
            });
            ensure_analysis_not_cancelled(cancellation)?;
            fens.push((
                Fen::from_position(current_pos, EnPassantMode::Legal),
                moves.iter().take(i + 1).cloned().collect(),
                prev_eval > cur_eval + 100,
            ));
        }
    }

    if reversed {
        fens.reverse();
    }
    Ok(fens)
}

async fn analyze_position_with_owner(
    proc: &mut EngineProcess,
    supervised: &crate::engine::SupervisedEngine,
    cancellation: &CancellationToken,
    go_mode: &GoMode,
    moves: &[String],
) -> Result<MoveAnalysis, Error> {
    ensure_analysis_owner_active(supervised, cancellation)?;
    proc.go(go_mode).await?;

    let mut current_analysis = MoveAnalysis::default();
    loop {
        let line = proc.next_line_cancellable(&supervised.cancelled).await?;
        let Some(line) = line else {
            return Err(Error::EngineDisconnected);
        };
        #[cfg(test)]
        observe_dequeued_search_line(&line);
        match parse_one(&line) {
            UciMessage::Info(attrs) => {
                match parse_uci_attrs(attrs, &proc.options.fen.parse()?, moves) {
                    Ok(best_moves) => {
                        if let Some(set) = ingest_info_line(
                            &mut proc.best_moves,
                            proc.last_depth,
                            proc.real_multipv,
                            best_moves,
                        ) {
                            if set.publishable {
                                current_analysis.best = set.lines;
                                proc.last_depth = set.depth;
                            }
                        }
                    }
                    Err(Error::NoMovesFound) => {}
                    Err(error) => warn!("Failed to parse info line: {line}, error: {error:?}"),
                }
            }
            UciMessage::BestMove { .. } => {
                ensure_analysis_owner_active(supervised, cancellation)?;
                break;
            }
            _ => {}
        }
    }
    ensure_analysis_owner_active(supervised, cancellation)?;
    Ok(current_analysis)
}

async fn fail_analysis_progress_before_child<R: tauri::Runtime>(
    progress_state: &crate::progress::ProgressStore,
    app: &tauri::AppHandle<R>,
    progress: &crate::progress::ProgressLease,
    error: Error,
) -> Error {
    if let Err(terminal) = update_progress_with_state(
        progress_state,
        app,
        progress,
        0.0,
        analysis_terminal_state(&error),
    ) {
        log::warn!(
            "analysis terminal progress generation {} failed: {}",
            progress.generation,
            terminal.category()
        );
    }
    error
}

async fn finish_analysis_failure<R: tauri::Runtime>(
    supervisor: &crate::engine::EngineSupervisor,
    key: &EngineKey,
    generation: u64,
    progress_state: &crate::progress::ProgressStore,
    app: &tauri::AppHandle<R>,
    progress: &crate::progress::ProgressLease,
    error: Error,
) -> Error {
    let cleanup = supervisor.terminate_exact(key, generation).await;
    if let Err(terminal) = update_progress_with_state(
        progress_state,
        app,
        progress,
        0.0,
        analysis_terminal_state(&error),
    ) {
        log::warn!(
            "analysis terminal progress generation {} failed: {}",
            progress.generation,
            terminal.category()
        );
    }
    match cleanup {
        Ok(()) => error,
        Err(cleanup) => Error::OperationAndCleanup {
            primary: error.to_string(),
            cleanup: cleanup.to_string(),
        },
    }
}

// Keep the command's independently validated engine, report and native-owner fields visible at
// this internal boundary; grouping them would hide which values participate in stale-result checks.
#[allow(clippy::too_many_arguments)]
async fn analyze_game_core<R: tauri::Runtime>(
    id: String,
    engine: EngineHandle,
    engine_id: String,
    go_mode: GoMode,
    options: AnalysisOptions,
    uci_options: Vec<EngineOption>,
    state: AppState,
    app: tauri::AppHandle<R>,
    cancellation: CancellationToken,
) -> Result<Vec<MoveAnalysis>, Error> {
    ensure_analysis_not_cancelled(&cancellation)?;
    let executable_ref = engine.id.clone();
    let executable = resolve_engine_executable(&state, &engine, PathOperation::EngineExecute)?;
    ensure_analysis_not_cancelled(&cancellation)?;
    let analysis_key = EngineKey::new("analysis".into(), id.clone())?;
    let mut analysis: Vec<MoveAnalysis> = Vec::new();

    let fen = Fen::from_ascii(options.fen.as_bytes())?;
    let mut fens = collect_report_positions(fen, &options.moves, options.reversed, &cancellation)?;

    let mut initial_resolved = {
        let mut authority = state
            .pgn_path_authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
        resolve_engine_options(
            authority
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?,
            &uci_options,
        )?
    };
    ensure_analysis_not_cancelled(&cancellation)?;
    let progress_lease = begin_progress(&state.progress_state, &app, id.clone())?;
    let inherited_values: HashMap<String, String> = initial_resolved
        .iter()
        .map(|option| (option.name.clone(), option.value.clone()))
        .collect();
    let inherited_resource_values: HashMap<String, Vec<String>> = initial_resolved
        .iter()
        .map(|option| (option.name.clone(), option.resource_values.clone()))
        .collect();
    let (report_options, inherited_values) =
        prepare_report_options(&uci_options, &inherited_values);
    let child_leases = initial_resolved
        .iter_mut()
        .flat_map(|option| std::mem::take(&mut option.resources))
        .collect();

    // Progress exists before a child. Failures here mark that lease cancelled or
    // failed; the cleanup-aware macro below is only valid once an actor exists.
    if let Err(error) = ensure_analysis_not_cancelled(&cancellation) {
        return Err(fail_analysis_progress_before_child(
            &state.progress_state,
            &app,
            &progress_lease,
            error,
        )
        .await);
    }
    let admission = match state
        .engine_supervisor
        .admit_for_operation(
            analysis_key.clone(),
            engine_id.clone(),
            executable_ref.clone(),
            cancellation.clone(),
        )
        .await
    {
        Ok(admission) => admission,
        Err(error) => {
            return Err(fail_analysis_progress_before_child(
                &state.progress_state,
                &app,
                &progress_lease,
                error,
            )
            .await);
        }
    };
    let (mut proc, supervised) = match EngineProcess::new(
        state.engine_supervisor.clone(),
        analysis_key.clone(),
        executable.with_resource_leases(child_leases),
        engine_id,
        executable_ref,
        Some(admission),
    )
    .await
    {
        Ok(process) => process,
        Err(error) => {
            return Err(fail_analysis_progress_before_child(
                &state.progress_state,
                &app,
                &progress_lease,
                error,
            )
            .await);
        }
    };
    macro_rules! fail_analysis_progress {
        ($error:expr) => {{
            let error = $error;
            return Err(finish_analysis_failure(
                state.engine_supervisor.as_ref(),
                &analysis_key,
                supervised.generation,
                &state.progress_state,
                &app,
                &progress_lease,
                error,
            )
            .await);
        }};
    }

    for (i, (_, moves, _)) in fens.iter().enumerate() {
        if let Err(cancelled) = ensure_analysis_owner_active(&supervised, &cancellation) {
            fail_analysis_progress!(cancelled);
        }

        if let Err(error) = update_progress_with_state(
            &state.progress_state,
            &app,
            &progress_lease,
            (i as f32 / fens.len() as f32) * 100.0,
            ProgressState::Running,
        ) {
            fail_analysis_progress!(error);
        }

        let configured_options = EngineOptions {
            fen: options.fen.clone(),
            moves: moves.clone(),
            extra_options: report_options.clone(),
        };
        let mut resolved = {
            let result = (|| {
                let mut authority = state
                    .pgn_path_authority
                    .lock()
                    .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
                resolve_engine_options(
                    authority.as_mut().ok_or_else(|| {
                        Error::Conflict("path authority is not initialized".into())
                    })?,
                    &configured_options.extra_options,
                )
            })();
            match result {
                Ok(resolved) => resolved,
                Err(error) => fail_analysis_progress!(error),
            }
        };
        for option in &mut resolved {
            restore_inherited_resource_provenance(
                option,
                &inherited_values,
                &inherited_resource_values,
            );
        }
        if let Err(error) = proc.set_options(configured_options, resolved).await {
            fail_analysis_progress!(error);
        }

        match analyze_position_with_owner(&mut proc, &supervised, &cancellation, &go_mode, moves)
            .await
        {
            Ok(current_analysis) => analysis.push(current_analysis),
            Err(error) => fail_analysis_progress!(error),
        }
    }

    if options.reversed {
        analysis.reverse();
        fens.reverse();
    }

    if let Err(error) = state
        .engine_supervisor
        .terminate_exact(&analysis_key, supervised.generation)
        .await
    {
        fail_analysis_progress!(error);
    }

    let present = if options.annotate_novelties {
        let Some(reference) = options.reference_db.clone() else {
            fail_analysis_progress!(Error::MissingReferenceDatabase);
        };
        let queries: Vec<GameQuery> = fens
            .iter()
            .map(|(fen, _, _)| {
                GameQuery::new().position(PositionQueryJs {
                    fen: fen.to_string(),
                    type_: "exact".to_string(),
                })
            })
            .collect();
        let authority = std::sync::Arc::clone(&state.pgn_path_authority);
        let repository = std::sync::Arc::clone(&state.database_repository);
        let search_cache = std::sync::Arc::clone(&state.search_cache);
        let permit = match tokio::select! {
            biased;
            _ = cancellation.cancelled() => Err(Error::AnalysisCancelled),
            permit = state.new_request.clone().acquire_owned() => permit.map_err(|_| Error::Conflict("position search permit unavailable".into())),
        } {
            Ok(permit) => permit,
            Err(error) => fail_analysis_progress!(error),
        };
        match BLOCKING_GATEWAY
            .spawn_cancellable(cancellation.clone(), move |worker_cancellation| {
                novelty_lookup_blocking(
                    &authority,
                    &repository,
                    &search_cache,
                    permit,
                    reference,
                    queries,
                    worker_cancellation,
                )
            })
            .await
        {
            Ok(present) => present,
            Err(error) => fail_analysis_progress!(error),
        }
    } else {
        Vec::new()
    };
    let mut novelty_found = false;
    for (i, analysis) in analysis.iter_mut().enumerate() {
        analysis.is_sacrifice = fens[i].2;
        if options.annotate_novelties && !novelty_found {
            if let Some(&found) = present.get(i) {
                analysis.novelty = !found;
                if analysis.novelty {
                    novelty_found = true;
                }
            }
        }
    }
    if let Err(cancelled) = ensure_analysis_not_cancelled(&cancellation) {
        fail_analysis_progress!(cancelled);
    }
    update_progress_with_state(
        &state.progress_state,
        &app,
        &progress_lease,
        100.0,
        ProgressState::Succeeded,
    )?;
    Ok(analysis)
}

/// Returns a prefix of presence flags ending at the first absent position, or
/// the full length when every position is present. Each element is "this
/// position is PRESENT in the reference database"; the caller sets
/// `analysis.novelty = !found`. A full-index scan per ply is the cost this
/// offload exists to bound.
pub(crate) fn novelty_lookup_blocking(
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &std::sync::Arc<SearchCache>,
    permit: OwnedSemaphorePermit,
    file: DatabaseHandle,
    queries: Vec<GameQuery>,
    cancellation: &CancellationToken,
) -> Result<Vec<bool>, Error> {
    let _permit = permit;
    let mut present = Vec::with_capacity(queries.len());
    for query in &queries {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let found = crate::db::is_position_in_db_cancellable(
            authority,
            repository,
            search_cache,
            &file,
            query,
            cancellation,
        )?;
        present.push(found);
        if !found {
            break;
        }
    }
    Ok(present)
}

const MATE_SCORE: i32 = 10000;
const PAWN_VALUE: i32 = 100;
const KNIGHT_VALUE: i32 = 300;
const BISHOP_VALUE: i32 = 300;
const ROOK_VALUE: i32 = 500;
const QUEEN_VALUE: i32 = 900;

fn count_material(position: &Chess) -> i32 {
    if position.is_checkmate() {
        return -MATE_SCORE;
    }
    if position.is_stalemate() {
        return 0;
    }
    let material: ByColor<i32> = position.board().material().map(|p| {
        p.pawn as i32 * PAWN_VALUE
            + p.knight as i32 * KNIGHT_VALUE
            + p.bishop as i32 * BISHOP_VALUE
            + p.rook as i32 * ROOK_VALUE
            + p.queen as i32 * QUEEN_VALUE
    });
    if position.turn() == Color::White {
        material.white - material.black
    } else {
        material.black - material.white
    }
}

fn piece_value(role: Role) -> i32 {
    match role {
        Role::Pawn => PAWN_VALUE,
        Role::Knight => KNIGHT_VALUE,
        Role::Bishop => BISHOP_VALUE,
        Role::Rook => ROOK_VALUE,
        Role::Queen => QUEEN_VALUE,
        _ => 0,
    }
}

fn qsearch(position: &Chess, mut alpha: i32, beta: i32) -> i32 {
    if position.is_checkmate() || position.is_stalemate() {
        return count_material(position);
    }
    let stand_pat = count_material(position);

    if stand_pat >= beta {
        return beta;
    }
    if alpha < stand_pat {
        alpha = stand_pat;
    }
    let legal_moves = position.legal_moves();
    let mut captures: Vec<_> = legal_moves
        .iter()
        .filter_map(|mv| mv.capture().map(|captured| (mv, captured)))
        .collect();

    captures.sort_by(|a, b| {
        let a_value = piece_value(a.1);
        let b_value = piece_value(b.1);
        b_value.cmp(&a_value)
    });

    for (capture, _) in captures {
        let mut new_position = position.clone();
        new_position.play_unchecked(capture);
        let score = -qsearch(&new_position, -beta, -alpha);
        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }

    alpha
}

fn naive_eval(pos: &Chess) -> i32 {
    // The heuristic is from the side to move.  A terminal position has no
    // legal move to maximise over: checkmate is a bounded mate score and any
    // draw (including stalemate) is exactly zero, never the i32::MIN sentinel.
    if pos.is_checkmate() || pos.is_stalemate() {
        return count_material(pos);
    }
    pos.legal_moves()
        .iter()
        .map(|mv| {
            let mut new_position = pos.clone();
            new_position.play_unchecked(mv);
            -qsearch(&new_position, i32::MIN, i32::MAX)
        })
        .max()
        .unwrap_or_else(|| count_material(pos))
}

#[cfg(test)]
mod tests {
    use crate::engine::EngineSupervisor;
    use shakmaty::FromSetup;
    use std::time::Duration;
    use tauri::{Listener, Manager};

    use super::*;

    #[test]
    fn analysis_cancellation_uses_cancelled_terminal_state() {
        assert_eq!(
            analysis_terminal_state(&Error::Cancellation),
            ProgressState::Cancelled
        );
        assert_eq!(
            analysis_terminal_state(&Error::AnalysisCancelled),
            ProgressState::Cancelled
        );
        assert_eq!(
            analysis_terminal_state(&Error::EngineDisconnected),
            ProgressState::Failed
        );
    }

    #[test]
    fn report_replay_stops_at_the_ply_where_cancellation_arrives() {
        let moves = ["e2e4", "e7e5", "g1f3"]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let live = collect_report_positions(start_fen(), &moves, false, &CancellationToken::new())
            .unwrap();
        assert_eq!(live.len(), 4);

        let cancelled = CancellationToken::new();
        cancelled.cancel();
        assert!(matches!(
            collect_report_positions(start_fen(), &moves, false, &cancelled),
            Err(Error::AnalysisCancelled)
        ));

        let during = CancellationToken::new();
        let cancel_at_last_ply = during.clone();
        // Cancel after the last ply's naive_eval so a check that only runs at
        // the next iteration cannot save the test.
        ANALYSIS_REPLAY_PLY_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move |ply| {
                    if ply == 2 {
                        cancel_at_last_ply.cancel();
                    }
                })))
                .is_none());
        });
        let error = collect_report_positions(start_fen(), &moves, false, &during).unwrap_err();
        ANALYSIS_REPLAY_PLY_HOOK.with(|slot| {
            slot.replace(None);
        });
        assert!(matches!(error, Error::AnalysisCancelled));
    }

    #[tokio::test]
    async fn analyze_game_core_does_not_start_progress_when_already_cancelled() {
        let app = engine_test_app();
        let state = app.state::<AppState>().inner().clone();
        let id = "cancelled-before-admit";
        let cancellation = CancellationToken::new();
        cancellation.cancel();
        let error = analyze_game_core(
            id.into(),
            EngineHandle {
                id: crate::infra::path_authority::PathRef {
                    id: "missing-engine".into(),
                },
                kind: crate::infra::path_authority::EngineHandleKind::Engine,
            },
            "missing-engine".into(),
            GoMode::Depth(1),
            AnalysisOptions {
                fen: start_fen().to_string(),
                moves: vec!["e2e4".into(), "e7e5".into()],
                annotate_novelties: false,
                reference_db: None,
                reversed: false,
            },
            Vec::new(),
            state.clone(),
            app.clone(),
            cancellation,
        )
        .await
        .unwrap_err();
        assert!(matches!(error, Error::AnalysisCancelled));
        assert!(state.progress_state.get(id).unwrap().is_none());
        assert!(state
            .engine_supervisor
            .get_exact(&EngineKey::new("analysis".into(), id.into()).unwrap())
            .is_none());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn analyze_game_core_stops_during_replay_before_progress_or_spawn() {
        let (_directory, app, engine, _resource) = resource_engine_fixture();
        let state = app.state::<AppState>().inner().clone();
        let id = "cancel-during-replay";
        let cancellation = CancellationToken::new();
        let cancel_at_last_ply = cancellation.clone();
        ANALYSIS_REPLAY_PLY_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move |ply| {
                    if ply == 2 {
                        cancel_at_last_ply.cancel();
                    }
                })))
                .is_none());
        });
        let error = analyze_game_core(
            id.into(),
            engine,
            "cancel-during-replay-engine".into(),
            GoMode::Depth(1),
            AnalysisOptions {
                fen: start_fen().to_string(),
                moves: ["e2e4", "e7e5", "g1f3"]
                    .into_iter()
                    .map(str::to_string)
                    .collect(),
                annotate_novelties: false,
                reference_db: None,
                reversed: false,
            },
            Vec::new(),
            state.clone(),
            app.clone(),
            cancellation,
        )
        .await
        .unwrap_err();
        ANALYSIS_REPLAY_PLY_HOOK.with(|slot| {
            slot.replace(None);
        });
        assert!(matches!(error, Error::AnalysisCancelled));
        assert!(state.progress_state.get(id).unwrap().is_none());
        assert!(state
            .engine_supervisor
            .get_exact(&EngineKey::new("analysis".into(), id.into()).unwrap())
            .is_none());
    }

    #[tokio::test]
    async fn analysis_rechecks_owner_after_readyok_and_bestmove_dequeue() {
        let (actor, writes) = EngineActor::recording_test_actor(&["readyok"]);
        let supervised = SupervisedEngine::new(
            41,
            "engine".into(),
            crate::infra::path_authority::PathRef {
                id: "engine-path".into(),
            },
            actor.clone(),
            Arc::new(AtomicBool::new(false)),
        );
        let mut process = EngineProcess {
            base: actor.clone(),
            last_depth: 0,
            best_moves: Vec::new(),
            last_best_moves: Vec::new(),
            last_progress: 0.0,
            options: EngineOptions::default(),
            resource_leases: Vec::new(),
            go_mode: GoMode::Depth(1),
            running: false,
            request_id: None,
            real_multipv: 0,
            start: Instant::now(),
        };
        process
            .set_options(
                EngineOptions {
                    fen: start_fen().to_string(),
                    moves: Vec::new(),
                    extra_options: Vec::new(),
                },
                Vec::new(),
            )
            .await
            .unwrap();
        let cancellation = CancellationToken::new();
        cancellation.cancel();
        assert!(matches!(
            analyze_position_with_owner(
                &mut process,
                &supervised,
                &cancellation,
                &GoMode::Depth(1),
                &[],
            )
            .await,
            Err(Error::AnalysisCancelled)
        ));
        assert!(!writes
            .lock()
            .await
            .iter()
            .any(|line| line.starts_with("go")));
        actor.terminate().await.unwrap();

        let (actor, writes) = EngineActor::recording_test_actor(&["bestmove e2e4"]);
        let supervisor = Arc::new(crate::engine::EngineSupervisor::default());
        let key = EngineKey::new("analysis".into(), "owned-sequence".into()).unwrap();
        let supervised = supervisor
            .replace_handle(
                key.clone(),
                actor.clone(),
                "engine".into(),
                crate::infra::path_authority::PathRef {
                    id: "engine-path".into(),
                },
            )
            .await
            .unwrap();
        let other_key = EngineKey::new("analysis".into(), "other-sequence".into()).unwrap();
        let (other_actor, _) = EngineActor::recording_test_actor(&[]);
        let other = supervisor
            .replace_handle(
                other_key.clone(),
                other_actor,
                "other-engine".into(),
                crate::infra::path_authority::PathRef {
                    id: "other-engine-path".into(),
                },
            )
            .await
            .unwrap();
        let mut process = EngineProcess {
            base: actor.clone(),
            last_depth: 0,
            best_moves: Vec::new(),
            last_best_moves: Vec::new(),
            last_progress: 0.0,
            options: EngineOptions::default(),
            resource_leases: Vec::new(),
            go_mode: GoMode::Depth(1),
            running: false,
            request_id: None,
            real_multipv: 1,
            start: Instant::now(),
        };
        let cancellation = CancellationToken::new();
        let cancel_at_dequeue = cancellation.clone();
        ANALYSIS_LINE_DEQUEUED_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move |line| {
                    if matches!(parse_one(line), UciMessage::BestMove { .. }) {
                        cancel_at_dequeue.cancel();
                    }
                })))
                .is_none());
        });
        let error = analyze_position_with_owner(
            &mut process,
            &supervised,
            &cancellation,
            &GoMode::Depth(1),
            &[],
        )
        .await
        .unwrap_err();
        assert!(matches!(error, Error::AnalysisCancelled));
        assert!(writes.lock().await.iter().any(|line| line == "go depth 1"));

        let app = engine_test_app();
        let progress_state = crate::progress::ProgressStore::default();
        let progress = begin_progress(&progress_state, &app, "analysis-sequence".into()).unwrap();
        let error = finish_analysis_failure(
            supervisor.as_ref(),
            &key,
            supervised.generation,
            &progress_state,
            &app,
            &progress,
            error,
        )
        .await;
        assert!(matches!(error, Error::AnalysisCancelled));
        assert!(supervisor.get_exact(&key).is_none());
        assert_eq!(
            supervisor.get_exact(&other_key).unwrap().generation,
            other.generation
        );
        supervisor
            .terminate_exact(&other_key, other.generation)
            .await
            .unwrap();
    }

    fn string_option(name: &str, value: &str) -> EngineOption {
        EngineOption::String {
            name: name.into(),
            value: value.into(),
        }
    }

    fn resolved_option(name: &str, value: &str) -> ResolvedEngineOption {
        ResolvedEngineOption {
            name: name.into(),
            value: value.into(),
            resources: Vec::new(),
            resource_values: Vec::new(),
        }
    }

    fn engine_test_app() -> tauri::AppHandle<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(
                BestMovesPayload,
                crate::progress::ProgressEvent
            ))
            .mount_events(&app);
        app.manage(AppState::default());
        app.handle().clone()
    }

    #[cfg(unix)]
    fn resource_engine_fixture() -> (
        tempfile::TempDir,
        tauri::AppHandle<tauri::test::MockRuntime>,
        EngineHandle,
        crate::infra::path_authority::EngineResourceHandle,
    ) {
        use crate::infra::path_authority::{EngineResourceHandleKind, PathClass};
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("resource-flow-engine.sh");
        std::fs::write(
            &script,
            r#"#!/bin/sh
capture="$PWD/capture.log"
while IFS= read -r line; do
    case "$line" in
        uci)
            echo uciok
            ;;
        isready)
            echo readyok
            ;;
        setoption\ name\ EvalFile\ value\ *)
            value=${line#*value }
            printf 'eval=%s\n' "$value" >> "$capture"
            if [ "$(cat "$value" 2>/dev/null)" = "resource-bytes" ]; then
                printf 'read=resource-bytes\n' >> "$capture"
            else
                printf 'read=unreadable\n' >> "$capture"
            fi
            child=
            for fd in /proc/$$/fd/[0-9]*; do
                if [ -f "$fd" ] && [ "$(cat "$fd" 2>/dev/null)" = "resource-bytes" ]; then
                    child="/proc/self/fd/${fd##*/}"
                    break
                fi
            done
            printf 'child=%s\n' "$child" >> "$capture"
            echo "$line"
            ;;
        setoption*)
            echo "$line"
            ;;
        go*)
            echo "info depth 1 multipv 1 score cp 12 nodes 1 pv e2e4"
            echo "info depth 1 multipv 2 score cp 8 nodes 1 pv d2d4"
            printf 'go-ready\n' >> "$capture"
            while [ ! -f "$PWD/release" ]; do
                sleep 0.01
            done
            echo "bestmove e2e4"
            ;;
        quit)
            exit 0
            ;;
    esac
done
"#,
        )
        .unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let resource_path = directory.path().join("weights.nnue");
        std::fs::write(&resource_path, b"resource-bytes").unwrap();

        let mut authority =
            PathAuthority::open(directory.path().join("registry.json"), Vec::new()).unwrap();
        let engine = authority
            .register_engine_file(&script, "resource-flow-engine")
            .unwrap();
        let grant = authority
            .grant_dialog(
                &resource_path,
                "weights",
                PathClass::SingleDialogGrant,
                PathOperation::EngineResourceRead,
                std::time::Duration::from_secs(30),
                1,
            )
            .unwrap();
        let resource = authority
            .promote_engine_resource(&grant, EngineResourceHandleKind::File, "weights")
            .unwrap();

        let app = engine_test_app();
        *app.state::<AppState>().pgn_path_authority.lock().unwrap() = Some(authority);
        (directory, app, engine, resource)
    }

    fn assert_safe_resource_logs(logs: &[EngineLog]) {
        assert!(logs.iter().any(|entry| matches!(
            entry,
            EngineLog::Gui(line) if line == "setoption name EvalFile value [redacted]\n"
        )));
        assert!(logs.iter().any(|entry| matches!(
            entry,
            EngineLog::Engine(line) if line == "setoption name EvalFile value [redacted]"
        )));
        assert!(logs.iter().all(|entry| match entry {
            EngineLog::Gui(line) | EngineLog::Engine(line) => {
                !line.contains("/proc/self/fd/") && !line.contains("resource-bytes")
            }
            EngineLog::Truncated { .. } => true,
        }));
    }

    fn assert_resource_wire_capture(directory: &tempfile::TempDir, expected: &str) {
        let capture = std::fs::read_to_string(directory.path().join("capture.log")).unwrap();
        let eval = capture
            .lines()
            .find_map(|line| line.strip_prefix("eval="))
            .expect("resource engine must capture the EvalFile wire value");
        let child = capture
            .lines()
            .find_map(|line| line.strip_prefix("child="))
            .expect("resource engine must capture its inherited resource descriptor");
        let read = capture
            .lines()
            .find_map(|line| line.strip_prefix("read="))
            .expect("resource engine must capture the EvalFile read result");
        for value in [eval, child] {
            let descriptor = value
                .strip_prefix("/proc/self/fd/")
                .expect("resource option must use a procfs descriptor");
            assert!(!descriptor.is_empty() && descriptor.bytes().all(|byte| byte.is_ascii_digit()));
        }
        assert_eq!(eval, child, "the wire value must be the inherited resource");
        assert_eq!(
            read, expected,
            "the child must read bytes through the wire value"
        );
    }

    async fn collect_barriered_resource_logs<T: Send>(
        directory: &tempfile::TempDir,
        supervisor: &Arc<EngineSupervisor>,
        key: &EngineKey,
        core: tokio::task::JoinHandle<T>,
    ) -> (Vec<EngineLog>, T) {
        let mut core = core;
        let ready = tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                let capture = std::fs::read_to_string(directory.path().join("capture.log"))
                    .unwrap_or_default();
                if capture.lines().any(|line| line == "go-ready")
                    && supervisor.get_exact(key).is_some()
                {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await;
        if ready.is_err() {
            let _ = std::fs::write(directory.path().join("release"), b"");
            let _ = tokio::time::timeout(Duration::from_secs(10), &mut core).await;
            panic!("resource engine did not reach its log barrier");
        }

        let logs_result = get_engine_logs_from_supervisor(supervisor, key).await;
        std::fs::write(directory.path().join("release"), b"").unwrap();
        let result = tokio::time::timeout(Duration::from_secs(10), core)
            .await
            .expect("resource core cleanup must finish")
            .expect("resource core task must finish");
        (
            logs_result.expect("active resource log query must succeed"),
            result,
        )
    }

    #[tokio::test]
    async fn stop_engine_command_forwards_qualified_and_broad_generations() {
        let app = engine_test_app();
        let state = app.state::<AppState>();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let executable = crate::infra::path_authority::PathRef {
            id: "engine-path".into(),
        };

        let (old_actor, _) = EngineActor::recording_test_actor(&[]);
        let old = state
            .engine_supervisor
            .replace_handle(key.clone(), old_actor, "engine".into(), executable.clone())
            .await
            .unwrap();
        let (replacement_actor, _) = EngineActor::recording_test_actor(&[]);
        let replacement = state
            .engine_supervisor
            .replace_handle(
                key.clone(),
                replacement_actor,
                "engine".into(),
                executable.clone(),
            )
            .await
            .unwrap();

        stop_engine(
            "engine".into(),
            "tab".into(),
            Some(old.generation.to_string()),
            app.state(),
        )
        .await
        .unwrap();
        assert_eq!(
            state.engine_supervisor.get_exact(&key).unwrap().generation,
            replacement.generation
        );

        stop_engine(
            "engine".into(),
            "tab".into(),
            Some(replacement.generation.to_string()),
            app.state(),
        )
        .await
        .unwrap();
        assert!(state.engine_supervisor.get_exact(&key).is_none());

        let (broad_actor, _) = EngineActor::recording_test_actor(&[]);
        let broad = state
            .engine_supervisor
            .replace_handle(key.clone(), broad_actor, "engine".into(), executable)
            .await
            .unwrap();
        assert!(matches!(
            stop_engine(
                "engine".into(),
                "tab".into(),
                Some("not-a-generation".into()),
                app.state(),
            )
            .await,
            Err(Error::InvalidInput(message)) if message == "invalid engine generation"
        ));
        assert_eq!(
            state.engine_supervisor.get_exact(&key).unwrap().generation,
            broad.generation
        );

        stop_engine("engine".into(), "tab".into(), None, app.state())
            .await
            .unwrap();
        assert!(state.engine_supervisor.get_exact(&key).is_none());
    }

    struct InteractiveSearchProbe {
        app: tauri::AppHandle<tauri::test::MockRuntime>,
        emitted: Arc<std::sync::Mutex<Vec<serde_json::Value>>>,
        actor: Arc<EngineActor>,
        supervised: SupervisedEngine,
        process: EngineProcess,
        generation: u64,
    }

    async fn interactive_search_probe(lines: &[&str], cancelled: bool) -> InteractiveSearchProbe {
        let app = engine_test_app();
        let emitted = Arc::new(std::sync::Mutex::new(Vec::new()));
        let observed = emitted.clone();
        app.listen(BestMovesPayload::NAME, move |event| {
            observed
                .lock()
                .unwrap()
                .push(serde_json::from_str::<serde_json::Value>(event.payload()).unwrap());
        });

        let (actor, _) = EngineActor::recording_test_actor(lines);
        let request_id = actor.start_search(&GoMode::Depth(16)).await.unwrap();
        let generation = 9_007_199_254_740_993;
        InteractiveSearchProbe {
            app,
            emitted,
            actor: actor.clone(),
            supervised: SupervisedEngine::new(
                generation,
                "engine".into(),
                crate::infra::path_authority::PathRef {
                    id: "engine-path".into(),
                },
                actor.clone(),
                Arc::new(AtomicBool::new(cancelled)),
            ),
            process: EngineProcess {
                base: actor,
                last_depth: 0,
                best_moves: Vec::new(),
                last_best_moves: Vec::new(),
                last_progress: 0.0,
                options: EngineOptions {
                    fen: start_fen().to_string(),
                    moves: Vec::new(),
                    extra_options: Vec::new(),
                },
                resource_leases: Vec::new(),
                go_mode: GoMode::Depth(16),
                running: true,
                request_id: Some(request_id),
                real_multipv: 1,
                start: Instant::now(),
            },
            generation,
        }
    }

    const INTERACTIVE_SEARCH_LINES: [&str; 2] = [
        "info depth 8 multipv 1 score cp 34 nodes 100 pv e2e4",
        "bestmove e2e4",
    ];

    #[tokio::test]
    async fn interactive_producer_emits_supervised_generation_for_info_and_terminal_payloads() {
        let mut probe = interactive_search_probe(&INTERACTIVE_SEARCH_LINES, false).await;

        process_interactive_search_output(
            &mut probe.process,
            "engine",
            "tab",
            &probe.supervised,
            &probe.app,
        )
        .await
        .unwrap();

        {
            let payloads = probe.emitted.lock().unwrap();
            assert_eq!(payloads.len(), 2);
            assert_eq!(payloads[0]["progress"], 50.0);
            assert_eq!(payloads[0]["generation"], probe.generation.to_string());
            assert_eq!(payloads[1]["progress"], 100.0);
            assert_eq!(payloads[1]["generation"], probe.generation.to_string());
        }
        probe.actor.terminate().await.unwrap();
    }

    #[tokio::test]
    async fn interactive_producer_skips_payloads_when_search_already_cancelled() {
        let mut probe = interactive_search_probe(&INTERACTIVE_SEARCH_LINES, true).await;

        process_interactive_search_output(
            &mut probe.process,
            "engine",
            "tab",
            &probe.supervised,
            &probe.app,
        )
        .await
        .unwrap();

        assert!(probe.emitted.lock().unwrap().is_empty());
        assert_eq!(probe.process.last_progress, 0.0);
        probe.actor.terminate().await.unwrap();
    }

    #[tokio::test]
    async fn interactive_producer_skips_payloads_when_cancelled_after_dequeued_info() {
        let mut probe = interactive_search_probe(&INTERACTIVE_SEARCH_LINES, false).await;
        let cancelled = probe.supervised.cancelled.clone();
        ANALYSIS_LINE_DEQUEUED_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move |line| {
                    if line.starts_with("info ") {
                        cancelled.store(true, Ordering::SeqCst);
                    }
                })))
                .is_none());
        });

        process_interactive_search_output(
            &mut probe.process,
            "engine",
            "tab",
            &probe.supervised,
            &probe.app,
        )
        .await
        .unwrap();

        assert!(probe.emitted.lock().unwrap().is_empty());
        assert_eq!(probe.process.last_progress, 0.0);
        ANALYSIS_LINE_DEQUEUED_HOOK.with(|slot| {
            slot.replace(None);
        });
        probe.actor.terminate().await.unwrap();
    }

    #[tokio::test]
    async fn interactive_producer_skips_terminal_payload_when_cancelled_after_dequeued_bestmove() {
        let mut probe = interactive_search_probe(&INTERACTIVE_SEARCH_LINES, false).await;
        let cancelled = probe.supervised.cancelled.clone();
        ANALYSIS_LINE_DEQUEUED_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move |line| {
                    if matches!(parse_one(line), UciMessage::BestMove { .. }) {
                        cancelled.store(true, Ordering::SeqCst);
                    }
                })))
                .is_none());
        });

        process_interactive_search_output(
            &mut probe.process,
            "engine",
            "tab",
            &probe.supervised,
            &probe.app,
        )
        .await
        .unwrap();

        {
            let payloads = probe.emitted.lock().unwrap();
            assert_eq!(payloads.len(), 1);
            assert_eq!(payloads[0]["progress"], 50.0);
            assert_eq!(payloads[0]["generation"], probe.generation.to_string());
        }
        assert_eq!(probe.process.last_progress, 50.0);
        ANALYSIS_LINE_DEQUEUED_HOOK.with(|slot| {
            slot.replace(None);
        });
        probe.actor.terminate().await.unwrap();
    }

    #[test]
    fn cancelled_interactive_search_normalizes_only_expected_stop_consequences() {
        assert!(matches!(
            classify_interactive_search_result(Err(Error::EngineDisconnected), true),
            Err(Error::Cancellation)
        ));
        assert!(matches!(
            classify_interactive_search_result(Ok(()), true),
            Err(Error::Cancellation)
        ));

        let combined = Error::OperationAndCleanup {
            primary: "search failed".into(),
            cleanup: "reap failed".into(),
        };
        assert!(matches!(
            classify_interactive_search_result(Err(combined), true),
            Err(Error::OperationAndCleanup { primary, cleanup })
                if primary == "search failed" && cleanup == "reap failed"
        ));
    }

    #[tokio::test]
    async fn set_options_collapses_duplicate_multipv_last_wins() {
        let (actor, writes) = EngineActor::recording_test_actor(&["readyok"]);
        let mut process = EngineProcess {
            base: actor,
            last_depth: 0,
            best_moves: Vec::new(),
            last_best_moves: Vec::new(),
            last_progress: 0.0,
            options: EngineOptions::default(),
            resource_leases: Vec::new(),
            go_mode: GoMode::Infinite,
            running: false,
            request_id: None,
            real_multipv: 0,
            start: Instant::now(),
        };
        let options = EngineOptions {
            fen: start_fen().to_string(),
            moves: Vec::new(),
            extra_options: vec![string_option("MultiPV", "2"), string_option("MultiPV", "4")],
        };

        process
            .set_options(
                options,
                vec![
                    resolved_option("MultiPV", "2"),
                    resolved_option("MultiPV", "4"),
                ],
            )
            .await
            .unwrap();

        let writes = writes.lock().await;
        assert_eq!(
            writes
                .iter()
                .filter(|line| line.as_str() == "setoption name MultiPV value 4")
                .count(),
            1
        );
        assert!(!writes
            .iter()
            .any(|line| line == "setoption name MultiPV value 2"));
        assert_eq!(process.real_multipv, 4);
        drop(writes);
        process.base.terminate().await.unwrap();
    }

    #[tokio::test]
    async fn set_options_passes_resource_provenance_to_actor_logs() {
        let resource = "/proc/self/fd/77".to_string();
        let (actor, writes) = EngineActor::recording_test_actor(&["readyok", &resource]);
        let mut process = EngineProcess {
            base: actor.clone(),
            last_depth: 0,
            best_moves: Vec::new(),
            last_best_moves: Vec::new(),
            last_progress: 0.0,
            options: EngineOptions::default(),
            resource_leases: Vec::new(),
            go_mode: GoMode::Infinite,
            running: false,
            request_id: None,
            real_multipv: 0,
            start: Instant::now(),
        };

        process
            .set_options(
                EngineOptions {
                    fen: start_fen().to_string(),
                    moves: Vec::new(),
                    extra_options: vec![string_option("EvalFile", &resource)],
                },
                vec![ResolvedEngineOption {
                    name: "EvalFile".into(),
                    value: resource.clone(),
                    resources: Vec::new(),
                    resource_values: vec![resource.clone()],
                }],
            )
            .await
            .unwrap();
        assert_eq!(
            actor.next_configuration_line().await.unwrap(),
            Some(resource.clone())
        );
        assert!(writes
            .lock()
            .await
            .iter()
            .any(|line| line == &format!("setoption name EvalFile value {resource}")));
        let logs = actor.logs().await.unwrap();
        assert!(logs.iter().all(|entry| match entry {
            EngineLog::Gui(line) | EngineLog::Engine(line) => !line.contains(&resource),
            EngineLog::Truncated { .. } => true,
        }));
        actor.terminate().await.unwrap();
    }

    #[test]
    fn report_option_prep_collapses_and_forces_multipv_on_both_sides() {
        let originals = vec![string_option("MultiPV", "2"), string_option("MultiPV", "4")];
        let inherited = HashMap::from([("MultiPV".into(), "4".into())]);

        let (extras, inherited) = prepare_report_options(&originals, &inherited);

        assert_eq!(
            extras,
            vec![string_option("MultiPV", &REPORT_MULTIPV.to_string())]
        );
        assert_eq!(inherited.get("MultiPV"), Some(&REPORT_MULTIPV.to_string()));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn report_core_restores_child_resource_provenance_after_fresh_resolution() {
        let (_directory, app, engine, resource) = resource_engine_fixture();
        let option = EngineOption::Resource {
            name: "EvalFile".into(),
            resources: vec![resource.clone()],
        };

        // Each resolution owns a new descriptor. The report path must keep the
        // descriptor inherited by the already-running child when it re-resolves
        // the same opaque handle for a report position.
        let (initial, refreshed) = {
            let state = app.state::<AppState>();
            let mut authority = state.pgn_path_authority.lock().unwrap();
            let authority = authority.as_mut().unwrap();
            let initial_option = resolve_engine_options(authority, std::slice::from_ref(&option))
                .unwrap()
                .pop()
                .unwrap();
            let initial = initial_option.resource_values[0].clone();
            let refreshed_option = resolve_engine_options(authority, std::slice::from_ref(&option))
                .unwrap()
                .pop()
                .unwrap();
            let refreshed = refreshed_option.resource_values[0].clone();
            (initial, refreshed)
        };
        assert_ne!(initial, refreshed);

        let state = app.state::<AppState>().inner().clone();
        let supervisor = state.engine_supervisor.clone();
        let app_for_core = app.clone();
        let core = tokio::spawn(async move {
            analyze_game_core(
                "report-resource".into(),
                engine,
                "report-resource-engine".into(),
                GoMode::Depth(1),
                AnalysisOptions {
                    fen: start_fen().to_string(),
                    moves: Vec::new(),
                    annotate_novelties: false,
                    reference_db: None,
                    reversed: false,
                },
                vec![option],
                state,
                app_for_core,
                CancellationToken::new(),
            )
            .await
        });
        let key = EngineKey::new("analysis".into(), "report-resource".into()).unwrap();
        let (logs, result) =
            collect_barriered_resource_logs(&_directory, &supervisor, &key, core).await;
        let result = result.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].best.len(), 2);
        assert_safe_resource_logs(&logs);
        assert!(supervisor.get_exact(&key).is_none());
        assert_resource_wire_capture(&_directory, "resource-bytes");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn invalid_initial_resource_does_not_leave_report_progress_running() {
        use crate::infra::path_authority::{
            EngineResourceHandle, EngineResourceHandleKind, PathRef,
        };

        let (_directory, app, engine, _) = resource_engine_fixture();
        let id = "invalid-initial-resource";
        let state = app.state::<AppState>().inner().clone();
        let invalid_resource = EngineResourceHandle::new(
            PathRef {
                id: "missing-resource".into(),
            },
            EngineResourceHandleKind::File,
            "missing-resource".into(),
        );
        let result = analyze_game_core(
            id.into(),
            engine,
            "invalid-resource-engine".into(),
            GoMode::Depth(1),
            AnalysisOptions {
                fen: start_fen().to_string(),
                moves: Vec::new(),
                annotate_novelties: false,
                reference_db: None,
                reversed: false,
            },
            vec![EngineOption::Resource {
                name: "EvalFile".into(),
                resources: vec![invalid_resource],
            }],
            state.clone(),
            app.clone(),
            CancellationToken::new(),
        )
        .await;
        assert!(result.is_err());
        assert!(state.progress_state.get(id).unwrap().is_none());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn get_best_moves_core_wires_resource_options_through_production_flow() {
        let (_directory, app, engine, resource) = resource_engine_fixture();
        let state = app.state::<AppState>();
        let key = EngineKey::new(
            "interactive-resource".into(),
            "interactive-resource-engine".into(),
        )
        .unwrap();
        let generation = state
            .engine_supervisor
            .prepare_engine_search(key, "interactive-resource-engine".into(), engine.id.clone())
            .await
            .unwrap();
        let supervisor = state.engine_supervisor.clone();
        let app_for_core = app.clone();
        let state_for_core = state.inner().clone();
        let core = tokio::spawn(async move {
            get_best_moves_core(
                "interactive-resource-engine".into(),
                engine,
                "interactive-resource".into(),
                GoMode::Depth(1),
                EngineOptions {
                    fen: start_fen().to_string(),
                    moves: Vec::new(),
                    extra_options: vec![EngineOption::Resource {
                        name: "EvalFile".into(),
                        resources: vec![resource],
                    }],
                },
                generation,
                app_for_core,
                state_for_core,
            )
            .await
        });
        let key = EngineKey::new(
            "interactive-resource".into(),
            "interactive-resource-engine".into(),
        )
        .unwrap();
        let (logs, result) =
            collect_barriered_resource_logs(&_directory, &supervisor, &key, core).await;
        let result = result.unwrap();
        assert!(result.is_none());
        assert_safe_resource_logs(&logs);
        assert!(supervisor.get_exact(&key).is_none());
        assert_resource_wire_capture(&_directory, "resource-bytes");
    }

    #[tokio::test]
    async fn retire_engine_command_delegate_reaps_and_tombstones_owner() {
        let supervisor = crate::engine::EngineSupervisor::default();
        let key = EngineKey::new("tab".into(), "engine-id".into()).unwrap();
        let (actor, _) = EngineActor::recording_test_actor(&[]);
        supervisor
            .replace_handle(
                key.clone(),
                actor,
                "engine-id".into(),
                crate::infra::path_authority::PathRef {
                    id: "engine-path".into(),
                },
            )
            .await
            .unwrap();

        retire_engine_with_supervisor("engine-id".into(), &supervisor)
            .await
            .unwrap();

        assert!(supervisor.get_exact(&key).is_none());
        let (replacement, _) = EngineActor::recording_test_actor(&[]);
        assert!(supervisor
            .replace_handle(
                key,
                replacement,
                "engine-id".into(),
                crate::infra::path_authority::PathRef {
                    id: "engine-path".into(),
                },
            )
            .await
            .is_err());

        let source = include_str!("chess.rs");
        let command = source
            .split_once("pub async fn retire_engine(")
            .map(|(_, suffix)| suffix)
            .expect("retire_engine command must exist");
        let body = command
            .split_once("#[tauri::command]")
            .map(|(body, _)| body)
            .unwrap_or(command);
        assert!(
            body.contains("retire_engine_with_supervisor(engine, &state.engine_supervisor).await"),
            "the Specta command must delegate to the tested supervisor retirement"
        );
    }

    #[tokio::test]
    async fn engine_logs_command_contract_distinguishes_absent_and_disconnected() {
        let supervisor = crate::engine::EngineSupervisor::default();
        let missing = EngineKey::new("tab".into(), "missing".into()).unwrap();
        assert!(get_engine_logs_from_supervisor(&supervisor, &missing)
            .await
            .unwrap()
            .is_empty());

        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let (actor, _) = EngineActor::recording_test_actor(&[]);
        let supervised = supervisor
            .replace_handle(
                key.clone(),
                actor.clone(),
                "engine".into(),
                crate::infra::path_authority::PathRef {
                    id: "engine-path".into(),
                },
            )
            .await
            .unwrap();
        actor.terminate().await.unwrap();
        assert!(matches!(
            get_engine_logs_from_supervisor(&supervisor, &key).await,
            Err(Error::EngineDisconnected)
        ));
        supervisor
            .terminate_exact(&key, supervised.generation)
            .await
            .unwrap();
    }

    #[test]
    fn interactive_commands_register_through_engine_process_new() {
        let source = include_str!("chess.rs");
        for function in ["pub async fn get_best_moves", "pub async fn analyze_game"] {
            let start = source.find(function).expect("command must exist");
            let suffix = &source[start + function.len()..];
            // Delimit before `mod tests` so later test-only `replace_handle`
            // call sites are not part of the production command body.
            let end = [
                suffix.find("\nmod tests"),
                suffix.find("\n#[tauri::command]"),
            ]
            .into_iter()
            .flatten()
            .min()
            .unwrap_or(suffix.len());
            let body = &suffix[..end];
            if function == "pub async fn get_best_moves" {
                assert!(body.contains("get_best_moves_core("));
            } else {
                assert!(body.contains("analyze_game_core("));
            }
        }
    }

    #[test]
    fn config_probe_uses_a_unique_supervised_key() {
        let source = include_str!("chess.rs");
        let body = source
            .split_once("pub async fn get_engine_config(")
            .map(|(_, body)| body)
            .expect("get_engine_config must exist");
        assert!(body.contains("Uuid::new_v4()"));
        assert!(body.contains("EngineKey::new(\"engine-config\""));
        assert!(body.contains("spawn_registered("));
        assert!(body.contains("terminate_exact(&key, supervised.generation)"));
    }

    fn pos(fen: &str) -> Chess {
        let fen: Fen = fen.parse().unwrap();
        Chess::from_setup(fen.into_setup(), CastlingMode::Chess960).unwrap()
    }

    fn start_fen() -> Fen {
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            .parse()
            .unwrap()
    }

    fn parsed_info(line: &str) -> BestMoves {
        match parse_one(line) {
            UciMessage::Info(attrs) => parse_uci_attrs(attrs, &start_fen(), &[]).unwrap(),
            other => panic!("expected info, got {other:?}"),
        }
    }

    fn ingest(
        collected: &mut Vec<BestMoves>,
        last_depth: u32,
        real_multipv: u16,
        line: &str,
    ) -> Option<CompleteMultiPv> {
        ingest_info_line(collected, last_depth, real_multipv, parsed_info(line))
    }

    #[test]
    fn ingest_skips_lowerbound_and_keeps_the_exact_score() {
        let mut collected = Vec::new();
        assert!(ingest(
            &mut collected,
            0,
            1,
            "info depth 8 multipv 1 score cp 12 lowerbound nodes 100 pv e2e4"
        )
        .is_none());
        assert!(collected.is_empty());

        let set = ingest(
            &mut collected,
            0,
            1,
            "info depth 8 multipv 1 score cp 34 nodes 100 pv e2e4",
        )
        .expect("exact score should complete MultiPV 1");
        assert!(set.publishable);
        assert!(collected.is_empty());
        assert_eq!(set.lines[0].score.value, ScoreValue::Cp(34));
        assert_ne!(set.lines[0].score.lower_bound, Some(true));
    }

    #[test]
    fn ingest_skips_upperbound() {
        let mut collected = Vec::new();
        assert!(ingest(
            &mut collected,
            0,
            1,
            "info depth 8 multipv 1 score cp 12 upperbound nodes 100 pv e2e4"
        )
        .is_none());
        assert!(collected.is_empty());
    }

    #[test]
    fn ingest_bound_between_pvs_does_not_desync_sequence() {
        let mut collected = Vec::new();
        assert!(ingest(
            &mut collected,
            0,
            2,
            "info depth 8 multipv 1 score cp 20 nodes 100 pv e2e4"
        )
        .is_none());
        assert_eq!(collected.len(), 1);

        assert!(ingest(
            &mut collected,
            0,
            2,
            "info depth 8 multipv 1 score cp 40 lowerbound nodes 100 pv e2e4"
        )
        .is_none());
        assert_eq!(collected.len(), 1);

        let set = ingest(
            &mut collected,
            0,
            2,
            "info depth 8 multipv 2 score cp 5 nodes 100 pv d2d4",
        )
        .expect("PV2 should complete after a bound on PV1");
        assert!(set.publishable);
        assert!(collected.is_empty());
        assert_eq!(set.lines.len(), 2);
        assert_eq!(set.lines[0].score.value, ScoreValue::Cp(20));
        assert_eq!(set.lines[1].score.value, ScoreValue::Cp(5));
    }

    #[test]
    fn ingest_rejects_out_of_sequence_multipv() {
        let mut collected = Vec::new();
        assert!(ingest(
            &mut collected,
            0,
            2,
            "info depth 8 multipv 2 score cp 5 nodes 100 pv d2d4"
        )
        .is_none());
        assert!(collected.is_empty());
    }

    #[test]
    fn ingest_mixed_depth_set_is_complete_but_not_publishable() {
        let mut collected = Vec::new();
        assert!(ingest(
            &mut collected,
            0,
            2,
            "info depth 8 multipv 1 score cp 20 nodes 100 pv e2e4"
        )
        .is_none());
        let set = ingest(
            &mut collected,
            0,
            2,
            "info depth 7 multipv 2 score cp 5 nodes 100 pv d2d4",
        )
        .expect("mixed depths still complete the sequence");
        assert!(collected.is_empty());
        assert!(!set.publishable);
        assert_eq!(set.lines.len(), 2);
    }

    #[test]
    fn ingest_shallower_than_last_depth_is_not_publishable() {
        let mut collected = Vec::new();
        let set = ingest(
            &mut collected,
            10,
            1,
            "info depth 8 multipv 1 score cp 20 nodes 100 pv e2e4",
        )
        .expect("a shallower set still completes MultiPV 1");
        assert!(collected.is_empty());
        assert!(!set.publishable);
        assert_eq!(set.depth, 8);
    }

    #[test]
    fn parse_uci_attrs_rejects_pv_without_score() {
        let attrs = match parse_one("info depth 8 multipv 1 nodes 100 pv e2e4") {
            UciMessage::Info(attrs) => attrs,
            other => panic!("expected info, got {other:?}"),
        };
        assert!(matches!(
            parse_uci_attrs(attrs, &start_fen(), &[]),
            Err(Error::NoMovesFound)
        ));
    }

    #[test]
    fn production_uci_paths_share_ingest_and_live_publish() {
        let source = include_str!("chess.rs");
        let production = source
            .split_once("mod tests {")
            .map(|(prefix, _)| prefix)
            .expect("test module should exist");

        for (function, expected_call) in [
            (
                "async fn process_interactive_search_output",
                "ingest_info_line(",
            ),
            (
                "async fn process_interactive_search_output",
                "emit_live_interactive_best_moves(",
            ),
            (
                "async fn process_interactive_search_output",
                "interactive_best_moves_payload(",
            ),
            ("pub async fn get_best_moves", "get_best_moves_core("),
            (
                "async fn get_best_moves_core<",
                "process_interactive_search_output(",
            ),
            ("pub async fn analyze_game(", "analyze_game_core("),
            (
                "async fn analyze_game_core<",
                "analyze_position_with_owner(",
            ),
            ("async fn analyze_position_with_owner(", "ingest_info_line("),
        ] {
            let body = crate::infra::blocking::source_scan::body_at_indent(production, function);
            assert!(
                body.contains(expected_call),
                "{function} must use {expected_call}"
            );
        }
    }

    #[test]
    fn eval_start_pos() {
        assert_eq!(naive_eval(&Chess::default()), 0);
    }

    #[test]
    fn eval_scandi() {
        let position = pos("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
        assert_eq!(naive_eval(&position), 0);
    }

    #[test]
    fn eval_hanging_pawn() {
        let position = pos("r1bqkbnr/ppp1pppp/2n5/1B1p4/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3");
        assert_eq!(naive_eval(&position), 100);
    }

    #[test]
    fn eval_complex_center() {
        let position = pos("r1bqkbnr/ppp2ppp/2n5/1B1pp3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4");
        assert_eq!(naive_eval(&position), 100);
    }

    #[test]
    fn eval_in_check() {
        let position = pos("r1bqkbnr/ppp2ppp/2B5/3pp3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4");
        assert_eq!(naive_eval(&position), -100);
    }

    #[test]
    fn eval_rook_stack() {
        let position = pos("rnrq4/8/8/1R6/1R6/1R5K/1Q6/7k w - - 0 1");
        assert_eq!(naive_eval(&position), MATE_SCORE);
    }

    #[test]
    fn eval_rook_stack2() {
        let position = pos("rnrq4/8/8/1R6/1Q6/1R5K/1R6/7k w - - 0 1");
        assert_eq!(naive_eval(&position), MATE_SCORE);
    }

    #[test]
    fn eval_opera_game1() {
        let position = pos("4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2K4R w k - 0 14");
        // White evaluates ahead
        assert_eq!(naive_eval(&position), -100);
    }

    #[test]
    fn eval_opera_game2() {
        let position = pos("4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 b k - 1 14");
        // Black's position is worse
        assert_eq!(naive_eval(&position), 0);
    }

    #[test]
    fn eval_terminal_positions_have_documented_scores() {
        let mate = pos("7k/6Q1/7K/8/8/8/8/8 b - - 0 1");
        let stalemate = pos("7k/5Q2/7K/8/8/8/8/8 b - - 0 1");
        assert_eq!(naive_eval(&mate), -MATE_SCORE);
        assert_eq!(naive_eval(&stalemate), 0);
    }
}

#[derive(Type, Default, Serialize, Debug)]
pub struct EngineConfig {
    pub name: String,
    pub options: Vec<UciOptionConfig>,
}

const MAX_ENGINE_OPTIONS: usize = 512;

async fn collect_engine_configuration(base: Arc<EngineActor>) -> Result<EngineConfig, Error> {
    base.start_uci_configuration().await?;

    // The per-line timeout in `next_configuration_line` only protects a
    // silent process. A chatty process which never sends `uciok` must be
    // bounded too, otherwise it can keep this command alive indefinitely.
    tokio::time::timeout(EngineDeadlines::default().uciok, async {
        let mut config = EngineConfig::default();
        while let Some(line) = base.next_configuration_line().await? {
            if let UciMessage::Id {
                name: Some(name),
                author: _,
            } = parse_one(&line)
            {
                config.name = name;
            }
            if let UciMessage::Option(opt) = parse_one(&line) {
                if config.options.len() == MAX_ENGINE_OPTIONS {
                    return Err(Error::ResourceLimit(format!(
                        "engine advertised more than {MAX_ENGINE_OPTIONS} options"
                    )));
                }
                config.options.push(opt);
            }
            if let UciMessage::UciOk = parse_one(&line) {
                return Ok(config);
            }
        }
        Err(Error::EngineDisconnected)
    })
    .await
    .map_err(|_| Error::EngineTimeout("collecting engine configuration".into()))?
}

#[tauri::command]
#[specta::specta]
pub async fn get_engine_config(
    engine: EngineHandle,
    state: tauri::State<'_, AppState>,
) -> Result<EngineConfig, Error> {
    let executable_ref = engine.id.clone();
    let executable = resolve_engine_executable(&state, &engine, PathOperation::EngineConfigure)?;
    let probe_id = uuid::Uuid::new_v4().to_string();
    let key = EngineKey::new("engine-config".into(), probe_id.clone())?;
    let (supervised, config) = spawn_registered(
        state.engine_supervisor.clone(),
        key.clone(),
        executable,
        probe_id,
        executable_ref,
        None,
        collect_engine_configuration,
    )
    .await?;
    state
        .engine_supervisor
        .terminate_exact(&key, supervised.generation)
        .await?;
    Ok(config)
}
