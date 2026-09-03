#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod chess;
mod chesscom;
mod credentials;
mod db;
mod engine;
mod error;
mod file_workspace;
mod game;
mod infra;

mod fs;
mod lexer;
mod lichess;
mod oauth;
mod opening;
mod pgn;
mod progress;
mod puzzle;
mod sound;

use std::{
    collections::{HashMap, VecDeque},
    io,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, SystemTime},
};

use chess::BestMovesPayload;
use dashmap::DashMap;
use db::{
    ConvertProgress, DatabaseProgress, GameQuery, IndexSource, NormalizedGame, PositionStats,
};
use derivative::Derivative;
use engine::EngineSupervisor;
use game::GameManager;
use progress::{clear_progress, get_progress, set_progress_state, start_progress, ProgressEvent};

use log::LevelFilter;
use oauth::AuthLifecycle;
#[cfg(debug_assertions)]
use specta_typescript::{BigIntExportBehavior, Typescript};
use sysinfo::SystemExt;
use tauri::{Manager, Window};
use tauri_plugin_log::{Target, TargetKind};

use crate::chess::{
    analyze_game, cancel_analysis, get_engine_config, get_engine_logs, kill_engine, kill_engines,
    retire_engine, stop_engine,
};
use crate::chesscom::{download_chess_com_games, get_public_chess_com_json};
use crate::db::{
    clear_games, convert_pgn, create_indexes, delete_database, delete_db_game, delete_empty_games,
    delete_indexes, export_to_pgn, get_player, get_players_game_info, get_tournaments,
    preload_reference_db, search_position, MmapSearchIndex,
};
use crate::error::Error;
use crate::game::{
    abort_game, get_game_engine_logs, get_game_state, make_game_move, resign_game, start_game,
    take_back_game_move, ClockUpdateEvent, GameMoveEvent, GameOverEvent,
};
use crate::infra::blocking::BLOCKING_GATEWAY;

use crate::file_workspace::{
    create_workspace_directory, create_workspace_file, issue_file_workspace, list_file_workspace,
    map_picker_join, move_workspace_entry, permanently_delete_workspace_entry,
    rename_workspace_file, restore_workspace_entry, trash_workspace_entry,
};
use crate::fs::set_file_as_executable;
use crate::lexer::lex_pgn;
use crate::lichess::{
    get_authenticated_lichess_account, get_authenticated_lichess_explorer, get_public_lichess_json,
};
use crate::oauth::{
    authenticate, get_authentication_status, list_lichess_accounts, migrate_legacy_lichess_token,
    remove_lichess_account,
};
use crate::pgn::{count_pgn_games, delete_game, read_games, write_game};
use crate::puzzle::{
    delete_puzzle_database, get_puzzle, get_puzzle_db_info, get_puzzle_themes,
    get_puzzle_workspace, get_themes_for_puzzle, issue_puzzle_download_destination,
    issue_puzzle_workspace, list_puzzle_databases,
};
use crate::sound::get_sound_server_port;
use crate::{
    chess::get_best_moves,
    db::{
        delete_duplicated_games, edit_db_info, get_db_info, get_games, get_latest_game_timestamp,
        get_players, merge_players, write_db_game,
    },
    fs::{
        cancel_download, download_engine_archive, download_file, download_lichess_games,
        file_exists, get_file_metadata,
    },
    opening::{
        get_opening_from_fen, get_opening_from_fens, get_opening_from_name, search_opening_name,
    },
};
use tokio::sync::Semaphore;

const SEARCH_RESULT_CACHE_CAPACITY: usize = 128;
const SEARCH_INDEX_CACHE_CAPACITY: usize = 8;
const SEARCH_RESULT_CACHE_MAX_BYTES: usize = 64 * 1024 * 1024;
const MAX_ENGINE_IMAGE_BYTES: usize = 10 * 1024 * 1024;
type SearchResult = (Vec<PositionStats>, Vec<NormalizedGame>);

#[derive(Clone)]
struct CachedSearchResult {
    value: SearchResult,
    bytes: usize,
}

fn estimated_search_result_bytes(value: &SearchResult) -> usize {
    let position_bytes = value
        .0
        .iter()
        .map(|item| item.move_.len() + std::mem::size_of::<PositionStats>())
        .sum::<usize>();
    let game_bytes = value
        .1
        .iter()
        .map(|game| {
            game.event.len()
                + game.site.len()
                + game.white.len()
                + game.black.len()
                + game.fen.len()
                + game.moves.len()
                + game.date.as_ref().map_or(0, String::len)
                + game.time.as_ref().map_or(0, String::len)
                + game.round.as_ref().map_or(0, String::len)
                + game.time_control.as_ref().map_or(0, String::len)
                + game.eco.as_ref().map_or(0, String::len)
                + std::mem::size_of_val(game)
        })
        .sum::<usize>();
    position_bytes.saturating_add(game_bytes)
}

/// A stable cache identity for a generated index. Canonical paths prevent
/// aliases from crossing database boundaries; the index revision prevents a
/// replacement from serving results computed from an older archive.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub(crate) struct SearchIndexIdentity {
    pub database: PathBuf,
    pub index: PathBuf,
    source: IndexSource,
    length: u64,
    modified: Duration,
}

impl SearchIndexIdentity {
    pub(crate) fn for_database(database: &Path, source: IndexSource) -> io::Result<Self> {
        let database = database.canonicalize()?;
        let preferred_index = db::get_index_path(&database);
        let index = if preferred_index.exists() {
            preferred_index
        } else {
            let legacy = db::legacy_index_path(&database);
            if legacy.exists() {
                legacy
            } else {
                preferred_index
            }
        };
        let index = index.canonicalize()?;
        let metadata = index.metadata()?;
        Ok(Self {
            database,
            index,
            source,
            length: metadata.len(),
            modified: metadata
                .modified()?
                .duration_since(SystemTime::UNIX_EPOCH)
                .map_err(io::Error::other)?,
        })
    }
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub(crate) struct SearchResultKey {
    query: GameQuery,
    identity: SearchIndexIdentity,
}

impl SearchResultKey {
    pub(crate) fn new(query: GameQuery, identity: SearchIndexIdentity) -> Self {
        Self { query, identity }
    }
}

struct BoundedSearchCache<K, V> {
    values: HashMap<K, V>,
    newest_last: VecDeque<K>,
}

impl<K, V> Default for BoundedSearchCache<K, V> {
    fn default() -> Self {
        Self {
            values: HashMap::new(),
            newest_last: VecDeque::new(),
        }
    }
}

impl<K: Clone + Eq + std::hash::Hash, V: Clone> BoundedSearchCache<K, V> {
    fn get(&mut self, key: &K) -> Option<V> {
        let value = self.values.get(key)?.clone();
        if let Some(position) = self.newest_last.iter().position(|existing| existing == key) {
            self.newest_last.remove(position);
        }
        self.newest_last.push_back(key.clone());
        Some(value)
    }

