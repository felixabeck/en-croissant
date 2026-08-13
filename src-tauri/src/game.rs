use std::{
    collections::{HashMap, VecDeque},
    io::{self, BufRead, BufReader, Cursor, Read},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Instant,
};

use dashmap::DashMap;
use log::{error, info};
use pgn_reader::{BufferedReader, RawHeader, Skip, Visitor};
use polyglot_book_rs::polyglot_hash_from_fen;
use rand::Rng;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, uci::UciMove, CastlingMode, Chess, Color, EnPassantMode, Position,
};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;
use tokio::{
    sync::{watch, Mutex, RwLock},
    time::{interval, Duration},
};
use tokio_util::sync::CancellationToken;

use crate::{
    engine::{
        parse_fen_to_position, resolve_engine_options, EngineActor, EngineDeadlines, EngineLog,
        EngineOption, GoMode, PlayersTime, MAX_ENGINE_LIMIT,
    },
    error::Error,
    infra::blocking::BLOCKING_GATEWAY,
    infra::path_authority::{
        EngineExecutable, EngineHandle, OpeningBookHandle, PathAuthority, PathOperation,
    },
};

pub type GameId = String;

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PlayerConfig {
    Human {
        name: String,
    },
    Engine {
        name: String,
        handle: EngineHandle,
        #[serde(default)]
        options: Vec<EngineOption>,
        go: Option<GoMode>,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimeControl {
    pub initial_time: u64,
    pub increment: u64,
}

fn validate_time_controls(config: &GameConfig) -> Result<(), Error> {
    let (Some(white), Some(black)) = (&config.white_time_control, &config.black_time_control)
    else {
        return if config.white_time_control.is_none() && config.black_time_control.is_none() {
            Ok(())
        } else {
            Err(Error::InvalidInput(
                "both players must provide a time control".into(),
            ))
        };
    };
    let max = u64::from(MAX_ENGINE_LIMIT);
    for (name, value) in [
        ("white initial time", white.initial_time),
        ("black initial time", black.initial_time),
        ("white increment", white.increment),
        ("black increment", black.increment),
    ] {
        if value > max {
            return Err(Error::InvalidInput(format!(
                "{name} must not exceed {MAX_ENGINE_LIMIT} milliseconds"
            )));
        }
    }
    if white.initial_time == 0 && black.initial_time == 0 {
        return Err(Error::InvalidInput(
            "at least one player clock must be non-zero".into(),
        ));
    }
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub white: PlayerConfig,
    pub black: PlayerConfig,
    pub white_time_control: Option<TimeControl>,
    pub black_time_control: Option<TimeControl>,
    pub initial_fen: Option<String>,
    #[serde(default)]
    pub initial_moves: Vec<String>,
    pub opening_book: Option<OpeningBookConfig>,
}

#[derive(Clone, Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OpeningBookConfig {
    pub book: OpeningBookHandle,
    #[serde(default = "default_opening_book_max_ply")]
    pub max_ply: usize,
}

fn default_opening_book_max_ply() -> usize {
    40
}

#[derive(Clone, Debug, Serialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum GameStatus {
    Playing,
    Finished { result: GameResult },
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum GameResult {
    WhiteWins { reason: GameEndReason },
    BlackWins { reason: GameEndReason },
    Draw { reason: DrawReason },
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum GameEndReason {
    Checkmate,
    Timeout,
    Resignation,
    Abandonment,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DrawReason {
    Stalemate,
    InsufficientMaterial,
    ThreefoldRepetition,
    FiftyMoveRule,
    Agreement,
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GameMove {
    pub uci: String,
    pub san: String,
    pub fen_after: String,
    pub clock: Option<u64>,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    pub game_id: GameId,
    pub session: u64,
    pub revision: u64,
    pub status: GameStatus,
    pub initial_fen: String,
    pub moves: Vec<GameMove>,
    pub current_fen: String,
    pub ply: u32,
    pub turn: String,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
    pub white_player: String,
    pub black_player: String,
}

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct GameMoveEvent {
    pub game_id: GameId,
    pub session: u64,
    pub revision: u64,
    pub moves: Vec<GameMove>,
    pub fen: String,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct ClockUpdateEvent {
    pub game_id: GameId,
    pub session: u64,
    pub revision: u64,
    pub white_time: Option<u64>,
    pub black_time: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct GameOverEvent {
    pub game_id: GameId,
    pub session: u64,
    pub revision: u64,
    pub result: GameResult,
    pub moves: Vec<GameMove>,
}

struct ClockState {
    white_time: Option<u64>,
    black_time: Option<u64>,
    white_increment: u64,
    black_increment: u64,
    last_tick: Instant,
}

#[derive(Clone)]
struct EngineRequestContext {
    session: u64,
    position_generation: u64,
    nonce: u64,
    cancellation: CancellationToken,
}

struct ActiveEngineRequest {
    context: EngineRequestContext,
    request_id: Option<crate::engine::EngineRequestId>,
}

struct GameController {
    game_id: GameId,
    session: u64,
    revision: u64,
    position_generation: u64,
    next_engine_request: u64,
    config: GameConfig,
    initial_fen: String,
    moves: Vec<GameMove>,
    position: Chess,
    position_history: HashMap<String, u32>,
    status: GameStatus,
    terminal_event_emitted: bool,
    clock: Option<ClockState>,
    white_engine: Option<Arc<EngineActor>>,
    black_engine: Option<Arc<EngineActor>>,
    move_notify_tx: Option<tokio::sync::mpsc::Sender<()>>,
    engine_thinking: bool,
    active_engine_request: Option<ActiveEngineRequest>,
    polyglot_book: Option<CancellablePolyglotBook>,
    polyglot_max_ply: usize,
}

impl GameController {
    fn new(game_id: GameId, session: u64, config: GameConfig) -> Result<Self, Error> {
        validate_time_controls(&config)?;
        let initial_fen = config.initial_fen.clone().unwrap_or_else(|| {
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string()
        });

        let position = parse_fen_to_position(&initial_fen)?;

        let clock = if config.white_time_control.is_some() || config.black_time_control.is_some() {
            Some(ClockState {
                white_time: config.white_time_control.as_ref().map(|tc| tc.initial_time),
                black_time: config.black_time_control.as_ref().map(|tc| tc.initial_time),
                white_increment: config
                    .white_time_control
                    .as_ref()
                    .map(|tc| tc.increment)
                    .unwrap_or(0),
                black_increment: config
                    .black_time_control
                    .as_ref()
                    .map(|tc| tc.increment)
                    .unwrap_or(0),
                last_tick: Instant::now(),
            })
        } else {
            None
        };

        let mut position_history = HashMap::new();
        let initial_key = Self::position_key(&position);
        position_history.insert(initial_key, 1);

        let initial_moves = config.initial_moves.clone();

        let mut controller = Self {
            game_id,
            session,
            revision: 0,
            position_generation: 0,
            next_engine_request: 0,
            config,
            initial_fen,
            moves: Vec::new(),
            position,
            position_history,
            status: GameStatus::Playing,
            terminal_event_emitted: false,
            clock,
            white_engine: None,
            black_engine: None,
            move_notify_tx: None,
            engine_thinking: false,
            active_engine_request: None,
            polyglot_book: None,
            polyglot_max_ply: 0,
        };

        controller.check_game_end();
        for uci_str in &initial_moves {
            if controller.status != GameStatus::Playing {
                return Err(Error::InvalidInput(
                    "initial moves continue after a terminal position".into(),
                ));
            }
            controller.apply_move_no_clock(uci_str)?;
        }

        Ok(controller)
    }

    fn get_state(&self) -> GameState {
        let turn = if self.position.turn() == Color::White {
            "white"
        } else {
            "black"
        };

        let (white_time, black_time) = self.get_current_times();

        let white_player = match &self.config.white {
            PlayerConfig::Human { name } => name.clone(),
            PlayerConfig::Engine { name, .. } => name.clone(),
        };

        let black_player = match &self.config.black {
            PlayerConfig::Human { name } => name.clone(),
            PlayerConfig::Engine { name, .. } => name.clone(),
        };

        GameState {
            game_id: self.game_id.clone(),
            session: self.session,
            revision: self.revision,
            status: self.status.clone(),
            initial_fen: self.initial_fen.clone(),
            moves: self.moves.clone(),
            current_fen: Fen::from_position(self.position.clone(), EnPassantMode::Legal)
                .to_string(),
            ply: self.moves.len() as u32,
            turn: turn.to_string(),
            white_time,
            black_time,
            white_player,
            black_player,
        }
    }

    fn position_key(position: &Chess) -> String {
        let fen = Fen::from_position(position.clone(), EnPassantMode::Legal).to_string();
        fen.split_whitespace().take(4).collect::<Vec<_>>().join(" ")
    }

    fn current_turn_player(&self) -> &PlayerConfig {
        if self.position.turn() == Color::White {
            &self.config.white
        } else {
            &self.config.black
        }
    }

    fn is_engine_turn(&self) -> bool {
        matches!(self.current_turn_player(), PlayerConfig::Engine { .. })
    }

    fn advance_position_generation(&mut self) {
        self.position_generation = self.position_generation.saturating_add(1);
        self.cancel_engine_request();
    }

    fn cancel_engine_request(&mut self) {
        if let Some(request) = &self.active_engine_request {
            request.context.cancellation.cancel();
        }
        self.active_engine_request = None;
        self.engine_thinking = false;
    }

    fn begin_engine_request(&mut self) -> Option<EngineRequestContext> {
        if self.status != GameStatus::Playing || !self.is_engine_turn() || self.engine_thinking {
            return None;
        }
        self.next_engine_request = self.next_engine_request.saturating_add(1);
        let context = EngineRequestContext {
            session: self.session,
            position_generation: self.position_generation,
            nonce: self.next_engine_request,
            cancellation: CancellationToken::new(),
        };
        self.engine_thinking = true;
        self.active_engine_request = Some(ActiveEngineRequest {
            context: context.clone(),
            request_id: None,
        });
        Some(context)
    }

    fn register_engine_request_id(
        &mut self,
        context: &EngineRequestContext,
        request_id: crate::engine::EngineRequestId,
    ) -> bool {
        let Some(active) = &mut self.active_engine_request else {
            return false;
        };
        if active.context.session != context.session
            || active.context.position_generation != context.position_generation
            || active.context.nonce != context.nonce
            || active.context.cancellation.is_cancelled()
        {
            return false;
        }
        active.request_id = Some(request_id);
        true
    }

    fn accepts_engine_result(
        &self,
        context: &EngineRequestContext,
        request_id: crate::engine::EngineRequestId,
    ) -> bool {
        self.status == GameStatus::Playing
            && self.session == context.session
            && self.position_generation == context.position_generation
            && self.active_engine_request.as_ref().is_some_and(|active| {
                active.context.nonce == context.nonce
                    && active.context.session == context.session
                    && active.context.position_generation == context.position_generation
                    && active.request_id == Some(request_id)
                    && !active.context.cancellation.is_cancelled()
            })
    }

    fn accepts_engine_context(&self, context: &EngineRequestContext) -> bool {
        self.status == GameStatus::Playing
            && self.session == context.session
            && self.position_generation == context.position_generation
            && self.active_engine_request.as_ref().is_some_and(|active| {
                active.context.nonce == context.nonce
                    && active.context.session == context.session
                    && active.context.position_generation == context.position_generation
                    && !active.context.cancellation.is_cancelled()
            })
    }

    fn apply_move(&mut self, uci_str: &str) -> Result<GameMove, Error> {
        if self.status != GameStatus::Playing {
            return Err(Error::GameNotInProgress);
        }
        if let Some(result) = self.settle_active_clock() {
            self.end_game(result);
            return Err(Error::GameNotInProgress);
        }

        let uci = UciMove::from_ascii(uci_str.as_bytes())?;
        let mv = uci.to_move(&self.position)?;

        let san = SanPlus::from_move_and_play_unchecked(&mut self.position.clone(), &mv);

        let clock = self.clock.as_ref().and_then(|c| {
            if self.position.turn() == Color::White {
                c.white_time
            } else {
                c.black_time
            }
        });

        self.position.play_unchecked(&mv);
        self.advance_position_generation();

        let pos_key = Self::position_key(&self.position);
        *self.position_history.entry(pos_key).or_insert(0) += 1;

        if let Some(clock_state) = self.clock.as_mut() {
            // `position.turn()` now names the opponent, so credit the mover
            // only after their elapsed time was settled above.
            if self.position.turn() == Color::Black {
                if let Some(white) = &mut clock_state.white_time {
                    *white = white.saturating_add(clock_state.white_increment);
                }
            } else if let Some(black) = &mut clock_state.black_time {
                *black = black.saturating_add(clock_state.black_increment);
            }
            clock_state.last_tick = Instant::now();
        }

        let (white_time, black_time) = self
            .clock
            .as_ref()
            .map(|c| (c.white_time, c.black_time))
            .unwrap_or((None, None));

        let fen_after = Fen::from_position(self.position.clone(), EnPassantMode::Legal).to_string();

        let game_move = GameMove {
            uci: uci_str.to_string(),
            san: san.to_string(),
            fen_after,
            clock,
            white_time,
            black_time,
        };

        self.moves.push(game_move.clone());
        self.bump_revision();
        self.check_game_end();

        Ok(game_move)
    }

    fn apply_move_no_clock(&mut self, uci_str: &str) -> Result<GameMove, Error> {
        let uci = UciMove::from_ascii(uci_str.as_bytes())?;
        let mv = uci.to_move(&self.position)?;

        let san = SanPlus::from_move_and_play_unchecked(&mut self.position.clone(), &mv);

        self.position.play_unchecked(&mv);
        self.advance_position_generation();

        let pos_key = Self::position_key(&self.position);
        *self.position_history.entry(pos_key).or_insert(0) += 1;

        let (white_time, black_time) = self
            .clock
            .as_ref()
            .map(|c| (c.white_time, c.black_time))
            .unwrap_or((None, None));

        let fen_after = Fen::from_position(self.position.clone(), EnPassantMode::Legal).to_string();

        let game_move = GameMove {
            uci: uci_str.to_string(),
            san: san.to_string(),
            fen_after,
            clock: None,
            white_time,
            black_time,
        };

        self.moves.push(game_move.clone());
        self.check_game_end();

        Ok(game_move)
    }

    fn rebuild_position_from_moves(&mut self) -> Result<(), Error> {
        self.position = parse_fen_to_position(&self.initial_fen)?;

        self.position_history.clear();
        let initial_key = Self::position_key(&self.position);
        self.position_history.insert(initial_key, 1);

        for m in &self.moves {
            let uci = UciMove::from_ascii(m.uci.as_bytes())?;
            let mv = uci.to_move(&self.position)?;
            self.position.play_unchecked(&mv);
            let pos_key = Self::position_key(&self.position);
            *self.position_history.entry(pos_key).or_insert(0) += 1;
        }

        if let Some(ref mut clock) = self.clock {
            clock.white_time = self
                .config
                .white_time_control
                .as_ref()
                .map(|tc| tc.initial_time);
            clock.black_time = self
                .config
                .black_time_control
                .as_ref()
                .map(|tc| tc.initial_time);

            if let Some(last_move) = self.moves.last() {
                if last_move.white_time.is_some() || last_move.black_time.is_some() {
                    clock.white_time = last_move.white_time;
                    clock.black_time = last_move.black_time;
                }
            }

            clock.last_tick = Instant::now();
        }

        Ok(())
    }

    fn take_back_moves(&mut self, count: usize) -> Result<(), Error> {
        self.cancel_engine_request();
        for _ in 0..count {
            self.moves.pop();
        }
        self.status = GameStatus::Playing;
        self.rebuild_position_from_moves()?;
        self.advance_position_generation();
        self.bump_revision();
        self.check_game_end();
        Ok(())
    }

    fn check_game_end(&mut self) {
        let result = if self.position.is_checkmate() {
            Some(if self.position.turn() == Color::White {
                GameResult::BlackWins {
                    reason: GameEndReason::Checkmate,
                }
            } else {
                GameResult::WhiteWins {
                    reason: GameEndReason::Checkmate,
                }
            })
        } else if self.position.is_stalemate() {
            Some(GameResult::Draw {
                reason: DrawReason::Stalemate,
            })
        } else if self.position.is_insufficient_material() {
            Some(GameResult::Draw {
                reason: DrawReason::InsufficientMaterial,
            })
        } else if self.position.halfmoves() >= 100 {
            Some(GameResult::Draw {
                reason: DrawReason::FiftyMoveRule,
            })
        } else {
            let pos_key = Self::position_key(&self.position);
            self.position_history
                .get(&pos_key)
                .filter(|count| **count >= 3)
                .map(|_| GameResult::Draw {
                    reason: DrawReason::ThreefoldRepetition,
                })
        };

        if let Some(result) = result {
            self.end_game(result);
        }
    }

    /// Debits the side to move before any move is parsed or accepted. A flag
    /// falls to a draw when the opponent has no possible mating material.
    fn settle_active_clock(&mut self) -> Option<GameResult> {
        let clock = self.clock.as_mut()?;
        let elapsed = clock.last_tick.elapsed().as_millis() as u64;
        let flagged = self.position.turn();
        let active = if flagged == Color::White {
            &mut clock.white_time
        } else {
            &mut clock.black_time
        };
        let Some(remaining) = active else {
            clock.last_tick = Instant::now();
            return None;
        };
        if elapsed >= *remaining {
            *remaining = 0;
            clock.last_tick = Instant::now();
            let winner = !flagged;
            return Some(if self.position.has_insufficient_material(winner) {
                GameResult::Draw {
                    reason: DrawReason::InsufficientMaterial,
                }
            } else if winner == Color::White {
                GameResult::WhiteWins {
                    reason: GameEndReason::Timeout,
                }
            } else {
                GameResult::BlackWins {
                    reason: GameEndReason::Timeout,
                }
            });
        }
        *remaining -= elapsed;
        clock.last_tick = Instant::now();
        None
    }

    fn get_current_times(&self) -> (Option<u64>, Option<u64>) {
        if let Some(ref clock) = self.clock {
            let elapsed = clock.last_tick.elapsed().as_millis() as u64;

            let white_time = if self.position.turn() == Color::White {
                clock.white_time.map(|t| t.saturating_sub(elapsed))
            } else {
                clock.white_time
            };

            let black_time = if self.position.turn() == Color::Black {
                clock.black_time.map(|t| t.saturating_sub(elapsed))
            } else {
                clock.black_time
            };

            (white_time, black_time)
        } else {
            (None, None)
        }
    }

    fn end_game(&mut self, result: GameResult) -> bool {
        if self.status != GameStatus::Playing {
            return false;
        }
        self.status = GameStatus::Finished { result };
        self.advance_position_generation();
        self.terminal_event_emitted = false;
        self.bump_revision();
        true
    }

    fn reset_clock(&mut self) {
        if let Some(ref mut clock) = self.clock {
            clock.last_tick = Instant::now();
        }
    }

    fn bump_revision(&mut self) {
        self.revision = self.revision.saturating_add(1);
    }

    fn move_event_revision(&self) -> u64 {
        if matches!(self.status, GameStatus::Finished { .. }) {
            self.revision.saturating_sub(1)
        } else {
            self.revision
        }
    }
}

/// Publishes a terminal result exactly once for the state transition that
/// produced it. Transport remains best effort, but competing timeout,
/// resignation and engine-error paths cannot publish conflicting results.
fn emit_terminal_event(controller: &mut GameController, app: &AppHandle) -> bool {
    let GameStatus::Finished { result } = &controller.status else {
        return false;
    };
    if controller.terminal_event_emitted {
        return false;
    }
    controller.terminal_event_emitted = true;
    let _ = GameOverEvent {
        game_id: controller.game_id.clone(),
        session: controller.session,
        revision: controller.revision,
        result: result.clone(),
        moves: controller.moves.clone(),
    }
    .emit(app);
    true
}

const COMPLETED_GAME_SNAPSHOTS: usize = 128;

#[derive(Clone, Copy, PartialEq, Eq)]
enum SessionDisposition {
    Active,
    Completed,
    Tombstoned,
}

struct LatestSession {
    session: u64,
    disposition: SessionDisposition,
}

struct CompletedSnapshot {
    game_id: GameId,
    session: u64,
    state: GameState,
}

#[derive(Default)]
struct CompletedGames {
    snapshots: VecDeque<CompletedSnapshot>,
    latest: HashMap<GameId, LatestSession>,
}

/// One lifecycle owner per public game ID. Keeping controller, shutdown and
/// loop handle together makes replacement and natural cleanup exact-session
/// operations instead of independent best-effort map mutations.
struct LiveSession {
    session: u64,
    controller: Arc<RwLock<GameController>>,
    shutdown: watch::Sender<bool>,
    join: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl LiveSession {
    async fn shutdown_and_join(&self) {
        self.controller.write().await.cancel_engine_request();
        let _ = self.shutdown.send(true);
        if let Some(join) = self.join.lock().await.take() {
            if let Err(error) = join.await {
                error!("game loop join failed: {error}");
            }
        }
    }
}

pub struct GameManager {
    games: DashMap<GameId, Arc<LiveSession>>,
    next_session: AtomicU64,
    lifecycle: DashMap<GameId, Arc<Mutex<()>>>,
    completed: Mutex<CompletedGames>,
}

async fn spawn_configured_game_engine(
    executable: EngineExecutable,
    options: &[EngineOption],
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    chess960: bool,
) -> Result<Arc<EngineActor>, Error> {
    let mut resolved = {
        let mut authority = authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
        resolve_engine_options(
            authority
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?,
            options,
        )?
    };
    // Every resource option of a game engine is resolved before spawn, so the
    // leases move into the executable and stay alive for the process lifetime
    // through the `EngineExecutable` that `ChildUciIo` owns. The controller
    // therefore holds no leases of its own; `chess.rs` differs only because
    // analysis re-resolves options on an already-running engine.
    let child_leases = resolved
        .iter_mut()
        .flat_map(|option| std::mem::take(&mut option.resources))
        .collect();
    let engine = EngineActor::spawn_initialized(
        executable.with_resource_leases(child_leases),
        EngineDeadlines::default(),
    )
    .await?;
    let setup = async {
        for option in resolved {
            if option.name != "UCI_Chess960" {
                engine.set_option(&option.name, &option.value).await?;
            }
        }
        engine
            .set_option("UCI_Chess960", if chess960 { "true" } else { "false" })
            .await?;
        engine.ensure_ready().await
    }
    .await;

    match setup {
        Ok(()) => Ok(Arc::new(engine)),
        Err(primary) => match engine.terminate().await {
            Ok(()) => Err(primary),
            Err(cleanup) => Err(Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: cleanup.to_string(),
            }),
        },
    }
}

fn resolve_game_engine_executable(
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    handle: &EngineHandle,
) -> Result<EngineExecutable, Error> {
    let mut authority = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    authority
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .engine_executable(handle, PathOperation::EngineExecute)
}

async fn terminate_game_engines(
    engines: impl IntoIterator<Item = Arc<EngineActor>>,
) -> Result<(), Error> {
    let mut failures = Vec::new();
    for engine in engines {
        if let Err(error) = engine.terminate().await {
            failures.push(error.to_string());
        }
    }
    if failures.is_empty() {
        Ok(())
    } else {
        Err(Error::Conflict(format!(
            "failed to terminate game engines: {}",
            failures.join("; ")
        )))
    }
}

impl GameManager {
    pub fn new() -> Self {
        Self {
            games: DashMap::new(),
            next_session: AtomicU64::new(0),
            lifecycle: DashMap::new(),
            completed: Mutex::new(CompletedGames::default()),
        }
    }

    fn lifecycle_slot(&self, game_id: &str) -> Arc<Mutex<()>> {
        self.lifecycle
            .entry(game_id.to_owned())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    async fn complete_exact(
        &self,
        game_id: &str,
        session: u64,
        controller: &Arc<RwLock<GameController>>,
    ) {
        if !self.session_is_current(game_id, session) {
            return;
        }
        let snapshot = controller.read().await.get_state();
        let mut completed = self.completed.lock().await;
        let Some(latest) = completed.latest.get_mut(game_id) else {
            return;
        };
        if latest.session != session || latest.disposition != SessionDisposition::Active {
            return;
        }
        latest.disposition = SessionDisposition::Completed;
        completed
            .snapshots
            .retain(|entry| entry.game_id != game_id || entry.session != session);
        completed.snapshots.push_back(CompletedSnapshot {
            game_id: game_id.to_owned(),
            session,
            state: snapshot,
        });
        while completed.snapshots.len() > COMPLETED_GAME_SNAPSHOTS {
            completed.snapshots.pop_front();
        }
        drop(completed);
        // Publish the completed disposition before removing the live entry.
        // Readers consequently observe either Live or the exact completed
        // snapshot, never an Active session with neither representation.
        let _ = self
            .games
            .remove_if(game_id, |_, current| current.session == session);
    }

    pub async fn start_game(
        self: &Arc<Self>,
        game_id: GameId,
        config: GameConfig,
        app: AppHandle,
        authority: &std::sync::Mutex<Option<PathAuthority>>,
    ) -> Result<GameState, Error> {
        let lifecycle = self.lifecycle_slot(&game_id);
        let _transition = lifecycle.lock().await;
        let session = self
            .next_session
            .fetch_add(1, Ordering::Relaxed)
            .checked_add(1)
            .ok_or_else(|| Error::ResourceLimit("game session generation exhausted".into()))?;
        let OpeningBookResult {
            config,
            polyglot_book,
            polyglot_max_ply,
        } = apply_opening_book(config, authority).await?;
        let castling_mode = CastlingMode::detect(
            config
                .clone()
                .initial_fen
                .unwrap_or_default()
                .parse::<Fen>()
                .unwrap_or_default()
                .as_setup(),
        );

        let mut controller = GameController::new(game_id.clone(), session, config.clone())?;
        controller.polyglot_book = polyglot_book;
        controller.polyglot_max_ply = polyglot_max_ply;

        if let PlayerConfig::Engine {
            handle, options, ..
        } = &config.white
        {
            let executable = resolve_game_engine_executable(authority, handle)?;
            controller.white_engine = Some(
                spawn_configured_game_engine(
                    executable,
                    options,
                    authority,
                    castling_mode.is_chess960(),
                )
                .await?,
            );
        }

        if let PlayerConfig::Engine {
            handle, options, ..
        } = &config.black
        {
            let executable = match resolve_game_engine_executable(authority, handle) {
                Ok(executable) => executable,
                Err(primary) => {
                    let cleanup = if let Some(engine) = controller.white_engine.take() {
                        engine.terminate().await
                    } else {
                        Ok(())
                    };
                    return match cleanup {
                        Ok(()) => Err(primary),
                        Err(cleanup) => Err(Error::OperationAndCleanup {
                            primary: primary.to_string(),
                            cleanup: cleanup.to_string(),
                        }),
                    };
                }
            };
            match spawn_configured_game_engine(
                executable,
                options,
                authority,
                castling_mode.is_chess960(),
            )
            .await
            {
                Ok(engine) => controller.black_engine = Some(engine),
                Err(primary) => {
                    let cleanup = if let Some(engine) = controller.white_engine.take() {
                        engine.terminate().await
                    } else {
                        Ok(())
                    };
                    return match cleanup {
                        Ok(()) => Err(primary),
                        Err(cleanup) => Err(Error::OperationAndCleanup {
                            primary: primary.to_string(),
                            cleanup: cleanup.to_string(),
                        }),
                    };
                }
            }
        }

        controller.reset_clock();

        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let (move_notify_tx, move_notify_rx) = tokio::sync::mpsc::channel(1);
        controller.move_notify_tx = Some(move_notify_tx);

        let state = controller.get_state();
        let controller = Arc::new(RwLock::new(controller));
        let live = Arc::new(LiveSession {
            session,
            controller: controller.clone(),
            shutdown: shutdown_tx,
            join: Mutex::new(None),
        });

        // Construct and validate the entire replacement before disturbing a
        // running game. A failed new configuration therefore preserves it.
        if let Some(old_game) = self.games.get(&game_id).map(|entry| entry.clone()) {
            // The lifecycle lock prevents a newer session from replacing this
            // exact one while it is joined. Remove before signaling so an
            // aborted replacement cannot become a completed snapshot.
            let _ = self
                .games
                .remove_if(&game_id, |_, current| current.session == old_game.session);
            old_game.shutdown_and_join().await;
        }
        self.completed.lock().await.latest.insert(
            game_id.clone(),
            LatestSession {
                session,
                disposition: SessionDisposition::Active,
            },
        );
        self.games.insert(game_id.clone(), live.clone());

        // A FEN (or a validated initial move sequence) may already be
        // terminal. Register the LiveSession first, then publish exactly once
        // through the same terminal-event guard used by live play.
        let initially_finished = {
            let mut controller = controller.write().await;
            emit_terminal_event(&mut controller, &app)
        };
        if initially_finished {
            let _ = live.shutdown.send(true);
        }

        let manager = Arc::downgrade(self);
        let join = tokio::spawn(game_loop(
            game_id,
            live.clone(),
            shutdown_rx,
            move_notify_rx,
            app,
            manager,
        ));
        *live.join.lock().await = Some(join);

        Ok(state)
    }

    async fn current_session(
        &self,
        game_id: &str,
        expected_session: u64,
    ) -> Result<Arc<LiveSession>, Error> {
        let game = self
            .games
            .get(game_id)
            .map(|entry| entry.clone())
            .ok_or_else(|| Error::GameNotFound(game_id.to_string()))?;
        if game.session != expected_session {
            return Err(Error::Conflict("game session is no longer current".into()));
        }
        Ok(game)
    }

    fn session_is_current(&self, game_id: &str, expected_session: u64) -> bool {
        self.games
            .get(game_id)
            .is_some_and(|game| game.session == expected_session)
    }

    pub async fn get_game_state(
        &self,
        game_id: &str,
        expected_session: u64,
    ) -> Result<GameState, Error> {
        let lifecycle = self.lifecycle_slot(game_id);
        let _operation = lifecycle.lock().await;
        if let Some(game) = self.games.get(game_id).map(|entry| entry.clone()) {
            if game.session != expected_session {
                return Err(Error::Conflict("game session is no longer current".into()));
            }
            return Ok(game.controller.read().await.get_state());
        }
        let completed = self.completed.lock().await;
        let Some(latest) = completed.latest.get(game_id) else {
            return Err(Error::GameNotFound(game_id.to_string()));
        };
        if latest.session != expected_session {
            return Err(Error::Conflict("game session is no longer current".into()));
        }
        if latest.disposition == SessionDisposition::Tombstoned {
            return Err(Error::GameNotFound(game_id.to_string()));
        }
        completed
            .snapshots
            .iter()
            .rev()
            .find(|entry| entry.game_id == game_id && entry.session == expected_session)
            .map(|entry| entry.state.clone())
            .ok_or_else(|| Error::GameNotFound(game_id.to_string()))
    }

    pub async fn make_move(
        &self,
        game_id: &str,
        expected_session: u64,
        uci: &str,
        app: &AppHandle,
    ) -> Result<GameState, Error> {
        let lifecycle = self.lifecycle_slot(game_id);
        let _operation = lifecycle.lock().await;
        let game = self.current_session(game_id, expected_session).await?;

        let mut controller = game.controller.write().await;

        if !self.session_is_current(game_id, expected_session) {
            return Err(Error::Conflict(
                "game session changed before move commit".into(),
            ));
        }

        if controller.is_engine_turn() {
            return Err(Error::NotHumanTurn);
        }

        let game_move = match controller.apply_move(uci) {
            Ok(move_) => move_,
            Err(_) if matches!(controller.status, GameStatus::Finished { .. }) => {
                let finished = emit_terminal_event(&mut controller, app);
                let state = controller.get_state();
                drop(controller);
                if finished {
                    let _ = game.shutdown.send(true);
                }
                return Ok(state);
            }
            Err(error) => return Err(error),
        };
        let (white_time, black_time) = controller.get_current_times();

        GameMoveEvent {
            game_id: game_id.to_string(),
            session: controller.session,
            // A terminal move is followed by a distinct GameOver event. The move
            // itself owns the revision assigned by `apply_move`; `end_game`
            // advances it once more for the terminal state/event.
            revision: controller.move_event_revision(),
            moves: controller.moves.clone(),
            fen: game_move.fen_after,
            white_time,
            black_time,
        }
        .emit(app)
        .unwrap_or(());

        let finished = emit_terminal_event(&mut controller, app);
        if !finished {
            if let Some(tx) = &controller.move_notify_tx {
                let _ = tx.try_send(());
            }
        }

        let state = controller.get_state();
        drop(controller);
        if finished {
            let _ = game.shutdown.send(true);
        }
        Ok(state)
    }

    pub async fn take_back_move(
        &self,
        game_id: &str,
        expected_session: u64,
        app: &AppHandle,
    ) -> Result<GameState, Error> {
        let lifecycle = self.lifecycle_slot(game_id);
        let _operation = lifecycle.lock().await;
        let game = self.current_session(game_id, expected_session).await?;

        let mut controller = game.controller.write().await;

        if !self.session_is_current(game_id, expected_session) {
            return Err(Error::Conflict(
                "game session changed before takeback commit".into(),
            ));
        }

        if controller.status != GameStatus::Playing {
            return Err(Error::GameNotInProgress);
        }
        if controller.moves.is_empty() {
            return Err(Error::NoMovesFound);
        }

        let human_color = match (&controller.config.white, &controller.config.black) {
            (PlayerConfig::Human { .. }, PlayerConfig::Engine { .. }) => Some(Color::White),
            (PlayerConfig::Engine { .. }, PlayerConfig::Human { .. }) => Some(Color::Black),
            _ => None,
        };

        let should_pop_two = human_color
            .map(|c| controller.position.turn() == c)
            .unwrap_or(false);

        controller.take_back_moves(if should_pop_two { 2 } else { 1 })?;

        let (white_time, black_time) = controller.get_current_times();
        let fen = Fen::from_position(controller.position.clone(), EnPassantMode::Legal).to_string();

        GameMoveEvent {
            game_id: game_id.to_string(),
            session: controller.session,
            revision: controller.move_event_revision(),
            moves: controller.moves.clone(),
            fen,
            white_time,
            black_time,
        }
        .emit(app)
        .unwrap_or(());

        let finished = emit_terminal_event(&mut controller, app);
        if !finished && controller.is_engine_turn() {
            if let Some(tx) = &controller.move_notify_tx {
                let _ = tx.try_send(());
            }
        }

        let state = controller.get_state();
        drop(controller);
        if finished {
            let _ = game.shutdown.send(true);
        }
        Ok(state)
    }

    pub async fn resign(
        &self,
        game_id: &str,
        expected_session: u64,
        color: &str,
        app: &AppHandle,
    ) -> Result<GameState, Error> {
        let lifecycle = self.lifecycle_slot(game_id);
        let _operation = lifecycle.lock().await;
        let game = self.current_session(game_id, expected_session).await?;

        let mut controller = game.controller.write().await;

        if !self.session_is_current(game_id, expected_session) {
            return Err(Error::Conflict(
                "game session changed before resignation commit".into(),
            ));
        }

        if controller.status != GameStatus::Playing {
            return Err(Error::GameNotInProgress);
        }

        let result = match color {
            "white" => GameResult::BlackWins {
                reason: GameEndReason::Resignation,
            },
            "black" => GameResult::WhiteWins {
                reason: GameEndReason::Resignation,
            },
            _ => return Err(Error::InvalidColor(color.to_string())),
        };

        let finished = controller.end_game(result);
        emit_terminal_event(&mut controller, app);

        let state = controller.get_state();
        drop(controller);
        if finished {
            let _ = game.shutdown.send(true);
        }
        Ok(state)
    }

    pub async fn abort_game(&self, game_id: &str, expected_session: u64) -> Result<(), Error> {
        let lifecycle = self.lifecycle_slot(game_id);
        let _transition = lifecycle.lock().await;
        let game = self.current_session(game_id, expected_session).await?;
        if self
            .games
            .remove_if(game_id, |_, current| current.session == expected_session)
            .is_none()
        {
            return Err(Error::Conflict(
                "game session changed before abort commit".into(),
            ));
        }
        {
            let mut completed = self.completed.lock().await;
            completed.latest.insert(
                game_id.to_owned(),
                LatestSession {
                    session: expected_session,
                    disposition: SessionDisposition::Tombstoned,
                },
            );
        }
        game.shutdown_and_join().await;
        Ok(())
    }

    pub async fn get_engine_logs(
        &self,
        game_id: &str,
        expected_session: u64,
        color: &str,
    ) -> Result<Vec<EngineLog>, Error> {
        let lifecycle = self.lifecycle_slot(game_id);
        let _operation = lifecycle.lock().await;
        let game = self.current_session(game_id, expected_session).await?;

        let engine = {
            let controller = game.controller.read().await;
            match color {
                "white" => controller.white_engine.clone(),
                "black" => controller.black_engine.clone(),
                _ => return Err(Error::InvalidColor(color.to_string())),
            }
        };

        if let Some(engine_arc) = engine {
            Ok(engine_arc.logs().await)
        } else {
            Ok(Vec::new())
        }
    }
}

impl Default for GameManager {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug)]
struct OpeningBookSelection {
    initial_fen: String,
    initial_moves: Vec<String>,
}

struct OpeningBookResult {
    config: GameConfig,
    polyglot_book: Option<CancellablePolyglotBook>,
    polyglot_max_ply: usize,
}

#[cfg(test)]
fn select_random_epd_entry(reader: impl BufRead) -> Result<OpeningBookSelection, Error> {
    select_random_epd_entry_cancellable(reader, &CancellationToken::new())
}

fn select_random_epd_entry_cancellable(
    mut reader: impl BufRead,
    cancellation: &CancellationToken,
) -> Result<OpeningBookSelection, Error> {
    let mut rng = rand::thread_rng();
    let mut selected = None;
    let mut seen = 0_u64;
    while let Some(line) = read_epd_line_cancellable(&mut reader, cancellation)? {
        ensure_opening_book_not_cancelled(cancellation)?;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let (fields, operations) = split_epd_position_and_operations(line)?;
        validate_epd_operations(operations)?;
        let fen = format!(
            "{} {} {} {} 0 1",
            fields[0], fields[1], fields[2], fields[3]
        );
        parse_fen_to_position(&fen)?;
        seen = seen
            .checked_add(1)
            .ok_or_else(|| Error::ResourceLimit("too many EPD entries".into()))?;
        if rng.gen_range(0..seen) == 0 {
            selected = Some(fen);
        }
    }
    let selected_line = selected.ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Opening book EPD has no entries",
        )
    })?;

    Ok(OpeningBookSelection {
        initial_fen: selected_line,
        initial_moves: Vec::new(),
    })
}

/// Reads one EPD line without allowing an untrusted missing newline to grow an
/// allocation indefinitely. `fill_buf` is consumed incrementally so a
/// cancellation is also observed while a single line is being read.
fn read_epd_line_cancellable(
    reader: &mut impl BufRead,
    cancellation: &CancellationToken,
) -> Result<Option<String>, Error> {
    let mut line = Vec::new();
    loop {
        ensure_opening_book_not_cancelled(cancellation)?;
        let available = reader.fill_buf()?;
        if available.is_empty() {
            if line.is_empty() {
                return Ok(None);
            }
            break;
        }

        let newline = available.iter().position(|byte| *byte == b'\n');
        let consumed = newline.map_or(available.len(), |index| index + 1);
        let new_len = line.len().checked_add(consumed).ok_or_else(|| {
            Error::ResourceLimit("opening-book EPD line exceeds the configured size limit".into())
        })?;
        if new_len > MAX_OPENING_BOOK_EPD_LINE_BYTES {
            return Err(Error::ResourceLimit(
                "opening-book EPD line exceeds the configured size limit".into(),
            ));
        }
        line.extend_from_slice(&available[..consumed]);
        reader.consume(consumed);
        if newline.is_some() {
            break;
        }
    }

    if line.last() == Some(&b'\n') {
        line.pop();
    }
    if line.last() == Some(&b'\r') {
        line.pop();
    }
    String::from_utf8(line)
        .map(Some)
        .map_err(|_| Error::InvalidInput("opening-book EPD is not valid UTF-8".into()))
}

fn split_epd_position_and_operations(line: &str) -> Result<([&str; 4], &str), Error> {
    let mut fields = [""; 4];
    let mut remaining = line;
    for field in &mut fields {
        remaining = remaining.trim_start();
        let end = remaining
            .find(char::is_whitespace)
            .unwrap_or(remaining.len());
        if end == 0 {
            return Err(Error::InvalidInput(
                "EPD entry must contain exactly four FEN position fields".into(),
            ));
        }
        (*field, remaining) = remaining.split_at(end);
    }
    Ok((fields, remaining.trim()))
}

/// Validates the EPD operation-list grammar without interpreting individual engine opcodes.
/// A fifth/sixth FEN field therefore cannot be mistaken for an operation.
fn validate_epd_operations(operations: &str) -> Result<(), Error> {
    let mut remaining = operations;
    while !remaining.is_empty() {
        let mut quoted = false;
        let mut escaped = false;
        let mut end = None;
        for (index, character) in remaining.char_indices() {
            if escaped {
                escaped = false;
            } else if character == '\\' && quoted {
                escaped = true;
            } else if character == '"' {
                quoted = !quoted;
            } else if character == ';' && !quoted {
                end = Some(index);
                break;
            } else if character.is_control() {
                return Err(Error::InvalidInput(
                    "EPD operations must not contain control characters".into(),
                ));
            }
        }
        if quoted || escaped {
            return Err(Error::InvalidInput(
                "EPD operation contains an unterminated quoted operand".into(),
            ));
        }
        let end =
            end.ok_or_else(|| Error::InvalidInput("EPD operations must end with ';'".into()))?;
        let operation = remaining[..end].trim();
        let opcode = operation
            .split_whitespace()
            .next()
            .ok_or_else(|| Error::InvalidInput("EPD operation must contain an opcode".into()))?;
        if !opcode
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphabetic())
            || !opcode
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '_')
        {
            return Err(Error::InvalidInput(
                "EPD operation has an invalid opcode".into(),
            ));
        }
        remaining = remaining[end + 1..].trim_start();
    }
    Ok(())
}

struct OpeningBookPgnVisitor {
    selected: Option<OpeningBookSelection>,
    seen: u64,
    current_position: Chess,
    initial_position: Chess,
    castling_mode: CastlingMode,
    initial_fen: Option<String>,
    moves: Vec<String>,
    skip: bool,
    exceeded_resource_limit: bool,
}

impl OpeningBookPgnVisitor {
    fn new() -> Self {
        let start = Chess::default();
        Self {
            selected: None,
            seen: 0,
            current_position: start.clone(),
            initial_position: start,
            castling_mode: CastlingMode::Standard,
            initial_fen: None,
            moves: Vec::new(),
            skip: false,
            exceeded_resource_limit: false,
        }
    }
}

impl Visitor for OpeningBookPgnVisitor {
    type Result = Option<OpeningBookSelection>;

    fn begin_game(&mut self) {
        let start = Chess::default();
        self.current_position = start.clone();
        self.initial_position = start;
        self.castling_mode = CastlingMode::Standard;
        self.initial_fen = None;
        self.moves.clear();
        self.skip = false;
    }

    fn header(&mut self, key: &[u8], value: RawHeader<'_>) {
        if key == b"FEN" {
            let fen_text = value.decode_utf8_lossy().into_owned();
            match parse_fen_to_position(&fen_text) {
                Ok(position) => {
                    let parsed_fen: Fen = match fen_text.parse() {
                        Ok(fen) => fen,
                        Err(_) => {
                            self.skip = true;
                            return;
                        }
                    };
                    self.current_position = position.clone();
                    self.initial_position = position;
                    self.castling_mode = CastlingMode::detect(parsed_fen.as_setup());
                    self.initial_fen = Some(fen_text);
                }
                Err(_) => {
                    self.skip = true;
                }
            }
        }
    }

    fn end_headers(&mut self) -> Skip {
        Skip(self.skip)
    }

    fn san(&mut self, san: SanPlus) {
        if self.skip {
            return;
        }

        let mv = match san.san.to_move(&self.current_position) {
            Ok(mv) => mv,
            Err(_) => {
                self.skip = true;
                return;
            }
        };

        let uci = UciMove::from_move(&mv, self.castling_mode).to_string();
        if self.moves.len() == MAX_OPENING_BOOK_PGN_MOVES {
            self.exceeded_resource_limit = true;
            self.skip = true;
            return;
        }
        self.moves.push(uci);
        self.current_position.play_unchecked(&mv);
    }

    fn end_game(&mut self) -> Self::Result {
        if self.skip || self.moves.is_empty() {
            return None;
        }

        let initial_fen = self.initial_fen.clone().unwrap_or_else(|| {
            Fen::from_position(self.initial_position.clone(), EnPassantMode::Legal).to_string()
        });

        let candidate = OpeningBookSelection {
            initial_fen,
            initial_moves: self.moves.clone(),
        };

        self.seen = match self.seen.checked_add(1) {
            Some(seen) => seen,
            None => {
                self.exceeded_resource_limit = true;
                return None;
            }
        };
        let mut rng = rand::thread_rng();
        if rng.gen_range(0..self.seen) == 0 {
            self.selected = Some(candidate.clone());
        }

        Some(candidate)
    }
}

#[cfg(test)]
fn select_random_pgn_entry(input: impl Read) -> Result<OpeningBookSelection, Error> {
    select_random_pgn_entry_cancellable(input, &CancellationToken::new())
}

/// Makes cancellation observable inside a single `pgn_reader::read_game`
/// call. The parser may issue many reads for a large game, so checking only
/// between games would leave an abandoned request occupying the bounded
/// blocking gateway unnecessarily long.
struct CancellableRead<R> {
    inner: R,
    cancellation: CancellationToken,
}

impl<R> CancellableRead<R> {
    fn new(inner: R, cancellation: &CancellationToken) -> Self {
        Self {
            inner,
            cancellation: cancellation.clone(),
        }
    }
}

impl<R: Read> Read for CancellableRead<R> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if self.cancellation.is_cancelled() {
            return Err(io::Error::new(
                io::ErrorKind::Interrupted,
                "opening-book parsing cancelled",
            ));
        }
        self.inner.read(buffer)
    }
}

