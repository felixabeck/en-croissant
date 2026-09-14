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
#[cfg(unix)]
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
    let directory_stat = rfs::fstat(dir).map_err(|error| Error::Io(Box::new(error.into())))?;
    if directory_stat.st_nlink == 0 {
        return Err(Error::Io(Box::new(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "directory was removed during enumeration",
        ))));
    }
    Ok(result)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg(unix)]
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
    #[cfg(unix)]
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

        pub(crate) fn as_file(&self) -> &File {
            &self.0
        }

        #[cfg(unix)]
        pub(crate) fn into_file(self) -> File {
            self.0
        }
    }
}

pub(crate) use verified_directory::VerifiedDir;

#[derive(Debug)]
#[must_use = "the rename may have landed without a durable parent; decide what CommittedDurabilityUncertain means at this site"]
#[cfg_attr(
    all(not(unix), not(test)),
    expect(
        dead_code,
        reason = "atomic replacement refuses off Unix until the Windows port constructs an outcome (f-20260830-06 follow-up (d))"
    )
)]
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
    #[cfg(unix)]
    PostRenameMetadata,
    ParentSync,
    Cleanup,
}

#[cfg(test)]
pub(crate) trait AtomicWriterInjector {
    fn inject(&self, _: AtomicFileFaultPoint) -> std::io::Result<()> {
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

#[cfg(any(test, unix))]
fn io(err: std::io::Error) -> Error {
    Error::Io(Box::new(err))
}
#[cfg(test)]
pub(crate) fn inject_atomic_file(point: AtomicFileFaultPoint) -> Result<(), Error> {
    current_test_atomic_file_injector()
        .map_or(Ok(()), |injector| injector.inject(point).map_err(io))
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
    pub(super) struct Installed {
        pub outcome: AtomicFileOutcome,
        pub identity: (u64, u64),
        pub ctime_nanos: i128,
    }

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

    pub(super) fn replace<F, P>(
        target: &Path,
        precommit: P,
        write_fn: F,
    ) -> Result<Installed, Error>
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
        replace_at(
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
        target_name: std::ffi::OsString,
        precommit: P,
        write_fn: F,
    ) -> Result<Installed, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
        P: FnOnce() -> Result<(), Error>,
    {
        let target_name = target_name.as_os_str();
        let original = match target_stat(&dir, target_name)? {
            Some(stat) if !regular(&stat) => {
                return Err(Error::InvalidInput(
                    "target must be a regular file, not a link or special file".into(),
                ))
            }
            Some(stat) => Some(stat),
            None => None,
        };

        #[cfg(test)]
        inject_atomic_file(AtomicFileFaultPoint::TempfileCreate)?;
        let (temp_name, fd) = (0..16)
            .find_map(|_| {
                let candidate = temp_name();
                match fs::openat(
                    &dir,
                    &candidate,
                    OFlags::CREATE
                        | OFlags::EXCL
                        | OFlags::WRONLY
                        | OFlags::NOFOLLOW
                        | OFlags::CLOEXEC,
                    Mode::from_raw_mode(0o600),
                ) {
                    Ok(fd) => Some(Ok((candidate, fd))),
                    Err(error) if error == Errno::EXIST => None,
                    Err(error) => Some(Err(io(error.into()))),
                }
            })
            .transpose()?
            .ok_or_else(|| {
                Error::Conflict(
                    "could not allocate a unique private temporary file after 16 attempts".into(),
                )
            })?;
        let mut temp = File::from(fd);
        let fail = |error| cleanup(&dir, &temp_name, error);

        #[cfg(test)]
        if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::Write) {
            return Err(fail(error));
        }
        if let Err(error) = write_fn(&mut temp) {
            return Err(fail(error));
        }
        #[cfg(test)]
        if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::Flush) {
            return Err(fail(error));
        }
        if let Err(error) = temp.flush().map_err(io) {
            return Err(fail(error));
        }
        #[cfg(test)]
        if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::FileSync) {
            return Err(fail(error));
        }
        if let Err(error) = temp.sync_all().map_err(io) {
            return Err(fail(error));
        }
        // The temporary inode stays 0600 until content and metadata are complete.
        let final_mode = original
            .as_ref()
            .map_or(0o600, |stat| stat.st_mode & 0o7777);
        #[cfg(test)]
        if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::PermissionCopy) {
            return Err(fail(error));
        }
        if let Err(error) =
            fs::fchmod(&temp, Mode::from_raw_mode(final_mode)).map_err(|e| io(e.into()))
        {
            return Err(fail(error));
        }
        if let Err(error) = temp.sync_all().map_err(io) {
            return Err(fail(error));
        }
        #[cfg(test)]
        if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::PreCommitRevalidate) {
            return Err(fail(error));
        }
        match (original.as_ref(), target_stat(&dir, target_name)?) {
            (None, None) => {}
            (None, Some(_)) => {
                return Err(fail(Error::Conflict(
                    "target was created concurrently".into(),
                )))
            }
            (Some(_), None) => {
                return Err(fail(Error::Conflict(
                    "target was deleted concurrently".into(),
                )))
            }
            (Some(expected), Some(actual)) if regular(&actual) && same_inode(expected, &actual) => {
            }
            (Some(_), Some(_)) => {
                return Err(fail(Error::Conflict("target changed concurrently".into())))
            }
        }
        if let Err(error) = precommit() {
            return Err(fail(error));
        }
        let fallback_metadata = temp.metadata().map_err(io)?;
        let commit = || {
            if original.is_none() {
                fs::renameat_with(&dir, &temp_name, &dir, target_name, RenameFlags::NOREPLACE)
            } else {
                fs::renameat(&dir, &temp_name, &dir, target_name)
            }
            .map_err(|e| io(e.into()))
        };
        #[cfg(test)]
        if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::Rename) {
            return Err(fail(error));
        }
        if let Err(error) = commit() {
            return Err(fail(error));
        }
        #[cfg(test)]
        let metadata = match inject_atomic_file(AtomicFileFaultPoint::PostRenameMetadata) {
            Ok(()) => temp.metadata(),
            Err(Error::Io(error)) => Err(*error),
            Err(_) => unreachable!("atomic file injectors only produce I/O errors"),
        };
        #[cfg(not(test))]
        let metadata = temp.metadata();
        let metadata = match metadata {
            Ok(metadata) => metadata,
            Err(error) => {
                let (installed_identity, installed_ctime_nanos) = fs::fstat(&temp)
                    .map(|stat| {
                        (
                            raw_stat_identity(&stat),
                            i128::from(stat.st_ctime) * 1_000_000_000
                                + i128::from(stat.st_ctime_nsec),
                        )
                    })
                    .unwrap_or_else(|_| {
                        (
                            (fallback_metadata.dev(), fallback_metadata.ino()),
                            i128::from(fallback_metadata.ctime()) * 1_000_000_000
                                + i128::from(fallback_metadata.ctime_nsec()),
                        )
                    });
                drop(temp);
                return Ok(Installed {
                    outcome: AtomicFileOutcome::CommittedDurabilityUncertain(error),
                    identity: installed_identity,
                    ctime_nanos: installed_ctime_nanos,
                });
            }
        };
        let installed_identity = (metadata.dev(), metadata.ino());
        let installed_ctime_nanos =
            i128::from(metadata.ctime()) * 1_000_000_000 + i128::from(metadata.ctime_nsec());
        drop(temp);
        #[cfg(test)]
        if let Err(error) = inject_atomic_file(AtomicFileFaultPoint::ParentSync) {
            let Error::Io(error) = error else {
                unreachable!("atomic file injectors only produce I/O errors")
            };
            return Ok(Installed {
                outcome: AtomicFileOutcome::CommittedDurabilityUncertain(*error),
                identity: installed_identity,
                ctime_nanos: installed_ctime_nanos,
            });
        }
        match dir.sync_all() {
            Ok(()) => Ok(Installed {
                outcome: AtomicFileOutcome::DurableCommit,
                identity: installed_identity,
                ctime_nanos: installed_ctime_nanos,
            }),
            Err(error) => Ok(Installed {
                outcome: AtomicFileOutcome::CommittedDurabilityUncertain(error),
                identity: installed_identity,
                ctime_nanos: installed_ctime_nanos,
            }),
        }
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

