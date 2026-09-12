use dashmap::DashMap;
use diesel::prelude::*;
use log::info;
use parking_lot::Mutex as ParkingMutex;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::SanPlus, Bitboard, ByColor, CastlingMode, Chess, Color, EnPassantMode,
    FromSetup, Position, Setup,
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
use tokio_util::sync::CancellationToken;

use crate::{
    db::{
        encoding::{decode_move, try_iter_mainline_move_bytes_cancellable},
        get_db_or_create, get_material_count, get_pawn_home,
        models::*,
        normalize_games,
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
    progress::{update_progress_with_state, JobProgress, ProgressLease, ProgressState},
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
                    && is_contained(
                        tested_board.by_color(Color::White),
                        query_board.by_color(Color::White),
                    )
                    && is_contained(
                        tested_board.by_color(Color::Black),
                        query_board.by_color(Color::Black),
                    )
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

#[cfg(test)]
pub(crate) fn load_search_index(
    authority: &Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &Arc<SearchCache>,
    handle: &DatabaseHandle,
) -> Result<(SearchIndexIdentity, MmapSearchIndex), Error> {
    load_search_index_cancellable(
        authority,
        repository,
        search_cache,
        handle,
        &CancellationToken::new(),
    )
}

pub(crate) fn load_search_index_cancellable(
    authority: &Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &Arc<SearchCache>,
    handle: &DatabaseHandle,
    cancellation: &CancellationToken,
) -> Result<(SearchIndexIdentity, MmapSearchIndex), Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let read_target = super::resolve_database(authority, handle, PathOperation::DatabaseRead)?;
    let db_identity =
        repository.database_identity_expected(read_target.path(), read_target.identity())?;
    let expected_source = IndexSource::from_database_identity(&db_identity)?;
    if let Some(index) = open_valid_preferred(&read_target, &expected_source, cancellation)? {
        return cache_loaded_index(
            search_cache,
            read_target.path(),
            expected_source,
            index,
            cancellation,
        );
    }

    // Different queries for the same database may arrive concurrently. One
    // per-index lock serializes only generation/loading for that archive.
    let generation_lock = GenerationLockCleanup {
        search_cache,
        index: get_index_path(read_target.path()),
        lock: search_cache.generation_lock(get_index_path(read_target.path())),
    };
    let _generation_guard =
        crate::infra::cancellable_lock::lock_cancellable(&generation_lock.lock, cancellation)?;

    let read_target = super::resolve_database(authority, handle, PathOperation::DatabaseRead)?;
    let db_identity =
        repository.database_identity_expected(read_target.path(), read_target.identity())?;
    let expected_source = IndexSource::from_database_identity(&db_identity)?;
    if let Some(index) = open_valid_preferred(&read_target, &expected_source, cancellation)? {
        return cache_loaded_index(
            search_cache,
            read_target.path(),
            expected_source,
            index,
            cancellation,
        );
    }

    let mutate_target = super::resolve_database(authority, handle, PathOperation::DatabaseMutate)?;
    let preferred_leaf = preferred_sidecar_leaf(mutate_target.leaf());
    let legacy_leaf = legacy_sidecar_leaf(mutate_target.leaf());
    promote_legacy_index_sidecar_at(
        mutate_target.parent(),
        &preferred_leaf,
        &legacy_leaf,
        &db_identity,
        cancellation,
    )?;
    if let Some(index) = open_valid_preferred(&mutate_target, &expected_source, cancellation)? {
        return cache_loaded_index(
            search_cache,
            mutate_target.path(),
            expected_source,
            index,
            cancellation,
        );
    }

    info!("Search index is absent, corrupt, or stale; generating automatically...");
    let generation_error = match super::generate_search_index(
        handle,
        authority,
        repository,
        search_cache,
        cancellation,
    ) {
        Ok(()) => None,
        Err(
            error @ Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::SearchIndexReplacement,
            ),
        ) => Some(error),
        Err(error) => return Err(error),
    };

    let read_target = super::resolve_database(authority, handle, PathOperation::DatabaseRead)?;
    let db_identity =
        repository.database_identity_expected(read_target.path(), read_target.identity())?;
    let expected_source = IndexSource::from_database_identity(&db_identity)?;
    let Some(index) = open_valid_preferred(&read_target, &expected_source, cancellation)? else {
        return Err(generation_error
            .unwrap_or_else(|| Error::Conflict("search index changed while loading".into())));
    };
    // Generation's rename landed; the new sidecar is the only copy. Returning
    // CommittedDurabilityUncertain here would fail a search whose index is now
    // valid. Promotion still returns that error because it must not unlink the
    // last durable (legacy) copy — d-20260831-23.
    cache_loaded_index(
        search_cache,
        read_target.path(),
        expected_source,
        index,
        cancellation,
    )
}