fn select_random_pgn_entry_cancellable(
    input: impl Read,
    cancellation: &CancellationToken,
) -> Result<OpeningBookSelection, Error> {
    let mut reader = BufferedReader::new(CancellableRead::new(input, cancellation));
    let mut visitor = OpeningBookPgnVisitor::new();

    loop {
        ensure_opening_book_not_cancelled(cancellation)?;
        match reader.read_game(&mut visitor) {
            Ok(Some(_)) => {}
            Ok(None) => break,
            Err(_) if cancellation.is_cancelled() => return Err(Error::Cancellation),
            Err(error) => return Err(error.into()),
        }
    }

    if visitor.exceeded_resource_limit {
        return Err(Error::ResourceLimit(
            "opening-book PGN exceeds the configured game-size limit".into(),
        ));
    }

    visitor.selected.ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Opening book PGN has no valid games",
        )
        .into()
    })
}

const MAX_OPENING_BOOK_BYTES: usize = 32 * 1024 * 1024;
const MAX_OPENING_BOOK_COMPRESSION_RATIO: u64 = 100;
const MAX_OPENING_BOOK_PGN_MOVES: usize = 10_000;
const MAX_OPENING_BOOK_EPD_LINE_BYTES: usize = 64 * 1024;

#[cfg(test)]
fn read_zip_inner(zip_bytes: &[u8]) -> Result<(String, Vec<u8>), Error> {
    read_zip_inner_cancellable(zip_bytes, &CancellationToken::new())
}