    fn insert(&mut self, key: K, value: V, capacity: usize) {
        self.values.insert(key.clone(), value);
        if let Some(position) = self
            .newest_last
            .iter()
            .position(|existing| existing == &key)
        {
            self.newest_last.remove(position);
        }
        self.newest_last.push_back(key);
        while self.values.len() > capacity {
            if let Some(oldest) = self.newest_last.pop_front() {
                self.values.remove(&oldest);
            }
        }
    }

    fn evict_oldest(&mut self) -> Option<V> {
        self.newest_last
            .pop_front()
            .and_then(|oldest| self.values.remove(&oldest))
    }

    fn retain(&mut self, predicate: impl FnMut(&K, &mut V) -> bool) {
        self.values.retain(predicate);
        self.newest_last.retain(|key| self.values.contains_key(key));
    }
}

#[derive(Default)]
pub(crate) struct SearchCache {
    results: Mutex<BoundedSearchCache<SearchResultKey, CachedSearchResult>>,
    indexes: Mutex<BoundedSearchCache<SearchIndexIdentity, MmapSearchIndex>>,
    collisions: DashMap<(GameQuery, PathBuf), Arc<tokio::sync::Mutex<()>>>,
    generation_locks: DashMap<PathBuf, Arc<tokio::sync::Mutex<()>>>,
}

impl SearchCache {
    pub(crate) fn clear(&self) {
        *self.results.lock().expect("search result cache poisoned") = Default::default();
        *self.indexes.lock().expect("search index cache poisoned") = Default::default();
        self.collisions.clear();
        self.generation_locks.clear();
    }

    pub(crate) fn get_result(&self, key: &SearchResultKey) -> Option<SearchResult> {
        self.results
            .lock()
            .expect("search result cache poisoned")
            .get(key)
            .map(|cached| cached.value)
    }

    pub(crate) fn insert_result(&self, key: SearchResultKey, value: SearchResult) {
        let bytes = estimated_search_result_bytes(&value);
        if bytes > SEARCH_RESULT_CACHE_MAX_BYTES {
            return;
        }
        let mut cache = self.results.lock().expect("search result cache poisoned");
        cache.insert(
            key,
            CachedSearchResult { value, bytes },
            SEARCH_RESULT_CACHE_CAPACITY,
        );
        let mut total = cache
            .values
            .values()
            .map(|cached| cached.bytes)
            .sum::<usize>();
        while total > SEARCH_RESULT_CACHE_MAX_BYTES {
            let Some(evicted) = cache.evict_oldest() else {
                break;
            };
            total = total.saturating_sub(evicted.bytes);
        }
    }

    pub(crate) fn get_index(&self, identity: &SearchIndexIdentity) -> Option<MmapSearchIndex> {
        self.indexes
            .lock()
            .expect("search index cache poisoned")
            .get(identity)
    }

    pub(crate) fn insert_index(&self, identity: SearchIndexIdentity, index: MmapSearchIndex) {
        self.indexes
            .lock()
            .expect("search index cache poisoned")
            .insert(identity, index, SEARCH_INDEX_CACHE_CAPACITY);
    }

    pub(crate) fn collision_lock(
        &self,
        query: GameQuery,
        database: PathBuf,
    ) -> Arc<tokio::sync::Mutex<()>> {
        self.collisions
            .entry((query, database))
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .value()
            .clone()
    }

    pub(crate) fn generation_lock(&self, index: PathBuf) -> Arc<tokio::sync::Mutex<()>> {
        self.generation_locks
            .entry(index)
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .value()
            .clone()
    }

    pub(crate) fn remove_generation_lock_if_idle(
        &self,
        index: &Path,
        lock: &Arc<tokio::sync::Mutex<()>>,
    ) {
        if Arc::strong_count(lock) == 2 {
            self.generation_locks
                .remove_if(index, |_, existing| Arc::ptr_eq(existing, lock));
        }
    }

    pub(crate) fn remove_collision_if_idle(
        &self,
        query: &GameQuery,
        database: &Path,
        lock: &Arc<tokio::sync::Mutex<()>>,
    ) {
        // One strong reference is held by the map and one by the cleanup
        // guard. Any waiter holds another reference, so it keeps the key alive
        // until it has serialized through the same mutex.
        if Arc::strong_count(lock) == 2 {
            self.collisions
                .remove_if(&(query.clone(), database.to_path_buf()), |_, existing| {
                    Arc::ptr_eq(existing, lock)
                });
        }
    }

    /// Mutation callers must invoke this after regenerating or deleting an
    /// index. Revision keys protect against external replacement; this is the
    /// explicit in-process invalidation seam for database writes.
    pub(crate) fn invalidate_database(&self, database: &Path) {
        let database = database
            .canonicalize()
            .unwrap_or_else(|_| database.to_path_buf());
        self.results
            .lock()
            .expect("search result cache poisoned")
            .retain(|key, _| key.identity.database != database);
        self.indexes
            .lock()
            .expect("search index cache poisoned")
            .retain(|identity, _| identity.database != database);
    }
}

#[derive(Derivative)]
#[derivative(Default)]
pub struct AppState {
    pub(crate) database_repository: Arc<db::DatabaseRepository>,
    #[derivative(Default(value = "Arc::new(Semaphore::new(2))"))]
    new_request: Arc<Semaphore>,
    #[derivative(Default(value = "Arc::new(SearchCache::default())"))]
    pub(crate) search_cache: Arc<SearchCache>,
    #[derivative(Default(value = "Default::default()"))]
    pub pgn_repository: crate::pgn::PgnRepository,
    #[derivative(Default(value = "Arc::new(std::sync::Mutex::new(None))"))]
    pub pgn_path_authority:
        Arc<std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>>,

    engine_supervisor: Arc<EngineSupervisor>,
    #[derivative(Default(value = "Arc::new(AuthLifecycle::default())"))]
    auth: Arc<AuthLifecycle>,
    #[derivative(Default(value = "Arc::new(crate::credentials::CredentialManager::default())"))]
    credentials: Arc<crate::credentials::CredentialManager>,
    game_manager: Arc<GameManager>,
    #[derivative(Default(value = "Default::default()"))]
    progress_state: progress::ProgressStore,
    #[derivative(Default(
        value = "Arc::new(tokio::sync::Mutex::new(crate::puzzle::PuzzleCache::new()))"
    ))]
    puzzle_cache: Arc<tokio::sync::Mutex<crate::puzzle::PuzzleCache>>,
    #[derivative(Default(value = "Arc::new(crate::infra::net::ProdTransport::default())"))]
    pub http_transport: Arc<dyn crate::infra::net::DownloadTransport>,
    #[derivative(Default(value = "Arc::new(crate::infra::net::native_json_http_client())"))]
    pub(crate) json_http_client: Arc<reqwest::Client>,
    #[derivative(Default(value = "Arc::new(crate::fs::DownloadRegistry::default())"))]
    pub download_registry: Arc<crate::fs::DownloadRegistry>,
}

