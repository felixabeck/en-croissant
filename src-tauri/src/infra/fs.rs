//! Crash consistency note: a successful `DurableCommit` means the replacement and its parent
//! directory entry were synced. A process or power failure before that point may leave either
//! version present. Existing file and directory replacement is optimistic: Unix has no inode-CAS
//! rename, so an uncooperative writer can still win the final revalidation-to-syscall window.
//! Staging and target parents must not be externally mutated through commit and cleanup. The
//! injected tests prove detection before that window, not compare-and-swap semantics. Commits
//! never follow a target link or leave the opened parent directory.

use crate::error::Error;
use std::{ffi::OsStr, fs::File, io::Write, path::Path};

#[derive(Debug)]
pub enum AtomicFileOutcome {
    DurableCommit,
    CommittedDurabilityUncertain(std::io::Error),
}
#[derive(Debug)]
pub struct AtomicInstalledFile {
    pub outcome: AtomicFileOutcome,
    pub identity: (u64, u64),
    pub ctime_nanos: i128,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AtomicFileFaultPoint {
    ParentOpen,
    TempfileCreate,
    Write,
    Flush,
    FileSync,
    PermissionCopy,
    PreCommitRevalidate,
    Rename,
    ParentSync,
    Cleanup,
}

pub trait AtomicWriterInjector: Send + Sync {
    fn inject(&self, _: AtomicFileFaultPoint) -> std::io::Result<()> {
        Ok(())
    }
}
pub struct DefaultInjector;
impl AtomicWriterInjector for DefaultInjector {}

fn io(err: std::io::Error) -> Error {
    Error::Io(Box::new(err))
}
fn inject<I: AtomicWriterInjector>(injector: &I, point: AtomicFileFaultPoint) -> Result<(), Error> {
    injector.inject(point).map_err(io)
}

#[cfg(unix)]
mod unix {
    use super::*;
    use rustix::{
        fs::{self, AtFlags, FileType, Mode, OFlags, RenameFlags},
        io::Errno,
    };
    use std::{
        ffi::OsStr,
        mem::MaybeUninit,
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

    /// Directory levels `remove_tree_at` will descend before refusing.
    pub(super) const MAX_REMOVE_TREE_DEPTH: usize = 64;
    /// `RawDir` buffer per open level. The worst-case stack contribution is this value times
    /// `MAX_REMOVE_TREE_DEPTH` (512 KiB), against a Tokio worker's 2 MiB stack.
    const REMOVE_TREE_DIR_BUFFER_BYTES: usize = 8192;

    #[cfg(test)]
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum RemovalFaultPoint {
        BeforeTopOpen,
        BeforeChildStat,
        BeforeChildOpen,
        AfterEntryRemoved,
        ParentSync,
    }

    #[cfg(test)]
    pub(crate) trait RemovalInjector {
        fn inject(&self, _: RemovalFaultPoint) -> std::io::Result<Option<u64>> {
            Ok(None)
        }
    }

    #[cfg(test)]
    pub(crate) struct RemovalFault(pub(crate) RemovalFaultPoint);

    #[cfg(test)]
    impl RemovalInjector for RemovalFault {
        fn inject(&self, point: RemovalFaultPoint) -> std::io::Result<Option<u64>> {
            if point == self.0 {
                return Err(std::io::Error::other("injected removal failure"));
            }
            Ok(None)
        }
    }

    #[cfg(test)]
    std::thread_local! {
        static TEST_REMOVAL_INJECTOR: std::cell::RefCell<Option<Box<dyn RemovalInjector>>> =
            const { std::cell::RefCell::new(None) };
    }

    #[cfg(test)]
    pub(crate) fn set_test_removal_injector(injector: Option<Box<dyn RemovalInjector>>) {
        TEST_REMOVAL_INJECTOR.with(|current| *current.borrow_mut() = injector);
    }

    #[cfg(test)]
    pub(super) fn inject_removal(point: RemovalFaultPoint) -> Result<Option<u64>, Error> {
        TEST_REMOVAL_INJECTOR.with(|current| {
            current
                .borrow()
                .as_ref()
                .map_or(Ok(None), |injector| injector.inject(point).map_err(io))
        })
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
        left.st_dev == right.st_dev && left.st_ino == right.st_ino
    }
    fn temp_name() -> std::ffi::OsString {
        #[cfg(test)]
        if let Some(name) = test_temp_names().lock().expect("test temp names").pop() {
            return name;
        }
        format!(".atomic-{}", uuid::Uuid::new_v4()).into()
    }
    #[cfg(test)]
    fn test_temp_names() -> &'static std::sync::Mutex<Vec<std::ffi::OsString>> {
        static NAMES: std::sync::OnceLock<std::sync::Mutex<Vec<std::ffi::OsString>>> =
            std::sync::OnceLock::new();
        NAMES.get_or_init(|| std::sync::Mutex::new(Vec::new()))
    }
    #[cfg(test)]
    pub(super) fn set_test_temp_names(names: Vec<std::ffi::OsString>) {
        *test_temp_names().lock().expect("test temp names") = names;
    }
    fn cleanup<I: AtomicWriterInjector>(
        dir: &File,
        temp: &OsStr,
        injector: &I,
        primary: Error,
    ) -> Error {
        let injected = injector.inject(AtomicFileFaultPoint::Cleanup).err();
        let unlink = fs::unlinkat(dir, temp, AtFlags::empty()).err();
        match injected.or_else(|| unlink.map(Into::into)) {
            None => primary,
            Some(cleanup) => Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: cleanup.to_string(),
            },
        }
    }

