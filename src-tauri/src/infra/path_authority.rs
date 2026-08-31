//! Capability-based authority for native paths.
//!
//! Physical paths never cross the renderer boundary. A [`PathRef`] is an opaque capability
//! identifier, and every operation is checked at resolution time. Persistent entries retain
//! filesystem identity; replacement or disappearance makes them unavailable instead of granting
//! authority to the object that happened to appear at the old location.

#![allow(dead_code)] // Foundation API; command consumers are migrated separately.

use crate::{
    error::Error,
    infra::fs::{atomic_replace, AtomicFileOutcome, AtomicInstalledFile},
};
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use specta::Type;
use std::{
    collections::{BTreeMap, HashMap},
    ffi::{OsStr, OsString},
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, SystemTime},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

const SCHEMA_VERSION: u32 = 1;

/// Opaque renderer-safe identifier. It deliberately has no path parsing API.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct PathRef {
    pub id: String,
}
impl PathRef {
    fn fresh() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
        }
    }
}

/// Renderer-safe handle for one authority-managed file workspace. It cannot contain a native
/// path, and PGN commands accept this type rather than a generic capability id.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct FileWorkspaceHandle {
    pub id: PathRef,
    pub kind: FileWorkspaceHandleKind,
}

/// Backend-only sealed workspace entry. The native path is retained only for registry rebinding;
/// all namespace mutations use `parent`/`directory` file descriptors and the single leaf name.
pub(crate) struct WorkspaceMutationTarget {
    pub(crate) parent: fs::File,
    pub(crate) directory: Option<fs::File>,
    pub(crate) leaf: OsString,
    pub(crate) identity: (u64, u64),
    pub(crate) is_dir: bool,
    path: PathBuf,
}
/// Retained no-follow parent descriptor for a database file. Callers must not
/// reopen `leaf` by pathname for create, unlink, or mmap; use this parent with
/// `openat` / `unlinkat` / `atomic_replace_at`.
pub(crate) struct DatabaseFileTarget {
    pub(crate) parent: fs::File,
    pub(crate) leaf: OsString,
    pub(crate) identity: (u64, u64),
}

#[cfg(unix)]
struct RetainedWorkspaceTarget {
    parent: fs::File,
    leaf: OsString,
    identity: (u64, u64),
    target_is_dir: bool,
    path: PathBuf,
}
impl WorkspaceMutationTarget {
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }
    pub(crate) fn directory(&self) -> Result<&fs::File, Error> {
        self.directory
            .as_ref()
            .ok_or_else(|| Error::InvalidInput("workspace entry must be a directory".into()))
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FileWorkspaceHandleKind {
    FileWorkspace,
}
impl FileWorkspaceHandle {
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: FileWorkspaceHandleKind::FileWorkspace,
        }
    }
}

/// Opaque handle for a database root.  A root is the only capability that may
/// create or discover database children; the renderer never supplies a path or
/// a relative component.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct DatabaseRootHandle {
    pub id: PathRef,
    pub kind: DatabaseRootHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DatabaseRootHandleKind {
    DatabaseRoot,
}