#[tauri::command]
#[specta::specta]
async fn close_splashscreen(window: Window) -> Result<(), String> {
    let main_win = window
        .get_webview_window("main")
        .ok_or_else(|| "no window labeled 'main' found".to_string())?;
    main_win.show().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn issue_pgn_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::FileWorkspaceDescriptor, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("PGN", &["pgn"])
            .blocking_pick_file()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| Error::InvalidInput(format!("invalid native file selection: {error}")))
    })
    .await
    .map_err(map_picker_join)??;
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "PGN".into());
    let mut authority_guard = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_guard
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    let grant = authority.grant_dialog_operations(
        &path,
        display_name.clone(),
        crate::infra::path_authority::PathClass::BoundedDialogGrant,
        vec![
            crate::infra::path_authority::PathOperation::ReadPgn,
            crate::infra::path_authority::PathOperation::WritePgn,
        ],
        Duration::from_secs(1_800),
        128,
    )?;
    let commit = authority.promote_dialog(
        &grant,
        crate::infra::path_authority::PathClass::PersistentFile,
        display_name.clone(),
        vec![
            crate::infra::path_authority::PathOperation::ReadPgn,
            crate::infra::path_authority::PathOperation::WritePgn,
        ],
    )?;
    Ok(crate::infra::path_authority::FileWorkspaceDescriptor {
        handle: crate::infra::path_authority::FileWorkspaceHandle::new(commit.id),
        display_name,
        availability: crate::infra::path_authority::PathAvailability::Available,
    })
}

/// Native-only save destination picker for database export. The selection is immediately
/// persisted as an exact ReadPgn+WritePgn workspace, so the renderer never receives a path and
/// can safely open the exported file after writing it.
#[tauri::command]
#[specta::specta]
async fn issue_pgn_export_destination(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::FileWorkspaceDescriptor, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("PGN", &["pgn"])
            .set_file_name("games.pgn")
            .blocking_save_file()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| Error::InvalidInput(format!("invalid native file selection: {error}")))
    })
    .await
    .map_err(map_picker_join)??;
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "PGN export".into());
    let mut authority_guard = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    authority_guard
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .create_pgn_export_destination(&path, display_name)
}

async fn save_native_export(
    app: &tauri::AppHandle,
    suggested_name: &str,
    extension: &str,
    bytes: &[u8],
) -> Result<(), Error> {
    use tauri_plugin_dialog::DialogExt;
    let picker_app = app.clone();
    let picker_extension = extension.to_owned();
    let picker_name = suggested_name.to_owned();
    let path = tokio::task::spawn_blocking(move || {
        picker_app
            .dialog()
            .file()
            .add_filter(
                picker_extension.to_uppercase(),
                &[picker_extension.as_str()],
            )
            .set_file_name(picker_name)
            .blocking_save_file()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| Error::InvalidInput(format!("invalid native file selection: {error}")))
    })
    .await
    .map_err(map_picker_join)??;
    let extension = extension.to_owned();
    let bytes = bytes.to_vec();
    BLOCKING_GATEWAY
        .spawn(move || save_native_export_blocking(path, extension, bytes))
        .await
}

fn save_native_export_blocking(
    path: PathBuf,
    extension: String,
    bytes: Vec<u8>,
) -> Result<(), Error> {
    if path.extension().and_then(|value| value.to_str()) != Some(extension.as_str()) {
        return Err(Error::InvalidInput(format!(
            "export must use .{extension} extension"
        )));
    }
    crate::infra::fs::atomic_replace(&path, |file| {
        file.write_all(&bytes).map_err(Error::from)?;
        Ok(())
    })?;
    Ok(())
}

/// Native save dialog and atomic export for a renderer-produced board image.
#[tauri::command]
#[specta::specta]
async fn save_board_snapshot(app: tauri::AppHandle, bytes: Vec<u8>) -> Result<(), Error> {
    save_native_export(&app, "board.png", "png", &bytes).await
}

/// Native save dialog and atomic export for renderer-selected engine logs.
#[tauri::command]
#[specta::specta]
async fn save_engine_logs(app: tauri::AppHandle, text: String) -> Result<(), Error> {
    save_native_export(&app, "engine-logs.csv", "csv", text.as_bytes()).await
}

/// Opens the fixed project documentation URL without granting arbitrary URL authority to the
/// renderer.
#[tauri::command]
#[specta::specta]
fn open_documentation(app: tauri::AppHandle) -> Result<(), Error> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url("https://encroissant.org/docs/", None::<&str>)
        .map_err(Error::from)
}

/// Opens the application-owned log file without exposing its native path to the renderer.
#[tauri::command]
#[specta::specta]
async fn open_app_log(app: tauri::AppHandle) -> Result<(), Error> {
    BLOCKING_GATEWAY
        .spawn(move || open_app_log_blocking(app))
        .await
}

fn open_app_log_blocking(app: tauri::AppHandle) -> Result<(), Error> {
    use tauri_plugin_opener::OpenerExt;
    let path = app.path().app_log_dir()?.join("en-croissant.log");
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(Error::from)
}

/// The native picker creates a persistent, least-privilege root for one-file downloads.
/// The renderer receives only the opaque capability ID, never a filesystem path.
#[tauri::command]
#[specta::specta]
async fn issue_download_destination(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::PathRef, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .blocking_pick_folder()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| {
                Error::InvalidInput(format!("invalid native folder selection: {error}"))
            })
    })
    .await
    .map_err(map_picker_join)??;
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Download destination".into());
    let mut authority = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    let grant = authority.grant_dialog(
        &path,
        display_name.clone(),
        crate::infra::path_authority::PathClass::SingleDialogGrant,
        crate::infra::path_authority::PathOperation::DownloadFile,
        Duration::from_secs(300),
        1,
    )?;
    Ok(authority
        .promote_dialog(
            &grant,
            crate::infra::path_authority::PathClass::PersistentCustomRoot,
            display_name,
            vec![crate::infra::path_authority::PathOperation::DownloadFile],
        )?
        .id)
}

/// Native-only database-root selection.  A directory is promoted immediately
/// to a persistent database workspace and the renderer receives only its
/// opaque handle.
#[tauri::command]
#[specta::specta]
async fn issue_database_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::DatabaseRootHandle, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .blocking_pick_folder()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| {
                Error::InvalidInput(format!("invalid database folder selection: {error}"))
            })
    })
    .await
    .map_err(map_picker_join)??;
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Databases".into());
    let mut authority_lock = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    let root = authority.get_or_create_database_root(&path, display_name)?;
    authority.set_active_database_root(&root)?;
    Ok(root)
}

/// Returns the app-owned default database root.  Unlike the picker command it
/// never receives a renderer path and is stable across restarts.
#[tauri::command]
#[specta::specta]
async fn get_database_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::DatabaseRootHandle, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || get_database_workspace_blocking(&authority, app))
        .await
}

fn get_database_workspace_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    app: tauri::AppHandle,
) -> Result<crate::infra::path_authority::DatabaseRootHandle, Error> {
    let mut authority_lock = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    if let Some(root) = authority.active_database_root()? {
        return Ok(root);
    }
    let path = app.path().app_data_dir()?.join("db");
    std::fs::create_dir_all(&path)?;
    let root = authority.get_or_create_database_root(&path, "Databases")?;
    authority.set_active_database_root(&root)?;
    Ok(root)
}

