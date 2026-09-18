//! Capability-based authority for native paths.
//!
//! Physical paths cross the renderer boundary in exactly one place: `sound_resource_path` returns
//! the location of one bundled sound file under the resource directory, for the non-Linux
//! asset-protocol route (`f-20260830-06`). Every other path is a [`PathRef`], an opaque capability
//! identifier, and every operation is checked at resolution time. Persistent entries retain
//! filesystem identity; replacement or disappearance makes them unavailable instead of granting
//! authority to the object that happened to appear at the old location. The exception is an
//! app-owned default root (`db` / `engines` / `puzzles`) recovered with a matching live
//! `VerifiedIdentity`: that path re-registers the new inode rather than staying wedged.

use crate::infra::fs::{
    assert_entry_identity, open_directory_at, open_regular_at, read_directory_entries_at,
    ParentAccess, RegularFileAccess,
};
use crate::{
    error::Error,
    infra::fs::{
        atomic_replace, read_bounded_bytes, AtomicFileOutcome, DirectoryEntry, DirectoryEntryKind,
        VerifiedDir,
    },
};
#[cfg(unix)]
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use specta::Type;
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    ffi::{OsStr, OsString},
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, SystemTime},
};
use tauri::Manager as _;
use tokio::sync::Notify;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[cfg(all(unix, not(any(target_os = "linux", target_os = "macos"))))]
compile_error!("ChessFable supports Linux, macOS and Windows");

mod resolved;
pub use resolved::ResolvedPath;
pub(crate) use resolved::{PgnSnapshot, PgnSnapshotIdentity};
mod verified;
pub(crate) use verified::VerifiedFile;

const SCHEMA_VERSION: u32 = 1;
/// Maximum number of distinct authority identifiers admitted in a normal registry.
/// Retained legacy registries may temporarily exceed it while they are being shrunk.
const MAX_AUTHORITY_IDS: usize = 4_096;
const MAX_TRUSTED_OWNER_FAMILIES: usize = 32;
const MAX_PENDING_ARTIFACTS: usize = 256;
/// The bound on the dialog-grant table for a real application session. It lived as a literal in
/// `open` until the app-data context gained its own constructor; naming it keeps startup from
/// carrying the number at the call site.
const DEFAULT_DIALOG_CAPACITY: usize = 256;
const MAX_REGISTRY_BYTES: usize = 16 * 1024 * 1024;
const MAX_LEGACY_REGISTRY_BYTES: u64 = 64 * 1024 * 1024;
fn map_db3_children_cancellable<T>(
    root: CapabilityDirectory,
    cancellation: &CancellationToken,
    mut map: impl FnMut(OsString, String, (u64, u64)) -> Result<T, Error>,
) -> Result<Vec<T>, Error> {
    let mut children: Vec<(String, DirectoryEntry)> = root
        .entries(cancellation, &mut |name| {
            Path::new(name).extension() == Some(OsStr::new("db3"))
        })?
        .into_iter()
        .filter(|entry| entry.kind == DirectoryEntryKind::RegularFile)
        .map(|entry| (entry.name.to_string_lossy().into_owned(), entry))
        .collect();
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    children.sort_by(|(left, _), (right, _)| left.cmp(right));

    let mut mapped = Vec::with_capacity(children.len());
    for (display_name, entry) in children {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        mapped.push(map(entry.name, display_name, entry.identity)?);
    }
    Ok(mapped)
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use crate::infra::fs::{
        set_test_atomic_file_injector, AtomicFileFaultPoint, AtomicWriterInjector,
    };
    use std::{
        ffi::OsStr,
        ptr::null,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        },
    };
    use windows_sys::{
        Wdk::Storage::FileSystem::FILE_OPEN,
        Win32::{
            Foundation::{GENERIC_READ, GENERIC_WRITE},
            Storage::FileSystem::SYNCHRONIZE,
        },
    };

    #[test]
    fn windows_child_open_maps_absence_and_refuses_wrong_target_types() {
        let dir = tempfile::tempdir().unwrap();
        let parent = open_windows_nofollow(dir.path(), false).unwrap();
        let read_access = SYNCHRONIZE | GENERIC_READ;
        let absent = open_windows_child(
            &parent,
            OsStr::new("missing"),
            FILE_OPEN,
            read_access,
            null(),
            false,
            true,
        )
        .expect_err("an absent child must fail");
        assert!(matches!(
            absent,
            Error::Io(error) if error.kind() == std::io::ErrorKind::NotFound
        ));

        fs::create_dir(dir.path().join("directory")).unwrap();
        fs::write(dir.path().join("file"), b"file").unwrap();
        assert!(open_windows_child(
            &parent,
            OsStr::new("directory"),
            FILE_OPEN,
            read_access,
            null(),
            false,
            true,
        )
        .is_err());
        assert!(open_windows_child(
            &parent,
            OsStr::new("file"),
            FILE_OPEN,
            read_access | GENERIC_WRITE,
            null(),
            true,
            true,
        )
        .is_err());
    }

    #[test]
    fn windows_missing_non_final_component_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let parent = open_windows_nofollow(dir.path(), false).unwrap();
        let expected = windows_file_identity(&parent).unwrap();
        let components = vec![OsString::from("missing"), OsString::from("target")];
        let result = resolved::resolve_windows(
            dir.path(),
            &expected,
            true,
            &components,
            PathOperation::DownloadFile,
        );
        assert!(matches!(
            result,
            Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound
        ));
    }

    #[test]
    fn registry_save_entries_persists_on_windows() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let file = dir.path().join("book.bin");
        fs::write(&file, b"book").unwrap();
        let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
        authority
            .migrate_legacy_os_path(
                file.into_os_string(),
                "book",
                PathClass::PersistentFile,
                vec![PathOperation::OpeningBookRead],
            )
            .unwrap();

        let reloaded = PathAuthority::open(registry, vec![]).unwrap();
        assert_eq!(reloaded.persistent.len(), 1);
    }

    #[test]
    fn registry_parent_sync_failure_reports_uncertain_without_retry() {
        struct ParentSyncFailure(Arc<AtomicUsize>);

        impl AtomicWriterInjector for ParentSyncFailure {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::ParentSync {
                    self.0.fetch_add(1, Ordering::SeqCst);
                    Err(std::io::Error::other("injected parent sync failure"))
                } else {
                    Ok(())
                }
            }
        }

        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let authority = PathAuthority::open(registry, vec![]).unwrap();
        let attempts = Arc::new(AtomicUsize::new(0));
        set_test_atomic_file_injector(Some(Arc::new(ParentSyncFailure(Arc::clone(&attempts)))));
        let durability = authority
            .save_entries(&authority.persistent, &None, &None, &None, &[])
            .unwrap();
        set_test_atomic_file_injector(None);

        assert_eq!(
            durability,
            CommitDurability::DurabilityUncertain(
                crate::error::DurabilityStage::RegistryReplacement
            )
        );
        assert_eq!(attempts.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn registry_uncertain_candidate_state_adoption() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let file = dir.path().join("book.bin");
        fs::write(&file, b"book").unwrap();
        let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
        let dialog = authority
            .grant_dialog(
                &file,
                "book",
                PathClass::SingleDialogGrant,
                PathOperation::OpeningBookRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name: "book".into(),
            class: PathClass::PersistentFile,
            purpose: None,
            operations: vec![PathOperation::OpeningBookRead],
            path: NativePath::from_path(&file),
            identity: identity(&file).unwrap(),
            target_is_dir: false,
        };
        let mut candidate = authority.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "injected parent sync failure",
        ))));
        let durability = authority
            .commit_candidate(candidate, Some(&dialog))
            .unwrap();
        set_test_atomic_file_injector(None);

        assert_eq!(
            durability,
            CommitDurability::DurabilityUncertain(
                crate::error::DurabilityStage::RegistryReplacement
            )
        );
        assert!(authority.registry_durability_pending);
        assert!(authority.persistent.contains_key(&id.id));
        assert!(!authority.dialogs.contains_key(&dialog.id));
        assert!(authority
            .resolve(&dialog, PathOperation::OpeningBookRead, &[])
            .is_err());
        let reloaded = PathAuthority::open(registry, vec![]).unwrap();
        assert!(reloaded.persistent.contains_key(&id.id));
    }

    #[test]
    fn windows_reparse_ancestor_stable_entry_rebinds_and_changed_entry_quarantines() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let junction = dir.path().join("junction");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("stable.pgn"), b"stable").unwrap();
        fs::write(real.join("changed.pgn"), b"old").unwrap();
        let status = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(&junction)
            .arg(&real)
            .status()
            .unwrap();
        assert!(status.success(), "mklink /J failed with {status}");
        let changed = StoredEntry {
            id: PathRef {
                id: "windows-changed".into(),
            },
            display_name: "changed".into(),
            class: PathClass::PersistentFile,
            purpose: Some(EntryPurpose::PgnFile),
            operations: canonical_operations(EntryPurpose::PgnFile),
            path: NativePath::from_path(&junction.join("changed.pgn")),
            identity: identity(&junction.join("changed.pgn")).unwrap(),
            target_is_dir: false,
        };
        let stable = StoredEntry {
            id: PathRef {
                id: "windows-stable".into(),
            },
            display_name: "stable".into(),
            class: PathClass::PersistentFile,
            purpose: Some(EntryPurpose::PgnFile),
            operations: canonical_operations(EntryPurpose::PgnFile),
            path: NativePath::from_path(&junction.join("stable.pgn")),
            identity: identity(&junction.join("stable.pgn")).unwrap(),
            target_is_dir: false,
        };
        fs::write(real.join("replacement.pgn"), b"new").unwrap();
        fs::remove_file(real.join("changed.pgn")).unwrap();
        fs::rename(real.join("replacement.pgn"), real.join("changed.pgn")).unwrap();
        let registry = dir.path().join("registry.json");
        let registry_value = Registry {
            schema_version: SCHEMA_VERSION,
            entries: vec![changed, stable],
            active_database_root: None,
            active_puzzle_root: None,
            active_engine_root: None,
            pending_artifacts: vec![],
            provisional_attachments: BTreeSet::new(),
            image_cleanup: vec![],
        };
        fs::write(&registry, serde_json::to_vec(&registry_value).unwrap()).unwrap();
        let capture = crate::error::LogCaptureScope::start();
        let mut authority = PathAuthority::open(registry, vec![]).unwrap();
        assert_eq!(
            authority.persistent["windows-stable"]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("stable.pgn")
        );
        assert_eq!(
            authority.persistent["windows-stable"].availability,
            PathAvailability::Available
        );
        let mut file = authority
            .resolve(
                &PathRef {
                    id: "windows-stable".into(),
                },
                PathOperation::ReadPgn,
                &[],
            )
            .unwrap()
            .into_read_file()
            .unwrap();
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes, b"stable");
        assert_eq!(
            authority.persistent["windows-changed"].availability,
            PathAvailability::Unavailable
        );
        let warnings: Vec<_> = capture
            .records()
            .into_iter()
            .filter(|record| record.level == log::Level::Warn)
            .filter(|record| record.message.contains("windows-changed"))
            .collect();
        assert_eq!(warnings.len(), 1, "{warnings:?}");
        assert!(warnings[0].message.contains("identity changed"));
    }
}

/// A directory reached through a `PathRef` capability. It carries no pathname.
pub(crate) struct CapabilityDirectory {
    directory: fs::File,
}

impl CapabilityDirectory {
    /// One descriptor-relative read of this directory, on both platforms.
    ///
    /// Every method on this type is live on Windows since `f-20260914-08`: the walk that drives
    /// them, `file_workspace.rs::collect_tree_entries`, is no longer `#[cfg(unix)]` and neither
    /// are the helpers it calls. `map_db3_children_cancellable` is the other caller.
    /// `capability_directory` itself is still refused off unix for every operation except
    /// `PathOperation::ReadPgn` (obligation B3b), so the database and puzzle listings reach this
    /// code only on unix for now — that gate is `f-20260914-09`, not a property of this type.
    pub(crate) fn entries(
        &self,
        cancellation: &CancellationToken,
        keep: &mut dyn FnMut(&OsStr) -> bool,
    ) -> Result<Vec<DirectoryEntry>, Error> {
        let entries = read_directory_entries_at(&self.directory, cancellation, keep)?;
        #[cfg(all(test, unix))]
        CAPABILITY_DIRECTORY_POST_ENTRIES_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        Ok(entries)
    }

    /// Remaps the errors a concurrent swap of the child produces into the one retryable
    /// `Conflict` the workspace listing reports, so a directory replaced between enumeration and
    /// open is a retry rather than a hard failure. Unix sees `LOOP`/`NOTDIR`/`NOENT`; Windows sees
    /// the NT counterparts, plus `open_windows_child`'s reparse refusal, because an entry that was
    /// a directory at enumeration time and is a junction when it is opened is the same swap.
    fn child_open_swap(error: Error) -> Error {
        #[cfg(unix)]
        {
            if let Error::Io(io_error) = &error {
                if matches!(
                    io_error.raw_os_error(),
                    Some(code)
                        if code == rustix::io::Errno::LOOP.raw_os_error()
                            || code == rustix::io::Errno::NOTDIR.raw_os_error()
                            || code == rustix::io::Errno::NOENT.raw_os_error()
                ) {
                    return Error::Conflict("workspace directory changed concurrently".into());
                }
            }
            error
        }
        #[cfg(windows)]
        {
            use windows_sys::Win32::Foundation::{
                ERROR_DIRECTORY, ERROR_FILE_NOT_FOUND, ERROR_PATH_NOT_FOUND,
            };

            if matches!(&error, Error::InvalidInput(message) if message == "reparse points cannot be authorized")
            {
                return Error::Conflict("workspace directory changed concurrently".into());
            }
            if let Error::Io(io_error) = &error {
                if matches!(
                    io_error.raw_os_error(),
                    Some(code)
                        if code == ERROR_FILE_NOT_FOUND as i32
                            || code == ERROR_PATH_NOT_FOUND as i32
                            || code == ERROR_DIRECTORY as i32
                ) {
                    return Error::Conflict("workspace directory changed concurrently".into());
                }
            }
            error
        }
    }

    pub(crate) fn open_child_directory(
        &self,
        entry: &DirectoryEntry,
    ) -> Result<CapabilityDirectory, Error> {
        if entry.kind != DirectoryEntryKind::Directory {
            return Err(Error::InvalidInput(
                "directory entry is not a directory".into(),
            ));
        }
        crate::infra::fs::single_leaf(&entry.name)?;
        #[cfg(all(test, unix))]
        CAPABILITY_CHILD_PRE_OPEN_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        let opened = open_directory_at(&self.directory, &entry.name, false)
            .map_err(Self::child_open_swap)?;
        Ok(CapabilityDirectory {
            directory: VerifiedDir::new(opened, entry.identity)?.into_file(),
        })
    }

    pub(crate) fn confirm_entry(&self, entry: &DirectoryEntry) -> Result<(), Error> {
        crate::infra::fs::single_leaf(&entry.name)?;
        assert_entry_identity(
            &self.directory,
            &entry.name,
            entry.identity,
            entry.kind == DirectoryEntryKind::Directory,
        )
    }

    pub(crate) fn open_metadata_sidecar(
        &self,
        pgn: &DirectoryEntry,
    ) -> Result<Option<fs::File>, Error> {
        crate::infra::fs::single_leaf(&pgn.name)?;
        let sidecar = workspace_sidecar_leaf(&pgn.name)?;
        #[cfg(all(test, unix))]
        WORKSPACE_METADATA_PRE_OPEN_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        let opened = match open_regular_at(&self.directory, &sidecar, RegularFileAccess::ReadOnly) {
            Ok(file) => {
                #[cfg(all(test, unix))]
                WORKSPACE_METADATA_POST_OPEN_HOOK.with(|slot| {
                    if let Some(hook) = slot.borrow_mut().take() {
                        hook(&file);
                    }
                });
                Some(file)
            }
            Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(error),
        };
        self.confirm_entry(pgn)?;
        Ok(opened)
    }
}

fn engine_file_operations() -> Vec<PathOperation> {
    vec![
        PathOperation::EngineExecute,
        PathOperation::EngineConfigure,
        PathOperation::EngineInstall,
        PathOperation::EngineBinaryInspect,
    ]
}

/// Opaque renderer-safe identifier. It deliberately has no path parsing API.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct PathRef {
    pub id: String,
}
impl PathRef {
    fn fresh() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
        }
    }
}

/// Renderer-safe handle for one authority-managed file workspace. It cannot contain a native
/// path, and PGN commands accept this type rather than a generic capability id.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct FileWorkspaceHandle {
    pub id: PathRef,
    pub kind: FileWorkspaceHandleKind,
}

/// Backend-only sealed workspace entry. The native path is retained only for registry rebinding;
/// all namespace mutations use `parent`/`directory` file descriptors and the single leaf name.
pub(crate) struct WorkspaceMutationTarget {
    pub(crate) parent: fs::File,
    pub(crate) directory: Option<fs::File>,
    pub(crate) leaf: OsString,
    pub(crate) identity: (u64, u64),
    pub(crate) is_dir: bool,
    path: PathBuf,
}
/// The failure classes shared by database probes, search-index loading and sidecar cleanup.
/// Callers map the classes differently because absence, a wrong object kind and a malformed
/// archive have different meanings at each boundary.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ProbeErrorClass {
    NotFound,
    Reparse,
    WrongKind,
    Malformed,
    MappedFile,
    Other,
}

fn unix_probe_error_class(code: Option<i32>) -> Option<ProbeErrorClass> {
    #[cfg(unix)]
    {
        matches!(
            code,
            Some(code)
                if code == rustix::io::Errno::LOOP.raw_os_error()
                    || code == rustix::io::Errno::NOTDIR.raw_os_error()
        )
        .then(|| {
            if code == Some(rustix::io::Errno::LOOP.raw_os_error()) {
                ProbeErrorClass::Reparse
            } else {
                ProbeErrorClass::WrongKind
            }
        })
    }
    #[cfg(not(unix))]
    {
        let _ = code;
        None
    }
}

/// Maps platform error values without importing a platform-specific error table. The Windows
/// values are stable DOS error codes, and using their numeric values lets Linux execute the same
/// classifier in its tests.
pub(crate) fn classify_probe_error_kind(error: &Error) -> ProbeErrorClass {
    match error {
        Error::Io(error) => {
            if error.kind() == std::io::ErrorKind::NotFound
                || matches!(error.raw_os_error(), Some(2 | 3))
            {
                ProbeErrorClass::NotFound
            } else if let Some(class) = unix_probe_error_class(error.raw_os_error()) {
                class
            } else if matches!(error.raw_os_error(), Some(1920 | 4393)) {
                ProbeErrorClass::Reparse
            } else if error.raw_os_error() == Some(267) {
                ProbeErrorClass::WrongKind
            } else if error.raw_os_error() == Some(1224) {
                ProbeErrorClass::MappedFile
            } else if error.kind() == std::io::ErrorKind::InvalidData {
                ProbeErrorClass::Malformed
            } else {
                ProbeErrorClass::Other
            }
        }
        Error::InvalidInput(message)
            if matches!(
                message.as_str(),
                "workspace sidecar must be a regular file"
                    | "workspace entry has an unexpected file type"
            ) =>
        {
            ProbeErrorClass::WrongKind
        }
        Error::InvalidInput(message) if message == "reparse points cannot be authorized" => {
            ProbeErrorClass::Reparse
        }
        Error::InvalidInput(message) if message == "target must be a regular file" => {
            ProbeErrorClass::WrongKind
        }
        _ => ProbeErrorClass::Other,
    }
}

/// Resolves Windows' ambiguous directory-open error without turning permission failures into
/// "missing". A directory probe succeeds only for a directory at the same parent/name; if it
/// fails, the original error remains `Other` and the caller propagates it.
pub(crate) fn classify_probe_error(
    error: &Error,
    parent: &fs::File,
    leaf: &OsStr,
) -> ProbeErrorClass {
    if matches!(
        error,
        Error::Io(error) if error.raw_os_error() == Some(5)
    ) && crate::infra::fs::entry_identity_at(parent, leaf, true).is_ok()
    {
        return ProbeErrorClass::WrongKind;
    }
    classify_probe_error_kind(error)
}

/// Retained no-follow parent descriptor for a database file. Callers must not
/// reopen `leaf` by pathname for create, unlink, or mmap; use this parent with
/// `openat` / `unlinkat` / `atomic_replace_at`.
pub(crate) struct DatabaseFileTarget {
    parent: fs::File,
    leaf: OsString,
    identity: (u64, u64),
    path: PathBuf,
}

impl DatabaseFileTarget {
    fn assemble(parent: fs::File, leaf: OsString, identity: (u64, u64), path: PathBuf) -> Self {
        Self {
            parent,
            leaf,
            identity,
            path,
        }
    }

    pub(crate) fn parent(&self) -> &fs::File {
        &self.parent
    }

    pub(crate) fn leaf(&self) -> &OsStr {
        &self.leaf
    }

    pub(crate) fn identity(&self) -> (u64, u64) {
        self.identity
    }

    /// Returns the canonical pathname the identity was validated against. SQLite's pathname-only
    /// open, in-memory keys, and logging consume this value; create, unlink, and mmap use the
    /// retained parent descriptor and leaf instead of reopening the pathname.
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }

    /// Opens the exact regular file authorized by this carrier after rechecking its retained
    /// parent and inode. The pathname walk is deliberately kept beside the carrier so repository
    /// callers cannot substitute a pathname while probing a pooled SQLite connection.
    pub(crate) fn open_current(&self) -> Result<fs::File, Error> {
        const CONFLICT: &str = "database changed after capability resolution";

        fn map_probe_error(class: ProbeErrorClass, error: Error) -> Error {
            if matches!(error, Error::Conflict(_)) {
                return Error::Conflict(CONFLICT.into());
            }
            match class {
                ProbeErrorClass::NotFound
                | ProbeErrorClass::Reparse
                | ProbeErrorClass::WrongKind => Error::Conflict(CONFLICT.into()),
                ProbeErrorClass::Malformed
                | ProbeErrorClass::MappedFile
                | ProbeErrorClass::Other => error,
            }
        }

        let (parent_now, leaf) = crate::infra::fs::open_verified_parent(
            &self.path,
            self.identity,
            false,
            ParentAccess::Readable,
        )
        .map_err(|error| map_probe_error(classify_probe_error_kind(&error), error))?;
        if opened_file_identity(&parent_now)? != opened_file_identity(&self.parent)? {
            return Err(Error::Conflict(CONFLICT.into()));
        }
        let file =
            crate::infra::fs::open_regular_at(&parent_now, &leaf, RegularFileAccess::ReadOnly)
                .map_err(|error| {
                    map_probe_error(classify_probe_error(&error, &parent_now, &leaf), error)
                })?;
        if opened_file_identity(&file)? != self.identity {
            return Err(Error::Conflict(CONFLICT.into()));
        }
        Ok(file)
    }

    #[cfg(all(test, unix))]
    pub(crate) fn for_test_path(path: &Path) -> Result<Self, Error> {
        path.file_name()
            .filter(|name| !name.is_empty())
            .ok_or_else(|| Error::InvalidInput("database path needs a leaf name".into()))?;
        let _file = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(path)?;
        let acquired = acquire_target(
            path,
            AcquireShape::File {
                parent_access: ParentAccess::Readable,
            },
        )?;
        let (parent, leaf) = acquired
            .parent_and_leaf
            .ok_or_else(|| Error::InvalidInput("database path needs a leaf name".into()))?;
        Ok(Self::assemble(
            parent,
            leaf,
            (acquired.identity.a, acquired.identity.b),
            acquired.path,
        ))
    }
}

mod verified_identity {
    use crate::{error::Error, infra::fs::AtomicFileOutcome};
    use std::{ffi::OsStr, fs};

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub(crate) struct VerifiedIdentity((u64, u64));

    impl VerifiedIdentity {
        pub(super) fn pair(self) -> (u64, u64) {
            self.0
        }

        pub(super) fn agrees_with(self, validated: &super::Identity) -> bool {
            self.pair() == (validated.a, validated.b)
        }
    }

    impl super::AuthorizedDir {
        pub(crate) fn identity(&self) -> VerifiedIdentity {
            VerifiedIdentity(self.identity)
        }

        pub(crate) fn atomic_replace_leaf_identified<F>(
            &self,
            leaf: &OsStr,
            write_fn: F,
        ) -> Result<(AtomicFileOutcome, VerifiedIdentity), Error>
        where
            F: FnOnce(&mut fs::File) -> Result<(), Error>,
        {
            let installed = crate::infra::fs::atomic_replace_at_identified(
                self.directory.as_file(),
                leaf,
                write_fn,
            )?;
            Ok((installed.outcome, VerifiedIdentity(installed.identity)))
        }

        pub(crate) fn open_leaf_identified(&self, leaf: &OsStr) -> Result<VerifiedIdentity, Error> {
            crate::infra::fs::single_leaf(leaf).map_err(|_| {
                Error::InvalidInput("managed image leaf must be one component".into())
            })?;
            let file = self
                .open_regular_relative(std::path::Path::new(leaf))
                .map_err(|error| match error {
                    Error::InvalidInput(_) => {
                        Error::Conflict("managed image leaf changed before cleanup".into())
                    }
                    Error::Io(error)
                        if error.raw_os_error() == Some(rustix::io::Errno::LOOP.raw_os_error()) =>
                    {
                        Error::Conflict("managed image leaf changed before cleanup".into())
                    }
                    error => error,
                })?;
            super::opened_file_identity(&file).map(VerifiedIdentity)
        }
    }

    impl super::ResolvedPath {
        pub(crate) fn identity(&self) -> Result<VerifiedIdentity, Error> {
            if let Some(file) = self.file() {
                return super::opened_file_identity(file).map(VerifiedIdentity);
            }
            if let Some(directory) = self.directory() {
                return super::opened_file_identity(directory).map(VerifiedIdentity);
            }
            Err(Error::Conflict(
                "resolved capability has no retained descriptor".into(),
            ))
        }
    }

    pub(super) fn database_child_identity(
        resolved: VerifiedIdentity,
        validated: &super::Identity,
    ) -> Result<VerifiedIdentity, Error> {
        let pair = (validated.a, validated.b);
        if !resolved.agrees_with(validated) {
            return Err(Error::Conflict(
                super::VERIFIED_REGISTRATION_CONFLICT.into(),
            ));
        }
        Ok(VerifiedIdentity(pair))
    }

    impl super::ResolvedPath {
        pub(super) fn create_database_file(&self) -> Result<(fs::File, VerifiedIdentity), Error> {
            if self.operation() != super::PathOperation::DatabaseCreate {
                return Err(Error::InvalidInput(
                    "resolved capability is not a database creation target".into(),
                ));
            }
            let parent = self.parent().ok_or_else(|| {
                Error::InvalidInput("database child has no retained parent".into())
            })?;
            let leaf = self
                .leaf()
                .ok_or_else(|| Error::InvalidInput("database child has no retained leaf".into()))?;
            let (file, observed) = crate::infra::fs::create_regular_at(parent, leaf)?;
            let actual = super::opened_file_identity(&file)?;
            if actual != observed {
                return Err(Error::Conflict(
                    super::VERIFIED_REGISTRATION_CONFLICT.into(),
                ));
            }
            Ok((file, VerifiedIdentity(actual)))
        }
    }
}

pub(crate) use verified_identity::VerifiedIdentity;

const VERIFIED_REGISTRATION_CONFLICT: &str = "verified identity does not match registration target";

fn refuse_unobserved(
    resolved_identity: VerifiedIdentity,
    observed: (u64, u64),
) -> Result<VerifiedIdentity, Error> {
    if resolved_identity.pair() != observed {
        return Err(Error::Conflict(VERIFIED_REGISTRATION_CONFLICT.into()));
    }
    Ok(resolved_identity)
}

#[cfg(all(test, unix))]
type WorkspaceMetadataPostOpenHook = Box<dyn FnOnce(&fs::File)>;
#[cfg(test)]
type RefreshEntryHook = Box<dyn Fn(&str)>;

#[cfg(all(test, unix))]
std::thread_local! {
    static CAPABILITY_DIRECTORY_POST_ENTRIES_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static CAPABILITY_CHILD_PRE_OPEN_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static WORKSPACE_METADATA_POST_OPEN_HOOK: std::cell::RefCell<Option<WorkspaceMetadataPostOpenHook>> =
        const { std::cell::RefCell::new(None) };
    static WORKSPACE_METADATA_PRE_OPEN_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
std::thread_local! {
    static DATABASE_CHILD_POST_RESOLVE_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static ACQUIRE_TARGET_BEFORE_PROOF_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static PGN_EXPORT_POST_CREATE_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static ACQUIRE_TARGET_CALLS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
    static PUZZLE_CHILD_POST_RESOLVE_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static DATABASE_CHILD_POST_CREATE_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static INSTALLED_ENGINE_POST_RESOLVE_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static RESOLVE_PRE_REGULAR_OPEN_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static RESOLVE_PRE_DIRECTORY_OPEN_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
    static REFRESH_ENTRY_HOOK: std::cell::RefCell<Option<RefreshEntryHook>> =
        const { std::cell::RefCell::new(None) };
}

fn reject_disagreeing_expected_identity(
    validated: &Identity,
    expected: Option<VerifiedIdentity>,
) -> Result<(), Error> {
    if expected.is_some_and(|expected| !expected.agrees_with(validated)) {
        return Err(Error::Conflict(VERIFIED_REGISTRATION_CONFLICT.into()));
    }
    Ok(())
}

#[cfg(all(test, unix))]
pub(crate) fn set_workspace_metadata_post_open_hook(hook: Option<WorkspaceMetadataPostOpenHook>) {
    WORKSPACE_METADATA_POST_OPEN_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[cfg(all(test, unix))]
pub(crate) fn set_capability_directory_post_entries_hook(hook: Option<Box<dyn FnOnce()>>) {
    CAPABILITY_DIRECTORY_POST_ENTRIES_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[cfg(all(test, unix))]
pub(crate) fn set_capability_child_pre_open_hook(hook: Option<Box<dyn FnOnce()>>) {
    CAPABILITY_CHILD_PRE_OPEN_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[cfg(all(test, unix))]
pub(crate) fn set_workspace_metadata_pre_open_hook(hook: Option<Box<dyn FnOnce()>>) {
    WORKSPACE_METADATA_PRE_OPEN_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[derive(Debug)]
pub(crate) struct AuthorizedDir {
    directory: VerifiedDir,
    identity: (u64, u64),
    path: PathBuf,
}

impl AuthorizedDir {
    /// Returns the native directory retained for registry rebinding and display only. Filesystem
    /// changes must use the retained descriptor and must never reopen this pathname.
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn try_clone(&self) -> Result<fs::File, Error> {
        self.directory.as_file().try_clone().map_err(Error::from)
    }

    pub(crate) fn remove_leaf_identified(
        &self,
        leaf: &OsStr,
        identity: VerifiedIdentity,
    ) -> Result<(), Error> {
        #[cfg(unix)]
        {
            crate::infra::fs::single_leaf(leaf)?;
            crate::infra::fs::remove_entry_at(
                self.directory.as_file(),
                leaf,
                identity.pair(),
                false,
            )
        }
        #[cfg(not(unix))]
        {
            let _ = (leaf, identity);
            Err(crate::infra::platform_support::unsupported(
                "fd-relative removal",
            ))
        }
    }

    pub(crate) fn open_regular_relative(&self, relative: &Path) -> Result<fs::File, Error> {
        #[cfg(unix)]
        {
            use std::os::unix::ffi::{OsStrExt, OsStringExt};
            let components: Vec<OsString> = relative
                .as_os_str()
                .as_bytes()
                .split(|byte| *byte == b'/')
                .map(|component| OsString::from_vec(component.to_vec()))
                .collect();
            validate_components(&components)?;
            let (leaf, directories) = components
                .split_last()
                .ok_or_else(|| Error::InvalidInput("invalid relative path component".into()))?;
            let mut parent = self.directory.as_file().try_clone()?;
            for directory in directories {
                parent = crate::infra::fs::open_directory_at(&parent, directory, false)?;
            }
            crate::infra::fs::open_regular_at(&parent, leaf, RegularFileAccess::ReadOnly)
        }
        #[cfg(not(unix))]
        {
            let _ = relative;
            Err(crate::infra::platform_support::unsupported(
                "fd-relative regular-file opening",
            ))
        }
    }
}

struct RetainedWorkspaceTarget {
    parent: fs::File,
    leaf: OsString,
    identity: (u64, u64),
    target_is_dir: bool,
    path: PathBuf,
}
impl WorkspaceMutationTarget {
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }
    pub(crate) fn directory(&self) -> Result<&fs::File, Error> {
        self.directory
            .as_ref()
            .ok_or_else(|| Error::InvalidInput("workspace entry must be a directory".into()))
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FileWorkspaceHandleKind {
    FileWorkspace,
}
impl FileWorkspaceHandle {
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: FileWorkspaceHandleKind::FileWorkspace,
        }
    }
}

/// Opaque handle for a database root.  A root is the only capability that may
/// create or discover database children; the renderer never supplies a path or
/// a relative component.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct DatabaseRootHandle {
    pub id: PathRef,
    pub kind: DatabaseRootHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DatabaseRootHandleKind {
    DatabaseRoot,
}

/// Opaque handle for the active puzzle-database directory. It is deliberately
/// distinct from the game-database root so puzzle commands cannot be routed to
/// a general database workspace by mistake.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct PuzzleRootHandle {
    pub id: PathRef,
    pub kind: PuzzleRootHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PuzzleRootHandleKind {
    PuzzleRoot,
}
impl PuzzleRootHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: PuzzleRootHandleKind::PuzzleRoot,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PuzzleRootDescriptor {
    pub root: PuzzleRootHandle,
    pub display_name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PuzzleDatabaseDescriptor {
    pub file: PathRef,
    pub filename: String,
}
impl DatabaseRootHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: DatabaseRootHandleKind::DatabaseRoot,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Opaque handle for one exact database file.  It is deliberately a distinct
/// type from a generic path capability so a database command cannot accidentally
/// be called with a PGN, puzzle, or download destination capability.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct DatabaseHandle {
    pub id: PathRef,
    pub kind: DatabaseHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DatabaseHandleKind {
    Database,
}
impl DatabaseHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: DatabaseHandleKind::Database,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Opaque authority-managed engine installation root.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct EngineRootHandle {
    pub id: PathRef,
    pub kind: EngineRootHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineRootHandleKind {
    EngineRoot,
}
impl EngineRootHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: EngineRootHandleKind::EngineRoot,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Opaque exact executable capability. It is distinct from its installation root.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct EngineHandle {
    pub id: PathRef,
    pub kind: EngineHandleKind,
}

/// Opaque, persistent native resource used as a UCI option value.  It is
/// intentionally distinct from executables and workspaces: a resource picker
/// can grant only a file or directory to an engine option, never authority to
/// execute it or inspect siblings.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EngineResourceHandle {
    pub id: PathRef,
    pub kind: EngineResourceHandleKind,
    pub display_name: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineResourceHandleKind {
    File,
    Directory,
}
impl EngineResourceHandle {
    pub(crate) fn new(id: PathRef, kind: EngineResourceHandleKind, display_name: String) -> Self {
        Self {
            id,
            kind,
            display_name,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Backend-only lease for a resource passed to an engine. Unix retains the
/// opened descriptor for the complete process lifetime; Windows retains the
/// opened no-delete handle alongside its path. In both cases, replacement
/// cannot redirect an engine's lazy access after UCI configuration.
#[derive(Debug)]
pub(crate) struct EngineResourceLease {
    #[cfg(unix)]
    file: fs::File,
    #[cfg(target_os = "macos")]
    target: std::sync::OnceLock<PathBuf>,
    #[cfg(target_os = "macos")]
    pinned_target: std::sync::OnceLock<PathBuf>,
    #[cfg(target_os = "macos")]
    is_directory: bool,
    #[cfg(windows)]
    /// Holds the no-delete handle until the lease is dropped.
    _file: fs::File,
    #[cfg(windows)]
    target: PathBuf,
}

#[cfg(target_os = "macos")]
fn descriptor_path(file: &fs::File) -> Result<PathBuf, Error> {
    use std::os::unix::ffi::OsStrExt;

    rustix::fs::getpath(file)
        .map(|path| PathBuf::from(OsStr::from_bytes(path.as_bytes())))
        .map_err(|error| Error::Io(Box::new(std::io::Error::from(error))))
}

impl EngineResourceLease {
    #[cfg(unix)]
    fn from_file(
        file: fs::File,
        is_directory: bool,
        target_override: Option<PathBuf>,
    ) -> Result<Self, Error> {
        #[cfg(target_os = "macos")]
        let target = match target_override {
            Some(target) => target,
            None => descriptor_path(&file)?,
        };
        #[cfg(not(target_os = "macos"))]
        let _ = is_directory;
        #[cfg(not(target_os = "macos"))]
        let _ = target_override;
        Ok(Self {
            file,
            #[cfg(target_os = "macos")]
            target: std::sync::OnceLock::from(target),
            #[cfg(target_os = "macos")]
            pinned_target: std::sync::OnceLock::new(),
            #[cfg(target_os = "macos")]
            is_directory,
        })
    }

    #[cfg(target_os = "linux")]
    pub(crate) fn uci_value(&self) -> Result<String, Error> {
        use std::os::fd::AsRawFd;
        Ok(format!("/proc/self/fd/{}", self.file.as_raw_fd()))
    }
    #[cfg(target_os = "macos")]
    pub(crate) fn uci_value(&self) -> Result<String, Error> {
        let target = if self.is_directory {
            self.target
                .get()
                .ok_or_else(|| Error::Conflict("engine resource target is unavailable".into()))?
        } else {
            self.pinned_target.get().ok_or_else(|| {
                Error::Conflict(
                    "engine file resource was not pinned before value construction".into(),
                )
            })?
        };
        Ok(target.to_string_lossy().into_owned())
    }
    #[cfg(windows)]
    pub(crate) fn uci_value(&self) -> Result<String, Error> {
        Ok(self.target.to_string_lossy().into_owned())
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn file(&self) -> &fs::File {
        &self.file
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn verify_current(&self) -> Result<(), Error> {
        if !self.is_directory {
            return Ok(());
        }
        let path = self
            .target
            .get()
            .ok_or_else(|| Error::Conflict("engine resource target is unavailable".into()))?;
        if crate::infra::fs::held_matches_path(&self.file, path)? {
            Ok(())
        } else {
            Err(Error::Conflict(
                "engine resource changed after authorization".into(),
            ))
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub(crate) fn verify_current(&self) -> Result<(), Error> {
        Ok(())
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn set_pinned_target(&self, target: PathBuf) -> Result<(), Error> {
        self.pinned_target
            .set(target)
            .map_err(|_| Error::Conflict("engine file resource was pinned more than once".into()))
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn is_directory(&self) -> bool {
        self.is_directory
    }
}
#[cfg(all(test, unix))]
impl EngineResourceLease {
    #[cfg(target_os = "macos")]
    pub(crate) fn pin_test_target_to_original(&self) -> Result<(), Error> {
        let target = self
            .target
            .get()
            .cloned()
            .ok_or_else(|| Error::Conflict("engine resource target is unavailable".into()))?;
        self.set_pinned_target(target)
    }

    pub(crate) fn test_file(file: fs::File) -> Self {
        #[cfg(target_os = "macos")]
        let fallback_target = Some(descriptor_path(&file).unwrap_or_else(|_| PathBuf::new()));
        #[cfg(not(target_os = "macos"))]
        let fallback_target = None;
        Self::from_file(file, false, fallback_target)
            .expect("test file lease must be constructible")
    }

    #[cfg(all(test, target_os = "macos"))]
    pub(crate) fn test_directory(file: fs::File) -> Self {
        let fallback_target = Some(descriptor_path(&file).unwrap_or_default());
        Self::from_file(file, true, fallback_target)
            .expect("test directory lease must be constructible")
    }
}
#[cfg(all(test, unix))]
impl EngineExecutable {
    pub(crate) fn test_fixture(
        file: fs::File,
        working_directory: PathBuf,
        resource_leases: Vec<EngineResourceLease>,
    ) -> Self {
        #[cfg(target_os = "macos")]
        let command_path =
            descriptor_path(&file).unwrap_or_else(|_| working_directory.join("engine"));
        Self {
            file,
            working_directory,
            resource_leases: resource_leases.into_iter().map(Arc::new).collect(),
            #[cfg(target_os = "macos")]
            command_path,
            #[cfg(target_os = "macos")]
            launch_root: None,
            #[cfg(target_os = "macos")]
            materialized_files: Vec::new(),
        }
    }
}

/// Opaque app-owned engine-image asset. Native code alone knows the copied
/// image path; the renderer can safely persist only this handle.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct EngineImageHandle {
    pub id: PathRef,
    pub kind: EngineImageHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineImageHandleKind {
    EngineImage,
}
impl EngineImageHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: EngineImageHandleKind::EngineImage,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ActivationObserverStage {
    BeforeRead,
    PostVerification,
    CommitBeforeRetainedDescriptorValidation,
}

#[cfg(test)]
pub(crate) trait ActivationObserver: Send + Sync {
    fn observe(&self, stage: ActivationObserverStage);
}

/// Prepared artifact activation evidence produced by [`PathAuthority::prepare_download_artifact`].
/// Retains the exact no-follow descriptor, pending intent, and root identity evidence.
/// Fields and constructors are private to this module so callers outside cannot manufacture
/// verified activation evidence.
struct PreparedArtifactActivation {
    descriptor: VerifiedFile,
    pending: PendingArtifact,
    root_id: PathRef,
    root_path: PathBuf,
    root_identity: Identity,
    prepared_identity: Identity,
    prepared_change_stamp: i128,
    #[cfg(test)]
    observer: Option<Arc<dyn ActivationObserver + Send + Sync>>,
}

/// Distinct content-verified activation evidence constructed solely by successful descriptor
/// hashing inside [`PreparedArtifactActivation::verify`]. Retains the descriptor until publication finishes.
struct ContentVerifiedArtifactActivation {
    descriptor: VerifiedFile,
    pending: PendingArtifact,
    root_id: PathRef,
    root_path: PathBuf,
    root_identity: Identity,
    verified_identity: Identity,
    verified_change_stamp: i128,
    #[cfg(test)]
    observer: Option<Arc<dyn ActivationObserver + Send + Sync>>,
}

impl PreparedArtifactActivation {
    /// Hashes the retained descriptor against the journalled size/digest without holding
    /// any authority reference or mutex lock, and verifies descriptor identity and change stamp after reading.
    fn verify(mut self) -> Result<ContentVerifiedArtifactActivation, Error> {
        #[cfg(test)]
        let (size, digest) = self.descriptor.sha256(self.observer.as_ref())?;
        #[cfg(not(test))]
        let (size, digest) = self.descriptor.sha256()?;

        if size != self.pending.payload_size || digest != self.pending.payload_sha256 {
            return Err(Error::Conflict(
                "download artifact payload differs from its durable reservation".into(),
            ));
        }
        let (a, b) = opened_file_identity(self.descriptor.as_file())?;
        let post_identity = Identity { a, b };
        let post_change_stamp = opened_file_change_stamp(self.descriptor.as_file())?;
        if post_identity != self.prepared_identity
            || post_change_stamp != self.prepared_change_stamp
        {
            return Err(Error::Conflict(
                "download artifact has no durable post-rename identity marker".into(),
            ));
        }
        #[cfg(test)]
        if let Some(observer) = &self.observer {
            observer.observe(ActivationObserverStage::PostVerification);
        }
        Ok(ContentVerifiedArtifactActivation {
            descriptor: self.descriptor,
            pending: self.pending,
            root_id: self.root_id,
            root_path: self.root_path,
            root_identity: self.root_identity,
            verified_identity: post_identity,
            verified_change_stamp: post_change_stamp,
            #[cfg(test)]
            observer: self.observer,
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineHandleKind {
    Engine,
}

/// Opaque exact opening-book file. It cannot be used where an executable or generic file
/// capability is expected.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct OpeningBookHandle {
    pub id: PathRef,
    pub kind: OpeningBookHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum OpeningBookHandleKind {
    OpeningBook,
}
/// Backend-only descriptor for the exact authority-validated opening-book file.
/// It intentionally retains an opened file instead of a path, so parsing cannot
/// be redirected by a replacement after capability resolution.
pub(crate) struct OpeningBookDescriptor {
    pub(crate) file_name: String,
    file: fs::File,
}

impl OpeningBookDescriptor {
    /// Reads the already-opened file in bounded chunks. Cancellation is checked
    /// between reads, keeping the single blocking opening-book worker responsive.
    pub(crate) fn read_bounded_bytes_cancellable(
        &mut self,
        max_bytes: usize,
        cancellation: &CancellationToken,
    ) -> Result<Vec<u8>, Error> {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let declared = self.file.metadata()?.len();
        if declared > max_bytes as u64 {
            return Err(Error::ResourceLimit(
                "opening book exceeds the configured size limit".into(),
            ));
        }

        read_bounded_bytes(
            &mut self.file,
            declared,
            max_bytes,
            "opening book exceeds the configured size limit",
            || {
                if cancellation.is_cancelled() {
                    Err(Error::Cancellation)
                } else {
                    Ok(())
                }
            },
        )
    }
}
impl OpeningBookHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: OpeningBookHandleKind::OpeningBook,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Backend-only sealed executable object. Unix retains the revalidated opened
/// descriptor; Windows retains its revalidated no-delete handle and launch
/// path. Callers cannot obtain a filesystem path from a renderer capability.
pub(crate) struct EngineExecutable {
    #[cfg(unix)]
    file: fs::File,
    working_directory: PathBuf,
    resource_leases: Vec<Arc<EngineResourceLease>>,
    #[cfg(target_os = "macos")]
    command_path: PathBuf,
    #[cfg(target_os = "macos")]
    launch_root: Option<EngineLaunchRoot>,
    #[cfg(target_os = "macos")]
    materialized_files: Vec<MaterializedFile>,
    #[cfg(windows)]
    /// Holds the no-delete handle until the executable is dropped.
    _file: fs::File,
    #[cfg(windows)]
    command_path: PathBuf,
}
impl EngineExecutable {
    /// Linux executes the already-opened inode through its stable procfs descriptor. This avoids
    /// a second pathname lookup between authority validation and process creation.
    #[cfg(target_os = "linux")]
    pub(crate) fn command_target(&self) -> PathBuf {
        use std::os::fd::AsRawFd;
        PathBuf::from(format!("/proc/self/fd/{}", self.file.as_raw_fd()))
    }
    #[cfg(target_os = "macos")]
    pub(crate) fn command_target(&self) -> &Path {
        &self.command_path
    }
    /// Windows CreateProcess accepts a path, not an opened executable handle.
    /// The kept no-delete handle seals that exact file until spawn completes,
    /// so the path cannot be replaced between authority validation and launch.
    #[cfg(windows)]
    pub(crate) fn command_target(&self) -> &Path {
        &self.command_path
    }
    pub(crate) fn working_directory(&self) -> &Path {
        &self.working_directory
    }
    /// Descriptors the child must be able to reach after `exec`: every resource
    /// lease, plus the sealed engine image itself.
    ///
    /// The image descriptor is included because `command_target` launches the
    /// engine as `/proc/self/fd/N`. When that inode is an interpreter script the
    /// kernel re-executes the interpreter with `/proc/self/fd/N` as its argument,
    /// so the interpreter must still be able to open descriptor `N` to read the
    /// script. With the default close-on-exec flag it cannot: the failure is a
    /// hard `ENOENT` at launch for every script-wrapped engine, not a silent
    /// redirection to the visible path. Reading the script back through the
    /// descriptor keeps the already-established sealing property intact.
    ///
    /// Note that `pre_exec` clears close-on-exec once, in the forked child, and
    /// nothing re-sets it. Anything the engine itself spawns therefore inherits
    /// these descriptors too. That has always been true of resource leases; the
    /// engine image joins the same set, and it is no more sensitive than the
    /// leases, being the program the engine is already running.
    #[cfg(target_os = "linux")]
    pub(crate) fn inherited_fds(&self) -> Vec<std::os::fd::RawFd> {
        use std::os::fd::AsRawFd;
        self.resource_leases
            .iter()
            .map(|lease| lease.file.as_raw_fd())
            .chain(std::iter::once(self.file.as_raw_fd()))
            .collect()
    }
    pub(crate) fn with_resource_leases(
        mut self,
        resource_leases: Vec<Arc<EngineResourceLease>>,
    ) -> Self {
        self.resource_leases = resource_leases;
        self
    }

    pub(crate) fn resource_leases(&self) -> &[Arc<EngineResourceLease>] {
        &self.resource_leases
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn launch_root(&self) -> Option<&EngineLaunchRoot> {
        self.launch_root.as_ref()
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn image_file(&self) -> &fs::File {
        &self.file
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn set_launch_materialization(
        &mut self,
        command_path: PathBuf,
        materialized_files: Vec<MaterializedFile>,
    ) {
        self.command_path = command_path;
        self.materialized_files = materialized_files;
    }

    #[cfg(all(test, target_os = "macos"))]
    pub(crate) fn set_test_launch_root(&mut self, launch_root: EngineLaunchRoot) {
        self.launch_root = Some(launch_root);
    }
}
impl EngineHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: EngineHandleKind::Engine,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseDescriptor {
    pub handle: DatabaseHandle,
    pub filename: String,
    pub availability: PathAvailability,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileWorkspaceDescriptor {
    pub handle: FileWorkspaceHandle,
    pub display_name: String,
    pub availability: PathAvailability,
}

/// A completed native download with a usable opaque file capability. Durability uncertainty is
/// reported without asking callers to retry a mutation that may already have committed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactPublication {
    pub handle: FileWorkspaceHandle,
    pub durability: CommitDurability,
}

#[derive(Clone)]
pub(crate) struct PendingArtifactReservation {
    id: PathRef,
    payload_size: u64,
    payload_sha256: String,
}

/// The lifetime and scope of a path capability.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PathClass {
    AppOwnedRoot,
    PersistentCustomRoot,
    PersistentFile,
    SingleDialogGrant,
    BoundedDialogGrant,
}

/// Exact least-privilege operation accepted by a capability.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PathOperation {
    ReadPgn,
    WritePgn,
    DatabaseRead,
    DatabaseMutate,
    DatabaseCreate,
    DatabaseExport,
    PuzzleRead,
    PuzzleDelete,
    EngineExecute,
    EngineConfigure,
    EngineBinaryInspect,
    EngineResourceRead,
    OpeningBookRead,
    ImageRead,
    DownloadFile,
    DownloadArchive,
    EngineInstall,
    SnapshotWrite,
    LogWrite,
    OpenShell,
}

fn is_database_file_operation(op: PathOperation) -> bool {
    match op {
        PathOperation::DatabaseRead
        | PathOperation::DatabaseMutate
        | PathOperation::DatabaseCreate
        | PathOperation::DatabaseExport => true,
        PathOperation::ReadPgn
        | PathOperation::WritePgn
        | PathOperation::PuzzleRead
        | PathOperation::PuzzleDelete
        | PathOperation::EngineExecute
        | PathOperation::EngineConfigure
        | PathOperation::EngineBinaryInspect
        | PathOperation::EngineResourceRead
        | PathOperation::OpeningBookRead
        | PathOperation::ImageRead
        | PathOperation::DownloadFile
        | PathOperation::DownloadArchive
        | PathOperation::EngineInstall
        | PathOperation::SnapshotWrite
        | PathOperation::LogWrite
        | PathOperation::OpenShell => false,
    }
}

/// Canonicalizes only the parent and appends the leaf name unchanged, so a leaf
/// symlink is never followed.
fn canonical_binding(path: &Path) -> Result<PathBuf, Error> {
    let file_name = path
        .file_name()
        .filter(|name| !name.is_empty())
        .ok_or_else(|| Error::InvalidInput("database path needs a leaf name".into()))?;
    Ok(fs::canonicalize(parent_of(path))?.join(file_name))
}

fn parent_of(path: &Path) -> &Path {
    path.parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."))
}

/// Returns the Windows namespace/path reason for a single component, independent of the host
/// platform. Callers apply this predicate only when the Windows path grammar is active; keeping
/// the policy itself cfg-free lets Linux tests execute every Windows-shaped case.
pub(crate) fn windows_component_refusal(name: &OsStr) -> Option<&'static str> {
    let text = name.to_string_lossy();
    if text
        .chars()
        .any(|character| matches!(character, ':' | '/' | '\\' | '\0'))
    {
        return Some("Windows path components may not contain a separator, colon, or NUL");
    }
    if text.encode_utf16().count() > 255 {
        return Some("Windows path component exceeds 255 UTF-16 units");
    }
    if matches!(text.chars().last(), Some('.' | ' ')) {
        return Some("Windows path components may not end with a dot or space");
    }
    let stem = text
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    if matches!(
        stem.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
            | "COM¹"
            | "COM²"
            | "COM³"
            | "LPT¹"
            | "LPT²"
            | "LPT³"
    ) {
        return Some("Windows path component uses a reserved DOS device name");
    }
    None
}

/// The database name leaves room for the appended `.ecsi` search-index sidecar. The shared
/// component predicate remains at the real filesystem limit of 255 units so derived sidecars
/// are valid for an accepted 250-unit database name.
pub(crate) fn windows_database_leaf_refusal(name: &OsStr) -> Option<&'static str> {
    (name.to_string_lossy().encode_utf16().count() > 250).then_some(
        "database filename exceeds the Windows search-index sidecar limit of 250 UTF-16 units",
    )
}

fn validate_windows_database_leaf(name: &OsStr) -> Result<(), Error> {
    if !cfg!(windows) {
        return Ok(());
    }
    if let Some(reason) = windows_database_leaf_refusal(name) {
        return Err(Error::InvalidInput(reason.into()));
    }
    let mut preferred = name.to_os_string();
    preferred.push(".ecsi");
    let legacy = Path::new(name).with_extension("ecsi").into_os_string();
    for sidecar in [preferred, legacy] {
        if let Some(reason) = windows_component_refusal(&sidecar) {
            return Err(Error::InvalidInput(format!(
                "database search-index sidecar is not a valid Windows component: {reason}"
            )));
        }
    }
    Ok(())
}

/// Converts a UTF-16 component length to the two byte lengths used by `UNICODE_STRING`.
/// Returning `None` prevents the lossy `usize` to `u16` cast from opening a different object.
///
/// Deliberately not `#[cfg(windows)]`: its only production caller is `open_windows_child`, but the
/// guard it carries is `f-20260916-03`'s subject and is unit-tested on every platform, which a
/// gated helper could not be. The non-test Linux build therefore has no caller.
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn unicode_string_lengths(utf16_units: usize) -> Option<(u16, u16)> {
    let bytes = utf16_units.checked_mul(2)?;
    let length = u16::try_from(bytes).ok()?;
    Some((length, length))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum EntryPurpose {
    PgnWorkspace,
    PgnFile,
    PgnReadOnlyFile,
    DownloadDestination,
    DatabaseRoot,
    DatabaseFile,
    PuzzleRoot,
    PuzzleFile,
    EngineRoot,
    EngineExecutable,
    EngineResource,
    OpeningBook,
    EngineImage,
}

#[derive(
    Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, Type,
)]
#[serde(rename_all = "camelCase")]
pub enum PathOwnerFamily {
    Engines,
    DownloadDestination,
    FileWorkspace,
    RecentFiles,
    ReferenceDatabase,
    PuzzleDatabase,
    OpeningBook,
    SessionWorkspace,
    ExpandedDirectories,
    DatabaseView,
    PracticeDeck,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StartupPathOwners {
    pub retained_ids: Vec<PathRef>,
    pub trusted_families: Vec<PathOwnerFamily>,
}

/// Maximum number of IDs accepted in one trusted attachment-owner request in normal state.
const MAX_AUTHORITY_REQUEST_IDS: usize = MAX_AUTHORITY_IDS;

/// Prepare marks the supplied current-session attachments as prepared without retiring omitted
/// IDs; an empty list is an explicit prepare with no retained attachments.
/// Reconcile with `Some([])` is a trusted complete owner snapshot and permits retirement of
/// omitted IDs. `None` is abandon-only: only explicitly abandoned provisional IDs are retired.
#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum EngineAttachmentAction {
    Prepare {
        retained_ids: Vec<PathRef>,
    },
    Reconcile {
        retained_ids: Option<Vec<PathRef>>,
        abandoned_ids: Vec<PathRef>,
        startup: bool,
    },
}

fn same_operation_set(actual: &[PathOperation], expected: &[PathOperation]) -> bool {
    actual.len() == expected.len() && expected.iter().all(|operation| actual.contains(operation))
}

fn canonical_operations(purpose: EntryPurpose) -> Vec<PathOperation> {
    match purpose {
        EntryPurpose::PgnWorkspace | EntryPurpose::PgnFile => {
            vec![PathOperation::ReadPgn, PathOperation::WritePgn]
        }
        EntryPurpose::PgnReadOnlyFile => vec![PathOperation::ReadPgn],
        EntryPurpose::DownloadDestination => vec![PathOperation::DownloadFile],
        EntryPurpose::DatabaseRoot => vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
            PathOperation::DatabaseCreate,
            PathOperation::DatabaseExport,
            PathOperation::DownloadFile,
        ],
        EntryPurpose::DatabaseFile => vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
            PathOperation::DatabaseCreate,
            PathOperation::DatabaseExport,
        ],
        EntryPurpose::PuzzleRoot => vec![
            PathOperation::PuzzleRead,
            PathOperation::PuzzleDelete,
            PathOperation::DownloadFile,
        ],
        EntryPurpose::PuzzleFile => {
            vec![PathOperation::PuzzleRead, PathOperation::PuzzleDelete]
        }
        EntryPurpose::EngineRoot => vec![
            PathOperation::DownloadArchive,
            PathOperation::EngineInstall,
            PathOperation::EngineExecute,
            PathOperation::EngineConfigure,
        ],
        EntryPurpose::EngineExecutable => engine_file_operations(),
        EntryPurpose::EngineResource => vec![PathOperation::EngineResourceRead],
        EntryPurpose::OpeningBook => vec![PathOperation::OpeningBookRead],
        EntryPurpose::EngineImage => vec![PathOperation::ImageRead],
    }
}

fn purpose_matches_shape(purpose: EntryPurpose, class: PathClass, target_is_dir: bool) -> bool {
    let expected_dir = matches!(
        purpose,
        EntryPurpose::PgnWorkspace
            | EntryPurpose::DownloadDestination
            | EntryPurpose::DatabaseRoot
            | EntryPurpose::PuzzleRoot
            | EntryPurpose::EngineRoot
    ) || (purpose == EntryPurpose::EngineResource && target_is_dir);
    let expected_class = if expected_dir {
        PathClass::PersistentCustomRoot
    } else {
        PathClass::PersistentFile
    };
    class == expected_class && target_is_dir == expected_dir
}

fn purpose_for_shape(
    class: PathClass,
    target_is_dir: bool,
    operations: &[PathOperation],
) -> Option<EntryPurpose> {
    let candidates = [
        EntryPurpose::PgnWorkspace,
        EntryPurpose::PgnFile,
        EntryPurpose::PgnReadOnlyFile,
        EntryPurpose::DownloadDestination,
        EntryPurpose::DatabaseRoot,
        EntryPurpose::DatabaseFile,
        EntryPurpose::PuzzleRoot,
        EntryPurpose::PuzzleFile,
        EntryPurpose::EngineRoot,
        EntryPurpose::EngineExecutable,
        EntryPurpose::EngineResource,
        EntryPurpose::OpeningBook,
        EntryPurpose::EngineImage,
    ];
    candidates.into_iter().find(|purpose| {
        purpose_matches_shape(*purpose, class, target_is_dir)
            && same_operation_set(operations, &canonical_operations(*purpose))
    })
}

fn owner_families_for_purpose(purpose: EntryPurpose) -> Option<Vec<PathOwnerFamily>> {
    use PathOwnerFamily as Family;
    Some(match purpose {
        EntryPurpose::PgnWorkspace | EntryPurpose::PgnFile | EntryPurpose::PgnReadOnlyFile => vec![
            Family::FileWorkspace,
            Family::RecentFiles,
            Family::SessionWorkspace,
            Family::ExpandedDirectories,
            Family::PracticeDeck,
        ],
        EntryPurpose::DownloadDestination => vec![Family::DownloadDestination],
        EntryPurpose::DatabaseRoot | EntryPurpose::PuzzleRoot | EntryPurpose::EngineRoot => vec![],
        EntryPurpose::DatabaseFile => vec![
            Family::ReferenceDatabase,
            Family::SessionWorkspace,
            Family::DatabaseView,
        ],
        EntryPurpose::PuzzleFile => vec![Family::PuzzleDatabase],
        EntryPurpose::EngineExecutable => vec![Family::Engines],
        EntryPurpose::OpeningBook => vec![Family::OpeningBook],
        EntryPurpose::EngineResource | EntryPurpose::EngineImage => return None,
    })
}

#[derive(Serialize, Deserialize, Type, Clone, Copy)]
pub enum SoundKind {
    Move,
    Capture,
    Check,
}

impl SoundKind {
    fn file_name(&self) -> &str {
        match self {
            Self::Move => "Move.mp3",
            Self::Capture => "Capture.mp3",
            Self::Check => "Check.mp3",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PathAvailability {
    Available,
    Unavailable,
}

/// Test-only snapshot of a path registry entry.
#[cfg(test)]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PathDescriptor {
    pub id: PathRef,
    pub display_name: String,
    pub class: PathClass,
    pub availability: PathAvailability,
}

/// Persistence result paired with a committed path identifier. `DurabilityUncertain` means the
/// replacement happened but syncing its parent directory failed; callers must not retry.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub enum CommitDurability {
    Durable,
    DurabilityUncertain(crate::error::DurabilityStage),
}

pub(crate) fn require_durable(durability: CommitDurability) -> Result<(), Error> {
    match durability {
        CommitDurability::Durable => Ok(()),
        CommitDurability::DurabilityUncertain(stage) => {
            Err(Error::CommittedDurabilityUncertain(stage))
        }
    }
}

/// Engine and opening-book registration has no renderer-visible list to recover
/// from: picker paths never cross IPC, and copied images are UUID-named. Keep
/// the adopted handle after an uncertain parent sync, matching
/// `set_active_engine_root`. `require_durable` stays on create paths that have
/// a list-and-recover caller.
fn keep_adopted_handle<T: std::fmt::Debug>(durability: CommitDurability, value: T) -> T {
    if let CommitDurability::DurabilityUncertain(stage) = durability {
        log::warn!("registration committed with uncertain durability: {stage}; adopted {value:?}");
    }
    value
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum WorkspaceRemovalStatus {
    Complete,
    Partial,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct PathCommit {
    pub id: PathRef,
    pub durability: CommitDurability,
}
impl std::ops::Deref for PathCommit {
    type Target = PathRef;
    fn deref(&self) -> &Self::Target {
        &self.id
    }
}
impl PartialEq<PathCommit> for PathRef {
    fn eq(&self, other: &PathCommit) -> bool {
        self == &other.id
    }
}
impl PartialEq<PathRef> for PathCommit {
    fn eq(&self, other: &PathRef) -> bool {
        &self.id == other
    }
}

#[derive(Clone, Debug)]
pub struct AppOwnedRoot {
    pub id: PathRef,
    pub display_name: String,
    pub path: PathBuf,
    pub operations: Vec<PathOperation>,
}
impl AppOwnedRoot {
    #[cfg(test)]
    pub fn new(
        display_name: impl Into<String>,
        path: PathBuf,
        operations: Vec<PathOperation>,
    ) -> Self {
        Self {
            id: PathRef::fresh(),
            display_name: display_name.into(),
            path,
            operations,
        }
    }
}

/// One of the application's own default root directories under its app-data directory.
/// The set is closed on purpose: the leaf is one half of the security property, so a caller
/// can name only a directory the application itself defines; the declared mode is the other half.
/// [`AppDataDir`] fixes the parent.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum AppOwnedDefaultRoot {
    Databases,
    Engines,
    EngineImages,
    Puzzles,
    Credentials,
    #[cfg(target_os = "macos")]
    EngineLaunch,
}

impl AppOwnedDefaultRoot {
    pub(crate) const ALL: &[Self] = &[
        Self::Databases,
        Self::Engines,
        Self::EngineImages,
        Self::Puzzles,
        Self::Credentials,
        #[cfg(target_os = "macos")]
        Self::EngineLaunch,
    ];

    fn leaf(self) -> &'static str {
        match self {
            Self::Databases => "db",
            Self::Engines => "engines",
            Self::EngineImages => "engine-images",
            Self::Puzzles => "puzzles",
            Self::Credentials => "credentials",
            #[cfg(target_os = "macos")]
            Self::EngineLaunch => "engine-launch",
        }
    }

    #[cfg(unix)]
    fn private_mode(self) -> Option<rustix::fs::RawMode> {
        match self {
            Self::Credentials => Some(0o700),
            #[cfg(target_os = "macos")]
            Self::EngineLaunch => Some(0o700),
            Self::Databases | Self::Engines | Self::EngineImages | Self::Puzzles => None,
        }
    }
}

/// The application's own app-data directory: the only parent an [`AppOwnedDefaultRoot`] may
/// be materialised under. The type is opaque and its only production constructor derives the
/// path from the Tauri app handle, so no in-crate caller can produce one from a user-picked or
/// dialog-derived directory. Without it the leaf was fixed and the parent was an arbitrary
/// `&Path`, which left `<anywhere>/db` reachable — and `src-tauri/src/infra/**` is invisible to
/// `check-rust-release-surface.mjs`, so such a caller would cost no counted site.
pub(crate) struct AppDataDir(PathBuf);

impl AppDataDir {
    /// The production constructor, and the only one outside tests. Generic over
    /// `R: tauri::Runtime`, matching how `puzzle.rs` and `db/mod.rs` spell that bound, so the
    /// workspace helpers stay reachable from `tauri::test::mock_app()`.
    pub(crate) fn for_app<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Self, Error> {
        use tauri::Manager as _;
        Ok(Self(app.path().app_data_dir()?))
    }

    /// Test-only, and `#[cfg(test)]`-gated rather than merely private: a constructor from an
    /// arbitrary path is precisely the escape hatch this type exists to remove, so it must not
    /// compile into the shipped binary at all. The tests need it because a real
    /// `app_data_dir()` resolves against the user directory of the machine running them.
    #[cfg(test)]
    pub(crate) fn for_test(path: &Path) -> Self {
        Self(path.to_path_buf())
    }

    fn as_path(&self) -> &Path {
        &self.0
    }
}

/// Bundled resource directory whose production constructor fixes the parent directory.
pub(crate) struct ResourceDir(PathBuf);

impl ResourceDir {
    pub(crate) fn for_app<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Self, Error> {
        Ok(Self(app.path().resource_dir()?))
    }

    /// Test-only for the same reason as [`AppDataDir::for_test`]: arbitrary resource roots must
    /// not be constructible in the shipped binary.
    #[cfg(all(test, unix))]
    pub(crate) fn for_test(path: &Path) -> Self {
        Self(path.to_path_buf())
    }

    pub(crate) fn bundled_sound_path(
        &self,
        collection: &str,
        kind: SoundKind,
    ) -> Result<PathBuf, Error> {
        let Some((_, has_check)) = BUNDLED_SOUND_COLLECTIONS
            .iter()
            .find(|(name, _)| *name == collection)
        else {
            return Err(Error::InvalidInput(
                "unknown bundled sound collection".into(),
            ));
        };
        if matches!(kind, SoundKind::Check) && !has_check {
            return Err(Error::InvalidInput(
                "no bundled check sound in that collection".into(),
            ));
        }
        Ok(self
            .as_path()
            .join(SOUND_ROOT_LEAF)
            .join(collection)
            .join(kind.file_name()))
    }

    fn as_path(&self) -> &Path {
        &self.0
    }
}

#[cfg(unix)]
fn authorize_existing_dir(path: &Path) -> Result<AuthorizedDir, Error> {
    use std::os::unix::fs::MetadataExt;
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "app-owned default root is not a directory",
        )
        .into());
    }
    let identity = (metadata.dev(), metadata.ino());
    let directory = crate::infra::fs::open_verified_directory(path, identity)?;
    Ok(AuthorizedDir {
        directory,
        identity,
        path: path.to_path_buf(),
    })
}

#[cfg(not(unix))]
fn authorize_existing_dir(path: &Path) -> Result<AuthorizedDir, Error> {
    let _ = path;
    Err(crate::infra::platform_support::unsupported_plural(
        "authorized directories",
    ))
}

/// Materialise one of the application's own default root directories under `app_data_dir`.
/// Both halves of the path are fixed by the types: the leaf per variant, the parent by
/// [`AppDataDir`]'s constructor. No caller can therefore name a directory the application does
/// not own, and in particular a user-picked path can never acquire create-if-missing semantics.
/// Refuses a leaf that is a symlink or not a directory.
///
/// The function returns its verified directory descriptor; subsequent writes must use the
/// descriptor rather than reopening the pathname. The function's `create_dir_all` call still
/// follows ancestor symlinks, which is tracked separately.
///
/// The refusal is built as an `std::io::Error`, so it reaches the renderer as `Error::Io` —
/// fixed text plus the MissingResource/Permission/Io discrimination. `Error::InvalidInput`
/// would render its string verbatim and put a native path on the wire.
pub(crate) fn ensure_app_owned_default_dir(
    app_data_dir: &AppDataDir,
    root: AppOwnedDefaultRoot,
) -> Result<AuthorizedDir, Error> {
    crate::infra::platform_support::off_unix_refusal("app-owned default directories", cfg!(unix))?;
    let path = app_data_dir.as_path().join(root.leaf());
    fs::create_dir_all(&path)?;
    let directory = authorize_existing_dir(&path)?;
    #[cfg(unix)]
    if let Some(mode) = root.private_mode() {
        rustix::fs::fchmod(
            directory.directory.as_file(),
            rustix::fs::Mode::from_raw_mode(mode),
        )
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    }
    Ok(directory)
}

#[cfg(target_os = "macos")]
const MAX_ENGINE_LAUNCH_LEAVES: usize = 64;
#[cfg(target_os = "macos")]
pub(crate) const ENGINE_EXECUTABLE_LEAF_MODE: u32 = 0o700;
#[cfg(target_os = "macos")]
pub(crate) const ENGINE_RESOURCE_LEAF_MODE: u32 = 0o600;
#[cfg(target_os = "macos")]
pub(crate) const ENGINE_LAUNCH_LOCK_MODE: u32 = 0o600;

#[cfg(target_os = "macos")]
#[derive(Debug, Clone)]
pub(crate) struct EngineLaunchRoot {
    inner: Arc<EngineLaunchRootInner>,
}

#[cfg(target_os = "macos")]
#[derive(Debug)]
struct EngineLaunchRootInner {
    _root: fs::File,
    _lock: fs::File,
    instance: fs::File,
    instance_path: PathBuf,
    registry: std::sync::Mutex<LaunchLeafRegistry>,
}

#[cfg(target_os = "macos")]
impl EngineLaunchRootInner {
    fn registry(&self) -> std::sync::MutexGuard<'_, LaunchLeafRegistry> {
        match self.registry.lock() {
            Ok(registry) => registry,
            Err(poisoned) => poisoned.into_inner(),
        }
    }
}

#[cfg(target_os = "macos")]
#[derive(Debug, Default)]
struct LaunchLeafRegistry {
    live: usize,
    released: Vec<ReleasedLeaf>,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ReleasedLeaf {
    pub(crate) leaf: OsString,
    pub(crate) engine_key: String,
    pub(crate) engine_id: String,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Default)]
pub(crate) struct ReclaimReport {
    pub(crate) removed: usize,
    pub(crate) failed: Vec<(ReleasedLeaf, Error)>,
}

#[cfg(target_os = "macos")]
pub(crate) struct MaterializedFile {
    root: Arc<EngineLaunchRootInner>,
    leaf: OsString,
    engine_key: String,
    engine_id: String,
    attempted: bool,
    active: bool,
}

#[cfg(target_os = "macos")]
impl Drop for MaterializedFile {
    fn drop(&mut self) {
        if !self.active {
            return;
        }
        let mut registry = self.root.registry();
        if self.attempted {
            registry.released.push(ReleasedLeaf {
                leaf: self.leaf.clone(),
                engine_key: self.engine_key.clone(),
                engine_id: self.engine_id.clone(),
            });
        } else {
            registry.live = registry.live.saturating_sub(1);
        }
    }
}

#[cfg(target_os = "macos")]
impl MaterializedFile {
    pub(crate) fn path(&self) -> PathBuf {
        self.root.instance_path.join(&self.leaf)
    }

    pub(crate) fn create_from(
        &mut self,
        source: &fs::File,
        mode: u32,
        is_cancelled: &dyn Fn() -> bool,
    ) -> Result<(), Error> {
        self.attempted = true;
        #[cfg(all(test, unix))]
        observe_engine_resolution("leaf");
        if is_cancelled() {
            return Err(Error::Cancellation);
        }
        #[cfg(test)]
        ENGINE_LAUNCH_BEFORE_CLONE_HOOKS.run(&self.engine_key);

        use rustix::fs::{self as rfs, CloneFlags, Mode};
        use rustix::io::Errno;
        #[cfg(test)]
        let forced_failure = ENGINE_LAUNCH_FAILURES.take(&self.engine_key);
        #[cfg(test)]
        let cloned = match forced_failure {
            Some(EngineLaunchFailure::CloneExdev) => Err(Errno::XDEV),
            Some(EngineLaunchFailure::CloneEnotsup) => Err(Errno::NOTSUP),
            Some(EngineLaunchFailure::Copy) => Err(Errno::XDEV),
            _ => rfs::fclonefileat(source, &self.root.instance, &self.leaf, CloneFlags::empty()),
        };
        #[cfg(not(test))]
        let cloned =
            rfs::fclonefileat(source, &self.root.instance, &self.leaf, CloneFlags::empty());
        match cloned {
            Ok(()) => {}
            Err(error) if error == Errno::XDEV || error == Errno::NOTSUP => {
                let (mut target, _) =
                    crate::infra::fs::create_regular_at(&self.root.instance, &self.leaf)?;
                #[cfg(test)]
                if forced_failure == Some(EngineLaunchFailure::Copy) {
                    return Err(Error::Io(Box::new(std::io::Error::other(
                        "injected engine launch copy failure",
                    ))));
                }
                let stat = rfs::fstat(source)
                    .map_err(|error| Error::Io(Box::new(std::io::Error::from(error))))?;
                let size = u64::try_from(stat.st_size).map_err(|_| {
                    Error::InvalidInput("engine launch source has an invalid size".into())
                })?;
                let mut offset = 0_u64;
                let mut buffer = [0_u8; 64 * 1024];
                while offset < size {
                    if is_cancelled() {
                        return Err(Error::Cancellation);
                    }
                    let wanted = usize::try_from((size - offset).min(buffer.len() as u64))
                        .map_err(|_| {
                            Error::ResourceLimit("engine launch file is too large".into())
                        })?;
                    let read = rustix::io::pread(source, &mut buffer[..wanted], offset)
                        .map_err(|error| Error::Io(Box::new(std::io::Error::from(error))))?;
                    if read == 0 {
                        return Err(Error::Io(Box::new(std::io::Error::new(
                            std::io::ErrorKind::UnexpectedEof,
                            "engine launch source ended before its descriptor size",
                        ))));
                    }
                    target.write_all(&buffer[..read])?;
                    offset = offset.checked_add(read as u64).ok_or_else(|| {
                        Error::ResourceLimit("engine launch file is too large".into())
                    })?;
                }
            }
            Err(error) => return Err(Error::Io(Box::new(std::io::Error::from(error)))),
        }
        if is_cancelled() {
            return Err(Error::Cancellation);
        }
        let target = crate::infra::fs::open_regular_at(
            &self.root.instance,
            &self.leaf,
            crate::infra::fs::RegularFileAccess::ReadOnly,
        )?;
        let mode = u16::try_from(mode)
            .map_err(|_| Error::InvalidInput("engine launch mode is invalid".into()))?;
        #[cfg(test)]
        if forced_failure == Some(EngineLaunchFailure::Fchmod) {
            return Err(Error::Io(Box::new(std::io::Error::other(
                "injected engine launch fchmod failure",
            ))));
        }
        rfs::fchmod(&target, Mode::from_raw_mode(mode))
            .map_err(|error| Error::Io(Box::new(std::io::Error::from(error))))?;
        if is_cancelled() {
            return Err(Error::Cancellation);
        }
        Ok(())
    }

    pub(crate) fn remove(mut self) -> Result<(), Error> {
        if !self.active {
            return Ok(());
        }
        let result = remove_instance_leaf(&self.root.instance, &self.leaf);
        if result.is_ok() {
            self.active = false;
            let mut registry = self.root.registry();
            registry.live = registry.live.saturating_sub(1);
        }
        result
    }
}

#[cfg(target_os = "macos")]
fn remove_instance_leaf(instance: &fs::File, leaf: &OsStr) -> Result<(), Error> {
    match rustix::fs::statat(instance, leaf, rustix::fs::AtFlags::SYMLINK_NOFOLLOW) {
        Err(rustix::io::Errno::NOENT) => Ok(()),
        Err(error) => Err(Error::Io(Box::new(std::io::Error::from(error)))),
        Ok(stat) => crate::infra::fs::remove_entry_at(
            instance,
            leaf,
            crate::infra::fs::raw_stat_identity(&stat),
            false,
        ),
    }
}

#[cfg(target_os = "macos")]
impl EngineLaunchRoot {
    #[cfg(test)]
    pub(crate) fn instance_path(&self) -> PathBuf {
        self.inner.instance_path.clone()
    }

    pub(crate) fn reserve_leaves(
        &self,
        count: usize,
        engine_key: &str,
        engine_id: &str,
    ) -> Result<Vec<MaterializedFile>, Error> {
        let mut registry = self.inner.registry();
        if registry.live.saturating_add(count) > MAX_ENGINE_LAUNCH_LEAVES {
            return Err(Error::ResourceLimit(
                "engine launch leaf limit reached".into(),
            ));
        }
        registry.live += count;
        Ok((0..count)
            .map(|_| MaterializedFile {
                root: self.inner.clone(),
                leaf: OsString::from(format!("{}.leaf", Uuid::new_v4())),
                engine_key: engine_key.into(),
                engine_id: engine_id.into(),
                attempted: false,
                active: true,
            })
            .collect())
    }

    pub(crate) fn reclaim(&self) -> ReclaimReport {
        let released = {
            let mut registry = self.inner.registry();
            std::mem::take(&mut registry.released)
        };
        let mut report = ReclaimReport::default();
        for leaf in released {
            let result = remove_instance_leaf(&self.inner.instance, &leaf.leaf);
            let mut registry = self.inner.registry();
            match result {
                Ok(()) => {
                    report.removed += 1;
                    registry.live = registry.live.saturating_sub(1);
                }
                Err(error) => {
                    registry.released.push(leaf.clone());
                    report.failed.push((leaf, error));
                }
            }
        }
        report
    }

    #[cfg(test)]
    pub(crate) fn registry_snapshot_for_test(&self) -> (usize, Vec<ReleasedLeaf>) {
        let registry = self.inner.registry();
        (registry.live, registry.released.clone())
    }

    #[cfg(test)]
    pub(crate) fn for_test(temp_dir: &Path) -> Result<Self, Error> {
        initialize_engine_launch_root(&AppDataDir::for_test(temp_dir))
    }
}

#[cfg(target_os = "macos")]
fn sibling_id(name: &OsStr) -> Option<String> {
    name.to_str()
        .and_then(|name| name.strip_suffix(".lock"))
        .map(str::to_owned)
}

#[cfg(target_os = "macos")]
fn log_launch_sibling_failure(id: &str, error: &Error) {
    log::error!(
        "engine launch sibling cleanup failed for {id}: category={}",
        error.category()
    );
}

#[cfg(target_os = "macos")]
fn sweep_engine_launch_root(
    root: &AuthorizedDir,
    own_lock: &OsStr,
    own_instance: &OsStr,
) -> Result<(), Error> {
    use rustix::fs::{self as rfs, FlockOperation};
    use rustix::io::Errno;
    let entries = read_directory_entries_at(
        root.directory.as_file(),
        &CancellationToken::new(),
        &mut |_| true,
    )?;
    let lock_ids = entries
        .iter()
        .filter_map(|entry| sibling_id(&entry.name))
        .collect::<std::collections::HashSet<_>>();
    for entry in &entries {
        if entry.name == own_lock || entry.name == own_instance {
            continue;
        }
        let Some(id) = sibling_id(&entry.name) else {
            continue;
        };
        if entry.kind != DirectoryEntryKind::RegularFile {
            let error = root
                .open_regular_relative(Path::new(&entry.name))
                .err()
                .unwrap_or_else(|| Error::InvalidInput("engine launch lock is not a file".into()));
            log_launch_sibling_failure(&id, &error);
            continue;
        }
        let lock = match crate::infra::fs::open_regular_at(
            root.directory.as_file(),
            &entry.name,
            RegularFileAccess::ReadOnly,
        ) {
            Ok(lock) => lock,
            Err(error) => {
                log_launch_sibling_failure(&id, &error);
                continue;
            }
        };
        match rfs::flock(&lock, FlockOperation::NonBlockingLockExclusive) {
            Err(error) if error == Errno::AGAIN || error == Errno::WOULDBLOCK => continue,
            Err(error) => {
                log_launch_sibling_failure(&id, &Error::Io(Box::new(error.into())));
                continue;
            }
            Ok(()) => {}
        }
        let instance_name = OsStr::new(&id);
        if let Some(instance) = entries
            .iter()
            .find(|candidate| candidate.name == instance_name)
        {
            if instance.kind != DirectoryEntryKind::Directory {
                let error = Error::InvalidInput("engine launch instance is not a directory".into());
                log_launch_sibling_failure(&id, &error);
                continue;
            }
            if let Err(error) = crate::infra::fs::remove_entry_at(
                root.directory.as_file(),
                &instance.name,
                instance.identity,
                true,
            ) {
                log_launch_sibling_failure(&id, &error);
                continue;
            }
        }
        if let Err(error) = crate::infra::fs::remove_entry_at(
            root.directory.as_file(),
            &entry.name,
            entry.identity,
            false,
        ) {
            log_launch_sibling_failure(&id, &error);
        }
    }
    for entry in &entries {
        if entry.name == own_lock || entry.name == own_instance {
            continue;
        }
        if entry.kind == DirectoryEntryKind::Directory
            && entry
                .name
                .to_str()
                .is_none_or(|name| !lock_ids.contains(name))
        {
            if let Err(error) = crate::infra::fs::remove_entry_at(
                root.directory.as_file(),
                &entry.name,
                entry.identity,
                true,
            ) {
                log_launch_sibling_failure(&entry.name.to_string_lossy(), &error);
            }
        }
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub(crate) fn initialize_engine_launch_root(
    app_data: &AppDataDir,
) -> Result<EngineLaunchRoot, Error> {
    use std::os::fd::{AsRawFd, FromRawFd};
    use std::os::unix::ffi::OsStrExt;
    let root = ensure_app_owned_default_dir(app_data, AppOwnedDefaultRoot::EngineLaunch)?;
    let id = Uuid::new_v4().to_string();
    let lock_name = OsString::from(format!("{id}.lock"));
    let lock_name_c = std::ffi::CString::new(lock_name.as_os_str().as_bytes())
        .map_err(|_| Error::InvalidInput("engine launch lock name contains NUL".into()))?;
    let raw_lock = unsafe {
        // SAFETY: root is an open directory descriptor, and lock_name_c is a live NUL-terminated
        // string for the duration of this single call.
        libc::openat(
            root.directory.as_file().as_raw_fd(),
            lock_name_c.as_ptr(),
            libc::O_CREAT
                | libc::O_EXCL
                | libc::O_NOFOLLOW
                | libc::O_CLOEXEC
                | libc::O_EXLOCK
                | libc::O_NONBLOCK,
            ENGINE_LAUNCH_LOCK_MODE,
        )
    };
    if raw_lock < 0 {
        return Err(Error::Io(Box::new(std::io::Error::last_os_error())));
    }
    // SAFETY: openat returned a uniquely owned descriptor on success.
    let lock = unsafe { fs::File::from_raw_fd(raw_lock) };
    #[cfg(test)]
    ENGINE_LAUNCH_LOCK_CREATED_HOOK.with(|slot| {
        if let Some(hook) = slot.borrow_mut().take() {
            hook();
        }
    });
    let instance_name = OsString::from(id.clone());
    crate::infra::fs::create_dir_at(root.directory.as_file(), &instance_name)?;
    let instance =
        crate::infra::fs::open_directory_at(root.directory.as_file(), &instance_name, false)?;
    sweep_engine_launch_root(&root, &lock_name, &instance_name)?;
    Ok(EngineLaunchRoot {
        inner: Arc::new(EngineLaunchRootInner {
            _root: root.try_clone()?,
            _lock: lock,
            instance,
            instance_path: root.path().join(instance_name),
            registry: std::sync::Mutex::new(LaunchLeafRegistry::default()),
        }),
    })
}

#[cfg(all(test, target_os = "macos"))]
std::thread_local! {
    static ENGINE_LAUNCH_LOCK_CREATED_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> =
        const { std::cell::RefCell::new(None) };
}

/// Keyed by the engine key the leaf was reserved for; see `infra::test_hooks`.
#[cfg(all(test, target_os = "macos"))]
static ENGINE_LAUNCH_BEFORE_CLONE_HOOKS: crate::infra::test_hooks::KeyedTestHooks<String> =
    crate::infra::test_hooks::KeyedTestHooks::new();

#[cfg(all(test, target_os = "macos"))]
pub(crate) fn set_engine_launch_lock_created_hook(hook: Option<Box<dyn FnOnce()>>) {
    ENGINE_LAUNCH_LOCK_CREATED_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[cfg(all(test, target_os = "macos"))]
pub(crate) fn set_engine_launch_before_clone_hook(
    engine_key: &str,
    hook: Option<crate::infra::test_hooks::TestHook>,
) {
    match hook {
        Some(hook) => ENGINE_LAUNCH_BEFORE_CLONE_HOOKS.arm(engine_key.to_owned(), hook),
        None => ENGINE_LAUNCH_BEFORE_CLONE_HOOKS.clear(&engine_key.to_owned()),
    }
}

#[cfg(all(test, unix))]
pub(crate) type EngineResolutionTrace =
    Arc<std::sync::Mutex<Vec<(&'static str, std::thread::ThreadId)>>>;

#[cfg(all(test, unix))]
std::thread_local! {
    static ENGINE_RESOLUTION_TRACE_LOCAL: std::cell::RefCell<Option<EngineResolutionTrace>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(all(test, unix))]
pub(crate) fn set_engine_resolution_trace(trace: Option<EngineResolutionTrace>) {
    ENGINE_RESOLUTION_TRACE_LOCAL.with(|slot| *slot.borrow_mut() = trace);
}

#[cfg(all(test, unix))]
pub(crate) fn take_engine_resolution_trace_for_worker() -> Option<EngineResolutionTrace> {
    ENGINE_RESOLUTION_TRACE_LOCAL.with(|slot| slot.borrow_mut().take())
}

#[cfg(all(test, unix))]
pub(crate) struct EngineResolutionTraceGuard(Option<EngineResolutionTrace>);

#[cfg(all(test, unix))]
pub(crate) fn install_engine_resolution_trace_for_worker(
    trace: Option<EngineResolutionTrace>,
) -> EngineResolutionTraceGuard {
    let previous = ENGINE_RESOLUTION_TRACE_LOCAL.with(|slot| slot.replace(trace));
    EngineResolutionTraceGuard(previous)
}

#[cfg(all(test, unix))]
impl Drop for EngineResolutionTraceGuard {
    fn drop(&mut self) {
        ENGINE_RESOLUTION_TRACE_LOCAL.with(|slot| {
            slot.replace(self.0.take());
        });
    }
}

#[cfg(all(test, unix))]
fn observe_engine_resolution(kind: &'static str) {
    let trace = ENGINE_RESOLUTION_TRACE_LOCAL.with(|slot| slot.borrow().clone());
    if let Some(trace) = trace {
        trace
            .lock()
            .unwrap()
            .push((kind, std::thread::current().id()));
    }
}

#[cfg(all(test, target_os = "macos"))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum EngineLaunchFailure {
    CloneExdev,
    CloneEnotsup,
    Copy,
    Fchmod,
}

/// Keyed by the engine key the leaf was reserved for; see `infra::test_hooks`.
#[cfg(all(test, target_os = "macos"))]
static ENGINE_LAUNCH_FAILURES: crate::infra::test_hooks::KeyedTestValues<
    String,
    EngineLaunchFailure,
> = crate::infra::test_hooks::KeyedTestValues::new();

#[cfg(all(test, target_os = "macos"))]
pub(crate) fn set_engine_launch_failure(engine_key: &str, failure: Option<EngineLaunchFailure>) {
    match failure {
        Some(failure) => ENGINE_LAUNCH_FAILURES.arm(engine_key.to_owned(), failure),
        None => ENGINE_LAUNCH_FAILURES.clear(&engine_key.to_owned()),
    }
}

const SOUND_ROOT_LEAF: &str = "sound";
const BUNDLED_SOUND_COLLECTIONS: [(&str, bool); 8] = [
    ("futuristic", true),
    ("lisp", true),
    ("nes", true),
    ("piano", true),
    ("robot", true),
    ("sfx", true),
    ("standard", false),
    ("woodland", true),
];

#[cfg(any(target_os = "linux", all(test, unix)))]
pub(crate) fn open_app_owned_resource_dir(
    resource_dir: &ResourceDir,
) -> Result<AuthorizedDir, Error> {
    let path = resource_dir.as_path().join(SOUND_ROOT_LEAF);
    authorize_existing_dir(&path)
}

pub trait Clock: Send + Sync {
    fn now(&self) -> SystemTime;
}
#[derive(Default)]
pub struct SystemClock;
impl Clock for SystemClock {
    fn now(&self) -> SystemTime {
        SystemTime::now()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "platform", rename_all = "camelCase")]
enum NativePath {
    Unix { bytes: String },
    Windows { utf16: Vec<u16> },
}
impl NativePath {
    fn from_path(path: &Path) -> Self {
        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStrExt;
            Self::Unix {
                bytes: STANDARD_NO_PAD.encode(path.as_os_str().as_bytes()),
            }
        }
        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            Self::Windows {
                utf16: path.as_os_str().encode_wide().collect(),
            }
        }
        #[cfg(not(any(unix, windows)))]
        compile_error!("path authority needs a native path codec");
    }
    fn to_path(&self) -> Result<PathBuf, Error> {
        match self {
            #[cfg(unix)]
            Self::Unix { bytes } => {
                use std::os::unix::ffi::OsStringExt;
                Ok(PathBuf::from(OsString::from_vec(
                    STANDARD_NO_PAD
                        .decode(bytes)
                        .map_err(|_| Error::InvalidInput("invalid stored native path".into()))?,
                )))
            }
            #[cfg(windows)]
            Self::Windows { utf16 } => {
                use std::os::windows::ffi::OsStringExt;
                Ok(PathBuf::from(OsString::from_wide(utf16)))
            }
            #[allow(unreachable_patterns)]
            _ => Err(Error::InvalidInput(
                "registry path belongs to another platform".into(),
            )),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
// `windows_file_identity` is pub(crate) and returns this, so on the Windows target a private
// Identity is "more private than the item" that exposes it.
pub(crate) struct Identity {
    a: u64,
    b: u64,
}
fn identity(path: &Path) -> Result<Identity, Error> {
    let meta = fs::symlink_metadata(path)?;
    if meta.file_type().is_symlink() || is_reparse_point(&meta) {
        return Err(Error::InvalidInput(
            "symbolic links are not path authorities".into(),
        ));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Ok(Identity {
            a: meta.dev(),
            b: meta.ino(),
        })
    }
    #[cfg(windows)]
    {
        windows_identity(path)
    }
}

pub(crate) async fn hash_staged_payload_cancellable(
    path: PathBuf,
    cancellation: tokio_util::sync::CancellationToken,
) -> Result<(u64, String), Error> {
    crate::infra::blocking::BLOCKING_GATEWAY
        .spawn_cancellable(cancellation, move |token| {
            let mut file = fs::File::open(&path)?;
            sha256_reader_cancellable(&mut file, token)
        })
        .await
}

#[cfg(all(test, unix))]
fn sha256_file(path: &Path) -> Result<(u64, String), Error> {
    let mut file = fs::File::open(path)?;
    sha256_open_file(&mut file, None)
}

fn sha256_reader_cancellable(
    reader: &mut impl Read,
    cancellation: &tokio_util::sync::CancellationToken,
) -> Result<(u64, String), Error> {
    let mut hasher = Sha256::new();
    let mut size = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        size = size.checked_add(read as u64).ok_or_else(|| {
            Error::ResourceLimit("artifact payload exceeds supported size".into())
        })?;
        hasher.update(&buffer[..read]);
    }
    Ok((size, format!("{:x}", hasher.finalize())))
}

/// Activates the download artifact through a single blocking worker where payload hashing
/// occurs outside the authority lock. Locks to persist the post-rename marker and prepare,
/// drops the lock to verify the descriptor, then reacquires the lock to commit.
pub(crate) async fn activate_download_artifact_runtime(
    authority: &Arc<std::sync::Mutex<Option<PathAuthority>>>,
    reservation: &PendingArtifactReservation,
    installed_identity: (u64, u64),
    installed_ctime_nanos: i128,
) -> Result<ArtifactPublication, Error> {
    let authority = Arc::clone(authority);
    let reservation = reservation.clone();
    crate::infra::blocking::BLOCKING_GATEWAY
        .spawn(move || {
            let prepared = {
                let mut guard = authority
                    .lock()
                    .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
                let auth = guard
                    .as_mut()
                    .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
                auth.mark_download_artifact_committed(
                    &reservation,
                    installed_identity,
                    installed_ctime_nanos,
                )?;
                auth.prepare_download_artifact(&reservation)?
            };
            let verified = prepared.verify()?;
            let mut guard = authority
                .lock()
                .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
            let auth = guard
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
            auth.commit_download_artifact(verified)
        })
        .await
}

fn sha256_open_file(
    file: &mut fs::File,
    #[cfg(test)] observer: Option<&Arc<dyn ActivationObserver + Send + Sync>>,
) -> Result<(u64, String), Error> {
    let mut hasher = Sha256::new();
    let mut size = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        #[cfg(test)]
        if let Some(observer) = observer {
            observer.observe(ActivationObserverStage::BeforeRead);
        }
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        size = size.checked_add(read as u64).ok_or_else(|| {
            Error::ResourceLimit("artifact payload exceeds supported size".into())
        })?;
        hasher.update(&buffer[..read]);
    }
    Ok((size, format!("{:x}", hasher.finalize())))
}

/// Change stamp paired with the opaque file identity. It is never a standalone authority check:
/// Unix uses inode ctime; Windows uses the handle's last-write FILETIME. Platforms without a
/// stable handle timestamp reject post-rename marker publication rather than making a claim.
fn opened_file_change_stamp(file: &fs::File) -> Result<i128, Error> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let metadata = file.metadata()?;
        return Ok(i128::from(metadata.ctime()) * 1_000_000_000 + i128::from(metadata.ctime_nsec()));
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        return Ok(i128::from(file.metadata()?.last_write_time()));
    }
    #[allow(unreachable_code)]
    Err(crate::infra::platform_support::unsupported_plural(
        "post-rename marker timestamps",
    ))
}
/// Stable identity for any already-opened object. This intentionally exposes no path and
/// uses the Windows handle index instead of lossy metadata fallbacks.
pub(crate) fn opened_file_identity(file: &fs::File) -> Result<(u64, u64), Error> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let meta = file.metadata()?;
        Ok((meta.dev(), meta.ino()))
    }
    #[cfg(windows)]
    {
        let identity = windows_file_identity(file)?;
        Ok((identity.a, identity.b))
    }
}
#[cfg(not(windows))]
pub(crate) fn is_reparse_point(_: &fs::Metadata) -> bool {
    false
}
#[cfg(windows)]
pub(crate) fn is_reparse_point(meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    meta.file_attributes() & windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT
        != 0
}
#[cfg(windows)]
fn windows_identity(path: &Path) -> Result<Identity, Error> {
    let file = open_windows_nofollow(path, false)?;
    windows_file_identity(&file)
}
#[cfg(windows)]
pub(crate) fn windows_file_identity(file: &fs::File) -> Result<Identity, Error> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::GetFileInformationByHandle;
    let mut info = unsafe { std::mem::zeroed() };
    if unsafe { GetFileInformationByHandle(file.as_raw_handle() as _, &mut info) } == 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(Identity {
        a: info.dwVolumeSerialNumber as u64,
        b: ((info.nFileIndexHigh as u64) << 32) | info.nFileIndexLow as u64,
    })
}

#[cfg(windows)]
pub(crate) fn windows_open_status_error(status: i32) -> Error {
    use windows_sys::Win32::Foundation::{
        RtlNtStatusToDosError, ERROR_FILE_NOT_FOUND, ERROR_PATH_NOT_FOUND, STATUS_NO_SUCH_FILE,
        STATUS_OBJECT_NAME_COLLISION, STATUS_OBJECT_NAME_NOT_FOUND, STATUS_OBJECT_PATH_NOT_FOUND,
        STATUS_SHARING_VIOLATION,
    };

    match status {
        STATUS_OBJECT_NAME_NOT_FOUND | STATUS_NO_SUCH_FILE => Error::Io(Box::new(
            std::io::Error::from_raw_os_error(ERROR_FILE_NOT_FOUND as i32),
        )),
        STATUS_OBJECT_PATH_NOT_FOUND => Error::Io(Box::new(std::io::Error::from_raw_os_error(
            ERROR_PATH_NOT_FOUND as i32,
        ))),
        STATUS_OBJECT_NAME_COLLISION => Error::Conflict("Windows object name collision".into()),
        STATUS_SHARING_VIOLATION => Error::Conflict("Windows sharing violation".into()),
        _ => {
            let error = unsafe { RtlNtStatusToDosError(status) };
            Error::Io(Box::new(std::io::Error::from_raw_os_error(error as i32)))
        }
    }
}

/// Opens one child relative to an already-opened directory with `NtCreateFile`. The child name
/// is a single component and the OS resolves it below `RootDirectory`; mutable ancestor strings
/// are never concatenated or reopened during traversal.
#[cfg(windows)]
pub(crate) fn open_windows_child(
    dir: &fs::File,
    name: &OsStr,
    disposition: u32,
    access: u32,
    security_descriptor: *const windows_sys::Win32::Security::SECURITY_DESCRIPTOR,
    directory: bool,
    allow_delete_share: bool,
) -> Result<fs::File, Error> {
    use std::{
        mem::{size_of, zeroed},
        os::windows::{
            ffi::OsStrExt,
            io::{AsRawHandle, FromRawHandle, RawHandle},
        },
        ptr::null_mut,
    };
    use windows_sys::{
        Wdk::{Foundation::OBJECT_ATTRIBUTES, Storage::FileSystem::NtCreateFile},
        Win32::{
            Foundation::{HANDLE, UNICODE_STRING},
            Storage::FileSystem::{FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE},
            System::IO::IO_STATUS_BLOCK,
        },
    };
    const OBJ_CASE_INSENSITIVE: u32 = 0x40;
    const OBJ_DONT_REPARSE: u32 = 0x1000;
    const FILE_DIRECTORY_FILE: u32 = 0x1;
    const FILE_NON_DIRECTORY_FILE: u32 = 0x40;
    const FILE_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
    // Without this the I/O manager keeps no `CurrentByteOffset` on the returned file object:
    // every `ReadFile`/`WriteFile` with a NULL `lpOverlapped` — which is what `File::read` and
    // `File::write` always issue — fails with `STATUS_INVALID_PARAMETER`, and
    // `NtQueryDirectoryFile` may complete asynchronously with `STATUS_PENDING`. `SYNCHRONIZE` in
    // the access mask does not imply it; only the create option does. Every call site's mask
    // carries `SYNCHRONIZE`, which this option requires.
    const FILE_SYNCHRONOUS_IO_NONALERT: u32 = 0x20;
    crate::infra::fs::single_leaf(name)?;
    let mut wide: Vec<u16> = name.encode_wide().collect();
    let (length, maximum_length) = unicode_string_lengths(wide.len()).ok_or_else(|| {
        Error::InvalidInput("Windows path component exceeds the UNICODE_STRING limit".into())
    })?;
    let mut unicode = UNICODE_STRING {
        Length: length,
        MaximumLength: maximum_length,
        Buffer: wide.as_mut_ptr(),
    };
    let attributes = OBJECT_ATTRIBUTES {
        Length: size_of::<OBJECT_ATTRIBUTES>() as u32,
        RootDirectory: dir.as_raw_handle() as _,
        ObjectName: &mut unicode,
        Attributes: OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
        SecurityDescriptor: security_descriptor,
        SecurityQualityOfService: null_mut(),
    };
    let mut handle: HANDLE = null_mut();
    let mut status: IO_STATUS_BLOCK = unsafe { zeroed() };
    let options = FILE_OPEN_REPARSE_POINT
        | FILE_SYNCHRONOUS_IO_NONALERT
        | if directory {
            FILE_DIRECTORY_FILE
        } else {
            FILE_NON_DIRECTORY_FILE
        };
    let result = unsafe {
        NtCreateFile(
            &mut handle,
            access,
            &attributes,
            &mut status,
            null_mut(),
            0,
            FILE_SHARE_READ
                | FILE_SHARE_WRITE
                | if allow_delete_share {
                    FILE_SHARE_DELETE
                } else {
                    0
                },
            disposition,
            options,
            null_mut(),
            0,
        )
    };
    if result != 0 {
        return Err(windows_open_status_error(result));
    }
    let file = unsafe { fs::File::from_raw_handle(handle as RawHandle) };
    if is_reparse_point(&file.metadata()?) {
        return Err(Error::InvalidInput(
            "reparse points cannot be authorized".into(),
        ));
    }
    Ok(file)
}

#[cfg(any(windows, test))]
pub(crate) fn allows_delete_sharing_for_operation(
    operation: PathOperation,
    is_final_leaf: bool,
) -> bool {
    !is_final_leaf
        || !matches!(
            operation,
            PathOperation::EngineExecute | PathOperation::EngineConfigure
        )
}
#[cfg(windows)]
fn open_windows_nofollow(path: &Path, writable: bool) -> Result<fs::File, Error> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ, FILE_SHARE_WRITE,
    };
    let mut options = fs::OpenOptions::new();
    options
        .read(true)
        .write(writable)
        // Keep the opened authorized executable/file from being replaced until
        // a caller that relies on this descriptor has finished its operation.
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS);
    let file = options.open(path)?;
    if is_reparse_point(&file.metadata()?) {
        return Err(Error::InvalidInput(
            "reparse points cannot be authorized".into(),
        ));
    }
    Ok(file)
}
fn class_is_root(class: PathClass) -> bool {
    matches!(
        class,
        PathClass::AppOwnedRoot | PathClass::PersistentCustomRoot
    )
}
fn validate_target(path: &Path, class: PathClass) -> Result<Identity, Error> {
    let meta = fs::symlink_metadata(path)?;
    if meta.file_type().is_symlink() {
        return Err(Error::InvalidInput(
            "symbolic links cannot be authorized".into(),
        ));
    }
    if class_is_root(class) {
        if !meta.is_dir() {
            return Err(Error::InvalidInput(
                "root authority must be a directory".into(),
            ));
        }
    } else if !meta.is_file() {
        return Err(Error::InvalidInput(
            "file authority must be a regular file".into(),
        ));
    }
    identity(path)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AcquireShape {
    Dialog { parent_access: ParentAccess },
    File { parent_access: ParentAccess },
    Root { parent_access: ParentAccess },
}

impl AcquireShape {
    fn for_persistent_class(class: PathClass, parent_access: ParentAccess) -> Self {
        if class == PathClass::PersistentCustomRoot {
            Self::Root { parent_access }
        } else {
            Self::File { parent_access }
        }
    }

    fn parent_access(self) -> ParentAccess {
        match self {
            Self::Dialog { parent_access }
            | Self::File { parent_access }
            | Self::Root { parent_access } => parent_access,
        }
    }
}

/// A path with a normal leaf stores the proven canonical `(path, identity)` pair and its retained
/// parent/leaf descriptor. Leafless paths keep the caller's spelling and carry no descriptor.
/// `parent_and_leaf` is the proving descriptor consumed by `database_file_target`/`for_test_path`
/// and dropped by registration doors, whose later use re-walks the stored path no-follow. The PGN
/// export door keeps its own proving parent and passes `None`.
struct AcquiredTarget {
    path: PathBuf,
    identity: Identity,
    target_is_dir: bool,
    parent_and_leaf: Option<(fs::File, OsString)>,
}

fn acquire_target(path: &Path, shape: AcquireShape) -> Result<AcquiredTarget, Error> {
    #[cfg(all(test, unix))]
    ACQUIRE_TARGET_CALLS.with(|calls| calls.set(calls.get().saturating_add(1)));

    let parent_access = shape.parent_access();
    let (identity, target_is_dir) = match shape {
        AcquireShape::Dialog { .. } => {
            let meta = fs::symlink_metadata(path)?;
            if meta.file_type().is_symlink() || (!meta.is_file() && !meta.is_dir()) {
                return Err(Error::InvalidInput(
                    "dialog selection must be a regular file or directory".into(),
                ));
            }
            (identity(path)?, meta.is_dir())
        }
        AcquireShape::File { .. } => (validate_target(path, PathClass::PersistentFile)?, false),
        AcquireShape::Root { .. } => (
            validate_target(path, PathClass::PersistentCustomRoot)?,
            true,
        ),
    };

    if !has_normal_leaf(path) {
        return Ok(AcquiredTarget {
            path: path.to_path_buf(),
            identity,
            target_is_dir,
            parent_and_leaf: None,
        });
    };

    #[cfg(unix)]
    {
        let canonical = canonical_binding(path)?;
        #[cfg(test)]
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        let parent_and_leaf = crate::infra::fs::open_verified_parent(
            &canonical,
            (identity.a, identity.b),
            target_is_dir,
            parent_access,
        )?;
        Ok(AcquiredTarget {
            path: canonical,
            identity,
            target_is_dir,
            parent_and_leaf: Some(parent_and_leaf),
        })
    }

    #[cfg(windows)]
    {
        let canonical = canonical_binding(path)?;
        let parent_and_leaf = crate::infra::fs::open_verified_parent(
            &canonical,
            (identity.a, identity.b),
            target_is_dir,
            parent_access,
        )?;
        Ok(AcquiredTarget {
            path: canonical,
            identity,
            target_is_dir,
            parent_and_leaf: Some(parent_and_leaf),
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct StoredEntry {
    id: PathRef,
    display_name: String,
    class: PathClass,
    operations: Vec<PathOperation>,
    path: NativePath,
    identity: Identity,
    #[serde(default)]
    target_is_dir: bool,
    #[serde(default)]
    purpose: Option<EntryPurpose>,
}
#[derive(Serialize, Deserialize)]
struct Registry {
    schema_version: u32,
    entries: Vec<StoredEntry>,
    #[serde(default)]
    active_database_root: Option<PathRef>,
    #[serde(default)]
    active_puzzle_root: Option<PathRef>,
    #[serde(default)]
    active_engine_root: Option<PathRef>,
    #[serde(default)]
    pending_artifacts: Vec<PendingArtifact>,
    /// Attachment IDs issued in this or a prior session but not yet durably adopted by renderer
    /// storage. Missing lifecycle metadata is deliberately interpreted as owned legacy state.
    #[serde(default)]
    provisional_attachments: BTreeSet<String>,
    /// Retired managed images remain here until identity-checked cleanup completes. These are not
    /// authority entries and therefore cannot resolve after restart.
    #[serde(default)]
    image_cleanup: Vec<StoredEntry>,
}
/// Durable intent recorded before an atomic download replacement. It lets a restarted authority
/// either activate the newly installed exact file or discard an intent whose replacement never
/// happened; neither state exposes a native path to the renderer.
#[derive(Clone, Serialize, Deserialize)]
struct PendingArtifact {
    id: PathRef,
    root: PathRef,
    filename: NativePath,
    display_name: String,
    operations: Vec<PathOperation>,
    baseline: Option<Identity>,
    /// The target root and exact staged bytes are part of the durable intent.
    /// Recovery never infers publication from an inode merely differing from baseline.
    #[serde(default)]
    root_identity: Option<Identity>,
    #[serde(default)]
    payload_size: u64,
    #[serde(default)]
    payload_sha256: String,
    #[serde(default)]
    payload_bound: bool,
    /// Written durably only after `renameat` and verified through a no-follow FD. This prevents
    /// a byte-identical outsider replacement from satisfying a merely content-based recovery.
    #[serde(default)]
    installed_identity: Option<Identity>,
    #[serde(default)]
    installed_ctime_nanos: Option<i128>,
}
#[derive(Clone, PartialEq, Eq)]
struct Entry {
    stored: StoredEntry,
    availability: PathAvailability,
}

type CompleteWorkspacePruneCandidate = (
    BTreeMap<String, Entry>,
    Vec<PendingArtifact>,
    BTreeSet<String>,
);
#[derive(Clone)]
struct DialogGrant {
    entry: Entry,
    expires_at: SystemTime,
    uses_left: u32,
    inserted_at: u64,
}

fn is_write_operation(op: PathOperation) -> bool {
    matches!(
        op,
        PathOperation::WritePgn
            | PathOperation::DatabaseMutate
            | PathOperation::DatabaseCreate
            | PathOperation::DatabaseExport
            | PathOperation::PuzzleDelete
            | PathOperation::EngineInstall
            | PathOperation::SnapshotWrite
            | PathOperation::LogWrite
    )
}

fn allows_missing_leaf(op: PathOperation) -> bool {
    match op {
        PathOperation::ReadPgn
        | PathOperation::WritePgn
        | PathOperation::DatabaseRead
        | PathOperation::DatabaseMutate
        | PathOperation::DatabaseCreate
        | PathOperation::DatabaseExport
        | PathOperation::PuzzleRead
        | PathOperation::PuzzleDelete
        | PathOperation::EngineExecute
        | PathOperation::EngineConfigure
        | PathOperation::EngineBinaryInspect
        | PathOperation::EngineResourceRead
        | PathOperation::OpeningBookRead
        | PathOperation::ImageRead
        | PathOperation::EngineInstall
        | PathOperation::SnapshotWrite
        | PathOperation::LogWrite
        | PathOperation::OpenShell => false,
        PathOperation::DownloadFile | PathOperation::DownloadArchive => true,
    }
}

pub(crate) fn parent_access_for_operations(operations: &[PathOperation]) -> ParentAccess {
    if operations
        .iter()
        .copied()
        .any(|operation| is_write_operation(operation) || allows_missing_leaf(operation))
    {
        ParentAccess::Writable
    } else {
        ParentAccess::Readable
    }
}

/// Counts complete blocking image issuances so shutdown cannot clean up before they settle.
pub(crate) struct ActiveImageIssuances {
    active: AtomicUsize,
    notify: Notify,
}

impl ActiveImageIssuances {
    fn new() -> Self {
        Self {
            active: AtomicUsize::new(0),
            notify: Notify::new(),
        }
    }

    pub(crate) async fn wait_for_zero(&self) {
        loop {
            // Arm the notification before observing the count. Otherwise a release between
            // the check and `notified().await` can leave shutdown asleep forever.
            let notified = self.notify.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            if self.active.load(Ordering::Acquire) == 0 {
                return;
            }
            notified.await;
        }
    }
}

pub(crate) struct ActiveImageIssuanceLease {
    tracker: Arc<ActiveImageIssuances>,
}

impl Drop for ActiveImageIssuanceLease {
    fn drop(&mut self) {
        self.tracker.active.fetch_sub(1, Ordering::AcqRel);
        self.tracker.notify.notify_waiters();
    }
}

#[derive(Clone)]
struct RegistryAdmissionSnapshot {
    bytes: usize,
    serialized: Vec<u8>,
    unique_ids: usize,
    pending_count: usize,
}

/// Backend-only authority registry. Its public methods never parse renderer-provided raw paths.
pub struct PathAuthority {
    registry_path: PathBuf,
    app_data_dir: Option<AppDataDir>,
    persistent: BTreeMap<String, Entry>,
    dialogs: HashMap<String, DialogGrant>,
    clock: Arc<dyn Clock>,
    dialog_capacity: usize,
    next_insertion: u64,
    active_database_root: Option<PathRef>,
    active_puzzle_root: Option<PathRef>,
    active_engine_root: Option<PathRef>,
    pending_artifacts: Vec<PendingArtifact>,
    pending_unpersisted_removals: BTreeSet<String>,
    loaded_candidate_ids: BTreeSet<String>,
    session_protected_ids: BTreeSet<String>,
    completed_owner_families: BTreeSet<PathOwnerFamily>,
    startup_retained_ids: BTreeSet<String>,
    startup_unowned_roots_reconciled: bool,
    provisional_attachments: BTreeSet<String>,
    retired_attachments: BTreeMap<String, Entry>,
    image_cleanup: BTreeMap<String, StoredEntry>,
    attachments_sealed: bool,
    registry_durability_pending: bool,
    active_image_issuances: Arc<ActiveImageIssuances>,
    #[cfg(test)]
    activation_observer: Option<Arc<dyn ActivationObserver + Send + Sync>>,
    #[cfg(target_os = "macos")]
    engine_launch_root: Option<EngineLaunchRoot>,
}
fn validate_components(components: &[OsString]) -> Result<(), Error> {
    for name in components {
        let component = name.as_os_str();
        if cfg!(windows) {
            if let Some(reason) = windows_component_refusal(component) {
                return Err(Error::InvalidInput(reason.into()));
            }
        }
        if component.is_empty()
            || component == OsStr::new(".")
            || component == OsStr::new("..")
            || Path::new(component).components().count() != 1
        {
            return Err(Error::InvalidInput(
                "invalid relative path component".into(),
            ));
        }
        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStrExt;
            if component.as_bytes().contains(&b'/') || component.as_bytes().contains(&0) {
                return Err(Error::InvalidInput(
                    "path component contains a separator or NUL".into(),
                ));
            }
        }
    }
    Ok(())
}

pub(crate) fn workspace_sidecar_leaf(leaf: &OsStr) -> Result<OsString, Error> {
    let stem = Path::new(leaf)
        .file_stem()
        .ok_or_else(|| Error::InvalidInput("PGN has no filename".into()))?;
    Ok(OsString::from(format!("{}.info", stem.to_string_lossy())))
}

#[cfg(target_os = "macos")]
type LaunchRootArgument = Option<EngineLaunchRoot>;
#[cfg(not(target_os = "macos"))]
type LaunchRootArgument = ();

impl PathAuthority {
    #[cfg(all(test, unix))]
    pub(crate) fn persistent_snapshot_for_test(&self) -> Vec<(String, (u64, u64), bool)> {
        let mut snapshot = self
            .persistent
            .values()
            .map(|entry| {
                (
                    entry.stored.display_name.clone(),
                    (entry.stored.identity.a, entry.stored.identity.b),
                    entry.stored.target_is_dir,
                )
            })
            .collect::<Vec<_>>();
        snapshot.sort();
        snapshot
    }

    /// Resolves an authorized directory for descriptor-relative enumeration. Database and puzzle
    /// listings share the same retained-directory walk as the PGN workspace listing.
    pub(crate) fn capability_directory(
        &mut self,
        id: &PathRef,
        operation: PathOperation,
    ) -> Result<CapabilityDirectory, Error> {
        let mut resolved = self.resolve(id, operation, &[])?;
        let directory = resolved
            .take_directory()
            .ok_or_else(|| Error::InvalidInput("path capability is not a directory".into()))?;
        Ok(CapabilityDirectory { directory })
    }

    /// Windows counterpart of the unix arm below, keeping its split exactly: an **existing**
    /// regular file is identity-checked and its bytes are left untouched, and only a **missing**
    /// one is created exclusively. It deliberately does not route through
    /// `atomic_replace_at_identified` — the unix arm does not either, and replacing here would
    /// destroy the very file the caller selected, before a single game had been written.
    #[cfg(windows)]
    pub(crate) fn create_pgn_export_destination(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<FileWorkspaceDescriptor, Error> {
        if matches!(
            path.as_os_str().as_encoded_bytes().last(),
            Some(b'/') | Some(b'\\')
        ) {
            return Err(Error::InvalidInput(
                "PGN export destination must have a .pgn filename".into(),
            ));
        }
        let extension_is_pgn = path
            .extension()
            .and_then(OsStr::to_str)
            .is_some_and(|extension| extension.eq_ignore_ascii_case("pgn"));
        if !extension_is_pgn || path.file_stem().is_none_or(|stem| stem.is_empty()) {
            return Err(Error::InvalidInput(
                "PGN export destination must have a .pgn filename".into(),
            ));
        }

        // The parent observed here is the one the identity check below pins the canonicalized
        // open against, so a swap between the two is a `Conflict` rather than a create in a
        // directory the caller never chose. Canonicalization on its own is not that pin.
        let parent_probe = open_windows_nofollow(parent_of(path), false)?;
        if !parent_probe.metadata()?.is_dir() {
            return Err(Error::InvalidInput(
                "PGN export destination parent must be a directory".into(),
            ));
        }
        let parent_identity = opened_file_identity(&parent_probe)?;
        drop(parent_probe);
        #[cfg(test)]
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        let canonical = canonical_binding(path)?;
        // A0: the parent is opened writable, because the create below flushes it.
        let parent = crate::infra::fs::open_parent_no_follow(&canonical)?;
        if opened_file_identity(&parent)? != parent_identity {
            return Err(Error::Conflict(
                "PGN export destination changed before creation".into(),
            ));
        }
        let leaf = canonical
            .file_name()
            .filter(|name| !name.is_empty())
            .ok_or_else(|| {
                Error::InvalidInput("PGN export destination must have a .pgn filename".into())
            })?
            .to_os_string();

        let mut created_identity = None;
        let display_name = display_name.into();
        let operations = canonical_operations(EntryPurpose::PgnFile);
        let result = (|| {
            let identity = match crate::infra::fs::entry_identity_at(&parent, &leaf, false) {
                Ok(identity) => identity,
                Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => {
                    let (file, identity) = crate::infra::fs::create_regular_at(&parent, &leaf)?;
                    created_identity = Some(identity);
                    file.sync_all()?;
                    parent.sync_all()?;
                    #[cfg(test)]
                    PGN_EXPORT_POST_CREATE_HOOK.with(|slot| {
                        if let Some(hook) = slot.borrow_mut().take() {
                            hook();
                        }
                    });
                    identity
                }
                Err(Error::InvalidInput(_)) => {
                    return Err(Error::InvalidInput(
                        "PGN export destination must be a regular file".into(),
                    ))
                }
                Err(error) => return Err(error),
            };
            let grant = self.grant_acquired(
                AcquiredTarget {
                    path: canonical.clone(),
                    identity: Identity {
                        a: identity.0,
                        b: identity.1,
                    },
                    target_is_dir: false,
                    parent_and_leaf: None,
                },
                display_name.clone(),
                PathClass::BoundedDialogGrant,
                operations.clone(),
                Duration::from_secs(30 * 60),
                128,
            )?;
            let commit = self.promote_dialog(
                &grant,
                PathClass::PersistentFile,
                display_name.clone(),
                operations,
            )?;
            require_durable(commit.durability)?;
            Ok(FileWorkspaceDescriptor {
                handle: FileWorkspaceHandle::new(commit.id),
                display_name,
                availability: PathAvailability::Available,
            })
        })();

        if result
            .as_ref()
            .is_err_and(|error| !matches!(error, Error::CommittedDurabilityUncertain(_)))
        {
            if let Some(identity) = created_identity {
                let _ = crate::infra::fs::remove_entry_at(&parent, &leaf, identity, false);
            }
        }
        result
    }

    /// Turns a native save-dialog choice into one persistent, exact PGN destination. The renderer
    /// receives only the resulting workspace handle; the selected native path never leaves this
    /// authority boundary. A new target is materialized before the dialog grant is promoted so
    /// the persisted identity is the object the subsequent atomic PGN write must replace.
    #[cfg(unix)]
    pub(crate) fn create_pgn_export_destination(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<FileWorkspaceDescriptor, Error> {
        use rustix::fs::{self as rfs, AtFlags, FileType};
        use std::os::unix::{ffi::OsStrExt, fs::MetadataExt};

        if path.as_os_str().as_bytes().last() == Some(&b'/') {
            return Err(Error::InvalidInput(
                "PGN export destination must have a .pgn filename".into(),
            ));
        }
        let extension_is_pgn = path
            .extension()
            .and_then(OsStr::to_str)
            .is_some_and(|extension| extension.eq_ignore_ascii_case("pgn"));
        if !extension_is_pgn || path.file_stem().is_none_or(|stem| stem.is_empty()) {
            return Err(Error::InvalidInput(
                "PGN export destination must have a .pgn filename".into(),
            ));
        }

        let parent_path = parent_of(path);
        let parent_metadata = fs::metadata(parent_path)?;
        if !parent_metadata.is_dir() {
            return Err(Error::InvalidInput(
                "PGN export destination parent must be a directory".into(),
            ));
        }
        let parent_identity = (parent_metadata.dev(), parent_metadata.ino());
        #[cfg(test)]
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        let canonical = canonical_binding(path)?;
        let parent = crate::infra::fs::open_parent_no_follow(&canonical)?;
        if opened_file_identity(&parent)? != parent_identity {
            return Err(Error::Conflict(
                "PGN export destination changed before creation".into(),
            ));
        }
        let leaf = canonical
            .file_name()
            .filter(|name| !name.is_empty())
            .ok_or_else(|| {
                Error::InvalidInput("PGN export destination must have a .pgn filename".into())
            })?
            .to_os_string();

        let mut created_identity = None;
        let display_name = display_name.into();
        let operations = canonical_operations(EntryPurpose::PgnFile);
        let result = (|| {
            let identity = match rfs::statat(&parent, &leaf, AtFlags::SYMLINK_NOFOLLOW) {
                Ok(stat) => {
                    if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
                        return Err(Error::InvalidInput(
                            "PGN export destination must be a regular file".into(),
                        ));
                    }
                    crate::infra::fs::raw_stat_identity(&stat)
                }
                Err(error) if error == rustix::io::Errno::NOENT => {
                    let (file, identity) = crate::infra::fs::create_regular_at(&parent, &leaf)?;
                    created_identity = Some(identity);
                    file.sync_all()?;
                    parent.sync_all()?;
                    #[cfg(test)]
                    PGN_EXPORT_POST_CREATE_HOOK.with(|slot| {
                        if let Some(hook) = slot.borrow_mut().take() {
                            hook();
                        }
                    });
                    identity
                }
                Err(error) => return Err(Error::Io(Box::new(error.into()))),
            };
            let grant = self.grant_acquired(
                AcquiredTarget {
                    path: canonical.clone(),
                    identity: Identity {
                        a: identity.0,
                        b: identity.1,
                    },
                    target_is_dir: false,
                    parent_and_leaf: None,
                },
                display_name.clone(),
                PathClass::BoundedDialogGrant,
                operations.clone(),
                Duration::from_secs(30 * 60),
                128,
            )?;
            let commit = self.promote_dialog(
                &grant,
                PathClass::PersistentFile,
                display_name.clone(),
                operations,
            )?;
            require_durable(commit.durability)?;
            Ok(FileWorkspaceDescriptor {
                handle: FileWorkspaceHandle::new(commit.id),
                display_name,
                availability: PathAvailability::Available,
            })
        })();

        if result
            .as_ref()
            .is_err_and(|error| !matches!(error, Error::CommittedDurabilityUncertain(_)))
        {
            if let Some(identity) = created_identity {
                let _ = crate::infra::fs::remove_entry_at(&parent, &leaf, identity, false);
            }
        }
        result
    }

    #[cfg(any(test, not(target_os = "macos")))]
    pub fn open(registry_path: PathBuf, app_roots: Vec<AppOwnedRoot>) -> Result<Self, Error> {
        Self::open_with_clock(
            registry_path,
            app_roots,
            Arc::new(SystemClock),
            DEFAULT_DIALOG_CAPACITY,
        )
    }

    /// The production entry point: the application's own data directory is what tells the registry
    /// which stored spellings are deliberately raw, so startup supplies it here rather than
    /// assembling a clock and a capacity at the call site.
    pub(crate) fn open_for_app(
        registry_path: PathBuf,
        app_roots: Vec<AppOwnedRoot>,
        app_data_dir: AppDataDir,
        launch_root: LaunchRootArgument,
    ) -> Result<Self, Error> {
        Self::open_with_app_data(
            registry_path,
            app_roots,
            Some(app_data_dir),
            Arc::new(SystemClock),
            DEFAULT_DIALOG_CAPACITY,
            launch_root,
        )
    }

    /// Test-only since the startup branches moved to `open_for_app`: its remaining callers
    /// are the macOS engine-launch tests, so it is gated on them rather than carrying
    /// `allow(dead_code)` into the shipped binary.
    #[cfg(all(test, target_os = "macos"))]
    pub(crate) fn open_with_launch_root(
        registry_path: PathBuf,
        app_roots: Vec<AppOwnedRoot>,
        launch_root: EngineLaunchRoot,
    ) -> Result<Self, Error> {
        Self::open_with_app_data(
            registry_path,
            app_roots,
            None,
            Arc::new(SystemClock),
            DEFAULT_DIALOG_CAPACITY,
            Some(launch_root),
        )
    }

    #[cfg(any(test, not(target_os = "macos")))]
    pub fn open_with_clock(
        registry_path: PathBuf,
        app_roots: Vec<AppOwnedRoot>,
        clock: Arc<dyn Clock>,
        dialog_capacity: usize,
    ) -> Result<Self, Error> {
        Self::open_with_app_data(
            registry_path,
            app_roots,
            None,
            clock,
            dialog_capacity,
            #[cfg(target_os = "macos")]
            None,
            #[cfg(not(target_os = "macos"))]
            (),
        )
    }

    pub(crate) fn open_with_app_data(
        registry_path: PathBuf,
        app_roots: Vec<AppOwnedRoot>,
        app_data_dir: Option<AppDataDir>,
        clock: Arc<dyn Clock>,
        dialog_capacity: usize,
        _launch_root: LaunchRootArgument,
    ) -> Result<Self, Error> {
        if dialog_capacity == 0 {
            return Err(Error::InvalidInput(
                "dialog capacity must be at least one".into(),
            ));
        }
        let (
            mut persistent,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            provisional_attachments,
            image_cleanup,
        ) = if registry_path.exists() {
            let file = fs::File::open(&registry_path)?;
            let bytes = read_registry_bytes(file)?;
            let registry: Registry = serde_json::from_slice(&bytes)
                .map_err(|e| Error::InvalidInput(format!("invalid path registry: {e}")))?;
            if registry.schema_version != SCHEMA_VERSION {
                return Err(Error::InvalidInput(format!(
                    "unsupported path registry schema {}",
                    registry.schema_version
                )));
            }
            let image_cleanup_records = registry.image_cleanup;
            let provisional_attachments = registry.provisional_attachments.clone();
            let mut loaded = BTreeMap::new();
            for mut stored in registry.entries {
                validate_persisted_shape(&stored)?;
                let needs_purpose_backfill = stored.purpose.is_none();
                let legacy_engine_file_operations = [
                    PathOperation::EngineExecute,
                    PathOperation::EngineConfigure,
                    PathOperation::EngineInstall,
                ];
                if stored.class == PathClass::PersistentFile
                    && same_operation_set(&stored.operations, &legacy_engine_file_operations)
                {
                    // This exact, class-restricted backfill is idempotent, so the registry schema
                    // does not need to change. Engine roots are PersistentCustomRoot and must keep
                    // their exact operation vector for stable reuse across restarts.
                    stored.operations.push(PathOperation::EngineBinaryInspect);
                }
                if needs_purpose_backfill {
                    stored.purpose =
                        purpose_for_shape(stored.class, stored.target_is_dir, &stored.operations);
                }
                if needs_purpose_backfill {
                    if let Some(purpose) = stored.purpose {
                        stored.operations = canonical_operations(purpose);
                    }
                } else if stored.purpose == Some(EntryPurpose::EngineExecutable)
                    && same_operation_set(
                        &stored.operations,
                        &[
                            PathOperation::EngineExecute,
                            PathOperation::EngineConfigure,
                            PathOperation::EngineInstall,
                            PathOperation::EngineBinaryInspect,
                        ],
                    )
                {
                    // Explicitly tagged registries written during the engine-inspection
                    // transition may contain the historical install bit. Treat it as recognized
                    // history, but leave other purpose-tagged subsets for their issuer to upgrade.
                    stored.operations = canonical_operations(EntryPurpose::EngineExecutable);
                }
                let mut entry = Entry {
                    stored,
                    availability: PathAvailability::Unavailable,
                };
                refresh_entry(&mut entry, app_data_dir.as_ref());
                if loaded.insert(entry.stored.id.id.clone(), entry).is_some() {
                    return Err(Error::InvalidInput(
                        "duplicate path registry identifier".into(),
                    ));
                }
            }
            validate_loaded_attachment_metadata(
                &loaded,
                &provisional_attachments,
                &image_cleanup_records,
            )?;
            let image_cleanup = image_cleanup_records
                .into_iter()
                .map(|stored| (stored.id.id.clone(), stored))
                .collect();
            let active = registry.active_database_root.filter(|id| {
                loaded.get(&id.id).is_some_and(|entry| {
                    entry.stored.target_is_dir
                        && entry
                            .stored
                            .operations
                            .contains(&PathOperation::DatabaseRead)
                })
            });
            let active_puzzle_root = registry.active_puzzle_root.filter(|id| {
                loaded.get(&id.id).is_some_and(|entry| {
                    entry.stored.target_is_dir
                        && entry.stored.operations.contains(&PathOperation::PuzzleRead)
                })
            });
            let active_engine_root = registry.active_engine_root.filter(|id| {
                loaded.get(&id.id).is_some_and(|entry| {
                    entry.stored.target_is_dir
                        && entry
                            .stored
                            .operations
                            .contains(&PathOperation::EngineInstall)
                })
            });
            (
                loaded,
                active,
                active_puzzle_root,
                active_engine_root,
                registry.pending_artifacts,
                provisional_attachments,
                image_cleanup,
            )
        } else {
            (
                BTreeMap::new(),
                None,
                None,
                None,
                Vec::new(),
                BTreeSet::new(),
                BTreeMap::new(),
            )
        };
        let loaded_candidate_ids = persistent.keys().cloned().collect();
        for root in app_roots {
            fs::create_dir_all(&root.path)?;
            let stored = StoredEntry {
                id: root.id.clone(),
                display_name: root.display_name,
                class: PathClass::AppOwnedRoot,
                purpose: None,
                operations: root.operations,
                path: NativePath::from_path(&root.path),
                identity: validate_target(&root.path, PathClass::AppOwnedRoot)?,
                target_is_dir: true,
            };
            persistent.insert(
                stored.id.id.clone(),
                Entry {
                    stored,
                    availability: PathAvailability::Available,
                },
            );
        }
        let mut authority = Self {
            registry_path,
            app_data_dir,
            persistent,
            dialogs: HashMap::new(),
            clock,
            dialog_capacity,
            next_insertion: 0,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            pending_unpersisted_removals: BTreeSet::new(),
            loaded_candidate_ids,
            session_protected_ids: BTreeSet::new(),
            completed_owner_families: BTreeSet::new(),
            startup_retained_ids: BTreeSet::new(),
            startup_unowned_roots_reconciled: false,
            provisional_attachments,
            retired_attachments: BTreeMap::new(),
            image_cleanup,
            attachments_sealed: false,
            registry_durability_pending: false,
            active_image_issuances: Arc::new(ActiveImageIssuances::new()),
            #[cfg(test)]
            activation_observer: None,
            #[cfg(target_os = "macos")]
            engine_launch_root: _launch_root,
        };
        // Recovery validates pending roots by their stored spelling; repair legacy spellings
        // before it runs so a recovered artifact sees the same canonical root as the registry.
        authority.rebind_legacy_spellings();
        authority.recover_pending_artifacts()?;
        Ok(authority)
    }

    fn rebind_legacy_spellings(&mut self) {
        let ids: Vec<_> = self.persistent.keys().cloned().collect();
        let mut rebound_ids = Vec::new();

        for id in ids {
            let Some(entry) = self.persistent.get_mut(&id) else {
                continue;
            };
            if entry.stored.class == PathClass::AppOwnedRoot {
                continue;
            }
            let path = match entry.stored.path.to_path() {
                Ok(path) => path,
                Err(error) => {
                    entry.availability = PathAvailability::Unavailable;
                    log::warn!(
                        "legacy path rebinding skipped for entry {}: {}",
                        entry.stored.id.id,
                        error.category()
                    );
                    continue;
                }
            };
            if spelling_is_application_owned(self.app_data_dir.as_ref(), &path) {
                continue;
            }
            match classify_canonical_binding(&path) {
                CanonicalBindingStatus::Canonical | CanonicalBindingStatus::Leafless => continue,
                CanonicalBindingStatus::NeedsRebinding => {}
                CanonicalBindingStatus::Failed(error) => {
                    entry.availability = PathAvailability::Unavailable;
                    log::warn!(
                        "legacy path rebinding skipped for entry {} at {:?}: {}",
                        entry.stored.id.id,
                        path,
                        error.category()
                    );
                    continue;
                }
            };
            let shape = AcquireShape::for_persistent_class(
                entry.stored.class,
                parent_access_for_operations(&entry.stored.operations),
            );
            let acquired = match acquire_target(&path, shape) {
                Ok(acquired) => acquired,
                Err(error) => {
                    entry.availability = PathAvailability::Unavailable;
                    log::warn!(
                        "legacy path rebinding skipped for entry {} at {:?}: {}",
                        entry.stored.id.id,
                        path,
                        error.category()
                    );
                    continue;
                }
            };
            if acquired.identity != entry.stored.identity {
                entry.availability = PathAvailability::Unavailable;
                log::warn!(
                    "legacy path rebinding skipped for entry {} at {:?}: identity changed",
                    entry.stored.id.id,
                    path
                );
                continue;
            }
            entry.stored.path = NativePath::from_path(&acquired.path);
            entry.availability = PathAvailability::Available;
            rebound_ids.push(id);
        }

        if rebound_ids.is_empty() {
            return;
        }
        let durability = self.commit_registry(
            self.persistent.clone(),
            self.active_database_root.clone(),
            self.active_puzzle_root.clone(),
            self.active_engine_root.clone(),
            self.pending_artifacts.clone(),
            None,
            true,
        );
        if let Err(error) = durability {
            log::warn!(
                "legacy path rebinding could not be persisted for entries {:?}: {}",
                rebound_ids,
                error.category()
            );
        }
    }

    #[cfg(test)]
    pub(crate) fn set_activation_observer(
        &mut self,
        observer: Option<Arc<dyn ActivationObserver + Send + Sync>>,
    ) {
        self.activation_observer = observer;
    }
    #[cfg(test)]
    pub(crate) fn has_persistent_id(&self, id: &str) -> bool {
        self.persistent.contains_key(id)
    }
    #[cfg(test)]
    pub(crate) fn has_pending_artifact_filename(&self, filename: &std::path::Path) -> bool {
        self.pending_artifacts
            .iter()
            .any(|p| p.filename.to_path().is_ok_and(|path| path == filename))
    }
    #[cfg(test)]
    pub fn descriptors(&mut self) -> Vec<PathDescriptor> {
        self.evict_dialogs();
        self.refresh_persistent();
        for grant in self.dialogs.values_mut() {
            refresh_entry(&mut grant.entry, self.app_data_dir.as_ref());
        }
        self.persistent
            .values()
            .map(|e| descriptor(&e.stored, e.availability))
            .chain(
                self.dialogs
                    .values()
                    .map(|g| descriptor(&g.entry.stored, g.entry.availability)),
            )
            .collect()
    }

    /// Recovery authorizes only the exact content bound before publication. A missing, changed,
    /// legacy-unbound, or conflicting target remains quarantined as intent; it is never inferred
    /// from a baseline inode difference and commits are never retried.
    fn recover_pending_artifacts(&mut self) -> Result<(), Error> {
        let reservations: Vec<_> = self
            .pending_artifacts
            .iter()
            .map(|pending| PendingArtifactReservation {
                id: pending.id.clone(),
                payload_size: pending.payload_size,
                payload_sha256: pending.payload_sha256.clone(),
            })
            .collect();
        for reservation in reservations {
            let Some(pending) = self
                .pending_artifacts
                .iter()
                .find(|pending| pending.id == reservation.id)
                .cloned()
            else {
                continue;
            };
            let Some(root) = self.persistent.get(&pending.root.id) else {
                continue;
            };
            let root_path = match root.stored.path.to_path() {
                Ok(path) => path,
                Err(error) => {
                    log::warn!(
                        "pending artifact recovery skipped for root {}: {}",
                        root.stored.id.id,
                        error.category()
                    );
                    continue;
                }
            };
            let Ok(root_identity) = validate_target(&root_path, PathClass::PersistentCustomRoot)
            else {
                continue;
            };
            if !pending.payload_bound
                || pending.installed_identity.is_none()
                || pending.root_identity.as_ref() != Some(&root_identity)
            {
                continue;
            }
            // Activation resolves and hashes the no-follow opened file descriptor itself. A
            // mismatch is an expected quarantined state during restart, not an open failure.
            if let Err(error) = self.activate_download_artifact(&reservation) {
                let category = error.category();
                let reservation_id = &reservation.id.id;
                log::warn!(
                    "pending artifact recovery skipped for reservation {reservation_id}: {category}"
                );
            }
        }
        Ok(())
    }
    pub fn grant_dialog(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        class: PathClass,
        operation: PathOperation,
        ttl: Duration,
        uses_left: u32,
    ) -> Result<PathRef, Error> {
        self.grant_dialog_operations(path, display_name, class, vec![operation], ttl, uses_left)
    }

    fn check_dialog_grant_shape(
        class: PathClass,
        operations: &[PathOperation],
        uses_left: u32,
    ) -> Result<(), Error> {
        if !matches!(
            class,
            PathClass::SingleDialogGrant | PathClass::BoundedDialogGrant
        ) || (class == PathClass::SingleDialogGrant && uses_left != 1)
            || (class == PathClass::BoundedDialogGrant && uses_left == 0)
            || operations.is_empty()
        {
            return Err(Error::InvalidInput("invalid dialog grant shape".into()));
        }
        Ok(())
    }

    fn grant_acquired(
        &mut self,
        acquired: AcquiredTarget,
        display_name: String,
        class: PathClass,
        operations: Vec<PathOperation>,
        ttl: Duration,
        uses_left: u32,
    ) -> Result<PathRef, Error> {
        Self::check_dialog_grant_shape(class, &operations, uses_left)?;
        // Validate before evicting: malformed dialog input must not affect live grants.
        self.evict_dialogs();
        if self.dialogs.len() >= self.dialog_capacity {
            if let Some(oldest) = self
                .dialogs
                .iter()
                .min_by_key(|(_, g)| g.inserted_at)
                .map(|(id, _)| id.clone())
            {
                self.dialogs.remove(&oldest);
            }
        }
        let id = PathRef::fresh();
        self.next_insertion += 1;
        let stored = StoredEntry {
            id: id.clone(),
            display_name,
            class,
            purpose: None,
            operations,
            path: NativePath::from_path(&acquired.path),
            identity: acquired.identity,
            target_is_dir: acquired.target_is_dir,
        };
        self.dialogs.insert(
            id.id.clone(),
            DialogGrant {
                entry: Entry {
                    stored,
                    availability: PathAvailability::Available,
                },
                expires_at: self.clock.now() + ttl,
                uses_left,
                inserted_at: self.next_insertion,
            },
        );
        Ok(id)
    }

    pub fn grant_dialog_operations(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        class: PathClass,
        operations: Vec<PathOperation>,
        ttl: Duration,
        uses_left: u32,
    ) -> Result<PathRef, Error> {
        Self::check_dialog_grant_shape(class, &operations, uses_left)?;
        let acquired = acquire_target(
            path,
            AcquireShape::Dialog {
                parent_access: parent_access_for_operations(&operations),
            },
        )?;
        self.grant_acquired(
            acquired,
            display_name.into(),
            class,
            operations,
            ttl,
            uses_left,
        )
    }
    /// Consumes an exact live dialog grant and persists the same native object as a root or file.
    pub fn promote_dialog(
        &mut self,
        dialog: &PathRef,
        persistent_class: PathClass,
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
    ) -> Result<PathCommit, Error> {
        if !matches!(
            persistent_class,
            PathClass::PersistentCustomRoot | PathClass::PersistentFile
        ) {
            return Err(Error::InvalidInput(
                "promotion target must be persistent".into(),
            ));
        }
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "persistent operations cannot be empty".into(),
            ));
        }
        let target_is_dir = persistent_class == PathClass::PersistentCustomRoot;
        let purpose = purpose_for_shape(persistent_class, target_is_dir, &operations);
        if self.attachments_sealed && is_attachment_purpose(purpose) {
            return Err(Error::Conflict(
                "engine attachment mutations are sealed".into(),
            ));
        }
        let grant = self.dialogs.get(&dialog.id).cloned().ok_or_else(|| {
            Error::InvalidInput("unknown, revoked, or expired dialog grant".into())
        })?;
        self.dialogs.remove(&dialog.id);
        if grant.expires_at <= self.clock.now() {
            return Err(Error::InvalidInput(
                "unknown, revoked, or expired dialog grant".into(),
            ));
        }
        if operations
            .iter()
            .any(|op| !grant.entry.stored.operations.contains(op))
        {
            return Err(Error::InvalidInput(
                "promotion cannot escalate dialog operation authority".into(),
            ));
        }
        let path = grant.entry.stored.path.to_path()?;
        let shape = AcquireShape::for_persistent_class(
            persistent_class,
            parent_access_for_operations(&operations),
        );
        let acquired = acquire_target(&path, shape)?;
        if acquired.path != path || acquired.identity != grant.entry.stored.identity {
            return Err(Error::Conflict(
                "dialog target changed before promotion".into(),
            ));
        }
        let expected = acquired.identity.clone();
        if let Some(purpose) = purpose {
            if let Some(existing) = self.persistent.values().find(|entry| {
                entry.stored.class == persistent_class
                    && entry.stored.purpose == Some(purpose)
                    && entry.stored.path.to_path().ok().as_ref() == Some(&path)
            }) {
                if existing.stored.identity != expected {
                    return Err(Error::Conflict(
                        "persistent target changed; acquire a new capability".into(),
                    ));
                }
                let id = existing.stored.id.clone();
                let mut candidate = self.persistent.clone();
                if let Some(entry) = candidate.get_mut(&id.id) {
                    entry.stored.operations = canonical_operations(purpose);
                }
                let durability = self.commit_candidate(candidate, Some(dialog))?;
                self.session_protected_ids.insert(id.id.clone());
                return Ok(PathCommit { id, durability });
            }
        }
        let id = PathRef::fresh();
        let operations = purpose.map(canonical_operations).unwrap_or(operations);
        let stored = StoredEntry {
            id: id.clone(),
            display_name: display_name.into(),
            class: persistent_class,
            purpose,
            operations,
            path: NativePath::from_path(&acquired.path),
            identity: expected,
            target_is_dir,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        let provisional = matches!(
            purpose,
            Some(EntryPurpose::EngineResource | EntryPurpose::EngineImage)
        );
        if provisional {
            self.provisional_attachments.insert(id.id.clone());
        }
        let durability = match self.commit_candidate(candidate, Some(dialog)) {
            Ok(durability) => durability,
            Err(error) => {
                if provisional {
                    self.provisional_attachments.remove(&id.id);
                }
                return Err(error);
            }
        };
        self.session_protected_ids.insert(id.id.clone());
        Ok(PathCommit { id, durability })
    }
    /// One-time backend migration escape hatch. New operational code must use dialog promotion.
    pub fn migrate_legacy_os_path(
        &mut self,
        path: OsString,
        display_name: impl Into<String>,
        class: PathClass,
        operations: Vec<PathOperation>,
    ) -> Result<PathCommit, Error> {
        self.migrate_legacy_os_path_inner(path, display_name.into(), class, operations, None)
    }

    fn fresh_stored_entry(
        path: &Path,
        identity: Identity,
        display_name: String,
        class: PathClass,
        purpose: Option<EntryPurpose>,
        operations: Vec<PathOperation>,
        target_is_dir: bool,
    ) -> StoredEntry {
        StoredEntry {
            id: PathRef::fresh(),
            display_name,
            class,
            purpose,
            operations,
            path: NativePath::from_path(path),
            identity,
            target_is_dir,
        }
    }

    fn persist_entry(
        &mut self,
        path: &Path,
        identity: Identity,
        display_name: String,
        class: PathClass,
        operations: Vec<PathOperation>,
    ) -> Result<PathCommit, Error> {
        let target_is_dir = class == PathClass::PersistentCustomRoot;
        let purpose = purpose_for_shape(class, target_is_dir, &operations);
        let operations = purpose.map(canonical_operations).unwrap_or(operations);
        let stored = Self::fresh_stored_entry(
            path,
            identity,
            display_name,
            class,
            purpose,
            operations,
            target_is_dir,
        );
        self.persist_new_entry(stored)
    }

    fn registration_target(
        path: &Path,
        class: PathClass,
        operations: &[PathOperation],
        expected_identity: Option<VerifiedIdentity>,
    ) -> Result<(PathBuf, Identity), Error> {
        match expected_identity {
            None => {
                let shape = AcquireShape::for_persistent_class(
                    class,
                    parent_access_for_operations(operations),
                );
                let acquired = acquire_target(path, shape)?;
                Ok((acquired.path, acquired.identity))
            }
            Some(expected) => {
                let identity = validate_target(path, class)?;
                reject_disagreeing_expected_identity(&identity, Some(expected))?;
                Ok((path.to_path_buf(), identity))
            }
        }
    }

    fn migrate_legacy_os_path_inner(
        &mut self,
        path: OsString,
        display_name: String,
        class: PathClass,
        operations: Vec<PathOperation>,
        expected_identity: Option<VerifiedIdentity>,
    ) -> Result<PathCommit, Error> {
        if !matches!(
            class,
            PathClass::PersistentCustomRoot | PathClass::PersistentFile
        ) {
            return Err(Error::InvalidInput(
                "legacy migration must create persistent authority".into(),
            ));
        }
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "persistent operations cannot be empty".into(),
            ));
        }
        let path = PathBuf::from(path);
        let (path, identity) =
            Self::registration_target(&path, class, &operations, expected_identity)?;
        self.persist_entry(&path, identity, display_name, class, operations)
    }
    /// Registers a bundled/app-owned or picker-selected persistent file. A call without an
    /// expected identity acquires through `acquire_target`; Unix paths with normal leaves are
    /// canonicalised, while leafless paths and non-Unix paths retain their input spelling.
    /// Existing persistent entries retain their opaque ID across restarts; a replaced object is
    /// rejected rather than silently reusing the old capability.
    pub fn get_or_create_persistent_file(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
    ) -> Result<PathCommit, Error> {
        self.get_or_create_persistent_file_inner(path, display_name.into(), operations, None)
    }

    pub(crate) fn get_or_create_persistent_file_verified(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
        expected: VerifiedIdentity,
    ) -> Result<PathCommit, Error> {
        self.get_or_create_persistent_file_inner(
            path,
            display_name.into(),
            operations,
            Some(expected),
        )
    }

    fn get_or_create_persistent_file_inner(
        &mut self,
        path: &Path,
        display_name: String,
        operations: Vec<PathOperation>,
        expected_identity: Option<VerifiedIdentity>,
    ) -> Result<PathCommit, Error> {
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "persistent operations cannot be empty".into(),
            ));
        }
        let (path, expected) = Self::registration_target(
            path,
            PathClass::PersistentFile,
            &operations,
            expected_identity,
        )?;
        self.get_or_create_persistent_file_from_identity(&path, display_name, operations, expected)
    }

    /// Common storage body for native paths whose file identity has already been established.
    /// Callers must acquire `identity` from a checked pathname or retained descriptor boundary.
    fn get_or_create_persistent_file_from_identity(
        &mut self,
        path: &Path,
        display_name: String,
        operations: Vec<PathOperation>,
        identity: Identity,
    ) -> Result<PathCommit, Error> {
        let purpose = purpose_for_shape(PathClass::PersistentFile, false, &operations);
        let desired_operations = purpose
            .map(canonical_operations)
            .unwrap_or_else(|| operations.clone());
        if let Some(entry) = self.persistent.values().find(|entry| {
            entry.stored.class == PathClass::PersistentFile
                && match purpose {
                    Some(purpose) => entry.stored.purpose == Some(purpose),
                    None => entry.stored.purpose.is_none() && entry.stored.operations == operations,
                }
                && entry
                    .stored
                    .path
                    .to_path()
                    .is_ok_and(|stored_path| stored_path == path)
        }) {
            if entry.stored.identity != identity {
                return Err(Error::Conflict(
                    "persistent file changed; acquire a new capability".into(),
                ));
            }
            let id = entry.stored.id.clone();
            let needs_update = purpose.is_some() && entry.stored.operations != desired_operations;
            if needs_update {
                let mut candidate = self.persistent.clone();
                if let Some(candidate_entry) = candidate.get_mut(&id.id) {
                    candidate_entry.stored.operations = desired_operations.clone();
                }
                let durability = self.commit_candidate(candidate, None)?;
                self.session_protected_ids.insert(id.id.clone());
                return Ok(PathCommit { id, durability });
            }
            self.session_protected_ids.insert(id.id.clone());
            return Ok(PathCommit {
                id,
                durability: CommitDurability::Durable,
            });
        }
        let stored = Self::fresh_stored_entry(
            path,
            identity,
            display_name,
            PathClass::PersistentFile,
            purpose,
            desired_operations,
            false,
        );
        self.persist_new_entry(stored)
    }

    fn persist_new_entry(&mut self, stored: StoredEntry) -> Result<PathCommit, Error> {
        if self.attachments_sealed && is_attachment_purpose(stored.purpose) {
            return Err(Error::Conflict(
                "engine attachment mutations are sealed".into(),
            ));
        }
        let id = stored.id.clone();
        let provisional = matches!(
            stored.purpose,
            Some(EntryPurpose::EngineResource | EntryPurpose::EngineImage)
        );
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        if provisional {
            self.provisional_attachments.insert(id.id.clone());
        }
        let durability = match self.commit_candidate(candidate, None) {
            Ok(durability) => durability,
            Err(error) => {
                self.provisional_attachments.remove(&id.id);
                return Err(error);
            }
        };
        self.session_protected_ids.insert(id.id.clone());
        Ok(PathCommit { id, durability })
    }

    /// Creates a persistent database root from a native-only selected path.
    /// Re-opening the application or re-listing the root reuses its identifier
    /// rather than exposing the directory again to the renderer.
    pub(crate) fn get_or_create_database_root(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        expected_identity: Option<VerifiedIdentity>,
    ) -> Result<DatabaseRootHandle, Error> {
        Ok(DatabaseRootHandle::new(self.get_or_create_root(
            path,
            display_name,
            canonical_operations(EntryPurpose::DatabaseRoot),
            "database",
            expected_identity,
        )?))
    }

    /// Creates or reuses a persisted directory that contains exact puzzle
    /// databases. Its ID is stable across restarts; only backend discovery
    /// derives child IDs from the directory.
    pub(crate) fn get_or_create_puzzle_root(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        expected_identity: Option<VerifiedIdentity>,
    ) -> Result<PuzzleRootHandle, Error> {
        Ok(PuzzleRootHandle::new(self.get_or_create_root(
            path,
            display_name,
            canonical_operations(EntryPurpose::PuzzleRoot),
            "puzzle",
            expected_identity,
        )?))
    }

    pub(crate) fn get_or_create_engine_root(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        expected_identity: Option<VerifiedIdentity>,
    ) -> Result<EngineRootHandle, Error> {
        Ok(EngineRootHandle::new(self.get_or_create_root(
            path,
            display_name,
            canonical_operations(EntryPurpose::EngineRoot),
            "engine",
            expected_identity,
        )?))
    }

    /// The one registration body behind the three root methods above: reuse the
    /// persisted entry for this directory when its operations match, recover a
    /// replaced app-owned default root when its verified expected identity is
    /// current, refuse every other replacement, and otherwise register it.
    /// `changed_noun` names the root in that refusal, so each caller keeps
    /// telling the renderer which root to select again. A `None` expected
    /// identity always refuses a replaced directory; recovery is limited to a
    /// default caller whose expected token matches the live directory.
    fn get_or_create_root(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
        changed_noun: &str,
        expected_identity: Option<VerifiedIdentity>,
    ) -> Result<PathRef, Error> {
        let display_name = display_name.into();
        let purpose = purpose_for_shape(PathClass::PersistentCustomRoot, true, &operations);
        let (path, identity) = Self::registration_target(
            path,
            PathClass::PersistentCustomRoot,
            &operations,
            expected_identity,
        )?;
        if let Some(entry) = self
            .persistent
            .values()
            .find(|entry| {
                entry.stored.class == PathClass::PersistentCustomRoot
                    && entry.stored.target_is_dir
                    && match purpose {
                        Some(purpose) => entry.stored.purpose == Some(purpose),
                        None => {
                            entry.stored.purpose.is_none() && entry.stored.operations == operations
                        }
                    }
                    && entry
                        .stored
                        .path
                        .to_path()
                        .is_ok_and(|stored| stored == path)
            })
            .cloned()
        {
            if identity != entry.stored.identity {
                if expected_identity.is_some() {
                    let stale_root = entry.stored.id.clone();
                    let new_root = PathRef::fresh();
                    let (mut candidate, filtered_pending, mut filtered_provisional) =
                        Self::complete_workspace_prune_candidate(
                            &self.persistent,
                            &self.pending_artifacts,
                            &self.provisional_attachments,
                            &stale_root.id,
                        )?;
                    filtered_provisional
                        .retain(|id| !self.pending_unpersisted_removals.contains(id));
                    let stored = StoredEntry {
                        id: new_root.clone(),
                        display_name,
                        class: PathClass::PersistentCustomRoot,
                        purpose,
                        operations: purpose.map(canonical_operations).unwrap_or(operations),
                        path: NativePath::from_path(&path),
                        identity,
                        target_is_dir: true,
                    };
                    candidate.insert(
                        new_root.id.clone(),
                        Entry {
                            stored,
                            availability: PathAvailability::Available,
                        },
                    );

                    let old_provisional = self.provisional_attachments.clone();
                    self.provisional_attachments = filtered_provisional;
                    return match self.commit_candidate_with_pending(
                        candidate,
                        filtered_pending,
                        None,
                    ) {
                        Ok(_) => {
                            self.session_protected_ids.insert(new_root.id.clone());
                            Ok(new_root)
                        }
                        Err(error) => {
                            self.provisional_attachments = old_provisional;
                            Err(error)
                        }
                    };
                }
                return Err(Error::Conflict(format!(
                    "{changed_noun} root changed; select it again"
                )));
            }
            let id = entry.stored.id.clone();
            if let Some(purpose) = purpose {
                let canonical = canonical_operations(purpose);
                if entry.stored.operations != canonical {
                    let mut candidate = self.persistent.clone();
                    if let Some(candidate_entry) = candidate.get_mut(&id.id) {
                        candidate_entry.stored.operations = canonical;
                    }
                    require_durable(self.commit_candidate(candidate, None)?)?;
                }
            }
            self.session_protected_ids.insert(id.id.clone());
            return Ok(id);
        }
        let id = self
            .persist_entry(
                &path,
                identity,
                display_name,
                PathClass::PersistentCustomRoot,
                operations,
            )?
            .id;
        self.session_protected_ids.insert(id.id.clone());
        Ok(id)
    }

    /// Builds the recovery-only Complete prune candidate for a replaced root. Explicit workspace
    /// removal keeps its own Complete/Partial semantics and pending-removal bookkeeping.
    fn complete_workspace_prune_candidate(
        persistent: &BTreeMap<String, Entry>,
        pending_artifacts: &[PendingArtifact],
        provisional_attachments: &BTreeSet<String>,
        root_id: &str,
    ) -> Result<CompleteWorkspacePruneCandidate, Error> {
        let removed = persistent
            .get(root_id)
            .ok_or_else(|| Error::InvalidInput("workspace entry is not persistent".into()))?;
        let removed_path = removed.stored.path.to_path()?;
        let mut candidate = persistent.clone();
        candidate.remove(root_id);
        if removed.stored.target_is_dir {
            candidate.retain(|id, entry| {
                if id == root_id {
                    return false;
                }
                let Ok(path) = entry.stored.path.to_path() else {
                    return true;
                };
                let is_descendant =
                    path != removed_path && path.strip_prefix(&removed_path).is_ok();
                !is_descendant
            });
        }

        let removed_ids: BTreeSet<_> = persistent
            .keys()
            .filter(|id| !candidate.contains_key(*id))
            .cloned()
            .collect();
        let mut filtered_pending = pending_artifacts.to_vec();
        filtered_pending.retain(|pending| !removed_ids.contains(&pending.root.id));
        let filtered_provisional = provisional_attachments
            .iter()
            .filter(|id| candidate.contains_key(*id))
            .cloned()
            .collect();
        Ok((candidate, filtered_pending, filtered_provisional))
    }

    pub(crate) fn active_engine_root(&mut self) -> Result<Option<EngineRootHandle>, Error> {
        let Some(id) = self.active_engine_root.clone() else {
            return Ok(None);
        };
        self.refresh_persistent_id(&id);
        match self.persistent.get(&id.id) {
            Some(entry)
                if entry.availability == PathAvailability::Available
                    && entry.stored.target_is_dir
                    && entry
                        .stored
                        .operations
                        .contains(&PathOperation::EngineInstall) =>
            {
                Ok(Some(EngineRootHandle::new(id)))
            }
            _ => Ok(None),
        }
    }

    pub(crate) fn engine_root_path(&mut self, root: &EngineRootHandle) -> Result<PathBuf, Error> {
        self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::EngineInstall,
        )
    }

    pub(crate) fn set_active_engine_root(&mut self, root: &EngineRootHandle) -> Result<(), Error> {
        let _ = self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::EngineInstall,
        )?;
        let durability = self.commit_state(
            self.persistent.clone(),
            self.active_database_root.clone(),
            self.active_puzzle_root.clone(),
            Some(root.path_ref().clone()),
            self.pending_artifacts.clone(),
            None,
        )?;
        if let CommitDurability::DurabilityUncertain(stage) = durability {
            log::warn!("active engine root committed with uncertain durability: {stage}");
        }
        Ok(())
    }

    /// Registers one exact executable selected or installed natively. The renderer receives only
    /// its opaque handle; every later execution and probe revalidates this identity.
    pub(crate) fn register_engine_file(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<EngineHandle, Error> {
        let operations = engine_file_operations();
        let commit =
            self.get_or_create_persistent_file_inner(path, display_name.into(), operations, None)?;
        Ok(keep_adopted_handle(
            commit.durability,
            EngineHandle::new(commit.id),
        ))
    }

    fn register_engine_file_from_resolved(
        &mut self,
        path: &Path,
        display_name: String,
        identity: VerifiedIdentity,
    ) -> Result<EngineHandle, Error> {
        let operations = engine_file_operations();
        let pair = identity.pair();
        let commit = self.get_or_create_persistent_file_from_identity(
            path,
            display_name,
            operations,
            Identity {
                a: pair.0,
                b: pair.1,
            },
        )?;
        Ok(keep_adopted_handle(
            commit.durability,
            EngineHandle::new(commit.id),
        ))
    }

    /// Persists a picker-selected UCI resource with only resource-read
    /// authority.  Callers must hand us the one-time dialog grant; raw paths
    /// never cross the IPC boundary.
    pub(crate) fn promote_engine_resource(
        &mut self,
        grant: &PathRef,
        kind: EngineResourceHandleKind,
        display_name: impl Into<String>,
    ) -> Result<EngineResourceHandle, Error> {
        let display_name = display_name.into();
        let class = match kind {
            EngineResourceHandleKind::File => PathClass::PersistentFile,
            EngineResourceHandleKind::Directory => PathClass::PersistentCustomRoot,
        };
        let commit = self.promote_dialog(
            grant,
            class,
            display_name.clone(),
            canonical_operations(EntryPurpose::EngineResource),
        )?;
        Ok(keep_adopted_handle(
            commit.durability,
            EngineResourceHandle::new(commit.id, kind, display_name),
        ))
    }

    /// Resolves a UCI resource through no-follow traversal and returns a
    /// descriptor lease. The caller owns this object until the engine exits.
    pub(crate) fn engine_resource(
        &mut self,
        resource: &EngineResourceHandle,
    ) -> Result<EngineResourceLease, Error> {
        if resource.kind == EngineResourceHandleKind::Directory {
            crate::infra::platform_support::off_unix_refusal(
                "engine directory resources",
                cfg!(unix),
            )?;
        }
        #[cfg(all(test, unix))]
        observe_engine_resolution("resource");
        let mut resolved =
            self.resolve(resource.path_ref(), PathOperation::EngineResourceRead, &[])?;
        match resource.kind {
            EngineResourceHandleKind::File => {
                #[cfg(unix)]
                let file = resolved
                    .take_file()
                    .ok_or_else(|| Error::InvalidInput("engine resource must be a file".into()))?;
                #[cfg(windows)]
                let _file = resolved
                    .take_file()
                    .ok_or_else(|| Error::InvalidInput("engine resource must be a file".into()))?;
                #[cfg(unix)]
                return EngineResourceLease::from_file(file, false, None);
                #[cfg(windows)]
                Ok(EngineResourceLease {
                    _file,
                    target: resolved.take_target().ok_or_else(|| {
                        Error::Conflict("engine resource target is unavailable".into())
                    })?,
                })
            }
            EngineResourceHandleKind::Directory => {
                #[cfg(unix)]
                {
                    let file = resolved.take_directory().ok_or_else(|| {
                        Error::InvalidInput("engine resource must be a directory".into())
                    })?;
                    EngineResourceLease::from_file(file, true, None)
                }
                #[cfg(windows)]
                {
                    Ok(EngineResourceLease {
                        _file: resolved.take_file().ok_or_else(|| {
                            Error::InvalidInput("engine resource must be a directory".into())
                        })?,
                        target: resolved.take_target().ok_or_else(|| {
                            Error::Conflict("engine resource target is unavailable".into())
                        })?,
                    })
                }
            }
        }
    }

    /// Registers an app-owned copied engine-image asset. The native picker is
    /// consumed before this point, so only the managed copy is persistent.
    pub(crate) fn register_engine_image(
        &mut self,
        dir: &AuthorizedDir,
        leaf: &OsStr,
        installed: VerifiedIdentity,
        display_name: String,
    ) -> Result<EngineImageHandle, Error> {
        if self.attachments_sealed {
            return Err(Error::Conflict(
                "engine attachment mutations are sealed".into(),
            ));
        }
        crate::infra::fs::single_leaf(leaf)
            .map_err(|_| Error::InvalidInput("engine image leaf must be one component".into()))?;
        let path = dir.path().join(leaf);
        let commit = self.get_or_create_persistent_file_verified(
            &path,
            display_name,
            canonical_operations(EntryPurpose::EngineImage),
            installed,
        )?;
        Ok(keep_adopted_handle(
            commit.durability,
            EngineImageHandle::new(commit.id),
        ))
    }

    pub(crate) fn register_opening_book(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<OpeningBookHandle, Error> {
        let commit = self.get_or_create_persistent_file(
            path,
            display_name,
            canonical_operations(EntryPurpose::OpeningBook),
        )?;
        Ok(keep_adopted_handle(
            commit.durability,
            OpeningBookHandle::new(commit.id),
        ))
    }

    /// Resolves an exact opening-book descriptor without exposing a native path.
    /// The caller moves this already-opened file to its bounded blocking worker.
    pub(crate) fn opening_book_descriptor(
        &mut self,
        book: &OpeningBookHandle,
    ) -> Result<OpeningBookDescriptor, Error> {
        let mut resolved = self.resolve(book.path_ref(), PathOperation::OpeningBookRead, &[])?;
        let file_name = self.display_name(book.path_ref())?;
        let file = resolved.take_file().ok_or_else(|| {
            Error::InvalidInput("opening-book capability names a directory".into())
        })?;
        Ok(OpeningBookDescriptor { file_name, file })
    }

    pub(crate) fn register_installed_engine(
        &mut self,
        root: &EngineRootHandle,
        relative_path: &str,
    ) -> Result<EngineHandle, Error> {
        let components: Vec<OsString> = Path::new(relative_path)
            .components()
            .map(|component| match component {
                std::path::Component::Normal(value) => Ok(value.to_os_string()),
                _ => Err(Error::InvalidInput(
                    "engine path must be a relative file path".into(),
                )),
            })
            .collect::<Result<_, _>>()?;
        if components.is_empty() {
            return Err(Error::InvalidInput("engine path is required".into()));
        }
        validate_components(&components)?;
        let resolved = self.resolve(root.path_ref(), PathOperation::EngineInstall, &components)?;
        if resolved.file().is_none() {
            return Err(Error::InvalidInput(
                "installed engine must be a regular file".into(),
            ));
        }
        let identity = resolved.identity()?;
        let path = resolved
            .target()
            .ok_or_else(|| Error::InvalidInput("installed engine must be a regular file".into()))?
            .to_path_buf();
        #[cfg(test)]
        INSTALLED_ENGINE_POST_RESOLVE_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        let display_name = components
            .last()
            .ok_or_else(|| Error::InvalidInput("engine path is required".into()))?
            .to_string_lossy()
            .into_owned();
        self.register_engine_file_from_resolved(&path, display_name, identity)
    }

    pub(crate) fn engine_archive_destination(
        &mut self,
        root: &EngineRootHandle,
    ) -> Result<PathRef, Error> {
        let _ = self.resolve(root.path_ref(), PathOperation::DownloadArchive, &[])?;
        Ok(root.path_ref().clone())
    }

    /// Resolves one exact engine object after capability and identity validation. The native
    /// path is for the backend actor only and is never serialized to the renderer.
    pub(crate) fn engine_executable(
        &mut self,
        engine: &EngineHandle,
        operation: PathOperation,
    ) -> Result<EngineExecutable, Error> {
        #[cfg(all(test, unix))]
        observe_engine_resolution("executable");
        if !matches!(
            operation,
            PathOperation::EngineExecute | PathOperation::EngineConfigure
        ) {
            return Err(Error::InvalidInput("invalid engine operation".into()));
        }
        let mut resolved = self.resolve(engine.path_ref(), operation, &[])?;
        #[cfg(unix)]
        let file = resolved
            .take_file()
            .ok_or_else(|| Error::InvalidInput("engine capability is not a file".into()))?;
        #[cfg(windows)]
        let _file = resolved
            .take_file()
            .ok_or_else(|| Error::InvalidInput("engine capability is not a file".into()))?;
        let verified_path = self.workspace_entry_path(
            &FileWorkspaceHandle::new(engine.path_ref().clone()),
            operation,
        )?;
        let working_directory = verified_path
            .parent()
            .ok_or_else(|| Error::InvalidInput("engine executable has no parent directory".into()))?
            .to_path_buf();
        #[cfg(target_os = "macos")]
        let command_path = descriptor_path(&file)?;
        Ok(EngineExecutable {
            #[cfg(unix)]
            file,
            working_directory,
            resource_leases: Vec::new(),
            #[cfg(target_os = "macos")]
            command_path,
            #[cfg(target_os = "macos")]
            launch_root: self.engine_launch_root.clone(),
            #[cfg(target_os = "macos")]
            materialized_files: Vec::new(),
            #[cfg(windows)]
            _file,
            #[cfg(windows)]
            command_path: verified_path,
        })
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn engine_launch_root(&self) -> Result<EngineLaunchRoot, Error> {
        self.engine_launch_root
            .clone()
            .ok_or_else(|| Error::Conflict("engine launch root is not initialized".into()))
    }

    pub(crate) fn active_database_root(&mut self) -> Result<Option<DatabaseRootHandle>, Error> {
        let Some(id) = self.active_database_root.clone() else {
            return Ok(None);
        };
        self.refresh_persistent_id(&id);
        match self.persistent.get(&id.id) {
            Some(entry)
                if entry.availability == PathAvailability::Available
                    && entry.stored.target_is_dir
                    && entry
                        .stored
                        .operations
                        .contains(&PathOperation::DatabaseRead) =>
            {
                Ok(Some(DatabaseRootHandle::new(id)))
            }
            _ => Ok(None),
        }
    }

    pub(crate) fn active_puzzle_root(&mut self) -> Result<Option<PuzzleRootDescriptor>, Error> {
        let Some(id) = self.active_puzzle_root.clone() else {
            return Ok(None);
        };
        self.refresh_persistent_id(&id);
        match self.persistent.get(&id.id) {
            Some(entry)
                if entry.availability == PathAvailability::Available
                    && entry.stored.target_is_dir
                    && entry.stored.operations.contains(&PathOperation::PuzzleRead) =>
            {
                Ok(Some(PuzzleRootDescriptor {
                    root: PuzzleRootHandle::new(id),
                    display_name: entry.stored.display_name.clone(),
                }))
            }
            _ => Ok(None),
        }
    }

    pub(crate) fn set_active_database_root(
        &mut self,
        root: &DatabaseRootHandle,
    ) -> Result<(), Error> {
        let _ = self.database_root_path(root)?;
        let active = Some(root.path_ref().clone());
        let durability = self.commit_state(
            self.persistent.clone(),
            active,
            self.active_puzzle_root.clone(),
            self.active_engine_root.clone(),
            self.pending_artifacts.clone(),
            None,
        )?;
        if let CommitDurability::DurabilityUncertain(stage) = durability {
            log::warn!("active database root committed with uncertain durability: {stage}");
        }
        Ok(())
    }

    pub(crate) fn set_active_puzzle_root(&mut self, root: &PuzzleRootHandle) -> Result<(), Error> {
        let _ = self.puzzle_root_path(root)?;
        let durability = self.commit_state(
            self.persistent.clone(),
            self.active_database_root.clone(),
            Some(root.path_ref().clone()),
            self.active_engine_root.clone(),
            self.pending_artifacts.clone(),
            None,
        )?;
        if let CommitDurability::DurabilityUncertain(stage) = durability {
            log::warn!("active puzzle root committed with uncertain durability: {stage}");
        }
        Ok(())
    }

    pub(crate) fn list_puzzle_children_cancellable(
        &mut self,
        root: &PuzzleRootHandle,
        cancellation: &CancellationToken,
    ) -> Result<Vec<PuzzleDatabaseDescriptor>, Error> {
        let root_directory =
            self.capability_directory(root.path_ref(), PathOperation::PuzzleRead)?;
        map_db3_children_cancellable(
            root_directory,
            cancellation,
            |filename, display_name, identity| {
                Ok(PuzzleDatabaseDescriptor {
                    file: self.register_puzzle_child(root, &filename, identity)?,
                    filename: display_name,
                })
            },
        )
    }

    pub(crate) fn puzzle_download_destination(
        &mut self,
        root: &PuzzleRootHandle,
    ) -> Result<PathRef, Error> {
        let _ = self.resolve(root.path_ref(), PathOperation::DownloadFile, &[])?;
        Ok(root.path_ref().clone())
    }

    fn puzzle_root_path(&mut self, root: &PuzzleRootHandle) -> Result<PathBuf, Error> {
        self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::PuzzleRead,
        )
    }

    fn register_puzzle_child(
        &mut self,
        root: &PuzzleRootHandle,
        filename: &OsStr,
        observed: (u64, u64),
    ) -> Result<PathRef, Error> {
        validate_components(&[filename.to_os_string()])?;
        let resolved = self.resolve(
            root.path_ref(),
            PathOperation::PuzzleRead,
            &[filename.to_os_string()],
        )?;
        let resolved_identity = refuse_unobserved(resolved.identity()?, observed)?;
        #[cfg(test)]
        PUZZLE_CHILD_POST_RESOLVE_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        let path = self.puzzle_root_path(root)?.join(filename);
        let commit = self.get_or_create_persistent_file_verified(
            &path,
            filename.to_string_lossy(),
            canonical_operations(EntryPurpose::PuzzleFile),
            resolved_identity,
        )?;
        require_durable(commit.durability)?;
        Ok(commit.id)
    }

    /// Returns database children known below a root and reconciles newly
    /// discovered native files into persistent opaque handles.  File names are
    /// backend-derived display metadata only; callers cannot feed them back as
    /// paths.
    pub(crate) fn list_database_children_cancellable(
        &mut self,
        root: &DatabaseRootHandle,
        cancellation: &CancellationToken,
    ) -> Result<Vec<DatabaseDescriptor>, Error> {
        let root_directory =
            self.capability_directory(root.path_ref(), PathOperation::DatabaseRead)?;
        map_db3_children_cancellable(
            root_directory,
            cancellation,
            |filename, display_name, identity| {
                Ok(DatabaseDescriptor {
                    handle: self.register_database_child(
                        root,
                        &filename,
                        display_name.clone(),
                        identity,
                    )?,
                    filename: display_name,
                    availability: PathAvailability::Available,
                })
            },
        )
    }

    /// Registers an exact database child after validating it relative to the
    /// root.  This avoids a join-and-open race and preserves non-UTF8 names in
    /// the registry; only lossy display metadata leaves the backend.
    pub(crate) fn register_database_child(
        &mut self,
        root: &DatabaseRootHandle,
        filename: &OsStr,
        display_name: impl Into<String>,
        observed: (u64, u64),
    ) -> Result<DatabaseHandle, Error> {
        validate_windows_database_leaf(filename)?;
        let components = vec![filename.to_os_string()];
        let resolved = self.resolve(root.path_ref(), PathOperation::DatabaseRead, &components)?;
        let resolved_identity = refuse_unobserved(resolved.identity()?, observed)?;
        #[cfg(test)]
        DATABASE_CHILD_POST_RESOLVE_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        self.register_database_child_verified(
            root,
            filename,
            display_name.into(),
            &resolved,
            resolved_identity,
        )
    }

    fn register_database_child_verified(
        &mut self,
        root: &DatabaseRootHandle,
        filename: &OsStr,
        display_name: String,
        resolved: &ResolvedPath,
        expected_identity: VerifiedIdentity,
    ) -> Result<DatabaseHandle, Error> {
        #[cfg(not(unix))]
        let _ = resolved;
        #[cfg(unix)]
        if resolved.parent().is_none() || resolved.leaf().is_none() {
            return Err(Error::InvalidInput(
                "database child has no retained parent boundary".into(),
            ));
        }
        let root_path = self.database_root_path(root)?;
        let path = root_path.join(filename);
        let validated_identity = validate_target(&path, PathClass::PersistentFile)?;
        let verified_identity =
            verified_identity::database_child_identity(expected_identity, &validated_identity)?;
        if let Some(entry) = self.persistent.values().find(|entry| {
            entry.stored.class == PathClass::PersistentFile
                && entry.stored.path.to_path().ok().as_ref() == Some(&path)
                && entry.stored.identity == validated_identity
                && !entry.stored.target_is_dir
                && entry.stored.purpose == Some(EntryPurpose::DatabaseFile)
                && entry
                    .stored
                    .operations
                    .contains(&PathOperation::DatabaseRead)
        }) {
            let id = entry.stored.id.clone();
            let canonical = canonical_operations(EntryPurpose::DatabaseFile);
            if entry.stored.operations != canonical {
                let mut candidate = self.persistent.clone();
                candidate
                    .get_mut(&id.id)
                    .expect("selected database entry remains in the cloned registry")
                    .stored
                    .operations = canonical;
                require_durable(self.commit_candidate(candidate, None)?)?;
            }
            self.session_protected_ids.insert(id.id.clone());
            return Ok(DatabaseHandle::new(id));
        }
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name,
            class: PathClass::PersistentFile,
            purpose: Some(EntryPurpose::DatabaseFile),
            operations: canonical_operations(EntryPurpose::DatabaseFile),
            path: NativePath::from_path(&path),
            identity: {
                let (a, b) = verified_identity.pair();
                Identity { a, b }
            },
            target_is_dir: false,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        require_durable(self.commit_candidate(candidate, None)?)?;
        self.session_protected_ids.insert(id.id.clone());
        Ok(DatabaseHandle::new(id))
    }

    /// Creates an empty database leaf exactly once below a validated database
    /// root, then persists its opaque identity before returning it.  The
    /// filename is a single native component and cannot escape the root.
    pub(crate) fn create_database_child(
        &mut self,
        root: &DatabaseRootHandle,
        filename: &OsStr,
    ) -> Result<DatabaseHandle, Error> {
        validate_windows_database_leaf(filename)?;
        validate_components(&[filename.to_os_string()])?;
        if std::path::Path::new(filename).extension() != Some(OsStr::new("db3")) {
            return Err(Error::InvalidInput(
                "database filename must end in .db3".into(),
            ));
        }
        let components = vec![filename.to_os_string()];
        let resolved = self.resolve(root.path_ref(), PathOperation::DatabaseCreate, &components)?;
        #[cfg(test)]
        DATABASE_CHILD_POST_RESOLVE_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        let parent = resolved
            .parent()
            .ok_or_else(|| Error::InvalidInput("database child has no retained parent".into()))?;
        let leaf = resolved
            .leaf()
            .ok_or_else(|| Error::InvalidInput("database child has no retained leaf".into()))?;
        let (file, verified_identity) = match resolved.create_database_file() {
            Ok(created) => created,
            Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                return Err(Error::Conflict("database filename already exists".into()));
            }
            Err(error) => return Err(error),
        };
        let sync_result = (|| {
            file.sync_all()?;
            parent.sync_all()?;
            Ok::<_, Error>(())
        })();
        if let Err(error) = sync_result {
            return Err(Self::cleanup_created_database_child(
                parent,
                leaf,
                verified_identity,
                error,
            ));
        }
        #[cfg(test)]
        DATABASE_CHILD_POST_CREATE_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().take() {
                hook();
            }
        });
        match self.register_database_child_verified(
            root,
            filename,
            filename.to_string_lossy().into_owned(),
            &resolved,
            verified_identity,
        ) {
            Ok(handle) => Ok(handle),
            Err(error @ Error::CommittedDurabilityUncertain(_)) => Err(error),
            Err(error) => Err(Self::cleanup_created_database_child(
                parent,
                leaf,
                verified_identity,
                error,
            )),
        }
    }

    fn cleanup_created_database_child(
        parent: &fs::File,
        leaf: &OsStr,
        identity: VerifiedIdentity,
        primary: Error,
    ) -> Error {
        match crate::infra::fs::remove_entry_at(parent, leaf, identity.pair(), false) {
            Ok(()) => primary,
            Err(cleanup) => Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: cleanup.to_string(),
            },
        }
    }

    pub(crate) fn database_file_target(
        &mut self,
        handle: &DatabaseHandle,
        operation: PathOperation,
    ) -> Result<DatabaseFileTarget, Error> {
        if !is_database_file_operation(operation) {
            return Err(Error::InvalidInput(
                "invalid database file operation".into(),
            ));
        }
        let workspace_handle = FileWorkspaceHandle::new(handle.path_ref().clone());
        let entry = self.persistent_entry_for(&workspace_handle, operation)?;
        if entry.stored.target_is_dir {
            return Err(Error::InvalidInput(
                "database handle must identify a regular file".into(),
            ));
        }
        let stored = entry.stored;
        let path = stored.path.to_path()?;
        let expected = (stored.identity.a, stored.identity.b);
        let acquired = acquire_target(
            &path,
            AcquireShape::File {
                parent_access: parent_access_for_operations(&[operation]),
            },
        )?;
        if acquired.identity != stored.identity {
            return Err(Error::Conflict(
                "workspace entry is unavailable because its object changed".into(),
            ));
        }
        let (parent, leaf) = acquired
            .parent_and_leaf
            .ok_or_else(|| Error::InvalidInput("database path needs a leaf name".into()))?;
        self.session_protected_ids
            .insert(handle.path_ref().id.clone());
        Ok(DatabaseFileTarget::assemble(
            parent,
            leaf,
            expected,
            acquired.path,
        ))
    }

    pub(crate) fn remove_database(&mut self, handle: &DatabaseHandle) -> Result<(), Error> {
        let mut dropped_engine_executables = Vec::new();
        require_durable(self.remove_workspace_entry(
            &FileWorkspaceHandle::new(handle.path_ref().clone()),
            WorkspaceRemovalStatus::Complete,
            &mut dropped_engine_executables,
        )?)
    }

    pub(crate) fn remove_puzzle_database(&mut self, handle: &PathRef) -> Result<(), Error> {
        let mut dropped_engine_executables = Vec::new();
        require_durable(self.remove_workspace_entry(
            &FileWorkspaceHandle::new(handle.clone()),
            WorkspaceRemovalStatus::Complete,
            &mut dropped_engine_executables,
        )?)
    }

    fn database_root_path(&mut self, root: &DatabaseRootHandle) -> Result<PathBuf, Error> {
        self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::DatabaseRead,
        )
    }

    pub(crate) fn database_download_destination(
        &mut self,
        root: &DatabaseRootHandle,
    ) -> Result<PathRef, Error> {
        let _ = self.resolve(root.path_ref(), PathOperation::DownloadFile, &[])?;
        Ok(root.path_ref().clone())
    }

    /// Copies the authority markers needed to classify a download before a single-use dialog
    /// grant is consumed by [`Self::resolve`].
    pub(crate) fn download_operations(
        &mut self,
        id: &PathRef,
    ) -> Result<Vec<PathOperation>, Error> {
        self.evict_dialogs();
        if self.pending_unpersisted_removals.contains(&id.id) {
            return Err(Error::InvalidInput(
                "workspace entry is not persistent".into(),
            ));
        }
        if let Some(operations) = self
            .persistent
            .get(&id.id)
            .map(|entry| entry.stored.operations.clone())
        {
            self.session_protected_ids.insert(id.id.clone());
            return Ok(operations);
        }
        self.dialogs
            .get(&id.id)
            .map(|grant| grant.entry.stored.operations.clone())
            .ok_or_else(|| Error::InvalidInput("unknown, revoked, or expired path grant".into()))
    }

    pub(crate) fn reconcile_startup_owners(
        &mut self,
        owners: StartupPathOwners,
    ) -> Result<CommitDurability, Error> {
        if owners.retained_ids.len() > self.authority_id_input_limit()
            || owners.trusted_families.len() > MAX_TRUSTED_OWNER_FAMILIES
        {
            return Err(Error::ResourceLimit(
                "startup path owner input exceeds its limit".into(),
            ));
        }
        let retained: BTreeSet<_> = owners
            .retained_ids
            .into_iter()
            .map(|path_ref| path_ref.id)
            .filter(|id| self.persistent.contains_key(id))
            .collect();
        let trusted: BTreeSet<_> = owners.trusted_families.into_iter().collect();
        let effective_trusted: BTreeSet<_> = trusted
            .union(&self.completed_owner_families)
            .copied()
            .collect();
        let active_roots = [
            self.active_database_root.as_ref(),
            self.active_puzzle_root.as_ref(),
            self.active_engine_root.as_ref(),
        ]
        .into_iter()
        .flatten()
        .map(|path_ref| path_ref.id.as_str())
        .collect::<BTreeSet<_>>();
        let pending_ids = self
            .pending_artifacts
            .iter()
            .flat_map(|pending| [pending.id.id.as_str(), pending.root.id.as_str()])
            .collect::<BTreeSet<_>>();
        let mut candidate = self.persistent.clone();
        candidate.retain(|id, entry| {
            if !self.loaded_candidate_ids.contains(id)
                || self.session_protected_ids.contains(id)
                || retained.contains(id)
                || self.startup_retained_ids.contains(id)
                || active_roots.contains(id.as_str())
                || pending_ids.contains(id.as_str())
            {
                return true;
            }
            let Some(purpose) = entry.stored.purpose else {
                return true;
            };
            let Some(families) = owner_families_for_purpose(purpose) else {
                return true;
            };
            if families.is_empty() && self.startup_unowned_roots_reconciled {
                return true;
            }
            !families
                .iter()
                .all(|family| effective_trusted.contains(family))
        });
        let durability = if candidate.len() == self.persistent.len() {
            if self.registry_durability_pending {
                self.retry_registry_durability()?;
            }
            CommitDurability::Durable
        } else {
            self.commit_candidate(candidate, None)?
        };
        if durability == CommitDurability::Durable {
            self.completed_owner_families.extend(trusted);
            self.startup_retained_ids.extend(retained);
            self.startup_unowned_roots_reconciled = true;
        }
        Ok(durability)
    }

    fn attachment_entry(entry: &Entry) -> bool {
        is_attachment_purpose(entry.stored.purpose)
    }

    pub(crate) fn seal_engine_attachments(&mut self) {
        self.attachments_sealed = true;
    }

    pub(crate) fn begin_engine_image_issuance(
        &mut self,
    ) -> Result<ActiveImageIssuanceLease, Error> {
        if self.attachments_sealed {
            return Err(Error::Conflict(
                "engine attachment mutations are sealed".into(),
            ));
        }
        self.active_image_issuances
            .active
            .fetch_add(1, Ordering::AcqRel);
        Ok(ActiveImageIssuanceLease {
            tracker: Arc::clone(&self.active_image_issuances),
        })
    }

    pub(crate) fn active_image_issuances(&self) -> Arc<ActiveImageIssuances> {
        Arc::clone(&self.active_image_issuances)
    }

    #[cfg(test)]
    pub(crate) fn engine_attachments_are_sealed(&self) -> bool {
        self.attachments_sealed
    }

    fn authority_id_input_limit(&self) -> usize {
        self.registry_unique_id_count()
            .max(MAX_AUTHORITY_REQUEST_IDS)
    }

    fn retry_registry_durability(&mut self) -> Result<(), Error> {
        let durability = self.save_entries(
            &self.persistent,
            &self.active_database_root,
            &self.active_puzzle_root,
            &self.active_engine_root,
            &self.pending_artifacts,
        )?;
        match durability {
            CommitDurability::Durable => {
                self.registry_durability_pending = false;
                Ok(())
            }
            CommitDurability::DurabilityUncertain(stage) => {
                self.registry_durability_pending = true;
                Err(Error::CommittedDurabilityUncertain(stage))
            }
        }
    }

    /// Applies one validated whole attachment transaction. Retired entries remain resolvable only
    /// in this process; only the authority and cleanup intent are written to the registry.
    pub(crate) fn reconcile_engine_attachments(
        &mut self,
        action: EngineAttachmentAction,
    ) -> Result<(), Error> {
        if self.attachments_sealed {
            return Err(Error::Conflict(
                "engine attachment mutations are sealed".into(),
            ));
        }
        let (retained, abandoned, startup, reconcile) = match action {
            EngineAttachmentAction::Prepare { retained_ids } => {
                (Some(retained_ids), Vec::new(), false, false)
            }
            EngineAttachmentAction::Reconcile {
                retained_ids,
                abandoned_ids,
                startup,
            } => (retained_ids, abandoned_ids, startup, true),
        };
        if retained
            .as_ref()
            .is_some_and(|ids| ids.len() > self.authority_id_input_limit())
            || abandoned.len() > self.authority_id_input_limit()
            || (startup && retained.is_none())
        {
            return Err(Error::ResourceLimit(
                "engine attachment action exceeds its limit".into(),
            ));
        }
        let retained_ids: BTreeSet<String> = retained
            .as_ref()
            .into_iter()
            .flatten()
            .map(|id| id.id.clone())
            .collect();
        for id in &retained_ids {
            let entry = self
                .persistent
                .get(id)
                .or_else(|| self.retired_attachments.get(id))
                .ok_or_else(|| Error::InvalidInput("unknown retained engine attachment".into()))?;
            if !Self::attachment_entry(entry) {
                return Err(Error::InvalidInput(
                    "retained capability is not an engine attachment".into(),
                ));
            }
        }
        for id in abandoned.iter().map(|id| &id.id) {
            if let Some(entry) = self
                .persistent
                .get(id)
                .or_else(|| self.retired_attachments.get(id))
            {
                if !Self::attachment_entry(entry) {
                    return Err(Error::InvalidInput(
                        "abandoned capability is not an engine attachment".into(),
                    ));
                }
            }
        }

        let old_provisional = self.provisional_attachments.clone();
        let old_cleanup = self.image_cleanup.clone();
        let old_retired = self.retired_attachments.clone();
        let old_admission = self.registry_admission_snapshot(
            &self.persistent,
            &self.active_database_root,
            &self.active_puzzle_root,
            &self.active_engine_root,
            &self.pending_artifacts,
            &old_provisional,
            &old_retired,
            &old_cleanup,
        )?;
        let mut candidate = self.persistent.clone();
        let mut readopted_retired_ids = Vec::new();
        for id in &retained_ids {
            if let Some(entry) = self.retired_attachments.get(id).cloned() {
                candidate.insert(id.clone(), entry);
                readopted_retired_ids.push(id.clone());
            }
            self.provisional_attachments.remove(id);
            self.image_cleanup.remove(id);
        }
        if reconcile {
            let abandon_only = retained.is_none();
            let explicit_abandoned: BTreeSet<_> = abandoned.into_iter().map(|id| id.id).collect();
            let retire_ids = candidate
                .iter()
                .filter_map(|(id, entry)| {
                    if !Self::attachment_entry(entry) || retained_ids.contains(id) {
                        return None;
                    }
                    let provisional = self.provisional_attachments.contains(id);
                    let explicitly_abandoned = explicit_abandoned.contains(id);
                    let should_retire = if abandon_only {
                        explicitly_abandoned && provisional
                    } else {
                        explicitly_abandoned
                            || (!provisional
                                && !(startup && self.session_protected_ids.contains(id)))
                            || (startup
                                && self.loaded_candidate_ids.contains(id)
                                && !self.session_protected_ids.contains(id))
                    };
                    should_retire.then(|| id.clone())
                })
                .collect::<Vec<_>>();
            for id in retire_ids {
                if let Some(entry) = candidate.remove(&id) {
                    self.provisional_attachments.remove(&id);
                    if entry.stored.purpose == Some(EntryPurpose::EngineImage) {
                        self.image_cleanup.insert(id.clone(), entry.stored.clone());
                    }
                    self.retired_attachments.insert(id, entry);
                }
            }
        }
        if candidate == self.persistent
            && self.provisional_attachments == old_provisional
            && self.image_cleanup == old_cleanup
            && self.retired_attachments == old_retired
        {
            if self.registry_durability_pending {
                return self.retry_registry_durability();
            }
            return Ok(());
        }
        match self.commit_candidate_with_pending_baseline(
            candidate,
            self.pending_artifacts.clone(),
            None,
            Some(old_admission),
        ) {
            Ok(durability) => {
                for id in readopted_retired_ids {
                    self.retired_attachments.remove(&id);
                }
                match durability {
                    CommitDurability::Durable => {
                        self.registry_durability_pending = false;
                        Ok(())
                    }
                    CommitDurability::DurabilityUncertain(stage) => {
                        self.registry_durability_pending = true;
                        Err(Error::CommittedDurabilityUncertain(stage))
                    }
                }
            }
            Err(error) => {
                self.provisional_attachments = old_provisional;
                self.image_cleanup = old_cleanup;
                self.retired_attachments = old_retired;
                Err(error)
            }
        }
    }

    /// Seals attachment mutations before process teardown. Cleanup never follows a stored path:
    /// only UUID leaves beneath the caller-proven EngineImages directory are eligible.
    pub(crate) fn cleanup_engine_images(
        &mut self,
        image_dir: &AuthorizedDir,
        seal: bool,
    ) -> Result<(), Error> {
        if seal {
            self.seal_engine_attachments();
        }
        if self.image_cleanup.is_empty() {
            if self.registry_durability_pending {
                return self.retry_registry_durability();
            }
            return Ok(());
        }
        let ids = self.image_cleanup.keys().cloned().collect::<Vec<_>>();
        let original_cleanup = self.image_cleanup.clone();
        let mut next_cleanup = original_cleanup.clone();
        let mut failures = Vec::new();
        let mut durability_uncertain = None;
        for id in ids {
            let Some(stored) = original_cleanup.get(&id).cloned() else {
                continue;
            };
            let Ok(path) = stored.path.to_path() else {
                next_cleanup.remove(&id);
                continue;
            };
            let Some(leaf) = path.file_name() else {
                next_cleanup.remove(&id);
                continue;
            };
            let valid_uuid = uuid::Uuid::parse_str(&leaf.to_string_lossy()).is_ok();
            if !valid_uuid || path.parent() != Some(image_dir.path()) {
                next_cleanup.remove(&id);
                continue;
            }
            let acquired = match image_dir.open_leaf_identified(leaf) {
                Ok(identity) if identity.agrees_with(&stored.identity) => identity,
                Ok(_) => {
                    next_cleanup.remove(&id);
                    continue;
                }
                Err(Error::Io(ref error)) if error.kind() == std::io::ErrorKind::NotFound => {
                    next_cleanup.remove(&id);
                    continue;
                }
                Err(Error::Conflict(_)) => {
                    next_cleanup.remove(&id);
                    continue;
                }
                Err(error) => {
                    failures.push(error);
                    continue;
                }
            };
            match image_dir.remove_leaf_identified(leaf, acquired) {
                Ok(()) => {
                    next_cleanup.remove(&id);
                }
                Err(Error::Io(ref error))
                    if matches!(error.kind(), std::io::ErrorKind::NotFound) =>
                {
                    next_cleanup.remove(&id);
                }
                Err(Error::Conflict(_)) => {
                    // A substituted leaf is not ours. Complete the obsolete intent without unlinking.
                    next_cleanup.remove(&id);
                }
                Err(error) => failures.push(error),
            }
        }
        if next_cleanup != original_cleanup {
            self.image_cleanup = next_cleanup;
            let durability = self.save_entries(
                &self.persistent,
                &self.active_database_root,
                &self.active_puzzle_root,
                &self.active_engine_root,
                &self.pending_artifacts,
            );
            match durability {
                Ok(CommitDurability::Durable) => {
                    self.registry_durability_pending = false;
                }
                Ok(CommitDurability::DurabilityUncertain(stage)) => {
                    log::warn!(
                        "engine image cleanup registry sync is uncertain at {stage}; completed intents are adopted"
                    );
                    self.registry_durability_pending = true;
                    durability_uncertain = Some(Error::CommittedDurabilityUncertain(stage));
                }
                Err(error) => {
                    self.image_cleanup = original_cleanup;
                    return match failures.into_iter().next() {
                        Some(cleanup) => Err(Error::OperationAndCleanup {
                            primary: error.to_string(),
                            cleanup: cleanup.to_string(),
                        }),
                        None => Err(error),
                    };
                }
            }
        }
        if let Some(error) = durability_uncertain {
            return match failures.into_iter().next() {
                Some(cleanup) => Err(Error::OperationAndCleanup {
                    primary: error.to_string(),
                    cleanup: cleanup.to_string(),
                }),
                None => Err(error),
            };
        }
        failures.into_iter().next().map_or(Ok(()), Err)
    }

    pub fn resolve(
        &mut self,
        id: &PathRef,
        operation: PathOperation,
        components: &[OsString],
    ) -> Result<ResolvedPath, Error> {
        validate_components(components)?;
        if self.pending_unpersisted_removals.contains(&id.id) {
            return Err(Error::InvalidInput(
                "workspace entry is not persistent".into(),
            ));
        }
        let entry = if let Some(entry) = self
            .persistent
            .get(&id.id)
            .or_else(|| self.retired_attachments.get(&id.id))
            .cloned()
        {
            entry
        } else {
            self.take_dialog(id, Some(operation))?.entry
        };
        if !entry.stored.operations.contains(&operation) {
            return Err(Error::InvalidInput(
                "path capability does not permit this operation".into(),
            ));
        }
        let root = entry.stored.path.to_path()?;
        let actual = validate_target(
            &root,
            if entry.stored.target_is_dir {
                PathClass::PersistentCustomRoot
            } else {
                PathClass::PersistentFile
            },
        )?;
        if actual != entry.stored.identity {
            return Err(Error::Conflict(
                "path authority is unavailable because its object changed".into(),
            ));
        }
        #[cfg(unix)]
        let resolved = resolved::resolve_unix(
            &root,
            &entry.stored.identity,
            entry.stored.target_is_dir,
            components,
            operation,
        );
        #[cfg(windows)]
        let resolved = resolved::resolve_windows(
            &root,
            &entry.stored.identity,
            entry.stored.target_is_dir,
            components,
            operation,
        );
        if resolved.is_ok() && self.persistent.contains_key(&id.id) {
            self.session_protected_ids.insert(id.id.clone());
        }
        resolved
    }

    /// Renderer-safe display metadata for a capability.  This is deliberately
    /// a label, not a path or component list.
    pub(crate) fn display_name(&mut self, id: &PathRef) -> Result<String, Error> {
        self.refresh_persistent_id(id);
        let display_name = self
            .persistent
            .get(&id.id)
            .filter(|entry| entry.availability == PathAvailability::Available)
            .map(|entry| entry.stored.display_name.clone())
            .ok_or_else(|| Error::InvalidInput("unknown or unavailable path capability".into()))?;
        self.session_protected_ids.insert(id.id.clone());
        Ok(display_name)
    }

    /// Returns the native root for a persistent, directory-backed workspace after checking its
    /// identity and required operation. This is intentionally crate-private: renderer code only
    /// ever receives [`FileWorkspaceHandle`], while native workspace commands use this one
    /// authority boundary for every filesystem operation.
    pub(crate) fn workspace_root(
        &mut self,
        workspace: &FileWorkspaceHandle,
        operation: PathOperation,
    ) -> Result<PathBuf, Error> {
        let entry = self
            .persistent
            .get(&workspace.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace is not persistent".into()))?;
        if !entry.stored.target_is_dir || !entry.stored.operations.contains(&operation) {
            return Err(Error::InvalidInput(
                "workspace does not permit this operation".into(),
            ));
        }
        let root = entry.stored.path.to_path()?;
        if validate_target(&root, PathClass::PersistentCustomRoot)? != entry.stored.identity {
            return Err(Error::Conflict(
                "workspace is unavailable because its root changed".into(),
            ));
        }
        self.session_protected_ids
            .insert(workspace.path_ref().id.clone());
        Ok(root)
    }

    /// Persists an opaque child handle for an entry observed through a retained directory
    /// descriptor. The supplied identity is the one captured during enumeration.
    pub(crate) fn register_workspace_child_observed(
        &mut self,
        workspace: &FileWorkspaceHandle,
        components: &[OsString],
        display_name: impl Into<String>,
        identity: (u64, u64),
        is_dir: bool,
        operation: PathOperation,
    ) -> Result<FileWorkspaceHandle, Error> {
        validate_components(components)?;
        if components.is_empty() {
            return Err(Error::InvalidInput("workspace child is required".into()));
        }
        let root_entry = self
            .persistent
            .get(&workspace.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace is not persistent".into()))?;
        if !root_entry.stored.target_is_dir || !root_entry.stored.operations.contains(&operation) {
            return Err(Error::InvalidInput("invalid PGN workspace root".into()));
        }
        let root = root_entry.stored.path.to_path()?;
        let path = components.iter().fold(root, |mut path, component| {
            path.push(component);
            path
        });
        let class = if is_dir {
            PathClass::PersistentCustomRoot
        } else {
            PathClass::PersistentFile
        };
        self.persist_workspace_child(
            root_entry,
            path,
            display_name.into(),
            class,
            Identity {
                a: identity.0,
                b: identity.1,
            },
            is_dir,
        )
    }

    fn persist_workspace_child(
        &mut self,
        root_entry: Entry,
        path: PathBuf,
        display_name: String,
        class: PathClass,
        identity: Identity,
        is_dir: bool,
    ) -> Result<FileWorkspaceHandle, Error> {
        let purpose =
            (root_entry.stored.purpose == Some(EntryPurpose::PgnWorkspace)).then_some(if is_dir {
                EntryPurpose::PgnWorkspace
            } else {
                EntryPurpose::PgnFile
            });
        if let Some((id, entry)) = self.persistent.iter().find(|(_, entry)| {
            entry.stored.class == class
                && entry.stored.path.to_path().ok().as_ref() == Some(&path)
                && entry.stored.identity == identity
                && entry.stored.target_is_dir == is_dir
                && entry.stored.purpose == purpose
                && (purpose.is_some()
                    || same_operation_set(&entry.stored.operations, &root_entry.stored.operations))
        }) {
            let id = PathRef { id: id.clone() };
            if let Some(purpose) = purpose {
                let canonical = canonical_operations(purpose);
                if entry.stored.operations != canonical {
                    let mut candidate = self.persistent.clone();
                    candidate
                        .get_mut(&id.id)
                        .expect("selected workspace entry remains in the cloned registry")
                        .stored
                        .operations = canonical;
                    require_durable(self.commit_candidate(candidate, None)?)?;
                }
            }
            self.session_protected_ids.insert(id.id.clone());
            return Ok(FileWorkspaceHandle::new(id));
        }
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name,
            class,
            purpose,
            operations: purpose
                .map(canonical_operations)
                .unwrap_or(root_entry.stored.operations),
            path: NativePath::from_path(&path),
            identity,
            target_is_dir: is_dir,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        require_durable(self.commit_candidate(candidate, None)?)?;
        self.session_protected_ids.insert(id.id.clone());
        Ok(FileWorkspaceHandle::new(id))
    }

    /// Persists a recovery intent before the download target is mutated. It binds the root inode,
    /// single leaf, and the caller-supplied SHA-256/size of the already-complete staging payload.
    /// The reservation has no renderer-visible capability and cannot be used to access the target
    /// until activation.
    pub(crate) fn reserve_download_artifact(
        &mut self,
        root: &PathRef,
        filename: OsString,
        (payload_size, payload_sha256): (u64, String),
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
    ) -> Result<PendingArtifactReservation, Error> {
        validate_components(std::slice::from_ref(&filename))?;
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "download artifact requires operations".into(),
            ));
        }
        let root_entry = self
            .persistent
            .get(&root.id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("download root must be persistent".into()))?;
        if !root_entry.stored.target_is_dir
            || !root_entry
                .stored
                .operations
                .contains(&PathOperation::DownloadFile)
        {
            return Err(Error::InvalidInput(
                "capability is not a download root".into(),
            ));
        }
        let root_path = root_entry.stored.path.to_path()?;
        let root_identity = validate_target(&root_path, PathClass::PersistentCustomRoot)?;
        if root_identity != root_entry.stored.identity {
            return Err(Error::Conflict(
                "download root changed before artifact reservation".into(),
            ));
        }
        let path = root_path.join(&filename);
        let baseline = match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                return Err(Error::InvalidInput(
                    "download artifact target must be a regular file".into(),
                ));
            }
            Ok(_) => Some(identity(&path)?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(Error::from(error)),
        };
        let pending = PendingArtifact {
            id: PathRef::fresh(),
            root: root.clone(),
            filename: NativePath::from_path(&PathBuf::from(&filename)),
            display_name: display_name.into(),
            operations,
            baseline,
            root_identity: Some(root_identity),
            payload_size,
            payload_sha256,
            payload_bound: true,
            installed_identity: None,
            installed_ctime_nanos: None,
        };
        let mut next_pending = self.pending_artifacts.clone();
        next_pending.push(pending.clone());
        let durability = self.commit_registry(
            self.persistent.clone(),
            self.active_database_root.clone(),
            self.active_puzzle_root.clone(),
            self.active_engine_root.clone(),
            next_pending,
            None,
            false,
        )?;
        match durability {
            CommitDurability::Durable => {}
            CommitDurability::DurabilityUncertain(_) => {
                // The stage the commit reports is the registry write; what the caller must not do
                // is act on the reservation, so name that instead.
                return Err(Error::CommittedDurabilityUncertain(
                    crate::error::DurabilityStage::ArchiveReservationJournal,
                ));
            }
        }
        Ok(PendingArtifactReservation {
            id: pending.id,
            payload_size: pending.payload_size,
            payload_sha256: pending.payload_sha256,
        })
    }

    fn commit_download_artifact(
        &mut self,
        verified: ContentVerifiedArtifactActivation,
    ) -> Result<ArtifactPublication, Error> {
        let current_pending = self
            .pending_artifacts
            .iter()
            .find(|pending| pending.id == verified.pending.id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("unknown download artifact reservation".into()))?;

        if current_pending.operations != verified.pending.operations
            || current_pending.root != verified.pending.root
            || current_pending.filename != verified.pending.filename
            || current_pending.root_identity != verified.pending.root_identity
            || current_pending.baseline != verified.pending.baseline
            || !current_pending.payload_bound
            || current_pending.payload_bound != verified.pending.payload_bound
            || current_pending.payload_size != verified.pending.payload_size
            || current_pending.payload_sha256 != verified.pending.payload_sha256
            || current_pending.installed_identity != verified.pending.installed_identity
            || current_pending.installed_ctime_nanos != verified.pending.installed_ctime_nanos
            || current_pending.display_name != verified.pending.display_name
        {
            return Err(Error::Conflict(
                "download artifact reservation changed before activation".into(),
            ));
        }

        let root = self
            .persistent
            .get(&verified.pending.root.id)
            .cloned()
            .ok_or_else(|| {
                Error::Conflict("download root disappeared before artifact activation".into())
            })?;
        if root.stored.id != verified.root_id {
            return Err(Error::Conflict(
                "download root changed before artifact activation".into(),
            ));
        }
        let root_path = root.stored.path.to_path()?;
        let root_identity = validate_target(&root_path, PathClass::PersistentCustomRoot)?;
        if root_identity != root.stored.identity
            || verified.pending.root_identity.as_ref() != Some(&root_identity)
            || root_identity != verified.root_identity
            || root_path != verified.root_path
        {
            return Err(Error::Conflict(
                "download root changed before artifact activation".into(),
            ));
        }

        let filename = verified.pending.filename.to_path()?;
        let leaf = filename
            .file_name()
            .ok_or_else(|| Error::InvalidInput("artifact reservation has no leaf".into()))?
            .to_os_string();
        let mut re_resolved =
            self.resolve(&verified.pending.root, PathOperation::DownloadFile, &[leaf])?;
        let current_file = re_resolved
            .take_file()
            .ok_or_else(|| Error::Conflict("artifact target is not a regular file".into()))?;
        let (cur_a, cur_b) = opened_file_identity(&current_file)?;
        let current_leaf_identity = Identity { a: cur_a, b: cur_b };
        let current_leaf_change_stamp = opened_file_change_stamp(&current_file)?;

        if current_leaf_identity != verified.verified_identity
            || current_leaf_change_stamp != verified.verified_change_stamp
        {
            return Err(Error::Conflict(
                "download artifact target changed before activation".into(),
            ));
        }

        #[cfg(test)]
        if let Some(observer) = &verified.observer {
            observer.observe(ActivationObserverStage::CommitBeforeRetainedDescriptorValidation);
        }

        let (ret_a, ret_b) = opened_file_identity(verified.descriptor.as_file())?;
        let retained_identity = Identity { a: ret_a, b: ret_b };
        let retained_change_stamp = opened_file_change_stamp(verified.descriptor.as_file())?;
        if retained_identity != verified.verified_identity
            || retained_change_stamp != verified.verified_change_stamp
        {
            return Err(Error::Conflict(
                "download artifact target changed before activation".into(),
            ));
        }

        let purpose = purpose_for_shape(
            PathClass::PersistentFile,
            false,
            &verified.pending.operations,
        );
        let operations = purpose
            .map(canonical_operations)
            .unwrap_or(verified.pending.operations);
        let stored = StoredEntry {
            id: verified.pending.id.clone(),
            display_name: verified.pending.display_name,
            class: PathClass::PersistentFile,
            purpose,
            operations,
            path: NativePath::from_path(&root_path.join(&filename)),
            identity: verified.verified_identity,
            target_is_dir: false,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            stored.id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        let next_pending: Vec<_> = self
            .pending_artifacts
            .iter()
            .filter(|pending| pending.id != verified.pending.id)
            .cloned()
            .collect();
        let durability = self.commit_registry(
            candidate,
            self.active_database_root.clone(),
            self.active_puzzle_root.clone(),
            self.active_engine_root.clone(),
            next_pending,
            None,
            true,
        )?;
        Ok(ArtifactPublication {
            handle: FileWorkspaceHandle::new(verified.pending.id),
            durability,
        })
    }

    /// Activates exactly the artifact covered by a durable reservation after atomic replacement.
    /// Module-private synchronous adapter used only by recovery and tests.
    fn activate_download_artifact(
        &mut self,
        reservation: &PendingArtifactReservation,
    ) -> Result<ArtifactPublication, Error> {
        let prepared = self.prepare_download_artifact(reservation)?;
        let verified = prepared.verify()?;
        self.commit_download_artifact(verified)
    }

    /// Records the exact no-follow inode installed by an already-completed rename. Failure or
    /// uncertain durability deliberately leaves the intent quarantined; callers must not retry
    /// the install because the target may already have changed.
    pub(crate) fn mark_download_artifact_committed(
        &mut self,
        reservation: &PendingArtifactReservation,
        installed_identity: (u64, u64),
        installed_ctime_nanos: i128,
    ) -> Result<(), Error> {
        let pending = self
            .pending_artifacts
            .iter()
            .find(|item| item.id == reservation.id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("unknown download artifact reservation".into()))?;
        if !pending.payload_bound {
            return Err(Error::Conflict(
                "legacy artifact intent is quarantined".into(),
            ));
        }
        let mut next = self.pending_artifacts.clone();
        let item = next
            .iter_mut()
            .find(|item| item.id == reservation.id)
            .expect("reservation was cloned from pending artifacts");
        item.installed_identity = Some(Identity {
            a: installed_identity.0,
            b: installed_identity.1,
        });
        item.installed_ctime_nanos = Some(installed_ctime_nanos);
        match self.commit_registry(
            self.persistent.clone(),
            self.active_database_root.clone(),
            self.active_puzzle_root.clone(),
            self.active_engine_root.clone(),
            next,
            None,
            true,
        )? {
            CommitDurability::Durable => Ok(()),
            CommitDurability::DurabilityUncertain(_) => Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::ArchiveCommitMarker,
            )),
        }
    }

    pub(crate) fn abandon_download_artifact(&mut self, reservation: &PendingArtifactReservation) {
        let next_pending: Vec<_> = self
            .pending_artifacts
            .iter()
            .filter(|pending| pending.id != reservation.id)
            .cloned()
            .collect();
        if next_pending.len() == self.pending_artifacts.len() {
            return;
        }
        if let Err(error) = self.commit_registry(
            self.persistent.clone(),
            self.active_database_root.clone(),
            self.active_puzzle_root.clone(),
            self.active_engine_root.clone(),
            next_pending,
            None,
            true,
        ) {
            let category = error.category();
            let reservation_id = &reservation.id.id;
            log::warn!(
                "failed to abandon download artifact reservation {reservation_id}: {category}"
            );
        }
    }

    /// Rebinds a successfully renamed entry without reopening its mutable pathname. `renameat`
    /// preserves the object identity already stored on the capability; a later resolver either
    /// observes that exact object at the new path or fails closed.
    pub(crate) fn rebind_workspace_entry(
        &mut self,
        handle: &FileWorkspaceHandle,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<(), Error> {
        let mut candidate = self.persistent.clone();
        let entry = candidate
            .get_mut(&handle.path_ref().id)
            .ok_or_else(|| Error::Conflict("workspace entry disappeared".into()))?;
        entry.stored.path = NativePath::from_path(path);
        entry.stored.display_name = display_name.into();
        entry.availability = PathAvailability::Available;
        require_durable(self.commit_candidate(candidate, None)?)?;
        Ok(())
    }

    fn persistent_entry_for(
        &self,
        handle: &FileWorkspaceHandle,
        operation: PathOperation,
    ) -> Result<Entry, Error> {
        let entry = self
            .persistent
            .get(&handle.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace entry is not persistent".into()))?;
        if !entry.stored.operations.contains(&operation) {
            return Err(Error::InvalidInput(
                "workspace entry does not permit this operation".into(),
            ));
        }
        Ok(entry)
    }

    pub(crate) fn workspace_entry_path(
        &mut self,
        handle: &FileWorkspaceHandle,
        operation: PathOperation,
    ) -> Result<PathBuf, Error> {
        let entry = self.persistent_entry_for(handle, operation)?;
        let class = if entry.stored.target_is_dir {
            PathClass::PersistentCustomRoot
        } else {
            PathClass::PersistentFile
        };
        let path = entry.stored.path.to_path()?;
        if validate_target(&path, class)? != entry.stored.identity {
            return Err(Error::Conflict(
                "workspace entry is unavailable because its object changed".into(),
            ));
        }
        self.session_protected_ids
            .insert(handle.path_ref().id.clone());
        Ok(path)
    }

    /// Resolves an opaque workspace capability into retained no-follow descriptors.  This is the
    /// mutation boundary: callers must not reopen `path()` for filesystem changes.
    pub(crate) fn workspace_mutation_target(
        &mut self,
        handle: &FileWorkspaceHandle,
    ) -> Result<WorkspaceMutationTarget, Error> {
        let target = self.retained_workspace_target(handle, PathOperation::WritePgn)?;
        let directory = if target.target_is_dir {
            Some(
                crate::infra::fs::open_verified_directory(&target.path, target.identity)?
                    .into_file(),
            )
        } else {
            None
        };
        Ok(WorkspaceMutationTarget {
            parent: target.parent,
            directory,
            leaf: target.leaf,
            identity: target.identity,
            is_dir: target.target_is_dir,
            path: target.path,
        })
    }

    fn retained_workspace_target(
        &mut self,
        handle: &FileWorkspaceHandle,
        required_operation: PathOperation,
    ) -> Result<RetainedWorkspaceTarget, Error> {
        let entry = self.persistent_entry_for(handle, required_operation)?;
        let path = entry.stored.path.to_path()?;
        let expected = (entry.stored.identity.a, entry.stored.identity.b);
        let (parent, leaf) = crate::infra::fs::open_verified_parent(
            &path,
            expected,
            entry.stored.target_is_dir,
            ParentAccess::Writable,
        )?;
        self.session_protected_ids
            .insert(handle.path_ref().id.clone());
        Ok(RetainedWorkspaceTarget {
            parent,
            leaf,
            identity: expected,
            target_is_dir: entry.stored.target_is_dir,
            path,
        })
    }

    pub(crate) fn remove_workspace_entry(
        &mut self,
        handle: &FileWorkspaceHandle,
        status: WorkspaceRemovalStatus,
        dropped_engine_executables: &mut Vec<PathRef>,
    ) -> Result<CommitDurability, Error> {
        let removed = self
            .persistent
            .get(&handle.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace entry is not persistent".into()))?;
        let removed_path = removed.stored.path.to_path()?;
        let mut candidate = self.persistent.clone();
        if status == WorkspaceRemovalStatus::Complete {
            candidate.remove(&handle.path_ref().id);
        }
        if removed.stored.target_is_dir {
            candidate.retain(|id, entry| {
                if id == &handle.path_ref().id {
                    return status == WorkspaceRemovalStatus::Partial;
                }
                let Ok(path) = entry.stored.path.to_path() else {
                    return true;
                };
                let is_descendant =
                    path != removed_path && path.strip_prefix(&removed_path).is_ok();
                if !is_descendant {
                    return true;
                }
                if status == WorkspaceRemovalStatus::Complete {
                    return false;
                }
                refresh_entry(entry, self.app_data_dir.as_ref());
                entry.availability == PathAvailability::Available
            });
        }

        let removed_ids: Vec<_> = self
            .persistent
            .keys()
            .filter(|id| !candidate.contains_key(*id))
            .cloned()
            .collect();
        dropped_engine_executables.extend(removed_ids.iter().filter_map(|id| {
            let entry = self.persistent.get(id)?;
            entry
                .stored
                .operations
                .iter()
                .any(|operation| {
                    matches!(
                        operation,
                        PathOperation::EngineExecute | PathOperation::EngineConfigure
                    )
                })
                .then(|| PathRef { id: id.clone() })
        }));
        let mut pending_artifacts = self.pending_artifacts.clone();
        pending_artifacts.retain(|pending| !removed_ids.contains(&pending.root.id));
        // An intent whose root was removed by this operation can never activate. This is scoped
        // here rather than made a general commit invariant because other commits do not establish
        // that a missing root was deliberately deleted.
        //
        // After a successful save, workspace records no longer outlive the objects they name. If
        // saving fails, however, this prune is not adopted: in-memory state must not diverge from
        // what was persisted, so the unavailable records remain until a later successful,
        // explicit reconciliation. Residual accumulation is therefore limited to registry-save
        // failures rather than ordinary workspace create-and-delete use.
        match self.commit_candidate_with_pending(candidate, pending_artifacts, None) {
            Ok(durability) => Ok(durability),
            Err(error) => {
                self.pending_unpersisted_removals.extend(removed_ids);
                Err(error)
            }
        }
    }

    /// Rebind every persistent child below a moved directory in one registry replacement. This
    /// keeps already-open tabs and recents attached to their original filesystem identities
    /// after a native directory move; paths never need to be reconstructed in the renderer.
    pub(crate) fn rebase_workspace_entries(
        &mut self,
        old_root: &Path,
        new_root: &Path,
    ) -> Result<(), Error> {
        let mut candidate = self.persistent.clone();
        let mut changed = false;
        for entry in candidate.values_mut() {
            let Ok(path) = entry.stored.path.to_path() else {
                continue;
            };
            let Ok(suffix) = path.strip_prefix(old_root) else {
                continue;
            };
            let rebased = new_root.join(suffix);
            // A namespace rename cannot change the object. Keep the pre-rename identity instead
            // of reopening `rebased`, which could bind an attacker replacement after commit.
            entry.stored.path = NativePath::from_path(&rebased);
            entry.availability = PathAvailability::Available;
            changed = true;
        }
        if changed {
            require_durable(self.commit_candidate(candidate, None)?)?;
        }
        Ok(())
    }
    fn take_dialog(
        &mut self,
        id: &PathRef,
        required: Option<PathOperation>,
    ) -> Result<DialogGrant, Error> {
        self.evict_dialogs();
        let mut grant = self.dialogs.remove(&id.id).ok_or_else(|| {
            Error::InvalidInput("unknown, revoked, or expired dialog grant".into())
        })?;
        if let Some(op) = required {
            if !grant.entry.stored.operations.contains(&op) {
                self.dialogs.insert(id.id.clone(), grant);
                return Err(Error::InvalidInput(
                    "dialog grant does not permit this operation".into(),
                ));
            }
        }
        grant.uses_left -= 1;
        if grant.uses_left > 0 {
            self.dialogs.insert(id.id.clone(), grant.clone());
        }
        Ok(grant)
    }
    fn evict_dialogs(&mut self) {
        let now = self.clock.now();
        self.dialogs.retain(|_, g| g.expires_at > now);
    }
    #[cfg(test)]
    fn refresh_persistent(&mut self) {
        for entry in self.persistent.values_mut() {
            refresh_entry(entry, self.app_data_dir.as_ref());
        }
    }
    fn refresh_persistent_id(&mut self, id: &PathRef) {
        if let Some(entry) = self.persistent.get_mut(&id.id) {
            refresh_entry(entry, self.app_data_dir.as_ref());
        }
    }
    #[cfg(all(test, unix))]
    fn save(&mut self) -> Result<CommitDurability, Error> {
        self.commit_registry(
            self.persistent.clone(),
            self.active_database_root.clone(),
            self.active_puzzle_root.clone(),
            self.active_engine_root.clone(),
            self.pending_artifacts.clone(),
            None,
            true,
        )
    }
    fn save_entries(
        &self,
        entries: &BTreeMap<String, Entry>,
        active_database_root: &Option<PathRef>,
        active_puzzle_root: &Option<PathRef>,
        active_engine_root: &Option<PathRef>,
        pending_artifacts: &[PendingArtifact],
    ) -> Result<CommitDurability, Error> {
        self.save_entries_with(
            entries,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            |target, write| atomic_replace(target, write),
        )
    }

    #[allow(clippy::too_many_arguments)] // one complete persisted-state admission snapshot
    fn registry_admission_snapshot(
        &self,
        entries: &BTreeMap<String, Entry>,
        active_database_root: &Option<PathRef>,
        active_puzzle_root: &Option<PathRef>,
        active_engine_root: &Option<PathRef>,
        pending_artifacts: &[PendingArtifact],
        provisional: &BTreeSet<String>,
        retired: &BTreeMap<String, Entry>,
        cleanup: &BTreeMap<String, StoredEntry>,
    ) -> Result<RegistryAdmissionSnapshot, Error> {
        let bytes = serde_json::to_vec(&Registry {
            schema_version: SCHEMA_VERSION,
            entries: entries
                .values()
                .filter(|entry| entry.stored.class != PathClass::AppOwnedRoot)
                .map(|entry| entry.stored.clone())
                .collect(),
            active_database_root: active_database_root.clone(),
            active_puzzle_root: active_puzzle_root.clone(),
            active_engine_root: active_engine_root.clone(),
            pending_artifacts: pending_artifacts.to_vec(),
            provisional_attachments: provisional.clone(),
            image_cleanup: cleanup.values().cloned().collect(),
        })
        .map_err(|error| Error::InvalidInput(error.to_string()))?;
        Ok(RegistryAdmissionSnapshot {
            bytes: bytes.len(),
            serialized: bytes,
            unique_ids: unique_registry_id_count(
                entries.keys().map(String::as_str).collect(),
                retired.keys().map(String::as_str).collect(),
                cleanup.keys().map(String::as_str).collect(),
                pending_artifacts
                    .iter()
                    .map(|pending| pending.id.id.as_str())
                    .collect(),
            ),
            // This is deliberately a separate admission dimension. A pending artifact can
            // carry an already-counted ID; its number of recovery records is still bounded.
            pending_count: pending_artifacts.len(),
        })
    }

    fn commit_candidate(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        consumed_dialog: Option<&PathRef>,
    ) -> Result<CommitDurability, Error> {
        self.commit_candidate_with_pending_baseline(
            candidate,
            self.pending_artifacts.clone(),
            consumed_dialog,
            None,
        )
    }
    fn commit_candidate_with_pending(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        pending_artifacts: Vec<PendingArtifact>,
        consumed_dialog: Option<&PathRef>,
    ) -> Result<CommitDurability, Error> {
        self.commit_candidate_with_pending_baseline(
            candidate,
            pending_artifacts,
            consumed_dialog,
            None,
        )
    }

    fn commit_candidate_with_pending_baseline(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        pending_artifacts: Vec<PendingArtifact>,
        consumed_dialog: Option<&PathRef>,
        baseline: Option<RegistryAdmissionSnapshot>,
    ) -> Result<CommitDurability, Error> {
        let active_database_root = self
            .active_database_root
            .clone()
            .filter(|id| candidate.contains_key(&id.id));
        let active_puzzle_root = self
            .active_puzzle_root
            .clone()
            .filter(|id| candidate.contains_key(&id.id));
        let active_engine_root = self
            .active_engine_root
            .clone()
            .filter(|id| candidate.contains_key(&id.id));
        let durability = self.commit_state_with_baseline(
            candidate,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            consumed_dialog,
            baseline,
        )?;
        Ok(durability)
    }
    fn commit_state(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        active_database_root: Option<PathRef>,
        active_puzzle_root: Option<PathRef>,
        active_engine_root: Option<PathRef>,
        pending_artifacts: Vec<PendingArtifact>,
        consumed_dialog: Option<&PathRef>,
    ) -> Result<CommitDurability, Error> {
        self.commit_state_with_baseline(
            candidate,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            consumed_dialog,
            None,
        )
    }

    #[allow(clippy::too_many_arguments)] // one complete registry commit plus its old baseline
    fn commit_state_with_baseline(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        active_database_root: Option<PathRef>,
        active_puzzle_root: Option<PathRef>,
        active_engine_root: Option<PathRef>,
        pending_artifacts: Vec<PendingArtifact>,
        consumed_dialog: Option<&PathRef>,
        baseline: Option<RegistryAdmissionSnapshot>,
    ) -> Result<CommitDurability, Error> {
        self.commit_registry_with_baseline(
            candidate,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            consumed_dialog,
            true,
            baseline,
        )
    }
    #[allow(clippy::too_many_arguments)] // one registry snapshot plus adopt_uncertain
    fn commit_registry(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        active_database_root: Option<PathRef>,
        active_puzzle_root: Option<PathRef>,
        active_engine_root: Option<PathRef>,
        pending_artifacts: Vec<PendingArtifact>,
        consumed_dialog: Option<&PathRef>,
        adopt_uncertain: bool,
    ) -> Result<CommitDurability, Error> {
        self.commit_registry_with_baseline(
            candidate,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            consumed_dialog,
            adopt_uncertain,
            None,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn commit_registry_with_baseline(
        &mut self,
        mut candidate: BTreeMap<String, Entry>,
        mut active_database_root: Option<PathRef>,
        mut active_puzzle_root: Option<PathRef>,
        mut active_engine_root: Option<PathRef>,
        mut pending_artifacts: Vec<PendingArtifact>,
        consumed_dialog: Option<&PathRef>,
        adopt_uncertain: bool,
        baseline: Option<RegistryAdmissionSnapshot>,
    ) -> Result<CommitDurability, Error> {
        candidate.retain(|id, _| !self.pending_unpersisted_removals.contains(id));
        pending_artifacts
            .retain(|pending| !self.pending_unpersisted_removals.contains(&pending.root.id));
        active_database_root = active_database_root.filter(|root| {
            !self.pending_unpersisted_removals.contains(&root.id)
                && candidate.contains_key(&root.id)
        });
        active_puzzle_root = active_puzzle_root.filter(|root| {
            !self.pending_unpersisted_removals.contains(&root.id)
                && candidate.contains_key(&root.id)
        });
        active_engine_root = active_engine_root.filter(|root| {
            !self.pending_unpersisted_removals.contains(&root.id)
                && candidate.contains_key(&root.id)
        });
        let durability = self.save_entries_with_baseline(
            &candidate,
            &active_database_root,
            &active_puzzle_root,
            &active_engine_root,
            &pending_artifacts,
            baseline,
            |target, write| atomic_replace(target, write),
        )?;
        self.registry_durability_pending = !matches!(durability, CommitDurability::Durable);
        if matches!(durability, CommitDurability::Durable) || adopt_uncertain {
            self.persistent = candidate;
            self.active_database_root = active_database_root;
            self.active_puzzle_root = active_puzzle_root;
            self.active_engine_root = active_engine_root;
            self.pending_artifacts = pending_artifacts;
            self.pending_unpersisted_removals.clear();
            self.loaded_candidate_ids
                .retain(|id| self.persistent.contains_key(id));
            self.session_protected_ids
                .retain(|id| self.persistent.contains_key(id));
            self.startup_retained_ids
                .retain(|id| self.persistent.contains_key(id));
            if let Some(dialog) = consumed_dialog {
                self.dialogs.remove(&dialog.id);
            }
        }
        Ok(durability)
    }
    fn save_entries_with<F>(
        &self,
        source: &BTreeMap<String, Entry>,
        active_database_root: &Option<PathRef>,
        active_puzzle_root: &Option<PathRef>,
        active_engine_root: &Option<PathRef>,
        pending_artifacts: &[PendingArtifact],
        replace: F,
    ) -> Result<CommitDurability, Error>
    where
        F: FnMut(
            &Path,
            Box<dyn FnOnce(&mut fs::File) -> Result<(), Error>>,
        ) -> Result<AtomicFileOutcome, Error>,
    {
        self.save_entries_with_baseline(
            source,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            None,
            replace,
        )
    }

    #[allow(clippy::too_many_arguments)] // one complete registry encoding plus its old baseline
    fn save_entries_with_baseline<F>(
        &self,
        source: &BTreeMap<String, Entry>,
        active_database_root: &Option<PathRef>,
        active_puzzle_root: &Option<PathRef>,
        active_engine_root: &Option<PathRef>,
        pending_artifacts: &[PendingArtifact],
        baseline: Option<RegistryAdmissionSnapshot>,
        mut replace: F,
    ) -> Result<CommitDurability, Error>
    where
        F: FnMut(
            &Path,
            Box<dyn FnOnce(&mut fs::File) -> Result<(), Error>>,
        ) -> Result<AtomicFileOutcome, Error>,
    {
        let candidate_snapshot = self.registry_admission_snapshot(
            source,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            &self.provisional_attachments,
            &self.retired_attachments,
            &self.image_cleanup,
        )?;
        let current_snapshot = if let Some(baseline) = baseline {
            baseline
        } else {
            self.registry_admission_snapshot(
                &self.persistent,
                &self.active_database_root,
                &self.active_puzzle_root,
                &self.active_engine_root,
                &self.pending_artifacts,
                &self.provisional_attachments,
                &self.retired_attachments,
                &self.image_cleanup,
            )?
        };
        if candidate_snapshot.unique_ids > MAX_AUTHORITY_IDS
            && candidate_snapshot.unique_ids > current_snapshot.unique_ids
        {
            return Err(Error::ResourceLimit(
                "path registry identifier limit reached".into(),
            ));
        }
        if candidate_snapshot.pending_count > MAX_PENDING_ARTIFACTS
            && candidate_snapshot.pending_count > current_snapshot.pending_count
        {
            return Err(Error::ResourceLimit(
                "pending path artifact limit reached".into(),
            ));
        }
        if candidate_snapshot.bytes > MAX_REGISTRY_BYTES
            && candidate_snapshot.bytes > current_snapshot.bytes
        {
            return Err(Error::ResourceLimit(
                "path registry serialized size limit reached".into(),
            ));
        }
        let bytes = candidate_snapshot.serialized;
        let mut attempt = || {
            let bytes = bytes.clone();
            replace(
                &self.registry_path,
                Box::new(move |f| f.write_all(&bytes).map_err(Error::from)),
            )
        };
        let outcome = match attempt() {
            Err(Error::Io(_)) => attempt()?,
            result => result?,
        };
        let stage = crate::infra::fs::map_atomic_file_outcome(
            outcome,
            crate::error::DurabilityStage::RegistryReplacement,
            |error| log::warn!("path authority registry replacement parent sync failed: {error}"),
        );
        Ok(match stage {
            Some(stage) => CommitDurability::DurabilityUncertain(stage),
            None => CommitDurability::Durable,
        })
    }
}

/// Takes the process-wide authority lock only long enough to open and bound the
/// image descriptor. The guard is dropped before this function returns.
pub(crate) fn engine_image_reader_for(
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    image: &EngineImageHandle,
    max_bytes: usize,
) -> Result<(VerifiedFile, u64), Error> {
    let mut lock = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    authority.open_engine_image(image, max_bytes)
}

/// Consumes the no-follow descriptor. `declared` is capped before it sizes the allocation, and
/// each read is limited to the remaining allowance plus one byte used to detect excess.
pub(crate) fn read_engine_image_bytes(
    file: VerifiedFile,
    declared: u64,
    max_bytes: usize,
) -> Result<Vec<u8>, Error> {
    let mut file = file.into_inner();
    read_bounded_bytes(
        &mut file,
        declared,
        max_bytes,
        "engine image exceeds the supported size limit",
        || Ok(()),
    )
}

fn validate_persisted_shape(entry: &StoredEntry) -> Result<(), Error> {
    if !matches!(
        entry.class,
        PathClass::PersistentCustomRoot | PathClass::PersistentFile
    ) || entry.operations.is_empty()
        || entry.id.id.is_empty()
        || entry.display_name.is_empty()
        || entry.target_is_dir != (entry.class == PathClass::PersistentCustomRoot)
    {
        return Err(Error::InvalidInput(
            "invalid persistent path registry entry".into(),
        ));
    }
    if let Some(purpose) = entry.purpose {
        let legacy_engine = purpose == EntryPurpose::EngineExecutable
            && same_operation_set(
                &entry.operations,
                &[
                    PathOperation::EngineExecute,
                    PathOperation::EngineConfigure,
                    PathOperation::EngineInstall,
                ],
            );
        let canonical = canonical_operations(purpose);
        let historical_subset = entry
            .operations
            .iter()
            .all(|operation| canonical.contains(operation));
        if !purpose_matches_shape(purpose, entry.class, entry.target_is_dir)
            || (!legacy_engine && !historical_subset)
        {
            return Err(Error::InvalidInput(
                "persistent path purpose does not match its authority shape".into(),
            ));
        }
    }
    Ok(())
}

fn validate_loaded_attachment_metadata(
    persistent: &BTreeMap<String, Entry>,
    provisional_ids: &BTreeSet<String>,
    image_cleanup: &[StoredEntry],
) -> Result<(), Error> {
    let is_attachment = |entry: &StoredEntry| {
        let Some(purpose) = entry.purpose else {
            return false;
        };
        matches!(
            purpose,
            EntryPurpose::EngineResource | EntryPurpose::EngineImage
        ) && purpose_matches_shape(purpose, entry.class, entry.target_is_dir)
            && entry.operations == canonical_operations(purpose)
    };

    for id in provisional_ids {
        let Some(entry) = persistent.get(id).map(|entry| &entry.stored) else {
            return Err(Error::InvalidInput(
                "provisional engine attachment is not a persistent entry".into(),
            ));
        };
        if !is_attachment(entry) {
            return Err(Error::InvalidInput(
                "provisional engine attachment has invalid authority shape".into(),
            ));
        }
    }

    let mut cleanup_ids = BTreeSet::new();
    for entry in image_cleanup {
        validate_persisted_shape(entry)?;
        if entry.class != PathClass::PersistentFile
            || entry.target_is_dir
            || entry.purpose != Some(EntryPurpose::EngineImage)
            || entry.operations != canonical_operations(EntryPurpose::EngineImage)
        {
            return Err(Error::InvalidInput(
                "engine image cleanup intent has invalid authority shape".into(),
            ));
        }
        if !cleanup_ids.insert(entry.id.id.clone()) || persistent.contains_key(&entry.id.id) {
            return Err(Error::InvalidInput(
                "duplicate or overlapping engine image cleanup intent".into(),
            ));
        }
        if provisional_ids.contains(&entry.id.id) {
            return Err(Error::InvalidInput(
                "engine attachment cannot be both provisional and cleanup-pending".into(),
            ));
        }
        let path = entry.path.to_path()?;
        let Some(leaf) = path.file_name() else {
            return Err(Error::InvalidInput(
                "engine image cleanup intent has no leaf".into(),
            ));
        };
        if uuid::Uuid::parse_str(&leaf.to_string_lossy()).is_err() {
            return Err(Error::InvalidInput(
                "engine image cleanup intent has an invalid leaf".into(),
            ));
        }
    }
    Ok(())
}

fn is_attachment_purpose(purpose: Option<EntryPurpose>) -> bool {
    matches!(
        purpose,
        Some(EntryPurpose::EngineResource | EntryPurpose::EngineImage)
    )
}

fn unique_registry_id_count(
    persistent: Vec<&str>,
    retired: Vec<&str>,
    cleanup: Vec<&str>,
    pending: Vec<&str>,
) -> usize {
    persistent
        .into_iter()
        .chain(retired)
        .chain(cleanup)
        .chain(pending)
        .collect::<BTreeSet<_>>()
        .len()
}

impl PathAuthority {
    fn registry_unique_id_count(&self) -> usize {
        unique_registry_id_count(
            self.persistent.keys().map(String::as_str).collect(),
            self.retired_attachments
                .keys()
                .map(String::as_str)
                .collect(),
            self.image_cleanup.keys().map(String::as_str).collect(),
            self.pending_artifacts
                .iter()
                .map(|pending| pending.id.id.as_str())
                .collect(),
        )
    }
}

fn read_registry_bytes(reader: impl Read) -> Result<Vec<u8>, Error> {
    let mut bytes = Vec::new();
    reader
        .take(MAX_LEGACY_REGISTRY_BYTES + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_LEGACY_REGISTRY_BYTES {
        return Err(Error::ResourceLimit(
            "path registry exceeds the legacy read limit".into(),
        ));
    }
    Ok(bytes)
}
enum CanonicalBindingStatus {
    Canonical,
    Leafless,
    NeedsRebinding,
    Failed(Error),
}

/// A leafless spelling — `/`, or one ending in `.` or `..` — has no name for a no-follow parent
/// walk to open, so acquisition and the load-time rebinding both leave it as the caller wrote it.
fn has_normal_leaf(path: &Path) -> bool {
    path.file_name()
        .is_some_and(|name| !name.is_empty() && name != OsStr::new(".") && name != OsStr::new(".."))
}

fn classify_canonical_binding(path: &Path) -> CanonicalBindingStatus {
    if !has_normal_leaf(path) {
        return CanonicalBindingStatus::Leafless;
    }
    match canonical_binding(path) {
        Ok(canonical) if canonical == path => CanonicalBindingStatus::Canonical,
        Ok(_) => CanonicalBindingStatus::NeedsRebinding,
        Err(error) => CanonicalBindingStatus::Failed(error),
    }
}

fn spelling_is_application_owned(app_data_dir: Option<&AppDataDir>, path: &Path) -> bool {
    if path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return false;
    }
    app_data_dir.as_ref().is_some_and(|dir| {
        AppOwnedDefaultRoot::ALL
            .iter()
            .any(|root| path.starts_with(dir.as_path().join(root.leaf())))
    })
}

/// An entry is outside the canonical-spelling requirement either because the application itself
/// registered the directory (`AppOwnedRoot`) or because the spelling names something inside one of
/// its own default roots. Both keep a deliberately raw spelling that `get_or_create_root` and
/// `cleanup_engine_images` compare lexically.
fn entry_keeps_its_raw_spelling(
    class: PathClass,
    app_data_dir: Option<&AppDataDir>,
    path: &Path,
) -> bool {
    class == PathClass::AppOwnedRoot || spelling_is_application_owned(app_data_dir, path)
}

fn refresh_entry(entry: &mut Entry, app_data_dir: Option<&AppDataDir>) {
    #[cfg(test)]
    REFRESH_ENTRY_HOOK.with(|slot| {
        if let Some(hook) = slot.borrow().as_ref() {
            hook(&entry.stored.id.id);
        }
    });
    let path = match entry.stored.path.to_path() {
        Ok(path) => path,
        Err(_) => {
            entry.availability = PathAvailability::Unavailable;
            return;
        }
    };
    let class = if entry.stored.target_is_dir {
        PathClass::PersistentCustomRoot
    } else {
        PathClass::PersistentFile
    };
    entry.availability =
        validate_target(&path, class).map_or(PathAvailability::Unavailable, |id| {
            if id == entry.stored.identity {
                if entry_keeps_its_raw_spelling(entry.stored.class, app_data_dir, &path) {
                    PathAvailability::Available
                } else {
                    match classify_canonical_binding(&path) {
                        CanonicalBindingStatus::Canonical | CanonicalBindingStatus::Leafless => {
                            PathAvailability::Available
                        }
                        CanonicalBindingStatus::NeedsRebinding
                        | CanonicalBindingStatus::Failed(_) => PathAvailability::Unavailable,
                    }
                }
            } else {
                PathAvailability::Unavailable
            }
        });
}
#[cfg(test)]
fn descriptor(stored: &StoredEntry, availability: PathAvailability) -> PathDescriptor {
    PathDescriptor {
        id: stored.id.clone(),
        display_name: stored.display_name.clone(),
        class: stored.class,
        availability,
    }
}

/// Assertions that hold on every target. `mod tests` below is `#[cfg(unix)]` as a whole, so a
/// platform-neutral property placed there would silently stop being proven off unix; these live
/// here instead, and the shared `PathAuthority` constructor lives here with them.
#[cfg(test)]
mod portable_tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    };
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    pub(super) struct TestClock(AtomicU64);
    impl TestClock {
        pub(super) fn new(v: u64) -> Self {
            Self(AtomicU64::new(v))
        }
        // Only the expiry tests advance the clock, and they are all unix-gated today.
        #[cfg_attr(not(unix), allow(dead_code))]
        pub(super) fn advance(&self, n: u64) {
            self.0.fetch_add(n, Ordering::SeqCst);
        }
    }
    impl Clock for TestClock {
        fn now(&self) -> SystemTime {
            UNIX_EPOCH + Duration::from_secs(self.0.load(Ordering::SeqCst))
        }
    }
    pub(super) fn authority(dir: &tempfile::TempDir, clock: Arc<TestClock>) -> PathAuthority {
        PathAuthority::open_with_clock(dir.path().join("registry.json"), vec![], clock, 2).unwrap()
    }

    /// `LaunchRootArgument` is `Option<EngineLaunchRoot>` on macOS and `()` everywhere else
    /// (`:3752-3754`), so a launch-root argument written at a call site compiles on exactly one of
    /// the two. Every test that opens the authority with an app-data context goes through this
    /// wrapper, which keeps the per-platform literal in one place; passing it as a value instead
    /// would trip `clippy::unit_arg` off macOS.
    #[cfg(unix)]
    pub(super) fn authority_with_app_data(
        registry_path: PathBuf,
        app_roots: Vec<AppOwnedRoot>,
        app_data_dir: Option<AppDataDir>,
        clock: Arc<dyn Clock>,
        dialog_capacity: usize,
    ) -> Result<PathAuthority, Error> {
        #[cfg(target_os = "macos")]
        {
            PathAuthority::open_with_app_data(
                registry_path,
                app_roots,
                app_data_dir,
                clock,
                dialog_capacity,
                None,
            )
        }
        #[cfg(not(target_os = "macos"))]
        {
            PathAuthority::open_with_app_data(
                registry_path,
                app_roots,
                app_data_dir,
                clock,
                dialog_capacity,
                (),
            )
        }
    }

    /// The missing-file arm of `create_pgn_export_destination`: the eleven un-ignored PGN tests
    /// all write their fixture first, so only this one drives the exclusive create, the two
    /// `sync_all`s and the promotion to a persistent read/write capability.
    #[test]
    fn pgn_export_destination_is_persistent_writable_and_rejects_non_pgn_targets() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("export.pgn");
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let destination = authority
            .create_pgn_export_destination(&path, "export.pgn")
            .unwrap();
        assert!(path.is_file());
        assert!(authority
            .resolve(destination.handle.path_ref(), PathOperation::ReadPgn, &[],)
            .is_ok());
        assert!(authority
            .resolve(destination.handle.path_ref(), PathOperation::WritePgn, &[],)
            .is_ok());
        assert!(matches!(
            authority.create_pgn_export_destination(&dir.path().join("export.txt"), "export.txt"),
            Err(Error::InvalidInput(_))
        ));
    }
}

#[cfg(unix)]
#[cfg(test)]
mod tests {
    use super::portable_tests::{authority, authority_with_app_data, TestClock};
    use super::resolved::file_identity;
    use super::*;
    use crate::infra::blocking::source_scan::body_at_indent;
    use crate::infra::fs::{
        set_test_atomic_file_injector, AtomicFileFaultPoint, AtomicInstalledFile,
        AtomicWriterInjector,
    };
    #[cfg(unix)]
    use crate::infra::fs::{set_test_removal_injector, RemovalFault, RemovalFaultPoint};
    use std::{
        os::unix::ffi::OsStringExt,
        sync::{atomic::Ordering, Mutex},
    };

    static CURRENT_DIR_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[cfg(unix)]
    fn observed_identity(path: &Path) -> (u64, u64) {
        use std::os::unix::fs::MetadataExt;
        let metadata = fs::symlink_metadata(path).unwrap();
        (metadata.dev(), metadata.ino())
    }

    const _: fn(VerifiedFile, u64, usize) -> Result<Vec<u8>, Error> = read_engine_image_bytes;

    #[test]
    fn staged_hash_core_cancels_between_real_read_chunks() {
        struct HeldReader {
            entered: Option<std::sync::mpsc::SyncSender<()>>,
            release: std::sync::mpsc::Receiver<()>,
            finished: bool,
        }
        impl Read for HeldReader {
            fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
                if self.finished {
                    return Ok(0);
                }
                self.finished = true;
                if let Some(entered) = self.entered.take() {
                    let _ = entered.send(());
                }
                let _ = self.release.recv_timeout(Duration::from_secs(5));
                buffer[..64].fill(7);
                Ok(64)
            }
        }

        let cancellation = tokio_util::sync::CancellationToken::new();
        let worker_cancellation = cancellation.clone();
        let (entered_tx, entered_rx) = std::sync::mpsc::sync_channel(1);
        let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);
        let worker = std::thread::spawn(move || {
            sha256_reader_cancellable(
                &mut HeldReader {
                    entered: Some(entered_tx),
                    release: release_rx,
                    finished: false,
                },
                &worker_cancellation,
            )
        });
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        cancellation.cancel();
        release_tx.send(()).unwrap();
        assert!(matches!(worker.join().unwrap(), Err(Error::Cancellation)));
    }

    type EngineImageReaderForFn = fn(
        &std::sync::Mutex<Option<PathAuthority>>,
        &EngineImageHandle,
        usize,
    ) -> Result<(VerifiedFile, u64), Error>;
    type RegisterEngineImageFn = fn(
        &mut PathAuthority,
        &AuthorizedDir,
        &OsStr,
        VerifiedIdentity,
        String,
    ) -> Result<EngineImageHandle, Error>;
    /// Compile-time arity pins for the engine-image split (`d-20260903-08`). A typed binding
    /// inside a test body is what both the ordinary and the branch-coverage build count as a
    /// use of the aliases; an anonymous `const _` did not, and inlining the types trips
    /// `clippy::type_complexity`.
    #[test]
    fn engine_image_split_arities_are_pinned() {
        let _: EngineImageReaderForFn = engine_image_reader_for;
        let _: RegisterEngineImageFn = PathAuthority::register_engine_image;
    }
    fn registered_engine_image(
        dir: &tempfile::TempDir,
        contents: &[u8],
    ) -> (Mutex<Option<PathAuthority>>, EngineImageHandle, PathBuf) {
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = OsStr::new("image.png");
        let (_, installed) = image_dir
            .atomic_replace_leaf_identified(leaf, |file| {
                file.write_all(contents).map_err(Error::from)
            })
            .unwrap();
        let image = image_dir.path().join(leaf);
        let mut authority = authority(dir, Arc::new(TestClock::new(0)));
        let handle = authority
            .register_engine_image(&image_dir, leaf, installed, "image".into())
            .expect("adopted image handle");
        (Mutex::new(Some(authority)), handle, image)
    }

    #[cfg(unix)]
    #[test]
    fn resolved_path_identity_reads_the_descriptor_not_the_pathname() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("engine");
        let original = dir.path().join("engine-original");
        fs::write(&path, b"original").unwrap();
        let original_identity = validate_target(&path, PathClass::PersistentFile).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let registered = authority
            .migrate_legacy_os_path(
                path.clone().into_os_string(),
                "engine",
                PathClass::PersistentFile,
                vec![PathOperation::EngineInstall],
            )
            .unwrap();
        let resolved = authority
            .resolve(&registered.id, PathOperation::EngineInstall, &[])
            .unwrap();

        fs::rename(&path, &original).unwrap();
        fs::write(&path, b"replacement").unwrap();
        let replacement_identity = validate_target(&path, PathClass::PersistentFile).unwrap();

        assert_ne!(original_identity, replacement_identity);
        assert_eq!(
            resolved.identity().unwrap().pair(),
            (original_identity.a, original_identity.b)
        );
    }

    #[cfg(unix)]
    #[test]
    fn engine_image_install_uses_the_authorized_directory_after_pathname_swap() {
        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let image_dir =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::EngineImages).unwrap();
        let original = dir.path().join("engine-images-original");
        fs::rename(image_dir.path(), &original).unwrap();
        fs::create_dir(image_dir.path()).unwrap();

        image_dir
            .atomic_replace_leaf_identified(OsStr::new("image.png"), |file| {
                file.write_all(b"descriptor bytes").map_err(Error::from)
            })
            .unwrap()
            .0
            .expect_durable();

        assert_eq!(
            fs::read(original.join("image.png")).unwrap(),
            b"descriptor bytes"
        );
        assert_eq!(fs::read_dir(image_dir.path()).unwrap().count(), 0);
    }

    #[test]
    fn engine_image_registration_stores_the_installed_identity() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = OsStr::new("image.png");
        let (_, installed) = image_dir
            .atomic_replace_leaf_identified(leaf, |file| {
                file.write_all(b"image").map_err(Error::from)
            })
            .unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));

        let handle = authority
            .register_engine_image(&image_dir, leaf, installed, "image".into())
            .unwrap();
        let stored = &authority.persistent[&handle.id.id].stored.identity;

        assert_eq!((stored.a, stored.b), installed.pair());
    }

    #[cfg(unix)]
    #[test]
    fn engine_image_registration_refuses_a_swap_and_stores_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = OsStr::new("image.png");
        let (_, installed) = image_dir
            .atomic_replace_leaf_identified(leaf, |file| {
                file.write_all(b"installed").map_err(Error::from)
            })
            .unwrap();
        let original = dir.path().join("engine-images-original");
        fs::rename(image_dir.path(), &original).unwrap();
        fs::create_dir(image_dir.path()).unwrap();
        fs::write(image_dir.path().join(leaf), b"impostor").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));

        let error = authority
            .register_engine_image(&image_dir, leaf, installed, "image".into())
            .expect_err("the pathname replacement must not be registered");

        let Error::Conflict(message) = error else {
            panic!("unexpected refusal: {error:?}");
        };
        assert!(!message.contains('/'), "{message}");
        assert!(!message.contains("image.png"), "{message}");
        assert!(authority.persistent.is_empty());
        image_dir.remove_leaf_identified(leaf, installed).unwrap();
        assert!(!original.join(leaf).exists());
        assert_eq!(fs::read(image_dir.path().join(leaf)).unwrap(), b"impostor");
    }

    #[test]
    fn engine_image_inner_registration_refuses_mismatch_and_orphan_is_removed() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let other_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Databases,
        )
        .unwrap();
        let leaf = OsStr::new("image.png");
        let (_, installed) = image_dir
            .atomic_replace_leaf_identified(leaf, |file| {
                file.write_all(b"installed").map_err(Error::from)
            })
            .unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));

        let error = authority
            .register_engine_image(&image_dir, leaf, other_dir.identity(), "image".into())
            .expect_err("a mismatched required identity must be refused");
        image_dir.remove_leaf_identified(leaf, installed).unwrap();

        let Error::Conflict(message) = error else {
            panic!("unexpected refusal: {error:?}");
        };
        assert!(!message.contains('/'), "{message}");
        assert!(!message.contains("image.png"), "{message}");
        assert!(authority.persistent.is_empty());
        assert!(!image_dir.path().join(leaf).exists());
    }

    #[test]
    fn register_engine_image_refuses_non_leaf_names_without_disclosure() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        for leaf in [
            OsStr::new("/private/image.png"),
            OsStr::new("nested/image.png"),
        ] {
            let error = authority
                .register_engine_image(&image_dir, leaf, image_dir.identity(), "image".into())
                .expect_err("non-leaf names must be refused before joining");
            let Error::InvalidInput(message) = error else {
                panic!("unexpected refusal: {error:?}");
            };
            assert!(!message.contains('/'), "{message}");
            assert!(
                !message.contains(leaf.to_string_lossy().as_ref()),
                "{message}"
            );
        }
        assert!(authority.persistent.is_empty());
    }

    #[test]
    fn persistent_file_reuse_refuses_a_disagreeing_expected_identity() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file");
        fs::write(&file, b"file").unwrap();
        let other_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Databases,
        )
        .unwrap();
        let operations = vec![PathOperation::PuzzleRead];
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        authority
            .get_or_create_persistent_file(&file, "file", operations.clone())
            .unwrap();

        let error = authority
            .get_or_create_persistent_file_verified(&file, "file", operations, other_dir.identity())
            .expect_err("the reuse arm must compare the required identity");

        assert!(matches!(error, Error::Conflict(_)), "{error:?}");
        assert_eq!(authority.persistent.len(), 1);
    }

    #[test]
    fn migrate_legacy_verified_identity_mismatch_is_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file");
        fs::write(&file, b"file").unwrap();
        let other_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Databases,
        )
        .unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));

        let error = authority
            .migrate_legacy_os_path_inner(
                file.into_os_string(),
                "file".into(),
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
                Some(other_dir.identity()),
            )
            .expect_err("the migrate arm must compare the required identity");

        let Error::Conflict(message) = error else {
            panic!("unexpected refusal: {error:?}");
        };
        assert!(!message.contains('/'), "{message}");
        assert!(!message.contains("file"), "{message}");
        assert!(authority.persistent.is_empty());
    }

    #[test]
    fn database_child_identity_mismatch_is_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let databases = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Databases,
        )
        .unwrap();
        let engines = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Engines,
        )
        .unwrap();
        let validated = validate_target(databases.path(), PathClass::PersistentCustomRoot).unwrap();

        let error = verified_identity::database_child_identity(engines.identity(), &validated)
            .expect_err("the descriptor and pathname identities disagree");

        let Error::Conflict(message) = error else {
            panic!("unexpected refusal: {error:?}");
        };
        assert!(!message.contains('/'), "{message}");
        assert!(!message.contains("db"), "{message}");
    }

    #[cfg(unix)]
    #[test]
    fn register_database_child_identity_mismatch_is_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("databases");
        fs::create_dir(&root_path).unwrap();
        let child = root_path.join("child.db3");
        let replacement = dir.path().join("replacement.db3");
        fs::write(&child, b"original").unwrap();
        fs::write(&replacement, b"replacement").unwrap();
        let original_identity = observed_identity(&child);
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_database_root(&root_path, "Databases", None)
            .unwrap();

        DATABASE_CHILD_POST_RESOLVE_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move || {
                    fs::rename(replacement, child).unwrap();
                })))
                .is_none());
        });
        let error = authority
            .register_database_child(
                &root,
                OsStr::new("child.db3"),
                "child.db3",
                original_identity,
            )
            .expect_err("the descriptor and joined pathname identities disagree");

        let Error::Conflict(message) = error else {
            panic!("unexpected refusal: {error:?}");
        };
        assert_eq!(message, VERIFIED_REGISTRATION_CONFLICT);
        assert!(!message.contains('/'), "{message}");
        assert!(!message.contains("child.db3"), "{message}");
    }

    #[cfg(unix)]
    #[test]
    fn create_database_child_is_exclusive_listable_and_validates_names() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("databases");
        fs::create_dir(&root_path).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_database_root(&root_path, "Databases", None)
            .unwrap();

        let created = authority
            .create_database_child(&root, OsStr::new("created.db3"))
            .unwrap();
        assert_eq!(fs::read(root_path.join("created.db3")).unwrap(), b"");
        let listed = authority
            .list_database_children_cancellable(&root, &CancellationToken::new())
            .unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].handle, created);

        fs::write(root_path.join("existing.db3"), b"original").unwrap();
        let conflict = authority
            .create_database_child(&root, OsStr::new("existing.db3"))
            .expect_err("exclusive creation must preserve an existing database");
        assert!(matches!(conflict, Error::Conflict(_)));
        assert_eq!(
            fs::read(root_path.join("existing.db3")).unwrap(),
            b"original"
        );

        for filename in [
            OsStr::new("no-extension"),
            OsStr::new("nested/child.db3"),
            OsStr::new(""),
        ] {
            assert!(authority.create_database_child(&root, filename).is_err());
        }
    }

    #[cfg(unix)]
    #[test]
    fn list_workspace_databases_cancels_between_entries_before_later_durable_registration() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("databases");
        fs::create_dir(&root_path).unwrap();
        for name in ["one.db3", "two.db3", "three.db3"] {
            fs::write(root_path.join(name), b"database").unwrap();
        }
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_database_root(&root_path, "Databases", None)
            .unwrap();
        let cancellation = CancellationToken::new();
        let cancel_after_first = cancellation.clone();
        DATABASE_CHILD_POST_RESOLVE_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move || cancel_after_first.cancel())))
                .is_none());
        });

        assert!(matches!(
            authority.list_database_children_cancellable(&root, &cancellation),
            Err(Error::Cancellation)
        ));
        let registered = authority
            .persistent
            .values()
            .filter(|entry| entry.stored.purpose == Some(EntryPurpose::DatabaseFile))
            .count();
        assert_eq!(registered, 1, "only the completed entry may be durable");
    }

    #[cfg(unix)]
    #[test]
    fn list_puzzle_databases_cancels_between_entries_before_later_durable_registration() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("puzzles");
        fs::create_dir(&root_path).unwrap();
        for name in ["one.db3", "two.db3", "three.db3"] {
            fs::write(root_path.join(name), b"database").unwrap();
        }
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_puzzle_root(&root_path, "Puzzles", None)
            .unwrap();
        let cancellation = CancellationToken::new();
        let cancel_after_first = cancellation.clone();
        PUZZLE_CHILD_POST_RESOLVE_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move || cancel_after_first.cancel())))
                .is_none());
        });

        assert!(matches!(
            authority.list_puzzle_children_cancellable(&root, &cancellation),
            Err(Error::Cancellation)
        ));
        let registered = authority
            .persistent
            .values()
            .filter(|entry| entry.stored.purpose == Some(EntryPurpose::PuzzleFile))
            .count();
        assert_eq!(registered, 1, "only the completed entry may be durable");
    }

    #[cfg(unix)]
    #[test]
    fn create_database_child_cleans_through_retained_root_after_path_swap() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("databases");
        let moved_root = dir.path().join("databases-moved");
        let outside = dir.path().join("outside");
        fs::create_dir(&root_path).unwrap();
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("sentinel.db3"), b"outside").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_database_root(&root_path, "Databases", None)
            .unwrap();
        let hook_root = root_path.clone();
        let hook_moved = moved_root.clone();
        let hook_outside = outside.clone();
        DATABASE_CHILD_POST_RESOLVE_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move || {
                    fs::rename(&hook_root, &hook_moved).unwrap();
                    symlink(&hook_outside, &hook_root).unwrap();
                })))
                .is_none());
        });

        let error = authority
            .create_database_child(&root, OsStr::new("created.db3"))
            .expect_err("registration must reject the swapped logical root");
        assert!(matches!(error, Error::InvalidInput(_) | Error::Conflict(_)));
        assert!(!moved_root.join("created.db3").exists());
        assert!(!outside.join("created.db3").exists());
        assert_eq!(fs::read(outside.join("sentinel.db3")).unwrap(), b"outside");
    }

    #[cfg(unix)]
    #[test]
    fn create_database_child_refuses_late_file_and_symlink_substitution() {
        use std::os::unix::fs::symlink;

        for symlink_leaf in [false, true] {
            let dir = tempfile::tempdir().unwrap();
            let root_path = dir.path().join("databases");
            let outside = dir.path().join("outside.db3");
            fs::create_dir(&root_path).unwrap();
            fs::write(&outside, b"outside").unwrap();
            let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
            let root = authority
                .get_or_create_database_root(&root_path, "Databases", None)
                .unwrap();
            let leaf = root_path.join("late.db3");
            let hook_leaf = leaf.clone();
            let hook_outside = outside.clone();
            DATABASE_CHILD_POST_RESOLVE_HOOK.with(|slot| {
                assert!(slot
                    .replace(Some(Box::new(move || {
                        if symlink_leaf {
                            symlink(&hook_outside, &hook_leaf).unwrap();
                        } else {
                            fs::write(&hook_leaf, b"original").unwrap();
                        }
                    })))
                    .is_none());
            });

            let error = authority
                .create_database_child(&root, OsStr::new("late.db3"))
                .expect_err("exclusive creation must refuse the late leaf");
            assert!(matches!(error, Error::Conflict(_)));
            if symlink_leaf {
                assert_eq!(fs::read(&outside).unwrap(), b"outside");
                assert!(fs::symlink_metadata(&leaf)
                    .unwrap()
                    .file_type()
                    .is_symlink());
            } else {
                assert_eq!(fs::read(&leaf).unwrap(), b"original");
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn create_database_child_does_not_adopt_or_unlink_substituted_leaf() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("databases");
        let original = root_path.join("original.db3");
        let replacement = root_path.join("created.db3");
        fs::create_dir(&root_path).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_database_root(&root_path, "Databases", None)
            .unwrap();
        let hook_original = original.clone();
        let hook_replacement = replacement.clone();
        DATABASE_CHILD_POST_CREATE_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move || {
                    fs::rename(&hook_replacement, &hook_original).unwrap();
                    fs::write(&hook_replacement, b"replacement").unwrap();
                })))
                .is_none());
        });

        let error = authority
            .create_database_child(&root, OsStr::new("created.db3"))
            .expect_err("registration must reject the substituted inode");
        assert!(matches!(error, Error::OperationAndCleanup { .. }));
        assert_eq!(fs::read(&replacement).unwrap(), b"replacement");
        assert_eq!(fs::read(&original).unwrap(), b"");
        assert!(authority.persistent.values().all(|entry| entry
            .stored
            .path
            .to_path()
            .ok()
            .as_ref()
            != Some(&replacement)));
    }

    #[cfg(unix)]
    #[test]
    fn create_database_child_registry_failure_cleans_created_leaf_and_reports_cleanup_failure() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("databases");
        fs::create_dir(&root_path).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_database_root(&root_path, "Databases", None)
            .unwrap();

        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        let error = authority
            .create_database_child(&root, OsStr::new("failed.db3"))
            .expect_err("registry failure must be returned");
        set_test_atomic_file_injector(None);
        assert!(matches!(error, Error::Io(_)));
        assert!(!root_path.join("failed.db3").exists());

        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        set_test_removal_injector(Some(Arc::new(RemovalFault(
            RemovalFaultPoint::BeforeTopOpen,
        ))));
        let error = authority
            .create_database_child(&root, OsStr::new("cleanup-failed.db3"))
            .expect_err("cleanup failure must be surfaced with the registry failure");
        set_test_atomic_file_injector(None);
        set_test_removal_injector(None);
        assert!(matches!(error, Error::OperationAndCleanup { .. }));
        assert!(root_path.join("cleanup-failed.db3").exists());
    }

    #[test]
    fn guarded_registrars_require_the_resolved_descriptor_identity() {
        let source = include_str!("mod.rs");
        for signature in [
            "pub(crate) fn register_installed_engine(",
            "fn register_puzzle_child(",
        ] {
            let body = body_at_indent(source, signature);
            assert!(body.contains("let resolved = self.resolve("), "{body}");
            assert!(body.contains("resolved.identity()?"), "{body}");
            assert!(!body.contains("let _ = self.resolve("), "{body}");
            assert!(!body.contains("validate_target("), "{body}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn installed_engine_registration_persists_resolved_identity_across_a_path_swap() {
        use std::os::unix::fs::MetadataExt;
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("engines");
        fs::create_dir(&root_path).unwrap();
        let engine = root_path.join("engine");
        let replacement = root_path.join("replacement");
        let original = root_path.join("original");
        fs::write(&engine, b"original").unwrap();
        fs::write(&replacement, b"replacement").unwrap();
        let original_metadata = fs::metadata(&engine).unwrap();
        let original_identity = (original_metadata.dev(), original_metadata.ino());
        let clock = Arc::new(TestClock::new(0));
        let mut authority = authority(&dir, clock);
        let root = authority
            .get_or_create_engine_root(&root_path, "Engines", None)
            .unwrap();

        let swap_engine = engine.clone();
        INSTALLED_ENGINE_POST_RESOLVE_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move || {
                    fs::rename(&swap_engine, original).unwrap();
                    fs::rename(replacement, swap_engine).unwrap();
                })))
                .is_none());
        });
        let handle = authority
            .register_installed_engine(&root, "engine")
            .expect("resolved descriptor identity is persisted despite pathname replacement");
        let stored = &authority.persistent[&handle.id.id].stored;
        assert_eq!((stored.identity.a, stored.identity.b), original_identity);
        let id = handle.id.id.clone();
        drop(authority);

        let mut reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let reopened_identity = &reopened.persistent[&id].stored.identity;
        assert_eq!(
            (reopened_identity.a, reopened_identity.b),
            original_identity
        );
        assert!(reopened
            .resolve(handle.path_ref(), PathOperation::EngineExecute, &[])
            .is_err());
    }

    #[test]
    fn installed_engine_registration_reuses_id_and_refuses_invalid_paths_and_directories() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("engines");
        fs::create_dir(&root_path).unwrap();
        fs::write(root_path.join("engine"), b"engine").unwrap();
        fs::create_dir(root_path.join("directory")).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_engine_root(&root_path, "Engines", None)
            .unwrap();
        let first = authority
            .register_installed_engine(&root, "engine")
            .unwrap();
        let second = authority
            .register_installed_engine(&root, "engine")
            .unwrap();
        assert_eq!(first.id, second.id);
        for invalid in ["", "../engine", "/engine", "directory"] {
            assert!(
                authority.register_installed_engine(&root, invalid).is_err(),
                "{invalid}"
            );
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink("engine", root_path.join("link")).unwrap();
            assert!(authority.register_installed_engine(&root, "link").is_err());
        }
        drop(authority);
        let mut reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let after_restart = reopened.register_installed_engine(&root, "engine").unwrap();
        assert_eq!(first.id, after_restart.id);

        let replacement = root_path.join("replacement");
        fs::write(&replacement, b"replacement").unwrap();
        fs::remove_file(root_path.join("engine")).unwrap();
        fs::rename(replacement, root_path.join("engine")).unwrap();
        let entries_before_refusal = reopened.persistent.len();
        let error = reopened
            .register_installed_engine(&root, "engine")
            .expect_err("a replaced engine must not reuse its stored capability");
        assert!(matches!(
            error,
            Error::Conflict(message)
                if message == "persistent file changed; acquire a new capability"
        ));
        assert_eq!(reopened.persistent.len(), entries_before_refusal);
    }

    #[test]
    fn installed_engine_registration_keeps_registry_unchanged_on_persistence_failure() {
        struct RegistryFailure;
        impl AtomicWriterInjector for RegistryFailure {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::TempfileCreate {
                    Err(std::io::Error::other("registry failure"))
                } else {
                    Ok(())
                }
            }
        }
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("engines");
        fs::create_dir(&root_path).unwrap();
        fs::write(root_path.join("engine"), b"engine").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_engine_root(&root_path, "Engines", None)
            .unwrap();
        let before = authority.persistent.len();
        set_test_atomic_file_injector(Some(Arc::new(RegistryFailure)));
        let result = authority.register_installed_engine(&root, "engine");
        set_test_atomic_file_injector(None);
        assert!(result.is_err());
        assert_eq!(authority.persistent.len(), before);
    }

    #[cfg(unix)]
    #[test]
    fn resolve_regular_swap_to_fifo_is_prompt_for_read_and_write_access() {
        for operation in [PathOperation::ReadPgn, PathOperation::WritePgn] {
            let dir = tempfile::tempdir().unwrap();
            let root_path = dir.path().join("workspace");
            fs::create_dir(&root_path).unwrap();
            let file = root_path.join("game.pgn");
            let original = root_path.join("original.pgn");
            fs::write(&file, b"*").unwrap();
            let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
            let grant = authority
                .grant_dialog_operations(
                    &root_path,
                    "Workspace",
                    PathClass::BoundedDialogGrant,
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                    Duration::from_secs(60),
                    1,
                )
                .unwrap();
            let root = authority
                .promote_dialog(
                    &grant,
                    PathClass::PersistentCustomRoot,
                    "Workspace",
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                )
                .unwrap();
            let swap_file = file.clone();
            RESOLVE_PRE_REGULAR_OPEN_HOOK.with(|slot| {
                assert!(slot
                    .replace(Some(Box::new(move || {
                        fs::rename(&swap_file, original).unwrap();
                        let status = std::process::Command::new("mkfifo")
                            .arg(swap_file)
                            .status()
                            .unwrap();
                        assert!(status.success());
                    })))
                    .is_none());
            });
            let release_fifo = file.clone();
            let (completed_tx, completed_rx) = std::sync::mpsc::channel();
            let watchdog = std::thread::spawn(move || {
                if completed_rx.recv_timeout(Duration::from_secs(2)).is_err() {
                    let _ = fs::OpenOptions::new()
                        .read(true)
                        .write(true)
                        .open(release_fifo);
                }
            });
            let started = std::time::Instant::now();
            let result = authority.resolve(&root.id, operation, &[OsString::from("game.pgn")]);
            let elapsed = started.elapsed();
            let _ = completed_tx.send(());
            watchdog.join().unwrap();
            assert!(result.is_err());
            assert!(
                elapsed < Duration::from_secs(1),
                "FIFO open blocked for {elapsed:?}"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_enforces_the_exact_stored_operation() {
        let dir = tempfile::tempdir().unwrap();
        let database = dir.path().join("readonly.db3");
        fs::write(&database, b"database").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let grant = authority
            .grant_dialog(
                &database,
                "readonly",
                PathClass::SingleDialogGrant,
                PathOperation::DatabaseRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let committed = authority
            .promote_dialog(
                &grant,
                PathClass::PersistentFile,
                "readonly",
                vec![PathOperation::DatabaseRead],
            )
            .unwrap();
        let handle = DatabaseHandle::new(committed.id);

        let target = authority
            .database_file_target(&handle, PathOperation::DatabaseRead)
            .unwrap();
        assert_eq!(target.leaf(), OsStr::new("readonly.db3"));
        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DatabaseMutate),
            Err(Error::InvalidInput(_))
        ));
        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DatabaseExport),
            Err(Error::InvalidInput(_))
        ));
        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DatabaseCreate),
            Err(Error::InvalidInput(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn is_database_file_operation_classifies_every_variant() {
        fn oracle(operation: PathOperation) -> bool {
            match operation {
                PathOperation::DatabaseRead
                | PathOperation::DatabaseMutate
                | PathOperation::DatabaseCreate
                | PathOperation::DatabaseExport => true,
                PathOperation::ReadPgn
                | PathOperation::WritePgn
                | PathOperation::PuzzleRead
                | PathOperation::PuzzleDelete
                | PathOperation::EngineExecute
                | PathOperation::EngineConfigure
                | PathOperation::EngineBinaryInspect
                | PathOperation::EngineResourceRead
                | PathOperation::OpeningBookRead
                | PathOperation::ImageRead
                | PathOperation::DownloadFile
                | PathOperation::DownloadArchive
                | PathOperation::EngineInstall
                | PathOperation::SnapshotWrite
                | PathOperation::LogWrite
                | PathOperation::OpenShell => false,
            }
        }

        let operations = [
            PathOperation::ReadPgn,
            PathOperation::WritePgn,
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
            PathOperation::DatabaseCreate,
            PathOperation::DatabaseExport,
            PathOperation::PuzzleRead,
            PathOperation::PuzzleDelete,
            PathOperation::EngineExecute,
            PathOperation::EngineConfigure,
            PathOperation::EngineBinaryInspect,
            PathOperation::EngineResourceRead,
            PathOperation::OpeningBookRead,
            PathOperation::ImageRead,
            PathOperation::DownloadFile,
            PathOperation::DownloadArchive,
            PathOperation::EngineInstall,
            PathOperation::SnapshotWrite,
            PathOperation::LogWrite,
            PathOperation::OpenShell,
        ];
        for operation in operations {
            assert_eq!(is_database_file_operation(operation), oracle(operation));
        }
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_mints_all_database_operations_for_a_created_child() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("databases");
        fs::create_dir(&root_path).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_database_root(&root_path, "Databases", None)
            .unwrap();
        let handle = authority
            .create_database_child(&root, OsStr::new("created.db3"))
            .unwrap();
        let expected_path = root_path.canonicalize().unwrap().join("created.db3");
        let expected_identity =
            opened_file_identity(&fs::File::open(&expected_path).unwrap()).unwrap();
        authority.session_protected_ids.clear();

        for operation in [
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
            PathOperation::DatabaseCreate,
            PathOperation::DatabaseExport,
        ] {
            let target = authority.database_file_target(&handle, operation).unwrap();
            assert_eq!(target.identity(), expected_identity);
            assert_eq!(target.path(), expected_path);
            assert_eq!(target.leaf(), OsStr::new("created.db3"));
        }
        assert!(authority
            .session_protected_ids
            .contains(&handle.path_ref().id));
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_rejects_non_database_operations_before_path_access() {
        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().join("pgn");
        let path = parent.join("study.pgn");
        fs::create_dir(&parent).unwrap();
        fs::write(&path, b"*").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let grant = authority
            .grant_dialog(
                &path,
                "study",
                PathClass::SingleDialogGrant,
                PathOperation::WritePgn,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let committed = authority
            .promote_dialog(
                &grant,
                PathClass::PersistentFile,
                "study",
                vec![PathOperation::WritePgn],
            )
            .unwrap();
        let handle = DatabaseHandle::new(committed.id);
        fs::remove_dir_all(&parent).unwrap();

        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::WritePgn),
            Err(Error::InvalidInput(message)) if message == "invalid database file operation"
        ));
        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DownloadFile),
            Err(Error::InvalidInput(message)) if message == "invalid database file operation"
        ));
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_rejects_directory_entries_before_path_access() {
        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().join("directories");
        let path = parent.join("database.db3");
        fs::create_dir_all(&path).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let committed = authority
            .migrate_legacy_os_path(
                path.clone().into_os_string(),
                "database",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::DatabaseRead],
            )
            .unwrap();
        let handle = DatabaseHandle::new(committed.id);
        fs::remove_dir_all(&parent).unwrap();

        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DatabaseRead),
            Err(Error::InvalidInput(message))
                if message == "database handle must identify a regular file"
        ));
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_binds_a_symlinked_ancestor_to_its_canonical_parent() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        let path = link.join("x.db3");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("x.db3"), b"database").unwrap();
        symlink(&real, &link).unwrap();
        let real_directory = authorize_existing_dir(&real).unwrap();
        let verified_file = real_directory
            .open_leaf_identified(OsStr::new("x.db3"))
            .unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let canonicalized = authority
            .migrate_legacy_os_path(
                path.clone().into_os_string(),
                "x",
                PathClass::PersistentFile,
                vec![
                    PathOperation::DatabaseRead,
                    PathOperation::DatabaseMutate,
                    PathOperation::DatabaseCreate,
                    PathOperation::DatabaseExport,
                ],
            )
            .unwrap();
        assert_eq!(
            authority.persistent[&canonicalized.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("x.db3")
        );
        let raw_spelling = authority
            .get_or_create_persistent_file_verified(
                &path,
                "x",
                canonical_operations(EntryPurpose::DatabaseFile),
                verified_file,
            )
            .unwrap();
        assert_eq!(
            authority.persistent[&raw_spelling.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            path
        );
        let handle = DatabaseHandle::new(raw_spelling.id);
        let target = authority
            .database_file_target(&handle, PathOperation::DatabaseMutate)
            .unwrap();
        assert_eq!(target.path(), real.join("x.db3"));
        assert_eq!(target.leaf(), OsStr::new("x.db3"));
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_rejects_a_replaced_leaf_before_minting() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().join("databases");
        let path = parent.join("database.db3");
        let moved = dir.path().join("moved.db3");
        fs::create_dir(&parent).unwrap();
        fs::write(&path, b"database").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let committed = authority
            .migrate_legacy_os_path(
                path.clone().into_os_string(),
                "database",
                PathClass::PersistentFile,
                canonical_operations(EntryPurpose::DatabaseFile),
            )
            .unwrap();
        let handle = DatabaseHandle::new(committed.id);
        fs::rename(&path, &moved).unwrap();
        symlink(&moved, &path).unwrap();

        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DatabaseRead),
            Err(Error::InvalidInput(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_rejects_a_leaf_replaced_before_the_proof() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().join("databases");
        let path = parent.join("database.db3");
        let moved = dir.path().join("moved.db3");
        fs::create_dir(&parent).unwrap();
        fs::write(&path, b"database").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let committed = authority
            .migrate_legacy_os_path(
                path.clone().into_os_string(),
                "database",
                PathClass::PersistentFile,
                canonical_operations(EntryPurpose::DatabaseFile),
            )
            .unwrap();
        let handle = DatabaseHandle::new(committed.id);
        fs::hard_link(&path, &moved).unwrap();
        let hook_path = path.clone();
        let hook_moved = moved.clone();
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            assert!(slot
                .replace(Some(Box::new(move || {
                    fs::remove_file(&hook_path).unwrap();
                    symlink(&hook_moved, &hook_path).unwrap();
                })))
                .is_none());
        });

        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DatabaseRead),
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn database_file_target_open_current_authenticates_the_authorized_file() {
        const CONFLICT: &str = "database changed after capability resolution";
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("database.db3");
        fs::write(&path, b"database").unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();

        let opened = target.open_current().unwrap();
        assert_eq!(opened_file_identity(&opened).unwrap(), target.identity());

        fs::remove_file(&path).unwrap();
        assert!(matches!(
            target.open_current(),
            Err(Error::Conflict(message)) if message == CONFLICT
        ));
    }

    #[test]
    fn database_file_target_open_current_rejects_directory_and_parent_replacements() {
        const CONFLICT: &str = "database changed after capability resolution";
        let dir = tempfile::tempdir().unwrap();
        let directory_path = dir.path().join("directory-leaf");
        fs::create_dir(&directory_path).unwrap();
        let directory_file = fs::File::open(&directory_path).unwrap();
        let directory_target = DatabaseFileTarget::assemble(
            fs::File::open(dir.path()).unwrap(),
            OsStr::new("directory-leaf").to_os_string(),
            opened_file_identity(&directory_file).unwrap(),
            directory_path.clone(),
        );
        assert!(matches!(
            directory_target.open_current(),
            Err(Error::Conflict(message)) if message == CONFLICT
        ));

        let parent = dir.path().join("parent");
        let child = parent.join("database.db3");
        fs::create_dir(&parent).unwrap();
        fs::write(&child, b"database").unwrap();
        let target = DatabaseFileTarget::for_test_path(&child).unwrap();
        let moved_parent = dir.path().join("moved-parent");
        fs::rename(&parent, &moved_parent).unwrap();
        fs::write(&parent, b"not a directory").unwrap();
        assert!(matches!(
            target.open_current(),
            Err(Error::Conflict(message)) if message == CONFLICT
        ));

        let hardlink_parent = dir.path().join("hardlink-parent");
        let hardlink_child = hardlink_parent.join("database.db3");
        fs::create_dir(&hardlink_parent).unwrap();
        fs::write(&hardlink_child, b"database").unwrap();
        let hardlink_target = DatabaseFileTarget::for_test_path(&hardlink_child).unwrap();
        let moved_hardlink_parent = dir.path().join("moved-hardlink-parent");
        fs::rename(&hardlink_parent, &moved_hardlink_parent).unwrap();
        fs::create_dir(&hardlink_parent).unwrap();
        fs::hard_link(
            moved_hardlink_parent.join("database.db3"),
            hardlink_parent.join("database.db3"),
        )
        .unwrap();
        assert!(matches!(
            hardlink_target.open_current(),
            Err(Error::Conflict(message)) if message == CONFLICT
        ));
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_test_door_binds_absent_relative_and_non_utf8_paths() {
        let dir = tempfile::tempdir().unwrap();
        let absent = dir.path().join("absent.db3");
        let target = DatabaseFileTarget::for_test_path(&absent).unwrap();
        assert_eq!(target.path(), absent.canonicalize().unwrap());
        assert_eq!(fs::metadata(&absent).unwrap().len(), 0);

        let _cwd_guard = CURRENT_DIR_TEST_LOCK.lock().unwrap();
        let old_cwd = std::env::current_dir().unwrap();
        std::env::set_current_dir(dir.path()).unwrap();
        let relative = DatabaseFileTarget::for_test_path(Path::new("database.db3")).unwrap();
        std::env::set_current_dir(old_cwd).unwrap();
        assert_eq!(
            relative.path(),
            dir.path().canonicalize().unwrap().join("database.db3")
        );

        assert!(matches!(
            DatabaseFileTarget::for_test_path(Path::new(".")),
            Err(Error::InvalidInput(message)) if message == "database path needs a leaf name"
        ));

        // APFS cannot store non-UTF-8 file names
        #[cfg(not(target_os = "macos"))]
        {
            let non_utf8 = dir.path().join(OsString::from_vec(b"caf\xe9.db3".to_vec()));
            let target = DatabaseFileTarget::for_test_path(&non_utf8).unwrap();
            assert_eq!(target.leaf(), non_utf8.file_name().unwrap());
        }
    }

    #[test]
    fn database_file_target_production_surface_is_private_and_canonically_bound() {
        let source = include_str!("mod.rs");
        let production = source
            .split("#[cfg(unix)]\n#[cfg(test)]\nmod tests")
            .next()
            .unwrap();
        let target = production
            .split("pub(crate) struct DatabaseFileTarget {")
            .nth(1)
            .unwrap()
            .split("}\n\nimpl DatabaseFileTarget")
            .next()
            .unwrap();
        assert!(!target.contains("pub"));
        assert!(production.contains("fn assemble("));
        assert!(!production.contains("pub fn assemble("));
        assert!(!production.contains("pub(crate) fn assemble("));

        let predicate = production
            .split("fn is_database_file_operation")
            .nth(1)
            .unwrap()
            .split("fn canonical_binding")
            .next()
            .unwrap();
        assert!(!predicate.contains("_ =>"));
        assert!(!predicate.contains(".."));
        assert!(!production.contains("fn database_path("));
        let body = production.split("fn database_file_target(").nth(1).unwrap();
        let first_statement = body
            .split_once("{")
            .map(|(_, body)| body.trim_start())
            .unwrap();
        assert!(first_statement.starts_with("if !is_database_file_operation(operation)"));

        for (source, marker) in [
            (
                include_str!("../../db/mod.rs"),
                "#[cfg(all(test, unix))]\nmod tests",
            ),
            (
                include_str!("../../db/search.rs"),
                "#[cfg(all(test, unix))]\nmod tests",
            ),
        ] {
            let Some((production, _tests)) = source.split_once(marker) else {
                panic!("missing test-module marker {marker:?}");
            };
            assert!(!production.contains("DatabaseFileTarget {"));
            assert!(!production.contains("assemble("));
        }
    }

    #[cfg(unix)]
    #[test]
    fn pgn_file_selected_through_symlinked_ancestor_is_stored_canonically_and_writable() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        let path = link.join("g.pgn");
        fs::write(real.join("g.pgn"), b"1. e4 *").unwrap();
        symlink(&real, &link).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let grant = authority
            .grant_dialog_operations(
                &path,
                "g.pgn",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(60),
                1,
            )
            .unwrap();
        assert_eq!(
            authority.dialogs[&grant.id]
                .entry
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("g.pgn")
        );
        let committed = authority
            .promote_dialog(
                &grant,
                PathClass::PersistentFile,
                "g.pgn",
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )
            .unwrap();
        assert_eq!(
            authority.persistent[&committed.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("g.pgn")
        );
        let resolved = authority
            .resolve(&committed.id, PathOperation::WritePgn, &[])
            .unwrap();
        let snapshot = resolved.pgn_snapshot().unwrap();
        let _ = resolved
            .replace_pgn_atomic(&snapshot, |_source, target| {
                target.write_all(b"1. d4 *").map_err(Error::from)
            })
            .unwrap();
        assert_eq!(fs::read(real.join("g.pgn")).unwrap(), b"1. d4 *");
    }

    #[cfg(unix)]
    #[test]
    fn picker_root_opening_book_and_migration_store_canonical_spellings() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        symlink(&real, &link).unwrap();
        fs::create_dir(real.join("db")).unwrap();
        fs::write(real.join("book.bin"), b"book").unwrap();
        fs::write(real.join("x.pgn"), b"*").unwrap();
        fs::create_dir(real.join("pz")).unwrap();
        fs::write(real.join("y.bin"), b"file").unwrap();

        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let database = authority
            .get_or_create_database_root(&link.join("db"), "Databases", None)
            .unwrap();
        assert_eq!(
            authority.persistent[&database.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("db")
        );
        let same_database = authority
            .get_or_create_database_root(&real.join("db"), "Databases", None)
            .unwrap();
        assert_eq!(same_database.id, database.id);
        authority
            .create_database_child(&database, OsStr::new("child.db3"))
            .unwrap();

        let opening_book = authority
            .register_opening_book(&link.join("book.bin"), "book")
            .unwrap();
        assert_eq!(
            authority.persistent[&opening_book.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("book.bin")
        );
        let same_book = authority
            .get_or_create_persistent_file(
                &real.join("book.bin"),
                "book",
                canonical_operations(EntryPurpose::OpeningBook),
            )
            .unwrap();
        assert_eq!(same_book.id, opening_book.id);

        let migrated = authority
            .migrate_legacy_os_path(
                link.join("x.pgn").into_os_string(),
                "x.pgn",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        assert_eq!(
            authority.persistent[&migrated.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("x.pgn")
        );

        let puzzle_real = authority
            .get_or_create_puzzle_root(&real.join("pz"), "Puzzles", None)
            .unwrap();
        let puzzle_link = authority
            .get_or_create_puzzle_root(&link.join("pz"), "Puzzles", None)
            .unwrap();
        assert_eq!(puzzle_link.id, puzzle_real.id);

        let file_real = authority
            .get_or_create_persistent_file(
                &real.join("y.bin"),
                "y.bin",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let file_link = authority
            .get_or_create_persistent_file(
                &link.join("y.bin"),
                "y.bin",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        assert_eq!(file_link.id, file_real.id);
    }

    #[cfg(unix)]
    #[test]
    fn promotion_refuses_an_ancestor_swapped_after_grant() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        let moved = dir.path().join("moved");
        fs::create_dir(real.join("ws")).unwrap_or_else(|_| {
            fs::create_dir(&real).unwrap();
            fs::create_dir(real.join("ws")).unwrap();
        });
        symlink(&real, &link).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let grant = authority
            .grant_dialog_operations(
                &link.join("ws"),
                "Workspace",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(60),
                1,
            )
            .unwrap();
        fs::rename(&real, &moved).unwrap();
        symlink(&moved, &real).unwrap();

        assert!(matches!(
            authority.promote_dialog(
                &grant,
                PathClass::PersistentCustomRoot,
                "Workspace",
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            ),
            Err(Error::Conflict(message)) if message == "dialog target changed before promotion"
        ));
        assert!(authority.persistent.is_empty());
    }
    #[test]
    fn dialog_grants_enforce_operation_expiry_and_uses() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut a = authority(&dir, clock.clone());
        let id = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(3),
                1,
            )
            .unwrap();
        assert!(a.resolve(&id, PathOperation::WritePgn, &[]).is_err());
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_err());
        let exp = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(1),
                1,
            )
            .unwrap();
        clock.advance(1);
        assert!(a.resolve(&exp, PathOperation::ReadPgn, &[]).is_err());
    }

    #[test]
    fn download_destination_is_operation_gated_and_never_exposes_a_path() {
        let dir = tempfile::tempdir().unwrap();
        let clock = Arc::new(TestClock::new(1));
        let root = AppOwnedRoot::new(
            "downloads",
            dir.path().to_path_buf(),
            vec![PathOperation::DownloadFile],
        );
        let id = root.id.clone();
        let mut authority =
            PathAuthority::open_with_clock(dir.path().join("registry.json"), vec![root], clock, 2)
                .unwrap();
        assert!(authority
            .resolve(&id, PathOperation::ReadPgn, &["new.pgn".into()])
            .is_err());
        let destination = authority
            .resolve(&id, PathOperation::DownloadFile, &["new.pgn".into()])
            .unwrap();
        destination
            .atomic_replace_download(|file| file.write_all(b"download").map_err(Error::from))
            .unwrap()
            .expect_durable();
        assert_eq!(fs::read(dir.path().join("new.pgn")).unwrap(), b"download");
    }

    #[cfg(unix)]
    #[test]
    fn engine_install_marks_only_the_resolved_file_executable() {
        use std::os::unix::fs::MetadataExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("engine");
        fs::write(&path, b"engine").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let id = authority
            .grant_dialog(
                &path,
                "engine",
                PathClass::SingleDialogGrant,
                PathOperation::EngineInstall,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        authority
            .resolve(&id, PathOperation::EngineInstall, &[])
            .unwrap()
            .mark_engine_executable()
            .unwrap();
        assert_ne!(fs::metadata(&path).unwrap().mode() & 0o111, 0);
    }

    #[test]
    fn pgn_atomic_precommit_reopens_target_and_rejects_external_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("game.pgn");
        fs::write(&path, b"old").unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut authority = authority(&dir, clock);
        let id = authority
            .grant_dialog(
                &path,
                "game",
                PathClass::SingleDialogGrant,
                PathOperation::WritePgn,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        let resolved = authority
            .resolve(&id, PathOperation::WritePgn, &[])
            .unwrap();
        let snapshot = resolved.pgn_snapshot().unwrap();
        let replacement = dir.path().join("replacement.pgn");
        fs::write(&replacement, b"external").unwrap();
        fs::rename(&replacement, &path).unwrap();
        assert!(resolved
            .replace_pgn_atomic(&snapshot, |_, temp| temp
                .write_all(b"new")
                .map_err(Error::from))
            .is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external");
    }

    #[cfg(unix)]
    #[test]
    fn pgn_precommit_retains_parent_handle_and_intermediate_symlink_swap_cannot_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let slot = dir.path().join("slot");
        fs::create_dir(&slot).unwrap();
        let path = slot.join("game.pgn");
        fs::write(&path, b"old").unwrap();
        let attacker = dir.path().join("attacker");
        fs::create_dir(&attacker).unwrap();
        fs::write(attacker.join("game.pgn"), b"attacker").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let id = authority
            .grant_dialog(
                &path,
                "game",
                PathClass::SingleDialogGrant,
                PathOperation::WritePgn,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        let resolved = authority
            .resolve(&id, PathOperation::WritePgn, &[])
            .unwrap();
        let snapshot = resolved.pgn_snapshot().unwrap();
        fs::rename(&slot, dir.path().join("slot-old")).unwrap();
        std::os::unix::fs::symlink(&attacker, &slot).unwrap();
        assert!(resolved
            .replace_pgn_atomic(&snapshot, |_, temp| temp
                .write_all(b"new")
                .map_err(Error::from))
            .is_err());
        assert_eq!(fs::read(attacker.join("game.pgn")).unwrap(), b"attacker");
    }

    #[test]
    fn pgn_workspace_grant_supports_count_read_and_mutate_lifecycle() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("game.pgn");
        fs::write(&path, b"[Event \"A\"]\n\n1. e4\n").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let id = authority
            .grant_dialog_operations(
                &path,
                "game",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30),
                3,
            )
            .unwrap();
        assert!(authority.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
        assert!(authority.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
        assert!(authority.resolve(&id, PathOperation::WritePgn, &[]).is_ok());
        assert!(authority.resolve(&id, PathOperation::ReadPgn, &[]).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn workspace_registry_never_binds_post_commit_replacements() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let path = workspace.join("game.pgn");
        fs::write(&path, b"original").unwrap();
        let original = identity(&path).unwrap();
        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let grant = authority
            .grant_dialog_operations(
                &workspace,
                "workspace",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let root = FileWorkspaceHandle::new(
            authority
                .promote_dialog(
                    &grant,
                    PathClass::PersistentCustomRoot,
                    "workspace",
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                )
                .unwrap()
                .id,
        );

        fs::rename(&path, workspace.join("original.pgn")).unwrap();
        fs::write(&path, b"replacement").unwrap();
        let handle = authority
            .register_workspace_child_observed(
                &root,
                &[OsString::from("game.pgn")],
                "game",
                (original.a, original.b),
                false,
                PathOperation::WritePgn,
            )
            .unwrap();

        assert!(matches!(
            authority.resolve(handle.path_ref(), PathOperation::ReadPgn, &[]),
            Err(Error::Conflict(_))
        ));

        let source = workspace.join("source.pgn");
        fs::write(&source, b"move source").unwrap();
        let moved_handle = authority
            .register_workspace_child_observed(
                &root,
                &[OsString::from("source.pgn")],
                "source",
                observed_identity(&source),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let moved = workspace.join("moved.pgn");
        fs::rename(&source, &moved).unwrap();
        fs::rename(&moved, workspace.join("moved-original.pgn")).unwrap();
        fs::write(&moved, b"attacker replacement").unwrap();
        authority
            .rebind_workspace_entry(&moved_handle, &moved, "moved")
            .unwrap();
        assert!(matches!(
            authority.resolve(moved_handle.path_ref(), PathOperation::ReadPgn, &[]),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn complete_workspace_directory_removal_prunes_descendants_even_when_commit_is_uncertain() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        let victim = workspace.join("victim");
        fs::create_dir_all(victim.join("nested")).unwrap();
        fs::write(victim.join("nested/game.pgn"), b"*").unwrap();
        let executable = victim.join("nested/engine");
        fs::write(&executable, b"engine").unwrap();
        fs::write(workspace.join("sibling.pgn"), b"*").unwrap();
        let registry = dir.path().join("registry.json");
        let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
        let grant = authority
            .grant_dialog_operations(
                &workspace,
                "workspace",
                PathClass::BoundedDialogGrant,
                vec![
                    PathOperation::ReadPgn,
                    PathOperation::WritePgn,
                    PathOperation::DatabaseRead,
                    PathOperation::PuzzleRead,
                    PathOperation::EngineInstall,
                ],
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let root = FileWorkspaceHandle::new(
            authority
                .promote_dialog(
                    &grant,
                    PathClass::PersistentCustomRoot,
                    "workspace",
                    vec![
                        PathOperation::ReadPgn,
                        PathOperation::WritePgn,
                        PathOperation::DatabaseRead,
                        PathOperation::PuzzleRead,
                        PathOperation::EngineInstall,
                    ],
                )
                .unwrap()
                .id,
        );
        let victim_handle = authority
            .register_workspace_child_observed(
                &root,
                &[OsString::from("victim")],
                "victim",
                observed_identity(&victim),
                true,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let nested_handle = authority
            .register_workspace_child_observed(
                &root,
                &[OsString::from("victim"), OsString::from("nested")],
                "nested",
                observed_identity(&victim.join("nested")),
                true,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let game_handle = authority
            .register_workspace_child_observed(
                &root,
                &[
                    OsString::from("victim"),
                    OsString::from("nested"),
                    OsString::from("game.pgn"),
                ],
                "game",
                observed_identity(&victim.join("nested/game.pgn")),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let sibling_handle = authority
            .register_workspace_child_observed(
                &root,
                &[OsString::from("sibling.pgn")],
                "sibling",
                observed_identity(&workspace.join("sibling.pgn")),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let engine_handle = authority
            .register_engine_file(&executable, "engine")
            .unwrap();
        fs::remove_dir_all(&victim).unwrap();

        authority.active_database_root = Some(victim_handle.path_ref().clone());
        authority.active_puzzle_root = Some(victim_handle.path_ref().clone());
        authority.active_engine_root = Some(victim_handle.path_ref().clone());
        authority.pending_artifacts.push(PendingArtifact {
            id: PathRef::fresh(),
            root: victim_handle.path_ref().clone(),
            filename: NativePath::from_path(Path::new("artifact.pgn")),
            display_name: "artifact".into(),
            operations: vec![PathOperation::ReadPgn],
            baseline: None,
            root_identity: None,
            payload_size: 0,
            payload_sha256: String::new(),
            payload_bound: false,
            installed_identity: None,
            installed_ctime_nanos: None,
        });

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "/private/registry: injected sync failure",
        ))));
        let mut dropped_engine_executables = Vec::new();
        let durability = authority
            .remove_workspace_entry(
                &victim_handle,
                WorkspaceRemovalStatus::Complete,
                &mut dropped_engine_executables,
            )
            .unwrap();
        set_test_atomic_file_injector(None);

        assert!(matches!(
            durability,
            CommitDurability::DurabilityUncertain(
                crate::error::DurabilityStage::RegistryReplacement
            )
        ));
        assert_eq!(dropped_engine_executables, vec![engine_handle.id]);
        for removed in [&victim_handle, &nested_handle, &game_handle] {
            assert!(!authority.persistent.contains_key(&removed.path_ref().id));
        }
        assert!(authority
            .persistent
            .contains_key(&sibling_handle.path_ref().id));

        let reloaded = PathAuthority::open(registry, vec![]).unwrap();
        for removed in [&victim_handle, &nested_handle, &game_handle] {
            assert!(!reloaded.persistent.contains_key(&removed.path_ref().id));
        }
        assert!(reloaded
            .persistent
            .contains_key(&sibling_handle.path_ref().id));
        assert_eq!(reloaded.active_database_root, None);
        assert_eq!(reloaded.active_puzzle_root, None);
        assert_eq!(reloaded.active_engine_root, None);
        assert!(reloaded.pending_artifacts.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn partial_workspace_directory_removal_keeps_survivors_and_prunes_missing_descendants() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        let victim = workspace.join("victim");
        fs::create_dir_all(&victim).unwrap();
        fs::write(victim.join("removed.pgn"), b"*").unwrap();
        fs::write(victim.join("survived.pgn"), b"*").unwrap();
        let removed_engine = victim.join("removed-engine");
        let survived_engine = victim.join("survived-engine");
        fs::write(&removed_engine, b"engine").unwrap();
        fs::write(&survived_engine, b"engine").unwrap();
        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let grant = authority
            .grant_dialog_operations(
                &workspace,
                "workspace",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let root = FileWorkspaceHandle::new(
            authority
                .promote_dialog(
                    &grant,
                    PathClass::PersistentCustomRoot,
                    "workspace",
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                )
                .unwrap()
                .id,
        );
        let victim_handle = authority
            .register_workspace_child_observed(
                &root,
                &[OsString::from("victim")],
                "victim",
                observed_identity(&victim),
                true,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let removed_handle = authority
            .register_workspace_child_observed(
                &root,
                &[OsString::from("victim"), OsString::from("removed.pgn")],
                "removed",
                observed_identity(&victim.join("removed.pgn")),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let survived_handle = authority
            .register_workspace_child_observed(
                &root,
                &[OsString::from("victim"), OsString::from("survived.pgn")],
                "survived",
                observed_identity(&victim.join("survived.pgn")),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let removed_engine_handle = authority
            .register_engine_file(&removed_engine, "removed engine")
            .unwrap();
        let survived_engine_handle = authority
            .register_engine_file(&survived_engine, "survived engine")
            .unwrap();
        fs::remove_file(victim.join("removed.pgn")).unwrap();
        fs::remove_file(removed_engine).unwrap();

        let mut dropped_engine_executables = Vec::new();
        authority
            .remove_workspace_entry(
                &victim_handle,
                WorkspaceRemovalStatus::Partial,
                &mut dropped_engine_executables,
            )
            .unwrap();

        assert!(authority
            .persistent
            .contains_key(&victim_handle.path_ref().id));
        assert!(!authority
            .persistent
            .contains_key(&removed_handle.path_ref().id));
        assert!(authority
            .persistent
            .contains_key(&survived_handle.path_ref().id));
        assert_eq!(dropped_engine_executables, vec![removed_engine_handle.id]);
        assert!(authority
            .persistent
            .contains_key(&survived_engine_handle.id.id));
    }

    #[test]
    fn candidate_commit_clears_removed_active_roots_and_their_pending_intents() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("root");
        fs::create_dir(&root_path).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .migrate_legacy_os_path(
                root_path.into_os_string(),
                "root",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::DownloadFile],
            )
            .unwrap();
        authority.active_database_root = Some(root.id.clone());
        authority.active_puzzle_root = Some(root.id.clone());
        authority.active_engine_root = Some(root.id.clone());
        authority.pending_artifacts.push(PendingArtifact {
            id: PathRef::fresh(),
            root: root.id.clone(),
            filename: NativePath::from_path(Path::new("artifact.pgn")),
            display_name: "artifact".into(),
            operations: vec![PathOperation::ReadPgn],
            baseline: None,
            root_identity: None,
            payload_size: 0,
            payload_sha256: String::new(),
            payload_bound: false,
            installed_identity: None,
            installed_ctime_nanos: None,
        });

        let mut dropped_engine_executables = Vec::new();
        authority
            .remove_workspace_entry(
                &FileWorkspaceHandle::new(root.id),
                WorkspaceRemovalStatus::Complete,
                &mut dropped_engine_executables,
            )
            .unwrap();

        assert_eq!(authority.active_database_root, None);
        assert_eq!(authority.active_puzzle_root, None);
        assert_eq!(authority.active_engine_root, None);
        assert!(authority.pending_artifacts.is_empty());
    }

    #[test]
    fn serialized_handle_kinds_reject_cross_capability_deserialization() {
        let id = PathRef::fresh();
        let file = FileWorkspaceHandle::new(id.clone());
        let encoded = serde_json::to_value(file).unwrap();
        assert_eq!(encoded["kind"], "fileWorkspace");
        assert!(serde_json::from_value::<DatabaseHandle>(encoded).is_err());
    }

    #[test]
    fn pgn_workspace_promotes_its_complete_granted_operation_set() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("game.pgn");
        fs::write(&path, b"game").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let id = authority
            .grant_dialog_operations(
                &path,
                "game",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30),
                2,
            )
            .unwrap();
        let commit = authority
            .promote_dialog(
                &id,
                PathClass::PersistentFile,
                "game",
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )
            .unwrap();
        assert!(authority
            .resolve(&commit.id, PathOperation::WritePgn, &[])
            .is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn engine_resource_leases_pin_files_and_directories() {
        fn promote(
            authority: &mut PathAuthority,
            path: &Path,
            kind: EngineResourceHandleKind,
        ) -> EngineResourceHandle {
            let grant = authority
                .grant_dialog(
                    path,
                    "resource",
                    PathClass::SingleDialogGrant,
                    PathOperation::EngineResourceRead,
                    Duration::from_secs(30),
                    1,
                )
                .unwrap();
            authority
                .promote_engine_resource(&grant, kind, "resource")
                .unwrap()
        }

        let dir = tempfile::tempdir().unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));

        let file = dir.path().join("network.nnue");
        fs::write(&file, b"original network").unwrap();
        let file_handle = promote(&mut authority, &file, EngineResourceHandleKind::File);
        let file_lease = authority.engine_resource(&file_handle).unwrap();
        fs::rename(&file, dir.path().join("network-original.nnue")).unwrap();
        fs::write(&file, b"attacker network").unwrap();
        #[cfg(target_os = "linux")]
        assert_eq!(
            fs::read(file_lease.uci_value().unwrap()).unwrap(),
            b"original network"
        );
        #[cfg(target_os = "macos")]
        {
            let launch_root = EngineLaunchRoot::for_test(dir.path()).unwrap();
            let mut leaf = launch_root
                .reserve_leaves(1, "resource-test", "resource")
                .unwrap()
                .pop()
                .unwrap();
            leaf.create_from(file_lease.file(), ENGINE_RESOURCE_LEAF_MODE, &|| false)
                .unwrap();
            file_lease.set_pinned_target(leaf.path()).unwrap();
            assert!(file_lease.verify_current().is_ok());
            let pinned_value = file_lease.uci_value().unwrap();
            let instance_path = launch_root.instance_path();
            assert!(Path::new(&pinned_value).starts_with(instance_path));
            assert_eq!(fs::read(pinned_value).unwrap(), b"original network");
            drop(leaf);
            assert_eq!(launch_root.reclaim().removed, 1);
        }
        assert!(matches!(
            authority.engine_resource(&file_handle),
            Err(Error::Conflict(_))
        ));

        let tables = dir.path().join("tables");
        fs::create_dir(&tables).unwrap();
        fs::write(tables.join("tablebase"), b"original table").unwrap();
        let directory_handle =
            promote(&mut authority, &tables, EngineResourceHandleKind::Directory);
        let directory_lease = authority.engine_resource(&directory_handle).unwrap();
        fs::rename(&tables, dir.path().join("tables-original")).unwrap();
        fs::create_dir(&tables).unwrap();
        fs::write(tables.join("tablebase"), b"attacker table").unwrap();
        #[cfg(target_os = "linux")]
        assert_eq!(
            fs::read(PathBuf::from(directory_lease.uci_value().unwrap()).join("tablebase"))
                .unwrap(),
            b"original table"
        );
        #[cfg(target_os = "macos")]
        assert!(matches!(
            directory_lease.verify_current(),
            Err(Error::Conflict(message))
                if message == "engine resource changed after authorization"
        ));
        assert!(matches!(
            authority.engine_resource(&directory_handle),
            Err(Error::Conflict(_))
        ));
    }

    /// The child must be handed every resource lease *and* the engine image, and
    /// the descriptors must be the ones the leases actually hold. Dropping the
    /// image descriptor is what makes a wrapper-script engine fail to launch;
    /// dropping a resource descriptor silently redirects the engine to whatever
    /// the visible path now resolves to.
    #[cfg(target_os = "linux")]
    #[test]
    fn inherited_descriptors_cover_every_resource_lease_and_the_engine_image() {
        use std::os::fd::AsRawFd;

        let dir = tempfile::tempdir().unwrap();
        let image = dir.path().join("engine");
        fs::write(&image, b"#!/bin/sh\n").unwrap();
        let first = dir.path().join("book.bin");
        fs::write(&first, b"book").unwrap();
        let second = dir.path().join("network.nnue");
        fs::write(&second, b"network").unwrap();

        let image_file = fs::File::open(&image).unwrap();
        let image_fd = image_file.as_raw_fd();
        let executable =
            EngineExecutable::test_fixture(image_file, dir.path().to_path_buf(), Vec::new());

        // No resource options configured: the image alone must still be inherited,
        // otherwise the interpreter cannot reopen a script engine.
        assert_eq!(executable.inherited_fds(), vec![image_fd]);

        let leases = vec![
            EngineResourceLease::test_file(fs::File::open(&first).unwrap()),
            EngineResourceLease::test_file(fs::File::open(&second).unwrap()),
        ];
        let lease_fds: Vec<_> = leases.iter().map(|lease| lease.file.as_raw_fd()).collect();
        let executable =
            executable.with_resource_leases(leases.into_iter().map(Arc::new).collect());

        let inherited = executable.inherited_fds();
        assert_eq!(inherited, [lease_fds.as_slice(), &[image_fd]].concat());
        // Each inherited descriptor must still name the authorized inode.
        assert_eq!(
            fs::read(format!("/proc/self/fd/{}", inherited[0])).unwrap(),
            b"book"
        );
        assert_eq!(
            fs::read(format!("/proc/self/fd/{}", inherited[1])).unwrap(),
            b"network"
        );
    }

    #[test]
    fn promoted_pgn_workspace_survives_restart_is_unbounded_and_rejects_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let path = dir.path().join("game.pgn");
        fs::write(&path, b"[Event \"A\"]\n\n1. e4\n").unwrap();

        let handle = {
            let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
            let grant = authority
                .grant_dialog_operations(
                    &path,
                    "game",
                    PathClass::BoundedDialogGrant,
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                    Duration::from_secs(30 * 60),
                    128,
                )
                .unwrap();
            FileWorkspaceHandle::new(
                authority
                    .promote_dialog(
                        &grant,
                        PathClass::PersistentFile,
                        "game",
                        vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                    )
                    .unwrap()
                    .id,
            )
        };

        let mut authority = PathAuthority::open(registry, vec![]).unwrap();
        for _ in 0..129 {
            assert!(authority
                .resolve(handle.path_ref(), PathOperation::ReadPgn, &[])
                .is_ok());
        }
        assert!(authority
            .resolve(handle.path_ref(), PathOperation::WritePgn, &[])
            .is_ok());

        fs::rename(&path, dir.path().join("old-game.pgn")).unwrap();
        fs::write(&path, b"[Event \"replacement\"]\n\n1. d4\n").unwrap();
        assert!(matches!(
            authority.resolve(handle.path_ref(), PathOperation::ReadPgn, &[]),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_destination_through_symlinked_ancestor_is_stored_canonically() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        symlink(&real, &link).unwrap();
        let path = link.join("new.pgn");
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));

        let destination = authority
            .create_pgn_export_destination(&path, "new.pgn")
            .unwrap();
        assert_eq!(
            authority.persistent[&destination.handle.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("new.pgn")
        );
        let resolved = authority
            .resolve(&destination.handle.id, PathOperation::WritePgn, &[])
            .unwrap();
        let snapshot = resolved.pgn_snapshot().unwrap();
        let _ = resolved
            .replace_pgn_atomic(&snapshot, |_source, target| {
                target.write_all(b"1. e4 *").map_err(Error::from)
            })
            .unwrap();
        assert_eq!(fs::read(real.join("new.pgn")).unwrap(), b"1. e4 *");
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_destination_reuses_an_existing_file_under_its_canonical_spelling() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("old.pgn"), b"sentinel").unwrap();
        symlink(&real, &link).unwrap();
        let path = link.join("old.pgn");
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));

        let destination = authority
            .create_pgn_export_destination(&path, "old.pgn")
            .unwrap();
        assert_eq!(fs::read(real.join("old.pgn")).unwrap(), b"sentinel");
        assert_eq!(
            authority.persistent[&destination.handle.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("old.pgn")
        );
        let resolved = authority
            .resolve(&destination.handle.id, PathOperation::WritePgn, &[])
            .unwrap();
        let snapshot = resolved.pgn_snapshot().unwrap();
        let _ = resolved
            .replace_pgn_atomic(&snapshot, |_source, target| {
                target.write_all(b"1. c4 *").map_err(Error::from)
            })
            .unwrap();
        assert_eq!(fs::read(real.join("old.pgn")).unwrap(), b"1. c4 *");
    }

    #[cfg(unix)]
    #[test]
    fn descriptor_verified_registrations_keep_their_original_spelling_after_an_ancestor_swap() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let moved = dir.path().join("moved");
        fs::create_dir(real.join("db2")).unwrap_or_else(|_| {
            fs::create_dir(&real).unwrap();
            fs::create_dir(real.join("db2")).unwrap();
        });
        let database = authorize_existing_dir(&real.join("db2")).unwrap();
        ACQUIRE_TARGET_CALLS.with(|calls| calls.set(0));
        fs::rename(&real, &moved).unwrap();
        symlink(&moved, &real).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .get_or_create_database_root(database.path(), "Databases", Some(database.identity()))
            .unwrap();
        assert_eq!(
            authority.persistent[&root.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            database.path()
        );
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 0);

        let image_dir_path = dir.path().join("image-real");
        let image_moved = dir.path().join("image-moved");
        fs::create_dir_all(&image_dir_path).unwrap();
        let image_dir = authorize_existing_dir(&image_dir_path).unwrap();
        let leaf = OsStr::new("uuid");
        fs::write(image_dir_path.join(leaf), b"image").unwrap();
        let installed = image_dir.open_leaf_identified(leaf).unwrap();
        fs::rename(&image_dir_path, &image_moved).unwrap();
        symlink(&image_moved, &image_dir_path).unwrap();
        let image = authority
            .register_engine_image(&image_dir, leaf, installed, "image".into())
            .unwrap();
        assert_eq!(
            authority.persistent[&image.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            image_dir.path().join(leaf)
        );
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 0);
    }

    #[cfg(unix)]
    #[test]
    fn leaf_symlinks_are_refused_for_dialog_grants() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real_file = dir.path().join("real-file");
        let real_dir = dir.path().join("real-dir");
        fs::write(&real_file, b"file").unwrap();
        fs::create_dir(&real_dir).unwrap();
        let file_link = dir.path().join("file-link");
        let dir_link = dir.path().join("dir-link");
        symlink(&real_file, &file_link).unwrap();
        symlink(&real_dir, &dir_link).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        for path in [&file_link, &dir_link] {
            assert!(matches!(
                authority.grant_dialog_operations(
                    path,
                    "selected",
                    PathClass::BoundedDialogGrant,
                    vec![PathOperation::ReadPgn],
                    Duration::from_secs(60),
                    1,
                ),
                Err(Error::InvalidInput(_))
            ));
        }
    }

    #[cfg(unix)]
    #[test]
    fn leafless_dialog_selections_keep_their_original_spelling() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        fs::create_dir(&real).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        for path in [PathBuf::from("/"), real.join("..")] {
            let grant = authority
                .grant_dialog_operations(
                    &path,
                    "directory",
                    PathClass::BoundedDialogGrant,
                    vec![PathOperation::ReadPgn],
                    Duration::from_secs(60),
                    1,
                )
                .unwrap();
            let stored = &authority.dialogs[&grant.id].entry.stored;
            assert_eq!(stored.path.to_path().unwrap(), path);
            assert!(stored.target_is_dir);
        }
    }

    #[cfg(unix)]
    #[test]
    fn ancestor_swaps_during_acquisition_are_refused_before_registration() {
        use std::os::unix::fs::symlink;

        fn fixture() -> (tempfile::TempDir, PathBuf, PathBuf, PathBuf) {
            let dir = tempfile::tempdir().unwrap();
            let real = dir.path().join("real");
            let link = dir.path().join("link");
            let moved = dir.path().join("moved");
            fs::create_dir_all(real.join("ws")).unwrap();
            fs::create_dir(real.join("db")).unwrap();
            fs::write(real.join("x.pgn"), b"*").unwrap();
            symlink(&real, &link).unwrap();
            (dir, real, link, moved)
        }

        let (dir, real, link, moved) = fixture();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(0)));
        let hook_real = real.clone();
        let hook_moved = moved.clone();
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            slot.replace(Some(Box::new(move || {
                fs::rename(&hook_real, &hook_moved).unwrap();
                symlink(&hook_moved, &hook_real).unwrap();
            })))
        });
        assert!(matches!(
            path_authority.grant_dialog_operations(
                &link.join("ws"),
                "Workspace",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn],
                Duration::from_secs(60),
                1,
            ),
            Err(Error::Io(_))
        ));
        assert!(path_authority.dialogs.is_empty());

        let (dir, real, link, moved) = fixture();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(0)));
        let hook_real = real.clone();
        let hook_moved = moved.clone();
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            slot.replace(Some(Box::new(move || {
                fs::rename(&hook_real, &hook_moved).unwrap();
                symlink(&hook_moved, &hook_real).unwrap();
            })))
        });
        let error = path_authority
            .migrate_legacy_os_path(
                link.join("x.pgn").into_os_string(),
                "x.pgn",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap_err();
        assert!(matches!(error, Error::Io(_)));
        assert!(path_authority.persistent.is_empty());

        let (dir, real, link, moved) = fixture();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(0)));
        let hook_real = real.clone();
        let hook_moved = moved.clone();
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            slot.replace(Some(Box::new(move || {
                fs::rename(&hook_real, &hook_moved).unwrap();
                symlink(&hook_moved, &hook_real).unwrap();
            })))
        });
        let error = path_authority
            .get_or_create_database_root(&link.join("db"), "Databases", None)
            .unwrap_err();
        assert!(matches!(error, Error::Io(_)));
        assert!(path_authority.persistent.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn promotion_refuses_a_different_leaf_inode_after_grant() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("g.pgn"), b"original").unwrap();
        symlink(&real, &link).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let grant = authority
            .grant_dialog_operations(
                &link.join("g.pgn"),
                "g.pgn",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(60),
                1,
            )
            .unwrap();
        // Create the replacement while the original still exists, so the filesystem cannot hand
        // the freed inode number back to it; the rename then swaps in a guaranteed different inode.
        let replacement = dir.path().join("replacement.pgn");
        fs::write(&replacement, b"replacement").unwrap();
        fs::rename(&replacement, real.join("g.pgn")).unwrap();
        assert!(matches!(
            authority.promote_dialog(
                &grant,
                PathClass::PersistentFile,
                "g.pgn",
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            ),
            Err(Error::Conflict(message)) if message == "dialog target changed before promotion"
        ));
        assert!(authority.persistent.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn promotion_conflict_removes_the_replaced_target_grant() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("g.pgn"), b"original").unwrap();
        symlink(&real, &link).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let grant = authority
            .grant_dialog_operations(
                &link.join("g.pgn"),
                "g.pgn",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(60),
                1,
            )
            .unwrap();
        let replacement = dir.path().join("replacement.pgn");
        fs::write(&replacement, b"replacement").unwrap();
        fs::rename(&replacement, real.join("g.pgn")).unwrap();

        assert!(matches!(
            authority.promote_dialog(
                &grant,
                PathClass::PersistentFile,
                "g.pgn",
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            ),
            Err(Error::Conflict(message)) if message == "dialog target changed before promotion"
        ));
        assert!(!authority.dialogs.contains_key(&grant.id));
    }

    #[cfg(unix)]
    fn pgn_export_test_setup() -> (tempfile::TempDir, PathBuf, PathBuf, PathBuf) {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        let evil = dir.path().join("evil");
        fs::create_dir(&real).unwrap();
        fs::create_dir(&evil).unwrap();
        symlink(&real, &link).unwrap();
        (dir, real, link, evil)
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_refuses_a_parent_retargeted_before_canonicalisation() {
        use std::os::unix::fs::symlink;

        let (dir, _real, link, evil) = pgn_export_test_setup();
        let mut auth = authority(&dir, Arc::new(TestClock::new(0)));
        let hook_link = link.clone();
        let hook_evil = evil.clone();
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            slot.replace(Some(Box::new(move || {
                fs::remove_file(&hook_link).unwrap();
                symlink(&hook_evil, &hook_link).unwrap();
            })))
        });
        assert!(matches!(
            auth.create_pgn_export_destination(&link.join("new2.pgn"), "new2.pgn"),
            Err(Error::Conflict(_))
        ));
        assert!(!evil.join("new2.pgn").exists());
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_refuses_a_parent_replaced_before_canonicalisation() {
        let (dir, real, link, _evil) = pgn_export_test_setup();
        let moved = dir.path().join("moved");
        let mut auth = authority(&dir, Arc::new(TestClock::new(0)));
        let hook_real = real.clone();
        let hook_moved = moved.clone();
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            slot.replace(Some(Box::new(move || {
                fs::rename(&hook_real, &hook_moved).unwrap();
                fs::create_dir(&hook_real).unwrap();
            })))
        });
        assert!(matches!(
            auth.create_pgn_export_destination(&link.join("new3.pgn"), "new3.pgn"),
            Err(Error::Conflict(_))
        ));
        assert!(!real.join("new3.pgn").exists());
        assert!(!moved.join("new3.pgn").exists());
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_cleans_up_created_files_descriptor_relatively_after_failure() {
        let (dir, real, link, _evil) = pgn_export_test_setup();
        let mut auth = authority(&dir, Arc::new(TestClock::new(0)));
        let before = auth.dialogs.len();
        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        let error = auth
            .create_pgn_export_destination(&link.join("new4.pgn"), "new4.pgn")
            .unwrap_err();
        set_test_atomic_file_injector(None);
        assert!(matches!(error, Error::Io(_)));
        assert!(!real.join("new4.pgn").exists());
        assert_eq!(auth.dialogs.len(), before);

        let (dir, real, link, _evil) = pgn_export_test_setup();
        let moved = dir.path().join("moved");
        let mut auth = authority(&dir, Arc::new(TestClock::new(0)));
        let hook_real = real.clone();
        let hook_moved = moved.clone();
        let hook_path = real.join("new4b.pgn");
        PGN_EXPORT_POST_CREATE_HOOK.with(|slot| {
            slot.replace(Some(Box::new(move || {
                fs::rename(&hook_real, &hook_moved).unwrap();
                fs::create_dir(&hook_real).unwrap();
                fs::write(hook_real.join("new4b.pgn"), b"sentinel").unwrap();
            })))
        });
        assert!(auth
            .create_pgn_export_destination(&link.join("new4b.pgn"), "new4b.pgn")
            .is_err());
        assert!(!moved.join("new4b.pgn").exists());
        assert_eq!(fs::read(&hook_path).unwrap(), b"sentinel");
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_preserves_an_existing_destination_after_promotion_failure() {
        let (dir, real, link, _evil) = pgn_export_test_setup();
        fs::write(real.join("keep.pgn"), b"sentinel").unwrap();
        let mut auth = authority(&dir, Arc::new(TestClock::new(0)));
        let before = auth.dialogs.len();
        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        assert!(auth
            .create_pgn_export_destination(&link.join("keep.pgn"), "keep.pgn")
            .is_err());
        set_test_atomic_file_injector(None);
        assert_eq!(fs::read(real.join("keep.pgn")).unwrap(), b"sentinel");
        assert_eq!(auth.dialogs.len(), before);
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_refuses_a_trailing_separator_destination() {
        let (dir, real, _link, _evil) = pgn_export_test_setup();
        let mut auth = authority(&dir, Arc::new(TestClock::new(0)));
        assert!(matches!(
            auth.create_pgn_export_destination(&real.join("export.pgn/"), "export.pgn"),
            Err(Error::InvalidInput(message))
                if message == "PGN export destination must have a .pgn filename"
        ));
        assert!(!real.join("export.pgn").exists());
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_preserves_a_replaced_created_leaf_after_failure() {
        let (dir, real, link, _evil) = pgn_export_test_setup();
        let mut auth = authority(&dir, Arc::new(TestClock::new(0)));
        let hook_path = real.join("new5.pgn");
        let replacement_path = hook_path.clone();
        PGN_EXPORT_POST_CREATE_HOOK.with(|slot| {
            slot.replace(Some(Box::new(move || {
                fs::remove_file(&replacement_path).unwrap();
                fs::write(&replacement_path, b"sentinel").unwrap();
            })))
        });
        assert!(auth
            .create_pgn_export_destination(&link.join("new5.pgn"), "new5.pgn")
            .is_err());
        assert_eq!(fs::read(&hook_path).unwrap(), b"sentinel");
        assert!(auth.persistent.is_empty());
        assert!(auth.dialogs.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn pgn_export_refuses_symlink_and_directory_leaves() {
        use std::os::unix::fs::symlink;

        let (dir, real, link, _evil) = pgn_export_test_setup();
        let target = real.join("target.pgn");
        fs::write(&target, b"target").unwrap();
        symlink(&target, real.join("sym.pgn")).unwrap();
        fs::create_dir(real.join("dir.pgn")).unwrap();
        let mut auth = authority(&dir, Arc::new(TestClock::new(0)));
        for leaf in ["sym.pgn", "dir.pgn"] {
            assert!(matches!(
                auth.create_pgn_export_destination(&link.join(leaf), leaf),
                Err(Error::InvalidInput(message))
                    if message == "PGN export destination must be a regular file"
            ));
        }
        assert_eq!(fs::read(&target).unwrap(), b"target");
        assert!(auth.persistent.is_empty());
        assert!(auth.dialogs.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn root_registration_acquires_once_per_fresh_spelling() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::create_dir(real.join("db3")).unwrap();
        symlink(&real, &link).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        ACQUIRE_TARGET_CALLS.with(|calls| calls.set(0));
        authority
            .get_or_create_database_root(&link.join("db3"), "Databases", None)
            .unwrap();
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 1);
        authority
            .get_or_create_database_root(&real.join("db3"), "Databases", None)
            .unwrap();
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 2);
    }

    #[cfg(unix)]
    #[test]
    fn shape_checks_precede_filesystem_access_for_all_acquisition_doors() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("g.pgn"), b"*").unwrap();
        symlink(&real, &link).unwrap();
        let missing = dir.path().join("missing");
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        ACQUIRE_TARGET_CALLS.with(|calls| calls.set(0));
        assert!(matches!(
            authority.grant_dialog_operations(
                &missing,
                "missing",
                PathClass::SingleDialogGrant,
                vec![PathOperation::ReadPgn],
                Duration::from_secs(60),
                2,
            ),
            Err(Error::InvalidInput(message)) if message == "invalid dialog grant shape"
        ));
        assert!(matches!(
            authority.migrate_legacy_os_path(
                missing.clone().into_os_string(),
                "missing",
                PathClass::PersistentFile,
                vec![],
            ),
            Err(Error::InvalidInput(message)) if message == "persistent operations cannot be empty"
        ));
        assert!(matches!(
            authority.get_or_create_persistent_file(&missing, "missing", vec![]),
            Err(Error::InvalidInput(message)) if message == "persistent operations cannot be empty"
        ));
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 0);

        let grant = authority
            .grant_dialog_operations(
                &link.join("g.pgn"),
                "g.pgn",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(60),
                1,
            )
            .unwrap();
        let calls_before_promotion = ACQUIRE_TARGET_CALLS.with(|calls| calls.get());
        fs::remove_file(real.join("g.pgn")).unwrap();
        assert!(matches!(
            authority.promote_dialog(
                &grant,
                PathClass::SingleDialogGrant,
                "g.pgn",
                vec![PathOperation::ReadPgn],
            ),
            Err(Error::InvalidInput(message)) if message == "promotion target must be persistent"
        ));
        assert!(matches!(
            authority.promote_dialog(
                &grant,
                PathClass::PersistentFile,
                "g.pgn",
                vec![],
            ),
            Err(Error::InvalidInput(message)) if message == "persistent operations cannot be empty"
        ));
        assert_eq!(
            ACQUIRE_TARGET_CALLS.with(|calls| calls.get()),
            calls_before_promotion
        );
    }
    #[test]
    fn capacity_evicts_oldest_not_every_grant() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("a");
        fs::write(&f, b"x").unwrap();
        let c = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, c);
        let first = a
            .grant_dialog(
                &f,
                "1",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(9),
                2,
            )
            .unwrap();
        let second = a
            .grant_dialog(
                &f,
                "2",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(9),
                2,
            )
            .unwrap();
        let third = a
            .grant_dialog(
                &f,
                "3",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(9),
                2,
            )
            .unwrap();
        assert!(a.resolve(&first, PathOperation::ReadPgn, &[]).is_err());
        assert!(a.resolve(&second, PathOperation::ReadPgn, &[]).is_ok());
        assert!(a.resolve(&third, PathOperation::ReadPgn, &[]).is_ok());
    }
    // The non-UTF-8 name is the point of this test, and APFS cannot store non-UTF-8 file names.
    #[cfg(not(target_os = "macos"))]
    #[test]
    fn persistent_identity_reload_and_native_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let name = OsString::from_vec(vec![b'f', 0x80]);
        let f = dir.path().join(&name);
        fs::write(&f, b"x").unwrap();
        let c = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, c.clone());
        let id = a
            .migrate_legacy_os_path(
                f.clone().into_os_string(),
                "non utf8",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        drop(a);
        let mut a = authority(&dir, c);
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
        fs::rename(&f, dir.path().join("previous-object")).unwrap();
        fs::write(&f, b"replacement").unwrap();
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_err());
        assert_eq!(
            a.descriptors()
                .into_iter()
                .find(|d| d.id == id)
                .unwrap()
                .availability,
            PathAvailability::Unavailable
        );
    }

    #[cfg(unix)]
    #[test]
    fn opened_file_identity_retains_the_original_directory_after_pathname_swap() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("directory");
        let original_path = dir.path().join("directory-original");
        fs::create_dir(&path).unwrap();
        let opened = fs::File::open(&path).unwrap();
        let original_identity = opened_file_identity(&opened).unwrap();

        fs::rename(&path, &original_path).unwrap();
        fs::create_dir(&path).unwrap();
        let replacement = fs::File::open(&path).unwrap();
        let replacement_identity = opened_file_identity(&replacement).unwrap();

        assert_ne!(original_identity, replacement_identity);
        assert_eq!(opened_file_identity(&opened).unwrap(), original_identity);
    }
    #[test]
    fn unicode_promotion_consumes_the_exact_dialog_grant() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("Schach ♞");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, clock);
        let dialog = a
            .grant_dialog(
                &root,
                "Schach ♞",
                PathClass::SingleDialogGrant,
                PathOperation::DatabaseRead,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        let promoted = a
            .promote_dialog(
                &dialog,
                PathClass::PersistentCustomRoot,
                "Schach ♞",
                vec![PathOperation::DatabaseRead],
            )
            .unwrap();
        assert!(a
            .resolve(&dialog, PathOperation::DatabaseRead, &[])
            .is_err());
        assert!(a
            .resolve(&promoted, PathOperation::DatabaseRead, &[])
            .is_ok());
        let reloaded = PathAuthority::open_with_clock(
            dir.path().join("registry.json"),
            vec![],
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        assert_eq!(
            reloaded.persistent[&promoted.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            root
        );
    }
    #[test]
    fn promotion_rejects_empty_or_escalating_operations_and_single_grants_cannot_be_multi_use() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, clock);
        assert!(a
            .grant_dialog(
                &file,
                "bad",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(1),
                2
            )
            .is_err());
        let id = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        assert!(a
            .promote_dialog(&id, PathClass::PersistentFile, "a", vec![])
            .is_err());
        assert!(a
            .promote_dialog(
                &id,
                PathClass::PersistentFile,
                "a",
                vec![PathOperation::WritePgn]
            )
            .is_err());
        assert!(!a.dialogs.contains_key(&id.id));
    }
    #[test]
    fn invalid_grant_does_not_evict_live_capacity_and_descriptors_revalidate() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, clock.clone());
        let one = a
            .grant_dialog(
                &file,
                "one",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(2),
                2,
            )
            .unwrap();
        let two = a
            .grant_dialog(
                &file,
                "two",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(2),
                2,
            )
            .unwrap();
        assert!(a
            .grant_dialog(
                dir.path().join("missing").as_path(),
                "bad",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(2),
                2
            )
            .is_err());
        assert!(a.resolve(&one, PathOperation::ReadPgn, &[]).is_ok());
        assert!(a.resolve(&two, PathOperation::ReadPgn, &[]).is_ok());
        let exp = a
            .grant_dialog(
                &file,
                "exp",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(1),
                2,
            )
            .unwrap();
        clock.advance(1);
        assert!(!a.descriptors().iter().any(|d| d.id == exp));
        let persistent = a
            .migrate_legacy_os_path(
                file.clone().into_os_string(),
                "a",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        fs::remove_file(&file).unwrap();
        assert_eq!(
            a.descriptors()
                .into_iter()
                .find(|d| d.id == persistent)
                .unwrap()
                .availability,
            PathAvailability::Unavailable
        );
    }
    #[test]
    fn failed_persistence_keeps_memory_and_consumes_dialog_grant() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = PathAuthority::open_with_clock(
            dir.path().join("missing-parent/registry.json"),
            vec![],
            clock,
            2,
        )
        .unwrap();
        assert!(a
            .migrate_legacy_os_path(
                file.clone().into_os_string(),
                "a",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn]
            )
            .is_err());
        assert!(a.persistent.is_empty());
        let dialog = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(2),
                1,
            )
            .unwrap();
        assert!(a
            .promote_dialog(
                &dialog,
                PathClass::PersistentFile,
                "a",
                vec![PathOperation::ReadPgn]
            )
            .is_err());
        assert!(a.persistent.is_empty());
        assert!(!a.dialogs.contains_key(&dialog.id));
    }
    #[test]
    fn rejects_traversal_symlink_and_special_components() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("root");
        fs::create_dir(&root).unwrap();
        fs::write(root.join("ok"), b"x").unwrap();
        std::os::unix::fs::symlink("ok", root.join("link")).unwrap();
        let c = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, c);
        let id = a
            .migrate_legacy_os_path(
                root.into_os_string(),
                "root",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        assert!(a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("..")])
            .is_err());
        assert!(a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("bad/name")])
            .is_err());
        assert!(a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("link")])
            .is_err());
        assert!(a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("ok")])
            .is_ok());
    }
    #[test]
    fn rejects_symlink_root_and_detects_leaf_replacement_after_resolution() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("target");
        fs::create_dir(&target).unwrap();
        let link = dir.path().join("root-link");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, clock);
        assert!(a
            .migrate_legacy_os_path(
                link.into_os_string(),
                "link",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn],
            )
            .is_err());
        let file = target.join("leaf");
        fs::write(&file, b"old").unwrap();
        let id = a
            .migrate_legacy_os_path(
                target.into_os_string(),
                "target",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let mut resolved = a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("leaf")])
            .unwrap();
        fs::remove_file(&file).unwrap();
        fs::write(&file, b"replacement").unwrap();
        assert_eq!(resolved.read_bytes().unwrap(), b"old");
    }
    #[test]
    fn read_capability_cannot_reach_a_sibling() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("readable");
        let sibling = dir.path().join("sibling");
        fs::write(&file, b"read").unwrap();
        fs::write(&sibling, b"sibling").unwrap();
        let mut a = authority(&dir, Arc::new(TestClock::new(0)));
        let id = a
            .migrate_legacy_os_path(
                file.into_os_string(),
                "readable",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let mut resolved = a.resolve(&id, PathOperation::ReadPgn, &[]).unwrap();
        assert_eq!(resolved.read_bytes().unwrap(), b"read");
        assert_eq!(fs::read(sibling).unwrap(), b"sibling");
    }
    #[test]
    fn app_owned_descriptor_revalidates_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("app");
        fs::create_dir(&root).unwrap();
        let app = AppOwnedRoot::new("app", root.clone(), vec![PathOperation::LogWrite]);
        let id = app.id.clone();
        let mut a = PathAuthority::open_with_clock(
            dir.path().join("registry.json"),
            vec![app],
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        fs::rename(&root, dir.path().join("old-app")).unwrap();
        fs::create_dir(&root).unwrap();
        assert_eq!(
            a.descriptors()
                .into_iter()
                .find(|d| d.id == id)
                .unwrap()
                .availability,
            PathAvailability::Unavailable
        );
    }
    #[test]
    fn unknown_schema_and_atomic_failure_preserve_old_registry() {
        let dir = tempfile::tempdir().unwrap();
        let reg = dir.path().join("registry.json");
        fs::write(&reg, b"{\"schema_version\":99,\"entries\":[]}").unwrap();
        assert!(PathAuthority::open(reg.clone(), vec![]).is_err());
        fs::remove_file(&reg).unwrap();
        let c = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, c);
        let f = dir.path().join("a");
        fs::write(&f, b"x").unwrap();
        a.migrate_legacy_os_path(
            f.clone().into_os_string(),
            "a",
            PathClass::PersistentFile,
            vec![PathOperation::ReadPgn],
        )
        .unwrap();
        let before = fs::read(&reg).unwrap();
        struct Fail;
        impl AtomicWriterInjector for Fail {
            fn inject(&self, p: AtomicFileFaultPoint) -> std::io::Result<()> {
                if p == AtomicFileFaultPoint::Write {
                    Err(std::io::Error::other("fail"))
                } else {
                    Ok(())
                }
            }
        }
        set_test_atomic_file_injector(Some(Arc::new(Fail)));
        assert!(a.save().is_err());
        set_test_atomic_file_injector(None);
        assert_eq!(fs::read(&reg).unwrap(), before);
        struct Uncertain;
        impl AtomicWriterInjector for Uncertain {
            fn inject(&self, p: AtomicFileFaultPoint) -> std::io::Result<()> {
                if p == AtomicFileFaultPoint::ParentSync {
                    Err(std::io::Error::other(
                        "/private/registry: raw operating system failure",
                    ))
                } else {
                    Ok(())
                }
            }
        }
        set_test_atomic_file_injector(Some(Arc::new(Uncertain)));
        let durability = a.save().expect("uncertain registry commit");
        set_test_atomic_file_injector(None);
        assert_eq!(
            serde_json::to_string(&durability).expect("serialize durability"),
            r#"{"DurabilityUncertain":"RegistryReplacement"}"#
        );
    }
    #[test]
    fn persisted_transient_or_invalid_entries_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let reg = dir.path().join("registry.json");
        fs::write(&reg, br#"{"schema_version":1,"entries":[{"id":"forged","display_name":"forged","class":"singleDialogGrant","operations":["readPgn"],"path":{"platform":"unix","bytes":"L3RtcA"},"identity":{"a":1,"b":1},"target_is_dir":false}]}"#).unwrap();
        assert!(PathAuthority::open(reg, vec![]).is_err());
    }
    #[test]
    fn zero_dialog_capacity_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        assert!(PathAuthority::open_with_clock(
            dir.path().join("registry.json"),
            vec![],
            Arc::new(TestClock::new(0)),
            0
        )
        .is_err());
    }
    #[test]
    fn uncertain_commit_keeps_candidate_and_consumes_promoted_grant() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let mut a = authority(&dir, Arc::new(TestClock::new(0)));
        let dialog = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(5),
                1,
            )
            .unwrap();
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name: "a".into(),
            class: PathClass::PersistentFile,
            purpose: None,
            operations: vec![PathOperation::ReadPgn],
            path: NativePath::from_path(&file),
            identity: identity(&file).unwrap(),
            target_is_dir: false,
        };
        let mut candidate = a.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        assert!(matches!(
            a.commit_candidate(candidate, Some(&dialog)).unwrap(),
            CommitDurability::DurabilityUncertain(_)
        ));
        set_test_atomic_file_injector(None);
        assert!(a.persistent.contains_key(&id.id));
        assert!(!a.dialogs.contains_key(&dialog.id));
        assert!(a.resolve(&dialog, PathOperation::ReadPgn, &[]).is_err());
        let reloaded = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(reloaded.persistent.contains_key(&id.id));
    }

    #[test]
    fn pending_download_artifact_recovers_an_atomic_install_after_restart() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let root_id = app_root.id.clone();
        let registry = dir.path().join("registry.json");
        let staged = dir.path().join("staged.pgn");
        fs::write(&staged, b"1. e4").unwrap();
        let reservation = {
            let mut authority =
                PathAuthority::open(registry.clone(), vec![app_root.clone()]).unwrap();
            let reservation = authority
                .reserve_download_artifact(
                    &root_id,
                    OsString::from("games.pgn"),
                    sha256_file(&staged).unwrap(),
                    "games.pgn",
                    vec![PathOperation::ReadPgn],
                )
                .unwrap();
            authority
                .resolve(
                    &root_id,
                    PathOperation::DownloadFile,
                    &[OsString::from("games.pgn")],
                )
                .unwrap()
                .atomic_replace_download(|file| file.write_all(b"1. e4").map_err(Error::from))
                .unwrap()
                .expect_durable();
            authority
                .mark_download_artifact_committed(
                    &reservation,
                    {
                        let identity = identity(&root.join("games.pgn")).unwrap();
                        (identity.a, identity.b)
                    },
                    {
                        use std::os::unix::fs::MetadataExt;
                        let metadata = fs::metadata(root.join("games.pgn")).unwrap();
                        i128::from(metadata.ctime()) * 1_000_000_000
                            + i128::from(metadata.ctime_nsec())
                    },
                )
                .unwrap();
            reservation
        };
        let mut recovered = PathAuthority::open(registry, vec![app_root]).unwrap();
        let mut artifact = recovered
            .resolve(&reservation.id, PathOperation::ReadPgn, &[])
            .unwrap();
        assert_eq!(artifact.read_bytes().unwrap(), b"1. e4");
        assert!(recovered
            .resolve(&reservation.id, PathOperation::DownloadFile, &[])
            .is_err());
        assert!(recovered.pending_artifacts.is_empty());
    }

    fn install_read_only_download_fixture(
        authority: &mut PathAuthority,
        root: &PathRef,
        filename: &str,
        staged: &Path,
    ) -> PathRef {
        let reservation = authority
            .reserve_download_artifact(
                root,
                OsString::from(filename),
                sha256_file(staged).unwrap(),
                filename,
                canonical_operations(EntryPurpose::PgnReadOnlyFile),
            )
            .unwrap();
        let resolved = authority
            .resolve(
                root,
                PathOperation::DownloadFile,
                &[OsString::from(filename)],
            )
            .unwrap();
        let installed = resolved
            .atomic_install_reserved_download(&reservation, staged)
            .unwrap();
        authority
            .mark_download_artifact_committed(
                &reservation,
                installed.identity,
                installed.ctime_nanos,
            )
            .unwrap();
        authority
            .activate_download_artifact(&reservation)
            .unwrap()
            .handle
            .id
    }

    #[test]
    fn finalized_read_only_pgn_downloads_reload_and_follow_startup_ownership() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("downloads");
        fs::create_dir(&root_path).unwrap();
        let app_root = AppOwnedRoot::new(
            "downloads",
            root_path.clone(),
            vec![PathOperation::DownloadFile],
        );
        let root = app_root.id.clone();
        let registry = dir.path().join("registry.json");
        let orphan_staged = dir.path().join("orphan-staged.pgn");
        let retained_staged = dir.path().join("retained-staged.pgn");
        fs::write(&orphan_staged, b"1. e4").unwrap();
        fs::write(&retained_staged, b"1. d4").unwrap();
        let (orphan, retained) = {
            let mut authority =
                PathAuthority::open(registry.clone(), vec![app_root.clone()]).unwrap();
            let orphan = install_read_only_download_fixture(
                &mut authority,
                &root,
                "orphan.pgn",
                &orphan_staged,
            );
            let retained = install_read_only_download_fixture(
                &mut authority,
                &root,
                "retained.pgn",
                &retained_staged,
            );
            (orphan, retained)
        };

        let mut authority = PathAuthority::open(registry, vec![app_root]).unwrap();
        for id in [&orphan, &retained] {
            assert_eq!(
                authority.persistent[&id.id].stored.purpose,
                Some(EntryPurpose::PgnReadOnlyFile)
            );
            assert_eq!(
                authority.persistent[&id.id].stored.operations,
                canonical_operations(EntryPurpose::PgnReadOnlyFile)
            );
            assert!(authority.resolve(id, PathOperation::ReadPgn, &[]).is_ok());
            assert!(authority.resolve(id, PathOperation::WritePgn, &[]).is_err());
        }
        // Resolve marks successful use as session-owned. Reload once more so the ownership sweep
        // observes both records strictly as startup candidates.
        let registry = authority.registry_path.clone();
        drop(authority);
        let mut authority = PathAuthority::open(
            registry,
            vec![AppOwnedRoot::new(
                "downloads",
                root_path.clone(),
                vec![PathOperation::DownloadFile],
            )],
        )
        .unwrap();
        authority
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![retained.clone()],
                trusted_families: vec![
                    PathOwnerFamily::FileWorkspace,
                    PathOwnerFamily::RecentFiles,
                    PathOwnerFamily::SessionWorkspace,
                    PathOwnerFamily::ExpandedDirectories,
                    PathOwnerFamily::PracticeDeck,
                ],
            })
            .unwrap();
        assert!(!authority.persistent.contains_key(&orphan.id));
        assert!(authority.persistent.contains_key(&retained.id));
        assert_eq!(fs::read(root_path.join("orphan.pgn")).unwrap(), b"1. e4");
        assert_eq!(fs::read(root_path.join("retained.pgn")).unwrap(), b"1. d4");
    }

    #[test]
    fn pending_artifact_never_activates_a_substituted_payload_after_restart() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let registry = dir.path().join("registry.json");
        let staged = dir.path().join("staged.pgn");
        fs::write(&staged, b"expected").unwrap();
        let reservation = {
            let mut authority =
                PathAuthority::open(registry.clone(), vec![app_root.clone()]).unwrap();
            authority
                .reserve_download_artifact(
                    &app_root.id,
                    OsString::from("games.pgn"),
                    sha256_file(&staged).unwrap(),
                    "games.pgn",
                    vec![PathOperation::ReadPgn],
                )
                .unwrap()
        };
        fs::write(root.join("games.pgn"), b"substituted").unwrap();
        let mut recovered = PathAuthority::open(registry, vec![app_root]).unwrap();
        assert!(recovered
            .pending_artifacts
            .iter()
            .any(|item| item.id == reservation.id));
        assert!(recovered.activate_download_artifact(&reservation).is_err());
        assert!(!recovered.persistent.contains_key(&reservation.id.id));
    }

    #[test]
    fn post_rename_marker_rejects_a_byte_identical_external_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let registry = dir.path().join("registry.json");
        let staged = dir.path().join("staged.pgn");
        fs::write(&staged, b"same bytes").unwrap();
        let mut authority = PathAuthority::open(registry, vec![app_root.clone()]).unwrap();
        let reservation = authority
            .reserve_download_artifact(
                &app_root.id,
                OsString::from("games.pgn"),
                sha256_file(&staged).unwrap(),
                "games.pgn",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        authority
            .resolve(
                &app_root.id,
                PathOperation::DownloadFile,
                &[OsString::from("games.pgn")],
            )
            .unwrap()
            .atomic_install_reserved_download(&reservation, &staged)
            .unwrap();
        authority
            .mark_download_artifact_committed(
                &reservation,
                {
                    let identity = identity(&root.join("games.pgn")).unwrap();
                    (identity.a, identity.b)
                },
                {
                    use std::os::unix::fs::MetadataExt;
                    let metadata = fs::metadata(root.join("games.pgn")).unwrap();
                    i128::from(metadata.ctime()) * 1_000_000_000 + i128::from(metadata.ctime_nsec())
                },
            )
            .unwrap();
        fs::remove_file(root.join("games.pgn")).unwrap();
        fs::write(root.join("games.pgn"), b"same bytes").unwrap();
        assert!(authority.activate_download_artifact(&reservation).is_err());
    }

    #[test]
    fn swap_between_rename_and_marker_persistence_is_quarantined_by_temp_fd_identity() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let staged = dir.path().join("staged.pgn");
        fs::write(&staged, b"same bytes").unwrap();
        let mut authority =
            PathAuthority::open(dir.path().join("registry.json"), vec![app_root.clone()]).unwrap();
        let reservation = authority
            .reserve_download_artifact(
                &app_root.id,
                OsString::from("games.pgn"),
                sha256_file(&staged).unwrap(),
                "games.pgn",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let installed = authority
            .resolve(
                &app_root.id,
                PathOperation::DownloadFile,
                &[OsString::from("games.pgn")],
            )
            .unwrap()
            .atomic_install_reserved_download(&reservation, &staged)
            .unwrap();
        fs::remove_file(root.join("games.pgn")).unwrap();
        fs::write(root.join("games.pgn"), b"same bytes").unwrap();
        authority
            .mark_download_artifact_committed(
                &reservation,
                installed.identity,
                installed.ctime_nanos,
            )
            .unwrap();
        assert!(authority.activate_download_artifact(&reservation).is_err());
    }

    struct TestActivationObserver {
        authority: std::sync::Weak<std::sync::Mutex<Option<PathAuthority>>>,
        caller_thread_id: std::thread::ThreadId,
        observed_stages: std::sync::Mutex<Vec<ActivationObserverStage>>,
    }

    impl ActivationObserver for TestActivationObserver {
        fn observe(&self, stage: ActivationObserverStage) {
            let current_thread = std::thread::current().id();
            assert_ne!(
                current_thread, self.caller_thread_id,
                "observer must execute on a blocking worker thread, not caller thread"
            );
            if matches!(
                stage,
                ActivationObserverStage::BeforeRead | ActivationObserverStage::PostVerification
            ) {
                let authority_arc = self
                    .authority
                    .upgrade()
                    .expect("authority must exist during verification");
                let try_lock = authority_arc.try_lock();
                assert!(
                    try_lock.is_ok(),
                    "authority mutex must be unlocked during stage {stage:?}"
                );
            }
            self.observed_stages.lock().unwrap().push(stage);
        }
    }

    struct InstalledArtifactFixture {
        authority: PathAuthority,
        app_root: AppOwnedRoot,
        reservation: PendingArtifactReservation,
        target_path: PathBuf,
        installed: AtomicInstalledFile,
        registry_path: PathBuf,
    }

    impl InstalledArtifactFixture {
        fn new(dir: &Path) -> Self {
            let mut fixture = Self::uncommitted(dir, b"1. e4 e5");
            fixture.mark_committed();
            fixture
        }

        fn with_payload(dir: &Path, payload: &[u8]) -> Self {
            let mut fixture = Self::uncommitted(dir, payload);
            fixture.mark_committed();
            fixture
        }

        fn uncommitted(dir: &Path, payload: &[u8]) -> Self {
            let root_path = dir.join("downloads");
            fs::create_dir_all(&root_path).unwrap();
            let app_root = AppOwnedRoot::new(
                "downloads",
                root_path.clone(),
                vec![PathOperation::DownloadFile],
            );
            let registry_path = dir.join("registry.json");
            let mut authority =
                PathAuthority::open(registry_path.clone(), vec![app_root.clone()]).unwrap();
            let staged = dir.join("staged.pgn");
            fs::write(&staged, payload).unwrap();
            let reservation = authority
                .reserve_download_artifact(
                    &app_root.id,
                    OsString::from("games.pgn"),
                    sha256_file(&staged).unwrap(),
                    "games.pgn",
                    vec![PathOperation::ReadPgn],
                )
                .unwrap();
            let installed = authority
                .resolve(
                    &app_root.id,
                    PathOperation::DownloadFile,
                    &[OsString::from("games.pgn")],
                )
                .unwrap()
                .atomic_install_reserved_download(&reservation, &staged)
                .unwrap();
            let target_path = root_path.join("games.pgn");
            Self {
                authority,
                app_root,
                reservation,
                target_path,
                installed,
                registry_path,
            }
        }

        fn mark_committed(&mut self) {
            self.authority
                .mark_download_artifact_committed(
                    &self.reservation,
                    self.installed.identity,
                    self.installed.ctime_nanos,
                )
                .unwrap();
        }

        fn prepare_and_verify(&mut self) -> ContentVerifiedArtifactActivation {
            let prepared = self
                .authority
                .prepare_download_artifact(&self.reservation)
                .expect("prepare must succeed");
            match prepared.verify() {
                Ok(v) => v,
                Err(e) => panic!("verify must succeed: {e:?}"),
            }
        }
    }

    #[tokio::test]
    async fn test_activation_runtime_helper_observes_hash_offload_and_lock_freedom() {
        let dir = tempfile::tempdir().unwrap();
        let payload_bytes = b"1. e4 e5 2. Nf3 Nc6 3. Bb5";
        let fixture = InstalledArtifactFixture::with_payload(dir.path(), payload_bytes);
        let authority = Arc::new(std::sync::Mutex::new(Some(fixture.authority)));

        let observer = Arc::new(TestActivationObserver {
            authority: Arc::downgrade(&authority),
            caller_thread_id: std::thread::current().id(),
            observed_stages: std::sync::Mutex::new(Vec::new()),
        });

        authority
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .set_activation_observer(Some(observer.clone()));

        let publication = activate_download_artifact_runtime(
            &authority,
            &fixture.reservation,
            fixture.installed.identity,
            fixture.installed.ctime_nanos,
        )
        .await
        .expect("runtime activation must succeed");

        let mut resolved = authority
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .resolve(&publication.handle.id, PathOperation::ReadPgn, &[])
            .expect("publication handle must resolve");
        assert_eq!(resolved.read_bytes().unwrap(), payload_bytes);

        let recorded = observer.observed_stages.lock().unwrap().clone();
        assert!(!recorded.is_empty(), "observer must have fired");
        let before_read_count = recorded
            .iter()
            .filter(|s| **s == ActivationObserverStage::BeforeRead)
            .count();
        assert!(
            before_read_count >= 1,
            "must have observed at least one BeforeRead stage"
        );
        let post_pos = recorded
            .iter()
            .position(|s| *s == ActivationObserverStage::PostVerification)
            .expect("must contain PostVerification");
        let commit_pos = recorded
            .iter()
            .position(|s| *s == ActivationObserverStage::CommitBeforeRetainedDescriptorValidation)
            .expect("must contain commit stage");
        assert!(post_pos > 0 && commit_pos > post_pos);
        assert_eq!(
            *recorded.last().unwrap(),
            ActivationObserverStage::CommitBeforeRetainedDescriptorValidation,
            "last observed stage must be commit stage"
        );
    }

    #[test]
    fn test_activation_rejects_byte_identical_replacement_on_different_inode_and_retains_pending() {
        let dir = tempfile::tempdir().unwrap();
        let content = b"1. d4 d5 2. c4 e6";
        let mut fixture = InstalledArtifactFixture::with_payload(dir.path(), content);

        let prepared = fixture
            .authority
            .prepare_download_artifact(&fixture.reservation)
            .expect("prepare must succeed");

        let verified = match prepared.verify() {
            Ok(v) => v,
            Err(e) => panic!("verify on retained descriptor succeeds: {e:?}"),
        };

        // Between verification and commit, replace target file with byte-identical content on different inode:
        fs::remove_file(&fixture.target_path).unwrap();
        fs::write(&fixture.target_path, content).unwrap();

        let err = fixture
            .authority
            .commit_download_artifact(verified)
            .expect_err("commit must reject byte-identical replacement on different inode");

        assert!(matches!(err, Error::Conflict(_)));
        assert!(fixture
            .authority
            .pending_artifacts
            .iter()
            .any(|p| p.id == fixture.reservation.id));
        assert!(!fixture
            .authority
            .persistent
            .contains_key(&fixture.reservation.id.id));
    }

    struct EofSameBytesRewriteObserver {
        target_path: PathBuf,
        payload: Vec<u8>,
        read_counter: std::sync::atomic::AtomicUsize,
        hook_fired: std::sync::atomic::AtomicBool,
        initial_stamp: i128,
        final_stamp: std::sync::Mutex<Option<i128>>,
    }

    impl ActivationObserver for EofSameBytesRewriteObserver {
        fn observe(&self, stage: ActivationObserverStage) {
            if stage != ActivationObserverStage::BeforeRead {
                return;
            }
            let count = self.read_counter.fetch_add(1, Ordering::SeqCst);
            // The first BeforeRead is before payload bytes are read.
            // The second BeforeRead is the EOF callback after payload was read.
            if count == 1 {
                let mut changed = false;
                for _ in 0..64 {
                    {
                        let mut file = fs::OpenOptions::new()
                            .write(true)
                            .open(&self.target_path)
                            .expect("target must open for rewrite");
                        file.write_all(&self.payload).expect("rewrite must succeed");
                        file.sync_all().expect("sync must succeed");
                    }
                    let reader = fs::File::open(&self.target_path)
                        .expect("target must open to read change stamp");
                    let stamp = opened_file_change_stamp(&reader).expect("stamp must read");
                    if stamp != self.initial_stamp {
                        *self.final_stamp.lock().unwrap() = Some(stamp);
                        changed = true;
                        break;
                    }
                }
                assert!(
                    changed,
                    "must observe a changed real stamp within bounded rewrite attempts"
                );
                self.hook_fired.store(true, Ordering::SeqCst);
            }
        }
    }

    #[test]
    fn test_activation_mutation_during_and_after_verification_rejects() {
        let dir = tempfile::tempdir().unwrap();
        let mut fixture = InstalledArtifactFixture::new(dir.path());

        // Case a: Rewrite SAME bytes in the final BeforeRead callback (EOF callback after payload was read)
        let observer = Arc::new(EofSameBytesRewriteObserver {
            target_path: fixture.target_path.clone(),
            payload: b"1. e4 e5".to_vec(),
            read_counter: std::sync::atomic::AtomicUsize::new(0),
            hook_fired: std::sync::atomic::AtomicBool::new(false),
            initial_stamp: fixture.installed.ctime_nanos,
            final_stamp: std::sync::Mutex::new(None),
        });
        fixture
            .authority
            .set_activation_observer(Some(observer.clone()));

        let prepared = fixture
            .authority
            .prepare_download_artifact(&fixture.reservation)
            .expect("preparation must succeed");

        let verify_err = prepared
            .verify()
            .err()
            .expect("post-hash verification must reject when change stamp changed");
        assert!(matches!(verify_err, Error::Conflict(_)));
        assert!(
            observer.hook_fired.load(Ordering::SeqCst),
            "EOF read observer hook must have fired"
        );
        let final_stamp = observer
            .final_stamp
            .lock()
            .unwrap()
            .expect("final stamp must have been captured");
        assert_ne!(
            final_stamp, observer.initial_stamp,
            "change stamp must differ from initial stamp on real platform"
        );
        assert!(fixture
            .authority
            .pending_artifacts
            .iter()
            .any(|p| p.id == fixture.reservation.id));

        // Clear observer and restore file content and change stamp marker for case b
        fixture.authority.set_activation_observer(None);
        fs::write(&fixture.target_path, b"1. e4 e5").unwrap();
        let restored_file = fs::File::open(&fixture.target_path).unwrap();
        let (new_a, new_b) = opened_file_identity(&restored_file).unwrap();
        let new_change_stamp = opened_file_change_stamp(&restored_file).unwrap();
        fixture
            .authority
            .mark_download_artifact_committed(
                &fixture.reservation,
                (new_a, new_b),
                new_change_stamp,
            )
            .unwrap();

        // Case b: Mutate/touch file after verification before commit
        let prepared2 = fixture
            .authority
            .prepare_download_artifact(&fixture.reservation)
            .unwrap();
        let verified2 = match prepared2.verify() {
            Ok(v) => v,
            Err(e) => panic!("verify must succeed: {e:?}"),
        };
        // Mutate the file on disk after verification
        {
            let mut f = fs::OpenOptions::new()
                .append(true)
                .open(&fixture.target_path)
                .unwrap();
            f.write_all(b" ").unwrap();
        }
        let commit_err = fixture
            .authority
            .commit_download_artifact(verified2)
            .expect_err("commit must reject post-verification modification");
        assert!(matches!(commit_err, Error::Conflict(_)));
        assert!(fixture
            .authority
            .pending_artifacts
            .iter()
            .any(|p| p.id == fixture.reservation.id));
    }

    struct CommitStageMutationObserver {
        target_path: PathBuf,
        fired: std::sync::atomic::AtomicBool,
    }

    impl ActivationObserver for CommitStageMutationObserver {
        fn observe(&self, stage: ActivationObserverStage) {
            if stage == ActivationObserverStage::CommitBeforeRetainedDescriptorValidation {
                let mut f = fs::OpenOptions::new()
                    .write(true)
                    .open(&self.target_path)
                    .expect("target must open for commit-stage mutation");
                f.write_all(b"mutated!").expect("write must succeed");
                f.sync_all().expect("sync must succeed");
                self.fired.store(true, Ordering::SeqCst);
            }
        }
    }

    #[test]
    fn test_activation_commit_rejects_mutation_at_commit_observer_stage_and_retains_pending() {
        let dir = tempfile::tempdir().unwrap();
        let mut fixture = InstalledArtifactFixture::new(dir.path());

        let observer = Arc::new(CommitStageMutationObserver {
            target_path: fixture.target_path.clone(),
            fired: std::sync::atomic::AtomicBool::new(false),
        });
        fixture
            .authority
            .set_activation_observer(Some(observer.clone()));

        let prepared = fixture
            .authority
            .prepare_download_artifact(&fixture.reservation)
            .expect("prepare must succeed");
        let verified = prepared.verify().expect("verify must succeed");

        let commit_err = fixture
            .authority
            .commit_download_artifact(verified)
            .expect_err(
                "commit must reject mutation between current-leaf and retained-descriptor checks",
            );

        assert!(matches!(commit_err, Error::Conflict(_)));
        assert!(
            observer.fired.load(Ordering::SeqCst),
            "commit observer hook must have fired"
        );
        assert!(
            fixture
                .authority
                .pending_artifacts
                .iter()
                .any(|p| p.id == fixture.reservation.id),
            "pending intent must be retained"
        );
        assert!(
            !fixture
                .authority
                .persistent
                .contains_key(&fixture.reservation.id.id),
            "no grant must be published"
        );
    }

    struct ResetInjector;
    impl Drop for ResetInjector {
        fn drop(&mut self) {
            set_test_atomic_file_injector(None);
        }
    }

    struct CountingObserver(std::sync::atomic::AtomicUsize);
    impl ActivationObserver for CountingObserver {
        fn observe(&self, _stage: ActivationObserverStage) {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }

    #[tokio::test]
    async fn test_activation_runtime_marker_uncertain_durability_fails_with_archive_commit_marker()
    {
        let dir = tempfile::tempdir().unwrap();
        let fixture = InstalledArtifactFixture::uncommitted(dir.path(), b"content");
        let authority = Arc::new(std::sync::Mutex::new(Some(fixture.authority)));

        let observer = Arc::new(CountingObserver(std::sync::atomic::AtomicUsize::new(0)));
        authority
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .set_activation_observer(Some(observer.clone()));

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "injected parent sync failure",
        ))));
        let _reset = ResetInjector;

        let result = activate_download_artifact_runtime(
            &authority,
            &fixture.reservation,
            fixture.installed.identity,
            fixture.installed.ctime_nanos,
        )
        .await;

        match result {
            Err(Error::CommittedDurabilityUncertain(stage)) => {
                assert_eq!(stage, crate::error::DurabilityStage::ArchiveCommitMarker);
            }
            other => {
                panic!("expected CommittedDurabilityUncertain(ArchiveCommitMarker), got {other:?}")
            }
        }

        assert_eq!(
            observer.0.load(Ordering::SeqCst),
            0,
            "verification observer must not be called when marker durability fails"
        );

        let auth_guard = authority.lock().unwrap();
        let auth = auth_guard.as_ref().unwrap();
        assert!(auth
            .pending_artifacts
            .iter()
            .any(|p| p.id == fixture.reservation.id));
        assert!(!auth.persistent.contains_key(&fixture.reservation.id.id));
    }

    #[tokio::test]
    async fn test_activation_runtime_marker_write_failure_returns_io_category_and_retains_pending()
    {
        let dir = tempfile::tempdir().unwrap();
        let fixture = InstalledArtifactFixture::uncommitted(dir.path(), b"content");
        let authority = Arc::new(std::sync::Mutex::new(Some(fixture.authority)));

        let observer = Arc::new(CountingObserver(std::sync::atomic::AtomicUsize::new(0)));
        authority
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .set_activation_observer(Some(observer.clone()));

        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        let _reset = ResetInjector;

        let result = activate_download_artifact_runtime(
            &authority,
            &fixture.reservation,
            fixture.installed.identity,
            fixture.installed.ctime_nanos,
        )
        .await;

        let error = result.expect_err("activation must fail on registry write error");
        assert_eq!(error.category(), crate::error::ErrorCategory::Io);

        assert_eq!(
            observer.0.load(Ordering::SeqCst),
            0,
            "verification observer must not be called when marker write fails"
        );

        {
            let auth_guard = authority.lock().unwrap();
            let auth = auth_guard.as_ref().unwrap();
            assert!(auth
                .pending_artifacts
                .iter()
                .any(|p| p.id == fixture.reservation.id));
            assert!(!auth.persistent.contains_key(&fixture.reservation.id.id));
        }

        drop(_reset);
        set_test_atomic_file_injector(None);

        // Reopen to assert retained pending intent on disk
        let reopened = PathAuthority::open(fixture.registry_path, vec![fixture.app_root]).unwrap();
        assert!(reopened
            .pending_artifacts
            .iter()
            .any(|p| p.id == fixture.reservation.id));
        assert!(!reopened.persistent.contains_key(&fixture.reservation.id.id));
    }

    #[test]
    fn test_activation_commit_rejects_abandoned_pending_or_changed_root() {
        // Abandon pending intent
        let dir1 = tempfile::tempdir().unwrap();
        let mut fixture1 = InstalledArtifactFixture::new(dir1.path());
        let verified1 = fixture1.prepare_and_verify();
        fixture1
            .authority
            .abandon_download_artifact(&fixture1.reservation);
        let err1 = fixture1
            .authority
            .commit_download_artifact(verified1)
            .expect_err("commit must reject abandoned intent");
        assert!(matches!(err1, Error::InvalidInput(_)));
        assert!(!fixture1
            .authority
            .pending_artifacts
            .iter()
            .any(|p| p.id == fixture1.reservation.id));
        assert!(!fixture1
            .authority
            .persistent
            .contains_key(&fixture1.reservation.id.id));

        // Remove root from persistent
        let dir2 = tempfile::tempdir().unwrap();
        let mut fixture2 = InstalledArtifactFixture::new(dir2.path());
        let verified2 = fixture2.prepare_and_verify();
        fixture2
            .authority
            .persistent
            .remove(&fixture2.app_root.id.id);
        let err2 = fixture2
            .authority
            .commit_download_artifact(verified2)
            .expect_err("commit must reject removed root");
        assert!(matches!(err2, Error::Conflict(_)));

        // Change root directory identity
        let dir3 = tempfile::tempdir().unwrap();
        let mut fixture3 = InstalledArtifactFixture::new(dir3.path());
        let verified3 = fixture3.prepare_and_verify();
        let target_backup = fs::read(&fixture3.target_path).unwrap();
        let root_dir = fixture3.target_path.parent().unwrap();
        fs::remove_dir_all(root_dir).unwrap();
        fs::create_dir(root_dir).unwrap();
        fs::write(&fixture3.target_path, target_backup).unwrap();
        let err3 = fixture3
            .authority
            .commit_download_artifact(verified3)
            .expect_err("commit must reject changed root identity");
        assert!(matches!(err3, Error::Conflict(_)));
    }

    #[test]
    fn test_activation_commit_rejects_independent_pending_field_mutations() {
        // Parameterized test independently mutating each of the 11 grant-relevant fields
        for field_idx in 0..11 {
            let dir = tempfile::tempdir().unwrap();
            let mut fixture = InstalledArtifactFixture::new(dir.path());
            let verified = fixture.prepare_and_verify();

            let pending = &mut fixture.authority.pending_artifacts[0];
            match field_idx {
                0 => pending.operations = vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                1 => pending.root = PathRef::fresh(),
                2 => pending.filename = NativePath::from_path(Path::new("mutated.pgn")),
                3 => pending.root_identity = Some(Identity { a: 99999, b: 88888 }),
                4 => pending.baseline = Some(Identity { a: 99999, b: 88888 }),
                5 => pending.payload_bound = false,
                6 => pending.payload_size += 1,
                7 => pending.payload_sha256 = "0".repeat(64),
                8 => pending.installed_identity = Some(Identity { a: 99999, b: 88888 }),
                9 => pending.installed_ctime_nanos = Some(0),
                10 => pending.display_name = "mutated display name".to_string(),
                _ => unreachable!(),
            }

            let err = fixture
                .authority
                .commit_download_artifact(verified)
                .unwrap_err();
            assert!(
                matches!(err, Error::Conflict(_)),
                "field mutation {field_idx} must be rejected with Conflict, got {err:?}"
            );
        }
    }

    #[test]
    fn test_recovery_leaves_durable_pending_record_unchanged_on_verification_failure() {
        let dir = tempfile::tempdir().unwrap();
        let fixture = InstalledArtifactFixture::with_payload(dir.path(), b"expected content");

        // Corrupt file on disk
        fs::write(&fixture.target_path, b"corrupted bytes").unwrap();

        // First startup recovery
        let authority1 = PathAuthority::open(
            fixture.registry_path.clone(),
            vec![fixture.app_root.clone()],
        )
        .unwrap();
        assert!(
            authority1
                .pending_artifacts
                .iter()
                .any(|p| p.id == fixture.reservation.id),
            "pending record must be retained after recovery verification failure"
        );
        assert!(!authority1
            .persistent
            .contains_key(&fixture.reservation.id.id));

        // Reopen to verify durable registry file on disk still retains pending record
        let authority2 =
            PathAuthority::open(fixture.registry_path, vec![fixture.app_root]).unwrap();
        assert!(
            authority2
                .pending_artifacts
                .iter()
                .any(|p| p.id == fixture.reservation.id),
            "pending record must persist in registry on disk"
        );
        assert!(!authority2
            .persistent
            .contains_key(&fixture.reservation.id.id));
    }

    #[test]
    fn active_database_root_is_atomic_persistent_and_becomes_unavailable_on_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("databases");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let handle = path_authority
            .get_or_create_database_root(&root, "Databases", None)
            .unwrap();
        path_authority.set_active_database_root(&handle).unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        assert_eq!(
            reloaded.active_database_root().unwrap(),
            Some(handle.clone())
        );

        let replacement = dir.path().join("replacement");
        fs::create_dir(&replacement).unwrap();
        // POSIX atomically replaces an empty directory, whereas Windows
        // requires its target to be absent. The identity change, not either
        // platform's rename rule, is the invariant under test.
        #[cfg(windows)]
        fs::remove_dir(&root).unwrap();
        fs::rename(&replacement, &root).unwrap();
        assert_eq!(reloaded.active_database_root().unwrap(), None);
    }

    const APP_OWNED_DEFAULT_ROOT_LEAVES: &[(AppOwnedDefaultRoot, &str)] = &[
        (AppOwnedDefaultRoot::Databases, "db"),
        (AppOwnedDefaultRoot::Engines, "engines"),
        (AppOwnedDefaultRoot::EngineImages, "engine-images"),
        (AppOwnedDefaultRoot::Puzzles, "puzzles"),
        (AppOwnedDefaultRoot::Credentials, "credentials"),
        #[cfg(target_os = "macos")]
        (AppOwnedDefaultRoot::EngineLaunch, "engine-launch"),
    ];

    #[cfg(unix)]
    #[test]
    fn rebinding_exempts_every_declared_app_owned_default_root() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real_app_data = dir.path().join("real-app-data");
        let app_data_link = dir.path().join("app-data-link");
        fs::create_dir(&real_app_data).unwrap();
        symlink(&real_app_data, &app_data_link).unwrap();
        let mut entries = Vec::new();
        for &(root, leaf) in APP_OWNED_DEFAULT_ROOT_LEAVES {
            fs::create_dir(real_app_data.join(leaf)).unwrap();
            entries.push(stored_entry_for(
                &app_data_link.join(leaf),
                format!("app-owned-{leaf}"),
                None,
                vec![PathOperation::ReadPgn],
            ));
            assert_eq!(root.leaf(), leaf);
        }
        assert_eq!(
            APP_OWNED_DEFAULT_ROOT_LEAVES.len(),
            AppOwnedDefaultRoot::ALL.len()
        );
        for root in AppOwnedDefaultRoot::ALL {
            assert!(
                APP_OWNED_DEFAULT_ROOT_LEAVES
                    .iter()
                    .any(|(candidate, _)| candidate == root),
                "{root:?} is missing from the independent leaf table"
            );
        }
        for (root, _) in APP_OWNED_DEFAULT_ROOT_LEAVES {
            assert!(AppOwnedDefaultRoot::ALL.contains(root));
        }
        let registry = dir.path().join("registry.json");
        write_registry_with_entries(&registry, entries);
        let authority = authority_with_app_data(
            registry,
            vec![],
            Some(AppDataDir::for_test(&app_data_link)),
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        for &(_, leaf) in APP_OWNED_DEFAULT_ROOT_LEAVES {
            let entry = &authority.persistent[&format!("app-owned-{leaf}")];
            assert_eq!(
                entry.stored.path.to_path().unwrap(),
                app_data_link.join(leaf)
            );
            assert_eq!(entry.availability, PathAvailability::Available);
        }
    }

    #[cfg(unix)]
    #[test]
    /// The load-bearing half is the app-owned entry: without the app-data context reaching
    /// `descriptors()`'s refresh, its raw spelling would be quarantined. The second entry is
    /// quarantined because its object changed, not because of its spelling; the spelling branch of
    /// `refresh_entry` is pinned directly by
    /// `refresh_entry_rejects_a_legacy_spelling_even_when_identity_matches`.
    fn descriptors_refresh_keeps_app_owned_spellings_and_quarantines_a_changed_entry() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real_app_data = dir.path().join("real-app-data");
        let app_data_link = dir.path().join("app-data-link");
        let real_external = dir.path().join("real-external");
        let external_link = dir.path().join("external-link");
        fs::create_dir_all(real_app_data.join("db")).unwrap();
        fs::create_dir(&real_external).unwrap();
        fs::write(real_app_data.join("db/owned.pgn"), b"owned").unwrap();
        fs::write(real_external.join("changed.pgn"), b"old").unwrap();
        symlink(&real_app_data, &app_data_link).unwrap();
        symlink(&real_external, &external_link).unwrap();
        let owned = stored_entry_for(
            &app_data_link.join("db/owned.pgn"),
            "descriptor-owned",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        let changed = stored_entry_for(
            &external_link.join("changed.pgn"),
            "descriptor-changed",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        fs::write(real_external.join("replacement"), b"new").unwrap();
        fs::rename(
            real_external.join("replacement"),
            real_external.join("changed.pgn"),
        )
        .unwrap();
        let registry = dir.path().join("registry.json");
        write_registry_with_entries(&registry, vec![owned, changed]);
        let mut authority = authority_with_app_data(
            registry,
            vec![],
            Some(AppDataDir::for_test(&app_data_link)),
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        let descriptors = authority.descriptors();
        let availability = |id: &str| {
            descriptors
                .iter()
                .find(|descriptor| descriptor.id.id == id)
                .map(|descriptor| descriptor.availability)
                .unwrap()
        };
        assert_eq!(
            availability("descriptor-owned"),
            PathAvailability::Available
        );
        assert_eq!(
            availability("descriptor-changed"),
            PathAvailability::Unavailable
        );
    }

    #[cfg(unix)]
    #[test]
    fn app_owned_database_children_and_images_keep_descriptor_bound_spellings() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real_app_data = dir.path().join("real-app-data");
        let app_data_link = dir.path().join("app-data-link");
        fs::create_dir(&real_app_data).unwrap();
        symlink(&real_app_data, &app_data_link).unwrap();
        let app_data = AppDataDir::for_test(&app_data_link);
        fs::create_dir(real_app_data.join("db")).unwrap();
        fs::create_dir(real_app_data.join("engine-images")).unwrap();
        let mut databases = authorize_existing_dir(&real_app_data.join("db")).unwrap();
        databases.path = app_data_link.join("db");
        let mut images = authorize_existing_dir(&real_app_data.join("engine-images")).unwrap();
        images.path = app_data_link.join("engine-images");
        let registry = dir.path().join("registry.json");
        let mut authority = authority_with_app_data(
            registry.clone(),
            vec![],
            Some(app_data),
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        let root = authority
            .get_or_create_database_root(databases.path(), "Databases", Some(databases.identity()))
            .unwrap();
        let child_path = databases.path().join("child.db3");
        fs::write(&child_path, b"database").unwrap();
        let child = authority
            .register_database_child(
                &root,
                OsStr::new("child.db3"),
                "child",
                observed_identity(&child_path),
            )
            .unwrap();
        let image_leaf = OsString::from(Uuid::new_v4().to_string());
        let (_, installed) = images
            .atomic_replace_leaf_identified(&image_leaf, |file| {
                file.write_all(b"engine image").map_err(Error::from)
            })
            .unwrap();
        let image = authority
            .register_engine_image(&images, &image_leaf, installed, "image".into())
            .unwrap();
        for id in [
            root.path_ref().clone(),
            child.path_ref().clone(),
            image.path_ref().clone(),
        ] {
            let path = authority.persistent[&id.id].stored.path.to_path().unwrap();
            assert!(path.starts_with(&app_data_link));
            assert_eq!(
                authority.persistent[&id.id].availability,
                PathAvailability::Available
            );
            authority.refresh_persistent_id(&id);
            assert_eq!(
                authority.persistent[&id.id].availability,
                PathAvailability::Available
            );
        }
        assert_eq!(
            authority.persistent[&root.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            databases.path()
        );
        assert_eq!(
            authority.persistent[&child.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            child_path
        );
        assert_eq!(
            authority.persistent[&image.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            images.path().join(&image_leaf)
        );
        drop(authority);

        let mut reopened = authority_with_app_data(
            registry,
            vec![],
            Some(AppDataDir::for_test(&app_data_link)),
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        let reused_root = reopened
            .get_or_create_database_root(databases.path(), "Databases", Some(databases.identity()))
            .unwrap();
        assert_eq!(reused_root.path_ref(), root.path_ref());
        assert!(reopened
            .database_file_target(
                &DatabaseHandle::new(child.path_ref().clone()),
                PathOperation::DatabaseRead
            )
            .is_ok());
        for id in [root.path_ref(), child.path_ref(), image.path_ref()] {
            reopened.refresh_persistent_id(id);
            assert_eq!(
                reopened.persistent[&id.id].availability,
                PathAvailability::Available
            );
        }
        reopened
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![image.path_ref().clone()],
                startup: false,
            })
            .unwrap();
        let mut reopened_images =
            authorize_existing_dir(&real_app_data.join("engine-images")).unwrap();
        reopened_images.path = app_data_link.join("engine-images");
        reopened
            .cleanup_engine_images(&reopened_images, false)
            .unwrap();
        assert!(!images.path().join(&image_leaf).exists());
    }

    #[cfg(unix)]
    #[test]
    fn runtime_app_owned_root_is_exempt_by_class_and_not_by_path() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("runtime-real");
        let link = dir.path().join("runtime-link");
        fs::create_dir(&real).unwrap();
        fs::create_dir(real.join("managed")).unwrap();
        symlink(&real, &link).unwrap();
        let app_data = dir.path().join("app-data");
        fs::create_dir(&app_data).unwrap();
        let app = AppOwnedRoot::new(
            "runtime",
            link.join("managed"),
            vec![PathOperation::ReadPgn],
        );
        let id = app.id.clone();
        let mut authority = authority_with_app_data(
            dir.path().join("registry.json"),
            vec![app],
            Some(AppDataDir::for_test(&app_data)),
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        assert_eq!(
            authority.persistent[&id.id].stored.path.to_path().unwrap(),
            link.join("managed")
        );
        assert_eq!(
            authority.persistent[&id.id].availability,
            PathAvailability::Available
        );
        authority.refresh_persistent_id(&id);
        assert_eq!(
            authority.persistent[&id.id].availability,
            PathAvailability::Available
        );
        assert_eq!(
            authority.persistent[&id.id].stored.path.to_path().unwrap(),
            link.join("managed")
        );
    }

    #[cfg(unix)]
    #[test]
    fn parent_dir_spelling_under_app_data_is_not_exempt() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real_app_data = dir.path().join("real-app-data");
        let app_data_link = dir.path().join("app-data-link");
        fs::create_dir_all(real_app_data.join("db")).unwrap();
        fs::create_dir_all(dir.path().join("outside/workspace")).unwrap();
        symlink(&real_app_data, &app_data_link).unwrap();
        let legacy = app_data_link.join("db/../../outside/workspace");
        let entry = stored_entry_for(
            &legacy,
            "parent-dir-entry",
            Some(EntryPurpose::PgnWorkspace),
            canonical_operations(EntryPurpose::PgnWorkspace),
        );
        let registry = dir.path().join("registry.json");
        write_registry_with_entries(&registry, vec![entry]);
        let authority = authority_with_app_data(
            registry,
            vec![],
            Some(AppDataDir::for_test(&app_data_link)),
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        let stored = &authority.persistent["parent-dir-entry"];
        assert_ne!(stored.stored.path.to_path().unwrap(), legacy);
        assert_eq!(stored.availability, PathAvailability::Available);
    }

    #[cfg(unix)]
    #[test]
    fn app_owned_leaf_name_does_not_exempt_a_sibling_path() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let app_data = dir.path().join("app-data");
        let real_sibling = dir.path().join("real-sibling");
        let sibling_link = dir.path().join("sibling-link");
        fs::create_dir(&app_data).unwrap();
        fs::create_dir_all(real_sibling.join("db")).unwrap();
        symlink(&real_sibling, &sibling_link).unwrap();
        let entry = stored_entry_for(
            &sibling_link.join("db"),
            "sibling-db",
            Some(EntryPurpose::PgnWorkspace),
            canonical_operations(EntryPurpose::PgnWorkspace),
        );
        let registry = dir.path().join("registry.json");
        write_registry_with_entries(&registry, vec![entry]);
        let authority = authority_with_app_data(
            registry,
            vec![],
            Some(AppDataDir::for_test(&app_data)),
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        assert_eq!(
            authority.persistent["sibling-db"]
                .stored
                .path
                .to_path()
                .unwrap(),
            real_sibling.join("db")
        );
        assert_eq!(
            authority.persistent["sibling-db"].availability,
            PathAvailability::Available
        );
    }

    #[cfg(unix)]
    #[test]
    fn reselecting_rebound_file_and_root_reuses_the_existing_ids() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir_all(real.join("workspace")).unwrap();
        fs::write(real.join("study.pgn"), b"*").unwrap();
        symlink(&real, &link).unwrap();
        let file = stored_entry_for(
            &link.join("study.pgn"),
            "reselect-file",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        let root = stored_entry_for(
            &link.join("workspace"),
            "reselect-root",
            Some(EntryPurpose::DatabaseRoot),
            canonical_operations(EntryPurpose::DatabaseRoot),
        );
        let registry = dir.path().join("registry.json");
        write_registry_with_entries(&registry, vec![file, root]);
        let mut authority = PathAuthority::open(registry, vec![]).unwrap();
        let file_commit = authority
            .get_or_create_persistent_file(
                &link.join("study.pgn"),
                "study",
                canonical_operations(EntryPurpose::PgnFile),
            )
            .unwrap();
        let root_handle = authority
            .get_or_create_database_root(&link.join("workspace"), "workspace", None)
            .unwrap();
        assert_eq!(file_commit.id.id, "reselect-file");
        assert_eq!(root_handle.id.id, "reselect-root");
        assert_eq!(authority.persistent.len(), 2);
    }

    #[cfg(unix)]
    #[test]
    fn malformed_persistent_path_and_pending_root_do_not_abort_startup() {
        let dir = tempfile::tempdir().unwrap();
        let valid_path = dir.path().join("valid.pgn");
        fs::write(&valid_path, b"valid").unwrap();
        let malformed = StoredEntry {
            id: PathRef {
                id: "malformed-entry".into(),
            },
            display_name: "malformed".into(),
            class: PathClass::PersistentFile,
            purpose: Some(EntryPurpose::PgnFile),
            operations: canonical_operations(EntryPurpose::PgnFile),
            path: NativePath::Unix { bytes: "!".into() },
            identity: Identity { a: 0, b: 0 },
            target_is_dir: false,
        };
        let valid = stored_entry_for(
            &valid_path,
            "valid-entry",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        let pending = pending_test_artifact(&malformed.id, "malformed-pending");
        let registry = dir.path().join("registry.json");
        write_registry(
            &registry,
            &Registry {
                schema_version: SCHEMA_VERSION,
                entries: vec![malformed, valid],
                active_database_root: None,
                active_puzzle_root: None,
                active_engine_root: None,
                pending_artifacts: vec![pending],
                provisional_attachments: BTreeSet::new(),
                image_cleanup: vec![],
            },
        );
        let capture = crate::error::LogCaptureScope::start();
        let authority = PathAuthority::open(registry, vec![]).unwrap();
        assert_eq!(
            authority.persistent["malformed-entry"].availability,
            PathAvailability::Unavailable
        );
        assert_eq!(
            authority.persistent["valid-entry"].availability,
            PathAvailability::Available
        );
        assert_eq!(authority.pending_artifacts.len(), 1);
        assert!(
            capture
                .messages()
                .iter()
                .filter(|message| message.contains("malformed-entry"))
                .count()
                >= 2
        );
    }

    #[cfg(unix)]
    #[test]
    fn pending_artifact_recovery_survives_legacy_root_rebinding() {
        use std::os::unix::fs::symlink;
        use std::os::unix::fs::MetadataExt;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        let downloads = real.join("downloads");
        fs::create_dir_all(&downloads).unwrap();
        symlink(&real, &link).unwrap();
        let root = stored_entry_for(
            &link.join("downloads"),
            "legacy-pending-root",
            Some(EntryPurpose::DownloadDestination),
            canonical_operations(EntryPurpose::DownloadDestination),
        );
        let artifact_path = downloads.join("artifact.pgn");
        fs::write(&artifact_path, b"artifact").unwrap();
        let artifact_identity = identity(&artifact_path).unwrap();
        let metadata = fs::metadata(&artifact_path).unwrap();
        let pending = PendingArtifact {
            id: PathRef {
                id: "recovered-artifact".into(),
            },
            root: root.id.clone(),
            filename: NativePath::from_path(Path::new("artifact.pgn")),
            display_name: "artifact".into(),
            operations: canonical_operations(EntryPurpose::PgnReadOnlyFile),
            baseline: None,
            root_identity: Some(root.identity.clone()),
            payload_size: 8,
            payload_sha256: sha256_file(&artifact_path).unwrap().1,
            payload_bound: true,
            installed_identity: Some(artifact_identity.clone()),
            installed_ctime_nanos: Some(
                i128::from(metadata.ctime()) * 1_000_000_000 + i128::from(metadata.ctime_nsec()),
            ),
        };
        let registry = dir.path().join("registry.json");
        write_registry(
            &registry,
            &Registry {
                schema_version: SCHEMA_VERSION,
                entries: vec![root],
                active_database_root: None,
                active_puzzle_root: None,
                active_engine_root: None,
                pending_artifacts: vec![pending],
                provisional_attachments: BTreeSet::new(),
                image_cleanup: vec![],
            },
        );
        let authority = PathAuthority::open(registry, vec![]).unwrap();
        assert_eq!(
            authority.persistent["legacy-pending-root"]
                .stored
                .path
                .to_path()
                .unwrap(),
            downloads
        );
        assert!(authority.pending_artifacts.is_empty());
        assert!(authority.persistent.contains_key("recovered-artifact"));
    }

    /// The leaves are written out verbatim rather than read back from the enum. A leaf is the
    /// identity of an existing user's app-data directory, so a test that asks the enum what
    /// its leaf is would copy a mistyped one into its own assertion and stay green forever.
    #[test]
    fn ensure_app_owned_default_dir_creates_each_root_under_its_own_leaf() {
        let dir = tempfile::tempdir().unwrap();
        for &(root, leaf) in APP_OWNED_DEFAULT_ROOT_LEAVES {
            let created =
                ensure_app_owned_default_dir(&AppDataDir::for_test(dir.path()), root).unwrap();
            assert_eq!(created.path(), dir.path().join(leaf));
            assert!(
                created.path().is_dir(),
                "{root:?} must create the directory {leaf}"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn ensure_app_owned_default_dir_applies_only_declared_private_mode() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        for &(_, leaf) in APP_OWNED_DEFAULT_ROOT_LEAVES {
            let path = dir.path().join(leaf);
            fs::create_dir(&path).unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        }

        for &(root, leaf) in APP_OWNED_DEFAULT_ROOT_LEAVES {
            let directory =
                ensure_app_owned_default_dir(&AppDataDir::for_test(dir.path()), root).unwrap();
            let mode = fs::metadata(directory.path()).unwrap().permissions().mode() & 0o7777;
            let expected_mode = match root {
                AppOwnedDefaultRoot::Credentials => 0o700,
                #[cfg(target_os = "macos")]
                AppOwnedDefaultRoot::EngineLaunch => 0o700,
                _ => 0o755,
            };
            assert_eq!(directory.path(), dir.path().join(leaf));
            assert_eq!(mode, expected_mode, "unexpected mode for {root:?}");
        }
    }

    #[test]
    fn ensure_app_owned_default_dir_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let first = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Databases,
        )
        .expect("first call creates the root");
        let second = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Databases,
        )
        .expect("second call accepts the existing root");
        assert_eq!(first.path(), second.path());
        assert!(second.path().is_dir());
    }

    #[test]
    fn ensure_app_owned_default_dir_rejects_a_regular_file_as_io() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("db"), b"not a directory").unwrap();
        let error = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Databases,
        )
        .expect_err("a regular file at the leaf must be refused");
        assert!(
            matches!(error, Error::Io(_)),
            "the refusal must stay Error::Io, which renders fixed text: {error:?}"
        );
    }

    /// Per variant, not once: `create_dir_all` succeeds on a symlink to an existing directory,
    /// and `EngineImages` and `Credentials` are the variants no `get_or_create_*_root` — and
    /// therefore no `validate_target` — ever follows.
    #[cfg(unix)]
    #[test]
    fn ensure_app_owned_default_dir_refuses_a_symlinked_leaf_for_every_root() {
        for &(root, leaf) in APP_OWNED_DEFAULT_ROOT_LEAVES {
            let dir = tempfile::tempdir().unwrap();
            let app_data = dir.path().join("app-data");
            let elsewhere = dir.path().join("elsewhere");
            fs::create_dir(&app_data).unwrap();
            fs::create_dir(&elsewhere).unwrap();
            std::os::unix::fs::symlink(&elsewhere, app_data.join(leaf)).unwrap();

            let error = ensure_app_owned_default_dir(&AppDataDir::for_test(&app_data), root)
                .expect_err("a symlinked leaf must be refused");
            assert!(
                matches!(error, Error::Io(_)),
                "{root:?} must be refused as Error::Io: {error:?}"
            );
            assert_eq!(
                fs::read_dir(&elsewhere).unwrap().count(),
                0,
                "{root:?} must not write through the symlink"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn ensure_app_owned_default_dir_maps_descriptor_open_failure_to_io() {
        if unsafe { libc::geteuid() } == 0 {
            return;
        }
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("db");
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o000)).unwrap();

        let result = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::Databases,
        );
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        let error = result.expect_err("opening a permissionless directory must fail");
        assert!(matches!(error, Error::Io(_)), "{error:?}");
    }

    #[cfg(unix)]
    #[test]
    fn open_app_owned_resource_dir_distinguishes_missing_and_symlinked_sound() {
        let missing_root = tempfile::tempdir().unwrap();
        let before = fs::read_dir(missing_root.path()).unwrap().count();
        let missing = open_app_owned_resource_dir(&ResourceDir::for_test(missing_root.path()))
            .expect_err("missing sound must be refused");
        let missing_kind = match missing {
            Error::Io(error) => error.kind(),
            other => panic!("missing sound must be Error::Io: {other:?}"),
        };
        assert_eq!(missing_kind, std::io::ErrorKind::NotFound);
        assert_eq!(fs::read_dir(missing_root.path()).unwrap().count(), before);

        let symlink_root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), symlink_root.path().join("sound")).unwrap();
        let before = fs::read_dir(symlink_root.path()).unwrap().count();
        let symlinked = open_app_owned_resource_dir(&ResourceDir::for_test(symlink_root.path()))
            .expect_err("symlinked sound must be refused");
        let symlink_kind = match symlinked {
            Error::Io(error) => error.kind(),
            other => panic!("symlinked sound must be Error::Io: {other:?}"),
        };
        assert_eq!(symlink_kind, std::io::ErrorKind::InvalidInput);
        assert_eq!(fs::read_dir(symlink_root.path()).unwrap().count(), before);
        assert_eq!(fs::read_dir(outside.path()).unwrap().count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn authorized_dir_opens_nested_regular_file() {
        use std::io::Read as _;
        let root = tempfile::tempdir().unwrap();
        let sound = root.path().join("sound");
        fs::create_dir_all(sound.join("a")).unwrap();
        fs::write(sound.join("a/b"), b"nested bytes").unwrap();
        let directory = open_app_owned_resource_dir(&ResourceDir::for_test(root.path())).unwrap();

        let mut opened = directory.open_regular_relative(Path::new("a/b")).unwrap();
        let mut bytes = Vec::new();
        opened.read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes, b"nested bytes");
    }

    #[cfg(unix)]
    #[test]
    fn authorized_dir_refuses_invalid_relative_components() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("sound")).unwrap();
        let directory = open_app_owned_resource_dir(&ResourceDir::for_test(root.path())).unwrap();
        for relative in ["../x", "./x", "a//b", "/absolute"] {
            assert!(
                directory
                    .open_regular_relative(Path::new(relative))
                    .is_err(),
                "{relative} must be refused"
            );
        }
        let nul = PathBuf::from(OsString::from_vec(b"name\0tail".to_vec()));
        assert!(directory.open_regular_relative(&nul).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn authorized_dir_refuses_an_intermediate_symlink() {
        let root = tempfile::tempdir().unwrap();
        let sound = root.path().join("sound");
        let outside = root.path().join("outside");
        fs::create_dir(&sound).unwrap();
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("x.mp3"), b"outside").unwrap();
        std::os::unix::fs::symlink(&outside, sound.join("link")).unwrap();
        let directory = open_app_owned_resource_dir(&ResourceDir::for_test(root.path())).unwrap();

        assert!(directory
            .open_regular_relative(Path::new("link/x.mp3"))
            .is_err());
    }

    #[cfg(unix)]
    #[test]
    fn authorized_dir_removes_only_a_matching_installed_leaf() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("sound")).unwrap();
        let directory = open_app_owned_resource_dir(&ResourceDir::for_test(root.path())).unwrap();
        let (_, installed) = directory
            .atomic_replace_leaf_identified(OsStr::new("track.mp3"), |file| {
                file.write_all(b"track").map_err(Error::from)
            })
            .unwrap();

        let other_root = tempfile::tempdir().unwrap();
        fs::create_dir(other_root.path().join("sound")).unwrap();
        let other = open_app_owned_resource_dir(&ResourceDir::for_test(other_root.path())).unwrap();
        assert!(directory
            .remove_leaf_identified(OsStr::new("track.mp3"), other.identity())
            .is_err());
        assert!(root.path().join("sound/track.mp3").is_file());

        directory
            .remove_leaf_identified(OsStr::new("track.mp3"), installed)
            .unwrap();
        assert!(!root.path().join("sound/track.mp3").exists());
    }

    #[cfg(unix)]
    #[test]
    fn authorized_dir_remove_leaf_refuses_a_non_leaf_name() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("sound")).unwrap();
        let directory = open_app_owned_resource_dir(&ResourceDir::for_test(root.path())).unwrap();
        let leaf = OsStr::new("track.mp3");
        let (_, installed) = directory
            .atomic_replace_leaf_identified(leaf, |file| {
                file.write_all(b"track").map_err(Error::from)
            })
            .unwrap();

        for invalid in ["../outside", "", "nested/track.mp3", "/absolute"] {
            assert!(
                directory
                    .remove_leaf_identified(OsStr::new(invalid), installed)
                    .is_err(),
                "{invalid} must be refused"
            );
            assert!(
                root.path().join("sound/track.mp3").is_file(),
                "the installed leaf must survive refusal of {invalid}"
            );
        }
    }

    #[test]
    fn authorized_dir_has_no_arbitrary_path_constructor() {
        let source = include_str!("mod.rs");
        for signature in ["impl AuthorizedDir {", "impl super::AuthorizedDir {"] {
            let implementation = body_at_indent(source, signature);
            assert!(!implementation.contains("for_test"), "{implementation}");
            assert!(!implementation.contains("fn new("), "{implementation}");
            assert!(!implementation.contains("path: &Path"), "{implementation}");
            assert!(
                !implementation.contains("path: PathBuf"),
                "{implementation}"
            );
        }

        let private_authorizer = ["authorize_existing", "_dir(path: &Path)"].concat();
        let expected_authorizer_signature =
            format!("fn {private_authorizer} -> Result<AuthorizedDir, Error> {{");
        let authorize_signatures: Vec<_> = source
            .lines()
            .filter(|line| line.contains(&private_authorizer))
            .collect();
        assert_eq!(authorize_signatures.len(), 2, "{authorize_signatures:?}");
        assert!(authorize_signatures
            .iter()
            .all(|line| *line == expected_authorizer_signature));

        let mut signature = String::new();
        let mut signature_is_public = false;
        let mut public_producers = Vec::new();
        for line in source.lines() {
            if line.contains("fn ") {
                signature.clear();
                signature.push_str(line.trim());
                signature_is_public = line.trim_start().starts_with("pub ")
                    || line.trim_start().starts_with("pub(crate) ");
            } else if !signature.is_empty() {
                signature.push_str(line.trim());
            }
            if !line.contains("-> Result<AuthorizedDir") {
                continue;
            }
            if signature_is_public {
                let name = signature
                    .split_once("fn ")
                    .expect("function signature")
                    .1
                    .split_once('(')
                    .expect("function parameters")
                    .0;
                let parameters_start = signature.find('(').expect("function parameters") + 1;
                let parameters_end = signature.find("->").expect("function return");
                let parameters = &signature[parameters_start..parameters_end];
                assert!(!parameters.contains("&Path"), "{signature}");
                assert!(!parameters.contains("PathBuf"), "{signature}");
                public_producers.push(name.to_owned());
            }
        }
        assert_eq!(
            public_producers
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>(),
            [
                "ensure_app_owned_default_dir",
                "open_app_owned_resource_dir"
            ]
        );
    }

    #[test]
    fn bundled_sound_paths_cover_every_collection_and_kind() {
        let root = PathBuf::from("resource-root");
        let resource_dir = ResourceDir::for_test(&root);
        let mut resolved_pairs = 0;
        for (collection, has_check) in BUNDLED_SOUND_COLLECTIONS {
            for (kind, file_name) in [
                (SoundKind::Move, "Move.mp3"),
                (SoundKind::Capture, "Capture.mp3"),
                (SoundKind::Check, "Check.mp3"),
            ] {
                if matches!(kind, SoundKind::Check) && !has_check {
                    assert!(matches!(
                        resource_dir.bundled_sound_path(collection, kind),
                        Err(Error::InvalidInput(message))
                            if message == "no bundled check sound in that collection"
                    ));
                    continue;
                }
                assert_eq!(
                    resource_dir.bundled_sound_path(collection, kind).unwrap(),
                    root.join("sound").join(collection).join(file_name)
                );
                resolved_pairs += 1;
            }
        }
        assert_eq!(resolved_pairs, 23);
    }

    #[test]
    fn bundled_sound_paths_reject_unknown_and_traversal_collections() {
        let resource_dir = ResourceDir::for_test(Path::new("resource-root"));
        for collection in ["unknown", "../x"] {
            assert!(matches!(
                resource_dir.bundled_sound_path(collection, SoundKind::Move),
                Err(Error::InvalidInput(_))
            ));
        }
    }

    /// Tauri production path resolution cannot be exercised by a unit test. Keep the constructor
    /// expression pinned so it cannot append `sound` (or any other component) twice.
    #[test]
    fn resource_dir_for_app_is_exactly_the_resource_root() {
        let source = include_str!("mod.rs");
        let resource = source
            .split_once("impl ResourceDir {")
            .expect("ResourceDir implementation")
            .1;
        let body = body_at_indent(resource, "pub(crate) fn for_app<R: tauri::Runtime>(");
        let expression = body.split_once('{').expect("constructor body").1;
        let compact: String = expression.split_whitespace().collect();
        assert_eq!(compact, "Ok(Self(app.path().resource_dir()?))", "{body}");
        assert!(!body.contains(".join("), "{body}");
        assert!(!body.contains("BaseDirectory::"), "{body}");
        assert!(!body.contains('"'), "{body}");
    }

    /// The default callers materialise their directory before registering it; the dialog
    /// callers must not. An absent user-picked folder means the disk changed under the user,
    /// and the answer is an error rather than a silently recreated empty root. One test per
    /// method, because with only one covered the other two could be converted quietly.
    #[test]
    fn get_or_create_database_root_refuses_an_absent_directory() {
        let dir = tempfile::tempdir().unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let absent = dir.path().join("absent-database-root");
        assert!(path_authority
            .get_or_create_database_root(&absent, "Databases", None)
            .is_err());
        assert!(!absent.exists(), "the absent root must not be created");
    }

    #[test]
    fn get_or_create_engine_root_refuses_an_absent_directory() {
        let dir = tempfile::tempdir().unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let absent = dir.path().join("absent-engine-root");
        assert!(path_authority
            .get_or_create_engine_root(&absent, "Engines", None)
            .is_err());
        assert!(!absent.exists(), "the absent root must not be created");
    }

    #[test]
    fn get_or_create_puzzle_root_refuses_an_absent_directory() {
        let dir = tempfile::tempdir().unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let absent = dir.path().join("absent-puzzle-root");
        assert!(path_authority
            .get_or_create_puzzle_root(&absent, "Puzzles", None)
            .is_err());
        assert!(!absent.exists(), "the absent root must not be created");
    }

    fn get_or_create_app_owned_test_root(
        path_authority: &mut PathAuthority,
        root: AppOwnedDefaultRoot,
        directory: &AuthorizedDir,
        expected_identity: VerifiedIdentity,
    ) -> Result<PathRef, Error> {
        match root {
            AppOwnedDefaultRoot::Databases => path_authority
                .get_or_create_database_root(directory.path(), "Databases", Some(expected_identity))
                .map(|handle| handle.path_ref().clone()),
            AppOwnedDefaultRoot::Engines => path_authority
                .get_or_create_engine_root(directory.path(), "Engines", Some(expected_identity))
                .map(|handle| handle.path_ref().clone()),
            AppOwnedDefaultRoot::Puzzles => path_authority
                .get_or_create_puzzle_root(directory.path(), "Puzzles", Some(expected_identity))
                .map(|handle| handle.path_ref().clone()),
            AppOwnedDefaultRoot::EngineImages | AppOwnedDefaultRoot::Credentials => {
                panic!("engine images and credentials do not have a persistent root entry")
            }
            #[cfg(target_os = "macos")]
            AppOwnedDefaultRoot::EngineLaunch => {
                panic!("engine launch does not have a persistent root entry")
            }
        }
    }

    fn set_active_app_owned_test_root(
        path_authority: &mut PathAuthority,
        root: AppOwnedDefaultRoot,
        id: &PathRef,
    ) {
        match root {
            AppOwnedDefaultRoot::Databases => path_authority
                .set_active_database_root(&DatabaseRootHandle::new(id.clone()))
                .unwrap(),
            AppOwnedDefaultRoot::Engines => path_authority
                .set_active_engine_root(&EngineRootHandle::new(id.clone()))
                .unwrap(),
            AppOwnedDefaultRoot::Puzzles => path_authority
                .set_active_puzzle_root(&PuzzleRootHandle::new(id.clone()))
                .unwrap(),
            AppOwnedDefaultRoot::EngineImages | AppOwnedDefaultRoot::Credentials => {
                panic!("engine images and credentials do not have a persistent root entry")
            }
            #[cfg(target_os = "macos")]
            AppOwnedDefaultRoot::EngineLaunch => {
                panic!("engine launch does not have a persistent root entry")
            }
        }
    }

    fn assert_active_app_owned_test_root_is_absent(
        path_authority: &mut PathAuthority,
        root: AppOwnedDefaultRoot,
    ) {
        match root {
            AppOwnedDefaultRoot::Databases => {
                assert_eq!(path_authority.active_database_root().unwrap(), None)
            }
            AppOwnedDefaultRoot::Engines => {
                assert_eq!(path_authority.active_engine_root().unwrap(), None)
            }
            AppOwnedDefaultRoot::Puzzles => {
                assert_eq!(path_authority.active_puzzle_root().unwrap(), None)
            }
            AppOwnedDefaultRoot::EngineImages | AppOwnedDefaultRoot::Credentials => {
                panic!("engine images and credentials do not have a persistent root entry")
            }
            #[cfg(target_os = "macos")]
            AppOwnedDefaultRoot::EngineLaunch => {
                panic!("engine launch does not have a persistent root entry")
            }
        }
    }

    fn persist_test_entry(
        path_authority: &mut PathAuthority,
        path: &Path,
        id: &str,
        purpose: EntryPurpose,
    ) -> PathRef {
        let stored = stored_entry_for(path, id, Some(purpose), canonical_operations(purpose));
        let id = stored.id.clone();
        let mut candidate = path_authority.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        path_authority.commit_candidate(candidate, None).unwrap();
        id
    }

    fn pending_test_artifact(root: &PathRef, id: &str) -> PendingArtifact {
        PendingArtifact {
            id: PathRef { id: id.into() },
            root: root.clone(),
            filename: NativePath::from_path(Path::new("artifact")),
            display_name: id.into(),
            operations: vec![PathOperation::ReadPgn],
            baseline: None,
            root_identity: None,
            payload_size: 0,
            payload_sha256: String::new(),
            payload_bound: false,
            installed_identity: None,
            installed_ctime_nanos: None,
        }
    }

    fn assert_app_owned_root_recovers_after_deleted_directory(root: AppOwnedDefaultRoot) {
        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let initial = ensure_app_owned_default_dir(&app_data, root).unwrap();
        let old_identity = initial.identity();
        let old_path = initial.path().to_path_buf();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let old_id =
            get_or_create_app_owned_test_root(&mut path_authority, root, &initial, old_identity)
                .unwrap();
        set_active_app_owned_test_root(&mut path_authority, root, &old_id);

        fs::remove_dir_all(&old_path).unwrap();
        assert_active_app_owned_test_root_is_absent(&mut path_authority, root);

        let replacement = ensure_app_owned_default_dir(&app_data, root).unwrap();
        assert_ne!(replacement.identity(), old_identity);
        let new_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            root,
            &replacement,
            replacement.identity(),
        )
        .unwrap();
        set_active_app_owned_test_root(&mut path_authority, root, &new_id);

        assert!(!path_authority.persistent.contains_key(&old_id.id));
        assert_eq!(
            path_authority.persistent[&new_id.id].availability,
            PathAvailability::Available
        );
        assert_eq!(
            path_authority.persistent[&new_id.id].stored.identity,
            Identity {
                a: replacement.identity().pair().0,
                b: replacement.identity().pair().1,
            }
        );

        let reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(!reopened.persistent.contains_key(&old_id.id));
        assert_eq!(
            reopened.persistent[&new_id.id].availability,
            PathAvailability::Available
        );
        assert_eq!(
            reopened.persistent[&new_id.id].stored.identity,
            Identity {
                a: replacement.identity().pair().0,
                b: replacement.identity().pair().1,
            }
        );
        assert!(reopened
            .provisional_attachments
            .iter()
            .all(|id| reopened.persistent.contains_key(id)));
    }

    #[test]
    fn app_owned_database_root_recovers_after_deleted_directory() {
        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let databases =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let engines =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Engines).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let old_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &databases,
            databases.identity(),
        )
        .unwrap();
        set_active_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &old_id,
        );
        let engines_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Engines,
            &engines,
            engines.identity(),
        )
        .unwrap();
        let resource = engines.path().join("resource.nnue");
        let resource_handle = attachment_resource(&mut path_authority, &resource);
        assert!(path_authority
            .persistent
            .contains_key(&resource_handle.id.id));
        assert!(path_authority
            .provisional_attachments
            .contains(&resource_handle.id.id));
        assert!(path_authority.persistent.contains_key(&engines_id.id));

        let old_identity = databases.identity();
        fs::remove_dir_all(databases.path()).unwrap();
        assert_eq!(path_authority.active_database_root().unwrap(), None);
        let replacement =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        assert_ne!(replacement.identity(), old_identity);
        let new_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &replacement,
            replacement.identity(),
        )
        .unwrap();
        set_active_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &new_id,
        );
        assert!(!path_authority.persistent.contains_key(&old_id.id));
        assert!(path_authority.persistent.contains_key(&engines_id.id));
        assert!(path_authority
            .persistent
            .contains_key(&resource_handle.id.id));
        assert!(path_authority
            .provisional_attachments
            .contains(&resource_handle.id.id));

        let reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(!reopened.persistent.contains_key(&old_id.id));
        assert!(reopened.persistent.contains_key(&engines_id.id));
        assert!(reopened.persistent.contains_key(&resource_handle.id.id));
        assert!(reopened
            .provisional_attachments
            .contains(&resource_handle.id.id));
    }

    #[test]
    fn app_owned_engine_root_recovers_after_deleted_directory() {
        assert_app_owned_root_recovers_after_deleted_directory(AppOwnedDefaultRoot::Engines);
    }

    #[test]
    fn app_owned_puzzle_root_recovers_after_deleted_directory() {
        assert_app_owned_root_recovers_after_deleted_directory(AppOwnedDefaultRoot::Puzzles);
    }

    #[test]
    fn app_owned_database_root_recovery_prunes_stale_descendants() {
        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let databases =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let old_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &databases,
            databases.identity(),
        )
        .unwrap();
        set_active_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &old_id,
        );

        let nested = databases.path().join("nested");
        let nested_file = nested.join("child");
        fs::create_dir(&nested).unwrap();
        fs::write(&nested_file, b"child").unwrap();
        let nested_id = persist_test_entry(
            &mut path_authority,
            &nested,
            "stale-nested",
            EntryPurpose::PgnWorkspace,
        );
        let nested_file_id = persist_test_entry(
            &mut path_authority,
            &nested_file,
            "stale-nested-file",
            EntryPurpose::PgnFile,
        );
        let sibling_root = dir.path().join("surviving");
        let sibling_file = sibling_root.join("sibling");
        fs::create_dir(&sibling_root).unwrap();
        fs::write(&sibling_file, b"sibling").unwrap();
        let sibling_id = persist_test_entry(
            &mut path_authority,
            &sibling_root,
            "surviving-root",
            EntryPurpose::PgnWorkspace,
        );
        let sibling_file_id = persist_test_entry(
            &mut path_authority,
            &sibling_file,
            "surviving-file",
            EntryPurpose::PgnFile,
        );

        fs::remove_dir_all(databases.path()).unwrap();
        assert_eq!(path_authority.active_database_root().unwrap(), None);
        let replacement =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let new_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &replacement,
            replacement.identity(),
        )
        .unwrap();
        assert!(!path_authority.persistent.contains_key(&old_id.id));
        assert!(!path_authority.persistent.contains_key(&nested_id.id));
        assert!(!path_authority.persistent.contains_key(&nested_file_id.id));
        assert!(path_authority.persistent.contains_key(&new_id.id));
        assert!(path_authority.persistent.contains_key(&sibling_id.id));
        assert!(path_authority.persistent.contains_key(&sibling_file_id.id));

        let reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(!reopened.persistent.contains_key(&old_id.id));
        assert!(!reopened.persistent.contains_key(&nested_id.id));
        assert!(!reopened.persistent.contains_key(&nested_file_id.id));
        assert!(reopened.persistent.contains_key(&sibling_id.id));
        assert!(reopened.persistent.contains_key(&sibling_file_id.id));
    }

    #[test]
    fn app_owned_database_root_recovery_prunes_pending_artifacts() {
        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let databases =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let old_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &databases,
            databases.identity(),
        )
        .unwrap();
        let sibling_path = dir.path().join("surviving");
        fs::create_dir(&sibling_path).unwrap();
        let sibling_id = path_authority
            .migrate_legacy_os_path_inner(
                sibling_path.clone().into_os_string(),
                "Surviving".into(),
                PathClass::PersistentCustomRoot,
                vec![PathOperation::DownloadFile],
                None,
            )
            .unwrap()
            .id;
        let stale_pending = path_authority
            .reserve_download_artifact(
                &old_id,
                OsString::from("stale"),
                (0, String::new()),
                "stale",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let sibling_pending = path_authority
            .reserve_download_artifact(
                &sibling_id,
                OsString::from("surviving"),
                (0, String::new()),
                "surviving",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let quarantined = pending_test_artifact(
            &PathRef {
                id: "already-absent-root".into(),
            },
            "quarantined",
        );
        path_authority.pending_artifacts.push(quarantined.clone());
        path_authority.save().unwrap();

        fs::remove_dir_all(databases.path()).unwrap();
        assert_eq!(path_authority.active_database_root().unwrap(), None);
        let replacement =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let new_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &replacement,
            replacement.identity(),
        )
        .unwrap();
        assert!(path_authority
            .pending_artifacts
            .iter()
            .all(|pending| pending.id != stale_pending.id));
        assert!(path_authority
            .pending_artifacts
            .iter()
            .any(|pending| pending.id == sibling_pending.id));
        assert!(path_authority
            .pending_artifacts
            .iter()
            .any(|pending| pending.id == quarantined.id));
        assert!(path_authority.persistent.contains_key(&new_id.id));

        let reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(reopened
            .pending_artifacts
            .iter()
            .all(|pending| pending.id != stale_pending.id));
        assert!(reopened
            .pending_artifacts
            .iter()
            .any(|pending| pending.id == sibling_pending.id));
        assert!(reopened
            .pending_artifacts
            .iter()
            .any(|pending| pending.id == quarantined.id));
    }

    #[test]
    fn app_owned_engine_root_recovery_prunes_provisional_attachments() {
        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let engines =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Engines).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let old_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Engines,
            &engines,
            engines.identity(),
        )
        .unwrap();
        let resource = engines.path().join("resource.nnue");
        let resource_handle = attachment_resource(&mut path_authority, &resource);
        assert!(path_authority
            .provisional_attachments
            .contains(&resource_handle.id.id));
        fs::remove_dir_all(engines.path()).unwrap();
        assert_eq!(path_authority.active_engine_root().unwrap(), None);
        let replacement =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Engines).unwrap();
        let new_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Engines,
            &replacement,
            replacement.identity(),
        )
        .unwrap();
        assert!(!path_authority.persistent.contains_key(&old_id.id));
        assert!(!path_authority
            .persistent
            .contains_key(&resource_handle.id.id));
        assert!(!path_authority
            .provisional_attachments
            .contains(&resource_handle.id.id));
        assert!(path_authority.persistent.contains_key(&new_id.id));

        let reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(!reopened.persistent.contains_key(&old_id.id));
        assert!(!reopened.persistent.contains_key(&resource_handle.id.id));
        assert!(!reopened
            .provisional_attachments
            .contains(&resource_handle.id.id));
    }

    #[test]
    fn app_owned_database_root_recovery_keeps_registry_unchanged_on_persistence_failure() {
        struct RegistryFailure;
        impl AtomicWriterInjector for RegistryFailure {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::TempfileCreate {
                    Err(std::io::Error::other("registry failure"))
                } else {
                    Ok(())
                }
            }
        }

        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let databases =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let engines =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Engines).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let old_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &databases,
            databases.identity(),
        )
        .unwrap();
        set_active_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &old_id,
        );
        let engines_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Engines,
            &engines,
            engines.identity(),
        )
        .unwrap();
        let resource = engines.path().join("resource.nnue");
        let resource_handle = attachment_resource(&mut path_authority, &resource);
        let pending = path_authority
            .reserve_download_artifact(
                &old_id,
                OsString::from("pending"),
                (0, String::new()),
                "pending",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let child_path = databases.path().join("child.db3");
        fs::write(&child_path, b"child").unwrap();
        let child = path_authority
            .register_database_child(
                &DatabaseRootHandle::new(old_id.clone()),
                OsStr::new("child.db3"),
                "child",
                observed_identity(&databases.path().join("child.db3")),
            )
            .unwrap();
        assert!(path_authority.persistent.contains_key(&engines_id.id));
        assert!(path_authority
            .provisional_attachments
            .contains(&resource_handle.id.id));
        path_authority.save().unwrap();

        fs::remove_dir_all(databases.path()).unwrap();
        assert_eq!(path_authority.active_database_root().unwrap(), None);
        let replacement =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        assert_ne!(replacement.identity(), databases.identity());

        let persistent_before = path_authority.persistent.clone();
        let pending_before = serde_json::to_vec(&path_authority.pending_artifacts).unwrap();
        let provisional_before = path_authority.provisional_attachments.clone();
        let removals_before = path_authority.pending_unpersisted_removals.clone();
        let active_before = path_authority.active_database_root.clone();
        let bytes_before = fs::read(dir.path().join("registry.json")).unwrap();

        set_test_atomic_file_injector(Some(Arc::new(RegistryFailure)));
        let result = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &replacement,
            replacement.identity(),
        );
        set_test_atomic_file_injector(None);
        assert!(matches!(result, Err(Error::Io(_))), "{result:?}");
        assert!(path_authority.persistent == persistent_before);
        assert_eq!(
            serde_json::to_vec(&path_authority.pending_artifacts).unwrap(),
            pending_before
        );
        assert_eq!(path_authority.provisional_attachments, provisional_before);
        assert_eq!(path_authority.pending_unpersisted_removals, removals_before);
        assert_eq!(path_authority.active_database_root, active_before);
        assert_eq!(
            fs::read(dir.path().join("registry.json")).unwrap(),
            bytes_before
        );
        assert!(path_authority.persistent.contains_key(&old_id.id));
        assert!(path_authority.persistent.contains_key(&child.id.id));
        assert!(path_authority
            .pending_artifacts
            .iter()
            .any(|item| item.id == pending.id));

        let reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(reopened.persistent.contains_key(&old_id.id));
        assert!(reopened.persistent.contains_key(&child.id.id));
        assert_eq!(
            fs::read(dir.path().join("registry.json")).unwrap(),
            bytes_before
        );
    }

    #[test]
    fn app_owned_engine_root_recovery_drops_tombstoned_provisional_markers() {
        struct RegistryFailure;
        impl AtomicWriterInjector for RegistryFailure {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::TempfileCreate {
                    Err(std::io::Error::other("registry failure"))
                } else {
                    Ok(())
                }
            }
        }

        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let databases =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let engines =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Engines).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let _database_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &databases,
            databases.identity(),
        )
        .unwrap();
        let engines_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Engines,
            &engines,
            engines.identity(),
        )
        .unwrap();
        let resource = engines.path().join("resource.nnue");
        let resource_handle = attachment_resource(&mut path_authority, &resource);
        assert!(path_authority
            .provisional_attachments
            .contains(&resource_handle.id.id));
        set_test_atomic_file_injector(Some(Arc::new(RegistryFailure)));
        let mut dropped = Vec::new();
        assert!(path_authority
            .remove_workspace_entry(
                &FileWorkspaceHandle::new(engines_id.clone()),
                WorkspaceRemovalStatus::Complete,
                &mut dropped,
            )
            .is_err());
        set_test_atomic_file_injector(None);
        assert!(path_authority
            .pending_unpersisted_removals
            .contains(&engines_id.id));
        assert!(path_authority
            .pending_unpersisted_removals
            .contains(&resource_handle.id.id));
        assert!(path_authority
            .persistent
            .contains_key(&resource_handle.id.id));

        fs::remove_dir_all(databases.path()).unwrap();
        assert_eq!(path_authority.active_database_root().unwrap(), None);
        let replacement =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let new_id = get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &replacement,
            replacement.identity(),
        )
        .unwrap();
        assert!(path_authority.persistent.contains_key(&new_id.id));

        let reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(!reopened
            .provisional_attachments
            .contains(&resource_handle.id.id));
    }

    #[test]
    fn app_owned_database_root_disagreeing_expected_identity_after_registration_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(dir.path());
        let databases =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Databases).unwrap();
        let engines =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Engines).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        get_or_create_app_owned_test_root(
            &mut path_authority,
            AppOwnedDefaultRoot::Databases,
            &databases,
            databases.identity(),
        )
        .unwrap();
        let error = path_authority
            .get_or_create_database_root(databases.path(), "Databases", Some(engines.identity()))
            .expect_err("a live identity from another path must be refused");
        assert!(matches!(
            error,
            Error::Conflict(message)
                if message == "verified identity does not match registration target"
        ));
    }

    #[cfg(unix)]
    fn assert_app_owned_root_swap_is_refused(root: AppOwnedDefaultRoot) {
        let dir = tempfile::tempdir().unwrap();
        let directory =
            ensure_app_owned_default_dir(&AppDataDir::for_test(dir.path()), root).unwrap();
        let original = dir.path().join(format!("{}-original", root.leaf()));
        fs::rename(directory.path(), &original).unwrap();
        fs::create_dir(directory.path()).unwrap();

        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let error = get_or_create_app_owned_test_root(
            &mut path_authority,
            root,
            &directory,
            directory.identity(),
        )
        .expect_err("a directory swapped after authorization must be refused");
        assert!(matches!(error, Error::Conflict(_)), "{error:?}");
        assert!(!error.to_string().contains('/'), "{error:?}");
        assert!(path_authority.persistent.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn app_owned_database_root_swap_before_registration_is_refused() {
        assert_app_owned_root_swap_is_refused(AppOwnedDefaultRoot::Databases);
    }

    #[cfg(unix)]
    #[test]
    fn app_owned_engine_root_swap_before_registration_is_refused() {
        assert_app_owned_root_swap_is_refused(AppOwnedDefaultRoot::Engines);
    }

    #[cfg(unix)]
    #[test]
    fn app_owned_puzzle_root_swap_before_registration_is_refused() {
        assert_app_owned_root_swap_is_refused(AppOwnedDefaultRoot::Puzzles);
    }

    fn assert_app_owned_root_reuses_descriptor_identity_after_reload(root: AppOwnedDefaultRoot) {
        let dir = tempfile::tempdir().unwrap();
        let directory =
            ensure_app_owned_default_dir(&AppDataDir::for_test(dir.path()), root).unwrap();
        let expected_identity = directory.identity();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let original = get_or_create_app_owned_test_root(
            &mut path_authority,
            root,
            &directory,
            expected_identity,
        )
        .unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        let reused =
            get_or_create_app_owned_test_root(&mut reloaded, root, &directory, expected_identity)
                .unwrap();
        assert_eq!(reused, original);
        assert_eq!(reloaded.persistent.len(), 1);
    }

    #[test]
    fn app_owned_database_root_reuses_descriptor_identity_after_reload() {
        assert_app_owned_root_reuses_descriptor_identity_after_reload(
            AppOwnedDefaultRoot::Databases,
        );
    }

    #[test]
    fn app_owned_engine_root_reuses_descriptor_identity_after_reload() {
        assert_app_owned_root_reuses_descriptor_identity_after_reload(AppOwnedDefaultRoot::Engines);
    }

    #[test]
    fn app_owned_puzzle_root_reuses_descriptor_identity_after_reload() {
        assert_app_owned_root_reuses_descriptor_identity_after_reload(AppOwnedDefaultRoot::Puzzles);
    }

    #[test]
    fn active_puzzle_root_is_restart_safe_and_rejects_a_replaced_custom_root() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("puzzles");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let handle = path_authority
            .get_or_create_puzzle_root(&root, "Puzzles", None)
            .unwrap();
        path_authority.set_active_puzzle_root(&handle).unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        assert_eq!(
            reloaded
                .active_puzzle_root()
                .unwrap()
                .map(|descriptor| descriptor.root),
            Some(handle)
        );
        let replacement = dir.path().join("replacement-puzzle-root");
        fs::create_dir(&replacement).unwrap();
        #[cfg(windows)]
        fs::remove_dir(&root).unwrap();
        fs::rename(&replacement, &root).unwrap();
        assert_eq!(reloaded.active_puzzle_root().unwrap(), None);
    }

    #[test]
    fn active_engine_root_is_restart_safe_and_rejects_a_replaced_custom_root() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("engines");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let handle = path_authority
            .get_or_create_engine_root(&root, "Engines", None)
            .unwrap();
        path_authority.set_active_engine_root(&handle).unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        assert_eq!(reloaded.active_engine_root().unwrap(), Some(handle));
        let replacement = dir.path().join("replacement-engine-root");
        fs::create_dir(&replacement).unwrap();
        #[cfg(windows)]
        fs::remove_dir(&root).unwrap();
        fs::rename(&replacement, &root).unwrap();
        assert_eq!(reloaded.active_engine_root().unwrap(), None);
    }

    #[test]
    fn legacy_engine_file_is_backfilled_and_reused_after_reload() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("engine");
        fs::write(&executable, b"engine").unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let legacy = path_authority
            .get_or_create_persistent_file(
                &executable,
                "engine",
                vec![
                    PathOperation::EngineExecute,
                    PathOperation::EngineConfigure,
                    PathOperation::EngineInstall,
                ],
            )
            .unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        let registered = reloaded
            .register_engine_file(&executable, "engine")
            .unwrap();
        assert_eq!(registered.path_ref(), &legacy.id);
        assert_eq!(reloaded.persistent.len(), 1);
        assert_eq!(
            reloaded
                .persistent
                .get(&legacy.id.id)
                .unwrap()
                .stored
                .operations,
            vec![
                PathOperation::EngineExecute,
                PathOperation::EngineConfigure,
                PathOperation::EngineInstall,
                PathOperation::EngineBinaryInspect,
            ]
        );
    }

    #[test]
    fn engine_root_is_not_backfilled_and_reuses_its_id_after_reload() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("engines");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let original = path_authority
            .get_or_create_engine_root(&root, "Engines", None)
            .unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        let reused = reloaded
            .get_or_create_engine_root(&root, "Engines", None)
            .unwrap();
        assert_eq!(reused, original);
        assert_eq!(reloaded.persistent.len(), 1);
        assert_eq!(
            reloaded
                .persistent
                .get(&original.path_ref().id)
                .unwrap()
                .stored
                .operations,
            vec![
                PathOperation::DownloadArchive,
                PathOperation::EngineInstall,
                PathOperation::EngineExecute,
                PathOperation::EngineConfigure,
            ]
        );
    }

    #[test]
    fn database_root_is_not_backfilled_and_reuses_its_id_after_reload() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("databases");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let original = path_authority
            .get_or_create_database_root(&root, "Databases", None)
            .unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        let reused = reloaded
            .get_or_create_database_root(&root, "Databases", None)
            .unwrap();
        assert_eq!(reused, original);
        assert_eq!(reloaded.persistent.len(), 1);
        assert_eq!(
            reloaded
                .persistent
                .get(&original.path_ref().id)
                .unwrap()
                .stored
                .operations,
            vec![
                PathOperation::DatabaseRead,
                PathOperation::DatabaseMutate,
                PathOperation::DatabaseCreate,
                PathOperation::DatabaseExport,
                PathOperation::DownloadFile,
            ]
        );
    }

    #[test]
    fn puzzle_root_is_not_backfilled_and_reuses_its_id_after_reload() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("puzzles");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let original = path_authority
            .get_or_create_puzzle_root(&root, "Puzzles", None)
            .unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        let reused = reloaded
            .get_or_create_puzzle_root(&root, "Puzzles", None)
            .unwrap();
        assert_eq!(reused, original);
        assert_eq!(reloaded.persistent.len(), 1);
        assert_eq!(
            reloaded
                .persistent
                .get(&original.path_ref().id)
                .unwrap()
                .stored
                .operations,
            vec![
                PathOperation::PuzzleRead,
                PathOperation::PuzzleDelete,
                PathOperation::DownloadFile,
            ]
        );
    }

    /// Replaces a registered root with a different directory of the same name,
    /// so the reuse lookup still matches while the stored identity no longer
    /// does. The noun in the message is asserted per root type: one shared noun
    /// across the three methods would tell the renderer to re-select the wrong
    /// root.
    fn replace_root_directory(dir: &tempfile::TempDir, root: &Path, replacement_name: &str) {
        let replacement = dir.path().join(replacement_name);
        fs::create_dir(&replacement).unwrap();
        // POSIX atomically replaces an empty directory, whereas Windows
        // requires its target to be absent.
        #[cfg(windows)]
        fs::remove_dir(root).unwrap();
        fs::rename(&replacement, root).unwrap();
    }

    #[test]
    fn database_root_reuse_rejects_a_replaced_directory() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("databases");
        fs::create_dir(&root).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        path_authority
            .get_or_create_database_root(&root, "Databases", None)
            .unwrap();
        replace_root_directory(&dir, &root, "replacement-database-root");

        let error = path_authority
            .get_or_create_database_root(&root, "Databases", None)
            .unwrap_err();
        assert!(
            matches!(&error, Error::Conflict(message)
                if message == "database root changed; select it again"),
            "unexpected error: {error:?}"
        );
    }

    #[test]
    fn puzzle_root_reuse_rejects_a_replaced_directory() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("puzzles");
        fs::create_dir(&root).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        path_authority
            .get_or_create_puzzle_root(&root, "Puzzles", None)
            .unwrap();
        replace_root_directory(&dir, &root, "replacement-puzzle-root");

        let error = path_authority
            .get_or_create_puzzle_root(&root, "Puzzles", None)
            .unwrap_err();
        assert!(
            matches!(&error, Error::Conflict(message)
                if message == "puzzle root changed; select it again"),
            "unexpected error: {error:?}"
        );
    }

    #[test]
    fn engine_root_reuse_rejects_a_replaced_directory() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("engines");
        fs::create_dir(&root).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        path_authority
            .get_or_create_engine_root(&root, "Engines", None)
            .unwrap();
        replace_root_directory(&dir, &root, "replacement-engine-root");

        let error = path_authority
            .get_or_create_engine_root(&root, "Engines", None)
            .unwrap_err();
        assert!(
            matches!(&error, Error::Conflict(message)
                if message == "engine root changed; select it again"),
            "unexpected error: {error:?}"
        );
    }

    #[test]
    fn windows_launch_sealing_covers_execute_and_configure_engine_operations() {
        assert!(!allows_delete_sharing_for_operation(
            PathOperation::EngineExecute,
            true
        ));
        assert!(!allows_delete_sharing_for_operation(
            PathOperation::EngineConfigure,
            true
        ));
        assert!(allows_delete_sharing_for_operation(
            PathOperation::EngineExecute,
            false
        ));
        assert!(allows_delete_sharing_for_operation(
            PathOperation::OpeningBookRead,
            true
        ));
        assert!(!is_write_operation(PathOperation::EngineConfigure));
    }

    #[test]
    fn write_operation_policy_is_exhaustive() {
        for operation in [
            PathOperation::WritePgn,
            PathOperation::DatabaseMutate,
            PathOperation::DatabaseCreate,
            PathOperation::DatabaseExport,
            PathOperation::PuzzleDelete,
            PathOperation::EngineInstall,
            PathOperation::SnapshotWrite,
            PathOperation::LogWrite,
        ] {
            assert!(is_write_operation(operation), "{operation:?}");
        }
        for operation in [
            PathOperation::ReadPgn,
            PathOperation::DatabaseRead,
            PathOperation::PuzzleRead,
            PathOperation::EngineExecute,
            PathOperation::EngineConfigure,
            PathOperation::EngineBinaryInspect,
            PathOperation::OpeningBookRead,
            PathOperation::ImageRead,
            PathOperation::DownloadFile,
            PathOperation::DownloadArchive,
            PathOperation::OpenShell,
        ] {
            assert!(!is_write_operation(operation), "{operation:?}");
        }
    }

    #[test]
    fn relative_components_reject_dot_and_nul_independently() {
        assert!(validate_components(&[OsString::from(".")]).is_err());
        assert!(validate_components(&[OsString::from("..")]).is_err());
        assert!(validate_components(&[OsString::from_vec(b"name\0tail".to_vec())]).is_err());
        assert!(validate_components(&[OsString::from("regular")]).is_ok());
    }

    #[test]
    fn persisted_entry_shape_validates_every_field_independently() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file.pgn");
        fs::write(&file, b"pgn").unwrap();
        let valid = stored_entry_for(&file, "valid", None, vec![PathOperation::ReadPgn]);
        assert!(validate_persisted_shape(&valid).is_ok());

        let invalid = [
            StoredEntry {
                class: PathClass::SingleDialogGrant,
                ..valid.clone()
            },
            StoredEntry {
                operations: vec![],
                ..valid.clone()
            },
            StoredEntry {
                id: PathRef { id: String::new() },
                ..valid.clone()
            },
            StoredEntry {
                display_name: String::new(),
                ..valid.clone()
            },
            StoredEntry {
                target_is_dir: true,
                ..valid.clone()
            },
            StoredEntry {
                class: PathClass::PersistentCustomRoot,
                target_is_dir: false,
                ..valid
            },
        ];
        for entry in invalid {
            assert!(validate_persisted_shape(&entry).is_err(), "{entry:?}");
        }
    }

    #[test]
    fn persisted_purpose_accepts_canonical_historical_subset_and_legacy_engine_operations() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("engine");
        fs::write(&file, b"engine").unwrap();
        let base = stored_entry_for(
            &file,
            "canonical-engine",
            Some(EntryPurpose::EngineExecutable),
            vec![
                PathOperation::EngineExecute,
                PathOperation::EngineConfigure,
                PathOperation::EngineInstall,
                PathOperation::EngineBinaryInspect,
            ],
        );

        assert!(validate_persisted_shape(&base).is_ok());
        assert!(validate_persisted_shape(&StoredEntry {
            purpose: Some(EntryPurpose::DatabaseFile),
            operations: vec![PathOperation::DatabaseRead],
            ..base.clone()
        })
        .is_ok());
        assert!(validate_persisted_shape(&StoredEntry {
            operations: vec![
                PathOperation::EngineExecute,
                PathOperation::EngineConfigure,
                PathOperation::EngineInstall,
            ],
            ..base
        })
        .is_ok());
    }

    #[test]
    fn persisted_purpose_rejects_wrong_purpose_class_and_operations() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("engine");
        fs::write(&file, b"engine").unwrap();
        let legacy_engine = stored_entry_for(
            &file,
            "legacy-engine",
            Some(EntryPurpose::EngineExecutable),
            vec![
                PathOperation::EngineExecute,
                PathOperation::EngineConfigure,
                PathOperation::EngineInstall,
            ],
        );

        let invalid = [
            StoredEntry {
                purpose: Some(EntryPurpose::EngineImage),
                ..legacy_engine.clone()
            },
            StoredEntry {
                class: PathClass::PersistentCustomRoot,
                target_is_dir: true,
                ..legacy_engine.clone()
            },
            StoredEntry {
                operations: vec![PathOperation::ImageRead],
                ..legacy_engine
            },
        ];

        for entry in invalid {
            assert!(validate_persisted_shape(&entry).is_err(), "{entry:?}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn read_only_engine_can_be_resolved_for_configuration() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("engine");
        fs::write(&executable, b"engine").unwrap();
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o555)).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let handle = path_authority
            .register_engine_file(&executable, "engine")
            .unwrap();
        assert!(path_authority
            .engine_executable(&handle, PathOperation::EngineConfigure)
            .is_ok());
    }

    #[test]
    fn engine_binary_inspection_cannot_read_bytes_or_become_a_read_file() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("engine");
        fs::write(&executable, b"engine").unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let handle = path_authority
            .register_engine_file(&executable, "engine")
            .unwrap();

        let mut byte_reader = path_authority
            .resolve(handle.path_ref(), PathOperation::EngineBinaryInspect, &[])
            .unwrap();
        assert!(byte_reader.read_bytes().is_err());
        let file_reader = path_authority
            .resolve(handle.path_ref(), PathOperation::EngineBinaryInspect, &[])
            .unwrap();
        assert!(file_reader.into_read_file().is_err());
    }

    fn writable_root(
        dir: &tempfile::TempDir,
        operations: Vec<PathOperation>,
    ) -> (PathAuthority, PathRef) {
        let root = dir.path().join("root");
        fs::create_dir(&root).unwrap();
        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let grant = authority
            .grant_dialog_operations(
                &root,
                "root",
                PathClass::BoundedDialogGrant,
                operations.clone(),
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let root = authority
            .promote_dialog(&grant, PathClass::PersistentCustomRoot, "root", operations)
            .unwrap()
            .id;
        (authority, root)
    }

    #[test]
    fn persist_workspace_parent_sync_surfaces_uncertain_and_keeps_candidate() {
        let dir = tempfile::tempdir().unwrap();
        let (mut authority, root) =
            writable_root(&dir, vec![PathOperation::ReadPgn, PathOperation::WritePgn]);
        fs::write(dir.path().join("root/game.pgn"), b"*").unwrap();
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        let error = authority
            .register_workspace_child_observed(
                &FileWorkspaceHandle::new(root),
                &[OsString::from("game.pgn")],
                "game",
                observed_identity(&dir.path().join("root/game.pgn")),
                false,
                PathOperation::ReadPgn,
            )
            .expect_err("uncertain persistence must be surfaced");
        set_test_atomic_file_injector(None);
        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert!(authority
            .persistent
            .values()
            .any(|entry| entry.stored.display_name == "game"));
    }

    #[cfg(unix)]
    #[test]
    fn create_database_child_parent_sync_does_not_roll_back_completed_file() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("databases");
        fs::create_dir(&root_path).unwrap();
        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let root = authority
            .get_or_create_database_root(&root_path, "databases", None)
            .unwrap();
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        let error = authority
            .create_database_child(&root, OsStr::new("created.db3"))
            .expect_err("uncertain registry durability must be surfaced");
        set_test_atomic_file_injector(None);
        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert!(root_path.join("created.db3").exists());
        assert_eq!(
            authority
                .list_database_children_cancellable(&root, &CancellationToken::new())
                .unwrap()
                .iter()
                .filter(|item| item.filename == "created.db3")
                .count(),
            1
        );
    }

    #[test]
    fn engine_path_commit_wrappers_return_handle_on_uncertain_without_rollback() {
        let dir = tempfile::tempdir().unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let engine = dir.path().join("engine");
        let book = dir.path().join("book.bin");
        let resource = dir.path().join("resource.nnue");
        for path in [&engine, &book, &resource] {
            fs::write(path, b"data").unwrap();
        }
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let image_leaf = OsStr::new("image.png");
        let (_, installed_image) = image_dir
            .atomic_replace_leaf_identified(image_leaf, |file| {
                file.write_all(b"data").map_err(Error::from)
            })
            .unwrap();
        let image = image_dir.path().join(image_leaf);
        let grant = authority
            .grant_dialog(
                &resource,
                "resource",
                PathClass::SingleDialogGrant,
                PathOperation::EngineResourceRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        let engine_handle = authority
            .register_engine_file(&engine, "engine")
            .expect("adopted engine handle");
        let image_handle = authority
            .register_engine_image(&image_dir, image_leaf, installed_image, "image".into())
            .expect("adopted image handle");
        let book_handle = authority
            .register_opening_book(&book, "book")
            .expect("adopted book handle");
        let resource_handle = authority
            .promote_engine_resource(&grant, EngineResourceHandleKind::File, "resource")
            .expect("adopted resource handle");
        set_test_atomic_file_injector(None);
        for path in [&engine, &image, &book, &resource] {
            assert!(authority
                .persistent
                .values()
                .any(|entry| { entry.stored.path.to_path().ok().as_ref() == Some(path) }));
        }
        let engine_again = authority
            .register_engine_file(&engine, "engine")
            .expect("lookup of adopted engine");
        let image_again = authority
            .register_engine_image(&image_dir, image_leaf, installed_image, "image".into())
            .expect("lookup of adopted image");
        let book_again = authority
            .register_opening_book(&book, "book")
            .expect("lookup of adopted book");
        assert_eq!(engine_handle, engine_again);
        assert_eq!(image_handle, image_again);
        assert_eq!(book_handle, book_again);
        authority
            .engine_resource(&resource_handle)
            .expect("adopted resource still resolves");
        assert_ne!(engine_handle.id, image_handle.id);
        assert_ne!(engine_handle.id, book_handle.id);
        assert_ne!(engine_handle.id, resource_handle.id);
    }

    #[test]
    fn set_active_roots_parent_sync_returns_ok_and_keeps_handles_usable() {
        let dir = tempfile::tempdir().unwrap();
        let database_path = dir.path().join("databases");
        let puzzle_path = dir.path().join("puzzles");
        let engine_path = dir.path().join("engines");
        for path in [&database_path, &puzzle_path, &engine_path] {
            fs::create_dir(path).unwrap();
        }
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let database = authority
            .get_or_create_database_root(&database_path, "databases", None)
            .unwrap();
        let puzzle = authority
            .get_or_create_puzzle_root(&puzzle_path, "puzzles", None)
            .unwrap();
        let engine = authority
            .get_or_create_engine_root(&engine_path, "engines", None)
            .unwrap();
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        authority.set_active_database_root(&database).unwrap();
        authority.set_active_puzzle_root(&puzzle).unwrap();
        authority.set_active_engine_root(&engine).unwrap();
        set_test_atomic_file_injector(None);
        assert_eq!(authority.active_database_root().unwrap(), Some(database));
        assert_eq!(
            authority
                .active_puzzle_root()
                .unwrap()
                .map(|descriptor| descriptor.root),
            Some(puzzle)
        );
        assert_eq!(authority.active_engine_root().unwrap(), Some(engine));
    }

    #[test]
    fn rebind_workspace_parent_sync_keeps_new_path() {
        let dir = tempfile::tempdir().unwrap();
        let (mut authority, root) =
            writable_root(&dir, vec![PathOperation::ReadPgn, PathOperation::WritePgn]);
        let old = dir.path().join("root/old.pgn");
        let new = dir.path().join("root/new.pgn");
        fs::write(&old, b"*").unwrap();
        let handle = authority
            .register_workspace_child_observed(
                &FileWorkspaceHandle::new(root),
                &[OsString::from("old.pgn")],
                "old",
                observed_identity(&old),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        fs::rename(&old, &new).unwrap();
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        let error = authority
            .rebind_workspace_entry(&handle, &new, "new")
            .expect_err("uncertain registry durability must be surfaced");
        set_test_atomic_file_injector(None);
        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert_eq!(
            authority
                .workspace_entry_path(&handle, PathOperation::ReadPgn)
                .unwrap(),
            new
        );
    }

    #[test]
    fn rebase_workspace_parent_sync_keeps_rebased_paths() {
        let dir = tempfile::tempdir().unwrap();
        let (mut authority, root) =
            writable_root(&dir, vec![PathOperation::ReadPgn, PathOperation::WritePgn]);
        let old = dir.path().join("root/old");
        let new = dir.path().join("root/new");
        fs::create_dir(&old).unwrap();
        let handle = authority
            .register_workspace_child_observed(
                &FileWorkspaceHandle::new(root),
                &[OsString::from("old")],
                "old",
                observed_identity(&old),
                true,
                PathOperation::ReadPgn,
            )
            .unwrap();
        fs::rename(&old, &new).unwrap();
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        let error = authority
            .rebase_workspace_entries(&old, &new)
            .expect_err("uncertain registry durability must be surfaced");
        set_test_atomic_file_injector(None);
        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert_eq!(
            authority
                .workspace_entry_path(&handle, PathOperation::ReadPgn)
                .unwrap(),
            new
        );
    }

    #[test]
    fn abandon_download_artifact_adopts_uncertain_but_not_failed_save() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("downloads");
        fs::create_dir(&root_path).unwrap();
        let staged = dir.path().join("staged");
        fs::write(&staged, b"payload").unwrap();
        let app = AppOwnedRoot::new("downloads", root_path, vec![PathOperation::DownloadFile]);
        let root = app.id.clone();
        let mut authority =
            PathAuthority::open(dir.path().join("registry.json"), vec![app]).unwrap();
        let first = authority
            .reserve_download_artifact(
                &root,
                OsString::from("first"),
                sha256_file(&staged).unwrap(),
                "first",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        authority.abandon_download_artifact(&first);
        set_test_atomic_file_injector(None);
        assert!(authority.pending_artifacts.is_empty());

        let second = authority
            .reserve_download_artifact(
                &root,
                OsString::from("second"),
                sha256_file(&staged).unwrap(),
                "second",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        authority.abandon_download_artifact(&second);
        set_test_atomic_file_injector(None);
        assert!(authority
            .pending_artifacts
            .iter()
            .any(|pending| pending.id == second.id));
    }

    struct AlwaysIo;

    impl AtomicWriterInjector for AlwaysIo {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == AtomicFileFaultPoint::Write {
                Err(std::io::Error::other("write failed"))
            } else {
                Ok(())
            }
        }
    }

    #[test]
    fn registry_write_retries_once() {
        let dir = tempfile::tempdir().unwrap();
        let authority = authority(&dir, Arc::new(TestClock::new(0)));
        let attempts = std::rc::Rc::new(std::cell::Cell::new(0));
        let observed = attempts.clone();
        let durability = authority
            .save_entries_with(
                &authority.persistent,
                &None,
                &None,
                &None,
                &[],
                move |_target, write| {
                    observed.set(observed.get() + 1);
                    if observed.get() == 1 {
                        return Err(Error::Io(Box::new(std::io::Error::other("retry"))));
                    }
                    let mut sink = tempfile::tempfile().unwrap();
                    write(&mut sink)?;
                    Ok(AtomicFileOutcome::DurableCommit)
                },
            )
            .unwrap();
        assert!(matches!(durability, CommitDurability::Durable));
        assert_eq!(attempts.get(), 2);
    }

    #[test]
    fn parent_sync_is_not_retried() {
        let dir = tempfile::tempdir().unwrap();
        let authority = authority(&dir, Arc::new(TestClock::new(0)));
        let attempts = std::cell::Cell::new(0);
        let durability = authority
            .save_entries_with(
                &authority.persistent,
                &None,
                &None,
                &None,
                &[],
                |_target, _write| {
                    attempts.set(attempts.get() + 1);
                    Ok(AtomicFileOutcome::CommittedDurabilityUncertain(
                        std::io::Error::other("parent sync"),
                    ))
                },
            )
            .unwrap();
        assert!(matches!(
            durability,
            CommitDurability::DurabilityUncertain(_)
        ));
        assert_eq!(attempts.get(), 1);
    }

    #[test]
    fn post_rename_metadata_failure_is_uncertain_not_retried_io() {
        struct MetadataFailure(std::sync::Arc<std::sync::atomic::AtomicUsize>);
        impl AtomicWriterInjector for MetadataFailure {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::PostRenameMetadata {
                    self.0.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    Err(std::io::Error::other("metadata failed"))
                } else {
                    Ok(())
                }
            }
        }
        let dir = tempfile::tempdir().unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let attempts = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        set_test_atomic_file_injector(Some(Arc::new(MetadataFailure(attempts.clone()))));
        let durability = authority.save().unwrap();
        set_test_atomic_file_injector(None);
        assert!(matches!(
            durability,
            CommitDurability::DurabilityUncertain(_)
        ));
        assert_eq!(attempts.load(std::sync::atomic::Ordering::SeqCst), 1);
    }

    #[test]
    fn registry_conflict_is_not_retried() {
        let dir = tempfile::tempdir().unwrap();
        let authority = authority(&dir, Arc::new(TestClock::new(0)));
        for error in [
            Error::Conflict("conflict".into()),
            Error::OperationAndCleanup {
                primary: "conflict".into(),
                cleanup: "cleanup".into(),
            },
        ] {
            let attempts = std::cell::Cell::new(0);
            let result = authority.save_entries_with(
                &authority.persistent,
                &None,
                &None,
                &None,
                &[],
                |_target, _write| {
                    attempts.set(attempts.get() + 1);
                    Err(match &error {
                        Error::Conflict(message) => Error::Conflict(message.clone()),
                        Error::OperationAndCleanup { primary, cleanup } => {
                            Error::OperationAndCleanup {
                                primary: primary.clone(),
                                cleanup: cleanup.clone(),
                            }
                        }
                        _ => unreachable!(),
                    })
                },
            );
            assert!(result.is_err());
            assert_eq!(attempts.get(), 1);
        }
    }

    #[test]
    fn unresolved_record_survives_reload() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file.pgn");
        fs::write(&file, b"*").unwrap();
        let registry = dir.path().join("registry.json");
        let id = {
            let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
            authority
                .migrate_legacy_os_path(
                    file.clone().into_os_string(),
                    "file",
                    PathClass::PersistentFile,
                    vec![PathOperation::ReadPgn],
                )
                .unwrap()
                .id
        };
        fs::remove_file(file).unwrap();
        let authority = PathAuthority::open(registry, vec![]).unwrap();
        assert_eq!(
            authority.persistent.get(&id.id).unwrap().availability,
            PathAvailability::Unavailable
        );
    }

    #[test]
    fn pending_prune_stripped_on_later_artifact_save() {
        let dir = tempfile::tempdir().unwrap();
        let (mut authority, root) = writable_root(
            &dir,
            vec![
                PathOperation::ReadPgn,
                PathOperation::WritePgn,
                PathOperation::DownloadFile,
            ],
        );
        let removed_path = dir.path().join("root/removed");
        fs::create_dir(&removed_path).unwrap();
        let removed = authority
            .register_workspace_child_observed(
                &FileWorkspaceHandle::new(root.clone()),
                &[OsString::from("removed")],
                "removed",
                observed_identity(&removed_path),
                true,
                PathOperation::ReadPgn,
            )
            .unwrap();
        let executable = removed_path.join("engine");
        fs::write(&executable, b"engine").unwrap();
        let engine_handle = authority
            .register_engine_file(&executable, "engine")
            .unwrap();
        let staged = dir.path().join("staged");
        fs::write(&staged, b"payload").unwrap();
        let stale_pending = authority
            .reserve_download_artifact(
                removed.path_ref(),
                OsString::from("stale.pgn"),
                sha256_file(&staged).unwrap(),
                "stale.pgn",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        authority.active_database_root = Some(removed.path_ref().clone());
        authority.active_puzzle_root = Some(removed.path_ref().clone());
        authority.active_engine_root = Some(removed.path_ref().clone());
        authority.save().unwrap();

        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        let mut dropped_engine_executables = Vec::new();
        assert!(authority
            .remove_workspace_entry(
                &removed,
                WorkspaceRemovalStatus::Complete,
                &mut dropped_engine_executables,
            )
            .is_err());
        set_test_atomic_file_injector(None);
        assert_eq!(dropped_engine_executables, vec![engine_handle.id]);
        assert!(authority.persistent.contains_key(&removed.path_ref().id));
        assert!(authority
            .pending_artifacts
            .iter()
            .any(|pending| pending.id == stale_pending.id));

        authority
            .reserve_download_artifact(
                &root,
                OsString::from("sibling.pgn"),
                sha256_file(&staged).unwrap(),
                "sibling.pgn",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        assert!(!authority.persistent.contains_key(&removed.path_ref().id));
        assert!(!authority
            .pending_artifacts
            .iter()
            .any(|pending| pending.root == *removed.path_ref()));
        assert_eq!(authority.active_database_root, None);
        assert_eq!(authority.active_puzzle_root, None);
        assert_eq!(authority.active_engine_root, None);

        let reloaded = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(!reloaded.persistent.contains_key(&removed.path_ref().id));
        assert!(!reloaded
            .pending_artifacts
            .iter()
            .any(|pending| pending.root == *removed.path_ref()));
    }

    const READ_TOKENS: [&str; 8] = [
        "read_to_end",
        "read_to_string",
        "read_bytes",
        "read_bounded_bytes",
        "sha256_open_file",
        "sha256_file",
        "fs::read",
        ".read(",
    ];

    #[test]
    fn engine_image_split_keeps_reads_off_the_opener_and_lock_wrapper() {
        let verified = include_str!("verified.rs");
        assert!(
            verified.contains("    pub(super) fn open_engine_image("),
            "open_engine_image must be pub(super)"
        );

        let open = body_at_indent(verified, "fn open_engine_image(");
        assert!(
            open.starts_with("    pub(super) fn open_engine_image("),
            "open_engine_image must be visible only to its parent module: {open}"
        );
        assert!(open.contains("max_bytes"));
        for token in READ_TOKENS {
            assert!(
                !open.contains(token),
                "open_engine_image must not contain {token:?}: {open}"
            );
        }

        let source = include_str!("mod.rs");
        let reader = body_at_indent(source, "fn engine_image_reader_for(");
        assert!(
            reader.contains("open_engine_image"),
            "engine_image_reader_for must call open_engine_image: {reader}"
        );
        for token in READ_TOKENS {
            assert!(
                !reader.contains(token),
                "engine_image_reader_for must not contain {token:?}: {reader}"
            );
        }

        let bytes = body_at_indent(source, "fn read_engine_image_bytes(");
        assert!(!bytes.contains("File::open"), "{bytes}");
        assert!(!bytes.contains("resolve"), "{bytes}");
        assert!(!bytes.contains("pgn_path_authority"), "{bytes}");
    }

    #[test]
    fn path_authority_module_split_proves_verified_file_provenance() {
        let module = include_str!("mod.rs");
        let resolved = include_str!("resolved.rs");
        let verified = include_str!("verified.rs");

        let public_resolved_struct = ["pub ", "struct ResolvedPath"].concat();
        assert!(resolved.contains(&public_resolved_struct));
        assert!(!module.contains(&public_resolved_struct));

        assert_eq!(verified.matches("impl VerifiedFile").count(), 1);
        let mint = body_at_indent(verified, "mod mint {");
        let mint_functions = [
            "from_resolved",
            "into_inner",
            "as_file",
            "sha256",
            "try_clone_inner",
        ];
        assert_eq!(mint.matches("fn ").count(), mint_functions.len(), "{mint}");
        for function in mint_functions {
            assert_eq!(
                mint.matches(&format!("fn {function}(")).count(),
                1,
                "{mint}"
            );
        }
        let from_resolved = body_at_indent(verified, "pub(super) fn from_resolved(");
        let compact_from_resolved: String = from_resolved.split_whitespace().collect();
        assert!(compact_from_resolved.contains("resolved.take_file().map(Self)"));
        assert!(!from_resolved.contains("pub(crate) fn from_resolved"));
        assert!(!from_resolved.contains("File::open"));

        let take_file = body_at_indent(resolved, "fn take_file(");
        let compact_take_file: String = take_file.split_whitespace().collect();
        assert!(
            compact_take_file.contains("self.file.take()"),
            "{take_file}"
        );

        let verified_struct = verified
            .lines()
            .find(|line| line.contains("struct VerifiedFile("))
            .expect("VerifiedFile tuple struct");
        let tuple_fields = verified_struct
            .split_once('(')
            .and_then(|(_, rest)| rest.split_once(')'))
            .map(|(fields, _)| fields)
            .expect("VerifiedFile tuple fields");
        assert!(!tuple_fields.contains("pub"), "{verified_struct}");

        let file_field = resolved
            .lines()
            .find(|line| line.trim_start().starts_with("file: Option<fs::File>"))
            .expect("ResolvedPath file field");
        assert!(!file_field.contains("pub"), "{file_field}");
        for forbidden in [
            "fn set_file",
            "fn replace_file",
            "self.file =",
            ".file.replace(",
            "fn from_file",
            "OpenOptions",
        ] {
            assert!(!resolved.contains(forbidden), "{forbidden}: {resolved}");
        }

        let mint_start = verified.find("mod mint {").expect("mint module");
        let mint_end = mint_start + mint.len();
        let verified_outside_mint = [&verified[..mint_start], &verified[mint_end..]].concat();
        assert!(!verified_outside_mint.contains("VerifiedFile("));

        let unix_resolver = body_at_indent(resolved, "fn resolve_unix(");
        let windows_resolver = body_at_indent(resolved, "fn resolve_windows(");
        let constructor_count = resolved
            .lines()
            .filter(|line| {
                line.contains("ResolvedPath {")
                    && !line.contains("pub struct")
                    && !line.contains("impl ResolvedPath")
            })
            .count();
        assert_eq!(constructor_count, 5, "{resolved}");
        assert_eq!(
            unix_resolver.matches("ResolvedPath {").count()
                + windows_resolver.matches("ResolvedPath {").count(),
            5,
            "{resolved}"
        );
        assert!(unix_resolver.contains("crate::infra::fs::open_regular_at"));
        assert_eq!(resolved.matches("File::open").count(), 1);
        assert!(body_at_indent(
            resolved,
            "pub(crate) fn atomic_install_reserved_download_cancellable("
        )
        .contains("File::open"));

        let mutants = include_str!("../../../.cargo/mutants.toml");
        let mutation_runner = include_str!("../../../../scripts/run-backend-mutation.mjs");
        let new_path = "src/infra/path_authority/mod.rs";
        let old_path = ["src/infra/path_authority", ".rs"].concat();
        assert!(mutants.contains(new_path));
        assert!(mutation_runner.contains(new_path));
        assert!(!mutants.contains(&old_path));
        assert!(!mutation_runner.contains(&old_path));
    }

    #[test]
    fn engine_image_reader_then_bytes_returns_exact_contents() {
        let dir = tempfile::tempdir().unwrap();
        let contents = b"\x89PNG\r\n\x1a\nengine-image";
        let (mutex, handle, _) = registered_engine_image(&dir, contents);
        let (file, declared) = engine_image_reader_for(&mutex, &handle, 1024).unwrap();
        assert_eq!(declared, contents.len() as u64);
        let bytes = read_engine_image_bytes(file, declared, 1024).unwrap();
        assert_eq!(bytes, contents);
    }

    #[test]
    fn opening_book_bounded_reader_keeps_exact_limit_and_cancellation() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("book.bin");
        fs::write(&path, b"book").unwrap();
        let mut descriptor = OpeningBookDescriptor {
            file_name: "book.bin".into(),
            file: fs::File::open(&path).unwrap(),
        };
        assert_eq!(
            descriptor
                .read_bounded_bytes_cancellable(4, &CancellationToken::new())
                .unwrap(),
            b"book"
        );
        let cancelled = CancellationToken::new();
        cancelled.cancel();
        let mut cancelled_descriptor = OpeningBookDescriptor {
            file_name: "book.bin".into(),
            file: fs::File::open(path).unwrap(),
        };
        assert!(matches!(
            cancelled_descriptor.read_bounded_bytes_cancellable(4, &cancelled),
            Err(Error::Cancellation)
        ));
    }

    #[test]
    fn engine_image_reader_rejects_oversized_file_without_a_descriptor() {
        let dir = tempfile::tempdir().unwrap();
        let contents = b"0123456789";
        let (mutex, handle, _) = registered_engine_image(&dir, contents);
        match engine_image_reader_for(&mutex, &handle, 4) {
            Ok(_) => panic!("oversized image produced a VerifiedFile"),
            Err(error) => assert!(matches!(error, Error::ResourceLimit(_))),
        }
    }

    #[test]
    fn engine_image_bytes_rejects_growth_past_max_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let contents = b"01234567";
        let (mutex, handle, image) = registered_engine_image(&dir, contents);
        let max_bytes = 10;
        let (file, declared) = engine_image_reader_for(&mutex, &handle, max_bytes).unwrap();
        let mut observed = file.try_clone_inner().unwrap();
        assert_eq!(declared, contents.len() as u64);
        let mut extra = fs::OpenOptions::new().append(true).open(&image).unwrap();
        extra.write_all(b"grown!").unwrap();
        drop(extra);
        let error = read_engine_image_bytes(file, declared, max_bytes).unwrap_err();
        assert!(matches!(error, Error::ResourceLimit(_)));
        use std::io::Seek;
        assert_eq!(observed.stream_position().unwrap(), 11);
    }

    #[test]
    fn engine_image_bytes_accepts_growth_under_max_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let contents = b"01234567";
        let (mutex, handle, image) = registered_engine_image(&dir, contents);
        let max_bytes = 20;
        let (file, declared) = engine_image_reader_for(&mutex, &handle, max_bytes).unwrap();
        assert_eq!(declared, contents.len() as u64);
        let mut extra = fs::OpenOptions::new().append(true).open(&image).unwrap();
        extra.write_all(b"grown").unwrap();
        drop(extra);
        let bytes = read_engine_image_bytes(file, declared, max_bytes).unwrap();
        assert_eq!(bytes, b"01234567grown");
    }

    #[test]
    fn semantic_file_reuse_survives_operation_reordering() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("study.pgn");
        fs::write(&file, b"pgn").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let first = authority
            .get_or_create_persistent_file(
                &file,
                "study",
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )
            .unwrap();
        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        let second = authority
            .get_or_create_persistent_file(
                &file,
                "study",
                vec![PathOperation::WritePgn, PathOperation::ReadPgn],
            )
            .unwrap();
        set_test_atomic_file_injector(None);
        assert_eq!(first.id, second.id);
        assert_eq!(
            authority.persistent[&first.id.id].stored.operations,
            canonical_operations(EntryPurpose::PgnFile)
        );
    }

    #[test]
    fn startup_reconciliation_preserves_retained_evidence_across_partial_calls() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("owned.pgn");
        let book = dir.path().join("orphan.bin");
        fs::write(&file, b"pgn").unwrap();
        fs::write(&book, b"book").unwrap();
        let registry = dir.path().join("registry.json");
        let (owned, orphan) = {
            let mut initial = PathAuthority::open(registry.clone(), vec![]).unwrap();
            let owned = initial
                .get_or_create_persistent_file(
                    &file,
                    "owned",
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                )
                .unwrap()
                .id;
            let orphan = initial.register_opening_book(&book, "book").unwrap();
            (owned, orphan)
        };
        let mut reloaded = PathAuthority::open(registry, vec![]).unwrap();
        reloaded
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![owned.clone()],
                trusted_families: vec![PathOwnerFamily::FileWorkspace],
            })
            .unwrap();
        reloaded
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![PathRef {
                    id: "unknown-stale-reference".into(),
                }],
                trusted_families: vec![
                    PathOwnerFamily::RecentFiles,
                    PathOwnerFamily::SessionWorkspace,
                    PathOwnerFamily::ExpandedDirectories,
                    PathOwnerFamily::PracticeDeck,
                ],
            })
            .unwrap();
        assert!(reloaded
            .resolve(&owned, PathOperation::ReadPgn, &[])
            .is_ok());
        reloaded
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![],
                trusted_families: vec![PathOwnerFamily::OpeningBook],
            })
            .unwrap();
        assert!(reloaded
            .resolve(orphan.path_ref(), PathOperation::OpeningBookRead, &[])
            .is_err());
        assert_eq!(fs::read(book).unwrap(), b"book");
        reloaded
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![],
                trusted_families: vec![PathOwnerFamily::FileWorkspace],
            })
            .unwrap();
        assert!(reloaded
            .resolve(&owned, PathOperation::ReadPgn, &[])
            .is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn final_directory_resolution_retains_the_child_descriptor() {
        let dir = tempfile::tempdir().unwrap();
        let child = dir.path().join("child");
        fs::create_dir(&child).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .migrate_legacy_os_path(
                dir.path().as_os_str().to_os_string(),
                "root",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )
            .unwrap();
        let mut resolved = authority
            .resolve(&root.id, PathOperation::ReadPgn, &[OsString::from("child")])
            .unwrap();
        let descriptor = resolved.take_directory().unwrap();
        assert_eq!(
            file_identity(&descriptor.metadata().unwrap()),
            identity(&child).unwrap()
        );
    }

    fn stored_entry_for(
        path: &Path,
        id: impl Into<String>,
        purpose: Option<EntryPurpose>,
        operations: Vec<PathOperation>,
    ) -> StoredEntry {
        let target_is_dir = path.is_dir();
        StoredEntry {
            id: PathRef { id: id.into() },
            display_name: "fixture".into(),
            class: if target_is_dir {
                PathClass::PersistentCustomRoot
            } else {
                PathClass::PersistentFile
            },
            operations,
            path: NativePath::from_path(path),
            identity: identity(path).unwrap(),
            target_is_dir,
            purpose,
        }
    }

    fn write_registry_with_entries(path: &Path, entries: Vec<StoredEntry>) {
        write_registry(
            path,
            &Registry {
                schema_version: SCHEMA_VERSION,
                entries,
                active_database_root: None,
                active_puzzle_root: None,
                active_engine_root: None,
                pending_artifacts: vec![],
                provisional_attachments: BTreeSet::new(),
                image_cleanup: vec![],
            },
        );
    }

    fn write_registry(path: &Path, registry: &Registry) {
        fs::write(path, serde_json::to_vec(registry).unwrap()).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn legacy_persistent_file_is_rebound_and_writable_after_open() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("g.pgn"), b"1. e4 *").unwrap();
        symlink(&real, &link).unwrap();
        let path = link.join("g.pgn");
        let entry = stored_entry_for(
            &path,
            "legacy-file",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        write_registry_with_entries(&dir.path().join("registry.json"), vec![entry]);

        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let stored = &authority.persistent["legacy-file"].stored;
        assert_eq!(stored.path.to_path().unwrap(), real.join("g.pgn"));
        assert_eq!(
            authority.persistent["legacy-file"].availability,
            PathAvailability::Available
        );
        let resolved = authority
            .resolve(
                &PathRef {
                    id: "legacy-file".into(),
                },
                PathOperation::WritePgn,
                &[],
            )
            .unwrap();
        let snapshot = resolved.pgn_snapshot().unwrap();
        let _ = resolved
            .replace_pgn_atomic(&snapshot, |_source, target| {
                target.write_all(b"1. d4 *").map_err(Error::from)
            })
            .unwrap();
        assert_eq!(fs::read(real.join("g.pgn")).unwrap(), b"1. d4 *");
    }

    #[cfg(unix)]
    #[test]
    fn legacy_persistent_root_is_rebound_and_supports_descriptor_mutation_after_open() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::create_dir(real.join("workspace")).unwrap();
        symlink(&real, &link).unwrap();
        let path = link.join("workspace");
        let entry = stored_entry_for(
            &path,
            "legacy-root",
            Some(EntryPurpose::PgnWorkspace),
            canonical_operations(EntryPurpose::PgnWorkspace),
        );
        write_registry_with_entries(&dir.path().join("registry.json"), vec![entry]);

        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        assert_eq!(
            authority.persistent["legacy-root"]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("workspace")
        );
        let target = authority
            .workspace_mutation_target(&FileWorkspaceHandle::new(PathRef {
                id: "legacy-root".into(),
            }))
            .unwrap();
        let directory = target.directory().unwrap();
        let _ = crate::infra::fs::atomic_replace_at(directory, OsStr::new("created.pgn"), |file| {
            file.write_all(b"1. e4 *").map_err(Error::from)
        })
        .unwrap();
        assert_eq!(
            fs::read(real.join("workspace/created.pgn")).unwrap(),
            b"1. e4 *"
        );
    }

    #[cfg(unix)]
    #[test]
    fn refresh_entry_rejects_a_legacy_spelling_even_when_identity_matches() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("g.pgn"), b"*").unwrap();
        symlink(&real, &link).unwrap();
        let path = link.join("g.pgn");
        let mut entry = Entry {
            stored: stored_entry_for(
                &path,
                "legacy-refresh",
                Some(EntryPurpose::PgnFile),
                canonical_operations(EntryPurpose::PgnFile),
            ),
            availability: PathAvailability::Available,
        };
        refresh_entry(&mut entry, None);
        assert_eq!(entry.availability, PathAvailability::Unavailable);

        let mut refreshed_authority = authority(&dir, Arc::new(TestClock::new(0)));
        refreshed_authority
            .persistent
            .insert("legacy-refresh".into(), entry.clone());
        refreshed_authority.refresh_persistent_id(&PathRef {
            id: "legacy-refresh".into(),
        });
        assert_eq!(
            refreshed_authority.persistent["legacy-refresh"].availability,
            PathAvailability::Unavailable
        );

        fs::create_dir(real.join("workspace")).unwrap();
        fs::write(real.join("workspace/child.pgn"), b"*").unwrap();
        let root_entry = stored_entry_for(
            &link.join("workspace"),
            "legacy-refresh-root",
            Some(EntryPurpose::PgnWorkspace),
            canonical_operations(EntryPurpose::PgnWorkspace),
        );
        let child_entry = stored_entry_for(
            &link.join("workspace/child.pgn"),
            "legacy-refresh-child",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        let mut partial_authority = authority(&dir, Arc::new(TestClock::new(0)));
        partial_authority.persistent.insert(
            root_entry.id.id.clone(),
            Entry {
                stored: root_entry,
                availability: PathAvailability::Available,
            },
        );
        partial_authority.persistent.insert(
            child_entry.id.id.clone(),
            Entry {
                stored: child_entry,
                availability: PathAvailability::Available,
            },
        );
        let mut dropped = Vec::new();
        partial_authority
            .remove_workspace_entry(
                &FileWorkspaceHandle::new(PathRef {
                    id: "legacy-refresh-root".into(),
                }),
                WorkspaceRemovalStatus::Partial,
                &mut dropped,
            )
            .unwrap();
        assert!(!partial_authority
            .persistent
            .contains_key("legacy-refresh-child"));
    }

    #[cfg(unix)]
    #[test]
    fn rebinding_is_persisted_and_second_open_does_not_acquire_again() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("g.pgn"), b"*").unwrap();
        symlink(&real, &link).unwrap();
        write_registry_with_entries(
            &dir.path().join("registry.json"),
            vec![stored_entry_for(
                &link.join("g.pgn"),
                "reopen-file",
                Some(EntryPurpose::PgnFile),
                canonical_operations(EntryPurpose::PgnFile),
            )],
        );

        ACQUIRE_TARGET_CALLS.with(|calls| calls.set(0));
        let first = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 1);
        assert_eq!(
            first.persistent["reopen-file"]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("g.pgn")
        );
        drop(first);
        let second = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 1);
        assert_eq!(
            second.persistent["reopen-file"]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("g.pgn")
        );
    }

    #[cfg(unix)]
    #[test]
    fn canonical_registry_is_not_rewritten_or_acquired() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("g.pgn");
        fs::write(&file, b"*").unwrap();
        let registry = dir.path().join("registry.json");
        write_registry_with_entries(
            &registry,
            vec![stored_entry_for(
                &file,
                "canonical-file",
                Some(EntryPurpose::PgnFile),
                canonical_operations(EntryPurpose::PgnFile),
            )],
        );
        let before = observed_identity(&registry);
        ACQUIRE_TARGET_CALLS.with(|calls| calls.set(0));
        let authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 0);
        assert_eq!(observed_identity(&registry), before);
        assert_eq!(
            authority.persistent["canonical-file"].availability,
            PathAvailability::Available
        );
    }

    #[cfg(unix)]
    #[test]
    fn changed_legacy_object_is_unavailable_while_other_entries_rebind() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("changed.pgn"), b"old").unwrap();
        fs::write(real.join("stable.pgn"), b"stable").unwrap();
        symlink(&real, &link).unwrap();
        let changed = stored_entry_for(
            &link.join("changed.pgn"),
            "changed-entry",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        let stable = stored_entry_for(
            &link.join("stable.pgn"),
            "stable-entry",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        fs::write(real.join("replacement"), b"new").unwrap();
        fs::rename(real.join("replacement"), real.join("changed.pgn")).unwrap();
        write_registry_with_entries(&dir.path().join("registry.json"), vec![changed, stable]);

        let capture = crate::error::LogCaptureScope::start();
        let authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let warnings: Vec<_> = capture
            .records()
            .into_iter()
            .filter(|record| record.level == log::Level::Warn)
            .filter(|record| record.message.contains("changed-entry"))
            .collect();
        assert_eq!(warnings.len(), 1, "{warnings:?}");
        assert!(warnings[0].message.contains("identity changed"));
        assert_eq!(
            authority.persistent["changed-entry"]
                .stored
                .path
                .to_path()
                .unwrap(),
            link.join("changed.pgn")
        );
        assert_eq!(
            authority.persistent["changed-entry"].availability,
            PathAvailability::Unavailable
        );
        assert_eq!(
            authority.persistent["stable-entry"]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("stable.pgn")
        );
        assert_eq!(
            authority.persistent["stable-entry"].availability,
            PathAvailability::Available
        );
    }

    #[cfg(unix)]
    #[test]
    fn failed_canonical_proof_keeps_entry_unavailable_without_aborting_open() {
        use std::os::unix::fs::symlink;

        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        let moved = dir.path().join("moved");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("g.pgn"), b"*").unwrap();
        symlink(&real, &link).unwrap();
        let entry = stored_entry_for(
            &link.join("g.pgn"),
            "proof-failure",
            Some(EntryPurpose::PgnFile),
            canonical_operations(EntryPurpose::PgnFile),
        );
        write_registry_with_entries(&dir.path().join("registry.json"), vec![entry]);

        let hook_real = real.clone();
        let hook_moved = moved.clone();
        ACQUIRE_TARGET_BEFORE_PROOF_HOOK.with(|slot| {
            slot.replace(Some(Box::new(move || {
                fs::rename(&hook_real, &hook_moved).unwrap();
                fs::create_dir(&hook_real).unwrap();
                fs::write(hook_real.join("g.pgn"), b"replacement").unwrap();
            })))
        });
        let capture = crate::error::LogCaptureScope::start();
        let authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert_eq!(
            authority.persistent["proof-failure"]
                .stored
                .path
                .to_path()
                .unwrap(),
            link.join("g.pgn")
        );
        assert_eq!(
            authority.persistent["proof-failure"].availability,
            PathAvailability::Unavailable
        );
        assert!(
            capture
                .messages()
                .iter()
                .filter(|message| message.contains("proof-failure"))
                .count()
                >= 1
        );
    }

    #[cfg(unix)]
    #[test]
    fn leafless_persistent_spelling_is_not_acquired() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let root = stored_entry_for(
            Path::new("/"),
            "leafless-root",
            Some(EntryPurpose::PgnWorkspace),
            canonical_operations(EntryPurpose::PgnWorkspace),
        );
        write_registry_with_entries(&registry, vec![root]);
        ACQUIRE_TARGET_CALLS.with(|calls| calls.set(0));
        let authority = PathAuthority::open(registry, vec![]).unwrap();
        assert_eq!(ACQUIRE_TARGET_CALLS.with(|calls| calls.get()), 0);
        assert_eq!(
            authority.persistent["leafless-root"]
                .stored
                .path
                .to_path()
                .unwrap(),
            Path::new("/")
        );
        assert_eq!(
            authority.persistent["leafless-root"].availability,
            PathAvailability::Available
        );
    }

    #[cfg(unix)]
    #[test]
    fn hard_rebinding_commit_failure_is_retried_by_the_next_registration() {
        struct RenameFailure;
        impl AtomicWriterInjector for RenameFailure {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::Rename {
                    Err(std::io::Error::other("injected registry rename failure"))
                } else {
                    Ok(())
                }
            }
        }

        use std::os::unix::fs::symlink;
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("legacy.pgn"), b"*").unwrap();
        symlink(&real, &link).unwrap();
        let registry = dir.path().join("registry.json");
        write_registry_with_entries(
            &registry,
            vec![stored_entry_for(
                &link.join("legacy.pgn"),
                "hard-failure",
                Some(EntryPurpose::PgnFile),
                canonical_operations(EntryPurpose::PgnFile),
            )],
        );

        let capture = crate::error::LogCaptureScope::start();
        set_test_atomic_file_injector(Some(Arc::new(RenameFailure)));
        let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
        set_test_atomic_file_injector(None);
        assert_eq!(
            authority.persistent["hard-failure"]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("legacy.pgn")
        );
        assert_eq!(
            authority.persistent["hard-failure"].availability,
            PathAvailability::Available
        );
        assert!(!authority.registry_durability_pending);
        let warnings: Vec<_> = capture
            .records()
            .into_iter()
            .filter(|record| record.level == log::Level::Warn)
            .filter(|record| record.message.contains("hard-failure"))
            .collect();
        assert_eq!(warnings.len(), 1, "{warnings:?}");
        assert!(warnings[0].message.contains("I/O failure"));

        let fresh = dir.path().join("fresh.pgn");
        fs::write(&fresh, b"fresh").unwrap();
        authority
            .get_or_create_persistent_file(
                &fresh,
                "fresh",
                canonical_operations(EntryPurpose::PgnFile),
            )
            .unwrap();
        drop(authority);
        // Read the registry file itself, not a reopened authority: the rebinding pass runs again
        // on every open, so a reopened authority shows the canonical spelling whether or not the
        // failed commit was ever flushed. Only the bytes on disk distinguish the two.
        let persisted: Registry =
            serde_json::from_str(&fs::read_to_string(&registry).unwrap()).unwrap();
        let stored = persisted
            .entries
            .iter()
            .find(|entry| entry.id.id == "hard-failure")
            .expect("the rebound entry stays in the registry");
        assert_eq!(
            stored.path.to_path().unwrap(),
            real.join("legacy.pgn"),
            "the next successful commit must flush the rebinding"
        );
    }

    #[cfg(unix)]
    #[test]
    fn uncertain_rebinding_commit_adopts_entry_and_marks_pending_durability() {
        use std::os::unix::fs::symlink;
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("legacy.pgn"), b"*").unwrap();
        symlink(&real, &link).unwrap();
        let registry = dir.path().join("registry.json");
        write_registry_with_entries(
            &registry,
            vec![stored_entry_for(
                &link.join("legacy.pgn"),
                "uncertain-rebind",
                Some(EntryPurpose::PgnFile),
                canonical_operations(EntryPurpose::PgnFile),
            )],
        );

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "injected parent sync failure",
        ))));
        let authority = PathAuthority::open(registry, vec![]).unwrap();
        set_test_atomic_file_injector(None);
        assert_eq!(
            authority.persistent["uncertain-rebind"]
                .stored
                .path
                .to_path()
                .unwrap(),
            real.join("legacy.pgn")
        );
        assert_eq!(
            authority.persistent["uncertain-rebind"].availability,
            PathAvailability::Available
        );
        assert!(authority.registry_durability_pending);
    }

    #[cfg(unix)]
    #[test]
    fn download_destination_rebind_is_canonical_and_usable() {
        use std::os::unix::fs::symlink;
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir_all(real.join("downloads")).unwrap();
        symlink(&real, &link).unwrap();
        let id = "download-destination";
        let entry = stored_entry_for(
            &link.join("downloads"),
            id,
            Some(EntryPurpose::DownloadDestination),
            canonical_operations(EntryPurpose::DownloadDestination),
        );
        write_registry_with_entries(&dir.path().join("registry.json"), vec![entry]);
        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert_eq!(
            authority.persistent[id].stored.path.to_path().unwrap(),
            real.join("downloads")
        );
        let resolved = authority
            .resolve(
                &PathRef { id: id.into() },
                PathOperation::DownloadFile,
                &[OsString::from("installed.pgn")],
            )
            .unwrap();
        let _ = resolved
            .atomic_replace_download(|file| file.write_all(b"download").map_err(Error::from))
            .unwrap();
        assert_eq!(
            fs::read(real.join("downloads/installed.pgn")).unwrap(),
            b"download"
        );
    }

    #[cfg(unix)]
    #[test]
    fn engine_resource_rebind_is_canonical_and_lease_usable() {
        use std::os::unix::fs::symlink;
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        let link = dir.path().join("link");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("resource.nnue"), b"resource").unwrap();
        symlink(&real, &link).unwrap();
        let id = "engine-resource";
        let entry = stored_entry_for(
            &link.join("resource.nnue"),
            id,
            Some(EntryPurpose::EngineResource),
            canonical_operations(EntryPurpose::EngineResource),
        );
        write_registry_with_entries(&dir.path().join("registry.json"), vec![entry]);
        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert_eq!(
            authority.persistent[id].stored.path.to_path().unwrap(),
            real.join("resource.nnue")
        );
        let handle = EngineResourceHandle::new(
            PathRef { id: id.into() },
            EngineResourceHandleKind::File,
            "resource".into(),
        );
        let lease = authority.engine_resource(&handle).unwrap();
        assert!(!lease.uci_value().unwrap().is_empty());
    }

    #[test]
    fn schema_one_backfills_every_exact_legacy_purpose_and_preserves_unknown_records() {
        let dir = tempfile::tempdir().unwrap();
        let registry_path = dir.path().join("registry.json");
        let purposes = [
            EntryPurpose::PgnWorkspace,
            EntryPurpose::PgnFile,
            EntryPurpose::PgnReadOnlyFile,
            EntryPurpose::DownloadDestination,
            EntryPurpose::DatabaseRoot,
            EntryPurpose::DatabaseFile,
            EntryPurpose::PuzzleRoot,
            EntryPurpose::PuzzleFile,
            EntryPurpose::EngineRoot,
            EntryPurpose::EngineExecutable,
            EntryPurpose::EngineResource,
            EntryPurpose::OpeningBook,
            EntryPurpose::EngineImage,
        ];
        let mut entries = Vec::new();
        for (index, purpose) in purposes.into_iter().enumerate() {
            let path = dir.path().join(format!("purpose-{index}"));
            let is_dir = matches!(
                purpose,
                EntryPurpose::PgnWorkspace
                    | EntryPurpose::DownloadDestination
                    | EntryPurpose::DatabaseRoot
                    | EntryPurpose::PuzzleRoot
                    | EntryPurpose::EngineRoot
            );
            if is_dir {
                fs::create_dir(&path).unwrap();
            } else {
                fs::write(&path, b"fixture").unwrap();
            }
            let operations = if purpose == EntryPurpose::EngineExecutable {
                vec![
                    PathOperation::EngineExecute,
                    PathOperation::EngineConfigure,
                    PathOperation::EngineInstall,
                ]
            } else {
                canonical_operations(purpose)
            };
            entries.push(stored_entry_for(
                &path,
                format!("purpose-{index}"),
                None,
                operations,
            ));
        }
        let unknown_path = dir.path().join("unknown");
        fs::write(&unknown_path, b"unknown").unwrap();
        entries.push(stored_entry_for(
            &unknown_path,
            "unknown",
            None,
            vec![PathOperation::SnapshotWrite],
        ));
        let mut json = serde_json::to_value(Registry {
            schema_version: SCHEMA_VERSION,
            entries,
            active_database_root: None,
            active_puzzle_root: None,
            active_engine_root: None,
            pending_artifacts: vec![],
            provisional_attachments: BTreeSet::new(),
            image_cleanup: vec![],
        })
        .unwrap();
        for entry in json["entries"].as_array_mut().unwrap() {
            entry.as_object_mut().unwrap().remove("purpose");
        }
        fs::write(&registry_path, serde_json::to_vec(&json).unwrap()).unwrap();

        let mut authority = PathAuthority::open(registry_path.clone(), vec![]).unwrap();
        for (index, purpose) in purposes.into_iter().enumerate() {
            let entry = &authority.persistent[&format!("purpose-{index}")].stored;
            assert_eq!(entry.purpose, Some(purpose));
            assert_eq!(entry.operations, canonical_operations(purpose));
        }
        assert_eq!(authority.persistent["unknown"].stored.purpose, None);
        authority.save().unwrap();
        let reloaded = PathAuthority::open(registry_path, vec![]).unwrap();
        assert_eq!(reloaded.persistent["unknown"].stored.purpose, None);
        for (index, purpose) in purposes.into_iter().enumerate() {
            assert_eq!(
                reloaded.persistent[&format!("purpose-{index}")]
                    .stored
                    .purpose,
                Some(purpose)
            );
        }
    }

    #[test]
    fn tagged_historical_operation_subsets_upgrade_under_same_root_and_file_ids() {
        let dir = tempfile::tempdir().unwrap();
        let registry_path = dir.path().join("registry.json");
        let root_path = dir.path().join("database-root");
        let file_path = dir.path().join("study.pgn");
        fs::create_dir(&root_path).unwrap();
        fs::write(&file_path, b"*").unwrap();
        let root_id = PathRef {
            id: "root-id".into(),
        };
        let file_id = PathRef {
            id: "file-id".into(),
        };
        let registry = Registry {
            schema_version: SCHEMA_VERSION,
            entries: vec![
                stored_entry_for(
                    &root_path,
                    root_id.id.clone(),
                    Some(EntryPurpose::DatabaseRoot),
                    vec![PathOperation::DatabaseRead],
                ),
                stored_entry_for(
                    &file_path,
                    file_id.id.clone(),
                    Some(EntryPurpose::PgnFile),
                    vec![PathOperation::ReadPgn],
                ),
            ],
            active_database_root: None,
            active_puzzle_root: None,
            active_engine_root: None,
            pending_artifacts: vec![],
            provisional_attachments: BTreeSet::new(),
            image_cleanup: vec![],
        };
        fs::write(&registry_path, serde_json::to_vec(&registry).unwrap()).unwrap();
        let mut authority = PathAuthority::open(registry_path.clone(), vec![]).unwrap();
        let root = authority
            .get_or_create_database_root(&root_path, "root", None)
            .unwrap();
        let file = authority
            .get_or_create_persistent_file(
                &file_path,
                "study",
                vec![PathOperation::WritePgn, PathOperation::ReadPgn],
            )
            .unwrap();
        assert_eq!(root.path_ref(), &root_id);
        assert_eq!(file.id, file_id);
        assert_eq!(
            authority.persistent[&root_id.id].stored.operations,
            canonical_operations(EntryPurpose::DatabaseRoot)
        );
        assert_eq!(
            authority.persistent[&file_id.id].stored.operations,
            canonical_operations(EntryPurpose::PgnFile)
        );
        drop(authority);
        let reloaded = PathAuthority::open(registry_path, vec![]).unwrap();
        assert_eq!(
            reloaded.persistent[&root_id.id].stored.operations,
            canonical_operations(EntryPurpose::DatabaseRoot)
        );
        assert_eq!(
            reloaded.persistent[&file_id.id].stored.operations,
            canonical_operations(EntryPurpose::PgnFile)
        );
    }

    #[test]
    fn semantic_reuse_does_not_broaden_an_unrelated_same_file_grant() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("shared.bin");
        fs::write(&file, b"shared").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let book = authority.register_opening_book(&file, "book").unwrap();
        let pgn = authority
            .get_or_create_persistent_file(
                &file,
                "pgn",
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )
            .unwrap();
        assert_ne!(book.path_ref(), &pgn.id);
        assert_eq!(
            authority.persistent[&book.path_ref().id].stored.operations,
            canonical_operations(EntryPurpose::OpeningBook)
        );
    }

    #[test]
    fn registry_admission_bounds_ids_pending_bytes_and_allow_non_growing_legacy() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("entry");
        fs::write(&file, b"entry").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let template = Entry {
            stored: stored_entry_for(
                &file,
                "template",
                Some(EntryPurpose::OpeningBook),
                canonical_operations(EntryPurpose::OpeningBook),
            ),
            availability: PathAvailability::Available,
        };
        for index in 0..=MAX_AUTHORITY_IDS {
            let mut entry = template.clone();
            entry.stored.id.id = format!("id-{index}");
            authority
                .persistent
                .insert(entry.stored.id.id.clone(), entry);
        }
        let same = authority.persistent.clone();
        assert!(authority
            .save_entries_with(&same, &None, &None, &None, &[], |_path, _write| {
                Ok(AtomicFileOutcome::DurableCommit)
            })
            .is_ok());
        let mut growth = same.clone();
        let mut extra = template.clone();
        extra.stored.id.id = "one-more".into();
        growth.insert(extra.stored.id.id.clone(), extra);
        let mut called = false;
        assert!(matches!(
            authority.save_entries_with(&growth, &None, &None, &None, &[], |_path, _write| {
                called = true;
                Ok(AtomicFileOutcome::DurableCommit)
            }),
            Err(Error::ResourceLimit(_))
        ));
        assert!(!called);

        authority.persistent.clear();
        let mut oversized = template;
        oversized.stored.id.id = "oversized".into();
        oversized.stored.display_name = "x".repeat(MAX_REGISTRY_BYTES + 1);
        let source = BTreeMap::from([(oversized.stored.id.id.clone(), oversized)]);
        assert!(matches!(
            authority.save_entries_with(&source, &None, &None, &None, &[], |_path, _write| {
                panic!("oversized bytes must be refused before replacement")
            }),
            Err(Error::ResourceLimit(_))
        ));
        authority.persistent = source.clone();
        assert!(authority
            .save_entries_with(&source, &None, &None, &None, &[], |_path, _write| {
                Ok(AtomicFileOutcome::DurableCommit)
            })
            .is_ok());
        let mut byte_growth = source;
        byte_growth
            .values_mut()
            .next()
            .unwrap()
            .stored
            .display_name
            .push('x');
        assert!(matches!(
            authority.save_entries_with(
                &byte_growth,
                &None,
                &None,
                &None,
                &[],
                |_path, _write| panic!("legacy byte growth must be refused"),
            ),
            Err(Error::ResourceLimit(_))
        ));

        let pending_template = PendingArtifact {
            id: PathRef {
                id: "pending".into(),
            },
            root: PathRef { id: "root".into() },
            filename: NativePath::from_path(Path::new("leaf")),
            display_name: "pending".into(),
            operations: vec![PathOperation::ReadPgn],
            baseline: None,
            root_identity: None,
            payload_size: 0,
            payload_sha256: String::new(),
            payload_bound: false,
            installed_identity: None,
            installed_ctime_nanos: None,
        };
        authority.pending_artifacts = (0..=MAX_PENDING_ARTIFACTS)
            .map(|index| {
                let mut pending = pending_template.clone();
                pending.id.id = format!("pending-{index}");
                pending
            })
            .collect();
        assert!(authority
            .save_entries_with(
                &BTreeMap::new(),
                &None,
                &None,
                &None,
                &authority.pending_artifacts,
                |_path, _write| Ok(AtomicFileOutcome::DurableCommit),
            )
            .is_ok());
        let mut pending_growth = authority.pending_artifacts.clone();
        let mut extra_pending = pending_template;
        extra_pending.id.id = "pending-more".into();
        pending_growth.push(extra_pending);
        assert!(matches!(
            authority.save_entries_with(
                &BTreeMap::new(),
                &None,
                &None,
                &None,
                &pending_growth,
                |_path, _write| panic!("pending growth must be refused"),
            ),
            Err(Error::ResourceLimit(_))
        ));
    }

    #[test]
    fn unique_id_limit_counts_the_union_and_failed_promotion_consumes_its_dialog() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("entry");
        fs::write(&file, b"entry").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let template = Entry {
            stored: stored_entry_for(
                &file,
                "template",
                Some(EntryPurpose::OpeningBook),
                canonical_operations(EntryPurpose::OpeningBook),
            ),
            availability: PathAvailability::Available,
        };
        for index in 0..MAX_AUTHORITY_IDS {
            let mut entry = template.clone();
            entry.stored.id.id = format!("union-{index}");
            authority
                .persistent
                .insert(entry.stored.id.id.clone(), entry);
        }
        let duplicate_pending = PendingArtifact {
            id: PathRef {
                id: "union-0".into(),
            },
            root: PathRef {
                id: "union-1".into(),
            },
            filename: NativePath::from_path(Path::new("leaf")),
            display_name: "pending".into(),
            operations: vec![PathOperation::ReadPgn],
            baseline: None,
            root_identity: None,
            payload_size: 0,
            payload_sha256: String::new(),
            payload_bound: false,
            installed_identity: None,
            installed_ctime_nanos: None,
        };
        assert!(authority
            .save_entries_with(
                &authority.persistent,
                &None,
                &None,
                &None,
                std::slice::from_ref(&duplicate_pending),
                |_path, _write| Ok(AtomicFileOutcome::DurableCommit),
            )
            .is_ok());
        let mut unique_pending = duplicate_pending;
        unique_pending.id.id = "union-new".into();
        assert!(matches!(
            authority.save_entries_with(
                &authority.persistent,
                &None,
                &None,
                &None,
                &[unique_pending],
                |_path, _write| panic!("union growth must be refused"),
            ),
            Err(Error::ResourceLimit(_))
        ));

        let dialog_file = dir.path().join("dialog.pgn");
        fs::write(&dialog_file, b"*").unwrap();
        let dialog = authority
            .grant_dialog(
                &dialog_file,
                "dialog",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        assert!(matches!(
            authority.promote_dialog(
                &dialog,
                PathClass::PersistentFile,
                "dialog",
                vec![PathOperation::ReadPgn],
            ),
            Err(Error::ResourceLimit(_))
        ));
        assert!(!authority.dialogs.contains_key(&dialog.id));
        assert_eq!(authority.persistent.len(), MAX_AUTHORITY_IDS);
    }

    #[test]
    fn oversized_startup_input_and_unknown_ids_do_not_mutate_or_accumulate() {
        let dir = tempfile::tempdir().unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let oversized = (0..=MAX_AUTHORITY_IDS)
            .map(|index| PathRef {
                id: format!("unknown-{index}"),
            })
            .collect();
        assert!(matches!(
            authority.reconcile_startup_owners(StartupPathOwners {
                retained_ids: oversized,
                trusted_families: vec![],
            }),
            Err(Error::ResourceLimit(_))
        ));
        for index in 0..20 {
            authority
                .reconcile_startup_owners(StartupPathOwners {
                    retained_ids: vec![PathRef {
                        id: format!("missing-{index}"),
                    }],
                    trusted_families: vec![],
                })
                .unwrap();
        }
        assert!(authority.startup_retained_ids.is_empty());
    }

    #[test]
    fn registry_reader_consumes_only_ceiling_plus_detection_byte() {
        struct CountingReader(u64);
        impl Read for CountingReader {
            fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
                if buffer.is_empty() {
                    return Ok(0);
                }
                self.0 += buffer.len() as u64;
                buffer.fill(0);
                Ok(buffer.len())
            }
        }
        let mut reader = CountingReader(0);
        assert!(matches!(
            read_registry_bytes(&mut reader),
            Err(Error::ResourceLimit(_))
        ));
        assert_eq!(reader.0, MAX_LEGACY_REGISTRY_BYTES + 1);
    }

    #[test]
    fn single_id_getter_refreshes_only_the_queried_record() {
        let dir = tempfile::tempdir().unwrap();
        let first = dir.path().join("first");
        let second = dir.path().join("second");
        fs::write(&first, b"first").unwrap();
        fs::write(&second, b"second").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let first = authority.register_opening_book(&first, "first").unwrap();
        authority.register_opening_book(&second, "second").unwrap();
        let observed = Arc::new(Mutex::new(Vec::<String>::new()));
        let captured = observed.clone();
        REFRESH_ENTRY_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move |id| captured.lock().unwrap().push(id.into())))
        });
        assert_eq!(authority.display_name(first.path_ref()).unwrap(), "first");
        REFRESH_ENTRY_HOOK.with(|slot| *slot.borrow_mut() = None);
        assert_eq!(
            observed.lock().unwrap().as_slice(),
            &[first.path_ref().id.clone()]
        );
    }

    #[cfg(unix)]
    #[test]
    fn final_directory_resolution_rejects_a_swap_between_stat_and_open() {
        let dir = tempfile::tempdir().unwrap();
        let child = dir.path().join("child");
        let original = dir.path().join("original");
        fs::create_dir(&child).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .migrate_legacy_os_path(
                dir.path().as_os_str().to_os_string(),
                "root",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )
            .unwrap();
        let child_for_hook = child.clone();
        RESOLVE_PRE_DIRECTORY_OPEN_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move || {
                fs::rename(&child_for_hook, &original).unwrap();
                fs::create_dir(&child_for_hook).unwrap();
            }))
        });
        assert!(matches!(
            authority.resolve(&root.id, PathOperation::ReadPgn, &[OsString::from("child")]),
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn startup_sweep_reclaims_each_non_attachment_purpose_but_preserves_native_owners_and_files() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let purposes = [
            EntryPurpose::PgnWorkspace,
            EntryPurpose::PgnFile,
            EntryPurpose::PgnReadOnlyFile,
            EntryPurpose::DownloadDestination,
            EntryPurpose::DatabaseFile,
            EntryPurpose::PuzzleFile,
            EntryPurpose::EngineExecutable,
            EntryPurpose::OpeningBook,
            EntryPurpose::DatabaseRoot,
            EntryPurpose::PuzzleRoot,
            EntryPurpose::EngineRoot,
        ];
        let mut entries = Vec::new();
        let mut paths = Vec::new();
        for (index, purpose) in purposes.into_iter().enumerate() {
            let path = dir.path().join(format!("stale-{index}"));
            if purpose_matches_shape(purpose, PathClass::PersistentCustomRoot, true) {
                fs::create_dir(&path).unwrap();
            } else {
                fs::write(&path, b"file").unwrap();
            }
            paths.push(path.clone());
            entries.push(stored_entry_for(
                &path,
                format!("stale-{index}"),
                Some(purpose),
                canonical_operations(purpose),
            ));
        }
        let active_path = dir.path().join("active-root");
        fs::create_dir(&active_path).unwrap();
        entries.push(stored_entry_for(
            &active_path,
            "active-root",
            Some(EntryPurpose::DatabaseRoot),
            canonical_operations(EntryPurpose::DatabaseRoot),
        ));
        let pending_path = dir.path().join("pending-root");
        fs::create_dir(&pending_path).unwrap();
        entries.push(stored_entry_for(
            &pending_path,
            "pending-root",
            Some(EntryPurpose::PgnWorkspace),
            canonical_operations(EntryPurpose::PgnWorkspace),
        ));
        let resource_path = dir.path().join("resource");
        fs::write(&resource_path, b"resource").unwrap();
        entries.push(stored_entry_for(
            &resource_path,
            "resource",
            Some(EntryPurpose::EngineResource),
            canonical_operations(EntryPurpose::EngineResource),
        ));
        let pending = PendingArtifact {
            id: PathRef {
                id: "pending-id".into(),
            },
            root: PathRef {
                id: "pending-root".into(),
            },
            filename: NativePath::from_path(Path::new("pending.pgn")),
            display_name: "pending".into(),
            operations: vec![PathOperation::ReadPgn],
            baseline: None,
            root_identity: None,
            payload_size: 0,
            payload_sha256: String::new(),
            payload_bound: false,
            installed_identity: None,
            installed_ctime_nanos: None,
        };
        fs::write(
            &registry,
            serde_json::to_vec(&Registry {
                schema_version: SCHEMA_VERSION,
                entries,
                active_database_root: Some(PathRef {
                    id: "active-root".into(),
                }),
                active_puzzle_root: None,
                active_engine_root: None,
                pending_artifacts: vec![pending],
                provisional_attachments: BTreeSet::new(),
                image_cleanup: vec![],
            })
            .unwrap(),
        )
        .unwrap();
        let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
        authority
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![PathRef {
                    id: "unrecognized-renderer-id".into(),
                }],
                trusted_families: vec![
                    PathOwnerFamily::Engines,
                    PathOwnerFamily::DownloadDestination,
                    PathOwnerFamily::FileWorkspace,
                    PathOwnerFamily::RecentFiles,
                    PathOwnerFamily::ReferenceDatabase,
                    PathOwnerFamily::PuzzleDatabase,
                    PathOwnerFamily::OpeningBook,
                    PathOwnerFamily::SessionWorkspace,
                    PathOwnerFamily::ExpandedDirectories,
                    PathOwnerFamily::DatabaseView,
                    PathOwnerFamily::PracticeDeck,
                ],
            })
            .unwrap();
        for index in 0..purposes.len() {
            assert!(!authority.persistent.contains_key(&format!("stale-{index}")));
        }
        for kept in ["active-root", "pending-root", "resource"] {
            assert!(authority.persistent.contains_key(kept), "{kept}");
        }
        for path in paths
            .iter()
            .chain([&active_path, &pending_path, &resource_path])
        {
            assert!(path.exists(), "reclamation removed {}", path.display());
        }
        drop(authority);
        let reloaded = PathAuthority::open(registry, vec![]).unwrap();
        assert!(reloaded.persistent.contains_key("active-root"));
        assert!(reloaded.persistent.contains_key("pending-root"));
        assert!(reloaded.persistent.contains_key("resource"));
    }

    #[test]
    fn referenced_offline_record_survives_a_trusted_startup_sweep() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let path = dir.path().join("offline.book");
        fs::write(&path, b"book").unwrap();
        let handle = {
            let mut initial = PathAuthority::open(registry.clone(), vec![]).unwrap();
            initial.register_opening_book(&path, "offline").unwrap()
        };
        fs::remove_file(&path).unwrap();
        let mut authority = PathAuthority::open(registry, vec![]).unwrap();
        authority
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![handle.id.clone()],
                trusted_families: vec![PathOwnerFamily::OpeningBook],
            })
            .unwrap();
        assert!(authority.persistent.contains_key(&handle.path_ref().id));
        assert_eq!(
            authority.persistent[&handle.path_ref().id].availability,
            PathAvailability::Unavailable
        );
    }

    #[test]
    fn workspace_and_database_child_reuse_upgrade_canonical_operations_under_the_same_id() {
        let dir = tempfile::tempdir().unwrap();
        let (mut authority, workspace_root) =
            writable_root(&dir, canonical_operations(EntryPurpose::PgnWorkspace));
        let workspace_file = dir.path().join("root/study.pgn");
        fs::write(&workspace_file, b"*").unwrap();
        let workspace = FileWorkspaceHandle::new(workspace_root);
        let child = authority
            .register_workspace_child_observed(
                &workspace,
                &[OsString::from("study.pgn")],
                "study",
                observed_identity(&workspace_file),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        authority
            .persistent
            .get_mut(&child.path_ref().id)
            .unwrap()
            .stored
            .operations = vec![PathOperation::ReadPgn];
        authority.save().unwrap();
        let reused = authority
            .register_workspace_child_observed(
                &workspace,
                &[OsString::from("study.pgn")],
                "study",
                observed_identity(&workspace_file),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        assert_eq!(reused, child);
        assert_eq!(
            authority.persistent[&child.path_ref().id].stored.operations,
            canonical_operations(EntryPurpose::PgnFile)
        );

        let database_root_path = dir.path().join("databases");
        fs::create_dir(&database_root_path).unwrap();
        let database_path = database_root_path.join("child.db3");
        fs::write(&database_path, b"database").unwrap();
        let database_root = authority
            .get_or_create_database_root(&database_root_path, "databases", None)
            .unwrap();
        let database = authority
            .register_database_child(
                &database_root,
                OsStr::new("child.db3"),
                "child",
                observed_identity(&database_root_path.join("child.db3")),
            )
            .unwrap();
        authority
            .persistent
            .get_mut(&database.path_ref().id)
            .unwrap()
            .stored
            .operations = vec![PathOperation::DatabaseRead];
        authority.save().unwrap();
        let database_again = authority
            .register_database_child(
                &database_root,
                OsStr::new("child.db3"),
                "child",
                observed_identity(&database_root_path.join("child.db3")),
            )
            .unwrap();
        assert_eq!(database_again, database);
        assert_eq!(
            authority.persistent[&database.path_ref().id]
                .stored
                .operations,
            canonical_operations(EntryPurpose::DatabaseFile)
        );
    }

    #[test]
    fn unknown_workspace_child_reuse_requires_the_parent_operation_set() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("unknown-root");
        let child_path = root_path.join("study.pgn");
        fs::create_dir(&root_path).unwrap();
        fs::write(&child_path, b"*").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .migrate_legacy_os_path(
                root_path.into_os_string(),
                "unknown root",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn, PathOperation::SnapshotWrite],
            )
            .unwrap()
            .id;
        let unrelated = StoredEntry {
            id: PathRef {
                id: "unrelated-unknown".into(),
            },
            display_name: "unrelated".into(),
            class: PathClass::PersistentFile,
            operations: vec![PathOperation::ReadPgn, PathOperation::LogWrite],
            path: NativePath::from_path(&child_path),
            identity: identity(&child_path).unwrap(),
            target_is_dir: false,
            purpose: None,
        };
        authority.persistent.insert(
            unrelated.id.id.clone(),
            Entry {
                stored: unrelated,
                availability: PathAvailability::Available,
            },
        );
        authority.save().unwrap();

        let registered = authority
            .register_workspace_child_observed(
                &FileWorkspaceHandle::new(root),
                &[OsString::from("study.pgn")],
                "study",
                observed_identity(&child_path),
                false,
                PathOperation::ReadPgn,
            )
            .unwrap();
        assert_ne!(registered.path_ref().id, "unrelated-unknown");
        assert_eq!(
            authority.persistent["unrelated-unknown"].stored.operations,
            vec![PathOperation::ReadPgn, PathOperation::LogWrite]
        );
        assert_eq!(
            authority.persistent[&registered.path_ref().id]
                .stored
                .operations,
            vec![PathOperation::ReadPgn, PathOperation::SnapshotWrite]
        );
    }

    #[test]
    fn repeated_create_remove_cycles_prune_session_tracking() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("study.pgn");
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        for _ in 0..20 {
            fs::write(&path, b"*").unwrap();
            let handle = authority
                .get_or_create_persistent_file(
                    &path,
                    "study",
                    canonical_operations(EntryPurpose::PgnFile),
                )
                .unwrap();
            fs::remove_file(&path).unwrap();
            let mut dropped = Vec::new();
            authority
                .remove_workspace_entry(
                    &FileWorkspaceHandle::new(handle.id),
                    WorkspaceRemovalStatus::Complete,
                    &mut dropped,
                )
                .unwrap();
            assert!(authority.persistent.is_empty());
            assert!(authority.session_protected_ids.is_empty());
            assert!(authority.loaded_candidate_ids.is_empty());
            assert!(authority.startup_retained_ids.is_empty());
        }
    }

    #[test]
    fn delayed_sweep_preserves_fresh_reissued_and_successfully_used_records() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let paths: Vec<_> = (0..4)
            .map(|index| dir.path().join(format!("book-{index}")))
            .collect();
        for path in &paths {
            fs::write(path, b"book").unwrap();
        }
        let loaded: Vec<_> = {
            let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
            paths[..3]
                .iter()
                .map(|path| authority.register_opening_book(path, "book").unwrap())
                .collect()
        };
        let mut authority = PathAuthority::open(registry, vec![]).unwrap();
        let fresh = authority.register_opening_book(&paths[3], "fresh").unwrap();
        let reissued = authority
            .register_opening_book(&paths[0], "reissued")
            .unwrap();
        assert_eq!(reissued, loaded[0]);
        authority
            .resolve(loaded[1].path_ref(), PathOperation::OpeningBookRead, &[])
            .unwrap();
        authority
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![],
                trusted_families: vec![PathOwnerFamily::OpeningBook],
            })
            .unwrap();
        for kept in [&fresh, &loaded[0], &loaded[1]] {
            assert!(authority.persistent.contains_key(&kept.path_ref().id));
        }
        assert!(!authority.persistent.contains_key(&loaded[2].path_ref().id));
        assert!(authority.session_protected_ids.len() <= authority.persistent.len());
    }

    #[test]
    fn startup_sweep_failure_is_retryable_and_uncertain_replacement_is_adopted_but_incomplete() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let first = dir.path().join("first.book");
        let second = dir.path().join("second.book");
        fs::write(&first, b"first").unwrap();
        fs::write(&second, b"second").unwrap();
        let (first_id, second_id) = {
            let mut initial = PathAuthority::open(registry.clone(), vec![]).unwrap();
            let first = initial.register_opening_book(&first, "first").unwrap();
            let second = initial.register_opening_book(&second, "second").unwrap();
            (first.id, second.id)
        };
        let disk_before = fs::read(&registry).unwrap();
        let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        assert!(authority
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![first_id.clone()],
                trusted_families: vec![PathOwnerFamily::OpeningBook],
            })
            .is_err());
        set_test_atomic_file_injector(None);
        assert!(authority.persistent.contains_key(&second_id.id));
        assert_eq!(fs::read(&registry).unwrap(), disk_before);
        assert!(!authority
            .completed_owner_families
            .contains(&PathOwnerFamily::OpeningBook));

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        let durability = authority
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![first_id.clone()],
                trusted_families: vec![PathOwnerFamily::OpeningBook],
            })
            .unwrap();
        set_test_atomic_file_injector(None);
        assert!(matches!(
            durability,
            CommitDurability::DurabilityUncertain(_)
        ));
        assert!(!authority.persistent.contains_key(&second_id.id));
        assert!(!authority
            .completed_owner_families
            .contains(&PathOwnerFamily::OpeningBook));
        assert_eq!(
            authority
                .reconcile_startup_owners(StartupPathOwners {
                    // The candidate was already adopted before the uncertain parent sync. This
                    // identical snapshot must retry the durability fence instead of reporting a
                    // no-op as durable without another replacement.
                    retained_ids: vec![first_id],
                    trusted_families: vec![PathOwnerFamily::OpeningBook],
                })
                .unwrap(),
            CommitDurability::Durable
        );
        assert!(authority
            .completed_owner_families
            .contains(&PathOwnerFamily::OpeningBook));
    }

    #[test]
    fn legacy_attachment_union_can_shrink_from_four_thousand_ninety_eight_ids() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let resource = dir.path().join("resource.nnue");
        fs::write(&resource, b"resource").unwrap();
        let template = Entry {
            stored: stored_entry_for(
                &resource,
                "legacy-0",
                Some(EntryPurpose::EngineResource),
                canonical_operations(EntryPurpose::EngineResource),
            ),
            availability: PathAvailability::Available,
        };
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        for index in 0..(MAX_AUTHORITY_IDS + 2) {
            let mut entry = template.clone();
            entry.stored.id.id = format!("legacy-{index}");
            authority
                .persistent
                .insert(entry.stored.id.id.clone(), entry);
        }
        authority.save().unwrap();
        let mut reopened = PathAuthority::open(registry.clone(), vec![]).unwrap();
        let all = reopened
            .persistent
            .keys()
            .map(|id| PathRef { id: id.clone() })
            .collect::<Vec<_>>();
        assert_eq!(all.len(), MAX_AUTHORITY_IDS + 2);
        reopened
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: all.clone(),
            })
            .unwrap();
        let retained = all[..MAX_AUTHORITY_IDS + 1].to_vec();
        reopened
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(retained.clone()),
                abandoned_ids: vec![],
                startup: false,
            })
            .unwrap();
        assert_eq!(reopened.persistent.len(), MAX_AUTHORITY_IDS + 1);
        let reloaded = PathAuthority::open(registry, vec![]).unwrap();
        assert_eq!(reloaded.persistent.len(), MAX_AUTHORITY_IDS + 1);
    }

    #[test]
    fn legacy_startup_owner_union_can_shrink_from_four_thousand_ninety_eight_ids() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let executable = dir.path().join("engine");
        fs::write(&executable, b"engine").unwrap();
        let template = Entry {
            stored: stored_entry_for(
                &executable,
                "legacy-engine-0",
                Some(EntryPurpose::EngineExecutable),
                canonical_operations(EntryPurpose::EngineExecutable),
            ),
            availability: PathAvailability::Available,
        };
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        for index in 0..(MAX_AUTHORITY_IDS + 2) {
            let mut entry = template.clone();
            entry.stored.id.id = format!("legacy-engine-{index}");
            authority
                .persistent
                .insert(entry.stored.id.id.clone(), entry);
        }
        authority.save().unwrap();
        let mut reopened = PathAuthority::open(registry.clone(), vec![]).unwrap();
        let retained = reopened
            .persistent
            .keys()
            .take(MAX_AUTHORITY_IDS + 1)
            .map(|id| PathRef { id: id.clone() })
            .collect::<Vec<_>>();
        reopened
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: retained,
                trusted_families: vec![PathOwnerFamily::Engines],
            })
            .unwrap();
        assert_eq!(reopened.persistent.len(), MAX_AUTHORITY_IDS + 1);
        let reloaded = PathAuthority::open(registry, vec![]).unwrap();
        assert_eq!(reloaded.persistent.len(), MAX_AUTHORITY_IDS + 1);
    }

    #[tokio::test]
    async fn active_image_issuance_lease_drains_before_cleanup() {
        let dir = tempfile::tempdir().unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let lease = authority.begin_engine_image_issuance().unwrap();
        let tracker = authority.active_image_issuances();
        authority.seal_engine_attachments();
        assert!(matches!(
            authority.begin_engine_image_issuance(),
            Err(Error::Conflict(_))
        ));
        assert!(
            tokio::time::timeout(Duration::from_millis(10), tracker.wait_for_zero())
                .await
                .is_err()
        );
        drop(lease);
        tokio::time::timeout(Duration::from_secs(1), tracker.wait_for_zero())
            .await
            .unwrap();
    }

    fn attachment_resource(authority: &mut PathAuthority, path: &Path) -> EngineResourceHandle {
        fs::write(path, b"resource").unwrap();
        let grant = authority
            .grant_dialog(
                path,
                "resource",
                PathClass::SingleDialogGrant,
                PathOperation::EngineResourceRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        authority
            .promote_engine_resource(&grant, EngineResourceHandleKind::File, "resource")
            .unwrap()
    }

    #[test]
    fn attachment_prepare_adopts_new_provisional_without_downgrading_reused_owned_id() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("network.nnue");
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let handle = attachment_resource(&mut authority, &path);
        assert!(authority.provisional_attachments.contains(&handle.id.id));
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![handle.id.clone()],
            })
            .unwrap();
        let reused = attachment_resource(&mut authority, &path);
        assert_eq!(reused.id, handle.id);
        assert!(!authority.provisional_attachments.contains(&handle.id.id));
        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![handle.id.clone()],
            })
            .unwrap();
        set_test_atomic_file_injector(None);
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![handle.id.clone()],
                startup: false,
            })
            .unwrap();
        assert!(authority.persistent.contains_key(&handle.id.id));
    }

    #[test]
    fn sealed_attachments_refuse_image_registration_and_resource_promotion_without_consumption() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let image_leaf = uuid::Uuid::new_v4().to_string();
        let (_, image_identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&image_leaf), |file| {
                file.write_all(b"image").map_err(Error::from)
            })
            .unwrap();
        let resource_path = dir.path().join("resource.nnue");
        fs::write(&resource_path, b"resource").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let grant = authority
            .grant_dialog(
                &resource_path,
                "resource",
                PathClass::SingleDialogGrant,
                PathOperation::EngineResourceRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        authority.save().unwrap();
        let before = fs::read(dir.path().join("registry.json")).unwrap();
        let persistent_before = authority.persistent.clone();
        let provisional_before = authority.provisional_attachments.clone();
        let retired_before = authority.retired_attachments.clone();
        let cleanup_before = authority.image_cleanup.clone();
        authority.seal_engine_attachments();

        assert!(matches!(
            authority.register_engine_image(
                &image_dir,
                OsStr::new(&image_leaf),
                image_identity,
                "image".into(),
            ),
            Err(Error::Conflict(_))
        ));
        assert!(matches!(
            authority.promote_engine_resource(&grant, EngineResourceHandleKind::File, "resource",),
            Err(Error::Conflict(_))
        ));
        assert_eq!(fs::read(dir.path().join("registry.json")).unwrap(), before);
        assert!(authority.persistent == persistent_before);
        assert_eq!(authority.provisional_attachments, provisional_before);
        assert!(authority.retired_attachments == retired_before);
        assert_eq!(authority.image_cleanup, cleanup_before);
        assert!(authority.dialogs.contains_key(&grant.id));
        assert!(image_dir.path().join(&image_leaf).exists());

        let book_path = dir.path().join("book.bin");
        fs::write(&book_path, b"book").unwrap();
        assert!(authority.register_opening_book(&book_path, "book").is_ok());
    }

    #[test]
    fn prepare_retry_reestablishes_uncertain_image_adoption_and_keeps_cleanup_cancelled() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = uuid::Uuid::new_v4().to_string();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let (_, identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&leaf), |file| {
                file.write_all(b"image").map_err(Error::from)
            })
            .unwrap();
        let image = authority
            .register_engine_image(&image_dir, OsStr::new(&leaf), identity, "image".into())
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            })
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: false,
            })
            .unwrap();
        assert!(authority.image_cleanup.contains_key(&image.id.id));
        let before_failed_prepare = fs::read(&registry).unwrap();

        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        assert!(authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            })
            .is_err());
        set_test_atomic_file_injector(None);
        assert_eq!(fs::read(&registry).unwrap(), before_failed_prepare);
        assert!(!authority.persistent.contains_key(&image.id.id));
        assert!(authority.retired_attachments.contains_key(&image.id.id));
        assert!(authority.image_cleanup.contains_key(&image.id.id));

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            }),
            Err(Error::CommittedDurabilityUncertain(_))
        ));
        set_test_atomic_file_injector(None);
        assert!(authority.persistent.contains_key(&image.id.id));
        assert!(!authority.retired_attachments.contains_key(&image.id.id));
        assert!(!authority.image_cleanup.contains_key(&image.id.id));
        assert!(authority.registry_durability_pending);

        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        assert!(authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            })
            .is_err());
        set_test_atomic_file_injector(None);
        assert!(authority.registry_durability_pending);

        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            })
            .unwrap();
        assert!(!authority.registry_durability_pending);
        assert!(image_dir.path().join(&leaf).exists());
        let reopened = PathAuthority::open(registry, vec![]).unwrap();
        assert!(reopened.persistent.contains_key(&image.id.id));
        assert!(reopened.image_cleanup.is_empty());
    }

    #[test]
    fn attachment_reconcile_retained_wins_and_retired_resource_resolves_only_this_session() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("network.nnue");
        let registry = dir.path().join("registry.json");
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let handle = attachment_resource(&mut authority, &path);
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![handle.id.clone()]),
                abandoned_ids: vec![handle.id.clone()],
                startup: false,
            })
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: false,
            })
            .unwrap();
        assert!(!authority.persistent.contains_key(&handle.id.id));
        assert!(authority
            .resolve(&handle.id, PathOperation::EngineResourceRead, &[])
            .is_ok());
        let mut reloaded = PathAuthority::open(registry, vec![]).unwrap();
        assert!(reloaded
            .resolve(&handle.id, PathOperation::EngineResourceRead, &[])
            .is_err());
        assert_eq!(fs::read(path).unwrap(), b"resource");
    }

    #[test]
    fn attachment_validation_and_loaded_provisional_startup_sweep_are_atomic() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("network.nnue");
        let registry = dir.path().join("registry.json");
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let handle = attachment_resource(&mut authority, &path);
        let before = fs::read(&registry).unwrap();
        let unknown = PathRef {
            id: "unknown".into(),
        };
        assert!(authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![unknown.clone()],
            })
            .is_err());
        assert_eq!(fs::read(&registry).unwrap(), before);
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![unknown],
                startup: false,
            })
            .unwrap();
        assert_eq!(fs::read(&registry).unwrap(), before);

        let ordinary_path = dir.path().join("ordinary.pgn");
        fs::write(&ordinary_path, b"*").unwrap();
        let ordinary = authority
            .migrate_legacy_os_path(
                ordinary_path.into_os_string(),
                "ordinary",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let before_nonattachment = fs::read(&registry).unwrap();
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![ordinary.id],
                startup: false,
            }),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(fs::read(&registry).unwrap(), before_nonattachment);

        drop(authority);
        let mut reloaded = PathAuthority::open(registry, vec![]).unwrap();
        reloaded
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: true,
            })
            .unwrap();
        assert!(!reloaded.persistent.contains_key(&handle.id.id));

        let fresh_path = dir.path().join("fresh.nnue");
        let fresh = attachment_resource(&mut reloaded, &fresh_path);
        reloaded
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: true,
            })
            .unwrap();
        assert!(reloaded.persistent.contains_key(&fresh.id.id));
    }

    #[test]
    fn attachment_action_validation_matrix_preserves_memory_and_disk() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let resource_path = dir.path().join("resource.nnue");
        let ordinary_path = dir.path().join("ordinary.pgn");
        fs::write(&ordinary_path, b"*").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let attachment = attachment_resource(&mut authority, &resource_path);
        let ordinary = authority
            .migrate_legacy_os_path(
                ordinary_path.into_os_string(),
                "ordinary",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let before = fs::read(&registry).unwrap();
        let persistent_before = authority.persistent.clone();
        let provisional_before = authority.provisional_attachments.clone();
        let retired_before = authority.retired_attachments.clone();
        let cleanup_before = authority.image_cleanup.clone();
        let assert_unchanged = |authority: &PathAuthority| {
            assert_eq!(fs::read(&registry).unwrap(), before);
            assert!(authority.persistent == persistent_before);
            assert_eq!(authority.provisional_attachments, provisional_before);
            assert!(authority.retired_attachments == retired_before);
            assert_eq!(authority.image_cleanup, cleanup_before);
        };
        let oversized = (0..=MAX_AUTHORITY_REQUEST_IDS)
            .map(|index| PathRef {
                id: format!("oversized-{index}"),
            })
            .collect::<Vec<_>>();
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: oversized.clone(),
            }),
            Err(Error::ResourceLimit(_))
        ));
        assert_unchanged(&authority);
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: oversized,
                startup: false,
            }),
            Err(Error::ResourceLimit(_))
        ));
        assert_unchanged(&authority);
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![],
                startup: true,
            }),
            Err(Error::ResourceLimit(_))
        ));
        assert_unchanged(&authority);
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![PathRef {
                    id: "unknown-retained".into(),
                }],
            }),
            Err(Error::InvalidInput(_))
        ));
        assert_unchanged(&authority);
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![ordinary.id.clone()],
            }),
            Err(Error::InvalidInput(_))
        ));
        assert_unchanged(&authority);
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![ordinary.id],
                startup: false,
            }),
            Err(Error::InvalidInput(_))
        ));
        assert_unchanged(&authority);
        assert!(authority.persistent.contains_key(&attachment.id.id));
    }

    #[test]
    fn attachment_abandon_only_retires_provisional_and_commit_boundaries_are_truthful() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("network.nnue");
        let registry = dir.path().join("registry.json");
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let handle = attachment_resource(&mut authority, &path);
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![handle.id.clone()],
                startup: false,
            })
            .unwrap();
        assert!(!authority.persistent.contains_key(&handle.id.id));
        assert!(authority.retired_attachments.contains_key(&handle.id.id));
        assert!(authority
            .resolve(&handle.id, PathOperation::EngineResourceRead, &[])
            .is_ok());

        let retry_path = dir.path().join("retry.nnue");
        let retry = attachment_resource(&mut authority, &retry_path);
        let before = fs::read(&registry).unwrap();
        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        assert!(authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![retry.id.clone()],
                startup: false,
            })
            .is_err());
        set_test_atomic_file_injector(None);
        assert!(authority.persistent.contains_key(&retry.id.id));
        assert!(authority.provisional_attachments.contains(&retry.id.id));
        assert!(!authority.retired_attachments.contains_key(&retry.id.id));
        assert_eq!(fs::read(&registry).unwrap(), before);

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![retry.id.clone()],
                startup: false,
            }),
            Err(Error::CommittedDurabilityUncertain(_))
        ));
        set_test_atomic_file_injector(None);
        assert!(!authority.persistent.contains_key(&retry.id.id));
        assert!(authority.retired_attachments.contains_key(&retry.id.id));
        assert!(!authority.provisional_attachments.contains(&retry.id.id));
        let reopened = PathAuthority::open(registry, vec![]).unwrap();
        assert!(!reopened.persistent.contains_key(&retry.id.id));
    }

    #[test]
    fn loaded_attachment_metadata_rejects_invalid_shapes_and_overlaps() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let resource = dir.path().join("resource.nnue");
        fs::write(&resource, b"resource").unwrap();
        let valid = stored_entry_for(
            &resource,
            "resource-id",
            Some(EntryPurpose::EngineResource),
            canonical_operations(EntryPurpose::EngineResource),
        );
        let mut invalid_provisional = serde_json::to_value(Registry {
            schema_version: SCHEMA_VERSION,
            entries: vec![valid.clone()],
            active_database_root: None,
            active_puzzle_root: None,
            active_engine_root: None,
            pending_artifacts: vec![],
            provisional_attachments: BTreeSet::from(["unknown".into()]),
            image_cleanup: vec![],
        })
        .unwrap();
        fs::write(&registry, serde_json::to_vec(&invalid_provisional).unwrap()).unwrap();
        assert!(matches!(
            PathAuthority::open(registry.clone(), vec![]),
            Err(Error::InvalidInput(_))
        ));

        let image_leaf = uuid::Uuid::new_v4().to_string();
        let image = dir.path().join(&image_leaf);
        fs::write(&image, b"image").unwrap();
        let cleanup = stored_entry_for(
            &image,
            "resource-id",
            Some(EntryPurpose::EngineImage),
            canonical_operations(EntryPurpose::EngineImage),
        );
        invalid_provisional["provisional_attachments"] = serde_json::json!([]);
        invalid_provisional["image_cleanup"] = serde_json::json!([cleanup]);
        invalid_provisional["entries"] = serde_json::json!([valid]);
        fs::write(&registry, serde_json::to_vec(&invalid_provisional).unwrap()).unwrap();
        assert!(matches!(
            PathAuthority::open(registry, vec![]),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn schema_one_legacy_attachments_without_lifecycle_fields_load_as_owned() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let resource_path = dir.path().join("resource.nnue");
        fs::write(&resource_path, b"resource").unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = uuid::Uuid::new_v4().to_string();
        let (_, identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&leaf), |file| {
                file.write_all(b"image").map_err(Error::from)
            })
            .unwrap();
        let (resource_id, image_id) = {
            let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
            let resource = attachment_resource(&mut authority, &resource_path);
            let image = authority
                .register_engine_image(&image_dir, OsStr::new(&leaf), identity, "image".into())
                .unwrap();
            (resource.id, image.id)
        };
        let mut legacy: serde_json::Value =
            serde_json::from_slice(&fs::read(&registry).unwrap()).unwrap();
        legacy
            .as_object_mut()
            .unwrap()
            .remove("provisional_attachments");
        legacy.as_object_mut().unwrap().remove("image_cleanup");
        for entry in legacy["entries"].as_array_mut().unwrap() {
            entry.as_object_mut().unwrap().remove("purpose");
        }
        fs::write(&registry, serde_json::to_vec(&legacy).unwrap()).unwrap();

        let mut reopened = PathAuthority::open(registry, vec![]).unwrap();
        assert!(reopened.persistent.contains_key(&resource_id.id));
        assert!(reopened.persistent.contains_key(&image_id.id));
        assert!(reopened.provisional_attachments.is_empty());
        reopened
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: None,
                abandoned_ids: vec![resource_id.clone(), image_id.clone()],
                startup: false,
            })
            .unwrap();
        assert!(reopened.persistent.contains_key(&resource_id.id));
        assert!(reopened.persistent.contains_key(&image_id.id));
        assert!(reopened.image_cleanup.is_empty());
        assert!(resource_path.exists());
        assert!(image_dir.path().join(&leaf).exists());
    }

    #[test]
    fn delayed_attachment_startup_preserves_fresh_prepared_reissued_and_used_handles() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let paths: Vec<_> = (0..3)
            .map(|index| dir.path().join(format!("resource-{index}.nnue")))
            .collect();
        for path in &paths {
            fs::write(path, b"resource").unwrap();
        }
        let loaded = {
            let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
            paths
                .iter()
                .map(|path| attachment_resource(&mut authority, path))
                .collect::<Vec<_>>()
        };
        let mut authority = PathAuthority::open(registry, vec![]).unwrap();
        let reissued = attachment_resource(&mut authority, &paths[1]);
        let fresh_path = dir.path().join("fresh.nnue");
        let fresh = attachment_resource(&mut authority, &fresh_path);
        let prepared_path = dir.path().join("prepared.nnue");
        let prepared = attachment_resource(&mut authority, &prepared_path);
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![prepared.id.clone()],
            })
            .unwrap();
        authority
            .resolve(&loaded[2].id, PathOperation::EngineResourceRead, &[])
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: true,
            })
            .unwrap();
        for id in [
            reissued.id.clone(),
            fresh.id.clone(),
            prepared.id.clone(),
            loaded[2].id.clone(),
        ] {
            assert!(authority.persistent.contains_key(&id.id));
        }
        assert!(!authority.persistent.contains_key(&loaded[0].id.id));
        assert!(authority.retired_attachments.contains_key(&loaded[0].id.id));
    }

    #[test]
    fn quota_first_prepare_then_empty_owner_reload_reclaims_only_unowned_attachments() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let resource_prepared_path = dir.path().join("prepared.nnue");
        let resource_owned_path = dir.path().join("owned.nnue");
        let executable_prepared_path = dir.path().join("prepared-engine");
        let executable_owned_path = dir.path().join("owned-engine");
        fs::write(&executable_prepared_path, b"prepared").unwrap();
        fs::write(&executable_owned_path, b"owned").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let prepared_resource = attachment_resource(&mut authority, &resource_prepared_path);
        let owned_resource = attachment_resource(&mut authority, &resource_owned_path);
        let prepared_leaf = uuid::Uuid::new_v4().to_string();
        let owned_leaf = uuid::Uuid::new_v4().to_string();
        let (_, prepared_identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&prepared_leaf), |file| {
                file.write_all(b"prepared image").map_err(Error::from)
            })
            .unwrap();
        let (_, owned_identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&owned_leaf), |file| {
                file.write_all(b"owned image").map_err(Error::from)
            })
            .unwrap();
        let prepared_image = authority
            .register_engine_image(
                &image_dir,
                OsStr::new(&prepared_leaf),
                prepared_identity,
                "prepared image".into(),
            )
            .unwrap();
        let owned_image = authority
            .register_engine_image(
                &image_dir,
                OsStr::new(&owned_leaf),
                owned_identity,
                "owned image".into(),
            )
            .unwrap();
        let prepared_executable = authority
            .get_or_create_persistent_file(
                &executable_prepared_path,
                "prepared engine",
                canonical_operations(EntryPurpose::EngineExecutable),
            )
            .unwrap();
        let owned_executable = authority
            .get_or_create_persistent_file(
                &executable_owned_path,
                "owned engine",
                canonical_operations(EntryPurpose::EngineExecutable),
            )
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![
                    prepared_resource.id.clone(),
                    owned_resource.id.clone(),
                    prepared_image.id.clone(),
                    owned_image.id.clone(),
                ],
            })
            .unwrap();
        let mut reopened = PathAuthority::open(registry, vec![]).unwrap();
        reopened
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![owned_resource.id.clone(), owned_image.id.clone()]),
                abandoned_ids: vec![],
                startup: true,
            })
            .unwrap();
        reopened
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![owned_executable.id.clone()],
                trusted_families: vec![PathOwnerFamily::Engines],
            })
            .unwrap();
        reopened.cleanup_engine_images(&image_dir, false).unwrap();
        assert!(!reopened.persistent.contains_key(&prepared_resource.id.id));
        assert!(!reopened.persistent.contains_key(&prepared_image.id.id));
        assert!(!reopened.persistent.contains_key(&prepared_executable.id.id));
        assert!(reopened.persistent.contains_key(&owned_resource.id.id));
        assert!(reopened.persistent.contains_key(&owned_image.id.id));
        assert!(reopened.persistent.contains_key(&owned_executable.id.id));
        assert!(resource_prepared_path.exists());
        assert!(image_dir.path().join(&owned_leaf).exists());
        assert!(!image_dir.path().join(&prepared_leaf).exists());
    }

    #[test]
    fn attachment_admission_counts_retired_ids_on_real_issue_and_abandon_paths() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("network.nnue");
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        for _ in 0..4 {
            let handle = attachment_resource(&mut authority, &path);
            authority
                .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                    retained_ids: None,
                    abandoned_ids: vec![handle.id],
                    startup: false,
                })
                .unwrap();
        }
        assert_eq!(authority.retired_attachments.len(), 4);

        let template = authority
            .retired_attachments
            .values()
            .next()
            .cloned()
            .expect("abandoning a real attachment must retain session resolution");
        for index in authority.retired_attachments.len()..MAX_AUTHORITY_IDS {
            let mut entry = template.clone();
            entry.stored.id.id = format!("retired-{index}");
            authority
                .retired_attachments
                .insert(entry.stored.id.id.clone(), entry);
        }
        let grant = authority
            .grant_dialog(
                &path,
                "resource",
                PathClass::SingleDialogGrant,
                PathOperation::EngineResourceRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        assert!(matches!(
            authority.promote_engine_resource(&grant, EngineResourceHandleKind::File, "resource",),
            Err(Error::ResourceLimit(_))
        ));
        assert!(!authority.dialogs.contains_key(&grant.id));
    }

    #[test]
    fn attachment_prepare_allows_non_growing_readoption_from_an_overlimit_legacy_state() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("network.nnue");
        fs::write(&path, b"resource").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let template = Entry {
            stored: stored_entry_for(
                &path,
                "persistent-0",
                Some(EntryPurpose::EngineResource),
                canonical_operations(EntryPurpose::EngineResource),
            ),
            availability: PathAvailability::Available,
        };
        for index in 0..MAX_AUTHORITY_IDS {
            let mut entry = template.clone();
            entry.stored.id.id = format!("persistent-{index}");
            authority
                .persistent
                .insert(entry.stored.id.id.clone(), entry);
        }
        let mut retired = template.clone();
        retired.stored.id.id = "retired-legacy".into();
        let retired_id = retired.stored.id.clone();
        authority
            .retired_attachments
            .insert(retired_id.id.clone(), retired);
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![retired_id.clone()],
            })
            .unwrap();
        assert_eq!(authority.persistent.len(), MAX_AUTHORITY_IDS + 1);
        assert!(!authority.retired_attachments.contains_key(&retired_id.id));
    }

    #[test]
    fn image_cleanup_keeps_intent_across_save_failure_and_completes_missing_retry() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = uuid::Uuid::new_v4().to_string();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let (_, identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&leaf), |file| {
                file.write_all(b"image").map_err(Error::from)
            })
            .unwrap();
        let image = authority
            .register_engine_image(&image_dir, OsStr::new(&leaf), identity, "image".into())
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            })
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: false,
            })
            .unwrap();
        assert!(authority.image_cleanup.contains_key(&image.id.id));

        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        assert!(authority.cleanup_engine_images(&image_dir, false).is_err());
        set_test_atomic_file_injector(None);
        assert!(authority.image_cleanup.contains_key(&image.id.id));
        assert!(!image_dir.path().join(&leaf).exists());

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "uncertain",
        ))));
        assert!(matches!(
            authority.cleanup_engine_images(&image_dir, false),
            Err(Error::CommittedDurabilityUncertain(_))
        ));
        set_test_atomic_file_injector(None);
        assert!(authority.image_cleanup.is_empty());
        drop(authority);
        let reopened = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(reopened.image_cleanup.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn image_cleanup_finishes_symlink_and_directory_substitutions_without_unlinking_them() {
        for directory_substitute in [false, true] {
            let dir = tempfile::tempdir().unwrap();
            let image_dir = ensure_app_owned_default_dir(
                &AppDataDir::for_test(dir.path()),
                AppOwnedDefaultRoot::EngineImages,
            )
            .unwrap();
            let leaf = uuid::Uuid::new_v4().to_string();
            let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
            let (_, identity) = image_dir
                .atomic_replace_leaf_identified(OsStr::new(&leaf), |file| {
                    file.write_all(b"image").map_err(Error::from)
                })
                .unwrap();
            let image = authority
                .register_engine_image(&image_dir, OsStr::new(&leaf), identity, "image".into())
                .unwrap();
            authority
                .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                    retained_ids: vec![image.id.clone()],
                })
                .unwrap();
            authority
                .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                    retained_ids: Some(vec![]),
                    abandoned_ids: vec![],
                    startup: false,
                })
                .unwrap();
            let path = image_dir.path().join(&leaf);
            fs::remove_file(&path).unwrap();
            if directory_substitute {
                fs::create_dir(&path).unwrap();
            } else {
                let target = dir.path().join("substitute");
                fs::write(&target, b"substitute").unwrap();
                std::os::unix::fs::symlink(&target, &path).unwrap();
            }
            authority.cleanup_engine_images(&image_dir, false).unwrap();
            assert!(authority.image_cleanup.is_empty());
            assert!(path.exists());
            assert_eq!(path.is_dir(), directory_substitute);
        }
    }

    #[cfg(unix)]
    #[test]
    fn image_cleanup_finishes_regular_file_inode_substitution_without_unlinking_it() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = uuid::Uuid::new_v4().to_string();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let (_, identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&leaf), |file| {
                file.write_all(b"image").map_err(Error::from)
            })
            .unwrap();
        let image = authority
            .register_engine_image(&image_dir, OsStr::new(&leaf), identity, "image".into())
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            })
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: false,
            })
            .unwrap();
        let path = image_dir.path().join(&leaf);
        let substitute = dir.path().join("substitute");
        fs::write(&substitute, b"substitute").unwrap();
        fs::remove_file(&path).unwrap();
        fs::rename(&substitute, &path).unwrap();
        authority.cleanup_engine_images(&image_dir, false).unwrap();
        assert!(authority.image_cleanup.is_empty());
        assert_eq!(fs::read(path).unwrap(), b"substitute");
    }

    #[test]
    fn image_cleanup_retains_intent_on_unrelated_io_failure() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = uuid::Uuid::new_v4().to_string();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let (_, identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&leaf), |file| {
                file.write_all(b"image").map_err(Error::from)
            })
            .unwrap();
        let image = authority
            .register_engine_image(&image_dir, OsStr::new(&leaf), identity, "image".into())
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            })
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: false,
            })
            .unwrap();
        let before = fs::read(&registry).unwrap();
        crate::infra::fs::set_test_removal_injector(Some(Arc::new(
            crate::infra::fs::RemovalFault(crate::infra::fs::RemovalFaultPoint::BeforeTopOpen),
        )));
        assert!(authority.cleanup_engine_images(&image_dir, false).is_err());
        crate::infra::fs::set_test_removal_injector(None);
        assert!(authority.image_cleanup.contains_key(&image.id.id));
        assert!(image_dir.path().join(&leaf).exists());
        assert_eq!(fs::read(&registry).unwrap(), before);
    }

    #[test]
    fn empty_image_cleanup_does_not_write_under_injected_failure() {
        let dir = tempfile::tempdir().unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        authority.save().unwrap();
        let registry = dir.path().join("registry.json");
        let before = fs::read(&registry).unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        set_test_atomic_file_injector(Some(Arc::new(AlwaysIo)));
        assert!(authority.cleanup_engine_images(&image_dir, false).is_ok());
        set_test_atomic_file_injector(None);
        assert_eq!(fs::read(registry).unwrap(), before);
    }

    #[test]
    fn image_cleanup_occupancy_counts_against_new_attachment_issuance() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let leaf = uuid::Uuid::new_v4().to_string();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let (_, identity) = image_dir
            .atomic_replace_leaf_identified(OsStr::new(&leaf), |file| {
                file.write_all(b"image").map_err(Error::from)
            })
            .unwrap();
        let image = authority
            .register_engine_image(&image_dir, OsStr::new(&leaf), identity, "image".into())
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![image.id.clone()],
            })
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: false,
            })
            .unwrap();
        let template = authority.image_cleanup.values().next().cloned().unwrap();
        for index in authority.image_cleanup.len()..MAX_AUTHORITY_IDS {
            let mut entry = template.clone();
            entry.id.id = format!("cleanup-{index}");
            authority.image_cleanup.insert(entry.id.id.clone(), entry);
        }
        let resource_path = dir.path().join("resource.nnue");
        fs::write(&resource_path, b"resource").unwrap();
        let grant = authority
            .grant_dialog(
                &resource_path,
                "resource",
                PathClass::SingleDialogGrant,
                PathOperation::EngineResourceRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        assert!(matches!(
            authority.promote_engine_resource(&grant, EngineResourceHandleKind::File, "resource",),
            Err(Error::ResourceLimit(_))
        ));
        assert!(!authority.dialogs.contains_key(&grant.id));
    }

    #[test]
    fn managed_image_cleanup_deletes_only_matching_uuid_leaf_and_preserves_retained_image() {
        let dir = tempfile::tempdir().unwrap();
        let image_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(dir.path()),
            AppOwnedDefaultRoot::EngineImages,
        )
        .unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let issue = |authority: &mut PathAuthority, leaf: &str| {
            let (_, identity) = image_dir
                .atomic_replace_leaf_identified(OsStr::new(leaf), |file| {
                    file.write_all(b"image").map_err(Error::from)
                })
                .unwrap();
            authority
                .register_engine_image(&image_dir, OsStr::new(leaf), identity, leaf.into())
                .unwrap()
        };
        let retired_leaf = uuid::Uuid::new_v4().to_string();
        let retained_leaf = uuid::Uuid::new_v4().to_string();
        let retired = issue(&mut authority, &retired_leaf);
        let retained = issue(&mut authority, &retained_leaf);
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![retired.id.clone(), retained.id.clone()],
            })
            .unwrap();
        authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![retained.id.clone()]),
                abandoned_ids: vec![],
                startup: false,
            })
            .unwrap();
        assert!(image_dir.path().join(&retired_leaf).exists());
        authority.cleanup_engine_images(&image_dir, false).unwrap();
        assert!(!image_dir.path().join(&retired_leaf).exists());
        assert!(image_dir.path().join(&retained_leaf).exists());
        assert!(authority.image_cleanup.is_empty());
        authority.cleanup_engine_images(&image_dir, true).unwrap();
        assert!(matches!(
            authority.reconcile_engine_attachments(EngineAttachmentAction::Prepare {
                retained_ids: vec![retained.id]
            }),
            Err(Error::Conflict(_))
        ));
    }
}

#[cfg(unix)]
#[cfg(test)]
mod workspace_directory_enumeration_tests {
    use super::*;
    use crate::infra::blocking::source_scan::body_at_indent;
    use crate::infra::path_authority::{
        set_capability_child_pre_open_hook, set_capability_directory_post_entries_hook,
        set_workspace_metadata_post_open_hook, set_workspace_metadata_pre_open_hook, SystemClock,
    };
    use std::sync::atomic::{AtomicBool, Ordering};

    fn root_fixture(path: &Path) -> (tempfile::TempDir, PathAuthority, PathRef) {
        let directory = tempfile::tempdir().unwrap();
        if !path.exists() {
            fs::create_dir_all(path).unwrap();
        }
        let mut authority = PathAuthority::open_with_clock(
            directory.path().join("registry.json"),
            vec![],
            std::sync::Arc::new(SystemClock),
            2,
        )
        .unwrap();
        let id = authority
            .migrate_legacy_os_path(
                path.to_path_buf().into_os_string(),
                "root",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn],
            )
            .unwrap()
            .id;
        (directory, authority, id)
    }
    #[test]
    fn capability_child_open_refuses_a_symlink_swap() {
        use std::os::unix::fs::symlink;
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("root");
        let child = root.join("child");
        let outside = directory.path().join("outside");
        fs::create_dir_all(&child).unwrap();
        fs::create_dir(&outside).unwrap();
        let (_registry, mut authority, id) = root_fixture(&root);
        let capability = authority
            .capability_directory(&id, PathOperation::ReadPgn)
            .unwrap();
        let entry = capability
            .entries(&CancellationToken::new(), &mut |_| true)
            .unwrap()
            .into_iter()
            .find(|entry| entry.name == "child")
            .unwrap();
        let old = root.join("child-old");
        let child_for_hook = child.clone();
        set_capability_child_pre_open_hook(Some(Box::new(move || {
            fs::rename(&child_for_hook, &old).unwrap();
            symlink(&outside, &child_for_hook).unwrap();
        })));
        let result = capability.open_child_directory(&entry);
        set_capability_child_pre_open_hook(None);
        assert!(matches!(result, Err(Error::Conflict(_))));
    }

    #[test]
    fn capability_child_open_refuses_a_directory_swap() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("root");
        let child = root.join("child");
        fs::create_dir_all(&child).unwrap();
        let (_registry, mut authority, id) = root_fixture(&root);
        let capability = authority
            .capability_directory(&id, PathOperation::ReadPgn)
            .unwrap();
        let entry = capability
            .entries(&CancellationToken::new(), &mut |_| true)
            .unwrap()
            .into_iter()
            .find(|entry| entry.name == "child")
            .unwrap();
        let old = root.join("child-old");
        let child_for_hook = child.clone();
        set_capability_child_pre_open_hook(Some(Box::new(move || {
            fs::rename(&child_for_hook, &old).unwrap();
            fs::create_dir(&child_for_hook).unwrap();
        })));
        let result = capability.open_child_directory(&entry);
        set_capability_child_pre_open_hook(None);
        assert!(matches!(result, Err(Error::Conflict(_))));
    }

    #[test]
    fn capability_child_open_refuses_a_file_swap_and_a_removal() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("root");
        let child = root.join("child");
        fs::create_dir_all(&child).unwrap();
        let (_registry, mut authority, id) = root_fixture(&root);
        let capability = authority
            .capability_directory(&id, PathOperation::ReadPgn)
            .unwrap();
        let entry = capability
            .entries(&CancellationToken::new(), &mut |_| true)
            .unwrap()
            .into_iter()
            .find(|entry| entry.name == "child")
            .unwrap();
        fs::remove_dir(&child).unwrap();
        fs::write(&child, b"file").unwrap();
        assert!(matches!(
            capability.open_child_directory(&entry),
            Err(Error::Conflict(_))
        ));
        fs::remove_file(&child).unwrap();
        assert!(matches!(
            capability.open_child_directory(&entry),
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn metadata_sidecar_is_read_from_the_enumerated_directory() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("root");
        fs::create_dir(&root).unwrap();
        let sub = root.join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("a.pgn"), b"*").unwrap();
        fs::write(sub.join("a.info"), b"trusted").unwrap();
        let (_registry, mut authority, id) = root_fixture(&root);
        let root_capability = authority
            .capability_directory(&id, PathOperation::ReadPgn)
            .unwrap();
        let sub_entry = root_capability
            .entries(&CancellationToken::new(), &mut |name| {
                name == OsStr::new("sub")
            })
            .unwrap()
            .pop()
            .unwrap();
        let capability = root_capability.open_child_directory(&sub_entry).unwrap();
        let entry = capability
            .entries(&CancellationToken::new(), &mut |name| {
                name == OsStr::new("a.pgn")
            })
            .unwrap()
            .pop()
            .unwrap();
        let moved = directory.path().join("moved");
        fs::rename(&sub, &moved).unwrap();
        fs::create_dir(&sub).unwrap();
        fs::hard_link(moved.join("a.pgn"), sub.join("a.pgn")).unwrap();
        fs::write(sub.join("a.info"), b"attacker").unwrap();
        let mut sidecar = capability.open_metadata_sidecar(&entry).unwrap().unwrap();
        let mut bytes = Vec::new();
        sidecar.read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes, b"trusted");
    }

    #[test]
    fn metadata_sidecar_refuses_a_pgn_replaced_before_the_sidecar_open() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("root");
        fs::create_dir(&root).unwrap();
        let pgn = root.join("a.pgn");
        let info = root.join("a.info");
        fs::write(&pgn, b"*").unwrap();
        fs::write(&info, b"trusted").unwrap();
        let (_registry, mut authority, id) = root_fixture(&root);
        let capability = authority
            .capability_directory(&id, PathOperation::ReadPgn)
            .unwrap();
        let entry = capability
            .entries(&CancellationToken::new(), &mut |name| {
                name == OsStr::new("a.pgn")
            })
            .unwrap()
            .pop()
            .unwrap();
        let post = std::sync::Arc::new(AtomicBool::new(false));
        let post_observed = std::sync::Arc::clone(&post);
        set_workspace_metadata_post_open_hook(Some(Box::new(move |_| {
            post_observed.store(true, Ordering::SeqCst);
        })));
        let pgn_for_hook = pgn.clone();
        let info_for_hook = info.clone();
        set_workspace_metadata_pre_open_hook(Some(Box::new(move || {
            fs::rename(&pgn_for_hook, root.join("old.pgn")).unwrap();
            fs::write(&pgn_for_hook, b"replacement").unwrap();
            fs::rename(&info_for_hook, root.join("old.info")).unwrap();
            fs::write(&info_for_hook, b"attacker").unwrap();
        })));
        let result = capability.open_metadata_sidecar(&entry);
        set_workspace_metadata_pre_open_hook(None);
        set_workspace_metadata_post_open_hook(None);
        assert!(matches!(result, Err(Error::Conflict(_))));
        assert!(post.load(Ordering::SeqCst));
    }

    #[derive(Clone, Copy)]
    enum Db3ListingKind {
        Database,
        Puzzle,
    }

    enum Db3RootHandle {
        Database(DatabaseRootHandle),
        Puzzle(PuzzleRootHandle),
    }

    #[derive(Clone, Copy)]
    enum Db3Replacement {
        RegularFile,
        Directory,
    }

    fn db3_root_fixture(
        kind: Db3ListingKind,
    ) -> (tempfile::TempDir, PathBuf, PathAuthority, Db3RootHandle) {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join(match kind {
            Db3ListingKind::Database => "databases",
            Db3ListingKind::Puzzle => "puzzles",
        });
        fs::create_dir(&root).unwrap();
        fs::write(root.join("a.db3"), b"old").unwrap();
        let mut authority = PathAuthority::open_with_clock(
            directory.path().join("registry.json"),
            vec![],
            std::sync::Arc::new(SystemClock),
            2,
        )
        .unwrap();
        let root_handle = match kind {
            Db3ListingKind::Database => Db3RootHandle::Database(
                authority
                    .get_or_create_database_root(&root, "Databases", None)
                    .unwrap(),
            ),
            Db3ListingKind::Puzzle => Db3RootHandle::Puzzle(
                authority
                    .get_or_create_puzzle_root(&root, "Puzzles", None)
                    .unwrap(),
            ),
        };
        (directory, root, authority, root_handle)
    }

    fn assert_db3_listing_refuses_replacement(
        kind: Db3ListingKind,
        replacement_kind: Db3Replacement,
    ) {
        let (_directory, root, mut authority, root_handle) = db3_root_fixture(kind);
        let child = root.join("a.db3");
        let before = authority.persistent_snapshot_for_test();
        let child_for_hook = child.clone();
        set_capability_directory_post_entries_hook(Some(Box::new(
            move || match replacement_kind {
                Db3Replacement::RegularFile => {
                    let replacement = child_for_hook.with_extension("replacement");
                    fs::write(&replacement, b"replacement").unwrap();
                    fs::rename(&replacement, &child_for_hook).unwrap();
                }
                Db3Replacement::Directory => {
                    fs::rename(&child_for_hook, child_for_hook.with_extension("old")).unwrap();
                    fs::create_dir(&child_for_hook).unwrap();
                }
            },
        )));
        let result = match root_handle {
            Db3RootHandle::Database(root) => authority
                .list_database_children_cancellable(&root, &CancellationToken::new())
                .map(|_| ()),
            Db3RootHandle::Puzzle(root) => authority
                .list_puzzle_children_cancellable(&root, &CancellationToken::new())
                .map(|_| ()),
        };
        set_capability_directory_post_entries_hook(None);
        assert!(matches!(result, Err(Error::Conflict(_))), "{result:?}");
        assert_eq!(authority.persistent_snapshot_for_test(), before);
    }

    #[test]
    fn database_listing_refuses_a_db3_replaced_after_enumeration() {
        assert_db3_listing_refuses_replacement(
            Db3ListingKind::Database,
            Db3Replacement::RegularFile,
        );
    }

    #[test]
    fn puzzle_listing_refuses_a_db3_replaced_after_enumeration() {
        assert_db3_listing_refuses_replacement(Db3ListingKind::Puzzle, Db3Replacement::RegularFile);
    }

    #[test]
    fn database_listing_refuses_a_db3_replaced_by_a_directory() {
        assert_db3_listing_refuses_replacement(Db3ListingKind::Database, Db3Replacement::Directory);
    }

    #[test]
    fn enumeration_consumers_use_no_direct_pathname_producer() {
        let sources = [
            (
                include_str!("mod.rs"),
                concat!("fn map_db3_children_cancellable", "<T>("),
            ),
            (
                include_str!("mod.rs"),
                concat!("pub(crate) fn open_child_directory(", "\n        &self"),
            ),
            (
                include_str!("mod.rs"),
                concat!("pub(crate) fn confirm_entry", "(&self"),
            ),
            (
                include_str!("mod.rs"),
                concat!("pub(crate) fn open_metadata_sidecar(", "\n        &self"),
            ),
            (
                include_str!("../fs.rs"),
                concat!("pub(crate) fn read_directory_entries_at(", "\n    dir:"),
            ),
            (
                include_str!("../../file_workspace.rs"),
                concat!("fn collect_tree_entries(", "\n    pgn_path_authority"),
            ),
            (
                include_str!("../../file_workspace.rs"),
                concat!("fn metadata_from(", "\n    directory"),
            ),
        ];
        let forbidden = [
            "Path::",
            "&Path",
            "PathBuf",
            "std::fs",
            "fs::metadata(",
            "fs::read(",
            "File::open",
            "OpenOptions",
            "timestamp(",
            "workspace_root(",
            "workspace_components(",
            "canonicalize",
            ".exists(",
            ".is_file(",
            ".is_dir(",
            "symlink_metadata",
            "read_dir(",
        ];
        for (source, signature) in sources {
            let body = body_at_indent(source, signature);
            for token in forbidden {
                if signature.starts_with("fn map_db3") && token == "Path::" {
                    assert_eq!(body.matches(token).count(), 1);
                } else {
                    assert!(!body.contains(token), "{signature} contains {token}");
                }
            }
        }
    }

    #[test]
    fn database_and_puzzle_listing_skip_symlinked_and_non_db3_and_keep_order() {
        #[cfg(not(target_os = "macos"))]
        use std::os::unix::ffi::{OsStrExt, OsStringExt};
        use std::os::unix::fs::symlink;
        let directory = tempfile::tempdir().unwrap();
        let database_path = directory.path().join("databases");
        let puzzle_path = directory.path().join("puzzles");
        fs::create_dir(&database_path).unwrap();
        fs::create_dir(&puzzle_path).unwrap();
        for root in [&database_path, &puzzle_path] {
            fs::write(root.join("b.db3"), b"b").unwrap();
            fs::write(root.join("a.db3"), b"a").unwrap();
            fs::write(root.join("C.db3"), b"C").unwrap();
            // APFS cannot store non-UTF-8 file names
            #[cfg(not(target_os = "macos"))]
            {
                let first = OsString::from_vec(b"\x81.db3".to_vec());
                let second = OsString::from_vec(b"\x80_.db3".to_vec());
                fs::write(root.join(&first), b"first").unwrap();
                fs::write(root.join(&second), b"second").unwrap();
                let raw_cmp = first.as_bytes().cmp(second.as_bytes());
                let lossy_cmp = first.to_string_lossy().cmp(&second.to_string_lossy());
                assert_ne!(raw_cmp, lossy_cmp);
            }
            fs::write(root.join("notes.txt"), b"notes").unwrap();
            symlink(root.join("a.db3"), root.join("d.db3")).unwrap();
        }
        let mut authority = PathAuthority::open_with_clock(
            directory.path().join("registry.json"),
            vec![],
            std::sync::Arc::new(SystemClock),
            2,
        )
        .unwrap();
        let database = authority
            .get_or_create_database_root(&database_path, "Databases", None)
            .unwrap();
        let puzzle = authority
            .get_or_create_puzzle_root(&puzzle_path, "Puzzles", None)
            .unwrap();
        let databases = authority
            .list_database_children_cancellable(&database, &CancellationToken::new())
            .unwrap();
        let puzzles = authority
            .list_puzzle_children_cancellable(&puzzle, &CancellationToken::new())
            .unwrap();
        // APFS cannot store non-UTF-8 file names
        #[cfg(not(target_os = "macos"))]
        let expected = ["C.db3", "a.db3", "b.db3", "�.db3", "�_.db3"];
        #[cfg(target_os = "macos")]
        let expected = ["C.db3", "a.db3", "b.db3"];
        assert_eq!(
            databases
                .iter()
                .map(|entry| entry.filename.as_str())
                .collect::<Vec<_>>(),
            expected
        );
        assert_eq!(
            puzzles
                .iter()
                .map(|entry| entry.filename.as_str())
                .collect::<Vec<_>>(),
            expected
        );
    }

    #[test]
    fn database_listing_cancels_after_an_empty_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("databases");
        fs::create_dir(&root).unwrap();
        fs::write(root.join("notes.txt"), b"notes").unwrap();
        let mut authority = PathAuthority::open_with_clock(
            directory.path().join("registry.json"),
            vec![],
            std::sync::Arc::new(SystemClock),
            2,
        )
        .unwrap();
        let root_handle = authority
            .get_or_create_database_root(&root, "Databases", None)
            .unwrap();
        let token = CancellationToken::new();
        let cancel = token.clone();
        set_capability_directory_post_entries_hook(Some(Box::new(move || cancel.cancel())));
        let result = authority.list_database_children_cancellable(&root_handle, &token);
        set_capability_directory_post_entries_hook(None);
        assert!(matches!(result, Err(Error::Cancellation)), "{result:?}");
    }

    #[test]
    fn capability_directory_methods_refuse_non_leaf_names() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("root");
        fs::create_dir(&root).unwrap();
        fs::write(root.join("safe"), b"safe").unwrap();
        let sibling = directory.path().join("sibling");
        fs::write(&sibling, b"untouched").unwrap();
        let (_registry, mut authority, id) = root_fixture(&root);
        let capability = authority
            .capability_directory(&id, PathOperation::ReadPgn)
            .unwrap();
        let regular = DirectoryEntry {
            name: OsString::from("safe"),
            kind: DirectoryEntryKind::RegularFile,
            identity: (0, 0),
            modified_seconds: 0,
        };
        assert!(matches!(
            capability.open_child_directory(&regular),
            Err(Error::InvalidInput(_))
        ));
        for name in ["..", "a/b", "/abs", ""] {
            let entry = DirectoryEntry {
                name: OsString::from(name),
                kind: DirectoryEntryKind::RegularFile,
                identity: (0, 0),
                modified_seconds: 0,
            };
            assert!(matches!(
                capability.open_child_directory(&entry),
                Err(Error::InvalidInput(_))
            ));
            assert!(matches!(
                capability.confirm_entry(&entry),
                Err(Error::InvalidInput(_))
            ));
            assert!(matches!(
                capability.open_metadata_sidecar(&entry),
                Err(Error::InvalidInput(_))
            ));
        }
        assert_eq!(fs::read(sibling).unwrap(), b"untouched");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_root_initialization_holds_a_private_locked_instance() {
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let instance = root.instance_path();
        let launch_dir = instance.parent().unwrap();
        let lock = launch_dir
            .read_dir()
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .find(|path| {
                path.extension()
                    .is_some_and(|extension| extension == "lock")
            })
            .unwrap();
        assert_eq!(
            launch_dir.metadata().unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            instance.metadata().unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            lock.metadata().unwrap().permissions().mode() & 0o777,
            ENGINE_LAUNCH_LOCK_MODE
        );

        let competing = std::fs::File::open(lock).unwrap();
        assert!(matches!(
            rustix::fs::flock(
                &competing,
                rustix::fs::FlockOperation::NonBlockingLockExclusive
            ),
            Err(error)
                if error == rustix::io::Errno::AGAIN
                    || error == rustix::io::Errno::WOULDBLOCK
        ));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_lock_is_locked_before_a_competing_sweep() {
        use std::sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        };

        let directory = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(directory.path());
        let ran = Arc::new(AtomicBool::new(false));
        let ran_in_hook = ran.clone();
        set_engine_launch_lock_created_hook(Some(Box::new(move || {
            ran_in_hook.store(true, Ordering::SeqCst);
            let root =
                ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::EngineLaunch).unwrap();
            assert!(!root.path().read_dir().unwrap().any(|entry| entry
                .unwrap()
                .file_type()
                .unwrap()
                .is_dir()));
            sweep_engine_launch_root(&root, OsStr::new("not-own.lock"), OsStr::new("not-own"))
                .unwrap();
        })));
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        set_engine_launch_lock_created_hook(None);

        assert!(ran.load(Ordering::SeqCst));
        assert!(root.instance_path().is_dir());
        assert!(root
            .instance_path()
            .parent()
            .unwrap()
            .read_dir()
            .unwrap()
            .any(|entry| entry
                .unwrap()
                .path()
                .extension()
                .is_some_and(|extension| extension == "lock")));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_sweep_reclaims_only_unowned_siblings() {
        let directory = tempfile::tempdir().unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let instance = root.instance_path();
        let launch_dir = instance.parent().unwrap();
        let own_id = instance.file_name().unwrap().to_os_string();
        let own_lock = OsString::from(format!("{}.lock", own_id.to_string_lossy()));

        let free_id = OsString::from("free-sibling");
        fs::create_dir(launch_dir.join(&free_id)).unwrap();
        fs::write(launch_dir.join(&free_id).join("payload"), b"payload").unwrap();
        fs::write(
            launch_dir.join(format!("{}.lock", free_id.to_string_lossy())),
            b"",
        )
        .unwrap();

        let held_id = OsString::from("held-sibling");
        fs::create_dir(launch_dir.join(&held_id)).unwrap();
        let held_lock_path = launch_dir.join(format!("{}.lock", held_id.to_string_lossy()));
        fs::write(&held_lock_path, b"").unwrap();
        let held_lock = std::fs::File::open(&held_lock_path).unwrap();
        rustix::fs::flock(&held_lock, rustix::fs::FlockOperation::LockExclusive).unwrap();

        let orphan_dir = OsString::from("orphan-directory");
        fs::create_dir(launch_dir.join(&orphan_dir)).unwrap();
        let orphan_lock = OsString::from("orphan-lock");
        fs::write(
            launch_dir.join(format!("{}.lock", orphan_lock.to_string_lossy())),
            b"",
        )
        .unwrap();

        let root_dir = ensure_app_owned_default_dir(
            &AppDataDir::for_test(directory.path()),
            AppOwnedDefaultRoot::EngineLaunch,
        )
        .unwrap();
        sweep_engine_launch_root(&root_dir, &own_lock, &own_id).unwrap();

        assert!(!launch_dir.join(&free_id).exists());
        assert!(!launch_dir
            .join(format!("{}.lock", free_id.to_string_lossy()))
            .exists());
        assert!(launch_dir.join(&held_id).exists());
        assert!(held_lock_path.exists());
        assert!(!launch_dir.join(&orphan_dir).exists());
        assert!(!launch_dir
            .join(format!("{}.lock", orphan_lock.to_string_lossy()))
            .exists());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_materialization_uses_the_held_source_descriptor() {
        let directory = tempfile::tempdir().unwrap();
        let source_path = directory.path().join("source");
        fs::write(&source_path, b"authorized").unwrap();
        let source = fs::File::open(&source_path).unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let mut leaf = root
            .reserve_leaves(1, "test:engine", "engine-id")
            .unwrap()
            .pop()
            .unwrap();

        fs::rename(&source_path, directory.path().join("source-original")).unwrap();
        fs::write(&source_path, b"replacement").unwrap();
        leaf.create_from(&source, ENGINE_RESOURCE_LEAF_MODE, &|| false)
            .unwrap();
        assert_eq!(fs::read(leaf.path()).unwrap(), b"authorized");
        drop(leaf);
        let report = root.reclaim();
        assert_eq!(report.removed, 1);
        assert!(report.failed.is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_clone_seam_runs_after_descriptor_acquisition() {
        let directory = tempfile::tempdir().unwrap();
        let source_path = directory.path().join("source");
        fs::write(&source_path, b"authorized").unwrap();
        let source = fs::File::open(&source_path).unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let mut leaf = root
            .reserve_leaves(1, "test:engine", "engine-id")
            .unwrap()
            .pop()
            .unwrap();
        let replacement = source_path.clone();
        let swapped = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let swapped_in_hook = swapped.clone();
        set_engine_launch_before_clone_hook(
            "test:engine",
            Some(Box::new(move || {
                fs::rename(&replacement, replacement.with_extension("original")).unwrap();
                fs::write(&replacement, b"replacement").unwrap();
                swapped_in_hook.store(true, std::sync::atomic::Ordering::SeqCst);
            })),
        );
        leaf.create_from(&source, ENGINE_RESOURCE_LEAF_MODE, &|| false)
            .unwrap();
        set_engine_launch_before_clone_hook("test:engine", None);
        // The descriptor was opened before the swap, so the bytes below read `authorized`
        // whether or not the hook fired. Without this the test proves nothing about the seam.
        assert!(
            swapped.load(std::sync::atomic::Ordering::SeqCst),
            "the before-clone hook armed for test:engine never ran, so no swap was staged"
        );
        assert_eq!(fs::read(leaf.path()).unwrap(), b"authorized");
        drop(leaf);
        assert_eq!(root.reclaim().removed, 1);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_reservation_counts_overlapping_leaves() {
        let directory = tempfile::tempdir().unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let first = root.reserve_leaves(64, "test:first", "first").unwrap();
        assert!(matches!(
            root.reserve_leaves(1, "test:second", "second"),
            Err(Error::ResourceLimit(message)) if message == "engine launch leaf limit reached"
        ));
        assert_eq!(root.registry_snapshot_for_test().0, 64);
        drop(first);
        assert_eq!(root.registry_snapshot_for_test().0, 0);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_clone_fallback_exdev_and_enotsup_preserve_authorized_bytes() {
        use std::os::unix::fs::PermissionsExt;

        for failure in [
            EngineLaunchFailure::CloneExdev,
            EngineLaunchFailure::CloneEnotsup,
        ] {
            let directory = tempfile::tempdir().unwrap();
            let source_path = directory.path().join("source");
            fs::write(&source_path, b"authorized-fallback-bytes").unwrap();
            fs::set_permissions(&source_path, fs::Permissions::from_mode(0o444)).unwrap();
            let source = fs::File::open(&source_path).unwrap();
            let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
            let mut leaf = root
                .reserve_leaves(1, "test:fallback", "fallback-engine")
                .unwrap()
                .pop()
                .unwrap();
            set_engine_launch_failure("test:fallback", Some(failure));
            leaf.create_from(&source, ENGINE_RESOURCE_LEAF_MODE, &|| false)
                .unwrap();
            // An unconsumed injection means the clone simply succeeded, and the assertions
            // below would then pass without the fallback ever being exercised.
            assert!(
                ENGINE_LAUNCH_FAILURES
                    .take(&"test:fallback".to_owned())
                    .is_none(),
                "the injected {failure:?} was never consumed, so no fallback was exercised"
            );
            assert_eq!(fs::read(leaf.path()).unwrap(), b"authorized-fallback-bytes");
            assert_eq!(
                fs::metadata(leaf.path()).unwrap().permissions().mode() & 0o777,
                ENGINE_RESOURCE_LEAF_MODE
            );
            drop(leaf);
            assert_eq!(root.reclaim().removed, 1);
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_removes_entries_after_copy_fchmod_and_cancellation_failures() {
        fn run_failure(failure: EngineLaunchFailure, cancelled: impl Fn() -> bool) {
            let directory = tempfile::tempdir().unwrap();
            let source_path = directory.path().join("source");
            fs::write(&source_path, vec![b'x'; 128 * 1024]).unwrap();
            let source = fs::File::open(&source_path).unwrap();
            let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
            let mut leaf = root
                .reserve_leaves(1, "test:failure", "failure-engine")
                .unwrap()
                .pop()
                .unwrap();
            set_engine_launch_failure("test:failure", Some(failure));
            let result = leaf.create_from(&source, ENGINE_RESOURCE_LEAF_MODE, &cancelled);
            assert!(
                ENGINE_LAUNCH_FAILURES
                    .take(&"test:failure".to_owned())
                    .is_none(),
                "the injected {failure:?} was never consumed, so no failure path was exercised"
            );
            match (failure, result) {
                (EngineLaunchFailure::Copy, Err(Error::Io(error))) => assert!(error
                    .to_string()
                    .contains("injected engine launch copy failure")),
                (EngineLaunchFailure::Fchmod, Err(Error::Io(error))) => assert!(error
                    .to_string()
                    .contains("injected engine launch fchmod failure")),
                (EngineLaunchFailure::CloneExdev, Err(Error::Cancellation)) => {}
                (failure, result) => {
                    panic!("unexpected engine launch failure result for {failure:?}: {result:?}")
                }
            }
            assert!(
                leaf.path().exists(),
                "the failed materialization must have created its leaf before cleanup"
            );
            assert!(leaf.remove().is_ok());
            assert_eq!(root.registry_snapshot_for_test().0, 0);
            assert!(root.instance_path().read_dir().unwrap().next().is_none());
        }

        run_failure(EngineLaunchFailure::Copy, || false);
        run_failure(EngineLaunchFailure::Fchmod, || false);
        let checks = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let checks_for_cancel = checks.clone();
        run_failure(EngineLaunchFailure::CloneExdev, move || {
            checks_for_cancel.fetch_add(1, std::sync::atomic::Ordering::SeqCst) >= 2
        });
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn dropping_an_engine_launch_leaf_only_registers_it_for_later_reclaim() {
        let directory = tempfile::tempdir().unwrap();
        let source_path = directory.path().join("source");
        fs::write(&source_path, b"bytes").unwrap();
        let source = fs::File::open(&source_path).unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let mut leaf = root
            .reserve_leaves(1, "test:drop", "drop-engine")
            .unwrap()
            .pop()
            .unwrap();
        leaf.create_from(&source, ENGINE_RESOURCE_LEAF_MODE, &|| false)
            .unwrap();
        let path = leaf.path();
        drop(leaf);
        assert!(path.exists());
        let (live, released) = root.registry_snapshot_for_test();
        assert_eq!(live, 1);
        assert_eq!(released.len(), 1);
        assert_eq!(released[0].engine_key, "test:drop");
        assert_eq!(released[0].engine_id, "drop-engine");
        assert_eq!(root.reclaim().removed, 1);
        assert!(!path.exists());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apple_engine_launch_retries_failed_reclaim_and_keeps_the_cap() {
        let directory = tempfile::tempdir().unwrap();
        let source_path = directory.path().join("source");
        fs::write(&source_path, b"bytes").unwrap();
        let source = fs::File::open(&source_path).unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let mut leaf = root
            .reserve_leaves(1, "test:retry", "retry-engine")
            .unwrap()
            .pop()
            .unwrap();
        leaf.create_from(&source, ENGINE_RESOURCE_LEAF_MODE, &|| false)
            .unwrap();
        drop(leaf);
        crate::infra::fs::set_test_removal_injector(Some(Arc::new(
            crate::infra::fs::RemovalFault(crate::infra::fs::RemovalFaultPoint::BeforeTopOpen),
        )));
        let report = root.reclaim();
        crate::infra::fs::set_test_removal_injector(None);
        assert_eq!(report.failed.len(), 1);
        assert_eq!(root.registry_snapshot_for_test().0, 1);
        assert!(matches!(
            root.reserve_leaves(64, "test:overflow", "overflow-engine"),
            Err(Error::ResourceLimit(message)) if message == "engine launch leaf limit reached"
        ));
        assert_eq!(root.reclaim().removed, 1);
        assert_eq!(root.registry_snapshot_for_test().0, 0);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn two_overlapping_engine_launches_are_bounded_to_one_success() {
        use std::sync::{Arc, Barrier};
        let directory = tempfile::tempdir().unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let start_barrier = Arc::new(Barrier::new(3));
        let attempted_barrier = Arc::new(Barrier::new(3));
        let results = Arc::new(std::sync::Mutex::new(Vec::new()));
        let mut threads = Vec::new();
        for index in 0..2 {
            let root = root.clone();
            let start_barrier = start_barrier.clone();
            let attempted_barrier = attempted_barrier.clone();
            let results = results.clone();
            threads.push(std::thread::spawn(move || {
                start_barrier.wait();
                let mut attempted_wait = false;
                let worker_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let result = root.reserve_leaves(33, &format!("test:{index}"), "bounded");
                    let outcome = match &result {
                        Ok(_) => Ok(()),
                        Err(Error::ResourceLimit(message)) => Err(message.clone()),
                        Err(error) => Err(format!("unexpected: {error}")),
                    };
                    results.lock().unwrap().push(outcome);
                    attempted_wait = true;
                    attempted_barrier.wait();
                    drop(result);
                }));
                if worker_result.is_err() && !attempted_wait {
                    attempted_barrier.wait();
                }
                worker_result
            }));
        }
        start_barrier.wait();
        attempted_barrier.wait();
        for thread in threads {
            let worker_result = thread
                .join()
                .unwrap_or_else(|_| panic!("reservation worker panicked"));
            assert!(
                worker_result.is_ok(),
                "reservation worker panicked before reaching the attempt barrier"
            );
        }
        let results = results.lock().unwrap().clone();
        assert_eq!(results.iter().filter(|outcome| outcome.is_ok()).count(), 1);
        let failures: Vec<_> = results
            .iter()
            .filter_map(|outcome| outcome.as_ref().err())
            .collect();
        assert_eq!(failures.len(), 1);
        assert_eq!(failures[0], "engine launch leaf limit reached");
        assert_eq!(root.registry_snapshot_for_test().0, 0);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn poisoned_engine_launch_registry_preserves_drop_and_reclaim_accounting() {
        use std::panic::AssertUnwindSafe;

        let directory = tempfile::tempdir().unwrap();
        let source_path = directory.path().join("source");
        fs::write(&source_path, b"released").unwrap();
        let root = EngineLaunchRoot::for_test(directory.path()).unwrap();
        let mut leaf = root
            .reserve_leaves(1, "test:poisoned", "poisoned-engine")
            .unwrap()
            .pop()
            .unwrap();
        leaf.create_from(
            &fs::File::open(&source_path).unwrap(),
            ENGINE_RESOURCE_LEAF_MODE,
            &|| false,
        )
        .unwrap();

        let poisoned = std::panic::catch_unwind(AssertUnwindSafe(|| {
            let _registry = root.inner.registry.lock().unwrap();
            panic!("poison the engine launch registry");
        }));
        assert!(poisoned.is_err());
        drop(leaf);
        assert_eq!(root.registry_snapshot_for_test().0, 1);
        assert_eq!(root.registry_snapshot_for_test().1.len(), 1);
        let report = root.reclaim();
        assert_eq!(report.removed, 1);
        assert_eq!(root.registry_snapshot_for_test().0, 0);
        assert!(root.registry_snapshot_for_test().1.is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn unpinned_file_resource_value_construction_is_a_typed_conflict() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source");
        fs::write(&source, b"resource").unwrap();
        let lease = EngineResourceLease::test_file(fs::File::open(&source).unwrap());
        assert!(matches!(
            lease.uci_value(),
            Err(Error::Conflict(message))
                if message == "engine file resource was not pinned before value construction"
        ));
    }
}