fn read_zip_inner_cancellable(
    zip_bytes: &[u8],
    cancellation: &CancellationToken,
) -> Result<(String, Vec<u8>), Error> {
    ensure_opening_book_not_cancelled(cancellation)?;
    let mut archive = zip::ZipArchive::new(Cursor::new(zip_bytes))?;
    if archive.len() != 1 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Opening book zip must contain exactly one file",
        )
        .into());
    }
    let mut inner = archive.by_index(0)?;
    let name = inner.name().to_string();
    let compressed = inner.compressed_size();
    let uncompressed = inner.size();
    if uncompressed > MAX_OPENING_BOOK_BYTES as u64
        || (compressed == 0 && uncompressed > 0)
        || (compressed > 0
            && uncompressed > compressed.saturating_mul(MAX_OPENING_BOOK_COMPRESSION_RATIO))
    {
        return Err(Error::ResourceLimit(
            "opening-book zip exceeds decompression safety limits".into(),
        ));
    }
    let mut buf = Vec::with_capacity(uncompressed as usize);
    let mut chunk = [0_u8; 16 * 1024];
    loop {
        // `ZipFile::read` performs decompression. Bound every such step so a
        // cancelled request releases its blocking-gateway permit promptly,
        // even while expanding one large archive member.
        ensure_opening_book_not_cancelled(cancellation)?;
        let read = inner.read(&mut chunk)?;
        if read == 0 {
            break;
        }
        let new_len = buf.len().checked_add(read).ok_or_else(|| {
            Error::ResourceLimit("opening-book zip exceeds decompression safety limits".into())
        })?;
        if new_len > MAX_OPENING_BOOK_BYTES {
            return Err(Error::ResourceLimit(
                "opening-book zip exceeds decompression safety limits".into(),
            ));
        }
        buf.extend_from_slice(&chunk[..read]);
    }
    if buf.len() != uncompressed as usize {
        return Err(Error::InvalidInput(
            "opening-book zip size does not match its declared metadata".into(),
        ));
    }
    ensure_opening_book_not_cancelled(cancellation)?;
    Ok((name, buf))
}

