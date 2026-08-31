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
    db::{is_position_in_db, GameQuery, PositionQueryJs},
    engine::{
        parse_fen_and_apply_moves, resolve_engine_options, EngineActor, EngineDeadlines, EngineKey,
        EngineLog, EngineOption, EngineRequestId, GoMode, ResolvedEngineOption,
    },
    error::Error,
    infra::path_authority::{DatabaseHandle, EngineExecutable, EngineHandle, PathOperation},
    progress::{begin_progress, update_progress_with_state, ProgressState},
    AppState,
};

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
    async fn new(executable: EngineExecutable) -> Result<Self, Error> {
        let base =
            Arc::new(EngineActor::spawn_initialized(executable, EngineDeadlines::default()).await?);
        Ok(Self {
            base,
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
        })
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

        let multipv = options
            .extra_options
            .iter()
            .find(|x| x.name() == "MultiPV")
            .map(|x| match x {
                EngineOption::String { value, .. } => value
                    .parse::<u16>()
                    .map_err(|_| Error::InvalidInput("MultiPV must be a positive integer".into())),
                EngineOption::Resource { .. } => Err(Error::InvalidInput(
                    "MultiPV must be a positive integer".into(),
                )),
            })
            .transpose()?
            .unwrap_or(1);
        if multipv == 0 {
            return Err(Error::InvalidInput("MultiPV must be at least one".into()));
        }

        self.real_multipv = multipv.min(pos.legal_moves().len() as u16);

        let mut next_resource_leases = Vec::new();
        for (option, mut resolved) in options.extra_options.iter().zip(resolved) {
            if !self.options.extra_options.contains(option) && option.name() != "UCI_Chess960" {
                self.set_option(&resolved.name, &resolved.value).await?;
            }
            next_resource_leases.append(&mut resolved.resources);
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

    pub(crate) async fn kill(&mut self) -> Result<(), Error> {
        self.base.terminate().await?;
        self.running = false;
        self.request_id = None;
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
            }
            _ => (),
        }
    }

    if best_moves.san_moves.is_empty() {
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

/// A finished MultiPV set sitting in `collected`. Callers publish only when
/// `publishable`, but they always clear `collected` afterwards — mixed-depth
/// and shallower sets still complete the sequence.
struct CompleteMultiPv {
    depth: u32,
    nodes: u64,
    publishable: bool,
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
    Some(CompleteMultiPv {
        depth,
        nodes,
        publishable,
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
pub async fn kill_engines(tab: String, state: tauri::State<'_, AppState>) -> Result<(), Error> {
    state.engine_supervisor.terminate_tab(&tab).await
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
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let key = EngineKey::new(tab, engine)?;
    if let Some(process) = state.engine_supervisor.get_exact(&key) {
        process.actor.stop_current().await?;
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
    if let Some(process) = state.engine_supervisor.get_exact(&key) {
        Ok(process.actor.logs().await)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_best_moves(
    id: String,
    engine: EngineHandle,
    tab: String,
    go_mode: GoMode,
    options: EngineOptions,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<(f32, Vec<BestMoves>)>, Error> {
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

    let key = EngineKey::new(tab.clone(), id.clone())?;

    let mut process = EngineProcess::new(executable.with_resource_leases(child_leases)).await?;
    let supervised = match state
        .engine_supervisor
        .replace_handle(key.clone(), process.base.clone())
        .await
    {
        Ok(supervised) => supervised,
        Err(error) => {
            let cleanup = process.kill().await;
            return match cleanup {
                Ok(()) => Err(error),
                Err(cleanup) => Err(Error::OperationAndCleanup {
                    primary: error.to_string(),
                    cleanup: cleanup.to_string(),
                }),
            };
        }
    };

    let lim = RateLimiter::direct(Quota::per_second(nonzero!(5u32)));

    let run_result: Result<(), Error> = async {
        process.set_options(options.clone(), resolved).await?;
        process.go(&go_mode).await?;
        loop {
            let line = { process.next_line().await? };
            let Some(line) = line else {
                break;
            };
            let proc = &mut process;
            match parse_one(&line) {
                UciMessage::Info(attrs) => {
                    match parse_uci_attrs(attrs, &proc.options.fen.parse()?, &proc.options.moves) {
                        Ok(best_moves) => {
                            if let Some(set) = ingest_info_line(
                                &mut proc.best_moves,
                                proc.last_depth,
                                proc.real_multipv,
                                best_moves,
                            ) {
                                if set.publishable && lim.check().is_ok() {
                                    let progress = (match proc.go_mode {
                                        GoMode::Depth(depth) => {
                                            (set.depth as f64 / depth as f64) * 100.0
                                        }
                                        GoMode::Time(time) => {
                                            (proc.start.elapsed().as_millis() as f64 / time as f64)
                                                * 100.0
                                        }
                                        GoMode::Nodes(nodes) => {
                                            (set.nodes as f64 / nodes as f64) * 100.0
                                        }
                                        GoMode::PlayersTime(_) => 99.99,
                                        GoMode::Infinite => 99.99,
                                    })
                                    .clamp(0.0, 100.0);
                                    BestMovesPayload {
                                        best_lines: proc.best_moves.clone(),
                                        engine: id.clone(),
                                        tab: tab.clone(),
                                        fen: proc.options.fen.clone(),
                                        moves: proc.options.moves.clone(),
                                        progress,
                                    }
                                    .emit(&app)?;
                                    proc.last_depth = set.depth;
                                    proc.last_best_moves = proc.best_moves.clone();
                                    proc.last_progress = progress as f32;
                                }
                                proc.best_moves.clear();
                            }
                        }
                        Err(e) => match e {
                            Error::NoMovesFound => {}
                            _ => {
                                warn!("Failed to parse info line: {}, error: {:?}", line, e);
                            }
                        },
                    }
                }
                UciMessage::BestMove { .. } => {
                    BestMovesPayload {
                        best_lines: proc.last_best_moves.clone(),
                        engine: id.clone(),
                        tab: tab.clone(),
                        fen: proc.options.fen.clone(),
                        moves: proc.options.moves.clone(),
                        progress: 100.0,
                    }
                    .emit(&app)?;
                    proc.last_progress = 100.0;
                }
                _ => {}
            }
        }
        Ok(())
    }
    .await;
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

#[tauri::command]
#[specta::specta]
pub async fn cancel_analysis(id: String, state: tauri::State<'_, AppState>) -> Result<(), Error> {
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
pub async fn analyze_game(
    id: String,
    engine: EngineHandle,
    go_mode: GoMode,
    options: AnalysisOptions,
    uci_options: Vec<EngineOption>,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Vec<MoveAnalysis>, Error> {
    let executable = resolve_engine_executable(&state, &engine, PathOperation::EngineExecute)?;
    let analysis_key = EngineKey::new("analysis".into(), id.clone())?;
    let mut analysis: Vec<MoveAnalysis> = Vec::new();

    let fen = Fen::from_ascii(options.fen.as_bytes())?;
    let setup = fen.as_setup().clone();
    let castling_mode = CastlingMode::detect(&setup);

    let mut chess: Chess = setup.position(castling_mode)?;
    let mut fens: Vec<(Fen, Vec<String>, bool)> = vec![(fen, vec![], false)];

    options
        .moves
        .iter()
        .enumerate()
        .try_for_each(|(i, m)| -> Result<(), Error> {
            let uci = UciMove::from_ascii(m.as_bytes())?;
            let m = uci.to_move(&chess)?;
            let previous_pos = chess.clone();
            chess.play_unchecked(&m);
            let current_pos = chess.clone();
            if !chess.is_game_over() {
                let prev_eval = naive_eval(&previous_pos);
                let cur_eval = -naive_eval(&current_pos);
                fens.push((
                    Fen::from_position(current_pos, EnPassantMode::Legal),
                    options.moves.clone().into_iter().take(i + 1).collect(),
                    prev_eval > cur_eval + 100,
                ));
            }
            Ok(())
        })?;

    if options.reversed {
        fens.reverse();
    }

    let progress_lease = begin_progress(&state.progress_state, &app, id.clone())?;
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
    let inherited_values: HashMap<String, String> = initial_resolved
        .iter()
        .map(|option| (option.name.clone(), option.value.clone()))
        .collect();
    let child_leases = initial_resolved
        .iter_mut()
        .flat_map(|option| std::mem::take(&mut option.resources))
        .collect();

    // Validate all position input and acquire the progress lease before a
    // child exists. Every path after this registration goes through the
    // cleanup-aware failure macro below.
    let mut proc = match EngineProcess::new(executable.with_resource_leases(child_leases)).await {
        Ok(process) => process,
        Err(error) => {
            let _ = update_progress_with_state(
                &state.progress_state,
                &app,
                &progress_lease,
                0.0,
                ProgressState::Failed,
            );
            return Err(error);
        }
    };
    let supervised = match state
        .engine_supervisor
        .replace_handle(analysis_key.clone(), proc.base.clone())
        .await
    {
        Ok(supervised) => supervised,
        Err(primary) => {
            let _ = update_progress_with_state(
                &state.progress_state,
                &app,
                &progress_lease,
                0.0,
                ProgressState::Failed,
            );
            match proc.kill().await {
                Ok(()) => return Err(primary),
                Err(cleanup) => {
                    return Err(Error::OperationAndCleanup {
                        primary: primary.to_string(),
                        cleanup: cleanup.to_string(),
                    })
                }
            }
        }
    };

    macro_rules! fail_analysis_progress {
        ($error:expr) => {{
            let error = $error;
            let cleanup = state
                .engine_supervisor
                .terminate_exact(&analysis_key, supervised.generation)
                .await;
            let _ = update_progress_with_state(
                &state.progress_state,
                &app,
                &progress_lease,
                0.0,
                ProgressState::Failed,
            );
            return match cleanup {
                Ok(()) => Err(error),
                Err(cleanup) => Err(Error::OperationAndCleanup {
                    primary: error.to_string(),
                    cleanup: cleanup.to_string(),
                }),
            };
        }};
    }

    let mut novelty_found = false;

    for (i, (_, moves, _)) in fens.iter().enumerate() {
        if supervised.cancelled.load(Ordering::SeqCst) {
            let cleanup = state
                .engine_supervisor
                .terminate_exact(&analysis_key, supervised.generation)
                .await;
            let terminal = update_progress_with_state(
                &state.progress_state,
                &app,
                &progress_lease,
                0.0,
                ProgressState::Cancelled,
            );
            return match (cleanup, terminal) {
                (Ok(()), Ok(())) => Err(Error::AnalysisCancelled),
                (Err(cleanup), Ok(())) => Err(Error::OperationAndCleanup {
                    primary: Error::AnalysisCancelled.to_string(),
                    cleanup: cleanup.to_string(),
                }),
                (Ok(()), Err(terminal)) => Err(terminal),
                (Err(cleanup), Err(terminal)) => Err(Error::OperationAndCleanup {
                    primary: terminal.to_string(),
                    cleanup: cleanup.to_string(),
                }),
            };
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

        let mut extra_options = uci_options.clone();
        if !extra_options.iter().any(|x| x.name() == "MultiPV") {
            extra_options.push(EngineOption::String {
                name: "MultiPV".to_string(),
                value: "2".to_string(),
            });
        } else {
            extra_options.iter_mut().for_each(|x| {
                if x.name() == "MultiPV" {
                    if let EngineOption::String { value, .. } = x {
                        *value = "2".to_string();
                    }
                }
            });
        }

        let configured_options = EngineOptions {
            fen: options.fen.clone(),
            moves: moves.clone(),
            extra_options,
        };
        let mut resolved = {
            let mut authority = state
                .pgn_path_authority
                .lock()
                .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
            resolve_engine_options(
                authority
                    .as_mut()
                    .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?,
                &configured_options.extra_options,
            )?
        };
        for option in &mut resolved {
            if let Some(value) = inherited_values.get(&option.name) {
                option.value = value.clone();
                option.resources.clear();
            }
        }
        if let Err(error) = proc.set_options(configured_options, resolved).await {
            fail_analysis_progress!(error);
        }

        if let Err(error) = proc.go(&go_mode).await {
            fail_analysis_progress!(error);
        }

        let mut current_analysis = MoveAnalysis::default();
        loop {
            let line = match proc.next_line_cancellable(&supervised.cancelled).await {
                Ok(line) => line,
                Err(error) => fail_analysis_progress!(error),
            };
            let Some(line) = line else {
                fail_analysis_progress!(Error::EngineDisconnected);
            };
            match parse_one(&line) {
                UciMessage::Info(attrs) => {
                    if let Ok(best_moves) =
                        parse_uci_attrs(attrs, &proc.options.fen.parse()?, moves)
                    {
                        if let Some(set) = ingest_info_line(
                            &mut proc.best_moves,
                            proc.last_depth,
                            proc.real_multipv,
                            best_moves,
                        ) {
                            if set.publishable {
                                current_analysis.best = proc.best_moves.clone();
                                proc.last_depth = set.depth;
                            }
                            proc.best_moves.clear();
                        }
                    }
                }
                UciMessage::BestMove { .. } => {
                    break;
                }
                _ => {}
            }
        }
        analysis.push(current_analysis);
    }

    if options.reversed {
        analysis.reverse();
        fens.reverse();
    }

    for (i, analysis) in analysis.iter_mut().enumerate() {
        let fen = &fens[i].0;
        // let query = PositionQuery::exact_from_fen(&fen.to_string())?;
        let query = PositionQueryJs {
            fen: fen.to_string(),
            type_: "exact".to_string(),
        };

        analysis.is_sacrifice = fens[i].2;
        if options.annotate_novelties && !novelty_found {
            if let Some(reference) = options.reference_db.clone() {
                analysis.novelty = match is_position_in_db(
                    reference,
                    GameQuery::new().position(query.clone()).clone(),
                    state.clone(),
                )
                .await
                {
                    Ok(found) => !found,
                    Err(error) => fail_analysis_progress!(error),
                };
                if analysis.novelty {
                    novelty_found = true;
                }
            } else {
                fail_analysis_progress!(Error::MissingReferenceDatabase);
            }
        }
    }
    if let Err(error) = state
        .engine_supervisor
        .terminate_exact(&analysis_key, supervised.generation)
        .await
    {
        fail_analysis_progress!(error);
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
    use shakmaty::FromSetup;

    use super::*;

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
        assert_eq!(collected.len(), 1);
        assert_eq!(collected[0].score.value, ScoreValue::Cp(34));
        assert_ne!(collected[0].score.lower_bound, Some(true));
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
        assert_eq!(collected.len(), 2);
        assert_eq!(collected[0].score.value, ScoreValue::Cp(20));
        assert_eq!(collected[1].score.value, ScoreValue::Cp(5));
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
        assert!(!set.publishable);
        assert_eq!(collected.len(), 2);
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
        assert!(!set.publishable);
        assert_eq!(set.depth, 8);
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

#[tauri::command]
#[specta::specta]
pub async fn get_engine_config(
    engine: EngineHandle,
    state: tauri::State<'_, AppState>,
) -> Result<EngineConfig, Error> {
    let executable = resolve_engine_executable(&state, &engine, PathOperation::EngineConfigure)?;
    let base = EngineActor::spawn(executable, EngineDeadlines::default()).await?;

    let configuration = async {
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
    .await;
    // `terminate` reaps even an engine that ignores `quit`; a configuration
    // probe must not leave a child behind on either success or parse failure.
    let cleanup = base.terminate().await;
    match (configuration, cleanup) {
        (Ok(config), Ok(())) => Ok(config),
        (Err(primary), Ok(())) => Err(primary),
        (Ok(_), Err(cleanup)) => Err(cleanup),
        (Err(primary), Err(cleanup)) => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: cleanup.to_string(),
        }),
    }
}
