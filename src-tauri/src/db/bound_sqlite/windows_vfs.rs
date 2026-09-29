use super::*;
use std::{
    ffi::{c_char, c_int, CStr},
    panic::{catch_unwind, AssertUnwindSafe},
};

pub(super) unsafe fn register_vfs(
    token: u64,
    name: &CString,
) -> Result<*mut ffi::sqlite3_vfs, Error> {
    let original = unsafe { ffi::sqlite3_vfs_find(c"win32".as_ptr()) };
    if original.is_null() {
        return Err(Error::Conflict("SQLite win32 VFS is unavailable".into()));
    }
    let default = unsafe { *original };
    let mut base = default;
    base.pNext = std::ptr::null_mut();
    base.zName = name.as_ptr();
    base.xOpen = Some(vfs_open);
    base.xDelete = Some(vfs_delete);
    base.xAccess = Some(vfs_access);
    base.xFullPathname = Some(vfs_full_pathname);
    let vfs = Box::new(BoundVfs {
        base,
        token,
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

unsafe extern "C" fn vfs_open(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const c_char,
    file: *mut ffi::sqlite3_file,
    flags: c_int,
    out_flags: *mut c_int,
) -> c_int {
    match catch_unwind(AssertUnwindSafe(|| unsafe {
        vfs_open_inner(vfs, name, file, flags, out_flags)
    })) {
        Ok(result) => result,
        Err(_) => ffi::SQLITE_CANTOPEN,
    }
}

unsafe fn vfs_open_inner(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const c_char,
    file: *mut ffi::sqlite3_file,
    flags: c_int,
    out_flags: *mut c_int,
) -> c_int {
    if flags & ffi::SQLITE_OPEN_SUPER_JOURNAL != 0 {
        return ffi::SQLITE_CANTOPEN;
    }
    let Some(bound_vfs) = (unsafe { vfs.cast::<BoundVfs>().as_ref() }) else {
        return ffi::SQLITE_CANTOPEN;
    };
    if !name.is_null() {
        let registration = match registration_for(bound_vfs.token) {
            Ok(registration) => registration,
            Err(_) => return ffi::SQLITE_CANTOPEN,
        };
        match windows_hooks::resolve_utf8(name) {
            windows_hooks::Resolution::Child {
                registration: named,
                ..
            } if named.token == registration.token => {}
            _ => return ffi::SQLITE_CANTOPEN,
        }
    }
    let Some(open) = bound_vfs.default_open else {
        return ffi::SQLITE_CANTOPEN;
    };
    unsafe { open(vfs, name, file, flags, out_flags) }
}

unsafe extern "C" fn vfs_access(
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
                    let exists = flags != ffi::SQLITE_ACCESS_EXISTS
                        || info.nFileSizeHigh != 0
                        || info.nFileSizeLow != 0;
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
                    if error == windows_sys::Win32::Foundation::ERROR_ACCESS_DENIED && !is_leaf =>
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

unsafe extern "C" fn vfs_delete(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const c_char,
    sync_dir: c_int,
) -> c_int {
    match catch_unwind(AssertUnwindSafe(|| unsafe {
        vfs_delete_inner(vfs, name, sync_dir)
    })) {
        Ok(result) => result,
        Err(_) => ffi::SQLITE_IOERR_DELETE,
    }
}

unsafe fn vfs_delete_inner(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const c_char,
    sync_dir: c_int,
) -> c_int {
    let Some(bound_vfs) = (unsafe { vfs.cast::<BoundVfs>().as_ref() }) else {
        return ffi::SQLITE_IOERR_DELETE;
    };
    let registration = match registration_for(bound_vfs.token) {
        Ok(registration) => registration,
        Err(_) => return ffi::SQLITE_IOERR_DELETE,
    };
    match windows_hooks::resolve_utf8(name) {
        windows_hooks::Resolution::Child {
            registration: named,
            ..
        } if named.token == registration.token => {}
        _ => return ffi::SQLITE_IOERR_DELETE,
    }
    let Some(delete) = bound_vfs.default_delete else {
        return ffi::SQLITE_IOERR_DELETE;
    };
    unsafe { delete(vfs, name, sync_dir) }
}

unsafe extern "C" fn vfs_full_pathname(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const c_char,
    output_size: c_int,
    output: *mut c_char,
) -> c_int {
    match catch_unwind(AssertUnwindSafe(|| unsafe {
        vfs_full_pathname_inner(vfs, name, output_size, output)
    })) {
        Ok(result) => result,
        Err(_) => ffi::SQLITE_CANTOPEN,
    }
}

unsafe fn vfs_full_pathname_inner(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const c_char,
    output_size: c_int,
    output: *mut c_char,
) -> c_int {
    if name.is_null() || output.is_null() || output_size <= 0 {
        return ffi::SQLITE_CANTOPEN;
    }
    let bytes = unsafe { CStr::from_ptr(name) }.to_bytes();
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
