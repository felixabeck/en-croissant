//! SQLite opens for authorized databases use a reserved URI name that cannot
//! name a real file. Unix and Windows syscall hooks resolve that name through
//! a retained parent directory handle, and each binding owns its SQLite VFS
//! until every connection using it has closed. Linux verifies leaf opens on
//! `O_PATH` descriptors before reopening the verified inode; other Unix
//! platforms quarantine mismatched descriptors and refuse new leaf opens when
//! that bounded registry is full. Windows locks are handle-scoped.
//! Production code must not open SQLite by a plain pathname under
//! `/<chessfable-bound>/`; the only remaining plain-path production open is the private
//! puzzle snapshot in the temp dir.

use std::{
    collections::HashMap,
    ffi::{CString, OsStr, OsString},
    fs::File,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Condvar, Mutex, OnceLock, Weak,
    },
};

use rusqlite::ffi;

#[cfg(unix)]
use crate::infra::fs::raw_libc_stat_identity;
use crate::{
    error::Error,
    infra::path_authority::{opened_file_identity, DatabaseFileTarget},
};

const RESERVED_PREFIX: &str = "/<chessfable-bound>/";
const RESERVED_URI_PREFIX: &str = "file:/%3Cchessfable-bound%3E/";
/// While any per-identity or unclassified retained set holds this many descriptors,
/// every leaf open is refused with `EMFILE`; admitted opens can still push a set past
/// the limit, and exceeding it never closes descriptors.
#[cfg(all(unix, not(target_os = "linux")))]
const QUARANTINE_ADMISSION_LIMIT: usize = 8;

type VfsOpenFn = unsafe extern "C" fn(
    *mut ffi::sqlite3_vfs,
    *const std::os::raw::c_char,
    *mut ffi::sqlite3_file,
    std::os::raw::c_int,
    *mut std::os::raw::c_int,
) -> std::os::raw::c_int;
type VfsDeleteFn = unsafe extern "C" fn(
    *mut ffi::sqlite3_vfs,
    *const std::os::raw::c_char,
    std::os::raw::c_int,
) -> std::os::raw::c_int;
type VfsFullPathnameFn = unsafe extern "C" fn(
    *mut ffi::sqlite3_vfs,
    *const std::os::raw::c_char,
    std::os::raw::c_int,
    *mut std::os::raw::c_char,
) -> std::os::raw::c_int;
type VfsAccessFn = unsafe extern "C" fn(
    *mut ffi::sqlite3_vfs,
    *const std::os::raw::c_char,
    std::os::raw::c_int,
    *mut std::os::raw::c_int,
) -> std::os::raw::c_int;
type ResolveOwnNameFn = fn(u64, *const std::os::raw::c_char) -> bool;

#[derive(Clone, Copy, Debug)]
pub(crate) enum SqliteMode {
    ReadWrite,
    ReadOnly,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
struct BindingKey {
    identity: (u64, u64),
    parent_identity: (u64, u64),
    leaf: OsString,
}

#[cfg(test)]
type BindingTestHook = Box<dyn FnOnce() + Send>;
#[cfg(test)]
type RegistryTestHook = Box<dyn FnOnce() + Send>;

struct Binding {
    parent: File,
    leaf: OsString,
    identity: (u64, u64),
    refusal_count: AtomicU64,
    #[cfg(test)]
    opened_names: Mutex<Vec<OsString>>,
    #[cfg(all(test, unix))]
    before_openat: Mutex<Option<BindingTestHook>>,
    #[cfg(all(test, target_os = "linux"))]
    before_proc_reopen: Mutex<Option<BindingTestHook>>,
    #[cfg(all(test, unix))]
    leaf_fstat_error: Mutex<Option<std::os::raw::c_int>>,
    #[cfg(all(test, target_os = "linux"))]
    proc_reopen_error: Mutex<Option<std::os::raw::c_int>>,
    #[cfg(all(test, unix))]
    faccessat_error: Mutex<Option<std::os::raw::c_int>>,
    #[cfg(all(test, windows))]
    before_delete_disposition: Mutex<Option<BindingTestHook>>,
}

struct Registration {
    token: u64,
    key: BindingKey,
    binding: Binding,
    vfs_name: Option<CString>,
    vfs_pointer: usize,
}

impl Drop for Registration {
    fn drop(&mut self) {
        if self.vfs_pointer != 0 {
            let vfs = self.vfs_pointer as *mut ffi::sqlite3_vfs;
            let result = unsafe { ffi::sqlite3_vfs_unregister(vfs) };
            if result == ffi::SQLITE_OK {
                unsafe {
                    drop(Box::from_raw(vfs as *mut BoundVfs));
                }
            } else if let Some(name) = self.vfs_name.take() {
                // SQLite still has the VFS pointer, whose zName points into this CString.
                // Keep both allocations alive if unregister unexpectedly refuses removal.
                std::mem::forget(name);
            }
        }
        remove_registration_if_current(&self.key, self.token, self);
    }
}

#[derive(Default)]
struct Registry {
    by_token: HashMap<u64, Weak<Registration>>,
    by_key: HashMap<BindingKey, (u64, Weak<Registration>)>,
    creating: HashMap<BindingKey, u64>,
    #[cfg(all(unix, not(target_os = "linux")))]
    quarantined_descriptors: HashMap<(u64, u64), Vec<File>>,
    #[cfg(all(unix, not(target_os = "linux")))]
    unclassified_descriptors: Vec<File>,
    #[cfg(test)]
    creation_hooks: HashMap<BindingKey, RegistryTestHook>,
    #[cfg(test)]
    waiting_hooks: HashMap<BindingKey, RegistryTestHook>,
}

static REGISTRY: OnceLock<Mutex<Registry>> = OnceLock::new();
static REGISTRY_CHANGED: OnceLock<Condvar> = OnceLock::new();
static NEXT_TOKEN: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
pub(crate) struct BoundDatabase(Arc<Registration>);

impl std::fmt::Debug for BoundDatabase {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("BoundDatabase")
            .field("token", &self.0.token)
            .finish()
    }
}

impl BoundDatabase {
    pub(crate) fn acquire(target: &DatabaseFileTarget) -> Result<Self, Error> {
        ensure_hooks_installed()?;
        let identity = target.identity();
        let parent_identity = opened_file_identity(target.parent())?;
        let leaf = target.leaf().to_os_string();
        leaf.to_str()
            .ok_or_else(|| Error::InvalidInput("Path is not valid UTF-8".into()))?;
        let key = BindingKey {
            identity,
            parent_identity,
            leaf: binding_key_leaf(&leaf),
        };
        let registry_mutex = REGISTRY.get_or_init(|| Mutex::new(Registry::default()));
        let changed = REGISTRY_CHANGED.get_or_init(Condvar::new);
        let token = loop {
            let mut registry = registry_mutex
                .lock()
                .map_err(|_| Error::Conflict("bound SQLite registry was poisoned".into()))?;
            registry
                .by_key
                .retain(|_, (_, weak)| weak.strong_count() != 0);
            registry.by_token.retain(|_, weak| weak.strong_count() != 0);
            if let Some((_, weak)) = registry.by_key.get(&key) {
                if let Some(registration) = weak.upgrade() {
                    return Ok(Self(registration));
                }
            }
            if registry.by_key.iter().any(|(existing, (_, weak))| {
                existing.identity == identity
                    && existing.parent_identity != parent_identity
                    && weak.strong_count() != 0
            }) || registry.creating.keys().any(|existing| {
                existing.identity == identity && existing.parent_identity != parent_identity
            }) {
                return Err(Error::Conflict(
                    "database is open through another directory".into(),
                ));
            }
            if registry.creating.contains_key(&key) {
                #[cfg(test)]
                if let Some(hook) = registry.waiting_hooks.remove(&key) {
                    hook();
                }
                drop(
                    changed.wait(registry).map_err(|_| {
                        Error::Conflict("bound SQLite registry was poisoned".into())
                    })?,
                );
                continue;
            }
            let token = NEXT_TOKEN
                .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |next| {
                    next.checked_add(1)
                })
                .map_err(|_| Error::ResourceLimit("bound SQLite token space exhausted".into()))?;
            registry.creating.insert(key.clone(), token);
            break token;
        };

        #[cfg(test)]
        invoke_registry_creation_hook(&key);
        let registration = (|| {
            let parent = target.parent().try_clone()?;
            let binding = Binding {
                parent,
                leaf,
                identity,
                refusal_count: AtomicU64::new(0),
                #[cfg(test)]
                opened_names: Mutex::new(Vec::new()),
                #[cfg(all(test, unix))]
                before_openat: Mutex::new(None),
                #[cfg(all(test, target_os = "linux"))]
                before_proc_reopen: Mutex::new(None),
                #[cfg(all(test, unix))]
                leaf_fstat_error: Mutex::new(None),
                #[cfg(all(test, target_os = "linux"))]
                proc_reopen_error: Mutex::new(None),
                #[cfg(all(test, unix))]
                faccessat_error: Mutex::new(None),
                #[cfg(all(test, windows))]
                before_delete_disposition: Mutex::new(None),
            };
            create_registration(token, key.clone(), binding)
        })();
        let registration = match registration {
            Ok(registration) => registration,
            Err(error) => {
                remove_reservation(&key, token);
                return Err(error);
            }
        };
        let mut registry = match registry_mutex.lock() {
            Ok(registry) => registry,
            Err(_) => {
                drop(registration);
                remove_reservation(&key, token);
                return Err(Error::Conflict("bound SQLite registry was poisoned".into()));
            }
        };
        if registry.creating.get(&key) != Some(&token) {
            drop(registry);
            drop(registration);
            return Err(Error::Conflict(
                "bound SQLite registry reservation was lost".into(),
            ));
        }
        registry.creating.remove(&key);
        registry
            .by_token
            .insert(token, Arc::downgrade(&registration));
        registry
            .by_key
            .insert(key, (token, Arc::downgrade(&registration)));
        changed.notify_all();
        Ok(Self(registration))
    }

    pub(crate) fn uri(&self, mode: SqliteMode) -> Result<String, Error> {
        let leaf = self
            .0
            .binding
            .leaf
            .to_str()
            .ok_or_else(|| Error::InvalidInput("Path is not valid UTF-8".into()))?;
        let vfs_name = self
            .0
            .vfs_name
            .as_ref()
            .ok_or_else(|| Error::Conflict("bound SQLite VFS name is unavailable".into()))?;
        let encoded_leaf = percent_encode_leaf(leaf);
        let mode = match mode {
            SqliteMode::ReadWrite => "rw",
            SqliteMode::ReadOnly => "ro",
        };
        Ok(format!(
            "{RESERVED_URI_PREFIX}{}/{encoded_leaf}?mode={mode}&vfs={}",
            self.0.token,
            vfs_name.to_string_lossy()
        ))
    }

    pub(crate) fn refusal_count(&self) -> u64 {
        self.0.binding.refusal_count.load(Ordering::SeqCst)
    }

    #[cfg(test)]
    pub(super) fn token(&self) -> u64 {
        self.0.token
    }

    #[cfg(test)]
    pub(super) fn vfs_pointer(&self) -> *mut ffi::sqlite3_vfs {
        self.0.vfs_pointer as *mut ffi::sqlite3_vfs
    }

    #[cfg(test)]
    pub(super) fn opened_names(&self) -> Vec<OsString> {
        self.0
            .binding
            .opened_names
            .lock()
            .map(|opened| opened.clone())
            .unwrap_or_default()
    }

    #[cfg(all(test, unix))]
    pub(super) fn set_before_openat_hook(
        &self,
        callback: impl FnOnce() + Send + 'static,
    ) -> Result<(), Error> {
        set_binding_test_hook(&self.0.binding.before_openat, "open", callback)
    }

    #[cfg(all(test, unix, not(target_os = "linux")))]
    pub(super) fn has_pending_before_openat_hook(&self) -> bool {
        self.0
            .binding
            .before_openat
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .is_some()
    }

    #[cfg(all(test, unix))]
    pub(super) fn fail_next_leaf_fstat_with(
        &self,
        error: std::os::raw::c_int,
    ) -> Result<(), Error> {
        let mut slot = self
            .0
            .binding
            .leaf_fstat_error
            .lock()
            .map_err(|_| Error::Conflict("bound SQLite fstat test hook was poisoned".into()))?;
        if slot.is_some() {
            return Err(Error::Conflict(
                "bound SQLite fstat test hook is already set".into(),
            ));
        }
        *slot = Some(error);
        Ok(())
    }

    #[cfg(all(test, target_os = "linux"))]
    pub(super) fn set_before_proc_reopen_hook(
        &self,
        callback: impl FnOnce() + Send + 'static,
    ) -> Result<(), Error> {
        set_binding_test_hook(&self.0.binding.before_proc_reopen, "proc reopen", callback)
    }

    #[cfg(all(test, target_os = "linux"))]
    pub(super) fn fail_next_proc_reopen_with(
        &self,
        error: std::os::raw::c_int,
    ) -> Result<(), Error> {
        let mut slot = self.0.binding.proc_reopen_error.lock().map_err(|_| {
            Error::Conflict("bound SQLite proc reopen test hook was poisoned".into())
        })?;
        if slot.is_some() {
            return Err(Error::Conflict(
                "bound SQLite proc reopen test hook is already set".into(),
            ));
        }
        *slot = Some(error);
        Ok(())
    }

    #[cfg(all(test, unix))]
    pub(super) fn fail_next_faccessat_with(&self, error: std::os::raw::c_int) -> Result<(), Error> {
        let mut slot =
            self.0.binding.faccessat_error.lock().map_err(|_| {
                Error::Conflict("bound SQLite access test hook was poisoned".into())
            })?;
        if slot.is_some() {
            return Err(Error::Conflict(
                "bound SQLite access test hook is already set".into(),
            ));
        }
        *slot = Some(error);
        Ok(())
    }

    #[cfg(all(test, windows))]
    pub(super) fn set_before_delete_disposition_hook(
        &self,
        callback: impl FnOnce() + Send + 'static,
    ) -> Result<(), Error> {
        set_binding_test_hook(
            &self.0.binding.before_delete_disposition,
            "delete",
            callback,
        )
    }
}

#[cfg(test)]
fn invoke_registry_creation_hook(key: &BindingKey) {
    let hook = REGISTRY
        .get()
        .and_then(|registry| registry.lock().ok())
        .and_then(|mut registry| registry.creation_hooks.remove(key));
    if let Some(hook) = hook {
        hook();
    }
}

/// Installs a one-shot test hook into a binding's hook slot; refuses to replace a pending one.
#[cfg(test)]
fn set_binding_test_hook(
    slot: &Mutex<Option<BindingTestHook>>,
    operation: &str,
    callback: impl FnOnce() + Send + 'static,
) -> Result<(), Error> {
    let mut hook = slot
        .lock()
        .map_err(|_| Error::Conflict(format!("bound SQLite {operation} test hook was poisoned")))?;
    if hook.is_some() {
        return Err(Error::Conflict(format!(
            "bound SQLite {operation} test hook is already set"
        )));
    }
    *hook = Some(Box::new(callback));
    Ok(())
}

