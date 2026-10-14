//! One arbitration for SQLite reservations, capability descriptors, sidecars and quarantine.
//! On Unix, each ordinary inode belongs to one domain: all capability owners, or the sidecars
//! of one SQLite registration token. Different domains and SQLite primaries cannot share it.
//! Windows has no inode exclusion.
//! Repository predecessor admission releases its state mutex before this mutex is acquired.
//! VFS lookup also releases this mutex before callbacks or filesystem work. No nested registry
//! acquisition is permitted. Both owner classes close before release under this mutex.

use crate::{
    db::bound_sqlite::{BindingKey, Registration},
    error::Error,
};

#[cfg(unix)]
/// The VFS admission threshold also governs ordinary opens. A full retained bucket refuses
/// admission, never closes descriptors. Already admitted opens may exceed the threshold.
pub(crate) const QUARANTINE_ADMISSION_LIMIT: usize = 8;
use std::{
    collections::HashMap,
    fs::File,
    io::{self, Read, Seek, Write},
    sync::{Mutex, MutexGuard, OnceLock, Weak},
};

#[derive(Default)]
pub(crate) struct Registry {
    pub(crate) by_token: HashMap<u64, Weak<Registration>>,
    pub(crate) by_key: HashMap<BindingKey, (PrimaryClaim, Weak<Registration>)>,
    pub(crate) creating: HashMap<BindingKey, PrimaryClaim>,
    ordinary: HashMap<(u64, u64), usize>,
    #[cfg(unix)]
    sidecar_counts: HashMap<(u64, u64), (u64, usize)>,
    #[cfg(unix)]
    sqlite_sidecars: HashMap<u64, SidecarOwners>,
    #[cfg(unix)]
    pub(crate) quarantined_descriptors: HashMap<(u64, u64), Vec<File>>,
    #[cfg(unix)]
    pub(crate) unclassified_descriptors: Vec<File>,
    #[cfg(test)]
    pub(crate) creation_hooks: HashMap<BindingKey, Box<dyn FnOnce() + Send>>,
    #[cfg(test)]
    pub(crate) creation_failures: std::collections::HashSet<BindingKey>,
    #[cfg(test)]
    pub(crate) waiting_hooks: HashMap<BindingKey, Box<dyn FnOnce() + Send>>,
    #[cfg(test)]
    pub(crate) drop_hooks: HashMap<BindingKey, Box<dyn FnOnce() + Send>>,
}

pub(crate) static REGISTRY: OnceLock<Mutex<Registry>> = OnceLock::new();

/// Moves between the existing creating and registered entries without releasing the inode.
/// Every removal drops this owner under admission arbitration, including expired weak entries.
pub(crate) struct PrimaryClaim {
    pub(crate) token: u64,
    #[cfg(unix)]
    _pin: File,
}

#[cfg(all(test, unix))]
thread_local! {
    pub(crate) static PRIMARY_CLOSE_BARRIERS: std::cell::RefCell<Option<(std::sync::Arc<std::sync::Barrier>, std::sync::Arc<std::sync::Barrier>)>> = const { std::cell::RefCell::new(None) };
    pub(crate) static PRIMARY_PIN_TEST_CONTROLS: std::cell::RefCell<OpenTestControls> = std::cell::RefCell::new(OpenTestControls::default());
}

#[cfg(all(test, unix))]
impl Drop for PrimaryClaim {
    fn drop(&mut self) {
        if let Some((entered, resume)) = PRIMARY_CLOSE_BARRIERS
            .try_with(|slot| slot.borrow_mut().take())
            .ok()
            .flatten()
        {
            entered.wait();
            resume.wait();
        }
    }
}

#[derive(Clone, Copy, Debug)]
enum OwnerClass {
    Capability,
    #[cfg(unix)]
    SqliteSidecar(u64),
}

#[cfg(all(test, unix))]
pub(crate) fn open_descriptor_fds(identity: (u64, u64)) -> Vec<libc::c_int> {
    let directory = if cfg!(target_os = "linux") {
        "/proc/self/fd"
    } else {
        "/dev/fd"
    };
    std::fs::read_dir(directory)
        .expect("read process descriptor directory")
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().to_str()?.parse::<libc::c_int>().ok())
        .filter(|fd| {
            let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
            if unsafe { libc::fstat(*fd, stat.as_mut_ptr()) } != 0 {
                return false;
            }
            crate::infra::fs::raw_libc_stat_identity(unsafe { &stat.assume_init() }) == identity
        })
        .collect()
}