fn open_valid_preferred(
    target: &DatabaseFileTarget,
    expected_source: &IndexSource,
    cancellation: &CancellationToken,
) -> Result<Option<MmapSearchIndex>, Error> {
    #[cfg(unix)]
    {
        use rustix::{
            fs::{self as rfs, Mode, OFlags},
            io::Errno,
        };
        let leaf = preferred_sidecar_leaf(target.leaf());
        let file = match rfs::openat(
            target.parent(),
            &leaf,
            OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        ) {
            Ok(file) => std::fs::File::from(file),
            Err(error) if error == Errno::NOENT || error == Errno::LOOP => return Ok(None),
            Err(error) => return Err(Error::Io(Box::new(error.into()))),
        };
        let index = match MmapSearchIndex::open_file_cancellable(file, cancellation) {
            Ok(index) => index,
            Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::InvalidData => {
                return Ok(None)
            }
            Err(error) => return Err(error),
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
    cancellation: &CancellationToken,
) -> Result<(SearchIndexIdentity, MmapSearchIndex), Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let identity = SearchIndexIdentity::for_database(database, expected_source)?;
    if let Some(index) = search_cache.get_index(&identity) {
        return Ok((identity, index));
    }

    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    search_cache.insert_index(identity.clone(), index.clone());
    Ok((identity, index))
}

struct CollisionCleanup<'a> {
    search_cache: &'a SearchCache,
    query: GameQuery,
    database: PathBuf,
    lock: Arc<ParkingMutex<()>>,
}

impl<'a> CollisionCleanup<'a> {
    fn for_query(search_cache: &'a SearchCache, query: GameQuery, database: &Path) -> Self {
        let database = database.to_path_buf();
        let lock = search_cache.collision_lock(query.clone(), database.clone());
        Self {
            search_cache,
            query,
            database,
            lock,
        }
    }
}

struct GenerationLockCleanup<'a> {
    search_cache: &'a SearchCache,
    index: PathBuf,
    lock: Arc<ParkingMutex<()>>,
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

fn invalid_move_stream(game_id: i32, error: Error) -> Error {
    match error {
        Error::Cancellation => Error::Cancellation,
        error => Error::InvalidInput(format!("game {game_id} has invalid move stream: {error}")),
    }
}