fn ensure_opening_book_not_cancelled(cancellation: &CancellationToken) -> Result<(), Error> {
    if cancellation.is_cancelled() {
        Err(Error::Cancellation)
    } else {
        Ok(())
    }
}

fn opening_book_ext(name: &str) -> Option<&str> {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".epd") {
        Some("epd")
    } else if lower.ends_with(".pgn") {
        Some("pgn")
    } else if lower.ends_with(".bin") {
        Some("bin")
    } else {
        None
    }
}

fn normalize_polyglot_uci(uci: &str) -> String {
    match uci {
        "e1h1" => "e1g1".to_string(),
        "e1a1" => "e1c1".to_string(),
        "e8h8" => "e8g8".to_string(),
        "e8a8" => "e8c8".to_string(),
        _ => uci.to_string(),
    }
}

fn choose_weighted_index(weights: &[u16], rng: &mut impl Rng) -> usize {
    let total: u64 = weights.iter().map(|w| *w as u64).sum();
    if total == 0 {
        return rng.gen_range(0..weights.len());
    }

    choose_weighted_target(weights, rng.gen_range(0..total))
}

fn choose_weighted_target(weights: &[u16], mut target: u64) -> usize {
    for (index, weight) in weights.iter().enumerate() {
        let weight = *weight as u64;
        if target < weight {
            return index;
        }
        target -= weight;
    }

    weights.len().saturating_sub(1)
}

