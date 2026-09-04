use dashmap::DashMap;
use diesel::prelude::*;
use log::info;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, Bitboard, ByColor, CastlingMode, Chess, EnPassantMode, FromSetup,
    Position, Setup,
};
use specta::Type;
use std::{
    cmp::Reverse,
    collections::BinaryHeap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};
use tauri::Manager;
use tokio::sync::OwnedSemaphorePermit;

use crate::{
    db::{
        encoding::{decode_move, try_iter_mainline_move_bytes},
        get_db_or_create, get_material_count, get_pawn_home,
        models::*,
        normalize_games, resolve_database,
        schema::*,
        search_index::{
            get_index_path, legacy_sidecar_leaf, preferred_sidecar_leaf,
            promote_legacy_index_sidecar_at, GameResult, IndexSource, MmapSearchIndex,
            SearchGameEntryRef,
        },
        DatabaseRepository, MaterialCount,
    },
    error::Error,
    infra::{
        blocking::BLOCKING_GATEWAY,
        path_authority::{DatabaseFileTarget, DatabaseHandle, PathAuthority, PathOperation},
    },
    progress::{begin_progress, update_progress_with_state, ProgressLease, ProgressState},
    AppState, SearchCache, SearchIndexIdentity, SearchResultKey,
};

use super::GameQuery;

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub struct ExactData {
    pawn_home: u16,
    material: MaterialCount,
    position: Chess,
}

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub struct PartialData {
    // piece_counts: Vec<(Piece, u8)>,
    piece_positions: Setup,
    material: MaterialCount,
}

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
pub enum PositionQuery {
    Exact(ExactData),
    Partial(PartialData),
}

impl PositionQuery {
    pub fn exact_from_fen(fen: &str) -> Result<PositionQuery, Error> {
        let fen = Fen::from_ascii(fen.as_bytes())?;
        let setup = fen.into_setup();
        let castling_mode = CastlingMode::detect(&setup);
        let position: Chess = setup.position(castling_mode)?;
        let pawn_home = get_pawn_home(position.board());
        let material = get_material_count(position.board());
        Ok(PositionQuery::Exact(ExactData {
            pawn_home,
            material,
            position,
        }))
    }

    pub fn partial_from_fen(fen: &str) -> Result<PositionQuery, Error> {
        let fen = Fen::from_ascii(fen.as_bytes())?;
        let setup = fen.into_setup();
        let material = get_material_count(&setup.board);
        Ok(PositionQuery::Partial(PartialData {
            piece_positions: setup,
            material,
        }))
    }
}

#[derive(Debug, Clone, Deserialize, Type, PartialEq, Eq, Hash)]
pub struct PositionQueryJs {
    pub fen: String,
    pub type_: String,
}

fn convert_position_query(query: PositionQueryJs) -> Result<PositionQuery, Error> {
    match query.type_.as_str() {
        "exact" => PositionQuery::exact_from_fen(&query.fen),
        "partial" => PositionQuery::partial_from_fen(&query.fen),
        _ => Err(Error::InvalidInput(format!(
            "unsupported position query type: {}",
            query.type_
        ))),
    }
}

impl PositionQuery {
    fn matches(&self, position: &Chess) -> bool {
        match self {
            PositionQuery::Exact(ref data) => {
                // Exact search matches side-to-move, board layout, castling rights, and en-passant state.
                // Halfmove and fullmove counters are intentionally excluded.
                data.position.turn() == position.turn()
                    && data.position.board() == position.board()
                    && data.position.castles().castling_rights()
                        == position.castles().castling_rights()
                    && data.position.ep_square(EnPassantMode::Legal)
                        == position.ep_square(EnPassantMode::Legal)
            }
            PositionQuery::Partial(ref data) => {
                let query_board = &data.piece_positions.board;
                let tested_board = position.board();

                is_contained(tested_board.pawns(), query_board.pawns())
                    && is_contained(tested_board.knights(), query_board.knights())
                    && is_contained(tested_board.bishops(), query_board.bishops())
                    && is_contained(tested_board.rooks(), query_board.rooks())
                    && is_contained(tested_board.queens(), query_board.queens())
                    && is_contained(tested_board.kings(), query_board.kings())
            }
        }
    }

    fn is_reachable_by(&self, material: &MaterialCount, pawn_home: u16) -> bool {
        match self {
            PositionQuery::Exact(ref data) => {
                let _ = material;
                is_end_reachable(data.pawn_home, pawn_home)
            }
            PositionQuery::Partial(_) => {
                let _ = material;
                true
            }
        }
    }

    fn can_reach(&self, material: &MaterialCount, pawn_home: u16) -> bool {
        match self {
            PositionQuery::Exact(ref data) => {
                let _ = material;
                is_end_reachable(pawn_home, data.pawn_home)
            }
            PositionQuery::Partial(_) => true,
        }
    }
}

/// Returns true if the end pawn structure is reachable
fn is_end_reachable(end: u16, pos: u16) -> bool {
    end & !pos == 0
}