#[cfg(test)]
fn invoke_binding_test_hook(hook: &Mutex<Option<BindingTestHook>>) {
    let callback = hook.lock().ok().and_then(|mut hook| hook.take());
    if let Some(callback) = callback {
        callback();
    }
}

/// For Windows bindings, approximates the case-insensitive name match with the system up-case
/// table (`RtlUpcaseUnicodeChar`, one UTF-16 unit at a time, no length-changing mappings), so
/// case variants of one path share one binding. The locale-based `LCMapStringEx` left `ς`
/// unmapped while NTFS folds it onto `Σ` (CI run 36590198609). A volume whose own up-case table
/// disagrees only splits one database across two registrations: each carries its own token in
/// every SQLite filename, and Windows byte-range locks are per handle, so the two coordinate
/// exactly like two processes. Distinct files never share a key, because it includes the leaf
/// identity.
fn binding_key_leaf(leaf: &OsStr) -> OsString {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::{OsStrExt, OsStringExt};
        use windows_sys::Wdk::System::SystemServices::RtlUpcaseUnicodeChar;

        let normalized: Vec<u16> = leaf
            .encode_wide()
            .map(|unit| unsafe { RtlUpcaseUnicodeChar(unit) })
            .collect();
        OsString::from_wide(&normalized)
    }
    #[cfg(not(windows))]
    {
        leaf.to_os_string()
    }
}

fn percent_encode_leaf(leaf: &str) -> String {
    let mut encoded = String::with_capacity(leaf.len());
    for byte in leaf.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(char::from(byte));
        } else {
            encoded.push('%');
            encoded.push_str(&format!("{byte:02X}"));
        }
    }
    encoded
}

fn sqlite_access_exists(is_regular_file: bool, length: i128) -> bool {
    !is_regular_file || length > 0
}

fn remove_key_if_token(registry: &mut Registry, key: &BindingKey, token: u64) -> bool {
    if registry
        .by_key
        .get(key)
        .is_some_and(|(current_token, _)| *current_token == token)
    {
        registry.by_key.remove(key);
        true
    } else {
        false
    }
}

fn remove_reservation(key: &BindingKey, token: u64) {
    let Some(registry_mutex) = REGISTRY.get() else {
        return;
    };
    let mut registry = match registry_mutex.lock() {
        Ok(registry) => registry,
        Err(poisoned) => poisoned.into_inner(),
    };
    if registry.creating.get(key) == Some(&token) {
        registry.creating.remove(key);
    }
    if let Some(changed) = REGISTRY_CHANGED.get() {
        changed.notify_all();
    }
}

fn remove_registration_if_current(key: &BindingKey, token: u64, registration: &Registration) {
    let Some(registry_mutex) = REGISTRY.get() else {
        return;
    };
    let mut registry = match registry_mutex.lock() {
        Ok(registry) => registry,
        Err(poisoned) => poisoned.into_inner(),
    };
    if registry
        .by_token
        .get(&token)
        .is_some_and(|weak| std::ptr::eq(weak.as_ptr(), registration))
    {
        registry.by_token.remove(&token);
    }
    remove_key_if_token(&mut registry, key, token);

    #[cfg(all(unix, not(target_os = "linux")))]
    {
        let identity = registration.binding.identity;
        let identity_is_live = identity_has_live_registration(&registry, identity);
        if !identity_is_live {
            // Drain while holding the registry lock so a new binding cannot acquire this inode
            // between the last-registration check and closing the quarantined descriptors.
            drop(registry.quarantined_descriptors.remove(&identity));
        }
        if !registry
            .by_key
            .values()
            .any(|(_, weak)| weak.strong_count() != 0)
        {
            drop(std::mem::take(&mut registry.unclassified_descriptors));
        }
    }
}

/// Checks liveness without upgrading a `Weak` under the registry lock: a temporary `Arc` dropped
/// here could be the last one, and `Registration::drop` locks the registry again.
#[cfg(all(unix, not(target_os = "linux")))]
fn identity_has_live_registration(registry: &Registry, identity: (u64, u64)) -> bool {
    registry
        .by_key
        .iter()
        .any(|(key, (_, weak))| key.identity == identity && weak.strong_count() != 0)
}

#[cfg(unix)]
fn leaf_identity_matches(registration: &Registration, stat: &libc::stat) -> bool {
    raw_libc_stat_identity(stat) == registration.binding.identity
}

#[cfg(all(unix, not(target_os = "linux")))]
fn retain_mismatched_descriptor(fd: libc::c_int, identity: (u64, u64)) {
    use std::os::fd::FromRawFd;

    // Keep a lockable descriptor from a leaf-swap race until its inode has no live binding.
    let file = unsafe { File::from_raw_fd(fd) };
    let Some(registry_mutex) = REGISTRY.get() else {
        drop(file);
        return;
    };
    let mut registry = match registry_mutex.lock() {
        Ok(registry) => registry,
        Err(poisoned) => poisoned.into_inner(),
    };
    let identity_is_live = identity_has_live_registration(&registry, identity);
    if identity_is_live {
        registry
            .quarantined_descriptors
            .entry(identity)
            .or_default()
            .push(file);
    } else {
        drop(file);
    }
}

#[cfg(all(unix, not(target_os = "linux")))]
fn retain_unclassified_descriptor(fd: libc::c_int) {
    use std::os::fd::FromRawFd;

    let file = unsafe { File::from_raw_fd(fd) };
    let Some(registry_mutex) = REGISTRY.get() else {
        drop(file);
        return;
    };
    let mut registry = match registry_mutex.lock() {
        Ok(registry) => registry,
        Err(poisoned) => poisoned.into_inner(),
    };
    registry.unclassified_descriptors.push(file);
}

#[cfg(all(unix, not(target_os = "linux")))]
fn leaf_open_is_admitted() -> bool {
    let Some(registry_mutex) = REGISTRY.get() else {
        return true;
    };
    let registry = match registry_mutex.lock() {
        Ok(registry) => registry,
        Err(poisoned) => poisoned.into_inner(),
    };
    !registry
        .quarantined_descriptors
        .values()
        .any(|descriptors| descriptors.len() >= QUARANTINE_ADMISSION_LIMIT)
        && registry.unclassified_descriptors.len() < QUARANTINE_ADMISSION_LIMIT
}

#[cfg(all(test, unix, not(target_os = "linux")))]
pub(super) fn quarantined_descriptor_fds(identity: (u64, u64)) -> Vec<std::os::fd::RawFd> {
    use std::os::fd::AsRawFd;

    REGISTRY
        .get()
        .and_then(|registry| registry.lock().ok())
        .and_then(|registry| {
            registry
                .quarantined_descriptors
                .get(&identity)
                .map(|files| files.iter().map(AsRawFd::as_raw_fd).collect())
        })
        .unwrap_or_default()
}

#[cfg(all(test, unix, not(target_os = "linux")))]
pub(super) fn unclassified_descriptor_fds() -> Vec<std::os::fd::RawFd> {
    use std::os::fd::AsRawFd;

    REGISTRY
        .get()
        .and_then(|registry| registry.lock().ok())
        .map(|registry| {
            registry
                .unclassified_descriptors
                .iter()
                .map(AsRawFd::as_raw_fd)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(all(test, unix, not(target_os = "linux")))]
pub(super) const fn quarantine_admission_limit() -> usize {
    QUARANTINE_ADMISSION_LIMIT
}

#[cfg(all(test, unix, not(target_os = "linux")))]
pub(super) fn retain_mismatched_descriptor_for_test(fd: libc::c_int, identity: (u64, u64)) {
    retain_mismatched_descriptor(fd, identity);
}

#[cfg(all(test, unix, not(target_os = "linux")))]
pub(super) fn retain_unclassified_descriptor_for_test(fd: libc::c_int) {
    retain_unclassified_descriptor(fd);
}

#[cfg(all(test, unix, not(target_os = "linux")))]
pub(super) fn open_bound_leaf_for_test(bound: &BoundDatabase) -> Result<libc::c_int, libc::c_int> {
    let leaf = bound.0.binding.leaf.to_string_lossy();
    let path = CString::new(format!("{RESERVED_PREFIX}{}/{leaf}", bound.0.token))
        .map_err(|_| libc::EINVAL)?;
    let fd = unsafe { unix_hooks::open_hook_inner(path.as_ptr(), libc::O_RDONLY, 0) };
    if fd < 0 {
        Err(unix_hooks::last_errno())
    } else {
        Ok(fd)
    }
}

fn increment_refusal(binding: &Binding) {
    let _ = binding
        .refusal_count
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |count| {
            Some(count.saturating_add(1))
        });
}

#[derive(Clone, Copy)]
enum InstallState {
    Installed,
    Failed(&'static str),
}

static INSTALL_STATE: OnceLock<InstallState> = OnceLock::new();

// `ctor` emits a `cfg(used_linker)` inside its expansion, which is outside this crate's cfg list.
#[allow(unexpected_cfgs)]
mod load_time_constructor {
    use super::{install_hooks, InstallState, INSTALL_STATE};

    #[ctor::ctor]
    fn install_hooks_at_load() {
        let state = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(install_hooks)) {
            Ok(Ok(())) => InstallState::Installed,
            Ok(Err(_)) | Err(_) => {
                InstallState::Failed("bound SQLite hooks could not be installed")
            }
        };
        let _ = INSTALL_STATE.set(state);
    }
}

fn ensure_hooks_installed() -> Result<(), Error> {
    match INSTALL_STATE.get() {
        Some(InstallState::Installed) => Ok(()),
        Some(InstallState::Failed(message)) => Err(Error::Conflict((*message).into())),
        None => Err(Error::Conflict(
            "bound SQLite load-time initialization did not run".into(),
        )),
    }
}

#[repr(C)]
struct BoundVfs {
    base: ffi::sqlite3_vfs,
    token: u64,
    resolve_own_name: ResolveOwnNameFn,
    default_open: Option<VfsOpenFn>,
    default_delete: Option<VfsDeleteFn>,
    default_full_pathname: Option<VfsFullPathnameFn>,
}

fn create_registration(
    token: u64,
    key: BindingKey,
    binding: Binding,
) -> Result<Arc<Registration>, Error> {
    ensure_hooks_installed()?;
    let name = CString::new(format!("chessfable-bound-{token}"))
        .map_err(|_| Error::Conflict("bound SQLite VFS name was invalid".into()))?;
    #[cfg(unix)]
    let vfs_pointer = unsafe {
        register_bound_vfs(
            token,
            &name,
            c"unix",
            unix_hooks::is_own_child,
            unix_vfs::vfs_access,
        )
    }?;
    #[cfg(windows)]
    let vfs_pointer = unsafe {
        register_bound_vfs(
            token,
            &name,
            c"win32",
            windows_hooks::is_own_child,
            windows_vfs::vfs_access,
        )
    }?;
    Ok(Arc::new(Registration {
        token,
        key,
        binding,
        vfs_name: Some(name),
        vfs_pointer: vfs_pointer as usize,
    }))
}

unsafe fn register_bound_vfs(
    token: u64,
    name: &CString,
    default_name: &std::ffi::CStr,
    resolve_own_name: ResolveOwnNameFn,
    access: VfsAccessFn,
) -> Result<*mut ffi::sqlite3_vfs, Error> {
    let original = unsafe { ffi::sqlite3_vfs_find(default_name.as_ptr()) };
    if original.is_null() {
        return Err(Error::Conflict("SQLite platform VFS is unavailable".into()));
    }
    let default = unsafe { *original };
    let mut base = default;
    base.pNext = std::ptr::null_mut();
    base.zName = name.as_ptr();
    base.xOpen = Some(bound_vfs_open);
    base.xDelete = Some(bound_vfs_delete);
    base.xAccess = Some(access);
    base.xFullPathname = Some(bound_vfs_full_pathname);
    let vfs = Box::new(BoundVfs {
        base,
        token,
        resolve_own_name,
        default_open: default.xOpen,
        default_delete: default.xDelete,
        default_full_pathname: default.xFullPathname,
    });
    let pointer = Box::into_raw(vfs);
    let rc = unsafe { ffi::sqlite3_vfs_register(pointer.cast(), 0) };
    if rc != ffi::SQLITE_OK {
        unsafe { drop(Box::from_raw(pointer)) };
        return Err(Error::Conflict(format!(
            "SQLite bound VFS registration failed with code {rc}"
        )));
    }
    Ok(pointer.cast())
}

unsafe extern "C" fn bound_vfs_open(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const std::os::raw::c_char,
    file: *mut ffi::sqlite3_file,
    flags: std::os::raw::c_int,
    out_flags: *mut std::os::raw::c_int,
) -> std::os::raw::c_int {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
        bound_vfs_open_inner(vfs, name, file, flags, out_flags)
    })) {
        Ok(result) => result,
        Err(_) => ffi::SQLITE_CANTOPEN,
    }
}

unsafe fn bound_vfs_open_inner(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const std::os::raw::c_char,
    file: *mut ffi::sqlite3_file,
    flags: std::os::raw::c_int,
    out_flags: *mut std::os::raw::c_int,
) -> std::os::raw::c_int {
    if flags & ffi::SQLITE_OPEN_SUPER_JOURNAL != 0 {
        return ffi::SQLITE_CANTOPEN;
    }
    let Some(bound_vfs) = (unsafe { vfs.cast::<BoundVfs>().as_ref() }) else {
        return ffi::SQLITE_CANTOPEN;
    };
    if !name.is_null() && !(bound_vfs.resolve_own_name)(bound_vfs.token, name) {
        return ffi::SQLITE_CANTOPEN;
    }
    let Some(open) = bound_vfs.default_open else {
        return ffi::SQLITE_CANTOPEN;
    };
    unsafe { open(vfs, name, file, flags, out_flags) }
}

unsafe extern "C" fn bound_vfs_delete(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const std::os::raw::c_char,
    sync_dir: std::os::raw::c_int,
) -> std::os::raw::c_int {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
        bound_vfs_delete_inner(vfs, name, sync_dir)
    })) {
        Ok(result) => result,
        Err(_) => ffi::SQLITE_IOERR_DELETE,
    }
}

unsafe fn bound_vfs_delete_inner(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const std::os::raw::c_char,
    sync_dir: std::os::raw::c_int,
) -> std::os::raw::c_int {
    let Some(bound_vfs) = (unsafe { vfs.cast::<BoundVfs>().as_ref() }) else {
        return ffi::SQLITE_IOERR_DELETE;
    };
    if !(bound_vfs.resolve_own_name)(bound_vfs.token, name) {
        return ffi::SQLITE_IOERR_DELETE;
    }
    let Some(delete) = bound_vfs.default_delete else {
        return ffi::SQLITE_IOERR_DELETE;
    };
    unsafe { delete(vfs, name, sync_dir) }
}

unsafe extern "C" fn bound_vfs_full_pathname(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const std::os::raw::c_char,
    output_size: std::os::raw::c_int,
    output: *mut std::os::raw::c_char,
) -> std::os::raw::c_int {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
        bound_vfs_full_pathname_inner(vfs, name, output_size, output)
    })) {
        Ok(result) => result,
        Err(_) => ffi::SQLITE_CANTOPEN,
    }
}