#[cfg(all(test, unix))]
pub(crate) use unix::{
    current_test_removal_injector, set_test_removal_injector, RemovalFault, RemovalFaultPoint,
    RemovalInjector,
};
#[cfg(unix)]
pub(crate) use unix::{raw_mode_from, raw_stat_identity, MAX_REMOVE_TREE_DEPTH};

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
    #[cfg(not(unix))]
    {
        let _ = (target, precommit, write_fn);
        Err(Error::Conflict("atomic replacement is unsupported on this platform: parent-directory durability cannot be proven".into()))
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
#[cfg(unix)]
pub(crate) fn open_verified_parent(
    path: &Path,
    expected: (u64, u64),
    directory: bool,
) -> Result<(File, std::ffi::OsString), Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType, Mode, OFlags};
    use std::os::unix::ffi::OsStrExt;
    let parent = unix::open_parent(path)?;
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

#[cfg(not(unix))]
pub(crate) fn entry_identity_at(
    _parent: &File,
    _name: &OsStr,
    _dir: bool,
) -> Result<(u64, u64), Error> {
    Err(crate::infra::platform_support::unsupported(
        "fd-relative entry identity",
    ))
}

#[cfg(unix)]
pub(crate) fn create_dir_at(parent: &File, name: &OsStr) -> Result<(), Error> {
    use rustix::fs::{self as rfs, Mode};
    rfs::mkdirat(parent, name, Mode::from_raw_mode(0o700))
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    parent.sync_all()?;
    Ok(())
}