pub(crate) fn load_search_index(
    authority: &Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &Arc<SearchCache>,
    handle: &DatabaseHandle,
) -> Result<(SearchIndexIdentity, MmapSearchIndex), Error> {
    let database =
        resolve_database(authority, handle, PathOperation::DatabaseRead)?.canonicalize()?;
    let read_target = database_file_target(authority, handle, PathOperation::DatabaseRead)?;
    let db_identity = repository.database_identity_expected(&database, read_target.identity)?;
    let expected_source = IndexSource::from_database_identity(&db_identity)?;
    if let Some(index) = open_valid_preferred(&read_target, &expected_source)? {
        return cache_loaded_index(search_cache, &database, expected_source, index);
    }

    // Different queries for the same database may arrive concurrently. One
    // per-index lock serializes only generation/loading for that archive.
    let generation_lock = GenerationLockCleanup {
        search_cache,
        index: get_index_path(&database),
        lock: search_cache.generation_lock(get_index_path(&database)),
    };
    let _generation_guard = generation_lock
        .lock
        .lock()
        .map_err(|_| Error::Conflict("search cache generation lock poisoned".into()))?;

    let read_target = database_file_target(authority, handle, PathOperation::DatabaseRead)?;
    let db_identity = repository.database_identity_expected(&database, read_target.identity)?;
    let expected_source = IndexSource::from_database_identity(&db_identity)?;
    if let Some(index) = open_valid_preferred(&read_target, &expected_source)? {
        return cache_loaded_index(search_cache, &database, expected_source, index);
    }

    let mutate_target = database_file_target(authority, handle, PathOperation::DatabaseMutate)?;
    let preferred_leaf = preferred_sidecar_leaf(&mutate_target.leaf);
    let legacy_leaf = legacy_sidecar_leaf(&mutate_target.leaf);
    promote_legacy_index_sidecar_at(
        &mutate_target.parent,
        &preferred_leaf,
        &legacy_leaf,
        &db_identity,
    )?;
    if let Some(index) = open_valid_preferred(&mutate_target, &expected_source)? {
        return cache_loaded_index(search_cache, &database, expected_source, index);
    }

    info!("Search index is absent, corrupt, or stale; generating automatically...");
    let generation_error =
        match super::generate_search_index(handle, authority, repository, search_cache) {
            Ok(()) => None,
            Err(
                error @ Error::CommittedDurabilityUncertain(
                    crate::error::DurabilityStage::SearchIndexReplacement,
                ),
            ) => Some(error),
            Err(error) => return Err(error),
        };

    let read_target = database_file_target(authority, handle, PathOperation::DatabaseRead)?;
    let db_identity = repository.database_identity_expected(&database, read_target.identity)?;
    let expected_source = IndexSource::from_database_identity(&db_identity)?;
    let Some(index) = open_valid_preferred(&read_target, &expected_source)? else {
        return Err(generation_error
            .unwrap_or_else(|| Error::Conflict("search index changed while loading".into())));
    };
    // Generation's rename landed; the new sidecar is the only copy. Returning
    // CommittedDurabilityUncertain here would fail a search whose index is now
    // valid. Promotion still returns that error because it must not unlink the
    // last durable (legacy) copy — d-20260831-23.
    cache_loaded_index(search_cache, &database, expected_source, index)
}

fn database_file_target(
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    handle: &DatabaseHandle,
    operation: PathOperation,
) -> Result<DatabaseFileTarget, Error> {
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .database_file_target(handle, operation)
}

fn open_valid_preferred(
    target: &DatabaseFileTarget,
    expected_source: &IndexSource,
) -> Result<Option<MmapSearchIndex>, Error> {
    #[cfg(unix)]
    {
        use rustix::{
            fs::{self as rfs, Mode, OFlags},
            io::Errno,
        };
        let leaf = preferred_sidecar_leaf(&target.leaf);
        let file = match rfs::openat(
            &target.parent,
            &leaf,
            OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        ) {
            Ok(file) => std::fs::File::from(file),
            Err(error) if error == Errno::NOENT || error == Errno::LOOP => return Ok(None),
            Err(error) => return Err(Error::Io(Box::new(error.into()))),
        };
        let index = match MmapSearchIndex::open_file(file) {
            Ok(index) => index,
            Err(error) if error.kind() == std::io::ErrorKind::InvalidData => return Ok(None),
            Err(error) => return Err(Error::from(error)),
        };
        Ok((index.source() == expected_source).then_some(index))
    }
    #[cfg(not(unix))]
    {
        let _ = (target, expected_source);
        Err(Error::Conflict(
            "fd-relative search index loading is unsupported on this platform".into(),
        ))
    }
}

fn cache_loaded_index(
    search_cache: &SearchCache,
    database: &Path,
    expected_source: IndexSource,
    index: MmapSearchIndex,
) -> Result<(SearchIndexIdentity, MmapSearchIndex), Error> {
    let identity = SearchIndexIdentity::for_database(database, expected_source)?;
    if let Some(index) = search_cache.get_index(&identity) {
        return Ok((identity, index));
    }

    search_cache.insert_index(identity.clone(), index.clone());
    Ok((identity, index))
}

struct CollisionCleanup<'a> {
    search_cache: &'a SearchCache,
    query: GameQuery,
    database: PathBuf,
    lock: Arc<Mutex<()>>,
}

struct GenerationLockCleanup<'a> {
    search_cache: &'a SearchCache,
    index: PathBuf,
    lock: Arc<Mutex<()>>,
}