    pub(super) fn replace<F, I, P>(
        target: &Path,
        injector: &I,
        precommit: P,
        write_fn: F,
    ) -> Result<Installed, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
        I: AtomicWriterInjector,
        P: FnOnce() -> Result<(), Error>,
    {
        inject(injector, AtomicFileFaultPoint::ParentOpen)?;
        let dir = open_parent(target)?;
        let dir_identity = dir.metadata().map_err(io)?;
        let logical_parent = parent(target).to_path_buf();
        let target_name = name(target)?.to_os_string();
        replace_at(
            dir,
            target_name,
            injector,
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

    pub(super) fn replace_at<F, I, P>(
        dir: File,
        target_name: std::ffi::OsString,
        injector: &I,
        precommit: P,
        write_fn: F,
    ) -> Result<Installed, Error>
    where
        F: FnOnce(&mut File) -> Result<(), Error>,
        I: AtomicWriterInjector,
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

        inject(injector, AtomicFileFaultPoint::TempfileCreate)?;
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
        let fail = |error| cleanup(&dir, &temp_name, injector, error);

        if let Err(error) =
            inject(injector, AtomicFileFaultPoint::Write).and_then(|_| write_fn(&mut temp))
        {
            return Err(fail(error));
        }
        if let Err(error) =
            inject(injector, AtomicFileFaultPoint::Flush).and_then(|_| temp.flush().map_err(io))
        {
            return Err(fail(error));
        }
        if let Err(error) = inject(injector, AtomicFileFaultPoint::FileSync)
            .and_then(|_| temp.sync_all().map_err(io))
        {
            return Err(fail(error));
        }
        // The temporary inode stays 0600 until content and metadata are complete.
        let final_mode = original
            .as_ref()
            .map_or(0o600, |stat| stat.st_mode & 0o7777);
        if let Err(error) = inject(injector, AtomicFileFaultPoint::PermissionCopy).and_then(|_| {
            fs::fchmod(&temp, Mode::from_raw_mode(final_mode)).map_err(|e| io(e.into()))
        }) {
            return Err(fail(error));
        }
        if let Err(error) = temp.sync_all().map_err(io) {
            return Err(fail(error));
        }
        if let Err(error) = inject(injector, AtomicFileFaultPoint::PreCommitRevalidate) {
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
        let commit = || {
            if original.is_none() {
                fs::renameat_with(&dir, &temp_name, &dir, target_name, RenameFlags::NOREPLACE)
            } else {
                fs::renameat(&dir, &temp_name, &dir, target_name)
            }
            .map_err(|e| io(e.into()))
        };
        if let Err(error) = inject(injector, AtomicFileFaultPoint::Rename).and_then(|_| commit()) {
            return Err(fail(error));
        }
        let metadata = temp.metadata().map_err(io)?;
        let installed_identity = (metadata.dev(), metadata.ino());
        let installed_ctime_nanos =
            i128::from(metadata.ctime()) * 1_000_000_000 + i128::from(metadata.ctime_nsec());
        drop(temp);
        if let Err(error) = injector.inject(AtomicFileFaultPoint::ParentSync) {
            return Ok(Installed {
                outcome: AtomicFileOutcome::CommittedDurabilityUncertain(error),
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

    fn sync_tree(dir: &File) -> Result<(), Error> {
        let mut buffer = [MaybeUninit::uninit(); 8192];
        let mut entries = fs::RawDir::new(dir, &mut buffer);
        while let Some(entry) = entries.next() {
            let entry = entry.map_err(|e| io(e.into()))?;
            let bytes = entry.file_name().to_bytes();
            if bytes == b"." || bytes == b".." {
                continue;
            }
            let name = std::ffi::OsString::from_vec(bytes.to_vec());
            let stat =
                fs::statat(dir, &name, AtFlags::SYMLINK_NOFOLLOW).map_err(|e| io(e.into()))?;
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
                    sync_tree(&child)?;
                }
                _ => {
                    return Err(Error::InvalidInput(
                        "directory install rejects links and special files".into(),
                    ))
                }
            }
        }
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
                if (stat.st_dev, stat.st_ino) != expected {
                    return Err(Error::Conflict(
                        "directory cleanup entry changed concurrently".into(),
                    ));
                }
                // Linux has no descriptor-relative unlink: a final name substitution can only
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
                // returns `NOSYS`, the device check is the fallback; a same-filesystem bind mount
                // is therefore invisible below that kernel floor.
                let is_mount = if opened.st_dev != compared_parent_dev {
                    true
                } else {
                    match fs::statx(
                        &child,
                        "",
                        AtFlags::EMPTY_PATH | AtFlags::NO_AUTOMOUNT,
                        fs::StatxFlags::empty(),
                    ) {
                        Ok(statx) => {
                            statx
                                .stx_attributes_mask
                                .contains(fs::StatxAttributes::MOUNT_ROOT)
                                && statx
                                    .stx_attributes
                                    .contains(fs::StatxAttributes::MOUNT_ROOT)
                        }
                        Err(Errno::NOSYS) => false,
                        Err(error) => return Err(io(error.into())),
                    }
                };
                if is_mount {
                    return Err(Error::InvalidInput(
                        "directory cleanup refuses to cross a mount".into(),
                    ));
                }
                if (stat.st_dev, stat.st_ino) != expected {
                    return Err(Error::Conflict(
                        "directory cleanup entry changed concurrently".into(),
                    ));
                }
                let mut buffer = [MaybeUninit::uninit(); REMOVE_TREE_DIR_BUFFER_BYTES];
                let mut entries = fs::RawDir::new(&child, &mut buffer);
                while let Some(entry) = entries.next() {
                    let entry = entry.map_err(|e| io(e.into()))?;
                    let bytes = entry.file_name().to_bytes();
                    if bytes != b"." && bytes != b".." {
                        #[cfg(test)]
                        inject_removal(RemovalFaultPoint::BeforeChildStat)?;
                        remove_tree_at(
                            &child,
                            OsStr::from_bytes(bytes),
                            (opened.st_dev, entry.ino()),
                            depth + 1,
                            opened.st_dev,
                            removed_entries,
                        )?;
                    }
                }
                // The descriptor pins the traversed directory, but Linux has no `funlinkat`;
                // the terminal name lookup remains confined by `REMOVEDIR` semantics.
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

    pub(super) fn install_dir<I>(source: &Path, target: &Path, injector: &I) -> Result<(), Error>
    where
        I: AtomicDirInjector,
    {
        injector
            .inject(AtomicDirFaultPoint::SyncEntry)
            .map_err(io)?;
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
        sync_tree(&source_dir)?;
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
        injector
            .inject(AtomicDirFaultPoint::PreCommit)
            .map_err(io)?;
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
        injector
            .inject(AtomicDirFaultPoint::BackupRename)
            .map_err(io)?;
        injector
            .inject(AtomicDirFaultPoint::InstallRename)
            .map_err(io)?;
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
        if let Err(error) = injector
            .inject(AtomicDirFaultPoint::ParentSync)
            .and_then(|_| parent_dir.sync_all())
        {
            return Err(Error::CommittedDurabilityUncertain(error.to_string()));
        }
        if let Some(original) = original.as_ref() {
            if let Err(error) = injector
                .inject(AtomicDirFaultPoint::BackupCleanup)
                .and_then(|_| {
                    let mut removed_entries = 0;
                    remove_tree_at(
                        &parent_dir,
                        source_name,
                        (original.st_dev, original.st_ino),
                        0,
                        parent_meta.dev(),
                        &mut removed_entries,
                    )
                    .map_err(|e| std::io::Error::other(e.to_string()))
                })
            {
                return Err(Error::CommittedDurabilityUncertain(format!(
                    "directory installed; old tree remains at {}: {error}",
                    source.display()
                )));
            }
            parent_dir
                .sync_all()
                .map_err(|e| Error::CommittedDurabilityUncertain(e.to_string()))?;
        }
        Ok(())
    }
}

#[cfg(all(test, unix))]
pub(crate) use unix::{set_test_removal_injector, RemovalFault, RemovalFaultPoint};

pub fn atomic_replace_with_precommit<F, I, P>(
    target: &Path,
    injector: &I,
    precommit: P,
    write_fn: F,
) -> Result<AtomicFileOutcome, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
    I: AtomicWriterInjector,
    P: FnOnce() -> Result<(), Error>,
{
    #[cfg(unix)]
    {
        unix::replace(target, injector, precommit, write_fn).map(|installed| installed.outcome)
    }
    #[cfg(not(unix))]
    {
        let _ = (target, injector, precommit, write_fn);
        Err(Error::Conflict("atomic replacement is unsupported on this platform: parent-directory durability cannot be proven".into()))
    }
}
pub fn atomic_replace_with_injector<F, I>(
    target: &Path,
    injector: &I,
    write_fn: F,
) -> Result<AtomicFileOutcome, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
    I: AtomicWriterInjector,
{
    atomic_replace_with_precommit(target, injector, || Ok(()), write_fn)
}
pub fn atomic_replace<F>(target: &Path, write_fn: F) -> Result<AtomicFileOutcome, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
{
    atomic_replace_with_injector(target, &DefaultInjector, write_fn)
}

/// Replaces one leaf below an already-authority-validated directory descriptor. No mutable
/// parent pathname is reopened between capability resolution and the final `renameat`.
#[allow(dead_code)]
pub fn atomic_replace_at<F>(
    parent: &File,
    leaf: &OsStr,
    write_fn: F,
) -> Result<AtomicFileOutcome, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
{
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        if leaf.as_bytes().is_empty() || leaf.as_bytes().contains(&b'/') {
            return Err(Error::InvalidInput(
                "atomic target must be one leaf name".into(),
            ));
        }
        unix::replace_at(
            parent.try_clone()?,
            leaf.to_os_string(),
            &DefaultInjector,
            || Ok(()),
            write_fn,
        )
        .map(|installed| installed.outcome)
    }
    #[cfg(not(unix))]
    {
        let _ = (parent, leaf, write_fn);
        Err(Error::Conflict(
            "fd-relative atomic replacement is unsupported on this platform".into(),
        ))
    }
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
    use std::os::unix::{ffi::OsStrExt, fs::MetadataExt};
    let parent = unix::open_parent(path)?;
    let leaf = path
        .file_name()
        .filter(|name| !name.as_bytes().is_empty())
        .ok_or_else(|| Error::InvalidInput("workspace entry needs a leaf name".into()))?
        .to_os_string();
    let stat = rfs::statat(&parent, &leaf, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    let kind = FileType::from_raw_mode(stat.st_mode);
    if stat.st_dev != expected.0
        || stat.st_ino != expected.1
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
        let meta = opened.metadata()?;
        if (meta.dev(), meta.ino()) != expected {
            return Err(Error::Conflict(
                "workspace directory changed concurrently".into(),
            ));
        }
    }
    Ok((parent, leaf))
}

#[cfg(unix)]
pub(crate) fn open_verified_directory(path: &Path, expected: (u64, u64)) -> Result<File, Error> {
    use rustix::fs::{self as rfs, Mode, OFlags};
    let (parent, leaf) = open_verified_parent(path, expected, true)?;
    Ok(File::from(
        rfs::openat(
            &parent,
            &leaf,
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|error| Error::Io(Box::new(error.into())))?,
    ))
}

#[cfg(unix)]
fn assert_entry_identity(
    parent: &File,
    name: &OsStr,
    expected: (u64, u64),
    dir: bool,
) -> Result<(), Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType};
    let stat = rfs::statat(parent, name, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    let kind = FileType::from_raw_mode(stat.st_mode);
    if (stat.st_dev, stat.st_ino) != expected
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
    Ok((stat.st_dev, stat.st_ino))
}

#[cfg(unix)]
pub(crate) fn create_dir_at(parent: &File, name: &OsStr) -> Result<(), Error> {
    use rustix::fs::{self as rfs, Mode};
    rfs::mkdirat(parent, name, Mode::from_raw_mode(0o700))
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    parent.sync_all()?;
    Ok(())
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
            parent_stat.st_dev,
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
        return Err(Error::CommittedDurabilityUncertain(error.to_string()));
    }
    parent
        .sync_all()
        .map_err(|error| Error::CommittedDurabilityUncertain(error.to_string()))?;
    Ok(())
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
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        if leaf.as_bytes().is_empty() || leaf.as_bytes().contains(&b'/') {
            return Err(Error::InvalidInput(
                "atomic target must be one leaf name".into(),
            ));
        }
        unix::replace_at(
            parent.try_clone()?,
            leaf.to_os_string(),
            &DefaultInjector,
            precommit,
            write_fn,
        )
        .map(|installed| installed.outcome)
    }
    #[cfg(not(unix))]
    {
        let _ = (parent, leaf, precommit, write_fn);
        Err(Error::Conflict(
            "fd-relative atomic replacement is unsupported on this platform".into(),
        ))
    }
}

/// Same fd-relative commit, with the inode identity captured from the still-open temporary FD
/// after `renameat` and before any pathname lookup can occur.
#[allow(dead_code)]
pub fn atomic_replace_at_identified<F>(
    parent: &File,
    leaf: &OsStr,
    write_fn: F,
) -> Result<AtomicInstalledFile, Error>
where
    F: FnOnce(&mut File) -> Result<(), Error>,
{
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        if leaf.as_bytes().is_empty() || leaf.as_bytes().contains(&b'/') {
            return Err(Error::InvalidInput(
                "atomic target must be one leaf name".into(),
            ));
        }
        unix::replace_at(
            parent.try_clone()?,
            leaf.to_os_string(),
            &DefaultInjector,
            || Ok(()),
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
        let _ = (parent, leaf, write_fn);
        Err(Error::Conflict(
            "fd-relative atomic replacement is unsupported on this platform".into(),
        ))
    }
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
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        if leaf.as_bytes().is_empty() || leaf.as_bytes().contains(&b'/') {
            return Err(Error::InvalidInput(
                "atomic target must be one leaf name".into(),
            ));
        }
        unix::replace_at(
            parent.try_clone()?,
            leaf.to_os_string(),
            &DefaultInjector,
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
        Err(Error::Conflict(
            "fd-relative atomic replacement is unsupported on this platform".into(),
        ))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AtomicDirFaultPoint {
    SyncEntry,
    PreCommit,
    BackupRename,
    InstallRename,
    ParentSync,
    BackupCleanup,
}
pub trait AtomicDirInjector: Send + Sync {
    fn inject(&self, _: AtomicDirFaultPoint) -> std::io::Result<()> {
        Ok(())
    }
}
pub struct DefaultDirInjector;
impl AtomicDirInjector for DefaultDirInjector {}

pub fn atomic_install_dir_with_injector<I>(
    temp_path: &Path,
    target_path: &Path,
    injector: &I,
) -> Result<(), Error>
where
    I: AtomicDirInjector,
{
    #[cfg(unix)]
    {
        unix::install_dir(temp_path, target_path, injector)
    }
    #[cfg(not(unix))]
    {
        let _ = (temp_path, target_path, injector);
        Err(Error::Conflict("atomic directory installation is unsupported on this platform: fd-relative no-follow and durable parent sync cannot be proven".into()))
    }
}
pub fn atomic_install_dir(temp_path: &Path, target_path: &Path) -> Result<(), Error> {
    atomic_install_dir_with_injector(temp_path, target_path, &DefaultDirInjector)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::Write, path::PathBuf, sync::Mutex};

    #[cfg(unix)]
    fn inode(path: &std::path::Path) -> (u64, u64) {
        use std::os::unix::fs::MetadataExt;
        let metadata = std::fs::symlink_metadata(path).expect("metadata");
        (metadata.dev(), metadata.ino())
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
        injector: Box<dyn unix::RemovalInjector>,
    ) -> Result<(), Error> {
        unix::set_test_removal_injector(Some(injector));
        let result = remove_entry_at(parent, name, expected, true);
        unix::set_test_removal_injector(None);
        result
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
            Box::new(RemovalSwap {
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
            Box::new(RemovalSwap {
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
            Box::new(RemovalSwap {
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
            Box::new(ParentDeviceOverride(expected.0.wrapping_add(1))),
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
            Box::new(unix::RemovalFault(
                unix::RemovalFaultPoint::AfterEntryRemoved,
            )),
        )
        .expect_err("post-removal failure must be reported");

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
            Box::new(unix::RemovalFault(unix::RemovalFaultPoint::ParentSync)),
        )
        .expect_err("parent sync failure must preserve commit status");

        assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
        assert!(!victim.exists(), "the tree was completely removed");
    }

    struct Fault(
        Option<AtomicFileFaultPoint>,
        Option<AtomicFileFaultPoint>,
        Mutex<Vec<AtomicFileFaultPoint>>,
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

    struct DirFault {
        point: AtomicDirFaultPoint,
    }

    struct SourceSwap {
        source: PathBuf,
    }
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
    struct DirTargetMutation {
        target: PathBuf,
        existing: bool,
    }
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
    impl AtomicDirInjector for DirFault {
        fn inject(&self, point: AtomicDirFaultPoint) -> std::io::Result<()> {
            if point == self.point {
                return Err(std::io::Error::other("injected"));
            }
            Ok(())
        }
    }

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

    #[test]
    fn fresh_target_is_private_then_durable() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("new");
        let outcome = atomic_replace_with_injector(
            &target,
            &PrivateTemp {
                parent: dir.path().to_path_buf(),
            },
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
        .expect("fd-relative replace");
        assert_eq!(
            std::fs::read(dir.path().join("artifact.pgn")).expect("read"),
            b"exact"
        );
        assert!(
            atomic_replace_at(&parent, std::ffi::OsStr::new("nested/name"), |_| Ok(())).is_err()
        );
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
        atomic_replace(&target, |file| file.write_all(b"new").map_err(io)).expect("replace");
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
        atomic_replace_with_precommit(
            &target,
            &injector,
            || {
                complete.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
            |file| file.write_all(b"new").map_err(io),
        )
        .expect("replace");
        assert!(observed.load(std::sync::atomic::Ordering::SeqCst));
        assert_eq!(std::fs::read(&target).expect("target"), b"new");
        let rejected = dir.path().join("rejected");
        std::fs::write(&rejected, b"old").expect("old");
        assert!(matches!(
            atomic_replace_with_precommit(
                &rejected,
                &DefaultInjector,
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
            let fault = Fault(Some(point), None, Mutex::new(Vec::new()));
            assert!(atomic_replace_with_injector(&target, &fault, |f| f
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
            Mutex::new(Vec::new()),
        );
        assert!(matches!(
            atomic_replace_with_injector(&target, &sync_fault, |f| f.write_all(b"new").map_err(io)),
            Ok(AtomicFileOutcome::CommittedDurabilityUncertain(_))
        ));
        assert_eq!(std::fs::read(&target).expect("read"), b"new");
        let second = dir.path().join("second");
        let cleanup_fault = Fault(
            Some(AtomicFileFaultPoint::Write),
            Some(AtomicFileFaultPoint::Cleanup),
            Mutex::new(Vec::new()),
        );
        assert!(atomic_replace_with_injector(&second, &cleanup_fault, |_| Ok(())).is_err());
        assert!(cleanup_fault
            .2
            .lock()
            .expect("lock")
            .contains(&AtomicFileFaultPoint::Cleanup));
        assert!(!second.exists());
        let third = dir.path().join("third");
        let real_cleanup_fault = BreakCleanup {
            parent: dir.path().to_path_buf(),
        };
        match atomic_replace_with_injector(&third, &real_cleanup_fault, |_| Ok(())) {
            Err(Error::OperationAndCleanup { primary, cleanup }) => {
                assert!(primary.contains("primary"));
                assert!(!cleanup.is_empty());
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
                atomic_replace_with_injector(&target, &injector, |f| f
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
            atomic_replace_with_injector(&target, &injector, |f| f.write_all(b"new").map_err(io)),
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
        assert!(atomic_replace_with_injector(&target, &injector, |f| f
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
            unix::set_test_temp_names(vec!["available".into(), "collision".into()]);
            std::fs::write(root.path().join("collision"), b"collision").expect("collision");
            atomic_replace(&root.path().join("target"), |f| {
                f.write_all(b"new").map_err(io)
            })
            .expect("retry");
            assert_eq!(
                std::fs::read(root.path().join("target")).expect("target"),
                b"new"
            );
        }
    }

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
            assert!(atomic_install_dir_with_injector(&source, &target, &injector).is_err());
            assert_eq!(std::fs::read(target.join("old")).expect("old"), b"old");
        }
        let (_root, source, target) = directory_fixture();
        let injector = DirFault {
            point: AtomicDirFaultPoint::ParentSync,
        };
        assert!(matches!(
            atomic_install_dir_with_injector(&source, &target, &injector),
            Err(Error::CommittedDurabilityUncertain(_))
        ));
        assert_eq!(std::fs::read(target.join("new")).expect("new"), b"new");

        let root = tempfile::tempdir().expect("root");
        let source = root.path().join("source");
        let target = root.path().join("target");
        std::fs::create_dir(&source).expect("source");
        std::fs::write(source.join("new"), b"new").expect("new");
        assert!(matches!(
            atomic_install_dir_with_injector(
                &source,
                &target,
                &DirTargetMutation {
                    target: target.clone(),
                    existing: false
                }
            ),
            Err(Error::Conflict(_))
        ));
        assert!(target.is_dir());
        let (_root, source, target) = directory_fixture();
        assert!(matches!(
            atomic_install_dir_with_injector(
                &source,
                &target,
                &DirTargetMutation {
                    target: target.clone(),
                    existing: true
                }
            ),
            Err(Error::Conflict(_))
        ));

        let (_root, source, target) = directory_fixture();
        assert!(atomic_install_dir_with_injector(
            &source,
            &target,
            &SourceSwap {
                source: source.clone()
            }
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
            atomic_install_dir_with_injector(&source, &target, &injector),
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