struct CancelOpeningBookOnDrop(CancellationToken);

impl Drop for CancelOpeningBookOnDrop {
    fn drop(&mut self) {
        self.0.cancel();
    }
}

async fn apply_opening_book(
    config: GameConfig,
    authority: &std::sync::Mutex<Option<PathAuthority>>,
) -> Result<OpeningBookResult, Error> {
    let Some(opening_book) = &config.opening_book else {
        return Ok(OpeningBookResult {
            config,
            polyglot_book: None,
            polyglot_max_ply: 0,
        });
    };

    let snapshot = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .opening_book_descriptor(&opening_book.book)?;
    let max_ply = opening_book.max_ply.max(1);

    let cancellation = CancellationToken::new();
    let _cancel_on_drop = CancelOpeningBookOnDrop(cancellation.clone());
    BLOCKING_GATEWAY
        .spawn_cancellable(cancellation, move |cancellation| {
            apply_opening_book_descriptor(config, snapshot, max_ply, cancellation)
        })
        .await
}

fn apply_opening_book_descriptor(
    config: GameConfig,
    mut descriptor: crate::infra::path_authority::OpeningBookDescriptor,
    max_ply: usize,
    cancellation: &CancellationToken,
) -> Result<OpeningBookResult, Error> {
    ensure_opening_book_not_cancelled(cancellation)?;
    let file_name = descriptor.file_name.clone();
    let bytes = descriptor.read_bounded_bytes_cancellable(MAX_OPENING_BOOK_BYTES, cancellation)?;
    let ext = opening_book_ext(&file_name);

    let is_human_vs_human = matches!(
        (&config.white, &config.black),
        (PlayerConfig::Human { .. }, PlayerConfig::Human { .. })
    );

    enum BookAction {
        Selection(OpeningBookSelection),
        Polyglot(CancellablePolyglotBook),
        Skip,
    }

    let action = match ext {
        Some("epd") => BookAction::Selection(select_random_epd_entry_cancellable(
            BufReader::new(Cursor::new(bytes)),
            cancellation,
        )?),
        Some("pgn") => BookAction::Selection(select_random_pgn_entry_cancellable(
            Cursor::new(bytes),
            cancellation,
        )?),
        Some("bin") => {
            if is_human_vs_human {
                BookAction::Skip
            } else {
                BookAction::Polyglot(load_polyglot_book_cancellable(&bytes, cancellation)?)
            }
        }
        Some("zip") => {
            let (inner_name, data) = read_zip_inner_cancellable(&bytes, cancellation)?;
            match opening_book_ext(&inner_name) {
                Some("epd") => BookAction::Selection(select_random_epd_entry_cancellable(
                    BufReader::new(Cursor::new(data)),
                    cancellation,
                )?),
                Some("pgn") => BookAction::Selection(select_random_pgn_entry_cancellable(
                    Cursor::new(data),
                    cancellation,
                )?),
                Some("bin") => {
                    if is_human_vs_human {
                        BookAction::Skip
                    } else {
                        BookAction::Polyglot(load_polyglot_book_cancellable(&data, cancellation)?)
                    }
                }
                _ => {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        "Zip must contain a .pgn, .epd, or .bin file",
                    )
                    .into())
                }
            }
        }
        _ => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Unsupported opening book format. Use .pgn, .epd, .bin, or .zip",
            )
            .into())
        }
    };

    match action {
        BookAction::Selection(selection) => {
            let mut next = config;
            next.initial_fen = Some(selection.initial_fen);
            next.initial_moves = selection.initial_moves;
            Ok(OpeningBookResult {
                config: next,
                polyglot_book: None,
                polyglot_max_ply: 0,
            })
        }
        BookAction::Polyglot(book) => Ok(OpeningBookResult {
            config,
            polyglot_book: Some(book),
            polyglot_max_ply: max_ply,
        }),
        BookAction::Skip => Ok(OpeningBookResult {
            config,
            polyglot_book: None,
            polyglot_max_ply: 0,
        }),
    }
}

#[cfg(test)]
fn load_polyglot_book(bytes: &[u8]) -> Result<CancellablePolyglotBook, Error> {
    load_polyglot_book_cancellable(bytes, &CancellationToken::new())
}

#[derive(Clone, Copy)]
struct PolyglotRecord {
    key: u64,
    move_data: u16,
    weight: u16,
}

struct PolyglotMoveEntry {
    move_string: String,
    weight: u16,
}

/// A bounded, cancellation-aware Polyglot representation. The upstream
/// loader parses and sorts a whole file without checkpoints, so it cannot run
/// inside the shared blocking gateway without making cancellation advisory.
struct CancellablePolyglotBook {
    entries: Vec<PolyglotRecord>,
}

impl CancellablePolyglotBook {
    fn get_all_moves_from_fen(&self, fen: &str) -> Vec<PolyglotMoveEntry> {
        let Ok(key) = polyglot_hash_from_fen(fen) else {
            return Vec::new();
        };
        let Ok(mut index) = self.entries.binary_search_by_key(&key, |entry| entry.key) else {
            return Vec::new();
        };
        while index > 0 && self.entries[index - 1].key == key {
            index -= 1;
        }
        let mut moves = Vec::new();
        for entry in self.entries[index..]
            .iter()
            .take_while(|entry| entry.key == key)
        {
            if let Some(move_string) = polyglot_move_to_uci(entry.move_data) {
                moves.push(PolyglotMoveEntry {
                    move_string,
                    weight: entry.weight,
                });
            }
        }
        moves.sort_by_key(|entry| std::cmp::Reverse(entry.weight));
        moves
    }
}

fn polyglot_move_to_uci(move_data: u16) -> Option<String> {
    let from = ((move_data >> 6) & 0x3f) as u8;
    let to = (move_data & 0x3f) as u8;
    let promotion = match (move_data >> 12) & 0x0f {
        0 => None,
        1 => Some('n'),
        2 => Some('b'),
        3 => Some('r'),
        4 => Some('q'),
        _ => return None,
    };
    let square = |square: u8| {
        let file = (b'a' + square % 8) as char;
        let rank = (b'1' + square / 8) as char;
        format!("{file}{rank}")
    };
    let mut uci = format!("{}{}", square(from), square(to));
    if let Some(promotion) = promotion {
        uci.push(promotion);
    }
    Some(uci)
}

fn load_polyglot_book_cancellable(
    bytes: &[u8],
    cancellation: &CancellationToken,
) -> Result<CancellablePolyglotBook, Error> {
    ensure_opening_book_not_cancelled(cancellation)?;
    if bytes.len() > MAX_OPENING_BOOK_BYTES {
        return Err(Error::ResourceLimit(
            "Polyglot book exceeds the configured size limit".into(),
        ));
    }
    if !bytes.len().is_multiple_of(16) {
        return Err(Error::InvalidInput(
            "Polyglot book is not aligned to 16-byte records".into(),
        ));
    }
    let mut entries = Vec::with_capacity(bytes.len() / 16);
    for (index, record) in bytes.chunks_exact(16).enumerate() {
        if index % 1024 == 0 {
            ensure_opening_book_not_cancelled(cancellation)?;
        }
        entries.push(PolyglotRecord {
            key: u64::from_be_bytes([
                record[0], record[1], record[2], record[3], record[4], record[5], record[6],
                record[7],
            ]),
            move_data: u16::from_be_bytes([record[8], record[9]]),
            weight: u16::from_be_bytes([record[10], record[11]]),
        });
    }
    cancellable_polyglot_sort(&mut entries, cancellation)?;
    Ok(CancellablePolyglotBook { entries })
}