unsafe fn bound_vfs_full_pathname_inner(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const std::os::raw::c_char,
    output_size: std::os::raw::c_int,
    output: *mut std::os::raw::c_char,
) -> std::os::raw::c_int {
    if name.is_null() || output.is_null() || output_size <= 0 {
        return ffi::SQLITE_CANTOPEN;
    }
    let bytes = unsafe { std::ffi::CStr::from_ptr(name) }.to_bytes();
    if bytes.starts_with(RESERVED_PREFIX.as_bytes()) {
        if bytes.len() + 1 > output_size as usize {
            return ffi::SQLITE_CANTOPEN;
        }
        unsafe { std::ptr::copy_nonoverlapping(name, output, bytes.len() + 1) };
        return ffi::SQLITE_OK;
    }
    let Some(bound_vfs) = (unsafe { vfs.cast::<BoundVfs>().as_ref() }) else {
        return ffi::SQLITE_CANTOPEN;
    };
    match bound_vfs.default_full_pathname {
        Some(full_pathname) => unsafe { full_pathname(vfs, name, output_size, output) },
        None => ffi::SQLITE_CANTOPEN,
    }
}

#[cfg(unix)]
mod unix_hooks {
    use super::*;
    use std::{
        ffi::{c_char, c_int, CStr},
        os::{fd::AsRawFd, unix::ffi::OsStrExt},
        panic::{catch_unwind, AssertUnwindSafe},
    };

    type OpenFn = unsafe extern "C" fn(*const c_char, c_int, c_int) -> c_int;
    type StatFn = unsafe extern "C" fn(*const c_char, *mut libc::stat) -> c_int;
    type AccessFn = unsafe extern "C" fn(*const c_char, c_int) -> c_int;
    type UnlinkFn = unsafe extern "C" fn(*const c_char) -> c_int;

    #[derive(Clone, Copy)]
    struct Originals {
        open: OpenFn,
        stat: StatFn,
        access: AccessFn,
        unlink: UnlinkFn,
    }

    static ORIGINALS: OnceLock<Originals> = OnceLock::new();

    pub(super) enum Resolution {
        Unbound,
        Refused(c_int),
        Directory(Arc<Registration>),
        Child {
            registration: Arc<Registration>,
            name: CString,
            is_leaf: bool,
        },
    }

    fn set_errno(value: c_int) {
        // The errno crate owns the per-platform errno location, so no target-specific region
        // is needed here.
        errno::set_errno(errno::Errno(value));
    }

    fn syscall_failure(error: c_int) -> c_int {
        set_errno(error);
        -1
    }

    pub(super) unsafe fn binding_faccessat(
        registration: &Registration,
        directory: c_int,
        path: *const c_char,
        mode: c_int,
        flags: c_int,
    ) -> c_int {
        #[cfg(test)]
        {
            let error = registration
                .binding
                .faccessat_error
                .lock()
                .ok()
                .and_then(|mut error| error.take());
            if let Some(error) = error {
                set_errno(error);
                return -1;
            }
        }
        #[cfg(not(test))]
        let _ = registration;
        unsafe { libc::faccessat(directory, path, mode, flags) }
    }

    pub(super) fn last_errno() -> c_int {
        match std::io::Error::last_os_error().raw_os_error() {
            Some(error) => error,
            None => libc::EIO,
        }
    }

    fn lookup_registration(token: u64) -> Result<Arc<Registration>, c_int> {
        let mutex = REGISTRY.get().ok_or(libc::ENOENT)?;
        let registry = mutex.lock().map_err(|_| libc::EIO)?;
        registry
            .by_token
            .get(&token)
            .and_then(Weak::upgrade)
            .ok_or(libc::ENOENT)
    }

    pub(super) fn resolve(path: *const c_char) -> Resolution {
        if path.is_null() {
            return Resolution::Refused(libc::EINVAL);
        }
        let bytes = unsafe { CStr::from_ptr(path) }.to_bytes();
        let prefix = RESERVED_PREFIX.as_bytes();
        let Some(rest) = bytes.strip_prefix(prefix) else {
            return Resolution::Unbound;
        };
        let Some(slash) = rest.iter().position(|byte| *byte == b'/') else {
            return match parse_token(rest).and_then(lookup_registration) {
                Ok(registration) => Resolution::Directory(registration),
                Err(error) => Resolution::Refused(error),
            };
        };
        let token_bytes = &rest[..slash];
        let name_bytes = &rest[slash + 1..];
        let token = match parse_token(token_bytes) {
            Ok(token) => token,
            Err(error) => return Resolution::Refused(error),
        };
        let registration = match lookup_registration(token) {
            Ok(registration) => registration,
            Err(error) => return Resolution::Refused(error),
        };
        if !valid_child_name(name_bytes, &registration.binding.leaf) {
            return Resolution::Refused(libc::ENOENT);
        }
        let name = match CString::new(name_bytes) {
            Ok(name) => name,
            Err(_) => return Resolution::Refused(libc::ENOENT),
        };
        let is_leaf = name_bytes == registration.binding.leaf.as_encoded_bytes();
        Resolution::Child {
            registration,
            name,
            is_leaf,
        }
    }

    fn parse_token(bytes: &[u8]) -> Result<u64, c_int> {
        if bytes.is_empty() || !bytes.iter().all(u8::is_ascii_digit) {
            return Err(libc::ENOENT);
        }
        let text = std::str::from_utf8(bytes).map_err(|_| libc::ENOENT)?;
        text.parse::<u64>().map_err(|_| libc::ENOENT)
    }

    fn valid_child_name(name: &[u8], leaf: &OsStr) -> bool {
        if name.is_empty() || name.contains(&b'/') || name == b"." || name == b".." {
            return false;
        }
        let leaf = leaf.as_encoded_bytes();
        if name == leaf {
            return true;
        }
        [b"-wal".as_slice(), b"-shm", b"-journal"]
            .iter()
            .any(|suffix| name == [leaf, suffix].concat())
    }

    fn set_opened_name(registration: &Registration, name: &OsStr) {
        #[cfg(test)]
        {
            let mut opened = registration
                .binding
                .opened_names
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            opened.push(name.to_os_string());
        }
        #[cfg(not(test))]
        let _ = (registration, name);
    }

    unsafe fn fstat_leaf_descriptor(
        registration: &Registration,
        fd: c_int,
        output: *mut libc::stat,
    ) -> c_int {
        #[cfg(test)]
        {
            let error = registration
                .binding
                .leaf_fstat_error
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .take();
            if let Some(error) = error {
                set_errno(error);
                return -1;
            }
        }
        #[cfg(not(test))]
        let _ = registration;
        unsafe { libc::fstat(fd, output) }
    }

    #[cfg(target_os = "linux")]
    unsafe fn open_linux_leaf(
        registration: &Registration,
        name: &CString,
        flags: c_int,
        mode: c_int,
    ) -> c_int {
        use std::os::fd::FromRawFd;

        #[cfg(test)]
        invoke_binding_test_hook(&registration.binding.before_openat);

        let path_fd = unsafe {
            libc::openat(
                registration.binding.parent.as_raw_fd(),
                name.as_ptr(),
                libc::O_PATH | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                0,
            )
        };
        if path_fd < 0 {
            return path_fd;
        }
        let path_file = unsafe { File::from_raw_fd(path_fd) };
        let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
        if unsafe { fstat_leaf_descriptor(registration, path_fd, stat.as_mut_ptr()) } != 0 {
            let error = last_errno();
            drop(path_file);
            return syscall_failure(error);
        }
        let stat = unsafe { stat.assume_init() };
        if !leaf_identity_matches(registration, &stat) {
            increment_refusal(&registration.binding);
            drop(path_file);
            return syscall_failure(libc::ESTALE);
        }

        set_opened_name(registration, OsStr::from_bytes(name.as_bytes()));
        #[cfg(test)]
        invoke_binding_test_hook(&registration.binding.before_proc_reopen);

        let proc_path = match CString::new(format!("/proc/self/fd/{path_fd}")) {
            Ok(path) => path,
            Err(_) => {
                drop(path_file);
                return syscall_failure(libc::EINVAL);
            }
        };
        #[cfg(test)]
        let reopen_error = registration
            .binding
            .proc_reopen_error
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take();
        #[cfg(not(test))]
        let reopen_error: Option<c_int> = None;
        let reopened_fd = match reopen_error {
            Some(error) => {
                set_errno(error);
                -1
            }
            None => unsafe {
                libc::open(
                    proc_path.as_ptr(),
                    flags & !libc::O_NOFOLLOW,
                    mode as libc::c_uint,
                )
            },
        };
        let error = (reopened_fd < 0).then(last_errno);
        drop(path_file);
        match error {
            Some(error) => syscall_failure(error),
            None => reopened_fd,
        }
    }

    pub(super) fn is_own_child(token: u64, path: *const c_char) -> bool {
        matches!(
            resolve(path),
            Resolution::Child { registration, .. } if registration.token == token
        )
    }

    fn set_errno_after_panic() -> c_int {
        syscall_failure(libc::EIO)
    }

    pub(super) unsafe extern "C" fn open_hook(
        path: *const c_char,
        flags: c_int,
        mode: c_int,
    ) -> c_int {
        match catch_unwind(AssertUnwindSafe(|| unsafe {
            open_hook_inner(path, flags, mode)
        })) {
            Ok(result) => result,
            Err(_) => set_errno_after_panic(),
        }
    }

    pub(super) unsafe fn open_hook_inner(path: *const c_char, flags: c_int, mode: c_int) -> c_int {
        match resolve(path) {
            Resolution::Unbound => match ORIGINALS.get() {
                Some(originals) => unsafe { (originals.open)(path, flags, mode) },
                None => syscall_failure(libc::ENOSYS),
            },
            Resolution::Refused(error) => syscall_failure(error),
            Resolution::Directory(registration) => unsafe {
                libc::openat(
                    registration.binding.parent.as_raw_fd(),
                    c".".as_ptr(),
                    flags | libc::O_DIRECTORY | libc::O_NOFOLLOW,
                    mode as libc::c_uint,
                )
            },
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => {
                if is_leaf {
                    #[cfg(target_os = "linux")]
                    return unsafe { open_linux_leaf(&registration, &name, flags, mode) };

                    #[cfg(all(unix, not(target_os = "linux")))]
                    {
                        if !leaf_open_is_admitted() {
                            return syscall_failure(libc::EMFILE);
                        }

                        // Non-Linux Unix must check before opening because a mismatched lockable
                        // descriptor can only be retained safely after the race has occurred.
                        let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
                        let result = unsafe {
                            libc::fstatat(
                                registration.binding.parent.as_raw_fd(),
                                name.as_ptr(),
                                stat.as_mut_ptr(),
                                libc::AT_SYMLINK_NOFOLLOW,
                            )
                        };
                        if result == 0
                            && !leaf_identity_matches(&registration, unsafe { &stat.assume_init() })
                        {
                            increment_refusal(&registration.binding);
                            return syscall_failure(libc::ESTALE);
                        }
                    }
                }
                #[cfg(all(test, unix, not(target_os = "linux")))]
                if is_leaf {
                    invoke_binding_test_hook(&registration.binding.before_openat);
                }
                let fd = unsafe {
                    libc::openat(
                        registration.binding.parent.as_raw_fd(),
                        name.as_ptr(),
                        flags | libc::O_NOFOLLOW,
                        mode as libc::c_uint,
                    )
                };
                if fd < 0 {
                    return fd;
                }
                #[cfg(all(unix, not(target_os = "linux")))]
                if is_leaf {
                    let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
                    if unsafe { fstat_leaf_descriptor(&registration, fd, stat.as_mut_ptr()) } != 0 {
                        let error = last_errno();
                        retain_unclassified_descriptor(fd);
                        return syscall_failure(error);
                    }
                    let stat = unsafe { stat.assume_init() };
                    if !leaf_identity_matches(&registration, &stat) {
                        increment_refusal(&registration.binding);
                        retain_mismatched_descriptor(fd, raw_libc_stat_identity(&stat));
                        return syscall_failure(libc::ESTALE);
                    }
                }
                set_opened_name(&registration, OsStr::from_bytes(name.as_bytes()));
                fd
            }
        }
    }

    pub(super) unsafe extern "C" fn stat_hook(
        path: *const c_char,
        output: *mut libc::stat,
    ) -> c_int {
        match catch_unwind(AssertUnwindSafe(|| unsafe {
            stat_hook_inner(path, output)
        })) {
            Ok(result) => result,
            Err(_) => set_errno_after_panic(),
        }
    }

    unsafe fn stat_hook_inner(path: *const c_char, output: *mut libc::stat) -> c_int {
        if output.is_null() {
            return syscall_failure(libc::EINVAL);
        }
        match resolve(path) {
            Resolution::Unbound => match ORIGINALS.get() {
                Some(originals) => unsafe { (originals.stat)(path, output) },
                None => syscall_failure(libc::ENOSYS),
            },
            Resolution::Refused(error) => syscall_failure(error),
            Resolution::Directory(registration) => unsafe {
                libc::fstat(registration.binding.parent.as_raw_fd(), output)
            },
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => {
                let result = unsafe {
                    libc::fstatat(
                        registration.binding.parent.as_raw_fd(),
                        name.as_ptr(),
                        output,
                        libc::AT_SYMLINK_NOFOLLOW,
                    )
                };
                if result != 0 {
                    return result;
                }
                if is_leaf && !leaf_identity_matches(&registration, unsafe { &*output }) {
                    increment_refusal(&registration.binding);
                    return syscall_failure(libc::ESTALE);
                }
                result
            }
        }
    }

    pub(super) unsafe extern "C" fn access_hook(path: *const c_char, mode: c_int) -> c_int {
        match catch_unwind(AssertUnwindSafe(|| unsafe {
            access_hook_inner(path, mode)
        })) {
            Ok(result) => result,
            Err(_) => set_errno_after_panic(),
        }
    }

    unsafe fn access_hook_inner(path: *const c_char, mode: c_int) -> c_int {
        match resolve(path) {
            Resolution::Unbound => match ORIGINALS.get() {
                Some(originals) => unsafe { (originals.access)(path, mode) },
                None => syscall_failure(libc::ENOSYS),
            },
            Resolution::Refused(error) => syscall_failure(error),
            Resolution::Directory(registration) => unsafe {
                binding_faccessat(
                    &registration,
                    registration.binding.parent.as_raw_fd(),
                    c".".as_ptr(),
                    mode,
                    libc::AT_SYMLINK_NOFOLLOW,
                )
            },
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => {
                if is_leaf {
                    let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
                    let result = unsafe {
                        libc::fstatat(
                            registration.binding.parent.as_raw_fd(),
                            name.as_ptr(),
                            stat.as_mut_ptr(),
                            libc::AT_SYMLINK_NOFOLLOW,
                        )
                    };
                    if result != 0 {
                        return result;
                    }
                    let stat = unsafe { stat.assume_init() };
                    if !leaf_identity_matches(&registration, &stat) {
                        increment_refusal(&registration.binding);
                        return syscall_failure(libc::ESTALE);
                    }
                }
                unsafe {
                    binding_faccessat(
                        &registration,
                        registration.binding.parent.as_raw_fd(),
                        name.as_ptr(),
                        mode,
                        libc::AT_SYMLINK_NOFOLLOW,
                    )
                }
            }
        }
    }

