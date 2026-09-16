//! Crash consistency note: a successful `DurableCommit` means the replacement and its parent
//! directory entry were synced. A process or power failure before that point may leave either
//! version present. Existing file replacement and recursive removal are optimistic: on Linux, no
//! available syscall conditionally renames or unlinks only a previously checked inode, so an
//! uncooperative writer can still win the final revalidation-to-syscall window.
//! Parent-descriptor-relative operations keep pathname resolution confined, but neither identity
//! guards nor private rename staging revoke already-open writer descriptors. Staging and target
//! parents must not be externally mutated through commit and cleanup. The injected tests prove
//! detection before that window, not compare-and-swap semantics. Commits never follow a target
//! link or leave the opened parent directory.

use crate::error::Error;
// `temp.flush()` in replace_at_driver is platform-neutral, so this trait must be in scope on
// every target, not only unix.
use std::io::Write;
#[cfg(test)]
use std::sync::Arc;
use std::{
    ffi::{OsStr, OsString},
    fs::File,
    io::Read,
    path::Path,
};
#[cfg(unix)]
use tokio_util::sync::CancellationToken;

#[cfg(all(test, windows))]
pub(crate) fn windows_test_parent(path: &Path) -> File {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_DELETE,
        FILE_SHARE_READ, FILE_SHARE_WRITE,
    };

    let mut options = std::fs::OpenOptions::new();
    options
        .read(true)
        .write(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS);
    options.open(path).expect("writable parent descriptor")
}

/// The file kind observed by descriptor-relative directory enumeration.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum DirectoryEntryKind {
    #[cfg(unix)]
    Directory,
    RegularFile,
    #[cfg(unix)]
    Other,
}

/// A directory entry snapshot carrying no pathname.
#[derive(Clone, Debug)]
pub(crate) struct DirectoryEntry {
    pub(crate) name: OsString,
    pub(crate) kind: DirectoryEntryKind,
    pub(crate) identity: (u64, u64),
    #[cfg(unix)]
    pub(crate) modified_seconds: i64,
}

#[cfg(all(test, unix))]
type ReadDirectoryPreStatHook = Box<dyn FnMut(&OsStr)>;

#[cfg(all(test, unix))]
std::thread_local! {
    static READ_DIRECTORY_PRE_STAT_HOOK: std::cell::RefCell<Option<ReadDirectoryPreStatHook>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(all(test, unix))]
pub(crate) fn set_read_directory_pre_stat_hook(hook: Option<ReadDirectoryPreStatHook>) {
    READ_DIRECTORY_PRE_STAT_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[cfg(unix)]
pub(crate) fn read_directory_entries_at(
    dir: &File,
    cancellation: &CancellationToken,
    keep: &mut dyn FnMut(&OsStr) -> bool,
) -> Result<Vec<DirectoryEntry>, Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType};
    use std::os::unix::ffi::OsStringExt;

    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let mut result = Vec::new();
    unix::walk_directory(dir, |bytes, _ino| {
        let name = OsString::from_vec(bytes.to_vec());
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        if !keep(&name) {
            return Ok(());
        }
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        #[cfg(all(test, unix))]
        READ_DIRECTORY_PRE_STAT_HOOK.with(|slot| {
            if let Some(hook) = slot.borrow_mut().as_mut() {
                hook(&name);
            }
        });
        let stat = rfs::statat(dir, &name, AtFlags::SYMLINK_NOFOLLOW)
            .map_err(|error| Error::Io(Box::new(error.into())))?;
        let kind = match FileType::from_raw_mode(stat.st_mode) {
            FileType::Directory => DirectoryEntryKind::Directory,
            FileType::RegularFile => DirectoryEntryKind::RegularFile,
            _ => DirectoryEntryKind::Other,
        };
        result.push(DirectoryEntry {
            name,
            kind,
            identity: unix::raw_stat_identity(&stat),
            modified_seconds: stat.st_mtime,
        });
        Ok(())
    })?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    unix::ensure_directory_not_removed(dir)?;
    Ok(result)
}

#[cfg(any(target_os = "macos", all(test, unix)))]
pub(crate) fn held_matches_path(held: &File, path: &Path) -> Result<bool, Error> {
    use rustix::{fs, io::Errno};

    let held_stat = match fs::fstat(held) {
        Ok(stat) => stat,
        Err(Errno::NOENT | Errno::NOTDIR) => return Ok(false),
        Err(error) => return Err(Error::Io(Box::new(error.into()))),
    };
    let path_stat = match fs::lstat(path) {
        Ok(stat) => stat,
        Err(Errno::NOENT | Errno::NOTDIR) => return Ok(false),
        Err(error) => return Err(Error::Io(Box::new(error.into()))),
    };
    Ok(unix::raw_stat_identity(&held_stat) == unix::raw_stat_identity(&path_stat))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(windows, allow(dead_code))]
pub(crate) enum RegularFileAccess {
    ReadOnly,
    ReadWrite,
}

pub(crate) fn read_bounded_bytes<R: Read>(
    reader: &mut R,
    declared: u64,
    max_bytes: usize,
    limit_message: &'static str,
    mut checkpoint: impl FnMut() -> Result<(), Error>,
) -> Result<Vec<u8>, Error> {
    checkpoint()?;
    let capacity = usize::try_from(declared)
        .unwrap_or(max_bytes)
        .min(max_bytes);
    let mut bytes = Vec::with_capacity(capacity);
    let mut chunk = [0_u8; 16 * 1024];
    loop {
        checkpoint()?;
        let remaining = max_bytes - bytes.len();
        let requested = chunk.len().min(remaining.saturating_add(1));
        let read = loop {
            match reader.read(&mut chunk[..requested]) {
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => {
                    checkpoint()?;
                    continue;
                }
                result => break result?,
            }
        };
        if read == 0 {
            checkpoint()?;
            return Ok(bytes);
        }
        if read > remaining {
            return Err(Error::ResourceLimit(limit_message.into()));
        }
        bytes.extend_from_slice(&chunk[..read]);
    }
}

mod verified_directory {
    use crate::error::Error;
    use std::fs::File;

    #[derive(Debug)]
    pub(crate) struct VerifiedDir(File);

    impl VerifiedDir {
        #[cfg(unix)]
        pub(crate) fn new(opened: File, expected: (u64, u64)) -> Result<Self, Error> {
            use std::os::unix::fs::MetadataExt;
            let verified = Self(opened);
            let metadata = verified.as_file().metadata()?;
            if (metadata.dev(), metadata.ino()) != expected {
                return Err(Error::Conflict(
                    "workspace directory changed concurrently".into(),
                ));
            }
            Ok(verified)
        }

        #[cfg(windows)]
        #[allow(dead_code)]
        pub(crate) fn new(opened: File, expected: (u64, u64)) -> Result<Self, Error> {
            let verified = Self(opened);
            if crate::infra::path_authority::opened_file_identity(verified.as_file())? != expected {
                return Err(Error::Conflict(
                    "workspace directory changed concurrently".into(),
                ));
            }
            Ok(verified)
        }

        pub(crate) fn as_file(&self) -> &File {
            &self.0
        }

        #[cfg_attr(windows, allow(dead_code))]
        pub(crate) fn into_file(self) -> File {
            self.0
        }
    }
}

pub(crate) use verified_directory::VerifiedDir;

#[derive(Debug)]
#[must_use = "the rename may have landed without a durable parent; decide what CommittedDurabilityUncertain means at this site"]
pub enum AtomicFileOutcome {
    DurableCommit,
    CommittedDurabilityUncertain(std::io::Error),
}

impl AtomicFileOutcome {
    /// Test assertion: a replacement inside a fresh temporary directory has no reason to lose
    /// its parent sync, so a test that only needs the file placed asserts that rather than
    /// discarding the outcome.
    #[cfg(test)]
    #[track_caller]
    pub(crate) fn expect_durable(self) {
        if let Self::CommittedDurabilityUncertain(error) = self {
            panic!("atomic replacement lost its parent sync: {error}");
        }
    }
}

pub(crate) fn map_atomic_file_outcome(
    outcome: AtomicFileOutcome,
    stage: crate::error::DurabilityStage,
    on_uncertain: impl FnOnce(&std::io::Error),
) -> Option<crate::error::DurabilityStage> {
    match outcome {
        AtomicFileOutcome::DurableCommit => None,
        AtomicFileOutcome::CommittedDurabilityUncertain(error) => {
            on_uncertain(&error);
            Some(stage)
        }
    }
}

/// The contract for a caller that has nothing left to do after the replacement: the rename
/// landed either way, so the state is kept and uncertain durability is reported as
/// `Error::CommittedDurabilityUncertain(stage)` after logging the cause.
pub(crate) fn require_durable(
    outcome: AtomicFileOutcome,
    stage: crate::error::DurabilityStage,
) -> Result<(), Error> {
    match map_atomic_file_outcome(outcome, stage, |error| {
        log::warn!("{stage} parent sync failed: {error}");
    }) {
        None => Ok(()),
        Some(stage) => Err(Error::CommittedDurabilityUncertain(stage)),
    }
}

#[derive(Debug)]
pub struct AtomicInstalledFile {
    pub outcome: AtomicFileOutcome,
    pub identity: (u64, u64),
    pub ctime_nanos: i128,
}

#[cfg(test)]
// The fault points are one cross-platform vocabulary, but no single target constructs all of
// them: `DaclCapture` and `DaclApply` are injected only inside `mod win`, so a unix test build
// never constructs them, and the Windows adapter likewise skips the unix-only permission path.
// The allow covers that platform asymmetry; it is not a licence for a fault point nothing injects.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AtomicFileFaultPoint {
    ParentOpen,
    TempfileCreate,
    Write,
    Flush,
    FileSync,
    PermissionCopy,
    PreCommitRevalidate,
    Rename,
    PostRenameMetadata,
    TargetStat,
    TempMetadata,
    DaclCapture,
    DaclApply,
    ParentSync,
    Cleanup,
}

#[cfg(test)]
pub(crate) trait AtomicWriterInjector {
    fn inject(&self, _: AtomicFileFaultPoint) -> std::io::Result<()> {
        Ok(())
    }

    #[cfg(windows)]
    fn inspect_temp(&self, _: &File) -> std::io::Result<()> {
        Ok(())
    }
}

/// Test injector that fails only the parent-directory sync, producing
/// `AtomicFileOutcome::CommittedDurabilityUncertain` with the given cause.
#[cfg(test)]
pub(crate) struct ParentSyncFault(pub(crate) &'static str);

#[cfg(test)]
impl AtomicWriterInjector for ParentSyncFault {
    fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
        if point == AtomicFileFaultPoint::ParentSync {
            Err(std::io::Error::other(self.0))
        } else {
            Ok(())
        }
    }
}

#[cfg(test)]
std::thread_local! {
    static TEST_ATOMIC_FILE_INJECTOR: std::cell::RefCell<
        Option<Arc<dyn AtomicWriterInjector + Send + Sync>>,
    > = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
pub(crate) fn set_test_atomic_file_injector(
    injector: Option<Arc<dyn AtomicWriterInjector + Send + Sync>>,
) {
    TEST_ATOMIC_FILE_INJECTOR.with(|current| *current.borrow_mut() = injector);
}

#[cfg(test)]
pub(crate) fn current_test_atomic_file_injector(
) -> Option<Arc<dyn AtomicWriterInjector + Send + Sync>> {
    TEST_ATOMIC_FILE_INJECTOR.with(|current| current.borrow().clone())
}

#[cfg(any(test, unix, windows))]
fn io(err: std::io::Error) -> Error {
    Error::Io(Box::new(err))
}
#[cfg(test)]
pub(crate) fn inject_atomic_file(point: AtomicFileFaultPoint) -> Result<(), Error> {
    current_test_atomic_file_injector()
        .map_or(Ok(()), |injector| injector.inject(point).map_err(io))
}

#[cfg(test)]
std::thread_local! {
    static DURABILITY_LOG: std::cell::RefCell<Vec<&'static str>> =
        const { std::cell::RefCell::new(Vec::new()) };
}

#[cfg(test)]
fn record_durability(label: &'static str) {
    DURABILITY_LOG.with(|log| log.borrow_mut().push(label));
}

#[cfg(not(test))]
fn record_durability(_: &'static str) {}

#[cfg(all(test, windows))]
fn inspect_test_atomic_temp(temp: &File) -> Result<(), Error> {
    current_test_atomic_file_injector()
        .map_or(Ok(()), |injector| injector.inspect_temp(temp).map_err(io))
}

#[cfg(test)]
#[allow(dead_code)]
fn durability_log() -> Vec<&'static str> {
    DURABILITY_LOG.with(|log| log.borrow().clone())
}

#[cfg(test)]
#[allow(dead_code)]
fn clear_durability_log() {
    DURABILITY_LOG.with(|log| log.borrow_mut().clear());
}

#[derive(Debug, Clone, Copy)]
struct TempMetadata {
    identity: (u64, u64),
    ctime_nanos: i128,
}

trait AtomicReplaceAdapter {
    type Target;

    fn target_stat(&self, dir: &File, target: &OsStr) -> Result<Option<Self::Target>, Error>;
    fn is_regular(&self, target: &Self::Target) -> bool;
    fn target_identity(&self, target: &Self::Target) -> (u64, u64);
    fn create_temp(
        &self,
        dir: &File,
        original: Option<&Self::Target>,
    ) -> Result<(OsString, File), Error>;
    fn before_write(
        &self,
        dir: &File,
        temp: &File,
        original: Option<&Self::Target>,
    ) -> Result<(), Error>;
    fn finalize_metadata(
        &self,
        temp: &mut File,
        original: Option<&Self::Target>,
    ) -> Result<(), Error>;
    fn rename(
        &self,
        dir: &File,
        temp: &mut File,
        temp_name: &OsStr,
        target: &OsStr,
        replace: bool,
    ) -> Result<(), Error>;
    fn metadata(&self, temp: &File) -> Result<TempMetadata, std::io::Error>;
    fn cleanup(&self, dir: &File, temp_name: &OsStr, temp: &mut File, primary: Error) -> Error;
}

fn cleanup_with_adapter<A: AtomicReplaceAdapter>(
    adapter: &A,
    dir: &File,
    temp_name: &OsStr,
    temp: &mut File,
    primary: Error,
) -> Error {
    adapter.cleanup(dir, temp_name, temp, primary)
}

fn replace_at_driver<A, F, P>(
    adapter: A,
    dir: File,
    target_name: OsString,
    precommit: P,
    write_fn: F,
) -> Result<AtomicInstalledFile, Error>
where
    A: AtomicReplaceAdapter,
    F: FnOnce(&mut File) -> Result<(), Error>,
    P: FnOnce() -> Result<(), Error>,
{
    let target_name_ref = target_name.as_os_str();
    let original = {
        let result = adapter.target_stat(&dir, target_name_ref);
        record_durability("target_stat:initial");
        match result? {
            Some(target) if !adapter.is_regular(&target) => {
                return Err(Error::InvalidInput(
                    "target must be a regular file, not a link or special file".into(),
                ));
            }
            target => target,
        }
    };

    #[cfg(test)]
    inject_atomic_file(AtomicFileFaultPoint::TempfileCreate)?;
    let (temp_name, mut temp) = adapter.create_temp(&dir, original.as_ref())?;

    if let Err(error) = adapter.before_write(&dir, &temp, original.as_ref()) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::Write) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    #[cfg(all(test, windows))]
    if let Err(error) = inspect_test_atomic_temp(&temp) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    if let Err(error) = write_fn(&mut temp) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::Flush) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    let result = temp.flush().map_err(io);
    record_durability("temp.flush");
    if let Err(error) = result {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::FileSync) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    let result = temp.sync_all().map_err(io);
    record_durability("temp.sync_all:content");
    if let Err(error) = result {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::PermissionCopy) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    if let Err(error) = adapter.finalize_metadata(&mut temp, original.as_ref()) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }

    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::PreCommitRevalidate) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::TargetStat) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    let current = adapter.target_stat(&dir, target_name_ref);
    record_durability("target_stat:revalidation");
    let current = match current {
        Ok(current) => current,
        Err(error) => {
            return Err(cleanup_with_adapter(
                &adapter, &dir, &temp_name, &mut temp, error,
            ))
        }
    };
    match (original.as_ref(), current) {
        (None, None) => {}
        (None, Some(_)) => {
            return Err(cleanup_with_adapter(
                &adapter,
                &dir,
                &temp_name,
                &mut temp,
                Error::Conflict("target was created concurrently".into()),
            ))
        }
        (Some(_), None) => {
            return Err(cleanup_with_adapter(
                &adapter,
                &dir,
                &temp_name,
                &mut temp,
                Error::Conflict("target was deleted concurrently".into()),
            ))
        }
        (Some(expected), Some(actual))
            if adapter.is_regular(&actual)
                && target_identity(&adapter, expected) == target_identity(&adapter, &actual) => {}
        (Some(_), Some(_)) => {
            return Err(cleanup_with_adapter(
                &adapter,
                &dir,
                &temp_name,
                &mut temp,
                Error::Conflict("target changed concurrently".into()),
            ))
        }
    }
    if let Err(error) = precommit() {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }

    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::TempMetadata) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    let fallback_metadata = match adapter.metadata(&temp) {
        Ok(metadata) => metadata,
        Err(error) => {
            return Err(cleanup_with_adapter(
                &adapter,
                &dir,
                &temp_name,
                &mut temp,
                io(error),
            ))
        }
    };
    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::Rename) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }
    if let Err(error) = adapter.rename(
        &dir,
        &mut temp,
        &temp_name,
        target_name_ref,
        original.is_some(),
    ) {
        return Err(cleanup_with_adapter(
            &adapter, &dir, &temp_name, &mut temp, error,
        ));
    }

    #[cfg(test)]
    let metadata = match inject_atomic_file(AtomicFileFaultPoint::PostRenameMetadata) {
        Ok(()) => adapter.metadata(&temp),
        Err(Error::Io(error)) => Err(*error),
        Err(_) => unreachable!("atomic file injectors only produce I/O errors"),
    };
    #[cfg(not(test))]
    let metadata = adapter.metadata(&temp);
    let metadata = match metadata {
        Ok(metadata) => metadata,
        Err(error) => {
            drop(temp);
            return Ok(AtomicInstalledFile {
                outcome: AtomicFileOutcome::CommittedDurabilityUncertain(error),
                identity: fallback_metadata.identity,
                ctime_nanos: fallback_metadata.ctime_nanos,
            });
        }
    };
    drop(temp);
    #[cfg(test)]
    if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::ParentSync) {
        let Error::Io(error) = error else {
            unreachable!("atomic file injectors only produce I/O errors")
        };
        return Ok(AtomicInstalledFile {
            outcome: AtomicFileOutcome::CommittedDurabilityUncertain(*error),
            identity: metadata.identity,
            ctime_nanos: metadata.ctime_nanos,
        });
    }
    let parent_sync = dir.sync_all();
    record_durability("dir.sync_all");
    let outcome = match parent_sync {
        Ok(()) => AtomicFileOutcome::DurableCommit,
        Err(error) => AtomicFileOutcome::CommittedDurabilityUncertain(error),
    };
    Ok(AtomicInstalledFile {
        outcome,
        identity: metadata.identity,
        ctime_nanos: metadata.ctime_nanos,
    })
}

fn target_identity<A: AtomicReplaceAdapter>(adapter: &A, target: &A::Target) -> (u64, u64) {
    adapter.target_identity(target)
}

#[cfg(unix)]
mod unix {
    use super::*;
    use rustix::{
        fs::{self, AtFlags, Dir, FileType, Mode, OFlags, RenameFlags},
        io::Errno,
    };
    #[cfg(target_os = "linux")]
    use std::io::Read;
    #[cfg(any(test, target_os = "linux"))]
    use std::os::unix::io::AsRawFd;
    use std::{
        ffi::OsStr,
        os::unix::{
            ffi::{OsStrExt, OsStringExt},
            fs::MetadataExt,
        },
        path::Component,
    };
    /// Directory levels `remove_tree_at` and `sync_tree` will descend before refusing.
    ///
    /// Each open level holds two descriptors (the level's `File` and the one `Dir` owns), so one
    /// walk keeps at most `2 * MAX_REMOVE_TREE_DEPTH + 1` descriptors. Directory buffers are
    /// heap-owned by `Dir`: rustix caps its Linux `getdents` buffer growth, and macOS libc grows
    /// its `DIR` buffer once to 8 KiB, except on union mounts, which the walker refuses.
    pub(crate) const MAX_REMOVE_TREE_DEPTH: usize = 64;
    /// Maximum accepted size of one `/proc/self/fdinfo` record.
    #[cfg(target_os = "linux")]
    const MAX_FDINFO_RECORD_BYTES: u64 = 4096;

    #[cfg(test)]
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum RemovalFaultPoint {
        BeforeTopOpen,
        BeforeChildStat,
        BeforeChildOpen,
        BeforeDirOpen,
        AfterDirectoryWalk,
        AfterEntryRemoved,
        ParentSync,
    }

    #[cfg(test)]
    pub(crate) trait RemovalInjector {
        fn inject(&self, _: RemovalFaultPoint) -> std::io::Result<Option<u64>> {
            Ok(None)
        }

        /// Supplies raw `statx` attribute-mask and attribute bits to the production decision.
        #[cfg(target_os = "linux")]
        fn statx_mount_attributes(
            &self,
            _: std::os::fd::RawFd,
        ) -> Option<std::io::Result<(u64, u64)>> {
            None
        }

        /// Supplies a raw fdinfo record to the production bounded parser.
        #[cfg(target_os = "linux")]
        fn fdinfo_record(&self, _: std::os::fd::RawFd) -> Option<std::io::Result<Vec<u8>>> {
            None
        }

        /// Supplies the raw mount-point buffer used by non-Linux mount evidence.
        #[cfg(not(target_os = "linux"))]
        fn mount_path_buffer(
            &self,
            _: std::os::fd::RawFd,
        ) -> Option<std::io::Result<Vec<libc::c_char>>> {
            None
        }

        /// Supplies the filesystem flags used by the non-Linux directory-walk bound.
        #[cfg(not(target_os = "linux"))]
        fn mount_flags(&self, _: std::os::fd::RawFd) -> Option<std::io::Result<u32>> {
            None
        }
    }

    #[cfg(test)]
    pub(crate) struct RemovalFault(pub(crate) RemovalFaultPoint);

    #[cfg(test)]
    impl RemovalInjector for RemovalFault {
        fn inject(&self, point: RemovalFaultPoint) -> std::io::Result<Option<u64>> {
            if point == self.0 {
                return Err(std::io::Error::other(
                    r"/private/removal C:\private\removal: injected removal failure",
                ));
            }
            Ok(None)
        }
    }

    #[cfg(test)]
    std::thread_local! {
        static TEST_REMOVAL_INJECTOR: std::cell::RefCell<
            Option<Arc<dyn RemovalInjector + Send + Sync>>,
        > = const { std::cell::RefCell::new(None) };
    }

    #[cfg(test)]
    pub(crate) fn set_test_removal_injector(
        injector: Option<Arc<dyn RemovalInjector + Send + Sync>>,
    ) {
        TEST_REMOVAL_INJECTOR.with(|current| *current.borrow_mut() = injector);
    }

    #[cfg(test)]
    pub(crate) fn current_test_removal_injector() -> Option<Arc<dyn RemovalInjector + Send + Sync>>
    {
        TEST_REMOVAL_INJECTOR.with(|current| current.borrow().clone())
    }

    #[cfg(test)]
    pub(crate) struct TestRemovalInjectorGuard(Option<Arc<dyn RemovalInjector + Send + Sync>>);

    #[cfg(test)]
    impl Drop for TestRemovalInjectorGuard {
        fn drop(&mut self) {
            let previous = self.0.take();
            set_test_removal_injector(previous);
        }
    }

    #[cfg(test)]
    pub(crate) fn scoped_test_removal_injector(
        injector: Arc<dyn RemovalInjector + Send + Sync>,
    ) -> TestRemovalInjectorGuard {
        let previous = current_test_removal_injector();
        set_test_removal_injector(Some(injector));
        TestRemovalInjectorGuard(previous)
    }

    #[cfg(test)]
    pub(super) fn inject_removal(point: RemovalFaultPoint) -> Result<Option<u64>, Error> {
        current_test_removal_injector()
            .map_or(Ok(None), |injector| injector.inject(point).map_err(io))
    }

    trait RawDevice {
        fn canonical(self) -> u64;
    }

    impl RawDevice for i32 {
        fn canonical(self) -> u64 {
            self as u64
        }
    }

    impl RawDevice for u64 {
        fn canonical(self) -> u64 {
            self
        }
    }

    fn identity_from_parts<D: RawDevice>(dev: D, ino: u64) -> (u64, u64) {
        (dev.canonical(), ino)
    }

    pub(crate) fn raw_stat_identity(stat: &rustix::fs::Stat) -> (u64, u64) {
        identity_from_parts(stat.st_dev, stat.st_ino)
    }