#[tauri::command]
#[specta::specta]
async fn list_workspace_databases(
    root: crate::infra::path_authority::DatabaseRootHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<crate::infra::path_authority::DatabaseDescriptor>, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || list_workspace_databases_blocking(&authority, root))
        .await
}

fn list_workspace_databases_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    root: crate::infra::path_authority::DatabaseRootHandle,
) -> Result<Vec<crate::infra::path_authority::DatabaseDescriptor>, Error> {
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .list_database_children(&root)
}

#[tauri::command]
#[specta::specta]
async fn create_workspace_database(
    root: crate::infra::path_authority::DatabaseRootHandle,
    filename: String,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::DatabaseHandle, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || create_workspace_database_blocking(&authority, root, filename))
        .await
}

fn create_workspace_database_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    root: crate::infra::path_authority::DatabaseRootHandle,
    filename: String,
) -> Result<crate::infra::path_authority::DatabaseHandle, Error> {
    if filename.is_empty() || filename.contains('/') || filename.contains('\\') {
        return Err(Error::InvalidInput("invalid database filename".into()));
    }
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .create_database_child(&root, std::ffi::OsStr::new(&filename))
}

#[tauri::command]
#[specta::specta]
async fn database_download_destination(
    root: crate::infra::path_authority::DatabaseRootHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::PathRef, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || database_download_destination_blocking(&authority, root))
        .await
}

fn database_download_destination_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    root: crate::infra::path_authority::DatabaseRootHandle,
) -> Result<crate::infra::path_authority::PathRef, Error> {
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .database_download_destination(&root)
}

#[tauri::command]
#[specta::specta]
async fn issue_engine_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::EngineRootHandle, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .blocking_pick_folder()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| {
                Error::InvalidInput(format!("invalid engine folder selection: {error}"))
            })
    })
    .await
    .map_err(map_picker_join)??;
    let mut lock = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    let root = authority.get_or_create_engine_root(&path, "Engines")?;
    authority.set_active_engine_root(&root)?;
    Ok(root)
}

#[tauri::command]
#[specta::specta]
async fn get_engine_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::EngineRootHandle, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || get_engine_workspace_blocking(&authority, app))
        .await
}

fn get_engine_workspace_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    app: tauri::AppHandle,
) -> Result<crate::infra::path_authority::EngineRootHandle, Error> {
    let mut lock = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    if let Some(root) = authority.active_engine_root()? {
        return Ok(root);
    }
    let path = app.path().app_data_dir()?.join("engines");
    std::fs::create_dir_all(&path)?;
    let root = authority.get_or_create_engine_root(&path, "Engines")?;
    authority.set_active_engine_root(&root)?;
    Ok(root)
}

#[tauri::command]
#[specta::specta]
async fn issue_engine_binary(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::EngineHandle, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .blocking_pick_file()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| Error::InvalidInput(format!("invalid engine file selection: {error}")))
    })
    .await
    .map_err(map_picker_join)??;
    let label = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Engine".into());
    state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .register_engine_file(&path, label)
}

/// Native-only resource picker for UCI file/directory options.  The dialog
/// selection is immediately bound to a no-follow persistent capability.
#[tauri::command]
#[specta::specta]
async fn issue_engine_resource(
    directory: bool,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::EngineResourceHandle, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        let picker = app.dialog().file();
        let selected = if directory {
            picker.blocking_pick_folder()
        } else {
            picker.blocking_pick_file()
        };
        selected
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| {
                Error::InvalidInput(format!("invalid engine resource selection: {error}"))
            })
    })
    .await
    .map_err(map_picker_join)??;
    let label = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Engine resource".into());
    let mut lock = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    let grant = authority.grant_dialog(
        &path,
        label.clone(),
        crate::infra::path_authority::PathClass::SingleDialogGrant,
        crate::infra::path_authority::PathOperation::EngineResourceRead,
        Duration::from_secs(300),
        1,
    )?;
    authority.promote_engine_resource(
        &grant,
        if directory {
            crate::infra::path_authority::EngineResourceHandleKind::Directory
        } else {
            crate::infra::path_authority::EngineResourceHandleKind::File
        },
        label,
    )
}

#[derive(serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
struct EngineImageData {
    bytes: Vec<u8>,
    mime_type: String,
}

fn engine_image_mime_type(bytes: &[u8]) -> Result<&'static str, Error> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Ok("image/png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Ok("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Ok("image/gif")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Ok("image/webp")
    } else {
        Err(Error::InvalidInput(
            "engine image must be a PNG, JPEG, GIF, or WebP file".into(),
        ))
    }
}

/// Copies a picker-selected raster image into app-owned storage. The original
/// physical path is consumed natively and never serialized to the renderer.
#[tauri::command]
#[specta::specta]
async fn issue_engine_image(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::EngineImageHandle, Error> {
    use tauri_plugin_dialog::DialogExt;
    let picker_app = app.clone();
    let path = tokio::task::spawn_blocking(move || {
        picker_app
            .dialog()
            .file()
            .add_filter("Image", &["png", "jpg", "jpeg", "gif", "webp"])
            .blocking_pick_file()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| {
                Error::InvalidInput(format!("invalid native image selection: {error}"))
            })
    })
    .await
    .map_err(map_picker_join)??;
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || issue_engine_image_blocking(&authority, app, path))
        .await
}

fn issue_engine_image_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    app: tauri::AppHandle,
    path: PathBuf,
) -> Result<crate::infra::path_authority::EngineImageHandle, Error> {
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Engine image".into());
    let grant = {
        let mut lock = authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
        let authority = lock
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
        authority.grant_dialog(
            &path,
            display_name.clone(),
            crate::infra::path_authority::PathClass::SingleDialogGrant,
            crate::infra::path_authority::PathOperation::ImageRead,
            Duration::from_secs(300),
            1,
        )?
    };
    let (file, declared) = crate::infra::path_authority::engine_image_reader_for(
        authority,
        &crate::infra::path_authority::EngineImageHandle::new(grant),
        MAX_ENGINE_IMAGE_BYTES,
    )?;
    let bytes = crate::infra::path_authority::read_engine_image_bytes(
        file,
        declared,
        MAX_ENGINE_IMAGE_BYTES,
    )?;
    engine_image_mime_type(&bytes)?;
    let image_dir = app.path().app_data_dir()?.join("engine-images");
    std::fs::create_dir_all(&image_dir)?;
    let destination = image_dir.join(uuid::Uuid::new_v4().to_string());
    crate::infra::fs::atomic_replace(&destination, |file| {
        file.write_all(&bytes).map_err(Error::from)
    })?;
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .register_engine_image(&destination, display_name)
}

#[tauri::command]
#[specta::specta]
async fn read_engine_image(
    image: crate::infra::path_authority::EngineImageHandle,
    state: tauri::State<'_, AppState>,
) -> Result<EngineImageData, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || read_engine_image_blocking(&authority, image))
        .await
}