    pub(super) unsafe extern "C" fn unlink_hook(path: *const c_char) -> c_int {
        match catch_unwind(AssertUnwindSafe(|| unsafe { unlink_hook_inner(path) })) {
            Ok(result) => result,
            Err(_) => set_errno_after_panic(),
        }
    }

    unsafe fn unlink_hook_inner(path: *const c_char) -> c_int {
        match resolve(path) {
            Resolution::Unbound => match ORIGINALS.get() {
                Some(originals) => unsafe { (originals.unlink)(path) },
                None => syscall_failure(libc::ENOSYS),
            },
            Resolution::Refused(error) => syscall_failure(error),
            Resolution::Directory(_) => syscall_failure(libc::EISDIR),
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => {
                if is_leaf {
                    return syscall_failure(libc::EPERM);
                }
                unsafe { libc::unlinkat(registration.binding.parent.as_raw_fd(), name.as_ptr(), 0) }
            }
        }
    }

    pub(super) fn install() -> Result<(), &'static str> {
        unsafe {
            let rc = ffi::sqlite3_initialize();
            if rc != ffi::SQLITE_OK {
                return Err("SQLite initialization failed before bound VFS setup");
            }
            let vfs = ffi::sqlite3_vfs_find(c"unix".as_ptr());
            if vfs.is_null() {
                return Err("SQLite unix VFS is unavailable");
            }
            let get = (*vfs)
                .xGetSystemCall
                .ok_or("SQLite unix VFS has no syscall lookup")?;
            let set = (*vfs)
                .xSetSystemCall
                .ok_or("SQLite unix VFS has no syscall installer")?;
            let open = syscall::<OpenFn>(get(vfs, c"open".as_ptr()))?;
            let stat = syscall::<StatFn>(get(vfs, c"stat".as_ptr()))?;
            let access = syscall::<AccessFn>(get(vfs, c"access".as_ptr()))?;
            let unlink = syscall::<UnlinkFn>(get(vfs, c"unlink".as_ptr()))?;
            ORIGINALS
                .set(Originals {
                    open,
                    stat,
                    access,
                    unlink,
                })
                .map_err(|_| "SQLite unix syscall originals were already set")?;

            let calls = [
                (c"open", syscall_pointer(open_hook as OpenFn)),
                (c"stat", syscall_pointer(stat_hook as StatFn)),
                (c"access", syscall_pointer(access_hook as AccessFn)),
                (c"unlink", syscall_pointer(unlink_hook as UnlinkFn)),
            ];
            for (installed, (name, callback)) in calls.into_iter().enumerate() {
                let rc = set(vfs, name.as_ptr(), callback);
                if rc != ffi::SQLITE_OK {
                    for (restore_name, restore) in [
                        (c"open", syscall_pointer(open)),
                        (c"stat", syscall_pointer(stat)),
                        (c"access", syscall_pointer(access)),
                        (c"unlink", syscall_pointer(unlink)),
                    ]
                    .into_iter()
                    .take(installed)
                    {
                        let _ = set(vfs, restore_name.as_ptr(), restore);
                    }
                    return Err("SQLite unix syscall hook installation failed");
                }
            }
        }
        Ok(())
    }

    unsafe fn syscall<T: Copy>(function: ffi::sqlite3_syscall_ptr) -> Result<T, &'static str> {
        let function = function.ok_or("required SQLite unix syscall is unavailable")?;
        if std::mem::size_of::<T>() != std::mem::size_of_val(&function) {
            return Err("SQLite unix syscall has an unexpected pointer size");
        }
        Ok(unsafe { std::mem::transmute_copy(&function) })
    }

    unsafe fn syscall_pointer<T: Copy>(function: T) -> ffi::sqlite3_syscall_ptr {
        if std::mem::size_of::<T>() != std::mem::size_of::<ffi::sqlite3_syscall_ptr>() {
            return None;
        }
        Some(unsafe { std::mem::transmute_copy(&function) })
    }
}

#[cfg(unix)]
mod unix_vfs {
    use super::*;
    use std::{
        ffi::{c_char, c_int},
        os::fd::AsRawFd,
        panic::{catch_unwind, AssertUnwindSafe},
    };

    pub(super) unsafe extern "C" fn vfs_access(
        vfs: *mut ffi::sqlite3_vfs,
        name: *const c_char,
        flags: c_int,
        out: *mut c_int,
    ) -> c_int {
        match catch_unwind(AssertUnwindSafe(|| unsafe {
            vfs_access_inner(vfs, name, flags, out)
        })) {
            Ok(result) => result,
            Err(_) => ffi::SQLITE_IOERR_ACCESS,
        }
    }

    unsafe fn vfs_access_inner(
        vfs: *mut ffi::sqlite3_vfs,
        name: *const c_char,
        flags: c_int,
        out: *mut c_int,
    ) -> c_int {
        if out.is_null()
            || !matches!(
                flags,
                ffi::SQLITE_ACCESS_EXISTS | ffi::SQLITE_ACCESS_READ | ffi::SQLITE_ACCESS_READWRITE
            )
        {
            return ffi::SQLITE_IOERR_ACCESS;
        }
        let Some(bound_vfs) = (unsafe { vfs.cast::<BoundVfs>().as_ref() }) else {
            return ffi::SQLITE_IOERR_ACCESS;
        };
        let registration = match registration_for(bound_vfs.token) {
            Ok(registration) => registration,
            Err(_) => return ffi::SQLITE_IOERR_ACCESS,
        };
        let (fd, name, is_leaf) = match unix_hooks::resolve(name) {
            unix_hooks::Resolution::Directory(named) if named.token == registration.token => {
                (named.binding.parent.as_raw_fd(), None, false)
            }
            unix_hooks::Resolution::Child {
                registration: named,
                name,
                is_leaf,
            } if named.token == registration.token => {
                (named.binding.parent.as_raw_fd(), Some(name), is_leaf)
            }
            _ => return ffi::SQLITE_IOERR_ACCESS,
        };
        let path = name
            .as_ref()
            .map_or(c".".to_bytes_with_nul(), |name| name.as_bytes_with_nul());
        let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
        let result = unsafe {
            libc::fstatat(
                fd,
                path.as_ptr().cast(),
                stat.as_mut_ptr(),
                libc::AT_SYMLINK_NOFOLLOW,
            )
        };
        if result != 0 {
            let error = unix_hooks::last_errno();
            if error == libc::ENOENT {
                unsafe { *out = 0 };
                return ffi::SQLITE_OK;
            }
            return ffi::SQLITE_IOERR_ACCESS;
        }
        let stat = unsafe { stat.assume_init() };
        if is_leaf && !leaf_identity_matches(&registration, &stat) {
            increment_refusal(&registration.binding);
            return ffi::SQLITE_IOERR_ACCESS;
        }
        let is_regular_file = stat.st_mode & libc::S_IFMT == libc::S_IFREG;
        if flags == ffi::SQLITE_ACCESS_EXISTS
            && !sqlite_access_exists(is_regular_file, i128::from(stat.st_size))
        {
            unsafe { *out = 0 };
            return ffi::SQLITE_OK;
        }
        unsafe { *out = 1 };
        if flags == ffi::SQLITE_ACCESS_READWRITE {
            let result = unsafe {
                unix_hooks::binding_faccessat(
                    &registration,
                    fd,
                    path.as_ptr().cast(),
                    libc::R_OK | libc::W_OK,
                    libc::AT_SYMLINK_NOFOLLOW,
                )
            };
            if result != 0 {
                let error = unix_hooks::last_errno();
                if error == libc::EACCES || error == libc::EROFS {
                    unsafe { *out = 0 };
                    return ffi::SQLITE_OK;
                }
                return ffi::SQLITE_IOERR_ACCESS;
            }
        }
        ffi::SQLITE_OK
    }
}

#[cfg(unix)]
use unix_hooks::install as install_hooks;

#[cfg(windows)]
use windows_hooks::install as install_hooks;

fn registration_for(token: u64) -> Result<Arc<Registration>, Error> {
    let mutex = REGISTRY
        .get()
        .ok_or_else(|| Error::Conflict("bound SQLite registry is unavailable".into()))?;
    let registry = mutex
        .lock()
        .map_err(|_| Error::Conflict("bound SQLite registry was poisoned".into()))?;
    registry
        .by_token
        .get(&token)
        .and_then(Weak::upgrade)
        .ok_or_else(|| Error::Conflict("bound SQLite registration is unavailable".into()))
}

#[cfg(windows)]
mod windows_hooks {
    use super::*;
    use std::{
        ffi::OsString,
        os::windows::fs::MetadataExt,
        os::windows::{ffi::OsStringExt, io::AsRawHandle},
        panic::{catch_unwind, AssertUnwindSafe},
    };
    use windows_sys::{
        core::BOOL,
        Wdk::Storage::FileSystem::{FILE_CREATE, FILE_OPEN, FILE_OPEN_IF},
        Win32::{
            Foundation::{
                GetLastError, SetLastError, ERROR_ACCESS_DENIED, ERROR_FILE_INVALID,
                ERROR_FILE_NOT_FOUND, ERROR_INVALID_PARAMETER, ERROR_PATH_NOT_FOUND, FILETIME,
                GENERIC_READ, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE,
            },
            Security::SECURITY_ATTRIBUTES,
            Storage::FileSystem::{
                FileDispositionInfo, GetFileInformationByHandle, SetFileInformationByHandle,
                BY_HANDLE_FILE_INFORMATION, CREATE_NEW, FILE_ATTRIBUTE_NORMAL,
                FILE_ATTRIBUTE_REPARSE_POINT, FILE_SHARE_READ, FILE_SHARE_WRITE,
                INVALID_FILE_ATTRIBUTES, OPEN_ALWAYS, OPEN_EXISTING, SYNCHRONIZE,
                WIN32_FILE_ATTRIBUTE_DATA,
            },
        },
    };

    type CreateFileFn = unsafe extern "system" fn(
        *const u16,
        u32,
        u32,
        *const SECURITY_ATTRIBUTES,
        u32,
        u32,
        HANDLE,
    ) -> HANDLE;
    type DeleteFileFn = unsafe extern "system" fn(*const u16) -> BOOL;
    type GetAttributesFn = unsafe extern "system" fn(*const u16) -> u32;
    type GetAttributesExFn =
        unsafe extern "system" fn(*const u16, i32, *mut std::ffi::c_void) -> BOOL;

    // winAccess reports a zero-length file as absent, so this keeps a reparse point visible to SQLite.
    const PRESENT_REPARSE_POINT_SYNTHETIC_SIZE: u32 = 1;

    #[derive(Clone, Copy)]
    struct Originals {
        create_file: CreateFileFn,
        delete_file: DeleteFileFn,
        get_attributes: GetAttributesFn,
        get_attributes_ex: GetAttributesExFn,
    }

    static ORIGINALS: OnceLock<Originals> = OnceLock::new();

    pub(super) enum Resolution {
        Unbound,
        Refused(u32),
        Directory(Arc<Registration>),
        Child {
            registration: Arc<Registration>,
            name: OsString,
            is_leaf: bool,
        },
    }

    fn wide_path(path: *const u16) -> Result<Vec<u16>, u32> {
        if path.is_null() {
            return Err(ERROR_INVALID_PARAMETER);
        }
        let mut length = 0usize;
        unsafe {
            while *path.add(length) != 0 {
                length = length.checked_add(1).ok_or(ERROR_INVALID_PARAMETER)?;
            }
            Ok(std::slice::from_raw_parts(path, length).to_vec())
        }
    }

    fn eq_ascii_case_insensitive(left: &[u16], right: &[u16]) -> bool {
        left.len() == right.len()
            && left
                .iter()
                .zip(right)
                .all(|(left, right)| ascii_lower(*left) == ascii_lower(*right))
    }

    fn ascii_lower(unit: u16) -> u16 {
        if (u16::from(b'A')..=u16::from(b'Z')).contains(&unit) {
            unit + (u16::from(b'a') - u16::from(b'A'))
        } else {
            unit
        }
    }

    fn parse_token(text: &[u16]) -> Result<u64, u32> {
        if text.is_empty()
            || !text
                .iter()
                .all(|unit| (u16::from(b'0')..=u16::from(b'9')).contains(unit))
        {
            return Err(ERROR_ACCESS_DENIED);
        }
        let digits = String::from_utf16(text).map_err(|_| ERROR_ACCESS_DENIED)?;
        digits.parse().map_err(|_| ERROR_ACCESS_DENIED)
    }

    fn lookup_registration(token: u64) -> Result<Arc<Registration>, u32> {
        let mutex = REGISTRY.get().ok_or(ERROR_ACCESS_DENIED)?;
        let registry = mutex.lock().map_err(|_| ERROR_ACCESS_DENIED)?;
        registry
            .by_token
            .get(&token)
            .and_then(Weak::upgrade)
            .ok_or(ERROR_ACCESS_DENIED)
    }

    pub(super) fn resolve(path: *const u16) -> Resolution {
        let mut wide = match wide_path(path) {
            Ok(wide) => wide,
            Err(error) => return Resolution::Refused(error),
        };
        for unit in &mut wide {
            if *unit == u16::from(b'\\') {
                *unit = u16::from(b'/');
            }
        }
        let prefix: Vec<u16> = RESERVED_PREFIX.encode_utf16().collect();
        if wide.len() < prefix.len() || !eq_ascii_case_insensitive(&wide[..prefix.len()], &prefix) {
            return Resolution::Unbound;
        }
        let rest = &wide[prefix.len()..];
        let Some(separator) = rest
            .iter()
            .position(|unit| *unit == u16::from(b'/') || *unit == u16::from(b'\\'))
        else {
            return match parse_token(rest).and_then(lookup_registration) {
                Ok(registration) => Resolution::Directory(registration),
                Err(error) => Resolution::Refused(error),
            };
        };
        let token = match parse_token(&rest[..separator]) {
            Ok(token) => token,
            Err(error) => return Resolution::Refused(error),
        };
        let registration = match lookup_registration(token) {
            Ok(registration) => registration,
            Err(error) => return Resolution::Refused(error),
        };
        let name_wide = &rest[separator + 1..];
        if name_wide.is_empty()
            || name_wide.iter().any(|unit| {
                *unit == u16::from(b'/') || *unit == u16::from(b'\\') || *unit == u16::from(b':')
            })
        {
            return Resolution::Refused(ERROR_ACCESS_DENIED);
        }
        let name = OsString::from_wide(name_wide);
        let leaf = super::binding_key_leaf(&registration.binding.leaf);
        let child = super::binding_key_leaf(&name);
        let leaf_match = child == leaf;
        let valid = leaf_match
            || ["-WAL", "-SHM", "-JOURNAL"].iter().any(|suffix| {
                let mut sidecar = leaf.clone();
                sidecar.push(*suffix);
                child == sidecar
            });
        if !valid {
            return Resolution::Refused(ERROR_ACCESS_DENIED);
        }
        Resolution::Child {
            registration,
            name,
            is_leaf: leaf_match,
        }
    }

