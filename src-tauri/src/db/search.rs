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
        Mutex,
    },
    time::Instant,
};
use tauri::Manager;

use crate::{
    db::{
        encoding::{decode_move, try_iter_mainline_move_bytes},
        get_db_or_create, get_material_count, get_pawn_home,
        models::*,
        normalize_games, resolve_database,
        schema::*,
        search_index::{
            get_index_path, GameResult, IndexSource, MmapSearchIndex, SearchGameEntryRef,
        },
        MaterialCount,
    },
    error::Error,
    infra::path_authority::{DatabaseHandle, PathOperation},
    progress::{begin_progress, update_progress_with_state, ProgressLease, ProgressState},
    AppState, SearchIndexIdentity, SearchResultKey,
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

async fn load_search_index(
    file: &Path,
    state: &tauri::State<'_, AppState>,
) -> Result<(SearchIndexIdentity, MmapSearchIndex), Error> {
    let database = file.canonicalize()?;
    let index_path = super::search_index::promote_legacy_index_sidecar(&database)?
        .unwrap_or_else(|| get_index_path(&database));
    let expected_source = IndexSource::from_database_identity(
        &state.database_repository.database_identity(&database)?,
    )?;
    match MmapSearchIndex::open(&index_path) {
        Ok(index) if index.source() == &expected_source => {
            let identity = SearchIndexIdentity::for_database(&database, expected_source.clone())?;
            if let Some(cached) = state.search_cache.get_index(&identity) {
                return Ok((identity, cached));
            }
            state
                .search_cache
                .insert_index(identity.clone(), index.clone());
            return Ok((identity, index));
        }
        Ok(_) => {}
        Err(error)
            if matches!(
                error.kind(),
                std::io::ErrorKind::NotFound | std::io::ErrorKind::InvalidData
            ) => {}
        Err(error) => return Err(Error::from(error)),
    }

    // Different queries for the same database may arrive concurrently. One
    // per-index lock serializes only generation/loading for that archive.
    let generation_lock = GenerationLockCleanup {
        state,
        index: index_path.clone(),
        lock: state.search_cache.generation_lock(index_path),
    };
    let _generation_guard = generation_lock.lock.lock().await;

    let expected_source = IndexSource::from_database_identity(
        &state.database_repository.database_identity(&database)?,
    )?;
    let needs_generation = MmapSearchIndex::open(get_index_path(&database))
        .map(|index| index.source() != &expected_source)
        .unwrap_or(true);
    if needs_generation {
        info!("Search index is absent, corrupt, or stale; generating automatically...");
        super::generate_search_index(&database, state)?;
    }

    let index = MmapSearchIndex::open(get_index_path(&database))?;
    let expected_source = IndexSource::from_database_identity(
        &state.database_repository.database_identity(&database)?,
    )?;
    if index.source() != &expected_source {
        return Err(Error::Conflict("search index changed while loading".into()));
    }
    let identity = SearchIndexIdentity::for_database(&database, expected_source)?;
    if let Some(index) = state.search_cache.get_index(&identity) {
        return Ok((identity, index));
    }

    state
        .search_cache
        .insert_index(identity.clone(), index.clone());
    Ok((identity, index))
}

/// Clears cached query results and loaded archives after a database mutation
/// has regenerated/deleted its companion search index.
pub fn invalidate_search_cache(state: &AppState, database: &Path) {
    state.search_cache.invalidate_database(database);
}

pub async fn preload_search_index(
    file: &Path,
    state: &tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let (_, index) = load_search_index(file, state).await?;
    info!("Preloaded reference database with {} games", index.len());
    Ok(())
}

struct CollisionCleanup<'a> {
    state: &'a AppState,
    query: GameQuery,
    database: PathBuf,
    lock: std::sync::Arc<tokio::sync::Mutex<()>>,
}

struct GenerationLockCleanup<'a> {
    state: &'a AppState,
    index: PathBuf,
    lock: std::sync::Arc<tokio::sync::Mutex<()>>,
}

impl Drop for GenerationLockCleanup<'_> {
    fn drop(&mut self) {
        self.state
            .search_cache
            .remove_generation_lock_if_idle(&self.index, &self.lock);
    }
}

impl Drop for CollisionCleanup<'_> {
    fn drop(&mut self) {
        self.state
            .search_cache
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
    let progress = SearchProgress::new(app, tab_id)?;
    let result = search_position_inner(file, query, state, &progress).await;
    progress.complete(if result.is_ok() {
        ProgressState::Succeeded
    } else {
        ProgressState::Failed
    });
    result
}

async fn search_position_inner(
    file: DatabaseHandle,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
    progress: &SearchProgress,
) -> Result<(Vec<PositionStats>, Vec<NormalizedGame>), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;

    let database = file.canonicalize()?;
    let collision_lock = state
        .search_cache
        .collision_lock(query.clone(), database.clone());
    let _collision_cleanup = CollisionCleanup {
        state: &state,
        query: query.clone(),
        database,
        lock: collision_lock,
    };
    let _guard = _collision_cleanup.lock.lock().await;

    let mut database_connection = get_db_or_create(&state, &file)?;
    let db = &mut *database_connection;

    let start = Instant::now();
    info!("start loading games");

    let permit = state.new_request.acquire().await.unwrap();

    let (identity, mmap_index) = load_search_index(&file, &state).await?;
    let cache_key = SearchResultKey::new(query.clone(), identity);
    if let Some(result) = state.search_cache.get_result(&cache_key) {
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

    info!("start search on {}", progress.lease.id);

    let process_entry = |entry: SearchGameEntryRef<'_>| -> Result<(), Error> {
        let index = processed.fetch_add(1, Ordering::Relaxed) + 1;
        if index.is_multiple_of(50000) {
            progress.report(index, game_count);
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
    state
        .search_cache
        .insert_result(cache_key, (openings.clone(), normalized_games.clone()));

    drop(permit);

    Ok((openings, normalized_games))
}

pub async fn is_position_in_db(
    file: DatabaseHandle,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<bool, Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;
    let database = file.canonicalize()?;
    let collision_lock = state
        .search_cache
        .collision_lock(query.clone(), database.clone());
    let _collision_cleanup = CollisionCleanup {
        state: &state,
        query: query.clone(),
        database,
        lock: collision_lock,
    };
    let _guard = _collision_cleanup.lock.lock().await;

    let parsed_position_query: Option<PositionQuery> = if let Some(pq) = &query.position {
        Some(convert_position_query(pq.clone())?)
    } else {
        None
    };

    let start = Instant::now();
    info!("start loading games for is_position_in_db");

    let permit = state.new_request.acquire().await.unwrap();

    let (identity, mmap_index) = load_search_index(&file, &state).await?;
    let cache_key = SearchResultKey::new(query.clone(), identity);
    if let Some(result) = state.search_cache.get_result(&cache_key) {
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
        state
            .search_cache
            .insert_result(cache_key, (vec![], vec![]));
    }

    drop(permit);

    Ok(exists)
}

#[cfg(test)]
mod tests {
    use super::*;

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