fn read_engine_image_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    image: crate::infra::path_authority::EngineImageHandle,
) -> Result<EngineImageData, Error> {
    let (file, declared) = crate::infra::path_authority::engine_image_reader_for(
        authority,
        &image,
        MAX_ENGINE_IMAGE_BYTES,
    )?;
    let bytes = crate::infra::path_authority::read_engine_image_bytes(
        file,
        declared,
        MAX_ENGINE_IMAGE_BYTES,
    )?;
    Ok(EngineImageData {
        mime_type: engine_image_mime_type(&bytes)?.into(),
        bytes,
    })
}

#[tauri::command]
#[specta::specta]
async fn issue_opening_book(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::OpeningBookHandle, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .blocking_pick_file()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| {
                Error::InvalidInput(format!("invalid opening book selection: {error}"))
            })
    })
    .await
    .map_err(map_picker_join)??;
    let label = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Opening book".into());
    state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .register_opening_book(&path, label)
}

#[tauri::command]
#[specta::specta]
async fn engine_archive_destination(
    root: crate::infra::path_authority::EngineRootHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::PathRef, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || engine_archive_destination_blocking(&authority, root))
        .await
}

fn engine_archive_destination_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    root: crate::infra::path_authority::EngineRootHandle,
) -> Result<crate::infra::path_authority::PathRef, Error> {
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .engine_archive_destination(&root)
}

#[tauri::command]
#[specta::specta]
async fn register_installed_engine(
    root: crate::infra::path_authority::EngineRootHandle,
    relative_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::EngineHandle, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || register_installed_engine_blocking(&authority, root, relative_path))
        .await
}

fn register_installed_engine_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    root: crate::infra::path_authority::EngineRootHandle,
    relative_path: String,
) -> Result<crate::infra::path_authority::EngineHandle, Error> {
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .register_installed_engine(&root, &relative_path)
}

#[tauri::command]
#[specta::specta]
async fn open_engine_workspace(
    app: tauri::AppHandle,
    root: crate::infra::path_authority::EngineRootHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || open_engine_workspace_blocking(&authority, app, root))
        .await
}

fn open_engine_workspace_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    app: tauri::AppHandle,
    root: crate::infra::path_authority::EngineRootHandle,
) -> Result<(), Error> {
    use tauri_plugin_opener::OpenerExt;
    let path = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .engine_root_path(&root)?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|error| Error::InvalidInput(format!("cannot open engine workspace: {error}")))
}

#[tauri::command]
#[specta::specta]
async fn list_path_capabilities(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<crate::infra::path_authority::PathDescriptor>, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || list_path_capabilities_blocking(&authority))
        .await
}

fn list_path_capabilities_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
) -> Result<Vec<crate::infra::path_authority::PathDescriptor>, Error> {
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))
        .map(crate::infra::path_authority::PathAuthority::descriptors)
}

#[tauri::command]
#[specta::specta]
async fn revoke_path_capability(
    id: crate::infra::path_authority::PathRef,
    state: tauri::State<'_, AppState>,
) -> Result<bool, Error> {
    // revoke_dialog is a HashMap::remove; a permit for a map removal is waste.
    state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))
        .map(|authority| authority.revoke_dialog(&id))
}

#[tauri::command]
#[specta::specta]
async fn promote_path_capability(
    id: crate::infra::path_authority::PathRef,
    path_class: crate::infra::path_authority::PathClass,
    display_name: String,
    operations: Vec<crate::infra::path_authority::PathOperation>,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::PathCommit, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || {
            promote_path_capability_blocking(&authority, id, path_class, display_name, operations)
        })
        .await
}

fn promote_path_capability_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    id: crate::infra::path_authority::PathRef,
    path_class: crate::infra::path_authority::PathClass,
    display_name: String,
    operations: Vec<crate::infra::path_authority::PathOperation>,
) -> Result<crate::infra::path_authority::PathCommit, Error> {
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .promote_dialog(&id, path_class, display_name, operations)
}

/// Whole-process budget for shutdown cleanup. Independent resources are reaped
/// concurrently; this remains a backstop for a teardown that never completes.
const SHUTDOWN_BUDGET: Duration = Duration::from_secs(15);

const EXIT_IDLE: u8 = 0;
const EXIT_RUNNING: u8 = 1;
const EXIT_DONE: u8 = 2;

#[derive(Debug, PartialEq, Eq)]
enum ExitDecision {
    StartCleanup,
    PreventExit,
    AllowExit,
}

#[derive(Default)]
struct ExitGuard(std::sync::atomic::AtomicU8);

impl ExitGuard {
    fn request(&self) -> ExitDecision {
        match self.0.compare_exchange(
            EXIT_IDLE,
            EXIT_RUNNING,
            std::sync::atomic::Ordering::SeqCst,
            std::sync::atomic::Ordering::SeqCst,
        ) {
            Ok(_) => ExitDecision::StartCleanup,
            Err(EXIT_RUNNING) => ExitDecision::PreventExit,
            Err(EXIT_DONE) => ExitDecision::AllowExit,
            Err(_) => ExitDecision::PreventExit,
        }
    }

    fn finish(&self) {
        self.0.store(EXIT_DONE, std::sync::atomic::Ordering::SeqCst);
    }
}

struct SoundServerLifecycle {
    shutdown: sound::SoundShutdownTx,
    join: tokio::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

impl SoundServerLifecycle {
    fn new(
        shutdown: Option<tokio::sync::oneshot::Sender<()>>,
        join: Option<tauri::async_runtime::JoinHandle<()>>,
    ) -> Self {
        Self {
            shutdown: sound::SoundShutdownTx(std::sync::Mutex::new(shutdown)),
            join: tokio::sync::Mutex::new(join),
        }
    }