#[cfg(all(test, target_os = "linux"))]
pub(crate) fn open_descriptor_count(identity: (u64, u64)) -> usize {
    open_descriptor_fds(identity).len()
}

#[cfg(all(test, target_os = "linux"))]
thread_local! {
    pub(crate) static FINAL_RELEASE_COUNTS: std::cell::RefCell<Vec<((u64, u64), usize)>> = const { std::cell::RefCell::new(Vec::new()) };
}

/// Per-registration connection counts control sidecar close only. Primary inode admission
/// always uses the shared by_key/creating state, including cached bindings without connections.
#[cfg(unix)]
#[derive(Default)]
struct SidecarOwners {
    connections: usize,
    files: HashMap<(u64, u64), OwnedFile>,
}

#[cfg(unix)]
pub(crate) fn begin_connection(token: u64) -> Result<(), Error> {
    let mut registry = lock()?;
    let owners = registry.sqlite_sidecars.entry(token).or_default();
    owners.connections = owners
        .connections
        .checked_add(1)
        .ok_or_else(|| Error::ResourceLimit("SQLite connection owner count exhausted".into()))?;
    Ok(())
}

#[cfg(unix)]
pub(crate) fn finish_connection(token: u64) {
    let mut registry = REGISTRY
        .get_or_init(|| Mutex::new(Registry::default()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let files = registry
        .sqlite_sidecars
        .get_mut(&token)
        .map(|owners| {
            owners.connections = owners.connections.saturating_sub(1);
            if owners.connections == 0 {
                std::mem::take(&mut owners.files)
            } else {
                HashMap::new()
            }
        })
        .unwrap_or_default();
    for mut owner in files.into_values() {
        owner.close_under(&mut registry);
    }
}

#[cfg(all(test, unix))]
#[derive(Default)]
pub(crate) struct OpenTestControls {
    pub(crate) after_identify: Option<Box<dyn FnOnce() + Send>>,
    pub(crate) inspect_error: Option<i32>,
    #[cfg(target_os = "linux")]
    pub(crate) reopen_error: Option<i32>,
}
#[cfg(all(test, unix))]
thread_local! {
    pub(crate) static OPEN_TEST_CONTROLS: std::cell::RefCell<OpenTestControls> = std::cell::RefCell::new(OpenTestControls::default());
    pub(crate) static FINAL_CLOSE_BARRIERS: std::cell::RefCell<Option<(std::sync::Arc<std::sync::Barrier>, std::sync::Arc<std::sync::Barrier>)>> = const { std::cell::RefCell::new(None) };
}

#[cfg(all(test, unix))]
fn after_identify() {
    let callback = OPEN_TEST_CONTROLS.with(|controls| controls.borrow_mut().after_identify.take());
    if let Some(callback) = callback {
        callback();
    }
}

#[cfg(unix)]
fn inspect(file: &File) -> Result<rustix::fs::Stat, rustix::io::Errno> {
    #[cfg(test)]
    if let Some(error) =
        OPEN_TEST_CONTROLS.with(|controls| controls.borrow_mut().inspect_error.take())
    {
        return Err(rustix::io::Errno::from_raw_os_error(error));
    }
    rustix::fs::fstat(file)
}

pub(crate) fn lock() -> Result<MutexGuard<'static, Registry>, Error> {
    REGISTRY
        .get_or_init(|| Mutex::new(Registry::default()))
        .lock()
        .map_err(|_| Error::Conflict("bound SQLite registry was poisoned".into()))
}

/// A read-only preflight avoids predecessor waits for an already incompatible ordinary owner.
/// BoundDatabase still performs final admission under this same arbitration after the barrier.
pub(crate) fn check_sqlite(identity: (u64, u64)) -> Result<(), Error> {
    lock()?.check_sqlite(identity)
}

impl Registry {
    #[cfg(unix)]
    pub(crate) fn remove_sidecars(&mut self, token: u64) {
        if let Some(owners) = self.sqlite_sidecars.remove(&token) {
            for mut owner in owners.files.into_values() {
                owner.close_under(self);
            }
        }
    }
    #[cfg(unix)]
    fn any_sqlite_live(&self) -> bool {
        !self.by_key.is_empty() || !self.creating.is_empty()
    }
    pub(crate) fn sqlite_live(&self, identity: (u64, u64)) -> bool {
        self.by_key.keys().any(|key| key.identity == identity)
            || self.creating.keys().any(|key| key.identity == identity)
    }

    /// Opens an ownership reference only after same-key reuse and alias exclusion. This is
    /// separate from metadata-only authority probes and never substitutes for VFS validation.
    pub(crate) fn claim_sqlite(
        &mut self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        token: u64,
    ) -> Result<PrimaryClaim, Error> {
        #[cfg(unix)]
        {
            use rustix::fs::{self as rfs, AtFlags, FileType, Mode, OFlags};
            let io_error = |error: rustix::io::Errno| Error::from(io::Error::from(error));
            if !self.open_admitted() {
                return Err(Error::from(io::Error::from_raw_os_error(libc::EMFILE)));
            }
            let expected = rfs::statat(target.parent(), target.leaf(), AtFlags::SYMLINK_NOFOLLOW)
                .map_err(io_error)?;
            if FileType::from_raw_mode(expected.st_mode) != FileType::RegularFile
                || crate::infra::fs::raw_stat_identity(&expected) != target.identity()
            {
                return Err(Error::Conflict(
                    "database changed after capability resolution".into(),
                ));
            }
            self.check_class(target.identity(), OwnerClass::Capability)?;
            self.check_sqlite(target.identity())?;
            #[cfg(test)]
            if let Some(hook) = PRIMARY_PIN_TEST_CONTROLS
                .with(|controls| controls.borrow_mut().after_identify.take())
            {
                hook();
            }
            #[cfg(target_os = "linux")]
            let flags = OFlags::PATH;
            #[cfg(not(target_os = "linux"))]
            let flags = OFlags::RDONLY | OFlags::NONBLOCK;
            let opened = File::from(
                rfs::openat(
                    target.parent(),
                    target.leaf(),
                    flags | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                    Mode::empty(),
                )
                .map_err(io_error)?,
            );
            #[cfg(test)]
            let inspect_error = PRIMARY_PIN_TEST_CONTROLS
                .with(|controls| controls.borrow_mut().inspect_error.take());
            #[cfg(not(test))]
            let inspect_error: Option<i32> = None;
            let stat = match inspect_error.map_or_else(
                || rfs::fstat(&opened),
                |error| Err(rustix::io::Errno::from_raw_os_error(error)),
            ) {
                Ok(stat) => stat,
                Err(error) => {
                    // O_PATH cannot release locks. All lockable unknown opens use quarantine.
                    #[cfg(not(target_os = "linux"))]
                    self.quarantine(opened, None);
                    return Err(io_error(error));
                }
            };
            let identity = crate::infra::fs::raw_stat_identity(&stat);
            if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile
                || identity != target.identity()
            {
                #[cfg(not(target_os = "linux"))]
                self.quarantine(opened, Some(identity));
                return Err(Error::Conflict(
                    "database changed after capability resolution".into(),
                ));
            }
            Ok(PrimaryClaim {
                token,
                _pin: opened,
            })
        }
        #[cfg(windows)]
        {
            let _ = target;
            Ok(PrimaryClaim { token })
        }
    }

    pub(crate) fn ordinary_live(&self, identity: (u64, u64)) -> bool {
        cfg!(unix) && self.ordinary.contains_key(&identity)
    }

    pub(crate) fn check_sqlite(&self, identity: (u64, u64)) -> Result<(), Error> {
        if self.ordinary_live(identity) {
            Err(Error::Conflict(
                "file is open through an ordinary capability".into(),
            ))
        } else if self.sidecar_live(identity) {
            Err(Error::Conflict(
                "file is open through a SQLite binding".into(),
            ))
        } else {
            Ok(())
        }
    }

    #[cfg(any(test, windows))]
    pub(crate) fn admit(&mut self, identity: (u64, u64)) -> Result<(), Error> {
        self.admit_class(identity, OwnerClass::Capability)
    }

    fn sidecar_live(&self, identity: (u64, u64)) -> bool {
        #[cfg(unix)]
        return self.sidecar_counts.contains_key(&identity);
        #[cfg(windows)]
        {
            let _ = identity;
            false
        }
    }

    fn check_class(&self, identity: (u64, u64), class: OwnerClass) -> Result<(), Error> {
        if cfg!(unix) && self.sqlite_live(identity) {
            return Err(Error::Conflict(
                "file is open through a SQLite binding".into(),
            ));
        }
        match class {
            OwnerClass::Capability if self.sidecar_live(identity) => Err(Error::Conflict(
                "file is open through a SQLite binding".into(),
            )),
            #[cfg(unix)]
            OwnerClass::SqliteSidecar(_) if self.ordinary_live(identity) => Err(Error::Conflict(
                "file is open through an ordinary capability".into(),
            )),
            #[cfg(unix)]
            OwnerClass::SqliteSidecar(token)
                if self
                    .sidecar_counts
                    .get(&identity)
                    .is_some_and(|(owner, _)| *owner != token) =>
            {
                Err(Error::Conflict(
                    "file is open through a SQLite binding".into(),
                ))
            }
            _ => Ok(()),
        }
    }

    fn admit_class(&mut self, identity: (u64, u64), class: OwnerClass) -> Result<(), Error> {
        self.check_class(identity, class)?;
        let count = match class {
            OwnerClass::Capability => self.ordinary.entry(identity).or_default(),
            #[cfg(unix)]
            OwnerClass::SqliteSidecar(token) => {
                &mut self.sidecar_counts.entry(identity).or_insert((token, 0)).1
            }
        };
        *count = count
            .checked_add(1)
            .ok_or_else(|| Error::ResourceLimit("ordinary file owner count exhausted".into()))?;
        Ok(())
    }

    fn release(&mut self, identity: (u64, u64), class: OwnerClass) {
        let count = match class {
            OwnerClass::Capability => self.ordinary.get_mut(&identity),
            #[cfg(unix)]
            OwnerClass::SqliteSidecar(token) => self
                .sidecar_counts
                .get_mut(&identity)
                .filter(|(owner, _)| *owner == token)
                .map(|(_, count)| count),
        };
        if let Some(count) = count {
            *count -= 1;
            if *count == 0 {
                match class {
                    OwnerClass::Capability => {
                        self.ordinary.remove(&identity);
                    }
                    #[cfg(unix)]
                    OwnerClass::SqliteSidecar(_) => {
                        self.sidecar_counts.remove(&identity);
                    }
                }
                #[cfg(all(test, target_os = "linux"))]
                FINAL_RELEASE_COUNTS.with(|counts| {
                    counts
                        .borrow_mut()
                        .push((identity, open_descriptor_count(identity)));
                });
            }
        }
    }

    #[cfg(unix)]
    pub(crate) fn open_admitted(&self) -> bool {
        self.unclassified_descriptors.len() < QUARANTINE_ADMISSION_LIMIT
            && !self
                .quarantined_descriptors
                .values()
                .any(|files| files.len() >= QUARANTINE_ADMISSION_LIMIT)
    }

    #[cfg(unix)]
    pub(crate) fn quarantine(&mut self, file: File, identity: Option<(u64, u64)>) {
        match identity {
            Some(identity) if self.sqlite_live(identity) || self.sidecar_live(identity) => self
                .quarantined_descriptors
                .entry(identity)
                .or_default()
                .push(file),
            Some(_) => drop(file),
            None if !self.any_sqlite_live() => drop(file),
            None => self.unclassified_descriptors.push(file),
        }
    }

    #[cfg(unix)]
    pub(crate) fn drain_quarantine(&mut self) {
        let retired: Vec<_> = self
            .quarantined_descriptors
            .keys()
            .copied()
            .filter(|id| !self.sqlite_live(*id) && !self.sidecar_live(*id))
            .collect();
        for id in retired {
            drop(self.quarantined_descriptors.remove(&id));
        }
        if !self.any_sqlite_live() {
            drop(std::mem::take(&mut self.unclassified_descriptors));
        }
    }
}

/// A regular descriptor with an inseparable capability or SQLite-sidecar owner.
/// Directory carriers are untracked. No consuming raw File escape outside SQLite handoff.
#[derive(Debug)]
pub(crate) struct OwnedFile {
    file: Option<File>,
    identity: (u64, u64),
    tracked: bool,
    class: OwnerClass,
}

impl OwnedFile {
    /// Called only by opening adapters while holding admission arbitration.
    fn admitted(file: File, identity: (u64, u64), class: OwnerClass) -> Self {
        Self {
            file: Some(file),
            identity,
            tracked: true,
            class,
        }
    }

    pub(in crate::infra) fn directory(file: File) -> Result<Self, Error> {
        if !file.metadata()?.is_dir() {
            return Err(Error::InvalidInput(
                "descriptor must name a directory".into(),
            ));
        }
        Ok(Self {
            file: Some(file),
            identity: (0, 0),
            tracked: false,
            class: OwnerClass::Capability,
        })
    }

    fn file(&self) -> io::Result<&File> {
        self.file
            .as_ref()
            .ok_or_else(|| io::Error::other("file descriptor was transferred"))
    }
    pub(crate) fn metadata(&self) -> io::Result<std::fs::Metadata> {
        self.file()?.metadata()
    }
    pub(crate) fn sync_all(&self) -> io::Result<()> {
        self.file()?.sync_all()
    }
    #[cfg(all(test, windows))]
    pub(crate) fn set_len(&self, length: u64) -> io::Result<()> {
        self.file()?.set_len(length)
    }
    #[cfg(unix)]
    pub(crate) fn set_permissions(&self, permissions: std::fs::Permissions) -> io::Result<()> {
        self.file()?.set_permissions(permissions)
    }
    #[cfg(test)]
    pub(crate) fn set_modified(&self, modified: std::time::SystemTime) -> io::Result<()> {
        self.file()?.set_modified(modified)
    }
    pub(crate) fn try_clone(&self) -> io::Result<Self> {
        let mut registry = lock().map_err(|error| io::Error::other(error.diagnostic()))?;
        let file = self.file()?.try_clone()?;
        if self.tracked {
            registry
                .admit_class(self.identity, self.class)
                .map_err(|error| io::Error::other(error.diagnostic()))?;
        }
        Ok(Self {
            file: Some(file),
            identity: self.identity,
            tracked: self.tracked,
            class: self.class,
        })
    }

    /// The only native transfer is into SQLite's owning registration, which retains the lease.
    #[cfg(unix)]
    pub(crate) fn handoff_sqlite(
        mut self,
        registration: &Registration,
    ) -> Result<std::os::fd::RawFd, Error> {
        use std::os::fd::IntoRawFd;
        let mut registry = lock()?;
        let identity = self.identity;
        let owners = registry
            .sqlite_sidecars
            .entry(registration.token)
            .or_default();
        if let std::collections::hash_map::Entry::Vacant(entry) = owners.files.entry(identity) {
            // Pin the inode without closing any newly opened descriptor. SQLite takes the
            // original descriptor, and this duplicate closes only after its last connection.
            let pin = self.file()?.try_clone()?;
            let native = self.file.replace(pin).ok_or_else(|| {
                Error::Conflict("SQLite sidecar descriptor is unavailable".into())
            })?;
            entry.insert(self);
            Ok(native.into_raw_fd())
        } else {
            let native = self.file.take().ok_or_else(|| {
                Error::Conflict("SQLite sidecar descriptor is unavailable".into())
            })?;
            self.close_under(&mut registry);
            Ok(native.into_raw_fd())
        }
    }

    fn close_under(&mut self, registry: &mut Registry) {
        drop(self.file.take());
        if self.tracked {
            registry.release(self.identity, self.class);
            self.tracked = false;
        }
    }
}

impl Drop for OwnedFile {
    fn drop(&mut self) {
        if !self.tracked {
            return;
        }
        let mut registry = REGISTRY
            .get_or_init(|| Mutex::new(Registry::default()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        // Fixed test barriers, not callbacks, expose the close critical section.
        #[cfg(all(test, unix))]
        if let Some((entered, resume)) = FINAL_CLOSE_BARRIERS
            .try_with(|slot| slot.borrow_mut().take())
            .ok()
            .flatten()
        {
            entered.wait();
            resume.wait();
        }
        self.close_under(&mut registry);
    }
}

impl Read for OwnedFile {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        self.file()?.read(bytes)
    }
}
impl Read for &OwnedFile {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        self.file()?.read(bytes)
    }
}
impl Write for OwnedFile {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.file()?.write(bytes)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.file()?.flush()
    }
}
impl Seek for OwnedFile {
    fn seek(&mut self, position: io::SeekFrom) -> io::Result<u64> {
        self.file()?.seek(position)
    }
}

