use std::{
    collections::VecDeque,
    convert::TryFrom,
    path::{Path, PathBuf},
    sync::Arc,
};

use diesel::{dsl::sql, sql_types::Bool, ExpressionMethods, QueryDsl, RunQueryDsl};
use serde::Serialize;
use specta::Type;
use tauri::Manager;

use crate::{
    db::{puzzle_themes, puzzles, themes, DatabaseIdentity, DatabaseRepository, Puzzle},
    error::Error,
    file_workspace::map_picker_join,
    infra::blocking::BLOCKING_GATEWAY,
};

#[derive(Debug, Clone, Eq, PartialEq)]
struct PuzzleCacheKey {
    database: DatabaseIdentity,
    min_rating: u16,
    max_rating: u16,
    theme: Option<String>,
}

#[derive(Debug, Default)]
pub struct PuzzleCache {
    puzzles: VecDeque<Puzzle>,
    key: Option<PuzzleCacheKey>,
}

impl PuzzleCache {
    pub fn new() -> Self {
        Self::default()
    }

    fn take(&mut self, key: &PuzzleCacheKey) -> Option<Puzzle> {
        if self.key.as_ref() == Some(key) {
            self.puzzles.pop_front()
        } else {
            None
        }
    }

    fn replace(&mut self, key: PuzzleCacheKey, puzzles: Vec<Puzzle>) {
        self.key = Some(key);
        self.puzzles = puzzles.into();
    }

    pub fn invalidate_database(&mut self, path: &std::path::Path) {
        if self
            .key
            .as_ref()
            .is_some_and(|key| key.database.path == path)
        {
            self.key = None;
            self.puzzles.clear();
        }
    }
}

fn validate_ratings(min_rating: u16, max_rating: u16) -> Result<(), Error> {
    if min_rating > max_rating {
        return Err(Error::InvalidInput(
            "minimum puzzle rating exceeds maximum rating".into(),
        ));
    }
    Ok(())
}

fn resolve_puzzle(
    state: &crate::AppState,
    file: &crate::infra::path_authority::PathRef,
    operation: crate::infra::path_authority::PathOperation,
) -> Result<crate::infra::path_authority::ResolvedPath, Error> {
    state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(file, operation, &[])
}

fn load_puzzles(
    repository: &DatabaseRepository,
    file: std::fs::File,
    expected_object: (u64, u64),
    min_rating: u16,
    max_rating: u16,
    theme: Option<&str>,
) -> Result<Vec<Puzzle>, Error> {
    let mut database_connection =
        repository.schema_specific_connection_expected_file(file, expected_object)?;
    let db = &mut *database_connection;
    let rows = if let Some(theme_name) = theme {
        puzzles::table
            .inner_join(puzzle_themes::table.inner_join(themes::table))
            .filter(themes::name.eq(theme_name))
            .filter(puzzles::rating.le(i32::from(max_rating)))
            .filter(puzzles::rating.ge(i32::from(min_rating)))
            .select(puzzles::all_columns)
            .order(sql::<Bool>("RANDOM()"))
            .limit(20)
            .load::<Puzzle>(db)?
    } else {
        puzzles::table
            .filter(puzzles::rating.le(i32::from(max_rating)))
            .filter(puzzles::rating.ge(i32::from(min_rating)))
            .order(sql::<Bool>("RANDOM()"))
            .limit(20)
            .load::<Puzzle>(db)?
    };
    Ok(rows)
}

fn load_puzzle_themes(
    repository: &DatabaseRepository,
    file: std::fs::File,
    expected_object: (u64, u64),
) -> Result<Vec<String>, Error> {
    let mut database_connection =
        repository.schema_specific_connection_expected_file(file, expected_object)?;
    let db = &mut *database_connection;
    themes::table
        .select(themes::name)
        .order(themes::name.asc())
        .load(db)
        .map_err(|error| {
            if error.to_string().contains("no such table: themes") {
                Error::PuzzleThemesUnavailable
            } else {
                Error::from(error)
            }
        })
}