    pub(super) fn resolve_utf8(path: *const std::ffi::c_char) -> Resolution {
        if path.is_null() {
            return Resolution::Refused(ERROR_INVALID_PARAMETER);
        }
        let text = unsafe { std::ffi::CStr::from_ptr(path) };
        match text.to_str() {
            Ok(text) => {
                let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
                resolve(wide.as_ptr())
            }
            Err(_) => Resolution::Refused(ERROR_ACCESS_DENIED),
        }
    }

    pub(super) fn is_own_child(token: u64, path: *const std::ffi::c_char) -> bool {
        matches!(
            resolve_utf8(path),
            Resolution::Child { registration, .. } if registration.token == token
        )
    }

    fn error_code(error: &Error) -> u32 {
        match error {
            Error::Io(source) => match source.raw_os_error() {
                Some(code) => code as u32,
                None => ERROR_ACCESS_DENIED,
            },
            _ => ERROR_ACCESS_DENIED,
        }
    }

    fn open_relative(
        registration: &Registration,
        name: &std::ffi::OsStr,
        creation_disposition: u32,
        desired_access: u32,
        allow_delete_share: bool,
    ) -> Result<std::fs::File, u32> {
        crate::infra::path_authority::open_windows_child(
            &registration.binding.parent,
            name,
            creation_disposition,
            desired_access | SYNCHRONIZE,
            std::ptr::null(),
            false,
            allow_delete_share,
        )
        .map_err(|error| error_code(&error))
    }

    fn identity_matches(registration: &Registration, file: &std::fs::File) -> Result<bool, u32> {
        crate::infra::path_authority::opened_file_identity(file)
            .map(|identity| identity == registration.binding.identity)
            .map_err(|error| error_code(&error))
    }

    fn report_identity_refusal(registration: &Registration) -> u32 {
        increment_refusal(&registration.binding);
        ERROR_FILE_INVALID
    }

    pub(super) fn query_attributes(
        registration: &Registration,
        name: &std::ffi::OsStr,
        is_leaf: bool,
    ) -> Result<BY_HANDLE_FILE_INFORMATION, u32> {
        let file = open_relative(registration, name, FILE_OPEN, GENERIC_READ, true)?;
        if is_leaf && !identity_matches(registration, &file)? {
            return Err(report_identity_refusal(registration));
        }
        let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
        if unsafe { GetFileInformationByHandle(file.as_raw_handle() as HANDLE, &mut info) } == 0 {
            return Err(unsafe { GetLastError() });
        }
        Ok(info)
    }

    unsafe extern "system" fn create_file_hook(
        path: *const u16,
        desired_access: u32,
        share_mode: u32,
        security_attributes: *const SECURITY_ATTRIBUTES,
        creation_disposition: u32,
        flags_and_attributes: u32,
        template: HANDLE,
    ) -> HANDLE {
        match catch_unwind(AssertUnwindSafe(|| unsafe {
            create_file_hook_inner(
                path,
                desired_access,
                share_mode,
                security_attributes,
                creation_disposition,
                flags_and_attributes,
                template,
            )
        })) {
            Ok(handle) => handle,
            Err(_) => {
                unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                INVALID_HANDLE_VALUE
            }
        }
    }

    unsafe fn create_file_hook_inner(
        path: *const u16,
        desired_access: u32,
        share_mode: u32,
        security_attributes: *const SECURITY_ATTRIBUTES,
        creation_disposition: u32,
        flags_and_attributes: u32,
        template: HANDLE,
    ) -> HANDLE {
        match resolve(path) {
            Resolution::Unbound => match ORIGINALS.get() {
                Some(originals) => unsafe {
                    (originals.create_file)(
                        path,
                        desired_access,
                        share_mode,
                        security_attributes,
                        creation_disposition,
                        flags_and_attributes,
                        template,
                    )
                },
                None => {
                    unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                    INVALID_HANDLE_VALUE
                }
            },
            Resolution::Refused(error) => {
                unsafe { SetLastError(error) };
                INVALID_HANDLE_VALUE
            }
            Resolution::Directory(_) => {
                unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                INVALID_HANDLE_VALUE
            }
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => {
                let valid_access = desired_access == GENERIC_READ
                    || desired_access == GENERIC_READ | GENERIC_WRITE;
                let valid_disposition = matches!(
                    creation_disposition,
                    CREATE_NEW | OPEN_EXISTING | OPEN_ALWAYS
                );
                if !valid_access
                    || share_mode != FILE_SHARE_READ | FILE_SHARE_WRITE
                    || !security_attributes.is_null()
                    || !valid_disposition
                    || flags_and_attributes != FILE_ATTRIBUTE_NORMAL
                    || !template.is_null()
                {
                    unsafe { SetLastError(ERROR_INVALID_PARAMETER) };
                    return INVALID_HANDLE_VALUE;
                }
                let nt_disposition = match creation_disposition {
                    OPEN_EXISTING => FILE_OPEN,
                    OPEN_ALWAYS => FILE_OPEN_IF,
                    CREATE_NEW => FILE_CREATE,
                    _ => {
                        unsafe { SetLastError(ERROR_INVALID_PARAMETER) };
                        return INVALID_HANDLE_VALUE;
                    }
                };
                let access = if desired_access == GENERIC_READ {
                    GENERIC_READ
                } else {
                    GENERIC_READ | GENERIC_WRITE
                };
                let file = match open_relative(&registration, &name, nt_disposition, access, false)
                {
                    Ok(file) => file,
                    Err(error) => {
                        unsafe { SetLastError(error) };
                        return INVALID_HANDLE_VALUE;
                    }
                };
                if is_leaf {
                    match identity_matches(&registration, &file) {
                        Ok(true) => {}
                        Ok(false) => {
                            unsafe { SetLastError(report_identity_refusal(&registration)) };
                            return INVALID_HANDLE_VALUE;
                        }
                        Err(error) => {
                            unsafe { SetLastError(error) };
                            return INVALID_HANDLE_VALUE;
                        }
                    }
                }
                #[cfg(test)]
                if let Ok(mut opened) = registration.binding.opened_names.lock() {
                    opened.push(name.clone());
                }
                std::os::windows::io::IntoRawHandle::into_raw_handle(file) as HANDLE
            }
        }
    }

    pub(super) unsafe extern "system" fn delete_file_hook(path: *const u16) -> BOOL {
        match catch_unwind(AssertUnwindSafe(|| unsafe { delete_file_hook_inner(path) })) {
            Ok(result) => result,
            Err(_) => {
                unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                0
            }
        }
    }

    unsafe fn delete_file_hook_inner(path: *const u16) -> BOOL {
        match resolve(path) {
            Resolution::Unbound => match ORIGINALS.get() {
                Some(originals) => unsafe { (originals.delete_file)(path) },
                None => {
                    unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                    0
                }
            },
            Resolution::Refused(error) => {
                unsafe { SetLastError(error) };
                0
            }
            Resolution::Directory(_) => {
                unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                0
            }
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => {
                if is_leaf {
                    unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                    return 0;
                }
                let file = match open_relative(
                    &registration,
                    &name,
                    FILE_OPEN,
                    // `open_windows_child` reads the handle's attributes to refuse a reparse point,
                    // so a `DELETE`-only handle fails before the disposition (CI run 36590198609).
                    windows_sys::Win32::Storage::FileSystem::DELETE
                        | windows_sys::Win32::Storage::FileSystem::FILE_READ_ATTRIBUTES,
                    false,
                ) {
                    Ok(file) => file,
                    Err(error) => {
                        unsafe { SetLastError(error) };
                        return 0;
                    }
                };
                #[cfg(test)]
                super::invoke_binding_test_hook(&registration.binding.before_delete_disposition);
                let disposition = windows_sys::Win32::Storage::FileSystem::FILE_DISPOSITION_INFO {
                    DeleteFile: true,
                };
                if unsafe {
                    SetFileInformationByHandle(
                        file.as_raw_handle() as HANDLE,
                        FileDispositionInfo,
                        std::ptr::addr_of!(disposition).cast(),
                        std::mem::size_of_val(&disposition) as u32,
                    )
                } == 0
                {
                    return 0;
                }
                1
            }
        }
    }

    unsafe extern "system" fn get_attributes_hook(path: *const u16) -> u32 {
        match catch_unwind(AssertUnwindSafe(|| unsafe {
            get_attributes_hook_inner(path)
        })) {
            Ok(attributes) => attributes,
            Err(_) => {
                unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                INVALID_FILE_ATTRIBUTES
            }
        }
    }

    unsafe fn get_attributes_hook_inner(path: *const u16) -> u32 {
        match resolve(path) {
            Resolution::Unbound => match ORIGINALS.get() {
                Some(originals) => unsafe { (originals.get_attributes)(path) },
                None => {
                    unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                    INVALID_FILE_ATTRIBUTES
                }
            },
            Resolution::Refused(error) => {
                unsafe { SetLastError(error) };
                INVALID_FILE_ATTRIBUTES
            }
            Resolution::Directory(registration) => match registration.binding.parent.metadata() {
                Ok(metadata) => metadata.file_attributes(),
                Err(error) => {
                    let code = match error.raw_os_error() {
                        Some(code) => code as u32,
                        None => ERROR_ACCESS_DENIED,
                    };
                    unsafe { SetLastError(code) };
                    INVALID_FILE_ATTRIBUTES
                }
            },
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => match query_attributes(&registration, &name, is_leaf) {
                Ok(info) => info.dwFileAttributes,
                Err(error) if error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND => {
                    unsafe { SetLastError(error) };
                    INVALID_FILE_ATTRIBUTES
                }
                Err(error) if error == ERROR_ACCESS_DENIED && !is_leaf => {
                    unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                    FILE_ATTRIBUTE_REPARSE_POINT
                }
                Err(error) => {
                    unsafe { SetLastError(error) };
                    INVALID_FILE_ATTRIBUTES
                }
            },
        }
    }

    unsafe extern "system" fn get_attributes_ex_hook(
        path: *const u16,
        level: i32,
        data: *mut std::ffi::c_void,
    ) -> BOOL {
        match catch_unwind(AssertUnwindSafe(|| unsafe {
            get_attributes_ex_hook_inner(path, level, data)
        })) {
            Ok(result) => result,
            Err(_) => {
                unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                0
            }
        }
    }

    unsafe fn get_attributes_ex_hook_inner(
        path: *const u16,
        level: i32,
        data: *mut std::ffi::c_void,
    ) -> BOOL {
        match resolve(path) {
            Resolution::Unbound => match ORIGINALS.get() {
                Some(originals) => unsafe { (originals.get_attributes_ex)(path, level, data) },
                None => {
                    unsafe { SetLastError(ERROR_ACCESS_DENIED) };
                    0
                }
            },
            Resolution::Refused(error) => {
                unsafe { SetLastError(error) };
                0
            }
            Resolution::Directory(registration) => {
                let mut info: WIN32_FILE_ATTRIBUTE_DATA = unsafe { std::mem::zeroed() };
                match fill_attribute_data_from_file(&registration.binding.parent, &mut info) {
                    Ok(()) => {
                        if data.is_null() {
                            unsafe { SetLastError(ERROR_INVALID_PARAMETER) };
                            return 0;
                        }
                        unsafe { std::ptr::write(data.cast(), info) };
                        1
                    }
                    Err(error) => {
                        unsafe { SetLastError(error) };
                        0
                    }
                }
            }
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => {
                if data.is_null() {
                    unsafe { SetLastError(ERROR_INVALID_PARAMETER) };
                    return 0;
                }
                if level != windows_sys::Win32::Storage::FileSystem::GetFileExInfoStandard {
                    unsafe { SetLastError(ERROR_INVALID_PARAMETER) };
                    return 0;
                }
                let info = match query_attributes(&registration, &name, is_leaf) {
                    Ok(info) => info,
                    Err(error)
                        if error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND =>
                    {
                        unsafe { SetLastError(error) };
                        return 0;
                    }
                    Err(error) if error == ERROR_ACCESS_DENIED && !is_leaf => {
                        let mut info: WIN32_FILE_ATTRIBUTE_DATA = unsafe { std::mem::zeroed() };
                        info.dwFileAttributes = FILE_ATTRIBUTE_REPARSE_POINT;
                        info.nFileSizeLow = PRESENT_REPARSE_POINT_SYNTHETIC_SIZE;
                        unsafe { std::ptr::write(data.cast(), info) };
                        return 1;
                    }
                    Err(error) => {
                        unsafe { SetLastError(error) };
                        return 0;
                    }
                };
                let attributes = WIN32_FILE_ATTRIBUTE_DATA {
                    dwFileAttributes: info.dwFileAttributes,
                    ftCreationTime: info.ftCreationTime,
                    ftLastAccessTime: info.ftLastAccessTime,
                    ftLastWriteTime: info.ftLastWriteTime,
                    nFileSizeHigh: info.nFileSizeHigh,
                    nFileSizeLow: info.nFileSizeLow,
                };
                unsafe { std::ptr::write(data.cast(), attributes) };
                1
            }
        }
    }

    fn fill_attribute_data_from_file(
        file: &std::fs::File,
        data: &mut WIN32_FILE_ATTRIBUTE_DATA,
    ) -> Result<(), u32> {
        use std::os::windows::fs::MetadataExt;
        let metadata = file
            .metadata()
            .map_err(|error| match error.raw_os_error() {
                Some(code) => code as u32,
                None => ERROR_ACCESS_DENIED,
            })?;
        let info = metadata;
        let to_filetime = |ticks: u64| FILETIME {
            dwLowDateTime: ticks as u32,
            dwHighDateTime: (ticks >> 32) as u32,
        };
        let size = info.file_size();
        data.dwFileAttributes = info.file_attributes();
        data.ftCreationTime = to_filetime(info.creation_time());
        data.ftLastAccessTime = to_filetime(info.last_access_time());
        data.ftLastWriteTime = to_filetime(info.last_write_time());
        data.nFileSizeHigh = (size >> 32) as u32;
        data.nFileSizeLow = size as u32;
        Ok(())
    }