    async fn shutdown_and_join(&self) -> Result<(), String> {
        let shutdown = self
            .shutdown
            .0
            .lock()
            .map_err(|_| "sound shutdown lock was poisoned".to_string())?
            .take();
        if let Some(shutdown) = shutdown {
            let _ = shutdown.send(());
        }
        let join = self.join.lock().await.take();
        if let Some(join) = join {
            join.await
                .map_err(|error| format!("sound server join failed: {error}"))?;
        }
        Ok(())
    }
}

/// Every teardown the process owns. Awaited before the event loop is allowed to
/// exit, because tao exits the process from inside `run()` — no `Drop` runs
/// afterwards and any child that was not reaped here is re-parented to init.
async fn shutdown_backend(
    supervisor: &EngineSupervisor,
    games: &GameManager,
    sound: Option<&SoundServerLifecycle>,
    budget: Duration,
) -> bool {
    log::info!("Shutdown requested: terminating engines and live games");
    let cleanup = async {
        let engines = supervisor.terminate_all();
        // Reserve half of the process-wide budget for the direct engine
        // fallback used when a game loop ignores its shutdown signal.
        let games = games.shutdown_all(budget / 2);
        let sound = async {
            if let Some(sound) = sound {
                sound.shutdown_and_join().await
            } else {
                Ok(())
            }
        };
        let (engines, games, sound) = tokio::join!(engines, games, sound);
        let mut failures = Vec::new();
        if let Err(error) = engines {
            failures.push(format!("engine teardown failed: {error}"));
        }
        if let Err(error) = games {
            failures.push(format!("game teardown failed: {error}"));
        }
        if let Err(error) = sound {
            failures.push(error);
        }
        failures
    };
    match tokio::time::timeout(budget, cleanup).await {
        Ok(failures) if failures.is_empty() => {
            log::info!("Shutdown cleanup finished");
            true
        }
        Ok(failures) => {
            log::error!("Shutdown cleanup failed: {}", failures.join("; "));
            false
        }
        Err(_) => {
            log::error!(
                "Shutdown budget of {budget:?} elapsed while engine, game, or sound teardown was still running"
            );
            false
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let specta_builder = tauri_specta::Builder::new()
        .commands(tauri_specta::collect_commands!(
            close_splashscreen,
            issue_pgn_workspace,
            issue_pgn_export_destination,
            save_board_snapshot,
            save_engine_logs,
            open_documentation,
            open_app_log,
            issue_download_destination,
            issue_database_workspace,
            get_database_workspace,
            list_workspace_databases,
            create_workspace_database,
            database_download_destination,
            issue_engine_workspace,
            get_engine_workspace,
            issue_engine_binary,
            issue_engine_resource,
            issue_engine_image,
            read_engine_image,
            issue_opening_book,
            engine_archive_destination,
            register_installed_engine,
            open_engine_workspace,
            issue_file_workspace,
            list_file_workspace,
            create_workspace_file,
            create_workspace_directory,
            move_workspace_entry,
            rename_workspace_file,
            trash_workspace_entry,
            restore_workspace_entry,
            permanently_delete_workspace_entry,
            list_path_capabilities,
            revoke_path_capability,
            promote_path_capability,
            get_best_moves,
            analyze_game,
            cancel_analysis,
            stop_engine,
            kill_engine,
            kill_engines,
            retire_engine,
            get_engine_logs,
            memory_size,
            get_puzzle,
            issue_puzzle_download_destination,
            issue_puzzle_workspace,
            get_puzzle_workspace,
            list_puzzle_databases,
            search_opening_name,
            get_opening_from_fen,
            get_opening_from_fens,
            get_opening_from_name,
            get_players_game_info,
            get_engine_config,
            file_exists,
            get_file_metadata,
            merge_players,
            convert_pgn,
            get_player,
            count_pgn_games,
            read_games,
            lex_pgn,
            is_bmi2_compatible,
            delete_game,
            delete_duplicated_games,
            delete_empty_games,
            clear_games,
            set_file_as_executable,
            delete_indexes,
            create_indexes,
            edit_db_info,
            delete_db_game,
            write_db_game,
            delete_database,
            export_to_pgn,
            authenticate,
            get_authentication_status,
            list_lichess_accounts,
            remove_lichess_account,
            migrate_legacy_lichess_token,
            get_authenticated_lichess_account,
            get_authenticated_lichess_explorer,
            get_public_lichess_json,
            write_game,
            download_file,
            download_engine_archive,
            download_lichess_games,
            cancel_download,
            get_tournaments,
            get_db_info,
            get_games,
            get_latest_game_timestamp,
            search_position,
            get_players,
            get_puzzle_db_info,
            get_puzzle_themes,
            get_themes_for_puzzle,
            delete_puzzle_database,
            start_game,
            get_game_state,
            make_game_move,
            take_back_game_move,
            resign_game,
            abort_game,
            get_game_engine_logs,
            preload_reference_db,
            get_progress,
            start_progress,
            set_progress_state,
            clear_progress,
            get_sound_server_port,
            download_chess_com_games,
            get_public_chess_com_json
        ))
        .events(tauri_specta::collect_events!(
            BestMovesPayload,
            ConvertProgress,
            DatabaseProgress,
            ProgressEvent,
            GameMoveEvent,
            ClockUpdateEvent,
            GameOverEvent
        ));

    #[cfg(debug_assertions)]
    specta_builder
        .export(
            Typescript::default().bigint(BigIntExportBehavior::BigInt),
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../src/bindings/generated.ts"),
        )
        .map_err(|error| format!("failed to export TypeScript bindings: {error}"))?;

    #[cfg(debug_assertions)]
    if std::env::args_os().any(|argument| argument == "--export-bindings-only") {
        return Ok(());
    }

    #[cfg(debug_assertions)]
    let log_targets = [TargetKind::Stdout, TargetKind::Webview];

    #[cfg(not(debug_assertions))]
    let log_targets = [
        TargetKind::Stdout,
        TargetKind::LogDir {
            file_name: Some(String::from("en-croissant.log")),
        },
    ];

    // Hoisted so the credential store can be constructed with the bundle identifier below; the
    // `--config` merge that `pnpm dev` applies is already resolved in here.
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets(log_targets.map(Target::new))
                .level(LevelFilter::Info)
                .build(),
        )
        .invoke_handler(specta_builder.invoke_handler())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .setup(move |app| {
            log::info!("Setting up application");
            // A debug build that carries the release identifier writes the installed release's
            // databases, engines and keyring entries.  `pnpm dev` merges tauri.dev.conf.json to
            // prevent that; `pnpm tauri dev` and a bare `cargo run` do not, and nothing else in the
            // process would say so.
            if cfg!(debug_assertions) && !app.config().identifier.ends_with(".dev") {
                log::warn!(
                    "development build running under the release identifier {} — it reads and \
                     writes the installed release's data. Start it with `pnpm dev`.",
                    app.config().identifier
                );
            }
            let credentials_dir = app.path().app_data_dir()?.join("credentials");
            app.state::<AppState>()
                .credentials
                .initialize(&credentials_dir)
                .map_err(|error| {
                    log::error!("native credential storage could not be initialized: {error}");
                    "native credential storage could not be initialized"
                })?;
            let authority_registry = app.path().app_config_dir()?.join("path-authority.json");
            let authority =
                crate::infra::path_authority::PathAuthority::open(authority_registry, vec![])
                    .map_err(|error| format!("path authority initialization failed: {error}"))?;
            *app.state::<AppState>()
                .pgn_path_authority
                .lock()
                .map_err(|_| "path authority lock poisoned")? = Some(authority);

            // #[cfg(any(windows, target_os = "macos"))]
            // set_shadow(&app.get_webview_window("main").unwrap(), true).unwrap();

            specta_builder.mount_events(app);

            #[cfg(target_os = "linux")]
            {
                let sound_dir = app
                    .path()
                    .resolve("sound", tauri::path::BaseDirectory::Resource)
                    .unwrap_or_else(|_| std::path::PathBuf::new());
                let (port, lifecycle) = if sound_dir.exists() {
                    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();
                    // Port 0 means "no sound server"; the renderer skips playback rather than
                    // requesting http://127.0.0.1:0/.  A construction failure is logged because it
                    // is otherwise indistinguishable from a build without sound resources — that
                    // silence is how the reactor panic in this very call reached a release.
                    match sound::create_sound_server(sound_dir, shutdown_rx) {
                        Ok((port, server)) => {
                            let join = tauri::async_runtime::spawn(server);
                            (
                                port,
                                SoundServerLifecycle::new(Some(shutdown_tx), Some(join)),
                            )
                        }
                        Err(error) => {
                            log::error!("sound server could not be started: {error}");
                            (0, SoundServerLifecycle::new(None, None))
                        }
                    }
                } else {
                    log::info!("no bundled sound resources found, sound stays disabled");
                    (0, SoundServerLifecycle::new(None, None))
                };
                app.manage(sound::SoundServerPort(port));
                app.manage(lifecycle);
            }
            #[cfg(not(target_os = "linux"))]
            app.manage(sound::SoundServerPort(0));

            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_cli::init())?;

            log::info!("Finished rust initialization");

            Ok(())
        })
        .manage(AppState {
            // The OS credential manager is shared by every build on the machine, so the store is
            // constructed with the running bundle identifier.  Injecting it here rather than
            // binding it later keeps "a store without a namespace" out of the running application.
            credentials: Arc::new(crate::credentials::CredentialManager::new(Arc::new(
                crate::credentials::OsCredentialStore::new(&context.config().identifier),
            ))),
            ..Default::default()
        })
        .build(context)?
        .run({
            let guard = Arc::new(ExitGuard::default());
            move |app, event| {
                let tauri::RunEvent::ExitRequested { api, .. } = &event else {
                    return;
                };
                match guard.request() {
                    ExitDecision::StartCleanup => api.prevent_exit(),
                    ExitDecision::PreventExit => {
                        api.prevent_exit();
                        return;
                    }
                    ExitDecision::AllowExit => return,
                }
                // Tao calls `process::exit` from inside `run()`, so nothing after
                // this point gets a second chance: the event loop has to stay
                // alive until the children are reaped.
                let app_handle = app.clone();
                let guard = guard.clone();
                tauri::async_runtime::spawn(async move {
                    // The cleanup runs in its own task so that a panic inside it
                    // arrives here as a `JoinError` instead of unwinding past the
                    // `exit` below.
                    let cleanup = tauri::async_runtime::spawn({
                        let app_handle = app_handle.clone();
                        async move {
                            let state = app_handle.state::<AppState>();
                            shutdown_backend(
                                state.engine_supervisor.as_ref(),
                                &state.game_manager,
                                app_handle.try_state::<SoundServerLifecycle>().as_deref(),
                                SHUTDOWN_BUDGET,
                            )
                            .await;
                        }
                    });
                    if let Err(error) = cleanup.await {
                        log::error!("shutdown cleanup did not finish: {error}");
                    }
                    // Unconditional, and outside the budget: a cleanup that hung
                    // or panicked must never leave a windowless process running.
                    guard.finish();
                    app_handle.exit(0);
                });
            }
        });

    Ok(())
}

#[tauri::command]
#[specta::specta]
fn is_bmi2_compatible() -> bool {
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    if is_x86_feature_detected!("bmi2") {
        return true;
    }
    false
}

#[tauri::command]
#[specta::specta]
fn memory_size() -> u32 {
    let total_bytes = sysinfo::System::new_all().total_memory();
    (total_bytes / 1024 / 1024) as u32
}

#[cfg(test)]
mod search_cache_tests {
    use super::*;
    use crate::db::SearchIndex;
    use tempfile::tempdir;