impl Drop for GenerationLockCleanup<'_> {
    fn drop(&mut self) {
        self.search_cache
            .remove_generation_lock_if_idle(&self.index, &self.lock);
    }
}

impl Drop for CollisionCleanup<'_> {
    fn drop(&mut self) {
        self.search_cache
            .remove_collision_if_idle(&self.query, &self.database, &self.lock);
    }
}

/// Returns true if the subset is contained in the container
fn is_contained(container: Bitboard, subset: Bitboard) -> bool {
    container & subset == subset
}

fn matches_date(date: Option<&str>, start: Option<&str>, end: Option<&str>) -> bool {
    if start.is_none() && end.is_none() {
        return true;
    }
    let Some(date) = date else {
        return false;
    };
    start.is_none_or(|bound| date >= bound) && end.is_none_or(|bound| date <= bound)
}

fn parse_wanted_result(value: Option<&str>) -> Result<Option<GameResult>, Error> {
    value
        .map(|value| match value {
            "whitewon" => Ok(GameResult::WhiteWin),
            "blackwon" => Ok(GameResult::BlackWin),
            "draw" => Ok(GameResult::Draw),
            _ => Err(Error::InvalidInput(format!(
                "unsupported result filter: {value}"
            ))),
        })
        .transpose()
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct PositionStats {
    #[serde(rename = "move")]
    pub move_: String,
    pub white: i32,
    pub draw: i32,
    pub black: i32,
}

fn get_move_after_match(
    game_id: i32,
    move_blob: &[u8],
    fen: &Option<&str>,
    query: &PositionQuery,
) -> Result<Option<String>, Error> {
    let mut chess = if let Some(fen) = fen {
        let fen = Fen::from_ascii(fen.as_bytes()).map_err(|error| {
            Error::InvalidInput(format!("game {game_id} has invalid FEN: {error}"))
        })?;
        let setup = fen.into_setup();
        let castling_mode = CastlingMode::detect(&setup);
        Chess::from_setup(setup, castling_mode).map_err(|error| {
            Error::InvalidInput(format!("game {game_id} has invalid FEN setup: {error}"))
        })?
    } else {
        Chess::default()
    };

    if query.matches(&chess) {
        let mut mainline = try_iter_mainline_move_bytes(move_blob)
            .map_err(|error| {
                Error::InvalidInput(format!("game {game_id} has invalid move stream: {error}"))
            })?
            .peekable();
        if mainline.peek().is_none() {
            return Ok(Some("*".to_string()));
        }
        let Some(next_byte) = mainline.peek().copied() else {
            return Ok(Some("*".to_string()));
        };
        let next_move = decode_move(next_byte, &chess).ok_or_else(|| {
            Error::InvalidInput(format!(
                "game {game_id} has illegal encoded move {next_byte}"
            ))
        })?;
        let san = SanPlus::from_move(chess, &next_move);
        return Ok(Some(san.to_string()));
    }

    let mut mainline = try_iter_mainline_move_bytes(move_blob)
        .map_err(|error| {
            Error::InvalidInput(format!("game {game_id} has invalid move stream: {error}"))
        })?
        .peekable();

    while let Some(byte) = mainline.next() {
        let m = decode_move(byte, &chess).ok_or_else(|| {
            Error::InvalidInput(format!("game {game_id} has illegal encoded move {byte}"))
        })?;
        chess.play_unchecked(&m);

        let is_irreversible =
            m.is_capture() || m.role() == shakmaty::Role::Pawn || m.is_promotion();

        if is_irreversible {
            let board = chess.board();
            if !query.is_reachable_by(&get_material_count(board), get_pawn_home(board)) {
                return Ok(None);
            }
        }
        if query.matches(&chess) {
            if mainline.peek().is_none() {
                return Ok(Some("*".to_string()));
            }
            let Some(next_byte) = mainline.peek().copied() else {
                return Ok(Some("*".to_string()));
            };
            let next_move = decode_move(next_byte, &chess).ok_or_else(|| {
                Error::InvalidInput(format!(
                    "game {game_id} has illegal encoded move {next_byte}"
                ))
            })?;
            let san = SanPlus::from_move(chess, &next_move);
            return Ok(Some(san.to_string()));
        }
    }
    Ok(None)
}

fn search_progress_percent(processed: usize, total: usize) -> f32 {
    if total == 0 {
        return 0.0;
    }
    (processed as f64 / total as f64 * 100.0) as f32
}

/// Search progress goes through the one shared progress store instead of a
/// bespoke event, so the renderer's `useProgress` subscription, the generation
/// leases and the bounded retention policy apply to a search exactly as they do
/// to every other long-running job.
struct SearchProgress<R: tauri::Runtime = tauri::Wry> {
    app: tauri::AppHandle<R>,
    lease: ProgressLease,
}

impl<R: tauri::Runtime> SearchProgress<R> {
    fn new(app: tauri::AppHandle<R>, id: String) -> Result<Self, Error> {
        let lease = {
            let state = app.state::<AppState>();
            begin_progress(&state.progress_state, &app, id)?
        };
        Ok(Self { app, lease })
    }

    #[cfg_attr(not(test), allow(dead_code))]
    fn report(&self, processed: usize, total: usize) {
        self.transition(
            search_progress_percent(processed, total),
            ProgressState::Running,
        );
    }

    fn complete(&self, state: ProgressState) {
        let progress = if matches!(state, ProgressState::Succeeded) {
            100.0
        } else {
            0.0
        };
        self.transition(progress, state);
    }

    /// A lease superseded by a newer search on the same tab, or cleared by the
    /// user, makes the transition fail. That is the intended outcome — the older
    /// producer must not drive the newer bar — and it must not abort the search
    /// that is still running.
    fn transition(&self, progress: f32, state: ProgressState) {
        let app_state = self.app.state::<AppState>();
        let _ = update_progress_with_state(
            &app_state.progress_state,
            &self.app,
            &self.lease,
            progress,
            state,
        );
    }
}

impl<R: tauri::Runtime> Drop for SearchProgress<R> {
    /// A search dropped without a terminal transition was cancelled. The store
    /// keeps the first terminal state it is given, so this is a no-op after
    /// `complete` and only fires on a genuinely abandoned search.
    fn drop(&mut self) {
        self.transition(0.0, ProgressState::Cancelled);
    }
}

#[tauri::command]
#[specta::specta]
pub async fn search_position(
    file: DatabaseHandle,
    query: GameQuery,
    app: tauri::AppHandle,
    tab_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(Vec<PositionStats>, Vec<NormalizedGame>), Error> {
    let progress = SearchProgress::new(app.clone(), tab_id)?;
    let authority = Arc::clone(&state.pgn_path_authority);
    let repository = Arc::clone(&state.database_repository);
    let search_cache = Arc::clone(&state.search_cache);
    let permit = state
        .new_request
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| Error::Conflict("position search permit unavailable".into()))?;
    let lease = progress.lease.clone();
    let worker_app = app.clone();
    let result = BLOCKING_GATEWAY
        .spawn(move || {
            search_position_blocking(
                &authority,
                &repository,
                &search_cache,
                permit,
                lease,
                worker_app,
                file,
                query,
            )
        })
        .await;
    progress.complete(if result.is_ok() {
        ProgressState::Succeeded
    } else {
        ProgressState::Failed
    });
    result
}

#[allow(clippy::too_many_arguments)]
fn search_position_blocking(
    authority: &Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &Arc<SearchCache>,
    permit: OwnedSemaphorePermit,
    lease: ProgressLease,
    app: tauri::AppHandle,
    file: DatabaseHandle,
    query: GameQuery,
) -> Result<(Vec<PositionStats>, Vec<NormalizedGame>), Error> {
    let database_handle = file;
    let file = resolve_database(authority, &database_handle, PathOperation::DatabaseRead)?;

    let database = file.canonicalize()?;
    let collision_lock = search_cache.collision_lock(query.clone(), database.clone());
    let _collision_cleanup = CollisionCleanup {
        search_cache,
        query: query.clone(),
        database,
        lock: collision_lock,
    };
    let _guard = _collision_cleanup
        .lock
        .lock()
        .map_err(|_| Error::Conflict("search cache collision lock poisoned".into()))?;

    let mut database_connection = get_db_or_create(repository, &file)?;
    let db = &mut *database_connection;

    let start = Instant::now();
    info!("start loading games");

    let (identity, mmap_index) =
        load_search_index(authority, repository, search_cache, &database_handle)?;
    let cache_key = SearchResultKey::new(query.clone(), identity);
    if let Some(result) = search_cache.get_result(&cache_key) {
        return Ok(result);
    }

    let game_count = mmap_index.len();

    info!(
        "Ready to search {} games: {:?}",
        game_count,
        start.elapsed()
    );

    let openings: DashMap<String, PositionStats> = DashMap::new();
    const MAX_SAMPLES: usize = 500;
    // Min-heap of (elo_key, game_id) to track top-rated sample games.
    // Using Reverse so peek() returns the entry with the lowest ELO,
    // which we can evict when a higher-rated game is found.
    let top_games: Mutex<BinaryHeap<Reverse<(i16, i32)>>> =
        Mutex::new(BinaryHeap::with_capacity(MAX_SAMPLES + 1));

    let processed = AtomicUsize::new(0);

    let parsed_position_query: Option<PositionQuery> = if let Some(pq) = &query.position {
        Some(convert_position_query(pq.clone())?)
    } else {
        None
    };

    let wanted_result = parse_wanted_result(query.wanted_result.as_deref())?;

    info!("start search on {}", lease.id);

    let process_entry = |entry: SearchGameEntryRef<'_>| -> Result<(), Error> {
        let index = processed.fetch_add(1, Ordering::Relaxed) + 1;
        if index.is_multiple_of(50000) {
            let _ = update_progress_with_state(
                &app.state::<AppState>().progress_state,
                &app,
                &lease,
                search_progress_percent(index, game_count),
                ProgressState::Running,
            );
        }

        try_iter_mainline_move_bytes(entry.moves).map_err(|error| {
            Error::InvalidInput(format!(
                "game {} has invalid move stream: {error}",
                entry.id
            ))
        })?;

        if let Some(white) = query.player1 {
            if white != entry.white_id {
                return Ok(());
            }
        }

        if let Some(black) = query.player2 {
            if black != entry.black_id {
                return Ok(());
            }
        }

        if let Some(wanted) = wanted_result {
            if entry.result != wanted {
                return Ok(());
            }
        } else if matches!(entry.result, GameResult::None | GameResult::Other) {
            // Unknown and non-standard results are neither draws nor wins.
            // PositionStats has no unknown bucket, so omit them explicitly.
            return Ok(());
        }

        if !matches_date(
            entry.date,
            query.start_date.as_deref(),
            query.end_date.as_deref(),
        ) {
            return Ok(());
        }

        if let Some(position_query) = &parsed_position_query {
            let end_material: MaterialCount = ByColor {
                white: entry.white_material,
                black: entry.black_material,
            };
            if position_query.can_reach(&end_material, entry.pawn_home) {
                if let Some(m) =
                    get_move_after_match(entry.id, entry.moves, &entry.fen, position_query)?
                {
                    let elo_key = entry.white_elo.max(entry.black_elo);
                    let mut heap = top_games.lock().unwrap();
                    if heap.len() < MAX_SAMPLES {
                        heap.push(Reverse((elo_key, entry.id)));
                    } else if let Some(&Reverse((min_elo, _))) = heap.peek() {
                        if elo_key > min_elo {
                            heap.pop();
                            heap.push(Reverse((elo_key, entry.id)));
                        }
                    }
                    drop(heap);

                    openings
                        .entry(m)
                        .and_modify(|opening| match entry.result {
                            GameResult::WhiteWin => opening.white += 1,
                            GameResult::BlackWin => opening.black += 1,
                            GameResult::Draw => opening.draw += 1,
                            GameResult::Other | GameResult::None => {}
                        })
                        .or_insert_with(|| PositionStats {
                            black: i32::from(entry.result == GameResult::BlackWin),
                            white: i32::from(entry.result == GameResult::WhiteWin),
                            draw: i32::from(entry.result == GameResult::Draw),
                            move_: String::new(),
                        });
                }
            }
        }
        Ok(())
    };

    mmap_index.par_iter().try_for_each(process_entry)?;

    let openings: Vec<PositionStats> = openings
        .into_iter()
        .map(|(k, mut v)| {
            v.move_ = k;
            v
        })
        .collect();
    let ids: Vec<i32> = top_games
        .into_inner()
        .unwrap()
        .into_iter()
        .map(|Reverse((_, id))| id)
        .collect();

    info!("finished search in {:?}", start.elapsed());

    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    let games: Vec<(Game, Player, Player, Event, Site)> = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .filter(games::id.eq_any(ids))
        .order((games::white_elo.desc(), games::black_elo.desc()))
        .load(db)?;
    let normalized_games = normalize_games(games)?;
    search_cache.insert_result(cache_key, (openings.clone(), normalized_games.clone()));

    drop(permit);

    Ok((openings, normalized_games))
}

