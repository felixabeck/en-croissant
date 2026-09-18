#[cfg(unix)]
use crate::infra::fs::RegularFileAccess;
use crate::{
    error::Error,
    infra::fs::{AtomicFileOutcome, AtomicInstalledFile},
};
use sha2::Digest;
use std::{
    ffi::{OsStr, OsString},
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::SystemTime,
};
use tokio_util::sync::CancellationToken;

use super::canonical_binding;
use super::{is_write_operation, opened_file_identity, DatabaseFileTarget, PathOperation};

#[cfg(windows)]
fn windows_path_parts(path: &Path) -> Result<(PathBuf, Vec<OsString>), Error> {
    use std::path::Component;

    let mut components = path.components();
    let mut base = PathBuf::new();
    let mut names = Vec::new();
    match components.next() {
        None => base.push("."),
        Some(Component::Prefix(prefix)) => {
            base.push(prefix.as_os_str());
            match components.next() {
                Some(Component::RootDir) => base.push("\\"),
                Some(Component::Normal(_)) => {
                    return Err(Error::InvalidInput("Windows path must be absolute".into()));
                }
                Some(Component::ParentDir) | Some(Component::Prefix(_)) => {
                    return Err(Error::InvalidInput(
                        "Windows path contains traversal components".into(),
                    ));
                }
                Some(Component::CurDir) | None => {}
            }
        }
        Some(Component::RootDir) => base.push("\\"),
        Some(Component::CurDir) => base.push("."),
        Some(Component::Normal(name)) => {
            base.push(".");
            names.push(name.to_os_string());
        }
        Some(Component::ParentDir) => {
            return Err(Error::InvalidInput(
                "Windows path contains traversal components".into(),
            ));
        }
    }

    for component in components {
        match component {
            Component::Normal(name) => names.push(name.to_os_string()),
            Component::CurDir => {}
            Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
                return Err(Error::InvalidInput(
                    "Windows path contains traversal components".into(),
                ));
            }
        }
    }
    Ok((base, names))
}

#[cfg(windows)]
fn open_windows_directory_walk(path: &Path, writable: bool) -> Result<fs::File, Error> {
    use std::ptr::null;
    use windows_sys::{
        Wdk::Storage::FileSystem::FILE_OPEN,
        Win32::{
            Foundation::{GENERIC_READ, GENERIC_WRITE},
            Storage::FileSystem::SYNCHRONIZE,
        },
    };

    let (base, names) = windows_path_parts(path)?;
    let mut handle = super::open_windows_nofollow(&base, writable)?;
    let access = SYNCHRONIZE | GENERIC_READ | if writable { GENERIC_WRITE } else { 0 };
    for name in names {
        handle = super::open_windows_child(&handle, &name, FILE_OPEN, access, null(), true, true)?;
    }
    Ok(handle)
}

/// Result of a successful resolution. It retains the exact opened file when
/// present, the verified directory handle for directory targets, and the
/// parent handle plus authority-validated leaf needed for relative operations.
/// Those handles stay private and are used only with that retained leaf, so a
/// resolution cannot be used to reach a sibling.
pub struct ResolvedPath {
    operation: PathOperation,
    file: Option<fs::File>,
    directory: Option<fs::File>,
    parent: Option<fs::File>,
    leaf: Option<OsString>,
    target: Option<PathBuf>,
}

impl ResolvedPath {
    pub(super) fn file(&self) -> Option<&fs::File> {
        self.file.as_ref()
    }

    pub(super) fn take_file(&mut self) -> Option<fs::File> {
        self.file.take()
    }

    pub(super) fn directory(&self) -> Option<&fs::File> {
        self.directory.as_ref()
    }

    pub(super) fn take_directory(&mut self) -> Option<fs::File> {
        self.directory.take()
    }

    // Read only by the database-child boundary, which `f-20260914-09` still refuses off unix.
    #[cfg_attr(not(unix), allow(dead_code))]
    pub(super) fn parent(&self) -> Option<&fs::File> {
        self.parent.as_ref()
    }

    #[cfg_attr(not(unix), allow(dead_code))]
    pub(super) fn leaf(&self) -> Option<&OsStr> {
        self.leaf.as_deref()
    }

    #[cfg(windows)]
    pub(super) fn take_target(&mut self) -> Option<PathBuf> {
        self.target.take()
    }

    pub(crate) fn target(&self) -> Option<&Path> {
        self.target.as_deref()
    }

    #[cfg_attr(not(unix), allow(dead_code))]
    pub(super) fn operation(&self) -> PathOperation {
        self.operation
    }