#[cfg(not(unix))]
pub(crate) fn create_dir_at(_parent: &File, _name: &OsStr) -> Result<(), Error> {
    Err(crate::infra::platform_support::unsupported(
        "fd-relative directory creation",
    ))
}

#[cfg(unix)]
pub(crate) fn open_directory_at(parent: &File, name: &OsStr) -> Result<File, Error> {
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

#[cfg(not(unix))]
pub(crate) fn open_directory_at(_parent: &File, _name: &OsStr) -> Result<File, Error> {
    Err(crate::infra::platform_support::unsupported(
        "fd-relative directory opening",
    ))
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

#[cfg(not(unix))]
pub(crate) fn rename_entry_at(
    _source_parent: &File,
    _source: &OsStr,
    _expected: (u64, u64),
    _source_is_dir: bool,
    _target_parent: &File,
    _target: &OsStr,
) -> Result<(), Error> {
    Err(crate::infra::platform_support::unsupported(
        "fd-relative renames",
    ))
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

#[cfg(not(unix))]
pub(crate) fn remove_entry_at(
    _parent: &File,
    _name: &OsStr,
    _expected: (u64, u64),
    _is_dir: bool,
) -> Result<(), Error> {
    Err(crate::infra::platform_support::unsupported(
        "fd-relative removals",
    ))
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

#[cfg(not(unix))]
pub(crate) fn remove_optional_regular_at(_parent: &File, _name: &OsStr) -> Result<(), Error> {
    Err(crate::infra::platform_support::unsupported(
        "fd-relative optional-file removal",
    ))
}

#[cfg(unix)]
pub(crate) fn remove_regular_at(parent: &File, name: &OsStr) -> Result<(), Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType};
    let stat = rfs::statat(parent, name, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
        return Err(Error::InvalidInput(
            "workspace entry must be a regular file".into(),
        ));
    }
    rfs::unlinkat(parent, name, AtFlags::empty())
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    Ok(())
}

#[cfg(not(unix))]
pub(crate) fn remove_regular_at(_parent: &File, _name: &OsStr) -> Result<(), Error> {
    Err(crate::infra::platform_support::unsupported(
        "fd-relative regular-file removal",
    ))
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
    #[cfg(not(unix))]
    {
        let _ = (parent, leaf, precommit, write_fn);
        Err(crate::infra::platform_support::unsupported(
            "fd-relative atomic replacement",
        ))
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

    #[cfg(unix)]
    #[test]
    fn create_regular_at_is_exclusive_and_returns_the_created_identity() {
        let temp = tempfile::tempdir().expect("tempdir");
        let parent = File::open(temp.path()).expect("open parent");
        let (created, identity) =
            create_regular_at(&parent, OsStr::new("database.db3")).expect("create regular leaf");
        assert_eq!(created.metadata().expect("created metadata").len(), 0);
        assert_eq!(
            entry_identity_at(&parent, OsStr::new("database.db3"), false).unwrap(),
            identity
        );
        assert!(matches!(
            create_regular_at(&parent, OsStr::new("database.db3")),
            Err(Error::Io(_))
        ));
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

    struct PrivateTemp {
        #[cfg(unix)]
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
                #[cfg(unix)]
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
        let parent = std::fs::File::open(dir.path()).expect("open parent");
        atomic_replace_at(&parent, std::ffi::OsStr::new("artifact.pgn"), |file| {
            file.write_all(b"exact").map_err(io)
        })
        .expect("fd-relative replace")
        .expect_durable();
        assert_eq!(
            std::fs::read(dir.path().join("artifact.pgn")).expect("read"),
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
        let parent = File::open(temp.path()).expect("open parent");
        assert!(entry_point(&parent, OsStr::new("")).is_err());
        assert!(entry_point(&parent, OsStr::new("nested/file")).is_err());
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