fn get_move_after_match(
    game_id: i32,
    move_blob: &[u8],
    fen: &Option<&str>,
    query: &PositionQuery,
    cancellation: &CancellationToken,
) -> Result<Option<String>, Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
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
        let mut mainline = try_iter_mainline_move_bytes_cancellable(move_blob, cancellation)
            .map_err(|error| invalid_move_stream(game_id, error))?
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

    let mut mainline = try_iter_mainline_move_bytes_cancellable(move_blob, cancellation)
        .map_err(|error| invalid_move_stream(game_id, error))?
        .peekable();

    while let Some(byte) = mainline.next() {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
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

#[tauri::command]
#[specta::specta]
pub async fn search_position(
    file: DatabaseHandle,
    query: GameQuery,
    app: tauri::AppHandle,
    tab_id: String,
    ticket: Option<String>,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<(Vec<PositionStats>, Vec<NormalizedGame>), Error> {
    let operation = crate::native_read_operation(ticket, &window, &state, "search_position")?;
    let cancellation = operation.token();
    let progress = JobProgress::new(app.clone(), tab_id)?;
    let authority = Arc::clone(&state.pgn_path_authority);
    let repository = Arc::clone(&state.database_repository);
    let search_cache = Arc::clone(&state.search_cache);
    let new_request = state.new_request.clone();
    let lease = progress.lease();
    let worker_app = app.clone();
    crate::infra::operations::run_native_operation(operation, "search_position", async move {
        let permit = acquire_search_request(new_request, &cancellation).await?;
        BLOCKING_GATEWAY
            .spawn_cancellable(cancellation, move |token| {
                let result = search_position_blocking(
                    &authority,
                    &repository,
                    &search_cache,
                    permit,
                    lease,
                    worker_app,
                    file,
                    query,
                    token,
                );
                progress.complete(match &result {
                    Ok(_) => ProgressState::Succeeded,
                    Err(Error::Cancellation) => ProgressState::Cancelled,
                    Err(_) => ProgressState::Failed,
                });
                result
            })
            .await
    })
    .await
}

async fn acquire_search_request(
    new_request: Arc<tokio::sync::Semaphore>,
    cancellation: &CancellationToken,
) -> Result<OwnedSemaphorePermit, Error> {
    tokio::select! {
        biased;
        _ = cancellation.cancelled() => Err(Error::Cancellation),
        permit = new_request.acquire_owned() => {
            permit.map_err(|_| Error::Conflict("position search permit unavailable".into()))
        }
    }
}

// Individual Arc handles the closure must own: BlockingGateway::spawn is
// `'static` and AppState is not Clone. A bundle type was rejected (plan
// decision D-B).
#[allow(clippy::too_many_arguments)]
fn search_position_blocking<R: tauri::Runtime>(
    authority: &Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &Arc<SearchCache>,
    permit: OwnedSemaphorePermit,
    lease: ProgressLease,
    app: tauri::AppHandle<R>,
    file: DatabaseHandle,
    query: GameQuery,
    cancellation: &CancellationToken,
) -> Result<(Vec<PositionStats>, Vec<NormalizedGame>), Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let database_handle = file;
    let target = super::resolve_database(authority, &database_handle, PathOperation::DatabaseRead)?;
    let _collision_cleanup =
        CollisionCleanup::for_query(search_cache, query.clone(), target.path());
    let _guard =
        crate::infra::cancellable_lock::lock_cancellable(&_collision_cleanup.lock, cancellation)?;

    let mut database_connection = get_db_or_create(repository, target.path())?;
    let db = &mut *database_connection;

    let start = Instant::now();
    info!("start loading games");

    let (identity, mmap_index) = load_search_index_cancellable(
        authority,
        repository,
        search_cache,
        &database_handle,
        cancellation,
    )?;
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
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
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

        try_iter_mainline_move_bytes_cancellable(entry.moves, cancellation)
            .map_err(|error| invalid_move_stream(entry.id, error))?;

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
                if let Some(m) = get_move_after_match(
                    entry.id,
                    entry.moves,
                    &entry.fen,
                    position_query,
                    cancellation,
                )? {
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
    let games: Vec<(Game, Player, Player, Event, Site)> =
        super::sqlite_cancellation::with_sqlite_cancellation(cancellation, || {
            games::table
                .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
                .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
                .inner_join(events::table.on(games::event_id.eq(events::id)))
                .inner_join(sites::table.on(games::site_id.eq(sites::id)))
                .filter(games::id.eq_any(ids))
                .order((games::white_elo.desc(), games::black_elo.desc()))
                .load(db)
        })?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let normalized_games = normalize_games(games, cancellation)?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    search_cache.insert_result(cache_key, (openings.clone(), normalized_games.clone()));

    drop(permit);

    Ok((openings, normalized_games))
}

#[cfg(test)]
pub fn is_position_in_db(
    authority: &Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &Arc<SearchCache>,
    file: &DatabaseHandle,
    query: &GameQuery,
) -> Result<bool, Error> {
    is_position_in_db_cancellable(
        authority,
        repository,
        search_cache,
        file,
        query,
        &CancellationToken::new(),
    )
}

pub(crate) fn is_position_in_db_cancellable(
    authority: &Mutex<Option<PathAuthority>>,
    repository: &DatabaseRepository,
    search_cache: &Arc<SearchCache>,
    file: &DatabaseHandle,
    query: &GameQuery,
    cancellation: &CancellationToken,
) -> Result<bool, Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let database_handle = file;
    let target = super::resolve_database(authority, database_handle, PathOperation::DatabaseRead)?;
    let _collision_cleanup =
        CollisionCleanup::for_query(search_cache, query.clone(), target.path());
    let _guard =
        crate::infra::cancellable_lock::lock_cancellable(&_collision_cleanup.lock, cancellation)?;

    let parsed_position_query: Option<PositionQuery> = if let Some(pq) = &query.position {
        Some(convert_position_query(pq.clone())?)
    } else {
        None
    };

    let start = Instant::now();
    info!("start loading games for is_position_in_db");

    let (identity, mmap_index) = load_search_index_cancellable(
        authority,
        repository,
        search_cache,
        database_handle,
        cancellation,
    )?;
    let cache_key = SearchResultKey::new(query.clone(), identity);
    if let Some(result) = search_cache.get_result(&cache_key) {
        return Ok(!result.0.is_empty());
    }

    let exists = AtomicBool::new(false);
    let check_entry = |entry: SearchGameEntryRef<'_>| -> Result<(), Error> {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        try_iter_mainline_move_bytes_cancellable(entry.moves, cancellation).map_err(|error| {
            if matches!(error, Error::Cancellation) {
                return Error::Cancellation;
            }
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
                && get_move_after_match(
                    entry.id,
                    entry.moves,
                    &entry.fen,
                    position_query,
                    cancellation,
                )?
                .is_some()
            {
                exists.store(true, Ordering::Relaxed);
            }
        }
        Ok(())
    };

    mmap_index.par_iter().try_for_each(check_entry)?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let exists = exists.load(Ordering::Relaxed);

    info!("finished search in {:?}", start.elapsed());

    if !exists {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        search_cache.insert_result(cache_key, (vec![], vec![]));
    }

    Ok(exists)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        db::{
            legacy_index_path,
            models::NewGame,
            ops::{create_event, create_game, create_player, create_site},
            SearchIndexChunk,
        },
        infra::fs::set_test_atomic_file_injector,
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
        super::super::schema_database_case("search", operations)
    }

    #[test]
    fn search_commands_resolve_with_their_own_operation() {
        let (_dir, app, handle, _database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(
                crate::progress::ProgressEvent
            ))
            .mount_events(&app);
        let state = app.state::<AppState>();
        let progress = JobProgress::new(app.clone(), "matrix-search".into()).unwrap();
        let permit = state.new_request.clone().try_acquire_owned().unwrap();
        let _ = super::super::take_resolve_database_operations();
        let result = search_position_blocking(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            permit,
            progress.lease(),
            app.clone(),
            handle,
            GameQuery::new(),
            &CancellationToken::new(),
        );
        let recorded = super::super::take_resolve_database_operations();
        assert_eq!(recorded.first(), Some(&PathOperation::DatabaseRead));
        assert!(matches!(
            result,
            Err(Error::InvalidInput(message))
                if message == "workspace entry does not permit this operation"
        ));

        let (_dir, app, handle, _database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        let state = app.state::<AppState>();
        let _ = super::super::take_resolve_database_operations();
        let result = is_position_in_db_cancellable(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &GameQuery::new(),
            &CancellationToken::new(),
        );
        let recorded = super::super::take_resolve_database_operations();
        assert_eq!(recorded.first(), Some(&PathOperation::DatabaseRead));
        assert!(matches!(
            result,
            Err(Error::InvalidInput(message))
                if message == "workspace entry does not permit this operation"
        ));

        let (_dir, app, handle, _database) = loader_test_case(vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
        ]);
        let state = app.state::<AppState>();
        let _ = super::super::take_resolve_database_operations();
        load_search_index_cancellable(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &CancellationToken::new(),
        )
        .unwrap();
        assert_eq!(
            super::super::take_resolve_database_operations(),
            vec![
                PathOperation::DatabaseRead,
                PathOperation::DatabaseRead,
                PathOperation::DatabaseMutate,
                PathOperation::DatabaseMutate,
                PathOperation::DatabaseRead,
            ]
        );

        let (_dir, app, handle, _database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        let state = app.state::<AppState>();
        let _ = super::super::take_resolve_database_operations();
        let result = load_search_index_cancellable(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &CancellationToken::new(),
        );
        assert_eq!(
            super::super::take_resolve_database_operations(),
            vec![
                PathOperation::DatabaseRead,
                PathOperation::DatabaseRead,
                PathOperation::DatabaseMutate,
            ]
        );
        assert!(matches!(
            result,
            Err(Error::InvalidInput(message))
                if message == "workspace entry does not permit this operation"
        ));
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
        SearchIndexChunk::default()
            .write_to_with_source(get_index_path(&database), loader_source(&app, &database))
            .unwrap()
            .expect_durable();

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
        SearchIndexChunk::default()
            .write_to_with_source(&legacy, loader_source(&legacy_app, &legacy_database))
            .unwrap()
            .expect_durable();
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
        let (_dir, app, handle, database) = loader_test_case(vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
        ]);
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "injected parent sync failure",
        ))));
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
    fn old_search_index_version_is_regenerated_when_mutation_is_authorized() {
        let (_dir, app, handle, database) = loader_test_case(vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
        ]);
        let path = get_index_path(&database);
        let mut old_header = vec![0_u8; 32];
        old_header[..4].copy_from_slice(b"ECSI");
        old_header[4..8].copy_from_slice(&6_u32.to_le_bytes());
        std::fs::write(&path, old_header).unwrap();

        let loaded = {
            let state = app.state::<AppState>();
            load_search_index(
                &state.pgn_path_authority,
                &state.database_repository,
                &state.search_cache,
                &handle,
            )
        }
        .unwrap();
        assert_eq!(loaded.1.len(), 0);
        assert!(MmapSearchIndex::open(path).is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn operational_search_index_open_error_propagates() {
        let (_dir, app, handle, database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        std::fs::create_dir(get_index_path(&database)).unwrap();

        let result = {
            let state = app.state::<AppState>();
            load_search_index(
                &state.pgn_path_authority,
                &state.database_repository,
                &state.search_cache,
                &handle,
            )
        };
        assert!(matches!(result, Err(Error::Io(_))));
    }

    #[test]
    fn search_index_loader_uses_fd_relative_authority_boundaries() {
        let source = include_str!("search.rs");
        let loader = source
            .split("fn load_search_index_cancellable")
            .nth(1)
            .unwrap()
            .split("fn open_valid_preferred")
            .next()
            .unwrap();
        assert!(loader.contains("resolve_database("));
        assert!(loader.contains("promote_legacy_index_sidecar_at"));
        assert!(!loader.contains("canonicalize("));
        assert!(!loader.contains("database_path("));
        assert!(!loader.contains("workspace_entry_path("));
        assert!(!loader.contains("let database"));
        assert!(loader.contains(
            "cache_loaded_index(\n            search_cache,\n            read_target.path()"
        ));
        assert!(loader.contains("generation_lock(get_index_path(read_target.path()))"));
        assert!(loader.contains("get_index_path(read_target.path())"));
        assert!(loader.contains(
            "cache_loaded_index(\n            search_cache,\n            mutate_target.path()"
        ));
        assert!(!loader.contains("atomic_replace(&"));
        assert!(!loader.contains("std::fs::remove_file"));
    }

    #[test]
    fn generation_lock_recovers_after_a_panicking_owner() {
        let (_dir, app, handle, database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        let index = get_index_path(&database.canonicalize().unwrap());
        let lock = app.state::<AppState>().search_cache.generation_lock(index);
        let panicked = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = lock.lock();
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
        assert!(!matches!(result, Err(Error::Conflict(ref message)) if message.contains("lock")));
    }

    #[test]
    fn collision_lock_recovers_after_a_panicking_owner() {
        let (_dir, app, handle, database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        let query = GameQuery::new();
        let canonical = database.canonicalize().unwrap();
        let lock = app
            .state::<AppState>()
            .search_cache
            .collision_lock(query.clone(), canonical);
        let panicked = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = lock.lock();
            panic!("poison the search cache collision lock");
        }));
        assert!(panicked.is_err());

        let result = {
            let state = app.state::<AppState>();
            is_position_in_db(
                &state.pgn_path_authority,
                &state.database_repository,
                &state.search_cache,
                &handle,
                &query,
            )
        };
        assert!(!matches!(result, Err(Error::Conflict(ref message)) if message.contains("lock")));
    }

    #[test]
    fn production_generation_and_collision_lock_waits_cancel_while_contended() {
        let (_dir, app, _handle, database) = loader_test_case(vec![PathOperation::DatabaseRead]);
        let cache = &app.state::<AppState>().search_cache;
        let generation = cache.generation_lock(get_index_path(&database));
        let collision = cache.collision_lock(GameQuery::new(), database.canonicalize().unwrap());

        for lock in [generation.clone(), collision.clone()] {
            let held = lock.lock();
            let worker_lock = Arc::clone(&lock);
            let cancellation = CancellationToken::new();
            let worker_token = cancellation.clone();
            let (done_tx, done_rx) = std::sync::mpsc::channel();
            let worker = std::thread::spawn(move || {
                let result =
                    crate::infra::cancellable_lock::lock_cancellable(&worker_lock, &worker_token)
                        .map(|_| ());
                let _ = done_tx.send(result);
            });
            cancellation.cancel();
            assert!(matches!(
                done_rx
                    .recv_timeout(std::time::Duration::from_secs(1))
                    .unwrap(),
                Err(Error::Cancellation)
            ));
            worker.join().unwrap();
            drop(held);
        }
    }

    fn assert_partial_match(fen1: &str, fen2: &str) {
        let query = PositionQuery::partial_from_fen(fen1).unwrap();
        let fen = Fen::from_ascii(fen2.as_bytes()).unwrap();
        let chess = Chess::from_setup(fen.into_setup(), shakmaty::CastlingMode::Chess960).unwrap();
        assert!(query.matches(&chess));
    }

    fn assert_partial_no_match(fen1: &str, fen2: &str) {
        let query = PositionQuery::partial_from_fen(fen1).unwrap();
        let fen = Fen::from_ascii(fen2.as_bytes()).unwrap();
        let chess = Chess::from_setup(fen.into_setup(), shakmaty::CastlingMode::Chess960).unwrap();
        assert!(!query.matches(&chess));
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
    fn partial_match_requires_the_piece_colour_on_each_specified_square() {
        assert_partial_no_match(
            "8/8/8/8/8/8/8/6N1 w - - 0 1",
            "3k4/8/8/8/8/4P3/3PKP2/6n1 w - - 0 1",
        );
        assert_partial_no_match(
            "8/8/8/8/8/8/8/6n1 w - - 0 1",
            "3k4/8/8/8/8/4p3/3PKP2/6N1 w - - 0 1",
        );
    }

    #[test]
    fn partial_match_accepts_extra_unspecified_pieces_of_either_colour() {
        assert_partial_match(
            "8/8/8/8/8/8/8/6N1 w - - 0 1",
            "3k4/8/8/8/8/4p3/3PKP2/6N1 w - - 0 1",
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
        let result =
            get_move_after_match(1, &game, &None, &query, &CancellationToken::new()).unwrap();
        assert_eq!(result, Some("e4".to_string()));

        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        )
        .unwrap();
        let result =
            get_move_after_match(1, &game, &None, &query, &CancellationToken::new()).unwrap();
        assert_eq!(result, Some("e5".to_string()));

        let query = PositionQuery::exact_from_fen(
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        )
        .unwrap();
        let result =
            get_move_after_match(1, &game, &None, &query, &CancellationToken::new()).unwrap();
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
        let result =
            get_move_after_match(1, &game, &None, &query, &CancellationToken::new()).unwrap();
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
        let error = get_move_after_match(42, &[252, 1], &None, &query, &CancellationToken::new())
            .unwrap_err();
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

    #[tokio::test]
    async fn search_cancellation_while_queued_for_request_semaphore_never_admits_work() {
        let semaphore = Arc::new(tokio::sync::Semaphore::new(1));
        let held = semaphore.clone().acquire_owned().await.unwrap();
        let cancellation = CancellationToken::new();
        let worker_token = cancellation.clone();
        let worker_semaphore = Arc::clone(&semaphore);
        let queued =
            tokio::spawn(
                async move { acquire_search_request(worker_semaphore, &worker_token).await },
            );
        tokio::task::yield_now().await;
        cancellation.cancel();
        assert!(matches!(
            tokio::time::timeout(std::time::Duration::from_secs(1), queued)
                .await
                .unwrap()
                .unwrap(),
            Err(Error::Cancellation)
        ));
        assert_eq!(semaphore.available_permits(), 0);
        drop(held);
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
        let progress = JobProgress::new(app.clone(), "tab-1".into()).unwrap();

        let store = &app.state::<AppState>().progress_state;
        assert_eq!(
            store.get("tab-1").unwrap().unwrap().state,
            ProgressState::Running
        );

        let _ = update_progress_with_state(
            &app.state::<AppState>().progress_state,
            &app,
            &progress.lease(),
            search_progress_percent(50, 200),
            ProgressState::Running,
        );
        assert_eq!(store.get("tab-1").unwrap().unwrap().progress, 25.0);

        progress.complete(ProgressState::Succeeded);
        let item = store.get("tab-1").unwrap().unwrap();
        assert_eq!(item.state, ProgressState::Succeeded);
        assert_eq!(item.progress, 100.0);

        // Dropping after a terminal transition must not reopen the entry as cancelled.
        drop(progress);
        assert_eq!(
            store.get("tab-1").unwrap().unwrap().state,
            ProgressState::Succeeded
        );
    }

    #[test]
    fn abandoned_search_is_cancelled_on_drop() {
        let app = progress_test_app();
        let progress = JobProgress::new(app.clone(), "tab-2".into()).unwrap();
        let _ = update_progress_with_state(
            &app.state::<AppState>().progress_state,
            &app,
            &progress.lease(),
            search_progress_percent(10, 100),
            ProgressState::Running,
        );
        drop(progress);

        let store = &app.state::<AppState>().progress_state;
        let item = store.get("tab-2").unwrap().unwrap();
        assert_eq!(item.state, ProgressState::Cancelled);
        assert!(item.finished);
    }

    #[test]
    fn search_cancellation_emits_exactly_one_cancelled_terminal_and_never_failed() {
        use tauri_specta::Event as _;

        let app = progress_test_app();
        let frames = Arc::new(std::sync::Mutex::new(Vec::new()));
        let captured = Arc::clone(&frames);
        crate::progress::ProgressEvent::listen(&app, move |event| {
            captured.lock().unwrap().push(event.payload);
        });
        let progress = JobProgress::new(app, "cancelled-search".into()).unwrap();
        progress.complete(ProgressState::Cancelled);
        drop(progress);
        let frames = frames.lock().unwrap();
        assert_eq!(
            frames
                .iter()
                .filter(|frame| frame.state == ProgressState::Cancelled && frame.finished)
                .count(),
            1
        );
        assert!(!frames
            .iter()
            .any(|frame| frame.state == ProgressState::Failed));
    }

    #[test]
    fn search_position_production_core_cancels_during_index_sql_without_cache_publication() {
        let (_dir, app, handle, database) = loader_test_case(vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
        ]);
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(
                crate::progress::ProgressEvent
            ))
            .mount_events(&app);
        let state = app.state::<AppState>();
        let progress = JobProgress::new(app.clone(), "held-search".into()).unwrap();
        let permit = state.new_request.clone().try_acquire_owned().unwrap();
        let cancellation = CancellationToken::new();
        let checkpoints =
            crate::db::sqlite_cancellation::cancel_on_callback(cancellation.clone(), 2);
        let result = search_position_blocking(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            permit,
            progress.lease(),
            app.clone(),
            handle,
            GameQuery::new(),
            &cancellation,
        );
        assert!(matches!(result, Err(Error::Cancellation)));
        assert!(checkpoints.load(Ordering::SeqCst) >= 2);
        assert!(!get_index_path(&database).exists());
        assert!(state.search_cache.results.lock().unwrap().values.is_empty());
    }

    #[test]
    fn search_position_cancels_during_post_sql_normalization_without_cache_publication() {
        let (_dir, app, handle, _database) = position_search_database();
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(
                crate::progress::ProgressEvent
            ))
            .mount_events(&app);
        let state = app.state::<AppState>();
        let progress = JobProgress::new(app.clone(), "normalization-search".into()).unwrap();
        let permit = state.new_request.clone().try_acquire_owned().unwrap();
        let cancellation = CancellationToken::new();
        crate::db::encoding::cancel_decode_after_checkpoints(cancellation.clone(), 2);
        let result = search_position_blocking(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            permit,
            progress.lease(),
            app.clone(),
            handle,
            exact_position_query(STARTING_FEN),
            &cancellation,
        );
        assert!(matches!(result, Err(Error::Cancellation)));
        assert!(state.search_cache.results.lock().unwrap().values.is_empty());
    }

    #[tokio::test]
    async fn novelty_core_observes_analysis_cancellation_after_engine_exit() {
        let (_dir, app, handle, database) = position_search_database();
        let state = app.state::<AppState>();
        let cancellation = CancellationToken::new();
        let checkpoints =
            crate::db::sqlite_cancellation::cancel_on_callback(cancellation.clone(), 2);
        let permit = state.new_request.clone().try_acquire_owned().unwrap();

        // analyze_game_core has already retired its engine before it calls this
        // production novelty helper. Cancellation must still reach the real
        // index-generation SQL scope and suppress every cache publication.
        let result = crate::chess::novelty_lookup_blocking(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            permit,
            handle,
            vec![exact_position_query(AFTER_E4_E5_NF3_FEN)],
            &cancellation,
        );

        let outcome = match &result {
            Ok(present) => format!("success with {} presence flags", present.len()),
            Err(error) => error.to_string(),
        };
        assert!(
            matches!(result, Err(Error::Cancellation)),
            "novelty lookup returned {outcome} after {} SQLite checkpoints",
            checkpoints.load(Ordering::SeqCst)
        );
        assert!(checkpoints.load(Ordering::SeqCst) >= 2);
        assert!(!get_index_path(&database).exists());
        assert!(state.search_cache.results.lock().unwrap().values.is_empty());
        assert!(state.search_cache.indexes.lock().unwrap().values.is_empty());
    }

    #[test]
    fn a_newer_search_on_the_same_tab_supersedes_the_older_producer() {
        let app = progress_test_app();
        let older = JobProgress::new(app.clone(), "tab-3".into()).unwrap();
        let newer = JobProgress::new(app.clone(), "tab-3".into()).unwrap();

        // The stale producer's updates are refused rather than driving the new bar.
        let _ = update_progress_with_state(
            &app.state::<AppState>().progress_state,
            &app,
            &older.lease(),
            search_progress_percent(90, 100),
            ProgressState::Running,
        );
        let store = &app.state::<AppState>().progress_state;
        assert_eq!(store.get("tab-3").unwrap().unwrap().progress, 0.0);

        let _ = update_progress_with_state(
            &app.state::<AppState>().progress_state,
            &app,
            &newer.lease(),
            search_progress_percent(10, 100),
            ProgressState::Running,
        );
        assert_eq!(store.get("tab-3").unwrap().unwrap().progress, 10.0);

        // Even the stale producer's Drop must not cancel the running search.
        drop(older);
        assert_eq!(
            store.get("tab-3").unwrap().unwrap().state,
            ProgressState::Running
        );
    }

    const STARTING_FEN: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const AFTER_E4_E5_NF3_FEN: &str =
        "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
    const AFTER_D4_FEN: &str = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1";

    fn insert_white_win_e4_e5(connection: &mut SqliteConnection) -> i32 {
        let white = create_player(connection, "Carlsen").unwrap();
        let black = create_player(connection, "Nakamura").unwrap();
        let event = create_event(connection, "Candidates").unwrap();
        let site = create_site(connection, "Madrid").unwrap();

        let mut chess = Chess::default();
        for san in ["e4", "e5"] {
            let m = SanPlus::from_ascii(san.as_bytes())
                .unwrap()
                .san
                .to_move(&chess)
                .unwrap();
            chess.play_unchecked(&m);
        }
        let material = get_material_count(chess.board());
        create_game(
            connection,
            NewGame {
                event_id: event.id,
                site_id: site.id,
                white_id: white.id,
                black_id: black.id,
                white_elo: Some(2800),
                black_elo: Some(2700),
                white_material: i32::from(material.white),
                black_material: i32::from(material.black),
                date: Some("2026.08.09"),
                time: Some("12:00:00"),
                round: None,
                result: Some("1-0"),
                time_control: None,
                eco: Some("C20"),
                ply_count: 2,
                fen: None,
                moves: &[12, 12],
                pawn_home: i32::from(get_pawn_home(chess.board())),
            },
        )
        .unwrap()
        .id
    }

    fn position_search_database() -> (
        TempDir,
        tauri::AppHandle<tauri::test::MockRuntime>,
        DatabaseHandle,
        PathBuf,
    ) {
        let (dir, app, handle, database) = loader_test_case(vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
        ]);
        let mut connection = SqliteConnection::establish(database.to_str().unwrap()).unwrap();
        insert_white_win_e4_e5(&mut connection);
        drop(connection);
        (dir, app, handle, database)
    }

    fn run_position_search(
        app: &tauri::AppHandle<tauri::test::MockRuntime>,
        handle: &DatabaseHandle,
        query: GameQuery,
        progress_id: &str,
    ) -> Result<(Vec<PositionStats>, Vec<NormalizedGame>), Error> {
        let state = app.state::<AppState>();
        let progress = JobProgress::new(app.clone(), progress_id.into()).unwrap();
        let permit = state.new_request.clone().try_acquire_owned().unwrap();
        search_position_blocking(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            permit,
            progress.lease(),
            app.clone(),
            handle.clone(),
            query,
            &CancellationToken::new(),
        )
    }

    fn exact_position_query(fen: &str) -> GameQuery {
        GameQuery::new().position(PositionQueryJs {
            fen: fen.to_string(),
            type_: "exact".to_string(),
        })
    }

    #[test]
    fn is_position_in_db_finds_a_played_position_and_rejects_an_unplayed_one() {
        let (_dir, app, handle, _database) = position_search_database();
        let state = app.state::<AppState>();

        let present = is_position_in_db(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &exact_position_query(STARTING_FEN),
        )
        .unwrap();
        assert!(
            present,
            "the starting position of 1. e4 e5 must be found in the database"
        );

        let absent = is_position_in_db(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &exact_position_query(AFTER_E4_E5_NF3_FEN),
        )
        .unwrap();
        assert!(
            !absent,
            "1. e4 e5 2. Nf3 is not a position of the stored game"
        );

        let absent_again = is_position_in_db(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &exact_position_query(AFTER_E4_E5_NF3_FEN),
        )
        .unwrap();
        assert!(
            !absent_again,
            "a repeated miss must stay a miss when served from the search cache"
        );

        let no_position = is_position_in_db(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &GameQuery::new(),
        )
        .unwrap();
        assert!(
            !no_position,
            "a query without a position is not a position match"
        );

        let pruned = is_position_in_db(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &exact_position_query(AFTER_D4_FEN),
        )
        .unwrap();
        assert!(
            !pruned,
            "1. d4 is unreachable from a game that never moved the d-pawn"
        );

        let invalid = is_position_in_db(
            &state.pgn_path_authority,
            &state.database_repository,
            &state.search_cache,
            &handle,
            &GameQuery::new().position(PositionQueryJs {
                fen: STARTING_FEN.to_string(),
                type_: "surprise".to_string(),
            }),
        );
        assert!(
            matches!(invalid, Err(Error::InvalidInput(_))),
            "an unsupported position query type must be rejected, not treated as a miss"
        );
    }

    #[test]
    fn production_position_search_applies_filters_and_reuses_exact_cached_results() {
        let (_dir, app, handle, database) = position_search_database();
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(
                crate::progress::ProgressEvent
            ))
            .mount_events(&app);
        let mut connection = SqliteConnection::establish(database.to_str().unwrap()).unwrap();
        let white_id = players::table
            .filter(players::name.eq("Carlsen"))
            .select(players::id)
            .first::<i32>(&mut connection)
            .unwrap();
        let black_id = players::table
            .filter(players::name.eq("Nakamura"))
            .select(players::id)
            .first::<i32>(&mut connection)
            .unwrap();
        drop(connection);

        let query = exact_position_query(STARTING_FEN);
        let first = run_position_search(&app, &handle, query.clone(), "search-success").unwrap();
        assert_eq!(first.0.len(), 1);
        assert_eq!(first.0[0].move_, "e4");
        assert_eq!(
            (first.0[0].white, first.0[0].draw, first.0[0].black),
            (1, 0, 0)
        );
        assert_eq!(first.1.len(), 1);

        let cached = run_position_search(&app, &handle, query, "search-cached").unwrap();
        assert_eq!(cached.0[0].move_, "e4");
        assert_eq!(cached.1[0].white, "Carlsen");

        let mut matching_filters = exact_position_query(STARTING_FEN);
        matching_filters.player1 = Some(white_id);
        matching_filters.player2 = Some(black_id);
        matching_filters.wanted_result = Some("whitewon".into());
        matching_filters.start_date = Some("2026.01.01".into());
        matching_filters.end_date = Some("2026.12.31".into());
        let matched =
            run_position_search(&app, &handle, matching_filters, "search-filter-hit").unwrap();
        assert_eq!(matched.0[0].white, 1);
        assert_eq!(matched.1.len(), 1);

        let mut wrong_white = exact_position_query(STARTING_FEN);
        wrong_white.player1 = Some(white_id + 10_000);
        let excluded_white =
            run_position_search(&app, &handle, wrong_white, "search-white-miss").unwrap();
        assert_eq!((excluded_white.0.len(), excluded_white.1.len()), (0, 0));

        let mut wrong_black = exact_position_query(STARTING_FEN);
        wrong_black.player2 = Some(black_id + 10_000);
        let excluded_black =
            run_position_search(&app, &handle, wrong_black, "search-black-miss").unwrap();
        assert_eq!((excluded_black.0.len(), excluded_black.1.len()), (0, 0));

        let mut wrong_result = exact_position_query(STARTING_FEN);
        wrong_result.wanted_result = Some("draw".into());
        let excluded_result =
            run_position_search(&app, &handle, wrong_result, "search-result-miss").unwrap();
        assert_eq!((excluded_result.0.len(), excluded_result.1.len()), (0, 0));

        let mut wrong_date = exact_position_query(STARTING_FEN);
        wrong_date.start_date = Some("2027.01.01".into());
        let excluded_date =
            run_position_search(&app, &handle, wrong_date, "search-date-miss").unwrap();
        assert_eq!((excluded_date.0.len(), excluded_date.1.len()), (0, 0));
    }
}