/// Opaque handle for the active puzzle-database directory. It is deliberately
/// distinct from the game-database root so puzzle commands cannot be routed to
/// a general database workspace by mistake.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct PuzzleRootHandle {
    pub id: PathRef,
    pub kind: PuzzleRootHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PuzzleRootHandleKind {
    PuzzleRoot,
}
impl PuzzleRootHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: PuzzleRootHandleKind::PuzzleRoot,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PuzzleRootDescriptor {
    pub root: PuzzleRootHandle,
    pub display_name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PuzzleDatabaseDescriptor {
    pub file: PathRef,
    pub filename: String,
}
impl DatabaseRootHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: DatabaseRootHandleKind::DatabaseRoot,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Opaque handle for one exact database file.  It is deliberately a distinct
/// type from a generic path capability so a database command cannot accidentally
/// be called with a PGN, puzzle, or download destination capability.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct DatabaseHandle {
    pub id: PathRef,
    pub kind: DatabaseHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DatabaseHandleKind {
    Database,
}
impl DatabaseHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: DatabaseHandleKind::Database,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Opaque authority-managed engine installation root.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct EngineRootHandle {
    pub id: PathRef,
    pub kind: EngineRootHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineRootHandleKind {
    EngineRoot,
}
impl EngineRootHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: EngineRootHandleKind::EngineRoot,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Opaque exact executable capability. It is distinct from its installation root.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct EngineHandle {
    pub id: PathRef,
    pub kind: EngineHandleKind,
}

/// Opaque, persistent native resource used as a UCI option value.  It is
/// intentionally distinct from executables and workspaces: a resource picker
/// can grant only a file or directory to an engine option, never authority to
/// execute it or inspect siblings.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EngineResourceHandle {
    pub id: PathRef,
    pub kind: EngineResourceHandleKind,
    pub display_name: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineResourceHandleKind {
    File,
    Directory,
}
impl EngineResourceHandle {
    pub(crate) fn new(id: PathRef, kind: EngineResourceHandleKind, display_name: String) -> Self {
        Self {
            id,
            kind,
            display_name,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Backend-only lease for a resource passed to an engine.  The descriptor is
/// retained for the complete process lifetime, so replacement cannot redirect
/// an engine's lazy access after UCI configuration.
#[derive(Debug)]
pub(crate) struct EngineResourceLease {
    #[cfg(unix)]
    file: fs::File,
    #[cfg(windows)]
    file: fs::File,
    #[cfg(windows)]
    target: PathBuf,
}
impl EngineResourceLease {
    #[cfg(unix)]
    pub(crate) fn uci_value(&self) -> String {
        use std::os::fd::AsRawFd;
        format!("/proc/self/fd/{}", self.file.as_raw_fd())
    }
    #[cfg(windows)]
    pub(crate) fn uci_value(&self) -> String {
        self.target.to_string_lossy().into_owned()
    }
}
#[cfg(all(test, unix))]
impl EngineResourceLease {
    pub(crate) fn test_file(file: fs::File) -> Self {
        Self { file }
    }
}
#[cfg(all(test, unix))]
impl EngineExecutable {
    pub(crate) fn test_fixture(
        file: fs::File,
        working_directory: PathBuf,
        resource_leases: Vec<EngineResourceLease>,
    ) -> Self {
        Self {
            file,
            working_directory,
            resource_leases,
        }
    }
}

/// Opaque app-owned engine-image asset. Native code alone knows the copied
/// image path; the renderer can safely persist only this handle.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct EngineImageHandle {
    pub id: PathRef,
    pub kind: EngineImageHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineImageHandleKind {
    EngineImage,
}
impl EngineImageHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: EngineImageHandleKind::EngineImage,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineHandleKind {
    Engine,
}

/// Opaque exact opening-book file. It cannot be used where an executable or generic file
/// capability is expected.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct OpeningBookHandle {
    pub id: PathRef,
    pub kind: OpeningBookHandleKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum OpeningBookHandleKind {
    OpeningBook,
}
/// Backend-only descriptor for the exact authority-validated opening-book file.
/// It intentionally retains an opened file instead of a path, so parsing cannot
/// be redirected by a replacement after capability resolution.
pub(crate) struct OpeningBookDescriptor {
    pub(crate) file_name: String,
    file: fs::File,
}

impl OpeningBookDescriptor {
    /// Reads the already-opened file in bounded chunks. Cancellation is checked
    /// between reads, keeping the single blocking opening-book worker responsive.
    pub(crate) fn read_bounded_bytes_cancellable(
        &mut self,
        max_bytes: usize,
        cancellation: &CancellationToken,
    ) -> Result<Vec<u8>, Error> {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let declared = self.file.metadata()?.len();
        if declared > max_bytes as u64 {
            return Err(Error::ResourceLimit(
                "opening book exceeds the configured size limit".into(),
            ));
        }

        let mut bytes = Vec::with_capacity(usize::try_from(declared).unwrap_or(max_bytes));
        let mut chunk = [0_u8; 16 * 1024];
        loop {
            if cancellation.is_cancelled() {
                return Err(Error::Cancellation);
            }
            let read = self.file.read(&mut chunk)?;
            if read == 0 {
                break;
            }
            let new_len = bytes.len().checked_add(read).ok_or_else(|| {
                Error::ResourceLimit("opening book exceeds the configured size limit".into())
            })?;
            if new_len > max_bytes {
                return Err(Error::ResourceLimit(
                    "opening book exceeds the configured size limit".into(),
                ));
            }
            bytes.extend_from_slice(&chunk[..read]);
        }
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        Ok(bytes)
    }
}
impl OpeningBookHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: OpeningBookHandleKind::OpeningBook,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

/// Backend-only sealed executable object. It owns the revalidated opened executable; callers
/// cannot obtain a filesystem path from a renderer capability.
pub(crate) struct EngineExecutable {
    #[cfg(unix)]
    file: fs::File,
    working_directory: PathBuf,
    resource_leases: Vec<EngineResourceLease>,
    #[cfg(windows)]
    file: fs::File,
    #[cfg(windows)]
    command_path: PathBuf,
}
impl EngineExecutable {
    /// Linux executes the already-opened inode through its stable procfs descriptor. This avoids
    /// a second pathname lookup between authority validation and process creation.
    #[cfg(unix)]
    pub(crate) fn command_target(&self) -> PathBuf {
        use std::os::fd::AsRawFd;
        PathBuf::from(format!("/proc/self/fd/{}", self.file.as_raw_fd()))
    }
    /// Windows CreateProcess accepts a path, not an opened executable handle.
    /// The kept no-delete handle seals that exact file until spawn completes,
    /// so the path cannot be replaced between authority validation and launch.
    #[cfg(windows)]
    pub(crate) fn command_target(&self) -> &Path {
        &self.command_path
    }
    pub(crate) fn working_directory(&self) -> &Path {
        &self.working_directory
    }
    /// Descriptors the child must be able to reach after `exec`: every resource
    /// lease, plus the sealed engine image itself.
    ///
    /// The image descriptor is included because `command_target` launches the
    /// engine as `/proc/self/fd/N`. When that inode is an interpreter script the
    /// kernel re-executes the interpreter with `/proc/self/fd/N` as its argument,
    /// so the interpreter must still be able to open descriptor `N` to read the
    /// script. With the default close-on-exec flag it cannot: the failure is a
    /// hard `ENOENT` at launch for every script-wrapped engine, not a silent
    /// redirection to the visible path. Reading the script back through the
    /// descriptor keeps the already-established sealing property intact.
    ///
    /// Note that `pre_exec` clears close-on-exec once, in the forked child, and
    /// nothing re-sets it. Anything the engine itself spawns therefore inherits
    /// these descriptors too. That has always been true of resource leases; the
    /// engine image joins the same set, and it is no more sensitive than the
    /// leases, being the program the engine is already running.
    #[cfg(unix)]
    pub(crate) fn inherited_fds(&self) -> Vec<std::os::fd::RawFd> {
        use std::os::fd::AsRawFd;
        self.resource_leases
            .iter()
            .map(|lease| lease.file.as_raw_fd())
            .chain(std::iter::once(self.file.as_raw_fd()))
            .collect()
    }
    pub(crate) fn with_resource_leases(
        mut self,
        resource_leases: Vec<EngineResourceLease>,
    ) -> Self {
        self.resource_leases = resource_leases;
        self
    }
}
impl EngineHandle {
    pub(crate) fn new(id: PathRef) -> Self {
        Self {
            id,
            kind: EngineHandleKind::Engine,
        }
    }
    pub(crate) fn path_ref(&self) -> &PathRef {
        &self.id
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseDescriptor {
    pub handle: DatabaseHandle,
    pub filename: String,
    pub availability: PathAvailability,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileWorkspaceDescriptor {
    pub handle: FileWorkspaceHandle,
    pub display_name: String,
    pub availability: PathAvailability,
}

/// A completed native download with a usable opaque file capability. Durability uncertainty is
/// reported without asking callers to retry a mutation that may already have committed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactPublication {
    pub handle: FileWorkspaceHandle,
    pub durability: CommitDurability,
}

#[derive(Clone)]
pub(crate) struct PendingArtifactReservation {
    id: PathRef,
    payload_size: u64,
    payload_sha256: String,
}

/// The lifetime and scope of a path capability.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PathClass {
    AppOwnedRoot,
    PersistentCustomRoot,
    PersistentFile,
    SingleDialogGrant,
    BoundedDialogGrant,
}

/// Exact least-privilege operation accepted by a capability.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PathOperation {
    ReadPgn,
    WritePgn,
    DatabaseRead,
    DatabaseMutate,
    DatabaseCreate,
    DatabaseExport,
    PuzzleRead,
    PuzzleDelete,
    EngineExecute,
    EngineConfigure,
    EngineBinaryInspect,
    EngineResourceRead,
    OpeningBookRead,
    ImageRead,
    DownloadFile,
    DownloadArchive,
    EngineInstall,
    SnapshotWrite,
    LogWrite,
    OpenShell,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PathAvailability {
    Available,
    Unavailable,
}

/// The only path metadata intentionally exposed to the renderer.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PathDescriptor {
    pub id: PathRef,
    pub display_name: String,
    pub class: PathClass,
    pub availability: PathAvailability,
}

/// Persistence result paired with a committed path identifier. `DurabilityUncertain` means the
/// replacement happened but syncing its parent directory failed; callers must not retry.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub enum CommitDurability {
    Durable,
    DurabilityUncertain(crate::error::DurabilityStage),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum WorkspaceRemovalStatus {
    Complete,
    Partial,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct PathCommit {
    pub id: PathRef,
    pub durability: CommitDurability,
}
impl std::ops::Deref for PathCommit {
    type Target = PathRef;
    fn deref(&self) -> &Self::Target {
        &self.id
    }
}
impl PartialEq<PathCommit> for PathRef {
    fn eq(&self, other: &PathCommit) -> bool {
        self == &other.id
    }
}
impl PartialEq<PathRef> for PathCommit {
    fn eq(&self, other: &PathRef) -> bool {
        &self.id == other
    }
}

#[derive(Clone, Debug)]
pub struct AppOwnedRoot {
    pub id: PathRef,
    pub display_name: String,
    pub path: PathBuf,
    pub operations: Vec<PathOperation>,
}
impl AppOwnedRoot {
    pub fn new(
        display_name: impl Into<String>,
        path: PathBuf,
        operations: Vec<PathOperation>,
    ) -> Self {
        Self {
            id: PathRef::fresh(),
            display_name: display_name.into(),
            path,
            operations,
        }
    }
}

pub trait Clock: Send + Sync {
    fn now(&self) -> SystemTime;
}
#[derive(Default)]
pub struct SystemClock;
impl Clock for SystemClock {
    fn now(&self) -> SystemTime {
        SystemTime::now()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "platform", rename_all = "camelCase")]
enum NativePath {
    Unix { bytes: String },
    Windows { utf16: Vec<u16> },
}
impl NativePath {
    fn from_path(path: &Path) -> Self {
        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStrExt;
            Self::Unix {
                bytes: STANDARD_NO_PAD.encode(path.as_os_str().as_bytes()),
            }
        }
        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            Self::Windows {
                utf16: path.as_os_str().encode_wide().collect(),
            }
        }
        #[cfg(not(any(unix, windows)))]
        compile_error!("path authority needs a native path codec");
    }
    fn to_path(&self) -> Result<PathBuf, Error> {
        match self {
            #[cfg(unix)]
            Self::Unix { bytes } => {
                use std::os::unix::ffi::OsStringExt;
                Ok(PathBuf::from(OsString::from_vec(
                    STANDARD_NO_PAD
                        .decode(bytes)
                        .map_err(|_| Error::InvalidInput("invalid stored native path".into()))?,
                )))
            }
            #[cfg(windows)]
            Self::Windows { utf16 } => {
                use std::os::windows::ffi::OsStringExt;
                Ok(PathBuf::from(OsString::from_wide(utf16)))
            }
            #[allow(unreachable_patterns)]
            _ => Err(Error::InvalidInput(
                "registry path belongs to another platform".into(),
            )),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
struct Identity {
    a: u64,
    b: u64,
}
fn identity(path: &Path) -> Result<Identity, Error> {
    let meta = fs::symlink_metadata(path)?;
    if meta.file_type().is_symlink() || is_reparse_point(&meta) {
        return Err(Error::InvalidInput(
            "symbolic links are not path authorities".into(),
        ));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Ok(Identity {
            a: meta.dev(),
            b: meta.ino(),
        })
    }
    #[cfg(windows)]
    {
        windows_identity(path)
    }
}

fn sha256_file(path: &Path) -> Result<(u64, String), Error> {
    let mut file = fs::File::open(path)?;
    sha256_open_file(&mut file)
}

fn sha256_open_file(file: &mut fs::File) -> Result<(u64, String), Error> {
    let mut hasher = Sha256::new();
    let mut size = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        size = size.checked_add(read as u64).ok_or_else(|| {
            Error::ResourceLimit("artifact payload exceeds supported size".into())
        })?;
        hasher.update(&buffer[..read]);
    }
    Ok((size, format!("{:x}", hasher.finalize())))
}

/// Change stamp paired with the opaque file identity. It is never a standalone authority check:
/// Unix uses inode ctime; Windows uses the handle's last-write FILETIME. Platforms without a
/// stable handle timestamp reject post-rename marker publication rather than making a claim.
fn opened_file_change_nanos(file: &fs::File) -> Result<i128, Error> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let metadata = file.metadata()?;
        return Ok(i128::from(metadata.ctime()) * 1_000_000_000 + i128::from(metadata.ctime_nsec()));
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        return Ok(i128::from(file.metadata()?.last_write_time()));
    }
    #[allow(unreachable_code)]
    Err(Error::Conflict(
        "post-rename marker timestamps are unsupported on this platform".into(),
    ))
}
/// Stable identity for an already-opened regular file. This intentionally exposes no path and
/// uses the Windows handle index instead of lossy metadata fallbacks.
pub(crate) fn opened_file_identity(file: &fs::File) -> Result<(u64, u64), Error> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let meta = file.metadata()?;
        Ok((meta.dev(), meta.ino()))
    }
    #[cfg(windows)]
    {
        let identity = windows_file_identity(file)?;
        Ok((identity.a, identity.b))
    }
}
#[cfg(not(windows))]
fn is_reparse_point(_: &fs::Metadata) -> bool {
    false
}
#[cfg(windows)]
fn is_reparse_point(meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    meta.file_attributes() & windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT
        != 0
}
#[cfg(windows)]
fn windows_identity(path: &Path) -> Result<Identity, Error> {
    let file = open_windows_nofollow(path, false)?;
    windows_file_identity(&file)
}
#[cfg(windows)]
fn windows_file_identity(file: &fs::File) -> Result<Identity, Error> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::GetFileInformationByHandle;
    let mut info = unsafe { std::mem::zeroed() };
    if unsafe { GetFileInformationByHandle(file.as_raw_handle() as _, &mut info) } == 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(Identity {
        a: info.dwVolumeSerialNumber as u64,
        b: ((info.nFileIndexHigh as u64) << 32) | info.nFileIndexLow as u64,
    })
}
/// Opens one child relative to an already-opened directory with `NtCreateFile`. The child name
/// is a single component and the OS resolves it below `RootDirectory`; mutable ancestor strings
/// are never concatenated or reopened during traversal.
#[cfg(windows)]
fn open_windows_child(
    dir: &fs::File,
    name: &OsStr,
    writable: bool,
    directory: bool,
    allow_delete_share: bool,
) -> Result<fs::File, Error> {
    use std::{
        mem::{size_of, zeroed},
        os::windows::{
            ffi::OsStrExt,
            io::{AsRawHandle, FromRawHandle, RawHandle},
        },
        ptr::null_mut,
    };
    use windows_sys::{
        Wdk::{
            Foundation::{IO_STATUS_BLOCK, OBJECT_ATTRIBUTES},
            Storage::FileSystem::{NtCreateFile, FILE_OPEN},
        },
        Win32::{
            Foundation::{HANDLE, UNICODE_STRING},
            Storage::FileSystem::{
                FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, SYNCHRONIZE,
            },
        },
    };
    const OBJ_CASE_INSENSITIVE: u32 = 0x40;
    const OBJ_DONT_REPARSE: u32 = 0x1000;
    const FILE_DIRECTORY_FILE: u32 = 0x1;
    const FILE_NON_DIRECTORY_FILE: u32 = 0x40;
    const FILE_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
    const GENERIC_READ: u32 = 0x8000_0000;
    const GENERIC_WRITE: u32 = 0x4000_0000;
    let mut wide: Vec<u16> = name.encode_wide().collect();
    let mut unicode = UNICODE_STRING {
        Length: (wide.len() * 2) as u16,
        MaximumLength: (wide.len() * 2) as u16,
        Buffer: wide.as_mut_ptr(),
    };
    let mut attributes = OBJECT_ATTRIBUTES {
        Length: size_of::<OBJECT_ATTRIBUTES>() as u32,
        RootDirectory: dir.as_raw_handle() as _,
        ObjectName: &mut unicode,
        Attributes: OBJ_CASE_INSENSITIVE | OBJ_DONT_REPARSE,
        SecurityDescriptor: null_mut(),
        SecurityQualityOfService: null_mut(),
    };
    let mut handle: HANDLE = null_mut();
    let mut status: IO_STATUS_BLOCK = unsafe { zeroed() };
    let desired = SYNCHRONIZE | GENERIC_READ | if writable { GENERIC_WRITE } else { 0 };
    let options = FILE_OPEN_REPARSE_POINT
        | if directory {
            FILE_DIRECTORY_FILE
        } else {
            FILE_NON_DIRECTORY_FILE
        };
    let result = unsafe {
        NtCreateFile(
            &mut handle,
            desired,
            &mut attributes,
            &mut status,
            null_mut(),
            0,
            FILE_SHARE_READ
                | FILE_SHARE_WRITE
                | if allow_delete_share {
                    FILE_SHARE_DELETE
                } else {
                    0
                },
            FILE_OPEN,
            options,
            null_mut(),
            0,
        )
    };
    if result != 0 {
        return Err(std::io::Error::from_raw_os_error(result).into());
    }
    let file = unsafe { fs::File::from_raw_handle(handle as RawHandle) };
    if is_reparse_point(&file.metadata()?) {
        return Err(Error::InvalidInput(
            "reparse points cannot be authorized".into(),
        ));
    }
    Ok(file)
}

fn allows_delete_sharing_for_operation(operation: PathOperation, is_final_leaf: bool) -> bool {
    !is_final_leaf
        || !matches!(
            operation,
            PathOperation::EngineExecute | PathOperation::EngineConfigure
        )
}
#[cfg(windows)]
fn open_windows_nofollow(path: &Path, writable: bool) -> Result<fs::File, Error> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ, FILE_SHARE_WRITE,
    };
    let mut options = fs::OpenOptions::new();
    options
        .read(true)
        .write(writable)
        // Keep the opened authorized executable/file from being replaced until
        // a caller that relies on this descriptor has finished its operation.
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS);
    let file = options.open(path)?;
    if is_reparse_point(&file.metadata()?) {
        return Err(Error::InvalidInput(
            "reparse points cannot be authorized".into(),
        ));
    }
    Ok(file)
}
fn class_is_root(class: PathClass) -> bool {
    matches!(
        class,
        PathClass::AppOwnedRoot | PathClass::PersistentCustomRoot
    )
}
fn validate_target(path: &Path, class: PathClass) -> Result<Identity, Error> {
    let meta = fs::symlink_metadata(path)?;
    if meta.file_type().is_symlink() {
        return Err(Error::InvalidInput(
            "symbolic links cannot be authorized".into(),
        ));
    }
    if class_is_root(class) {
        if !meta.is_dir() {
            return Err(Error::InvalidInput(
                "root authority must be a directory".into(),
            ));
        }
    } else if !meta.is_file() {
        return Err(Error::InvalidInput(
            "file authority must be a regular file".into(),
        ));
    }
    identity(path)
}
fn validate_dialog_target(path: &Path) -> Result<Identity, Error> {
    let meta = fs::symlink_metadata(path)?;
    if meta.file_type().is_symlink() || (!meta.is_file() && !meta.is_dir()) {
        return Err(Error::InvalidInput(
            "dialog selection must be a regular file or directory".into(),
        ));
    }
    identity(path)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct StoredEntry {
    id: PathRef,
    display_name: String,
    class: PathClass,
    operations: Vec<PathOperation>,
    path: NativePath,
    identity: Identity,
    #[serde(default)]
    target_is_dir: bool,
}
#[derive(Serialize, Deserialize)]
struct Registry {
    schema_version: u32,
    entries: Vec<StoredEntry>,
    #[serde(default)]
    active_database_root: Option<PathRef>,
    #[serde(default)]
    active_puzzle_root: Option<PathRef>,
    #[serde(default)]
    active_engine_root: Option<PathRef>,
    #[serde(default)]
    pending_artifacts: Vec<PendingArtifact>,
}
/// Durable intent recorded before an atomic download replacement. It lets a restarted authority
/// either activate the newly installed exact file or discard an intent whose replacement never
/// happened; neither state exposes a native path to the renderer.
#[derive(Clone, Serialize, Deserialize)]
struct PendingArtifact {
    id: PathRef,
    root: PathRef,
    filename: NativePath,
    display_name: String,
    operations: Vec<PathOperation>,
    baseline: Option<Identity>,
    /// The target root and exact staged bytes are part of the durable intent.
    /// Recovery never infers publication from an inode merely differing from baseline.
    #[serde(default)]
    root_identity: Option<Identity>,
    #[serde(default)]
    payload_size: u64,
    #[serde(default)]
    payload_sha256: String,
    #[serde(default)]
    payload_bound: bool,
    /// Written durably only after `renameat` and verified through a no-follow FD. This prevents
    /// a byte-identical outsider replacement from satisfying a merely content-based recovery.
    #[serde(default)]
    installed_identity: Option<Identity>,
    #[serde(default)]
    installed_ctime_nanos: Option<i128>,
}
#[derive(Clone)]
struct Entry {
    stored: StoredEntry,
    availability: PathAvailability,
}
#[derive(Clone)]
struct DialogGrant {
    entry: Entry,
    expires_at: SystemTime,
    uses_left: u32,
    inserted_at: u64,
}

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

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(crate) struct PgnSnapshotIdentity(Identity);
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
impl ResolvedPath {
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
            Self::pgn_snapshot_file(open_windows_child(parent, leaf, false, false, true)?)
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
            identity: PgnSnapshotIdentity(Identity { a, b }),
            revision: PgnSnapshotRevision {
                size: meta.len(),
                mtime_nanos: modified,
                ctime_nanos,
            },
        })
    }
    pub(crate) fn atomic_replace_download<F>(&self, write: F) -> Result<AtomicFileOutcome, Error>
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
        crate::infra::fs::atomic_replace_at_with_precommit(
            parent,
            leaf,
            || self.revalidate_logical_parent(),
            write,
        )
    }

    /// Streams a previously reserved staging file into the private atomic temporary inode and
    /// verifies its exact reservation digest before `renameat`. A substituted staging pathname
    /// therefore fails before the visible target changes.
    pub(crate) fn atomic_install_reserved_download(
        &self,
        reservation: &PendingArtifactReservation,
        staged_payload: &Path,
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
        crate::infra::fs::atomic_replace_at_identified_with_precommit(
            parent,
            leaf,
            || self.revalidate_logical_parent(),
            move |target| {
                let mut hasher = Sha256::new();
                let mut copied = 0_u64;
                let mut buffer = [0_u8; 64 * 1024];
                loop {
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
        let current = identity(logical_parent)?;
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
            let current = opened_file_identity(&open_windows_nofollow(&target, true)?)?;
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
    /// Bounded variant for untrusted assets. It checks descriptor metadata
    /// before allocating and reads at most one sentinel byte beyond the limit,
    /// so a sparse or concurrently growing file cannot force an allocation.
    pub fn read_bounded_bytes(&mut self, max_bytes: usize) -> Result<Vec<u8>, Error> {
        if !matches!(self.operation, PathOperation::OpeningBookRead) {
            return Err(Error::InvalidInput(
                "resolved capability is not a readable opening book".into(),
            ));
        }
        let file = self.file_mut()?;
        let declared = file.metadata()?.len();
        if declared > max_bytes as u64 {
            return Err(Error::ResourceLimit(
                "opening book exceeds the configured size limit".into(),
            ));
        }
        let mut bytes = Vec::with_capacity(usize::try_from(declared).unwrap_or(max_bytes));
        let mut limited = file.take((max_bytes as u64).saturating_add(1));
        limited.read_to_end(&mut bytes)?;
        if bytes.len() > max_bytes {
            return Err(Error::ResourceLimit(
                "opening book exceeds the configured size limit".into(),
            ));
        }
        Ok(bytes)
    }
    /// Replaces bytes in only the already-opened file. Atomic replacement remains a higher-level operation.
    pub fn write_bytes(&mut self, bytes: &[u8]) -> Result<(), Error> {
        if !is_write_operation(self.operation) {
            return Err(Error::InvalidInput(
                "resolved capability is not writable".into(),
            ));
        }
        let file = self.file_mut()?;
        file.set_len(0)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        Ok(())
    }
    fn file_mut(&mut self) -> Result<&mut fs::File, Error> {
        self.file.as_mut().ok_or_else(|| {
            Error::InvalidInput(
                "resolved capability names a directory; a file component is required".into(),
            )
        })
    }
}
fn is_write_operation(op: PathOperation) -> bool {
    matches!(
        op,
        PathOperation::WritePgn
            | PathOperation::DatabaseMutate
            | PathOperation::DatabaseCreate
            | PathOperation::DatabaseExport
            | PathOperation::PuzzleDelete
            | PathOperation::EngineInstall
            | PathOperation::SnapshotWrite
            | PathOperation::LogWrite
    )
}

/// Backend-only authority registry. Its public methods never parse renderer-provided raw paths.
pub struct PathAuthority {
    registry_path: PathBuf,
    persistent: BTreeMap<String, Entry>,
    dialogs: HashMap<String, DialogGrant>,
    clock: Arc<dyn Clock>,
    dialog_capacity: usize,
    next_insertion: u64,
    active_database_root: Option<PathRef>,
    active_puzzle_root: Option<PathRef>,
    active_engine_root: Option<PathRef>,
    pending_artifacts: Vec<PendingArtifact>,
}
impl PathAuthority {
    /// Turns a native save-dialog choice into one persistent, exact PGN destination. The renderer
    /// receives only the resulting workspace handle; the selected native path never leaves this
    /// authority boundary. A new target is materialized before the dialog grant is promoted so
    /// the persisted identity is the object the subsequent atomic PGN write must replace.
    pub(crate) fn create_pgn_export_destination(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<FileWorkspaceDescriptor, Error> {
        let extension_is_pgn = path
            .extension()
            .and_then(OsStr::to_str)
            .is_some_and(|extension| extension.eq_ignore_ascii_case("pgn"));
        if !extension_is_pgn || path.file_stem().is_none_or(|stem| stem.is_empty()) {
            return Err(Error::InvalidInput(
                "PGN export destination must have a .pgn filename".into(),
            ));
        }

        let created = match fs::symlink_metadata(path) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() || !metadata.is_file() {
                    return Err(Error::InvalidInput(
                        "PGN export destination must be a regular file".into(),
                    ));
                }
                false
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let parent = path.parent().ok_or_else(|| {
                    Error::InvalidInput("PGN export destination has no parent directory".into())
                })?;
                let parent_metadata = fs::symlink_metadata(parent)?;
                if parent_metadata.file_type().is_symlink() || !parent_metadata.is_dir() {
                    return Err(Error::InvalidInput(
                        "PGN export destination parent must be a directory".into(),
                    ));
                }
                let created = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(path)?;
                created.sync_all()?;
                true
            }
            Err(error) => return Err(Error::from(error)),
        };

        let display_name = display_name.into();
        let result = (|| {
            let grant = self.grant_dialog_operations(
                path,
                display_name.clone(),
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30 * 60),
                128,
            )?;
            let commit = self.promote_dialog(
                &grant,
                PathClass::PersistentFile,
                display_name.clone(),
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )?;
            Ok(FileWorkspaceDescriptor {
                handle: FileWorkspaceHandle::new(commit.id),
                display_name,
                availability: PathAvailability::Available,
            })
        })();
        if result.is_err() && created {
            let _ = fs::remove_file(path);
        }
        result
    }

    /// Registers the exact regular PGN that was atomically written below a DownloadFile root.
    /// This is intentionally native-only: it turns the just-created object into a distinct
    /// opaque read capability without exposing its path or granting sibling access.
    pub(crate) fn register_downloaded_pgn(
        &mut self,
        root: &PathRef,
        filename: &OsStr,
    ) -> Result<PathRef, Error> {
        let components = vec![filename.to_os_string()];
        self.validate_components(&components)?;
        // Resolve through the fd/handle-relative no-follow path before persisting identity.
        let _resolved = self.resolve(root, PathOperation::DownloadFile, &components)?;
        let root_entry =
            self.persistent.get(&root.id).cloned().ok_or_else(|| {
                Error::InvalidInput("download destination must be persistent".into())
            })?;
        if !root_entry.stored.target_is_dir
            || !root_entry
                .stored
                .operations
                .contains(&PathOperation::DownloadFile)
        {
            return Err(Error::InvalidInput("invalid download destination".into()));
        }
        let root_path = root_entry.stored.path.to_path()?;
        let path = root_path.join(filename);
        let identity = validate_target(&path, PathClass::PersistentFile)?;
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name: filename.to_string_lossy().into_owned(),
            class: PathClass::PersistentFile,
            operations: vec![PathOperation::ReadPgn],
            path: NativePath::from_path(&path),
            identity,
            target_is_dir: false,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        self.commit_candidate(candidate, None)?;
        Ok(id)
    }
    pub fn open(registry_path: PathBuf, app_roots: Vec<AppOwnedRoot>) -> Result<Self, Error> {
        Self::open_with_clock(registry_path, app_roots, Arc::new(SystemClock), 256)
    }
    pub fn open_with_clock(
        registry_path: PathBuf,
        app_roots: Vec<AppOwnedRoot>,
        clock: Arc<dyn Clock>,
        dialog_capacity: usize,
    ) -> Result<Self, Error> {
        if dialog_capacity == 0 {
            return Err(Error::InvalidInput(
                "dialog capacity must be at least one".into(),
            ));
        }
        let (
            mut persistent,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
        ) = if registry_path.exists() {
            let bytes = fs::read(&registry_path)?;
            let registry: Registry = serde_json::from_slice(&bytes)
                .map_err(|e| Error::InvalidInput(format!("invalid path registry: {e}")))?;
            if registry.schema_version != SCHEMA_VERSION {
                return Err(Error::InvalidInput(format!(
                    "unsupported path registry schema {}",
                    registry.schema_version
                )));
            }
            let mut loaded = BTreeMap::new();
            for mut stored in registry.entries {
                validate_persisted_shape(&stored)?;
                let legacy_engine_file_operations = [
                    PathOperation::EngineExecute,
                    PathOperation::EngineConfigure,
                    PathOperation::EngineInstall,
                ];
                if stored.class == PathClass::PersistentFile
                    && stored.operations == legacy_engine_file_operations
                {
                    // This exact, class-restricted backfill is idempotent, so the registry schema
                    // does not need to change. Engine roots are PersistentCustomRoot and must keep
                    // their exact operation vector for stable reuse across restarts.
                    stored.operations.push(PathOperation::EngineBinaryInspect);
                }
                let mut entry = Entry {
                    stored,
                    availability: PathAvailability::Unavailable,
                };
                refresh_entry(&mut entry);
                if loaded.insert(entry.stored.id.id.clone(), entry).is_some() {
                    return Err(Error::InvalidInput(
                        "duplicate path registry identifier".into(),
                    ));
                }
            }
            let active = registry.active_database_root.filter(|id| {
                loaded.get(&id.id).is_some_and(|entry| {
                    entry.stored.target_is_dir
                        && entry
                            .stored
                            .operations
                            .contains(&PathOperation::DatabaseRead)
                })
            });
            let active_puzzle_root = registry.active_puzzle_root.filter(|id| {
                loaded.get(&id.id).is_some_and(|entry| {
                    entry.stored.target_is_dir
                        && entry.stored.operations.contains(&PathOperation::PuzzleRead)
                })
            });
            let active_engine_root = registry.active_engine_root.filter(|id| {
                loaded.get(&id.id).is_some_and(|entry| {
                    entry.stored.target_is_dir
                        && entry
                            .stored
                            .operations
                            .contains(&PathOperation::EngineInstall)
                })
            });
            (
                loaded,
                active,
                active_puzzle_root,
                active_engine_root,
                registry.pending_artifacts,
            )
        } else {
            (BTreeMap::new(), None, None, None, Vec::new())
        };
        for root in app_roots {
            fs::create_dir_all(&root.path)?;
            let stored = StoredEntry {
                id: root.id.clone(),
                display_name: root.display_name,
                class: PathClass::AppOwnedRoot,
                operations: root.operations,
                path: NativePath::from_path(&root.path),
                identity: validate_target(&root.path, PathClass::AppOwnedRoot)?,
                target_is_dir: true,
            };
            persistent.insert(
                stored.id.id.clone(),
                Entry {
                    stored,
                    availability: PathAvailability::Available,
                },
            );
        }
        let mut authority = Self {
            registry_path,
            persistent,
            dialogs: HashMap::new(),
            clock,
            dialog_capacity,
            next_insertion: 0,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
        };
        authority.recover_pending_artifacts()?;
        Ok(authority)
    }
    pub fn descriptors(&mut self) -> Vec<PathDescriptor> {
        self.evict_dialogs();
        self.refresh_persistent();
        for grant in self.dialogs.values_mut() {
            refresh_entry(&mut grant.entry);
        }
        self.persistent
            .values()
            .map(|e| descriptor(&e.stored, e.availability))
            .chain(
                self.dialogs
                    .values()
                    .map(|g| descriptor(&g.entry.stored, g.entry.availability)),
            )
            .collect()
    }

    /// Recovery authorizes only the exact content bound before publication. A missing, changed,
    /// legacy-unbound, or conflicting target remains quarantined as intent; it is never inferred
    /// from a baseline inode difference and commits are never retried.
    fn recover_pending_artifacts(&mut self) -> Result<(), Error> {
        let reservations: Vec<_> = self
            .pending_artifacts
            .iter()
            .map(|pending| PendingArtifactReservation {
                id: pending.id.clone(),
                payload_size: pending.payload_size,
                payload_sha256: pending.payload_sha256.clone(),
            })
            .collect();
        for reservation in reservations {
            let Some(pending) = self
                .pending_artifacts
                .iter()
                .find(|pending| pending.id == reservation.id)
                .cloned()
            else {
                continue;
            };
            let Some(root) = self.persistent.get(&pending.root.id) else {
                continue;
            };
            let Ok(root_identity) = validate_target(
                &root.stored.path.to_path()?,
                PathClass::PersistentCustomRoot,
            ) else {
                continue;
            };
            if !pending.payload_bound
                || pending.installed_identity.is_none()
                || pending.root_identity.as_ref() != Some(&root_identity)
            {
                continue;
            }
            // Activation resolves and hashes the no-follow opened file descriptor itself. A
            // mismatch is an expected quarantined state during restart, not an open failure.
            let _ = self.activate_download_artifact(&reservation);
        }
        Ok(())
    }
    pub fn grant_dialog(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        class: PathClass,
        operation: PathOperation,
        ttl: Duration,
        uses_left: u32,
    ) -> Result<PathRef, Error> {
        self.grant_dialog_operations(path, display_name, class, vec![operation], ttl, uses_left)
    }
    pub fn grant_dialog_operations(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        class: PathClass,
        operations: Vec<PathOperation>,
        ttl: Duration,
        uses_left: u32,
    ) -> Result<PathRef, Error> {
        if !matches!(
            class,
            PathClass::SingleDialogGrant | PathClass::BoundedDialogGrant
        ) || (class == PathClass::SingleDialogGrant && uses_left != 1)
            || (class == PathClass::BoundedDialogGrant && uses_left == 0)
            || operations.is_empty()
        {
            return Err(Error::InvalidInput("invalid dialog grant shape".into()));
        }
        let identity = validate_dialog_target(path)?;
        let target_is_dir = fs::symlink_metadata(path)?.is_dir();
        // Validate before evicting: malformed dialog input must not affect live grants.
        self.evict_dialogs();
        if self.dialogs.len() >= self.dialog_capacity {
            if let Some(oldest) = self
                .dialogs
                .iter()
                .min_by_key(|(_, g)| g.inserted_at)
                .map(|(id, _)| id.clone())
            {
                self.dialogs.remove(&oldest);
            }
        }
        let id = PathRef::fresh();
        self.next_insertion += 1;
        let stored = StoredEntry {
            id: id.clone(),
            display_name: display_name.into(),
            class,
            operations,
            path: NativePath::from_path(path),
            identity,
            target_is_dir,
        };
        self.dialogs.insert(
            id.id.clone(),
            DialogGrant {
                entry: Entry {
                    stored,
                    availability: PathAvailability::Available,
                },
                expires_at: self.clock.now() + ttl,
                uses_left,
                inserted_at: self.next_insertion,
            },
        );
        Ok(id)
    }
    pub fn revoke_dialog(&mut self, id: &PathRef) -> bool {
        self.dialogs.remove(&id.id).is_some()
    }
    /// Consumes an exact live dialog grant and persists the same native object as a root or file.
    pub fn promote_dialog(
        &mut self,
        dialog: &PathRef,
        persistent_class: PathClass,
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
    ) -> Result<PathCommit, Error> {
        if !matches!(
            persistent_class,
            PathClass::PersistentCustomRoot | PathClass::PersistentFile
        ) {
            return Err(Error::InvalidInput(
                "promotion target must be persistent".into(),
            ));
        }
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "persistent operations cannot be empty".into(),
            ));
        }
        let grant = self.dialogs.get(&dialog.id).cloned().ok_or_else(|| {
            Error::InvalidInput("unknown, revoked, or expired dialog grant".into())
        })?;
        if grant.expires_at <= self.clock.now() {
            self.dialogs.remove(&dialog.id);
            return Err(Error::InvalidInput(
                "unknown, revoked, or expired dialog grant".into(),
            ));
        }
        if operations
            .iter()
            .any(|op| !grant.entry.stored.operations.contains(op))
        {
            return Err(Error::InvalidInput(
                "promotion cannot escalate dialog operation authority".into(),
            ));
        }
        let path = grant.entry.stored.path.to_path()?;
        let expected = validate_target(&path, persistent_class)?;
        if expected != grant.entry.stored.identity {
            return Err(Error::Conflict(
                "dialog target changed before promotion".into(),
            ));
        }
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name: display_name.into(),
            class: persistent_class,
            operations,
            path: grant.entry.stored.path,
            identity: expected,
            target_is_dir: persistent_class == PathClass::PersistentCustomRoot,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        let durability = self.commit_candidate(candidate, Some(dialog))?;
        Ok(PathCommit { id, durability })
    }
    /// One-time backend migration escape hatch. New operational code must use dialog promotion.
    pub fn migrate_legacy_os_path(
        &mut self,
        path: OsString,
        display_name: impl Into<String>,
        class: PathClass,
        operations: Vec<PathOperation>,
    ) -> Result<PathCommit, Error> {
        if !matches!(
            class,
            PathClass::PersistentCustomRoot | PathClass::PersistentFile
        ) {
            return Err(Error::InvalidInput(
                "legacy migration must create persistent authority".into(),
            ));
        }
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "persistent operations cannot be empty".into(),
            ));
        }
        let path = PathBuf::from(path);
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name: display_name.into(),
            class,
            operations,
            path: NativePath::from_path(&path),
            identity: validate_target(&path, class)?,
            target_is_dir: class == PathClass::PersistentCustomRoot,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        let durability = self.commit_candidate(candidate, None)?;
        Ok(PathCommit { id, durability })
    }
    /// Backend discovery for bundled/app-owned files. Existing persistent
    /// entries retain their opaque ID across restarts; a replaced object is
    /// rejected rather than silently reusing the old capability.
    pub fn get_or_create_persistent_file(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
    ) -> Result<PathCommit, Error> {
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "persistent operations cannot be empty".into(),
            ));
        }
        let expected = validate_target(path, PathClass::PersistentFile)?;
        if let Some(entry) = self.persistent.values().find(|entry| {
            entry.stored.class == PathClass::PersistentFile
                && entry.stored.operations == operations
                && entry
                    .stored
                    .path
                    .to_path()
                    .is_ok_and(|stored_path| stored_path == path)
        }) {
            if entry.stored.identity != expected {
                return Err(Error::Conflict(
                    "persistent puzzle database changed; acquire a new capability".into(),
                ));
            }
            return Ok(PathCommit {
                id: entry.stored.id.clone(),
                durability: CommitDurability::Durable,
            });
        }
        self.migrate_legacy_os_path(
            path.as_os_str().to_os_string(),
            display_name,
            PathClass::PersistentFile,
            operations,
        )
    }

    /// Creates a persistent database root from a native-only selected path.
    /// Re-opening the application or re-listing the root reuses its identifier
    /// rather than exposing the directory again to the renderer.
    pub(crate) fn get_or_create_database_root(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<DatabaseRootHandle, Error> {
        let operations = vec![
            PathOperation::DatabaseRead,
            PathOperation::DatabaseMutate,
            PathOperation::DatabaseCreate,
            PathOperation::DatabaseExport,
            PathOperation::DownloadFile,
        ];
        if let Some(entry) = self.persistent.values().find(|entry| {
            entry.stored.target_is_dir
                && entry.stored.operations == operations
                && entry
                    .stored
                    .path
                    .to_path()
                    .is_ok_and(|stored| stored == path)
        }) {
            if validate_target(path, PathClass::PersistentCustomRoot)? != entry.stored.identity {
                return Err(Error::Conflict(
                    "database root changed; select it again".into(),
                ));
            }
            return Ok(DatabaseRootHandle::new(entry.stored.id.clone()));
        }
        Ok(DatabaseRootHandle::new(
            self.migrate_legacy_os_path(
                path.as_os_str().to_os_string(),
                display_name,
                PathClass::PersistentCustomRoot,
                operations,
            )?
            .id,
        ))
    }

    /// Creates or reuses a persisted directory that contains exact puzzle
    /// databases. Its ID is stable across restarts; only backend discovery
    /// derives child IDs from the directory.
    pub(crate) fn get_or_create_puzzle_root(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<PuzzleRootHandle, Error> {
        let operations = vec![
            PathOperation::PuzzleRead,
            PathOperation::PuzzleDelete,
            PathOperation::DownloadFile,
        ];
        if let Some(entry) = self.persistent.values().find(|entry| {
            entry.stored.target_is_dir
                && entry.stored.operations == operations
                && entry
                    .stored
                    .path
                    .to_path()
                    .is_ok_and(|stored| stored == path)
        }) {
            if validate_target(path, PathClass::PersistentCustomRoot)? != entry.stored.identity {
                return Err(Error::Conflict(
                    "puzzle root changed; select it again".into(),
                ));
            }
            return Ok(PuzzleRootHandle::new(entry.stored.id.clone()));
        }
        Ok(PuzzleRootHandle::new(
            self.migrate_legacy_os_path(
                path.as_os_str().to_os_string(),
                display_name,
                PathClass::PersistentCustomRoot,
                operations,
            )?
            .id,
        ))
    }

    pub(crate) fn get_or_create_engine_root(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<EngineRootHandle, Error> {
        let operations = vec![
            PathOperation::DownloadArchive,
            PathOperation::EngineInstall,
            PathOperation::EngineExecute,
            PathOperation::EngineConfigure,
        ];
        if let Some(entry) = self.persistent.values().find(|entry| {
            entry.stored.target_is_dir
                && entry.stored.operations == operations
                && entry
                    .stored
                    .path
                    .to_path()
                    .is_ok_and(|stored| stored == path)
        }) {
            if validate_target(path, PathClass::PersistentCustomRoot)? != entry.stored.identity {
                return Err(Error::Conflict(
                    "engine root changed; select it again".into(),
                ));
            }
            return Ok(EngineRootHandle::new(entry.stored.id.clone()));
        }
        Ok(EngineRootHandle::new(
            self.migrate_legacy_os_path(
                path.as_os_str().to_os_string(),
                display_name,
                PathClass::PersistentCustomRoot,
                operations,
            )?
            .id,
        ))
    }

    pub(crate) fn active_engine_root(&mut self) -> Result<Option<EngineRootHandle>, Error> {
        self.refresh_persistent();
        let Some(id) = self.active_engine_root.clone() else {
            return Ok(None);
        };
        match self.persistent.get(&id.id) {
            Some(entry)
                if entry.availability == PathAvailability::Available
                    && entry.stored.target_is_dir
                    && entry
                        .stored
                        .operations
                        .contains(&PathOperation::EngineInstall) =>
            {
                Ok(Some(EngineRootHandle::new(id)))
            }
            _ => Ok(None),
        }
    }

    pub(crate) fn engine_root_path(&mut self, root: &EngineRootHandle) -> Result<PathBuf, Error> {
        self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::EngineInstall,
        )
    }

    pub(crate) fn set_active_engine_root(&mut self, root: &EngineRootHandle) -> Result<(), Error> {
        let _ = self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::EngineInstall,
        )?;
        self.commit_state(
            self.persistent.clone(),
            self.active_database_root.clone(),
            self.active_puzzle_root.clone(),
            Some(root.path_ref().clone()),
            self.pending_artifacts.clone(),
            None,
        )?;
        Ok(())
    }

    /// Registers one exact executable selected or installed natively. The renderer receives only
    /// its opaque handle; every later execution and probe revalidates this identity.
    pub(crate) fn register_engine_file(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<EngineHandle, Error> {
        let operations = vec![
            PathOperation::EngineExecute,
            PathOperation::EngineConfigure,
            PathOperation::EngineInstall,
            PathOperation::EngineBinaryInspect,
        ];
        Ok(EngineHandle::new(
            self.get_or_create_persistent_file(path, display_name, operations)?
                .id,
        ))
    }

    /// Persists a picker-selected UCI resource with only resource-read
    /// authority.  Callers must hand us the one-time dialog grant; raw paths
    /// never cross the IPC boundary.
    pub(crate) fn promote_engine_resource(
        &mut self,
        grant: &PathRef,
        kind: EngineResourceHandleKind,
        display_name: impl Into<String>,
    ) -> Result<EngineResourceHandle, Error> {
        let display_name = display_name.into();
        let class = match kind {
            EngineResourceHandleKind::File => PathClass::PersistentFile,
            EngineResourceHandleKind::Directory => PathClass::PersistentCustomRoot,
        };
        let commit = self.promote_dialog(
            grant,
            class,
            display_name.clone(),
            vec![PathOperation::EngineResourceRead],
        )?;
        Ok(EngineResourceHandle::new(commit.id, kind, display_name))
    }

    /// Resolves a UCI resource through no-follow traversal and returns a
    /// descriptor lease. The caller owns this object until the engine exits.
    pub(crate) fn engine_resource(
        &mut self,
        resource: &EngineResourceHandle,
    ) -> Result<EngineResourceLease, Error> {
        let resolved = self.resolve(resource.path_ref(), PathOperation::EngineResourceRead, &[])?;
        match resource.kind {
            EngineResourceHandleKind::File => {
                let file = resolved
                    .file
                    .ok_or_else(|| Error::InvalidInput("engine resource must be a file".into()))?;
                Ok(EngineResourceLease {
                    #[cfg(unix)]
                    file,
                    #[cfg(windows)]
                    file,
                    #[cfg(windows)]
                    target: resolved.target.ok_or_else(|| {
                        Error::Conflict("engine resource target is unavailable".into())
                    })?,
                })
            }
            EngineResourceHandleKind::Directory => {
                #[cfg(unix)]
                {
                    let file = resolved.directory.ok_or_else(|| {
                        Error::InvalidInput("engine resource must be a directory".into())
                    })?;
                    Ok(EngineResourceLease { file })
                }
                #[cfg(windows)]
                {
                    let file = resolved.file.ok_or_else(|| {
                        Error::InvalidInput("engine resource must be a directory".into())
                    })?;
                    Ok(EngineResourceLease {
                        file,
                        target: resolved.target.ok_or_else(|| {
                            Error::Conflict("engine resource target is unavailable".into())
                        })?,
                    })
                }
            }
        }
    }

    /// Registers an app-owned copied engine-image asset. The native picker is
    /// consumed before this point, so only the managed copy is persistent.
    pub(crate) fn register_engine_image(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<EngineImageHandle, Error> {
        Ok(EngineImageHandle::new(
            self.get_or_create_persistent_file(path, display_name, vec![PathOperation::ImageRead])?
                .id,
        ))
    }

    /// Reads bounded bytes from an exact, revalidated image capability. Native
    /// paths remain inside the authority layer.
    pub(crate) fn read_engine_image(
        &mut self,
        image: &EngineImageHandle,
        max_bytes: usize,
    ) -> Result<Vec<u8>, Error> {
        let mut resolved = self.resolve(image.path_ref(), PathOperation::ImageRead, &[])?;
        let mut file = resolved
            .file
            .take()
            .ok_or_else(|| Error::InvalidInput("engine image capability is not a file".into()))?;
        let declared = file.metadata()?.len();
        if declared > max_bytes as u64 {
            return Err(Error::ResourceLimit(
                "engine image exceeds the supported size limit".into(),
            ));
        }
        let mut bytes = Vec::with_capacity(usize::try_from(declared).unwrap_or(max_bytes));
        file.read_to_end(&mut bytes)?;
        if bytes.len() > max_bytes {
            return Err(Error::ResourceLimit(
                "engine image exceeds the supported size limit".into(),
            ));
        }
        Ok(bytes)
    }

    pub(crate) fn register_opening_book(
        &mut self,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<OpeningBookHandle, Error> {
        Ok(OpeningBookHandle::new(
            self.get_or_create_persistent_file(
                path,
                display_name,
                vec![PathOperation::OpeningBookRead],
            )?
            .id,
        ))
    }

    /// Resolves an exact opening-book descriptor without exposing a native path.
    /// The caller moves this already-opened file to its bounded blocking worker.
    pub(crate) fn opening_book_descriptor(
        &mut self,
        book: &OpeningBookHandle,
    ) -> Result<OpeningBookDescriptor, Error> {
        let mut resolved = self.resolve(book.path_ref(), PathOperation::OpeningBookRead, &[])?;
        let file_name = self.display_name(book.path_ref())?;
        let file = resolved.file.take().ok_or_else(|| {
            Error::InvalidInput("opening-book capability names a directory".into())
        })?;
        Ok(OpeningBookDescriptor { file_name, file })
    }

    pub(crate) fn register_installed_engine(
        &mut self,
        root: &EngineRootHandle,
        relative_path: &str,
    ) -> Result<EngineHandle, Error> {
        let components: Vec<OsString> = Path::new(relative_path)
            .components()
            .map(|component| match component {
                std::path::Component::Normal(value) => Ok(value.to_os_string()),
                _ => Err(Error::InvalidInput(
                    "engine path must be a relative file path".into(),
                )),
            })
            .collect::<Result<_, _>>()?;
        if components.is_empty() {
            return Err(Error::InvalidInput("engine path is required".into()));
        }
        self.validate_components(&components)?;
        self.resolve(root.path_ref(), PathOperation::EngineInstall, &components)?;
        let base = self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::EngineInstall,
        )?;
        let path = components.iter().fold(base, |mut current, component| {
            current.push(component);
            current
        });
        self.register_engine_file(&path, components.last().unwrap().to_string_lossy())
    }

    pub(crate) fn engine_archive_destination(
        &mut self,
        root: &EngineRootHandle,
    ) -> Result<PathRef, Error> {
        let _ = self.resolve(root.path_ref(), PathOperation::DownloadArchive, &[])?;
        Ok(root.path_ref().clone())
    }

    /// Resolves one exact engine object after capability and identity validation. The native
    /// path is for the backend actor only and is never serialized to the renderer.
    pub(crate) fn engine_executable(
        &mut self,
        engine: &EngineHandle,
        operation: PathOperation,
    ) -> Result<EngineExecutable, Error> {
        if !matches!(
            operation,
            PathOperation::EngineExecute | PathOperation::EngineConfigure
        ) {
            return Err(Error::InvalidInput("invalid engine operation".into()));
        }
        let resolved = self.resolve(engine.path_ref(), operation, &[])?;
        let file = resolved
            .file
            .ok_or_else(|| Error::InvalidInput("engine capability is not a file".into()))?;
        let verified_path = self.workspace_entry_path(
            &FileWorkspaceHandle::new(engine.path_ref().clone()),
            operation,
        )?;
        let working_directory = verified_path
            .parent()
            .ok_or_else(|| Error::InvalidInput("engine executable has no parent directory".into()))?
            .to_path_buf();
        Ok(EngineExecutable {
            file,
            working_directory,
            resource_leases: Vec::new(),
            #[cfg(windows)]
            command_path: verified_path,
        })
    }

    pub(crate) fn active_database_root(&mut self) -> Result<Option<DatabaseRootHandle>, Error> {
        self.refresh_persistent();
        let Some(id) = self.active_database_root.clone() else {
            return Ok(None);
        };
        match self.persistent.get(&id.id) {
            Some(entry)
                if entry.availability == PathAvailability::Available
                    && entry.stored.target_is_dir
                    && entry
                        .stored
                        .operations
                        .contains(&PathOperation::DatabaseRead) =>
            {
                Ok(Some(DatabaseRootHandle::new(id)))
            }
            _ => Ok(None),
        }
    }

    pub(crate) fn active_puzzle_root(&mut self) -> Result<Option<PuzzleRootDescriptor>, Error> {
        self.refresh_persistent();
        let Some(id) = self.active_puzzle_root.clone() else {
            return Ok(None);
        };
        match self.persistent.get(&id.id) {
            Some(entry)
                if entry.availability == PathAvailability::Available
                    && entry.stored.target_is_dir
                    && entry.stored.operations.contains(&PathOperation::PuzzleRead) =>
            {
                Ok(Some(PuzzleRootDescriptor {
                    root: PuzzleRootHandle::new(id),
                    display_name: entry.stored.display_name.clone(),
                }))
            }
            _ => Ok(None),
        }
    }

    pub(crate) fn set_active_database_root(
        &mut self,
        root: &DatabaseRootHandle,
    ) -> Result<(), Error> {
        let _ = self.database_root_path(root)?;
        let active = Some(root.path_ref().clone());
        self.commit_state(
            self.persistent.clone(),
            active,
            self.active_puzzle_root.clone(),
            self.active_engine_root.clone(),
            self.pending_artifacts.clone(),
            None,
        )?;
        Ok(())
    }

    pub(crate) fn set_active_puzzle_root(&mut self, root: &PuzzleRootHandle) -> Result<(), Error> {
        let _ = self.puzzle_root_path(root)?;
        self.commit_state(
            self.persistent.clone(),
            self.active_database_root.clone(),
            Some(root.path_ref().clone()),
            self.active_engine_root.clone(),
            self.pending_artifacts.clone(),
            None,
        )?;
        Ok(())
    }

    pub(crate) fn list_puzzle_children(
        &mut self,
        root: &PuzzleRootHandle,
    ) -> Result<Vec<PuzzleDatabaseDescriptor>, Error> {
        let root_path = self.puzzle_root_path(root)?;
        let mut descriptors = Vec::new();
        for entry in fs::read_dir(root_path)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension() != Some(OsStr::new("db3")) {
                continue;
            }
            let metadata = fs::symlink_metadata(&path)?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                continue;
            }
            let filename = entry.file_name();
            let file = self.register_puzzle_child(root, &filename)?;
            descriptors.push(PuzzleDatabaseDescriptor {
                file,
                filename: filename.to_string_lossy().into_owned(),
            });
        }
        descriptors.sort_by(|a, b| a.filename.cmp(&b.filename));
        Ok(descriptors)
    }

    pub(crate) fn puzzle_download_destination(
        &mut self,
        root: &PuzzleRootHandle,
    ) -> Result<PathRef, Error> {
        let _ = self.resolve(root.path_ref(), PathOperation::DownloadFile, &[])?;
        Ok(root.path_ref().clone())
    }

    fn puzzle_root_path(&mut self, root: &PuzzleRootHandle) -> Result<PathBuf, Error> {
        self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::PuzzleRead,
        )
    }

    fn register_puzzle_child(
        &mut self,
        root: &PuzzleRootHandle,
        filename: &OsStr,
    ) -> Result<PathRef, Error> {
        self.validate_components(&[filename.to_os_string()])?;
        let _ = self.resolve(
            root.path_ref(),
            PathOperation::PuzzleRead,
            &[filename.to_os_string()],
        )?;
        let path = self.puzzle_root_path(root)?.join(filename);
        Ok(self
            .get_or_create_persistent_file(
                &path,
                filename.to_string_lossy(),
                vec![PathOperation::PuzzleRead, PathOperation::PuzzleDelete],
            )?
            .id)
    }

    /// Returns database children known below a root and reconciles newly
    /// discovered native files into persistent opaque handles.  File names are
    /// backend-derived display metadata only; callers cannot feed them back as
    /// paths.
    pub(crate) fn list_database_children(
        &mut self,
        root: &DatabaseRootHandle,
    ) -> Result<Vec<DatabaseDescriptor>, Error> {
        let root_path = self.database_root_path(root)?;
        let mut descriptors = Vec::new();
        for entry in fs::read_dir(root_path)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension() != Some(OsStr::new("db3")) {
                continue;
            }
            let metadata = fs::symlink_metadata(&path)?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                continue;
            }
            let filename = entry.file_name().to_string_lossy().into_owned();
            let handle =
                self.register_database_child(root, &entry.file_name(), filename.clone())?;
            descriptors.push(DatabaseDescriptor {
                handle,
                filename,
                availability: PathAvailability::Available,
            });
        }
        descriptors.sort_by(|a, b| a.filename.cmp(&b.filename));
        Ok(descriptors)
    }

    /// Registers an exact database child after validating it relative to the
    /// root.  This avoids a join-and-open race and preserves non-UTF8 names in
    /// the registry; only lossy display metadata leaves the backend.
    pub(crate) fn register_database_child(
        &mut self,
        root: &DatabaseRootHandle,
        filename: &OsStr,
        display_name: impl Into<String>,
    ) -> Result<DatabaseHandle, Error> {
        let components = vec![filename.to_os_string()];
        self.resolve(root.path_ref(), PathOperation::DatabaseRead, &components)?;
        let root_path = self.database_root_path(root)?;
        let path = root_path.join(filename);
        let identity = validate_target(&path, PathClass::PersistentFile)?;
        if let Some(entry) = self.persistent.values().find(|entry| {
            entry.stored.path.to_path().ok().as_ref() == Some(&path)
                && entry.stored.identity == identity
                && !entry.stored.target_is_dir
                && entry
                    .stored
                    .operations
                    .contains(&PathOperation::DatabaseRead)
        }) {
            return Ok(DatabaseHandle::new(entry.stored.id.clone()));
        }
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name: display_name.into(),
            class: PathClass::PersistentFile,
            operations: vec![
                PathOperation::DatabaseRead,
                PathOperation::DatabaseMutate,
                PathOperation::DatabaseCreate,
                PathOperation::DatabaseExport,
            ],
            path: NativePath::from_path(&path),
            identity,
            target_is_dir: false,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        self.commit_candidate(candidate, None)?;
        Ok(DatabaseHandle::new(id))
    }

    /// Creates an empty database leaf exactly once below a validated database
    /// root, then persists its opaque identity before returning it.  The
    /// filename is a single native component and cannot escape the root.
    pub(crate) fn create_database_child(
        &mut self,
        root: &DatabaseRootHandle,
        filename: &OsStr,
    ) -> Result<DatabaseHandle, Error> {
        self.validate_components(&[filename.to_os_string()])?;
        if std::path::Path::new(filename).extension() != Some(OsStr::new("db3")) {
            return Err(Error::InvalidInput(
                "database filename must end in .db3".into(),
            ));
        }
        let root_path = self.database_root_path(root)?;
        let path = root_path.join(filename);
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(file) => file.sync_all()?,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                return Err(Error::Conflict("database filename already exists".into()));
            }
            Err(error) => return Err(Error::from(error)),
        }
        match self.register_database_child(root, filename, filename.to_string_lossy()) {
            Ok(handle) => Ok(handle),
            Err(error) => {
                // Do not leave an unmanaged artifact if registration fails.
                let _ = fs::remove_file(&path);
                Err(error)
            }
        }
    }

    /// Resolved native path for an exact database capability.  This is only
    /// callable by backend command code and performs identity/no-follow checks
    /// on every operation.
    pub(crate) fn database_path(
        &mut self,
        handle: &DatabaseHandle,
        operation: PathOperation,
    ) -> Result<PathBuf, Error> {
        if !matches!(
            operation,
            PathOperation::DatabaseRead
                | PathOperation::DatabaseMutate
                | PathOperation::DatabaseCreate
                | PathOperation::DatabaseExport
        ) {
            return Err(Error::InvalidInput("invalid database operation".into()));
        }
        self.workspace_entry_path(
            &FileWorkspaceHandle::new(handle.path_ref().clone()),
            operation,
        )
    }

    #[cfg(unix)]
    pub(crate) fn database_file_target(
        &mut self,
        handle: &DatabaseHandle,
        operation: PathOperation,
    ) -> Result<DatabaseFileTarget, Error> {
        if !matches!(
            operation,
            PathOperation::DatabaseRead | PathOperation::DatabaseMutate
        ) {
            return Err(Error::InvalidInput(
                "invalid database file operation".into(),
            ));
        }
        let target = self.retained_workspace_target(
            &FileWorkspaceHandle::new(handle.path_ref().clone()),
            operation,
        )?;
        if target.target_is_dir {
            return Err(Error::InvalidInput(
                "database handle must identify a regular file".into(),
            ));
        }
        Ok(DatabaseFileTarget {
            parent: target.parent,
            leaf: target.leaf,
            identity: target.identity,
        })
    }

    pub(crate) fn remove_database(&mut self, handle: &DatabaseHandle) -> Result<(), Error> {
        match self.remove_workspace_entry(
            &FileWorkspaceHandle::new(handle.path_ref().clone()),
            WorkspaceRemovalStatus::Complete,
        )? {
            CommitDurability::Durable => Ok(()),
            CommitDurability::DurabilityUncertain(stage) => {
                Err(Error::CommittedDurabilityUncertain(stage))
            }
        }
    }

    fn database_root_path(&mut self, root: &DatabaseRootHandle) -> Result<PathBuf, Error> {
        self.workspace_root(
            &FileWorkspaceHandle::new(root.path_ref().clone()),
            PathOperation::DatabaseRead,
        )
    }

    pub(crate) fn database_download_destination(
        &mut self,
        root: &DatabaseRootHandle,
    ) -> Result<PathRef, Error> {
        let _ = self.resolve(root.path_ref(), PathOperation::DownloadFile, &[])?;
        Ok(root.path_ref().clone())
    }
    pub fn resolve(
        &mut self,
        id: &PathRef,
        operation: PathOperation,
        components: &[OsString],
    ) -> Result<ResolvedPath, Error> {
        self.validate_components(components)?;
        let entry = if let Some(entry) = self.persistent.get(&id.id).cloned() {
            entry
        } else {
            self.take_dialog(id, Some(operation))?.entry
        };
        if !entry.stored.operations.contains(&operation) {
            return Err(Error::InvalidInput(
                "path capability does not permit this operation".into(),
            ));
        }
        let root = entry.stored.path.to_path()?;
        let actual = validate_target(
            &root,
            if entry.stored.target_is_dir {
                PathClass::PersistentCustomRoot
            } else {
                PathClass::PersistentFile
            },
        )?;
        if actual != entry.stored.identity {
            return Err(Error::Conflict(
                "path authority is unavailable because its object changed".into(),
            ));
        }
        #[cfg(unix)]
        {
            resolve_unix(
                &root,
                &entry.stored.identity,
                entry.stored.target_is_dir,
                components,
                operation,
            )
        }
        #[cfg(windows)]
        {
            resolve_windows(
                &root,
                &entry.stored.identity,
                entry.stored.target_is_dir,
                components,
                operation,
            )
        }
    }

    /// Renderer-safe display metadata for a capability.  This is deliberately
    /// a label, not a path or component list.
    pub(crate) fn display_name(&mut self, id: &PathRef) -> Result<String, Error> {
        self.refresh_persistent();
        self.persistent
            .get(&id.id)
            .filter(|entry| entry.availability == PathAvailability::Available)
            .map(|entry| entry.stored.display_name.clone())
            .ok_or_else(|| Error::InvalidInput("unknown or unavailable path capability".into()))
    }

    /// Returns the native root for a persistent, directory-backed workspace after checking its
    /// identity and required operation. This is intentionally crate-private: renderer code only
    /// ever receives [`FileWorkspaceHandle`], while native workspace commands use this one
    /// authority boundary for every filesystem operation.
    pub(crate) fn workspace_root(
        &mut self,
        workspace: &FileWorkspaceHandle,
        operation: PathOperation,
    ) -> Result<PathBuf, Error> {
        let entry = self
            .persistent
            .get(&workspace.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace is not persistent".into()))?;
        if !entry.stored.target_is_dir || !entry.stored.operations.contains(&operation) {
            return Err(Error::InvalidInput(
                "workspace does not permit this operation".into(),
            ));
        }
        let root = entry.stored.path.to_path()?;
        if validate_target(&root, PathClass::PersistentCustomRoot)? != entry.stored.identity {
            return Err(Error::Conflict(
                "workspace is unavailable because its root changed".into(),
            ));
        }
        Ok(root)
    }

    /// Persists an opaque child handle for a validated workspace entry. The child keeps the
    /// workspace operations and its own identity, so open tabs and recent entries survive a
    /// renderer remount or application restart without serializing a physical path.
    pub(crate) fn register_workspace_child(
        &mut self,
        workspace: &FileWorkspaceHandle,
        components: &[OsString],
        display_name: impl Into<String>,
    ) -> Result<FileWorkspaceHandle, Error> {
        self.validate_components(components)?;
        if components.is_empty() {
            return Err(Error::InvalidInput("workspace child is required".into()));
        }
        let root_entry = self
            .persistent
            .get(&workspace.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace is not persistent".into()))?;
        if !root_entry.stored.target_is_dir
            || !root_entry
                .stored
                .operations
                .contains(&PathOperation::ReadPgn)
        {
            return Err(Error::InvalidInput("invalid PGN workspace root".into()));
        }
        // `resolve` performs fd/handle-relative no-follow traversal before we persist the
        // descriptor. The native path remains backend-only registry data.
        self.resolve(workspace.path_ref(), PathOperation::ReadPgn, components)?;
        let root = self.workspace_root(workspace, PathOperation::ReadPgn)?;
        let path = components.iter().fold(root, |mut path, component| {
            path.push(component);
            path
        });
        let metadata = fs::symlink_metadata(&path)?;
        if metadata.file_type().is_symlink() || (!metadata.is_file() && !metadata.is_dir()) {
            return Err(Error::InvalidInput(
                "workspace entry must be a regular file or directory".into(),
            ));
        }
        let class = if metadata.is_dir() {
            PathClass::PersistentCustomRoot
        } else {
            PathClass::PersistentFile
        };
        let identity = validate_target(&path, class)?;
        self.persist_workspace_child(
            root_entry,
            path,
            display_name.into(),
            class,
            identity,
            metadata.is_dir(),
        )
    }

    /// Persists a child created through retained descriptors. The caller supplies the exact
    /// inode captured from the installed/opened FD, so registration cannot bind a pathname
    /// replacement that appears after the namespace commit.
    #[cfg(unix)]
    pub(crate) fn register_workspace_child_expected(
        &mut self,
        workspace: &FileWorkspaceHandle,
        components: &[OsString],
        display_name: impl Into<String>,
        expected_identity: (u64, u64),
        is_dir: bool,
    ) -> Result<FileWorkspaceHandle, Error> {
        self.validate_components(components)?;
        if components.is_empty() {
            return Err(Error::InvalidInput("workspace child is required".into()));
        }
        let root_entry = self
            .persistent
            .get(&workspace.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace is not persistent".into()))?;
        if !root_entry.stored.target_is_dir
            || !root_entry
                .stored
                .operations
                .contains(&PathOperation::WritePgn)
        {
            return Err(Error::InvalidInput(
                "invalid writable PGN workspace root".into(),
            ));
        }
        let root = root_entry.stored.path.to_path()?;
        let path = components.iter().fold(root, |mut path, component| {
            path.push(component);
            path
        });
        let class = if is_dir {
            PathClass::PersistentCustomRoot
        } else {
            PathClass::PersistentFile
        };
        self.persist_workspace_child(
            root_entry,
            path,
            display_name.into(),
            class,
            Identity {
                a: expected_identity.0,
                b: expected_identity.1,
            },
            is_dir,
        )
    }

    fn persist_workspace_child(
        &mut self,
        root_entry: Entry,
        path: PathBuf,
        display_name: String,
        class: PathClass,
        identity: Identity,
        is_dir: bool,
    ) -> Result<FileWorkspaceHandle, Error> {
        if let Some((id, _)) = self.persistent.iter().find(|(_, entry)| {
            entry.stored.path.to_path().ok().as_ref() == Some(&path)
                && entry.stored.identity == identity
                && entry.stored.target_is_dir == is_dir
        }) {
            return Ok(FileWorkspaceHandle::new(PathRef { id: id.clone() }));
        }
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name,
            class,
            operations: root_entry.stored.operations,
            path: NativePath::from_path(&path),
            identity,
            target_is_dir: is_dir,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        self.commit_candidate(candidate, None)?;
        Ok(FileWorkspaceHandle::new(id))
    }

    /// Converts an authority-created download leaf into an opaque persistent file handle. Native
    /// download code supplies only a validated single filename; no filesystem path crosses IPC.
    pub(crate) fn register_download_artifact(
        &mut self,
        root: &PathRef,
        filename: OsString,
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
    ) -> Result<FileWorkspaceHandle, Error> {
        self.validate_components(std::slice::from_ref(&filename))?;
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "download artifact requires operations".into(),
            ));
        }
        let root_entry = self
            .persistent
            .get(&root.id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("download root must be persistent".into()))?;
        if !root_entry.stored.target_is_dir
            || !root_entry
                .stored
                .operations
                .contains(&PathOperation::DownloadFile)
        {
            return Err(Error::InvalidInput(
                "capability is not a download root".into(),
            ));
        }
        self.resolve(
            root,
            PathOperation::DownloadFile,
            std::slice::from_ref(&filename),
        )?;
        let root_path = root_entry.stored.path.to_path()?;
        let path = root_path.join(&filename);
        let metadata = fs::symlink_metadata(&path)?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(Error::InvalidInput(
                "download artifact must be a regular file".into(),
            ));
        }
        let identity = validate_target(&path, PathClass::PersistentFile)?;
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name: display_name.into(),
            class: PathClass::PersistentFile,
            operations,
            path: NativePath::from_path(&path),
            identity,
            target_is_dir: false,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        self.commit_candidate(candidate, None)?;
        Ok(FileWorkspaceHandle::new(id))
    }

    /// Persists a recovery intent before the download target is mutated. It binds the root inode,
    /// single leaf, and SHA-256/size of the already-complete staging payload. The reservation has
    /// no renderer-visible capability and cannot be used to access the target until activation.
    pub(crate) fn reserve_download_artifact(
        &mut self,
        root: &PathRef,
        filename: OsString,
        staged_payload: &Path,
        display_name: impl Into<String>,
        operations: Vec<PathOperation>,
    ) -> Result<PendingArtifactReservation, Error> {
        self.validate_components(std::slice::from_ref(&filename))?;
        if operations.is_empty() {
            return Err(Error::InvalidInput(
                "download artifact requires operations".into(),
            ));
        }
        let root_entry = self
            .persistent
            .get(&root.id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("download root must be persistent".into()))?;
        if !root_entry.stored.target_is_dir
            || !root_entry
                .stored
                .operations
                .contains(&PathOperation::DownloadFile)
        {
            return Err(Error::InvalidInput(
                "capability is not a download root".into(),
            ));
        }
        let root_path = root_entry.stored.path.to_path()?;
        let root_identity = validate_target(&root_path, PathClass::PersistentCustomRoot)?;
        if root_identity != root_entry.stored.identity {
            return Err(Error::Conflict(
                "download root changed before artifact reservation".into(),
            ));
        }
        let path = root_path.join(&filename);
        let baseline = match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                return Err(Error::InvalidInput(
                    "download artifact target must be a regular file".into(),
                ));
            }
            Ok(_) => Some(identity(&path)?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(Error::from(error)),
        };
        let (payload_size, payload_sha256) = sha256_file(staged_payload)?;
        let pending = PendingArtifact {
            id: PathRef::fresh(),
            root: root.clone(),
            filename: NativePath::from_path(&PathBuf::from(&filename)),
            display_name: display_name.into(),
            operations,
            baseline,
            root_identity: Some(root_identity),
            payload_size,
            payload_sha256,
            payload_bound: true,
            installed_identity: None,
            installed_ctime_nanos: None,
        };
        let mut next_pending = self.pending_artifacts.clone();
        next_pending.push(pending.clone());
        let durability = self.save_entries(
            &self.persistent,
            &self.active_database_root,
            &self.active_puzzle_root,
            &self.active_engine_root,
            &next_pending,
        )?;
        match durability {
            CommitDurability::Durable => self.pending_artifacts = next_pending,
            CommitDurability::DurabilityUncertain(_) => {
                // The stage the commit reports is the registry write; what the caller must not do
                // is act on the reservation, so name that instead.
                return Err(Error::CommittedDurabilityUncertain(
                    crate::error::DurabilityStage::ArchiveReservationJournal,
                ));
            }
        }
        Ok(PendingArtifactReservation {
            id: pending.id,
            payload_size: pending.payload_size,
            payload_sha256: pending.payload_sha256,
        })
    }

    /// Activates exactly the artifact covered by a durable reservation after atomic replacement.
    /// A failed activation intentionally leaves the durable intent in place so restart recovery
    /// can return the same opaque capability instead of losing a published file.
    pub(crate) fn activate_download_artifact(
        &mut self,
        reservation: &PendingArtifactReservation,
    ) -> Result<ArtifactPublication, Error> {
        let pending = self
            .pending_artifacts
            .iter()
            .find(|pending| pending.id == reservation.id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("unknown download artifact reservation".into()))?;
        let root = self
            .persistent
            .get(&pending.root.id)
            .cloned()
            .ok_or_else(|| {
                Error::Conflict("download root disappeared before artifact activation".into())
            })?;
        let root_path = root.stored.path.to_path()?;
        let root_identity = validate_target(&root_path, PathClass::PersistentCustomRoot)?;
        if root_identity != root.stored.identity
            || pending.root_identity.as_ref() != Some(&root_identity)
        {
            return Err(Error::Conflict(
                "download root changed before artifact activation".into(),
            ));
        }
        let filename = pending.filename.to_path()?;
        let path = root_path.join(&filename);
        let leaf = filename
            .file_name()
            .ok_or_else(|| Error::InvalidInput("artifact reservation has no leaf".into()))?
            .to_os_string();
        let resolved = self.resolve(&pending.root, PathOperation::DownloadFile, &[leaf])?;
        let mut opened = resolved
            .file
            .ok_or_else(|| Error::Conflict("artifact target is not a regular file".into()))?;
        let (a, b) = opened_file_identity(&opened)?;
        let current = Identity { a, b };
        if !pending.payload_bound
            || sha256_open_file(&mut opened)?
                != (pending.payload_size, pending.payload_sha256.clone())
        {
            return Err(Error::Conflict(
                "download artifact payload differs from its durable reservation".into(),
            ));
        }
        let current_ctime_nanos = opened_file_change_nanos(&opened)?;
        if pending.installed_identity.as_ref() != Some(&current)
            || pending.installed_ctime_nanos != Some(current_ctime_nanos)
        {
            return Err(Error::Conflict(
                "download artifact has no durable post-rename identity marker".into(),
            ));
        }
        if pending
            .baseline
            .as_ref()
            .is_some_and(|baseline| baseline == &current)
        {
            return Err(Error::Conflict(
                "download artifact target was not replaced before activation".into(),
            ));
        }
        let stored = StoredEntry {
            id: pending.id.clone(),
            display_name: pending.display_name,
            class: PathClass::PersistentFile,
            operations: pending.operations,
            path: NativePath::from_path(&path),
            identity: current,
            target_is_dir: false,
        };
        let mut candidate = self.persistent.clone();
        candidate.insert(
            stored.id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        let next_pending: Vec<_> = self
            .pending_artifacts
            .iter()
            .filter(|pending| pending.id != reservation.id)
            .cloned()
            .collect();
        let durability = self.save_entries(
            &candidate,
            &self.active_database_root,
            &self.active_puzzle_root,
            &self.active_engine_root,
            &next_pending,
        )?;
        self.persistent = candidate;
        self.pending_artifacts = next_pending;
        Ok(ArtifactPublication {
            handle: FileWorkspaceHandle::new(reservation.id.clone()),
            durability,
        })
    }

    /// Records the exact no-follow inode installed by an already-completed rename. Failure or
    /// uncertain durability deliberately leaves the intent quarantined; callers must not retry
    /// the install because the target may already have changed.
    pub(crate) fn mark_download_artifact_committed(
        &mut self,
        reservation: &PendingArtifactReservation,
        installed_identity: (u64, u64),
        installed_ctime_nanos: i128,
    ) -> Result<(), Error> {
        let pending = self
            .pending_artifacts
            .iter()
            .find(|item| item.id == reservation.id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("unknown download artifact reservation".into()))?;
        if !pending.payload_bound {
            return Err(Error::Conflict(
                "legacy artifact intent is quarantined".into(),
            ));
        }
        let mut next = self.pending_artifacts.clone();
        let item = next
            .iter_mut()
            .find(|item| item.id == reservation.id)
            .expect("reservation was cloned from pending artifacts");
        item.installed_identity = Some(Identity {
            a: installed_identity.0,
            b: installed_identity.1,
        });
        item.installed_ctime_nanos = Some(installed_ctime_nanos);
        match self.save_entries(
            &self.persistent,
            &self.active_database_root,
            &self.active_puzzle_root,
            &self.active_engine_root,
            &next,
        )? {
            CommitDurability::Durable => {
                self.pending_artifacts = next;
                Ok(())
            }
            CommitDurability::DurabilityUncertain(_) => Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::ArchiveCommitMarker,
            )),
        }
    }

    pub(crate) fn abandon_download_artifact(&mut self, reservation: &PendingArtifactReservation) {
        let next_pending: Vec<_> = self
            .pending_artifacts
            .iter()
            .filter(|pending| pending.id != reservation.id)
            .cloned()
            .collect();
        if next_pending.len() == self.pending_artifacts.len() {
            return;
        }
        if self
            .save_entries(
                &self.persistent,
                &self.active_database_root,
                &self.active_puzzle_root,
                &self.active_engine_root,
                &next_pending,
            )
            .is_ok()
        {
            self.pending_artifacts = next_pending;
        }
    }

    /// Rebinds a successfully renamed entry without reopening its mutable pathname. `renameat`
    /// preserves the object identity already stored on the capability; a later resolver either
    /// observes that exact object at the new path or fails closed.
    pub(crate) fn rebind_workspace_entry(
        &mut self,
        handle: &FileWorkspaceHandle,
        path: &Path,
        display_name: impl Into<String>,
    ) -> Result<(), Error> {
        let mut candidate = self.persistent.clone();
        let entry = candidate
            .get_mut(&handle.path_ref().id)
            .ok_or_else(|| Error::Conflict("workspace entry disappeared".into()))?;
        entry.stored.path = NativePath::from_path(path);
        entry.stored.display_name = display_name.into();
        entry.availability = PathAvailability::Available;
        self.commit_candidate(candidate, None)?;
        Ok(())
    }

    pub(crate) fn workspace_entry_path(
        &mut self,
        handle: &FileWorkspaceHandle,
        operation: PathOperation,
    ) -> Result<PathBuf, Error> {
        let entry = self
            .persistent
            .get(&handle.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace entry is not persistent".into()))?;
        if !entry.stored.operations.contains(&operation) {
            return Err(Error::InvalidInput(
                "workspace entry does not permit this operation".into(),
            ));
        }
        let class = if entry.stored.target_is_dir {
            PathClass::PersistentCustomRoot
        } else {
            PathClass::PersistentFile
        };
        let path = entry.stored.path.to_path()?;
        if validate_target(&path, class)? != entry.stored.identity {
            return Err(Error::Conflict(
                "workspace entry is unavailable because its object changed".into(),
            ));
        }
        Ok(path)
    }

    /// Resolves an opaque workspace capability into retained no-follow descriptors.  This is the
    /// mutation boundary: callers must not reopen `path()` for filesystem changes.
    #[cfg(unix)]
    pub(crate) fn workspace_mutation_target(
        &mut self,
        handle: &FileWorkspaceHandle,
    ) -> Result<WorkspaceMutationTarget, Error> {
        let target = self.retained_workspace_target(handle, PathOperation::WritePgn)?;
        let directory = if target.target_is_dir {
            Some(crate::infra::fs::open_verified_directory(
                &target.path,
                target.identity,
            )?)
        } else {
            None
        };
        Ok(WorkspaceMutationTarget {
            parent: target.parent,
            directory,
            leaf: target.leaf,
            identity: target.identity,
            is_dir: target.target_is_dir,
            path: target.path,
        })
    }

    #[cfg(unix)]
    fn retained_workspace_target(
        &mut self,
        handle: &FileWorkspaceHandle,
        required_operation: PathOperation,
    ) -> Result<RetainedWorkspaceTarget, Error> {
        let entry = self
            .persistent
            .get(&handle.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace entry is not persistent".into()))?;
        if !entry.stored.operations.contains(&required_operation) {
            return Err(Error::InvalidInput(
                "workspace entry does not permit this operation".into(),
            ));
        }
        let path = entry.stored.path.to_path()?;
        let expected = (entry.stored.identity.a, entry.stored.identity.b);
        let (parent, leaf) =
            crate::infra::fs::open_verified_parent(&path, expected, entry.stored.target_is_dir)?;
        Ok(RetainedWorkspaceTarget {
            parent,
            leaf,
            identity: expected,
            target_is_dir: entry.stored.target_is_dir,
            path,
        })
    }

    pub(crate) fn remove_workspace_entry(
        &mut self,
        handle: &FileWorkspaceHandle,
        status: WorkspaceRemovalStatus,
    ) -> Result<CommitDurability, Error> {
        let removed = self
            .persistent
            .get(&handle.path_ref().id)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("workspace entry is not persistent".into()))?;
        let removed_path = removed.stored.path.to_path()?;
        let mut candidate = self.persistent.clone();
        if status == WorkspaceRemovalStatus::Complete {
            candidate.remove(&handle.path_ref().id);
        }
        if removed.stored.target_is_dir {
            candidate.retain(|id, entry| {
                if id == &handle.path_ref().id {
                    return status == WorkspaceRemovalStatus::Partial;
                }
                let Ok(path) = entry.stored.path.to_path() else {
                    return true;
                };
                let is_descendant =
                    path != removed_path && path.strip_prefix(&removed_path).is_ok();
                if !is_descendant {
                    return true;
                }
                if status == WorkspaceRemovalStatus::Complete {
                    return false;
                }
                refresh_entry(entry);
                entry.availability == PathAvailability::Available
            });
        }

        let removed_ids: Vec<_> = self
            .persistent
            .keys()
            .filter(|id| !candidate.contains_key(*id))
            .cloned()
            .collect();
        let mut pending_artifacts = self.pending_artifacts.clone();
        pending_artifacts.retain(|pending| !removed_ids.contains(&pending.root.id));
        // An intent whose root was removed by this operation can never activate. This is scoped
        // here rather than made a general commit invariant because other commits do not establish
        // that a missing root was deliberately deleted.
        //
        // After a successful save, workspace records no longer outlive the objects they name. If
        // saving fails, however, this prune is not adopted: in-memory state must not diverge from
        // what was persisted, so the unavailable records remain until a later successful,
        // explicit reconciliation. Residual accumulation is therefore limited to registry-save
        // failures rather than ordinary workspace create-and-delete use.
        self.commit_candidate_with_pending(candidate, pending_artifacts, None)
    }

    /// Rebind every persistent child below a moved directory in one registry replacement. This
    /// keeps already-open tabs and recents attached to their original filesystem identities
    /// after a native directory move; paths never need to be reconstructed in the renderer.
    pub(crate) fn rebase_workspace_entries(
        &mut self,
        old_root: &Path,
        new_root: &Path,
    ) -> Result<(), Error> {
        let mut candidate = self.persistent.clone();
        let mut changed = false;
        for entry in candidate.values_mut() {
            let Ok(path) = entry.stored.path.to_path() else {
                continue;
            };
            let Ok(suffix) = path.strip_prefix(old_root) else {
                continue;
            };
            let rebased = new_root.join(suffix);
            // A namespace rename cannot change the object. Keep the pre-rename identity instead
            // of reopening `rebased`, which could bind an attacker replacement after commit.
            entry.stored.path = NativePath::from_path(&rebased);
            entry.availability = PathAvailability::Available;
            changed = true;
        }
        if changed {
            self.commit_candidate(candidate, None)?;
        }
        Ok(())
    }
    fn take_dialog(
        &mut self,
        id: &PathRef,
        required: Option<PathOperation>,
    ) -> Result<DialogGrant, Error> {
        self.evict_dialogs();
        let mut grant = self.dialogs.remove(&id.id).ok_or_else(|| {
            Error::InvalidInput("unknown, revoked, or expired dialog grant".into())
        })?;
        if let Some(op) = required {
            if !grant.entry.stored.operations.contains(&op) {
                self.dialogs.insert(id.id.clone(), grant);
                return Err(Error::InvalidInput(
                    "dialog grant does not permit this operation".into(),
                ));
            }
        }
        grant.uses_left -= 1;
        if grant.uses_left > 0 {
            self.dialogs.insert(id.id.clone(), grant.clone());
        }
        Ok(grant)
    }
    fn evict_dialogs(&mut self) {
        let now = self.clock.now();
        self.dialogs.retain(|_, g| g.expires_at > now);
    }
    fn refresh_persistent(&mut self) {
        for entry in self.persistent.values_mut() {
            refresh_entry(entry);
        }
    }
    fn validate_components(&self, components: &[OsString]) -> Result<(), Error> {
        for name in components {
            let s = name.as_os_str();
            if s.is_empty()
                || s == OsStr::new(".")
                || s == OsStr::new("..")
                || Path::new(s).components().count() != 1
            {
                return Err(Error::InvalidInput(
                    "invalid relative path component".into(),
                ));
            }
            #[cfg(unix)]
            {
                use std::os::unix::ffi::OsStrExt;
                if s.as_bytes().contains(&b'/') || s.as_bytes().contains(&0) {
                    return Err(Error::InvalidInput(
                        "path component contains a separator or NUL".into(),
                    ));
                }
            }
        }
        Ok(())
    }
    fn save(&self) -> Result<CommitDurability, Error> {
        self.save_entries(
            &self.persistent,
            &self.active_database_root,
            &self.active_puzzle_root,
            &self.active_engine_root,
            &self.pending_artifacts,
        )
    }
    fn save_entries(
        &self,
        entries: &BTreeMap<String, Entry>,
        active_database_root: &Option<PathRef>,
        active_puzzle_root: &Option<PathRef>,
        active_engine_root: &Option<PathRef>,
        pending_artifacts: &[PendingArtifact],
    ) -> Result<CommitDurability, Error> {
        self.save_entries_with(
            entries,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            |target, write| atomic_replace(target, write),
        )
    }
    fn commit_candidate(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        consumed_dialog: Option<&PathRef>,
    ) -> Result<CommitDurability, Error> {
        self.commit_candidate_with_pending(
            candidate,
            self.pending_artifacts.clone(),
            consumed_dialog,
        )
    }
    fn commit_candidate_with_pending(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        pending_artifacts: Vec<PendingArtifact>,
        consumed_dialog: Option<&PathRef>,
    ) -> Result<CommitDurability, Error> {
        let active_database_root = self
            .active_database_root
            .clone()
            .filter(|id| candidate.contains_key(&id.id));
        let active_puzzle_root = self
            .active_puzzle_root
            .clone()
            .filter(|id| candidate.contains_key(&id.id));
        let active_engine_root = self
            .active_engine_root
            .clone()
            .filter(|id| candidate.contains_key(&id.id));
        let durability = self.commit_state(
            candidate,
            active_database_root,
            active_puzzle_root,
            active_engine_root,
            pending_artifacts,
            consumed_dialog,
        )?;
        Ok(durability)
    }
    fn commit_state(
        &mut self,
        candidate: BTreeMap<String, Entry>,
        active_database_root: Option<PathRef>,
        active_puzzle_root: Option<PathRef>,
        active_engine_root: Option<PathRef>,
        pending_artifacts: Vec<PendingArtifact>,
        consumed_dialog: Option<&PathRef>,
    ) -> Result<CommitDurability, Error> {
        let durability = self.save_entries(
            &candidate,
            &active_database_root,
            &active_puzzle_root,
            &active_engine_root,
            &pending_artifacts,
        )?;
        self.persistent = candidate;
        self.active_database_root = active_database_root;
        self.active_puzzle_root = active_puzzle_root;
        self.active_engine_root = active_engine_root;
        self.pending_artifacts = pending_artifacts;
        if let Some(dialog) = consumed_dialog {
            self.dialogs.remove(&dialog.id);
        }
        Ok(durability)
    }
    fn save_entries_with<F>(
        &self,
        source: &BTreeMap<String, Entry>,
        active_database_root: &Option<PathRef>,
        active_puzzle_root: &Option<PathRef>,
        active_engine_root: &Option<PathRef>,
        pending_artifacts: &[PendingArtifact],
        replace: F,
    ) -> Result<CommitDurability, Error>
    where
        F: FnOnce(
            &Path,
            Box<dyn FnOnce(&mut fs::File) -> Result<(), Error>>,
        ) -> Result<AtomicFileOutcome, Error>,
    {
        let entries = source
            .values()
            .filter(|e| e.stored.class != PathClass::AppOwnedRoot)
            .map(|e| e.stored.clone())
            .collect();
        let bytes = serde_json::to_vec(&Registry {
            schema_version: SCHEMA_VERSION,
            entries,
            active_database_root: active_database_root.clone(),
            active_puzzle_root: active_puzzle_root.clone(),
            active_engine_root: active_engine_root.clone(),
            pending_artifacts: pending_artifacts.to_vec(),
        })
        .map_err(|e| Error::InvalidInput(e.to_string()))?;
        let outcome = replace(
            &self.registry_path,
            Box::new(move |f| f.write_all(&bytes).map_err(Error::from)),
        )?;
        let stage = crate::infra::fs::map_atomic_file_outcome(
            outcome,
            crate::error::DurabilityStage::RegistryReplacement,
            |error| log::warn!("path authority registry replacement parent sync failed: {error}"),
        );
        Ok(match stage {
            Some(stage) => CommitDurability::DurabilityUncertain(stage),
            None => CommitDurability::Durable,
        })
    }
}
fn validate_persisted_shape(entry: &StoredEntry) -> Result<(), Error> {
    if !matches!(
        entry.class,
        PathClass::PersistentCustomRoot | PathClass::PersistentFile
    ) || entry.operations.is_empty()
        || entry.id.id.is_empty()
        || entry.display_name.is_empty()
        || entry.target_is_dir != (entry.class == PathClass::PersistentCustomRoot)
    {
        return Err(Error::InvalidInput(
            "invalid persistent path registry entry".into(),
        ));
    }
    Ok(())
}
fn refresh_entry(entry: &mut Entry) {
    let path = match entry.stored.path.to_path() {
        Ok(path) => path,
        Err(_) => {
            entry.availability = PathAvailability::Unavailable;
            return;
        }
    };
    let class = if entry.stored.target_is_dir {
        PathClass::PersistentCustomRoot
    } else {
        PathClass::PersistentFile
    };
    entry.availability =
        validate_target(&path, class).map_or(PathAvailability::Unavailable, |id| {
            if id == entry.stored.identity {
                PathAvailability::Available
            } else {
                PathAvailability::Unavailable
            }
        });
}
fn descriptor(stored: &StoredEntry, availability: PathAvailability) -> PathDescriptor {
    PathDescriptor {
        id: stored.id.clone(),
        display_name: stored.display_name.clone(),
        class: stored.class,
        availability,
    }
}