    #[test]
    fn bounded_cache_evicts_the_oldest_key() {
        let mut cache = BoundedSearchCache::default();
        cache.insert("first", 1, 2);
        cache.insert("second", 2, 2);
        cache.insert("third", 3, 2);
        assert_eq!(cache.get(&"first"), None);
        assert_eq!(cache.get(&"second"), Some(2));
        assert_eq!(cache.get(&"third"), Some(3));
    }

    #[test]
    fn database_and_index_revisions_do_not_share_cache_identity() {
        let directory = tempdir().unwrap();
        let first_database = directory.path().join("first.db");
        let second_database = directory.path().join("second.db");
        std::fs::write(&first_database, []).unwrap();
        std::fs::write(&second_database, []).unwrap();
        SearchIndex::default()
            .write_to(db::get_index_path(&first_database))
            .unwrap();
        let mut changed = SearchIndex::default();
        changed.entries.push(crate::db::SearchGameEntry {
            id: 1,
            white_id: 1,
            black_id: 2,
            date: None,
            result: Default::default(),
            pawn_home: 0,
            white_material: 0,
            black_material: 0,
            white_elo: 0,
            black_elo: 0,
            fen: None,
            moves: vec![],
        });
        changed
            .write_to(db::get_index_path(&second_database))
            .unwrap();

        let first = SearchIndexIdentity::for_database(
            &first_database,
            IndexSource::from_database(&first_database, 0).unwrap(),
        )
        .unwrap();
        let second = SearchIndexIdentity::for_database(
            &second_database,
            IndexSource::from_database(&second_database, 0).unwrap(),
        )
        .unwrap();
        assert_ne!(first, second);
        assert_ne!(first.database, second.database);
    }

    #[tokio::test]
    async fn generation_lock_is_shared_only_for_the_same_index_path() {
        let cache = SearchCache::default();
        let first = cache.generation_lock(PathBuf::from("one.ecsi"));
        let same = cache.generation_lock(PathBuf::from("one.ecsi"));
        let other = cache.generation_lock(PathBuf::from("two.ecsi"));
        let held = first.lock().await;
        assert!(same.try_lock().is_err());
        assert!(other.try_lock().is_ok());
        drop(held);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exit_requests_are_blocked_until_cleanup_is_done() {
        let guard = ExitGuard::default();
        assert!(
            matches!(guard.request(), ExitDecision::StartCleanup),
            "the first request must run the cleanup"
        );
        assert!(
            matches!(guard.request(), ExitDecision::PreventExit),
            "a second request must remain blocked while cleanup runs"
        );
        guard.finish();
        assert!(matches!(guard.request(), ExitDecision::AllowExit));
    }

    #[tokio::test]
    async fn shutdown_with_nothing_running_is_a_no_op_and_repeatable() {
        let supervisor = EngineSupervisor::default();
        let games = GameManager::new();
        assert!(shutdown_backend(&supervisor, &games, None, Duration::from_secs(30)).await);
        assert!(shutdown_backend(&supervisor, &games, None, Duration::from_secs(30)).await);
    }
}

#[cfg(test)]
mod blocking_offload_scans {
    use crate::infra::blocking::source_scan::body_at_indent;

