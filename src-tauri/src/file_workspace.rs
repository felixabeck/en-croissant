//! Native PGN collection management.
//!
//! This is deliberately the only layer that knows collection filenames. The renderer receives
//! opaque [`FileWorkspaceHandle`] values plus safe display metadata; it never receives an OS
//! path or sends one back for a PGN operation.

use crate::{
    error::Error,
    infra::blocking::BLOCKING_GATEWAY,
    infra::cancellable_lock::lock_std_cancellable,
    infra::path_authority::{
        workspace_sidecar_leaf as sidecar_leaf, CommitDurability, FileWorkspaceDescriptor,
        FileWorkspaceHandle, PathAuthority, PathClass, PathOperation, PathRef,
        WorkspaceMutationTarget, WorkspaceRemovalStatus,
    },
    pgn, AppState,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
    time::{Duration, UNIX_EPOCH},
};
use tokio_util::sync::CancellationToken;

const TRASH_DIRECTORY: &str = ".en-croissant-trash";
const MAX_WORKSPACE_METADATA_BYTES: usize = 1024 * 1024;
const METADATA_LIMIT_MESSAGE: &str = "PGN metadata exceeds the supported size limit";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceEntryKind {
    File,
    Directory,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceFileType {
    Repertoire,
    Game,
    Tournament,
    Puzzle,
    Other,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadata {
    #[serde(rename = "type")]
    pub file_type: WorkspaceFileType,
    pub tags: Vec<String>,
}

impl Default for WorkspaceMetadata {
    fn default() -> Self {
        Self {
            file_type: WorkspaceFileType::Other,
            tags: vec![],
        }
    }
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub handle: FileWorkspaceHandle,
    pub kind: WorkspaceEntryKind,
    pub name: String,
    pub children: Vec<WorkspaceEntry>,
    pub metadata: Option<WorkspaceMetadata>,
    pub game_count: Option<i32>,
    pub last_modified: i64,
}

fn authority(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
) -> Result<MutexGuard<'_, Option<PathAuthority>>, Error> {
    pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))
}

fn validate_name(name: &str) -> Result<&str, Error> {
    let name = name.trim();
    if name.is_empty()
        || name == "."
        || name == ".."
        || name == TRASH_DIRECTORY
        || name.contains(['/', '\\', '\0'])
        || name.ends_with(".info")
    {
        return Err(Error::InvalidInput("invalid workspace basename".into()));
    }
    Ok(name)
}

fn pgn_name(name: &str) -> Result<String, Error> {
    let name = validate_name(name)?;
    Ok(if name.to_ascii_lowercase().ends_with(".pgn") {
        name.to_string()
    } else {
        format!("{name}.pgn")
    })
}

#[cfg(test)]
fn info_path(pgn: &Path) -> Result<PathBuf, Error> {
    let leaf = pgn
        .file_name()
        .ok_or_else(|| Error::InvalidInput("PGN has no filename".into()))?;
    Ok(pgn.with_file_name(sidecar_leaf(leaf)?))
}

fn serialize_metadata(metadata: &WorkspaceMetadata) -> Result<Vec<u8>, Error> {
    let bytes =
        serde_json::to_vec(metadata).map_err(|error| Error::InvalidInput(error.to_string()))?;
    if bytes.len() > MAX_WORKSPACE_METADATA_BYTES {
        return Err(Error::ResourceLimit(METADATA_LIMIT_MESSAGE.into()));
    }
    Ok(bytes)
}

fn metadata_from(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace: &FileWorkspaceHandle,
    path: &Path,
) -> Result<WorkspaceMetadata, Error> {
    let components = workspace_components(pgn_path_authority, workspace, path)?;
    let mut sidecar = {
        let mut guard = authority(pgn_path_authority)?;
        let authority = guard
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
        authority.open_workspace_metadata(workspace, &components)?
    };
    let Some(sidecar) = sidecar.as_mut() else {
        return Ok(WorkspaceMetadata::default());
    };
    let declared = sidecar.metadata()?.len();
    let bytes = crate::infra::fs::read_bounded_bytes(
        sidecar,
        declared,
        MAX_WORKSPACE_METADATA_BYTES,
        METADATA_LIMIT_MESSAGE,
        || Ok(()),
    )?;
    serde_json::from_slice(&bytes)
        .map_err(|error| Error::InvalidInput(format!("invalid PGN metadata: {error}")))
}

fn timestamp(path: &Path) -> Result<i64, Error> {
    let modified = fs::metadata(path)?.modified()?;
    Ok(modified
        .duration_since(UNIX_EPOCH)
        .map_err(|error| Error::InvalidInput(format!("invalid modification time: {error}")))?
        .as_secs() as i64)
}

fn workspace_root(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace: &FileWorkspaceHandle,
) -> Result<PathBuf, Error> {
    authority(pgn_path_authority)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .workspace_root(workspace, PathOperation::ReadPgn)
}

#[cfg(unix)]
fn mutation_target(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    entry: &FileWorkspaceHandle,
) -> Result<WorkspaceMutationTarget, Error> {
    authority(pgn_path_authority)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .workspace_mutation_target(entry)
}

fn durability_uncertainty(
    outcome: crate::infra::fs::AtomicFileOutcome,
    stage: crate::error::DurabilityStage,
) -> Option<crate::error::DurabilityStage> {
    crate::infra::fs::map_atomic_file_outcome(outcome, stage, |error| {
        log::warn!("{stage} parent sync failed: {error}");
    })
}

fn ensure_registered_descendant(
    root: &WorkspaceMutationTarget,
    entry: &WorkspaceMutationTarget,
) -> Result<(), Error> {
    entry
        .path()
        .strip_prefix(root.path())
        .map_err(|_| Error::InvalidInput("workspace entry escapes its root".into()))?;
    Ok(())
}

fn workspace_components(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace: &FileWorkspaceHandle,
    path: &Path,
) -> Result<Vec<std::ffi::OsString>, Error> {
    let root = workspace_root(pgn_path_authority, workspace)?;
    let relative = path
        .strip_prefix(&root)
        .map_err(|_| Error::InvalidInput("workspace entry escapes its root".into()))?;
    Ok(relative
        .components()
        .map(|component| component.as_os_str().to_os_string())
        .collect())
}

fn register_entry(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace: &FileWorkspaceHandle,
    path: &Path,
    display_name: String,
) -> Result<FileWorkspaceHandle, Error> {
    let components = workspace_components(pgn_path_authority, workspace, path)?;
    authority(pgn_path_authority)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .register_workspace_child(workspace, &components, display_name)
}

#[cfg(unix)]
fn register_created_entry(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace: &FileWorkspaceHandle,
    path: &Path,
    display_name: String,
    identity: (u64, u64),
    is_dir: bool,
) -> Result<FileWorkspaceHandle, Error> {
    let components = workspace_components(pgn_path_authority, workspace, path)?;
    authority(pgn_path_authority)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .register_workspace_child_expected(workspace, &components, display_name, identity, is_dir)
}

pub(crate) fn map_picker_join(error: tokio::task::JoinError) -> Error {
    if error.is_cancelled() {
        Error::Cancellation
    } else {
        Error::InvalidInput("native picker task failed".into())
    }
}

// A pre-existing synchronous helper is the blocking body and gets no pass-through
// wrapper, so the command holds the spawn. Same keep-name rule as puzzle.rs:
// `collect_tree_entries`, `create_workspace_directory_inner`, `trash_entry`,
// `restore_entry`.
fn collect_tree_entries(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace: &FileWorkspaceHandle,
    token: &CancellationToken,
) -> Result<(Vec<WorkspaceEntry>, Vec<FileWorkspaceHandle>), Error> {
    fn visit(
        pgn_path_authority: &Mutex<Option<PathAuthority>>,
        workspace: &FileWorkspaceHandle,
        path: PathBuf,
        missing: &mut Vec<FileWorkspaceHandle>,
        token: &CancellationToken,
    ) -> Result<Option<WorkspaceEntry>, Error> {
        if token.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let meta = fs::symlink_metadata(&path)?;
        if meta.file_type().is_symlink()
            || path.file_name().is_some_and(|name| name == TRASH_DIRECTORY)
        {
            return Ok(None);
        }
        let name = path
            .file_name()
            .ok_or_else(|| Error::InvalidInput("workspace entry has no name".into()))?
            .to_string_lossy()
            .into_owned();
        if meta.is_dir() {
            let handle = register_entry(pgn_path_authority, workspace, &path, name.clone())?;
            if token.is_cancelled() {
                return Err(Error::Cancellation);
            }
            let mut children = Vec::new();
            for entry in fs::read_dir(&path)? {
                if token.is_cancelled() {
                    return Err(Error::Cancellation);
                }
                children.push(entry?.path());
            }
            children.sort();
            let mut output = Vec::new();
            for child in children {
                if token.is_cancelled() {
                    return Err(Error::Cancellation);
                }
                if let Some(entry) = visit(pgn_path_authority, workspace, child, missing, token)? {
                    output.push(entry);
                }
            }
            return Ok(Some(WorkspaceEntry {
                handle,
                kind: WorkspaceEntryKind::Directory,
                name,
                children: output,
                metadata: None,
                game_count: None,
                last_modified: timestamp(&path)?,
            }));
        }
        if !meta.is_file() || !name.to_ascii_lowercase().ends_with(".pgn") {
            return Ok(None);
        }
        let handle = register_entry(
            pgn_path_authority,
            workspace,
            &path,
            name.trim_end_matches(".pgn").to_string(),
        )?;
        missing.push(handle.clone());
        Ok(Some(WorkspaceEntry {
            handle,
            kind: WorkspaceEntryKind::File,
            name: name.trim_end_matches(".pgn").to_string(),
            children: vec![],
            metadata: Some(metadata_from(pgn_path_authority, workspace, &path)?),
            game_count: None,
            last_modified: timestamp(&path)?,
        }))
    }

    if token.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let root = workspace_root(pgn_path_authority, workspace)?;
    let mut paths = Vec::new();
    for entry in fs::read_dir(root)? {
        if token.is_cancelled() {
            return Err(Error::Cancellation);
        }
        paths.push(entry?.path());
    }
    paths.sort();
    let mut entries = Vec::new();
    let mut missing = Vec::new();
    for path in paths {
        if token.is_cancelled() {
            return Err(Error::Cancellation);
        }
        if let Some(entry) = visit(pgn_path_authority, workspace, path, &mut missing, token)? {
            entries.push(entry);
        }
    }
    Ok((entries, missing))
}

fn set_workspace_game_count(
    entries: &mut [WorkspaceEntry],
    handle: &FileWorkspaceHandle,
    game_count: i32,
) {
    for entry in entries {
        if &entry.handle == handle {
            entry.game_count = Some(game_count);
            return;
        }
        set_workspace_game_count(&mut entry.children, handle, game_count);
    }
}