    fn directory_removed_error() -> Error {
        Error::Io(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "directory was removed during enumeration",
        )))
    }

    pub(super) fn ensure_directory_not_removed(dir: &File) -> Result<(), Error> {
        #[cfg(not(target_os = "macos"))]
        {
            let directory_stat = fs::fstat(dir).map_err(|error| io(error.into()))?;
            if directory_stat.st_nlink == 0 {
                return Err(directory_removed_error());
            }
        }
        #[cfg(target_os = "macos")]
        {
            use std::os::unix::ffi::OsStrExt;

            let path = fs::getpath(dir).map_err(|error| {
                if matches!(error, Errno::NOENT | Errno::NOTDIR) {
                    directory_removed_error()
                } else {
                    io(error.into())
                }
            })?;
            if !super::held_matches_path(dir, Path::new(OsStr::from_bytes(path.as_bytes())))? {
                return Err(directory_removed_error());
            }
        }
        Ok(())
    }

    pub(crate) fn raw_mode_from(mode: u32) -> Result<rustix::fs::RawMode, Error> {
        rustix::fs::RawMode::try_from(mode)
            .map_err(|_| Error::InvalidInput("file mode does not fit this platform".into()))
    }

    #[cfg(any(test, not(target_os = "linux")))]
    pub(super) fn mount_path_from_buffer(buffer: &[libc::c_char]) -> Result<Vec<u8>, Error> {
        let end = buffer.iter().position(|byte| *byte == 0).ok_or_else(|| {
            Error::InvalidInput("directory cleanup cannot establish mount path".into())
        })?;
        if end == 0 {
            return Err(Error::InvalidInput(
                "directory cleanup cannot establish mount path".into(),
            ));
        }
        Ok(buffer[..end].iter().map(|byte| *byte as u8).collect())
    }

    #[cfg(any(test, not(target_os = "linux")))]
    pub(super) fn mount_crossing_from(
        parent: Result<Vec<u8>, Error>,
        child: Result<Vec<u8>, Error>,
    ) -> Result<bool, Error> {
        let parent = parent?;
        let child = child?;
        Ok(parent != child)
    }

    #[cfg(any(test, not(target_os = "linux")))]
    pub(super) fn union_mount_refusal(f_flags: u32, union_flag: u32) -> Result<(), Error> {
        if f_flags & union_flag != 0 {
            return Err(Error::InvalidInput(
                "directory walks refuse union mounts".into(),
            ));
        }
        Ok(())
    }

    #[cfg(not(target_os = "linux"))]
    fn mount_path_evidence(file: &File) -> Result<Vec<u8>, Error> {
        #[cfg(test)]
        if let Some(buffer) = current_test_removal_injector()
            .and_then(|injector| injector.mount_path_buffer(file.as_raw_fd()))
        {
            return mount_path_from_buffer(&buffer.map_err(io)?);
        }
        let stat = fs::fstatfs(file).map_err(|error| io(error.into()))?;
        mount_path_from_buffer(&stat.f_mntonname)
    }

    #[cfg(not(target_os = "linux"))]
    fn mount_flags(file: &File) -> Result<u32, Error> {
        #[cfg(test)]
        if let Some(flags) = current_test_removal_injector()
            .and_then(|injector| injector.mount_flags(file.as_raw_fd()))
        {
            return flags.map_err(io);
        }
        let stat = fs::fstatfs(file).map_err(|error| io(error.into()))?;
        Ok(stat.f_flags)
    }

    #[cfg(not(target_os = "linux"))]
    fn refuse_union_mount(file: &File) -> Result<(), Error> {
        union_mount_refusal(mount_flags(file)?, libc::MNT_UNION as u32)
    }

    pub(super) fn walk_directory(
        dir: &File,
        mut visit: impl FnMut(&[u8], u64) -> Result<(), Error>,
    ) -> Result<(), Error> {
        #[cfg(not(target_os = "linux"))]
        refuse_union_mount(dir)?;
        #[cfg(test)]
        inject_removal(RemovalFaultPoint::BeforeDirOpen)?;
        let opened = fs::openat(
            dir,
            ".",
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|error| io(error.into()))?;
        let mut entries = Dir::new(opened).map_err(|error| io(error.into()))?;
        while let Some(entry) = entries.read() {
            let entry = entry.map_err(|error| io(error.into()))?;
            let bytes = entry.file_name().to_bytes();
            if bytes != b"." && bytes != b".." {
                visit(bytes, entry.ino())?;
            }
        }
        #[cfg(test)]
        inject_removal(RemovalFaultPoint::AfterDirectoryWalk)?;
        Ok(())
    }

    #[cfg(test)]
    mod identity_tests {
        use super::{identity_from_parts, raw_mode_from, raw_stat_identity};
        use crate::infra::blocking::source_scan::{braced_body, normalise, Literals};

        #[cfg(target_os = "macos")]
        use crate::error::Error;
        use rustix::fs::fstat;

        #[test]
        fn identity_from_parts_canonicalises_signed_and_unsigned_devices() {
            assert_eq!(identity_from_parts(-1_i32, 7), (u64::MAX, 7));
            assert_eq!(identity_from_parts(i32::MIN, 7), (i32::MIN as u64, 7));
            assert_eq!(identity_from_parts(u64::MAX, 7), (u64::MAX, 7));
        }

        #[test]
        fn raw_stat_identity_matches_file_metadata() {
            use std::os::unix::fs::MetadataExt;
            let temp = tempfile::tempdir().expect("tempdir");
            let path = temp.path().join("file");
            std::fs::write(&path, b"file").expect("file");
            let file = std::fs::File::open(&path).expect("open file");
            let stat = fstat(&file).expect("fstat");
            let metadata = file.metadata().expect("metadata");
            assert_eq!(raw_stat_identity(&stat), (metadata.dev(), metadata.ino()));
        }

        #[test]
        fn raw_stat_identity_body_is_the_plain_call() {
            let source = include_str!("fs.rs");
            let body = braced_body(source, "pub(crate) fn raw_stat_identity(");
            let compact: String = normalise(&source[body], Literals::Blank)
                .chars()
                .filter(|character| !character.is_whitespace())
                .collect();
            let expected = ["{identity_from_parts(stat.st", "_dev,stat.st_ino)}"].concat();
            assert_eq!(compact, expected);
        }

        #[test]
        fn raw_mode_from_accepts_platform_mode() {
            assert_eq!(raw_mode_from(0o100_644).expect("mode"), 0o100_644);
        }

        #[cfg(target_os = "macos")]
        #[test]
        fn macos_port_raw_mode_rejects_wide_mode() {
            for mode in [0x1_0000, u32::MAX] {
                assert!(matches!(raw_mode_from(mode), Err(Error::InvalidInput(_))));
            }
        }

        #[test]
        fn raw_device_is_read_once() {
            fn rust_sources(path: &std::path::Path, files: &mut Vec<std::path::PathBuf>) {
                for entry in std::fs::read_dir(path).expect("source directory") {
                    let entry = entry.expect("source entry");
                    let path = entry.path();
                    if path.is_dir() {
                        rust_sources(&path, files);
                    } else if path.extension().and_then(std::ffi::OsStr::to_str) == Some("rs") {
                        files.push(path);
                    }
                }
            }

            let source_root = std::path::PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/src"));
            let mut files = Vec::new();
            rust_sources(&source_root, &mut files);
            let needle = ["st", "_dev"].concat();
            let mut occurrences = Vec::new();
            for file in files {
                let source = std::fs::read_to_string(&file).expect("Rust source");
                let normalised = normalise(&source, Literals::Blank);
                for (offset, _) in normalised.match_indices(&needle) {
                    let line = source[..offset]
                        .bytes()
                        .filter(|byte| *byte == b'\n')
                        .count()
                        + 1;
                    occurrences.push(format!("{}:{line}", file.display()));
                }
            }
            assert_eq!(
                occurrences.len(),
                1,
                "raw device occurrences: {occurrences:?}"
            );
            let fs_source = include_str!("fs.rs");
            let body = braced_body(fs_source, "pub(crate) fn raw_stat_identity(");
            let offset = normalise(fs_source, Literals::Blank)
                .find(&needle)
                .expect("raw device occurrence");
            assert!(
                body.contains(&offset),
                "raw device access is outside helper"
            );
        }
    }

    #[cfg(target_os = "linux")]
    pub(super) fn parse_fdinfo_mount_id(record: &[u8]) -> Result<u64, Error> {
        if record.len() > MAX_FDINFO_RECORD_BYTES as usize {
            return Err(Error::InvalidInput(
                "directory cleanup cannot establish mount identity: fdinfo record is oversized"
                    .into(),
            ));
        }
        let mut mount_id = None;
        for line in record.split(|byte| *byte == b'\n') {
            let Some(value) = line.strip_prefix(b"mnt_id:") else {
                continue;
            };
            if mount_id.is_some() {
                return Err(Error::InvalidInput(
                    "directory cleanup cannot establish mount identity: duplicate fdinfo mnt_id"
                        .into(),
                ));
            }
            let value = value
                .strip_prefix(b"\t")
                .or_else(|| value.strip_prefix(b" "))
                .ok_or_else(|| {
                    Error::InvalidInput(
                        "directory cleanup cannot establish mount identity: malformed fdinfo mnt_id"
                            .into(),
                    )
                })?;
            if value.is_empty() || !value.iter().all(u8::is_ascii_digit) {
                return Err(Error::InvalidInput(
                    "directory cleanup cannot establish mount identity: malformed fdinfo mnt_id"
                        .into(),
                ));
            }
            let parsed = std::str::from_utf8(value)
                .ok()
                .and_then(|digits| digits.parse::<u64>().ok())
                .ok_or_else(|| {
                    Error::InvalidInput(
                        "directory cleanup cannot establish mount identity: malformed fdinfo mnt_id"
                            .into(),
                    )
                })?;
            mount_id = Some(parsed);
        }
        mount_id.ok_or_else(|| {
            Error::InvalidInput(
                "directory cleanup cannot establish mount identity: fdinfo mnt_id is missing"
                    .into(),
            )
        })
    }

    #[cfg(target_os = "linux")]
    pub(super) fn read_fdinfo_mount_id(file: &File) -> Result<u64, Error> {
        #[cfg(test)]
        if let Some(record) = current_test_removal_injector()
            .and_then(|injector| injector.fdinfo_record(file.as_raw_fd()))
        {
            return parse_fdinfo_mount_id(&record.map_err(io)?);
        }
        let path = format!("/proc/self/fdinfo/{}", file.as_raw_fd());
        let mut record = Vec::with_capacity(MAX_FDINFO_RECORD_BYTES as usize + 1);
        File::open(path)
            .map_err(io)?
            .take(MAX_FDINFO_RECORD_BYTES + 1)
            .read_to_end(&mut record)
            .map_err(io)?;
        parse_fdinfo_mount_id(&record)
    }

    #[cfg(target_os = "linux")]
    fn statx_mount_attributes(file: &File) -> Result<(u64, u64), Error> {
        #[cfg(test)]
        if let Some(attributes) = current_test_removal_injector()
            .and_then(|injector| injector.statx_mount_attributes(file.as_raw_fd()))
        {
            return attributes.map_err(io);
        }
        fs::statx(
            file,
            "",
            AtFlags::EMPTY_PATH | AtFlags::NO_AUTOMOUNT,
            fs::StatxFlags::empty(),
        )
        .map(|statx| {
            (
                statx.stx_attributes_mask.bits(),
                statx.stx_attributes.bits(),
            )
        })
        .map_err(|error| io(error.into()))
    }

    #[cfg(target_os = "linux")]
    fn mount_crossing(parent: &File, child: &File) -> Result<bool, Error> {
        let mount_root = fs::StatxAttributes::MOUNT_ROOT.bits();
        match statx_mount_attributes(child) {
            Ok((mask, attributes)) if mask & mount_root != 0 => {
                return Ok(attributes & mount_root != 0);
            }
            Ok(_) => {}
            Err(Error::Io(error)) if error.raw_os_error() == Some(Errno::NOSYS.raw_os_error()) => {}
            Err(error) => return Err(error),
        }
        Ok(read_fdinfo_mount_id(parent)? != read_fdinfo_mount_id(child)?)
    }

    #[cfg(not(target_os = "linux"))]
    pub(super) fn mount_crossing(parent: &File, child: &File) -> Result<bool, Error> {
        mount_crossing_from(mount_path_evidence(parent), mount_path_evidence(child))
    }

    fn name(path: &Path) -> Result<&OsStr, Error> {
        path.file_name()
            .filter(|n| !n.as_bytes().is_empty())
            .ok_or_else(|| Error::InvalidInput("target must name a file".into()))
    }
    fn parent(path: &Path) -> &Path {
        path.parent().unwrap_or_else(|| Path::new("."))
    }
    fn open_dir_no_follow(path: &Path) -> Result<File, Error> {
        let initial = if path.is_absolute() {
            Path::new("/")
        } else {
            Path::new(".")
        };
        let mut dir = fs::openat(
            fs::CWD,
            initial,
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map(File::from)
        .map_err(|e| io(e.into()))?;
        for component in path.components() {
            match component {
                Component::RootDir | Component::CurDir => {}
                Component::Normal(component) => {
                    dir = fs::openat(
                        &dir,
                        component,
                        OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                        Mode::empty(),
                    )
                    .map(File::from)
                    .map_err(|e| io(e.into()))?
                }
                Component::ParentDir | Component::Prefix(_) => {
                    return Err(Error::InvalidInput(
                        "parent path may not contain traversal components".into(),
                    ))
                }
            }
        }
        Ok(dir)
    }
    pub(super) fn open_parent(path: &Path) -> Result<File, Error> {
        open_dir_no_follow(parent(path))
    }
    fn missing(error: &rustix::io::Errno) -> bool {
        *error == Errno::NOENT
    }
    fn target_stat(dir: &File, target: &OsStr) -> Result<Option<fs::Stat>, Error> {
        match fs::statat(dir, target, AtFlags::SYMLINK_NOFOLLOW) {
            Ok(stat) => Ok(Some(stat)),
            Err(error) if missing(&error) => Ok(None),
            Err(error) => Err(io(error.into())),
        }
    }
    fn regular(stat: &fs::Stat) -> bool {
        FileType::from_raw_mode(stat.st_mode) == FileType::RegularFile
    }
    fn same_inode(left: &fs::Stat, right: &fs::Stat) -> bool {
        raw_stat_identity(left) == raw_stat_identity(right)
    }
    fn temp_name() -> std::ffi::OsString {
        #[cfg(test)]
        if let Some(name) = TEST_TEMP_NAMES.with(|names| names.borrow_mut().pop()) {
            return name;
        }
        format!(".atomic-{}", uuid::Uuid::new_v4()).into()
    }
    #[cfg(test)]
    std::thread_local! {
        static TEST_TEMP_NAMES: std::cell::RefCell<Vec<std::ffi::OsString>> =
            const { std::cell::RefCell::new(Vec::new()) };
    }
    #[cfg(test)]
    pub(super) struct TestTempNamesGuard(Vec<std::ffi::OsString>);
    #[cfg(test)]
    impl Drop for TestTempNamesGuard {
        fn drop(&mut self) {
            let previous = std::mem::take(&mut self.0);
            TEST_TEMP_NAMES.with(|names| *names.borrow_mut() = previous);
        }
    }
    #[cfg(test)]
    pub(super) fn scoped_test_temp_names(names: Vec<std::ffi::OsString>) -> TestTempNamesGuard {
        let previous = TEST_TEMP_NAMES.with(|current| current.replace(names));
        TestTempNamesGuard(previous)
    }
    fn cleanup(dir: &File, temp: &OsStr, primary: Error) -> Error {
        #[cfg(test)]
        let injected = inject_atomic_file(AtomicFileFaultPoint::Cleanup).err();
        #[cfg(not(test))]
        let injected: Option<Error> = None;
        let unlink = fs::unlinkat(dir, temp, AtFlags::empty())
            .err()
            .map(|error| io(error.into()));
        match injected.or(unlink) {
            None => primary,
            Some(cleanup) => {
                log::error!(
                    "atomic replacement failed: {primary}; temporary cleanup failed: {cleanup}"
                );
                Error::OperationAndCleanup {
                    primary: primary.to_string(),
                    cleanup: cleanup.to_string(),
                }
            }
        }
    }

    struct UnixAdapter;

    impl AtomicReplaceAdapter for UnixAdapter {
        type Target = fs::Stat;

        fn target_stat(&self, dir: &File, target: &OsStr) -> Result<Option<Self::Target>, Error> {
            target_stat(dir, target)
        }

        fn is_regular(&self, target: &Self::Target) -> bool {
            regular(target)
        }

        fn target_identity(&self, target: &Self::Target) -> (u64, u64) {
            raw_stat_identity(target)
        }

        fn create_temp(
            &self,
            dir: &File,
            _original: Option<&Self::Target>,
        ) -> Result<(OsString, File), Error> {
            let created = (0..16)
                .find_map(|_| {
                    let candidate = temp_name();
                    match fs::openat(
                        dir,
                        &candidate,
                        OFlags::CREATE
                            | OFlags::EXCL
                            | OFlags::WRONLY
                            | OFlags::NOFOLLOW
                            | OFlags::CLOEXEC,
                        Mode::from_raw_mode(0o600),
                    ) {
                        Ok(fd) => Some(Ok((candidate, File::from(fd)))),
                        Err(error) if error == Errno::EXIST => None,
                        Err(error) => Some(Err(io(error.into()))),
                    }
                })
                .transpose()?
                .ok_or_else(|| {
                    Error::Conflict(
                        "could not allocate a unique private temporary file after 16 attempts"
                            .into(),
                    )
                })?;
            Ok(created)
        }

        fn before_write(
            &self,
            _dir: &File,
            _temp: &File,
            _original: Option<&Self::Target>,
        ) -> Result<(), Error> {
            Ok(())
        }

        fn finalize_metadata(
            &self,
            temp: &mut File,
            original: Option<&Self::Target>,
        ) -> Result<(), Error> {
            let final_mode = original.map_or(0o600, |stat| stat.st_mode & 0o7777);
            fs::fchmod(&mut *temp, Mode::from_raw_mode(final_mode))
                .map_err(|error| io(error.into()))?;
            let result = temp.sync_all().map_err(io);
            record_durability("temp.sync_all:metadata");
            result
        }

        fn rename(
            &self,
            dir: &File,
            _temp: &mut File,
            temp_name: &OsStr,
            target: &OsStr,
            replace: bool,
        ) -> Result<(), Error> {
            if replace {
                fs::renameat(dir, temp_name, dir, target).map_err(|error| io(error.into()))
            } else {
                fs::renameat_with(dir, temp_name, dir, target, RenameFlags::NOREPLACE)
                    .map_err(|error| io(error.into()))
            }
        }

        fn metadata(&self, temp: &File) -> Result<TempMetadata, std::io::Error> {
            let stat = fs::fstat(temp)
                .map_err(|error| std::io::Error::from_raw_os_error(error.raw_os_error()))?;
            record_durability("temp.metadata");
            Ok(TempMetadata {
                identity: raw_stat_identity(&stat),
                ctime_nanos: i128::from(stat.st_ctime) * 1_000_000_000
                    + i128::from(stat.st_ctime_nsec),
            })
        }

        fn cleanup(
            &self,
            dir: &File,
            temp_name: &OsStr,
            _temp: &mut File,
            primary: Error,
        ) -> Error {
            cleanup(dir, temp_name, primary)
        }
    }

    pub(super) fn replace<F, P>(
        target: &Path,
        precommit: P,
        write_fn: F,
    ) -> Result<AtomicInstalledFile, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
        P: FnOnce() -> Result<(), Error>,
    {
        #[cfg(test)]
        inject_atomic_file(AtomicFileFaultPoint::ParentOpen)?;
        let dir = open_parent(target)?;
        let dir_identity = dir.metadata().map_err(io)?;
        let logical_parent = parent(target).to_path_buf();
        let target_name = name(target)?.to_os_string();
        replace_at_driver(
            UnixAdapter,
            dir,
            target_name,
            move || {
                let current = open_dir_no_follow(&logical_parent)?;
                let metadata = current.metadata().map_err(io)?;
                if metadata.dev() != dir_identity.dev() || metadata.ino() != dir_identity.ino() {
                    return Err(Error::Conflict(
                        "parent directory changed concurrently".into(),
                    ));
                }
                precommit()
            },
            write_fn,
        )
    }

    pub(super) fn replace_at<F, P>(
        dir: File,
        target_name: OsString,
        precommit: P,
        write_fn: F,
    ) -> Result<AtomicInstalledFile, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
        P: FnOnce() -> Result<(), Error>,
    {
        replace_at_driver(UnixAdapter, dir, target_name, precommit, write_fn)
    }

    fn sync_tree(dir: &File, depth: usize) -> Result<(), Error> {
        walk_directory(dir, |bytes, _ino| {
            let name = std::ffi::OsString::from_vec(bytes.to_vec());
            let stat =
                fs::statat(dir, &name, AtFlags::SYMLINK_NOFOLLOW).map_err(|e| io(e.into()))?;
            if depth.saturating_add(1) >= MAX_REMOVE_TREE_DEPTH {
                return Err(Error::ResourceLimit(format!(
                    "directory install exceeded {MAX_REMOVE_TREE_DEPTH} levels"
                )));
            }
            match FileType::from_raw_mode(stat.st_mode) {
                FileType::RegularFile => File::from(
                    fs::openat(
                        dir,
                        &name,
                        OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                        Mode::empty(),
                    )
                    .map_err(|e| io(e.into()))?,
                )
                .sync_all()
                .map_err(io)?,
                FileType::Directory => {
                    let child = File::from(
                        fs::openat(
                            dir,
                            &name,
                            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                            Mode::empty(),
                        )
                        .map_err(|e| io(e.into()))?,
                    );
                    sync_tree(&child, depth + 1)?;
                }
                _ => {
                    return Err(Error::InvalidInput(
                        "directory install rejects links and special files".into(),
                    ))
                }
            }
            Ok(())
        })?;
        ensure_directory_not_removed(dir)?;
        dir.sync_all().map_err(io)
    }

    pub(super) fn remove_tree_at(
        parent: &File,
        name: &OsStr,
        expected: (u64, u64),
        depth: usize,
        parent_dev: u64,
        removed_entries: &mut usize,
    ) -> Result<(), Error> {
        if depth >= MAX_REMOVE_TREE_DEPTH {
            return Err(Error::ResourceLimit(format!(
                "directory cleanup exceeded {MAX_REMOVE_TREE_DEPTH} levels"
            )));
        }
        let stat = fs::statat(parent, name, AtFlags::SYMLINK_NOFOLLOW).map_err(|e| io(e.into()))?;
        // The identity check lives in each arm rather than here, because the directory arm must
        // let the mount check answer first: a cross-device mount differs from `expected` in
        // `st_dev`, and "refuses to cross a mount" is the true reason, not "changed concurrently".
        match FileType::from_raw_mode(stat.st_mode) {
            FileType::RegularFile => {
                if raw_stat_identity(&stat) != expected {
                    return Err(Error::Conflict(
                        "directory cleanup entry changed concurrently".into(),
                    ));
                }
                // There is no inode-conditional unlink here: a final name substitution can only
                // reach the kernel's type-confined `unlinkat` behavior, never an outside target.
                fs::unlinkat(parent, name, AtFlags::empty()).map_err(|e| io(e.into()))?;
                *removed_entries += 1;
                #[cfg(test)]
                inject_removal(RemovalFaultPoint::AfterEntryRemoved)?;
                Ok(())
            }
            FileType::Directory => {
                #[cfg(test)]
                let compared_parent_dev = if depth == 0 {
                    parent_dev
                } else {
                    inject_removal(RemovalFaultPoint::BeforeChildOpen)?.unwrap_or(parent_dev)
                };
                #[cfg(not(test))]
                let compared_parent_dev = parent_dev;
                let child = File::from(
                    fs::openat(
                        parent,
                        name,
                        OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                        Mode::empty(),
                    )
                    .map_err(|e| io(e.into()))?,
                );
                let opened = fs::fstat(&child).map_err(|e| io(e.into()))?;
                if !same_inode(&opened, &stat) {
                    return Err(Error::Conflict(
                        "directory cleanup entry changed concurrently".into(),
                    ));
                }
                // `MOUNT_ROOT` requires Linux 5.8. When the bit is unavailable, or `statx`
                // returns `NOSYS`, descriptor mount IDs provide the required evidence. Failure to
                // read or strictly parse either bounded fdinfo record refuses destructive descent.
                let opened_identity = raw_stat_identity(&opened);
                let is_mount = if opened_identity.0 != compared_parent_dev {
                    true
                } else {
                    match mount_crossing(parent, &child) {
                        Ok(is_mount) => is_mount,
                        Err(error) => {
                            log::warn!("recursive delete cannot establish mount identity: {error}");
                            return Err(error);
                        }
                    }
                };
                if is_mount {
                    log::warn!("recursive delete stopped at a mount point");
                    return Err(Error::InvalidInput(
                        "directory cleanup refuses to cross a mount".into(),
                    ));
                }
                if raw_stat_identity(&stat) != expected {
                    return Err(Error::Conflict(
                        "directory cleanup entry changed concurrently".into(),
                    ));
                }
                walk_directory(&child, |bytes, ino| {
                    #[cfg(test)]
                    inject_removal(RemovalFaultPoint::BeforeChildStat)?;
                    remove_tree_at(
                        &child,
                        OsStr::from_bytes(bytes),
                        (opened_identity.0, ino),
                        depth + 1,
                        opened_identity.0,
                        removed_entries,
                    )
                })?;
                ensure_directory_not_removed(&child)?;
                // The descriptor pins the traversed directory, but this walk has no
                // inode-conditional unlink. The parent-relative terminal lookup remains
                // type-confined by `REMOVEDIR`; it can still name a concurrently substituted
                // directory.
                fs::unlinkat(parent, name, AtFlags::REMOVEDIR).map_err(|e| io(e.into()))?;
                *removed_entries += 1;
                #[cfg(test)]
                inject_removal(RemovalFaultPoint::AfterEntryRemoved)?;
                Ok(())
            }
            _ => Err(Error::InvalidInput(
                "directory cleanup rejects links and special files".into(),
            )),
        }
    }

    pub(super) fn install_dir(source: &Path, target: &Path) -> Result<(), Error> {
        #[cfg(test)]
        inject_atomic_dir(AtomicDirFaultPoint::SyncEntry)?;
        let parent_dir = open_parent(target)?;
        let source_parent = open_parent(source)?;
        let parent_meta = parent_dir.metadata().map_err(io)?;
        let source_parent_meta = source_parent.metadata().map_err(io)?;
        if parent_meta.dev() != source_parent_meta.dev()
            || parent_meta.ino() != source_parent_meta.ino()
        {
            return Err(Error::InvalidInput(
                "directory staging source must be in the target's real parent directory".into(),
            ));
        }
        let source_name = name(source)?;
        let target_name = name(target)?;
        let source_stat = target_stat(&parent_dir, source_name)?
            .ok_or_else(|| Error::InvalidInput("directory staging source does not exist".into()))?;
        if FileType::from_raw_mode(source_stat.st_mode) != FileType::Directory {
            return Err(Error::InvalidInput(
                "directory staging source must be a real directory".into(),
            ));
        }
        let source_dir = File::from(
            fs::openat(
                &parent_dir,
                source_name,
                OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::empty(),
            )
            .map_err(|e| io(e.into()))?,
        );
        sync_tree(&source_dir, 0)?;
        let original = match target_stat(&parent_dir, target_name)? {
            Some(stat) if FileType::from_raw_mode(stat.st_mode) == FileType::Directory => {
                Some(stat)
            }
            Some(_) => {
                return Err(Error::InvalidInput(
                    "directory target must be a real directory".into(),
                ))
            }
            None => None,
        };
        #[cfg(test)]
        inject_atomic_dir(AtomicDirFaultPoint::PreCommit)?;
        let current_parent = open_parent(target)?.metadata().map_err(io)?;
        if current_parent.dev() != parent_meta.dev() || current_parent.ino() != parent_meta.ino() {
            return Err(Error::Conflict(
                "directory parent changed concurrently".into(),
            ));
        }
        match target_stat(&parent_dir, source_name)? {
            Some(stat) if same_inode(&source_stat, &stat) => {}
            _ => {
                return Err(Error::Conflict(
                    "directory staging source changed concurrently".into(),
                ))
            }
        }
        match (original.as_ref(), target_stat(&parent_dir, target_name)?) {
            (None, None) => {}
            (None, Some(_)) => {
                return Err(Error::Conflict(
                    "directory target was created concurrently".into(),
                ))
            }
            (Some(_), None) => {
                return Err(Error::Conflict(
                    "directory target was deleted concurrently".into(),
                ))
            }
            (Some(expected), Some(actual))
                if FileType::from_raw_mode(actual.st_mode) == FileType::Directory
                    && same_inode(expected, &actual) => {}
            _ => {
                return Err(Error::Conflict(
                    "directory target changed concurrently".into(),
                ))
            }
        }
        #[cfg(test)]
        inject_atomic_dir(AtomicDirFaultPoint::BackupRename)?;
        #[cfg(test)]
        inject_atomic_dir(AtomicDirFaultPoint::InstallRename)?;
        if original.is_some() {
            fs::renameat_with(
                &parent_dir,
                source_name,
                &parent_dir,
                target_name,
                RenameFlags::EXCHANGE,
            )
            .map_err(|e| io(e.into()))?;
        } else {
            fs::renameat_with(
                &parent_dir,
                source_name,
                &parent_dir,
                target_name,
                RenameFlags::NOREPLACE,
            )
            .map_err(|e| io(e.into()))?;
        }
        #[cfg(test)]
        if let Err(error) = inject_atomic_dir(AtomicDirFaultPoint::ParentSync) {
            log::warn!("directory installation parent sync failed: {error}");
            return Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::DirectoryInstall,
            ));
        }
        if let Err(error) = parent_dir.sync_all() {
            log::warn!("directory installation parent sync failed: {error}");
            return Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::DirectoryInstall,
            ));
        }
        if let Some(original) = original.as_ref() {
            #[cfg(test)]
            if let Err(error) = inject_atomic_dir(AtomicDirFaultPoint::BackupCleanup) {
                log::error!(
                    "directory installed but old tree cleanup at {} failed: {error}",
                    source.display()
                );
                return Err(Error::CommittedDurabilityUncertain(
                    crate::error::DurabilityStage::OldDirectoryCleanup,
                ));
            }
            let mut removed_entries = 0;
            if let Err(error) = remove_tree_at(
                &parent_dir,
                source_name,
                raw_stat_identity(original),
                0,
                parent_meta.dev(),
                &mut removed_entries,
            ) {
                log::error!(
                    "directory installed but old tree cleanup at {} failed: {error}",
                    source.display()
                );
                return Err(Error::CommittedDurabilityUncertain(
                    crate::error::DurabilityStage::OldDirectoryCleanup,
                ));
            }
            if let Err(error) = parent_dir.sync_all() {
                log::warn!("old directory cleanup parent sync failed: {error}");
                return Err(Error::CommittedDurabilityUncertain(
                    crate::error::DurabilityStage::OldDirectoryCleanupSync,
                ));
            }
        }
        Ok(())
    }
}