#[cfg(unix)]
impl std::os::fd::AsFd for OwnedFile {
    fn as_fd(&self) -> std::os::fd::BorrowedFd<'_> {
        // The descriptor is present for the full borrowed carrier lifetime.
        unsafe { std::os::fd::BorrowedFd::borrow_raw(std::os::fd::AsRawFd::as_raw_fd(self)) }
    }
}
#[cfg(unix)]
impl std::os::fd::AsRawFd for OwnedFile {
    fn as_raw_fd(&self) -> std::os::fd::RawFd {
        self.file
            .as_ref()
            .map_or(-1, std::os::fd::AsRawFd::as_raw_fd)
    }
}
#[cfg(windows)]
impl std::os::windows::io::AsRawHandle for OwnedFile {
    fn as_raw_handle(&self) -> std::os::windows::io::RawHandle {
        self.file.as_ref().map_or(
            std::ptr::null_mut(),
            std::os::windows::io::AsRawHandle::as_raw_handle,
        )
    }
}

/// Metadata is shared without exposing a File that could mint an unowned duplicate.
pub(crate) trait FileMetadata {
    fn metadata(&self) -> io::Result<std::fs::Metadata>;
    #[cfg(windows)]
    fn native_handle(&self) -> std::os::windows::io::RawHandle;
}
impl FileMetadata for File {
    fn metadata(&self) -> io::Result<std::fs::Metadata> {
        File::metadata(self)
    }
    #[cfg(windows)]
    fn native_handle(&self) -> std::os::windows::io::RawHandle {
        std::os::windows::io::AsRawHandle::as_raw_handle(self)
    }
}
impl FileMetadata for OwnedFile {
    fn metadata(&self) -> io::Result<std::fs::Metadata> {
        OwnedFile::metadata(self)
    }
    #[cfg(windows)]
    fn native_handle(&self) -> std::os::windows::io::RawHandle {
        std::os::windows::io::AsRawHandle::as_raw_handle(self)
    }
}