    /// Installs a backend-created archive directory at the authority-resolved destination. The
    /// renderer cannot supply either native path.
    pub(crate) fn atomic_install_download_dir(
        &self,
        temporary_directory: &Path,
    ) -> Result<(), Error> {
        if self.operation != PathOperation::DownloadArchive {
            return Err(Error::InvalidInput(
                "resolved capability is not an archive destination".into(),
            ));
        }
        let target = self.target.as_deref().ok_or_else(|| {
            Error::InvalidInput("archive destination is a directory capability".into())
        })?;
        crate::infra::fs::atomic_install_dir(temporary_directory, target)
    }

    /// Metadata from the exact opened object. It never reconstructs or reveals a pathname.
    pub(crate) fn modified_seconds(&self) -> Result<u32, Error> {
        let file = self
            .file
            .as_ref()
            .ok_or_else(|| Error::InvalidInput("capability names a directory".into()))?;
        file.metadata()?
            .modified()?
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|error| Error::InvalidInput(format!("invalid modification time: {error}")))?
            .as_secs()
            .try_into()
            .map_err(|_| Error::ResourceLimit("file modification time exceeds u32 range".into()))
    }

    /// Transfers the already-opened, identity-checked regular file to a native
    /// streaming consumer.  This is intentionally not a path accessor.
    pub(crate) fn into_read_file(mut self) -> Result<fs::File, Error> {
        if !matches!(
            self.operation,
            PathOperation::ReadPgn | PathOperation::DatabaseRead | PathOperation::PuzzleRead
        ) {
            return Err(Error::InvalidInput(
                "resolved capability is not readable".into(),
            ));
        }
        self.file
            .take()
            .ok_or_else(|| Error::InvalidInput("resolved capability names a directory".into()))
    }

    fn fresh_pgn_snapshot(&self) -> Result<PgnSnapshot, Error> {
        let parent = self
            .parent
            .as_ref()
            .ok_or_else(|| Error::Conflict("PGN parent handle is unavailable".into()))?;
        let leaf = self
            .leaf
            .as_ref()
            .ok_or_else(|| Error::Conflict("PGN leaf handle is unavailable".into()))?;
        #[cfg(unix)]
        {
            use rustix::fs::{self as rfs, Mode, OFlags};
            let file = fs::File::from(
                rfs::openat(
                    parent,
                    leaf,
                    OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                    Mode::empty(),
                )
                .map_err(|error| Error::from(std::io::Error::from(error)))?,
            );
            Self::pgn_snapshot_file(file)
        }
        #[cfg(windows)]
        {
            use std::ptr::null;
            use windows_sys::{
                Wdk::Storage::FileSystem::FILE_OPEN,
                Win32::{Foundation::GENERIC_READ, Storage::FileSystem::SYNCHRONIZE},
            };
            Self::pgn_snapshot_file(super::open_windows_child(
                parent,
                leaf,
                FILE_OPEN,
                SYNCHRONIZE | GENERIC_READ,
                null(),
                false,
                true,
            )?)
        }
    }

    fn pgn_snapshot_file(file: fs::File) -> Result<PgnSnapshot, Error> {
        let meta = file.metadata()?;
        let modified = meta
            .modified()?
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|e| Error::InvalidInput(format!("invalid PGN modification time: {e}")))?
            .as_nanos();
        #[cfg(unix)]
        let ctime_nanos = {
            use std::os::unix::fs::MetadataExt;
            i128::from(meta.ctime()).saturating_mul(1_000_000_000) + i128::from(meta.ctime_nsec())
        };
        #[cfg(windows)]
        let ctime_nanos = {
            use std::os::windows::fs::MetadataExt;
            i128::from(meta.creation_time())
        };
        #[cfg(not(any(unix, windows)))]
        let ctime_nanos = 0;
        let (a, b) = opened_file_identity(&file)?;
        Ok(PgnSnapshot {
            file,
            identity: PgnSnapshotIdentity(super::Identity { a, b }),
            revision: PgnSnapshotRevision {
                size: meta.len(),
                mtime_nanos: modified,
                ctime_nanos,
            },
        })
    }

    #[cfg(all(test, unix))]
    pub(crate) fn atomic_replace_download<F>(&self, write: F) -> Result<AtomicFileOutcome, Error>
    where
        F: FnOnce(&mut fs::File) -> Result<(), Error>,
    {
        self.atomic_replace_download_cancellable(&CancellationToken::new(), write)
    }

    pub(crate) fn atomic_replace_download_cancellable<F>(
        &self,
        cancellation: &CancellationToken,
        write: F,
    ) -> Result<AtomicFileOutcome, Error>
    where
        F: FnOnce(&mut fs::File) -> Result<(), Error>,
    {
        if self.operation != PathOperation::DownloadFile {
            return Err(Error::InvalidInput(
                "resolved capability is not a download destination".into(),
            ));
        }
        let parent = self
            .parent
            .as_ref()
            .ok_or_else(|| Error::Conflict("download parent descriptor is unavailable".into()))?;
        let leaf = self
            .leaf
            .as_ref()
            .ok_or_else(|| Error::Conflict("download leaf descriptor is unavailable".into()))?;
        let precommit_cancellation = cancellation.clone();
        crate::infra::fs::atomic_replace_at_with_precommit(
            parent,
            leaf,
            || {
                if precommit_cancellation.is_cancelled() {
                    return Err(Error::Cancellation);
                }
                self.revalidate_logical_parent()
            },
            write,
        )
    }

    /// Streams a previously reserved staging file into the private atomic temporary inode and
    /// verifies its exact reservation digest before `renameat`. A substituted staging pathname
    /// therefore fails before the visible target changes.
    #[cfg(all(test, unix))]
    pub(crate) fn atomic_install_reserved_download(
        &self,
        reservation: &super::PendingArtifactReservation,
        staged_payload: &Path,
    ) -> Result<AtomicInstalledFile, Error> {
        self.atomic_install_reserved_download_cancellable(
            reservation,
            staged_payload,
            &CancellationToken::new(),
        )
    }

    pub(crate) fn atomic_install_reserved_download_cancellable(
        &self,
        reservation: &super::PendingArtifactReservation,
        staged_payload: &Path,
        cancellation: &CancellationToken,
    ) -> Result<AtomicInstalledFile, Error> {
        let mut staged = fs::File::open(staged_payload)?;
        let expected_size = reservation.payload_size;
        let expected_hash = reservation.payload_sha256.clone();
        let parent = self
            .parent
            .as_ref()
            .ok_or_else(|| Error::Conflict("download parent descriptor is unavailable".into()))?;
        let leaf = self
            .leaf
            .as_ref()
            .ok_or_else(|| Error::Conflict("download leaf descriptor is unavailable".into()))?;
        let copy_cancellation = cancellation.clone();
        let precommit_cancellation = cancellation.clone();
        crate::infra::fs::atomic_replace_at_identified_with_precommit(
            parent,
            leaf,
            || {
                if precommit_cancellation.is_cancelled() {
                    return Err(Error::Cancellation);
                }
                self.revalidate_logical_parent()
            },
            move |target| {
                let mut hasher = sha2::Sha256::new();
                let mut copied = 0_u64;
                let mut buffer = [0_u8; 64 * 1024];
                loop {
                    if copy_cancellation.is_cancelled() {
                        return Err(Error::Cancellation);
                    }
                    let read = staged.read(&mut buffer)?;
                    if read == 0 {
                        break;
                    }
                    copied = copied.checked_add(read as u64).ok_or_else(|| {
                        Error::ResourceLimit("artifact payload exceeds supported size".into())
                    })?;
                    hasher.update(&buffer[..read]);
                    target.write_all(&buffer[..read])?;
                }
                if copied != expected_size || format!("{:x}", hasher.finalize()) != expected_hash {
                    return Err(Error::Conflict(
                        "staging payload changed after artifact reservation".into(),
                    ));
                }
                Ok(())
            },
        )
    }

    fn revalidate_logical_parent(&self) -> Result<(), Error> {
        let retained = self
            .parent
            .as_ref()
            .ok_or_else(|| Error::Conflict("retained parent descriptor is unavailable".into()))?;
        let expected = opened_file_identity(retained)?;
        let logical_parent = self
            .target
            .as_deref()
            .and_then(Path::parent)
            .ok_or_else(|| Error::Conflict("logical parent path is unavailable".into()))?;
        #[cfg(windows)]
        let current = {
            let directory = open_windows_directory_walk(logical_parent, false)?;
            super::windows_file_identity(&directory)?
        };
        #[cfg(not(windows))]
        let current = super::identity(logical_parent)?;
        if (current.a, current.b) != expected {
            return Err(Error::Conflict(
                "logical parent changed after resolution".into(),
            ));
        }
        Ok(())
    }

    fn pgn_allowed(&self) -> Result<(), Error> {
        if matches!(
            self.operation,
            PathOperation::ReadPgn | PathOperation::WritePgn
        ) {
            Ok(())
        } else {
            Err(Error::InvalidInput(
                "resolved capability is not a PGN capability".into(),
            ))
        }
    }

    pub(crate) fn pgn_snapshot(&self) -> Result<PgnSnapshot, Error> {
        self.pgn_allowed()?;
        let file = self
            .file
            .as_ref()
            .ok_or_else(|| Error::InvalidInput("PGN capability names a directory".into()))?
            .try_clone()?;
        Self::pgn_snapshot_file(file)
    }

    /// Returns the backend-only location for an already-opened puzzle database.
    /// The retained file handle pins the exact identity through the SQLite
    /// operation, so the renderer never gains a native path or sibling handle.
    pub(crate) fn puzzle_database_path(&self) -> Result<PathBuf, Error> {
        if !matches!(
            self.operation,
            PathOperation::PuzzleRead | PathOperation::PuzzleDelete
        ) {
            return Err(Error::InvalidInput(
                "resolved capability is not a puzzle database".into(),
            ));
        }
        self.file
            .as_ref()
            .ok_or_else(|| Error::InvalidInput("puzzle capability names a directory".into()))?;
        self.target
            .clone()
            .ok_or_else(|| Error::Conflict("puzzle database target is unavailable".into()))
    }

    pub(crate) fn puzzle_database_identity(&self) -> Result<(u64, u64), Error> {
        self.puzzle_database_path()?;
        opened_file_identity(
            self.file
                .as_ref()
                .ok_or_else(|| Error::InvalidInput("puzzle capability names a directory".into()))?,
        )
    }

    /// Mints the repository carrier from the retained puzzle capability. This is a blocking
    /// filesystem operation and callers must construct it inside their blocking closure.
    pub(crate) fn puzzle_database_target(&self) -> Result<DatabaseFileTarget, Error> {
        if !matches!(
            self.operation,
            PathOperation::PuzzleRead | PathOperation::PuzzleDelete
        ) {
            return Err(Error::InvalidInput(
                "resolved capability is not a puzzle database".into(),
            ));
        }
        let parent = self
            .parent()
            .ok_or_else(|| Error::InvalidInput("puzzle capability names a directory".into()))?
            .try_clone()?;
        let leaf = self
            .leaf()
            .ok_or_else(|| Error::InvalidInput("puzzle capability names a directory".into()))?
            .to_os_string();
        let identity =
            opened_file_identity(self.file.as_ref().ok_or_else(|| {
                Error::InvalidInput("puzzle capability names a directory".into())
            })?)?;
        let path = canonical_binding(
            self.target()
                .ok_or_else(|| Error::Conflict("puzzle database target is unavailable".into()))?,
        )?;
        Ok(DatabaseFileTarget::assemble(parent, leaf, identity, path))
    }

    /// Duplicate the already-authorized descriptor for SQLite. The caller owns
    /// this duplicate for the complete database connection lifetime, so a
    /// pathname swap cannot redirect SQLite after capability resolution.
    pub(crate) fn puzzle_database_file(&self) -> Result<fs::File, Error> {
        self.puzzle_database_path()?;
        self.file
            .as_ref()
            .ok_or_else(|| Error::InvalidInput("puzzle capability names a directory".into()))?
            .try_clone()
            .map_err(Error::from)
    }

    /// Deletes only the same regular file that was opened during capability resolution. The
    /// shared descriptor-relative primitive verifies the entry identity and performs the delete
    /// relative to the retained parent on every supported platform.
    pub(crate) fn delete_puzzle_database(&self) -> Result<(), Error> {
        if self.operation != PathOperation::PuzzleDelete {
            return Err(Error::InvalidInput(
                "resolved capability does not permit puzzle deletion".into(),
            ));
        }
        let expected =
            opened_file_identity(self.file.as_ref().ok_or_else(|| {
                Error::InvalidInput("puzzle capability names a directory".into())
            })?)?;
        let parent = self.parent.as_ref().ok_or_else(|| {
            Error::Conflict("puzzle database parent handle is unavailable".into())
        })?;
        let leaf = self
            .leaf
            .as_ref()
            .ok_or_else(|| Error::Conflict("puzzle database leaf handle is unavailable".into()))?;
        crate::infra::fs::remove_entry_at(parent, leaf, expected, false).map_err(
            |error| match error {
                Error::Conflict(_) => {
                    Error::Conflict("puzzle database changed before deletion".into())
                }
                error => error,
            },
        )
    }

    /// Marks exactly the authority-resolved engine file executable. Windows has no POSIX
    /// executable bit; its `#[cfg(not(unix))]` counterpart checks the same engine-install file
    /// shape and succeeds as a checked no-op.
    #[cfg(unix)]
    pub(crate) fn mark_engine_executable(&self) -> Result<(), Error> {
        if self.operation != PathOperation::EngineInstall {
            return Err(Error::InvalidInput(
                "resolved capability is not an engine install target".into(),
            ));
        }
        use rustix::fs::{fchmod, Mode};
        use std::os::unix::fs::MetadataExt;
        let file = self
            .file
            .as_ref()
            .ok_or_else(|| Error::InvalidInput("engine target is a directory".into()))?;
        let mode = file.metadata()?.mode() | 0o111;
        fchmod(
            file,
            Mode::from_raw_mode(crate::infra::fs::raw_mode_from(mode)?),
        )
        .map_err(|error| Error::from(std::io::Error::from(error)))
    }

    #[cfg(not(unix))]
    pub(crate) fn mark_engine_executable(&self) -> Result<(), Error> {
        if self.operation != PathOperation::EngineInstall {
            return Err(Error::InvalidInput(
                "resolved capability is not an engine install target".into(),
            ));
        }
        self.file
            .as_ref()
            .ok_or_else(|| Error::InvalidInput("engine target is a directory".into()))?;
        Ok(())
    }

    pub(crate) fn replace_pgn_atomic<F>(
        &self,
        expected: &PgnSnapshot,
        write: F,
    ) -> Result<AtomicFileOutcome, Error>
    where
        F: FnOnce(&mut fs::File, &mut fs::File) -> Result<(), Error>,
    {
        crate::infra::platform_support::off_unix_refusal("PGN atomic replacement", cfg!(unix))?;
        if self.operation != PathOperation::WritePgn {
            return Err(Error::InvalidInput(
                "resolved capability is not writable PGN".into(),
            ));
        }
        let parent = self
            .parent
            .as_ref()
            .ok_or_else(|| Error::Conflict("PGN parent descriptor is unavailable".into()))?;
        let leaf = self
            .leaf
            .as_ref()
            .ok_or_else(|| Error::Conflict("PGN leaf descriptor is unavailable".into()))?;
        let mut source = expected.file.try_clone()?;
        crate::infra::fs::atomic_replace_at_with_precommit(
            parent,
            leaf,
            || {
                self.revalidate_logical_parent()?;
                let current = self.fresh_pgn_snapshot()?;
                if current.identity != expected.identity || current.revision != expected.revision {
                    return Err(Error::Conflict("PGN changed before atomic commit".into()));
                }
                Ok(())
            },
            |temporary| write(&mut source, temporary),
        )
    }

    /// Reads only the already-opened, identity-checked file; no directory or sibling handle is exposed.
    #[cfg(test)]
    pub fn read_bytes(&mut self) -> Result<Vec<u8>, Error> {
        if !matches!(
            self.operation,
            PathOperation::ReadPgn
                | PathOperation::DatabaseRead
                | PathOperation::PuzzleRead
                | PathOperation::OpeningBookRead
                | PathOperation::ImageRead
        ) {
            return Err(Error::InvalidInput(
                "resolved capability is not readable".into(),
            ));
        }
        let mut bytes = Vec::new();
        self.file_mut()?.read_to_end(&mut bytes)?;
        Ok(bytes)
    }

    #[cfg(test)]
    fn file_mut(&mut self) -> Result<&mut fs::File, Error> {
        self.file.as_mut().ok_or_else(|| {
            Error::InvalidInput(
                "resolved capability names a directory; a file component is required".into(),
            )
        })
    }

    /// Builds a `ResolvedPath` directly for the Windows executable-no-op runtime test. Its fields
    /// are private to this module, and the Windows-only test cannot run on the Linux source-pin
    /// host, so this is the only way to exercise the counterpart body without a full resolve.
    #[cfg(all(test, windows))]
    fn windows_test(operation: PathOperation, file: Option<fs::File>) -> Self {
        Self {
            operation,
            file,
            directory: None,
            parent: None,
            leaf: None,
            target: None,
        }
    }

    /// Builds a `DownloadArchive` capability directly for the sibling-staging test. Its fields
    /// are private to this module, and `publish_engine_archive_tree` needs a resolved destination
    /// without driving a full authority walk; this is the narrower counterpart to `windows_test`
    /// and is the only constructor that carries a `target`.
    #[cfg(test)]
    pub(crate) fn download_archive_test(target: PathBuf) -> Self {
        Self {
            operation: PathOperation::DownloadArchive,
            file: None,
            directory: None,
            parent: None,
            leaf: None,
            target: Some(target),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(crate) struct PgnSnapshotIdentity(super::Identity);
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(crate) struct PgnSnapshotRevision {
    pub size: u64,
    pub mtime_nanos: u128,
    pub ctime_nanos: i128,
}
pub(crate) struct PgnSnapshot {
    pub file: fs::File,
    pub identity: PgnSnapshotIdentity,
    pub revision: PgnSnapshotRevision,
}

#[cfg(unix)]
pub(super) fn file_identity(meta: &fs::Metadata) -> super::Identity {
    use std::os::unix::fs::MetadataExt;
    super::Identity {
        a: meta.dev(),
        b: meta.ino(),
    }
}

#[cfg(unix)]
pub(super) fn resolve_unix(
    root: &Path,
    expected_root: &super::Identity,
    root_is_dir: bool,
    components: &[OsString],
    operation: PathOperation,
) -> Result<ResolvedPath, Error> {
    use rustix::fs::{self as rfs, FileType, Mode, OFlags};
    let base = if root_is_dir {
        root
    } else {
        root.parent()
            .ok_or_else(|| Error::InvalidInput("file authority has no parent".into()))?
    };
    let mut handle = fs::File::from(
        rfs::openat(
            rfs::CWD,
            base,
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|e| Error::from(std::io::Error::from(e)))?,
    );
    if root_is_dir && file_identity(&handle.metadata()?) != *expected_root {
        return Err(Error::Conflict("root changed concurrently".into()));
    }
    let names: Vec<OsString> = if root_is_dir {
        components.to_vec()
    } else {
        if !components.is_empty() {
            return Err(Error::InvalidInput(
                "file authority cannot have child components".into(),
            ));
        }
        vec![root
            .file_name()
            .ok_or_else(|| Error::InvalidInput("invalid file authority".into()))?
            .to_os_string()]
    };
    let mut exact_file = None;
    for (index, name) in names.iter().enumerate() {
        let last = index + 1 == names.len();
        let stat = match rfs::statat(&handle, name, rfs::AtFlags::SYMLINK_NOFOLLOW) {
            Ok(stat) => stat,
            Err(error)
                if last
                    && matches!(
                        operation,
                        PathOperation::DownloadFile
                            | PathOperation::DownloadArchive
                            | PathOperation::DatabaseCreate
                    )
                    && error == rustix::io::Errno::NOENT =>
            {
                return Ok(ResolvedPath {
                    operation,
                    file: None,
                    directory: None,
                    parent: Some(handle.try_clone()?),
                    leaf: Some(name.clone()),
                    target: Some(names.iter().fold(root.to_path_buf(), |mut path, name| {
                        path.push(name);
                        path
                    })),
                });
            }
            Err(error) => return Err(Error::from(std::io::Error::from(error))),
        };
        let ty = FileType::from_raw_mode(stat.st_mode);
        if ty == FileType::Symlink
            || (!last && ty != FileType::Directory)
            || (last && ty != FileType::Directory && ty != FileType::RegularFile)
        {
            return Err(Error::InvalidInput(
                "path contains a symlink or special file".into(),
            ));
        }
        if last && ty == FileType::RegularFile {
            let (a, b) = crate::infra::fs::raw_stat_identity(&stat);
            let leaf_identity = super::Identity { a, b };
            if !root_is_dir && leaf_identity != *expected_root {
                return Err(Error::Conflict(
                    "file authority changed concurrently".into(),
                ));
            }
            #[cfg(test)]
            super::RESOLVE_PRE_REGULAR_OPEN_HOOK.with(|slot| {
                if let Some(hook) = slot.borrow_mut().take() {
                    hook();
                }
            });
            let access = if is_write_operation(operation) {
                RegularFileAccess::ReadWrite
            } else {
                RegularFileAccess::ReadOnly
            };
            let file = crate::infra::fs::open_regular_at(&handle, name, access)?;
            if file_identity(&file.metadata()?) != leaf_identity {
                return Err(Error::Conflict("file changed while resolving".into()));
            }
            exact_file = Some(file);
        }
        if ty == FileType::Directory {
            #[cfg(test)]
            super::RESOLVE_PRE_DIRECTORY_OPEN_HOOK.with(|slot| {
                if let Some(hook) = slot.borrow_mut().take() {
                    hook();
                }
            });
            handle = fs::File::from(
                rfs::openat(
                    &handle,
                    name,
                    OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                    Mode::empty(),
                )
                .map_err(|e| Error::from(std::io::Error::from(e)))?,
            );
            let opened_identity = file_identity(&handle.metadata()?);
            let (a, b) = crate::infra::fs::raw_stat_identity(&stat);
            let stat_identity = super::Identity { a, b };
            if opened_identity != stat_identity {
                return Err(Error::Conflict("directory changed while resolving".into()));
            }
        }
    }
    let parent = exact_file
        .as_ref()
        .map(|_| handle.try_clone())
        .transpose()?;
    let leaf = if exact_file.is_some() {
        Some(
            names
                .last()
                .ok_or_else(|| Error::Conflict("resolved PGN has no leaf component".into()))?
                .clone(),
        )
    } else {
        None
    };
    let directory = if exact_file.is_none() {
        Some(handle)
    } else {
        None
    };
    Ok(ResolvedPath {
        operation,
        file: exact_file,
        directory,
        parent,
        leaf,
        target: if root_is_dir {
            Some(names.iter().fold(root.to_path_buf(), |mut path, name| {
                path.push(name);
                path
            }))
        } else {
            Some(root.to_path_buf())
        },
    })
}

#[cfg(windows)]
pub(super) fn resolve_windows(
    root: &Path,
    expected_root: &super::Identity,
    root_is_dir: bool,
    components: &[OsString],
    operation: PathOperation,
) -> Result<ResolvedPath, Error> {
    use std::ptr::null;
    use windows_sys::{
        Wdk::Storage::FileSystem::FILE_OPEN,
        Win32::{
            Foundation::{GENERIC_READ, GENERIC_WRITE},
            Storage::FileSystem::SYNCHRONIZE,
        },
    };

    fn allows_missing_leaf(operation: PathOperation) -> bool {
        matches!(
            operation,
            PathOperation::DownloadFile
                | PathOperation::DownloadArchive
                | PathOperation::DatabaseCreate
        )
    }

    fn is_missing_leaf_error(error: &Error) -> bool {
        matches!(
            error,
            Error::Io(error) if error.kind() == std::io::ErrorKind::NotFound
        )
    }

    /// `NtCreateFile` answers a non-directory at a `FILE_DIRECTORY_FILE` leaf with
    /// `STATUS_NOT_A_DIRECTORY`, which `windows_open_status_error` maps to `ERROR_DIRECTORY`.
    fn is_not_a_directory_error(error: &Error) -> bool {
        matches!(
            error,
            Error::Io(error)
                if error.raw_os_error()
                    == Some(windows_sys::Win32::Foundation::ERROR_DIRECTORY as i32)
        )
    }

    // R1-03/R2-02 - two predicates, not one. The PARENT of the final component must carry
    // GENERIC_WRITE for any operation that creates or replaces the leaf, because the retained
    // parent descriptor also serves FILE_CREATE for the temporary and the RootDirectory rename,
    // and because FlushFileBuffers fails with os error 5 on a read-only directory handle (E2).
    // The CHILD's access keeps is_write_operation's membership unchanged: opening an existing
    // target writable would fail for a target whose DACL permits delete/replace but denies write.
    let child_writable = is_write_operation(operation);
    let parent_writable = child_writable || allows_missing_leaf(operation);
    let access = SYNCHRONIZE | GENERIC_READ | if child_writable { GENERIC_WRITE } else { 0 };
    let parent_access =
        SYNCHRONIZE | GENERIC_READ | if parent_writable { GENERIC_WRITE } else { 0 };
    let mut handle = if root_is_dir {
        let handle = super::open_windows_nofollow(root, parent_writable)?;
        if super::windows_file_identity(&handle)? != *expected_root {
            return Err(Error::Conflict("root changed concurrently".into()));
        }
        handle
    } else if !components.is_empty() {
        return Err(Error::InvalidInput(
            "file authority cannot have child components".into(),
        ));
    } else {
        super::open_windows_nofollow(
            root.parent()
                .ok_or_else(|| Error::InvalidInput("file authority has no parent".into()))?,
            parent_writable,
        )?
    };
    let names: Vec<OsString> = if root_is_dir {
        components.to_vec()
    } else {
        vec![root
            .file_name()
            .ok_or_else(|| Error::InvalidInput("invalid file authority".into()))?
            .to_os_string()]
    };
    let target = if root_is_dir {
        Some(names.iter().fold(root.to_path_buf(), |mut path, name| {
            path.push(name);
            path
        }))
    } else {
        Some(root.to_path_buf())
    };
    for (index, name) in names.iter().enumerate() {
        let last = index + 1 == names.len();
        // An archive destination names a directory the renderer never creates: the engine
        // download stages beside it and installs onto it, so the leaf is opened as a directory
        // even when it is the final component. That turns "an existing regular file sits at the
        // archive destination" into a typed refusal instead of an `Io` error from a
        // non-directory open.
        let download_dir_leaf = last && operation == PathOperation::DownloadArchive;
        // Every operation that can yield an EngineExecutable is kept open
        // without FILE_SHARE_DELETE until CreateProcess has opened it. This
        // seals the authority-validated path against replacement in the
        // otherwise unavoidable Windows path-based launch API.
        let file = match super::open_windows_child(
            &handle,
            name,
            FILE_OPEN,
            if last { access } else { parent_access },
            null(),
            !last || download_dir_leaf,
            super::allows_delete_sharing_for_operation(operation, last),
        ) {
            Ok(file) => file,
            Err(error)
                if last && allows_missing_leaf(operation) && is_missing_leaf_error(&error) =>
            {
                return Ok(ResolvedPath {
                    operation,
                    file: None,
                    directory: None,
                    parent: Some(handle.try_clone()?),
                    leaf: Some(name.clone()),
                    target: target.clone(),
                });
            }
            Err(error) if download_dir_leaf && is_not_a_directory_error(&error) => {
                return Err(Error::InvalidInput(
                    "archive destination must be a directory".into(),
                ));
            }
            Err(error) => return Err(error),
        };
        let meta = file.metadata()?;
        if download_dir_leaf {
            if super::is_reparse_point(&meta) || !meta.is_dir() {
                return Err(Error::InvalidInput(
                    "archive destination must be a directory".into(),
                ));
            }
            return Ok(ResolvedPath {
                operation,
                file: None,
                directory: Some(file),
                parent: Some(handle.try_clone()?),
                leaf: Some(name.clone()),
                target,
            });
        }
        if super::is_reparse_point(&meta)
            || (!last && !meta.is_dir())
            || (last && !meta.is_dir() && !meta.is_file())
        {
            return Err(Error::InvalidInput(
                "path contains a reparse point or special file".into(),
            ));
        }
        if last && meta.is_file() {
            if !root_is_dir && super::windows_file_identity(&file)? != *expected_root {
                return Err(Error::Conflict(
                    "file authority changed concurrently".into(),
                ));
            }
            return Ok(ResolvedPath {
                operation,
                file: Some(file),
                directory: None,
                parent: Some(handle.try_clone()?),
                leaf: Some(name.clone()),
                target,
            });
        }
        handle = file;
    }
    // The terminal component is a directory: the handle the walk opened and verified IS the
    // capability. Dropping it would leave `capability_directory` with no descriptor to hand out
    // and force a second, unpinned open by pathname. The computed `target` is carried on the
    // lease as the UCI/CreateProcess string, exactly as the file return above does.
    Ok(ResolvedPath {
        operation,
        file: None,
        directory: Some(handle),
        parent: None,
        leaf: None,
        target,
    })
}

/// Runtime half of the executable no-op pin (R1-07). The counterpart cannot be compiled on the
/// Linux proof host, so the source pin in `platform_support` and this `#[cfg(windows)]` test
/// together hold the contract: an engine-install regular file is accepted and a wrong operation
/// or a directory shape is `InvalidInput`.
#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;

    #[test]
    fn mark_engine_executable_windows_is_a_checked_noop() {
        let file = tempfile::tempfile().unwrap();
        ResolvedPath::windows_test(PathOperation::EngineInstall, Some(file))
            .mark_engine_executable()
            .unwrap();
        assert!(matches!(
            ResolvedPath::windows_test(PathOperation::EngineInstall, None).mark_engine_executable(),
            Err(Error::InvalidInput(_))
        ));
        assert!(matches!(
            ResolvedPath::windows_test(PathOperation::ReadPgn, None).mark_engine_executable(),
            Err(Error::InvalidInput(_))
        ));
    }

    /// An archive destination is a directory leaf: a regular file already sitting there is a
    /// typed `InvalidInput`, not the `Io` error a non-directory open would produce.
    #[test]
    fn download_archive_leaf_file_is_invalid_input() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("archive"), b"not a directory").unwrap();
        let parent =
            crate::infra::path_authority::open_windows_nofollow(dir.path(), false).unwrap();
        let expected = crate::infra::path_authority::windows_file_identity(&parent).unwrap();
        let components = vec![OsString::from("archive")];

        let error = match resolve_windows(
            dir.path(),
            &expected,
            true,
            &components,
            PathOperation::DownloadArchive,
        ) {
            Ok(_) => panic!("a file at the archive destination must be refused"),
            Err(error) => error,
        };

        assert!(matches!(error, Error::InvalidInput(_)), "{error:?}");
    }
}