#[cfg(windows)]
mod win {
    use super::*;
    use crate::infra::path_authority::{
        is_reparse_point, open_windows_child, opened_file_identity, windows_open_status_error,
    };
    use std::{
        ffi::OsStr,
        fs::{File, OpenOptions},
        os::windows::{
            ffi::{OsStrExt, OsStringExt},
            fs::OpenOptionsExt,
            io::{AsRawHandle, FromRawHandle, RawHandle},
        },
        path::{Component, Path, PathBuf},
        ptr::{null, null_mut},
    };
    use windows_sys::{
        Wdk::{
            Foundation::OBJECT_ATTRIBUTES,
            Storage::FileSystem::{
                FileDispositionInformation, FileDispositionInformationEx,
                FileIdBothDirectoryInformation, FileRenameInformationEx, NtCreateFile,
                NtQueryDirectoryFile, NtSetInformationFile, FILE_CREATE, FILE_DISPOSITION_DELETE,
                FILE_DISPOSITION_IGNORE_READONLY_ATTRIBUTE, FILE_DISPOSITION_INFORMATION,
                FILE_DISPOSITION_INFORMATION_EX, FILE_DISPOSITION_POSIX_SEMANTICS,
                FILE_ID_BOTH_DIR_INFORMATION, FILE_NON_DIRECTORY_FILE, FILE_OPEN,
                FILE_OPEN_REPARSE_POINT, FILE_RENAME_IGNORE_READONLY_ATTRIBUTE,
                FILE_RENAME_INFORMATION, FILE_RENAME_POSIX_SEMANTICS,
                FILE_RENAME_REPLACE_IF_EXISTS, FILE_SYNCHRONOUS_IO_NONALERT,
            },
        },
        Win32::{
            // The NTSTATUS constants and RtlNtStatusToDosError live with the single classifier
            // in path_authority::windows_open_status_error, which this module now routes to.
            Foundation::{HANDLE, STATUS_BUFFER_OVERFLOW, STATUS_NO_MORE_FILES, UNICODE_STRING},
            Security::{
                AddAccessAllowedAce, CreateWellKnownSid, GetKernelObjectSecurity, InitializeAcl,
                InitializeSecurityDescriptor, SetKernelObjectSecurity,
                SetSecurityDescriptorControl, SetSecurityDescriptorDacl, WinCreatorOwnerSid,
                ACCESS_ALLOWED_ACE, ACL, ACL_REVISION, DACL_SECURITY_INFORMATION,
                PSECURITY_DESCRIPTOR, PSID, SECURITY_DESCRIPTOR, SECURITY_MAX_SID_SIZE,
                SE_DACL_PROTECTED,
            },
            Storage::FileSystem::{
                GetFileType, DELETE, FILE_ALL_ACCESS, FILE_ATTRIBUTE_DIRECTORY,
                FILE_ATTRIBUTE_NORMAL, FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_BACKUP_SEMANTICS,
                FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
                FILE_TYPE_DISK, READ_CONTROL, SYNCHRONIZE, WRITE_DAC,
            },
            System::{SystemServices::SECURITY_DESCRIPTOR_REVISION, IO::IO_STATUS_BLOCK},
        },
    };
    // Only `test_security_descriptor_is_creator_only` reads a DACL back, so importing these
    // unconditionally makes them unused imports in a release build.
    #[cfg(test)]
    use windows_sys::Win32::Security::{EqualSid, GetAce, GetSecurityDescriptorDacl};

    const OBJ_CASE_INSENSITIVE: u32 = 0x40;
    const OBJ_DONT_REPARSE: u32 = 0x1000;
    const FILE_SHARE_PRIVATE_TEMP: u32 = FILE_SHARE_WRITE;
    const TEMP_ACCESS: u32 = DELETE
        | SYNCHRONIZE
        | windows_sys::Win32::Foundation::GENERIC_READ
        | windows_sys::Win32::Foundation::GENERIC_WRITE
        | READ_CONTROL
        | WRITE_DAC;
    pub(super) const TARGET_ACCESS: u32 =
        DELETE | SYNCHRONIZE | windows_sys::Win32::Foundation::GENERIC_READ | READ_CONTROL;
    const DIRECTORY_READ_ACCESS: u32 =
        SYNCHRONIZE | windows_sys::Win32::Foundation::GENERIC_READ | READ_CONTROL;
    const DIRECTORY_ACCESS: u32 =
        DIRECTORY_READ_ACCESS | windows_sys::Win32::Foundation::GENERIC_WRITE;
    pub(crate) const MAX_REMOVE_TREE_DEPTH: usize = 64;
    const DIRECTORY_ENUMERATION_START_BYTES: usize = 8192;
    const DIRECTORY_ENUMERATION_MAX_BYTES: usize = 1024 * 1024;
    const DIRECTORY_ENUMERATION_OVERFLOW_RETRIES: u8 = 8;

    // Exposed through `type Target = Target` in the pub(super) AtomicReplaceAdapter impl below,
    // so it may not be more private than that impl (E0446 on the Windows target).
    pub(super) struct Target {
        handle: File,
        identity: (u64, u64),
    }

    struct PrivateSecurityDescriptor {
        descriptor: SECURITY_DESCRIPTOR,
        _acl: Vec<u8>,
    }

    impl PrivateSecurityDescriptor {
        fn new(access: u32) -> Result<Self, Error> {
            let mut sid = vec![0_u8; SECURITY_MAX_SID_SIZE as usize];
            let mut sid_length = sid.len() as u32;
            let created = unsafe {
                CreateWellKnownSid(
                    WinCreatorOwnerSid,
                    null_mut(),
                    sid.as_mut_ptr() as PSID,
                    &mut sid_length,
                )
            };
            if created == 0 {
                return Err(std::io::Error::last_os_error().into());
            }

            let acl_length = std::mem::size_of::<ACL>() + std::mem::size_of::<ACCESS_ALLOWED_ACE>()
                - std::mem::size_of::<u32>()
                + sid_length as usize;
            let mut acl = vec![0_u8; acl_length];
            let acl_ptr = acl.as_mut_ptr() as *mut ACL;
            if unsafe { InitializeAcl(acl_ptr, acl_length as u32, ACL_REVISION) } == 0 {
                return Err(std::io::Error::last_os_error().into());
            }
            if unsafe {
                AddAccessAllowedAce(acl_ptr, ACL_REVISION, access, sid.as_mut_ptr() as PSID)
            } == 0
            {
                return Err(std::io::Error::last_os_error().into());
            }

            let mut descriptor = SECURITY_DESCRIPTOR::default();
            // PSECURITY_DESCRIPTOR is `*mut c_void`, so `&mut SECURITY_DESCRIPTOR` does not
            // coerce; every descriptor argument in this module is cast explicitly.
            let descriptor_ptr =
                (&mut descriptor as *mut SECURITY_DESCRIPTOR) as PSECURITY_DESCRIPTOR;
            if unsafe { InitializeSecurityDescriptor(descriptor_ptr, SECURITY_DESCRIPTOR_REVISION) }
                == 0
            {
                return Err(std::io::Error::last_os_error().into());
            }
            if unsafe { SetSecurityDescriptorDacl(descriptor_ptr, 1, acl_ptr, 0) } == 0 {
                return Err(std::io::Error::last_os_error().into());
            }
            // Supplying a DACL for a new object does not by itself keep the parent directory's
            // inheritable ACEs out of it: Windows merges them in unless the descriptor is marked
            // protected. Without this, a parent carrying an inheritable grant would hand that
            // access to the "creator-only" temporary, which is the one property it must have.
            if unsafe {
                SetSecurityDescriptorControl(descriptor_ptr, SE_DACL_PROTECTED, SE_DACL_PROTECTED)
            } == 0
            {
                return Err(std::io::Error::last_os_error().into());
            }
            Ok(Self {
                descriptor,
                _acl: acl,
            })
        }

        fn as_ptr(&self) -> *const SECURITY_DESCRIPTOR {
            &self.descriptor
        }
    }

    pub(super) struct WindowsAdapter;

    fn as_io(error: Error) -> std::io::Error {
        match error {
            Error::Io(error) => *error,
            other => std::io::Error::other(other.to_string()),
        }
    }

    fn missing(error: &Error) -> bool {
        matches!(
            error,
            Error::Io(error) if matches!(error.raw_os_error(), Some(2 | 3))
        )
    }

    fn open_target(dir: &File, name: &OsStr) -> Result<File, Error> {
        open_windows_child(dir, name, FILE_OPEN, TARGET_ACCESS, null(), false, true)
    }

    fn target_stat(dir: &File, name: &OsStr) -> Result<Option<Target>, Error> {
        let handle = match open_target(dir, name) {
            Ok(handle) => handle,
            Err(error) if missing(&error) => return Ok(None),
            Err(error) => return Err(error),
        };
        let identity = opened_file_identity(&handle)?;
        Ok(Some(Target { handle, identity }))
    }

    fn target_regular(target: &Target) -> bool {
        // FILE_NON_DIRECTORY_FILE only excludes directories: devices, volumes, pipes and mailslots
        // are all "non-directory" objects and were accepted here, so the driver's "target must be
        // a regular file, not a link or special file" guard was vacuous on Windows while the unix
        // arm really checked. FILE_TYPE_DISK is what separates a file on disk from those.
        unsafe { GetFileType(target.handle.as_raw_handle() as HANDLE) == FILE_TYPE_DISK }
    }

    fn temp_name() -> OsString {
        #[cfg(test)]
        if let Some(name) = TEST_TEMP_NAMES.with(|names| names.borrow_mut().pop()) {
            return name;
        }
        format!(".atomic-{}", uuid::Uuid::new_v4()).into()
    }

    #[cfg(test)]
    std::thread_local! {
        static TEST_TEMP_NAMES: std::cell::RefCell<Vec<OsString>> =
            const { std::cell::RefCell::new(Vec::new()) };
    }

    #[cfg(test)]
    pub(super) struct TestTempNamesGuard(Vec<OsString>);

    #[cfg(test)]
    impl Drop for TestTempNamesGuard {
        fn drop(&mut self) {
            let previous = std::mem::take(&mut self.0);
            TEST_TEMP_NAMES.with(|names| *names.borrow_mut() = previous);
        }
    }

    #[cfg(test)]
    pub(super) fn scoped_test_temp_names(names: Vec<OsString>) -> TestTempNamesGuard {
        let previous = TEST_TEMP_NAMES.with(|current| current.replace(names));
        TestTempNamesGuard(previous)
    }

    fn capture_security_descriptor(file: &File) -> Result<Vec<u8>, Error> {
        let mut required = 0_u32;
        unsafe {
            GetKernelObjectSecurity(
                file.as_raw_handle() as HANDLE,
                DACL_SECURITY_INFORMATION,
                null_mut(),
                0,
                &mut required,
            );
        }
        if required == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        let mut descriptor = vec![0_u8; required as usize];
        let result = unsafe {
            GetKernelObjectSecurity(
                file.as_raw_handle() as HANDLE,
                DACL_SECURITY_INFORMATION,
                descriptor.as_mut_ptr() as PSECURITY_DESCRIPTOR,
                required,
                &mut required,
            )
        };
        if result == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        Ok(descriptor)
    }

    fn apply_security_descriptor(
        file: &File,
        descriptor: PSECURITY_DESCRIPTOR,
    ) -> Result<(), Error> {
        let result = unsafe {
            SetKernelObjectSecurity(
                file.as_raw_handle() as HANDLE,
                DACL_SECURITY_INFORMATION,
                descriptor,
            )
        };
        if result == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        Ok(())
    }

    fn open_temp_child(
        dir: &File,
        name: &OsStr,
        security_descriptor: &PrivateSecurityDescriptor,
    ) -> Result<File, Error> {
        let mut wide: Vec<u16> = name.encode_wide().collect();
        let unicode = UNICODE_STRING {
            Length: (wide.len() * 2) as u16,
            MaximumLength: (wide.len() * 2) as u16,
            Buffer: wide.as_mut_ptr(),
        };
        let attributes = OBJECT_ATTRIBUTES {
            Length: std::mem::size_of::<OBJECT_ATTRIBUTES>() as u32,
            RootDirectory: dir.as_raw_handle() as HANDLE,
            ObjectName: &unicode,
            Attributes: OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
            SecurityDescriptor: security_descriptor.as_ptr(),
            SecurityQualityOfService: null(),
        };
        let mut handle: HANDLE = null_mut();
        let mut status: IO_STATUS_BLOCK = unsafe { std::mem::zeroed() };
        let status = unsafe {
            NtCreateFile(
                &mut handle,
                TEMP_ACCESS,
                &attributes,
                &mut status,
                null_mut(),
                FILE_ATTRIBUTE_NORMAL,
                FILE_SHARE_PRIVATE_TEMP,
                FILE_CREATE,
                FILE_NON_DIRECTORY_FILE | FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
                null(),
                0,
            )
        };
        if status != 0 {
            return Err(windows_open_status_error(status));
        }
        Ok(unsafe { File::from_raw_handle(handle as RawHandle) })
    }

    fn create_temp(dir: &File, _original: Option<&Target>) -> Result<(OsString, File), Error> {
        let security_descriptor = PrivateSecurityDescriptor::new(FILE_ALL_ACCESS)?;
        (0..16)
            .find_map(|_| {
                let candidate = temp_name();
                match open_temp_child(dir, &candidate, &security_descriptor) {
                    Ok(file) => Some(Ok((candidate, file))),
                    Err(Error::Conflict(message)) if message == "Windows object name collision" => {
                        None
                    }
                    Err(error) => Some(Err(error)),
                }
            })
            .transpose()?
            .ok_or_else(|| {
                Error::Conflict(
                    "could not allocate a unique private temporary file after 16 attempts".into(),
                )
            })
    }

    pub(super) fn rename_child(
        dir: &File,
        temp: &mut File,
        _temp_name: &OsStr,
        target: &OsStr,
        replace: bool,
    ) -> Result<(), Error> {
        super::single_leaf(target)?;
        // FILE_RENAME_INFORMATION is a variable-length structure: FileName is declared [u16; 1]
        // but carries the whole leaf, so it cannot be written as a plain value and the buffer is
        // laid out by hand. The offsets are taken from the crate's own struct rather than spelled
        // as literals, so the compiler derives them and a layout change cannot silently desync.
        const ROOT_DIRECTORY_OFFSET: usize =
            std::mem::offset_of!(FILE_RENAME_INFORMATION, RootDirectory);
        const FILE_NAME_LENGTH_OFFSET: usize =
            std::mem::offset_of!(FILE_RENAME_INFORMATION, FileNameLength);
        const FILE_NAME_OFFSET: usize = std::mem::offset_of!(FILE_RENAME_INFORMATION, FileName);

        let wide: Vec<u16> = target.encode_wide().collect();
        let name_bytes = wide.len() * std::mem::size_of::<u16>();
        let buffer_len = FILE_NAME_OFFSET + name_bytes;
        let mut buffer = vec![0_u8; buffer_len];
        let flags = if replace {
            FILE_RENAME_REPLACE_IF_EXISTS
                | FILE_RENAME_POSIX_SEMANTICS
                | FILE_RENAME_IGNORE_READONLY_ATTRIBUTE
        } else {
            FILE_RENAME_POSIX_SEMANTICS
        };
        unsafe {
            std::ptr::write_unaligned(buffer.as_mut_ptr().cast::<u32>(), flags);
            std::ptr::write_unaligned(
                buffer
                    .as_mut_ptr()
                    .add(ROOT_DIRECTORY_OFFSET)
                    .cast::<HANDLE>(),
                dir.as_raw_handle() as HANDLE,
            );
            std::ptr::write_unaligned(
                buffer
                    .as_mut_ptr()
                    .add(FILE_NAME_LENGTH_OFFSET)
                    .cast::<u32>(),
                name_bytes as u32,
            );
            std::ptr::copy_nonoverlapping(
                wide.as_ptr().cast::<u8>(),
                buffer.as_mut_ptr().add(FILE_NAME_OFFSET),
                name_bytes,
            );
        }
        let mut status_block: IO_STATUS_BLOCK = unsafe { std::mem::zeroed() };
        let status = unsafe {
            NtSetInformationFile(
                temp.as_raw_handle() as HANDLE,
                &mut status_block,
                buffer.as_ptr().cast(),
                buffer.len() as u32,
                FileRenameInformationEx,
            )
        };
        if status != 0 {
            return Err(windows_open_status_error(status));
        }
        Ok(())
    }

    fn delete_temp(temp: &File) -> Result<(), Error> {
        // FILE_DISPOSITION_INFORMATION is a single BOOLEAN DeleteFile; the struct says that,
        // where a bare [1_u8] left the reader to infer both the layout and the meaning.
        let disposition = FILE_DISPOSITION_INFORMATION { DeleteFile: true };
        let mut status_block: IO_STATUS_BLOCK = unsafe { std::mem::zeroed() };
        let status = unsafe {
            NtSetInformationFile(
                temp.as_raw_handle() as HANDLE,
                &mut status_block,
                std::ptr::addr_of!(disposition).cast(),
                std::mem::size_of::<FILE_DISPOSITION_INFORMATION>() as u32,
                FileDispositionInformation,
            )
        };
        if status != 0 {
            return Err(windows_open_status_error(status));
        }
        Ok(())
    }

    fn map_create_collision(error: Error) -> Error {
        match error {
            Error::Conflict(message) if message == "Windows object name collision" => Error::Io(
                Box::new(std::io::Error::from(std::io::ErrorKind::AlreadyExists)),
            ),
            other => other,
        }
    }

    fn missing_leaf(error: &Error) -> bool {
        matches!(
            error,
            Error::Io(error) if error.raw_os_error() == Some(2)
        )
    }

    fn is_reparse_refusal(error: &Error) -> bool {
        matches!(
            error,
            Error::InvalidInput(message) if message == "reparse points cannot be authorized"
        )
    }

    fn child_delete_access(directory: bool) -> u32 {
        if directory {
            DIRECTORY_ACCESS | DELETE
        } else {
            TARGET_ACCESS
        }
    }

    fn directory_open_access(writable: bool) -> u32 {
        if writable {
            DIRECTORY_ACCESS
        } else {
            DIRECTORY_READ_ACCESS
        }
    }

    fn regular_file_access(access: RegularFileAccess) -> u32 {
        let read = SYNCHRONIZE | READ_CONTROL | windows_sys::Win32::Foundation::GENERIC_READ;
        match access {
            RegularFileAccess::ReadOnly => read,
            RegularFileAccess::ReadWrite => read | windows_sys::Win32::Foundation::GENERIC_WRITE,
        }
    }

    fn type_mismatch(conflict: bool) -> Error {
        if conflict {
            Error::Conflict("workspace entry changed concurrently".into())
        } else {
            Error::InvalidInput("workspace entry has an unexpected file type".into())
        }
    }

    fn opened_is_disk(file: &File) -> bool {
        unsafe { GetFileType(file.as_raw_handle() as HANDLE) == FILE_TYPE_DISK }
    }

    fn open_expected_child(
        parent: &File,
        name: &OsStr,
        directory: bool,
        conflict: bool,
    ) -> Result<File, Error> {
        let access = if directory {
            DIRECTORY_READ_ACCESS
        } else {
            SYNCHRONIZE | READ_CONTROL | windows_sys::Win32::Foundation::GENERIC_READ
        };
        match open_windows_child(parent, name, FILE_OPEN, access, null(), directory, true) {
            Ok(file) => {
                if !directory && !opened_is_disk(&file) {
                    return Err(type_mismatch(conflict));
                }
                Ok(file)
            }
            Err(error) if is_reparse_refusal(&error) => Err(error),
            Err(error) => match open_windows_child(
                parent,
                name,
                FILE_OPEN,
                if directory {
                    SYNCHRONIZE | READ_CONTROL | windows_sys::Win32::Foundation::GENERIC_READ
                } else {
                    DIRECTORY_READ_ACCESS
                },
                null(),
                !directory,
                true,
            ) {
                Ok(_) => Err(type_mismatch(conflict)),
                Err(_) => Err(error),
            },
        }
    }

    fn unlink_posix(file: &File) -> Result<(), Error> {
        let disposition = FILE_DISPOSITION_INFORMATION_EX {
            Flags: FILE_DISPOSITION_DELETE
                | FILE_DISPOSITION_POSIX_SEMANTICS
                | FILE_DISPOSITION_IGNORE_READONLY_ATTRIBUTE,
        };
        let mut status_block: IO_STATUS_BLOCK = unsafe { std::mem::zeroed() };
        let status = unsafe {
            NtSetInformationFile(
                file.as_raw_handle() as HANDLE,
                &mut status_block,
                std::ptr::addr_of!(disposition).cast(),
                std::mem::size_of::<FILE_DISPOSITION_INFORMATION_EX>() as u32,
                FileDispositionInformationEx,
            )
        };
        if status != 0 {
            return Err(windows_open_status_error(status));
        }
        Ok(())
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub(super) enum EnumeratedKind {
        Directory,
        RegularFile,
        Other,
    }

    pub(super) struct EnumeratedEntry {
        pub name: OsString,
        pub identity: (u64, u64),
        pub kind: EnumeratedKind,
    }

    fn enumerated_kind(attributes: u32) -> EnumeratedKind {
        if attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            EnumeratedKind::Other
        } else if attributes & FILE_ATTRIBUTE_DIRECTORY != 0 {
            EnumeratedKind::Directory
        } else {
            EnumeratedKind::RegularFile
        }
    }

    /// Parses one `NtQueryDirectoryFile` page. `buffer` must be 8-byte aligned, which
    /// `enumerate_directory` guarantees by backing it with a `Vec<u64>`; the headers are
    /// read as references and `FILE_ID_BOTH_DIR_INFORMATION` has 8-byte alignment.
    fn parse_directory_page(
        buffer: &[u8],
        used: usize,
        volume: u64,
        entries: &mut Vec<EnumeratedEntry>,
    ) -> Result<(), Error> {
        const FILE_NAME_OFFSET: usize =
            std::mem::offset_of!(FILE_ID_BOTH_DIR_INFORMATION, FileName);
        let mut offset = 0usize;
        if used == 0 {
            return Ok(());
        }
        loop {
            if offset
                .checked_add(FILE_NAME_OFFSET)
                .is_none_or(|end| end > used)
            {
                return Err(Error::Io(Box::new(std::io::Error::other(
                    "directory enumeration entry is truncated",
                ))));
            }
            let header =
                unsafe { &*(buffer.as_ptr().add(offset) as *const FILE_ID_BOTH_DIR_INFORMATION) };
            let name_bytes = header.FileNameLength as usize;
            if !name_bytes.is_multiple_of(2)
                || offset
                    .checked_add(FILE_NAME_OFFSET)
                    .and_then(|start| start.checked_add(name_bytes))
                    .is_none_or(|end| end > used)
            {
                return Err(Error::Io(Box::new(std::io::Error::other(
                    "directory enumeration file name is truncated",
                ))));
            }
            let name_units = name_bytes / 2;
            let name = OsString::from_wide(unsafe {
                std::slice::from_raw_parts(
                    buffer.as_ptr().add(offset + FILE_NAME_OFFSET).cast::<u16>(),
                    name_units,
                )
            });
            if name != OsStr::new(".") && name != OsStr::new("..") {
                entries.push(EnumeratedEntry {
                    name,
                    identity: (volume, header.FileId as u64),
                    kind: enumerated_kind(header.FileAttributes),
                });
            }
            if header.NextEntryOffset == 0 {
                return Ok(());
            }
            let next = match offset.checked_add(header.NextEntryOffset as usize) {
                Some(next) if next > offset && next <= used => next,
                _ => {
                    return Err(Error::Io(Box::new(std::io::Error::other(
                        "directory enumeration next-entry offset is invalid",
                    ))));
                }
            };
            offset = next;
        }
    }

    pub(super) fn enumerate_directory(dir: &File) -> Result<Vec<EnumeratedEntry>, Error> {
        let volume = opened_file_identity(dir)?.0;
        let mut restart_scan = true;
        let mut buffer_len = DIRECTORY_ENUMERATION_START_BYTES;
        let mut overflow_retries = 0_u8;
        let mut entries = Vec::new();
        loop {
            // `FILE_ID_BOTH_DIR_INFORMATION` has 8-byte alignment and NT lays every
            // entry out 8-aligned relative to the buffer start, so the buffer itself
            // must be 8-aligned: a `Vec<u8>` only guarantees alignment 1, and forming
            // a reference to a header inside it would be undefined behaviour.
            let mut buffer = vec![0_u64; buffer_len.div_ceil(8)];
            let buffer_bytes = buffer.len() * 8;
            let mut status_block: IO_STATUS_BLOCK = unsafe { std::mem::zeroed() };
            let status = unsafe {
                NtQueryDirectoryFile(
                    dir.as_raw_handle() as HANDLE,
                    null_mut(),
                    None,
                    null(),
                    &mut status_block,
                    buffer.as_mut_ptr().cast(),
                    buffer_bytes as u32,
                    FileIdBothDirectoryInformation,
                    false,
                    null(),
                    restart_scan,
                )
            };
            if status == STATUS_NO_MORE_FILES {
                break;
            }
            if status == STATUS_BUFFER_OVERFLOW {
                overflow_retries = overflow_retries.saturating_add(1);
                if overflow_retries > DIRECTORY_ENUMERATION_OVERFLOW_RETRIES
                    || buffer_len >= DIRECTORY_ENUMERATION_MAX_BYTES
                {
                    return Err(Error::Io(Box::new(std::io::Error::other(
                        "directory enumeration buffer was exhausted",
                    ))));
                }
                buffer_len = buffer_len
                    .saturating_mul(2)
                    .min(DIRECTORY_ENUMERATION_MAX_BYTES);
                continue;
            }
            if status != 0 {
                return Err(windows_open_status_error(status));
            }
            overflow_retries = 0;
            let used = status_block.Information.min(buffer_bytes);
            // SAFETY: `buffer` owns `buffer_bytes` initialised bytes at 8-byte alignment.
            let page =
                unsafe { std::slice::from_raw_parts(buffer.as_ptr().cast::<u8>(), buffer_bytes) };
            parse_directory_page(page, used, volume, &mut entries)?;
            restart_scan = false;
        }
        Ok(entries)
    }

    #[allow(dead_code)]
    pub(super) fn open_writable_parent(path: &Path) -> Result<File, Error> {
        open_directory_path(path.parent().unwrap_or_else(|| Path::new(".")), true)
    }

    #[allow(dead_code)]
    pub(super) fn open_writable_leaf_directory(parent: &File, name: &OsStr) -> Result<File, Error> {
        open_windows_child(
            parent,
            name,
            FILE_OPEN,
            DIRECTORY_ACCESS,
            null(),
            true,
            true,
        )
    }

    pub(super) fn open_directory_child(
        parent: &File,
        name: &OsStr,
        writable: bool,
    ) -> Result<File, Error> {
        open_windows_child(
            parent,
            name,
            FILE_OPEN,
            directory_open_access(writable),
            null(),
            true,
            true,
        )
    }

    pub(super) fn create_dir_at(parent: &File, name: &OsStr) -> Result<(), Error> {
        drop(
            open_windows_child(
                parent,
                name,
                FILE_CREATE,
                DIRECTORY_ACCESS,
                null(),
                true,
                true,
            )
            .map_err(map_create_collision)?,
        );
        parent.sync_all()?;
        Ok(())
    }

    pub(super) fn entry_identity_at(
        parent: &File,
        name: &OsStr,
        dir: bool,
    ) -> Result<(u64, u64), Error> {
        let opened = open_expected_child(parent, name, dir, false)?;
        opened_file_identity(&opened)
    }

