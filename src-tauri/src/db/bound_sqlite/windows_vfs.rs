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