#[cfg(unix)]
pub(crate) trait NativeFile: FileMetadata + std::os::fd::AsFd {}
#[cfg(unix)]
impl<T: FileMetadata + std::os::fd::AsFd> NativeFile for T {}
#[cfg(windows)]
pub(crate) trait NativeFile: FileMetadata + std::os::windows::io::AsRawHandle {}
#[cfg(windows)]
impl<T: FileMetadata + std::os::windows::io::AsRawHandle> NativeFile for T {}

#[cfg(unix)]
impl std::os::unix::fs::FileExt for OwnedFile {
    fn read_at(&self, bytes: &mut [u8], offset: u64) -> io::Result<usize> {
        self.file()?.read_at(bytes, offset)
    }
    fn write_at(&self, bytes: &[u8], offset: u64) -> io::Result<usize> {
        self.file()?.write_at(bytes, offset)
    }
}

#[cfg(all(test, unix))]
impl OwnedFile {
    pub(crate) fn open(path: impl AsRef<std::path::Path>) -> io::Result<Self> {
        Ok(File::open(path)?.into())
    }
}

#[cfg(test)]
impl From<File> for OwnedFile {
    fn from(file: File) -> Self {
        if file.metadata().unwrap().is_dir() {
            return Self::directory(file).unwrap();
        }
        let identity = crate::infra::path_authority::opened_file_identity(&file).unwrap();
        let admission = lock().unwrap().admit(identity);
        admission.unwrap();
        Self::admitted(file, identity, OwnerClass::Capability)
    }
}

