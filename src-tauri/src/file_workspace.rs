//! Native PGN collection management.
//!
//! This is deliberately the only layer that knows collection filenames. The renderer receives
//! opaque [`FileWorkspaceHandle`] values plus safe display metadata; it never receives an OS
//! path or sends one back for a PGN operation.

use crate::{
    error::Error,
    infra::blocking::BLOCKING_GATEWAY,
    infra::cancellable_lock::lock_std_cancellable,
    infra::fs::{DirectoryEntry, DirectoryEntryKind},
    infra::path_authority::{
        workspace_sidecar_leaf as sidecar_leaf, CapabilityDirectory, CommitDurability,
        FileWorkspaceDescriptor, FileWorkspaceHandle, PathAuthority, PathClass, PathOperation,
        PathRef, WorkspaceMutationTarget, WorkspaceRemovalStatus,
    },
    pgn, AppState,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::{
    ffi::OsStr,
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
    directory: &CapabilityDirectory,
    pgn: &DirectoryEntry,
) -> Result<WorkspaceMetadata, Error> {
    let mut sidecar = directory.open_metadata_sidecar(pgn)?;
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

fn listed_mtime(entry: &DirectoryEntry) -> Result<i64, Error> {
    if entry.modified_seconds < 0 {
        return Err(Error::InvalidInput(format!(
            "invalid modification time: {}",
            entry.modified_seconds
        )));
    }
    Ok(entry.modified_seconds)
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
        .register_workspace_child_observed(
            workspace,
            &components,
            display_name,
            identity,
            is_dir,
            PathOperation::WritePgn,
        )
}

pub(crate) fn map_picker_join(error: tokio::task::JoinError) -> Error {
    if error.is_cancelled() {
        Error::Cancellation
    } else {
        Error::InvalidInput("native picker task failed".into())
    }
}

#[cfg(all(test, unix))]
type WorkspaceListingConfirmHook = Box<dyn FnMut(&DirectoryEntry)>;

#[cfg(all(test, unix))]
std::thread_local! {
    static WORKSPACE_LISTING_PRE_REGISTER_HOOK: std::cell::RefCell<Option<Box<dyn FnMut()>>> =
        const { std::cell::RefCell::new(None) };
    static WORKSPACE_LISTING_PRE_CONFIRM_HOOK: std::cell::RefCell<Option<WorkspaceListingConfirmHook>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(all(test, unix))]
pub(crate) fn set_workspace_listing_pre_register_hook(hook: Option<Box<dyn FnMut()>>) {
    WORKSPACE_LISTING_PRE_REGISTER_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[cfg(all(test, unix))]
pub(crate) fn set_workspace_listing_pre_confirm_hook(hook: Option<WorkspaceListingConfirmHook>) {
    WORKSPACE_LISTING_PRE_CONFIRM_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[cfg(unix)]
const MAX_WORKSPACE_LISTING_DEPTH: usize = 64;

// A pre-existing synchronous helper is the blocking body and gets no pass-through
// wrapper, so the command holds the spawn. Same keep-name rule as puzzle.rs:
// `collect_tree_entries`, `create_workspace_directory_inner`, `trash_entry`,
// `restore_entry`.
#[cfg(unix)]
fn collect_tree_entries(
    pgn_path_authority: &Mutex<Option<PathAuthority>>,
    workspace: &FileWorkspaceHandle,
    token: &CancellationToken,
) -> Result<(Vec<WorkspaceEntry>, Vec<FileWorkspaceHandle>), Error> {
    use std::os::unix::ffi::OsStrExt;

    struct Staged {
        components: Vec<std::ffi::OsString>,
        name: String,
        identity: (u64, u64),
        last_modified: i64,
        body: StagedBody,
    }

    enum StagedBody {
        Directory(Vec<Staged>),
        File(WorkspaceMetadata),
    }

    fn confirm_staged(dir: &CapabilityDirectory, entry: &DirectoryEntry) -> Result<(), Error> {
        #[cfg(all(test, unix))]
        WORKSPACE_LISTING_PRE_CONFIRM_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().as_mut() {
                hook(entry);
            }
        });
        dir.confirm_entry(entry)
    }

    fn walk(
        dir: &CapabilityDirectory,
        components: Vec<std::ffi::OsString>,
        depth: usize,
        token: &CancellationToken,
    ) -> Result<Vec<Staged>, Error> {
        if depth > MAX_WORKSPACE_LISTING_DEPTH {
            return Err(Error::ResourceLimit(format!(
                "workspace listing exceeded {MAX_WORKSPACE_LISTING_DEPTH} levels"
            )));
        }
        if token.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let mut entries = dir.entries(token, &mut |name| name != OsStr::new(TRASH_DIRECTORY))?;
        if token.is_cancelled() {
            return Err(Error::Cancellation);
        }
        entries.sort_by(|left, right| {
            left.name
                .as_os_str()
                .as_bytes()
                .cmp(right.name.as_os_str().as_bytes())
        });
        let mut staged = Vec::new();
        for entry in entries {
            if token.is_cancelled() {
                return Err(Error::Cancellation);
            }
            let is_directory = match entry.kind {
                DirectoryEntryKind::Directory => true,
                DirectoryEntryKind::RegularFile => false,
                DirectoryEntryKind::Other => continue,
            };
            let display = entry.name.to_string_lossy().into_owned();
            if !is_directory && !display.to_ascii_lowercase().ends_with(".pgn") {
                continue;
            }
            let mut child_components = components.clone();
            child_components.push(entry.name.clone());
            if is_directory {
                let last_modified = listed_mtime(&entry)?;
                let child = dir.open_child_directory(&entry)?;
                let children = walk(&child, child_components.clone(), depth + 1, token)?;
                if token.is_cancelled() {
                    return Err(Error::Cancellation);
                }
                confirm_staged(dir, &entry)?;
                staged.push(Staged {
                    components: child_components,
                    name: display,
                    identity: entry.identity,
                    last_modified,
                    body: StagedBody::Directory(children),
                });
            } else {
                let name = display.trim_end_matches(".pgn").to_string();
                let last_modified = listed_mtime(&entry)?;
                let metadata = metadata_from(dir, &entry)?;
                if token.is_cancelled() {
                    return Err(Error::Cancellation);
                }
                confirm_staged(dir, &entry)?;
                staged.push(Staged {
                    components: child_components,
                    name,
                    identity: entry.identity,
                    last_modified,
                    body: StagedBody::File(metadata),
                });
            }
        }
        Ok(staged)
    }

    fn register(
        staged: Vec<Staged>,
        pgn_path_authority: &Mutex<Option<PathAuthority>>,
        workspace: &FileWorkspaceHandle,
        token: &CancellationToken,
        missing: &mut Vec<FileWorkspaceHandle>,
    ) -> Result<Vec<WorkspaceEntry>, Error> {
        let mut result = Vec::new();
        for entry in staged {
            if token.is_cancelled() {
                return Err(Error::Cancellation);
            }
            #[cfg(all(test, unix))]
            WORKSPACE_LISTING_PRE_REGISTER_HOOK.with(|slot| {
                if let Some(hook) = slot.borrow_mut().as_mut() {
                    hook();
                }
            });
            let is_dir = matches!(entry.body, StagedBody::Directory(_));
            let handle = authority(pgn_path_authority)?
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
                .register_workspace_child_observed(
                    workspace,
                    &entry.components,
                    entry.name.clone(),
                    entry.identity,
                    is_dir,
                    PathOperation::ReadPgn,
                )?;
            if !is_dir {
                missing.push(handle.clone());
            }
            let (metadata, nested) = match entry.body {
                StagedBody::Directory(children) => (
                    None,
                    register(children, pgn_path_authority, workspace, token, missing)?,
                ),
                StagedBody::File(metadata) => (Some(metadata), Vec::new()),
            };
            result.push(WorkspaceEntry {
                handle,
                kind: if is_dir {
                    WorkspaceEntryKind::Directory
                } else {
                    WorkspaceEntryKind::File
                },
                name: entry.name,
                children: nested,
                metadata,
                game_count: None,
                last_modified: entry.last_modified,
            });
        }
        Ok(result)
    }

    let root = authority(pgn_path_authority)?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .capability_directory(workspace.path_ref(), PathOperation::ReadPgn)?;
    let staged = walk(&root, Vec::new(), 0, token)?;
    let mut missing = Vec::new();
    let entries = register(staged, pgn_path_authority, workspace, token, &mut missing)?;
    Ok((entries, missing))
}

#[cfg(not(unix))]
fn collect_tree_entries(
    _pgn_path_authority: &Mutex<Option<PathAuthority>>,
    _workspace: &FileWorkspaceHandle,
    _token: &CancellationToken,
) -> Result<(Vec<WorkspaceEntry>, Vec<FileWorkspaceHandle>), Error> {
    Err(Error::Conflict(
        "workspace listing is unsupported on this platform".into(),
    ))
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
    #[cfg(unix)]
    use crate::infra::path_authority::{
        set_workspace_metadata_post_open_hook, set_workspace_metadata_pre_open_hook,
    };
    use crate::infra::{
        fs::{
            set_test_atomic_file_injector, set_test_removal_injector, AtomicFileFaultPoint,
            AtomicWriterInjector, RemovalFault, RemovalFaultPoint,
        },
        path_authority::PathAuthority,
    };
    #[cfg(unix)]
    use std::os::unix::fs::MetadataExt;
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

    #[cfg(unix)]
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

    #[cfg(unix)]
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

    fn metadata_from_path(
        pgn_path_authority: &Mutex<Option<PathAuthority>>,
        workspace: &FileWorkspaceHandle,
        path: &Path,
    ) -> Result<WorkspaceMetadata, Error> {
        let components = workspace_components(pgn_path_authority, workspace, path)?;
        let mut guard = authority(pgn_path_authority)?;
        let authority = guard
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
        let mut directory =
            authority.capability_directory(workspace.path_ref(), PathOperation::ReadPgn)?;
        let token = CancellationToken::new();
        for component in &components[..components.len().saturating_sub(1)] {
            let entries = directory.entries(&token, &mut |name| name == component)?;
            let entry = entries
                .into_iter()
                .find(|entry| entry.name == *component)
                .ok_or_else(|| {
                    Error::Io(Box::new(std::io::Error::from(std::io::ErrorKind::NotFound)))
                })?;
            directory = directory.open_child_directory(&entry)?;
        }
        let leaf = components
            .last()
            .ok_or_else(|| Error::InvalidInput("PGN has no filename".into()))?;
        let entry = directory
            .entries(&token, &mut |name| name == leaf)?
            .into_iter()
            .find(|entry| entry.name == *leaf)
            .ok_or_else(|| {
                Error::Io(Box::new(std::io::Error::from(std::io::ErrorKind::NotFound)))
            })?;
        metadata_from(&directory, &entry)
    }

    #[cfg(unix)]
    fn registered_child_file(
        state: &AppState,
        workspace: &FileWorkspaceHandle,
        path: &Path,
    ) -> FileWorkspaceHandle {
        let metadata = fs::symlink_metadata(path).expect("file metadata");
        let identity = (metadata.dev(), metadata.ino());
        let components = workspace_components(&state.pgn_path_authority, workspace, path)
            .expect("workspace components");
        authority(&state.pgn_path_authority)
            .expect("authority lock")
            .as_mut()
            .expect("authority")
            .register_workspace_child_observed(
                workspace,
                &components,
                path.file_stem()
                    .expect("file stem")
                    .to_string_lossy()
                    .into_owned(),
                identity,
                false,
                PathOperation::ReadPgn,
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

    #[cfg(unix)]
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

    #[cfg(unix)]
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

    #[cfg(unix)]
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

    #[cfg(unix)]
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

    #[cfg(unix)]
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

    #[cfg(unix)]
    #[test]
    fn metadata_sidecars_default_parse_and_reject_invalid_json() {
        let (_directory, state, workspace) = workspace_state();
        let root = workspace_root(&state.pgn_path_authority, &workspace).expect("workspace root");
        let pgn = root.join("game.pgn");
        fs::write(&pgn, "[Event \"test\"]\n").expect("PGN");
        assert_eq!(
            metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
            WorkspaceMetadata::default()
        );

        let sidecar = info_path(&pgn).unwrap();
        let metadata = WorkspaceMetadata {
            file_type: WorkspaceFileType::Tournament,
            tags: vec!["rapid".into(), "training".into()],
        };
        fs::write(&sidecar, serde_json::to_vec(&metadata).unwrap()).expect("metadata");
        assert_eq!(
            metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
            metadata
        );

        fs::write(sidecar, "not json").expect("invalid metadata");
        assert!(matches!(
            metadata_from_path(&state.pgn_path_authority, &workspace, &pgn),
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
        assert!(metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).is_err());
        fs::remove_file(&sidecar).unwrap();
        std::os::unix::fs::symlink("missing", &sidecar).unwrap();
        assert!(metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).is_err());
        fs::remove_file(&sidecar).unwrap();
        fs::create_dir(&sidecar).unwrap();
        assert!(metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).is_err());
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
        let result = metadata_from_path(&state.pgn_path_authority, &workspace, &pgn);
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
            metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
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
            metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
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
            metadata_from_path(
                &second_state.pgn_path_authority,
                &second_workspace,
                &second_pgn,
            )
            .unwrap(),
            trusted
        );
        set_workspace_metadata_post_open_hook(None);
    }

    #[cfg(unix)]
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
            metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).unwrap(),
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
        let error = metadata_from_path(&state.pgn_path_authority, &workspace, &pgn).unwrap_err();
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

    #[cfg(unix)]
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

        let metadata = fs::metadata(&game).expect("game metadata");
        let identity = (metadata.dev(), metadata.ino());
        let components = workspace_components(&state.pgn_path_authority, &workspace, &game)
            .expect("workspace components");
        let entry = authority(&state.pgn_path_authority)
            .expect("authority lock")
            .as_mut()
            .expect("authority")
            .register_workspace_child_observed(
                &workspace,
                &components,
                "Round one",
                identity,
                false,
                PathOperation::ReadPgn,
            )
            .expect("entry handle");
        {
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

    #[cfg(unix)]
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

    #[cfg(unix)]
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

    #[cfg(unix)]
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

#[cfg(unix)]
#[cfg(test)]
mod workspace_directory_enumeration_tests {
    use super::*;
    use crate::infra::path_authority::{
        set_capability_child_pre_open_hook, set_capability_directory_post_entries_hook,
        set_workspace_metadata_post_open_hook, set_workspace_metadata_pre_open_hook, PathAuthority,
        SystemClock,
    };
    use std::os::unix::fs::FileExt;
    use std::os::unix::fs::MetadataExt;
    use std::sync::atomic::{AtomicBool, Ordering};
    use tempfile::TempDir;

    fn workspace_fixture() -> (
        TempDir,
        Mutex<Option<PathAuthority>>,
        FileWorkspaceHandle,
        PathBuf,
    ) {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("workspace");
        fs::create_dir(&root).unwrap();
        let mut authority = PathAuthority::open_with_clock(
            directory.path().join("registry.json"),
            vec![],
            Arc::new(SystemClock),
            2,
        )
        .unwrap();
        let id = authority
            .migrate_legacy_os_path(
                root.clone().into_os_string(),
                "workspace",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )
            .unwrap()
            .id;
        (
            directory,
            Mutex::new(Some(authority)),
            FileWorkspaceHandle::new(id),
            root,
        )
    }

    #[test]
    fn collect_tree_entries_matches_the_workspace_shape() {
        use std::{
            ffi::OsString,
            os::unix::{
                ffi::{OsStrExt, OsStringExt},
                fs::symlink,
            },
        };

        let (directory, authority, workspace, root) = workspace_fixture();
        fs::write(root.join("a.pgn"), b"*").unwrap();
        fs::write(
            root.join("a.info"),
            br#"{"type":"game","tags":["trusted"]}"#,
        )
        .unwrap();
        fs::write(root.join("B.PGN"), b"*").unwrap();
        let raw_first = OsString::from_vec(b"\x81.pgn".to_vec());
        let raw_second = OsString::from_vec(b"\x80_.pgn".to_vec());
        fs::write(root.join(&raw_first), b"*").unwrap();
        fs::write(root.join(&raw_second), b"*").unwrap();
        fs::write(root.join("notes.txt"), b"notes").unwrap();
        let raw_order = [&raw_first, &raw_second];
        let lossy_order = raw_order
            .iter()
            .map(|name| name.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        let raw_cmp = raw_order[0].as_bytes().cmp(raw_order[1].as_bytes());
        let lossy_cmp = lossy_order[0].cmp(&lossy_order[1]);
        assert_ne!(raw_cmp, lossy_cmp);
        let nested = root.join("nested");
        fs::create_dir(&nested).unwrap();
        fs::write(nested.join("inner.pgn"), b"*").unwrap();
        fs::create_dir(root.join(TRASH_DIRECTORY)).unwrap();
        fs::create_dir(nested.join(TRASH_DIRECTORY)).unwrap();
        let outside = directory.path().join("outside");
        fs::create_dir(&outside).unwrap();
        symlink(root.join("a.pgn"), root.join("linked.pgn")).unwrap();
        symlink(&outside, root.join("linked-dir")).unwrap();
        let fifo = root.join("f.pgn");
        let status = std::process::Command::new("mkfifo")
            .arg(&fifo)
            .status()
            .unwrap();
        assert!(status.success());

        let (entries, missing) =
            collect_tree_entries(&authority, &workspace, &CancellationToken::new()).unwrap();
        let top_names = entries
            .iter()
            .map(|entry| entry.name.as_str())
            .collect::<Vec<_>>();
        assert_eq!(top_names, ["B.PGN", "a", "nested", "�_", "�"]);
        let a_entry = entries.iter().find(|entry| entry.name == "a").unwrap();
        assert_eq!(a_entry.kind, WorkspaceEntryKind::File);
        assert_eq!(a_entry.metadata.as_ref().unwrap().tags, ["trusted"]);
        let nested_entry = entries.iter().find(|entry| entry.name == "nested").unwrap();
        assert_eq!(nested_entry.kind, WorkspaceEntryKind::Directory);
        assert_eq!(nested_entry.children.len(), 1);
        assert_eq!(nested_entry.children[0].name, "inner");
        assert_eq!(nested_entry.children[0].kind, WorkspaceEntryKind::File);

        fn flatten<'a>(entries: &'a [WorkspaceEntry], out: &mut Vec<&'a WorkspaceEntry>) {
            for entry in entries {
                out.push(entry);
                flatten(&entry.children, out);
            }
        }
        let mut listed = Vec::new();
        flatten(&entries, &mut listed);
        assert_eq!(missing.len(), 5);
        let listed_files = listed
            .iter()
            .filter(|entry| entry.kind == WorkspaceEntryKind::File)
            .collect::<Vec<_>>();
        assert_eq!(listed_files.len(), missing.len());
        assert!(listed_files
            .iter()
            .all(|entry| missing.iter().any(|handle| handle == &entry.handle)));
        assert!(missing
            .iter()
            .all(|handle| { missing.iter().filter(|other| *other == handle).count() == 1 }));
        let mut guard = authority.lock().unwrap();
        let authority = guard.as_mut().unwrap();
        let snapshot = authority.persistent_snapshot_for_test();
        let expected_paths = [
            root.join("a.pgn"),
            root.join("B.PGN"),
            root.join(&raw_first),
            root.join(&raw_second),
            nested.join("inner.pgn"),
        ];
        let expected_entries = [
            (root.join("a.pgn"), "a".to_string()),
            (root.join("B.PGN"), "B.PGN".to_string()),
            (root.join(&raw_first), "�".to_string()),
            (root.join(&raw_second), "�_".to_string()),
            (nested.clone(), "nested".to_string()),
            (nested.join("inner.pgn"), "inner".to_string()),
        ];
        for entry in &listed {
            let (path, _) = expected_entries
                .iter()
                .find(|(_, display)| display == &entry.name)
                .unwrap();
            assert_eq!(entry.last_modified, mtime_seconds(path));
        }
        for entry in &listed_files {
            let resolved = authority
                .resolve(entry.handle.path_ref(), PathOperation::ReadPgn, &[])
                .unwrap();
            let path = expected_paths
                .iter()
                .find(|path| {
                    let filename = path.file_name().unwrap().to_string_lossy();
                    let display = if filename.ends_with(".pgn") {
                        filename.trim_end_matches(".pgn").to_string()
                    } else {
                        filename.into_owned()
                    };
                    display == entry.name
                })
                .unwrap();
            use std::os::unix::fs::MetadataExt;
            let metadata = fs::symlink_metadata(path).unwrap();
            let identity = (metadata.dev(), metadata.ino());
            assert!(snapshot
                .iter()
                .any(|(_, observed, is_dir)| { !*is_dir && *observed == identity }));
            assert_eq!(entry.last_modified, mtime_seconds(path));
            let _ = resolved;
        }
        assert!(missing
            .iter()
            .all(|handle| { listed_files.iter().any(|entry| entry.handle == *handle) }));
    }

    fn mtime_seconds(path: &Path) -> i64 {
        use std::os::unix::fs::MetadataExt;
        fs::symlink_metadata(path).unwrap().mtime()
    }

    #[test]
    fn collect_tree_entries_lists_a_workspace_under_a_symlinked_ancestor() {
        use std::os::unix::fs::symlink;
        let directory = tempfile::tempdir().unwrap();
        let real = directory.path().join("real");
        let link = directory.path().join("link");
        let root = real.join("workspace");
        fs::create_dir_all(&root).unwrap();
        symlink(&real, &link).unwrap();
        fs::write(root.join("a.pgn"), b"*").unwrap();
        let mut authority = PathAuthority::open_with_clock(
            directory.path().join("registry.json"),
            vec![],
            Arc::new(SystemClock),
            2,
        )
        .unwrap();
        let id = authority
            .migrate_legacy_os_path(
                link.join("workspace").into_os_string(),
                "workspace",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn],
            )
            .unwrap()
            .id;
        let workspace = FileWorkspaceHandle::new(id);
        let authority = Mutex::new(Some(authority));
        let (entries, _) =
            collect_tree_entries(&authority, &workspace, &CancellationToken::new()).unwrap();
        assert_eq!(entries[0].name, "a");
    }

    #[test]
    fn collect_tree_entries_refuses_a_directory_swapped_mid_walk() {
        use std::os::unix::fs::symlink;
        let (_directory, authority, workspace, root) = workspace_fixture();
        let sub = root.join("sub");
        let outside = root.join("outside");
        fs::create_dir(&sub).unwrap();
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("leak.pgn"), b"*").unwrap();
        let old = root.join("sub-old");
        let sub_for_hook = sub.clone();
        let outside_for_hook = outside.clone();
        set_capability_child_pre_open_hook(Some(Box::new(move || {
            fs::rename(&sub_for_hook, &old).unwrap();
            symlink(&outside_for_hook, &sub_for_hook).unwrap();
        })));
        let result = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        set_capability_child_pre_open_hook(None);
        assert!(matches!(result, Err(Error::Conflict(_))), "{result:?}");
        use std::os::unix::fs::MetadataExt;
        let outside_identity = (
            fs::symlink_metadata(&outside).unwrap().dev(),
            fs::symlink_metadata(&outside).unwrap().ino(),
        );
        let leak_identity = (
            fs::symlink_metadata(outside.join("leak.pgn"))
                .unwrap()
                .dev(),
            fs::symlink_metadata(outside.join("leak.pgn"))
                .unwrap()
                .ino(),
        );
        let snapshot = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert!(!snapshot.iter().any(|(_, identity, _)| {
            *identity == outside_identity || *identity == leak_identity
        }));
    }

    #[test]
    fn collect_tree_entries_never_returns_metadata_from_a_replaced_parent() {
        let (directory, authority, workspace, root) = workspace_fixture();
        let sub = root.join("sub");
        fs::create_dir(&sub).unwrap();
        let pgn = sub.join("a.pgn");
        fs::write(&pgn, b"*").unwrap();
        let trusted_sidecar = br#"{"type":"game","tags":["trusted"]}"#.to_vec();
        fs::write(sub.join("a.info"), &trusted_sidecar).unwrap();
        let opened_sidecar = Arc::new(Mutex::new(None::<Vec<u8>>));
        let opened_sidecar_for_hook = Arc::clone(&opened_sidecar);
        set_workspace_metadata_post_open_hook(Some(Box::new(move |file| {
            let length = file.metadata().unwrap().len() as usize;
            let mut bytes = vec![0; length];
            let mut offset = 0;
            while offset < bytes.len() {
                let read = file.read_at(&mut bytes[offset..], offset as u64).unwrap();
                if read == 0 {
                    bytes.truncate(offset);
                    break;
                }
                offset += read;
            }
            *opened_sidecar_for_hook.lock().unwrap() = Some(bytes);
        })));
        let replacement_ran = Arc::new(AtomicBool::new(false));
        let replacement_ran_for_hook = Arc::clone(&replacement_ran);
        let sub_for_hook = sub.clone();
        let moved = directory.path().join("sub-old");
        set_workspace_metadata_pre_open_hook(Some(Box::new(move || {
            replacement_ran_for_hook.store(true, Ordering::SeqCst);
            fs::rename(&sub_for_hook, &moved).unwrap();
            fs::create_dir(&sub_for_hook).unwrap();
            fs::hard_link(moved.join("a.pgn"), sub_for_hook.join("a.pgn")).unwrap();
            fs::write(
                sub_for_hook.join("a.info"),
                br#"{"type":"game","tags":["attacker"]}"#,
            )
            .unwrap();
        })));
        let result = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        set_workspace_metadata_pre_open_hook(None);
        set_workspace_metadata_post_open_hook(None);
        assert!(replacement_ran.load(Ordering::SeqCst));
        let recorded_sidecar = opened_sidecar.lock().unwrap().clone();
        assert!(
            recorded_sidecar.is_some(),
            "metadata sidecar post-open hook did not fire"
        );
        assert_eq!(
            recorded_sidecar.as_deref(),
            Some(trusted_sidecar.as_slice())
        );
        match result {
            Ok((entries, _)) => {
                let metadata = entries
                    .iter()
                    .find(|entry| entry.name == "sub")
                    .and_then(|entry| entry.children.iter().find(|child| child.name == "a"))
                    .and_then(|entry| entry.metadata.as_ref())
                    .unwrap();
                assert_eq!(metadata.tags, ["trusted"]);
            }
            Err(Error::Conflict(_)) => {}
            Err(error) => panic!("unexpected error: {error:?}"),
        }
    }

    #[test]
    fn collect_tree_entries_refuses_a_pgn_replaced_after_enumeration() {
        let (_directory, authority, workspace, root) = workspace_fixture();
        let pgn = root.join("a.pgn");
        fs::write(&pgn, b"*").unwrap();
        let pgn_for_hook = pgn.clone();
        set_capability_directory_post_entries_hook(Some(Box::new(move || {
            let replacement = pgn_for_hook.with_extension("replacement");
            fs::write(&replacement, b"replacement").unwrap();
            fs::rename(&replacement, &pgn_for_hook).unwrap();
        })));
        let result = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        set_capability_directory_post_entries_hook(None);
        assert!(matches!(result, Err(Error::Conflict(_))), "{result:?}");
        assert!(!authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test()
            .iter()
            .any(|(name, _, _)| name == "a"));
    }

    #[test]
    fn collect_tree_entries_refuses_an_entry_replaced_before_registration() {
        let (_directory, authority, workspace, root) = workspace_fixture();
        let pgn = root.join("a.pgn");
        fs::write(&pgn, b"*").unwrap();
        let before = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        let replacement = root.join("a.replacement");
        let pgn_for_hook = pgn.clone();
        set_workspace_listing_pre_confirm_hook(Some(Box::new(move |_| {
            fs::rename(&pgn_for_hook, &replacement).unwrap();
            fs::write(&pgn_for_hook, b"replacement").unwrap();
        })));
        let result = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        set_workspace_listing_pre_confirm_hook(None);
        assert!(matches!(result, Err(Error::Conflict(_))));
        assert_eq!(
            authority
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .persistent_snapshot_for_test(),
            before
        );

        let (_directory, authority, workspace, root) = workspace_fixture();
        let sub = root.join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("inner.pgn"), b"*").unwrap();
        let before = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        let sub_for_hook = sub.clone();
        set_workspace_listing_pre_confirm_hook(Some(Box::new(move |entry| {
            if entry.name == "sub" {
                fs::rename(&sub_for_hook, root.join("sub-old")).unwrap();
                fs::create_dir(&sub_for_hook).unwrap();
            }
        })));
        let result = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        set_workspace_listing_pre_confirm_hook(None);
        assert!(matches!(result, Err(Error::Conflict(_))));
        let after = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert_eq!(after, before);
        assert!(!after
            .iter()
            .any(|(name, _, is_dir)| name == "inner" && !*is_dir));
    }

    #[test]
    fn collect_tree_entries_propagates_a_vanished_entry() {
        let (_directory, authority, workspace, root) = workspace_fixture();
        let sub = root.join("sub");
        fs::create_dir(&sub).unwrap();
        let pgn = sub.join("a.pgn");
        fs::write(&pgn, b"*").unwrap();
        let before = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        let pgn_for_hook = pgn.clone();
        crate::infra::fs::set_read_directory_pre_stat_hook(Some(Box::new(move |name| {
            if name == OsStr::new("a.pgn") && pgn_for_hook.exists() {
                fs::remove_file(&pgn_for_hook).unwrap();
            }
        })));
        let result = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        crate::infra::fs::set_read_directory_pre_stat_hook(None);
        assert!(result.is_err());
        let after = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert_eq!(after, before);
        assert!(!after
            .iter()
            .any(|(name, _, _)| name == "sub" || name == "a"));
    }

    #[test]
    fn collect_tree_entries_cancels_after_an_empty_snapshot() {
        let (_directory, authority, workspace, root) = workspace_fixture();
        fs::create_dir(root.join(TRASH_DIRECTORY)).unwrap();
        let token = CancellationToken::new();
        let cancel = token.clone();
        set_capability_directory_post_entries_hook(Some(Box::new(move || cancel.cancel())));
        let result = collect_tree_entries(&authority, &workspace, &token);
        set_capability_directory_post_entries_hook(None);
        assert!(matches!(result, Err(Error::Cancellation)));
    }

    #[test]
    fn collect_tree_entries_cancels_between_directories() {
        let (_directory, authority, workspace, root) = workspace_fixture();
        fs::create_dir(root.join("sub")).unwrap();
        let before = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        let token = CancellationToken::new();
        let cancel = token.clone();
        set_capability_directory_post_entries_hook(Some(Box::new(move || cancel.cancel())));
        let result = collect_tree_entries(&authority, &workspace, &token);
        set_capability_directory_post_entries_hook(None);
        assert!(matches!(result, Err(Error::Cancellation)));
        assert_eq!(
            authority
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .persistent_snapshot_for_test(),
            before
        );
    }

    #[test]
    fn collect_tree_entries_refuses_a_pre_epoch_listed_entry() {
        let old = std::time::SystemTime::UNIX_EPOCH - Duration::from_secs(1);

        let (_directory, authority, workspace, root) = workspace_fixture();
        let pgn = root.join("old.pgn");
        fs::write(&pgn, b"*").unwrap();
        fs::OpenOptions::new()
            .write(true)
            .open(&pgn)
            .unwrap()
            .set_modified(old)
            .unwrap();
        let before = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert!(matches!(
            collect_tree_entries(&authority, &workspace, &CancellationToken::new()),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(
            authority
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .persistent_snapshot_for_test(),
            before
        );

        let (_directory, authority, workspace, root) = workspace_fixture();
        let sub = root.join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("a.pgn"), b"*").unwrap();
        fs::File::open(&sub).unwrap().set_modified(old).unwrap();
        let before = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert!(matches!(
            collect_tree_entries(&authority, &workspace, &CancellationToken::new()),
            Err(Error::InvalidInput(_))
        ));
        let after = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert_eq!(after, before);
        assert!(!after
            .iter()
            .any(|(name, _, _)| name == "sub" || name == "a"));

        let (_directory, authority, workspace, root) = workspace_fixture();
        let notes = root.join("notes.txt");
        fs::write(&notes, b"notes").unwrap();
        fs::OpenOptions::new()
            .write(true)
            .open(&notes)
            .unwrap()
            .set_modified(old)
            .unwrap();
        assert!(collect_tree_entries(&authority, &workspace, &CancellationToken::new()).is_ok());
    }

    #[test]
    fn collect_tree_entries_refuses_beyond_the_depth_bound() {
        let (_directory, authority, workspace, root) = workspace_fixture();
        let mut current = root;
        for index in 0..MAX_WORKSPACE_LISTING_DEPTH {
            current = current.join(format!("d{index}"));
            fs::create_dir(&current).unwrap();
        }
        let result = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        let (entries, _) = result.unwrap();
        let mut cursor = &entries[0];
        for index in 1..MAX_WORKSPACE_LISTING_DEPTH {
            cursor = &cursor.children[0];
            assert_eq!(cursor.name, format!("d{index}"));
        }
        assert_eq!(cursor.name, format!("d{}", MAX_WORKSPACE_LISTING_DEPTH - 1));
        let (_directory, authority, workspace, root) = workspace_fixture();
        let mut current = root;
        for index in 0..=MAX_WORKSPACE_LISTING_DEPTH {
            current = current.join(format!("d{index}"));
            fs::create_dir(&current).unwrap();
        }
        let before = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert!(matches!(
            collect_tree_entries(&authority, &workspace, &CancellationToken::new()),
            Err(Error::ResourceLimit(_))
        ));
        assert_eq!(
            authority
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .persistent_snapshot_for_test(),
            before
        );
    }

    #[test]
    fn collect_tree_entries_returns_refusing_handles_for_entries_replaced_after_confirmation() {
        use std::os::unix::fs::symlink;
        let (directory, authority, workspace, root) = workspace_fixture();
        let a = root.join("a.pgn");
        let b = root.join("b.pgn");
        let c = root.join("c.pgn");
        let deep = root.join("deep");
        let sub = root.join("sub");
        fs::write(&a, b"a").unwrap();
        fs::write(&b, b"b").unwrap();
        fs::write(&c, b"c").unwrap();
        fs::create_dir(&deep).unwrap();
        fs::write(deep.join("d.pgn"), b"d").unwrap();
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("inner.pgn"), b"inner").unwrap();
        let outside = directory.path().join("outside");
        fs::create_dir(&outside).unwrap();
        let counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let counter_for_hook = Arc::clone(&counter);
        set_workspace_listing_pre_register_hook(Some(Box::new(move || {
            match counter_for_hook.fetch_add(1, std::sync::atomic::Ordering::SeqCst) {
                0 => {
                    fs::rename(&a, root.join("a-old.pgn")).unwrap();
                    fs::write(&a, b"replacement").unwrap();
                }
                1 => {
                    fs::rename(&b, root.join("b-old.pgn")).unwrap();
                    fs::create_dir(&b).unwrap();
                }
                2 => {
                    fs::remove_file(&c).unwrap();
                }
                3 => {
                    fs::rename(&deep, root.join("deep-old")).unwrap();
                    fs::hard_link(root.join("deep-old/d.pgn"), outside.join("d.pgn")).unwrap();
                    symlink(&outside, &deep).unwrap();
                }
                5 => {
                    fs::rename(&sub, root.join("sub-old")).unwrap();
                    fs::create_dir(&sub).unwrap();
                }
                _ => {}
            }
        })));
        let result = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        set_workspace_listing_pre_register_hook(None);
        let (entries, _) = result.unwrap();
        assert_eq!(entries.len(), 5);
        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            ["a", "b", "c", "deep", "sub"]
        );
        for name in ["a", "b", "c"] {
            let entry = entries.iter().find(|entry| entry.name == name).unwrap();
            assert_eq!(entry.kind, WorkspaceEntryKind::File);
            assert!(entry.children.is_empty());
        }
        let deep_entry = entries.iter().find(|entry| entry.name == "deep").unwrap();
        assert_eq!(deep_entry.kind, WorkspaceEntryKind::Directory);
        assert_eq!(
            deep_entry
                .children
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            ["d"]
        );
        let sub_entry = entries.iter().find(|entry| entry.name == "sub").unwrap();
        assert_eq!(sub_entry.kind, WorkspaceEntryKind::Directory);
        assert_eq!(
            sub_entry
                .children
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            ["inner"]
        );
        let mut authority = authority.lock().unwrap();
        fn assert_refusing(authority: &mut PathAuthority, entries: &[WorkspaceEntry]) {
            for entry in entries {
                assert!(
                    authority
                        .resolve(entry.handle.path_ref(), PathOperation::ReadPgn, &[])
                        .is_err(),
                    "{} should refuse after replacement",
                    entry.name
                );
                assert_refusing(authority, &entry.children);
            }
        }
        assert_refusing(authority.as_mut().unwrap(), &entries);
    }

    #[test]
    fn collect_tree_entries_cancels_between_registrations() {
        let (_directory, authority, workspace, root) = workspace_fixture();
        fs::write(root.join("a.pgn"), b"*").unwrap();
        fs::write(root.join("b.pgn"), b"*").unwrap();
        let token = CancellationToken::new();
        let cancel = token.clone();
        let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let calls_for_hook = Arc::clone(&calls);
        set_workspace_listing_pre_register_hook(Some(Box::new(move || {
            if calls_for_hook.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 0 {
                cancel.cancel();
            }
        })));
        let result = collect_tree_entries(&authority, &workspace, &token);
        set_workspace_listing_pre_register_hook(None);
        assert!(matches!(result, Err(Error::Cancellation)));
        let snapshot = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert!(snapshot
            .iter()
            .any(|(name, _, is_dir)| name == "a" && !*is_dir));
        assert!(!snapshot
            .iter()
            .any(|(name, _, is_dir)| name == "b" && !*is_dir));

        let (_directory, authority, workspace, root) = workspace_fixture();
        let sub = root.join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("inner.pgn"), b"*").unwrap();
        fs::write(sub.join("other.pgn"), b"*").unwrap();
        let token = CancellationToken::new();
        let cancel = token.clone();
        let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let calls_for_hook = Arc::clone(&calls);
        set_workspace_listing_pre_register_hook(Some(Box::new(move || {
            if calls_for_hook.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 1 {
                cancel.cancel();
            }
        })));
        let result = collect_tree_entries(&authority, &workspace, &token);
        set_workspace_listing_pre_register_hook(None);
        assert!(matches!(result, Err(Error::Cancellation)));
        let snapshot = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        assert!(snapshot
            .iter()
            .any(|(name, _, is_dir)| name == "inner" && !*is_dir));
        assert!(!snapshot
            .iter()
            .any(|(name, _, is_dir)| name == "other" && !*is_dir));
    }

    #[test]
    fn collect_tree_entries_propagates_a_pass_two_registry_failure() {
        use crate::infra::fs::{
            set_test_atomic_file_injector, AtomicFileFaultPoint, AtomicWriterInjector,
        };

        struct WriteFault;
        impl AtomicWriterInjector for WriteFault {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::Write {
                    Err(std::io::Error::other("second registry commit failed"))
                } else {
                    Ok(())
                }
            }
        }

        struct SecondCommitFault<F> {
            point: AtomicFileFaultPoint,
            calls: std::sync::atomic::AtomicUsize,
            fault: F,
        }
        impl<F: AtomicWriterInjector> AtomicWriterInjector for SecondCommitFault<F> {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point != self.point {
                    return Ok(());
                }
                let call = self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                let second_commit = match self.point {
                    // Registry persistence retries an I/O failure once, so the second
                    // commit occupies calls 1 and 2; call 3 (the third commit) passes.
                    AtomicFileFaultPoint::Write => matches!(call, 1 | 2),
                    _ => call == 1,
                };
                if second_commit {
                    self.fault.inject(point)
                } else {
                    Ok(())
                }
            }
        }

        let (_directory, authority, workspace, root) = workspace_fixture();
        for name in ["a.pgn", "b.pgn", "c.pgn"] {
            fs::write(root.join(name), b"*").unwrap();
        }
        let injector = Arc::new(SecondCommitFault {
            point: AtomicFileFaultPoint::ParentSync,
            calls: std::sync::atomic::AtomicUsize::new(0),
            fault: crate::infra::fs::ParentSyncFault("second registry commit uncertain"),
        });
        set_test_atomic_file_injector(Some(injector));
        let uncertain = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        set_test_atomic_file_injector(None);
        assert!(matches!(
            uncertain,
            Err(Error::CommittedDurabilityUncertain(_))
        ));
        let snapshot = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        for name in ["a", "b"] {
            let path = root.join(format!("{name}.pgn"));
            let metadata = fs::symlink_metadata(path).unwrap();
            let identity = (metadata.dev(), metadata.ino());
            assert!(snapshot.iter().any(|(display, observed, is_dir)| {
                display == name && !*is_dir && *observed == identity
            }));
        }
        assert!(!snapshot.iter().any(|(name, _, _)| name == "c"));

        let (_directory, authority, workspace, root) = workspace_fixture();
        for name in ["a.pgn", "b.pgn", "c.pgn"] {
            fs::write(root.join(name), b"*").unwrap();
        }
        let injector = Arc::new(SecondCommitFault {
            point: AtomicFileFaultPoint::Write,
            calls: std::sync::atomic::AtomicUsize::new(0),
            fault: WriteFault,
        });
        set_test_atomic_file_injector(Some(injector));
        let hard_failure = collect_tree_entries(&authority, &workspace, &CancellationToken::new());
        set_test_atomic_file_injector(None);
        assert!(
            matches!(hard_failure, Err(Error::Io(_))),
            "{hard_failure:?}"
        );
        let snapshot = authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .persistent_snapshot_for_test();
        let metadata = fs::symlink_metadata(root.join("a.pgn")).unwrap();
        let identity = (metadata.dev(), metadata.ino());
        assert!(snapshot.iter().any(|(display, observed, is_dir)| {
            display == "a" && !*is_dir && *observed == identity
        }));
        assert!(!snapshot
            .iter()
            .any(|(name, _, _)| name == "b" || name == "c"));
    }
}
