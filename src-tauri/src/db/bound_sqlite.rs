//! SQLite opens for authorized databases use a reserved URI name that cannot
//! name a real file. Unix and Windows syscall hooks resolve that name through
//! a retained parent directory handle, and each binding owns its SQLite VFS
//! until every connection using it has closed. Production code must not open
//! SQLite by a plain pathname under `/<chessfable-bound>/`; the only remaining
//! plain-path production open is the private puzzle snapshot in the temp dir.

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

struct Binding {
    parent: File,
    leaf: OsString,
    identity: (u64, u64),
    refusal_count: AtomicU64,
    #[cfg(test)]
    opened_names: Mutex<Vec<OsString>>,
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

        let registration = (|| {
            let parent = target.parent().try_clone()?;
            let binding = Binding {
                parent,
                leaf,
                identity,
                refusal_count: AtomicU64::new(0),
                #[cfg(test)]
                opened_names: Mutex::new(Vec::new()),
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
}

fn binding_key_leaf(leaf: &OsStr) -> OsString {
    #[cfg(windows)]
    {
        OsString::from(leaf.to_string_lossy().to_lowercase())
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
        #[cfg(target_os = "linux")]
        unsafe {
            *libc::__errno_location() = value;
        }
        #[cfg(target_os = "macos")]
        unsafe {
            *libc::__error() = value;
        }
    }

    fn syscall_failure(error: c_int) -> c_int {
        set_errno(error);
        -1
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

    fn set_opened_name(registration: &Registration, name: &OsStr) -> Result<(), c_int> {
        #[cfg(test)]
        {
            let mut opened = registration
                .binding
                .opened_names
                .lock()
                .map_err(|_| libc::EIO)?;
            opened.push(name.to_os_string());
        }
        #[cfg(not(test))]
        let _ = (registration, name);
        Ok(())
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

    unsafe fn open_hook_inner(path: *const c_char, flags: c_int, mode: c_int) -> c_int {
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
                    mode as libc::mode_t,
                )
            },
            Resolution::Child {
                registration,
                name,
                is_leaf,
            } => {
                if is_leaf {
                    // Refuse a swapped leaf before opening it: closing a descriptor on another
                    // inode would release every POSIX lock this process holds on that inode.
                    // The check after the open still covers a swap between the two calls.
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
                        && raw_libc_stat_identity(unsafe { &stat.assume_init() })
                            != registration.binding.identity
                    {
                        increment_refusal(&registration.binding);
                        return syscall_failure(libc::ESTALE);
                    }
                }
                let fd = unsafe {
                    libc::openat(
                        registration.binding.parent.as_raw_fd(),
                        name.as_ptr(),
                        flags | libc::O_NOFOLLOW,
                        mode as libc::mode_t,
                    )
                };
                if fd < 0 {
                    return fd;
                }
                if is_leaf {
                    let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
                    if unsafe { libc::fstat(fd, stat.as_mut_ptr()) } != 0 {
                        let error = last_errno();
                        unsafe { libc::close(fd) };
                        return syscall_failure(error);
                    }
                    let stat = unsafe { stat.assume_init() };
                    let identity = raw_libc_stat_identity(&stat);
                    if identity != registration.binding.identity {
                        increment_refusal(&registration.binding);
                        unsafe { libc::close(fd) };
                        return syscall_failure(libc::ESTALE);
                    }
                }
                if set_opened_name(&registration, OsStr::from_bytes(name.as_bytes())).is_err() {
                    unsafe { libc::close(fd) };
                    return syscall_failure(libc::EIO);
                }
                fd
            }
        }
    }

    unsafe extern "C" fn stat_hook(path: *const c_char, output: *mut libc::stat) -> c_int {
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
                if is_leaf
                    && raw_libc_stat_identity(unsafe { &*output }) != registration.binding.identity
                {
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
                libc::faccessat(
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
                    if raw_libc_stat_identity(&stat) != registration.binding.identity {
                        increment_refusal(&registration.binding);
                        return syscall_failure(libc::ESTALE);
                    }
                }
                unsafe {
                    libc::faccessat(
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
        if is_leaf {
            let stat = unsafe { stat.assume_init() };
            if raw_libc_stat_identity(&stat) != registration.binding.identity {
                increment_refusal(&registration.binding);
                return ffi::SQLITE_IOERR_ACCESS;
            }
        }
        unsafe { *out = 1 };
        if flags == ffi::SQLITE_ACCESS_READWRITE {
            let result = unsafe {
                libc::faccessat(
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
mod windows_hooks;

#[cfg(windows)]
mod windows_vfs;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_sqlite_version_is_pinned_for_the_hook_set() {
        assert_eq!(ffi::SQLITE_VERSION_NUMBER, 3_039_002);
        assert_eq!(ffi::SQLITE_VERSION, b"3.39.2\0");
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
        let path = dir.path().join("percent%question?#.db3");
        std::fs::File::create(&path).unwrap();
        let target = DatabaseFileTarget::for_test_path(&path).unwrap();
        let bound = BoundDatabase::acquire(&target).unwrap();
        let uri = bound.uri(SqliteMode::ReadWrite).unwrap();
        assert!(uri.starts_with(RESERVED_URI_PREFIX));
        assert!(uri.contains("percent%25question%3F%23.db3"));
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
            std::fs::File::create(&path).unwrap();
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
        unsafe {
            let vfs = bound.vfs_pointer();
            let mut exists = -1;
            let callback = (*vfs).xAccess.unwrap();
            let result = callback(vfs, name.as_ptr(), ffi::SQLITE_ACCESS_EXISTS, &mut exists);
            (result, exists)
        }
    }

    fn call_vfs_delete(bound: &BoundDatabase, name: &std::ffi::CStr) -> i32 {
        unsafe {
            let vfs = bound.vfs_pointer();
            let callback = (*vfs).xDelete.unwrap();
            callback(vfs, name.as_ptr(), 0)
        }
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