#[cfg(unix)]
pub(crate) fn open_at(
    parent: &File,
    name: &std::ffi::OsStr,
    flags: rustix::fs::OFlags,
    create: bool,
) -> Result<OwnedFile, Error> {
    open_at_mode(
        parent,
        name,
        flags,
        create,
        rustix::fs::Mode::from_raw_mode(0o600),
    )
}

#[cfg(unix)]
pub(crate) fn open_at_mode(
    parent: &File,
    name: &std::ffi::OsStr,
    flags: rustix::fs::OFlags,
    create: bool,
    mode: rustix::fs::Mode,
) -> Result<OwnedFile, Error> {
    open_at_mode_class(parent, name, flags, create, mode, OwnerClass::Capability)
}

#[cfg(unix)]
pub(crate) fn open_sqlite_sidecar_at_mode(
    parent: &File,
    name: &std::ffi::OsStr,
    flags: rustix::fs::OFlags,
    create: bool,
    exclusive: bool,
    mode: rustix::fs::Mode,
    token: u64,
) -> Result<OwnedFile, Error> {
    if create && exclusive {
        create_at_mode_class(parent, name, flags, mode, OwnerClass::SqliteSidecar(token))
    } else {
        open_at_mode_class(
            parent,
            name,
            flags,
            create,
            mode,
            OwnerClass::SqliteSidecar(token),
        )
    }
}

