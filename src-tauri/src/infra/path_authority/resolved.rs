use crate::{
    error::Error,
    infra::fs::{AtomicFileOutcome, AtomicInstalledFile, RegularFileAccess},
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

use super::{is_write_operation, opened_file_identity, PathOperation};

/// Result of a successful resolution. It retains only the exact opened file, never a parent or
/// root handle that could be used to reach a sibling.
pub struct ResolvedPath {
    operation: PathOperation,
    #[cfg(unix)]
    file: Option<fs::File>,
    #[cfg(unix)]
    directory: Option<fs::File>,
    #[cfg(windows)]
    file: Option<fs::File>,
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

    #[cfg(unix)]
    pub(super) fn directory(&self) -> Option<&fs::File> {
        self.directory.as_ref()
    }

    #[cfg(unix)]
    pub(super) fn take_directory(&mut self) -> Option<fs::File> {
        self.directory.take()
    }

    pub(super) fn parent(&self) -> Option<&fs::File> {
        self.parent.as_ref()
    }

    pub(super) fn leaf(&self) -> Option<&OsStr> {
        self.leaf.as_deref()
    }

    #[cfg(windows)]
    pub(super) fn take_target(&mut self) -> Option<PathBuf> {
        self.target.take()
    }

    pub(super) fn target(&self) -> Option<&Path> {
        self.target.as_deref()
    }

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
        #[cfg(unix)]
        {
            crate::infra::fs::atomic_install_dir(temporary_directory, target)
        }
        #[cfg(not(unix))]
        {
            let _ = temporary_directory;
            Err(Error::Conflict(
                "atomic archive installation is unsupported on this platform".into(),
            ))
        }
    }

    /// Marks exactly the authority-resolved engine file executable. Windows deliberately reports
    /// unsupported because POSIX executable bits have no truthful equivalent there.
    pub(crate) fn mark_engine_executable(&self) -> Result<(), Error> {
        if self.operation != PathOperation::EngineInstall {
            return Err(Error::InvalidInput(
                "resolved capability is not an engine install target".into(),
            ));
        }
        #[cfg(unix)]
        {
            use rustix::fs::{fchmod, Mode};
            use std::os::unix::fs::MetadataExt;
            let file = self
                .file
                .as_ref()
                .ok_or_else(|| Error::InvalidInput("engine target is a directory".into()))?;
            let mode = file.metadata()?.mode() | 0o111;
            fchmod(file, Mode::from_raw_mode(mode))
                .map_err(|error| Error::from(std::io::Error::from(error)))
        }
        #[cfg(not(unix))]
        {
            Err(Error::InvalidInput(
                "engine executable mode is unsupported on this platform".into(),
            ))
        }
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
            Self::pgn_snapshot_file(super::open_windows_child(parent, leaf, false, false, true)?)
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

    #[cfg(test)]
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
    #[cfg(test)]
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

    /// Deletes only the same object that was opened during capability
    /// resolution. Unix verifies the directory entry through the retained
    /// parent descriptor immediately before `unlinkat`; as with every POSIX
    /// pathname mutation, a race after that final kernel check cannot be
    /// expressed as a compare-and-delete operation and is intentionally not
    /// hidden from callers by a retry.
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
        #[cfg(unix)]
        {
            use rustix::fs::{self as rfs, AtFlags, FileType};
            let stat = rfs::statat(parent, leaf, AtFlags::SYMLINK_NOFOLLOW)
                .map_err(|error| Error::from(std::io::Error::from(error)))?;
            if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile
                || (stat.st_dev, stat.st_ino) != expected
            {
                return Err(Error::Conflict(
                    "puzzle database changed before deletion".into(),
                ));
            }
            rfs::unlinkat(parent, leaf, AtFlags::empty())
                .map_err(|error| Error::from(std::io::Error::from(error)))?;
            Ok(())
        }
        #[cfg(windows)]
        {
            let target = self.puzzle_database_path()?;
            let current = opened_file_identity(&super::open_windows_nofollow(&target, true)?)?;
            if current != expected {
                return Err(Error::Conflict(
                    "puzzle database changed before deletion".into(),
                ));
            }
            fs::remove_file(target)?;
            Ok(())
        }
    }

    pub(crate) fn replace_pgn_atomic<F>(
        &self,
        expected: &PgnSnapshot,
        write: F,
    ) -> Result<AtomicFileOutcome, Error>
    where
        F: FnOnce(&mut fs::File, &mut fs::File) -> Result<(), Error>,
    {
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
                    #[cfg(unix)]
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
            let leaf_identity = super::Identity {
                a: stat.st_dev,
                b: stat.st_ino,
            };
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
            let stat_identity = super::Identity {
                a: stat.st_dev,
                b: stat.st_ino,
            };
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
        #[cfg(unix)]
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
    let mut handle = if root_is_dir {
        let handle = super::open_windows_nofollow(root, false)?;
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
            false,
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
    for (index, name) in names.iter().enumerate() {
        let last = index + 1 == names.len();
        // Every operation that can yield an EngineExecutable is kept open
        // without FILE_SHARE_DELETE until CreateProcess has opened it. This
        // seals the authority-validated path against replacement in the
        // otherwise unavoidable Windows path-based launch API.
        let file = super::open_windows_child(
            &handle,
            name,
            last && is_write_operation(operation),
            !last,
            super::allows_delete_sharing_for_operation(operation, last),
        )?;
        let meta = file.metadata()?;
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
                parent: Some(handle.try_clone()?),
                leaf: Some(name.clone()),
                target: if root_is_dir {
                    Some(names.iter().fold(root.to_path_buf(), |mut path, name| {
                        path.push(name);
                        path
                    }))
                } else {
                    Some(root.to_path_buf())
                },
            });
        }
        handle = file;
    }
    Ok(ResolvedPath {
        operation,
        file: None,
        parent: None,
        leaf: None,
        target: None,
    })
}