    /// Asserting that a converted command merely *mentions* `BLOCKING_GATEWAY` does not pin the
    /// offload: moving the worker call back onto the command future and leaving a decoy
    /// `BLOCKING_GATEWAY.spawn(|| Ok(()))` behind would keep such a scan green, which is exactly
    /// the GTK-main-loop regression this range exists to prevent. So each command is paired with
    /// the worker it offloads, and the worker call must appear exactly once, after the gateway
    /// acquisition — i.e. inside the spawned closure.
    #[test]
    fn s1_converted_symbols_offload_their_worker_through_the_gateway() {
        let main = include_str!("main.rs");
        let puzzle = include_str!("puzzle.rs");
        // The argument text of the `BLOCKING_GATEWAY.spawn*(…)` call in `body`. Position alone is
        // not enough: `BLOCKING_GATEWAY.spawn(|| Ok(())).await?;` followed by a direct call to the
        // worker puts that call after the gateway token and still runs it on the command future.
        let gateway_closure = |body: &'static str, signature: &str| -> &'static str {
            let gateway = body
                .find("BLOCKING_GATEWAY")
                .unwrap_or_else(|| panic!("{signature} must acquire BLOCKING_GATEWAY: {body}"));
            let rest = &body[gateway..];
            let spawn = rest
                .find(".spawn")
                .unwrap_or_else(|| panic!("{signature} must call .spawn on the gateway: {body}"));
            let open = spawn
                + rest[spawn..]
                    .find('(')
                    .unwrap_or_else(|| panic!("{signature} must open the spawn call: {body}"));
            let mut depth = 0usize;
            for (offset, character) in rest[open..].char_indices() {
                match character {
                    '(' => depth += 1,
                    ')' => {
                        depth -= 1;
                        if depth == 0 {
                            return &rest[open + 1..open + offset];
                        }
                    }
                    _ => {}
                }
            }
            panic!("{signature} has an unbalanced spawn call: {body}");
        };
        let assert_offloads = move |source: &'static str, signature: &str, worker: &str| {
            let body = body_at_indent(source, signature);
            let call = format!("{worker}(");
            let occurrences = body.matches(call.as_str()).count();
            assert_eq!(
                occurrences, 1,
                "{signature} must call {call} exactly once, so the closure scan cannot be \
                 satisfied while a second call runs on the command future: {body}"
            );
            let closure = gateway_closure(body, signature);
            assert!(
                closure.contains(call.as_str()),
                "{signature} must call {call} inside the BLOCKING_GATEWAY closure, not on the \
                 command future; closure was {closure:?}: {body}"
            );
        };
        for (signature, worker) in [
            (
                "async fn save_native_export(",
                "save_native_export_blocking",
            ),
            ("async fn open_app_log(", "open_app_log_blocking"),
            (
                "async fn get_database_workspace(",
                "get_database_workspace_blocking",
            ),
            (
                "async fn list_workspace_databases(",
                "list_workspace_databases_blocking",
            ),
            (
                "async fn create_workspace_database(",
                "create_workspace_database_blocking",
            ),
            (
                "async fn database_download_destination(",
                "database_download_destination_blocking",
            ),
            (
                "async fn get_engine_workspace(",
                "get_engine_workspace_blocking",
            ),
            ("async fn read_engine_image(", "read_engine_image_blocking"),
            (
                "async fn engine_archive_destination(",
                "engine_archive_destination_blocking",
            ),
            (
                "async fn register_installed_engine(",
                "register_installed_engine_blocking",
            ),
            (
                "async fn open_engine_workspace(",
                "open_engine_workspace_blocking",
            ),
            (
                "async fn list_path_capabilities(",
                "list_path_capabilities_blocking",
            ),
            (
                "async fn promote_path_capability(",
                "promote_path_capability_blocking",
            ),
            (
                "async fn issue_engine_image(",
                "issue_engine_image_blocking",
            ),
        ] {
            assert_offloads(main, signature, worker);
        }
        // `get_puzzle_workspace` is the documented exception: `active_or_default_puzzle_workspace`
        // already is the blocking body, so no `*_blocking` wrapper was added (`e770bcdb`).
        for (signature, worker) in [
            (
                "pub async fn get_puzzle_workspace(",
                "active_or_default_puzzle_workspace",
            ),
            (
                "pub async fn issue_puzzle_download_destination(",
                "issue_puzzle_download_destination_blocking",
            ),
        ] {
            assert_offloads(puzzle, signature, worker);
        }
        for signature in [
            "async fn save_board_snapshot(",
            "async fn save_engine_logs(",
        ] {
            let body = body_at_indent(main, signature);
            assert!(
                body.contains("save_native_export"),
                "{signature} must forward to save_native_export: {body}"
            );
        }
    }

    #[test]
    fn s2_dialogs_precede_blocking_gateway() {
        let main = include_str!("main.rs");
        let save = body_at_indent(main, "async fn save_native_export(");
        let save_dialog = save
            .find("blocking_save_file")
            .expect("save_native_export must call blocking_save_file");
        let save_gateway = save
            .find("BLOCKING_GATEWAY")
            .expect("save_native_export must call BLOCKING_GATEWAY");
        assert!(
            save_dialog < save_gateway,
            "save_native_export must run blocking_save_file before BLOCKING_GATEWAY: {save}"
        );

        let image = body_at_indent(main, "async fn issue_engine_image(");
        let picker = image
            .find("blocking_pick_file")
            .expect("issue_engine_image must call blocking_pick_file");
        let image_gateway = image
            .find("BLOCKING_GATEWAY")
            .expect("issue_engine_image must call BLOCKING_GATEWAY");
        assert!(
            picker < image_gateway,
            "issue_engine_image must run the picker before BLOCKING_GATEWAY: {image}"
        );
    }

    #[test]
    fn s8_blocking_functions_do_not_nest_the_gateway() {
        for (file, source) in [
            ("main.rs", include_str!("main.rs")),
            ("puzzle.rs", include_str!("puzzle.rs")),
        ] {
            let mut search_from = 0;
            while let Some(rel) = source[search_from..].find("_blocking(") {
                let abs = search_from + rel;
                let line_start = source[..abs].rfind('\n').map(|i| i + 1).unwrap_or(0);
                let line_end = source[abs..]
                    .find('\n')
                    .map(|i| abs + i)
                    .unwrap_or(source.len());
                let line = &source[line_start..line_end];
                let trimmed = line.trim_start();
                let is_sync_fn = trimmed.starts_with("fn ")
                    || trimmed.starts_with("pub fn ")
                    || trimmed.starts_with("pub(crate) fn ");
                if is_sync_fn {
                    let name_start = trimmed.find("fn ").expect("sync fn prefix") + 3;
                    let name = trimmed[name_start..]
                        .split('(')
                        .next()
                        .expect("function name")
                        .trim();
                    let body = body_at_indent(source, &format!("fn {name}("));
                    for token in ["BLOCKING_GATEWAY", "block_on", "Handle::current", ".await"] {
                        assert!(
                            !body.contains(token),
                            "{file}::{name} must not nest a gateway acquisition (contains {token:?}): {body}"
                        );
                    }
                }
                search_from = abs + "_blocking(".len();
            }
        }

        // Workers that carry a blocking body without the `_blocking` suffix are invisible to the
        // walk above, so they are named here. `active_or_default_puzzle_workspace` is the
        // documented exception (`e770bcdb`, `d-20260903-06`): it already was the blocking body,
        // so no pass-through wrapper was added — and without this it would be the one offloaded
        // worker never checked for the nested acquisition that deadlocks the gateway.
        for (file, source, name) in [(
            "puzzle.rs",
            include_str!("puzzle.rs"),
            "active_or_default_puzzle_workspace",
        )] {
            let body = body_at_indent(source, &format!("fn {name}("));
            for token in ["BLOCKING_GATEWAY", "block_on", "Handle::current", ".await"] {
                assert!(
                    !body.contains(token),
                    "{file}::{name} must not nest a gateway acquisition (contains {token:?}): {body}"
                );
            }
        }
    }
}
