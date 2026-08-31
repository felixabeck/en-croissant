mod encoding;
mod migrations;
mod models;
mod ops;
mod repository;
mod schema;
mod search;
mod search_index;

use crate::{
    db::{
        encoding::{decode_game_to_movetext, decode_move, iter_mainline_move_bytes},
        models::*,
        ops::*,
        schema::*,
    },
    error::Error,
    infra::{
        fs::{remove_optional_regular_at, AtomicFileOutcome},
        path_authority::{DatabaseFileTarget, DatabaseHandle, FileWorkspaceHandle, PathOperation},
    },
    opening::get_opening_from_setup,
    AppState,
};
use chrono::{NaiveDate, NaiveTime};
use dashmap::DashMap;
use diesel::{
    connection::{DefaultLoadingMode, SimpleConnection},
    insert_into,
    prelude::*,
    sql_query,
    sql_types::Text,
};
use pgn_reader::{BufferedReader, Nag, RawHeader, SanPlus, Skip, Visitor};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, Board, ByColor, CastlingMode, Chess, EnPassantMode, FromSetup, Piece, Position,
    PositionError,
};
use specta::Type;
use std::{
    ffi::OsStr,
    fs::File,
    path::Path,
    sync::atomic::{AtomicUsize, Ordering},
    time::{Instant, SystemTime},
};
use std::{
    io::{BufWriter, Write},
    str::FromStr,
};
use tauri::State;

use log::info;
use tauri_specta::Event as _;

use self::encoding::{
    encode_comment, encode_move, encode_nag, VARIATION_END_MARKER, VARIATION_START_MARKER,
};
pub use self::repository::{DatabaseIdentity, DatabaseRepository};
pub use self::search_index::{
    get_index_path, legacy_index_path, IndexSource, MmapSearchIndex, SearchGameEntry, SearchIndex,
};

pub use self::models::NormalizedGame;
pub use self::models::Puzzle;
pub use self::schema::puzzle_themes;
pub use self::schema::puzzles;
pub use self::schema::themes;
pub use self::search::{is_position_in_db, search_position, PositionQueryJs, PositionStats};

const INDEXES_SQL: &str = include_str!("indexes.sql");

const DELETE_INDEXES_SQL: &str = include_str!("delete_indexes.sql");

#[cfg(test)]
const CREATE_TABLES_SQL: &str = include_str!("create.sql");

const WHITE_PAWN: Piece = Piece {
    color: shakmaty::Color::White,
    role: shakmaty::Role::Pawn,
};

const BLACK_PAWN: Piece = Piece {
    color: shakmaty::Color::Black,
    role: shakmaty::Role::Pawn,
};

type MaterialCount = ByColor<u8>;

fn get_material_count(board: &Board) -> MaterialCount {
    board.material().map(|material| {
        material.pawn
            + material.knight * 3
            + material.bishop * 3
            + material.rook * 5
            + material.queen * 9
    })
}

/// Returns the bit representation of the pawns on the second and seventh rank
/// of the given board.
fn get_pawn_home(board: &Board) -> u16 {
    let white_pawns = board.by_piece(WHITE_PAWN);
    let black_pawns = board.by_piece(BLACK_PAWN);
    let second_rank_pawns = (white_pawns.0 >> 8) as u8;
    let seventh_rank_pawns = (black_pawns.0 >> 48) as u8;
    (second_rank_pawns as u16) | ((seventh_rank_pawns as u16) << 8)
}

/// Immutable safety policy for every connection in every database pool.  Import
/// batching belongs at the transaction/index layer; a pooled connection must
/// never retain weaker integrity or durability PRAGMAs from a prior caller.
#[derive(Debug, Default)]
pub struct ConnectionOptions;

/// Metadata used to invalidate the cheap schema-validation cache whenever a
/// database is replaced or modified outside this process.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DatabaseSchemaIdentity {
    object: (u64, u64),
    length: u64,
    modified: SystemTime,
}

impl DatabaseSchemaIdentity {
    fn from_path(path: &Path) -> Result<Self, Error> {
        let metadata = path.metadata()?;
        Ok(Self {
            object: crate::infra::path_authority::opened_file_identity(&File::open(path)?)?,
            length: metadata.len(),
            modified: metadata.modified()?,
        })
    }
}

impl diesel::r2d2::CustomizeConnection<SqliteConnection, diesel::r2d2::Error>
    for ConnectionOptions
{
    fn on_acquire(&self, conn: &mut SqliteConnection) -> Result<(), diesel::r2d2::Error> {
        (|| {
            conn.batch_execute(
                "PRAGMA foreign_keys = ON;\
                 PRAGMA journal_mode = WAL;\
                 PRAGMA synchronous = FULL;\
                 PRAGMA busy_timeout = 30000;",
            )?;
            Ok(())
        })()
        .map_err(diesel::r2d2::Error::QueryError)
    }
}

pub(crate) fn get_db_or_create(
    state: &State<AppState>,
    db_path: &Path,
) -> Result<repository::DatabaseConnection, Error> {
    state.database_repository.connection(db_path)
}

/// The sole database capability boundary.  Native repository code receives a
/// checked path only after the opaque handle and the exact requested operation
/// have been validated; no renderer path is ever parsed here.
pub(crate) fn resolve_database(
    state: &AppState,
    handle: &DatabaseHandle,
    operation: PathOperation,
) -> Result<std::path::PathBuf, Error> {
    state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .database_path(handle, operation)
}

fn update_info_count(
    db: &mut SqliteConnection,
    name: &str,
    value: i64,
) -> Result<(), diesel::result::Error> {
    diesel::insert_into(info::table)
        .values((info::name.eq(name), info::value.eq(value.to_string())))
        .on_conflict(info::name)
        .do_update()
        .set(info::value.eq(value.to_string()))
        .execute(db)?;
    Ok(())
}

#[derive(Debug)]
pub struct MaterialColor {
    white: u8,
    black: u8,
}

impl Default for MaterialColor {
    fn default() -> Self {
        Self {
            white: 39,
            black: 39,
        }
    }
}

#[derive(Default, Debug)]
pub struct TempGame {
    pub event_name: Option<String>,
    pub site_name: Option<String>,
    pub date: Option<String>,
    pub time: Option<String>,
    pub round: Option<String>,
    pub white_name: Option<String>,
    pub white_elo: Option<i32>,
    pub black_name: Option<String>,
    pub black_elo: Option<i32>,
    pub result: Option<String>,
    pub time_control: Option<String>,
    pub eco: Option<String>,
    pub fen: Option<String>,
    pub moves: Vec<u8>,
    pub position: Chess,
    pub material_count: MaterialColor,
}

impl TempGame {
    pub fn insert_to_db(&self, db: &mut SqliteConnection) -> Result<(), diesel::result::Error> {
        let pawn_home = get_pawn_home(self.position.board());

        let white_id = if let Some(name) = &self.white_name {
            create_player(db, name)?.id
        } else {
            0
        };
        let black_id = if let Some(name) = &self.black_name {
            create_player(db, name)?.id
        } else {
            0
        };

        let event_id = if let Some(name) = &self.event_name {
            create_event(db, name)?.id
        } else {
            0
        };

        let site_id = if let Some(name) = &self.site_name {
            create_site(db, name)?.id
        } else {
            0
        };

        let ply_count = iter_mainline_move_bytes(&self.moves).count() as i32;
        let final_material = get_material_count(self.position.board());
        let minimal_white_material = self.material_count.white.min(final_material.white) as i32;
        let minimal_black_material = self.material_count.black.min(final_material.black) as i32;

        let new_game = NewGame {
            white_id,
            black_id,
            ply_count,
            eco: self.eco.as_deref(),
            round: self.round.as_deref(),
            white_elo: self.white_elo,
            black_elo: self.black_elo,
            white_material: minimal_white_material,
            black_material: minimal_black_material,
            // max_rating: self.game.white.rating.max(self.game.black.rating),
            date: self.date.as_deref(),
            time: self.time.as_deref(),
            time_control: self.time_control.as_deref(),
            site_id,
            event_id,
            fen: self.fen.as_deref(),
            result: self.result.as_deref(),
            moves: self.moves.as_slice(),
            pawn_home: pawn_home as i32,
        };

        create_game(db, new_game)?;
        Ok(())
    }
}

struct Importer {
    game: TempGame,
    timestamp: Option<i64>,
    skip: bool,
    frames: Vec<ImportFrame>,
}

struct ImportFrame {
    position: Chess,
    pre_move_positions: Vec<Chess>,
}

impl ImportFrame {
    fn new(position: Chess) -> Self {
        Self {
            position,
            pre_move_positions: Vec::new(),
        }
    }
}

impl Importer {
    fn new(timestamp: Option<i64>) -> Importer {
        Importer {
            game: TempGame::default(),
            timestamp,
            skip: false,
            frames: Vec::new(),
        }
    }
}

impl Visitor for Importer {
    type Result = Option<TempGame>;

    fn begin_game(&mut self) {
        self.game = TempGame::default();
        self.skip = false;
        self.frames.clear();
    }