#[cfg(unix)]
fn open_at_mode_class(
    parent: &File,
    name: &std::ffi::OsStr,
    flags: rustix::fs::OFlags,
    create: bool,
    mode: rustix::fs::Mode,
    class: OwnerClass,
) -> Result<OwnedFile, Error> {
    use rustix::fs::{self as rfs, FileType, OFlags};
    let io_error = |error: rustix::io::Errno| Error::from(io::Error::from(error));
    #[cfg(target_os = "linux")]
    {
        use rustix::fs::Mode;
        use std::os::fd::AsRawFd;
        let path_file = match rfs::openat(
            parent,
            name,
            OFlags::PATH | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        ) {
            Ok(fd) => File::from(fd),
            Err(error) if error == rustix::io::Errno::NOENT && create => {
                match create_at_mode_class(parent, name, flags, mode, class) {
                    Err(Error::Io(error)) if error.raw_os_error() == Some(libc::EEXIST) => {
                        return open_at_mode_class(parent, name, flags, false, mode, class)
                    }
                    result => return result,
                }
            }
            Err(error) => return Err(io_error(error)),
        };
        let stat = inspect(&path_file).map_err(io_error)?;
        if FileType::from_raw_mode(stat.st_mode) == FileType::Symlink {
            return Err(Error::from(io::Error::from_raw_os_error(libc::ELOOP)));
        }
        if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
            // This exact non-regular inode cannot hold a regular database reservation. Open
            // nonblocking only to preserve the kernel's access error before the kind refusal.
            let special = rfs::openat(
                rfs::CWD,
                format!("/proc/self/fd/{}", path_file.as_raw_fd()),
                flags | OFlags::CLOEXEC | OFlags::NONBLOCK,
                Mode::empty(),
            )
            .map_err(io_error)?;
            drop(special);
            return Err(Error::InvalidInput("target must be a regular file".into()));
        }
        let identity = crate::infra::fs::raw_stat_identity(&stat);
        #[cfg(test)]
        after_identify();
        let mut registry = lock()?;
        if !registry.open_admitted() {
            return Err(Error::from(io::Error::from_raw_os_error(libc::EMFILE)));
        }
        registry.admit_class(identity, class)?;
        let mut owned = OwnedFile {
            file: None,
            identity,
            tracked: true,
            class,
        };
        drop(registry);
        #[cfg(test)]
        let reopen_error =
            OPEN_TEST_CONTROLS.with(|controls| controls.borrow_mut().reopen_error.take());
        #[cfg(not(test))]
        let reopen_error: Option<i32> = None;
        let reopened = match reopen_error {
            Some(error) => Err(rustix::io::Errno::from_raw_os_error(error)),
            None => rfs::openat(
                rfs::CWD,
                format!("/proc/self/fd/{}", path_file.as_raw_fd()),
                flags | OFlags::CLOEXEC,
                Mode::empty(),
            ),
        };
        match reopened {
            Ok(fd) => {
                owned.file = Some(File::from(fd));
                Ok(owned)
            }
            Err(error) => Err(io_error(error)),
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let expected = match rfs::statat(parent, name, rfs::AtFlags::SYMLINK_NOFOLLOW) {
            Ok(stat) => Some(crate::infra::fs::raw_stat_identity(&stat)),
            Err(error) if error == rustix::io::Errno::NOENT && create => None,
            Err(error) => return Err(io_error(error)),
        };
        #[cfg(test)]
        after_identify();
        let mut registry = lock()?;
        if !registry.open_admitted() {
            return Err(Error::from(io::Error::from_raw_os_error(libc::EMFILE)));
        }
        if let Some(identity) = expected {
            registry.check_class(identity, class)?;
        }
        let opened = File::from(
            rfs::openat(
                parent,
                name,
                flags
                    | OFlags::NOFOLLOW
                    | OFlags::CLOEXEC
                    | OFlags::NONBLOCK
                    | if create {
                        OFlags::CREATE
                    } else {
                        OFlags::empty()
                    },
                mode,
            )
            .map_err(io_error)?,
        );
        let stat = match inspect(&opened) {
            Ok(stat) => stat,
            Err(error) => {
                registry.quarantine(opened, None);
                return Err(io_error(error));
            }
        };
        let identity = crate::infra::fs::raw_stat_identity(&stat);
        if let Err(error) = registry.admit_class(identity, class) {
            registry.quarantine(opened, Some(identity));
            return Err(error);
        }
        let owned = OwnedFile::admitted(opened, identity, class);
        drop(registry);
        if expected.is_some_and(|expected| expected != identity) {
            return Err(Error::Conflict("file changed while opening".into()));
        }
        if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
            return Err(Error::InvalidInput("target must be a regular file".into()));
        }
        if !flags.contains(OFlags::NONBLOCK) {
            let current = rfs::fcntl_getfl(&owned).map_err(io_error)?;
            rfs::fcntl_setfl(&owned, current - OFlags::NONBLOCK).map_err(io_error)?;
        }
        Ok(owned)
    }
}