pub fn is_position_in_db(
    authority: &Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &Arc<SearchCache>,
    file: &DatabaseHandle,
    query: &GameQuery,
) -> Result<bool, Error> {
    let database_handle = file;
    let file = resolve_database(authority, database_handle, PathOperation::DatabaseRead)?;
    let database = file.canonicalize()?;
    let collision_lock = search_cache.collision_lock(query.clone(), database.clone());
    let _collision_cleanup = CollisionCleanup {
        search_cache,
        query: query.clone(),
        database,
        lock: collision_lock,
    };
    let _guard = _collision_cleanup
        .lock
        .lock()
        .map_err(|_| Error::Conflict("search cache collision lock poisoned".into()))?;

    let parsed_position_query: Option<PositionQuery> = if let Some(pq) = &query.position {
        Some(convert_position_query(pq.clone())?)
    } else {
        None
    };

    let start = Instant::now();
    info!("start loading games for is_position_in_db");

    let (identity, mmap_index) =
        load_search_index(authority, repository, search_cache, database_handle)?;
    let cache_key = SearchResultKey::new(query.clone(), identity);
    if let Some(result) = search_cache.get_result(&cache_key) {
        return Ok(!result.0.is_empty());
    }

    let exists = AtomicBool::new(false);
    let check_entry = |entry: SearchGameEntryRef<'_>| -> Result<(), Error> {
        try_iter_mainline_move_bytes(entry.moves).map_err(|error| {
            Error::InvalidInput(format!(
                "game {} has invalid move stream: {error}",
                entry.id
            ))
        })?;
        let end_material: MaterialCount = ByColor {
            white: entry.white_material,
            black: entry.black_material,
        };
        if let Some(position_query) = &parsed_position_query {
            if position_query.can_reach(&end_material, entry.pawn_home)
                && get_move_after_match(entry.id, entry.moves, &entry.fen, position_query)?
                    .is_some()
            {
                exists.store(true, Ordering::Relaxed);
            }
        }
        Ok(())
    };

    mmap_index.par_iter().try_for_each(check_entry)?;
    let exists = exists.load(Ordering::Relaxed);

    info!("finished search in {:?}", start.elapsed());

    if !exists {
        search_cache.insert_result(cache_key, (vec![], vec![]));
    }

    Ok(exists)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        db::{legacy_index_path, SearchIndex},
        infra::{
            fs::{set_test_atomic_file_injector, AtomicFileFaultPoint, AtomicWriterInjector},
            path_authority::PathClass,
        },
    };
    use diesel::Connection;
    use std::sync::Arc;
    use tempfile::TempDir;

    fn loader_test_case(
        operations: Vec<PathOperation>,
    ) -> (
        TempDir,
        tauri::AppHandle<tauri::test::MockRuntime>,
        DatabaseHandle,
        PathBuf,
    ) {
        use diesel::connection::SimpleConnection;

        let dir = tempfile::tempdir().unwrap();
        let database = dir.path().join("search.db3");
        let mut connection = SqliteConnection::establish(database.to_str().unwrap()).unwrap();
        connection
            .batch_execute(super::super::CREATE_TABLES_SQL)
            .unwrap();
        connection
            .batch_execute("INSERT INTO Info (Name, Value) VALUES ('Version', '2.0.0');")
            .unwrap();
        drop(connection);

        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let grant = authority
            .grant_dialog_operations(
                &database,
                "search",
                PathClass::BoundedDialogGrant,
                operations.clone(),
                std::time::Duration::from_secs(30),
                1,
            )
            .unwrap();
        let commit = authority
            .promote_dialog(&grant, PathClass::PersistentFile, "search", operations)
            .unwrap();
        let handle = DatabaseHandle::new(commit.id);
        let state = AppState::default();
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = tauri::test::mock_app();
        app.manage(state);
        (dir, app.handle().clone(), handle, database)
    }

    fn loader_source(
        app: &tauri::AppHandle<tauri::test::MockRuntime>,
        database: &Path,
    ) -> IndexSource {
        IndexSource::from_database_identity(
            &app.state::<AppState>()
                .database_repository
                .database_identity(database)
                .unwrap(),
        )
        .unwrap()
    }

    #[test]
    fn search_index_database_read_only_loads_valid_preferred_sidecar() {
        let (_dir, app, handle, database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        SearchIndex::default()
            .write_to_with_source(get_index_path(&database), loader_source(&app, &database))
            .unwrap();

        let loaded = {
            let state = app.state::<AppState>();
            load_search_index(
                &state.pgn_path_authority,
                &state.database_repository,
                &state.search_cache,
                &handle,
            )
        };
        assert!(loaded.is_ok());
    }

    #[test]
    fn search_index_database_read_only_never_promotes_or_generates() {
        let (_legacy_dir, legacy_app, legacy_handle, legacy_database) =
            loader_test_case(vec![PathOperation::DatabaseRead]);
        let legacy = legacy_index_path(&legacy_database);
        SearchIndex::default()
            .write_to_with_source(&legacy, loader_source(&legacy_app, &legacy_database))
            .unwrap();
        let result = {
            let state = legacy_app.state::<AppState>();
            load_search_index(
                &state.pgn_path_authority,
                &state.database_repository,
                &state.search_cache,
                &legacy_handle,
            )
        };
        assert!(matches!(result, Err(Error::InvalidInput(_))));
        assert!(legacy.exists());
        assert!(!get_index_path(&legacy_database).exists());

        let (_missing_dir, missing_app, missing_handle, missing_database) =
            loader_test_case(vec![PathOperation::DatabaseRead]);
        let result = {
            let state = missing_app.state::<AppState>();
            load_search_index(
                &state.pgn_path_authority,
                &state.database_repository,
                &state.search_cache,
                &missing_handle,
            )
        };
        assert!(matches!(result, Err(Error::InvalidInput(_))));
        assert!(!get_index_path(&missing_database).exists());
        assert!(!legacy_index_path(&missing_database).exists());
    }

    #[test]
    fn search_index_generation_parent_sync_loads_committed_index() {
        struct ParentSyncFailure;
        impl AtomicWriterInjector for ParentSyncFailure {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::ParentSync {
                    Err(std::io::Error::other("injected parent sync failure"))
                } else {
                    Ok(())
                }
            }
        }

        let (_dir, app, handle, database) = loader_test_case(vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
        ]);
        set_test_atomic_file_injector(Some(Arc::new(ParentSyncFailure)));
        let result = {
            let state = app.state::<AppState>();
            load_search_index(
                &state.pgn_path_authority,
                &state.database_repository,
                &state.search_cache,
                &handle,
            )
        };
        set_test_atomic_file_injector(None);

        if let Err(error) = result {
            panic!("{error:?}");
        }
        assert!(get_index_path(&database).exists());
    }

    #[test]
    fn search_index_loader_uses_fd_relative_authority_boundaries() {
        let source = include_str!("search.rs");
        let loader = source
            .split("fn load_search_index")
            .nth(1)
            .unwrap()
            .split("fn database_file_target")
            .next()
            .unwrap();
        assert!(loader.contains("database_file_target"));
        assert!(loader.contains("promote_legacy_index_sidecar_at"));
        assert!(!loader.contains("atomic_replace(&"));
        assert!(!loader.contains("std::fs::remove_file"));
    }

    #[test]
    fn poisoned_generation_lock_returns_conflict_on_the_next_query() {
        let (_dir, app, handle, database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        let index = get_index_path(&database.canonicalize().unwrap());
        let lock = app.state::<AppState>().search_cache.generation_lock(index);
        let panicked = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = lock.lock().unwrap();
            panic!("poison the search cache generation lock");
        }));
        assert!(panicked.is_err());

        let result = {
            let state = app.state::<AppState>();
            load_search_index(
                &state.pgn_path_authority,
                &state.database_repository,
                &state.search_cache,
                &handle,
            )
        };
        assert!(
            matches!(result, Err(Error::Conflict(_))),
            "poisoned generation lock must return Conflict, not panic"
        );
    }

    fn assert_partial_match(fen1: &str, fen2: &str) {
        let query = PositionQuery::partial_from_fen(fen1).unwrap();
        let fen = Fen::from_ascii(fen2.as_bytes()).unwrap();
        let chess = Chess::from_setup(fen.into_setup(), shakmaty::CastlingMode::Chess960).unwrap();
        assert!(query.matches(&chess));
    }

    #[test]
    fn exact_matches() {
        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        )
        .unwrap();
        let chess = Chess::default();
        assert!(query.matches(&chess));
    }

    #[test]
    fn empty_matches_anything() {
        assert_partial_match(
            "8/8/8/8/8/8/8/8 w - - 0 1",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        );
    }

    #[test]
    fn correct_partial_match() {
        assert_partial_match(
            "8/8/8/8/8/8/8/6N1 w - - 0 1",
            "3k4/8/8/8/8/4P3/3PKP2/6N1 w - - 0 1",
        );
    }

    #[test]
    #[should_panic]
    fn fail_partial_match() {
        assert_partial_match(
            "8/8/8/8/8/8/8/6N1 w - - 0 1",
            "3k4/8/8/8/8/4P3/3PKP2/7N w - - 0 1",
        );
        assert_partial_match(
            "8/8/8/8/8/8/8/6N1 w - - 0 1",
            "3k4/8/8/8/8/4P3/3PKP2/6n1 w - - 0 1",
        );
    }

    #[test]
    fn correct_exact_is_reachable() {
        let query =
            PositionQuery::exact_from_fen("rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR")
                .unwrap();
        let chess = Chess::default();
        assert!(query.is_reachable_by(
            &get_material_count(chess.board()),
            get_pawn_home(chess.board())
        ));
    }

    #[test]
    fn correct_partial_is_reachable() {
        let query = PositionQuery::partial_from_fen("8/8/8/8/8/8/8/8").unwrap();
        let chess = Chess::default();
        assert!(query.is_reachable_by(
            &get_material_count(chess.board()),
            get_pawn_home(chess.board())
        ));
    }

    #[test]
    fn correct_partial_can_reach() {
        let query = PositionQuery::partial_from_fen("8/8/8/8/8/8/8/8").unwrap();
        let chess = Chess::default();
        assert!(query.can_reach(
            &get_material_count(chess.board()),
            get_pawn_home(chess.board())
        ));
    }

    #[test]
    fn get_move_after_exact_match_test() {
        let game = vec![12, 12]; // 1. e4 e5

        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        )
        .unwrap();
        let result = get_move_after_match(1, &game, &None, &query).unwrap();
        assert_eq!(result, Some("e4".to_string()));

        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        )
        .unwrap();
        let result = get_move_after_match(1, &game, &None, &query).unwrap();
        assert_eq!(result, Some("e5".to_string()));

        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        )
        .unwrap();
        let result = get_move_after_match(1, &game, &None, &query).unwrap();
        assert_eq!(result, Some("*".to_string()));
    }

    #[test]
    fn exact_match_rights_regression() {
        let mut chess = Chess::default();
        chess.play_unchecked(
            &SanPlus::from_ascii(b"e4")
                .unwrap()
                .san
                .to_move(&chess)
                .unwrap(),
        );
        chess.play_unchecked(
            &SanPlus::from_ascii(b"e5")
                .unwrap()
                .san
                .to_move(&chess)
                .unwrap(),
        );

        // Correct match
        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        )
        .unwrap();
        assert!(query.matches(&chess));

        // Missing castling right
        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w Qkq - 0 2",
        )
        .unwrap();
        assert!(!query.matches(&chess));

        // Wrong side to move
        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2",
        )
        .unwrap();
        assert!(!query.matches(&chess));

        // Let's create an en passant scenario
        let mut chess2 = Chess::default();
        for san in ["e4", "e5", "d4", "exd4", "e5", "f5"] {
            chess2.play_unchecked(
                &SanPlus::from_ascii(san.as_bytes())
                    .unwrap()
                    .san
                    .to_move(&chess2)
                    .unwrap(),
            );
        }

        // Correct ep square f6
        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppp2pp/8/4Pp2/3p4/8/PPP2PPP/RNBQKBNR w KQkq f6 0 4",
        )
        .unwrap();
        assert!(query.matches(&chess2));

        // Missing ep square
        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppp2pp/8/4Pp2/3p4/8/PPP2PPP/RNBQKBNR w KQkq - 0 4",
        )
        .unwrap();
        assert!(!query.matches(&chess2));
    }

    #[test]
    fn get_move_after_partial_match_test() {
        let game = vec![12, 12]; // 1. e4 e5

        let query = PositionQuery::partial_from_fen("8/pppppppp/8/8/8/8/PPPPPPPP/8").unwrap();
        let result = get_move_after_match(1, &game, &None, &query).unwrap();
        assert_eq!(result, Some("e4".to_string()));
    }

    #[test]
    fn invalid_position_query_discriminant_is_an_input_error() {
        let error = convert_position_query(PositionQueryJs {
            fen: "8/8/8/8/8/8/8/8 w - - 0 1".into(),
            type_: "surprise".into(),
        })
        .unwrap_err();
        assert!(matches!(error, Error::InvalidInput(_)));
    }

    #[test]
    fn invalid_result_filter_is_an_input_error() {
        assert!(matches!(
            parse_wanted_result(Some("anything")),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn result_filter_maps_every_supported_value_and_absence() {
        assert_eq!(parse_wanted_result(None).unwrap(), None);
        assert_eq!(
            parse_wanted_result(Some("whitewon")).unwrap(),
            Some(GameResult::WhiteWin)
        );
        assert_eq!(
            parse_wanted_result(Some("blackwon")).unwrap(),
            Some(GameResult::BlackWin)
        );
        assert_eq!(
            parse_wanted_result(Some("draw")).unwrap(),
            Some(GameResult::Draw)
        );
    }

    #[test]
    fn pawn_home_reachability_rejects_a_required_home_pawn_that_is_absent() {
        assert!(!is_end_reachable(0b0001, 0));
        assert!(is_end_reachable(0b0001, 0b0011));
    }

    #[test]
    fn promotion_material_is_not_pruned_as_unreachable() {
        let query = PositionQuery::exact_from_fen("7k/Q7/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        let before_promotion: MaterialCount = ByColor { white: 1, black: 0 };
        assert!(query.is_reachable_by(&before_promotion, 0));
    }

    #[test]
    fn bounded_date_queries_exclude_unknown_dates() {
        assert!(!matches_date(None, Some("2024.01.01"), None));
        assert!(!matches_date(None, None, Some("2024.12.31")));
        assert!(matches_date(
            Some("2024.06.01"),
            Some("2024.01.01"),
            Some("2024.12.31")
        ));
        assert!(!matches_date(Some("2023.12.31"), Some("2024.01.01"), None));
    }

    #[test]
    fn corrupt_game_stream_is_reported_with_game_context() {
        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        )
        .unwrap();
        let error = get_move_after_match(42, &[252, 1], &None, &query).unwrap_err();
        assert!(error.to_string().contains("game 42"));
    }

    #[test]
    fn search_progress_percent_handles_zero_game_searches() {
        assert_eq!(search_progress_percent(0, 0), 0.0);
        assert_eq!(search_progress_percent(7, 0), 0.0);
        assert_eq!(search_progress_percent(0, 200), 0.0);
        assert_eq!(search_progress_percent(50, 200), 25.0);
        assert_eq!(search_progress_percent(200, 200), 100.0);
    }

    fn progress_test_app() -> tauri::AppHandle<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        // The store emits a typed Specta event, so the mock app needs the same
        // event registry the real application mounts in `main.rs`.
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(
                crate::progress::ProgressEvent
            ))
            .mount_events(&app);
        app.manage(AppState::default());
        app.handle().clone()
    }

    #[test]
    fn search_progress_is_visible_through_the_shared_store() {
        let app = progress_test_app();
        let progress = SearchProgress::new(app.clone(), "tab-1".into()).unwrap();

        let store = &app.state::<AppState>().progress_state;
        assert_eq!(store.get("tab-1").unwrap().state, ProgressState::Running);

        progress.report(50, 200);
        assert_eq!(store.get("tab-1").unwrap().progress, 25.0);

        progress.complete(ProgressState::Succeeded);
        let item = store.get("tab-1").unwrap();
        assert_eq!(item.state, ProgressState::Succeeded);
        assert_eq!(item.progress, 100.0);

        // Dropping after a terminal transition must not reopen the entry as cancelled.
        drop(progress);
        assert_eq!(store.get("tab-1").unwrap().state, ProgressState::Succeeded);
    }

    #[test]
    fn abandoned_search_is_cancelled_on_drop() {
        let app = progress_test_app();
        let progress = SearchProgress::new(app.clone(), "tab-2".into()).unwrap();
        progress.report(10, 100);
        drop(progress);

        let store = &app.state::<AppState>().progress_state;
        let item = store.get("tab-2").unwrap();
        assert_eq!(item.state, ProgressState::Cancelled);
        assert!(item.finished);
    }

    #[test]
    fn a_newer_search_on_the_same_tab_supersedes_the_older_producer() {
        let app = progress_test_app();
        let older = SearchProgress::new(app.clone(), "tab-3".into()).unwrap();
        let newer = SearchProgress::new(app.clone(), "tab-3".into()).unwrap();

        // The stale producer's updates are refused rather than driving the new bar.
        older.report(90, 100);
        let store = &app.state::<AppState>().progress_state;
        assert_eq!(store.get("tab-3").unwrap().progress, 0.0);

        newer.report(10, 100);
        assert_eq!(store.get("tab-3").unwrap().progress, 10.0);

        // Even the stale producer's Drop must not cancel the running search.
        drop(older);
        assert_eq!(store.get("tab-3").unwrap().state, ProgressState::Running);
    }
}