#[cfg(unix)]
fn file_identity(meta: &fs::Metadata) -> Identity {
    use std::os::unix::fs::MetadataExt;
    Identity {
        a: meta.dev(),
        b: meta.ino(),
    }
}

#[cfg(unix)]
fn resolve_unix(
    root: &Path,
    expected_root: &Identity,
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
                        PathOperation::DownloadFile | PathOperation::DownloadArchive
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
            let leaf_identity = Identity {
                a: stat.st_dev,
                b: stat.st_ino,
            };
            if !root_is_dir && leaf_identity != *expected_root {
                return Err(Error::Conflict(
                    "file authority changed concurrently".into(),
                ));
            }
            let file = fs::File::from(
                rfs::openat(
                    &handle,
                    name,
                    if is_write_operation(operation) {
                        OFlags::RDWR
                    } else {
                        OFlags::RDONLY
                    } | OFlags::NOFOLLOW
                        | OFlags::CLOEXEC,
                    Mode::empty(),
                )
                .map_err(|e| Error::from(std::io::Error::from(e)))?,
            );
            if file_identity(&file.metadata()?) != leaf_identity {
                return Err(Error::Conflict("file changed while resolving".into()));
            }
            exact_file = Some(file);
        }
        if !last {
            handle = fs::File::from(
                rfs::openat(
                    &handle,
                    name,
                    OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                    Mode::empty(),
                )
                .map_err(|e| Error::from(std::io::Error::from(e)))?,
            );
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
fn resolve_windows(
    root: &Path,
    expected_root: &Identity,
    root_is_dir: bool,
    components: &[OsString],
    operation: PathOperation,
) -> Result<ResolvedPath, Error> {
    let mut handle = if root_is_dir {
        let handle = open_windows_nofollow(root, false)?;
        if windows_file_identity(&handle)? != *expected_root {
            return Err(Error::Conflict("root changed concurrently".into()));
        }
        handle
    } else if !components.is_empty() {
        return Err(Error::InvalidInput(
            "file authority cannot have child components".into(),
        ));
    } else {
        open_windows_nofollow(
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
        let file = open_windows_child(
            &handle,
            name,
            last && is_write_operation(operation),
            !last,
            allows_delete_sharing_for_operation(operation, last),
        )?;
        let meta = file.metadata()?;
        if is_reparse_point(&meta)
            || (!last && !meta.is_dir())
            || (last && !meta.is_dir() && !meta.is_file())
        {
            return Err(Error::InvalidInput(
                "path contains a reparse point or special file".into(),
            ));
        }
        if last && meta.is_file() {
            if !root_is_dir && windows_file_identity(&file)? != *expected_root {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::fs::{
        set_test_atomic_file_injector, AtomicFileFaultPoint, AtomicWriterInjector,
    };
    use std::{
        os::unix::ffi::OsStringExt,
        sync::atomic::{AtomicU64, Ordering},
        time::UNIX_EPOCH,
    };
    struct TestClock(AtomicU64);
    impl TestClock {
        fn new(v: u64) -> Self {
            Self(AtomicU64::new(v))
        }
        fn advance(&self, n: u64) {
            self.0.fetch_add(n, Ordering::SeqCst);
        }
    }
    impl Clock for TestClock {
        fn now(&self) -> SystemTime {
            UNIX_EPOCH + Duration::from_secs(self.0.load(Ordering::SeqCst))
        }
    }
    fn authority(dir: &tempfile::TempDir, clock: Arc<TestClock>) -> PathAuthority {
        PathAuthority::open_with_clock(dir.path().join("registry.json"), vec![], clock, 2).unwrap()
    }

    #[cfg(unix)]
    #[test]
    fn database_file_target_enforces_the_exact_stored_operation() {
        let dir = tempfile::tempdir().unwrap();
        let database = dir.path().join("readonly.db3");
        fs::write(&database, b"database").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let grant = authority
            .grant_dialog(
                &database,
                "readonly",
                PathClass::SingleDialogGrant,
                PathOperation::DatabaseRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let committed = authority
            .promote_dialog(
                &grant,
                PathClass::PersistentFile,
                "readonly",
                vec![PathOperation::DatabaseRead],
            )
            .unwrap();
        let handle = DatabaseHandle::new(committed.id);

        let target = authority
            .database_file_target(&handle, PathOperation::DatabaseRead)
            .unwrap();
        assert_eq!(target.leaf, OsString::from("readonly.db3"));
        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DatabaseMutate),
            Err(Error::InvalidInput(_))
        ));
        assert!(matches!(
            authority.database_file_target(&handle, PathOperation::DatabaseExport),
            Err(Error::InvalidInput(_))
        ));
    }
    #[test]
    fn dialog_grants_enforce_operation_expiry_revoke_and_uses() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut a = authority(&dir, clock.clone());
        let id = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(3),
                1,
            )
            .unwrap();
        assert!(a.resolve(&id, PathOperation::WritePgn, &[]).is_err());
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_err());
        let exp = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(1),
                1,
            )
            .unwrap();
        clock.advance(1);
        assert!(a.resolve(&exp, PathOperation::ReadPgn, &[]).is_err());
        let revoked = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(3),
                1,
            )
            .unwrap();
        assert!(a.revoke_dialog(&revoked));
        assert!(a.resolve(&revoked, PathOperation::ReadPgn, &[]).is_err());
    }

    #[test]
    fn download_destination_is_operation_gated_and_never_exposes_a_path() {
        let dir = tempfile::tempdir().unwrap();
        let clock = Arc::new(TestClock::new(1));
        let root = AppOwnedRoot::new(
            "downloads",
            dir.path().to_path_buf(),
            vec![PathOperation::DownloadFile],
        );
        let id = root.id.clone();
        let mut authority =
            PathAuthority::open_with_clock(dir.path().join("registry.json"), vec![root], clock, 2)
                .unwrap();
        assert!(authority
            .resolve(&id, PathOperation::ReadPgn, &["new.pgn".into()])
            .is_err());
        let destination = authority
            .resolve(&id, PathOperation::DownloadFile, &["new.pgn".into()])
            .unwrap();
        destination
            .atomic_replace_download(|file| file.write_all(b"download").map_err(Error::from))
            .unwrap();
        assert_eq!(fs::read(dir.path().join("new.pgn")).unwrap(), b"download");
    }

    #[cfg(unix)]
    #[test]
    fn engine_install_marks_only_the_resolved_file_executable() {
        use std::os::unix::fs::MetadataExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("engine");
        fs::write(&path, b"engine").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let id = authority
            .grant_dialog(
                &path,
                "engine",
                PathClass::SingleDialogGrant,
                PathOperation::EngineInstall,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        authority
            .resolve(&id, PathOperation::EngineInstall, &[])
            .unwrap()
            .mark_engine_executable()
            .unwrap();
        assert_ne!(fs::metadata(&path).unwrap().mode() & 0o111, 0);
    }

    #[test]
    fn pgn_atomic_precommit_reopens_target_and_rejects_external_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("game.pgn");
        fs::write(&path, b"old").unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut authority = authority(&dir, clock);
        let id = authority
            .grant_dialog(
                &path,
                "game",
                PathClass::SingleDialogGrant,
                PathOperation::WritePgn,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        let resolved = authority
            .resolve(&id, PathOperation::WritePgn, &[])
            .unwrap();
        let snapshot = resolved.pgn_snapshot().unwrap();
        let replacement = dir.path().join("replacement.pgn");
        fs::write(&replacement, b"external").unwrap();
        fs::rename(&replacement, &path).unwrap();
        assert!(resolved
            .replace_pgn_atomic(&snapshot, |_, temp| temp
                .write_all(b"new")
                .map_err(Error::from))
            .is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external");
    }

    #[cfg(unix)]
    #[test]
    fn pgn_precommit_retains_parent_handle_and_intermediate_symlink_swap_cannot_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let slot = dir.path().join("slot");
        fs::create_dir(&slot).unwrap();
        let path = slot.join("game.pgn");
        fs::write(&path, b"old").unwrap();
        let attacker = dir.path().join("attacker");
        fs::create_dir(&attacker).unwrap();
        fs::write(attacker.join("game.pgn"), b"attacker").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let id = authority
            .grant_dialog(
                &path,
                "game",
                PathClass::SingleDialogGrant,
                PathOperation::WritePgn,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        let resolved = authority
            .resolve(&id, PathOperation::WritePgn, &[])
            .unwrap();
        let snapshot = resolved.pgn_snapshot().unwrap();
        fs::rename(&slot, dir.path().join("slot-old")).unwrap();
        std::os::unix::fs::symlink(&attacker, &slot).unwrap();
        assert!(resolved
            .replace_pgn_atomic(&snapshot, |_, temp| temp
                .write_all(b"new")
                .map_err(Error::from))
            .is_err());
        assert_eq!(fs::read(attacker.join("game.pgn")).unwrap(), b"attacker");
    }

    #[test]
    fn pgn_workspace_grant_supports_count_read_and_mutate_lifecycle() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("game.pgn");
        fs::write(&path, b"[Event \"A\"]\n\n1. e4\n").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let id = authority
            .grant_dialog_operations(
                &path,
                "game",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30),
                3,
            )
            .unwrap();
        assert!(authority.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
        assert!(authority.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
        assert!(authority.resolve(&id, PathOperation::WritePgn, &[]).is_ok());
        assert!(authority.resolve(&id, PathOperation::ReadPgn, &[]).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn workspace_registry_never_binds_post_commit_replacements() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let path = workspace.join("game.pgn");
        fs::write(&path, b"original").unwrap();
        let original = identity(&path).unwrap();
        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let grant = authority
            .grant_dialog_operations(
                &workspace,
                "workspace",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let root = FileWorkspaceHandle::new(
            authority
                .promote_dialog(
                    &grant,
                    PathClass::PersistentCustomRoot,
                    "workspace",
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                )
                .unwrap()
                .id,
        );

        fs::rename(&path, workspace.join("original.pgn")).unwrap();
        fs::write(&path, b"replacement").unwrap();
        let handle = authority
            .register_workspace_child_expected(
                &root,
                &[OsString::from("game.pgn")],
                "game",
                (original.a, original.b),
                false,
            )
            .unwrap();

        assert!(matches!(
            authority.resolve(handle.path_ref(), PathOperation::ReadPgn, &[]),
            Err(Error::Conflict(_))
        ));

        let source = workspace.join("source.pgn");
        fs::write(&source, b"move source").unwrap();
        let moved_handle = authority
            .register_workspace_child(&root, &[OsString::from("source.pgn")], "source")
            .unwrap();
        let moved = workspace.join("moved.pgn");
        fs::rename(&source, &moved).unwrap();
        fs::rename(&moved, workspace.join("moved-original.pgn")).unwrap();
        fs::write(&moved, b"attacker replacement").unwrap();
        authority
            .rebind_workspace_entry(&moved_handle, &moved, "moved")
            .unwrap();
        assert!(matches!(
            authority.resolve(moved_handle.path_ref(), PathOperation::ReadPgn, &[]),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn complete_workspace_directory_removal_prunes_descendants_even_when_commit_is_uncertain() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        let victim = workspace.join("victim");
        fs::create_dir_all(victim.join("nested")).unwrap();
        fs::write(victim.join("nested/game.pgn"), b"*").unwrap();
        fs::write(workspace.join("sibling.pgn"), b"*").unwrap();
        let registry = dir.path().join("registry.json");
        let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
        let grant = authority
            .grant_dialog_operations(
                &workspace,
                "workspace",
                PathClass::BoundedDialogGrant,
                vec![
                    PathOperation::ReadPgn,
                    PathOperation::WritePgn,
                    PathOperation::DatabaseRead,
                    PathOperation::PuzzleRead,
                    PathOperation::EngineInstall,
                ],
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let root = FileWorkspaceHandle::new(
            authority
                .promote_dialog(
                    &grant,
                    PathClass::PersistentCustomRoot,
                    "workspace",
                    vec![
                        PathOperation::ReadPgn,
                        PathOperation::WritePgn,
                        PathOperation::DatabaseRead,
                        PathOperation::PuzzleRead,
                        PathOperation::EngineInstall,
                    ],
                )
                .unwrap()
                .id,
        );
        let victim_handle = authority
            .register_workspace_child(&root, &[OsString::from("victim")], "victim")
            .unwrap();
        let nested_handle = authority
            .register_workspace_child(
                &root,
                &[OsString::from("victim"), OsString::from("nested")],
                "nested",
            )
            .unwrap();
        let game_handle = authority
            .register_workspace_child(
                &root,
                &[
                    OsString::from("victim"),
                    OsString::from("nested"),
                    OsString::from("game.pgn"),
                ],
                "game",
            )
            .unwrap();
        let sibling_handle = authority
            .register_workspace_child(&root, &[OsString::from("sibling.pgn")], "sibling")
            .unwrap();
        fs::remove_dir_all(&victim).unwrap();

        authority.active_database_root = Some(victim_handle.path_ref().clone());
        authority.active_puzzle_root = Some(victim_handle.path_ref().clone());
        authority.active_engine_root = Some(victim_handle.path_ref().clone());
        authority.pending_artifacts.push(PendingArtifact {
            id: PathRef::fresh(),
            root: victim_handle.path_ref().clone(),
            filename: NativePath::from_path(Path::new("artifact.pgn")),
            display_name: "artifact".into(),
            operations: vec![PathOperation::ReadPgn],
            baseline: None,
            root_identity: None,
            payload_size: 0,
            payload_sha256: String::new(),
            payload_bound: false,
            installed_identity: None,
            installed_ctime_nanos: None,
        });

        struct ParentSync;
        impl AtomicWriterInjector for ParentSync {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::ParentSync {
                    Err(std::io::Error::other(
                        "/private/registry: injected sync failure",
                    ))
                } else {
                    Ok(())
                }
            }
        }
        set_test_atomic_file_injector(Some(Box::new(ParentSync)));
        let durability = authority
            .remove_workspace_entry(&victim_handle, WorkspaceRemovalStatus::Complete)
            .unwrap();
        set_test_atomic_file_injector(None);

        assert!(matches!(
            durability,
            CommitDurability::DurabilityUncertain(
                crate::error::DurabilityStage::RegistryReplacement
            )
        ));
        for removed in [&victim_handle, &nested_handle, &game_handle] {
            assert!(!authority.persistent.contains_key(&removed.path_ref().id));
        }
        assert!(authority
            .persistent
            .contains_key(&sibling_handle.path_ref().id));

        let reloaded = PathAuthority::open(registry, vec![]).unwrap();
        for removed in [&victim_handle, &nested_handle, &game_handle] {
            assert!(!reloaded.persistent.contains_key(&removed.path_ref().id));
        }
        assert!(reloaded
            .persistent
            .contains_key(&sibling_handle.path_ref().id));
        assert_eq!(reloaded.active_database_root, None);
        assert_eq!(reloaded.active_puzzle_root, None);
        assert_eq!(reloaded.active_engine_root, None);
        assert!(reloaded.pending_artifacts.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn partial_workspace_directory_removal_keeps_survivors_and_prunes_missing_descendants() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        let victim = workspace.join("victim");
        fs::create_dir_all(&victim).unwrap();
        fs::write(victim.join("removed.pgn"), b"*").unwrap();
        fs::write(victim.join("survived.pgn"), b"*").unwrap();
        let mut authority = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        let grant = authority
            .grant_dialog_operations(
                &workspace,
                "workspace",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let root = FileWorkspaceHandle::new(
            authority
                .promote_dialog(
                    &grant,
                    PathClass::PersistentCustomRoot,
                    "workspace",
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                )
                .unwrap()
                .id,
        );
        let victim_handle = authority
            .register_workspace_child(&root, &[OsString::from("victim")], "victim")
            .unwrap();
        let removed_handle = authority
            .register_workspace_child(
                &root,
                &[OsString::from("victim"), OsString::from("removed.pgn")],
                "removed",
            )
            .unwrap();
        let survived_handle = authority
            .register_workspace_child(
                &root,
                &[OsString::from("victim"), OsString::from("survived.pgn")],
                "survived",
            )
            .unwrap();
        fs::remove_file(victim.join("removed.pgn")).unwrap();

        authority
            .remove_workspace_entry(&victim_handle, WorkspaceRemovalStatus::Partial)
            .unwrap();

        assert!(authority
            .persistent
            .contains_key(&victim_handle.path_ref().id));
        assert!(!authority
            .persistent
            .contains_key(&removed_handle.path_ref().id));
        assert!(authority
            .persistent
            .contains_key(&survived_handle.path_ref().id));
    }

    #[test]
    fn candidate_commit_clears_removed_active_roots_and_their_pending_intents() {
        let dir = tempfile::tempdir().unwrap();
        let root_path = dir.path().join("root");
        fs::create_dir(&root_path).unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(0)));
        let root = authority
            .migrate_legacy_os_path(
                root_path.into_os_string(),
                "root",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::DownloadFile],
            )
            .unwrap();
        authority.active_database_root = Some(root.id.clone());
        authority.active_puzzle_root = Some(root.id.clone());
        authority.active_engine_root = Some(root.id.clone());
        authority.pending_artifacts.push(PendingArtifact {
            id: PathRef::fresh(),
            root: root.id.clone(),
            filename: NativePath::from_path(Path::new("artifact.pgn")),
            display_name: "artifact".into(),
            operations: vec![PathOperation::ReadPgn],
            baseline: None,
            root_identity: None,
            payload_size: 0,
            payload_sha256: String::new(),
            payload_bound: false,
            installed_identity: None,
            installed_ctime_nanos: None,
        });

        authority
            .remove_workspace_entry(
                &FileWorkspaceHandle::new(root.id),
                WorkspaceRemovalStatus::Complete,
            )
            .unwrap();

        assert_eq!(authority.active_database_root, None);
        assert_eq!(authority.active_puzzle_root, None);
        assert_eq!(authority.active_engine_root, None);
        assert!(authority.pending_artifacts.is_empty());
    }

    #[test]
    fn serialized_handle_kinds_reject_cross_capability_deserialization() {
        let id = PathRef::fresh();
        let file = FileWorkspaceHandle::new(id.clone());
        let encoded = serde_json::to_value(file).unwrap();
        assert_eq!(encoded["kind"], "fileWorkspace");
        assert!(serde_json::from_value::<DatabaseHandle>(encoded).is_err());
    }

    #[test]
    fn pgn_workspace_promotes_its_complete_granted_operation_set() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("game.pgn");
        fs::write(&path, b"game").unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let id = authority
            .grant_dialog_operations(
                &path,
                "game",
                PathClass::BoundedDialogGrant,
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                Duration::from_secs(30),
                2,
            )
            .unwrap();
        let commit = authority
            .promote_dialog(
                &id,
                PathClass::PersistentFile,
                "game",
                vec![PathOperation::ReadPgn, PathOperation::WritePgn],
            )
            .unwrap();
        assert!(authority
            .resolve(&commit.id, PathOperation::WritePgn, &[])
            .is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn engine_resource_leases_pin_files_and_directories() {
        fn promote(
            authority: &mut PathAuthority,
            path: &Path,
            kind: EngineResourceHandleKind,
        ) -> EngineResourceHandle {
            let grant = authority
                .grant_dialog(
                    path,
                    "resource",
                    PathClass::SingleDialogGrant,
                    PathOperation::EngineResourceRead,
                    Duration::from_secs(30),
                    1,
                )
                .unwrap();
            authority
                .promote_engine_resource(&grant, kind, "resource")
                .unwrap()
        }

        let dir = tempfile::tempdir().unwrap();
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));

        let file = dir.path().join("network.nnue");
        fs::write(&file, b"original network").unwrap();
        let file_handle = promote(&mut authority, &file, EngineResourceHandleKind::File);
        let file_lease = authority.engine_resource(&file_handle).unwrap();
        fs::rename(&file, dir.path().join("network-original.nnue")).unwrap();
        fs::write(&file, b"attacker network").unwrap();
        assert_eq!(
            fs::read(file_lease.uci_value()).unwrap(),
            b"original network"
        );
        assert!(matches!(
            authority.engine_resource(&file_handle),
            Err(Error::Conflict(_))
        ));

        let tables = dir.path().join("tables");
        fs::create_dir(&tables).unwrap();
        fs::write(tables.join("tablebase"), b"original table").unwrap();
        let directory_handle =
            promote(&mut authority, &tables, EngineResourceHandleKind::Directory);
        let directory_lease = authority.engine_resource(&directory_handle).unwrap();
        fs::rename(&tables, dir.path().join("tables-original")).unwrap();
        fs::create_dir(&tables).unwrap();
        fs::write(tables.join("tablebase"), b"attacker table").unwrap();
        assert_eq!(
            fs::read(PathBuf::from(directory_lease.uci_value()).join("tablebase")).unwrap(),
            b"original table"
        );
        assert!(matches!(
            authority.engine_resource(&directory_handle),
            Err(Error::Conflict(_))
        ));
    }

    /// The child must be handed every resource lease *and* the engine image, and
    /// the descriptors must be the ones the leases actually hold. Dropping the
    /// image descriptor is what makes a wrapper-script engine fail to launch;
    /// dropping a resource descriptor silently redirects the engine to whatever
    /// the visible path now resolves to.
    #[cfg(unix)]
    #[test]
    fn inherited_descriptors_cover_every_resource_lease_and_the_engine_image() {
        use std::os::fd::AsRawFd;

        let dir = tempfile::tempdir().unwrap();
        let image = dir.path().join("engine");
        fs::write(&image, b"#!/bin/sh\n").unwrap();
        let first = dir.path().join("book.bin");
        fs::write(&first, b"book").unwrap();
        let second = dir.path().join("network.nnue");
        fs::write(&second, b"network").unwrap();

        let image_file = fs::File::open(&image).unwrap();
        let image_fd = image_file.as_raw_fd();
        let executable =
            EngineExecutable::test_fixture(image_file, dir.path().to_path_buf(), Vec::new());

        // No resource options configured: the image alone must still be inherited,
        // otherwise the interpreter cannot reopen a script engine.
        assert_eq!(executable.inherited_fds(), vec![image_fd]);

        let leases = vec![
            EngineResourceLease::test_file(fs::File::open(&first).unwrap()),
            EngineResourceLease::test_file(fs::File::open(&second).unwrap()),
        ];
        let lease_fds: Vec<_> = leases.iter().map(|lease| lease.file.as_raw_fd()).collect();
        let executable = executable.with_resource_leases(leases);

        let inherited = executable.inherited_fds();
        assert_eq!(inherited, [lease_fds.as_slice(), &[image_fd]].concat());
        // Each inherited descriptor must still name the authorized inode.
        assert_eq!(
            fs::read(format!("/proc/self/fd/{}", inherited[0])).unwrap(),
            b"book"
        );
        assert_eq!(
            fs::read(format!("/proc/self/fd/{}", inherited[1])).unwrap(),
            b"network"
        );
    }

    #[test]
    fn promoted_pgn_workspace_survives_restart_is_unbounded_and_rejects_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let registry = dir.path().join("registry.json");
        let path = dir.path().join("game.pgn");
        fs::write(&path, b"[Event \"A\"]\n\n1. e4\n").unwrap();

        let handle = {
            let mut authority = PathAuthority::open(registry.clone(), vec![]).unwrap();
            let grant = authority
                .grant_dialog_operations(
                    &path,
                    "game",
                    PathClass::BoundedDialogGrant,
                    vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                    Duration::from_secs(30 * 60),
                    128,
                )
                .unwrap();
            FileWorkspaceHandle::new(
                authority
                    .promote_dialog(
                        &grant,
                        PathClass::PersistentFile,
                        "game",
                        vec![PathOperation::ReadPgn, PathOperation::WritePgn],
                    )
                    .unwrap()
                    .id,
            )
        };

        let mut authority = PathAuthority::open(registry, vec![]).unwrap();
        for _ in 0..129 {
            assert!(authority
                .resolve(handle.path_ref(), PathOperation::ReadPgn, &[])
                .is_ok());
        }
        assert!(authority
            .resolve(handle.path_ref(), PathOperation::WritePgn, &[])
            .is_ok());

        fs::rename(&path, dir.path().join("old-game.pgn")).unwrap();
        fs::write(&path, b"[Event \"replacement\"]\n\n1. d4\n").unwrap();
        assert!(matches!(
            authority.resolve(handle.path_ref(), PathOperation::ReadPgn, &[]),
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn pgn_export_destination_is_persistent_writable_and_rejects_non_pgn_targets() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("export.pgn");
        let mut authority = authority(&dir, Arc::new(TestClock::new(1)));
        let destination = authority
            .create_pgn_export_destination(&path, "export.pgn")
            .unwrap();
        assert!(path.is_file());
        assert!(authority
            .resolve(destination.handle.path_ref(), PathOperation::ReadPgn, &[],)
            .is_ok());
        assert!(authority
            .resolve(destination.handle.path_ref(), PathOperation::WritePgn, &[],)
            .is_ok());
        assert!(matches!(
            authority.create_pgn_export_destination(&dir.path().join("export.txt"), "export.txt"),
            Err(Error::InvalidInput(_))
        ));
    }
    #[test]
    fn capacity_evicts_oldest_not_every_grant() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("a");
        fs::write(&f, b"x").unwrap();
        let c = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, c);
        let first = a
            .grant_dialog(
                &f,
                "1",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(9),
                2,
            )
            .unwrap();
        let second = a
            .grant_dialog(
                &f,
                "2",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(9),
                2,
            )
            .unwrap();
        let third = a
            .grant_dialog(
                &f,
                "3",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(9),
                2,
            )
            .unwrap();
        assert!(a.resolve(&first, PathOperation::ReadPgn, &[]).is_err());
        assert!(a.resolve(&second, PathOperation::ReadPgn, &[]).is_ok());
        assert!(a.resolve(&third, PathOperation::ReadPgn, &[]).is_ok());
    }
    #[test]
    fn persistent_identity_reload_and_native_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let name = OsString::from_vec(vec![b'f', 0x80]);
        let f = dir.path().join(&name);
        fs::write(&f, b"x").unwrap();
        let c = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, c.clone());
        let id = a
            .migrate_legacy_os_path(
                f.clone().into_os_string(),
                "non utf8",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        drop(a);
        let mut a = authority(&dir, c);
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
        fs::rename(&f, dir.path().join("previous-object")).unwrap();
        fs::write(&f, b"replacement").unwrap();
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_err());
        assert_eq!(
            a.descriptors()
                .into_iter()
                .find(|d| d.id == id)
                .unwrap()
                .availability,
            PathAvailability::Unavailable
        );
    }
    #[test]
    fn unicode_promotion_consumes_the_exact_dialog_grant() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("Schach ♞");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, clock);
        let dialog = a
            .grant_dialog(
                &root,
                "Schach ♞",
                PathClass::SingleDialogGrant,
                PathOperation::DatabaseRead,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        let promoted = a
            .promote_dialog(
                &dialog,
                PathClass::PersistentCustomRoot,
                "Schach ♞",
                vec![PathOperation::DatabaseRead],
            )
            .unwrap();
        assert!(a
            .resolve(&dialog, PathOperation::DatabaseRead, &[])
            .is_err());
        assert!(a
            .resolve(&promoted, PathOperation::DatabaseRead, &[])
            .is_ok());
        let reloaded = PathAuthority::open_with_clock(
            dir.path().join("registry.json"),
            vec![],
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        assert_eq!(
            reloaded.persistent[&promoted.id.id]
                .stored
                .path
                .to_path()
                .unwrap(),
            root
        );
    }
    #[test]
    fn promotion_rejects_empty_or_escalating_operations_and_single_grants_cannot_be_multi_use() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, clock);
        assert!(a
            .grant_dialog(
                &file,
                "bad",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(1),
                2
            )
            .is_err());
        let id = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(10),
                1,
            )
            .unwrap();
        assert!(a
            .promote_dialog(&id, PathClass::PersistentFile, "a", vec![])
            .is_err());
        assert!(a
            .promote_dialog(
                &id,
                PathClass::PersistentFile,
                "a",
                vec![PathOperation::WritePgn]
            )
            .is_err());
        assert!(a.resolve(&id, PathOperation::ReadPgn, &[]).is_ok());
    }
    #[test]
    fn invalid_grant_does_not_evict_live_capacity_and_descriptors_revalidate() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, clock.clone());
        let one = a
            .grant_dialog(
                &file,
                "one",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(2),
                2,
            )
            .unwrap();
        let two = a
            .grant_dialog(
                &file,
                "two",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(2),
                2,
            )
            .unwrap();
        assert!(a
            .grant_dialog(
                dir.path().join("missing").as_path(),
                "bad",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(2),
                2
            )
            .is_err());
        assert!(a.resolve(&one, PathOperation::ReadPgn, &[]).is_ok());
        assert!(a.resolve(&two, PathOperation::ReadPgn, &[]).is_ok());
        let exp = a
            .grant_dialog(
                &file,
                "exp",
                PathClass::BoundedDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(1),
                2,
            )
            .unwrap();
        clock.advance(1);
        assert!(!a.descriptors().iter().any(|d| d.id == exp));
        let persistent = a
            .migrate_legacy_os_path(
                file.clone().into_os_string(),
                "a",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        fs::remove_file(&file).unwrap();
        assert_eq!(
            a.descriptors()
                .into_iter()
                .find(|d| d.id == persistent)
                .unwrap()
                .availability,
            PathAvailability::Unavailable
        );
    }
    #[test]
    fn failed_persistence_keeps_memory_and_dialog_grant_intact() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = PathAuthority::open_with_clock(
            dir.path().join("missing-parent/registry.json"),
            vec![],
            clock,
            2,
        )
        .unwrap();
        assert!(a
            .migrate_legacy_os_path(
                file.clone().into_os_string(),
                "a",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn]
            )
            .is_err());
        assert!(a.persistent.is_empty());
        let dialog = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(2),
                1,
            )
            .unwrap();
        assert!(a
            .promote_dialog(
                &dialog,
                PathClass::PersistentFile,
                "a",
                vec![PathOperation::ReadPgn]
            )
            .is_err());
        assert!(a.persistent.is_empty());
        assert!(a.resolve(&dialog, PathOperation::ReadPgn, &[]).is_ok());
    }
    #[test]
    fn rejects_traversal_symlink_and_special_components() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("root");
        fs::create_dir(&root).unwrap();
        fs::write(root.join("ok"), b"x").unwrap();
        std::os::unix::fs::symlink("ok", root.join("link")).unwrap();
        let c = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, c);
        let id = a
            .migrate_legacy_os_path(
                root.into_os_string(),
                "root",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        assert!(a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("..")])
            .is_err());
        assert!(a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("bad/name")])
            .is_err());
        assert!(a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("link")])
            .is_err());
        assert!(a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("ok")])
            .is_ok());
    }
    #[test]
    fn rejects_symlink_root_and_detects_leaf_replacement_after_resolution() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("target");
        fs::create_dir(&target).unwrap();
        let link = dir.path().join("root-link");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let clock = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, clock);
        assert!(a
            .migrate_legacy_os_path(
                link.into_os_string(),
                "link",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn],
            )
            .is_err());
        let file = target.join("leaf");
        fs::write(&file, b"old").unwrap();
        let id = a
            .migrate_legacy_os_path(
                target.into_os_string(),
                "target",
                PathClass::PersistentCustomRoot,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let mut resolved = a
            .resolve(&id, PathOperation::ReadPgn, &[OsString::from("leaf")])
            .unwrap();
        fs::remove_file(&file).unwrap();
        fs::write(&file, b"replacement").unwrap();
        assert_eq!(resolved.read_bytes().unwrap(), b"old");
    }
    #[test]
    fn read_capability_cannot_mutate_or_reach_a_sibling() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("readable");
        let sibling = dir.path().join("sibling");
        fs::write(&file, b"read").unwrap();
        fs::write(&sibling, b"sibling").unwrap();
        let mut a = authority(&dir, Arc::new(TestClock::new(0)));
        let id = a
            .migrate_legacy_os_path(
                file.into_os_string(),
                "readable",
                PathClass::PersistentFile,
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let mut resolved = a.resolve(&id, PathOperation::ReadPgn, &[]).unwrap();
        assert!(resolved.write_bytes(b"mutate").is_err());
        assert_eq!(resolved.read_bytes().unwrap(), b"read");
        assert_eq!(fs::read(sibling).unwrap(), b"sibling");
    }
    #[test]
    fn app_owned_descriptor_revalidates_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("app");
        fs::create_dir(&root).unwrap();
        let app = AppOwnedRoot::new("app", root.clone(), vec![PathOperation::LogWrite]);
        let id = app.id.clone();
        let mut a = PathAuthority::open_with_clock(
            dir.path().join("registry.json"),
            vec![app],
            Arc::new(TestClock::new(0)),
            2,
        )
        .unwrap();
        fs::rename(&root, dir.path().join("old-app")).unwrap();
        fs::create_dir(&root).unwrap();
        assert_eq!(
            a.descriptors()
                .into_iter()
                .find(|d| d.id == id)
                .unwrap()
                .availability,
            PathAvailability::Unavailable
        );
    }
    #[test]
    fn unknown_schema_and_atomic_failure_preserve_old_registry() {
        let dir = tempfile::tempdir().unwrap();
        let reg = dir.path().join("registry.json");
        fs::write(&reg, b"{\"schema_version\":99,\"entries\":[]}").unwrap();
        assert!(PathAuthority::open(reg.clone(), vec![]).is_err());
        fs::remove_file(&reg).unwrap();
        let c = Arc::new(TestClock::new(0));
        let mut a = authority(&dir, c);
        let f = dir.path().join("a");
        fs::write(&f, b"x").unwrap();
        a.migrate_legacy_os_path(
            f.clone().into_os_string(),
            "a",
            PathClass::PersistentFile,
            vec![PathOperation::ReadPgn],
        )
        .unwrap();
        let before = fs::read(&reg).unwrap();
        struct Fail;
        impl AtomicWriterInjector for Fail {
            fn inject(&self, p: AtomicFileFaultPoint) -> std::io::Result<()> {
                if p == AtomicFileFaultPoint::Write {
                    Err(std::io::Error::other("fail"))
                } else {
                    Ok(())
                }
            }
        }
        set_test_atomic_file_injector(Some(Box::new(Fail)));
        assert!(a.save().is_err());
        set_test_atomic_file_injector(None);
        assert_eq!(fs::read(&reg).unwrap(), before);
        struct Uncertain;
        impl AtomicWriterInjector for Uncertain {
            fn inject(&self, p: AtomicFileFaultPoint) -> std::io::Result<()> {
                if p == AtomicFileFaultPoint::ParentSync {
                    Err(std::io::Error::other(
                        "/private/registry: raw operating system failure",
                    ))
                } else {
                    Ok(())
                }
            }
        }
        set_test_atomic_file_injector(Some(Box::new(Uncertain)));
        let durability = a.save().expect("uncertain registry commit");
        set_test_atomic_file_injector(None);
        assert_eq!(
            serde_json::to_string(&durability).expect("serialize durability"),
            r#"{"DurabilityUncertain":"RegistryReplacement"}"#
        );
    }
    #[test]
    fn persisted_transient_or_invalid_entries_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let reg = dir.path().join("registry.json");
        fs::write(&reg, br#"{"schema_version":1,"entries":[{"id":"forged","display_name":"forged","class":"singleDialogGrant","operations":["readPgn"],"path":{"platform":"unix","bytes":"L3RtcA"},"identity":{"a":1,"b":1},"target_is_dir":false}]}"#).unwrap();
        assert!(PathAuthority::open(reg, vec![]).is_err());
    }
    #[test]
    fn zero_dialog_capacity_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        assert!(PathAuthority::open_with_clock(
            dir.path().join("registry.json"),
            vec![],
            Arc::new(TestClock::new(0)),
            0
        )
        .is_err());
    }
    #[test]
    fn uncertain_commit_keeps_candidate_and_consumes_promoted_grant() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a");
        fs::write(&file, b"x").unwrap();
        let mut a = authority(&dir, Arc::new(TestClock::new(0)));
        let dialog = a
            .grant_dialog(
                &file,
                "a",
                PathClass::SingleDialogGrant,
                PathOperation::ReadPgn,
                Duration::from_secs(5),
                1,
            )
            .unwrap();
        let id = PathRef::fresh();
        let stored = StoredEntry {
            id: id.clone(),
            display_name: "a".into(),
            class: PathClass::PersistentFile,
            operations: vec![PathOperation::ReadPgn],
            path: NativePath::from_path(&file),
            identity: identity(&file).unwrap(),
            target_is_dir: false,
        };
        let mut candidate = a.persistent.clone();
        candidate.insert(
            id.id.clone(),
            Entry {
                stored,
                availability: PathAvailability::Available,
            },
        );
        struct ParentSync;
        impl AtomicWriterInjector for ParentSync {
            fn inject(&self, p: AtomicFileFaultPoint) -> std::io::Result<()> {
                if p == AtomicFileFaultPoint::ParentSync {
                    Err(std::io::Error::other("uncertain"))
                } else {
                    Ok(())
                }
            }
        }
        set_test_atomic_file_injector(Some(Box::new(ParentSync)));
        assert!(matches!(
            a.commit_candidate(candidate, Some(&dialog)).unwrap(),
            CommitDurability::DurabilityUncertain(_)
        ));
        set_test_atomic_file_injector(None);
        assert!(a.persistent.contains_key(&id.id));
        assert!(!a.dialogs.contains_key(&dialog.id));
        assert!(a.resolve(&dialog, PathOperation::ReadPgn, &[]).is_err());
        let reloaded = PathAuthority::open(dir.path().join("registry.json"), vec![]).unwrap();
        assert!(reloaded.persistent.contains_key(&id.id));
    }

    #[test]
    fn downloaded_pgn_becomes_an_exact_read_capability() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let root_id = app_root.id.clone();
        let mut authority =
            PathAuthority::open(dir.path().join("registry.json"), vec![app_root]).unwrap();
        let resolved = authority
            .resolve(
                &root_id,
                PathOperation::DownloadFile,
                &[OsString::from("games.pgn")],
            )
            .unwrap();
        resolved
            .atomic_replace_download(|file| file.write_all(b"1. e4 e5").map_err(Error::from))
            .unwrap();
        let artifact = authority
            .register_downloaded_pgn(&root_id, OsStr::new("games.pgn"))
            .unwrap();
        let mut readable = authority
            .resolve(&artifact, PathOperation::ReadPgn, &[])
            .unwrap();
        assert_eq!(readable.read_bytes().unwrap(), b"1. e4 e5");
        assert!(authority
            .resolve(&artifact, PathOperation::DownloadFile, &[])
            .is_err());
    }

    #[test]
    fn pending_download_artifact_recovers_an_atomic_install_after_restart() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let root_id = app_root.id.clone();
        let registry = dir.path().join("registry.json");
        let staged = dir.path().join("staged.pgn");
        fs::write(&staged, b"1. e4").unwrap();
        let reservation = {
            let mut authority =
                PathAuthority::open(registry.clone(), vec![app_root.clone()]).unwrap();
            let reservation = authority
                .reserve_download_artifact(
                    &root_id,
                    OsString::from("games.pgn"),
                    &staged,
                    "games.pgn",
                    vec![PathOperation::ReadPgn],
                )
                .unwrap();
            authority
                .resolve(
                    &root_id,
                    PathOperation::DownloadFile,
                    &[OsString::from("games.pgn")],
                )
                .unwrap()
                .atomic_replace_download(|file| file.write_all(b"1. e4").map_err(Error::from))
                .unwrap();
            authority
                .mark_download_artifact_committed(
                    &reservation,
                    {
                        let identity = identity(&root.join("games.pgn")).unwrap();
                        (identity.a, identity.b)
                    },
                    {
                        use std::os::unix::fs::MetadataExt;
                        let metadata = fs::metadata(root.join("games.pgn")).unwrap();
                        i128::from(metadata.ctime()) * 1_000_000_000
                            + i128::from(metadata.ctime_nsec())
                    },
                )
                .unwrap();
            reservation
        };
        let mut recovered = PathAuthority::open(registry, vec![app_root]).unwrap();
        let mut artifact = recovered
            .resolve(&reservation.id, PathOperation::ReadPgn, &[])
            .unwrap();
        assert_eq!(artifact.read_bytes().unwrap(), b"1. e4");
        assert!(recovered.pending_artifacts.is_empty());
    }

    #[test]
    fn pending_artifact_never_activates_a_substituted_payload_after_restart() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let registry = dir.path().join("registry.json");
        let staged = dir.path().join("staged.pgn");
        fs::write(&staged, b"expected").unwrap();
        let reservation = {
            let mut authority =
                PathAuthority::open(registry.clone(), vec![app_root.clone()]).unwrap();
            authority
                .reserve_download_artifact(
                    &app_root.id,
                    OsString::from("games.pgn"),
                    &staged,
                    "games.pgn",
                    vec![PathOperation::ReadPgn],
                )
                .unwrap()
        };
        fs::write(root.join("games.pgn"), b"substituted").unwrap();
        let mut recovered = PathAuthority::open(registry, vec![app_root]).unwrap();
        assert!(recovered
            .pending_artifacts
            .iter()
            .any(|item| item.id == reservation.id));
        assert!(recovered.activate_download_artifact(&reservation).is_err());
        assert!(!recovered.persistent.contains_key(&reservation.id.id));
    }

    #[test]
    fn post_rename_marker_rejects_a_byte_identical_external_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let registry = dir.path().join("registry.json");
        let staged = dir.path().join("staged.pgn");
        fs::write(&staged, b"same bytes").unwrap();
        let mut authority = PathAuthority::open(registry, vec![app_root.clone()]).unwrap();
        let reservation = authority
            .reserve_download_artifact(
                &app_root.id,
                OsString::from("games.pgn"),
                &staged,
                "games.pgn",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        authority
            .resolve(
                &app_root.id,
                PathOperation::DownloadFile,
                &[OsString::from("games.pgn")],
            )
            .unwrap()
            .atomic_install_reserved_download(&reservation, &staged)
            .unwrap();
        authority
            .mark_download_artifact_committed(
                &reservation,
                {
                    let identity = identity(&root.join("games.pgn")).unwrap();
                    (identity.a, identity.b)
                },
                {
                    use std::os::unix::fs::MetadataExt;
                    let metadata = fs::metadata(root.join("games.pgn")).unwrap();
                    i128::from(metadata.ctime()) * 1_000_000_000 + i128::from(metadata.ctime_nsec())
                },
            )
            .unwrap();
        fs::remove_file(root.join("games.pgn")).unwrap();
        fs::write(root.join("games.pgn"), b"same bytes").unwrap();
        assert!(authority.activate_download_artifact(&reservation).is_err());
    }

    #[test]
    fn swap_between_rename_and_marker_persistence_is_quarantined_by_temp_fd_identity() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("downloads");
        fs::create_dir(&root).unwrap();
        let app_root =
            AppOwnedRoot::new("downloads", root.clone(), vec![PathOperation::DownloadFile]);
        let staged = dir.path().join("staged.pgn");
        fs::write(&staged, b"same bytes").unwrap();
        let mut authority =
            PathAuthority::open(dir.path().join("registry.json"), vec![app_root.clone()]).unwrap();
        let reservation = authority
            .reserve_download_artifact(
                &app_root.id,
                OsString::from("games.pgn"),
                &staged,
                "games.pgn",
                vec![PathOperation::ReadPgn],
            )
            .unwrap();
        let installed = authority
            .resolve(
                &app_root.id,
                PathOperation::DownloadFile,
                &[OsString::from("games.pgn")],
            )
            .unwrap()
            .atomic_install_reserved_download(&reservation, &staged)
            .unwrap();
        fs::remove_file(root.join("games.pgn")).unwrap();
        fs::write(root.join("games.pgn"), b"same bytes").unwrap();
        authority
            .mark_download_artifact_committed(
                &reservation,
                installed.identity,
                installed.ctime_nanos,
            )
            .unwrap();
        assert!(authority.activate_download_artifact(&reservation).is_err());
    }

    #[test]
    fn active_database_root_is_atomic_persistent_and_becomes_unavailable_on_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("databases");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let handle = path_authority
            .get_or_create_database_root(&root, "Databases")
            .unwrap();
        path_authority.set_active_database_root(&handle).unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        assert_eq!(
            reloaded.active_database_root().unwrap(),
            Some(handle.clone())
        );

        let replacement = dir.path().join("replacement");
        fs::create_dir(&replacement).unwrap();
        // POSIX atomically replaces an empty directory, whereas Windows
        // requires its target to be absent. The identity change, not either
        // platform's rename rule, is the invariant under test.
        #[cfg(windows)]
        fs::remove_dir(&root).unwrap();
        fs::rename(&replacement, &root).unwrap();
        assert_eq!(reloaded.active_database_root().unwrap(), None);
    }

    #[test]
    fn active_puzzle_root_is_restart_safe_and_rejects_a_replaced_custom_root() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("puzzles");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let handle = path_authority
            .get_or_create_puzzle_root(&root, "Puzzles")
            .unwrap();
        path_authority.set_active_puzzle_root(&handle).unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        assert_eq!(
            reloaded
                .active_puzzle_root()
                .unwrap()
                .map(|descriptor| descriptor.root),
            Some(handle)
        );
        let replacement = dir.path().join("replacement-puzzle-root");
        fs::create_dir(&replacement).unwrap();
        #[cfg(windows)]
        fs::remove_dir(&root).unwrap();
        fs::rename(&replacement, &root).unwrap();
        assert_eq!(reloaded.active_puzzle_root().unwrap(), None);
    }

    #[test]
    fn active_engine_root_is_restart_safe_and_rejects_a_replaced_custom_root() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("engines");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let handle = path_authority
            .get_or_create_engine_root(&root, "Engines")
            .unwrap();
        path_authority.set_active_engine_root(&handle).unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        assert_eq!(reloaded.active_engine_root().unwrap(), Some(handle));
        let replacement = dir.path().join("replacement-engine-root");
        fs::create_dir(&replacement).unwrap();
        #[cfg(windows)]
        fs::remove_dir(&root).unwrap();
        fs::rename(&replacement, &root).unwrap();
        assert_eq!(reloaded.active_engine_root().unwrap(), None);
    }

    #[test]
    fn legacy_engine_file_is_backfilled_and_reused_after_reload() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("engine");
        fs::write(&executable, b"engine").unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let legacy = path_authority
            .get_or_create_persistent_file(
                &executable,
                "engine",
                vec![
                    PathOperation::EngineExecute,
                    PathOperation::EngineConfigure,
                    PathOperation::EngineInstall,
                ],
            )
            .unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        let registered = reloaded
            .register_engine_file(&executable, "engine")
            .unwrap();
        assert_eq!(registered.path_ref(), &legacy.id);
        assert_eq!(reloaded.persistent.len(), 1);
        assert_eq!(
            reloaded
                .persistent
                .get(&legacy.id.id)
                .unwrap()
                .stored
                .operations,
            vec![
                PathOperation::EngineExecute,
                PathOperation::EngineConfigure,
                PathOperation::EngineInstall,
                PathOperation::EngineBinaryInspect,
            ]
        );
    }

    #[test]
    fn engine_root_is_not_backfilled_and_reuses_its_id_after_reload() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("engines");
        fs::create_dir(&root).unwrap();
        let clock = Arc::new(TestClock::new(1));
        let mut path_authority = authority(&dir, clock.clone());
        let original = path_authority
            .get_or_create_engine_root(&root, "Engines")
            .unwrap();
        drop(path_authority);

        let mut reloaded = authority(&dir, clock);
        let reused = reloaded
            .get_or_create_engine_root(&root, "Engines")
            .unwrap();
        assert_eq!(reused, original);
        assert_eq!(reloaded.persistent.len(), 1);
        assert_eq!(
            reloaded
                .persistent
                .get(&original.path_ref().id)
                .unwrap()
                .stored
                .operations,
            vec![
                PathOperation::DownloadArchive,
                PathOperation::EngineInstall,
                PathOperation::EngineExecute,
                PathOperation::EngineConfigure,
            ]
        );
    }

    #[test]
    fn windows_launch_sealing_covers_execute_and_configure_engine_operations() {
        assert!(!allows_delete_sharing_for_operation(
            PathOperation::EngineExecute,
            true
        ));
        assert!(!allows_delete_sharing_for_operation(
            PathOperation::EngineConfigure,
            true
        ));
        assert!(allows_delete_sharing_for_operation(
            PathOperation::EngineExecute,
            false
        ));
        assert!(allows_delete_sharing_for_operation(
            PathOperation::OpeningBookRead,
            true
        ));
        assert!(!is_write_operation(PathOperation::EngineConfigure));
    }

    #[test]
    fn write_operation_policy_is_exhaustive() {
        for operation in [
            PathOperation::WritePgn,
            PathOperation::DatabaseMutate,
            PathOperation::DatabaseCreate,
            PathOperation::DatabaseExport,
            PathOperation::PuzzleDelete,
            PathOperation::EngineInstall,
            PathOperation::SnapshotWrite,
            PathOperation::LogWrite,
        ] {
            assert!(is_write_operation(operation), "{operation:?}");
        }
        for operation in [
            PathOperation::ReadPgn,
            PathOperation::DatabaseRead,
            PathOperation::PuzzleRead,
            PathOperation::EngineExecute,
            PathOperation::EngineConfigure,
            PathOperation::EngineBinaryInspect,
            PathOperation::OpeningBookRead,
            PathOperation::ImageRead,
            PathOperation::DownloadFile,
            PathOperation::DownloadArchive,
            PathOperation::OpenShell,
        ] {
            assert!(!is_write_operation(operation), "{operation:?}");
        }
    }

    #[test]
    fn relative_components_reject_dot_and_nul_independently() {
        let dir = tempfile::tempdir().unwrap();
        let authority = authority(&dir, Arc::new(TestClock::new(1)));
        assert!(authority
            .validate_components(&[OsString::from(".")])
            .is_err());
        assert!(authority
            .validate_components(&[OsString::from("..")])
            .is_err());
        assert!(authority
            .validate_components(&[OsString::from_vec(b"name\0tail".to_vec())])
            .is_err());
        assert!(authority
            .validate_components(&[OsString::from("regular")])
            .is_ok());
    }

    #[test]
    fn persisted_entry_shape_validates_every_field_independently() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file.pgn");
        fs::write(&file, b"pgn").unwrap();
        let valid = StoredEntry {
            id: PathRef::fresh(),
            display_name: "file.pgn".into(),
            class: PathClass::PersistentFile,
            operations: vec![PathOperation::ReadPgn],
            path: NativePath::from_path(&file),
            identity: identity(&file).unwrap(),
            target_is_dir: false,
        };
        assert!(validate_persisted_shape(&valid).is_ok());

        let invalid = [
            StoredEntry {
                class: PathClass::SingleDialogGrant,
                ..valid.clone()
            },
            StoredEntry {
                operations: vec![],
                ..valid.clone()
            },
            StoredEntry {
                id: PathRef { id: String::new() },
                ..valid.clone()
            },
            StoredEntry {
                display_name: String::new(),
                ..valid.clone()
            },
            StoredEntry {
                target_is_dir: true,
                ..valid.clone()
            },
            StoredEntry {
                class: PathClass::PersistentCustomRoot,
                target_is_dir: false,
                ..valid
            },
        ];
        for entry in invalid {
            assert!(validate_persisted_shape(&entry).is_err(), "{entry:?}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn read_only_engine_can_be_resolved_for_configuration() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("engine");
        fs::write(&executable, b"engine").unwrap();
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o555)).unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let handle = path_authority
            .register_engine_file(&executable, "engine")
            .unwrap();
        assert!(path_authority
            .engine_executable(&handle, PathOperation::EngineConfigure)
            .is_ok());
    }

    #[test]
    fn engine_binary_inspection_cannot_read_bytes_or_become_a_read_file() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("engine");
        fs::write(&executable, b"engine").unwrap();
        let mut path_authority = authority(&dir, Arc::new(TestClock::new(1)));
        let handle = path_authority
            .register_engine_file(&executable, "engine")
            .unwrap();

        let mut byte_reader = path_authority
            .resolve(handle.path_ref(), PathOperation::EngineBinaryInspect, &[])
            .unwrap();
        assert!(byte_reader.read_bytes().is_err());
        let file_reader = path_authority
            .resolve(handle.path_ref(), PathOperation::EngineBinaryInspect, &[])
            .unwrap();
        assert!(file_reader.into_read_file().is_err());
    }
}