    pub(super) fn assert_entry_identity(
        parent: &File,
        name: &OsStr,
        expected: (u64, u64),
        dir: bool,
    ) -> Result<(), Error> {
        let opened = open_expected_child(parent, name, dir, true)?;
        if opened_file_identity(&opened)? != expected {
            return Err(Error::Conflict(
                "workspace entry changed concurrently".into(),
            ));
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub(super) fn open_regular_at(
        parent: &File,
        name: &OsStr,
        access: RegularFileAccess,
    ) -> Result<File, Error> {
        let opened = open_windows_child(
            parent,
            name,
            FILE_OPEN,
            regular_file_access(access),
            null(),
            false,
            true,
        )?;
        if !opened_is_disk(&opened) {
            return Err(Error::InvalidInput("target must be a regular file".into()));
        }
        Ok(opened)
    }

    #[allow(dead_code)]
    pub(super) fn create_regular_at(
        parent: &File,
        name: &OsStr,
    ) -> Result<(File, (u64, u64)), Error> {
        let created = open_windows_child(
            parent,
            name,
            FILE_CREATE,
            regular_file_access(RegularFileAccess::ReadWrite),
            null(),
            false,
            true,
        )
        .map_err(map_create_collision)?;
        if !opened_is_disk(&created) {
            return Err(Error::InvalidInput(
                "created database must be a regular file".into(),
            ));
        }
        let identity = opened_file_identity(&created)?;
        Ok((created, identity))
    }

    #[allow(dead_code)]
    pub(super) fn open_verified_parent(
        path: &Path,
        expected: (u64, u64),
        directory: bool,
    ) -> Result<(File, OsString), Error> {
        let parent = open_writable_parent(path)?;
        let leaf = path
            .file_name()
            .filter(|name| !name.is_empty())
            .ok_or_else(|| Error::InvalidInput("workspace entry needs a leaf name".into()))?
            .to_os_string();
        let opened = open_expected_child(&parent, &leaf, directory, true)?;
        if opened_file_identity(&opened)? != expected {
            return Err(Error::Conflict(
                "workspace entry changed concurrently".into(),
            ));
        }
        Ok((parent, leaf))
    }

    #[allow(dead_code)]
    pub(super) fn open_writable_verified_directory(
        path: &Path,
        expected: (u64, u64),
    ) -> Result<VerifiedDir, Error> {
        let (parent, leaf) = open_verified_parent(path, expected, true)?;
        let opened = open_writable_leaf_directory(&parent, &leaf)?;
        VerifiedDir::new(opened, expected)
    }

    pub(super) fn rename_entry_at(
        source_parent: &File,
        source: &OsStr,
        expected: (u64, u64),
        source_is_dir: bool,
        target_parent: &File,
        target: &OsStr,
    ) -> Result<(), Error> {
        assert_entry_identity(source_parent, source, expected, source_is_dir)?;
        let mut opened = open_windows_child(
            source_parent,
            source,
            FILE_OPEN,
            child_delete_access(source_is_dir),
            null(),
            source_is_dir,
            true,
        )?;
        if opened_file_identity(&opened)? != expected {
            return Err(Error::Conflict(
                "workspace entry changed concurrently".into(),
            ));
        }
        rename_child(target_parent, &mut opened, source, target, false)?;
        source_parent.sync_all()?;
        if opened_file_identity(source_parent)? != opened_file_identity(target_parent)? {
            target_parent.sync_all()?;
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub(super) fn rename_optional_regular_at(
        source_parent: &File,
        source: &OsStr,
        target_parent: &File,
        target: &OsStr,
    ) -> Result<bool, Error> {
        let mut opened = match open_windows_child(
            source_parent,
            source,
            FILE_OPEN,
            child_delete_access(false),
            null(),
            false,
            true,
        ) {
            Ok(opened) => opened,
            Err(error) if missing_leaf(&error) => return Ok(false),
            Err(error) => return Err(error),
        };
        if !opened_is_disk(&opened) {
            return Err(Error::InvalidInput(
                "workspace sidecar must be a regular file".into(),
            ));
        }
        rename_child(target_parent, &mut opened, source, target, false)?;
        Ok(true)
    }

    fn remove_regular_child(
        parent: &File,
        entry: &EnumeratedEntry,
        removed_entries: &mut usize,
    ) -> Result<(), Error> {
        let opened = open_windows_child(
            parent,
            &entry.name,
            FILE_OPEN,
            child_delete_access(false),
            null(),
            false,
            true,
        )?;
        if opened_file_identity(&opened)? != entry.identity {
            return Err(Error::Conflict(
                "directory cleanup entry changed concurrently".into(),
            ));
        }
        if !opened_is_disk(&opened) {
            return Err(Error::InvalidInput(
                "directory cleanup rejects links and special files".into(),
            ));
        }
        unlink_posix(&opened)?;
        *removed_entries += 1;
        Ok(())
    }

    fn remove_windows_tree_at(
        parent: &File,
        name: &OsStr,
        expected: (u64, u64),
        depth: usize,
        parent_volume: u64,
        removed_entries: &mut usize,
    ) -> Result<(), Error> {
        if depth >= MAX_REMOVE_TREE_DEPTH {
            return Err(Error::ResourceLimit(format!(
                "directory cleanup exceeded {MAX_REMOVE_TREE_DEPTH} levels"
            )));
        }
        let child = open_windows_child(
            parent,
            name,
            FILE_OPEN,
            child_delete_access(true),
            null(),
            true,
            true,
        )?;
        let opened_identity = opened_file_identity(&child)?;
        if opened_identity.0 != parent_volume {
            log::warn!("recursive delete stopped at a mount point");
            return Err(Error::InvalidInput(
                "directory cleanup refuses to cross a mount".into(),
            ));
        }
        if opened_identity != expected {
            return Err(Error::Conflict(
                "directory cleanup entry changed concurrently".into(),
            ));
        }
        for entry in enumerate_directory(&child)? {
            match entry.kind {
                EnumeratedKind::Other => {
                    return Err(Error::InvalidInput(
                        "directory cleanup rejects links and special files".into(),
                    ));
                }
                EnumeratedKind::RegularFile => {
                    remove_regular_child(&child, &entry, removed_entries)?;
                }
                EnumeratedKind::Directory => {
                    remove_windows_tree_at(
                        &child,
                        &entry.name,
                        entry.identity,
                        depth + 1,
                        opened_identity.0,
                        removed_entries,
                    )?;
                }
            }
        }
        unlink_posix(&child)?;
        *removed_entries += 1;
        Ok(())
    }

    pub(super) fn remove_entry_at(
        parent: &File,
        name: &OsStr,
        expected: (u64, u64),
        is_dir: bool,
    ) -> Result<(), Error> {
        assert_entry_identity(parent, name, expected, is_dir)?;
        if is_dir {
            let parent_volume = opened_file_identity(parent)?.0;
            let mut removed_entries = 0;
            if let Err(cause) = remove_windows_tree_at(
                parent,
                name,
                expected,
                0,
                parent_volume,
                &mut removed_entries,
            ) {
                return if removed_entries == 0 {
                    Err(cause)
                } else {
                    Err(Error::PartialRemoval {
                        removed_entries,
                        cause: Box::new(cause),
                    })
                };
            }
        } else {
            let opened = open_windows_child(
                parent,
                name,
                FILE_OPEN,
                child_delete_access(false),
                null(),
                false,
                true,
            )?;
            if opened_file_identity(&opened)? != expected {
                return Err(Error::Conflict(
                    "workspace entry changed concurrently".into(),
                ));
            }
            unlink_posix(&opened)?;
        }
        if let Err(error) = parent.sync_all() {
            log::warn!("workspace removal parent sync failed: {error}");
            return Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::WorkspaceRemoval,
            ));
        }
        Ok(())
    }

    pub(super) fn remove_optional_regular_at(parent: &File, name: &OsStr) -> Result<(), Error> {
        let opened = match open_windows_child(
            parent,
            name,
            FILE_OPEN,
            child_delete_access(false),
            null(),
            false,
            true,
        ) {
            Ok(opened) => opened,
            Err(error) if missing_leaf(&error) => return Ok(()),
            Err(error) => return Err(error),
        };
        if !opened_is_disk(&opened) {
            return Err(Error::InvalidInput(
                "workspace sidecar must be a regular file".into(),
            ));
        }
        unlink_posix(&opened)
    }

    fn cleanup(temp: &mut File, primary: Error) -> Error {
        #[cfg(test)]
        let injected = inject_atomic_file(AtomicFileFaultPoint::Cleanup).err();
        #[cfg(not(test))]
        let injected: Option<Error> = None;
        let removal = injected.or_else(|| delete_temp(temp).err());
        match removal {
            None => primary,
            Some(cleanup) => {
                log::error!(
                    "atomic replacement failed: {primary}; temporary cleanup failed: {cleanup}"
                );
                Error::OperationAndCleanup {
                    primary: primary.to_string(),
                    cleanup: cleanup.to_string(),
                }
            }
        }
    }

    fn metadata(temp: &File) -> Result<TempMetadata, std::io::Error> {
        use std::os::windows::fs::MetadataExt;
        let identity = opened_file_identity(temp).map_err(as_io)?;
        let stamp = temp.metadata()?.last_write_time();
        record_durability("temp.metadata");
        Ok(TempMetadata {
            identity,
            ctime_nanos: i128::from(stamp),
        })
    }

    #[cfg(test)]
    pub(super) fn test_security_descriptor(file: &File) -> Result<Vec<u8>, Error> {
        capture_security_descriptor(file)
    }

    #[cfg(test)]
    pub(super) fn test_security_descriptor_is_creator_only(file: &File) -> Result<bool, Error> {
        let descriptor = capture_security_descriptor(file)?;
        let mut dacl_present = 0;
        let mut dacl: *mut ACL = null_mut();
        let mut ace: *mut std::ffi::c_void = null_mut();
        let mut creator_sid = vec![0_u8; SECURITY_MAX_SID_SIZE as usize];
        let mut creator_sid_length = creator_sid.len() as u32;
        let result = unsafe {
            GetSecurityDescriptorDacl(
                descriptor.as_ptr() as *mut SECURITY_DESCRIPTOR as *mut std::ffi::c_void,
                &mut dacl_present,
                &mut dacl,
                null_mut(),
            )
        };
        if result == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        if dacl_present == 0 || dacl.is_null() || unsafe { (*dacl).AceCount } != 1 {
            return Ok(false);
        }
        if unsafe { GetAce(dacl, 0, &mut ace) } == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        let ace = unsafe { &*(ace as *const ACCESS_ALLOWED_ACE) };
        let created = unsafe {
            CreateWellKnownSid(
                WinCreatorOwnerSid,
                null_mut(),
                creator_sid.as_mut_ptr() as PSID,
                &mut creator_sid_length,
            )
        };
        if created == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        let ace_sid = &ace.SidStart as *const u32 as *mut std::ffi::c_void;
        Ok(ace.Header.AceType == 0
            && ace.Mask == FILE_ALL_ACCESS
            && unsafe { EqualSid(ace_sid, creator_sid.as_mut_ptr() as PSID) } != 0)
    }

    #[cfg(test)]
    pub(super) fn set_test_target_security_descriptor(
        path: &Path,
        access: u32,
    ) -> Result<(), Error> {
        let mut options = OpenOptions::new();
        options
            .read(true)
            .write(true)
            .access_mode(
                windows_sys::Win32::Foundation::GENERIC_READ
                    | windows_sys::Win32::Foundation::GENERIC_WRITE
                    | READ_CONTROL
                    | WRITE_DAC,
            )
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS);
        let file = options.open(path).map_err(io)?;
        let descriptor = PrivateSecurityDescriptor::new(access)?;
        apply_security_descriptor(&file, descriptor.as_ptr() as PSECURITY_DESCRIPTOR)
    }

    impl AtomicReplaceAdapter for WindowsAdapter {
        type Target = Target;

        fn target_stat(&self, dir: &File, target: &OsStr) -> Result<Option<Self::Target>, Error> {
            target_stat(dir, target)
        }

        fn is_regular(&self, target: &Self::Target) -> bool {
            target_regular(target)
        }

        fn target_identity(&self, target: &Self::Target) -> (u64, u64) {
            target.identity
        }

        fn create_temp(
            &self,
            dir: &File,
            original: Option<&Self::Target>,
        ) -> Result<(OsString, File), Error> {
            create_temp(dir, original)
        }

        fn before_write(
            &self,
            _dir: &File,
            temp: &File,
            original: Option<&Self::Target>,
        ) -> Result<(), Error> {
            let Some(original) = original else {
                return Ok(());
            };
            #[cfg(test)]
            inject_atomic_file(AtomicFileFaultPoint::DaclCapture)?;
            let descriptor = capture_security_descriptor(&original.handle)?;
            #[cfg(test)]
            inject_atomic_file(AtomicFileFaultPoint::DaclApply)?;
            apply_security_descriptor(temp, descriptor.as_ptr() as PSECURITY_DESCRIPTOR)
        }

        fn finalize_metadata(
            &self,
            _temp: &mut File,
            _original: Option<&Self::Target>,
        ) -> Result<(), Error> {
            Ok(())
        }

        fn rename(
            &self,
            dir: &File,
            temp: &mut File,
            temp_name: &OsStr,
            target: &OsStr,
            replace: bool,
        ) -> Result<(), Error> {
            rename_child(dir, temp, temp_name, target, replace)
        }

        fn metadata(&self, temp: &File) -> Result<TempMetadata, std::io::Error> {
            metadata(temp)
        }

        fn cleanup(
            &self,
            _dir: &File,
            _temp_name: &OsStr,
            temp: &mut File,
            primary: Error,
        ) -> Error {
            cleanup(temp, primary)
        }
    }

    fn open_directory_path(path: &Path, writable: bool) -> Result<File, Error> {
        let mut base = PathBuf::new();
        let mut components = path.components().peekable();
        if path.is_absolute() {
            while let Some(component) = components.peek().copied() {
                match component {
                    Component::Prefix(_) | Component::RootDir => {
                        base.push(component.as_os_str());
                        components.next();
                    }
                    _ => break,
                }
            }
        } else {
            base.push(".");
            while matches!(components.peek(), Some(Component::CurDir)) {
                components.next();
            }
        }
        let mut options = OpenOptions::new();
        options
            .read(true)
            .write(writable)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS);
        let mut dir = options.open(&base).map_err(io)?;
        // FILE_FLAG_OPEN_REPARSE_POINT yields a handle to the link itself instead of following
        // it, but opening a reparse point is not the same as refusing one. open_windows_nofollow
        // refuses it at exactly this step; without the same refusal here a reparse point planted
        // at the base prefix is traversed rather than rejected.
        if is_reparse_point(&dir.metadata().map_err(io)?) {
            return Err(Error::InvalidInput(
                "reparse points cannot be authorized".into(),
            ));
        }
        // DIRECTORY_ACCESS carries GENERIC_WRITE, so a read-only walk must not use it for the
        // intermediate components: demanding write on every ancestor fails under a directory the
        // caller may only read. `writable` already governs the base open above; this is the same
        // two-predicate split as resolve_windows in path_authority/resolved.rs.
        let child_access = if writable {
            DIRECTORY_ACCESS
        } else {
            DIRECTORY_READ_ACCESS
        };
        for component in components {
            let Component::Normal(name) = component else {
                return Err(Error::InvalidInput(
                    "parent path may not contain traversal components".into(),
                ));
            };
            dir = open_windows_child(&dir, name, FILE_OPEN, child_access, null(), true, true)?;
        }
        Ok(dir)
    }

    pub(super) fn replace<F, P>(
        target: &Path,
        precommit: P,
        write_fn: F,
    ) -> Result<AtomicInstalledFile, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
        P: FnOnce() -> Result<(), Error>,
    {
        #[cfg(test)]
        inject_atomic_file(AtomicFileFaultPoint::ParentOpen)?;
        let logical_parent = target.parent().unwrap_or_else(|| Path::new("."));
        let dir = open_directory_path(logical_parent, true)?;
        let parent_identity = opened_file_identity(&dir)?;
        let target_name = target
            .file_name()
            .filter(|name| !name.is_empty())
            .ok_or_else(|| Error::InvalidInput("target must name a file".into()))?
            .to_os_string();
        replace_at_driver(
            WindowsAdapter,
            dir,
            target_name,
            move || {
                let current = open_directory_path(logical_parent, false)?;
                if opened_file_identity(&current)? != parent_identity {
                    return Err(Error::Conflict(
                        "parent directory changed concurrently".into(),
                    ));
                }
                precommit()
            },
            write_fn,
        )
    }

    pub(super) fn replace_at<F, P>(
        dir: File,
        target_name: OsString,
        precommit: P,
        write_fn: F,
    ) -> Result<AtomicInstalledFile, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
        P: FnOnce() -> Result<(), Error>,
    {
        replace_at_driver(WindowsAdapter, dir, target_name, precommit, write_fn)
    }
}

#[cfg(all(test, unix))]
pub(crate) use unix::{
    current_test_removal_injector, set_test_removal_injector, RemovalFault, RemovalFaultPoint,
    RemovalInjector,
};
#[cfg(unix)]
pub(crate) use unix::{raw_mode_from, raw_stat_identity, MAX_REMOVE_TREE_DEPTH};
#[cfg(windows)]
#[allow(unused_imports)]
pub(crate) use win::MAX_REMOVE_TREE_DEPTH;

pub fn atomic_replace_with_precommit<F, P>(
    target: &Path,
    precommit: P,
    write_fn: F,
) -> Result<AtomicFileOutcome, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
    P: FnOnce() -> Result<(), Error>,
{
    #[cfg(unix)]
    {
        unix::replace(target, precommit, write_fn).map(|installed| installed.outcome)
    }
    #[cfg(windows)]
    {
        win::replace(target, precommit, write_fn).map(|installed| installed.outcome)
    }
}
pub fn atomic_replace<F>(target: &Path, write_fn: F) -> Result<AtomicFileOutcome, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
{
    atomic_replace_with_precommit(target, || Ok(()), write_fn)
}

pub(crate) fn single_leaf(leaf: &OsStr) -> Result<(), Error> {
    if leaf.is_empty() || Path::new(leaf).file_name() != Some(leaf) {
        return Err(Error::InvalidInput(
            "leaf name must be one component".into(),
        ));
    }
    Ok(())
}

/// Replaces one leaf below an already-authority-validated directory descriptor. No mutable
/// parent pathname is reopened between capability resolution and the final `renameat`.
pub fn atomic_replace_at<F>(
    parent: &File,
    leaf: &OsStr,
    write_fn: F,
) -> Result<AtomicFileOutcome, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
{
    atomic_replace_at_with_precommit(parent, leaf, || Ok(()), write_fn)
}

/// Mutating workspace primitives.  Each one accepts an already-opened parent directory and
/// performs the final lookup relative to that descriptor with `NOFOLLOW`.  `expected`, when
/// supplied, is checked immediately before the namespace mutation; it is the identity captured
/// by the path authority when the opaque workspace capability was issued.
#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn open_verified_parent(
    path: &Path,
    expected: (u64, u64),
    directory: bool,
) -> Result<(File, std::ffi::OsString), Error> {
    win::open_verified_parent(path, expected, directory)
}

#[cfg(unix)]
pub(crate) fn open_verified_parent(
    path: &Path,
    expected: (u64, u64),
    directory: bool,
) -> Result<(File, std::ffi::OsString), Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType, Mode, OFlags};
    use std::os::unix::ffi::OsStrExt;
    let parent = open_parent_no_follow(path)?;
    let leaf = path
        .file_name()
        .filter(|name| !name.as_bytes().is_empty())
        .ok_or_else(|| Error::InvalidInput("workspace entry needs a leaf name".into()))?
        .to_os_string();
    let stat = rfs::statat(&parent, &leaf, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    let kind = FileType::from_raw_mode(stat.st_mode);
    if unix::raw_stat_identity(&stat) != expected
        || (directory && kind != FileType::Directory)
        || (!directory && kind != FileType::RegularFile)
    {
        return Err(Error::Conflict(
            "workspace entry changed concurrently".into(),
        ));
    }
    // Opening a directory here pins the destination parent before its children are mutated.
    if directory {
        let opened = File::from(
            rfs::openat(
                &parent,
                &leaf,
                OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::empty(),
            )
            .map_err(|error| Error::Io(Box::new(error.into())))?,
        );
        if unix::raw_stat_identity(
            &rfs::fstat(&opened).map_err(|error| Error::Io(Box::new(error.into())))?,
        ) != expected
        {
            return Err(Error::Conflict(
                "workspace directory changed concurrently".into(),
            ));
        }
    }
    Ok((parent, leaf))
}

#[cfg(unix)]
pub(crate) fn open_parent_no_follow(path: &Path) -> Result<File, Error> {
    unix::open_parent(path)
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn open_parent_no_follow(path: &Path) -> Result<File, Error> {
    win::open_writable_parent(path)
}

#[cfg(unix)]
pub(crate) fn open_verified_directory(
    path: &Path,
    expected: (u64, u64),
) -> Result<VerifiedDir, Error> {
    use rustix::fs::{self as rfs, Mode, OFlags};
    let (parent, leaf) = open_verified_parent(path, expected, true)?;
    let opened = File::from(
        rfs::openat(
            &parent,
            &leaf,
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|error| Error::Io(Box::new(error.into())))?,
    );
    VerifiedDir::new(opened, expected)
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn open_verified_directory(
    path: &Path,
    expected: (u64, u64),
) -> Result<VerifiedDir, Error> {
    win::open_writable_verified_directory(path, expected)
}

#[cfg(unix)]
pub(crate) fn assert_entry_identity(
    parent: &File,
    name: &OsStr,
    expected: (u64, u64),
    dir: bool,
) -> Result<(), Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType};
    let stat = rfs::statat(parent, name, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    let kind = FileType::from_raw_mode(stat.st_mode);
    if unix::raw_stat_identity(&stat) != expected
        || (dir && kind != FileType::Directory)
        || (!dir && kind != FileType::RegularFile)
    {
        return Err(Error::Conflict(
            "workspace entry changed concurrently".into(),
        ));
    }
    Ok(())
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn assert_entry_identity(
    parent: &File,
    name: &OsStr,
    expected: (u64, u64),
    dir: bool,
) -> Result<(), Error> {
    win::assert_entry_identity(parent, name, expected, dir)
}

#[cfg(unix)]
pub(crate) fn entry_identity_at(
    parent: &File,
    name: &OsStr,
    dir: bool,
) -> Result<(u64, u64), Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType};
    let stat = rfs::statat(parent, name, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    let kind = FileType::from_raw_mode(stat.st_mode);
    if (dir && kind != FileType::Directory) || (!dir && kind != FileType::RegularFile) {
        return Err(Error::InvalidInput(
            "workspace entry has an unexpected file type".into(),
        ));
    }
    Ok(unix::raw_stat_identity(&stat))
}

#[cfg(windows)]
pub(crate) fn entry_identity_at(
    parent: &File,
    name: &OsStr,
    dir: bool,
) -> Result<(u64, u64), Error> {
    win::entry_identity_at(parent, name, dir)
}

#[cfg(unix)]
pub(crate) fn create_dir_at(parent: &File, name: &OsStr) -> Result<(), Error> {
    use rustix::fs::{self as rfs, Mode};
    rfs::mkdirat(parent, name, Mode::from_raw_mode(0o700))
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    parent.sync_all()?;
    Ok(())
}

#[cfg(windows)]
pub(crate) fn create_dir_at(parent: &File, name: &OsStr) -> Result<(), Error> {
    win::create_dir_at(parent, name)
}

#[cfg(unix)]
pub(crate) fn open_directory_at(
    parent: &File,
    name: &OsStr,
    _writable: bool,
) -> Result<File, Error> {
    use rustix::fs::{self as rfs, Mode, OFlags};
    Ok(File::from(
        rfs::openat(
            parent,
            name,
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|error| Error::Io(Box::new(error.into())))?,
    ))
}

#[cfg(windows)]
pub(crate) fn open_directory_at(
    parent: &File,
    name: &OsStr,
    writable: bool,
) -> Result<File, Error> {
    win::open_directory_child(parent, name, writable)
}

#[cfg(unix)]
pub(crate) fn open_regular_at(
    parent: &File,
    name: &OsStr,
    access: RegularFileAccess,
) -> Result<File, Error> {
    single_leaf(name)?;
    use rustix::fs::{self as rfs, FileType, Mode, OFlags};
    let opened = File::from(
        rfs::openat(
            parent,
            name,
            match access {
                RegularFileAccess::ReadOnly => OFlags::RDONLY,
                RegularFileAccess::ReadWrite => OFlags::RDWR,
            } | OFlags::NOFOLLOW
                | OFlags::CLOEXEC
                | OFlags::NONBLOCK,
            Mode::empty(),
        )
        .map_err(|error| Error::Io(Box::new(error.into())))?,
    );
    let stat = rfs::fstat(&opened).map_err(|error| Error::Io(Box::new(error.into())))?;
    if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
        return Err(Error::InvalidInput("target must be a regular file".into()));
    }
    let flags = rfs::fcntl_getfl(&opened).map_err(|error| Error::Io(Box::new(error.into())))?;
    rfs::fcntl_setfl(&opened, flags - OFlags::NONBLOCK)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    Ok(opened)
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn open_regular_at(
    parent: &File,
    name: &OsStr,
    access: RegularFileAccess,
) -> Result<File, Error> {
    win::open_regular_at(parent, name, access)
}

/// Creates one private regular-file leaf below a retained directory descriptor. The exclusive
/// no-follow open is the namespace mutation; the returned inode identity is the only identity
/// callers may use for later registration or cleanup.
#[cfg(unix)]
pub(crate) fn create_regular_at(parent: &File, name: &OsStr) -> Result<(File, (u64, u64)), Error> {
    single_leaf(name)?;
    use rustix::fs::{self as rfs, FileType, Mode, OFlags};
    let created = File::from(
        rfs::openat(
            parent,
            name,
            OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::from_raw_mode(0o600),
        )
        .map_err(|error| Error::Io(Box::new(error.into())))?,
    );
    let stat = rfs::fstat(&created).map_err(|error| Error::Io(Box::new(error.into())))?;
    if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
        return Err(Error::InvalidInput(
            "created database must be a regular file".into(),
        ));
    }
    Ok((created, unix::raw_stat_identity(&stat)))
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn create_regular_at(parent: &File, name: &OsStr) -> Result<(File, (u64, u64)), Error> {
    win::create_regular_at(parent, name)
}

#[cfg(unix)]
pub(crate) fn rename_entry_at(
    source_parent: &File,
    source: &OsStr,
    expected: (u64, u64),
    source_is_dir: bool,
    target_parent: &File,
    target: &OsStr,
) -> Result<(), Error> {
    use rustix::fs::{self as rfs, RenameFlags};
    use std::os::unix::fs::MetadataExt;
    assert_entry_identity(source_parent, source, expected, source_is_dir)?;
    rfs::renameat_with(
        source_parent,
        source,
        target_parent,
        target,
        RenameFlags::NOREPLACE,
    )
    .map_err(|error| Error::Io(Box::new(error.into())))?;
    source_parent.sync_all()?;
    if source_parent.metadata()?.ino() != target_parent.metadata()?.ino()
        || source_parent.metadata()?.dev() != target_parent.metadata()?.dev()
    {
        target_parent.sync_all()?;
    }
    Ok(())
}

#[cfg(windows)]
pub(crate) fn rename_entry_at(
    source_parent: &File,
    source: &OsStr,
    expected: (u64, u64),
    source_is_dir: bool,
    target_parent: &File,
    target: &OsStr,
) -> Result<(), Error> {
    win::rename_entry_at(
        source_parent,
        source,
        expected,
        source_is_dir,
        target_parent,
        target,
    )
}

#[cfg(unix)]
pub(crate) fn rename_optional_regular_at(
    source_parent: &File,
    source: &OsStr,
    target_parent: &File,
    target: &OsStr,
) -> Result<bool, Error> {
    use rustix::{
        fs::{self as rfs, AtFlags, FileType, RenameFlags},
        io::Errno,
    };
    match rfs::statat(source_parent, source, AtFlags::SYMLINK_NOFOLLOW) {
        Err(error) if error == Errno::NOENT => return Ok(false),
        Err(error) => return Err(Error::Io(Box::new(error.into()))),
        Ok(stat) if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile => {
            return Err(Error::InvalidInput(
                "workspace sidecar must be a regular file".into(),
            ))
        }
        Ok(_) => {}
    }
    rfs::renameat_with(
        source_parent,
        source,
        target_parent,
        target,
        RenameFlags::NOREPLACE,
    )
    .map_err(|error| Error::Io(Box::new(error.into())))?;
    Ok(true)
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) fn rename_optional_regular_at(
    source_parent: &File,
    source: &OsStr,
    target_parent: &File,
    target: &OsStr,
) -> Result<bool, Error> {
    win::rename_optional_regular_at(source_parent, source, target_parent, target)
}

#[cfg(unix)]
pub(crate) fn remove_entry_at(
    parent: &File,
    name: &OsStr,
    expected: (u64, u64),
    is_dir: bool,
) -> Result<(), Error> {
    use rustix::fs::{self as rfs, AtFlags};
    single_leaf(name)?;
    assert_entry_identity(parent, name, expected, is_dir)?;
    #[cfg(test)]
    unix::inject_removal(unix::RemovalFaultPoint::BeforeTopOpen)?;
    if is_dir {
        let parent_stat = rfs::fstat(parent).map_err(|error| Error::Io(Box::new(error.into())))?;
        let mut removed_entries = 0;
        if let Err(cause) = unix::remove_tree_at(
            parent,
            name,
            expected,
            0,
            unix::raw_stat_identity(&parent_stat).0,
            &mut removed_entries,
        ) {
            return if removed_entries == 0 {
                Err(cause)
            } else {
                Err(Error::PartialRemoval {
                    removed_entries,
                    cause: Box::new(cause),
                })
            };
        }
    } else {
        rfs::unlinkat(parent, name, AtFlags::empty())
            .map_err(|error| Error::Io(Box::new(error.into())))?;
    }
    #[cfg(test)]
    if let Err(error) = unix::inject_removal(unix::RemovalFaultPoint::ParentSync) {
        log::warn!("workspace removal parent sync failed: {error}");
        return Err(Error::CommittedDurabilityUncertain(
            crate::error::DurabilityStage::WorkspaceRemoval,
        ));
    }
    if let Err(error) = parent.sync_all() {
        log::warn!("workspace removal parent sync failed: {error}");
        return Err(Error::CommittedDurabilityUncertain(
            crate::error::DurabilityStage::WorkspaceRemoval,
        ));
    }
    Ok(())
}

#[cfg(windows)]
pub(crate) fn remove_entry_at(
    parent: &File,
    name: &OsStr,
    expected: (u64, u64),
    is_dir: bool,
) -> Result<(), Error> {
    win::remove_entry_at(parent, name, expected, is_dir)
}

#[cfg(unix)]
pub(crate) fn remove_optional_regular_at(parent: &File, name: &OsStr) -> Result<(), Error> {
    use rustix::{
        fs::{self as rfs, AtFlags, FileType},
        io::Errno,
    };
    match rfs::statat(parent, name, AtFlags::SYMLINK_NOFOLLOW) {
        Err(error) if error == Errno::NOENT => Ok(()),
        Err(error) => Err(Error::Io(Box::new(error.into()))),
        Ok(stat) if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile => Err(
            Error::InvalidInput("workspace sidecar must be a regular file".into()),
        ),
        Ok(_) => rfs::unlinkat(parent, name, AtFlags::empty())
            .map_err(|error| Error::Io(Box::new(error.into()))),
    }
}

#[cfg(windows)]
pub(crate) fn remove_optional_regular_at(parent: &File, name: &OsStr) -> Result<(), Error> {
    win::remove_optional_regular_at(parent, name)
}

pub fn atomic_replace_at_with_precommit<F, P>(
    parent: &File,
    leaf: &OsStr,
    precommit: P,
    write_fn: F,
) -> Result<AtomicFileOutcome, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
    P: FnOnce() -> Result<(), Error>,
{
    atomic_replace_at_identified_with_precommit(parent, leaf, precommit, write_fn)
        .map(|installed| installed.outcome)
}

/// Same fd-relative commit, with the inode identity captured from the still-open temporary FD
/// after `renameat` and before any pathname lookup can occur.
pub fn atomic_replace_at_identified<F>(
    parent: &File,
    leaf: &OsStr,
    write_fn: F,
) -> Result<AtomicInstalledFile, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
{
    atomic_replace_at_identified_with_precommit(parent, leaf, || Ok(()), write_fn)
}

pub fn atomic_replace_at_identified_with_precommit<F, P>(
    parent: &File,
    leaf: &OsStr,
    precommit: P,
    write_fn: F,
) -> Result<AtomicInstalledFile, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
    P: FnOnce() -> Result<(), Error>,
{
    single_leaf(leaf)?;
    #[cfg(unix)]
    {
        unix::replace_at(
            parent.try_clone()?,
            leaf.to_os_string(),
            precommit,
            write_fn,
        )
        .map(|installed| AtomicInstalledFile {
            outcome: installed.outcome,
            identity: installed.identity,
            ctime_nanos: installed.ctime_nanos,
        })
    }
    #[cfg(windows)]
    {
        win::replace_at(
            parent.try_clone()?,
            leaf.to_os_string(),
            precommit,
            write_fn,
        )
    }
}

#[cfg(all(test, unix))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AtomicDirFaultPoint {
    SyncEntry,
    PreCommit,
    BackupRename,
    InstallRename,
    ParentSync,
    BackupCleanup,
}
#[cfg(all(test, unix))]
pub(crate) trait AtomicDirInjector {
    fn inject(&self, _: AtomicDirFaultPoint) -> std::io::Result<()> {
        Ok(())
    }
}