fn cancellable_polyglot_sort(
    entries: &mut [PolyglotRecord],
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    if entries.len() < 2 {
        return Ok(());
    }
    let mut buffer = vec![
        PolyglotRecord {
            key: 0,
            move_data: 0,
            weight: 0,
        };
        entries.len()
    ];
    let mut width = 1_usize;
    while width < entries.len() {
        let mut start = 0;
        while start < entries.len() {
            ensure_opening_book_not_cancelled(cancellation)?;
            let mid = (start + width).min(entries.len());
            let end = (mid + width).min(entries.len());
            let (mut left, mut right, mut output) = (start, mid, start);
            while left < mid && right < end {
                if entries[left].key <= entries[right].key {
                    buffer[output] = entries[left];
                    left += 1;
                } else {
                    buffer[output] = entries[right];
                    right += 1;
                }
                output += 1;
                if output % 4096 == 0 {
                    ensure_opening_book_not_cancelled(cancellation)?;
                }
            }
            buffer[output..output + (mid - left)].copy_from_slice(&entries[left..mid]);
            output += mid - left;
            buffer[output..output + (end - right)].copy_from_slice(&entries[right..end]);
            entries[start..end].copy_from_slice(&buffer[start..end]);
            start = end;
        }
        width = width.saturating_mul(2);
    }
    Ok(())
}

fn spawn_engine_task(
    game_id: &GameId,
    controller: &Arc<RwLock<GameController>>,
    app: &AppHandle,
    context: EngineRequestContext,
    manager: std::sync::Weak<GameManager>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    let game_id_clone = game_id.clone();
    let controller_clone = controller.clone();
    let app_clone = app.clone();
    tokio::spawn(async move {
        request_engine_move(
            &game_id_clone,
            &controller_clone,
            &app_clone,
            context,
            manager,
        )
        .await
    })
}

async fn maybe_start_engine(
    controller: &Arc<RwLock<GameController>>,
    engine_task: &Option<tokio::task::JoinHandle<Result<(), Error>>>,
) -> Option<EngineRequestContext> {
    let mut ctrl = controller.write().await;
    if engine_task.is_some() {
        return None;
    }
    ctrl.begin_engine_request()
}

async fn game_loop(
    game_id: GameId,
    live: Arc<LiveSession>,
    mut shutdown_rx: watch::Receiver<bool>,
    mut move_notify_rx: tokio::sync::mpsc::Receiver<()>,
    app: AppHandle,
    manager: std::sync::Weak<GameManager>,
) {
    let controller = live.controller.clone();
    let mut clock_interval = interval(Duration::from_millis(100));
    let mut engine_task: Option<tokio::task::JoinHandle<Result<(), Error>>> = None;

    if let Some(context) = maybe_start_engine(&controller, &engine_task).await {
        engine_task = Some(spawn_engine_task(
            &game_id,
            &controller,
            &app,
            context,
            manager.clone(),
        ));
    }

    loop {
        tokio::select! {
            biased;

            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    info!("Game {} shutting down", game_id);
                    if let Some(task) = engine_task.take() {
                        task.abort();
                        let _ = task.await;
                    }
                    break;
                }
            }

            result = async {
                if let Some(ref mut task) = engine_task {
                    Some(task.await)
                } else {
                    std::future::pending::<Option<Result<Result<(), Error>, tokio::task::JoinError>>>().await
                }
            } => {
                engine_task = None;

                match result {
                    Some(Ok(Ok(()))) => {
                        if let Some(context) = maybe_start_engine(&controller, &engine_task).await {
                            engine_task = Some(spawn_engine_task(
                                &game_id,
                                &controller,
                                &app,
                                context,
                                manager.clone(),
                            ));
                        }
                    }
                    Some(Ok(Err(e))) => {
                        error!("Engine move error: {:?}", e);
                        let mut ctrl = controller.write().await;
                        ctrl.engine_thinking = false;
                        if ctrl.status == GameStatus::Playing {
                            let result = if ctrl.position.turn() == Color::White {
                                GameResult::BlackWins { reason: GameEndReason::Abandonment }
                            } else {
                                GameResult::WhiteWins { reason: GameEndReason::Abandonment }
                            };
                            ctrl.end_game(result);
                        }
                        emit_terminal_event(&mut ctrl, &app);
                        break;
                    }
                    Some(Err(_join_error)) => {
                        let mut ctrl = controller.write().await;
                        ctrl.engine_thinking = false;
                        if ctrl.status == GameStatus::Playing {
                            let result = if ctrl.position.turn() == Color::White {
                                GameResult::BlackWins { reason: GameEndReason::Abandonment }
                            } else {
                                GameResult::WhiteWins { reason: GameEndReason::Abandonment }
                            };
                            ctrl.end_game(result);
                        }
                        emit_terminal_event(&mut ctrl, &app);
                        break;
                    }
                    None => {
                        error!("game loop observed an impossible empty engine-task completion");
                        break;
                    }
                }
            }

            _ = move_notify_rx.recv() => {
                if let Some(context) = maybe_start_engine(&controller, &engine_task).await {
                    engine_task = Some(spawn_engine_task(
                        &game_id,
                        &controller,
                        &app,
                        context,
                        manager.clone(),
                    ));
                }
            }

            _ = clock_interval.tick() => {
                let is_finished;

                {
                    let mut ctrl = controller.write().await;

                    if ctrl.status != GameStatus::Playing {
                        break;
                    }

                    if let Some(result) = ctrl.settle_active_clock() {
                        ctrl.end_game(result);
                        emit_terminal_event(&mut ctrl, &app);
                        break;
                    }

                    let (white_time, black_time) = ctrl.get_current_times();
                    ctrl.bump_revision();
                    let _ = ClockUpdateEvent {
                        game_id: game_id.clone(),
                        session: ctrl.session,
                        revision: ctrl.revision,
                        white_time,
                        black_time,
                    }.emit(&app);

                    is_finished = ctrl.status != GameStatus::Playing;
                }

                if is_finished {
                    break;
                }
            }
        }
    }

    if let Some(task) = engine_task.take() {
        task.abort();
        let _ = task.await;
    }

    let engines = {
        let ctrl = controller.read().await;
        [ctrl.white_engine.clone(), ctrl.black_engine.clone()]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
    };
    if let Err(error) = terminate_game_engines(engines).await {
        error!("Game {game_id} engine cleanup failed: {error}");
    }

    if let Some(manager) = manager.upgrade() {
        manager
            .complete_exact(&game_id, live.session, &controller)
            .await;
    }
    info!("Game loop ended for {}", game_id);
}

fn try_polyglot_book_move(controller: &GameController) -> Option<String> {
    let book = controller.polyglot_book.as_ref()?;

    if controller.moves.len() >= controller.polyglot_max_ply {
        return None;
    }

    let fen = Fen::from_position(controller.position.clone(), EnPassantMode::Legal).to_string();
    let entries = book.get_all_moves_from_fen(&fen);

    if entries.is_empty() {
        return None;
    }

    let mut rng = rand::thread_rng();
    let legal_moves = entries
        .into_iter()
        .filter_map(|entry| {
            let uci = normalize_polyglot_uci(&entry.move_string);
            let parsed = UciMove::from_ascii(uci.as_bytes()).ok()?;
            parsed.to_move(&controller.position).ok()?;
            Some((uci, entry.weight))
        })
        .collect::<Vec<_>>();

    if legal_moves.is_empty() {
        return None;
    }

    let weights = legal_moves.iter().map(|(_, w)| *w).collect::<Vec<_>>();
    let selected = choose_weighted_index(&weights, &mut rng);
    Some(legal_moves[selected].0.clone())
}