#[tauri::command]
#[specta::specta]
pub async fn issue_file_workspace(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<FileWorkspaceDescriptor, Error> {
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
    let pgn_path_authority = Arc::clone(&state.pgn_path_authority);
    crate::infra::operations::run_accepted_blocking(
        &state.operations,
        "issue_file_workspace",
        move || issue_file_workspace_blocking(&pgn_path_authority, path),
    )
    .await
}

fn issue_file_workspace_blocking(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    path: PathBuf,
) -> Result<FileWorkspaceDescriptor, Error> {
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "PGN collection".into());
    let mut authority = authority(pgn_path_authority)?;
    let authority = authority
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    let temporary = authority.grant_dialog_operations(
        &path,
        display_name.clone(),
        PathClass::BoundedDialogGrant,
        vec![PathOperation::ReadPgn, PathOperation::WritePgn],
        Duration::from_secs(300),
        1,
    )?;
    let committed = authority.promote_dialog(
        &temporary,
        PathClass::PersistentCustomRoot,
        display_name.clone(),
        vec![PathOperation::ReadPgn, PathOperation::WritePgn],
    )?;
    Ok(FileWorkspaceDescriptor {
        handle: FileWorkspaceHandle::new(committed.id),
        display_name,
        availability: crate::infra::path_authority::PathAvailability::Available,
    })
}

pub(crate) async fn list_file_workspace_core(
    workspace: &FileWorkspaceHandle,
    authority_arc: &Arc<Mutex<Option<PathAuthority>>>,
    repository: &crate::pgn::PgnRepository,
    cancellation: &CancellationToken,
) -> Result<Vec<WorkspaceEntry>, Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let pgn_path_authority = Arc::clone(authority_arc);
    let workspace_for_tree = workspace.clone();
    let (mut entries, missing) = BLOCKING_GATEWAY
        .spawn_cancellable(cancellation.clone(), move |token| {
            collect_tree_entries(&pgn_path_authority, &workspace_for_tree, token)
        })
        .await?;
    for handle in missing {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let resolved = {
            authority(authority_arc)?
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
                .resolve(handle.path_ref(), PathOperation::ReadPgn, &[])?
        };
        let game_count = pgn::count_pgn_games_core(resolved, cancellation, repository).await?;
        set_workspace_game_count(&mut entries, &handle, game_count);
    }
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    Ok(entries)
}

