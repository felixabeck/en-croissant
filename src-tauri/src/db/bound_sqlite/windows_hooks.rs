use super::*;
use std::{
    ffi::OsString,
    os::windows::fs::MetadataExt,
    os::windows::{ffi::OsStringExt, io::AsRawHandle},
    panic::{catch_unwind, AssertUnwindSafe},
};
use windows_sys::{
    core::BOOL,
    Win32::{
        Foundation::{
            GetLastError, SetLastError, ERROR_ACCESS_DENIED, ERROR_FILE_INVALID,
            ERROR_FILE_NOT_FOUND, ERROR_INVALID_PARAMETER, ERROR_PATH_NOT_FOUND, FILETIME,
            GENERIC_READ, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE,
        },
        Security::SECURITY_ATTRIBUTES,
        Storage::FileSystem::{
            FileDispositionInfo, GetFileInformationByHandle, SetFileInformationByHandle,
            BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_NORMAL, FILE_ATTRIBUTE_REPARSE_POINT,
            FILE_SHARE_READ, FILE_SHARE_WRITE, INVALID_FILE_ATTRIBUTES, WIN32_FILE_ATTRIBUTE_DATA,
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
type GetAttributesExFn = unsafe extern "system" fn(*const u16, i32, *mut std::ffi::c_void) -> BOOL;

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
    let leaf = registration.binding.leaf.to_string_lossy().to_lowercase();
    let child = name.to_string_lossy().to_lowercase();
    let leaf_match = child == leaf;
    let valid = leaf_match
        || ["-wal", "-shm", "-journal"]
            .iter()
            .any(|suffix| child == format!("{leaf}{suffix}"));
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
        desired_access,
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
    let file = open_relative(
        registration,
        name,
        1, // FILE_OPEN
        GENERIC_READ,
        true,
    )?;
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
            let valid_access =
                desired_access == GENERIC_READ || desired_access == GENERIC_READ | GENERIC_WRITE;
            let valid_disposition = matches!(creation_disposition, 1 | 3 | 4);
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
                3 => 1, // OPEN_EXISTING -> FILE_OPEN
                4 => 3, // OPEN_ALWAYS -> FILE_OPEN_IF
                1 => 2, // CREATE_NEW -> FILE_CREATE
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
            let file = match open_relative(&registration, &name, nt_disposition, access, false) {
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

unsafe extern "system" fn delete_file_hook(path: *const u16) -> BOOL {
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
                1,
                windows_sys::Win32::Storage::FileSystem::DELETE,
                true,
            ) {
                Ok(file) => file,
                Err(error) => {
                    unsafe { SetLastError(error) };
                    return 0;
                }
            };
            let disposition =
                windows_sys::Win32::Storage::FileSystem::FILE_DISPOSITION_INFO { DeleteFile: true };
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
                Err(error) if error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND => {
                    unsafe { SetLastError(error) };
                    return 0;
                }
                Err(error) if error == ERROR_ACCESS_DENIED && !is_leaf => {
                    let mut info: WIN32_FILE_ATTRIBUTE_DATA = unsafe { std::mem::zeroed() };
                    info.dwFileAttributes = FILE_ATTRIBUTE_REPARSE_POINT;
                    info.nFileSizeLow = 1;
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
            get_attributes: syscall::<GetAttributesFn>(get(vfs, c"GetFileAttributesW".as_ptr()))?,
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