    pub(super) fn install() -> Result<(), &'static str> {
        unsafe {
            let rc = ffi::sqlite3_initialize();
            if rc != ffi::SQLITE_OK {
                return Err("SQLite initialization failed before bound VFS setup");
            }
            let vfs = ffi::sqlite3_vfs_find(c"win32".as_ptr());
            if vfs.is_null() {
                return Err("SQLite win32 VFS is unavailable");
            }
            let get = (*vfs)
                .xGetSystemCall
                .ok_or("SQLite win32 VFS has no syscall lookup")?;
            let set = (*vfs)
                .xSetSystemCall
                .ok_or("SQLite win32 VFS has no syscall installer")?;
            let originals = Originals {
                create_file: syscall::<CreateFileFn>(get(vfs, c"CreateFileW".as_ptr()))?,
                delete_file: syscall::<DeleteFileFn>(get(vfs, c"DeleteFileW".as_ptr()))?,
                get_attributes: syscall::<GetAttributesFn>(get(
                    vfs,
                    c"GetFileAttributesW".as_ptr(),
                ))?,
                get_attributes_ex: syscall::<GetAttributesExFn>(get(
                    vfs,
                    c"GetFileAttributesExW".as_ptr(),
                ))?,
            };
            ORIGINALS
                .set(originals)
                .map_err(|_| "SQLite win32 syscall originals were already set")?;
            let calls = [
                (
                    c"CreateFileW",
                    syscall_pointer(create_file_hook as CreateFileFn),
                ),
                (
                    c"DeleteFileW",
                    syscall_pointer(delete_file_hook as DeleteFileFn),
                ),
                (
                    c"GetFileAttributesW",
                    syscall_pointer(get_attributes_hook as GetAttributesFn),
                ),
                (
                    c"GetFileAttributesExW",
                    syscall_pointer(get_attributes_ex_hook as GetAttributesExFn),
                ),
            ];
            for (installed, (name, callback)) in calls.into_iter().enumerate() {
                let rc = set(vfs, name.as_ptr(), callback);
                if rc != ffi::SQLITE_OK {
                    for (restore_name, restore) in [
                        (c"CreateFileW", syscall_pointer(originals.create_file)),
                        (c"DeleteFileW", syscall_pointer(originals.delete_file)),
                        (
                            c"GetFileAttributesW",
                            syscall_pointer(originals.get_attributes),
                        ),
                        (
                            c"GetFileAttributesExW",
                            syscall_pointer(originals.get_attributes_ex),
                        ),
                    ]
                    .into_iter()
                    .take(installed)
                    {
                        let _ = set(vfs, restore_name.as_ptr(), restore);
                    }
                    return Err("SQLite win32 syscall hook installation failed");
                }
            }
        }
        Ok(())
    }

    unsafe fn syscall<T: Copy>(function: ffi::sqlite3_syscall_ptr) -> Result<T, &'static str> {
        let function = function.ok_or("required SQLite win32 syscall is unavailable")?;
        if std::mem::size_of::<T>() != std::mem::size_of_val(&function) {
            return Err("SQLite win32 syscall has an unexpected pointer size");
        }
        Ok(unsafe { std::mem::transmute_copy(&function) })
    }

    unsafe fn syscall_pointer<T: Copy>(function: T) -> ffi::sqlite3_syscall_ptr {
        if std::mem::size_of::<T>() != std::mem::size_of::<ffi::sqlite3_syscall_ptr>() {
            return None;
        }
        Some(unsafe { std::mem::transmute_copy(&function) })
    }
}

#[cfg(windows)]
mod windows_vfs {
    use super::*;
    use std::{
        ffi::{c_char, c_int},
        panic::{catch_unwind, AssertUnwindSafe},
    };

    pub(super) unsafe extern "C" fn vfs_access(
        vfs: *mut ffi::sqlite3_vfs,
        name: *const c_char,
        flags: c_int,
        out: *mut c_int,
    ) -> c_int {
        match catch_unwind(AssertUnwindSafe(|| unsafe {
            vfs_access_inner(vfs, name, flags, out)
        })) {
            Ok(result) => result,
            Err(_) => ffi::SQLITE_IOERR_ACCESS,
        }
    }

    unsafe fn vfs_access_inner(
        vfs: *mut ffi::sqlite3_vfs,
        name: *const c_char,
        flags: c_int,
        out: *mut c_int,
    ) -> c_int {
        if out.is_null()
            || !matches!(
                flags,
                ffi::SQLITE_ACCESS_EXISTS | ffi::SQLITE_ACCESS_READ | ffi::SQLITE_ACCESS_READWRITE
            )
        {
            return ffi::SQLITE_IOERR_ACCESS;
        }
        let Some(bound_vfs) = (unsafe { vfs.cast::<BoundVfs>().as_ref() }) else {
            return ffi::SQLITE_IOERR_ACCESS;
        };
        let registration = match registration_for(bound_vfs.token) {
            Ok(registration) => registration,
            Err(_) => return ffi::SQLITE_IOERR_ACCESS,
        };
        match windows_hooks::resolve_utf8(name) {
            windows_hooks::Resolution::Directory(named) if named.token == registration.token => {
                unsafe { *out = 1 };
                ffi::SQLITE_OK
            }
            windows_hooks::Resolution::Child {
                registration: named,
                name,
                is_leaf,
            } if named.token == registration.token => {
                match windows_hooks::query_attributes(&registration, &name, is_leaf) {
                    Ok(info) => {
                        // winAccess applies its zero-size absence rule to every attribute record,
                        // not only to regular files as unixAccess does.
                        let zero_size_rule_applies = true;
                        let file_size =
                            (u64::from(info.nFileSizeHigh) << 32) | u64::from(info.nFileSizeLow);
                        let exists = flags != ffi::SQLITE_ACCESS_EXISTS
                            || sqlite_access_exists(zero_size_rule_applies, i128::from(file_size));
                        let accessible = flags != ffi::SQLITE_ACCESS_READWRITE
                            || info.dwFileAttributes
                                & windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_READONLY
                                == 0;
                        unsafe { *out = i32::from(exists && accessible) };
                        ffi::SQLITE_OK
                    }
                    Err(error)
                        if error == windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND
                            || error == windows_sys::Win32::Foundation::ERROR_PATH_NOT_FOUND =>
                    {
                        unsafe { *out = 0 };
                        ffi::SQLITE_OK
                    }
                    Err(error)
                        if error == windows_sys::Win32::Foundation::ERROR_ACCESS_DENIED
                            && !is_leaf =>
                    {
                        // A reparse point is present. Report it as existing so SQLite attempts an
                        // open, where open_windows_child rejects it without following the target.
                        unsafe { *out = 1 };
                        ffi::SQLITE_OK
                    }
                    Err(_) => ffi::SQLITE_IOERR_ACCESS,
                }
            }
            _ => ffi::SQLITE_IOERR_ACCESS,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_sqlite_version_is_pinned_for_the_hook_set() {
        assert_eq!(ffi::SQLITE_VERSION_NUMBER, 3_039_002);
        assert_eq!(ffi::SQLITE_VERSION, b"3.39.2\0");
    }

    #[test]
    fn sqlite_exists_size_rule_keeps_nonregular_entries_and_rejects_empty_regular_files() {
        assert!(sqlite_access_exists(false, 0));
        assert!(!sqlite_access_exists(true, 0));
        assert!(sqlite_access_exists(true, 1));
        assert!(!sqlite_access_exists(true, -1));
    }

    #[test]
    fn constructor_installs_before_tests_and_plain_paths_remain_unbound() {
        ensure_hooks_installed().unwrap();
        let connection = rusqlite::Connection::open_in_memory().unwrap();
        connection.execute_batch("SELECT 1;").unwrap();
    }

    #[test]
    fn bound_uri_encodes_special_leaf_bytes_and_refuses_non_utf8() {
        let dir = tempfile::tempdir().unwrap();
        // `?` is not a legal Windows file-name character, so it is only exercised on unix.
        let (leaf, encoded) = if cfg!(windows) {
            ("percent%hash# .db3", "percent%25hash%23%20.db3")
        } else {
            ("percent%question?#.db3", "percent%25question%3F%23.db3")
        };
        let path = dir.path().join(leaf);
        std::fs::File::create(&path).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        assert!(format!("{bound:?}").contains(&bound.token().to_string()));
        let uri = bound.uri(SqliteMode::ReadWrite).unwrap();
        assert!(uri.starts_with(RESERVED_URI_PREFIX));
        assert!(uri.contains(encoded), "{uri}");
        assert!(uri.contains("&vfs=chessfable-bound-"));
        rusqlite::Connection::open_with_flags(
            &uri,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_URI,
        )
        .unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStringExt;
            let path = dir
                .path()
                .join(OsString::from_vec(b"nonutf8-\xff.db3".to_vec()));
            // APFS stores only UTF-8 names and refuses this one with `EILSEQ` (CI run
            // 36594812395), so there no such database can reach `acquire` at all.
            match std::fs::File::create(&path) {
                Ok(_) => {}
                Err(error) if error.raw_os_error() == Some(libc::EILSEQ) => return,
                Err(error) => panic!("creating the non-UTF-8 leaf failed: {error}"),
            }
            let target = DatabaseFileTarget::for_test_path(&path).unwrap();
            assert!(matches!(
                BoundDatabase::acquire(&target),
                Err(Error::InvalidInput(message)) if message == "Path is not valid UTF-8"
            ));
        }
    }

    #[test]
    fn registration_map_cleans_up_and_stale_drop_cannot_remove_new_entry() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("registry.db3");
        std::fs::File::create(&path).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let key = bound.0.key.clone();
        let token = bound.token();
        assert!(REGISTRY
            .get()
            .and_then(|registry| registry.lock().ok())
            .is_some_and(|registry| registry.by_key.contains_key(&key)));
        drop(bound);
        assert!(REGISTRY
            .get()
            .and_then(|registry| registry.lock().ok())
            .is_some_and(|registry| !registry.by_key.contains_key(&key)));

        let mut registry = Registry::default();
        let weak = Weak::new();
        registry.by_key.insert(key.clone(), (token + 1, weak));
        assert!(!remove_key_if_token(&mut registry, &key, token));
        assert!(registry.by_key.contains_key(&key));
    }

    #[cfg(all(unix, not(target_os = "linux")))]
    #[test]
    fn a_descriptor_for_a_bound_inode_is_retained_until_its_last_binding_drops() {
        use std::os::fd::IntoRawFd;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("quarantined-inode.db3");
        std::fs::File::create(&path).unwrap();
        let alias = dir.path().join("quarantined-inode-alias.db3");
        std::fs::hard_link(&path, &alias).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let identity = bound.0.binding.identity;
        let alias_target = DatabaseFileTarget::for_test_path(&alias).unwrap();
        let alias_bound = BoundDatabase::acquire(&alias_target).unwrap();
        let fd = std::fs::File::open(&path).unwrap().into_raw_fd();

        retain_mismatched_descriptor(fd, identity);
        assert_ne!(unsafe { libc::fcntl(fd, libc::F_GETFD) }, -1);
        assert!(REGISTRY
            .get()
            .and_then(|registry| registry.lock().ok())
            .is_some_and(|registry| registry.quarantined_descriptors.contains_key(&identity)));

        drop(bound);
        assert_ne!(unsafe { libc::fcntl(fd, libc::F_GETFD) }, -1);
        drop(alias_bound);
        // A closed descriptor number can be reused at once by a parallel test, so closure is
        // observed through the registry, which owns the quarantined `File`s.
        assert!(REGISTRY
            .get()
            .and_then(|registry| registry.lock().ok())
            .is_some_and(|registry| !registry.quarantined_descriptors.contains_key(&identity)));
    }

    #[test]
    fn bindings_share_one_name_per_directory_entry_and_refuse_cross_parent_aliases() {
        let root = tempfile::tempdir().unwrap();
        let first_parent = root.path().join("first");
        let second_parent = root.path().join("second");
        std::fs::create_dir(&first_parent).unwrap();
        std::fs::create_dir(&second_parent).unwrap();
        let path = first_parent.join("game.db3");
        std::fs::File::create(&path).unwrap();
        let same_directory_alias = first_parent.join("alias.db3");
        std::fs::hard_link(&path, &same_directory_alias).unwrap();
        let cross_directory_alias = second_parent.join("game.db3");
        std::fs::hard_link(&path, &cross_directory_alias).unwrap();

        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let first = BoundDatabase::acquire(&target).unwrap();
        let second = BoundDatabase::acquire(&target).unwrap();
        assert_eq!(first.token(), second.token());

        let alias_target = DatabaseFileTarget::for_test_path(&same_directory_alias).unwrap();
        let alias = BoundDatabase::acquire(&alias_target).unwrap();
        assert_ne!(first.token(), alias.token());

        let cross_target = DatabaseFileTarget::for_test_path(&cross_directory_alias).unwrap();
        assert!(matches!(
            BoundDatabase::acquire(&cross_target),
            Err(Error::Conflict(message)) if message == "database is open through another directory"
        ));
        drop(first);
        drop(second);
        drop(alias);
        let cross = BoundDatabase::acquire(&cross_target).unwrap();
        assert!(cross.token() != 0);
    }