#[cfg(all(test, unix))]
std::thread_local! {
    static TEST_ATOMIC_DIR_INJECTOR: std::cell::RefCell<Option<Box<dyn AtomicDirInjector>>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(all(test, unix))]
pub(crate) fn set_test_atomic_dir_injector(injector: Option<Box<dyn AtomicDirInjector>>) {
    TEST_ATOMIC_DIR_INJECTOR.with(|current| *current.borrow_mut() = injector);
}

#[cfg(all(test, unix))]
fn inject_atomic_dir(point: AtomicDirFaultPoint) -> Result<(), Error> {
    TEST_ATOMIC_DIR_INJECTOR.with(|current| {
        current
            .borrow()
            .as_ref()
            .map_or(Ok(()), |injector| injector.inject(point).map_err(io))
    })
}

pub fn atomic_install_dir(temp_path: &Path, target_path: &Path) -> Result<(), Error> {
    #[cfg(unix)]
    {
        unix::install_dir(temp_path, target_path)
    }
    #[cfg(not(unix))]
    {
        let _ = (temp_path, target_path);
        Err(Error::Conflict("atomic directory installation is unsupported on this platform: fd-relative no-follow and durable parent sync cannot be proven".into()))
    }
}

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    use super::windows_test_parent;
    use super::*;
    use crate::infra::blocking::source_scan::{body_at_indent, braced_body, normalise, Literals};
    use std::{
        io::{Read, Write},
        path::PathBuf,
        sync::{Arc, Mutex},
    };

    #[cfg(unix)]
    fn inode(path: &std::path::Path) -> (u64, u64) {
        use std::os::unix::fs::MetadataExt;
        let metadata = std::fs::symlink_metadata(path).expect("metadata");
        (metadata.dev(), metadata.ino())
    }

    #[test]
    fn bounded_reader_accepts_zero_and_exact_limits_and_detects_one_excess_byte() {
        let mut empty = std::io::Cursor::new(Vec::<u8>::new());
        assert_eq!(
            read_bounded_bytes(&mut empty, 0, 0, "too large", || Ok(())).unwrap(),
            b""
        );
        let mut exact = std::io::Cursor::new(b"exact".to_vec());
        assert_eq!(
            read_bounded_bytes(&mut exact, u64::MAX, 5, "too large", || Ok(())).unwrap(),
            b"exact"
        );
        let mut excess = std::io::Cursor::new(b"excess".to_vec());
        assert!(matches!(
            read_bounded_bytes(&mut excess, 0, 5, "too large", || Ok(())),
            Err(Error::ResourceLimit(_))
        ));
        assert_eq!(excess.position(), 6, "reader consumes only cap plus one");
    }

    #[test]
    fn bounded_reader_retries_interrupted_and_propagates_io_and_checkpoint_errors() {
        struct InterruptedOnce {
            interrupted: bool,
            bytes: std::io::Cursor<Vec<u8>>,
        }
        impl Read for InterruptedOnce {
            fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
                if !self.interrupted {
                    self.interrupted = true;
                    return Err(std::io::Error::from(std::io::ErrorKind::Interrupted));
                }
                self.bytes.read(output)
            }
        }
        let mut interrupted = InterruptedOnce {
            interrupted: false,
            bytes: std::io::Cursor::new(b"ok".to_vec()),
        };
        assert_eq!(
            read_bounded_bytes(&mut interrupted, 2, 2, "too large", || Ok(())).unwrap(),
            b"ok"
        );

        let mut interrupted_then_cancelled = InterruptedOnce {
            interrupted: false,
            bytes: std::io::Cursor::new(b"unread".to_vec()),
        };
        let mut checkpoints = 0;
        let error = read_bounded_bytes(&mut interrupted_then_cancelled, 6, 6, "too large", || {
            checkpoints += 1;
            if checkpoints == 3 {
                Err(Error::Cancellation)
            } else {
                Ok(())
            }
        })
        .unwrap_err();
        assert!(matches!(error, Error::Cancellation));
        assert_eq!(interrupted_then_cancelled.bytes.position(), 0);

        let mut failed = std::io::repeat(0).take(1);
        let error = read_bounded_bytes(&mut failed, 1, 1, "too large", || Err(Error::Cancellation))
            .unwrap_err();
        assert!(matches!(error, Error::Cancellation));

        struct FailedReader;
        impl Read for FailedReader {
            fn read(&mut self, _: &mut [u8]) -> std::io::Result<usize> {
                Err(std::io::Error::other("read failed"))
            }
        }
        assert!(matches!(
            read_bounded_bytes(&mut FailedReader, 0, 1, "too large", || Ok(())),
            Err(Error::Io(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_classifies_without_following() {
        use std::os::unix::fs::symlink;
        use std::os::unix::net::UnixListener;
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("directory");
        std::fs::create_dir(&directory).unwrap();
        let regular = root.path().join("regular");
        std::fs::write(&regular, b"regular").unwrap();
        symlink(&directory, root.path().join("outside-link")).unwrap();
        symlink(&regular, root.path().join("file-link")).unwrap();
        let handle = File::open(root.path()).unwrap();
        let _socket = UnixListener::bind(root.path().join("socket")).unwrap();
        let entries =
            read_directory_entries_at(&handle, &CancellationToken::new(), &mut |_| true).unwrap();
        assert_eq!(entries.len(), 5);
        assert_eq!(
            entries
                .iter()
                .find(|entry| entry.name == "regular")
                .unwrap()
                .kind,
            DirectoryEntryKind::RegularFile
        );
        assert_eq!(
            entries
                .iter()
                .find(|entry| entry.name == "directory")
                .unwrap()
                .kind,
            DirectoryEntryKind::Directory
        );
        assert_eq!(
            entries
                .iter()
                .filter(|entry| entry.kind == DirectoryEntryKind::Other)
                .count(),
            3
        );
        for entry in entries {
            assert_ne!(entry.name, ".");
            assert_ne!(entry.name, "..");
            assert_eq!(entry.identity, inode(&root.path().join(&entry.name)));
        }
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_stats_only_after_keep() {
        let root = tempfile::tempdir().unwrap();
        for name in ["a", "b", "c"] {
            std::fs::write(root.path().join(name), name).unwrap();
        }
        let events = Arc::new(Mutex::new(Vec::<String>::new()));
        let hook_events = Arc::clone(&events);
        set_read_directory_pre_stat_hook(Some(Box::new(move |name| {
            hook_events
                .lock()
                .unwrap()
                .push(format!("stat:{}", name.to_string_lossy()));
        })));
        let keep_events = Arc::clone(&events);
        let root_path = root.path().to_path_buf();
        let mut keep = move |name: &OsStr| {
            keep_events
                .lock()
                .unwrap()
                .push(format!("keep:{}", name.to_string_lossy()));
            if name != OsStr::new("b") {
                std::fs::remove_file(root_path.join(name)).unwrap();
                false
            } else {
                true
            }
        };
        let handle = File::open(root.path()).unwrap();
        let result = read_directory_entries_at(&handle, &CancellationToken::new(), &mut keep);
        set_read_directory_pre_stat_hook(None);
        assert!(result.is_ok());
        let log = events.lock().unwrap().clone();
        assert_eq!(
            log.iter()
                .filter(|event| event.starts_with("stat:"))
                .count(),
            1
        );
        let stat_index = log.iter().position(|event| event == "stat:b").unwrap();
        let keep_index = log.iter().position(|event| event == "keep:b").unwrap();
        assert!(keep_index < stat_index);
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_checks_cancellation_before_opening() {
        let root = tempfile::tempdir().unwrap();
        let file = root.path().join("file");
        std::fs::write(&file, b"file").unwrap();
        let descriptor = File::open(file).unwrap();
        let token = CancellationToken::new();
        token.cancel();
        assert!(matches!(
            read_directory_entries_at(&descriptor, &token, &mut |_| true),
            Err(Error::Cancellation)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_skips_the_stat_once_keep_cancels() {
        let root = tempfile::tempdir().unwrap();
        std::fs::write(root.path().join("a"), b"a").unwrap();
        std::fs::write(root.path().join("b"), b"b").unwrap();
        let token = CancellationToken::new();
        let worker = token.clone();
        let fired = Arc::new(Mutex::new(false));
        let observed = Arc::clone(&fired);
        set_read_directory_pre_stat_hook(Some(Box::new(move |_| {
            *observed.lock().unwrap() = true;
        })));
        let handle = File::open(root.path()).unwrap();
        let result = read_directory_entries_at(&handle, &token, &mut |_| {
            worker.cancel();
            true
        });
        set_read_directory_pre_stat_hook(None);
        assert!(matches!(result, Err(Error::Cancellation)));
        assert!(!*fired.lock().unwrap());
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_checks_cancellation_at_end_of_stream() {
        let root = tempfile::tempdir().unwrap();
        std::fs::write(root.path().join("a"), b"a").unwrap();
        let token = CancellationToken::new();
        let worker = token.clone();
        set_read_directory_pre_stat_hook(Some(Box::new(move |_| worker.cancel())));
        let handle = File::open(root.path()).unwrap();
        let result = read_directory_entries_at(&handle, &token, &mut |_| true);
        set_read_directory_pre_stat_hook(None);
        assert!(matches!(result, Err(Error::Cancellation)));
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_fails_for_an_entry_removed_before_stat() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("a");
        std::fs::write(&path, b"a").unwrap();
        let remove = path.clone();
        set_read_directory_pre_stat_hook(Some(Box::new(move |_| {
            std::fs::remove_file(&remove).unwrap();
        })));
        let handle = File::open(root.path()).unwrap();
        let result = read_directory_entries_at(&handle, &CancellationToken::new(), &mut |_| true);
        set_read_directory_pre_stat_hook(None);
        assert!(
            matches!(result, Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound)
        );
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_refuses_a_removed_directory() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("directory");
        std::fs::create_dir(&directory).unwrap();
        let handle = File::open(&directory).unwrap();
        std::fs::remove_dir(&directory).unwrap();
        assert!(matches!(
            read_directory_entries_at(&handle, &CancellationToken::new(), &mut |_| true),
            Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound
        ));
    }

    #[cfg(unix)]
    #[test]
    fn held_matches_path_compares_the_held_and_named_identities() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("directory");
        std::fs::create_dir(&directory).unwrap();
        let handle = File::open(&directory).unwrap();

        assert!(held_matches_path(&handle, &directory).unwrap());
        std::fs::remove_dir(&directory).unwrap();
        assert!(!held_matches_path(&handle, &directory).unwrap());
        std::fs::create_dir(&directory).unwrap();
        assert!(!held_matches_path(&handle, &directory).unwrap());
    }

    #[cfg(unix)]
    fn assert_directory_removed_during_enumeration(error: &Error) {
        assert!(matches!(
            error,
            Error::Io(error)
                if error.kind() == std::io::ErrorKind::NotFound
                    && error.to_string() == "directory was removed during enumeration"
        ));
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_refuses_a_directory_removed_after_the_walk() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("directory");
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("entry"), b"entry").unwrap();
        let handle = File::open(&directory).unwrap();
        let injector = Arc::new(PostWalkMutation::new(
            directory.clone(),
            PostWalkAction::Remove,
        ));

        let result = {
            let _guard = unix::scoped_test_removal_injector(injector);
            read_directory_entries_at(&handle, &CancellationToken::new(), &mut |_| true)
        };

        let error = result.expect_err("post-walk removal must be refused");
        assert_directory_removed_during_enumeration(&error);
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_rejects_a_same_name_directory_replacement() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("directory");
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("entry"), b"entry").unwrap();
        let handle = File::open(&directory).unwrap();
        let injector = Arc::new(PostWalkMutation::new(
            directory.clone(),
            PostWalkAction::ReplaceWithSentinel,
        ));

        let result = {
            let _guard = unix::scoped_test_removal_injector(injector);
            read_directory_entries_at(&handle, &CancellationToken::new(), &mut |_| true)
        };

        let error = result.expect_err("same-name replacement must be refused");
        assert_directory_removed_during_enumeration(&error);
        assert_eq!(
            std::fs::read(directory.join("sentinel")).unwrap(),
            b"sentinel"
        );
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_accepts_a_directory_renamed_after_the_walk() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("directory");
        let moved = root.path().join("moved");
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("entry"), b"entry").unwrap();
        let handle = File::open(&directory).unwrap();
        let injector = Arc::new(PostWalkMutation::new(
            directory,
            PostWalkAction::RenameAway {
                destination: moved.clone(),
            },
        ));

        let result = {
            let _guard = unix::scoped_test_removal_injector(injector);
            read_directory_entries_at(&handle, &CancellationToken::new(), &mut |_| true)
        };

        assert!(
            result.is_ok(),
            "rename-away must preserve the held directory"
        );
        assert!(moved.join("entry").is_file());
    }

    #[cfg(unix)]
    #[test]
    fn read_directory_entries_at_keeps_cancellation_precedence_at_the_post_walk_point() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("directory");
        std::fs::create_dir(&directory).unwrap();
        let handle = File::open(&directory).unwrap();
        let token = CancellationToken::new();
        let injector = Arc::new(
            PostWalkMutation::new(directory, PostWalkAction::Remove)
                .with_cancellation(token.clone()),
        );

        let result = {
            let _guard = unix::scoped_test_removal_injector(injector);
            read_directory_entries_at(&handle, &token, &mut |_| true)
        };

        assert!(matches!(result, Err(Error::Cancellation)));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn read_directory_entries_at_maps_getpath_enotdir_to_removed_directory() {
        let root = tempfile::tempdir().unwrap();
        let parent = root.path().join("parent");
        let directory = parent.join("directory");
        std::fs::create_dir_all(&directory).unwrap();
        let handle = File::open(&directory).unwrap();
        let injector = Arc::new(PostWalkMutation::new(
            directory,
            PostWalkAction::RemoveParentAndCreateFile {
                parent: parent.clone(),
            },
        ));

        let result = {
            let _guard = unix::scoped_test_removal_injector(injector);
            read_directory_entries_at(&handle, &CancellationToken::new(), &mut |_| true)
        };

        let error = result.expect_err("parent replacement must be refused");
        assert_directory_removed_during_enumeration(&error);
        assert!(std::fs::metadata(parent).unwrap().is_file());
    }

    #[test]
    fn directory_types_carry_no_pathname() {
        let source = include_str!("fs.rs");
        let directory = body_at_indent(source, "pub(crate) struct DirectoryEntry {");
        assert_eq!(
            directory.trim(),
            "pub(crate) struct DirectoryEntry {\n    pub(crate) name: OsString,\n    pub(crate) kind: DirectoryEntryKind,\n    pub(crate) identity: (u64, u64),\n    #[cfg(unix)]\n    pub(crate) modified_seconds: i64,"
        );
        let capability_source = include_str!("path_authority/mod.rs");
        let capability =
            body_at_indent(capability_source, "pub(crate) struct CapabilityDirectory {");
        assert_eq!(
            capability.trim(),
            "pub(crate) struct CapabilityDirectory {\n    #[cfg(unix)]\n    directory: fs::File,"
        );
    }

    #[test]
    fn mark_engine_executable_uses_checked_raw_mode() {
        let source = include_str!("path_authority/resolved.rs");
        let body = braced_body(source, "pub(crate) fn mark_engine_executable(");
        let compact: String = normalise(&source[body.clone()], Literals::Blank)
            .chars()
            .filter(|character| !character.is_whitespace())
            .collect();
        assert!(compact.contains("Mode::from_raw_mode(crate::infra::fs::raw_mode_from(mode)?)"));
        assert_eq!(compact.matches("from_raw_mode(").count(), 1);
        assert!(!normalise(&source[body], Literals::Blank).contains(" as "));
    }

    #[test]
    fn bounded_reader_checks_cancellation_between_reads_and_after_eof() {
        struct OneByteReader(std::io::Cursor<Vec<u8>>);
        impl Read for OneByteReader {
            fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
                self.0.read(&mut output[..1])
            }
        }
        let mut between = OneByteReader(std::io::Cursor::new(b"two".to_vec()));
        let mut checkpoints = 0;
        let error = read_bounded_bytes(&mut between, 3, 3, "too large", || {
            checkpoints += 1;
            if checkpoints == 3 {
                Err(Error::Cancellation)
            } else {
                Ok(())
            }
        })
        .unwrap_err();
        assert!(matches!(error, Error::Cancellation));
        assert_eq!(between.0.position(), 1);

        use std::{cell::Cell, rc::Rc};
        struct EofSignallingReader {
            bytes: std::io::Cursor<Vec<u8>>,
            saw_eof: Rc<Cell<bool>>,
        }
        impl Read for EofSignallingReader {
            fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
                let read = self.bytes.read(output)?;
                if read == 0 {
                    self.saw_eof.set(true);
                }
                Ok(read)
            }
        }
        let saw_eof = Rc::new(Cell::new(false));
        let checkpoint_eof = Rc::clone(&saw_eof);
        let mut after_eof = EofSignallingReader {
            bytes: std::io::Cursor::new(b"done".to_vec()),
            saw_eof,
        };
        let error = read_bounded_bytes(&mut after_eof, 4, 4, "too large", || {
            if checkpoint_eof.get() {
                Err(Error::Cancellation)
            } else {
                Ok(())
            }
        })
        .unwrap_err();
        assert!(matches!(error, Error::Cancellation));
        assert_eq!(after_eof.bytes.position(), 4);
    }

    #[cfg(unix)]
    #[test]
    fn verified_parent_rejects_an_intermediate_symlink_swap() {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let nested = root.join("nested");
        let outside = temp.path().join("outside");
        std::fs::create_dir(&root).expect("root");
        std::fs::create_dir(&nested).expect("nested");
        std::fs::create_dir(&outside).expect("outside");
        let entry = nested.join("game.pgn");
        std::fs::write(&entry, b"trusted").expect("entry");
        std::fs::write(outside.join("game.pgn"), b"outside").expect("outside entry");
        let expected = inode(&entry);
        std::fs::rename(&nested, root.join("nested-old")).expect("move nested");
        std::os::unix::fs::symlink(&outside, &nested).expect("swap link");

        assert!(matches!(
            open_verified_parent(&entry, expected, false),
            Err(Error::Io(_))
        ));
        assert_eq!(
            std::fs::read(outside.join("game.pgn")).expect("outside intact"),
            b"outside"
        );
    }

    #[cfg(unix)]
    #[test]
    fn verified_directory_refuses_a_mismatched_identity() {
        let temp = tempfile::tempdir().expect("tempdir");
        let opened_path = temp.path().join("opened");
        let expected_path = temp.path().join("expected");
        std::fs::create_dir(&opened_path).expect("opened directory");
        std::fs::create_dir(&expected_path).expect("expected directory");
        let opened = File::open(&opened_path).expect("opened descriptor");

        assert!(matches!(
            VerifiedDir::new(opened, inode(&expected_path)),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn open_verified_directory_contains_exactly_one_openat() {
        let source = include_str!("fs.rs");
        let body = body_at_indent(source, "fn open_verified_directory(");
        assert_eq!(body.matches("openat").count(), 1, "{body}");
    }

    #[cfg(unix)]
    #[test]
    fn open_regular_at_opens_exact_regular_file_bytes() {
        let temp = tempfile::tempdir().expect("tempdir");
        std::fs::write(temp.path().join("track.mp3"), b"exact bytes").expect("write file");
        let parent = File::open(temp.path()).expect("open parent");
        let mut opened = open_regular_at(
            &parent,
            OsStr::new("track.mp3"),
            RegularFileAccess::ReadOnly,
        )
        .expect("open leaf");
        let mut bytes = Vec::new();
        opened.read_to_end(&mut bytes).expect("read leaf");
        assert_eq!(bytes, b"exact bytes");
    }

    #[cfg(unix)]
    #[test]
    fn open_regular_at_supports_explicit_read_write_access() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("game.pgn");
        std::fs::write(&path, b"old").expect("write file");
        let parent = File::open(temp.path()).expect("open parent");
        let mut opened = open_regular_at(
            &parent,
            OsStr::new("game.pgn"),
            RegularFileAccess::ReadWrite,
        )
        .expect("open read/write");
        opened.write_all(b"!").expect("write descriptor");
        drop(opened);
        assert_eq!(std::fs::read(path).unwrap(), b"!ld");
    }

    #[cfg(unix)]
    #[test]
    fn open_regular_at_refuses_a_symlink_leaf() {
        let temp = tempfile::tempdir().expect("tempdir");
        std::fs::write(temp.path().join("target"), b"target").expect("write target");
        std::os::unix::fs::symlink("target", temp.path().join("link")).expect("link");
        let parent = File::open(temp.path()).expect("open parent");
        assert!(open_regular_at(&parent, OsStr::new("link"), RegularFileAccess::ReadOnly).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn open_regular_at_refuses_a_directory_leaf() {
        let temp = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir(temp.path().join("directory")).expect("directory");
        let parent = File::open(temp.path()).expect("open parent");
        assert!(open_regular_at(
            &parent,
            OsStr::new("directory"),
            RegularFileAccess::ReadOnly
        )
        .is_err());
    }

    #[cfg(unix)]
    #[test]
    fn open_regular_at_refuses_a_fifo_leaf() {
        let temp = tempfile::tempdir().expect("tempdir");
        let fifo = temp.path().join("fifo");
        let status = std::process::Command::new("mkfifo")
            .arg(&fifo)
            .status()
            .expect("run mkfifo");
        assert!(status.success(), "mkfifo failed with {status}");
        let parent = File::open(temp.path()).expect("open parent");
        assert!(open_regular_at(&parent, OsStr::new("fifo"), RegularFileAccess::ReadOnly).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn open_regular_at_refuses_a_multicomponent_leaf() {
        let temp = tempfile::tempdir().expect("tempdir");
        let parent = File::open(temp.path()).expect("open parent");
        assert!(open_regular_at(
            &parent,
            OsStr::new("nested/file"),
            RegularFileAccess::ReadOnly
        )
        .is_err());
    }

    #[cfg(unix)]
    #[test]
    fn open_regular_at_refuses_an_empty_leaf() {
        let temp = tempfile::tempdir().expect("tempdir");
        let parent = File::open(temp.path()).expect("open parent");
        assert!(open_regular_at(&parent, OsStr::new(""), RegularFileAccess::ReadOnly).is_err());
    }

    #[test]
    fn create_regular_at_is_exclusive_and_returns_the_created_identity() {
        let temp = tempfile::tempdir().expect("tempdir");
        #[cfg(unix)]
        let parent = File::open(temp.path()).expect("open parent");
        #[cfg(windows)]
        let parent = windows_test_parent(temp.path());
        let (created, identity) =
            create_regular_at(&parent, OsStr::new("database.db3")).expect("create regular leaf");
        assert_eq!(created.metadata().expect("created metadata").len(), 0);
        assert_eq!(
            entry_identity_at(&parent, OsStr::new("database.db3"), false).unwrap(),
            identity
        );
        match create_regular_at(&parent, OsStr::new("database.db3")) {
            Err(Error::Io(error)) => {
                assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists)
            }
            other => panic!("expected AlreadyExists, got {other:?}"),
        }
    }

    #[test]
    fn create_dir_at_is_exclusive_and_reports_already_exists() {
        let temp = tempfile::tempdir().expect("tempdir");
        #[cfg(unix)]
        let parent = File::open(temp.path()).expect("open parent");
        #[cfg(windows)]
        let parent = windows_test_parent(temp.path());
        create_dir_at(&parent, OsStr::new("folder")).expect("create directory");
        match create_dir_at(&parent, OsStr::new("folder")) {
            Err(Error::Io(error)) => {
                assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists)
            }
            other => panic!("expected AlreadyExists, got {other:?}"),
        }
    }

    #[test]
    fn optional_regular_missing_leaf_is_success() {
        let temp = tempfile::tempdir().expect("tempdir");
        #[cfg(unix)]
        let parent = File::open(temp.path()).expect("open parent");
        #[cfg(windows)]
        let parent = windows_test_parent(temp.path());
        let missing = OsStr::new("sidecar.info");
        assert!(
            !rename_optional_regular_at(&parent, missing, &parent, OsStr::new("other.info"))
                .expect("missing sidecar rename")
        );
        remove_optional_regular_at(&parent, missing).expect("missing sidecar removal");
    }

    #[cfg(unix)]
    #[test]
    fn create_regular_at_refuses_symlinks_and_invalid_leaves() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().expect("tempdir");
        let outside = temp.path().join("outside");
        std::fs::write(&outside, b"outside").expect("outside");
        let parent = File::open(temp.path()).expect("open parent");
        symlink(&outside, temp.path().join("link.db3")).expect("link");
        assert!(matches!(
            create_regular_at(&parent, OsStr::new("link.db3")),
            Err(Error::Io(_))
        ));
        for leaf in [OsStr::new(""), OsStr::new("nested/database.db3")] {
            assert!(matches!(
                create_regular_at(&parent, leaf),
                Err(Error::InvalidInput(_))
            ));
        }
        assert_eq!(std::fs::read(outside).expect("outside intact"), b"outside");
    }

    #[cfg(unix)]
    #[test]
    fn create_regular_at_uses_retained_parent_after_pathname_swap() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let moved = temp.path().join("moved");
        let outside = temp.path().join("outside");
        std::fs::create_dir(&root).expect("root");
        std::fs::create_dir(&outside).expect("outside");
        std::fs::write(outside.join("sentinel.db3"), b"outside").expect("sentinel");
        let parent = File::open(&root).expect("open retained parent");
        std::fs::rename(&root, &moved).expect("move root");
        symlink(&outside, &root).expect("install pathname substitute");

        let (_created, _) =
            create_regular_at(&parent, OsStr::new("created.db3")).expect("retained parent create");
        assert!(moved.join("created.db3").is_file());
        assert!(!outside.join("created.db3").exists());
        assert_eq!(
            std::fs::read(outside.join("sentinel.db3")).expect("outside intact"),
            b"outside"
        );
    }

    #[cfg(unix)]
    #[test]
    fn remove_entry_at_refuses_invalid_leaf_names() {
        let temp = tempfile::tempdir().expect("tempdir");
        let parent = File::open(temp.path()).expect("open parent");
        for name in ["", "nested/file"] {
            assert!(matches!(
                remove_entry_at(&parent, OsStr::new(name), (0, 0), false),
                Err(Error::InvalidInput(_))
            ));
        }
    }

    #[cfg(unix)]
    #[test]
    fn remove_entry_at_does_not_unlink_outside_parent() {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let outside = temp.path().join("outside");
        std::fs::create_dir(&root).expect("root");
        std::fs::write(&outside, b"outside").expect("outside");
        let parent = File::open(&root).expect("open parent");
        let expected = inode(&outside);

        for name in [OsStr::new("../outside"), outside.as_os_str()] {
            assert!(matches!(
                remove_entry_at(&parent, name, expected, false),
                Err(Error::InvalidInput(_))
            ));
            assert_eq!(std::fs::read(&outside).expect("outside intact"), b"outside");
        }
    }

    #[cfg(unix)]
    #[test]
    fn retained_parent_rename_cannot_follow_a_post_open_target_swap() {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let nested = root.join("nested");
        let outside = temp.path().join("outside");
        let destination = root.join("destination");
        std::fs::create_dir(&root).expect("root");
        std::fs::create_dir(&nested).expect("nested");
        std::fs::create_dir(&outside).expect("outside");
        std::fs::create_dir(&destination).expect("destination");
        let entry = nested.join("game.pgn");
        std::fs::write(&entry, b"trusted").expect("entry");
        std::fs::write(outside.join("game.pgn"), b"outside").expect("outside entry");
        let expected = inode(&entry);
        let (parent, leaf) = open_verified_parent(&entry, expected, false).expect("retain parent");
        let target_parent = std::fs::File::open(&destination).expect("destination FD");
        std::fs::rename(&nested, root.join("nested-old")).expect("move nested");
        std::os::unix::fs::symlink(&outside, &nested).expect("swap link");

        rename_entry_at(&parent, &leaf, expected, false, &target_parent, &leaf)
            .expect("rename through retained parent");
        assert_eq!(
            std::fs::read(destination.join("game.pgn")).expect("moved"),
            b"trusted"
        );
        assert_eq!(
            std::fs::read(outside.join("game.pgn")).expect("outside intact"),
            b"outside"
        );
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_rejects_symlink_children_without_traversing_them() {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let outside = temp.path().join("outside");
        let victim = root.join("victim");
        std::fs::create_dir(&root).expect("root");
        std::fs::create_dir(&outside).expect("outside");
        std::fs::create_dir(&victim).expect("victim");
        std::fs::write(outside.join("keep"), b"outside").expect("outside file");
        std::os::unix::fs::symlink(&outside, victim.join("link")).expect("link");
        let parent = std::fs::File::open(&root).expect("parent FD");

        assert!(matches!(
            remove_entry_at(
                &parent,
                std::ffi::OsStr::new("victim"),
                inode(&victim),
                true
            ),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(
            std::fs::read(outside.join("keep")).expect("outside intact"),
            b"outside"
        );
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_descends_through_nested_directories() {
        // `recursive_delete_rejects_symlink_children_without_traversing_them` does reach the
        // recursive call, but only to have it fail: the child is a symlink, so `?` propagates out
        // of the walk and the loop never reaches a second entry, the `.`/`..` skip, or the
        // closing `unlinkat(REMOVEDIR)`. Nothing deliberately drives the *successful* descent.
        // What actually reached it was other tests' workspace cleanup, and only where that
        // cleanup happens to take the permanent-delete path — on GitHub's runner the directory
        // arm runs exactly once (from the test above) against 21 times here, which is the whole
        // of the cross-machine coverage gap in `f-20260829-01`. Three levels, because two would
        // still pass if the recursion only ever unwound once.
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let victim = root.join("victim");
        let middle = victim.join("middle");
        let deepest = middle.join("deepest");
        std::fs::create_dir_all(&deepest).expect("tree");
        std::fs::write(victim.join("top.pgn"), b"top").expect("top file");
        std::fs::write(middle.join("middle.pgn"), b"middle").expect("middle file");
        std::fs::write(deepest.join("deepest.pgn"), b"deepest").expect("deepest file");
        std::fs::write(root.join("sibling.pgn"), b"sibling").expect("sibling file");
        let parent = std::fs::File::open(&root).expect("parent FD");

        remove_entry_at(
            &parent,
            std::ffi::OsStr::new("victim"),
            inode(&victim),
            true,
        )
        .expect("recursive delete");

        assert!(!victim.exists(), "the whole subtree is gone");
        assert_eq!(
            std::fs::read(root.join("sibling.pgn")).expect("sibling intact"),
            b"sibling",
            "the descent stays inside the named entry"
        );
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_reports_a_held_directory_removed_after_the_walk() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("removed"), b"content").unwrap();
        let injector = Arc::new(PostWalkMutation::new(
            victim.clone(),
            PostWalkAction::Remove,
        ));

        let error = remove_entry_with_injector(&parent, OsStr::new("victim"), expected, injector)
            .expect_err("removed held directory must be reported");

        let Error::PartialRemoval {
            removed_entries,
            cause,
        } = &error
        else {
            panic!("expected partial removal, got {error:?}");
        };
        assert!(*removed_entries >= 1);
        assert_directory_removed_during_enumeration(cause);
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_rejects_a_same_name_directory_replacement_after_the_walk() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("removed"), b"content").unwrap();
        let injector = Arc::new(PostWalkMutation::new(
            victim.clone(),
            PostWalkAction::ReplaceWithSentinel,
        ));

        let error = remove_entry_with_injector(&parent, OsStr::new("victim"), expected, injector)
            .expect_err("same-name replacement must be reported");

        let Error::PartialRemoval { cause, .. } = &error else {
            panic!("expected partial removal, got {error:?}");
        };
        assert_directory_removed_during_enumeration(cause);
        assert_eq!(std::fs::read(victim.join("sentinel")).unwrap(), b"sentinel");
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_rejects_a_symlink_planted_below_the_top_level() {
        // The test above refuses a symlink that is a direct child of the removed entry, so the
        // walk rejects it before descending into any directory. The property that matters is that
        // the refusal survives a real descent: the `statat`/`NOFOLLOW` check is per entry, so a
        // symlink reached only after two directory levels must hit the same arm rather than be
        // followed out of the tree.
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let outside = temp.path().join("outside");
        let victim = root.join("victim");
        let deepest = victim.join("middle").join("deepest");
        std::fs::create_dir_all(&deepest).expect("tree");
        std::fs::create_dir(&outside).expect("outside");
        std::fs::write(outside.join("keep"), b"outside").expect("outside file");
        std::os::unix::fs::symlink(&outside, deepest.join("link")).expect("link");
        let parent = std::fs::File::open(&root).expect("parent FD");

        assert!(matches!(
            remove_entry_at(
                &parent,
                std::ffi::OsStr::new("victim"),
                inode(&victim),
                true
            ),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(
            std::fs::read(outside.join("keep")).expect("outside intact"),
            b"outside",
            "the descent never followed the link"
        );
    }

    #[cfg(unix)]
    struct RemovalSwap {
        point: unix::RemovalFaultPoint,
        target: PathBuf,
        replacement: PathBuf,
    }

    #[cfg(unix)]
    impl unix::RemovalInjector for RemovalSwap {
        fn inject(&self, point: unix::RemovalFaultPoint) -> std::io::Result<Option<u64>> {
            if point == self.point && self.replacement.exists() {
                std::fs::remove_dir_all(&self.target)?;
                std::fs::rename(&self.replacement, &self.target)?;
            }
            Ok(None)
        }
    }

    #[cfg(unix)]
    enum PostWalkAction {
        Remove,
        ReplaceWithSentinel,
        RenameAway {
            destination: PathBuf,
        },
        #[cfg(target_os = "macos")]
        RemoveParentAndCreateFile {
            parent: PathBuf,
        },
    }

    #[cfg(unix)]
    struct PostWalkMutation {
        target: PathBuf,
        action: PostWalkAction,
        cancellation: Option<CancellationToken>,
        fired: std::sync::atomic::AtomicBool,
    }

    #[cfg(unix)]
    impl PostWalkMutation {
        fn new(target: PathBuf, action: PostWalkAction) -> Self {
            Self {
                target,
                action,
                cancellation: None,
                fired: std::sync::atomic::AtomicBool::new(false),
            }
        }

        fn with_cancellation(mut self, cancellation: CancellationToken) -> Self {
            self.cancellation = Some(cancellation);
            self
        }
    }

    #[cfg(unix)]
    impl unix::RemovalInjector for PostWalkMutation {
        fn inject(&self, point: unix::RemovalFaultPoint) -> std::io::Result<Option<u64>> {
            if point != unix::RemovalFaultPoint::AfterDirectoryWalk
                || self.fired.swap(true, std::sync::atomic::Ordering::SeqCst)
            {
                return Ok(None);
            }
            match &self.action {
                PostWalkAction::Remove => std::fs::remove_dir_all(&self.target)?,
                PostWalkAction::ReplaceWithSentinel => {
                    std::fs::remove_dir_all(&self.target)?;
                    std::fs::create_dir(&self.target)?;
                    std::fs::write(self.target.join("sentinel"), b"sentinel")?;
                }
                PostWalkAction::RenameAway { destination } => {
                    std::fs::rename(&self.target, destination)?;
                }
                #[cfg(target_os = "macos")]
                PostWalkAction::RemoveParentAndCreateFile { parent } => {
                    std::fs::remove_dir_all(&self.target)?;
                    std::fs::remove_dir_all(parent)?;
                    std::fs::write(parent, b"parent replacement")?;
                }
            }
            if let Some(cancellation) = &self.cancellation {
                cancellation.cancel();
            }
            Ok(None)
        }
    }

    #[cfg(unix)]
    struct ParentDeviceOverride(u64);

    #[cfg(unix)]
    impl unix::RemovalInjector for ParentDeviceOverride {
        fn inject(&self, point: unix::RemovalFaultPoint) -> std::io::Result<Option<u64>> {
            if point == unix::RemovalFaultPoint::BeforeChildOpen {
                return Ok(Some(self.0));
            }
            Ok(None)
        }
    }

    #[cfg(target_os = "linux")]
    #[derive(Clone, Copy)]
    enum InjectedStatx {
        Nosys,
        MissingMountRootMask,
        MountRoot(bool),
        Error(i32),
    }

    #[cfg(target_os = "linux")]
    enum InjectedFdinfo {
        Real,
        Unreadable,
        ByDescriptor(Mutex<std::collections::HashMap<std::os::fd::RawFd, Vec<u8>>>),
    }

    #[cfg(target_os = "linux")]
    struct MountEvidenceInjector {
        statx: InjectedStatx,
        fdinfo: InjectedFdinfo,
        child_fdinfo_record: Option<Vec<u8>>,
    }

    #[cfg(target_os = "linux")]
    impl MountEvidenceInjector {
        fn real_fdinfo(statx: InjectedStatx) -> Self {
            Self {
                statx,
                fdinfo: InjectedFdinfo::Real,
                child_fdinfo_record: None,
            }
        }

        fn unreadable_fdinfo(statx: InjectedStatx) -> Self {
            Self {
                statx,
                fdinfo: InjectedFdinfo::Unreadable,
                child_fdinfo_record: None,
            }
        }

        fn records(
            statx: InjectedStatx,
            parent: std::os::fd::RawFd,
            parent_record: &[u8],
            child_record: &[u8],
        ) -> Self {
            Self {
                statx,
                fdinfo: InjectedFdinfo::ByDescriptor(Mutex::new(
                    [(parent, parent_record.to_vec())].into_iter().collect(),
                )),
                child_fdinfo_record: Some(child_record.to_vec()),
            }
        }
    }

    #[cfg(target_os = "linux")]
    impl unix::RemovalInjector for MountEvidenceInjector {
        fn statx_mount_attributes(
            &self,
            descriptor: std::os::fd::RawFd,
        ) -> Option<std::io::Result<(u64, u64)>> {
            use rustix::{fs::StatxAttributes, io::Errno};
            if let (InjectedFdinfo::ByDescriptor(records), Some(child_record)) =
                (&self.fdinfo, &self.child_fdinfo_record)
            {
                records
                    .lock()
                    .expect("fdinfo records")
                    .insert(descriptor, child_record.clone());
            }
            let mount_root = StatxAttributes::MOUNT_ROOT.bits();
            Some(match self.statx {
                InjectedStatx::Nosys => Err(std::io::Error::from_raw_os_error(
                    Errno::NOSYS.raw_os_error(),
                )),
                InjectedStatx::MissingMountRootMask => Ok((0, 0)),
                InjectedStatx::MountRoot(is_mount) => {
                    Ok((mount_root, if is_mount { mount_root } else { 0 }))
                }
                InjectedStatx::Error(code) => Err(std::io::Error::from_raw_os_error(code)),
            })
        }

        fn fdinfo_record(
            &self,
            descriptor: std::os::fd::RawFd,
        ) -> Option<std::io::Result<Vec<u8>>> {
            match &self.fdinfo {
                InjectedFdinfo::Real => None,
                InjectedFdinfo::Unreadable => Some(Err(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "injected unreadable fdinfo",
                ))),
                InjectedFdinfo::ByDescriptor(records) => Some(
                    match records.lock().expect("fdinfo records").get(&descriptor) {
                        Some(record) => Ok(record.clone()),
                        None => Err(std::io::Error::new(
                            std::io::ErrorKind::NotFound,
                            format!("no injected fdinfo record for descriptor {descriptor}"),
                        )),
                    },
                ),
            }
        }
    }

    #[cfg(target_os = "macos")]
    struct MacMountInjector {
        paths: Mutex<Vec<std::io::Result<Vec<libc::c_char>>>>,
        flags: Mutex<Vec<std::io::Result<u32>>>,
        events: Mutex<Vec<&'static str>>,
    }

    #[cfg(target_os = "macos")]
    impl MacMountInjector {
        fn new(
            paths: Vec<std::io::Result<Vec<libc::c_char>>>,
            flags: Vec<std::io::Result<u32>>,
        ) -> Arc<Self> {
            Arc::new(Self {
                paths: Mutex::new(paths),
                flags: Mutex::new(flags),
                events: Mutex::new(Vec::new()),
            })
        }

        fn path(bytes: &[u8]) -> std::io::Result<Vec<libc::c_char>> {
            Ok(bytes.iter().map(|byte| *byte as libc::c_char).collect())
        }

        fn events(&self) -> Vec<&'static str> {
            self.events.lock().expect("mount events").clone()
        }
    }

    #[cfg(target_os = "macos")]
    impl unix::RemovalInjector for MacMountInjector {
        fn inject(&self, point: unix::RemovalFaultPoint) -> std::io::Result<Option<u64>> {
            if point == unix::RemovalFaultPoint::BeforeDirOpen {
                self.events
                    .lock()
                    .expect("mount events")
                    .push("before_dir_open");
            }
            Ok(None)
        }

        fn mount_path_buffer(
            &self,
            _: std::os::fd::RawFd,
        ) -> Option<std::io::Result<Vec<libc::c_char>>> {
            self.events.lock().expect("mount events").push("mount_path");
            let mut paths = self.paths.lock().expect("mount paths");
            (!paths.is_empty()).then(|| paths.remove(0))
        }

        fn mount_flags(&self, _: std::os::fd::RawFd) -> Option<std::io::Result<u32>> {
            self.events
                .lock()
                .expect("mount events")
                .push("mount_flags");
            let mut flags = self.flags.lock().expect("mount flags");
            (!flags.is_empty()).then(|| flags.remove(0))
        }
    }

    #[cfg(unix)]
    #[test]
    fn mount_path_buffer_parser_accepts_only_terminated_non_empty_paths() {
        let path = |bytes: &[u8]| {
            bytes
                .iter()
                .map(|byte| *byte as libc::c_char)
                .collect::<Vec<_>>()
        };
        assert_eq!(
            unix::mount_path_from_buffer(&path(b"/private/tmp\0trailing"))
                .expect("terminated mount path"),
            b"/private/tmp"
        );
        for buffer in [path(b"/private/tmp"), path(b"\0")].iter() {
            assert!(matches!(
                unix::mount_path_from_buffer(buffer),
                Err(Error::InvalidInput(_))
            ));
        }
    }

    #[cfg(unix)]
    #[test]
    fn mount_decision_compares_paths_and_propagates_either_error() {
        assert!(!unix::mount_crossing_from(Ok(b"/tmp".to_vec()), Ok(b"/tmp".to_vec())).unwrap());
        assert!(unix::mount_crossing_from(Ok(b"/".to_vec()), Ok(b"/dev".to_vec())).unwrap());
        let parent_error = Error::InvalidInput("parent evidence".into());
        assert!(matches!(
            unix::mount_crossing_from(Err(parent_error), Ok(Vec::new())),
            Err(Error::InvalidInput(message)) if message == "parent evidence"
        ));
        let child_error = Error::InvalidInput("child evidence".into());
        assert!(matches!(
            unix::mount_crossing_from(Ok(Vec::new()), Err(child_error)),
            Err(Error::InvalidInput(message)) if message == "child evidence"
        ));
    }

    #[cfg(unix)]
    #[test]
    fn union_mount_refusal_rejects_the_union_flag() {
        assert!(unix::union_mount_refusal(0, 0x20).is_ok());
        for flags in [0x20, 0x21] {
            assert!(unix::union_mount_refusal(flags, 0x20).is_err());
        }
        assert!(matches!(
            unix::union_mount_refusal(0x20, 0x20),
            Err(Error::InvalidInput(message)) if message == "directory walks refuse union mounts"
        ));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_mnt_union_is_the_expected_flag() {
        assert_eq!(libc::MNT_UNION as u32, 0x20);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_real_tempdir_walk_passes_union_check() {
        let temp = tempfile::tempdir().expect("tempdir");
        std::fs::write(temp.path().join("file"), b"file").expect("file");
        let directory = File::open(temp.path()).expect("directory");
        unix::walk_directory(&directory, |_, _| Ok(())).expect("ordinary tempdir walk");
    }

    #[cfg(target_os = "macos")]
    fn macos_mount_fixture() -> (tempfile::TempDir, PathBuf, (u64, u64), File) {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let victim = root.join("victim");
        std::fs::create_dir_all(victim.join("child")).expect("tree");
        std::fs::write(victim.join("child/file"), b"file").expect("file");
        let parent = File::open(&root).expect("parent");
        (temp, victim.clone(), inode(&victim), parent)
    }

    #[cfg(target_os = "macos")]
    fn assert_macos_mount_error(
        paths: Vec<std::io::Result<Vec<libc::c_char>>>,
    ) -> (Error, tempfile::TempDir, PathBuf, Arc<MacMountInjector>) {
        let (temp, victim, expected, parent) = macos_mount_fixture();
        let injector = MacMountInjector::new(paths, Vec::new());
        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::clone(&injector) as Arc<dyn unix::RemovalInjector + Send + Sync>,
        )
        .expect_err("injected mount evidence must refuse deletion");
        (error, temp, victim, injector)
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_mount_crossing_refuses_different_mount_paths() {
        let paths = vec![
            MacMountInjector::path(b"/parent\0"),
            MacMountInjector::path(b"/child\0"),
        ];
        let (error, _temp, victim, _injector) = assert_macos_mount_error(paths);
        assert!(matches!(
            error,
            Error::InvalidInput(message) if message == "directory cleanup refuses to cross a mount"
        ));
        assert!(victim.join("child/file").is_file());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_mount_crossing_rejects_unterminated_path() {
        let paths = vec![
            MacMountInjector::path(b"/parent\0"),
            MacMountInjector::path(b"/child"),
        ];
        let (error, _temp, victim, _injector) = assert_macos_mount_error(paths);
        assert!(matches!(error, Error::InvalidInput(_)));
        assert!(victim.join("child/file").is_file());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_mount_crossing_rejects_empty_paths() {
        let paths = vec![MacMountInjector::path(b"\0"), MacMountInjector::path(b"\0")];
        let (error, _temp, victim, _injector) = assert_macos_mount_error(paths);
        assert!(matches!(error, Error::InvalidInput(_)));
        assert!(victim.join("child/file").is_file());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_mount_crossing_propagates_child_error() {
        let paths = vec![
            MacMountInjector::path(b"/parent\0"),
            Err(std::io::Error::from_raw_os_error(libc::EIO)),
        ];
        let (error, _temp, victim, _injector) = assert_macos_mount_error(paths);
        assert!(matches!(error, Error::Io(io_error) if io_error.raw_os_error() == Some(libc::EIO)));
        assert!(victim.join("child/file").is_file());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_mount_crossing_propagates_parent_error() {
        let paths = vec![
            Err(std::io::Error::from_raw_os_error(libc::EIO)),
            MacMountInjector::path(b"/child\0"),
        ];
        let (error, _temp, victim, _injector) = assert_macos_mount_error(paths);
        assert!(matches!(error, Error::Io(io_error) if io_error.raw_os_error() == Some(libc::EIO)));
        assert!(victim.join("child/file").is_file());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_union_mount_refusal_happens_before_child_dir_open() {
        let (temp, victim, expected, parent) = macos_mount_fixture();
        let injector = MacMountInjector::new(Vec::new(), vec![Ok(0), Ok(libc::MNT_UNION as u32)]);
        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::clone(&injector) as Arc<dyn unix::RemovalInjector + Send + Sync>,
        )
        .expect_err("union mount must refuse deletion");
        assert!(matches!(
            error,
            Error::InvalidInput(message) if message == "directory walks refuse union mounts"
        ));
        assert!(victim.join("child/file").is_file());
        let events = injector.events();
        assert_eq!(
            events
                .iter()
                .filter(|event| **event == "mount_flags")
                .count(),
            2
        );
        assert_eq!(
            events
                .iter()
                .filter(|event| **event == "before_dir_open")
                .count(),
            1
        );
        assert_eq!(events.last(), Some(&"mount_flags"));
        drop(temp);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_union_mount_refusal_happens_before_install_dir_open() {
        let (temp, source, target) = directory_fixture();
        let nested = source.join("nested");
        std::fs::create_dir(&nested).expect("nested");
        std::fs::write(nested.join("file"), b"file").expect("file");
        let injector = MacMountInjector::new(Vec::new(), vec![Ok(0), Ok(libc::MNT_UNION as u32)]);
        let _guard = unix::scoped_test_removal_injector(
            Arc::clone(&injector) as Arc<dyn unix::RemovalInjector + Send + Sync>
        );
        let error =
            atomic_install_dir(&source, &target).expect_err("union mount must refuse install");
        assert!(matches!(
            error,
            Error::InvalidInput(message) if message == "directory walks refuse union mounts"
        ));
        assert!(source.join("new").is_file());
        assert!(nested.join("file").is_file());
        assert_eq!(
            std::fs::read(target.join("old")).expect("old target"),
            b"old"
        );
        assert_eq!(
            injector.events(),
            vec!["mount_flags", "before_dir_open", "mount_flags"]
        );
        drop(temp);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_port_real_mount_evidence_distinguishes_devfs() {
        let temp = tempfile::tempdir().expect("tempdir");
        let first = File::open(temp.path()).expect("tempdir descriptor");
        let second = File::open(temp.path()).expect("second descriptor");
        assert!(!unix::mount_crossing(&first, &second).expect("same mount evidence"));
        let root = File::open("/").expect("root descriptor");
        let dev = File::open("/dev").expect("devfs descriptor");
        assert!(unix::mount_crossing(&root, &dev).expect("devfs mount evidence"));
    }

    #[cfg(unix)]
    fn removal_fixture() -> (tempfile::TempDir, PathBuf, PathBuf, (u64, u64), File) {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let victim = root.join("victim");
        std::fs::create_dir_all(&victim).expect("victim");
        let expected = inode(&victim);
        let parent = File::open(&root).expect("parent FD");
        (temp, root, victim, expected, parent)
    }

    #[cfg(unix)]
    fn remove_entry_with_injector(
        parent: &File,
        name: &OsStr,
        expected: (u64, u64),
        injector: Arc<dyn unix::RemovalInjector + Send + Sync>,
    ) -> Result<(), Error> {
        let _guard = unix::scoped_test_removal_injector(injector);
        remove_entry_at(parent, name, expected, true)
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn fdinfo_mount_id_parser_accepts_one_decimal_field() {
        assert_eq!(
            unix::parse_fdinfo_mount_id(b"pos:\t0\nflags:\t0100000\nmnt_id:\t4294967297\n")
                .expect("valid mount id"),
            4_294_967_297
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn fdinfo_mount_id_parser_rejects_missing_duplicate_malformed_and_boundedness_failures() {
        let oversized = vec![b'x'; 4097];
        for record in [
            b"pos:\t0\n".as_slice(),
            b"mnt_id:\t1\nmnt_id:\t1\n".as_slice(),
            b"mnt_id: 12x\n".as_slice(),
            b"mnt_id:\t18446744073709551616\n".as_slice(),
            oversized.as_slice(),
        ] {
            assert!(matches!(
                unix::parse_fdinfo_mount_id(record),
                Err(Error::InvalidInput(_))
            ));
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn fdinfo_mount_id_reads_real_descriptor_records() {
        let temp = tempfile::tempdir().expect("tempdir");
        let left = File::open(temp.path()).expect("left descriptor");
        let right = File::open(temp.path()).expect("right descriptor");
        assert_eq!(
            unix::read_fdinfo_mount_id(&left).expect("left mount id"),
            unix::read_fdinfo_mount_id(&right).expect("right mount id")
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn recursive_delete_succeeds_with_same_mount_fdinfo_for_both_statx_unavailable_forms() {
        for statx in [InjectedStatx::Nosys, InjectedStatx::MissingMountRootMask] {
            let (_temp, _root, victim, expected, parent) = removal_fixture();
            std::fs::create_dir(victim.join("child")).expect("child");
            std::fs::write(victim.join("child/removed"), b"content").expect("content");
            remove_entry_with_injector(
                &parent,
                OsStr::new("victim"),
                expected,
                Arc::new(MountEvidenceInjector::real_fdinfo(statx)),
            )
            .expect("same-mount recursive deletion");
            assert!(!victim.exists());
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn recursive_delete_propagates_non_nosys_statx_errors_before_deletion() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("keep"), b"content").expect("content");
        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(MountEvidenceInjector::real_fdinfo(InjectedStatx::Error(
                rustix::io::Errno::ACCESS.raw_os_error(),
            ))),
        )
        .expect_err("statx error must propagate");
        assert!(matches!(error, Error::Io(_)));
        assert_eq!(
            std::fs::read(victim.join("keep")).expect("intact"),
            b"content"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn recursive_delete_refuses_unreadable_fdinfo_before_deletion() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("keep"), b"content").expect("content");
        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(MountEvidenceInjector::unreadable_fdinfo(
                InjectedStatx::Nosys,
            )),
        )
        .expect_err("unreadable fdinfo must refuse descent");
        assert!(matches!(error, Error::Io(_)));
        assert_eq!(
            std::fs::read(victim.join("keep")).expect("intact"),
            b"content"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn recursive_delete_refuses_invalid_fdinfo_before_deletion() {
        use std::os::fd::AsRawFd;

        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("keep"), b"content").expect("content");
        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(MountEvidenceInjector::records(
                InjectedStatx::Nosys,
                parent.as_raw_fd(),
                b"pos:\t0\n",
                b"mnt_id:\t42\n",
            )),
        )
        .expect_err("invalid fdinfo must refuse descent");
        assert!(matches!(error, Error::InvalidInput(_)));
        assert_eq!(
            std::fs::read(victim.join("keep")).expect("intact"),
            b"content"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn recursive_delete_refuses_unequal_mount_ids_even_when_devices_match() {
        use std::os::fd::AsRawFd;

        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("keep"), b"content").expect("content");
        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(MountEvidenceInjector::records(
                InjectedStatx::MissingMountRootMask,
                parent.as_raw_fd(),
                b"mnt_id:\t41\n",
                b"mnt_id:\t42\n",
            )),
        )
        .expect_err("different descriptor mount ids must refuse descent");
        assert!(matches!(error, Error::InvalidInput(_)));
        assert_eq!(
            std::fs::read(victim.join("keep")).expect("intact"),
            b"content"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn recursive_delete_accepts_equal_descriptor_addressed_mount_ids() {
        use std::os::fd::AsRawFd;

        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("removed"), b"content").expect("content");
        remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(MountEvidenceInjector::records(
                InjectedStatx::MissingMountRootMask,
                parent.as_raw_fd(),
                b"mnt_id:\t42\n",
                b"mnt_id:\t42\n",
            )),
        )
        .expect("equal descriptor mount ids permit deletion");
        assert!(!victim.exists());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn recursive_delete_uses_supported_statx_mount_root_without_fdinfo() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("keep"), b"content").expect("content");
        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(MountEvidenceInjector::unreadable_fdinfo(
                InjectedStatx::MountRoot(true),
            )),
        )
        .expect_err("mount root must refuse descent");
        assert!(matches!(error, Error::InvalidInput(_)));
        assert_eq!(
            std::fs::read(victim.join("keep")).expect("intact"),
            b"content"
        );

        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("removed"), b"content").expect("content");
        remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(MountEvidenceInjector::unreadable_fdinfo(
                InjectedStatx::MountRoot(false),
            )),
        )
        .expect("clear supported mount-root attribute permits deletion");
        assert!(!victim.exists());
    }

    #[cfg(target_os = "linux")]
    struct BindMountFixture {
        temp: Option<tempfile::TempDir>,
        root: PathBuf,
        victim: PathBuf,
        source: PathBuf,
        mounted: Option<PathBuf>,
    }

    #[cfg(target_os = "linux")]
    impl BindMountFixture {
        fn new(mount_below_target: bool) -> std::io::Result<Self> {
            let temp = tempfile::tempdir()?;
            let root = temp.path().join("root");
            let victim = root.join("victim");
            let source = temp.path().join("source");
            std::fs::create_dir_all(&victim)?;
            std::fs::create_dir(&source)?;
            std::fs::write(source.join("keep"), b"mounted content")?;
            let target = if mount_below_target {
                let target = victim.join("mounted");
                std::fs::create_dir(&target)?;
                target
            } else {
                victim.clone()
            };
            // Own and disarm cleanup before starting `mount`: even a command error is uncertain
            // until an explicit unmount attempt proves the target is clear.
            let mut fixture = Self {
                temp: Some(temp),
                root,
                victim,
                source,
                mounted: Some(target.clone()),
            };
            let output = std::process::Command::new("mount")
                .args(["--bind"])
                .arg(&fixture.source)
                .arg(&target)
                .output();
            match output {
                Ok(output) if output.status.success() => Ok(fixture),
                Ok(output) => {
                    let primary = format!(
                        "bind mount failed with {}: {}",
                        output.status,
                        String::from_utf8_lossy(&output.stderr)
                    );
                    if let Err(cleanup) = fixture.cleanup() {
                        return Err(std::io::Error::other(format!(
                            "{primary}; cleanup also failed: {cleanup}"
                        )));
                    }
                    Err(std::io::Error::other(primary))
                }
                Err(primary) => {
                    if let Err(cleanup) = fixture.cleanup() {
                        return Err(std::io::Error::other(format!(
                            "bind mount command failed: {primary}; cleanup also failed: {cleanup}"
                        )));
                    }
                    Err(primary)
                }
            }
        }

        fn cleanup(&mut self) -> std::io::Result<()> {
            let Some(target) = self.mounted.as_ref() else {
                drop(self.temp.take());
                return Ok(());
            };
            let failure = match std::process::Command::new("umount").arg(target).output() {
                Ok(output) if output.status.success() => None,
                Ok(output) => Some(format!(
                    "{}: {}",
                    output.status,
                    String::from_utf8_lossy(&output.stderr)
                )),
                Err(error) => Some(error.to_string()),
            };
            if let Some(failure) = failure {
                let retained = self
                    .temp
                    .take()
                    .expect("mounted fixture owns its temporary directory")
                    .keep();
                return Err(std::io::Error::other(format!(
                    "failed to unmount bind fixture; retained {}: {failure}",
                    retained.display()
                )));
            }
            self.mounted.take();
            drop(self.temp.take());
            Ok(())
        }
    }

    #[cfg(target_os = "linux")]
    impl Drop for BindMountFixture {
        fn drop(&mut self) {
            if self.mounted.is_none() || self.temp.is_none() {
                return;
            }
            if let Err(error) = self.cleanup() {
                eprintln!("bind-mount fixture cleanup failed during unwind: {error}");
            }
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn bind_mount_fixture_retains_tempdir_when_unmount_fails() {
        let temp = tempfile::tempdir().expect("tempdir");
        let retained = temp.path().to_path_buf();
        let nonexistent_target = retained.join("not-mounted");
        let mut fixture = BindMountFixture {
            temp: Some(temp),
            root: retained.join("root"),
            victim: retained.join("victim"),
            source: retained.join("source"),
            mounted: Some(nonexistent_target),
        };
        fixture.cleanup().expect_err("unmount must fail");
        assert!(retained.exists(), "failed cleanup retains the fixture");
        drop(fixture);
        std::fs::remove_dir_all(retained).expect("remove known-unmounted retained test fixture");
    }

    #[cfg(target_os = "linux")]
    #[test]
    #[ignore = "requires an isolated user and mount namespace"]
    fn recursive_delete_refuses_bind_mount_without_mount_root() {
        for mount_below_target in [false, true] {
            for statx in [InjectedStatx::Nosys, InjectedStatx::MissingMountRootMask] {
                let mut fixture = BindMountFixture::new(mount_below_target)
                    .expect("create real same-filesystem bind mount fixture");
                let parent = File::open(&fixture.root).expect("parent descriptor");
                let expected = inode(&fixture.victim);
                let error = remove_entry_with_injector(
                    &parent,
                    OsStr::new("victim"),
                    expected,
                    Arc::new(MountEvidenceInjector::real_fdinfo(statx)),
                )
                .expect_err("descriptor mount-id mismatch must refuse recursive deletion");
                assert_eq!(
                    std::fs::read(fixture.source.join("keep")).expect("source content survives"),
                    b"mounted content"
                );
                assert!(matches!(
                    error,
                    Error::InvalidInput(message)
                        if message == "directory cleanup refuses to cross a mount"
                ));
                fixture
                    .cleanup()
                    .expect("unmount bind fixture before temporary-directory cleanup");
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_rejects_top_level_substitution() {
        let (_temp, root, victim, expected, parent) = removal_fixture();
        let replacement = root.join("replacement");
        std::fs::create_dir(&replacement).expect("replacement");
        std::fs::write(replacement.join("keep"), b"replacement").expect("replacement content");

        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(RemovalSwap {
                point: unix::RemovalFaultPoint::BeforeTopOpen,
                target: victim.clone(),
                replacement,
            }),
        )
        .expect_err("substitution must be rejected");

        assert!(matches!(error, Error::Conflict(_)));
        assert_eq!(
            std::fs::read(victim.join("keep")).expect("substituted tree survives"),
            b"replacement"
        );
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_rejects_child_substitution() {
        let (_temp, root, victim, expected, parent) = removal_fixture();
        let child = victim.join("child");
        let replacement = root.join("replacement");
        std::fs::create_dir_all(&child).expect("child");
        std::fs::create_dir(&replacement).expect("replacement");
        std::fs::write(replacement.join("keep"), b"replacement").expect("replacement content");
        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(RemovalSwap {
                point: unix::RemovalFaultPoint::BeforeChildOpen,
                target: child.clone(),
                replacement,
            }),
        )
        .expect_err("substitution must be rejected");

        assert!(matches!(error, Error::Conflict(_)));
        assert_eq!(
            std::fs::read(child.join("keep")).expect("substituted tree survives"),
            b"replacement"
        );
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_rejects_child_substitution_before_stat() {
        let (_temp, root, victim, expected, parent) = removal_fixture();
        let child = victim.join("child");
        let replacement = root.join("replacement");
        std::fs::create_dir_all(&child).expect("child");
        std::fs::create_dir(&replacement).expect("replacement");
        std::fs::write(replacement.join("keep"), b"replacement").expect("replacement content");

        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(RemovalSwap {
                point: unix::RemovalFaultPoint::BeforeChildStat,
                target: child.clone(),
                replacement,
            }),
        )
        .expect_err("substitution must be rejected");

        assert!(matches!(error, Error::Conflict(_)));
        assert_eq!(
            std::fs::read(child.join("keep")).expect("substituted tree survives"),
            b"replacement"
        );
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_refuses_a_forced_parent_device() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        let child = victim.join("child");
        std::fs::create_dir_all(&child).expect("child");
        std::fs::write(child.join("keep"), b"content").expect("child content");

        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(ParentDeviceOverride(expected.0.wrapping_add(1))),
        )
        .expect_err("mount must be rejected");

        assert!(matches!(error, Error::InvalidInput(_)));
        assert_eq!(
            std::fs::read(child.join("keep")).expect("mounted child survives"),
            b"content"
        );
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_refuses_more_than_the_maximum_depth() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        let mut current = victim.clone();
        for level in 1..unix::MAX_REMOVE_TREE_DEPTH {
            current = current.join(format!("level-{level}"));
            std::fs::create_dir(&current).expect("nested directory");
        }
        let boundary = current.join("boundary");
        std::fs::write(&boundary, b"content").expect("boundary entry");
        let error = remove_entry_at(&parent, OsStr::new("victim"), expected, true)
            .expect_err("depth must be bounded");

        assert!(matches!(error, Error::ResourceLimit(_)));
        assert!(boundary.is_file(), "the refused entry survives");
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_reports_partial_progress() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("removed"), b"content").expect("child content");

        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(unix::RemovalFault(
                unix::RemovalFaultPoint::AfterEntryRemoved,
            )),
        )
        .expect_err("post-removal failure must be reported");

        let serialized = serde_json::to_string(&error).expect("serialize partial removal");
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert_eq!(payload["category"], "partial-removal");
        assert_eq!(payload["message"], error.to_string());
        assert!(!serialized.contains("/private/removal"));
        assert!(!serialized.contains(r"C:\private\removal"));
        assert!(!serialized.contains("injected removal failure"));

        assert!(matches!(
            error,
            Error::PartialRemoval {
                removed_entries,
                ..
            } if removed_entries >= 1
        ));
        assert!(error.to_string().starts_with("Partially removed:"));
    }

    #[cfg(unix)]
    #[test]
    fn recursive_delete_maps_parent_sync_failure_after_complete_removal() {
        let (_temp, _root, victim, expected, parent) = removal_fixture();
        std::fs::write(victim.join("removed"), b"content").expect("child content");

        let error = remove_entry_with_injector(
            &parent,
            OsStr::new("victim"),
            expected,
            Arc::new(unix::RemovalFault(unix::RemovalFaultPoint::ParentSync)),
        )
        .expect_err("parent sync failure must preserve commit status");

        let serialized = serde_json::to_string(&error).expect("serialize removal error");
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert_eq!(payload["category"], "durability");
        assert_eq!(
            payload["message"],
            "Committed but durability uncertain: workspace removal"
        );

        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert!(!victim.exists(), "the tree was completely removed");
    }

    struct Fault(
        Option<AtomicFileFaultPoint>,
        Option<AtomicFileFaultPoint>,
        Arc<Mutex<Vec<AtomicFileFaultPoint>>>,
    );
    impl AtomicWriterInjector for Fault {
        fn inject(&self, p: AtomicFileFaultPoint) -> std::io::Result<()> {
            self.2.lock().expect("lock").push(p);
            if self.0 == Some(p) || self.1 == Some(p) {
                Err(std::io::Error::other("injected"))
            } else {
                Ok(())
            }
        }
    }

    struct Mutation {
        point: AtomicFileFaultPoint,
        target: PathBuf,
        parent: PathBuf,
        action: &'static str,
    }
    impl AtomicWriterInjector for Mutation {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point != self.point {
                return Ok(());
            }
            match self.action {
                "create" => std::fs::write(&self.target, b"racer"),
                "replace" => {
                    std::fs::remove_file(&self.target)?;
                    #[cfg(unix)]
                    {
                        std::os::unix::fs::symlink("replacement", &self.target)
                    }
                    #[cfg(not(unix))]
                    {
                        std::fs::write(&self.target, b"racer")
                    }
                }
                "parent" => {
                    let moved = self.parent.with_extension("moved");
                    std::fs::rename(&self.parent, &moved)?;
                    std::fs::create_dir(&self.parent)
                }
                _ => unreachable!("test action"),
            }
        }
    }

    #[cfg(windows)]
    struct PostRenameSwap {
        target: PathBuf,
        installed: PathBuf,
    }

    #[cfg(windows)]
    impl AtomicWriterInjector for PostRenameSwap {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == AtomicFileFaultPoint::PostRenameMetadata {
                std::fs::rename(&self.target, &self.installed)?;
                std::fs::write(&self.target, b"racer")?;
            }
            Ok(())
        }
    }

    struct PrivateTemp {
        parent: PathBuf,
    }

    struct BreakCleanup {
        parent: PathBuf,
    }

    struct PrecommitOrder {
        complete: std::sync::Arc<std::sync::atomic::AtomicBool>,
        observed_at_rename: std::sync::Arc<std::sync::atomic::AtomicBool>,
    }
    impl AtomicWriterInjector for PrecommitOrder {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == AtomicFileFaultPoint::Rename {
                self.observed_at_rename.store(
                    self.complete.load(std::sync::atomic::Ordering::SeqCst),
                    std::sync::atomic::Ordering::SeqCst,
                );
            }
            Ok(())
        }
    }
    impl AtomicWriterInjector for BreakCleanup {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == AtomicFileFaultPoint::Write {
                return Err(std::io::Error::other("primary"));
            }
            if point == AtomicFileFaultPoint::Cleanup {
                let temp = std::fs::read_dir(&self.parent)?
                    .find_map(|entry| {
                        let entry = entry.ok()?;
                        entry
                            .file_name()
                            .to_string_lossy()
                            .starts_with(".atomic-")
                            .then_some(entry.path())
                    })
                    .expect("temp");
                let moved = self.parent.join("moved-temp");
                std::fs::rename(&temp, &moved)?;
                std::fs::create_dir(&temp)?;
                std::fs::write(temp.join("blocker"), b"x")?;
            }
            Ok(())
        }
    }
    impl AtomicWriterInjector for PrivateTemp {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            #[cfg(windows)]
            if point == AtomicFileFaultPoint::Write {
                let temp = std::fs::read_dir(&self.parent)?
                    .find_map(|entry| {
                        let entry = entry.ok()?;
                        entry
                            .file_name()
                            .to_string_lossy()
                            .starts_with(".atomic-")
                            .then_some(entry.path())
                    })
                    .expect("private temporary file exists");
                assert!(
                    std::fs::File::open(temp).is_err(),
                    "temporary must not share reads before its DACL is final"
                );
            }
            #[cfg(not(unix))]
            let _ = point;
            #[cfg(unix)]
            if matches!(
                point,
                AtomicFileFaultPoint::Write
                    | AtomicFileFaultPoint::Flush
                    | AtomicFileFaultPoint::FileSync
                    | AtomicFileFaultPoint::PermissionCopy
            ) {
                use std::os::unix::fs::PermissionsExt;
                let temp = std::fs::read_dir(&self.parent)?
                    .find_map(|entry| entry.ok().map(|entry| entry.path()))
                    .expect("private temporary file exists");
                assert_eq!(std::fs::metadata(temp)?.permissions().mode() & 0o777, 0o600);
            }
            Ok(())
        }

        #[cfg(windows)]
        fn inspect_temp(&self, temp: &File) -> std::io::Result<()> {
            assert!(
                win::test_security_descriptor_is_creator_only(temp)
                    .map_err(|error| std::io::Error::other(error.to_string()))?,
                "temporary DACL must grant access only to its creator"
            );
            Ok(())
        }
    }

    #[cfg(unix)]
    struct DirFault {
        point: AtomicDirFaultPoint,
    }

    #[cfg(unix)]
    struct SourceSwap {
        source: PathBuf,
    }
    #[cfg(unix)]
    impl AtomicDirInjector for SourceSwap {
        fn inject(&self, point: AtomicDirFaultPoint) -> std::io::Result<()> {
            if point == AtomicDirFaultPoint::PreCommit {
                std::fs::remove_dir_all(&self.source)?;
                #[cfg(unix)]
                {
                    std::os::unix::fs::symlink("elsewhere", &self.source)?;
                }
            }
            Ok(())
        }
    }
    #[cfg(unix)]
    struct DirTargetMutation {
        target: PathBuf,
        existing: bool,
    }
    #[cfg(unix)]
    impl AtomicDirInjector for DirTargetMutation {
        fn inject(&self, point: AtomicDirFaultPoint) -> std::io::Result<()> {
            if point == AtomicDirFaultPoint::PreCommit {
                if self.existing {
                    std::fs::remove_dir_all(&self.target)?;
                    #[cfg(unix)]
                    {
                        return std::os::unix::fs::symlink("replacement", &self.target);
                    }
                }
                std::fs::create_dir(&self.target)?;
            }
            Ok(())
        }
    }
    #[cfg(unix)]
    impl AtomicDirInjector for DirFault {
        fn inject(&self, point: AtomicDirFaultPoint) -> std::io::Result<()> {
            if point == self.point {
                return Err(std::io::Error::other("injected"));
            }
            Ok(())
        }
    }

    #[cfg(unix)]
    fn directory_fixture() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let root = tempfile::tempdir().expect("tempdir");
        let source = root.path().join("source");
        let target = root.path().join("target");
        std::fs::create_dir(&source).expect("source");
        std::fs::write(source.join("new"), b"new").expect("new");
        std::fs::create_dir(&target).expect("target");
        std::fs::write(target.join("old"), b"old").expect("old");
        (root, source, target)
    }

    #[cfg(unix)]
    #[test]
    fn directory_install_refuses_a_source_removed_after_the_walk() {
        let (_root, source, target) = directory_fixture();
        let injector = Arc::new(PostWalkMutation::new(
            source.clone(),
            PostWalkAction::Remove,
        ));

        let result = {
            let _guard = unix::scoped_test_removal_injector(injector);
            atomic_install_dir(&source, &target)
        };

        let error = result.expect_err("source removal must be refused");
        assert_directory_removed_during_enumeration(&error);
        assert_eq!(std::fs::read(target.join("old")).unwrap(), b"old");
    }

    #[cfg(unix)]
    #[test]
    fn directory_install_refuses_a_same_name_source_replacement_after_the_walk() {
        let (_root, source, target) = directory_fixture();
        let injector = Arc::new(PostWalkMutation::new(
            source.clone(),
            PostWalkAction::ReplaceWithSentinel,
        ));

        let result = {
            let _guard = unix::scoped_test_removal_injector(injector);
            atomic_install_dir(&source, &target)
        };

        let error = result.expect_err("same-name source replacement must be refused");
        assert_directory_removed_during_enumeration(&error);
        assert_eq!(std::fs::read(target.join("old")).unwrap(), b"old");
        assert!(!target.join("sentinel").exists());
        assert_eq!(std::fs::read(source.join("sentinel")).unwrap(), b"sentinel");
    }

    #[cfg(unix)]
    #[test]
    fn directory_install_refuses_more_than_the_maximum_depth() {
        let (_root, source, target) = directory_fixture();
        let mut current = source.clone();
        for level in 0..MAX_REMOVE_TREE_DEPTH {
            current = current.join(format!("level-{level}"));
            std::fs::create_dir(&current).expect("nested directory");
        }
        std::fs::write(current.join("boundary"), b"boundary").expect("boundary");

        let error = atomic_install_dir(&source, &target).expect_err("depth must be bounded");
        assert!(matches!(error, Error::ResourceLimit(_)));
        assert_eq!(
            std::fs::read(target.join("old")).expect("old target"),
            b"old"
        );
        assert!(current.join("boundary").is_file());
    }

    #[cfg(unix)]
    #[test]
    fn directory_install_refuses_a_regular_file_beyond_the_maximum_depth() {
        let (_root, source, target) = directory_fixture();
        std::fs::remove_file(source.join("new")).expect("fixture file");
        let mut current = source.clone();
        for level in 0..(MAX_REMOVE_TREE_DEPTH - 1) {
            current = current.join(format!("level-{level}"));
            std::fs::create_dir(&current).expect("nested directory");
        }
        std::fs::write(current.join("boundary"), b"boundary").expect("boundary");

        let error = atomic_install_dir(&source, &target).expect_err("file depth must be bounded");
        assert!(matches!(error, Error::ResourceLimit(_)));
        assert_eq!(
            std::fs::read(target.join("old")).expect("old target"),
            b"old"
        );

        let (_root, source, target) = directory_fixture();
        std::fs::remove_file(source.join("new")).expect("fixture file");
        let mut current = source.clone();
        for level in 0..(MAX_REMOVE_TREE_DEPTH - 2) {
            current = current.join(format!("level-{level}"));
            std::fs::create_dir(&current).expect("nested directory");
        }
        std::fs::write(current.join("boundary"), b"boundary").expect("boundary");
        let boundary = current
            .strip_prefix(&source)
            .expect("boundary below source")
            .join("boundary");

        atomic_install_dir(&source, &target).expect("shallower file depth must install");
        assert_eq!(
            std::fs::read(target.join(boundary)).expect("installed boundary"),
            b"boundary"
        );
    }

    #[cfg(unix)]
    #[test]
    fn directory_install_rejects_links_and_special_files_without_following() {
        use std::os::unix::{fs::symlink, net::UnixListener};

        let (root, source, target) = directory_fixture();
        let outside = root.path().join("outside");
        std::fs::create_dir(&outside).expect("outside");
        std::fs::write(outside.join("sentinel"), b"untouched").expect("sentinel");
        symlink(&outside, source.join("outside-link")).expect("link");
        let error = atomic_install_dir(&source, &target).expect_err("link must be rejected");
        assert!(matches!(
            error,
            Error::InvalidInput(message) if message == "directory install rejects links and special files"
        ));
        assert_eq!(
            std::fs::read(target.join("old")).expect("old target"),
            b"old"
        );
        assert_eq!(
            std::fs::read(outside.join("sentinel")).expect("sentinel"),
            b"untouched"
        );

        let (_root, source, target) = directory_fixture();
        let _socket = UnixListener::bind(source.join("socket")).expect("socket");
        let error = atomic_install_dir(&source, &target).expect_err("socket must be rejected");
        assert!(matches!(
            error,
            Error::InvalidInput(message) if message == "directory install rejects links and special files"
        ));
        assert_eq!(
            std::fs::read(target.join("old")).expect("old target"),
            b"old"
        );
    }

    fn run_atomic_file_fault<F>(
        target: &Path,
        injector: Arc<dyn AtomicWriterInjector + Send + Sync>,
        write_fn: F,
    ) -> Result<AtomicFileOutcome, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
    {
        set_test_atomic_file_injector(Some(injector));
        let result = atomic_replace(target, write_fn);
        set_test_atomic_file_injector(None);
        result
    }

    #[cfg(unix)]
    fn run_atomic_dir_fault(
        source: &Path,
        target: &Path,
        injector: Box<dyn AtomicDirInjector>,
    ) -> Result<(), Error> {
        set_test_atomic_dir_injector(Some(injector));
        let result = atomic_install_dir(source, target);
        set_test_atomic_dir_injector(None);
        result
    }

    #[test]
    fn fresh_target_is_private_then_durable() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("new");
        let outcome = run_atomic_file_fault(
            &target,
            Arc::new(PrivateTemp {
                parent: dir.path().to_path_buf(),
            }),
            |f| f.write_all(b"new").map_err(io),
        )
        .expect("replace");
        assert!(matches!(outcome, AtomicFileOutcome::DurableCommit));
        assert_eq!(std::fs::read(&target).expect("read"), b"new");
    }
    #[test]
    fn retained_parent_descriptor_installs_without_reopening_a_target_path() {
        let dir = tempfile::tempdir().expect("tempdir");
        #[cfg(unix)]
        let parent = std::fs::File::open(dir.path()).expect("open parent");
        #[cfg(windows)]
        let parent = windows_test_parent(dir.path());
        let moved = dir.path().with_extension("moved");
        std::fs::rename(dir.path(), &moved).expect("rename parent");
        atomic_replace_at(&parent, std::ffi::OsStr::new("artifact.pgn"), |file| {
            file.write_all(b"exact").map_err(io)
        })
        .expect("fd-relative replace")
        .expect_durable();
        assert_eq!(
            std::fs::read(moved.join("artifact.pgn")).expect("read"),
            b"exact"
        );
        assert!(
            atomic_replace_at(&parent, std::ffi::OsStr::new("nested/name"), |_| Ok(())).is_err()
        );
    }

    fn assert_atomic_entry_point_refuses_an_empty_or_multicomponent_leaf<T>(
        entry_point: impl Fn(&File, &OsStr) -> Result<T, Error>,
    ) {
        let temp = tempfile::tempdir().expect("tempdir");
        let parent_path = temp.path().join("parent");
        std::fs::write(&parent_path, b"parent").expect("write parent");
        let parent = File::open(parent_path).expect("open parent");
        for leaf in [OsStr::new(""), OsStr::new("nested/file")] {
            assert!(matches!(
                entry_point(&parent, leaf),
                Err(Error::InvalidInput(_))
            ));
        }
    }

    #[test]
    fn atomic_replace_at_refuses_an_empty_or_multicomponent_leaf() {
        assert_atomic_entry_point_refuses_an_empty_or_multicomponent_leaf(|parent, leaf| {
            atomic_replace_at(parent, leaf, |_| Ok(()))
        });
    }

    #[test]
    fn atomic_replace_at_with_precommit_refuses_an_empty_or_multicomponent_leaf() {
        assert_atomic_entry_point_refuses_an_empty_or_multicomponent_leaf(|parent, leaf| {
            atomic_replace_at_with_precommit(parent, leaf, || Ok(()), |_| Ok(()))
        });
    }

    #[test]
    fn atomic_replace_at_identified_refuses_an_empty_or_multicomponent_leaf() {
        assert_atomic_entry_point_refuses_an_empty_or_multicomponent_leaf(|parent, leaf| {
            atomic_replace_at_identified(parent, leaf, |_| Ok(()))
        });
    }

    #[test]
    fn atomic_replace_at_identified_with_precommit_refuses_an_empty_or_multicomponent_leaf() {
        assert_atomic_entry_point_refuses_an_empty_or_multicomponent_leaf(|parent, leaf| {
            atomic_replace_at_identified_with_precommit(parent, leaf, || Ok(()), |_| Ok(()))
        });
    }
    #[cfg(unix)]
    fn assert_logical_parent_unchanged(parent: &File, logical: &Path) -> Result<(), Error> {
        use std::os::unix::fs::MetadataExt;
        let expected = parent.metadata()?;
        let current = std::fs::symlink_metadata(logical)?;
        if current.file_type().is_symlink()
            || current.dev() != expected.dev()
            || current.ino() != expected.ino()
        {
            return Err(Error::Conflict(
                "logical parent changed after resolution".into(),
            ));
        }
        Ok(())
    }
    #[cfg(unix)]
    #[test]
    fn fd_replace_rejects_real_logical_parent_swap_without_touching_either_target() {
        let root = tempfile::tempdir().unwrap();
        let logical = root.path().join("logical");
        let old = root.path().join("old");
        std::fs::create_dir(&logical).unwrap();
        std::fs::write(logical.join("artifact"), b"old").unwrap();
        let parent = std::fs::File::open(&logical).unwrap();
        std::fs::rename(&logical, &old).unwrap();
        std::fs::create_dir(&logical).unwrap();
        std::fs::write(logical.join("artifact"), b"outside").unwrap();
        let result = atomic_replace_at_with_precommit(
            &parent,
            std::ffi::OsStr::new("artifact"),
            || assert_logical_parent_unchanged(&parent, &logical),
            |file| file.write_all(b"new").map_err(io),
        );
        assert!(matches!(result, Err(Error::Conflict(_))));
        assert_eq!(std::fs::read(old.join("artifact")).unwrap(), b"old");
        assert_eq!(std::fs::read(logical.join("artifact")).unwrap(), b"outside");
    }
    #[cfg(unix)]
    #[test]
    fn fd_replace_rejects_symlink_logical_parent_swap_without_touching_either_target() {
        let root = tempfile::tempdir().unwrap();
        let logical = root.path().join("logical");
        let replacement = root.path().join("replacement");
        let old = root.path().join("old");
        std::fs::create_dir(&logical).unwrap();
        std::fs::create_dir(&replacement).unwrap();
        std::fs::write(logical.join("artifact"), b"old").unwrap();
        std::fs::write(replacement.join("artifact"), b"outside").unwrap();
        let parent = std::fs::File::open(&logical).unwrap();
        std::fs::rename(&logical, &old).unwrap();
        std::os::unix::fs::symlink(&replacement, &logical).unwrap();
        let result = atomic_replace_at_with_precommit(
            &parent,
            std::ffi::OsStr::new("artifact"),
            || assert_logical_parent_unchanged(&parent, &logical),
            |file| file.write_all(b"new").map_err(io),
        );
        assert!(matches!(result, Err(Error::Conflict(_))));
        assert_eq!(std::fs::read(old.join("artifact")).unwrap(), b"old");
        assert_eq!(
            std::fs::read(replacement.join("artifact")).unwrap(),
            b"outside"
        );
    }
    #[test]
    fn replacement_preserves_existing_target_and_mode() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("old");
        std::fs::write(&target, b"old").expect("write");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o640))
                .expect("mode");
        }
        atomic_replace(&target, |file| file.write_all(b"new").map_err(io))
            .expect("replace")
            .expect_durable();
        assert_eq!(std::fs::read(&target).expect("read"), b"new");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&target)
                    .expect("metadata")
                    .permissions()
                    .mode()
                    & 0o777,
                0o640
            );
        }
    }

    #[test]
    fn caller_precommit_runs_after_revalidation_before_rename_and_preserves_target_on_conflict() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        std::fs::write(&target, b"old").expect("old");
        let complete = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let observed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let injector = PrecommitOrder {
            complete: complete.clone(),
            observed_at_rename: observed.clone(),
        };
        set_test_atomic_file_injector(Some(Arc::new(injector)));
        atomic_replace_with_precommit(
            &target,
            || {
                complete.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
            |file| file.write_all(b"new").map_err(io),
        )
        .expect("replace")
        .expect_durable();
        set_test_atomic_file_injector(None);
        assert!(observed.load(std::sync::atomic::Ordering::SeqCst));
        assert_eq!(std::fs::read(&target).expect("target"), b"new");
        let rejected = dir.path().join("rejected");
        std::fs::write(&rejected, b"old").expect("old");
        assert!(matches!(
            atomic_replace_with_precommit(
                &rejected,
                || Err(Error::Conflict("caller validation failed".into())),
                |file| file.write_all(b"new").map_err(io)
            ),
            Err(Error::Conflict(_))
        ));
        assert_eq!(std::fs::read(&rejected).expect("target"), b"old");
        assert_eq!(std::fs::read_dir(dir.path()).expect("entries").count(), 2);
    }
    #[test]
    fn file_fault_matrix_preserves_old_or_absent_target() {
        for point in [
            AtomicFileFaultPoint::ParentOpen,
            AtomicFileFaultPoint::TempfileCreate,
            AtomicFileFaultPoint::Write,
            AtomicFileFaultPoint::Flush,
            AtomicFileFaultPoint::FileSync,
            AtomicFileFaultPoint::PermissionCopy,
            AtomicFileFaultPoint::PreCommitRevalidate,
            AtomicFileFaultPoint::Rename,
        ] {
            let dir = tempfile::tempdir().expect("tempdir");
            let target = dir.path().join("new");
            let fault = Fault(Some(point), None, Arc::new(Mutex::new(Vec::new())));
            assert!(run_atomic_file_fault(&target, Arc::new(fault), |f| f
                .write_all(b"new")
                .map_err(io))
            .is_err());
            assert!(!target.exists());
        }
    }

    #[test]
    fn file_post_commit_and_cleanup_precedence_are_explicit() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("new");
        let sync_fault = Fault(
            Some(AtomicFileFaultPoint::ParentSync),
            None,
            Arc::new(Mutex::new(Vec::new())),
        );
        assert!(matches!(
            run_atomic_file_fault(&target, Arc::new(sync_fault), |f| f
                .write_all(b"new")
                .map_err(io)),
            Ok(AtomicFileOutcome::CommittedDurabilityUncertain(_))
        ));
        assert_eq!(std::fs::read(&target).expect("read"), b"new");
        let second = dir.path().join("second");
        let cleanup_points = Arc::new(Mutex::new(Vec::new()));
        let cleanup_fault = Fault(
            Some(AtomicFileFaultPoint::Write),
            Some(AtomicFileFaultPoint::Cleanup),
            cleanup_points.clone(),
        );
        assert!(run_atomic_file_fault(&second, Arc::new(cleanup_fault), |_| Ok(())).is_err());
        assert!(cleanup_points
            .lock()
            .expect("lock")
            .contains(&AtomicFileFaultPoint::Cleanup));
        assert!(!second.exists());
        let third = dir.path().join("third");
        let real_cleanup_fault = BreakCleanup {
            parent: dir.path().to_path_buf(),
        };
        match run_atomic_file_fault(&third, Arc::new(real_cleanup_fault), |_| Ok(())) {
            Err(error @ Error::OperationAndCleanup { .. }) => {
                let Error::OperationAndCleanup { primary, cleanup } = &error else {
                    unreachable!();
                };
                assert_eq!(primary, "I/O failure");
                assert!(!cleanup.is_empty());
                let serialized = serde_json::to_string(&error).expect("serialize cleanup error");
                let payload: serde_json::Value =
                    serde_json::from_str(&serialized).expect("serialized error is a JSON object");
                assert_eq!(payload["category"], "operation-and-cleanup");
                assert_eq!(
                    payload["message"],
                    "Operation failed; temporary cleanup also failed"
                );
            }
            other => panic!("expected structured cleanup error, got {other:?}"),
        }
    }

    #[test]
    fn file_revalidation_races_are_conflicts_and_actual_rename_failure_is_preserved() {
        for (existing, action) in [(false, "create"), (true, "replace")] {
            let root = tempfile::tempdir().expect("tempdir");
            let parent = root.path().join("parent");
            std::fs::create_dir(&parent).expect("parent");
            let target = parent.join("target");
            if existing {
                std::fs::write(&target, b"old").expect("old");
            }
            let injector = Mutation {
                point: AtomicFileFaultPoint::PreCommitRevalidate,
                target: target.clone(),
                parent: parent.clone(),
                action,
            };
            assert!(matches!(
                run_atomic_file_fault(&target, Arc::new(injector), |f| f
                    .write_all(b"new")
                    .map_err(io)),
                Err(Error::Conflict(_))
            ));
            if action == "create" {
                assert_eq!(std::fs::read(&target).expect("read"), b"racer");
            }
            #[cfg(unix)]
            if action == "replace" {
                assert!(std::fs::symlink_metadata(&target)
                    .expect("metadata")
                    .file_type()
                    .is_symlink());
            }
        }
        let root = tempfile::tempdir().expect("tempdir");
        let parent = root.path().join("parent");
        std::fs::create_dir(&parent).expect("parent");
        let target = parent.join("target");
        let injector = Mutation {
            point: AtomicFileFaultPoint::PreCommitRevalidate,
            target: target.clone(),
            parent: parent.clone(),
            action: "parent",
        };
        assert!(matches!(
            run_atomic_file_fault(&target, Arc::new(injector), |f| f
                .write_all(b"new")
                .map_err(io)),
            Err(Error::Conflict(_))
        ));
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        let injector = Mutation {
            point: AtomicFileFaultPoint::Rename,
            target: target.clone(),
            parent: dir.path().to_path_buf(),
            action: "create",
        };
        assert!(run_atomic_file_fault(&target, Arc::new(injector), |f| f
            .write_all(b"new")
            .map_err(io))
        .is_err());
        assert_eq!(std::fs::read(target).expect("read"), b"racer");
    }

    #[test]
    fn nofollow_rejects_ancestor_and_final_parent_symlinks_and_temp_collision_retries() {
        #[cfg(unix)]
        {
            let root = tempfile::tempdir().expect("root");
            let real = root.path().join("real");
            std::fs::create_dir(&real).expect("real");
            let ancestor = root.path().join("ancestor");
            std::os::unix::fs::symlink(&real, &ancestor).expect("symlink");
            assert!(atomic_replace(&ancestor.join("target"), |_| Ok(())).is_err());
            let final_parent = root.path().join("final");
            std::os::unix::fs::symlink(&real, &final_parent).expect("symlink");
            assert!(atomic_replace(&final_parent.join("target"), |_| Ok(())).is_err());
            let _temp_names =
                unix::scoped_test_temp_names(vec!["available".into(), "collision".into()]);
            std::fs::write(root.path().join("collision"), b"collision").expect("collision");
            atomic_replace(&root.path().join("target"), |f| {
                f.write_all(b"new").map_err(io)
            })
            .expect("retry")
            .expect_durable();
            assert_eq!(
                std::fs::read(root.path().join("target")).expect("target"),
                b"new"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn temporary_name_overrides_are_thread_owned_and_scoped() {
        use std::sync::mpsc;
        use std::time::Duration;

        let (first_ready_tx, first_ready_rx) = mpsc::channel();
        let (second_ready_tx, second_ready_rx) = mpsc::channel();
        let (run_first_tx, run_first_rx) = mpsc::channel();
        let (first_done_tx, first_done_rx) = mpsc::channel();

        let first = std::thread::spawn(move || {
            let root = tempfile::tempdir().expect("first tempdir");
            std::fs::write(root.path().join(".atomic-first-collision"), b"collision")
                .expect("first collision");
            let observed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
            {
                let _names = unix::scoped_test_temp_names(vec![
                    ".atomic-first-unused".into(),
                    ".atomic-first-available".into(),
                    ".atomic-first-collision".into(),
                ]);
                first_ready_tx.send(()).expect("first ready");
                run_first_rx
                    .recv_timeout(Duration::from_secs(5))
                    .expect("run first");
                let observed_in_write = observed.clone();
                atomic_replace(&root.path().join("target"), |_| {
                    observed_in_write.store(
                        root.path().join(".atomic-first-available").exists(),
                        std::sync::atomic::Ordering::SeqCst,
                    );
                    Ok(())
                })
                .expect("first replacement")
                .expect_durable();
            }
            first_done_tx.send(()).expect("first done");
            atomic_replace(&root.path().join("after-scope"), |_| {
                assert!(!root.path().join(".atomic-first-unused").exists());
                Ok(())
            })
            .expect("first replacement after scope")
            .expect_durable();
            let unwind = std::panic::catch_unwind(|| {
                let _names =
                    unix::scoped_test_temp_names(vec![".atomic-first-panic-unused".into()]);
                panic!("exercise temporary-name guard cleanup");
            });
            assert!(unwind.is_err());
            atomic_replace(&root.path().join("after-unwind"), |_| {
                assert!(!root.path().join(".atomic-first-panic-unused").exists());
                Ok(())
            })
            .expect("first replacement after unwind")
            .expect_durable();
            observed.load(std::sync::atomic::Ordering::SeqCst)
        });

        first_ready_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("first installed names");
        let second = std::thread::spawn(move || {
            let root = tempfile::tempdir().expect("second tempdir");
            std::fs::write(root.path().join(".atomic-second-collision"), b"collision")
                .expect("second collision");
            let observed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
            let _names = unix::scoped_test_temp_names(vec![
                ".atomic-second-available".into(),
                ".atomic-second-collision".into(),
            ]);
            second_ready_tx.send(()).expect("second ready");
            first_done_rx
                .recv_timeout(Duration::from_secs(5))
                .expect("first finished replacement");
            let observed_in_write = observed.clone();
            atomic_replace(&root.path().join("target"), |_| {
                observed_in_write.store(
                    root.path().join(".atomic-second-available").exists(),
                    std::sync::atomic::Ordering::SeqCst,
                );
                Ok(())
            })
            .expect("second replacement")
            .expect_durable();
            observed.load(std::sync::atomic::Ordering::SeqCst)
        });

        second_ready_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("second installed names");
        run_first_tx.send(()).expect("run first replacement");
        let first_observed_own_name = first.join().expect("first thread");
        let second_observed_own_name = second.join().expect("second thread");
        assert!(first_observed_own_name);
        assert!(second_observed_own_name);
    }

    #[cfg(unix)]
    #[test]
    fn directory_fault_matrix_preserves_or_recovers_old_target() {
        for point in [
            AtomicDirFaultPoint::SyncEntry,
            AtomicDirFaultPoint::PreCommit,
            AtomicDirFaultPoint::BackupRename,
            AtomicDirFaultPoint::InstallRename,
        ] {
            let (_root, source, target) = directory_fixture();
            let injector = DirFault { point };
            assert!(run_atomic_dir_fault(&source, &target, Box::new(injector)).is_err());
            assert_eq!(std::fs::read(target.join("old")).expect("old"), b"old");
        }
        let (_root, source, target) = directory_fixture();
        let injector = DirFault {
            point: AtomicDirFaultPoint::ParentSync,
        };
        assert!(matches!(
            run_atomic_dir_fault(&source, &target, Box::new(injector)),
            Err(Error::CommittedDurabilityUncertain(_))
        ));
        assert_eq!(std::fs::read(target.join("new")).expect("new"), b"new");

        let root = tempfile::tempdir().expect("root");
        let source = root.path().join("source");
        let target = root.path().join("target");
        std::fs::create_dir(&source).expect("source");
        std::fs::write(source.join("new"), b"new").expect("new");
        assert!(matches!(
            run_atomic_dir_fault(
                &source,
                &target,
                Box::new(DirTargetMutation {
                    target: target.clone(),
                    existing: false
                })
            ),
            Err(Error::Conflict(_))
        ));
        assert!(target.is_dir());
        let (_root, source, target) = directory_fixture();
        assert!(matches!(
            run_atomic_dir_fault(
                &source,
                &target,
                Box::new(DirTargetMutation {
                    target: target.clone(),
                    existing: true
                })
            ),
            Err(Error::Conflict(_))
        ));

        let (_root, source, target) = directory_fixture();
        assert!(run_atomic_dir_fault(
            &source,
            &target,
            Box::new(SourceSwap {
                source: source.clone()
            })
        )
        .is_err());
        #[cfg(unix)]
        assert!(std::fs::symlink_metadata(source)
            .expect("source")
            .file_type()
            .is_symlink());
        let (_root, source, target) = directory_fixture();
        let injector = DirFault {
            point: AtomicDirFaultPoint::BackupCleanup,
        };
        assert!(matches!(
            run_atomic_dir_fault(&source, &target, Box::new(injector)),
            Err(Error::CommittedDurabilityUncertain(_))
        ));
        assert_eq!(std::fs::read(target.join("new")).expect("new"), b"new");
    }

    #[cfg(windows)]
    fn run_atomic_at_fault<F>(
        parent: &File,
        leaf: &OsStr,
        injector: Arc<dyn AtomicWriterInjector + Send + Sync>,
        write_fn: F,
    ) -> Result<AtomicInstalledFile, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
    {
        set_test_atomic_file_injector(Some(injector));
        let result = atomic_replace_at_identified(parent, leaf, write_fn);
        set_test_atomic_file_injector(None);
        result
    }

    #[cfg(windows)]
    fn assert_no_windows_temporary_files(path: &Path) {
        assert!(
            std::fs::read_dir(path)
                .expect("temporary directory")
                .filter_map(Result::ok)
                .all(|entry| !entry.file_name().to_string_lossy().starts_with(".atomic-")),
            "temporary file survived cleanup"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_replace_at_installs_durably() {
        let dir = tempfile::tempdir().expect("tempdir");
        let parent = windows_test_parent(dir.path());
        atomic_replace_at(&parent, OsStr::new("target"), |file| {
            file.write_all(b"new").map_err(io)
        })
        .expect("replace")
        .expect_durable();
        assert_eq!(
            std::fs::read(dir.path().join("target")).expect("target"),
            b"new"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_replace_at_records_real_durability_sequence() {
        let dir = tempfile::tempdir().expect("tempdir");
        let parent = windows_test_parent(dir.path());
        clear_durability_log();
        atomic_replace_at(&parent, OsStr::new("target"), |file| {
            file.write_all(b"new").map_err(io)
        })
        .expect("replace")
        .expect_durable();
        let log = durability_log();
        assert!(
            log.iter().position(|entry| *entry == "temp.flush")
                < log
                    .iter()
                    .position(|entry| *entry == "temp.sync_all:content")
        );
        assert!(
            log.iter().position(|entry| *entry == "temp.metadata")
                < log.iter().position(|entry| *entry == "dir.sync_all")
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_precommit_logs_after_revalidation() {
        let dir = tempfile::tempdir().expect("tempdir");
        let parent = windows_test_parent(dir.path());
        clear_durability_log();
        let observed = Arc::new(Mutex::new(Vec::new()));
        let observed_by_precommit = Arc::clone(&observed);
        atomic_replace_at_with_precommit(
            &parent,
            OsStr::new("target"),
            move || {
                observed_by_precommit
                    .lock()
                    .expect("log")
                    .extend(durability_log());
                Ok(())
            },
            |file| file.write_all(b"new").map_err(io),
        )
        .expect("replace")
        .expect_durable();
        assert_eq!(
            observed.lock().expect("log").last().copied(),
            Some("target_stat:revalidation")
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_post_rename_identity_query_is_performed() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        let installed = dir.path().join("installed");
        let parent = windows_test_parent(dir.path());
        clear_durability_log();
        let result = run_atomic_at_fault(
            &parent,
            OsStr::new("target"),
            Arc::new(PostRenameSwap {
                target: target.clone(),
                installed: installed.clone(),
            }),
            |file| file.write_all(b"new").map_err(io),
        )
        .expect("replace");
        result.outcome.expect_durable();
        assert!(durability_log().contains(&"temp.metadata"));
        assert_eq!(
            result.identity,
            crate::infra::path_authority::opened_file_identity(
                &File::open(&installed).expect("installed")
            )
            .expect("identity")
        );
        assert_eq!(std::fs::read(installed).expect("installed"), b"new");
        assert_eq!(std::fs::read(target).expect("racer"), b"racer");
    }

    #[cfg(windows)]
    #[test]
    fn windows_post_rename_metadata_failure_reports_uncertain_with_target_values() {
        let dir = tempfile::tempdir().expect("tempdir");
        let parent = windows_test_parent(dir.path());
        let result = run_atomic_at_fault(
            &parent,
            OsStr::new("target"),
            Arc::new(Fault(
                Some(AtomicFileFaultPoint::PostRenameMetadata),
                None,
                Arc::new(Mutex::new(Vec::new())),
            )),
            |file| file.write_all(b"new").map_err(io),
        )
        .expect("committed replacement retains its marker");
        assert!(matches!(
            result.outcome,
            AtomicFileOutcome::CommittedDurabilityUncertain(_)
        ));
        let target = File::open(dir.path().join("target")).expect("target");
        assert_eq!(
            result.identity,
            crate::infra::path_authority::opened_file_identity(&target).expect("identity")
        );
        assert_eq!(
            std::fs::read(dir.path().join("target")).expect("read"),
            b"new"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_dacl_is_preserved_across_replacement() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target_path = dir.path().join("target");
        std::fs::write(&target_path, b"old").expect("old");
        win::set_test_target_security_descriptor(&target_path, win::TARGET_ACCESS)
            .expect("distinct target DACL");
        let parent = windows_test_parent(dir.path());
        let parent_dacl = win::test_security_descriptor(&parent).expect("parent DACL");
        let before = win::test_security_descriptor(&File::open(&target_path).expect("target"))
            .expect("target DACL");
        assert_ne!(before, parent_dacl);
        atomic_replace_at(&parent, OsStr::new("target"), |file| {
            file.write_all(b"new").map_err(io)
        })
        .expect("replace")
        .expect_durable();
        let after = win::test_security_descriptor(&File::open(&target_path).expect("target"))
            .expect("installed DACL");
        assert_eq!(before, after);
    }

    #[cfg(windows)]
    #[test]
    fn windows_dacl_capture_failure_fails_closed() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        std::fs::write(&target, b"old").expect("old");
        let result = run_atomic_file_fault(
            &target,
            Arc::new(Fault(
                Some(AtomicFileFaultPoint::DaclCapture),
                None,
                Arc::new(Mutex::new(Vec::new())),
            )),
            |file| file.write_all(b"new").map_err(io),
        );
        assert!(result.is_err());
        assert_eq!(std::fs::read(&target).expect("target"), b"old");
        assert_no_windows_temporary_files(dir.path());
    }

    #[cfg(windows)]
    #[test]
    fn windows_dacl_apply_failure_fails_closed() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        std::fs::write(&target, b"old").expect("old");
        let result = run_atomic_file_fault(
            &target,
            Arc::new(Fault(
                Some(AtomicFileFaultPoint::DaclApply),
                None,
                Arc::new(Mutex::new(Vec::new())),
            )),
            |file| file.write_all(b"new").map_err(io),
        );
        assert!(result.is_err());
        assert_eq!(std::fs::read(&target).expect("target"), b"old");
        assert_no_windows_temporary_files(dir.path());
    }

    #[cfg(windows)]
    #[test]
    fn windows_target_stat_failure_cleans_up() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        std::fs::write(&target, b"old").expect("old");
        let result = run_atomic_file_fault(
            &target,
            Arc::new(Fault(
                Some(AtomicFileFaultPoint::TargetStat),
                None,
                Arc::new(Mutex::new(Vec::new())),
            )),
            |file| file.write_all(b"new").map_err(io),
        );
        assert!(result.is_err());
        assert_eq!(std::fs::read(&target).expect("target"), b"old");
        assert_no_windows_temporary_files(dir.path());
    }

    #[cfg(windows)]
    #[test]
    fn windows_temp_metadata_failure_cleans_up() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        std::fs::write(&target, b"old").expect("old");
        let result = run_atomic_file_fault(
            &target,
            Arc::new(Fault(
                Some(AtomicFileFaultPoint::TempMetadata),
                None,
                Arc::new(Mutex::new(Vec::new())),
            )),
            |file| file.write_all(b"new").map_err(io),
        );
        assert!(result.is_err());
        assert_eq!(std::fs::read(&target).expect("target"), b"old");
        assert_no_windows_temporary_files(dir.path());
    }

    #[cfg(windows)]
    #[test]
    fn windows_rename_collision_is_conflict_not_io() {
        let root = tempfile::tempdir().expect("root");
        let parent = root.path().join("parent");
        std::fs::create_dir(&parent).expect("parent");
        let target = parent.join("target");
        let injector = Mutation {
            point: AtomicFileFaultPoint::Rename,
            target: target.clone(),
            parent: parent.clone(),
            action: "create",
        };
        let result = run_atomic_file_fault(&target, Arc::new(injector), |file| {
            file.write_all(b"new").map_err(io)
        });
        assert!(matches!(result, Err(Error::Conflict(_))));
        assert_eq!(std::fs::read(target).expect("racer"), b"racer");
        assert_no_windows_temporary_files(&parent);
    }

    #[cfg(windows)]
    #[test]
    fn windows_sharing_violation_is_conflict_not_io() {
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::{FILE_SHARE_READ, FILE_SHARE_WRITE};
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        std::fs::write(&target, b"old").expect("old");
        let mut options = std::fs::OpenOptions::new();
        options
            .read(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE);
        let _holder = options.open(&target).expect("sharing holder");
        let parent = windows_test_parent(dir.path());
        let result = atomic_replace_at(&parent, OsStr::new("target"), |file| {
            file.write_all(b"new").map_err(io)
        });
        assert!(matches!(result, Err(Error::Conflict(_))));
        assert_eq!(std::fs::read(&target).expect("target"), b"old");
    }

    #[cfg(windows)]
    #[test]
    fn windows_temp_name_collision_drives_the_retry() {
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::write(dir.path().join("collision"), b"existing").expect("collision");
        let _names = win::scoped_test_temp_names(vec!["available".into(), "collision".into()]);
        let parent = windows_test_parent(dir.path());
        atomic_replace_at(&parent, OsStr::new("target"), |file| {
            file.write_all(b"new").map_err(io)
        })
        .expect("retry")
        .expect_durable();
        assert_eq!(
            std::fs::read(dir.path().join("target")).expect("target"),
            b"new"
        );
        assert_eq!(
            std::fs::read(dir.path().join("collision")).expect("collision"),
            b"existing"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_readonly_target_is_replaced() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        std::fs::write(&target, b"old").expect("old");
        let mut permissions = std::fs::metadata(&target).expect("metadata").permissions();
        permissions.set_readonly(true);
        std::fs::set_permissions(&target, permissions).expect("readonly");
        let parent = windows_test_parent(dir.path());
        atomic_replace_at(&parent, OsStr::new("target"), |file| {
            file.write_all(b"new").map_err(io)
        })
        .expect("replace readonly target")
        .expect_durable();
        assert_eq!(std::fs::read(&target).expect("target"), b"new");
    }

    #[cfg(windows)]
    #[test]
    fn windows_replace_succeeds_on_target_denying_generic_write() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("target");
        std::fs::write(&target, b"old").expect("old");
        win::set_test_target_security_descriptor(&target, win::TARGET_ACCESS)
            .expect("target DACL without generic write");
        let parent = windows_test_parent(dir.path());
        atomic_replace_at(&parent, OsStr::new("target"), |file| {
            file.write_all(b"new").map_err(io)
        })
        .expect("replacement only needs delete/read-control access to target")
        .expect_durable();
        assert_eq!(std::fs::read(&target).expect("target"), b"new");
    }

    #[cfg(windows)]
    #[test]
    fn windows_replace_under_a_read_only_ancestor_succeeds() {
        // Regression guard for the read-only walk: open_directory_path honours `writable` on its
        // base open but once demanded DIRECTORY_ACCESS (which carries GENERIC_WRITE) for every
        // child component, so the pre-commit revalidation — which opens the parent chain with
        // `writable = false` — failed on any path whose ancestor denies write. The source pin in
        // infra/platform_support.rs proves the two-predicate split is still written; this proves
        // the behaviour it exists for. Nothing local executes it: it first runs on a Windows
        // runner.
        let dir = tempfile::tempdir().expect("tempdir");
        let ancestor = dir.path().join("ancestor");
        std::fs::create_dir(&ancestor).expect("ancestor");
        let target = ancestor.join("target");
        std::fs::write(&target, b"old").expect("old");
        // Deny GENERIC_WRITE on the ancestor itself; traversal and revalidation need only
        // read access to it, and the replacement happens inside it via a retained descriptor.
        win::set_test_target_security_descriptor(&ancestor, win::TARGET_ACCESS)
            .expect("ancestor DACL without generic write");
        atomic_replace(&target, |file| file.write_all(b"new").map_err(io))
            .expect("a read-only ancestor must not block replacement")
            .expect_durable();
        assert_eq!(std::fs::read(&target).expect("target"), b"new");
    }

    #[cfg(not(unix))]
    #[test]
    fn non_unix_directory_install_is_explicitly_unsupported() {
        let root = tempfile::tempdir().expect("tempdir");
        assert!(matches!(
            atomic_install_dir(&root.path().join("source"), &root.path().join("target")),
            Err(Error::Conflict(_))
        ));
    }
}
