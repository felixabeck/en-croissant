//! Native PGN collection management.
//!
//! This is deliberately the only layer that knows collection filenames. The renderer receives
//! opaque [`FileWorkspaceHandle`] values plus safe display metadata; it never receives an OS
//! path or sends one back for a PGN operation.

use crate::{
    error::Error,
    infra::path_authority::{
        FileWorkspaceDescriptor, FileWorkspaceHandle, PathClass, PathOperation,
        WorkspaceMutationTarget,
    },
    pgn, AppState,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, UNIX_EPOCH},
};

const TRASH_DIRECTORY: &str = ".en-croissant-trash";

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

fn authority<'a>(
    state: &'a AppState,
) -> Result<std::sync::MutexGuard<'a, Option<crate::infra::path_authority::PathAuthority>>, Error> {
    state
        .pgn_path_authority
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

fn info_path(pgn: &Path) -> Result<PathBuf, Error> {
    let stem = pgn
        .file_stem()
        .ok_or_else(|| Error::InvalidInput("PGN has no filename".into()))?;
    Ok(pgn.with_file_name(format!("{}.info", stem.to_string_lossy())))
}

fn metadata_from(path: &Path) -> Result<WorkspaceMetadata, Error> {
    let sidecar = info_path(path)?;
    if !sidecar.exists() {
        return Ok(WorkspaceMetadata::default());
    }
    let bytes = fs::read(sidecar)?;
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

fn workspace_root(state: &AppState, workspace: &FileWorkspaceHandle) -> Result<PathBuf, Error> {
    authority(state)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .workspace_root(workspace, PathOperation::ReadPgn)
}

#[cfg(unix)]
fn mutation_target(
    state: &AppState,
    entry: &FileWorkspaceHandle,
) -> Result<WorkspaceMutationTarget, Error> {
    authority(state)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .workspace_mutation_target(entry)
}

fn sidecar_leaf(leaf: &std::ffi::OsStr) -> Result<std::ffi::OsString, Error> {
    let path = Path::new(leaf);
    info_path(path)?
        .file_name()
        .map(ToOwned::to_owned)
        .ok_or_else(|| Error::InvalidInput("PGN has no filename".into()))
}

fn durability_uncertainty(
    outcome: crate::infra::fs::AtomicFileOutcome,
    stage: crate::error::DurabilityStage,
) -> Option<crate::error::DurabilityStage> {
    match outcome {
        crate::infra::fs::AtomicFileOutcome::DurableCommit => None,
        crate::infra::fs::AtomicFileOutcome::CommittedDurabilityUncertain(error) => {
            log::warn!("{stage} parent sync failed: {error}");
            Some(stage)
        }
    }
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
    state: &AppState,
    workspace: &FileWorkspaceHandle,
    path: &Path,
) -> Result<Vec<std::ffi::OsString>, Error> {
    let root = workspace_root(state, workspace)?;
    let relative = path
        .strip_prefix(&root)
        .map_err(|_| Error::InvalidInput("workspace entry escapes its root".into()))?;
    Ok(relative
        .components()
        .map(|component| component.as_os_str().to_os_string())
        .collect())
}

fn register_entry(
    state: &AppState,
    workspace: &FileWorkspaceHandle,
    path: &Path,
    display_name: String,
) -> Result<FileWorkspaceHandle, Error> {
    let components = workspace_components(state, workspace, path)?;
    authority(state)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .register_workspace_child(workspace, &components, display_name)
}

#[cfg(unix)]
fn register_created_entry(
    state: &AppState,
    workspace: &FileWorkspaceHandle,
    path: &Path,
    display_name: String,
    identity: (u64, u64),
    is_dir: bool,
) -> Result<FileWorkspaceHandle, Error> {
    let components = workspace_components(state, workspace, path)?;
    authority(state)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .register_workspace_child_expected(workspace, &components, display_name, identity, is_dir)
}

async fn tree_entry(
    state: &tauri::State<'_, AppState>,
    workspace: &FileWorkspaceHandle,
    path: PathBuf,
) -> Result<Option<WorkspaceEntry>, Error> {
    let meta = fs::symlink_metadata(&path)?;
    if meta.file_type().is_symlink() || path.file_name().is_some_and(|name| name == TRASH_DIRECTORY)
    {
        return Ok(None);
    }
    let name = path
        .file_name()
        .ok_or_else(|| Error::InvalidInput("workspace entry has no name".into()))?
        .to_string_lossy()
        .into_owned();
    if meta.is_dir() {
        let handle = register_entry(state.inner(), workspace, &path, name.clone())?;
        let mut children = fs::read_dir(&path)?
            .map(|entry| entry.map_err(Error::from))
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .map(|entry| entry.path())
            .collect::<Vec<_>>();
        children.sort();
        let mut output = Vec::new();
        for child in children {
            if let Some(entry) = Box::pin(tree_entry(state, workspace, child)).await? {
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
        state.inner(),
        workspace,
        &path,
        name.trim_end_matches(".pgn").to_string(),
    )?;
    let resolved = authority(state.inner())?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(handle.path_ref(), PathOperation::ReadPgn, &[])?;
    let game_count = pgn::count_pgn_games_core(resolved, state.clone()).await?;
    Ok(Some(WorkspaceEntry {
        handle,
        kind: WorkspaceEntryKind::File,
        name: name.trim_end_matches(".pgn").to_string(),
        children: vec![],
        metadata: Some(metadata_from(&path)?),
        game_count: Some(game_count),
        last_modified: timestamp(&path)?,
    }))
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
    .map_err(|_| Error::Cancellation)??;
    let display_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "PGN collection".into());
    let mut authority = authority(state.inner())?;
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

#[tauri::command]
#[specta::specta]
pub async fn list_file_workspace(
    workspace: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<WorkspaceEntry>, Error> {
    let root = workspace_root(state.inner(), &workspace)?;
    let mut paths = fs::read_dir(root)?
        .map(|entry| entry.map_err(Error::from))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(|entry| entry.path())
        .collect::<Vec<_>>();
    paths.sort();
    let mut entries = Vec::new();
    for path in paths {
        if let Some(entry) = tree_entry(&state, &workspace, path).await? {
            entries.push(entry);
        }
    }
    Ok(entries)
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
    state: &AppState,
    entry: &FileWorkspaceHandle,
    source: &WorkspaceMutationTarget,
    target: &Path,
) -> Result<(), Error> {
    let mut authority = authority(state)?;
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
    let root = mutation_target(state.inner(), &workspace)?;
    let parent_target = mutation_target(state.inner(), &parent)?;
    ensure_registered_descendant(&root, &parent_target)?;
    let parent_dir = parent_target.directory()?;
    let filename = pgn_name(&name)?;
    let target_leaf = std::ffi::OsString::from(&filename);
    let target = parent_target.path().join(&filename);
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
            file.write_all(
                &serde_json::to_vec(&metadata).map_err(|e| Error::InvalidInput(e.to_string()))?,
            )
            .map_err(Error::from)
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
        state.inner(),
        &workspace,
        &target,
        name.clone(),
        installed.identity,
        false,
    )?;
    let resolved = authority(state.inner())?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(handle.path_ref(), PathOperation::ReadPgn, &[])?;
    let game_count = pgn::count_pgn_games_core(resolved, state).await?;
    let entry = WorkspaceEntry {
        handle,
        kind: WorkspaceEntryKind::File,
        name,
        children: vec![],
        metadata: Some(metadata),
        game_count: Some(game_count),
        last_modified: timestamp(&target)?,
    };
    if let Some(error) = pgn_uncertainty.or(sidecar_uncertainty) {
        return Err(Error::CommittedDurabilityUncertain(error));
    }
    Ok(entry)
}

#[tauri::command]
#[specta::specta]
pub fn create_workspace_directory(
    workspace: FileWorkspaceHandle,
    parent: FileWorkspaceHandle,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceEntry, Error> {
    let root = mutation_target(state.inner(), &workspace)?;
    let parent_target = mutation_target(state.inner(), &parent)?;
    ensure_registered_descendant(&root, &parent_target)?;
    let parent_dir = parent_target.directory()?;
    let name = validate_name(&name)?.to_string();
    let target = parent_target.path().join(&name);
    let target_leaf = std::ffi::OsString::from(&name);
    crate::infra::fs::create_dir_at(parent_dir, &target_leaf)?;
    let identity = crate::infra::fs::entry_identity_at(parent_dir, &target_leaf, true)?;
    let handle = match register_created_entry(
        state.inner(),
        &workspace,
        &target,
        name.clone(),
        identity,
        true,
    ) {
        Ok(handle) => handle,
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
pub fn move_workspace_entry(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    target_directory: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let root = mutation_target(state.inner(), &workspace)?;
    let source = mutation_target(state.inner(), &entry)?;
    let destination = mutation_target(state.inner(), &target_directory)?;
    ensure_registered_descendant(&root, &source)?;
    ensure_registered_descendant(&root, &destination)?;
    let name = source.leaf.clone();
    let target = destination.path().join(&name);
    if source.path() == target {
        return Ok(());
    }
    paired_rename(&source, destination.directory()?, &name)?;
    rebind_after_move(state.inner(), &entry, &source, &target)
}

#[tauri::command]
#[specta::specta]
pub fn rename_workspace_file(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    name: String,
    metadata: WorkspaceMetadata,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let root = mutation_target(state.inner(), &workspace)?;
    let source = mutation_target(state.inner(), &entry)?;
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
    paired_rename(&source, &source.parent, &target_leaf)?;
    let info_leaf = sidecar_leaf(&target_leaf)?;
    crate::infra::fs::atomic_replace_at(&source.parent, &info_leaf, |file| {
        use std::io::Write;
        file.write_all(
            &serde_json::to_vec(&metadata).map_err(|e| Error::InvalidInput(e.to_string()))?,
        )
        .map_err(Error::from)
    })?;
    rebind_after_move(state.inner(), &entry, &source, &target)
}

#[tauri::command]
#[specta::specta]
pub fn trash_workspace_entry(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let root = mutation_target(state.inner(), &workspace)?;
    let source = mutation_target(state.inner(), &entry)?;
    ensure_registered_descendant(&root, &source)?;
    let root_dir = root.directory()?;
    let trash = std::ffi::OsString::from(TRASH_DIRECTORY);
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
    rebind_after_move(state.inner(), &entry, &source, &target)
}

#[tauri::command]
#[specta::specta]
pub fn restore_workspace_entry(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let root = mutation_target(state.inner(), &workspace)?;
    let source = mutation_target(state.inner(), &entry)?;
    let trash_root = root.path().join(TRASH_DIRECTORY);
    source
        .path()
        .strip_prefix(&trash_root)
        .map_err(|_| Error::InvalidInput("workspace entry is not in trash".into()))?;
    let target = root.path().join(&source.leaf);
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
    rebind_after_move(state.inner(), &entry, &source, &target)
}

#[tauri::command]
#[specta::specta]
pub fn permanently_delete_workspace_entry(
    workspace: FileWorkspaceHandle,
    entry: FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    permanently_delete_entry(state.inner(), &workspace, &entry)
}

fn permanently_delete_entry(
    state: &AppState,
    workspace: &FileWorkspaceHandle,
    entry: &FileWorkspaceHandle,
) -> Result<(), Error> {
    let root = mutation_target(state, workspace)?;
    let source = mutation_target(state, entry)?;
    ensure_registered_descendant(&root, &source)?;
    let durability_error = match crate::infra::fs::remove_entry_at(
        &source.parent,
        &source.leaf,
        source.identity,
        source.is_dir,
    ) {
        Ok(()) => None,
        Err(Error::CommittedDurabilityUncertain(stage)) => Some(stage),
        Err(error) => return Err(error),
    };
    if !source.is_dir {
        crate::infra::fs::remove_optional_regular_at(&source.parent, &sidecar_leaf(&source.leaf)?)?;
    }
    authority(state)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .remove_workspace_entry(entry)?;
    if let Some(error) = durability_error {
        return Err(Error::CommittedDurabilityUncertain(error));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::{
        fs::{set_test_removal_injector, RemovalFault, RemovalFaultPoint},
        path_authority::PathAuthority,
    };
    use tempfile::TempDir;

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
        let root = mutation_target(state, workspace).expect("workspace target");
        let child = root.path().join(name);
        fs::create_dir(&child).expect("child directory");
        fs::write(child.join("removed"), b"content").expect("child content");
        let identity = crate::infra::fs::entry_identity_at(
            root.directory().expect("workspace directory"),
            Path::new(name).as_os_str(),
            true,
        )
        .expect("child identity");
        let entry = register_created_entry(state, workspace, &child, name.into(), identity, true)
            .expect("child handle");
        (child, entry)
    }

    fn delete_entry_with_fault(
        state: &AppState,
        workspace: &FileWorkspaceHandle,
        entry: &FileWorkspaceHandle,
        point: RemovalFaultPoint,
    ) -> Result<(), Error> {
        set_test_removal_injector(Some(Box::new(RemovalFault(point))));
        let result = permanently_delete_entry(state, workspace, entry);
        set_test_removal_injector(None);
        result
    }

    #[test]
    fn committed_delete_removes_authority_record_when_parent_sync_fails() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");

        let error =
            delete_entry_with_fault(&state, &workspace, &entry, RemovalFaultPoint::ParentSync)
                .expect_err("parent sync failure must preserve commit status");

        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert!(!child.exists(), "the directory was completely removed");
        assert!(matches!(
            mutation_target(&state, &entry),
            Err(Error::InvalidInput(message)) if message == "workspace entry is not persistent"
        ));
    }

    #[test]
    fn partial_delete_keeps_authority_record() {
        let (_directory, state, workspace) = workspace_state();
        let (child, entry) = registered_child_directory(&state, &workspace, "victim");

        let error = delete_entry_with_fault(
            &state,
            &workspace,
            &entry,
            RemovalFaultPoint::AfterEntryRemoved,
        )
        .expect_err("post-removal failure must be reported");

        assert!(matches!(error, Error::PartialRemoval { .. }));
        assert!(child.exists(), "the top directory remains");
        mutation_target(&state, &entry).expect("authority record remains");
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
        let directory = tempfile::tempdir().expect("metadata directory");
        let pgn = directory.path().join("game.pgn");
        fs::write(&pgn, "[Event \"test\"]\n").expect("PGN");
        assert_eq!(metadata_from(&pgn).unwrap(), WorkspaceMetadata::default());

        let sidecar = info_path(&pgn).unwrap();
        let metadata = WorkspaceMetadata {
            file_type: WorkspaceFileType::Tournament,
            tags: vec!["rapid".into(), "training".into()],
        };
        fs::write(&sidecar, serde_json::to_vec(&metadata).unwrap()).expect("metadata");
        assert_eq!(metadata_from(&pgn).unwrap(), metadata);

        fs::write(sidecar, "not json").expect("invalid metadata");
        assert!(matches!(metadata_from(&pgn), Err(Error::InvalidInput(_))));
    }

    #[test]
    fn workspace_helpers_bind_only_registered_descendants_and_preserve_sidecar_names() {
        let (directory, state, workspace) = workspace_state();
        let root = workspace_root(&state, &workspace).expect("workspace root");
        let game = root.join("round-one.pgn");
        fs::write(&game, "[Event \"Round one\"]\n\n1. e4 e5 *\n").expect("PGN");

        assert_eq!(
            workspace_components(&state, &workspace, &game).unwrap(),
            vec!["round-one.pgn"]
        );
        assert!(
            workspace_components(&state, &workspace, &directory.path().join("outside.pgn"))
                .is_err()
        );
        assert_eq!(
            sidecar_leaf(Path::new("round-one.pgn").as_os_str()).unwrap(),
            "round-one.info"
        );
        assert!(sidecar_leaf(Path::new("/").as_os_str()).is_err());

        let entry =
            register_entry(&state, &workspace, &game, "Round one".into()).expect("entry handle");
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            let metadata = fs::metadata(&game).expect("game metadata");
            let expected = register_created_entry(
                &state,
                &workspace,
                &game,
                "Round one expected".into(),
                (metadata.dev(), metadata.ino()),
                false,
            )
            .expect("expected entry handle");
            let root_target = mutation_target(&state, &workspace).expect("root target");
            let entry_target = mutation_target(&state, &entry).expect("entry target");
            let expected_target = mutation_target(&state, &expected).expect("expected target");
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
}