fn puzzle_database_info(
    repository: &DatabaseRepository,
    path: &Path,
    file_handle: std::fs::File,
    expected_object: (u64, u64),
    file: crate::infra::path_authority::PathRef,
) -> Result<PuzzleDatabaseInfo, Error> {
    let metadata = file_handle.metadata()?;
    let mut database_connection =
        repository.schema_specific_connection_expected_file(file_handle, expected_object)?;
    let db = &mut *database_connection;
    let puzzle_count = puzzles::table.count().get_result::<i64>(db)?;
    let puzzle_count = i32::try_from(puzzle_count)
        .map_err(|_| Error::ResourceLimit("puzzle count exceeds IPC integer range".into()))?;
    let filename = path
        .file_name()
        .ok_or_else(|| Error::InvalidInput("puzzle database has no filename".into()))?
        .to_string_lossy()
        .into_owned();
    Ok(PuzzleDatabaseInfo {
        title: filename,
        description: String::new(),
        puzzle_count,
        storage_size: metadata.len(),
        path: file,
    })
}

async fn cache_key(
    repository: Arc<DatabaseRepository>,
    path: PathBuf,
    expected_object: (u64, u64),
    min_rating: u16,
    max_rating: u16,
    theme: Option<String>,
) -> Result<PuzzleCacheKey, Error> {
    let database = BLOCKING_GATEWAY
        .spawn(move || repository.database_identity_expected(&path, expected_object))
        .await?;
    Ok(PuzzleCacheKey {
        database,
        min_rating,
        max_rating,
        theme,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_puzzle(
    file: crate::infra::path_authority::PathRef,
    min_rating: u16,
    max_rating: u16,
    theme: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Puzzle, Error> {
    validate_ratings(min_rating, max_rating)?;
    let resolved = resolve_puzzle(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::PuzzleRead,
    )?;
    let path = resolved.puzzle_database_path()?;
    let expected_object = resolved.puzzle_database_identity()?;
    let repository = state.database_repository.clone();
    let key = cache_key(
        repository.clone(),
        path.clone(),
        expected_object,
        min_rating,
        max_rating,
        theme.clone(),
    )
    .await?;

    if let Some(puzzle) = state.puzzle_cache.lock().await.take(&key) {
        return Ok(puzzle);
    }

    let fetch_theme = theme.clone();
    let new_puzzles = BLOCKING_GATEWAY
        .spawn(move || {
            // Keep the exact authority-opened descriptor alive for the entire
            // SQLite operation; `fetch_path` is backend-only and never crosses IPC.
            let file_handle = resolved.puzzle_database_file()?;
            let _pinned = resolved;
            load_puzzles(
                repository.as_ref(),
                file_handle,
                expected_object,
                min_rating,
                max_rating,
                fetch_theme.as_deref(),
            )
        })
        .await?;

    let mut cache = state.puzzle_cache.lock().await;
    // A concurrent request may have populated this exact key while SQLite was
    // loading. Prefer its next item rather than discarding a valid sequence.
    if let Some(puzzle) = cache.take(&key) {
        return Ok(puzzle);
    }
    cache.replace(key.clone(), new_puzzles);
    cache.take(&key).ok_or(Error::NoPuzzles)
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PuzzleDatabaseInfo {
    title: String,
    description: String,
    puzzle_count: i32,
    storage_size: u64,
    path: crate::infra::path_authority::PathRef,
}

fn active_or_default_puzzle_workspace(
    app: &tauri::AppHandle,
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
) -> Result<crate::infra::path_authority::PuzzleRootDescriptor, Error> {
    let mut authority_lock = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    if let Some(workspace) = authority.active_puzzle_root()? {
        return Ok(workspace);
    }
    let path = app.path().app_data_dir()?.join("puzzles");
    std::fs::create_dir_all(&path)?;
    let root = authority.get_or_create_puzzle_root(&path, "Puzzles")?;
    authority.set_active_puzzle_root(&root)?;
    authority
        .active_puzzle_root()?
        .ok_or_else(|| Error::Conflict("new puzzle workspace became unavailable".into()))
}

#[tauri::command]
#[specta::specta]
pub async fn issue_puzzle_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<crate::infra::path_authority::PuzzleRootDescriptor, Error> {
    use tauri_plugin_dialog::DialogExt;
    let path = tokio::task::spawn_blocking(move || {
        app.dialog()
            .file()
            .blocking_pick_folder()
            .ok_or(Error::Cancellation)?
            .into_path()
            .map_err(|error| Error::InvalidInput(format!("invalid native file selection: {error}")))
    })
    .await
    .map_err(map_picker_join)??;
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || issue_puzzle_workspace_blocking(&authority, path))
        .await
}

fn issue_puzzle_workspace_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    path: PathBuf,
) -> Result<crate::infra::path_authority::PuzzleRootDescriptor, Error> {
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Puzzles".into());
    let mut authority_lock = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    let root = authority.get_or_create_puzzle_root(&path, display_name)?;
    authority.set_active_puzzle_root(&root)?;
    authority
        .active_puzzle_root()?
        .ok_or_else(|| Error::Conflict("selected puzzle workspace became unavailable".into()))
}

#[tauri::command]
#[specta::specta]
pub async fn get_puzzle_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<crate::infra::path_authority::PuzzleRootDescriptor, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    // `active_or_default_puzzle_workspace` already holds the whole body, so it is the blocking
    // function; a `get_puzzle_workspace_blocking` forwarding to it would be a pass-through.
    BLOCKING_GATEWAY
        .spawn(move || active_or_default_puzzle_workspace(&app, &authority))
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn issue_puzzle_download_destination(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<crate::infra::path_authority::PathRef, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    BLOCKING_GATEWAY
        .spawn(move || issue_puzzle_download_destination_blocking(&authority, app))
        .await
}

fn issue_puzzle_download_destination_blocking(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    app: tauri::AppHandle,
) -> Result<crate::infra::path_authority::PathRef, Error> {
    let workspace = active_or_default_puzzle_workspace(&app, authority)?;
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .puzzle_download_destination(&workspace.root)
}

#[tauri::command]
#[specta::specta]
pub async fn list_puzzle_databases(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<PuzzleDatabaseInfo>, Error> {
    let authority = std::sync::Arc::clone(&state.pgn_path_authority);
    let files = BLOCKING_GATEWAY
        .spawn(move || list_puzzle_databases_blocking(&app, &authority))
        .await?;
    let mut databases = Vec::with_capacity(files.len());
    for file in files {
        databases.push(puzzle_database_info_for_file(&state, file.file).await?);
    }
    Ok(databases)
}

fn list_puzzle_databases_blocking(
    app: &tauri::AppHandle,
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
) -> Result<Vec<crate::infra::path_authority::PuzzleDatabaseDescriptor>, Error> {
    let workspace = active_or_default_puzzle_workspace(app, authority)?;
    authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .list_puzzle_children(&workspace.root)
}

async fn puzzle_database_info_for_file(
    state: &crate::AppState,
    file: crate::infra::path_authority::PathRef,
) -> Result<PuzzleDatabaseInfo, Error> {
    let resolved = resolve_puzzle(
        state,
        &file,
        crate::infra::path_authority::PathOperation::PuzzleRead,
    )?;
    let expected_object = resolved.puzzle_database_identity()?;
    let file_handle = resolved.puzzle_database_file()?;
    let path = resolved.puzzle_database_path()?;
    let repository = state.database_repository.clone();
    BLOCKING_GATEWAY
        .spawn(move || {
            let _pinned = resolved;
            puzzle_database_info(
                repository.as_ref(),
                &path,
                file_handle,
                expected_object,
                file,
            )
        })
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn get_puzzle_db_info(
    file: crate::infra::path_authority::PathRef,
    state: tauri::State<'_, crate::AppState>,
) -> Result<PuzzleDatabaseInfo, Error> {
    let resolved = resolve_puzzle(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::PuzzleRead,
    )?;
    let expected_object = resolved.puzzle_database_identity()?;
    let file_handle = resolved.puzzle_database_file()?;
    let path = resolved.puzzle_database_path()?;
    let repository = state.database_repository.clone();
    BLOCKING_GATEWAY
        .spawn(move || {
            let _pinned = resolved;
            puzzle_database_info(
                repository.as_ref(),
                &path,
                file_handle,
                expected_object,
                file,
            )
        })
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_puzzle_database(
    file: crate::infra::path_authority::PathRef,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), Error> {
    let resolved = resolve_puzzle(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::PuzzleDelete,
    )?;
    let path = resolved.puzzle_database_path()?;
    let repository = state.database_repository.clone();
    let deleted_path = path.clone();
    BLOCKING_GATEWAY
        .spawn(move || {
            repository.delete_exclusive(&path, || match resolved.delete_puzzle_database() {
                Ok(()) => Ok(()),
                Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(error) => Err(error),
            })
        })
        .await?;
    state
        .puzzle_cache
        .lock()
        .await
        .invalidate_database(&deleted_path);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_puzzle_themes(
    file: crate::infra::path_authority::PathRef,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<String>, Error> {
    let resolved = resolve_puzzle(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::PuzzleRead,
    )?;
    let expected_object = resolved.puzzle_database_identity()?;
    let file_handle = resolved.puzzle_database_file()?;
    let repository = state.database_repository.clone();
    BLOCKING_GATEWAY
        .spawn(move || {
            let _pinned = resolved;
            load_puzzle_themes(repository.as_ref(), file_handle, expected_object)
        })
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn get_themes_for_puzzle(
    file: crate::infra::path_authority::PathRef,
    puzzle_id: i32,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<String>, Error> {
    let resolved = resolve_puzzle(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::PuzzleRead,
    )?;
    let expected_object = resolved.puzzle_database_identity()?;
    let file_handle = resolved.puzzle_database_file()?;
    let repository = state.database_repository.clone();
    BLOCKING_GATEWAY
        .spawn(move || {
            let _pinned = resolved;
            let mut database_connection = repository
                .schema_specific_connection_expected_file(file_handle, expected_object)?;
            let db = &mut *database_connection;
            Ok(themes::table
                .inner_join(puzzle_themes::table)
                .filter(puzzle_themes::puzzle_id.eq(puzzle_id))
                .select(themes::name)
                .order(themes::name.asc())
                .load(db)?)
        })
        .await
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use diesel::connection::SimpleConnection;

    use super::*;

    fn puzzle_database(
        name: &str,
        rating: i32,
    ) -> (tempfile::TempDir, PathBuf, DatabaseRepository) {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(name);
        let repository = DatabaseRepository::default();
        let mut database_connection = repository.schema_specific_connection(&path).unwrap();
        let db = &mut *database_connection;
        db.batch_execute(
            "CREATE TABLE puzzles (id INTEGER PRIMARY KEY, fen TEXT NOT NULL, moves TEXT NOT NULL, rating INTEGER NOT NULL, rating_deviation INTEGER NOT NULL, popularity INTEGER NOT NULL, nb_plays INTEGER NOT NULL);
             CREATE TABLE themes (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
             CREATE TABLE puzzle_themes (puzzle_id INTEGER NOT NULL, theme_id INTEGER NOT NULL);",
        )
        .unwrap();
        db.batch_execute(&format!(
            "INSERT INTO puzzles VALUES (1, 'fen-{rating}', 'e2e4', {rating}, 10, 1, 1); INSERT INTO themes VALUES (1, 'fork'); INSERT INTO puzzle_themes VALUES (1, 1);"
        ))
        .unwrap();
        db.batch_execute("PRAGMA wal_checkpoint(TRUNCATE);")
            .unwrap();
        drop(database_connection);
        (directory, path, repository)
    }

    #[test]
    fn alternate_databases_and_short_sets_never_reuse_a_stale_puzzle() {
        let (_one_dir, one_path, one_repository) = puzzle_database("one.db", 1200);
        let (_two_dir, two_path, two_repository) = puzzle_database("two.db", 2200);
        let one_identity = one_repository.database_identity(&one_path).unwrap();
        let two_identity = two_repository.database_identity(&two_path).unwrap();
        let one_key = PuzzleCacheKey {
            database: one_identity,
            min_rating: 1000,
            max_rating: 1500,
            theme: None,
        };
        let two_key = PuzzleCacheKey {
            database: two_identity,
            min_rating: 2000,
            max_rating: 2500,
            theme: Some("fork".into()),
        };
        let one_object = crate::infra::path_authority::opened_file_identity(
            &std::fs::File::open(&one_path).unwrap(),
        )
        .unwrap();
        let one = load_puzzles(
            &one_repository,
            std::fs::File::open(&one_path).unwrap(),
            one_object,
            1000,
            1500,
            None,
        )
        .unwrap();
        assert_eq!(one.len(), 1);
        let two_object = crate::infra::path_authority::opened_file_identity(
            &std::fs::File::open(&two_path).unwrap(),
        )
        .unwrap();
        let two = load_puzzles(
            &two_repository,
            std::fs::File::open(&two_path).unwrap(),
            two_object,
            2000,
            2500,
            Some("fork"),
        )
        .unwrap();
        assert_eq!(two.len(), 1);

        let mut cache = PuzzleCache::new();
        cache.replace(one_key.clone(), one);
        assert_eq!(cache.take(&one_key).unwrap().rating, 1200);
        assert!(cache.take(&one_key).is_none());
        cache.replace(two_key.clone(), two);
        assert_eq!(cache.take(&two_key).unwrap().rating, 2200);
    }

    #[test]
    fn database_invalidation_removes_only_that_database_cache_entry() {
        let (_dir, path, repository) = puzzle_database("one.db", 1200);
        let key = PuzzleCacheKey {
            database: repository.database_identity(&path).unwrap(),
            min_rating: 0,
            max_rating: u16::MAX,
            theme: None,
        };
        let mut cache = PuzzleCache::new();
        cache.replace(key, vec![]);
        cache.invalidate_database(&path.canonicalize().unwrap());
        assert!(cache.key.is_none());
    }

    #[test]
    fn invalid_rating_range_is_rejected_before_querying() {
        assert!(validate_ratings(2000, 1000).is_err());
    }

    #[test]
    fn puzzle_capability_is_operation_specific_and_replacement_is_rejected() {
        let (directory, path, _repository) = puzzle_database("one.db3", 1200);
        let mut authority = crate::infra::path_authority::PathAuthority::open(
            directory.path().join("registry.json"),
            vec![],
        )
        .unwrap();
        let capability = authority
            .grant_dialog_operations(
                &path,
                "Puzzle database",
                crate::infra::path_authority::PathClass::BoundedDialogGrant,
                vec![crate::infra::path_authority::PathOperation::PuzzleRead],
                Duration::from_secs(60),
                4,
            )
            .unwrap();
        let resolved = authority
            .resolve(
                &capability,
                crate::infra::path_authority::PathOperation::PuzzleRead,
                &[],
            )
            .unwrap();
        assert_eq!(resolved.puzzle_database_path().unwrap(), path);
        assert!(authority
            .resolve(
                &capability,
                crate::infra::path_authority::PathOperation::PuzzleDelete,
                &[],
            )
            .is_err());

        std::fs::remove_file(&path).unwrap();
        std::fs::write(&path, b"replacement").unwrap();
        assert!(authority
            .resolve(
                &capability,
                crate::infra::path_authority::PathOperation::PuzzleRead,
                &[],
            )
            .is_err());
    }

    #[test]
    fn persistent_puzzle_descriptor_survives_restart_and_rejects_replacement() {
        let (directory, path, _repository) = puzzle_database("persistent.db3", 1200);
        let registry = directory.path().join("registry.json");
        let operations = vec![
            crate::infra::path_authority::PathOperation::PuzzleRead,
            crate::infra::path_authority::PathOperation::PuzzleDelete,
        ];
        let first = crate::infra::path_authority::PathAuthority::open(registry.clone(), vec![])
            .unwrap()
            .get_or_create_persistent_file(&path, "Persistent puzzle database", operations.clone())
            .unwrap();
        let mut reopened =
            crate::infra::path_authority::PathAuthority::open(registry, vec![]).unwrap();
        let second = reopened
            .get_or_create_persistent_file(&path, "Persistent puzzle database", operations.clone())
            .unwrap();
        assert_eq!(first.id, second.id);

        std::fs::remove_file(&path).unwrap();
        std::fs::write(&path, b"replacement").unwrap();
        assert!(reopened
            .get_or_create_persistent_file(&path, "Persistent puzzle database", operations)
            .is_err());
    }

    #[test]
    fn puzzle_query_rejects_replacement_after_authority_identity_was_captured() {
        let (directory, path, repository) = puzzle_database("original.db3", 1200);
        let expected = crate::infra::path_authority::opened_file_identity(
            &std::fs::File::open(&path).unwrap(),
        )
        .unwrap();
        let replacement = directory.path().join("replacement.db3");
        let mut replacement_connection =
            repository.schema_specific_connection(&replacement).unwrap();
        replacement_connection
            .batch_execute(
                "CREATE TABLE puzzles (id INTEGER PRIMARY KEY, fen TEXT NOT NULL, moves TEXT NOT NULL, rating INTEGER NOT NULL, rating_deviation INTEGER NOT NULL, popularity INTEGER NOT NULL, nb_plays INTEGER NOT NULL);\
                 CREATE TABLE themes (id INTEGER PRIMARY KEY, name TEXT NOT NULL);\
                 CREATE TABLE puzzle_themes (puzzle_id INTEGER NOT NULL, theme_id INTEGER NOT NULL);\
                 INSERT INTO puzzles VALUES (1, 'replacement', 'e2e4', 2200, 10, 1, 1);",
            )
            .unwrap();
        drop(replacement_connection);
        std::fs::rename(replacement, &path).unwrap();

        assert!(load_puzzles(
            &repository,
            std::fs::File::open(&path).unwrap(),
            expected,
            0,
            u16::MAX,
            None,
        )
        .is_err());
    }

    #[cfg(unix)]
    #[test]
    fn retained_authority_descriptor_queries_original_database_after_path_swap() {
        let (directory, path, repository) = puzzle_database("original.db3", 1200);
        let retained_file = std::fs::File::open(&path).unwrap();
        let expected = crate::infra::path_authority::opened_file_identity(&retained_file).unwrap();
        let replacement = directory.path().join("replacement.db3");
        let mut replacement_connection =
            repository.schema_specific_connection(&replacement).unwrap();
        replacement_connection
            .batch_execute(
                "CREATE TABLE puzzles (id INTEGER PRIMARY KEY, fen TEXT NOT NULL, moves TEXT NOT NULL, rating INTEGER NOT NULL, rating_deviation INTEGER NOT NULL, popularity INTEGER NOT NULL, nb_plays INTEGER NOT NULL);\
                 CREATE TABLE themes (id INTEGER PRIMARY KEY, name TEXT NOT NULL);\
                 CREATE TABLE puzzle_themes (puzzle_id INTEGER NOT NULL, theme_id INTEGER NOT NULL);\
                 INSERT INTO puzzles VALUES (1, 'replacement', 'e2e4', 2200, 10, 1, 1);",
            )
            .unwrap();
        drop(replacement_connection);
        std::fs::rename(replacement, &path).unwrap();

        let rows = load_puzzles(&repository, retained_file, expected, 0, u16::MAX, None).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].rating, 1200);
    }

    #[test]
    fn invalid_puzzle_schema_is_reported_as_an_error() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("invalid.db3");
        let repository = DatabaseRepository::default();
        // Opening this creates a valid SQLite file with no puzzle tables.
        drop(repository.schema_specific_connection(&path).unwrap());
        let object = crate::infra::path_authority::opened_file_identity(
            &std::fs::File::open(&path).unwrap(),
        )
        .unwrap();
        assert!(load_puzzles(
            &repository,
            std::fs::File::open(&path).unwrap(),
            object,
            0,
            u16::MAX,
            None,
        )
        .is_err());
    }

    fn opened_identity(path: &Path) -> (u64, u64) {
        crate::infra::path_authority::opened_file_identity(&std::fs::File::open(path).unwrap())
            .unwrap()
    }

    fn serialized_payload(error: &Error) -> (String, serde_json::Value) {
        let serialized = serde_json::to_string(error).expect("serialize error");
        let payload = serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        (serialized, payload)
    }

    #[test]
    fn missing_themes_table_is_puzzle_themes_unavailable() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("empty-themes.db3");
        let repository = DatabaseRepository::default();
        drop(repository.schema_specific_connection(&path).unwrap());
        let object = opened_identity(&path);
        let error = load_puzzle_themes(&repository, std::fs::File::open(&path).unwrap(), object)
            .expect_err("empty schema must report missing puzzle themes");
        let (_serialized, payload) = serialized_payload(&error);
        assert_eq!(payload["category"], "puzzle-themes-unavailable");
        assert!(matches!(error, Error::PuzzleThemesUnavailable));
    }

    #[test]
    fn themes_table_without_name_is_a_database_failure_without_sql() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("themes-without-name.db3");
        let repository = DatabaseRepository::default();
        let mut database_connection = repository.schema_specific_connection(&path).unwrap();
        database_connection
            .batch_execute("CREATE TABLE themes (id INTEGER PRIMARY KEY);")
            .unwrap();
        database_connection
            .batch_execute("PRAGMA wal_checkpoint(TRUNCATE);")
            .unwrap();
        drop(database_connection);
        let object = opened_identity(&path);
        let error = load_puzzle_themes(&repository, std::fs::File::open(&path).unwrap(), object)
            .expect_err("themes without name must stay a diesel failure");
        let (serialized, payload) = serialized_payload(&error);
        assert_eq!(payload["category"], "database");
        assert!(matches!(error, Error::Diesel(_)));
        let source = std::error::Error::source(&error).expect("Diesel keeps its cause");
        let source_text = source.to_string();
        assert!(
            !source_text.contains("no such table"),
            "arm 2 must not be a missing table, got {source_text}"
        );
        assert!(
            !serialized.contains(&source_text),
            "SQL fragment leaked on the wire: {serialized}"
        );
    }

    #[test]
    fn themed_load_puzzles_missing_themes_stays_a_database_failure() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("themed-without-themes.db3");
        let repository = DatabaseRepository::default();
        let mut database_connection = repository.schema_specific_connection(&path).unwrap();
        database_connection
            .batch_execute(
                "CREATE TABLE puzzles (id INTEGER PRIMARY KEY, fen TEXT NOT NULL, moves TEXT NOT NULL, rating INTEGER NOT NULL, rating_deviation INTEGER NOT NULL, popularity INTEGER NOT NULL, nb_plays INTEGER NOT NULL);
                 CREATE TABLE puzzle_themes (puzzle_id INTEGER NOT NULL, theme_id INTEGER NOT NULL);
                 INSERT INTO puzzles VALUES (1, 'fen', 'e2e4', 1200, 10, 1, 1);"
            )
            .unwrap();
        database_connection
            .batch_execute("PRAGMA wal_checkpoint(TRUNCATE);")
            .unwrap();
        drop(database_connection);
        let object = opened_identity(&path);
        let error = load_puzzles(
            &repository,
            std::fs::File::open(&path).unwrap(),
            object,
            0,
            u16::MAX,
            Some("fork"),
        )
        .expect_err("themed load without themes must stay a diesel failure");
        let (serialized, payload) = serialized_payload(&error);
        assert_eq!(payload["category"], "database");
        assert!(matches!(error, Error::Diesel(_)));
        let source = std::error::Error::source(&error).expect("Diesel keeps its cause");
        let source_text = source.to_string();
        assert!(
            source_text.contains("no such table: themes"),
            "arm 3 must see SQLite's missing themes table on source(), got {source_text}"
        );
        assert!(!serialized.contains("no such table: themes"));
    }
}