async fn request_engine_move(
    game_id: &str,
    controller: &Arc<RwLock<GameController>>,
    app: &AppHandle,
    context: EngineRequestContext,
    manager: std::sync::Weak<GameManager>,
) -> Result<(), Error> {
    // Try polyglot book move first (only for engine turns with a loaded book)
    {
        let ctrl = controller.read().await;
        let book_move = try_polyglot_book_move(&ctrl);
        let turn = ctrl.position.turn();
        drop(ctrl);

        if let Some(book_uci) = book_move {
            let Some(manager) = manager.upgrade() else {
                return Ok(());
            };
            let lifecycle = manager.lifecycle_slot(game_id);
            let _operation = lifecycle.lock().await;
            let mut ctrl = controller.write().await;
            if !manager.session_is_current(game_id, context.session)
                || !ctrl.accepts_engine_context(&context)
                || ctrl.position.turn() != turn
            {
                return Ok(());
            }

            let game_move = match ctrl.apply_move(&book_uci) {
                Ok(move_) => move_,
                Err(_) if matches!(ctrl.status, GameStatus::Finished { .. }) => {
                    emit_terminal_event(&mut ctrl, app);
                    return Ok(());
                }
                Err(error) => return Err(error),
            };
            let (white_time, black_time) = ctrl.get_current_times();

            GameMoveEvent {
                game_id: game_id.to_string(),
                session: ctrl.session,
                revision: ctrl.move_event_revision(),
                moves: ctrl.moves.clone(),
                fen: game_move.fen_after,
                white_time,
                black_time,
            }
            .emit(app)
            .unwrap_or(());

            emit_terminal_event(&mut ctrl, app);

            return Ok(());
        }
    }

    let (engine_arc, go_mode, initial_fen, moves, turn) = {
        let ctrl = controller.read().await;

        if ctrl.status != GameStatus::Playing {
            return Ok(());
        }

        let turn = ctrl.position.turn();
        let (engine_arc, player_config) = if turn == Color::White {
            (ctrl.white_engine.clone(), ctrl.config.white.clone())
        } else {
            (ctrl.black_engine.clone(), ctrl.config.black.clone())
        };

        let engine = match engine_arc {
            Some(e) => e,
            None => return Err(Error::EngineNotInitialized),
        };

        let go = match player_config {
            PlayerConfig::Engine { go, .. } => go,
            _ => return Err(Error::NotEngineTurn),
        };

        let initial_fen = ctrl.initial_fen.clone();
        let moves: Vec<String> = ctrl.moves.iter().map(|m| m.uci.clone()).collect();
        let (white_time, black_time) = ctrl.get_current_times();

        let go_mode = match (white_time, black_time, ctrl.clock.as_ref()) {
            (None, None, None) => go.unwrap_or(GoMode::Depth(20)),
            (Some(wtime), Some(btime), Some(clock)) => GoMode::PlayersTime(PlayersTime::new(
                u32::try_from(wtime)
                    .map_err(|_| Error::InvalidInput("white clock exceeds UCI range".into()))?,
                u32::try_from(btime)
                    .map_err(|_| Error::InvalidInput("black clock exceeds UCI range".into()))?,
                u32::try_from(clock.white_increment)
                    .map_err(|_| Error::InvalidInput("white increment exceeds UCI range".into()))?,
                u32::try_from(clock.black_increment)
                    .map_err(|_| Error::InvalidInput("black increment exceeds UCI range".into()))?,
            )),
            _ => {
                return Err(Error::Conflict(
                    "game clock state is asymmetric or incomplete".into(),
                ));
            }
        };

        (engine, go_mode, initial_fen, moves, turn)
    };

    if context.cancellation.is_cancelled() {
        return Ok(());
    }
    if let Err(error) = engine_arc.set_position(&initial_fen, &moves).await {
        return if context.cancellation.is_cancelled() {
            Ok(())
        } else {
            Err(error)
        };
    }
    if context.cancellation.is_cancelled() {
        return Ok(());
    }
    let request_id = match engine_arc.start_search(&go_mode).await {
        Ok(request_id) => request_id,
        Err(_) if context.cancellation.is_cancelled() => return Ok(()),
        Err(error) => return Err(error),
    };
    {
        let mut ctrl = controller.write().await;
        if !ctrl.register_engine_request_id(&context, request_id) {
            drop(ctrl);
            let _ = engine_arc.stop_current().await;
            return Ok(());
        }
    }
    let best_move = match engine_arc
        .wait_bestmove_cancellable(request_id, &context.cancellation)
        .await
    {
        Ok(best_move) => best_move,
        Err(_) if context.cancellation.is_cancelled() => return Ok(()),
        Err(error) => return Err(error),
    };

    let Some(manager) = manager.upgrade() else {
        return Ok(());
    };
    let lifecycle = manager.lifecycle_slot(game_id);
    let _operation = lifecycle.lock().await;
    let mut ctrl = controller.write().await;
    if !manager.session_is_current(game_id, context.session)
        || !ctrl.accepts_engine_result(&context, request_id)
        || ctrl.position.turn() != turn
    {
        return Ok(());
    }

    let game_move = match ctrl.apply_move(&best_move) {
        Ok(move_) => move_,
        Err(_) if matches!(ctrl.status, GameStatus::Finished { .. }) => {
            emit_terminal_event(&mut ctrl, app);
            return Ok(());
        }
        Err(error) => return Err(error),
    };
    let (white_time, black_time) = ctrl.get_current_times();

    GameMoveEvent {
        game_id: game_id.to_string(),
        session: ctrl.session,
        revision: ctrl.move_event_revision(),
        moves: ctrl.moves.clone(),
        fen: game_move.fen_after,
        white_time,
        black_time,
    }
    .emit(app)
    .unwrap_or(());

    emit_terminal_event(&mut ctrl, app);

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn start_game(
    game_id: String,
    config: GameConfig,
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    info!("Starting game with ID {}", game_id);
    state
        .game_manager
        .start_game(game_id, config, app, &state.pgn_path_authority)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn get_game_state(
    game_id: String,
    expected_session: u64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    state
        .game_manager
        .get_game_state(&game_id, expected_session)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn make_game_move(
    game_id: String,
    expected_session: u64,
    uci: String,
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    state
        .game_manager
        .make_move(&game_id, expected_session, &uci, &app)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn take_back_game_move(
    game_id: String,
    expected_session: u64,
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    state
        .game_manager
        .take_back_move(&game_id, expected_session, &app)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn resign_game(
    game_id: String,
    expected_session: u64,
    color: String,
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<GameState, Error> {
    state
        .game_manager
        .resign(&game_id, expected_session, &color, &app)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn abort_game(
    game_id: String,
    expected_session: u64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), Error> {
    state
        .game_manager
        .abort_game(&game_id, expected_session)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn get_game_engine_logs(
    game_id: String,
    expected_session: u64,
    color: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<EngineLog>, Error> {
    state
        .game_manager
        .get_engine_logs(&game_id, expected_session, &color)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    struct CancelsAfterFirstRead {
        bytes: Cursor<Vec<u8>>,
        cancellation: CancellationToken,
        reads: usize,
    }

    impl Read for CancelsAfterFirstRead {
        fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
            let chunk_len = buffer.len().min(1);
            let read = self.bytes.read(&mut buffer[..chunk_len])?;
            self.reads += 1;
            if self.reads == 1 {
                self.cancellation.cancel();
            }
            Ok(read)
        }
    }

    fn human_config() -> GameConfig {
        GameConfig {
            white: PlayerConfig::Human {
                name: "White".into(),
            },
            black: PlayerConfig::Human {
                name: "Black".into(),
            },
            white_time_control: None,
            black_time_control: None,
            initial_fen: None,
            initial_moves: Vec::new(),
            opening_book: None,
        }
    }

    fn mating_config(white: PlayerConfig) -> GameConfig {
        GameConfig {
            white,
            black: PlayerConfig::Human {
                name: "Black".into(),
            },
            white_time_control: None,
            black_time_control: None,
            // White has Qg7#, which lets this test cover the terminal-move
            // publication protocol without an external engine process.
            initial_fen: Some("7k/8/5KQ1/8/8/8/8/8 w - - 0 1".into()),
            initial_moves: Vec::new(),
            opening_book: None,
        }
    }

    fn fake_engine_player() -> PlayerConfig {
        PlayerConfig::Engine {
            name: "Engine".into(),
            handle: EngineHandle {
                id: crate::infra::path_authority::PathRef {
                    id: "test-engine".into(),
                },
                kind: crate::infra::path_authority::EngineHandleKind::Engine,
            },
            options: Vec::new(),
            go: None,
        }
    }

    fn assert_terminal_move_publication_revisions(config: GameConfig) {
        let mut controller = GameController::new("game".into(), 1, config).unwrap();
        controller.apply_move("g6g7").unwrap();

        assert!(matches!(controller.status, GameStatus::Finished { .. }));
        let move_revision = controller.move_event_revision();
        let terminal_revision = controller.get_state().revision;
        assert_eq!(terminal_revision, move_revision + 1);

        // A strict client accepts the publications in natural order, and keeps
        // the terminal state if transport delivers the two events out of order.
        let mut newest = 0;
        assert!(move_revision > newest);
        newest = move_revision;
        assert!(terminal_revision > newest);

        let mut newest = 0;
        assert!(terminal_revision > newest);
        newest = terminal_revision;
        assert!(move_revision <= newest);
    }

    #[test]
    fn controller_applies_and_rebuilds_moves_without_losing_position_history() {
        let mut controller = GameController::new("game".into(), 1, human_config()).unwrap();
        assert_eq!(controller.revision, 0);
        controller.apply_move("e2e4").unwrap();
        assert_eq!(controller.revision, 1);
        controller.apply_move("e7e5").unwrap();
        assert_eq!(controller.moves.len(), 2);
        controller.moves.pop();
        controller.rebuild_position_from_moves().unwrap();
        controller.bump_revision();
        assert_eq!(controller.revision, 3);
        assert_eq!(controller.moves.len(), 1);
        assert_eq!(controller.position.turn(), Color::Black);
        assert!(controller.position_history.values().all(|count| *count > 0));
    }

    #[test]
    fn move_application_counts_repeated_positions_for_live_and_initial_moves() {
        let cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
        let mut live = GameController::new("live".into(), 1, human_config()).unwrap();
        let initial_key = GameController::position_key(&live.position);
        for uci in cycle {
            live.apply_move(uci).unwrap();
        }
        assert_eq!(live.position_history.get(&initial_key), Some(&2));

        let mut config = human_config();
        config.initial_moves = cycle.into_iter().map(str::to_owned).collect();
        let initial = GameController::new("initial".into(), 1, config).unwrap();
        assert_eq!(initial.position_history.get(&initial_key), Some(&2));
    }

    #[test]
    fn ending_a_game_is_idempotent() {
        let mut controller = GameController::new("game".into(), 1, human_config()).unwrap();
        assert!(controller.end_game(GameResult::Draw {
            reason: DrawReason::Agreement,
        }));
        assert_eq!(controller.revision, 1);
        assert!(!controller.end_game(GameResult::Draw {
            reason: DrawReason::Agreement,
        }));
        assert_eq!(controller.revision, 1);
    }

    #[test]
    fn terminal_human_move_has_distinct_move_and_game_over_revisions() {
        let config = mating_config(PlayerConfig::Human {
            name: "White".into(),
        });
        assert_terminal_move_publication_revisions(config.clone());
        let mut controller = GameController::new("game".into(), 1, config).unwrap();
        controller.apply_move("g6g7").unwrap();
        assert!(matches!(
            controller.status,
            GameStatus::Finished {
                result: GameResult::WhiteWins {
                    reason: GameEndReason::Checkmate
                }
            }
        ));
    }

    #[test]
    fn terminal_engine_move_has_distinct_move_and_game_over_revisions() {
        assert_terminal_move_publication_revisions(mating_config(fake_engine_player()));
    }

    #[test]
    fn opening_zip_rejects_compression_bombs_before_decompression() {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("book.pgn", options).unwrap();
        zip.write_all(&vec![b'x'; 1024 * 1024]).unwrap();
        let bytes = zip.finish().unwrap().into_inner();
        assert!(matches!(
            read_zip_inner(&bytes),
            Err(Error::ResourceLimit(_))
        ));
    }

    #[test]
    fn opening_book_rejects_malformed_epd_operations_and_extra_fen_fields() {
        let valid = b"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - bm e4;\n";
        assert!(select_random_epd_entry(BufReader::new(Cursor::new(valid))).is_ok());

        let missing_terminator = b"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - bm e4\n";
        assert!(select_random_epd_entry(BufReader::new(Cursor::new(missing_terminator))).is_err());

        let full_fen = b"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1\n";
        assert!(select_random_epd_entry(BufReader::new(Cursor::new(full_fen))).is_err());
    }

    #[test]
    fn epd_operation_grammar_handles_quotes_escapes_and_opcode_boundaries() {
        for valid in [
            "bm e4;",
            "id \"semicolon; stays quoted\";",
            "id \"escaped \\\" quote\";",
            "bm_1 e4;",
        ] {
            assert!(validate_epd_operations(valid).is_ok(), "{valid}");
        }
        for invalid in ["bm a\\\";", "1bad e4;", "bad-op e4;", "bm e4"] {
            assert!(validate_epd_operations(invalid).is_err(), "{invalid}");
        }
        assert!(matches!(
            validate_epd_operations("id \"unterminated;"),
            Err(Error::InvalidInput(message))
                if message == "EPD operation contains an unterminated quoted operand"
        ));
    }

    #[test]
    fn opening_book_extension_castling_and_weight_selection_are_exact() {
        for (name, expected) in [
            ("book.EPD", Some("epd")),
            ("book.pgn", Some("pgn")),
            ("book.BIN", Some("bin")),
            ("book.zip", None),
        ] {
            assert_eq!(opening_book_ext(name), expected);
        }
        for (input, expected) in [
            ("e1h1", "e1g1"),
            ("e1a1", "e1c1"),
            ("e8h8", "e8g8"),
            ("e8a8", "e8c8"),
            ("e2e4", "e2e4"),
        ] {
            assert_eq!(normalize_polyglot_uci(input), expected);
        }

        let weights = [2, 3, 5];
        for (target, expected) in [(0, 0), (1, 0), (2, 1), (4, 1), (5, 2), (9, 2)] {
            assert_eq!(choose_weighted_target(&weights, target), expected);
        }
        use rand::SeedableRng;
        use std::collections::HashSet;

        let zero_weight_selections = (0..128)
            .map(|seed| {
                let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
                choose_weighted_index(&[0, 0, 0], &mut rng)
            })
            .collect::<HashSet<_>>();
        assert_eq!(zero_weight_selections, HashSet::from([0, 1, 2]));
    }

    #[test]
    fn malformed_opening_book_payloads_return_errors_without_panicking() {
        let zip = std::panic::catch_unwind(|| read_zip_inner(b"not a zip archive"));
        assert!(matches!(zip, Ok(Err(_))));

        let pgn = std::panic::catch_unwind(|| {
            select_random_pgn_entry(Cursor::new(b"1. definitely-not-san *".to_vec()))
        });
        assert!(matches!(pgn, Ok(Err(_))));

        let polyglot = std::panic::catch_unwind(|| load_polyglot_book(&[0_u8]));
        assert!(matches!(polyglot, Ok(Err(_))));
    }

    #[test]
    fn cancelled_opening_book_parsers_stop_before_consuming_input() {
        let cancellation = CancellationToken::new();
        cancellation.cancel();

        assert!(matches!(
            select_random_pgn_entry_cancellable(Cursor::new(b"1. e4 e5 *"), &cancellation),
            Err(Error::Cancellation)
        ));
        assert!(matches!(
            read_zip_inner_cancellable(b"not a zip archive", &cancellation),
            Err(Error::Cancellation)
        ));
        assert!(matches!(
            load_polyglot_book_cancellable(&[0_u8; 16], &cancellation),
            Err(Error::Cancellation)
        ));
    }

    #[test]
    fn pgn_cancellation_interrupts_an_in_progress_read_game() {
        let cancellation = CancellationToken::new();
        let reader = CancelsAfterFirstRead {
            bytes: Cursor::new(b"1. e4 e5 *".to_vec()),
            cancellation: cancellation.clone(),
            reads: 0,
        };

        assert!(matches!(
            select_random_pgn_entry_cancellable(reader, &cancellation),
            Err(Error::Cancellation)
        ));
    }

    #[test]
    fn epd_cancellation_interrupts_an_in_progress_unterminated_line() {
        let cancellation = CancellationToken::new();
        let reader = BufReader::new(CancelsAfterFirstRead {
            bytes: Cursor::new(
                b"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - bm e4;".to_vec(),
            ),
            cancellation: cancellation.clone(),
            reads: 0,
        });

        assert!(matches!(
            select_random_epd_entry_cancellable(reader, &cancellation),
            Err(Error::Cancellation)
        ));
    }

    #[test]
    fn epd_reader_rejects_unbounded_lines() {
        let line = vec![b'x'; MAX_OPENING_BOOK_EPD_LINE_BYTES + 1];
        assert!(matches!(
            select_random_epd_entry(BufReader::new(Cursor::new(line))),
            Err(Error::ResourceLimit(_))
        ));
    }

    #[test]
    fn time_controls_reject_asymmetry_and_values_outside_uci_range() {
        let mut config = human_config();
        config.white_time_control = Some(TimeControl {
            initial_time: 1_000,
            increment: 0,
        });
        assert!(matches!(
            GameController::new("game".into(), 1, config.clone()),
            Err(Error::InvalidInput(_))
        ));

        config.black_time_control = Some(TimeControl {
            initial_time: 1_000,
            increment: u64::from(MAX_ENGINE_LIMIT) + 1,
        });
        assert!(matches!(
            GameController::new("game".into(), 1, config),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn time_controls_accept_exact_uci_limits_and_either_single_running_clock() {
        for (white_initial, black_initial) in [(u64::from(MAX_ENGINE_LIMIT), 0), (0, 1)] {
            let mut config = human_config();
            config.white_time_control = Some(TimeControl {
                initial_time: white_initial,
                increment: u64::from(MAX_ENGINE_LIMIT),
            });
            config.black_time_control = Some(TimeControl {
                initial_time: black_initial,
                increment: u64::from(MAX_ENGINE_LIMIT),
            });
            assert!(GameController::new("game".into(), 1, config).is_ok());
        }
    }

    #[test]
    fn clock_is_debited_before_a_legal_move_then_incremented_once() {
        let mut config = human_config();
        config.white_time_control = Some(TimeControl {
            initial_time: 1_000,
            increment: 100,
        });
        config.black_time_control = Some(TimeControl {
            initial_time: 1_000,
            increment: 0,
        });
        let mut controller = GameController::new("game".into(), 1, config).unwrap();
        controller.clock.as_mut().unwrap().last_tick = Instant::now() - Duration::from_millis(250);

        let game_move = controller.apply_move("e2e4").unwrap();
        assert!(matches!(game_move.clock, Some(700..=800)));
        let white_time = controller.clock.as_ref().unwrap().white_time.unwrap();
        assert!((800..=850).contains(&white_time));
        assert_eq!(controller.clock.as_ref().unwrap().black_time, Some(1_000));
    }

    #[test]
    fn timeout_is_a_draw_when_the_opponent_has_insufficient_mating_material() {
        let mut config = human_config();
        config.initial_fen = Some("8/8/8/8/8/8/3K2N1/5k2 b - - 0 1".into());
        config.white_time_control = Some(TimeControl {
            initial_time: 1_000,
            increment: 0,
        });
        config.black_time_control = Some(TimeControl {
            initial_time: 1,
            increment: 0,
        });
        let mut controller = GameController::new("game".into(), 1, config).unwrap();
        controller.clock.as_mut().unwrap().last_tick = Instant::now() - Duration::from_millis(2);

        assert_eq!(
            controller.settle_active_clock(),
            Some(GameResult::Draw {
                reason: DrawReason::InsufficientMaterial,
            })
        );
    }

    #[test]
    fn timeout_awards_the_opponent_and_current_times_debit_only_the_active_side() {
        let mut config = human_config();
        config.white_time_control = Some(TimeControl {
            initial_time: 1_000,
            increment: 0,
        });
        config.black_time_control = Some(TimeControl {
            initial_time: 2_000,
            increment: 0,
        });
        let mut white_to_move = GameController::new("white".into(), 1, config.clone()).unwrap();
        white_to_move.clock.as_mut().unwrap().last_tick =
            Instant::now() - Duration::from_millis(100);
        let (white, black) = white_to_move.get_current_times();
        assert!(matches!(white, Some(850..=950)));
        assert_eq!(black, Some(2_000));

        config.initial_fen =
            Some("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1".into());
        let mut black_to_move = GameController::new("black".into(), 1, config).unwrap();
        black_to_move.clock.as_mut().unwrap().last_tick =
            Instant::now() - Duration::from_millis(100);
        let (white, black) = black_to_move.get_current_times();
        assert_eq!(white, Some(1_000));
        assert!(matches!(black, Some(1_850..=1_950)));

        black_to_move.clock.as_mut().unwrap().black_time = Some(1);
        black_to_move.clock.as_mut().unwrap().last_tick = Instant::now() - Duration::from_millis(2);
        assert!(matches!(
            black_to_move.settle_active_clock(),
            Some(GameResult::WhiteWins {
                reason: GameEndReason::Timeout
            })
        ));

        let no_clock = GameController::new("none".into(), 1, human_config()).unwrap();
        assert_eq!(no_clock.get_current_times(), (None, None));
    }

    #[test]
    fn game_session_identity_is_preserved_in_state() {
        let controller = GameController::new("game".into(), 42, human_config()).unwrap();
        assert_eq!(controller.get_state().session, 42);
    }

    #[test]
    fn initial_terminal_fen_is_finished_before_a_live_session_starts() {
        let mut source = GameController::new(
            "source".into(),
            1,
            mating_config(PlayerConfig::Human {
                name: "White".into(),
            }),
        )
        .unwrap();
        source.apply_move("g6g7").unwrap();
        let mut config = human_config();
        config.initial_fen = Some(source.get_state().current_fen);
        let controller = GameController::new("game".into(), 1, config).unwrap();
        assert!(matches!(controller.status, GameStatus::Finished { .. }));
    }

    #[test]
    fn initial_moves_cannot_continue_after_a_terminal_position() {
        let mut config = mating_config(PlayerConfig::Human {
            name: "White".into(),
        });
        config.initial_moves = vec!["g6g7".into(), "h8h7".into()];
        assert!(matches!(
            GameController::new("game".into(), 1, config),
            Err(Error::InvalidInput(_))
        ));
    }

    #[tokio::test]
    async fn delayed_engine_result_cannot_commit_after_two_takebacks() {
        let mut config = human_config();
        config.black = fake_engine_player();
        let mut controller = GameController::new("game".into(), 7, config).unwrap();
        controller.apply_move("e2e4").unwrap();
        let context = controller.begin_engine_request().unwrap();
        let request_id = crate::engine::EngineRequestId(91);
        assert!(controller.register_engine_request_id(&context, request_id));

        let barrier = Arc::new(tokio::sync::Barrier::new(2));
        let delayed_barrier = barrier.clone();
        let delayed_context = context.clone();
        let delayed = tokio::spawn(async move {
            delayed_barrier.wait().await;
            delayed_barrier.wait().await;
            delayed_context
        });

        barrier.wait().await;
        controller.take_back_moves(1).unwrap();
        controller.take_back_moves(1).unwrap();
        barrier.wait().await;
        let delayed_context = delayed.await.unwrap();

        assert!(delayed_context.cancellation.is_cancelled());
        assert!(!controller.accepts_engine_result(&delayed_context, request_id));
    }

    #[tokio::test]
    async fn same_game_lifecycle_slot_serializes_start_and_abort_transitions() {
        let manager = Arc::new(GameManager::new());
        let first_slot = manager.lifecycle_slot("game");
        let held = first_slot.lock().await;
        let second_slot = manager.lifecycle_slot("game");
        assert!(Arc::ptr_eq(&first_slot, &second_slot));

        assert!(second_slot.try_lock().is_err());
        drop(held);
        assert!(second_slot.try_lock().is_ok());
    }

    #[tokio::test]
    async fn natural_completion_removes_only_the_matching_session_and_keeps_a_bounded_snapshot() {
        let manager = GameManager::new();
        let controller = Arc::new(RwLock::new(
            GameController::new("game".into(), 1, human_config()).unwrap(),
        ));
        let (shutdown, _) = watch::channel(false);
        manager.completed.lock().await.latest.insert(
            "game".into(),
            LatestSession {
                session: 1,
                disposition: SessionDisposition::Active,
            },
        );
        manager.games.insert(
            "game".into(),
            Arc::new(LiveSession {
                session: 1,
                controller: controller.clone(),
                shutdown,
                join: Mutex::new(None),
            }),
        );
        manager.complete_exact("game", 1, &controller).await;
        assert!(manager.games.get("game").is_none());
        assert_eq!(manager.get_game_state("game", 1).await.unwrap().session, 1);

        let replacement = Arc::new(RwLock::new(
            GameController::new("game".into(), 2, human_config()).unwrap(),
        ));
        let (shutdown, _) = watch::channel(false);
        manager.completed.lock().await.latest.insert(
            "game".into(),
            LatestSession {
                session: 2,
                disposition: SessionDisposition::Active,
            },
        );
        manager.games.insert(
            "game".into(),
            Arc::new(LiveSession {
                session: 2,
                controller: replacement.clone(),
                shutdown,
                join: Mutex::new(None),
            }),
        );
        manager.complete_exact("game", 1, &controller).await;
        assert_eq!(manager.get_game_state("game", 2).await.unwrap().session, 2);
        assert!(manager.completed.lock().await.snapshots.len() <= COMPLETED_GAME_SNAPSHOTS);
    }

    #[tokio::test]
    async fn tombstoned_latest_session_never_falls_back_to_an_older_snapshot() {
        let manager = GameManager::new();
        let old_state = GameController::new("game".into(), 1, human_config())
            .unwrap()
            .get_state();
        let mut completed = manager.completed.lock().await;
        completed.snapshots.push_back(CompletedSnapshot {
            game_id: "game".into(),
            session: 1,
            state: old_state,
        });
        completed.latest.insert(
            "game".into(),
            LatestSession {
                session: 2,
                disposition: SessionDisposition::Tombstoned,
            },
        );
        drop(completed);

        assert!(matches!(
            manager.get_game_state("game", 2).await,
            Err(Error::GameNotFound(_))
        ));
        assert!(matches!(
            manager.get_game_state("game", 1).await,
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn epd_reader_errors_are_not_silently_treated_as_end_of_book() {
        assert!(select_random_epd_entry(BufReader::new(Cursor::new(vec![0xff]))).is_err());
    }
}