    #[cfg(windows)]
    #[test]
    fn windows_case_variants_share_one_binding() {
        let root = tempfile::tempdir().unwrap();
        let original = root.path().join("GameCase.db3");
        std::fs::File::create(&original).unwrap();
        let alternate = root.path().join("gamecase.db3");
        let first =
            BoundDatabase::acquire(&DatabaseFileTarget::for_test_path(&original).unwrap()).unwrap();
        let second =
            BoundDatabase::acquire(&DatabaseFileTarget::for_test_path(&alternate).unwrap())
                .unwrap();
        assert_eq!(first.token(), second.token());
        assert_ne!(
            binding_key_leaf(OsStr::new("ß.db3")),
            binding_key_leaf(OsStr::new("SS.db3"))
        );

        // The key must agree with the filesystem rather than with a hard-coded folding table:
        // two spellings share a key exactly when the second opens the file the first created.
        let sigma_path = root.path().join("Σ.db3");
        std::fs::File::create(&sigma_path).unwrap();
        let final_sigma_path = root.path().join("ς.db3");
        let filesystem_folds = match std::fs::File::open(&final_sigma_path) {
            Ok(file) => {
                crate::infra::path_authority::opened_file_identity(&file).unwrap()
                    == crate::infra::path_authority::opened_file_identity(
                        &std::fs::File::open(&sigma_path).unwrap(),
                    )
                    .unwrap()
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
            Err(error) => panic!("probing the final-sigma spelling failed: {error}"),
        };
        assert_eq!(
            binding_key_leaf(OsStr::new("Σ.db3")) == binding_key_leaf(OsStr::new("ς.db3")),
            filesystem_folds
        );
        let sigma_bound =
            BoundDatabase::acquire(&DatabaseFileTarget::for_test_path(&sigma_path).unwrap())
                .unwrap();
        let final_sigma_name = format!("{RESERVED_PREFIX}{}/ς.db3", sigma_bound.token());
        let final_sigma_wide: Vec<u16> = final_sigma_name
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        assert_eq!(
            matches!(
                windows_hooks::resolve(final_sigma_wide.as_ptr()),
                windows_hooks::Resolution::Child { is_leaf: true, .. }
            ),
            filesystem_folds
        );
    }

    #[cfg(windows)]
    #[test]
    fn delete_sidecar_handle_prevents_rename_out_of_the_authorized_parent() {
        use windows_sys::Win32::Foundation::ERROR_SHARING_VIOLATION;

        let root = tempfile::tempdir().unwrap();
        let parent = root.path().join("authorized");
        std::fs::create_dir(&parent).unwrap();
        let path = parent.join("delete-race.db3");
        std::fs::File::create(&path).unwrap();
        let sidecar = parent.join("delete-race.db3-wal");
        std::fs::write(&sidecar, b"held sidecar").unwrap();
        let outside = root.path().join("moved-wal");
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let rename_result = Arc::new(Mutex::new(None));
        let rename_result_in_hook = Arc::clone(&rename_result);
        let sidecar_in_hook = sidecar.clone();
        let outside_in_hook = outside.clone();
        bound
            .set_before_delete_disposition_hook(move || {
                *rename_result_in_hook.lock().unwrap() =
                    Some(std::fs::rename(&sidecar_in_hook, &outside_in_hook));
            })
            .unwrap();

        let sqlite_name = format!("{RESERVED_PREFIX}{}/delete-race.db3-wal", bound.token());
        let mut wide_name: Vec<u16> = sqlite_name.encode_utf16().collect();
        wide_name.push(0);
        let deleted = unsafe { windows_hooks::delete_file_hook(wide_name.as_ptr()) };
        assert_eq!(deleted, 1);

        let rename_error = rename_result
            .lock()
            .unwrap()
            .take()
            .expect("rename attempt ran")
            .expect_err("the open handle must deny rename");
        assert_eq!(
            rename_error.raw_os_error(),
            Some(ERROR_SHARING_VIOLATION as i32)
        );
        assert!(
            !sidecar.exists(),
            "the sidecar should be deleted in the held parent"
        );
        assert!(
            !outside.exists(),
            "nothing should be moved outside the held parent"
        );
    }

    #[cfg(unix)]
    #[test]
    fn unix_bound_syscall_hooks_do_not_follow_a_symlinked_sidecar() {
        use std::{ffi::CString, os::unix::fs::symlink};

        let root = tempfile::tempdir().unwrap();
        let parent = root.path().join("authorized");
        std::fs::create_dir(&parent).unwrap();
        let path = parent.join("nofollow.db3");
        std::fs::File::create(&path).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let external_path = root.path().join("external-readable-file");
        std::fs::write(&external_path, b"external file remains untouched").unwrap();
        let original_external_contents = std::fs::read(&external_path).unwrap();
        let sidecar_path = parent.join("nofollow.db3-wal");
        symlink(&external_path, &sidecar_path).unwrap();
        let leaf = path.file_name().unwrap().to_string_lossy();
        let name =
            CString::new(format!("{RESERVED_PREFIX}{}/{}-wal", bound.token(), leaf)).unwrap();

        let opened = unsafe { unix_hooks::open_hook(name.as_ptr(), libc::O_RDONLY, 0) };
        assert_eq!(opened, -1);
        assert_eq!(unix_hooks::last_errno(), libc::ELOOP);
        assert_eq!(
            std::fs::read(&external_path).unwrap(),
            original_external_contents
        );
        let accessed = unsafe { unix_hooks::access_hook(name.as_ptr(), libc::F_OK) };
        assert_eq!(accessed, 0, "access must observe the symlink itself");
    }

    #[cfg(unix)]
    #[test]
    fn concurrent_first_binding_acquisitions_share_one_token_and_clean_up() {
        use std::sync::Barrier;

        const THREADS: usize = 8;
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("concurrent-first-binding.db3");
        std::fs::File::create(&path).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let key = BindingKey {
            identity: target.identity(),
            parent_identity: opened_file_identity(target.parent()).unwrap(),
            leaf: binding_key_leaf(target.leaf()),
        };
        let start = Arc::new(Barrier::new(THREADS));
        let acquired = Arc::new(Barrier::new(THREADS));

        let handles: Vec<_> = (0..THREADS)
            .map(|_| {
                let path = path.clone();
                let start = Arc::clone(&start);
                let acquired = Arc::clone(&acquired);
                std::thread::spawn(move || {
                    let target = DatabaseFileTarget::for_test_path(&path).unwrap();
                    start.wait();
                    let binding = BoundDatabase::acquire(&target);
                    let token = binding.as_ref().ok().map(BoundDatabase::token);
                    acquired.wait();
                    drop(binding);
                    token
                })
            })
            .collect();
        let tokens: Vec<_> = handles
            .into_iter()
            .map(|handle| handle.join().unwrap().expect("binding acquisition"))
            .collect();

        assert!(tokens.iter().all(|token| *token == tokens[0]));
        let registry = REGISTRY.get().unwrap().lock().unwrap();
        assert!(!registry.by_key.contains_key(&key));
        assert!(!registry.creating.contains_key(&key));
    }

    #[test]
    fn binding_creation_waiter_reuses_the_reserved_registration() {
        use std::sync::mpsc;

        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("reserved-creation.db3");
        std::fs::File::create(&path).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let key = BindingKey {
            identity: target.identity(),
            parent_identity: opened_file_identity(target.parent()).unwrap(),
            leaf: binding_key_leaf(target.leaf()),
        };
        let (creation_started_tx, creation_started_rx) = mpsc::channel();
        let (release_creation_tx, release_creation_rx) = mpsc::channel();
        let (waiter_reached_tx, waiter_reached_rx) = mpsc::channel();
        let (owner_acquired_tx, owner_acquired_rx) = mpsc::channel();
        let (release_owner_tx, release_owner_rx) = mpsc::channel();
        let (waiter_acquired_tx, waiter_acquired_rx) = mpsc::channel();

        let registry = REGISTRY.get_or_init(|| Mutex::new(Registry::default()));
        {
            let mut registry = registry.lock().unwrap();
            registry.creation_hooks.insert(
                key.clone(),
                Box::new(move || {
                    let _ = creation_started_tx.send(());
                    let _ = release_creation_rx.recv();
                }),
            );
            registry.waiting_hooks.insert(
                key.clone(),
                Box::new(move || {
                    let _ = waiter_reached_tx.send(());
                }),
            );
        }

        let creator_path = path.clone();
        let creator = std::thread::spawn(move || {
            let target = DatabaseFileTarget::for_test_path(&creator_path).unwrap();
            let binding = BoundDatabase::acquire(&target).unwrap();
            owner_acquired_tx.send(binding.token()).unwrap();
            release_owner_rx.recv().unwrap();
            drop(binding);
        });
        creation_started_rx.recv().unwrap();

        let waiter_path = path.clone();
        let waiter = std::thread::spawn(move || {
            let target = DatabaseFileTarget::for_test_path(&waiter_path).unwrap();
            let binding = BoundDatabase::acquire(&target).unwrap();
            waiter_acquired_tx.send(binding.token()).unwrap();
        });
        waiter_reached_rx.recv().unwrap();
        release_creation_tx.send(()).unwrap();

        let owner_token = owner_acquired_rx.recv().unwrap();
        let waiter_token = waiter_acquired_rx.recv().unwrap();
        assert_eq!(owner_token, waiter_token);
        release_owner_tx.send(()).unwrap();
        creator.join().unwrap();
        waiter.join().unwrap();

        let registry = registry.lock().unwrap();
        assert!(!registry.by_key.contains_key(&key));
        assert!(!registry.creating.contains_key(&key));
    }

    #[test]
    fn binding_test_hook_rejects_replacement_until_invoked() {
        let called = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let called_by_hook = Arc::clone(&called);
        let hook = Mutex::new(None);
        set_binding_test_hook(&hook, "witness", move || {
            called_by_hook.store(true, Ordering::SeqCst);
        })
        .unwrap();
        assert!(matches!(
            set_binding_test_hook(&hook, "witness", || {}),
            Err(Error::Conflict(message)) if message == "bound SQLite witness test hook is already set"
        ));
        invoke_binding_test_hook(&hook);
        assert!(called.load(Ordering::SeqCst));
    }

    fn call_vfs_open(bound: &BoundDatabase, name: *const std::os::raw::c_char, flags: i32) -> i32 {
        unsafe {
            let vfs = bound.vfs_pointer();
            let size = (*vfs).szOsFile as usize;
            let layout =
                std::alloc::Layout::from_size_align(size, std::mem::align_of::<u128>()).unwrap();
            let file = std::alloc::alloc_zeroed(layout).cast::<ffi::sqlite3_file>();
            assert!(!file.is_null());
            let mut out_flags = 0;
            let callback = (*vfs).xOpen.unwrap();
            let result = callback(vfs, name, file, flags, &mut out_flags);
            if result == ffi::SQLITE_OK {
                let methods = (*file).pMethods;
                let close = (*methods).xClose.unwrap();
                let close_result = close(file);
                assert_eq!(close_result, ffi::SQLITE_OK);
            }
            std::alloc::dealloc(file.cast(), layout);
            result
        }
    }

    fn call_vfs_access(bound: &BoundDatabase, name: &std::ffi::CStr) -> (i32, i32) {
        let mut exists = -1;
        let result =
            call_vfs_access_with_flags(bound, name, ffi::SQLITE_ACCESS_EXISTS, &mut exists);
        (result, exists)
    }

    fn call_vfs_access_with_flags(
        bound: &BoundDatabase,
        name: &std::ffi::CStr,
        flags: i32,
        out: *mut i32,
    ) -> i32 {
        unsafe {
            let vfs = bound.vfs_pointer();
            let callback = (*vfs).xAccess.unwrap();
            callback(vfs, name.as_ptr(), flags, out)
        }
    }

    #[cfg(unix)]
    fn call_vfs_full_pathname(
        bound: &BoundDatabase,
        name: *const std::os::raw::c_char,
        output: *mut std::os::raw::c_char,
        output_size: i32,
    ) -> i32 {
        unsafe {
            let vfs = bound.vfs_pointer();
            let callback = (*vfs).xFullPathname.unwrap();
            callback(vfs, name, output_size, output)
        }
    }

    fn call_vfs_delete(bound: &BoundDatabase, name: &std::ffi::CStr) -> i32 {
        unsafe {
            let vfs = bound.vfs_pointer();
            let callback = (*vfs).xDelete.unwrap();
            callback(vfs, name.as_ptr(), 0)
        }
    }

    #[cfg(unix)]
    #[test]
    fn unix_syscall_hooks_resolve_bound_paths_and_delegate_unbound_paths() {
        use std::{
            ffi::CString,
            os::{fd::FromRawFd, unix::ffi::OsStrExt},
        };

        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("syscall-witness.db3");
        std::fs::write(&path, b"database").unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let leaf = path.file_name().unwrap().to_str().unwrap();
        let directory_name = CString::new(format!("{RESERVED_PREFIX}{}", bound.token())).unwrap();
        let leaf_name =
            CString::new(format!("{RESERVED_PREFIX}{}/{}", bound.token(), leaf)).unwrap();
        let sidecar_name = CString::new(format!(
            "{RESERVED_PREFIX}{}/{}-journal",
            bound.token(),
            leaf
        ))
        .unwrap();
        let bad_token = CString::new(format!("{RESERVED_PREFIX}not-a-token/{leaf}")).unwrap();
        let invalid_remainder =
            CString::new(format!("{RESERVED_PREFIX}{}/../escape", bound.token())).unwrap();
        let overflowing_token =
            CString::new(format!("{RESERVED_PREFIX}999999999999999999999999999999")).unwrap();

        let directory_fd =
            unsafe { unix_hooks::open_hook(directory_name.as_ptr(), libc::O_RDONLY, 0) };
        assert!(directory_fd >= 0);
        let directory = unsafe { std::fs::File::from_raw_fd(directory_fd) };
        assert!(directory.metadata().unwrap().is_dir());
        drop(directory);

        let leaf_fd = unsafe { unix_hooks::open_hook(leaf_name.as_ptr(), libc::O_RDONLY, 0) };
        assert!(leaf_fd >= 0);
        let opened_leaf = unsafe { std::fs::File::from_raw_fd(leaf_fd) };
        assert_eq!(
            opened_leaf.metadata().unwrap().len(),
            b"database".len() as u64
        );
        drop(opened_leaf);

        for invalid in [&bad_token, &invalid_remainder, &overflowing_token] {
            assert_eq!(
                unsafe { unix_hooks::open_hook(invalid.as_ptr(), libc::O_RDONLY, 0) },
                -1
            );
            assert_eq!(unix_hooks::last_errno(), libc::ENOENT);
        }
        assert_eq!(
            unsafe { unix_hooks::open_hook(std::ptr::null(), libc::O_RDONLY, 0) },
            -1
        );
        assert_eq!(unix_hooks::last_errno(), libc::EINVAL);

        let mut directory_stat = std::mem::MaybeUninit::<libc::stat>::uninit();
        assert_eq!(
            unsafe { unix_hooks::stat_hook(directory_name.as_ptr(), directory_stat.as_mut_ptr()) },
            0
        );
        assert!(unsafe { directory_stat.assume_init() }.st_mode & libc::S_IFMT == libc::S_IFDIR);
        let mut leaf_stat = std::mem::MaybeUninit::<libc::stat>::uninit();
        assert_eq!(
            unsafe { unix_hooks::stat_hook(leaf_name.as_ptr(), leaf_stat.as_mut_ptr()) },
            0
        );
        assert_eq!(
            raw_libc_stat_identity(unsafe { &leaf_stat.assume_init() }),
            target.identity()
        );
        assert_eq!(
            unsafe { unix_hooks::stat_hook(leaf_name.as_ptr(), std::ptr::null_mut()) },
            -1
        );
        assert_eq!(unix_hooks::last_errno(), libc::EINVAL);
        assert_eq!(
            unsafe { unix_hooks::stat_hook(invalid_remainder.as_ptr(), leaf_stat.as_mut_ptr()) },
            -1
        );
        assert_eq!(unix_hooks::last_errno(), libc::ENOENT);

        assert_eq!(
            unsafe { unix_hooks::access_hook(directory_name.as_ptr(), libc::F_OK) },
            0
        );
        assert_eq!(
            unsafe { unix_hooks::access_hook(leaf_name.as_ptr(), libc::R_OK | libc::W_OK) },
            0
        );
        assert_eq!(
            unsafe { unix_hooks::access_hook(invalid_remainder.as_ptr(), libc::F_OK) },
            -1
        );
        assert_eq!(unix_hooks::last_errno(), libc::ENOENT);
        bound.fail_next_faccessat_with(libc::EACCES).unwrap();
        assert_eq!(
            unsafe { unix_hooks::access_hook(leaf_name.as_ptr(), libc::R_OK | libc::W_OK) },
            -1
        );
        assert_eq!(unix_hooks::last_errno(), libc::EACCES);
        assert_eq!(
            unsafe { unix_hooks::access_hook(std::ptr::null(), libc::F_OK) },
            -1
        );
        assert_eq!(unix_hooks::last_errno(), libc::EINVAL);

        assert_eq!(
            unsafe { unix_hooks::unlink_hook(directory_name.as_ptr()) },
            -1
        );
        assert_eq!(unix_hooks::last_errno(), libc::EISDIR);
        assert_eq!(unsafe { unix_hooks::unlink_hook(leaf_name.as_ptr()) }, -1);
        assert_eq!(unix_hooks::last_errno(), libc::EPERM);
        std::fs::write(path.with_file_name(format!("{leaf}-journal")), b"rollback").unwrap();
        assert_eq!(unsafe { unix_hooks::unlink_hook(sidecar_name.as_ptr()) }, 0);
        assert!(!path.with_file_name(format!("{leaf}-journal")).exists());
        assert_eq!(
            unsafe { unix_hooks::unlink_hook(invalid_remainder.as_ptr()) },
            -1
        );
        assert_eq!(unix_hooks::last_errno(), libc::ENOENT);
        assert_eq!(unsafe { unix_hooks::unlink_hook(std::ptr::null()) }, -1);
        assert_eq!(unix_hooks::last_errno(), libc::EINVAL);

        let unbound_path = root.path().join("plain-syscall-fallback");
        std::fs::write(&unbound_path, b"fallback").unwrap();
        let unbound_name = CString::new(unbound_path.as_os_str().as_bytes()).unwrap();
        let unbound_fd = unsafe { unix_hooks::open_hook(unbound_name.as_ptr(), libc::O_RDONLY, 0) };
        assert!(unbound_fd >= 0);
        drop(unsafe { std::fs::File::from_raw_fd(unbound_fd) });
        let mut unbound_stat = std::mem::MaybeUninit::<libc::stat>::uninit();
        assert_eq!(
            unsafe { unix_hooks::stat_hook(unbound_name.as_ptr(), unbound_stat.as_mut_ptr()) },
            0
        );
        assert_eq!(
            unsafe { unix_hooks::access_hook(unbound_name.as_ptr(), libc::R_OK) },
            0
        );
        assert_eq!(unsafe { unix_hooks::unlink_hook(unbound_name.as_ptr()) }, 0);
        assert!(!unbound_path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn unix_bound_vfs_access_and_full_path_callbacks_cover_sqlite_results() {
        use std::ffi::{CStr, CString};

        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("vfs-callbacks.db3");
        std::fs::write(&path, b"database contents").unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let leaf = path.file_name().unwrap().to_str().unwrap();
        let leaf_name =
            CString::new(format!("{RESERVED_PREFIX}{}/{}", bound.token(), leaf)).unwrap();
        let journal_name = CString::new(format!(
            "{RESERVED_PREFIX}{}/{}-journal",
            bound.token(),
            leaf
        ))
        .unwrap();
        let invalid_name =
            CString::new(format!("{RESERVED_PREFIX}{}/../outside", bound.token())).unwrap();

        let mut access_result = -1;
        assert_eq!(
            call_vfs_access_with_flags(
                &bound,
                &leaf_name,
                ffi::SQLITE_ACCESS_READ,
                &mut access_result,
            ),
            ffi::SQLITE_OK
        );
        assert_eq!(access_result, 1);
        assert_eq!(
            call_vfs_access_with_flags(
                &bound,
                &leaf_name,
                ffi::SQLITE_ACCESS_READWRITE,
                &mut access_result,
            ),
            ffi::SQLITE_OK
        );
        assert_eq!(access_result, 1);

        bound.fail_next_faccessat_with(libc::EACCES).unwrap();
        assert_eq!(
            call_vfs_access_with_flags(
                &bound,
                &leaf_name,
                ffi::SQLITE_ACCESS_READWRITE,
                &mut access_result,
            ),
            ffi::SQLITE_OK
        );
        assert_eq!(access_result, 0);
        bound.fail_next_faccessat_with(libc::EROFS).unwrap();
        assert_eq!(
            call_vfs_access_with_flags(
                &bound,
                &leaf_name,
                ffi::SQLITE_ACCESS_READWRITE,
                &mut access_result,
            ),
            ffi::SQLITE_OK
        );
        assert_eq!(access_result, 0);
        assert_eq!(
            call_vfs_access_with_flags(
                &bound,
                &leaf_name,
                // Not one of EXISTS (0), READWRITE (1) or READ (2).
                ffi::SQLITE_ACCESS_READWRITE | ffi::SQLITE_ACCESS_READ,
                &mut access_result,
            ),
            ffi::SQLITE_IOERR_ACCESS
        );
        assert_eq!(
            call_vfs_access_with_flags(
                &bound,
                &leaf_name,
                ffi::SQLITE_ACCESS_EXISTS,
                std::ptr::null_mut(),
            ),
            ffi::SQLITE_IOERR_ACCESS
        );
        assert_eq!(
            call_vfs_access(&bound, &invalid_name).0,
            ffi::SQLITE_IOERR_ACCESS
        );

        let journal_path = path.with_file_name(format!("{leaf}-journal"));
        std::fs::File::create(&journal_path).unwrap();
        assert_eq!(call_vfs_access(&bound, &journal_name), (ffi::SQLITE_OK, 0));
        assert!(bound
            .opened_names()
            .iter()
            .all(|name| name != &OsString::from(format!("{leaf}-journal"))));
        std::fs::write(&journal_path, b"rollback").unwrap();
        assert_eq!(call_vfs_access(&bound, &journal_name), (ffi::SQLITE_OK, 1));
        std::fs::remove_file(&journal_path).unwrap();
        assert_eq!(call_vfs_access(&bound, &journal_name), (ffi::SQLITE_OK, 0));

        let too_small = [0 as std::os::raw::c_char; 1];
        assert_eq!(
            call_vfs_full_pathname(
                &bound,
                leaf_name.as_ptr(),
                too_small.as_ptr().cast_mut(),
                too_small.len() as i32,
            ),
            ffi::SQLITE_CANTOPEN
        );
        let mut reserved_output = vec![0 as std::os::raw::c_char; 512];
        assert_eq!(
            call_vfs_full_pathname(
                &bound,
                leaf_name.as_ptr(),
                reserved_output.as_mut_ptr(),
                reserved_output.len() as i32,
            ),
            ffi::SQLITE_OK
        );
        assert_eq!(
            unsafe { CStr::from_ptr(reserved_output.as_ptr()) }.to_bytes(),
            leaf_name.to_bytes()
        );
        let unprefixed_name = CString::new(path.as_os_str().as_encoded_bytes()).unwrap();
        let mut full_path = vec![0 as std::os::raw::c_char; 4096];
        assert_eq!(
            call_vfs_full_pathname(
                &bound,
                unprefixed_name.as_ptr(),
                full_path.as_mut_ptr(),
                full_path.len() as i32,
            ),
            ffi::SQLITE_OK
        );
        assert!(!unsafe { CStr::from_ptr(full_path.as_ptr()) }
            .to_bytes()
            .is_empty());
        assert_eq!(
            call_vfs_full_pathname(
                &bound,
                std::ptr::null(),
                full_path.as_mut_ptr(),
                full_path.len() as i32,
            ),
            ffi::SQLITE_CANTOPEN
        );
        assert_eq!(
            call_vfs_full_pathname(
                &bound,
                unprefixed_name.as_ptr(),
                std::ptr::null_mut(),
                full_path.len() as i32,
            ),
            ffi::SQLITE_CANTOPEN
        );
        assert_eq!(
            call_vfs_full_pathname(&bound, leaf_name.as_ptr(), full_path.as_mut_ptr(), 0),
            ffi::SQLITE_CANTOPEN
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_failing_sidecar_stat_is_an_access_error_not_absence() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let parent = dir.path().join("authorized");
        std::fs::create_dir(&parent).unwrap();
        let path = parent.join("stat-error.db3");
        std::fs::File::create(&path).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let journal_name = CString::new(format!(
            "{RESERVED_PREFIX}{}/stat-error.db3-journal",
            bound.token()
        ))
        .unwrap();

        // Without search permission on the held directory, fstatat fails with EACCES; an
        // "absent" answer here would let SQLite skip a hot journal's rollback.
        std::fs::set_permissions(&parent, std::fs::Permissions::from_mode(0o600)).unwrap();
        let result = call_vfs_access(&bound, &journal_name);
        std::fs::set_permissions(&parent, std::fs::Permissions::from_mode(0o700)).unwrap();
        assert_eq!(result.0, ffi::SQLITE_IOERR_ACCESS);
    }

    #[cfg(unix)]
    #[test]
    fn malformed_reserved_names_are_refused_not_passed_through() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("names.db3");
        std::fs::File::create(&path).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let token = bound.token();
        let names = [
            format!("{RESERVED_PREFIX}/names.db3"),
            format!("{RESERVED_PREFIX}abc/names.db3"),
            format!("{RESERVED_PREFIX}{token}/"),
            format!("{RESERVED_PREFIX}{token}/."),
            format!("{RESERVED_PREFIX}{token}/.."),
        ];
        for name in names {
            let name = CString::new(name).unwrap();
            assert!(
                matches!(
                    unix_hooks::resolve(name.as_ptr()),
                    unix_hooks::Resolution::Refused(libc::ENOENT)
                ),
                "{name:?} must be refused"
            );
        }
    }

    #[cfg(all(unix, not(target_os = "linux")))]
    #[test]
    fn a_refused_descriptor_of_an_unbound_inode_is_not_retained() {
        use std::os::fd::{AsRawFd, IntoRawFd};

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("never-bound.db3");
        std::fs::File::create(&path).unwrap();
        let file = std::fs::File::open(&path).unwrap();
        let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
        assert_eq!(
            unsafe { libc::fstat(file.as_raw_fd(), stat.as_mut_ptr()) },
            0
        );
        let identity = raw_libc_stat_identity(unsafe { &stat.assume_init() });
        let fd = file.into_raw_fd();

        // No binding holds this inode, so this process holds no SQLite lock on it and the
        // descriptor is closed at once instead of being quarantined.
        retain_mismatched_descriptor(fd, identity);
        assert!(quarantined_descriptor_fds(identity).is_empty());
    }

    #[test]
    fn bound_vfs_refuses_escape_names_foreign_tokens_and_leaf_replacements() {
        use std::ffi::CString;

        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("owned.db3");
        let other_path = root.path().join("other.db3");
        let dead_path = root.path().join("dead.db3");
        let outside = root.path().join("outside.db3");
        std::fs::File::create(&path).unwrap();
        std::fs::File::create(&other_path).unwrap();
        std::fs::File::create(&dead_path).unwrap();
        std::fs::File::create(&outside).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let other_target = DatabaseFileTarget::for_test_path(&other_path).unwrap();
        let dead_target = DatabaseFileTarget::for_test_path(&dead_path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let other = BoundDatabase::acquire(&other_target).unwrap();
        let dead = BoundDatabase::acquire(&dead_target).unwrap();
        let dead_token = dead.token();
        drop(dead);
        let outside_name = CString::new(outside.to_str().unwrap()).unwrap();
        let foreign_present_path = root.path().join("other.db3-wal");
        std::fs::File::create(&foreign_present_path).unwrap();
        let foreign_present =
            CString::new(format!("{RESERVED_PREFIX}{}/other.db3-wal", other.token())).unwrap();
        let foreign_absent =
            CString::new(format!("{RESERVED_PREFIX}{}/other.db3-shm", other.token())).unwrap();
        let unregistered =
            CString::new(format!("{RESERVED_PREFIX}{}/owned.db3-wal", dead_token)).unwrap();
        let invalid_remainder =
            CString::new(format!("{RESERVED_PREFIX}{}/../outside.db3", bound.token())).unwrap();
        let own_sidecar =
            CString::new(format!("{RESERVED_PREFIX}{}/owned.db3-wal", bound.token())).unwrap();

        assert_eq!(
            call_vfs_open(
                &bound,
                outside_name.as_ptr(),
                ffi::SQLITE_OPEN_READWRITE | ffi::SQLITE_OPEN_CREATE
            ),
            ffi::SQLITE_CANTOPEN
        );
        assert_eq!(
            call_vfs_access(&bound, &outside_name).0,
            ffi::SQLITE_IOERR_ACCESS
        );
        assert_eq!(
            call_vfs_delete(&bound, &outside_name),
            ffi::SQLITE_IOERR_DELETE
        );
        assert_eq!(
            call_vfs_open(&bound, foreign_present.as_ptr(), ffi::SQLITE_OPEN_READWRITE),
            ffi::SQLITE_CANTOPEN
        );
        assert_eq!(
            call_vfs_access(&bound, &foreign_present).0,
            ffi::SQLITE_IOERR_ACCESS
        );
        assert_eq!(
            call_vfs_access(&bound, &foreign_absent).0,
            ffi::SQLITE_IOERR_ACCESS
        );
        assert_eq!(
            call_vfs_delete(&bound, &foreign_present),
            ffi::SQLITE_IOERR_DELETE
        );
        assert!(foreign_present_path.exists());
        assert_eq!(
            call_vfs_open(&bound, unregistered.as_ptr(), ffi::SQLITE_OPEN_READWRITE),
            ffi::SQLITE_CANTOPEN
        );
        assert_eq!(
            call_vfs_access(&bound, &unregistered).0,
            ffi::SQLITE_IOERR_ACCESS
        );
        assert_eq!(
            call_vfs_delete(&bound, &unregistered),
            ffi::SQLITE_IOERR_DELETE
        );
        assert_eq!(
            call_vfs_open(
                &bound,
                invalid_remainder.as_ptr(),
                ffi::SQLITE_OPEN_READWRITE
            ),
            ffi::SQLITE_CANTOPEN
        );
        assert_eq!(
            call_vfs_access(&bound, &invalid_remainder).0,
            ffi::SQLITE_IOERR_ACCESS
        );
        assert_eq!(
            call_vfs_delete(&bound, &invalid_remainder),
            ffi::SQLITE_IOERR_DELETE
        );
        assert_eq!(
            call_vfs_open(
                &bound,
                own_sidecar.as_ptr(),
                ffi::SQLITE_OPEN_READWRITE | ffi::SQLITE_OPEN_SUPER_JOURNAL
            ),
            ffi::SQLITE_CANTOPEN
        );
        assert_ne!(call_vfs_delete(&bound, &outside_name), ffi::SQLITE_OK);
        assert!(outside.exists());
        assert_eq!(
            call_vfs_open(
                &bound,
                std::ptr::null(),
                ffi::SQLITE_OPEN_TEMP_DB | ffi::SQLITE_OPEN_READWRITE | ffi::SQLITE_OPEN_CREATE
            ),
            ffi::SQLITE_OK
        );

        let replacement = root.path().join("replacement.db3");
        std::fs::File::create(&replacement).unwrap();
        let backup = root.path().join("owned.original.db3");
        std::fs::rename(&path, &backup).unwrap();
        std::fs::hard_link(&replacement, &path).unwrap();
        let own_leaf =
            CString::new(format!("{RESERVED_PREFIX}{}/owned.db3", bound.token())).unwrap();
        assert_eq!(
            call_vfs_access(&bound, &own_leaf).0,
            ffi::SQLITE_IOERR_ACCESS
        );
        std::fs::remove_file(&path).unwrap();
        std::fs::rename(backup, &path).unwrap();
        assert_ne!(call_vfs_delete(&bound, &own_leaf), ffi::SQLITE_OK);
        assert!(path.exists());
    }
}