    fn header(&mut self, key: &[u8], value: RawHeader<'_>) {
        if key == b"White" {
            self.game.white_name = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Black" {
            self.game.black_name = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"WhiteElo" {
            if value.as_bytes() == b"-" {
                self.game.white_elo = Some(0);
            } else {
                self.game.white_elo = btoi::btoi(value.as_bytes()).ok();
            }
        } else if key == b"BlackElo" {
            if value.as_bytes() == b"-" {
                self.game.black_elo = Some(0);
            } else {
                self.game.black_elo = btoi::btoi(value.as_bytes()).ok();
            }
        } else if key == b"TimeControl" {
            self.game.time_control = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"ECO" {
            self.game.eco = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Round" {
            self.game.round = Some(value.decode_utf8_lossy().into_owned());
        } else if key == b"Date" || key == b"UTCDate" {
            self.game.date = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"UTCTime" {
            self.game.time = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"Site" {
            self.game.site_name = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"Event" {
            self.game.event_name = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"Result" {
            self.game.result = Some(String::from_utf8_lossy(value.as_bytes()).to_string());
        } else if key == b"FEN" {
            if value.as_bytes() == b"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" {
                self.game.fen = None;
            } else {
                let fen = Fen::from_ascii(value.as_bytes());
                if let Ok(fen) = fen {
                    self.game.fen = Some(value.decode_utf8_lossy().into_owned());
                    let setup = fen.into_setup();
                    let castling_mode = CastlingMode::detect(&setup);
                    if let Ok(setup) = Chess::from_setup(setup, castling_mode)
                        .or_else(PositionError::ignore_too_much_material)
                    {
                        self.game.position = setup;
                    } else {
                        self.skip = true;
                    }
                } else {
                    self.skip = true;
                }
            }
        }
    }

    fn end_headers(&mut self) -> Skip {
        // Skip games with timestamp before
        let cur_timestamp = self.game.date.as_ref().and_then(|date| {
            let date = NaiveDate::parse_from_str(date, "%Y.%m.%d").ok()?;
            let time = self
                .game
                .time
                .as_ref()
                .and_then(|time| NaiveTime::parse_from_str(time, "%H:%M:%S").ok())?;
            Some(date.and_time(time).and_utc().timestamp())
        });

        if let (Some(cur_timestamp), Some(timestamp)) = (cur_timestamp, self.timestamp) {
            if cur_timestamp <= timestamp {
                self.skip = true;
            }
        }

        // Skip games without ELO
        // self.skip |= self.current.white_elo.is_none() || self.current.black_elo.is_none();

        self.frames.clear();
        self.frames
            .push(ImportFrame::new(self.game.position.clone()));

        Skip(self.skip)
    }

    fn san(&mut self, san: SanPlus) {
        if self.frames.is_empty() {
            self.frames
                .push(ImportFrame::new(self.game.position.clone()));
        }

        let is_mainline = self.frames.len() == 1;
        let frame = self.frames.last_mut().unwrap();
        let pre_move_position = frame.position.clone();

        let m = san.san.to_move(&frame.position).ok();
        if let Some(m) = m {
            let encoded = match encode_move(&m, &frame.position) {
                Ok(byte) => byte,
                Err(_) => {
                    self.skip = true;
                    return;
                }
            };

            if is_mainline && m.is_promotion() {
                let cur_material = get_material_count(frame.position.board());
                if cur_material.white < self.game.material_count.white {
                    self.game.material_count.white = cur_material.white;
                }
                if cur_material.black < self.game.material_count.black {
                    self.game.material_count.black = cur_material.black;
                }
            }
            self.game.moves.push(encoded);
            frame.pre_move_positions.push(pre_move_position);
            frame.position.play_unchecked(&m);

            if is_mainline {
                self.game.position = frame.position.clone();
            }
        } else {
            self.skip = true;
        }
    }

    fn begin_variation(&mut self) -> Skip {
        if self.frames.is_empty() {
            self.frames
                .push(ImportFrame::new(self.game.position.clone()));
        }

        let parent = self.frames.last().unwrap();
        let variation_start = parent
            .pre_move_positions
            .last()
            .cloned()
            .unwrap_or_else(|| parent.position.clone());

        self.game.moves.push(VARIATION_START_MARKER);
        self.frames.push(ImportFrame::new(variation_start));
        Skip(false)
    }

    fn end_variation(&mut self) {
        self.game.moves.push(VARIATION_END_MARKER);
        if self.frames.len() > 1 {
            self.frames.pop();
        } else {
            self.skip = true;
        }

        if let Some(root) = self.frames.first() {
            self.game.position = root.position.clone();
        }
    }

    fn comment(&mut self, comment: pgn_reader::RawComment<'_>) {
        let comment = String::from_utf8_lossy(comment.as_bytes());
        encode_comment(comment.as_ref(), &mut self.game.moves);
    }

    fn nag(&mut self, nag: Nag) {
        encode_nag(&nag.to_string(), &mut self.game.moves);
    }

    fn end_game(&mut self) -> Self::Result {
        self.frames.clear();
        if self.skip {
            self.game = TempGame::default();
            None
        } else {
            Some(std::mem::take(&mut self.game))
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn convert_pgn(
    files: Vec<FileWorkspaceHandle>,
    database: DatabaseHandle,
    timestamp: Option<i32>,
    app: tauri::AppHandle,
    title: String,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_path = resolve_database(&state, &database, PathOperation::DatabaseCreate)?;

    if files.is_empty() {
        return Ok(());
    }

    let description = description.unwrap_or_default();
    let write_lease = state.database_repository.write_lease(&db_path)?;
    let _write_guard = write_lease.lock()?;

    let mut database_connection = state
        .database_repository
        .initialization_connection(&db_path)?;
    let db = &mut *database_connection;
    let database_was_created = migrations::prepare_database(db, &title, &description)?;
    state.database_repository.mark_schema_validated(&db_path)?;

    // start counting time
    let start = Instant::now();

    let mut imported_games = 0usize;

    for file_handle in files {
        let (file, current_file_name) = {
            let mut authority = state
                .pgn_path_authority
                .lock()
                .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
            let authority = authority
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
            let display_name = authority.display_name(file_handle.path_ref())?;
            let resolved =
                authority.resolve(file_handle.path_ref(), PathOperation::ReadPgn, &[])?;
            (resolved.into_read_file()?, Some(display_name))
        };
        let extension = current_file_name
            .as_deref()
            .and_then(|name| std::path::Path::new(name).extension())
            .map(std::ffi::OsStr::to_os_string);

        let uncompressed: Box<dyn std::io::Read + Send> =
            if extension.as_deref() == Some("bz2".as_ref()) {
                Box::new(bzip2::read::MultiBzDecoder::new(file))
            } else if extension.as_deref() == Some("zst".as_ref()) {
                Box::new(zstd::Decoder::new(file)?)
            } else {
                Box::new(file)
            };

        let mut importer = Importer::new(timestamp.map(|t| t as i64));
        let mut file_imported_games = 0usize;

        db.transaction::<_, diesel::result::Error, _>(|db| {
            for game in BufferedReader::new(uncompressed)
                .into_iter(&mut importer)
                .flatten()
                .flatten()
            {
                if (imported_games + file_imported_games).is_multiple_of(1000) {
                    let elapsed = start.elapsed().as_millis() as u32;
                    // Best effort: a dropped progress frame must never abort an
                    // import, and this runs on renderer-driven input.
                    let _ = ConvertProgress {
                        imported_games: (imported_games + file_imported_games) as u32,
                        elapsed_ms: elapsed,
                        source_file_name: current_file_name.clone(),
                    }
                    .emit(&app);
                }
                game.insert_to_db(db)?;
                file_imported_games += 1;
            }
            Ok(())
        })?;

        imported_games += file_imported_games;
    }

    if database_was_created {
        create_required_indexes(db)?;
    }

    // get game, player, event and site counts and to the info table
    let game_count: i64 = games::table.count().get_result(db)?;
    let player_count: i64 = players::table.count().get_result(db)?;
    let event_count: i64 = events::table.count().get_result(db)?;
    let site_count: i64 = sites::table.count().get_result(db)?;

    let counts = [
        ("GameCount", game_count),
        ("PlayerCount", player_count),
        ("EventCount", event_count),
        ("SiteCount", site_count),
    ];

    for c in counts.iter() {
        insert_into(info::table)
            .values((info::name.eq(c.0), info::value.eq(c.1.to_string())))
            .on_conflict(info::name)
            .do_update()
            .set(info::value.eq(c.1.to_string()))
            .execute(db)?;
    }
    let _ = ConvertProgress {
        imported_games: imported_games as u32,
        elapsed_ms: start.elapsed().as_millis() as u32,
        source_file_name: None,
    }
    .emit(&app);
    state.database_repository.data_changed(&db_path)?;
    search::invalidate_search_cache(&state, &db_path);

    Ok(())
}

pub fn generate_search_index(
    handle: &DatabaseHandle,
    state: &tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let db_path = resolve_database(state, handle, PathOperation::DatabaseMutate)?;
    let target = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .database_file_target(handle, PathOperation::DatabaseMutate)?;
    state.database_repository.with_write_lock(&db_path, || {
        state.database_repository.with_index_lock(&db_path, || {
            generate_search_index_locked(&db_path, &target, state)
        })
    })
}

#[derive(Queryable)]
struct SearchIndexGameRecord {
    id: i32,
    white_id: i32,
    black_id: i32,
    date: Option<String>,
    result: Option<String>,
    moves: Vec<u8>,
    fen: Option<String>,
    pawn_home: i32,
    white_material: i32,
    black_material: i32,
    white_elo: Option<i32>,
    black_elo: Option<i32>,
}

fn generate_search_index_locked(
    db_path: &Path,
    target: &DatabaseFileTarget,
    state: &tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let mut database_connection = get_db_or_create(state, db_path)?;
    let db = &mut *database_connection;
    let index_leaf = search_index::preferred_sidecar_leaf(&target.leaf);

    info!("Generating search index for {:?}", db_path);
    let start = Instant::now();

    let games: Vec<SearchIndexGameRecord> = games::table
        .select((
            games::id,
            games::white_id,
            games::black_id,
            games::date,
            games::result,
            games::moves,
            games::fen,
            games::pawn_home,
            games::white_material,
            games::black_material,
            games::white_elo,
            games::black_elo,
        ))
        .load(db)?;

    let mut writer = SearchIndex::with_capacity(games.len());
    for game in games {
        let entry = SearchGameEntry::from_game_data(crate::db::search_index::SearchGameData {
            id: game.id,
            white_id: game.white_id,
            black_id: game.black_id,
            date: game.date,
            result: game.result,
            moves: game.moves,
            fen: game.fen,
            pawn_home: game.pawn_home,
            white_material: game.white_material,
            black_material: game.black_material,
            white_elo: game.white_elo,
            black_elo: game.black_elo,
        })?;
        writer.push(entry);
    }
    let source = IndexSource::from_database_identity(
        &state
            .database_repository
            .database_identity_expected(db_path, target.identity)?,
    )?;
    match writer.write_to_at(&target.parent, &index_leaf, source)? {
        AtomicFileOutcome::DurableCommit => {}
        AtomicFileOutcome::CommittedDurabilityUncertain(error) => {
            log::warn!("search index parent sync failed: {error}");
            return Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::SearchIndexReplacement,
            ));
        }
    }
    search::invalidate_search_cache(state, db_path);

    info!("Search index generated in {:?}", start.elapsed());
    Ok(())
}

#[derive(Serialize, Type)]
pub struct DatabaseInfo {
    title: String,
    description: String,
    player_count: i32,
    event_count: i32,
    game_count: i32,
    storage_size: u64,
    filename: String,
    indexed: bool,
}

#[derive(QueryableByName, Debug, Serialize)]
struct IndexInfo {
    #[diesel(sql_type = Text, column_name = "name")]
    _name: String,
}

#[derive(QueryableByName)]
struct IndexListInfo {
    #[diesel(sql_type = Text)]
    name: String,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    unique_value: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    partial: i32,
}

#[derive(QueryableByName)]
struct IndexSqlInfo {
    #[diesel(sql_type = Text)]
    sql: String,
}

const REQUIRED_GAME_INDEXES: [(&str, &str); 7] = [
    ("games_date_idx", "Date"),
    ("games_white_idx", "WhiteID"),
    ("games_black_idx", "BlackID"),
    ("games_result_idx", "Result"),
    ("games_white_elo_idx", "WhiteElo"),
    ("games_black_elo_idx", "BlackElo"),
    ("games_plycount_idx", "PlyCount"),
];

fn check_index_exists(conn: &mut SqliteConnection) -> Result<bool, Error> {
    for (index_name, expected_column) in REQUIRED_GAME_INDEXES {
        let definitions: Vec<IndexListInfo> = sql_query(
            "SELECT name, \"unique\" AS unique_value, partial
             FROM pragma_index_list('Games') WHERE name = ?",
        )
        .bind::<Text, _>(index_name)
        .load(conn)?;
        if definitions.len() != 1
            || definitions[0].name != index_name
            || definitions[0].unique_value != 0
            || definitions[0].partial != 0
        {
            return Ok(false);
        }
        let indexes: Vec<IndexInfo> = sql_query("SELECT name FROM pragma_index_info(?)")
            .bind::<Text, _>(index_name)
            .load(conn)?;
        if indexes.len() != 1 || indexes[0]._name != expected_column {
            return Ok(false);
        }
        let stored: IndexSqlInfo = sql_query(
            "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ? AND tbl_name = 'Games'",
        )
        .bind::<Text, _>(index_name)
        .get_result(conn)?;
        let normalize = |sql: &str| {
            sql.chars()
                .filter(|character| !character.is_whitespace())
                .collect::<String>()
                .to_ascii_uppercase()
        };
        if normalize(&stored.sql)
            != format!("CREATEINDEX{index_name}ONGAMES({expected_column})").to_ascii_uppercase()
        {
            return Ok(false);
        }
    }
    Ok(true)
}

fn create_required_indexes(conn: &mut SqliteConnection) -> Result<(), Error> {
    conn.transaction::<_, Error, _>(|conn| {
        // Rebuilding the named contract inside one transaction repairs a
        // same-name but semantically wrong/partial/collated index as well as
        // a missing one. Readers observe either the former set or the full
        // canonical set, never a partial repair.
        conn.batch_execute(DELETE_INDEXES_SQL)?;
        conn.batch_execute(INDEXES_SQL)?;
        if !check_index_exists(conn)? {
            return Err(Error::InvalidInput(
                "Required Games indexes were not created with their expected definitions".into(),
            ));
        }
        Ok(())
    })
}

fn drop_required_indexes(conn: &mut SqliteConnection) -> Result<(), Error> {
    conn.transaction::<_, Error, _>(|conn| {
        conn.batch_execute(DELETE_INDEXES_SQL)?;
        if check_index_exists(conn)? {
            return Err(Error::InvalidInput(
                "Required Games indexes remain after deletion".into(),
            ));
        }
        Ok(())
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_db_info(
    file: DatabaseHandle,
    state: tauri::State<'_, AppState>,
) -> Result<DatabaseInfo, Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;

    info!("get_db_info {:?}", file);

    let path = file;

    let mut database_connection = get_db_or_create(&state, &path)?;
    let db = &mut *database_connection;

    let info_records: Vec<Info> = info::table.load(db)?;

    let get_info_value = |key: &str| -> Option<String> {
        info_records
            .iter()
            .find(|i| i.name == key)
            .and_then(|i| i.value.clone())
    };

    let title = get_info_value("Title").unwrap_or_else(|| "Untitled".to_string());
    let description = get_info_value("Description").unwrap_or_default();
    let player_count = get_info_value("PlayerCount")
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0);
    let game_count = get_info_value("GameCount")
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0);
    let event_count = get_info_value("EventCount")
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0);

    let storage_size = path.metadata()?.len();
    let filename = path
        .file_name()
        .ok_or_else(|| Error::InvalidInput("Database path has no filename".into()))?
        .to_string_lossy();

    let is_indexed = check_index_exists(db)?;
    Ok(DatabaseInfo {
        title,
        description,
        player_count,
        game_count,
        event_count,
        storage_size,
        filename: filename.to_string(),
        indexed: is_indexed,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn create_indexes(
    file: DatabaseHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;

    state.database_repository.with_index_lock(&file, || {
        let mut database_connection = get_db_or_create(&state, &file)?;
        let db = &mut *database_connection;
        create_required_indexes(db)
    })
}

#[tauri::command]
#[specta::specta]
pub async fn delete_indexes(
    file: DatabaseHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;
    state.database_repository.with_index_lock(&file, || {
        let mut database_connection = get_db_or_create(&state, &file)?;
        let db = &mut *database_connection;
        drop_required_indexes(db)
    })
}

#[tauri::command]
#[specta::specta]
pub async fn edit_db_info(
    file: DatabaseHandle,
    title: Option<String>,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;

    state.database_repository.with_write_lock(&file, || {
        let mut database_connection = get_db_or_create(&state, &file)?;
        let db = &mut *database_connection;
        if let Some(title) = title {
            diesel::insert_into(info::table)
                .values((info::name.eq("Title"), info::value.eq(title.clone())))
                .on_conflict(info::name)
                .do_update()
                .set(info::value.eq(title))
                .execute(db)?;
        }

        if let Some(description) = description {
            diesel::insert_into(info::table)
                .values((
                    info::name.eq("Description"),
                    info::value.eq(description.clone()),
                ))
                .on_conflict(info::name)
                .do_update()
                .set(info::value.eq(description))
                .execute(db)?;
        }
        Ok(())
    })?;
    state.database_repository.data_changed(&file)?;
    search::invalidate_search_cache(&state, &file);
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Type)]
pub enum Sides {
    BlackWhite,
    WhiteBlack,
    Any,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Type)]
pub enum GameSort {
    #[default]
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "date")]
    Date,
    #[serde(rename = "whiteElo")]
    WhiteElo,
    #[serde(rename = "blackElo")]
    BlackElo,
    #[serde(rename = "ply_count")]
    PlyCount,
}

#[derive(Default, Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Type)]
pub enum SortDirection {
    #[serde(rename = "asc")]
    Asc,
    #[default]
    #[serde(rename = "desc")]
    Desc,
}

#[derive(Default, Debug, Clone, Deserialize, PartialEq, Eq, Hash, Type)]
#[serde(rename_all = "camelCase")]
pub struct QueryOptions<SortT> {
    pub skip_count: bool,
    #[specta(optional)]
    pub page: Option<i32>,
    #[specta(optional)]
    pub page_size: Option<i32>,
    pub sort: SortT,
    pub direction: SortDirection,
}

const MAX_PAGE_SIZE: i32 = 1000;

fn pagination_limit_offset(
    page: Option<i32>,
    page_size: Option<i32>,
) -> Result<(Option<i64>, Option<i64>), Error> {
    if let Some(page_size) = page_size {
        if !(1..=MAX_PAGE_SIZE).contains(&page_size) {
            return Err(Error::InvalidInput(format!(
                "page size must be between 1 and {MAX_PAGE_SIZE}"
            )));
        }
    }

    if let Some(page) = page {
        if page < 1 {
            return Err(Error::InvalidInput("page must be at least 1".into()));
        }
    }

    let limit = page_size.map(i64::from);
    let offset = page.map(|page| (i64::from(page) - 1) * page_size.map(i64::from).unwrap_or(10));

    Ok((limit, offset))
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq, Hash, Type)]
pub struct GameQuery {
    #[specta(optional)]
    pub options: Option<QueryOptions<GameSort>>,
    #[specta(optional)]
    pub player1: Option<i32>,
    #[specta(optional)]
    pub player2: Option<i32>,
    #[specta(optional)]
    pub tournament_id: Option<i32>,
    #[specta(optional)]
    pub start_date: Option<String>,
    #[specta(optional)]
    pub end_date: Option<String>,
    #[specta(optional)]
    pub range1: Option<(i32, i32)>,
    #[specta(optional)]
    pub range2: Option<(i32, i32)>,
    #[specta(optional)]
    pub sides: Option<Sides>,
    #[specta(optional)]
    pub outcome: Option<String>,
    #[specta(optional)]
    pub position: Option<PositionQueryJs>,
    #[specta(optional)]
    pub wanted_result: Option<String>,
}

impl GameQuery {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn position(mut self, position: PositionQueryJs) -> Self {
        self.position = Some(position);
        self
    }
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct QueryResponse<T> {
    pub data: T,
    pub count: Option<i32>,
}

#[tauri::command]
#[specta::specta]
pub async fn get_games(
    file: DatabaseHandle,
    query: GameQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<NormalizedGame>>, Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;

    let mut database_connection = get_db_or_create(&state, &file)?;
    let db = &mut *database_connection;

    let mut count: Option<i64> = None;
    let query_options = query.options.unwrap_or_default();

    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    let mut sql_query = games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .into_boxed();
    let mut count_query = games::table.into_boxed();

    // if let Some(speed) = query.speed {
    //     sql_query = sql_query.filter(games::speed.eq(speed as i32));
    //     count_query = count_query.filter(games::speed.eq(speed as i32));
    // }

    if let Some(outcome) = query.outcome {
        sql_query = sql_query.filter(games::result.eq(outcome.clone()));
        count_query = count_query.filter(games::result.eq(outcome));
    }

    if let Some(start_date) = query.start_date {
        sql_query = sql_query.filter(games::date.ge(start_date.clone()));
        count_query = count_query.filter(games::date.ge(start_date));
    }

    if let Some(end_date) = query.end_date {
        sql_query = sql_query.filter(games::date.le(end_date.clone()));
        count_query = count_query.filter(games::date.le(end_date));
    }

    if let Some(tournament_id) = query.tournament_id {
        sql_query = sql_query.filter(games::event_id.eq(tournament_id));
        count_query = count_query.filter(games::event_id.eq(tournament_id));
    }

    let (limit, offset) = pagination_limit_offset(query_options.page, query_options.page_size)?;
    if let Some(limit) = limit {
        sql_query = sql_query.limit(limit);
    }

    if let Some(offset) = offset {
        sql_query = sql_query.offset(offset);
    }

    match query.sides {
        Some(Sides::BlackWhite) => {
            if let Some(player1) = query.player1 {
                sql_query = sql_query.filter(games::black_id.eq(player1));
                count_query = count_query.filter(games::black_id.eq(player1));
            }
            if let Some(player2) = query.player2 {
                sql_query = sql_query.filter(games::white_id.eq(player2));
                count_query = count_query.filter(games::white_id.eq(player2));
            }

            if let Some(range1) = query.range1 {
                sql_query = sql_query.filter(games::black_elo.between(range1.0, range1.1));
                count_query = count_query.filter(games::black_elo.between(range1.0, range1.1));
            }

            if let Some(range2) = query.range2 {
                sql_query = sql_query.filter(games::white_elo.between(range2.0, range2.1));
                count_query = count_query.filter(games::white_elo.between(range2.0, range2.1));
            }
        }
        Some(Sides::WhiteBlack) => {
            if let Some(player1) = query.player1 {
                sql_query = sql_query.filter(games::white_id.eq(player1));
                count_query = count_query.filter(games::white_id.eq(player1));
            }
            if let Some(player2) = query.player2 {
                sql_query = sql_query.filter(games::black_id.eq(player2));
                count_query = count_query.filter(games::black_id.eq(player2));
            }

            if let Some(range1) = query.range1 {
                sql_query = sql_query.filter(games::white_elo.between(range1.0, range1.1));
                count_query = count_query.filter(games::white_elo.between(range1.0, range1.1));
            }

            if let Some(range2) = query.range2 {
                sql_query = sql_query.filter(games::black_elo.between(range2.0, range2.1));
                count_query = count_query.filter(games::black_elo.between(range2.0, range2.1));
            }
        }
        Some(Sides::Any) => {
            if let Some(player1) = query.player1 {
                sql_query =
                    sql_query.filter(games::white_id.eq(player1).or(games::black_id.eq(player1)));
                count_query =
                    count_query.filter(games::white_id.eq(player1).or(games::black_id.eq(player1)));
            }
            if let Some(player2) = query.player2 {
                sql_query =
                    sql_query.filter(games::white_id.eq(player2).or(games::black_id.eq(player2)));
                count_query =
                    count_query.filter(games::white_id.eq(player2).or(games::black_id.eq(player2)));
            }

            if let (Some(range1), Some(range2)) = (query.range1, query.range2) {
                sql_query = sql_query.filter(
                    games::white_elo
                        .between(range1.0, range1.1)
                        .or(games::black_elo.between(range1.0, range1.1))
                        .or(games::white_elo
                            .between(range2.0, range2.1)
                            .or(games::black_elo.between(range2.0, range2.1))),
                );
                count_query = count_query.filter(
                    games::white_elo
                        .between(range1.0, range1.1)
                        .or(games::black_elo.between(range1.0, range1.1))
                        .or(games::white_elo
                            .between(range2.0, range2.1)
                            .or(games::black_elo.between(range2.0, range2.1))),
                );
            } else {
                if let Some(range1) = query.range1 {
                    sql_query = sql_query.filter(
                        games::white_elo
                            .between(range1.0, range1.1)
                            .or(games::black_elo.between(range1.0, range1.1)),
                    );
                    count_query = count_query.filter(
                        games::white_elo
                            .between(range1.0, range1.1)
                            .or(games::black_elo.between(range1.0, range1.1)),
                    );
                }

                if let Some(range2) = query.range2 {
                    sql_query = sql_query.filter(
                        games::white_elo
                            .between(range2.0, range2.1)
                            .or(games::black_elo.between(range2.0, range2.1)),
                    );
                    count_query = count_query.filter(
                        games::white_elo
                            .between(range2.0, range2.1)
                            .or(games::black_elo.between(range2.0, range2.1)),
                    );
                }
            }
        }
        None => {}
    }

    sql_query = match query_options.sort {
        GameSort::Id => match query_options.direction {
            SortDirection::Asc => sql_query.order(games::id.asc()),
            SortDirection::Desc => sql_query.order(games::id.desc()),
        },
        GameSort::Date => match query_options.direction {
            SortDirection::Asc => sql_query.order((games::date.asc(), games::time.asc())),
            SortDirection::Desc => sql_query.order((games::date.desc(), games::time.desc())),
        },
        GameSort::WhiteElo => match query_options.direction {
            SortDirection::Asc => sql_query.order(games::white_elo.asc()),
            SortDirection::Desc => sql_query.order(games::white_elo.desc()),
        },
        GameSort::BlackElo => match query_options.direction {
            SortDirection::Asc => sql_query.order(games::black_elo.asc()),
            SortDirection::Desc => sql_query.order(games::black_elo.desc()),
        },
        GameSort::PlyCount => match query_options.direction {
            SortDirection::Asc => sql_query.order(games::ply_count.asc()),
            SortDirection::Desc => sql_query.order(games::ply_count.desc()),
        },
    };

    if !query_options.skip_count {
        count = Some(
            count_query
                .select(diesel::dsl::count(games::id))
                .first(db)?,
        );
    }

    // println!(
    //     "{:?}\n",
    //     diesel::debug_query::<diesel::sqlite::Sqlite, _>(&sql_query)
    // );

    let games: Vec<(Game, Player, Player, Event, Site)> = sql_query.load(db)?;
    let normalized_games = normalize_games(games)?;

    Ok(QueryResponse {
        data: normalized_games,
        count: count.map(|c| c as i32),
    })
}

fn get_latest_game_timestamp_in_db(db: &mut SqliteConnection) -> Result<Option<i64>, Error> {
    let timestamps = games::table
        .select((games::date, games::time))
        .filter(games::date.is_not_null())
        .filter(games::time.is_not_null())
        .load::<(Option<String>, Option<String>)>(db)?;

    Ok(timestamps
        .into_iter()
        .filter_map(|(date, time)| {
            let date = NaiveDate::parse_from_str(date?.as_str(), "%Y.%m.%d").ok()?;
            let time = NaiveTime::parse_from_str(time?.as_str(), "%H:%M:%S").ok()?;
            Some(date.and_time(time).and_utc().timestamp_millis())
        })
        .max())
}

#[tauri::command]
#[specta::specta]
pub async fn get_latest_game_timestamp(
    file: DatabaseHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<f64>, Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;

    let mut database_connection = get_db_or_create(&state, &file)?;
    let db = &mut *database_connection;
    Ok(get_latest_game_timestamp_in_db(db)?.map(|timestamp| timestamp as f64))
}

fn normalize_games(
    games: Vec<(Game, Player, Player, Event, Site)>,
) -> Result<Vec<NormalizedGame>, Error> {
    games
        .into_iter()
        .map(|(game, white, black, event, site)| {
            let fen: Fen = game
                .fen
                .map(|f| {
                    Fen::from_ascii(f.as_bytes()).map_err(|error| {
                        Error::InvalidInput(format!("game {} has invalid FEN: {error}", game.id))
                    })
                })
                .transpose()?
                .unwrap_or_default();
            let game_result = game.result.clone().unwrap_or_default();
            let result_token = if game_result.is_empty() {
                "*".to_string()
            } else {
                game_result.clone()
            };

            Ok(NormalizedGame {
                id: game.id,
                event: event.name.unwrap_or_default(),
                event_id: event.id,
                site: site.name.unwrap_or_default(),
                site_id: site.id,
                date: game.date,
                time: game.time,
                round: game.round,
                white: white.name.unwrap_or_default(),
                white_id: game.white_id,
                white_elo: game.white_elo,
                black: black.name.unwrap_or_default(),
                black_id: game.black_id,
                black_elo: game.black_elo,
                result: Outcome::from_str(&game_result).unwrap_or_default(),
                time_control: game.time_control,
                eco: game.eco,
                ply_count: game.ply_count,
                fen: fen.to_string(),
                moves: {
                    let movetext = decode_game_to_movetext(&game.moves, fen)?;
                    if movetext.is_empty() {
                        result_token
                    } else {
                        format!("{} {}", movetext, result_token)
                    }
                },
            })
        })
        .collect()
}

#[derive(Debug, Clone, Deserialize, Type)]
pub struct PlayerQuery {
    pub options: QueryOptions<PlayerSort>,
    #[specta(optional)]
    pub name: Option<String>,
    #[specta(optional)]
    pub range: Option<(i32, i32)>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum PlayerSort {
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "name")]
    Name,
    #[serde(rename = "elo")]
    Elo,
}

#[tauri::command]
#[specta::specta]
pub async fn get_player(
    file: DatabaseHandle,
    id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Option<Player>, Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;

    let mut database_connection = get_db_or_create(&state, &file)?;
    let db = &mut *database_connection;
    let player = players::table
        .filter(players::id.eq(id))
        .first::<Player>(db)
        .optional()?;
    Ok(player)
}

#[tauri::command]
#[specta::specta]
pub async fn get_players(
    file: DatabaseHandle,
    query: PlayerQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<Player>>, Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;

    let mut database_connection = get_db_or_create(&state, &file)?;
    let db = &mut *database_connection;
    let mut count: Option<i64> = None;

    let mut sql_query = players::table.into_boxed();
    let mut count_query = players::table.into_boxed();
    sql_query = sql_query.filter(players::name.is_not("Unknown"));
    count_query = count_query.filter(players::name.is_not("Unknown"));

    if let Some(name) = query.name {
        sql_query = sql_query.filter(players::name.like(format!("%{}%", name)));
        count_query = count_query.filter(players::name.like(format!("%{}%", name)));
    }

    if let Some(range) = query.range {
        sql_query = sql_query.filter(players::elo.between(range.0, range.1));
        count_query = count_query.filter(players::elo.between(range.0, range.1));
    }

    if !query.options.skip_count {
        count = Some(count_query.count().get_result(db)?);
    }

    let (limit, offset) = pagination_limit_offset(query.options.page, query.options.page_size)?;
    if let Some(limit) = limit {
        sql_query = sql_query.limit(limit);
    }

    if let Some(offset) = offset {
        sql_query = sql_query.offset(offset);
    }

    sql_query = match query.options.sort {
        PlayerSort::Id => match query.options.direction {
            SortDirection::Asc => sql_query.order(players::id.asc()),
            SortDirection::Desc => sql_query.order(players::id.desc()),
        },
        PlayerSort::Name => match query.options.direction {
            SortDirection::Asc => sql_query.order(players::name.asc()),
            SortDirection::Desc => sql_query.order(players::name.desc()),
        },
        PlayerSort::Elo => match query.options.direction {
            SortDirection::Asc => sql_query.order(players::elo.asc()),
            SortDirection::Desc => sql_query.order(players::elo.desc()),
        },
    };

    let players = sql_query.load::<Player>(db)?;

    Ok(QueryResponse {
        data: players,
        count: count.map(|c| c as i32),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum TournamentSort {
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "name")]
    Name,
}

#[derive(Debug, Clone, Deserialize, Type)]
pub struct TournamentQuery {
    pub options: QueryOptions<TournamentSort>,
    pub name: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn get_tournaments(
    file: DatabaseHandle,
    query: TournamentQuery,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResponse<Vec<Event>>, Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;

    let mut database_connection = get_db_or_create(&state, &file)?;
    let db = &mut *database_connection;
    let mut count: Option<i64> = None;

    let mut sql_query = events::table.into_boxed();
    let mut count_query = events::table.into_boxed();
    sql_query = sql_query.filter(events::name.is_not("Unknown").and(events::name.is_not("")));
    count_query = count_query.filter(events::name.is_not("Unknown").and(events::name.is_not("")));

    if let Some(name) = query.name {
        sql_query = sql_query.filter(events::name.like(format!("%{}%", name)));
        count_query = count_query.filter(events::name.like(format!("%{}%", name)));
    }

    if !query.options.skip_count {
        count = Some(count_query.count().get_result(db)?);
    }

    let (limit, offset) = pagination_limit_offset(query.options.page, query.options.page_size)?;
    if let Some(limit) = limit {
        sql_query = sql_query.limit(limit);
    }

    if let Some(offset) = offset {
        sql_query = sql_query.offset(offset);
    }

    sql_query = match query.options.sort {
        TournamentSort::Id => match query.options.direction {
            SortDirection::Asc => sql_query.order(events::id.asc()),
            SortDirection::Desc => sql_query.order(events::id.desc()),
        },
        TournamentSort::Name => match query.options.direction {
            SortDirection::Asc => sql_query.order(events::name.asc()),
            SortDirection::Desc => sql_query.order(events::name.desc()),
        },
    };

    let events = sql_query.load::<Event>(db)?;

    Ok(QueryResponse {
        data: events,
        count: count.map(|c| c as i32),
    })
}

#[derive(Debug, Clone, Serialize, Type, Default)]
pub struct PlayerGameInfo {
    pub site_stats_data: Vec<SiteStatsData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
#[repr(u8)] // Ensure minimal memory usage (as u8)
pub enum GameOutcome {
    #[default]
    Won = 0,
    Drawn = 1,
    Lost = 2,
}

impl GameOutcome {
    pub fn from_str(result_str: &str, is_white: bool) -> Option<Self> {
        match result_str {
            "1-0" => Some(if is_white {
                GameOutcome::Won
            } else {
                GameOutcome::Lost
            }),
            "1/2-1/2" => Some(GameOutcome::Drawn),
            "0-1" => Some(if is_white {
                GameOutcome::Lost
            } else {
                GameOutcome::Won
            }),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Type, Default)]
pub struct SiteStatsData {
    pub site: String,
    pub player: String,
    pub data: Vec<StatsData>,
}

#[derive(Debug, Clone, Serialize, Type, Default)]
pub struct StatsData {
    pub date: String,
    pub is_player_white: bool,
    pub player_elo: i32,
    pub result: GameOutcome,
    pub time_control: String,
    pub opening: String,
}

#[derive(Serialize, Debug, Clone, Type, tauri_specta::Event)]
pub struct DatabaseProgress {
    pub id: String,
    pub progress: f64,
}

/// Import progress for a PGN-to-database conversion. A conversion has no total
/// to divide by until it finishes, so this reports the counters the UI shows
/// rather than a percentage.
#[derive(Serialize, Debug, Clone, Type, tauri_specta::Event)]
pub struct ConvertProgress {
    pub imported_games: u32,
    pub elapsed_ms: u32,
    pub source_file_name: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub async fn get_players_game_info(
    file: DatabaseHandle,
    id: i32,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<PlayerGameInfo, Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseRead)?;

    let mut database_connection = get_db_or_create(&state, &file)?;
    let db = &mut *database_connection;
    let timer = Instant::now();

    let sql_query = games::table
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .inner_join(players::table.on(players::id.eq(id)))
        .select((
            games::white_id,
            games::black_id,
            games::result,
            games::date,
            games::moves,
            games::white_elo,
            games::black_elo,
            games::time_control,
            sites::name,
            players::name,
        ))
        .filter(games::white_id.eq(id).or(games::black_id.eq(id)))
        .filter(games::fen.is_null());

    type GameInfo = (
        i32,
        i32,
        Option<String>,
        Option<String>,
        Vec<u8>,
        Option<i32>,
        Option<i32>,
        Option<String>,
        Option<String>,
        Option<String>,
    );
    let info: Vec<GameInfo> = sql_query.load(db)?;

    let mut game_info = PlayerGameInfo::default();
    let progress = AtomicUsize::new(0);
    game_info.site_stats_data = info
        .par_iter()
        .filter_map(
            |(
                white_id,
                black_id,
                outcome,
                date,
                moves,
                white_elo,
                black_elo,
                time_control,
                site,
                player,
            )| {
                let is_white = *white_id == id;
                let is_black = *black_id == id;
                let result = GameOutcome::from_str(outcome.as_deref()?, is_white);

                if !is_white && !is_black
                    || is_white && white_elo.is_none()
                    || is_black && black_elo.is_none()
                    || result.is_none()
                    || date.is_none()
                    || site.is_none()
                    || player.is_none()
                {
                    return None;
                }

                let site = site.as_deref().map(|s| {
                    if s.starts_with("https://lichess.org/") {
                        "Lichess".to_string()
                    } else {
                        s.to_string()
                    }
                })?;

                let mut setups = vec![];
                let mut chess = Chess::default();
                for (i, byte) in iter_mainline_move_bytes(moves).enumerate() {
                    if i > 54 {
                        // max length of opening in data
                        break;
                    }
                    let Some(m) = decode_move(byte, &chess) else {
                        break;
                    };
                    chess.play_unchecked(&m);
                    setups.push(chess.clone().into_setup(EnPassantMode::Legal));
                }

                setups.reverse();
                let opening = setups
                    .iter()
                    .find_map(|setup| get_opening_from_setup(setup.clone()).ok())
                    .unwrap_or_default();

                let p = progress.fetch_add(1, Ordering::Relaxed);
                if p.is_multiple_of(1000) || p == info.len() - 1 {
                    let _ = DatabaseProgress {
                        id: id.to_string(),
                        progress: (p as f64 / info.len() as f64) * 100_f64,
                    }
                    .emit(&app);
                }

                Some(SiteStatsData {
                    site: site.clone(),
                    player: player.clone().unwrap(),
                    data: vec![StatsData {
                        date: date.clone().unwrap(),
                        is_player_white: is_white,
                        player_elo: if is_white {
                            white_elo.unwrap()
                        } else {
                            black_elo.unwrap()
                        },
                        result: result.unwrap(),
                        time_control: time_control.clone().unwrap_or_default(),
                        opening,
                    }],
                })
            },
        )
        .fold(DashMap::new, |acc, data| {
            acc.entry((data.site.clone(), data.player.clone()))
                .or_insert_with(Vec::new)
                .extend(data.data);
            acc
        })
        .reduce(DashMap::new, |acc1, acc2| {
            for ((site, player), data) in acc2 {
                acc1.entry((site, player))
                    .or_insert_with(Vec::new)
                    .extend(data);
            }
            acc1
        })
        .into_iter()
        .map(|((site, player), data)| SiteStatsData { site, player, data })
        .collect();

    println!("get_players_game_info {:?}: {:?}", file, timer.elapsed());

    Ok(game_info)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_database(
    file: DatabaseHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let handle = file.clone();
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;
    let target = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .database_file_target(&handle, PathOperation::DatabaseMutate)?;
    let expected_source = IndexSource::from_database_identity(
        &state
            .database_repository
            .database_identity_expected(&file, target.identity)?,
    )?;
    let mut primary_gone = false;
    let mut unlinked = 0;
    let unlink_result = state.database_repository.delete_exclusive(&file, || {
        unlinked = unlink_database_files(&target, &expected_source)?;
        primary_gone = true;
        Ok(())
    });
    if let Err(error) = unlink_result {
        return finish_database_deletion(primary_gone, unlinked, Err(error));
    }

    search::invalidate_search_cache(&state, &file);
    let registry_result = (|| {
        state
            .pgn_path_authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
            .remove_database(&handle)
    })();
    finish_database_deletion(primary_gone, unlinked, registry_result)
}

fn finish_database_deletion(
    primary_gone: bool,
    unlinked: usize,
    tail: Result<(), Error>,
) -> Result<(), Error> {
    match tail {
        Ok(()) => Ok(()),
        Err(error) if !primary_gone => Err(error),
        Err(error @ Error::CommittedDurabilityUncertain(_)) => Err(error),
        Err(error) => Err(Error::PartialRemoval {
            removed_entries: unlinked,
            cause: Box::new(error),
        }),
    }
}

#[cfg(unix)]
fn unlink_database_files(
    target: &DatabaseFileTarget,
    expected_source: &IndexSource,
) -> Result<usize, Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType};

    fn existed_as_regular(parent: &File, leaf: &OsStr) -> bool {
        rfs::statat(parent, leaf, AtFlags::SYMLINK_NOFOLLOW)
            .is_ok_and(|stat| FileType::from_raw_mode(stat.st_mode) == FileType::RegularFile)
    }

    let preferred_leaf = search_index::preferred_sidecar_leaf(&target.leaf);
    let legacy_leaf = search_index::legacy_sidecar_leaf(&target.leaf);
    let mut unlinked = 0;

    let preferred_existed = existed_as_regular(&target.parent, &preferred_leaf);
    remove_optional_regular_at(&target.parent, &preferred_leaf)?;
    unlinked += usize::from(preferred_existed);

    if legacy_leaf != preferred_leaf
        && legacy_sidecar_matches(&target.parent, &legacy_leaf, expected_source)?
    {
        let legacy_existed = existed_as_regular(&target.parent, &legacy_leaf);
        remove_optional_regular_at(&target.parent, &legacy_leaf)?;
        unlinked += usize::from(legacy_existed);
    }

    let stat = rfs::statat(&target.parent, &target.leaf, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile
        || (stat.st_dev, stat.st_ino) != target.identity
    {
        return Err(Error::Conflict("database changed before deletion".into()));
    }
    // Same residual POSIX window as delete_puzzle_database: there is no
    // compare-and-unlink. The inode check is the last userspace observation
    // before unlinkat; remove_regular_at would re-stat without the identity.
    rfs::unlinkat(&target.parent, &target.leaf, AtFlags::empty())
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    Ok(unlinked + 1)
}

#[cfg(unix)]
fn legacy_sidecar_matches(
    parent: &File,
    leaf: &OsStr,
    expected_source: &IndexSource,
) -> Result<bool, Error> {
    use rustix::{
        fs::{self as rfs, Mode, OFlags},
        io::Errno,
    };

    let file = match rfs::openat(
        parent,
        leaf,
        OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
        Mode::empty(),
    ) {
        Ok(file) => File::from(file),
        Err(error) if error == Errno::NOENT || error == Errno::LOOP => return Ok(false),
        Err(error) => return Err(Error::Io(Box::new(error.into()))),
    };
    if !file.metadata()?.is_file() {
        return Ok(false);
    }
    Ok(MmapSearchIndex::open_file(file).is_ok_and(|archive| archive.source() == expected_source))
}

fn delete_orphaned_data(db: &mut SqliteConnection) -> Result<(), Error> {
    db.batch_execute(
        "
        DELETE FROM Players WHERE ID != 0 AND ID NOT IN (
            SELECT WhiteID FROM Games UNION SELECT BlackID FROM Games
        );
        DELETE FROM Events WHERE ID != 0 AND ID NOT IN (
            SELECT EventID FROM Games
        );
        DELETE FROM Sites WHERE ID != 0 AND ID NOT IN (
            SELECT SiteID FROM Games
        );
        ",
    )?;

    Ok(())
}

fn maintain_database_metadata(db: &mut SqliteConnection) -> Result<(), Error> {
    delete_orphaned_data(db)?;

    let game_count: i64 = games::table.count().get_result(db)?;
    update_info_count(db, "GameCount", game_count)?;

    let player_count: i64 = players::table.count().get_result(db)?;
    update_info_count(db, "PlayerCount", player_count)?;

    let event_count: i64 = events::table.count().get_result(db)?;
    update_info_count(db, "EventCount", event_count)?;

    let site_count: i64 = sites::table.count().get_result(db)?;
    update_info_count(db, "SiteCount", site_count)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_duplicated_games(
    file: DatabaseHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;

    state.database_repository.with_write_lock(&file, || {
        let mut database_connection = get_db_or_create(&state, &file)?;
        let db = &mut *database_connection;
        db.transaction(delete_duplicated_games_transaction)
    })?;
    state.database_repository.data_changed(&file)?;
    search::invalidate_search_cache(&state, &file);
    Ok(())
}

fn delete_duplicated_games_transaction(db: &mut SqliteConnection) -> Result<(), Error> {
    db.batch_execute(
        "
        DELETE FROM Games
        WHERE ID IN (
            SELECT ID
            FROM (
                SELECT ID,
                    ROW_NUMBER() OVER (PARTITION BY EventID, SiteID, Round, WhiteID, BlackID, Moves, Date, UTCTime ORDER BY ID) AS RowNum
                FROM Games
            ) AS Subquery
            WHERE RowNum > 1
        );
        ",
    )?;

    maintain_database_metadata(db)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_empty_games(
    file: DatabaseHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;

    state.database_repository.with_write_lock(&file, || {
        let mut database_connection = get_db_or_create(&state, &file)?;
        let db = &mut *database_connection;
        db.transaction(delete_empty_games_transaction)
    })?;
    state.database_repository.data_changed(&file)?;
    search::invalidate_search_cache(&state, &file);
    Ok(())
}

fn delete_empty_games_transaction(db: &mut SqliteConnection) -> Result<(), Error> {
    diesel::delete(games::table.filter(games::ply_count.eq(0))).execute(db)?;

    maintain_database_metadata(db)?;

    Ok(())
}

struct PgnGame {
    event: Option<String>,
    site: Option<String>,
    date: Option<String>,
    time: Option<String>,
    round: Option<String>,
    white: Option<String>,
    black: Option<String>,
    result: Option<String>,
    time_control: Option<String>,
    eco: Option<String>,
    white_elo: Option<String>,
    black_elo: Option<String>,
    ply_count: Option<String>,
    fen: Option<String>,
    moves: Option<String>,
}

impl PgnGame {
    fn write(&self, writer: &mut impl Write) -> Result<(), Error> {
        writeln!(
            writer,
            "[Event \"{}\"]",
            self.event.as_deref().unwrap_or("")
        )?;
        writeln!(writer, "[Site \"{}\"]", self.site.as_deref().unwrap_or(""))?;
        writeln!(writer, "[Date \"{}\"]", self.date.as_deref().unwrap_or(""))?;
        if let Some(time) = self.time.as_deref() {
            if !time.is_empty() {
                writeln!(writer, "[UTCTime \"{}\"]", time)?;
            }
        }
        writeln!(
            writer,
            "[Round \"{}\"]",
            self.round.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[White \"{}\"]",
            self.white.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[Black \"{}\"]",
            self.black.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[Result \"{}\"]",
            self.result.as_deref().unwrap_or("*")
        )?;
        if let Some(time_control) = self.time_control.as_deref() {
            writeln!(writer, "[TimeControl \"{}\"]", time_control)?;
        }
        if let Some(eco) = self.eco.as_deref() {
            writeln!(writer, "[ECO \"{}\"]", eco)?;
        }
        if let Some(white_elo) = self.white_elo.as_deref() {
            if white_elo == "0" {
                writeln!(writer, "[WhiteElo \"-\"]")?;
            } else {
                writeln!(writer, "[WhiteElo \"{}\"]", white_elo)?;
            }
        }
        if let Some(black_elo) = self.black_elo.as_deref() {
            if black_elo == "0" {
                writeln!(writer, "[BlackElo \"-\"]")?;
            } else {
                writeln!(writer, "[BlackElo \"{}\"]", black_elo)?;
            }
        }
        if let Some(ply_count) = self.ply_count.as_deref() {
            writeln!(writer, "[PlyCount \"{}\"]", ply_count)?;
        }
        if let Some(fen) = self.fen.as_deref() {
            writeln!(writer, "[SetUp \"1\"]")?;
            writeln!(writer, "[FEN \"{}\"]", fen)?;
        }
        writeln!(writer)?;
        if let Some(moves) = self.moves.as_deref() {
            if !moves.is_empty() {
                write!(writer, "{} ", moves)?;
            }
        }
        match self.result.as_deref() {
            Some("1-0") => writeln!(writer, "1-0"),
            Some("0-1") => writeln!(writer, "0-1"),
            Some("1/2-1/2") => writeln!(writer, "1/2-1/2"),
            _ => writeln!(writer, "*"),
        }?;
        writeln!(writer)?;
        Ok(())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn export_to_pgn(
    file: DatabaseHandle,
    destination: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseExport)?;

    let mut database_connection = get_db_or_create(&state, &file)?;
    let db = &mut *database_connection;

    let mut writer = BufWriter::new(Vec::new());

    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .load_iter::<(Game, Player, Player, Event, Site), DefaultLoadingMode>(db)?
        .flatten()
        .map(|(game, white, black, event, site)| {
            let pgn = PgnGame {
                event: event.name,
                site: site.name,
                date: game.date,
                time: game.time,
                round: game.round,
                white: white.name,
                black: black.name,
                result: game.result,
                time_control: game.time_control,
                eco: game.eco,
                white_elo: game.white_elo.map(|e| e.to_string()),
                black_elo: game.black_elo.map(|e| e.to_string()),
                ply_count: game.ply_count.map(|e| e.to_string()),
                fen: game.fen.clone(),
                moves: decode_game_to_movetext(
                    &game.moves,
                    if let Some(fen) = game.fen {
                        Fen::from_ascii(fen.as_bytes()).unwrap_or_default()
                    } else {
                        Fen::default()
                    },
                )
                .ok(),
            };

            pgn.write(&mut writer)?;

            Ok(())
        })
        .collect::<Result<Vec<_>, Error>>()?;
    let bytes = writer
        .into_inner()
        .map_err(|error| Error::from(error.into_error()))?;
    let resolved = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(destination.path_ref(), PathOperation::WritePgn, &[])?;
    let snapshot = resolved.pgn_snapshot()?;
    let outcome = resolved.replace_pgn_atomic(&snapshot, |_, temporary| {
        temporary.write_all(&bytes).map_err(Error::from)
    })?;
    if let Some(stage) = crate::infra::fs::map_atomic_file_outcome(
        outcome,
        crate::error::DurabilityStage::DatabasePgnReplacement,
        |error| log::warn!("database PGN replacement parent sync failed: {error}"),
    ) {
        Err(Error::CommittedDurabilityUncertain(stage))
    } else {
        Ok(())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn delete_db_game(
    file: DatabaseHandle,
    game_id: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;

    state.database_repository.with_write_lock(&file, || {
        let mut database_connection = get_db_or_create(&state, &file)?;
        let db = &mut *database_connection;
        db.transaction(|db| delete_db_game_transaction(db, game_id))
    })?;
    state.database_repository.data_changed(&file)?;
    search::invalidate_search_cache(&state, &file);
    Ok(())
}

fn delete_db_game_transaction(db: &mut SqliteConnection, game_id: i32) -> Result<(), Error> {
    diesel::delete(games::table.filter(games::id.eq(game_id))).execute(db)?;

    maintain_database_metadata(db)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn write_db_game(
    file: DatabaseHandle,
    game_id: i32,
    pgn: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;

    let mut importer = Importer::new(None);
    let mut parsed = BufferedReader::new(pgn.as_bytes())
        .into_iter(&mut importer)
        .flatten()
        .flatten();
    let temp_game = parsed.next().ok_or(Error::NoMovesFound)?;
    state.database_repository.with_write_lock(&file, || {
        let mut database_connection = get_db_or_create(&state, &file)?;
        let db = &mut *database_connection;
        db.transaction(|db| {
            write_parsed_db_game(db, game_id, &temp_game, maintain_database_metadata)
        })
    })?;
    state.database_repository.data_changed(&file)?;
    search::invalidate_search_cache(&state, &file);
    Ok(())
}

fn write_parsed_db_game(
    db: &mut SqliteConnection,
    game_id: i32,
    temp_game: &TempGame,
    maintain_metadata: fn(&mut SqliteConnection) -> Result<(), Error>,
) -> Result<(), Error> {
    let existing_time = games::table
        .filter(games::id.eq(game_id))
        .select(games::time)
        .first::<Option<String>>(db)
        .optional()?
        .ok_or_else(|| Error::GameNotFound(game_id.to_string()))?;
    let game_time = temp_game.time.clone().or(existing_time);

    let white_id = if let Some(name) = temp_game.white_name.as_deref() {
        create_player(db, name)?.id
    } else {
        0
    };
    let black_id = if let Some(name) = temp_game.black_name.as_deref() {
        create_player(db, name)?.id
    } else {
        0
    };
    let event_id = if let Some(name) = temp_game.event_name.as_deref() {
        create_event(db, name)?.id
    } else {
        0
    };
    let site_id = if let Some(name) = temp_game.site_name.as_deref() {
        create_site(db, name)?.id
    } else {
        0
    };

    let final_material = get_material_count(temp_game.position.board());
    let minimal_white_material = temp_game.material_count.white.min(final_material.white) as i32;
    let minimal_black_material = temp_game.material_count.black.min(final_material.black) as i32;
    let pawn_home = get_pawn_home(temp_game.position.board()) as i32;
    let ply_count = iter_mainline_move_bytes(&temp_game.moves).count() as i32;

    let updated_rows = diesel::update(games::table.filter(games::id.eq(game_id)))
        .set((
            games::event_id.eq(event_id),
            games::site_id.eq(site_id),
            games::date.eq(temp_game.date.clone()),
            games::time.eq(game_time),
            games::round.eq(temp_game.round.clone()),
            games::white_id.eq(white_id),
            games::white_elo.eq(temp_game.white_elo),
            games::black_id.eq(black_id),
            games::black_elo.eq(temp_game.black_elo),
            games::white_material.eq(minimal_white_material),
            games::black_material.eq(minimal_black_material),
            games::result.eq(temp_game.result.clone()),
            games::time_control.eq(temp_game.time_control.clone()),
            games::eco.eq(temp_game.eco.clone()),
            games::ply_count.eq(ply_count),
            games::fen.eq(temp_game.fen.clone()),
            games::moves.eq(temp_game.moves.clone()),
            games::pawn_home.eq(pawn_home),
        ))
        .execute(db)?;

    if updated_rows != 1 {
        return Err(Error::GameNotFound(game_id.to_string()));
    }

    maintain_metadata(db)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn merge_players(
    file: DatabaseHandle,
    player1: i32,
    player2: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let file = resolve_database(&state, &file, PathOperation::DatabaseMutate)?;

    state.database_repository.with_write_lock(&file, || {
        let mut database_connection = get_db_or_create(&state, &file)?;
        let db = &mut *database_connection;
        db.transaction(|db| merge_players_transaction(db, player1, player2))
    })?;
    state.database_repository.data_changed(&file)?;
    search::invalidate_search_cache(&state, &file);
    Ok(())
}

fn merge_players_transaction(
    db: &mut SqliteConnection,
    source_player: i32,
    target_player: i32,
) -> Result<(), Error> {
    if source_player == target_player {
        return Err(Error::InvalidInput(
            "source and target player IDs must be different".into(),
        ));
    }
    if source_player == 0 || target_player == 0 {
        return Err(Error::InvalidInput(
            "the unknown player (ID 0) cannot be merged".into(),
        ));
    }

    let source_exists = players::table
        .find(source_player)
        .select(players::id)
        .first::<i32>(db)
        .optional()?
        .is_some();
    if !source_exists {
        return Err(Error::InvalidInput(format!(
            "source player {source_player} does not exist"
        )));
    }

    let target_exists = players::table
        .find(target_player)
        .select(players::id)
        .first::<i32>(db)
        .optional()?
        .is_some();
    if !target_exists {
        return Err(Error::InvalidInput(format!(
            "target player {target_player} does not exist"
        )));
    }

    // Players that faced each other cannot be merged without changing a game into self-play.
    let count: i64 = games::table
        .filter(
            games::white_id
                .eq(source_player)
                .and(games::black_id.eq(target_player)),
        )
        .or_filter(
            games::white_id
                .eq(target_player)
                .and(games::black_id.eq(source_player)),
        )
        .limit(1)
        .count()
        .get_result(db)?;

    if count > 0 {
        return Err(Error::NotDistinctPlayers);
    }

    diesel::update(games::table.filter(games::white_id.eq(source_player)))
        .set(games::white_id.eq(target_player))
        .execute(db)?;
    diesel::update(games::table.filter(games::black_id.eq(source_player)))
        .set(games::black_id.eq(target_player))
        .execute(db)?;

    let deleted_rows =
        diesel::delete(players::table.filter(players::id.eq(source_player))).execute(db)?;
    if deleted_rows != 1 {
        return Err(Error::InvalidInput(format!(
            "source player {source_player} could not be deleted"
        )));
    }

    maintain_database_metadata(db)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn clear_games(state: tauri::State<'_, AppState>) {
    state.search_cache.clear();
}

#[tauri::command]
#[specta::specta]
pub async fn preload_reference_db(
    file: DatabaseHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    search::preload_search_index(&file, &state).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use pgn_reader::BufferedReader;

    #[test]
    fn finish_database_deletion_preserves_sidecar_only_error() {
        let result = finish_database_deletion(
            false,
            1,
            Err(Error::from(std::io::Error::other("sidecar failure"))),
        );
        let error = result.unwrap_err();
        assert!(matches!(error, Error::Io(_)));
        assert!(!error.to_string().starts_with("Partially removed:"));
    }

    #[test]
    fn finish_database_deletion_wraps_post_primary_failure() {
        let error =
            finish_database_deletion(true, 1, Err(Error::Conflict("x".into()))).unwrap_err();
        assert!(matches!(error, Error::PartialRemoval { .. }));
        assert!(error.to_string().starts_with("Partially removed:"));
    }

    #[test]
    fn finish_database_deletion_preserves_durability_uncertainty() {
        let error = finish_database_deletion(
            true,
            1,
            Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::RegistryReplacement,
            )),
        )
        .unwrap_err();
        assert!(matches!(
            error,
            Error::CommittedDurabilityUncertain(crate::error::DurabilityStage::RegistryReplacement)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn delete_database_stops_at_invalid_preferred_sidecar_before_primary() {
        let dir = tempfile::tempdir().unwrap();
        let database = dir.path().join("ordered.db3");
        std::fs::write(&database, b"database").unwrap();
        let expected_source = IndexSource::from_database(&database, 0).unwrap();
        std::fs::create_dir(get_index_path(&database)).unwrap();
        let (parent, leaf) =
            crate::infra::fs::open_verified_parent(&database, expected_source.object, false)
                .unwrap();
        let target = DatabaseFileTarget {
            parent,
            leaf,
            identity: expected_source.object,
        };

        let error = unlink_database_files(&target, &expected_source).unwrap_err();
        assert!(matches!(error, Error::InvalidInput(_)));
        assert!(database.exists());
    }

    #[cfg(unix)]
    #[test]
    fn delete_database_leaves_colliding_legacy_sidecar() {
        let dir = tempfile::tempdir().unwrap();
        let collision_owner = dir.path().join("foo");
        let database = dir.path().join("foo.db3");
        std::fs::write(&collision_owner, b"database").unwrap();
        std::fs::write(&database, b"database").unwrap();
        let shared_sidecar = get_index_path(&collision_owner);
        assert_eq!(shared_sidecar, legacy_index_path(&database));
        SearchIndex::default()
            .write_to_with_source(
                &shared_sidecar,
                IndexSource::from_database(&collision_owner, 0).unwrap(),
            )
            .unwrap();
        let expected_source = IndexSource::from_database(&database, 0).unwrap();
        let (parent, leaf) =
            crate::infra::fs::open_verified_parent(&database, expected_source.object, false)
                .unwrap();
        let target = DatabaseFileTarget {
            parent,
            leaf,
            identity: expected_source.object,
        };

        assert_eq!(unlink_database_files(&target, &expected_source).unwrap(), 1);
        assert!(!database.exists());
        assert!(shared_sidecar.exists());
    }

    #[test]
    fn delete_database_uses_fd_relative_target_and_outcome_mapper() {
        let source = include_str!("mod.rs");
        let body = source
            .split("pub async fn delete_database")
            .nth(1)
            .unwrap()
            .split("fn finish_database_deletion")
            .next()
            .unwrap();
        assert!(body.contains("finish_database_deletion"));
        assert!(body.contains("database_file_target"));
        assert!(!body.contains("remove_file"));
    }

    #[test]
    fn search_index_generation_uses_fd_relative_atomic_writer() {
        let source = include_str!("mod.rs");
        let body = source
            .split("fn generate_search_index_locked")
            .nth(1)
            .unwrap()
            .split("#[derive(Serialize, Type)]")
            .next()
            .unwrap();
        assert!(body.contains("write_to_at"));
        assert!(!body.contains("atomic_replace(&"));
        assert!(!body.contains("std::fs::remove_file"));
    }

    #[test]
    fn pagination_limit_offset_validates_and_uses_i64_arithmetic() {
        struct Case {
            page: Option<i32>,
            page_size: Option<i32>,
            expected: Result<(Option<i64>, Option<i64>), ()>,
        }

        let cases = [
            Case {
                page: None,
                page_size: Some(-1),
                expected: Err(()),
            },
            Case {
                page: Some(0),
                page_size: None,
                expected: Err(()),
            },
            Case {
                page: Some(-1),
                page_size: None,
                expected: Err(()),
            },
            Case {
                page: Some(2_000_000_000),
                page_size: Some(2),
                expected: Ok((Some(2), Some(3_999_999_998))),
            },
            Case {
                page: None,
                page_size: Some(1001),
                expected: Err(()),
            },
            Case {
                page: Some(3),
                page_size: Some(50),
                expected: Ok((Some(50), Some(100))),
            },
            Case {
                page: None,
                page_size: None,
                expected: Ok((None, None)),
            },
        ];

        for case in cases {
            let actual = pagination_limit_offset(case.page, case.page_size);
            match case.expected {
                Ok(expected) => assert_eq!(actual.unwrap(), expected),
                Err(()) => assert!(matches!(actual, Err(Error::InvalidInput(_)))),
            }
        }
    }

    #[test]
    fn pagination_limit_offset_is_used_by_all_query_commands() {
        let source = include_str!("mod.rs");

        for function_name in ["get_games", "get_players", "get_tournaments"] {
            let signature = format!("pub async fn {function_name}(");
            let start = source.find(&signature).unwrap();
            let remainder = &source[start..];
            let end = remainder
                .find("\n#[tauri::command]")
                .unwrap_or(remainder.len());
            let function = &remainder[..end];

            assert!(
                function.contains("pagination_limit_offset"),
                "{function_name} must validate pagination through pagination_limit_offset"
            );
            assert!(
                !function.contains("limit as i64"),
                "{function_name} must not cast an unvalidated limit"
            );
        }
    }

    #[test]
    fn home_row() {
        use shakmaty::Board;

        let pawn_home = get_pawn_home(&Board::default());
        assert_eq!(pawn_home, 0b1111111111111111);

        let pawn_home = get_pawn_home(
            &Board::from_ascii_board_fen(b"8/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/8").unwrap(),
        );
        assert_eq!(pawn_home, 0b1110111111101111);

        let pawn_home = get_pawn_home(&Board::from_ascii_board_fen(b"8/8/8/8/8/8/8/8").unwrap());
        assert_eq!(pawn_home, 0b0000000000000000);
    }

    #[test]
    fn importer_handles_nested_variations() {
        let pgn = r#"[Event "T"]
[Site "S"]
[Date "2026.02.27"]
[UTCTime "12:00:00"]
[White "W"]
[Black "B"]
[Result "*"]

1. e4 (1. d4 d5 (1... Nf6) {inner}) e5 *
"#;

        let mut importer = Importer::new(None);
        let games: Vec<TempGame> = BufferedReader::new(pgn.as_bytes())
            .into_iter(&mut importer)
            .flatten()
            .flatten()
            .collect();

        assert_eq!(games.len(), 1);
        let movetext = decode_game_to_movetext(&games[0].moves, Fen::default()).unwrap();

        assert_eq!(movetext, "1. e4 (1. d4 d5 (1... Nf6) {inner}) 1... e5");
    }

    #[test]
    fn importer_handles_symbolic_and_numeric_nags() {
        let pgn = r#"[Event "T"]
[Site "S"]
[Date "2026.02.27"]
[UTCTime "12:00:00"]
[White "W"]
[Black "B"]
[Result "*"]

1. e4! (1. d4 $2) e5 $1 *
"#;

        let mut importer = Importer::new(None);
        let games: Vec<TempGame> = BufferedReader::new(pgn.as_bytes())
            .into_iter(&mut importer)
            .flatten()
            .flatten()
            .collect();

        assert_eq!(games.len(), 1);
        let movetext = decode_game_to_movetext(&games[0].moves, Fen::default()).unwrap();
        assert_eq!(movetext, "1. e4! (1. d4?) 1... e5!");
    }

    fn setup_test_db() -> SqliteConnection {
        let mut conn = SqliteConnection::establish(":memory:").unwrap();
        conn.batch_execute("PRAGMA foreign_keys = ON;").unwrap();
        conn.batch_execute(CREATE_TABLES_SQL).unwrap();
        conn
    }

    #[test]
    fn required_indexes_have_an_exact_status_and_can_be_repaired_atomically() {
        let db = &mut setup_test_db();
        assert!(!check_index_exists(db).unwrap());

        create_required_indexes(db).unwrap();
        assert!(check_index_exists(db).unwrap());

        drop_required_indexes(db).unwrap();
        assert!(!check_index_exists(db).unwrap());

        db.batch_execute("CREATE INDEX games_date_idx ON Games(Result);")
            .unwrap();
        assert!(!check_index_exists(db).unwrap());

        create_required_indexes(db).unwrap();
        assert!(check_index_exists(db).unwrap());
    }

    #[test]
    fn delete_orphaned_data_removes_unreferenced_players_events_sites() {
        let db = &mut setup_test_db();

        // Create players, events, sites
        let player1 = create_player(db, "Magnus").unwrap();
        let player2 = create_player(db, "Hikaru").unwrap();
        let event = create_event(db, "World Championship").unwrap();
        let site = create_site(db, "Reykjavik").unwrap();

        // Insert a game referencing them
        let game = create_game(
            db,
            NewGame {
                event_id: event.id,
                site_id: site.id,
                white_id: player1.id,
                black_id: player2.id,
                white_elo: None,
                black_elo: None,
                white_material: 0,
                black_material: 0,
                date: None,
                time: None,
                round: None,
                result: None,
                time_control: None,
                eco: None,
                ply_count: 10,
                fen: None,
                moves: &[],
                pawn_home: 0,
            },
        )
        .unwrap();

        // Verify everything exists: 3 players (Unknown + 2), 2 events, 2 sites
        let player_count: i64 = players::table.count().get_result(db).unwrap();
        assert_eq!(player_count, 3);
        let event_count: i64 = events::table.count().get_result(db).unwrap();
        assert_eq!(event_count, 2);
        let site_count: i64 = sites::table.count().get_result(db).unwrap();
        assert_eq!(site_count, 2);

        // Delete the game
        diesel::delete(games::table.filter(games::id.eq(game.id)))
            .execute(db)
            .unwrap();

        // Before fix: orphans would remain. Call our cleanup function.
        maintain_database_metadata(db).unwrap();

        // Players: only the sentinel "Unknown" (ID=0) should remain
        let player_count: i64 = players::table.count().get_result(db).unwrap();
        assert_eq!(player_count, 1, "Orphaned players should be deleted");

        let remaining_player: Player = players::table.first(db).unwrap();
        assert_eq!(
            remaining_player.id, 0,
            "Only the Unknown player should remain"
        );

        // Events: only the sentinel should remain
        let event_count: i64 = events::table.count().get_result(db).unwrap();
        assert_eq!(event_count, 1, "Orphaned events should be deleted");

        // Sites: only the sentinel should remain
        let site_count: i64 = sites::table.count().get_result(db).unwrap();
        assert_eq!(site_count, 1, "Orphaned sites should be deleted");

        assert_info_counts_match_tables(db);
    }

    #[test]
    fn delete_orphaned_data_preserves_referenced_records() {
        let db = &mut setup_test_db();

        // Create players, events, sites for two games
        let magnus = create_player(db, "Magnus").unwrap();
        let hikaru = create_player(db, "Hikaru").unwrap();
        let fabiano = create_player(db, "Fabiano").unwrap();
        let event1 = create_event(db, "World Championship").unwrap();
        let event2 = create_event(db, "Candidates").unwrap();
        let site1 = create_site(db, "Reykjavik").unwrap();
        let site2 = create_site(db, "Toronto").unwrap();

        let make_game = |db: &mut SqliteConnection, w: i32, b: i32, e: i32, s: i32| {
            create_game(
                db,
                NewGame {
                    event_id: e,
                    site_id: s,
                    white_id: w,
                    black_id: b,
                    white_elo: None,
                    black_elo: None,
                    white_material: 0,
                    black_material: 0,
                    date: None,
                    time: None,
                    round: None,
                    result: None,
                    time_control: None,
                    eco: None,
                    ply_count: 10,
                    fen: None,
                    moves: &[],
                    pawn_home: 0,
                },
            )
            .unwrap()
        };

        // Game 1: Magnus vs Hikaru at World Championship in Reykjavik
        let game1 = make_game(db, magnus.id, hikaru.id, event1.id, site1.id);
        // Game 2: Fabiano vs Hikaru at Candidates in Toronto
        let game2 = make_game(db, fabiano.id, hikaru.id, event2.id, site2.id);

        // Delete only game 1
        diesel::delete(games::table.filter(games::id.eq(game1.id)))
            .execute(db)
            .unwrap();
        maintain_database_metadata(db).unwrap();

        // Magnus should be gone (only in game 1), but Hikaru and Fabiano should remain
        let player_count: i64 = players::table.count().get_result(db).unwrap();
        assert_eq!(player_count, 3, "Unknown + Hikaru + Fabiano should remain");

        let magnus_exists: i64 = players::table
            .filter(players::name.eq("Magnus"))
            .count()
            .get_result(db)
            .unwrap();
        assert_eq!(magnus_exists, 0, "Magnus should be deleted (orphaned)");

        // Event1 and Site1 should be gone, Event2 and Site2 should remain
        let event_count: i64 = events::table.count().get_result(db).unwrap();
        assert_eq!(event_count, 2, "Unknown + Candidates should remain");

        let site_count: i64 = sites::table.count().get_result(db).unwrap();
        assert_eq!(site_count, 2, "Unknown + Toronto should remain");
        assert_info_counts_match_tables(db);

        // Delete game 2 — now everything should be orphaned
        diesel::delete(games::table.filter(games::id.eq(game2.id)))
            .execute(db)
            .unwrap();
        maintain_database_metadata(db).unwrap();

        let player_count: i64 = players::table.count().get_result(db).unwrap();
        assert_eq!(player_count, 1, "Only Unknown should remain");
        let event_count: i64 = events::table.count().get_result(db).unwrap();
        assert_eq!(event_count, 1, "Only Unknown should remain");
        let site_count: i64 = sites::table.count().get_result(db).unwrap();
        assert_eq!(site_count, 1, "Only Unknown should remain");
        assert_info_counts_match_tables(db);
    }

    fn parsed_game(pgn: &str) -> TempGame {
        let mut importer = Importer::new(None);
        BufferedReader::new(pgn.as_bytes())
            .into_iter(&mut importer)
            .flatten()
            .flatten()
            .next()
            .unwrap()
    }

    fn test_game_pgn(white: &str, black: &str, event: &str, site: &str) -> String {
        format!(
            "[Event \"{event}\"]\n[Site \"{site}\"]\n[Date \"2026.08.09\"]\n[White \"{white}\"]\n[Black \"{black}\"]\n[Result \"*\"]\n\n1. e4 e5 *\n"
        )
    }

    fn insert_test_game(
        db: &mut SqliteConnection,
        white_id: i32,
        black_id: i32,
        event_id: i32,
        site_id: i32,
    ) -> Game {
        create_game(
            db,
            NewGame {
                event_id,
                site_id,
                white_id,
                black_id,
                white_elo: None,
                black_elo: None,
                white_material: 0,
                black_material: 0,
                date: None,
                time: None,
                round: None,
                result: None,
                time_control: None,
                eco: None,
                ply_count: 2,
                fen: None,
                moves: &[],
                pawn_home: 0,
            },
        )
        .unwrap()
    }

    type DatabaseState = (i64, i64, i64, i64, Vec<(String, Option<String>)>);

    fn database_state(db: &mut SqliteConnection) -> DatabaseState {
        (
            games::table.count().get_result(db).unwrap(),
            players::table.count().get_result(db).unwrap(),
            events::table.count().get_result(db).unwrap(),
            sites::table.count().get_result(db).unwrap(),
            info::table
                .order(info::name.asc())
                .select((info::name, info::value))
                .load(db)
                .unwrap(),
        )
    }

    fn assert_info_counts_match_tables(db: &mut SqliteConnection) {
        for (name, count) in [
            (
                "GameCount",
                games::table.count().get_result::<i64>(db).unwrap(),
            ),
            (
                "PlayerCount",
                players::table.count().get_result::<i64>(db).unwrap(),
            ),
            (
                "EventCount",
                events::table.count().get_result::<i64>(db).unwrap(),
            ),
            (
                "SiteCount",
                sites::table.count().get_result::<i64>(db).unwrap(),
            ),
        ] {
            assert_eq!(
                info::table
                    .find(name)
                    .select(info::value)
                    .first::<Option<String>>(db)
                    .unwrap(),
                Some(count.to_string()),
                "{name} must match its table"
            );
        }
    }

    #[test]
    fn delete_empty_games_maintains_all_info_counts() {
        let db = &mut setup_test_db();
        let white = create_player(db, "White").unwrap();
        let black = create_player(db, "Black").unwrap();
        let event = create_event(db, "Event").unwrap();
        let site = create_site(db, "Site").unwrap();
        let empty_game = insert_test_game(db, white.id, black.id, event.id, site.id);
        insert_test_game(db, white.id, black.id, event.id, site.id);
        diesel::update(games::table.find(empty_game.id))
            .set(games::ply_count.eq(0))
            .execute(db)
            .unwrap();

        db.transaction(delete_empty_games_transaction).unwrap();

        assert_eq!(games::table.count().get_result::<i64>(db).unwrap(), 1);
        assert_info_counts_match_tables(db);
    }

    #[test]
    fn deleting_a_game_maintains_all_info_counts() {
        let db = &mut setup_test_db();
        let white = create_player(db, "White").unwrap();
        let black = create_player(db, "Black").unwrap();
        let event = create_event(db, "Event").unwrap();
        let site = create_site(db, "Site").unwrap();
        let deleted_game = insert_test_game(db, white.id, black.id, event.id, site.id);
        insert_test_game(db, white.id, black.id, event.id, site.id);

        db.transaction(|db| delete_db_game_transaction(db, deleted_game.id))
            .unwrap();

        assert_eq!(games::table.count().get_result::<i64>(db).unwrap(), 1);
        assert_info_counts_match_tables(db);
    }

    #[test]
    fn deleting_duplicate_games_maintains_all_info_counts() {
        let db = &mut setup_test_db();
        let white = create_player(db, "White").unwrap();
        let black = create_player(db, "Black").unwrap();
        let event = create_event(db, "Event").unwrap();
        let site = create_site(db, "Site").unwrap();
        insert_test_game(db, white.id, black.id, event.id, site.id);
        insert_test_game(db, white.id, black.id, event.id, site.id);

        db.transaction(delete_duplicated_games_transaction).unwrap();

        assert_eq!(games::table.count().get_result::<i64>(db).unwrap(), 1);
        assert_info_counts_match_tables(db);
    }

    #[test]
    fn deleting_empty_games_rolls_back_with_the_enclosing_transaction() {
        let db = &mut setup_test_db();
        let white = create_player(db, "White").unwrap();
        let black = create_player(db, "Black").unwrap();
        let event = create_event(db, "Event").unwrap();
        let site = create_site(db, "Site").unwrap();
        let empty_game = insert_test_game(db, white.id, black.id, event.id, site.id);
        diesel::update(games::table.find(empty_game.id))
            .set(games::ply_count.eq(0))
            .execute(db)
            .unwrap();
        maintain_database_metadata(db).unwrap();
        let before = database_state(db);

        let result: Result<(), Error> = db.transaction(|db| {
            delete_empty_games_transaction(db)?;
            Err(Error::InvalidInput("injected delete failure".into()))
        });

        assert!(
            matches!(result, Err(Error::InvalidInput(message)) if message == "injected delete failure")
        );
        assert_eq!(database_state(db), before);
    }

    #[test]
    fn writing_nonexistent_game_leaves_database_unchanged() {
        let db = &mut setup_test_db();
        maintain_database_metadata(db).unwrap();
        let before = database_state(db);
        let replacement = parsed_game(&test_game_pgn(
            "New White",
            "New Black",
            "New Event",
            "New Site",
        ));

        let result = db.transaction(|db| {
            write_parsed_db_game(db, 404, &replacement, maintain_database_metadata)
        });

        assert!(matches!(result, Err(Error::GameNotFound(id)) if id == "404"));
        assert_eq!(database_state(db), before);
    }

    #[test]
    fn writing_game_removes_old_last_referenced_dimensions() {
        let db = &mut setup_test_db();
        let old_white = create_player(db, "Old White").unwrap();
        let old_black = create_player(db, "Old Black").unwrap();
        let old_event = create_event(db, "Old Event").unwrap();
        let old_site = create_site(db, "Old Site").unwrap();
        let game = insert_test_game(db, old_white.id, old_black.id, old_event.id, old_site.id);
        let replacement = parsed_game(&test_game_pgn(
            "New White",
            "New Black",
            "New Event",
            "New Site",
        ));

        db.transaction(|db| {
            write_parsed_db_game(db, game.id, &replacement, maintain_database_metadata)
        })
        .unwrap();

        for name in ["Old White", "Old Black"] {
            assert_eq!(
                players::table
                    .filter(players::name.eq(name))
                    .count()
                    .get_result::<i64>(db)
                    .unwrap(),
                0
            );
        }
        assert_eq!(
            events::table
                .filter(events::name.eq("Old Event"))
                .count()
                .get_result::<i64>(db)
                .unwrap(),
            0
        );
        assert_eq!(
            sites::table
                .filter(sites::name.eq("Old Site"))
                .count()
                .get_result::<i64>(db)
                .unwrap(),
            0
        );
        assert_eq!(database_state(db).0, 1);
        assert_eq!(database_state(db).1, 3);
        assert_eq!(database_state(db).2, 2);
        assert_eq!(database_state(db).3, 2);
        assert_info_counts_match_tables(db);
    }

    #[test]
    fn writing_game_rolls_back_when_final_metadata_maintenance_fails() {
        fn fail_final_metadata(_: &mut SqliteConnection) -> Result<(), Error> {
            Err(Error::InvalidInput("injected metadata failure".into()))
        }

        let db = &mut setup_test_db();
        let old_white = create_player(db, "Old White").unwrap();
        let old_black = create_player(db, "Old Black").unwrap();
        let old_event = create_event(db, "Old Event").unwrap();
        let old_site = create_site(db, "Old Site").unwrap();
        let game = insert_test_game(db, old_white.id, old_black.id, old_event.id, old_site.id);
        maintain_database_metadata(db).unwrap();
        let before = database_state(db);
        let replacement = parsed_game(&test_game_pgn(
            "New White",
            "New Black",
            "New Event",
            "New Site",
        ));

        let result = db
            .transaction(|db| write_parsed_db_game(db, game.id, &replacement, fail_final_metadata));

        assert!(
            matches!(result, Err(Error::InvalidInput(message)) if message == "injected metadata failure")
        );
        assert_eq!(database_state(db), before);
    }

    #[test]
    fn merge_rejects_invalid_player_ids_without_mutating_database() {
        let db = &mut setup_test_db();
        let source = create_player(db, "Source").unwrap();
        let target = create_player(db, "Target").unwrap();
        let opponent = create_player(db, "Opponent").unwrap();
        let event = create_event(db, "Event").unwrap();
        let site = create_site(db, "Site").unwrap();
        insert_test_game(db, source.id, opponent.id, event.id, site.id);
        insert_test_game(db, target.id, opponent.id, event.id, site.id);
        maintain_database_metadata(db).unwrap();
        let before = database_state(db);

        for (source_id, target_id, expected_message) in [
            (
                source.id,
                source.id,
                "source and target player IDs must be different",
            ),
            (0, target.id, "the unknown player (ID 0) cannot be merged"),
            (source.id, 0, "the unknown player (ID 0) cannot be merged"),
            (999, target.id, "source player 999 does not exist"),
            (source.id, 999, "target player 999 does not exist"),
        ] {
            let result = db.transaction(|db| merge_players_transaction(db, source_id, target_id));
            match result {
                Err(Error::InvalidInput(message)) => assert_eq!(message, expected_message),
                other => panic!("expected InvalidInput, got {other:?}"),
            }
            assert_eq!(database_state(db), before);
        }
    }

    #[test]
    fn merge_rejects_both_head_to_head_orientations_without_mutating_database() {
        for (white_is_source, black_is_source) in [(true, false), (false, true)] {
            let db = &mut setup_test_db();
            let source = create_player(db, "Source").unwrap();
            let target = create_player(db, "Target").unwrap();
            let event = create_event(db, "Event").unwrap();
            let site = create_site(db, "Site").unwrap();
            let (white_id, black_id) = if white_is_source {
                (source.id, target.id)
            } else {
                (target.id, source.id)
            };
            assert_ne!(white_is_source, black_is_source);
            insert_test_game(db, white_id, black_id, event.id, site.id);
            maintain_database_metadata(db).unwrap();
            let before = database_state(db);

            let result = db.transaction(|db| merge_players_transaction(db, source.id, target.id));

            assert!(matches!(result, Err(Error::NotDistinctPlayers)));
            assert_eq!(database_state(db), before);
        }
    }

    #[test]
    fn merge_rewrites_white_and_black_references_then_deletes_source() {
        let db = &mut setup_test_db();
        let source = create_player(db, "Source").unwrap();
        let target = create_player(db, "Target").unwrap();
        let opponent = create_player(db, "Opponent").unwrap();
        let event = create_event(db, "Event").unwrap();
        let site = create_site(db, "Site").unwrap();
        let white_game = insert_test_game(db, source.id, opponent.id, event.id, site.id);
        let black_game = insert_test_game(db, opponent.id, source.id, event.id, site.id);

        db.transaction(|db| merge_players_transaction(db, source.id, target.id))
            .unwrap();

        assert_eq!(
            games::table
                .find(white_game.id)
                .select(games::white_id)
                .first::<i32>(db)
                .unwrap(),
            target.id
        );
        assert_eq!(
            games::table
                .find(black_game.id)
                .select(games::black_id)
                .first::<i32>(db)
                .unwrap(),
            target.id
        );
        assert_eq!(
            players::table
                .find(source.id)
                .count()
                .get_result::<i64>(db)
                .unwrap(),
            0
        );
        assert_eq!(database_state(db).1, 3);
        assert_info_counts_match_tables(db);
    }
}