#[cfg(unix)]
pub(crate) fn create_at(
    parent: &File,
    name: &std::ffi::OsStr,
    flags: rustix::fs::OFlags,
) -> Result<OwnedFile, Error> {
    create_at_mode(parent, name, flags, rustix::fs::Mode::from_raw_mode(0o600))
}

#[cfg(unix)]
pub(crate) fn create_at_mode(
    parent: &File,
    name: &std::ffi::OsStr,
    flags: rustix::fs::OFlags,
    mode: rustix::fs::Mode,
) -> Result<OwnedFile, Error> {
    create_at_mode_class(parent, name, flags, mode, OwnerClass::Capability)
}

#[cfg(unix)]
fn create_at_mode_class(
    parent: &File,
    name: &std::ffi::OsStr,
    flags: rustix::fs::OFlags,
    mode: rustix::fs::Mode,
    class: OwnerClass,
) -> Result<OwnedFile, Error> {
    use rustix::fs::{self as rfs, OFlags};
    let mut registry = lock()?;
    if !registry.open_admitted() {
        return Err(Error::from(io::Error::from_raw_os_error(libc::EMFILE)));
    }
    let opened = File::from(
        rfs::openat(
            parent,
            name,
            flags | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            mode,
        )
        .map_err(|error| Error::from(io::Error::from(error)))?,
    );
    let stat = match rfs::fstat(&opened) {
        Ok(stat) => stat,
        Err(error) => {
            registry.quarantine(opened, None);
            return Err(Error::from(io::Error::from(error)));
        }
    };
    let identity = crate::infra::fs::raw_stat_identity(&stat);
    if let Err(error) = registry.admit_class(identity, class) {
        registry.quarantine(opened, Some(identity));
        return Err(error);
    }
    Ok(OwnedFile::admitted(opened, identity, class))
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use crate::infra::fs::{open_regular_at, RegularFileAccess};

    #[test]
    fn cross_capability_windows_carrier_preserves_rights_clone_and_sqlite_coexistence() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("carrier.db3");
        File::create(&path).unwrap();
        let parent = crate::infra::fs::windows_test_parent(root.path());
        let leaf = path.file_name().unwrap();
        let mut read_only = open_regular_at(&parent, leaf, RegularFileAccess::ReadOnly).unwrap();
        assert!(read_only.write_all(b"refused").is_err());
        assert!(read_only.set_len(4).is_err());
        let target =
            crate::infra::path_authority::DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = crate::db::bound_sqlite::BoundDatabase::acquire(&target).unwrap();
        let mut writer = open_regular_at(&parent, leaf, RegularFileAccess::ReadWrite).unwrap();
        writer.write_all(b"ordinary").unwrap();
        writer.sync_all().unwrap();
        let mut duplicate = writer.try_clone().unwrap();
        drop(writer);
        duplicate.seek(io::SeekFrom::Start(0)).unwrap();
        let mut bytes = Vec::new();
        duplicate.read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes, b"ordinary");
        assert_eq!(
            crate::infra::path_authority::opened_file_identity(&duplicate).unwrap(),
            target.identity()
        );
        drop(duplicate);
        drop(read_only);
        drop(bound);
    }
}

#[cfg(windows)]
pub(in crate::infra) fn own_windows(file: File) -> Result<OwnedFile, Error> {
    let identity = crate::infra::path_authority::opened_file_identity(&file)?;
    lock()?.admit(identity)?;
    Ok(OwnedFile::admitted(file, identity, OwnerClass::Capability))
}