#[tauri::command]
#[specta::specta]
pub async fn list_file_workspace(
    workspace: FileWorkspaceHandle,
    ticket: Option<String>,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<WorkspaceEntry>, Error> {
    let operation = crate::native_read_operation(ticket, &window, &state, "list_file_workspace")?;
    let cancellation = operation.token();
    let authority_arc = Arc::clone(&state.pgn_path_authority);
    let repository = state.pgn_repository.clone();
    crate::infra::operations::run_native_operation(operation, "list_file_workspace", async move {
        list_file_workspace_core(&workspace, &authority_arc, &repository, &cancellation).await
    })
    .await
}

#[cfg(unix)]
fn paired_rename(
    source: &WorkspaceMutationTarget,
    target_parent: &fs::File,
    target_leaf: &std::ffi::OsStr,
) -> Result<(), Error> {
    use crate::infra::fs::{rename_entry_at, rename_optional_regular_at};
    let source_info = sidecar_leaf(&source.leaf)?;
    let target_info = sidecar_leaf(target_leaf)?;
    rename_entry_at(
        &source.parent,
        &source.leaf,
        source.identity,
        source.is_dir,
        target_parent,
        target_leaf,
    )?;
    if let Err(error) =
        rename_optional_regular_at(&source.parent, &source_info, target_parent, &target_info)
    {
        // The same retained descriptors are used for rollback; never reopen a mutable pathname.
        let rollback = crate::infra::fs::rename_entry_at(
            target_parent,
            target_leaf,
            source.identity,
            source.is_dir,
            &source.parent,
            &source.leaf,
        );
        return match rollback {
            Ok(()) => Err(error),
            Err(rollback) => {
                log::error!("paired rename failed: {error}; rollback failed: {rollback}");
                Err(Error::OperationAndCleanup {
                    primary: error.to_string(),
                    cleanup: rollback.to_string(),
                })
            }
        };
    }
    Ok(())
}

fn rebind_after_move(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    entry: &FileWorkspaceHandle,
    source: &WorkspaceMutationTarget,
    target: &Path,
) -> Result<(), Error> {
    let mut authority = authority(pgn_path_authority)?;
    let authority = authority
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    if source.is_dir {
        authority.rebase_workspace_entries(source.path(), target)
    } else {
        authority.rebind_workspace_entry(
            entry,
            target,
            target.file_stem().unwrap_or_default().to_string_lossy(),
        )
    }
}

#[tauri::command]
#[specta::specta]
pub async fn create_workspace_file(
    workspace: FileWorkspaceHandle,
    parent: FileWorkspaceHandle,
    name: String,
    metadata: WorkspaceMetadata,
    pgn: String,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceEntry, Error> {
    let operation = state.operations.accept("create_workspace_file")?;
    let cancellation = operation.token();
    let state = state.inner().clone();
    crate::infra::operations::run_native_operation(operation, "create_workspace_file", async move {
        let pgn_path_authority = Arc::clone(&state.pgn_path_authority);
        let workspace_mutation = Arc::clone(&state.workspace_mutation);
        let mut entry = BLOCKING_GATEWAY
            .spawn_cancellable(cancellation, move |token| {
                create_workspace_file_blocking(
                    workspace,
                    parent,
                    name,
                    metadata,
                    pgn,
                    &pgn_path_authority,
                    &workspace_mutation,
                    token,
                )
            })
            .await?;
        let resolved = {
            authority(&state.pgn_path_authority)?
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
                .resolve(entry.handle.path_ref(), PathOperation::ReadPgn, &[])?
        };
        entry.game_count = Some(
            pgn::count_pgn_games_core(resolved, &CancellationToken::new(), &state.pgn_repository)
                .await?,
        );
        Ok(entry)
    })
    .await
}

// This core deliberately mirrors the flat command boundary plus its two shared owners. Grouping
// those values would introduce a one-off request type with no second consumer.
#[allow(clippy::too_many_arguments)]
fn create_workspace_file_blocking(
    workspace: FileWorkspaceHandle,
    parent: FileWorkspaceHandle,
    name: String,
    metadata: WorkspaceMetadata,
    pgn: String,
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace_mutation: &Mutex<()>,
    cancellation: &CancellationToken,
) -> Result<WorkspaceEntry, Error> {
    let metadata_bytes = serialize_metadata(&metadata)?;
    let _guard = lock_std_cancellable(
        workspace_mutation,
        cancellation,
        "workspace mutation lock was poisoned",
    )?;
    let root = mutation_target(pgn_path_authority, &workspace)?;
    let parent_target = mutation_target(pgn_path_authority, &parent)?;
    ensure_registered_descendant(&root, &parent_target)?;
    let parent_dir = parent_target.directory()?;
    let filename = pgn_name(&name)?;
    let target_leaf = std::ffi::OsString::from(&filename);
    let target = parent_target.path().join(&filename);
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let installed =
        crate::infra::fs::atomic_replace_at_identified(parent_dir, &target_leaf, |file| {
            use std::io::Write;
            file.write_all(pgn.as_bytes()).map_err(Error::from)
        })?;
    let pgn_uncertainty = durability_uncertainty(
        installed.outcome,
        crate::error::DurabilityStage::WorkspacePgnCreation,
    );
    let info_leaf = sidecar_leaf(&target_leaf)?;
    let sidecar_outcome = match crate::infra::fs::atomic_replace_at(
        parent_dir,
        &info_leaf,
        |file| {
            use std::io::Write;
            file.write_all(&metadata_bytes).map_err(Error::from)
        },
    ) {
        Ok(outcome) => outcome,
        Err(error) => {
            let rollback = crate::infra::fs::remove_regular_at(parent_dir, &target_leaf);
            return match rollback {
                Ok(()) => Err(error),
                Err(rollback) => {
                    log::error!(
                            "workspace sidecar creation failed: {error}; PGN rollback failed: {rollback}"
                        );
                    Err(Error::OperationAndCleanup {
                        primary: error.to_string(),
                        cleanup: rollback.to_string(),
                    })
                }
            };
        }
    };
    let sidecar_uncertainty = durability_uncertainty(
        sidecar_outcome,
        crate::error::DurabilityStage::WorkspaceSidecarCreation,
    );
    let handle = register_created_entry(
        pgn_path_authority,
        &workspace,
        &target,
        name.clone(),
        installed.identity,
        false,
    )?;
    let entry = WorkspaceEntry {
        handle,
        kind: WorkspaceEntryKind::File,
        name,
        children: vec![],
        metadata: Some(metadata),
        game_count: None,
        last_modified: timestamp(&target)?,
    };
    if let Some(error) = pgn_uncertainty.or(sidecar_uncertainty) {
        return Err(Error::CommittedDurabilityUncertain(error));
    }
    Ok(entry)
}

#[tauri::command]
#[specta::specta]
pub async fn create_workspace_directory(
    workspace: FileWorkspaceHandle,
    parent: FileWorkspaceHandle,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceEntry, Error> {
    let operation = state.operations.accept("create_workspace_directory")?;
    let cancellation = operation.token();
    let pgn_path_authority = Arc::clone(&state.pgn_path_authority);
    let workspace_mutation = Arc::clone(&state.workspace_mutation);
    crate::infra::operations::run_native_operation(
        operation,
        "create_workspace_directory",
        async move {
            BLOCKING_GATEWAY
                .spawn_cancellable(cancellation, move |token| {
                    create_workspace_directory_inner(
                        workspace,
                        parent,
                        name,
                        &pgn_path_authority,
                        &workspace_mutation,
                        token,
                    )
                })
                .await
        },
    )
    .await
}

fn create_workspace_directory_inner(
    workspace: FileWorkspaceHandle,
    parent: FileWorkspaceHandle,
    name: String,
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace_mutation: &Mutex<()>,
    cancellation: &CancellationToken,
) -> Result<WorkspaceEntry, Error> {
    let _guard = lock_std_cancellable(
        workspace_mutation,
        cancellation,
        "workspace mutation lock was poisoned",
    )?;
    let root = mutation_target(pgn_path_authority, &workspace)?;
    let parent_target = mutation_target(pgn_path_authority, &parent)?;
    ensure_registered_descendant(&root, &parent_target)?;
    let parent_dir = parent_target.directory()?;
    let name = validate_name(&name)?.to_string();
    let target = parent_target.path().join(&name);
    let target_leaf = std::ffi::OsString::from(&name);
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    crate::infra::fs::create_dir_at(parent_dir, &target_leaf)?;
    let identity = crate::infra::fs::entry_identity_at(parent_dir, &target_leaf, true)?;
    let handle = match register_created_entry(
        pgn_path_authority,
        &workspace,
        &target,
        name.clone(),
        identity,
        true,
    ) {
        Ok(handle) => handle,
        Err(error @ Error::CommittedDurabilityUncertain(_)) => return Err(error),
        Err(error) => {
            match crate::infra::fs::remove_entry_at(parent_dir, &target_leaf, identity, true) {
                Ok(()) => return Err(error),
                Err(rollback) => {
                    log::error!(
                        "workspace directory registration failed: {error}; rollback failed: {rollback}"
                    );
                    return Err(Error::OperationAndCleanup {
                        primary: error.to_string(),
                        cleanup: rollback.to_string(),
                    });
                }
            }
        }
    };
    Ok(WorkspaceEntry {
        handle,
        kind: WorkspaceEntryKind::Directory,
        name,
        children: vec![],
        metadata: None,
        game_count: None,
        last_modified: timestamp(&target)?,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn move_workspace_entry(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    target_directory: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let operation = state.operations.accept("move_workspace_entry")?;
    let cancellation = operation.token();
    let pgn_path_authority = Arc::clone(&state.pgn_path_authority);
    let workspace_mutation = Arc::clone(&state.workspace_mutation);
    crate::infra::operations::run_native_operation(operation, "move_workspace_entry", async move {
        BLOCKING_GATEWAY
            .spawn_cancellable(cancellation, move |token| {
                move_workspace_entry_blocking(
                    workspace,
                    entry,
                    target_directory,
                    &pgn_path_authority,
                    &workspace_mutation,
                    token,
                )
            })
            .await
    })
    .await
}

fn move_workspace_entry_blocking(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    target_directory: FileWorkspaceHandle,
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace_mutation: &Mutex<()>,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let _guard = lock_std_cancellable(
        workspace_mutation,
        cancellation,
        "workspace mutation lock was poisoned",
    )?;
    let root = mutation_target(pgn_path_authority, &workspace)?;
    let source = mutation_target(pgn_path_authority, &entry)?;
    let destination = mutation_target(pgn_path_authority, &target_directory)?;
    ensure_registered_descendant(&root, &source)?;
    ensure_registered_descendant(&root, &destination)?;
    let name = source.leaf.clone();
    let target = destination.path().join(&name);
    if source.path() == target {
        return Ok(());
    }
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    paired_rename(&source, destination.directory()?, &name)?;
    rebind_after_move(pgn_path_authority, &entry, &source, &target)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_workspace_file(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    name: String,
    metadata: WorkspaceMetadata,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let operation = state.operations.accept("rename_workspace_file")?;
    let cancellation = operation.token();
    let pgn_path_authority = Arc::clone(&state.pgn_path_authority);
    let workspace_mutation = Arc::clone(&state.workspace_mutation);
    crate::infra::operations::run_native_operation(operation, "rename_workspace_file", async move {
        BLOCKING_GATEWAY
            .spawn_cancellable(cancellation, move |token| {
                rename_workspace_file_blocking(
                    workspace,
                    entry,
                    name,
                    metadata,
                    &pgn_path_authority,
                    &workspace_mutation,
                    token,
                )
            })
            .await
    })
    .await
}

fn rename_workspace_file_blocking(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    name: String,
    metadata: WorkspaceMetadata,
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace_mutation: &Mutex<()>,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let metadata_bytes = serialize_metadata(&metadata)?;
    let _guard = lock_std_cancellable(
        workspace_mutation,
        cancellation,
        "workspace mutation lock was poisoned",
    )?;
    let root = mutation_target(pgn_path_authority, &workspace)?;
    let source = mutation_target(pgn_path_authority, &entry)?;
    ensure_registered_descendant(&root, &source)?;
    if source.is_dir {
        return Err(Error::InvalidInput("workspace entry must be a file".into()));
    }
    let filename = pgn_name(&name)?;
    let target = source
        .path()
        .parent()
        .ok_or_else(|| Error::InvalidInput("workspace file has no parent".into()))?
        .join(&filename);
    let target_leaf = std::ffi::OsString::from(&filename);
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    paired_rename(&source, &source.parent, &target_leaf)?;
    let info_leaf = sidecar_leaf(&target_leaf)?;
    let sidecar_outcome =
        crate::infra::fs::atomic_replace_at(&source.parent, &info_leaf, |file| {
            use std::io::Write;
            file.write_all(&metadata_bytes).map_err(Error::from)
        })?;
    // The PGN rename and the sidecar rename both landed; the registry must follow them even
    // when the sidecar's parent sync is uncertain, so the rebind happens before reporting. The
    // first uncertain stage is the one reported, as in `create_workspace_file_blocking`; a
    // rebind failure that is not an uncertainty outranks it.
    let sidecar_uncertainty = durability_uncertainty(
        sidecar_outcome,
        crate::error::DurabilityStage::WorkspaceSidecarReplacement,
    );
    let rebind = rebind_after_move(pgn_path_authority, &entry, &source, &target);
    match (sidecar_uncertainty, rebind) {
        (Some(stage), Ok(()) | Err(Error::CommittedDurabilityUncertain(_))) => {
            Err(Error::CommittedDurabilityUncertain(stage))
        }
        (_, result) => result,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn trash_workspace_entry(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let operation = state.operations.accept("trash_workspace_entry")?;
    let cancellation = operation.token();
    let pgn_path_authority = Arc::clone(&state.pgn_path_authority);
    let workspace_mutation = Arc::clone(&state.workspace_mutation);
    crate::infra::operations::run_native_operation(operation, "trash_workspace_entry", async move {
        BLOCKING_GATEWAY
            .spawn_cancellable(cancellation, move |token| {
                trash_entry(
                    &pgn_path_authority,
                    &workspace_mutation,
                    &workspace,
                    &entry,
                    token,
                )
            })
            .await
    })
    .await
}

fn trash_entry(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace_mutation: &Mutex<()>,
    workspace: &FileWorkspaceHandle,
    entry: &FileWorkspaceHandle,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let _guard = lock_std_cancellable(
        workspace_mutation,
        cancellation,
        "workspace mutation lock was poisoned",
    )?;
    let root = mutation_target(pgn_path_authority, workspace)?;
    let source = mutation_target(pgn_path_authority, entry)?;
    ensure_registered_descendant(&root, &source)?;
    let root_dir = root.directory()?;
    let trash = std::ffi::OsString::from(TRASH_DIRECTORY);
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    // Both components are created through retained descriptors; no recursive pathname creation.
    match crate::infra::fs::create_dir_at(root_dir, &trash) {
        Ok(()) => {}
        Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(error) => return Err(error),
    }
    let trash_path = root.path().join(TRASH_DIRECTORY);
    let trash_dir = crate::infra::fs::open_directory_at(root_dir, &trash)?;
    let bucket = std::ffi::OsString::from(uuid::Uuid::new_v4().to_string());
    crate::infra::fs::create_dir_at(&trash_dir, &bucket)?;
    let bucket_path = trash_path.join(&bucket);
    let bucket_dir = crate::infra::fs::open_directory_at(&trash_dir, &bucket)?;
    let target = bucket_path.join(&source.leaf);
    if source.is_dir {
        crate::infra::fs::rename_entry_at(
            &source.parent,
            &source.leaf,
            source.identity,
            true,
            &bucket_dir,
            &source.leaf,
        )?;
    } else {
        paired_rename(&source, &bucket_dir, &source.leaf)?;
    }
    rebind_after_move(pgn_path_authority, entry, &source, &target)
}

#[tauri::command]
#[specta::specta]
pub async fn restore_workspace_entry(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let operation = state.operations.accept("restore_workspace_entry")?;
    let cancellation = operation.token();
    let pgn_path_authority = Arc::clone(&state.pgn_path_authority);
    let workspace_mutation = Arc::clone(&state.workspace_mutation);
    crate::infra::operations::run_native_operation(
        operation,
        "restore_workspace_entry",
        async move {
            BLOCKING_GATEWAY
                .spawn_cancellable(cancellation, move |token| {
                    restore_entry(
                        &pgn_path_authority,
                        &workspace_mutation,
                        &workspace,
                        &entry,
                        token,
                    )
                })
                .await
        },
    )
    .await
}

fn restore_entry(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace_mutation: &Mutex<()>,
    workspace: &FileWorkspaceHandle,
    entry: &FileWorkspaceHandle,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let _guard = lock_std_cancellable(
        workspace_mutation,
        cancellation,
        "workspace mutation lock was poisoned",
    )?;
    let root = mutation_target(pgn_path_authority, workspace)?;
    let source = mutation_target(pgn_path_authority, entry)?;
    let trash_root = root.path().join(TRASH_DIRECTORY);
    source
        .path()
        .strip_prefix(&trash_root)
        .map_err(|_| Error::InvalidInput("workspace entry is not in trash".into()))?;
    let target = root.path().join(&source.leaf);
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    if source.is_dir {
        crate::infra::fs::rename_entry_at(
            &source.parent,
            &source.leaf,
            source.identity,
            true,
            root.directory()?,
            &source.leaf,
        )?;
    } else {
        paired_rename(&source, root.directory()?, &source.leaf)?;
    }
    rebind_after_move(pgn_path_authority, entry, &source, &target)
}

#[tauri::command]
#[specta::specta]
pub async fn permanently_delete_workspace_entry(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let operation = state
        .operations
        .accept("permanently_delete_workspace_entry")?;
    let cancellation = operation.token();
    let state = state.inner().clone();
    crate::infra::operations::run_native_operation(
        operation,
        "permanently_delete_workspace_entry",
        async move { permanently_delete_entry(&state, &workspace, &entry, cancellation).await },
    )
    .await
}

async fn permanently_delete_entry(
    state: &AppState,
    workspace: &FileWorkspaceHandle,
    entry: &FileWorkspaceHandle,
    cancellation: tokio_util::sync::CancellationToken,
) -> Result<(), Error> {
    let pgn_path_authority = Arc::clone(&state.pgn_path_authority);
    let workspace_mutation = Arc::clone(&state.workspace_mutation);
    let workspace = workspace.clone();
    let entry = entry.clone();
    let (dropped_engine_executables, result) = BLOCKING_GATEWAY
        .spawn_cancellable(cancellation, move |token| {
            Ok(permanently_delete_entry_blocking(
                &pgn_path_authority,
                &workspace_mutation,
                &workspace,
                &entry,
                token,
            ))
        })
        .await?;
    if let Err(error) = state
        .engine_supervisor
        .retire_executables(dropped_engine_executables)
        .await
    {
        log::warn!("workspace removal engine retirement failed: {error}");
    }
    result
}

// Dropped executables must reach `retire_executables` on the error path as well
// as the success path, so they cannot travel through the `Result`. A plain
// `spawn(..).await?` would drop them on `Err` and leave a running engine holding
// an unlinked inode.
fn permanently_delete_entry_blocking(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace_mutation: &Mutex<()>,
    workspace: &FileWorkspaceHandle,
    entry: &FileWorkspaceHandle,
    cancellation: &CancellationToken,
) -> (Vec<PathRef>, Result<(), Error>) {
    let mut dropped_engine_executables = Vec::<PathRef>::new();
    let result = (|| {
        let _guard = lock_std_cancellable(
            workspace_mutation,
            cancellation,
            "workspace mutation lock was poisoned",
        )?;
        let root = mutation_target(pgn_path_authority, workspace)?;
        let source = mutation_target(pgn_path_authority, entry)?;
        ensure_registered_descendant(&root, &source)?;
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let removal_error = match crate::infra::fs::remove_entry_at(
            &source.parent,
            &source.leaf,
            source.identity,
            source.is_dir,
        ) {
            Ok(()) => None,
            Err(error @ Error::CommittedDurabilityUncertain(_)) => Some(error),
            Err(error @ Error::PartialRemoval { .. }) => Some(error),
            Err(error) => return Err(error),
        };
        let sidecar_error = if source.is_dir {
            None
        } else {
            sidecar_leaf(&source.leaf)
                .and_then(|sidecar| {
                    crate::infra::fs::remove_optional_regular_at(&source.parent, &sidecar)
                })
                .err()
        };
        let removal_status = if matches!(removal_error, Some(Error::PartialRemoval { .. })) {
            WorkspaceRemovalStatus::Partial
        } else {
            WorkspaceRemovalStatus::Complete
        };
        let registry_result = (|| {
            authority(pgn_path_authority)?
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
                .remove_workspace_entry(entry, removal_status, &mut dropped_engine_executables)
        })();

        if let Some(error @ Error::PartialRemoval { .. }) = removal_error {
            match registry_result {
                Ok(CommitDurability::Durable) => {}
                Ok(CommitDurability::DurabilityUncertain(stage)) => {
                    log::warn!("partial workspace removal registry durability uncertain: {stage}");
                }
                Err(registry_error) => {
                    log::warn!(
                        "partial workspace removal registry reconciliation failed: {registry_error}"
                    );
                }
            }
            return Err(error);
        }

        let registry_durability = match registry_result {
            Ok(durability) => durability,
            Err(error) => {
                log::warn!("workspace removal registry reconciliation failed: {error}");
                if let Some(sidecar_error) = sidecar_error {
                    log::warn!(
                        "workspace sidecar cleanup also failed after removal: {sidecar_error}"
                    );
                }
                if let Some(Error::CommittedDurabilityUncertain(stage)) = removal_error {
                    log::warn!("workspace removal durability also uncertain: {stage}");
                }
                return Err(Error::CommittedDurabilityUncertain(
                    crate::error::DurabilityStage::RegistryReplacement,
                ));
            }
        };
        if let Some(error) = sidecar_error {
            log::warn!("workspace sidecar cleanup failed after removal: {error}");
            if let CommitDurability::DurabilityUncertain(stage) = registry_durability {
                log::warn!("workspace removal registry durability also uncertain: {stage}");
            }
            if let Some(Error::CommittedDurabilityUncertain(stage)) = removal_error {
                log::warn!("workspace removal durability also uncertain: {stage}");
            }
            return Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::WorkspaceRemoval,
            ));
        }
        if let Some(Error::CommittedDurabilityUncertain(stage)) = removal_error {
            if let CommitDurability::DurabilityUncertain(registry_stage) = registry_durability {
                log::warn!(
                    "workspace removal registry durability also uncertain: {registry_stage}"
                );
            }
            return Err(Error::CommittedDurabilityUncertain(stage));
        }
        if let CommitDurability::DurabilityUncertain(stage) = registry_durability {
            return Err(Error::CommittedDurabilityUncertain(stage));
        }
        Ok(())
    })();
    (dropped_engine_executables, result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::EngineKey;
    use crate::infra::{
        fs::{
            set_test_atomic_file_injector, set_test_removal_injector, AtomicFileFaultPoint,
            AtomicWriterInjector, RemovalFault, RemovalFaultPoint,
        },
        path_authority::{
            set_workspace_metadata_post_open_hook, set_workspace_metadata_pre_open_hook,
            PathAuthority,
        },
    };
    use std::{
        io::{Seek, Write},
        sync::{Arc, Mutex as StdMutex},
    };
    use tauri::Manager;
    use tempfile::TempDir;

    #[derive(Clone, Copy, Debug)]
    enum QueuedWorkspaceCommand {
        CreateFile,
        CreateDirectory,
        Move,
        Rename,
        Trash,
        Restore,
        PermanentlyDelete,
    }

    /// Owns the contended standard mutex on a bounded worker thread so async tests never retain
    /// a `MutexGuard` across `.await`. Drop always releases and joins the holder.
    struct HeldWorkspaceMutation {
        release: Option<std::sync::mpsc::SyncSender<()>>,
        worker: Option<std::thread::JoinHandle<()>>,
    }

    impl HeldWorkspaceMutation {
        fn new(mutation: Arc<StdMutex<()>>) -> Self {
            let (entered_tx, entered_rx) = std::sync::mpsc::sync_channel(1);
            let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);
            let worker = std::thread::spawn(move || {
                let _guard = mutation.lock().expect("hold workspace mutation lock");
                entered_tx.send(()).expect("report held workspace lock");
                let _ = release_rx.recv_timeout(Duration::from_secs(5));
            });
            entered_rx
                .recv_timeout(Duration::from_secs(5))
                .expect("workspace lock holder must start");
            Self {
                release: Some(release_tx),
                worker: Some(worker),
            }
        }

        fn release(&mut self) {
            if let Some(release) = self.release.take() {
                release.send(()).expect("release workspace lock");
            }
            if let Some(worker) = self.worker.take() {
                worker.join().expect("join workspace lock holder");
            }
        }
    }

    impl Drop for HeldWorkspaceMutation {
        fn drop(&mut self) {
            if let Some(release) = self.release.take() {
                let _ = release.send(());
            }
            if let Some(worker) = self.worker.take() {
                let _ = worker.join();
            }
        }
    }

    fn workspace_tree_snapshot(root: &Path) -> Vec<(PathBuf, Option<Vec<u8>>)> {
        fn visit(root: &Path, directory: &Path, entries: &mut Vec<(PathBuf, Option<Vec<u8>>)>) {
            let mut children = fs::read_dir(directory)
                .expect("read workspace")
                .map(|child| child.expect("workspace child").path())
                .collect::<Vec<_>>();
            children.sort();
            for child in children {
                let relative = child
                    .strip_prefix(root)
                    .expect("relative path")
                    .to_path_buf();
                if child.is_dir() {
                    entries.push((relative, None));
                    visit(root, &child, entries);
                } else {
                    entries.push((relative, Some(fs::read(&child).expect("read child"))));
                }
            }
        }
        let mut entries = Vec::new();
        visit(root, root, &mut entries);
        entries
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn shutdown_cancels_every_workspace_command_at_the_actual_mutation_lock() {
        for command in [
            QueuedWorkspaceCommand::CreateFile,
            QueuedWorkspaceCommand::CreateDirectory,
            QueuedWorkspaceCommand::Move,
            QueuedWorkspaceCommand::Rename,
            QueuedWorkspaceCommand::Trash,
            QueuedWorkspaceCommand::Restore,
            QueuedWorkspaceCommand::PermanentlyDelete,
        ] {
            let (_directory, state, workspace) = workspace_state();
            let root = workspace_root(&state.pgn_path_authority, &workspace).expect("root");
            let source_path = root.join("source.pgn");
            fs::write(&source_path, b"[Event \"Source\"]\n\n1. e4 *\n").expect("source");
            let source = registered_child_file(&state, &workspace, &source_path);
            let (_destination_path, destination) =
                registered_child_directory(&state, &workspace, "destination");
            if matches!(command, QueuedWorkspaceCommand::Restore) {
                trash_entry(
                    &state.pgn_path_authority,
                    &state.workspace_mutation,
                    &workspace,
                    &source,
                    &CancellationToken::new(),
                )
                .expect("prepare trashed entry");
            }
            let source_before = mutation_target(&state.pgn_path_authority, &source)
                .expect("source target")
                .path()
                .to_path_buf();
            let descriptor_ids_before = {
                let mut authority = authority(&state.pgn_path_authority).expect("authority");
                authority
                    .as_mut()
                    .expect("initialized authority")
                    .descriptors()
                    .iter()
                    .map(|descriptor| descriptor.id.clone())
                    .collect::<Vec<_>>()
            };
            let tree_before = workspace_tree_snapshot(&root);
            let mutation = Arc::clone(&state.workspace_mutation);
            let _held = HeldWorkspaceMutation::new(Arc::clone(&mutation));
            let waiting = crate::infra::cancellable_lock::observe_std_lock_wait(mutation.as_ref());
            let app = tauri::test::mock_app();
            app.manage(state);
            let command_app = app.handle().clone();
            let command_workspace = workspace.clone();
            let command_source = source.clone();
            let command_destination = destination.clone();
            let task = tokio::spawn(async move {
                let state = command_app.state::<AppState>();
                match command {
                    QueuedWorkspaceCommand::CreateFile => create_workspace_file(
                        command_workspace.clone(),
                        command_workspace,
                        "created.pgn".into(),
                        WorkspaceMetadata::default(),
                        "1. d4 *".into(),
                        state,
                    )
                    .await
                    .map(|_| ()),
                    QueuedWorkspaceCommand::CreateDirectory => create_workspace_directory(
                        command_workspace.clone(),
                        command_workspace,
                        "created".into(),
                        state,
                    )
                    .await
                    .map(|_| ()),
                    QueuedWorkspaceCommand::Move => {
                        move_workspace_entry(
                            command_workspace,
                            command_source.clone(),
                            command_destination.clone(),
                            state,
                        )
                        .await
                    }
                    QueuedWorkspaceCommand::Rename => {
                        rename_workspace_file(
                            command_workspace,
                            command_source.clone(),
                            "renamed.pgn".into(),
                            WorkspaceMetadata::default(),
                            state,
                        )
                        .await
                    }
                    QueuedWorkspaceCommand::Trash => {
                        trash_workspace_entry(command_workspace, command_source.clone(), state)
                            .await
                    }
                    QueuedWorkspaceCommand::Restore => {
                        restore_workspace_entry(command_workspace, command_source.clone(), state)
                            .await
                    }
                    QueuedWorkspaceCommand::PermanentlyDelete => {
                        permanently_delete_workspace_entry(
                            command_workspace,
                            command_source.clone(),
                            state,
                        )
                        .await
                    }
                }
            });
            waiting
                .recv_timeout(Duration::from_secs(5))
                .expect("command must contend on the exact held mutation lock");
            app.state::<AppState>()
                .operations
                .seal_and_request_cancellation()
                .expect("request shutdown cancellation");
            let error = tokio::time::timeout(Duration::from_secs(5), task)
                .await
                .expect("queued command must stop while lock remains held")
                .expect("join queued command")
                .expect_err("queued command must cancel");
            assert!(
                matches!(error, Error::Cancellation),
                "{command:?}: {error:?}"
            );
            assert!(
                mutation.try_lock().is_err(),
                "{command:?}: cancellation must return while the exact lock remains held"
            );
            assert_eq!(workspace_tree_snapshot(&root), tree_before, "{command:?}");
            let state = app.state::<AppState>();
            assert_eq!(
                mutation_target(&state.pgn_path_authority, &source)
                    .expect("source authority remains")
                    .path(),
                source_before,
                "{command:?}"
            );
            let descriptor_ids_after = {
                let mut authority = authority(&state.pgn_path_authority).expect("authority");
                authority
                    .as_mut()
                    .expect("initialized authority")
                    .descriptors()
                    .iter()
                    .map(|descriptor| descriptor.id.clone())
                    .collect::<Vec<_>>()
            };
            assert_eq!(descriptor_ids_after, descriptor_ids_before, "{command:?}");
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn every_workspace_command_finishes_its_tail_after_caller_abort() {
        for command in [
            QueuedWorkspaceCommand::CreateFile,
            QueuedWorkspaceCommand::CreateDirectory,
            QueuedWorkspaceCommand::Move,
            QueuedWorkspaceCommand::Rename,
            QueuedWorkspaceCommand::Trash,
            QueuedWorkspaceCommand::Restore,
            QueuedWorkspaceCommand::PermanentlyDelete,
        ] {
            let (_directory, state, workspace) = workspace_state();
            let root = workspace_root(&state.pgn_path_authority, &workspace).expect("root");
            let source_path = root.join("source.pgn");
            fs::write(&source_path, b"[Event \"Source\"]\n\n1. e4 *\n").expect("source");
            let source = registered_child_file(&state, &workspace, &source_path);
            let (destination_path, destination) =
                registered_child_directory(&state, &workspace, "destination");
            if matches!(command, QueuedWorkspaceCommand::Restore) {
                trash_entry(
                    &state.pgn_path_authority,
                    &state.workspace_mutation,
                    &workspace,
                    &source,
                    &CancellationToken::new(),
                )
                .expect("prepare trashed entry");
            }
            let mutation = Arc::clone(&state.workspace_mutation);
            let mut held = HeldWorkspaceMutation::new(Arc::clone(&mutation));
            let waiting = crate::infra::cancellable_lock::observe_std_lock_wait(mutation.as_ref());
            let app = tauri::test::mock_app();
            app.manage(state);
            let command_app = app.handle().clone();
            let command_workspace = workspace.clone();
            let command_source = source.clone();
            let command_destination = destination.clone();
            let caller = tokio::spawn(async move {
                let state = command_app.state::<AppState>();
                match command {
                    QueuedWorkspaceCommand::CreateFile => create_workspace_file(
                        command_workspace.clone(),
                        command_workspace,
                        "created.pgn".into(),
                        WorkspaceMetadata::default(),
                        "1. d4 *".into(),
                        state,
                    )
                    .await
                    .map(|_| ()),
                    QueuedWorkspaceCommand::CreateDirectory => create_workspace_directory(
                        command_workspace.clone(),
                        command_workspace,
                        "created".into(),
                        state,
                    )
                    .await
                    .map(|_| ()),
                    QueuedWorkspaceCommand::Move => {
                        move_workspace_entry(
                            command_workspace,
                            command_source.clone(),
                            command_destination,
                            state,
                        )
                        .await
                    }
                    QueuedWorkspaceCommand::Rename => {
                        rename_workspace_file(
                            command_workspace,
                            command_source.clone(),
                            "renamed.pgn".into(),
                            WorkspaceMetadata::default(),
                            state,
                        )
                        .await
                    }
                    QueuedWorkspaceCommand::Trash => {
                        trash_workspace_entry(command_workspace, command_source.clone(), state)
                            .await
                    }
                    QueuedWorkspaceCommand::Restore => {
                        restore_workspace_entry(command_workspace, command_source.clone(), state)
                            .await
                    }
                    QueuedWorkspaceCommand::PermanentlyDelete => {
                        permanently_delete_workspace_entry(
                            command_workspace,
                            command_source.clone(),
                            state,
                        )
                        .await
                    }
                }
            });
            waiting
                .recv_timeout(Duration::from_secs(5))
                .expect("command must contend on the exact held mutation lock");
            caller.abort();
            let _ = caller.await;
            held.release();
            let operations = app.state::<AppState>().operations.clone();
            let drained = tokio::task::spawn_blocking(move || {
                operations.wait_for_drain(Duration::from_secs(5)).unwrap()
            })
            .await
            .expect("join drain");
            assert!(drained, "{command:?} must retain its accepted owner");
            let state = app.state::<AppState>();
            match command {
                QueuedWorkspaceCommand::CreateFile => {
                    assert_eq!(
                        fs::read_to_string(root.join("created.pgn")).unwrap(),
                        "1. d4 *"
                    );
                    assert!(root.join("created.info").is_file());
                }
                QueuedWorkspaceCommand::CreateDirectory => {
                    assert!(root.join("created").is_dir());
                }
                QueuedWorkspaceCommand::Move => {
                    assert!(!source_path.exists());
                    assert!(destination_path.join("source.pgn").is_file());
                    assert_eq!(
                        mutation_target(&state.pgn_path_authority, &source)
                            .expect("moved authority")
                            .path(),
                        destination_path.join("source.pgn")
                    );
                }
                QueuedWorkspaceCommand::Rename => {
                    assert!(!source_path.exists());
                    assert!(root.join("renamed.pgn").is_file());
                    assert!(root.join("renamed.info").is_file());
                    assert_eq!(
                        mutation_target(&state.pgn_path_authority, &source)
                            .expect("renamed authority")
                            .path(),
                        root.join("renamed.pgn")
                    );
                }
                QueuedWorkspaceCommand::Trash => {
                    assert!(!source_path.exists());
                    let target = mutation_target(&state.pgn_path_authority, &source)
                        .expect("trash authority");
                    assert!(target.path().is_file());
                    assert!(target.path().starts_with(root.join(TRASH_DIRECTORY)));
                }
                QueuedWorkspaceCommand::Restore => {
                    assert!(source_path.is_file());
                    assert_eq!(
                        mutation_target(&state.pgn_path_authority, &source)
                            .expect("restored authority")
                            .path(),
                        source_path
                    );
                }
                QueuedWorkspaceCommand::PermanentlyDelete => {
                    assert!(!source_path.exists());
                    assert!(mutation_target(&state.pgn_path_authority, &source).is_err());
                }
            }
        }
    }

    #[tokio::test]
    async fn test_map_picker_join_panic_is_not_cancellation() {
        let error = tokio::task::spawn_blocking(|| panic!("folder picker panic"))
            .await
            .expect_err("panicking folder picker must return a join error");
        assert!(matches!(
            map_picker_join(error),
            Error::InvalidInput(message) if message == "native picker task failed"
        ));
    }

    #[tokio::test]
    async fn test_map_picker_join_cancelled() {
        let handle = tokio::spawn(std::future::pending::<()>());
        handle.abort();
        let error = handle
            .await
            .expect_err("an aborted task must return a join error");
        assert!(error.is_cancelled());
        assert!(matches!(map_picker_join(error), Error::Cancellation));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn production_workspace_file_tail_finishes_after_command_caller_drop() {
        let (directory, state, workspace) = workspace_state();
        let (hook, entered, release) = crate::pgn::BoundedHook::new();
        state.pgn_repository.set_count_hook(Some(hook)).unwrap();
        let app = tauri::test::mock_app();
        app.manage(state);
        let handle = app.handle().clone();
        let caller = tokio::spawn(async move {
            let state = handle.state::<AppState>();
            create_workspace_file(
                workspace.clone(),
                workspace,
                "completed.pgn".into(),
                WorkspaceMetadata::default(),
                "1. e4 *".into(),
                state,
            )
            .await
        });
        tokio::time::timeout(Duration::from_secs(1), entered)
            .await
            .unwrap()
            .unwrap();
        caller.abort();
        release.send(()).unwrap();
        tokio::time::timeout(Duration::from_secs(2), async {
            while !app
                .state::<AppState>()
                .operations
                .outstanding_labels()
                .unwrap()
                .is_empty()
            {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert_eq!(
            fs::read_to_string(directory.path().join("workspace/completed.pgn")).unwrap(),
            "1. e4 *"
        );
    }

    fn workspace_state() -> (TempDir, AppState, FileWorkspaceHandle) {
        let directory = tempfile::tempdir().expect("temporary workspace parent");
        let root = directory.path().join("workspace");
        fs::create_dir(&root).expect("workspace root");
        let mut path_authority =
            PathAuthority::open(directory.path().join("registry.json"), vec![]).expect("authority");
        let grant = path_authority
            .grant_dialog_operations(
                &root,
                "Workspace",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(60),
                4,
            )
            .expect("workspace grant");
        let workspace = FileWorkspaceHandle::new(
            path_authority
                .promote_dialog(
                    &grant,
                    PathClass::PersistentCustomRoot,
                    "Workspace",
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                )
                .expect("persistent workspace")
                .id,
        );
        let state = AppState::default();
        *state.pgn_path_authority.lock().expect("authority lock") = Some(path_authority);
        (directory, state, workspace)
    }

    fn registered_child_directory(
        state: &AppState,
        workspace: &FileWorkspaceHandle,
        name: &str,
    ) -> (PathBuf, FileWorkspaceHandle) {
        let root = mutation_target(&state.pgn_path_authority, workspace).expect("workspace target");
        let child = root.path().join(name);
        fs::create_dir(&child).expect("child directory");
        fs::write(child.join("removed"), b"content").expect("child content");
        let identity = crate::infra::fs::entry_identity_at(
            root.directory().expect("workspace directory"),
            Path::new(name).as_os_str(),
            true,
        )
        .expect("child identity");
        let entry = register_created_entry(
            &state.pgn_path_authority,
            workspace,
            &child,
            name.into(),
            identity,
            true,
        )
        .expect("child handle");
        (child, entry)
    }

    fn registered_child_file(
        state: &AppState,
        workspace: &FileWorkspaceHandle,
        path: &Path,
    ) -> FileWorkspaceHandle {
        register_entry(
            &state.pgn_path_authority,
            workspace,
            path,
            path.file_stem()
                .expect("file stem")
                .to_string_lossy()
                .into_owned(),
        )
        .expect("registered file")
    }

    fn registered_engine_file(state: &AppState, path: &Path) -> PathRef {
        authority(&state.pgn_path_authority)
            .expect("authority lock")
            .as_mut()
            .expect("authority")
            .register_engine_file(path, "engine")
            .expect("registered engine")
            .id
    }

    async fn supervise_test_engine(
        state: &AppState,
        key: &EngineKey,
        engine_id: &str,
        executable: PathRef,
    ) {
        let (actor, _) = crate::engine::EngineActor::recording_test_actor(&[]);
        state
            .engine_supervisor
            .replace_handle(key.clone(), actor, engine_id.into(), executable)
            .await
            .expect("registered supervised engine");
    }

    async fn delete_entry_with_fault(
        state: &AppState,
        workspace: &FileWorkspaceHandle,
        entry: &FileWorkspaceHandle,
        point: RemovalFaultPoint,
    ) -> Result<(), Error> {
        set_test_removal_injector(Some(Arc::new(RemovalFault(point))));
        let result = permanently_delete_entry(
            state,
            workspace,
            entry,
            tokio_util::sync::CancellationToken::new(),
        )
        .await;
        set_test_removal_injector(None);
        result
    }

    #[tokio::test]
    async fn committed_delete_removes_authority_record_when_parent_sync_fails() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");
        let descendant = child.join("descendant.pgn");
        fs::write(&descendant, b"*").expect("descendant");
        let descendant_entry = registered_child_file(&state, &workspace, &descendant);

        let error =
            delete_entry_with_fault(&state, &workspace, &entry, RemovalFaultPoint::ParentSync)
                .await
                .expect_err("parent sync failure must preserve commit status");

        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert!(!child.exists(), "the directory was completely removed");
        assert!(matches!(
            mutation_target(&state.pgn_path_authority, &entry),
            Err(Error::InvalidInput(message)) if message == "workspace entry is not persistent"
        ));
        assert!(matches!(
            mutation_target(&state.pgn_path_authority, &descendant_entry),
            Err(Error::InvalidInput(message)) if message == "workspace entry is not persistent"
        ));
    }

    #[tokio::test]
    async fn partial_delete_keeps_authority_record() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");
        let survivor = child.join("survivor.pgn");
        fs::write(&survivor, b"*").expect("survivor");
        let removed_entry = registered_child_file(&state, &workspace, &child.join("removed"));
        let survivor_entry = registered_child_file(&state, &workspace, &survivor);

        let error = delete_entry_with_fault(
            &state,
            &workspace,
            &entry,
            RemovalFaultPoint::AfterEntryRemoved,
        )
        .await
        .expect_err("post-removal failure must be reported");

        assert!(matches!(error, Error::PartialRemoval { .. }));
        assert!(child.exists(), "the top directory remains");
        mutation_target(&state.pgn_path_authority, &entry).expect("authority record remains");
        for (path, handle) in [
            (child.join("removed"), removed_entry),
            (survivor, survivor_entry),
        ] {
            if path.exists() {
                mutation_target(&state.pgn_path_authority, &handle)
                    .expect("surviving descendant remains registered");
            } else {
                assert!(matches!(
                    mutation_target(&state.pgn_path_authority, &handle),
                    Err(Error::InvalidInput(message))
                        if message == "workspace entry is not persistent"
                ));
            }
        }
    }

    struct RegistryWriteFailure;

    impl AtomicWriterInjector for RegistryWriteFailure {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == AtomicFileFaultPoint::Write {
                Err(std::io::Error::other(
                    r"/private/registry C:\private\registry: injected write failure",
                ))
            } else {
                Ok(())
            }
        }
    }

    #[tokio::test]
    async fn registry_failure_after_unlink_is_applied_despite_error_and_keeps_persisted_state() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");
        set_test_atomic_file_injector(Some(Arc::new(RegistryWriteFailure)));
        let error = permanently_delete_entry(
            &state,
            &workspace,
            &entry,
            tokio_util::sync::CancellationToken::new(),
        )
        .await
        .expect_err("registry failure after unlink must be applied-despite-error");
        set_test_atomic_file_injector(None);

        assert!(!child.exists());
        assert!(matches!(
            error,
            Error::CommittedDurabilityUncertain(crate::error::DurabilityStage::RegistryReplacement)
        ));
        assert!(
            mutation_target(&state.pgn_path_authority, &entry).is_err(),
            "deleted object is retained as unavailable"
        );
        assert!(authority(&state.pgn_path_authority)
            .expect("authority lock")
            .as_mut()
            .expect("authority")
            .descriptors()
            .iter()
            .any(|descriptor| descriptor.id == *entry.path_ref()));
        let serialized = serde_json::to_string(&error).expect("serialize registry failure");
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert_eq!(payload["category"], "durability");
        assert_eq!(
            payload["message"],
            "Committed but durability uncertain: registry replacement"
        );
        assert!(!serialized.contains("/private/registry"));
        assert!(!serialized.contains(r"C:\private\registry"));
    }

    #[tokio::test]
    async fn sidecar_failure_after_unlink_still_removes_authority_record() {
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).expect("workspace root");
        let file = root.join("victim.pgn");
        fs::write(&file, b"*").expect("victim file");
        fs::create_dir(root.join("victim.info")).expect("invalid sidecar directory");
        let entry = registered_child_file(&state, &workspace, &file);

        let error = permanently_delete_entry(
            &state,
            &workspace,
            &entry,
            tokio_util::sync::CancellationToken::new(),
        )
        .await
        .expect_err("sidecar cleanup failure must be applied-despite-error");

        assert!(!file.exists());
        assert!(matches!(
            error,
            Error::CommittedDurabilityUncertain(crate::error::DurabilityStage::WorkspaceRemoval)
        ));
        assert!(matches!(
            mutation_target(&state.pgn_path_authority, &entry),
            Err(Error::InvalidInput(message)) if message == "workspace entry is not persistent"
        ));
        let serialized = serde_json::to_string(&error).expect("serialize sidecar failure");
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert_eq!(payload["category"], "durability");
        assert_eq!(
            payload["message"],
            "Committed but durability uncertain: workspace removal"
        );
    }

    #[tokio::test]
    async fn partial_removal_wins_over_registry_reconciliation_failure() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");
        let removed_entry = registered_child_file(&state, &workspace, &child.join("removed"));
        set_test_atomic_file_injector(Some(Arc::new(RegistryWriteFailure)));
        let error = delete_entry_with_fault(
            &state,
            &workspace,
            &entry,
            RemovalFaultPoint::AfterEntryRemoved,
        )
        .await
        .expect_err("partial removal must remain the primary outcome");
        set_test_atomic_file_injector(None);

        assert!(matches!(error, Error::PartialRemoval { .. }));
        mutation_target(&state.pgn_path_authority, &entry)
            .expect("top record remains after partial removal");
        assert!(
            mutation_target(&state.pgn_path_authority, &removed_entry).is_err(),
            "failed registry save retains removed descendant as unavailable"
        );
        assert!(authority(&state.pgn_path_authority)
            .expect("authority lock")
            .as_mut()
            .expect("authority")
            .descriptors()
            .iter()
            .any(|descriptor| descriptor.id == *removed_entry.path_ref()));
        let serialized = serde_json::to_string(&error).expect("serialize partial removal");
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert_eq!(payload["category"], "partial-removal");
        assert!(payload["message"]
            .as_str()
            .expect("message")
            .starts_with("Partially removed:"));
        assert!(!serialized.contains("/private/registry"));
        assert!(!serialized.contains(r"C:\private\registry"));
    }

    #[tokio::test]
    async fn permanent_directory_delete_retires_only_its_engine_executable() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");
        let executable_path = child.join("engine");
        fs::write(&executable_path, b"engine").expect("engine executable");
        let executable = registered_engine_file(&state, &executable_path);
        let key = EngineKey::new("tab".into(), "operation".into()).expect("engine key");
        supervise_test_engine(&state, &key, "application-engine", executable.clone()).await;

        permanently_delete_entry(
            &state,
            &workspace,
            &entry,
            tokio_util::sync::CancellationToken::new(),
        )
        .await
        .expect("permanent delete");

        assert!(state.engine_supervisor.get_exact(&key).is_none());
        let (retired_actor, _) = crate::engine::EngineActor::recording_test_actor(&[]);
        assert!(matches!(
            state
                .engine_supervisor
                .replace_handle(
                    EngineKey::new("tab".into(), "retired path".into()).expect("engine key"),
                    retired_actor,
                    "different-application-engine".into(),
                    executable,
                )
                .await,
            Err(Error::Conflict(message)) if message == "engine executable is retired"
        ));

        let replacement_key =
            EngineKey::new("tab".into(), "replacement path".into()).expect("engine key");
        supervise_test_engine(
            &state,
            &replacement_key,
            "application-engine",
            PathRef {
                id: "replacement-executable".into(),
            },
        )
        .await;
        assert!(state
            .engine_supervisor
            .get_exact(&replacement_key)
            .is_some());
        state.engine_supervisor.terminate_all().await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn production_delete_retirement_tail_survives_command_caller_drop() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "dropped-caller");
        let executable_path = child.join("engine");
        fs::write(&executable_path, b"engine").unwrap();
        let executable = registered_engine_file(&state, &executable_path);
        let key = EngineKey::new("tab".into(), "caller-drop".into()).unwrap();
        supervise_test_engine(&state, &key, "application-engine", executable.clone()).await;
        let mutation = Arc::clone(&state.workspace_mutation);
        let (entered_tx, entered_rx) = std::sync::mpsc::sync_channel(1);
        let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);
        let holder = std::thread::spawn(move || {
            let _guard = mutation.lock().unwrap();
            entered_tx.send(()).unwrap();
            let _ = release_rx.recv_timeout(Duration::from_secs(5));
        });
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();

        let app = tauri::test::mock_app();
        app.manage(state);
        let command_app = app.handle().clone();
        let caller = tokio::spawn(async move {
            let state = command_app.state::<AppState>();
            permanently_delete_workspace_entry(workspace, entry, state).await
        });
        tokio::time::timeout(Duration::from_secs(1), async {
            while app
                .state::<AppState>()
                .operations
                .outstanding_labels()
                .unwrap()
                .is_empty()
            {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        caller.abort();
        release_tx.send(()).unwrap();
        holder.join().unwrap();
        tokio::time::timeout(Duration::from_secs(2), async {
            while !app
                .state::<AppState>()
                .operations
                .outstanding_labels()
                .unwrap()
                .is_empty()
            {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();

        let state = app.state::<AppState>();
        assert!(!child.exists());
        assert!(state.engine_supervisor.get_exact(&key).is_none());
        let (actor, _) = crate::engine::EngineActor::recording_test_actor(&[]);
        assert!(matches!(
            state
                .engine_supervisor
                .replace_handle(
                    EngineKey::new("tab".into(), "retired-after-drop".into()).unwrap(),
                    actor,
                    "other-engine".into(),
                    executable,
                )
                .await,
            Err(Error::Conflict(message)) if message == "engine executable is retired"
        ));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn production_delete_error_retirement_tail_survives_command_caller_drop() {
        let (directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "dropped-error");
        let executable_path = child.join("engine");
        fs::write(&executable_path, b"engine").unwrap();
        let executable = registered_engine_file(&state, &executable_path);
        let key = EngineKey::new("tab".into(), "caller-drop-error".into()).unwrap();
        supervise_test_engine(&state, &key, "application-engine", executable.clone()).await;
        let mutation = Arc::clone(&state.workspace_mutation);
        let (entered_tx, entered_rx) = std::sync::mpsc::sync_channel(1);
        let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);
        let holder = std::thread::spawn(move || {
            let _guard = mutation.lock().unwrap();
            entered_tx.send(()).unwrap();
            let _ = release_rx.recv_timeout(Duration::from_secs(5));
        });
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();

        let app = tauri::test::mock_app();
        app.manage(state);
        let command_app = app.handle().clone();
        let caller = tokio::spawn(async move {
            let state = command_app.state::<AppState>();
            permanently_delete_workspace_entry(workspace, entry, state).await
        });
        tokio::time::timeout(Duration::from_secs(1), async {
            while app
                .state::<AppState>()
                .operations
                .outstanding_labels()
                .unwrap()
                .is_empty()
            {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        caller.abort();
        let registry = directory.path().join("registry.json");
        fs::remove_file(&registry).unwrap();
        fs::create_dir(&registry).unwrap();
        release_tx.send(()).unwrap();
        holder.join().unwrap();
        tokio::time::timeout(Duration::from_secs(2), async {
            while !app
                .state::<AppState>()
                .operations
                .outstanding_labels()
                .unwrap()
                .is_empty()
            {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();

        let state = app.state::<AppState>();
        assert!(!child.exists(), "the workspace unlink completed");
        assert!(registry.is_dir(), "the registry replacement failed");
        assert!(state.engine_supervisor.get_exact(&key).is_none());
        let (actor, _) = crate::engine::EngineActor::recording_test_actor(&[]);
        assert!(matches!(
            state
                .engine_supervisor
                .replace_handle(
                    EngineKey::new("tab".into(), "retired-after-error".into()).unwrap(),
                    actor,
                    "other-engine".into(),
                    executable,
                )
                .await,
            Err(Error::Conflict(message)) if message == "engine executable is retired"
        ));
    }

    #[tokio::test]
    async fn trash_directory_does_not_retire_its_engine_executable() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");
        let executable_path = child.join("engine");
        fs::write(&executable_path, b"engine").expect("engine executable");
        let executable = registered_engine_file(&state, &executable_path);
        let key = EngineKey::new("tab".into(), "operation".into()).expect("engine key");
        supervise_test_engine(&state, &key, "application-engine", executable).await;

        trash_entry(
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &workspace,
            &entry,
            &CancellationToken::new(),
        )
        .expect("trash directory");

        assert!(state.engine_supervisor.get_exact(&key).is_some());
        state.engine_supervisor.terminate_all().await.unwrap();
    }

    #[tokio::test]
    async fn registry_failure_after_unlink_still_retires_engine_executable() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");
        let executable_path = child.join("engine");
        fs::write(&executable_path, b"engine").expect("engine executable");
        let executable = registered_engine_file(&state, &executable_path);
        let key = EngineKey::new("tab".into(), "operation".into()).expect("engine key");
        supervise_test_engine(&state, &key, "application-engine", executable).await;
        set_test_atomic_file_injector(Some(Arc::new(RegistryWriteFailure)));

        let result = permanently_delete_entry(
            &state,
            &workspace,
            &entry,
            tokio_util::sync::CancellationToken::new(),
        )
        .await;
        set_test_atomic_file_injector(None);

        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::RegistryReplacement
            ))
        ));
        assert!(state.engine_supervisor.get_exact(&key).is_none());
    }

    #[test]
    fn trash_and_restore_directory_keep_descendant_records() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");
        let descendant = child.join("descendant.pgn");
        fs::write(&descendant, b"*").expect("descendant");
        let descendant_entry = registered_child_file(&state, &workspace, &descendant);

        trash_entry(
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &workspace,
            &entry,
            &CancellationToken::new(),
        )
        .expect("trash directory");
        mutation_target(&state.pgn_path_authority, &descendant_entry)
            .expect("descendant survives trash rebase");
        restore_entry(
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &workspace,
            &entry,
            &CancellationToken::new(),
        )
        .expect("restore directory");
        mutation_target(&state.pgn_path_authority, &descendant_entry)
            .expect("descendant survives restore rebase");
    }

    #[test]
    fn workspace_names_reject_paths_reserved_sidecars_and_empty_values() {
        for invalid in [
            "",
            " ",
            ".",
            "..",
            ".en-croissant-trash",
            "a/b",
            "a\\b",
            "game.info",
        ] {
            assert!(
                validate_name(invalid).is_err(),
                "{invalid:?} must not be a basename"
            );
        }
        assert_eq!(validate_name("  Study  ").unwrap(), "Study");
        assert_eq!(pgn_name("Study").unwrap(), "Study.pgn");
        assert_eq!(pgn_name("Study.PGN").unwrap(), "Study.PGN");
    }

    #[test]
    fn metadata_sidecars_default_parse_and_reject_invalid_json() {
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).expect("workspace root");
        let pgn = root.join("game.pgn");
        fs::write(&pgn, "[Event \"test\"]\n").expect("PGN");
        assert_eq!(
            metadata_from(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
            WorkspaceMetadata::default()
        );

        let sidecar = info_path(&pgn).unwrap();
        let metadata = WorkspaceMetadata {
            file_type: WorkspaceFileType::Tournament,
            tags: vec!["rapid".into(), "training".into()],
        };
        fs::write(&sidecar, serde_json::to_vec(&metadata).unwrap()).expect("metadata");
        assert_eq!(
            metadata_from(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
            metadata
        );

        fs::write(sidecar, "not json").expect("invalid metadata");
        assert!(matches!(
            metadata_from(&state.pgn_path_authority, &workspace, &pgn),
            Err(Error::InvalidInput(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn metadata_sidecars_refuse_links_directories_and_fifos() {
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).unwrap();
        let pgn = root.join("game.pgn");
        let sidecar = root.join("game.info");
        fs::write(&pgn, "*").unwrap();
        fs::write(
            root.join("target"),
            serialize_metadata(&WorkspaceMetadata::default()).unwrap(),
        )
        .unwrap();

        std::os::unix::fs::symlink("target", &sidecar).unwrap();
        assert!(metadata_from(&state.pgn_path_authority, &workspace, &pgn).is_err());
        fs::remove_file(&sidecar).unwrap();
        std::os::unix::fs::symlink("missing", &sidecar).unwrap();
        assert!(metadata_from(&state.pgn_path_authority, &workspace, &pgn).is_err());
        fs::remove_file(&sidecar).unwrap();
        fs::create_dir(&sidecar).unwrap();
        assert!(metadata_from(&state.pgn_path_authority, &workspace, &pgn).is_err());
        fs::remove_dir(&sidecar).unwrap();
        let status = std::process::Command::new("mkfifo")
            .arg(&sidecar)
            .status()
            .unwrap();
        assert!(status.success());
        use std::os::unix::fs::OpenOptionsExt;
        let (completed_tx, completed_rx) = std::sync::mpsc::channel();
        let fifo = sidecar.clone();
        let watchdog = std::thread::spawn(move || {
            match completed_rx.recv_timeout(Duration::from_secs(1)) {
                Ok(()) => return false,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    panic!("FIFO completion channel disconnected")
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            }
            let release_started = std::time::Instant::now();
            loop {
                match fs::OpenOptions::new()
                    .write(true)
                    .custom_flags(libc::O_NONBLOCK)
                    .open(&fifo)
                {
                    Ok(mut writer) => {
                        writer
                            .write_all(&serialize_metadata(&WorkspaceMetadata::default()).unwrap())
                            .unwrap();
                        return true;
                    }
                    Err(error)
                        if error.raw_os_error() == Some(libc::ENXIO)
                            && release_started.elapsed() < Duration::from_secs(1) =>
                    {
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => panic!("FIFO watchdog failed: {error}"),
                }
            }
        });
        let result = metadata_from(&state.pgn_path_authority, &workspace, &pgn);
        let _ = completed_tx.send(());
        let released_regression = watchdog.join().unwrap();
        assert!(result.is_err());
        assert!(!released_regression, "metadata opener blocked on the FIFO");
    }

    #[cfg(unix)]
    #[test]
    fn metadata_sidecar_keeps_lossy_non_utf8_naming() {
        use std::os::unix::ffi::OsStringExt;
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).unwrap();
        let leaf = std::ffi::OsString::from_vec(b"game-\xff.pgn".to_vec());
        let pgn = root.join(&leaf);
        fs::write(&pgn, "*").unwrap();
        let sidecar = root.join(sidecar_leaf(&leaf).unwrap());
        let expected = WorkspaceMetadata {
            file_type: WorkspaceFileType::Game,
            tags: vec!["non-utf8".into()],
        };
        fs::write(sidecar, serialize_metadata(&expected).unwrap()).unwrap();
        assert_eq!(
            metadata_from(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
            expected
        );
    }

    #[cfg(unix)]
    #[test]
    fn metadata_sidecar_reads_retained_parent_and_leaf_across_replacements() {
        let (directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).unwrap();
        let pgn = root.join("game.pgn");
        let sidecar = root.join("game.info");
        let trusted = WorkspaceMetadata {
            file_type: WorkspaceFileType::Game,
            tags: vec!["trusted".into()],
        };
        let attacker = WorkspaceMetadata {
            file_type: WorkspaceFileType::Puzzle,
            tags: vec!["attacker".into()],
        };
        fs::write(&pgn, "*").unwrap();
        fs::write(&sidecar, serialize_metadata(&trusted).unwrap()).unwrap();
        let old_root = directory.path().join("old-workspace");
        let replacement_root = root.clone();
        set_workspace_metadata_pre_open_hook(Some(Box::new(move || {
            fs::rename(&replacement_root, &old_root).unwrap();
            fs::create_dir(&replacement_root).unwrap();
            fs::write(replacement_root.join("game.pgn"), "*").unwrap();
            fs::write(
                replacement_root.join("game.info"),
                serialize_metadata(&attacker).unwrap(),
            )
            .unwrap();
        })));
        assert_eq!(
            metadata_from(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
            trusted
        );
        set_workspace_metadata_pre_open_hook(None);

        let (_second_directory, second_state, second_workspace) = workspace_state();
        let second_root =
            workspace_root(&second_state.pgn_path_authority, &second_workspace).unwrap();
        let second_pgn = second_root.join("game.pgn");
        let original_sidecar = second_root.join("game.info");
        let moved_sidecar = second_root.join("original.info");
        fs::write(&second_pgn, "*").unwrap();
        fs::write(&original_sidecar, serialize_metadata(&trusted).unwrap()).unwrap();
        let replacement_sidecar = original_sidecar.clone();
        set_workspace_metadata_post_open_hook(Some(Box::new(move |_| {
            fs::rename(&replacement_sidecar, moved_sidecar).unwrap();
            fs::write(
                replacement_sidecar,
                serialize_metadata(&WorkspaceMetadata {
                    file_type: WorkspaceFileType::Puzzle,
                    tags: vec!["replacement".into()],
                })
                .unwrap(),
            )
            .unwrap();
        })));
        assert_eq!(
            metadata_from(
                &second_state.pgn_path_authority,
                &second_workspace,
                &second_pgn,
            )
            .unwrap(),
            trusted
        );
        set_workspace_metadata_post_open_hook(None);
    }

    #[test]
    fn metadata_sidecar_exact_limit_succeeds_and_growth_consumes_only_cap_plus_one() {
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).unwrap();
        let pgn = root.join("game.pgn");
        let sidecar = root.join("game.info");
        fs::write(&pgn, "*").unwrap();
        let expected = WorkspaceMetadata::default();
        let mut exact = serialize_metadata(&expected).unwrap();
        exact.resize(MAX_WORKSPACE_METADATA_BYTES, b' ');
        fs::write(&sidecar, &exact).unwrap();
        assert_eq!(
            metadata_from(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
            expected
        );

        fs::write(&sidecar, serialize_metadata(&expected).unwrap()).unwrap();
        let observed = Arc::new(StdMutex::new(None));
        let retained = Arc::clone(&observed);
        let growing_sidecar = sidecar.clone();
        set_workspace_metadata_post_open_hook(Some(Box::new(move |opened| {
            *retained.lock().unwrap() = Some(opened.try_clone().unwrap());
            let mut writer = fs::OpenOptions::new()
                .append(true)
                .open(growing_sidecar)
                .unwrap();
            writer
                .write_all(&vec![b' '; MAX_WORKSPACE_METADATA_BYTES + 1])
                .unwrap();
        })));
        let error = metadata_from(&state.pgn_path_authority, &workspace, &pgn).unwrap_err();
        set_workspace_metadata_post_open_hook(None);
        assert!(matches!(error, Error::ResourceLimit(_)));
        let mut retained = observed.lock().unwrap().take().unwrap();
        assert_eq!(
            retained.stream_position().unwrap(),
            (MAX_WORKSPACE_METADATA_BYTES + 1) as u64
        );
    }

    #[test]
    fn oversized_metadata_refuses_create_and_rename_before_mutation() {
        let (_directory, state, workspace) = workspace_state();
        let oversized = WorkspaceMetadata {
            file_type: WorkspaceFileType::Game,
            tags: vec!["x".repeat(MAX_WORKSPACE_METADATA_BYTES)],
        };
        let create = create_workspace_file_blocking(
            workspace.clone(),
            workspace.clone(),
            "too-large".into(),
            oversized.clone(),
            "*".into(),
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &CancellationToken::new(),
        );
        assert!(matches!(create, Err(Error::ResourceLimit(_))));
        let root = workspace_root(&state.pgn_path_authority, &workspace).unwrap();
        assert!(!root.join("too-large.pgn").exists());
        assert!(!root.join("too-large.info").exists());

        let created = create_workspace_file_blocking(
            workspace.clone(),
            workspace.clone(),
            "before".into(),
            WorkspaceMetadata::default(),
            "*".into(),
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &CancellationToken::new(),
        )
        .unwrap();
        let rename = rename_workspace_file_blocking(
            workspace,
            created.handle,
            "after".into(),
            oversized,
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &CancellationToken::new(),
        );
        assert!(matches!(rename, Err(Error::ResourceLimit(_))));
        assert!(root.join("before.pgn").is_file());
        assert!(root.join("before.info").is_file());
        assert!(!root.join("after.pgn").exists());
        assert!(!root.join("after.info").exists());
    }

    #[test]
    fn workspace_helpers_bind_only_registered_descendants_and_preserve_sidecar_names() {
        let (directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).expect("workspace root");
        let game = root.join("round-one.pgn");
        fs::write(&game, "[Event \"Round one\"]\n\n1. e4 e5 *\n").expect("PGN");

        assert_eq!(
            workspace_components(&state.pgn_path_authority, &workspace, &game).unwrap(),
            vec!["round-one.pgn"]
        );
        assert!(workspace_components(
            &state.pgn_path_authority,
            &workspace,
            &directory.path().join("outside.pgn")
        )
        .is_err());
        assert_eq!(
            sidecar_leaf(Path::new("round-one.pgn").as_os_str()).unwrap(),
            "round-one.info"
        );
        assert!(sidecar_leaf(Path::new("/").as_os_str()).is_err());

        let entry = register_entry(
            &state.pgn_path_authority,
            &workspace,
            &game,
            "Round one".into(),
        )
        .expect("entry handle");
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            let metadata = fs::metadata(&game).expect("game metadata");
            let expected = register_created_entry(
                &state.pgn_path_authority,
                &workspace,
                &game,
                "Round one expected".into(),
                (metadata.dev(), metadata.ino()),
                false,
            )
            .expect("expected entry handle");
            let root_target =
                mutation_target(&state.pgn_path_authority, &workspace).expect("root target");
            let entry_target =
                mutation_target(&state.pgn_path_authority, &entry).expect("entry target");
            let expected_target =
                mutation_target(&state.pgn_path_authority, &expected).expect("expected target");
            ensure_registered_descendant(&root_target, &entry_target).expect("entry inside root");
            ensure_registered_descendant(&root_target, &expected_target)
                .expect("expected entry inside root");
        }
    }

    #[test]
    fn timestamps_and_durability_outcomes_remain_renderer_safe() {
        let directory = tempfile::tempdir().expect("timestamp directory");
        let pgn = directory.path().join("game.pgn");
        fs::write(&pgn, "*").expect("PGN");
        assert!(timestamp(&pgn).unwrap() > 0);
        assert_eq!(
            durability_uncertainty(
                crate::infra::fs::AtomicFileOutcome::DurableCommit,
                crate::error::DurabilityStage::WorkspacePgnCreation,
            ),
            None
        );
        assert_eq!(
            durability_uncertainty(
                crate::infra::fs::AtomicFileOutcome::CommittedDurabilityUncertain(
                    std::io::Error::other("/private/workspace: sync failed"),
                ),
                crate::error::DurabilityStage::WorkspaceSidecarCreation,
            ),
            Some(crate::error::DurabilityStage::WorkspaceSidecarCreation)
        );
    }

    /// Creates `before.pgn` with an empty tag list, renames it to `after.pgn` with the tag
    /// `renamed` under `injector`, and returns the workspace root, the entry handle and the
    /// rename result.
    fn rename_under_injector(
        injector: Option<Arc<dyn AtomicWriterInjector + Send + Sync>>,
    ) -> (
        TempDir,
        AppState,
        PathBuf,
        FileWorkspaceHandle,
        Result<(), Error>,
    ) {
        let (directory, state, workspace) = workspace_state();
        let created = create_workspace_file_blocking(
            workspace.clone(),
            workspace.clone(),
            "before".into(),
            WorkspaceMetadata {
                file_type: WorkspaceFileType::Game,
                tags: vec![],
            },
            "*".into(),
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &CancellationToken::new(),
        )
        .expect("created file");
        let root = mutation_target(&state.pgn_path_authority, &workspace)
            .expect("workspace target")
            .path()
            .to_path_buf();
        set_test_atomic_file_injector(injector);
        let result = rename_workspace_file_blocking(
            workspace,
            created.handle.clone(),
            "after".into(),
            WorkspaceMetadata {
                file_type: WorkspaceFileType::Game,
                tags: vec!["renamed".into()],
            },
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &CancellationToken::new(),
        );
        set_test_atomic_file_injector(None);
        (directory, state, root, created.handle, result)
    }

    /// The rename, the sidecar rewrite and the registry rebind all landed, whatever the result.
    fn assert_rename_landed(state: &AppState, root: &Path, handle: &FileWorkspaceHandle) {
        assert!(root.join("after.pgn").is_file());
        assert!(!root.join("before.pgn").exists());
        assert!(!root.join("before.info").exists());
        let sidecar: WorkspaceMetadata =
            serde_json::from_slice(&fs::read(root.join("after.info")).expect("renamed sidecar"))
                .expect("sidecar is the metadata JSON");
        assert_eq!(sidecar.tags, vec!["renamed".to_string()]);
        let rebound = mutation_target(&state.pgn_path_authority, handle)
            .expect("renamed entry stays registered");
        assert_eq!(rebound.path(), root.join("after.pgn"));
    }

    #[test]
    fn rename_workspace_file_moves_pgn_sidecar_and_registry_entry() {
        let (_directory, state, root, handle, result) = rename_under_injector(None);
        result.expect("durable rename");
        assert_rename_landed(&state, &root, &handle);
    }

    #[test]
    fn rename_workspace_file_reports_uncertain_sidecar_after_a_durable_rebind() {
        // Fails only the first parent sync, which is the sidecar rewrite; the registry rebind
        // that follows commits durably, so the `(Some(stage), Ok(()))` arm is the one exercised.
        struct FirstParentSyncFault(std::sync::atomic::AtomicBool);
        impl AtomicWriterInjector for FirstParentSyncFault {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::ParentSync
                    && !self.0.swap(true, std::sync::atomic::Ordering::SeqCst)
                {
                    Err(std::io::Error::other("uncertain"))
                } else {
                    Ok(())
                }
            }
        }
        let (_directory, state, root, handle, result) = rename_under_injector(Some(Arc::new(
            FirstParentSyncFault(std::sync::atomic::AtomicBool::new(false)),
        )));
        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::WorkspaceSidecarReplacement
            ))
        ));
        assert_rename_landed(&state, &root, &handle);
    }

    #[test]
    fn rename_workspace_file_lets_a_failed_rebind_outrank_the_sidecar_uncertainty() {
        // The sidecar rewrite loses its parent sync; the registry rebind that follows fails
        // outright at its rename, so the hard error is the one reported, not the uncertainty.
        struct UncertainSidecarThenFailedRegistry(std::sync::atomic::AtomicBool);
        impl AtomicWriterInjector for UncertainSidecarThenFailedRegistry {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                let sidecar_done = self.0.load(std::sync::atomic::Ordering::SeqCst);
                match point {
                    AtomicFileFaultPoint::ParentSync if !sidecar_done => {
                        self.0.store(true, std::sync::atomic::Ordering::SeqCst);
                        Err(std::io::Error::other("uncertain"))
                    }
                    AtomicFileFaultPoint::Rename if sidecar_done => {
                        Err(std::io::Error::other("registry rename failed"))
                    }
                    _ => Ok(()),
                }
            }
        }
        let (_directory, _state, root, _handle, result) = rename_under_injector(Some(Arc::new(
            UncertainSidecarThenFailedRegistry(std::sync::atomic::AtomicBool::new(false)),
        )));
        assert!(
            matches!(result, Err(Error::Io(_))),
            "a failed rebind must not be reported as an uncertainty: {result:?}"
        );
        assert!(root.join("after.pgn").is_file());
        assert!(root.join("after.info").is_file());
    }

    #[test]
    fn rename_workspace_file_reports_the_sidecar_stage_over_a_registry_uncertainty() {
        // Every parent sync fails: the sidecar rewrite and the registry rebind are both
        // uncertain, and the first stage is the one reported.
        let (_directory, state, root, handle, result) = rename_under_injector(Some(Arc::new(
            crate::infra::fs::ParentSyncFault("uncertain"),
        )));
        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::WorkspaceSidecarReplacement
            ))
        ));
        assert_rename_landed(&state, &root, &handle);
    }

    #[test]
    fn create_workspace_directory_parent_sync_keeps_completed_directory() {
        let (_directory, state, workspace) = workspace_state();
        let root =
            mutation_target(&state.pgn_path_authority, &workspace).expect("workspace target");
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        let error = create_workspace_directory_inner(
            workspace.clone(),
            workspace,
            "created".into(),
            &state.pgn_path_authority,
            &state.workspace_mutation,
            &CancellationToken::new(),
        )
        .expect_err("uncertain registry durability must be surfaced");
        set_test_atomic_file_injector(None);
        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert!(root.path().join("created").is_dir());
    }

    #[test]
    fn collect_tree_entries_stops_traversal_when_cancelled() {
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).expect("root");
        fs::write(root.join("game1.pgn"), b"[Event \"Test 1\"]\n\n1. e4 e5 *").expect("write pgn");
        fs::write(root.join("game2.pgn"), b"[Event \"Test 2\"]\n\n1. d4 d5 *").expect("write pgn");
        let sub = root.join("subdir");
        fs::create_dir(&sub).expect("create subdir");
        fs::write(sub.join("game3.pgn"), b"[Event \"Test 3\"]\n\n1. c4 c5 *").expect("write pgn");

        let token = CancellationToken::new();
        token.cancel();
        let result = collect_tree_entries(&state.pgn_path_authority, &workspace, &token);
        assert!(matches!(result, Err(Error::Cancellation)));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn multi_file_count_cancellation_stops_subsequent_counts() {
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).expect("root");
        fs::write(root.join("a.pgn"), b"[Event \"A\"]\n\n1. e4 e5 *").expect("write a");
        fs::write(root.join("b.pgn"), b"[Event \"B\"]\n\n1. d4 d5 *").expect("write b");
        fs::write(root.join("c.pgn"), b"[Event \"C\"]\n\n1. c4 c5 *").expect("write c");

        let token = CancellationToken::new();
        let (hook, entered, release) = pgn::BoundedHook::new();
        state
            .pgn_repository
            .set_count_hook(Some(hook))
            .expect("set count hook");

        let listing_task = tokio::spawn({
            let workspace = workspace.clone();
            let authority = Arc::clone(&state.pgn_path_authority);
            let repository = state.pgn_repository.clone();
            let token = token.clone();
            async move { list_file_workspace_core(&workspace, &authority, &repository, &token).await }
        });

        tokio::time::timeout(std::time::Duration::from_secs(5), entered)
            .await
            .expect("timeout waiting for count entry")
            .expect("entered count");

        token.cancel();
        let _ = release.send(());

        let result = listing_task.await.expect("join");
        assert!(matches!(result, Err(Error::Cancellation)));
    }

    #[tokio::test]
    async fn parent_token_survives_child_reads() {
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).expect("root");
        fs::write(root.join("a.pgn"), b"[Event \"A\"]\n\n1. e4 e5 *").expect("write a");

        let parent = CancellationToken::new();
        let child_token = parent.child_token();

        child_token.cancel();
        assert!(child_token.is_cancelled());
        assert!(!parent.is_cancelled());

        let (entries, missing) =
            collect_tree_entries(&state.pgn_path_authority, &workspace, &parent).expect("collect");
        assert_eq!(missing.len(), 1);
        let _ = entries;

        let resolved = authority(&state.pgn_path_authority)
            .unwrap()
            .as_mut()
            .unwrap()
            .resolve(missing[0].path_ref(), PathOperation::ReadPgn, &[])
            .unwrap();
        let count = pgn::count_pgn_games_core(resolved, &parent, &state.pgn_repository)
            .await
            .expect("count");
        assert_eq!(count, 1);
        assert!(!parent.is_cancelled());
    }
}
