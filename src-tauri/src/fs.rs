use std::{
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};

use log::info;
use reqwest::header::HeaderMap;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use specta::Type;

use futures_util::StreamExt;
use tokio_util::sync::CancellationToken;

use crate::error::Error;
use crate::infra::fs::atomic_replace;
use crate::progress::{begin_progress, update_progress_with_state, ProgressLease, ProgressState};
use crate::AppState;

const MAX_ACTIVE_DOWNLOADS: usize = 32;
const DOWNLOAD_DEADLINE: Duration = Duration::from_secs(60 * 60);
const MAX_ARCHIVE_PATH_BYTES: usize = 1024;
#[cfg(unix)]
const MAX_ARCHIVE_PATH_COMPONENTS: usize = crate::infra::fs::MAX_REMOVE_TREE_DEPTH - 1;
const ARTIFACT_MANIFEST_PUBLIC_KEY: &str =
    "RWSF3PMxhuaQf7613UytN4bdF7FQyBymLJVDIG3OE8xNa+0fcs6KE6/J";

fn download_target_durability(
    outcome: crate::infra::fs::AtomicFileOutcome,
) -> Option<crate::infra::path_authority::CommitDurability> {
    let stage = crate::infra::fs::map_atomic_file_outcome(
        outcome,
        crate::error::DurabilityStage::DownloadTargetReplacement,
        |error| log::warn!("download target replacement parent sync failed: {error}"),
    )?;
    Some(crate::infra::path_authority::CommitDurability::DurabilityUncertain(stage))
}

/// A release-key signed artifact digest. The signature binds URL and hash.
#[derive(Clone, Debug, Deserialize, Type)]
pub struct ArtifactIntegrity {
    pub sha256: String,
    pub signature: String,
}

/// Bounded lifecycle-owned cancellation registry. A lease removes itself on every ordinary
/// return, error, cancellation, and deadline unwind; IDs therefore cannot accumulate forever.
#[derive(Default)]
pub struct DownloadRegistry;

pub struct DownloadLease {
    operation: crate::infra::operations::OperationLease,
}

impl DownloadRegistry {
    pub fn begin(
        self: &Arc<Self>,
        operations: &crate::infra::operations::OperationRegistry,
        id: &str,
    ) -> Result<DownloadLease, Error> {
        let _ = self;
        let label = format!("download publication {id}");
        Ok(DownloadLease {
            operation: operations.accept_download(id, &label, MAX_ACTIVE_DOWNLOADS)?,
        })
    }

    pub fn cancel(
        &self,
        operations: &crate::infra::operations::OperationRegistry,
        id: &str,
    ) -> Result<bool, Error> {
        let _ = self;
        operations.cancel_accepted(id)
    }
}

impl DownloadLease {
    pub(crate) fn cancellation_token(&self) -> CancellationToken {
        self.operation.token()
    }

    pub(crate) fn into_operation(self) -> crate::infra::operations::OperationLease {
        self.operation
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum OpClass {
    Lichess,
    Engine,
    Db,
    PuzzleDb,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PayloadFormat {
    PlainFile,
    Archive,
}

impl OpClass {
    fn from_operations(
        operations: &[crate::infra::path_authority::PathOperation],
    ) -> Result<Self, Error> {
        use crate::infra::path_authority::PathOperation;

        let engine = operations.iter().any(|operation| {
            matches!(
                operation,
                PathOperation::DownloadArchive
                    | PathOperation::EngineInstall
                    | PathOperation::EngineExecute
                    | PathOperation::EngineConfigure
            )
        });
        let database = operations.iter().any(|operation| {
            matches!(
                operation,
                PathOperation::DatabaseRead
                    | PathOperation::DatabaseMutate
                    | PathOperation::DatabaseCreate
                    | PathOperation::DatabaseExport
            )
        });
        let puzzle = operations.iter().any(|operation| {
            matches!(
                operation,
                PathOperation::PuzzleRead | PathOperation::PuzzleDelete
            )
        });
        let marker_classes = usize::from(engine) + usize::from(database) + usize::from(puzzle);
        if marker_classes > 1 {
            return Err(Error::InvalidInput(
                "download destination mixes operation classes".into(),
            ));
        }
        let only_engine = operations.iter().all(|operation| {
            matches!(
                operation,
                PathOperation::DownloadFile
                    | PathOperation::DownloadArchive
                    | PathOperation::EngineInstall
                    | PathOperation::EngineExecute
                    | PathOperation::EngineConfigure
            )
        });
        let only_database = operations.iter().all(|operation| {
            matches!(
                operation,
                PathOperation::DownloadFile
                    | PathOperation::DatabaseRead
                    | PathOperation::DatabaseMutate
                    | PathOperation::DatabaseCreate
                    | PathOperation::DatabaseExport
            )
        });
        let only_puzzle = operations.iter().all(|operation| {
            matches!(
                operation,
                PathOperation::DownloadFile
                    | PathOperation::PuzzleRead
                    | PathOperation::PuzzleDelete
            )
        });
        if engine && only_engine {
            Ok(Self::Engine)
        } else if database && only_database {
            Ok(Self::Db)
        } else if puzzle && only_puzzle {
            Ok(Self::PuzzleDb)
        } else if operations == [PathOperation::DownloadFile] {
            Ok(Self::Lichess)
        } else {
            Err(Error::InvalidInput(
                "download destination has no recognized operation class".into(),
            ))
        }
    }

    fn max_size(&self) -> u64 {
        match self {
            Self::Lichess => 100 * 1024 * 1024,
            Self::Engine => 500 * 1024 * 1024,
            Self::Db => 10 * 1024 * 1024 * 1024,
            Self::PuzzleDb => 5 * 1024 * 1024 * 1024,
        }
    }

    fn payload_format(&self) -> PayloadFormat {
        match self {
            Self::Engine => PayloadFormat::Archive,
            // A Lichess export and the database/puzzle data sets are all single files.
            Self::Lichess | Self::Db | Self::PuzzleDb => PayloadFormat::PlainFile,
        }
    }

    fn limits(&self) -> ArchiveLimits {
        ArchiveLimits {
            compressed: self.max_size(),
            expanded: match self {
                Self::Lichess => 100 * 1024 * 1024,
                Self::Engine => 2 * 1024 * 1024 * 1024,
                Self::Db => 10 * 1024 * 1024 * 1024,
                Self::PuzzleDb => 5 * 1024 * 1024 * 1024,
            },
            per_entry: match self {
                Self::Engine => 512 * 1024 * 1024,
                _ => self.max_size(),
            },
            entries: 100_000,
            ratio: 250,
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct ArchiveLimits {
    compressed: u64,
    expanded: u64,
    per_entry: u64,
    entries: usize,
    ratio: u64,
}

fn redact_url(url: &reqwest::Url) -> String {
    let mut redacted = url.clone();
    let _ = redacted.set_username("");
    let _ = redacted.set_password(None);
    redacted.set_query(None);
    redacted.set_fragment(None);
    redacted.to_string()
}

fn validate_download_url(url: &reqwest::Url) -> Result<(), Error> {
    if url.scheme() != "https" {
        return Err(Error::InvalidInput("Only HTTPS allowed".into()));
    }
    if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
        return Err(Error::InvalidInput("Unsafe URL component".into()));
    }
    match url.host() {
        Some(url::Host::Domain(_)) => {}
        Some(url::Host::Ipv4(ip)) => {
            if !crate::infra::net::is_public_ip(std::net::IpAddr::V4(ip)) {
                return Err(Error::InvalidInput("Non-public download address".into()));
            }
        }
        Some(url::Host::Ipv6(ip)) => {
            if !crate::infra::net::is_public_ip(std::net::IpAddr::V6(ip)) {
                return Err(Error::InvalidInput("Non-public download address".into()));
            }
        }
        None => return Err(Error::InvalidInput("URL must have a host".into())),
    }
    Ok(())
}

fn validate_artifact_integrity(
    op: OpClass,
    url: &str,
    integrity: Option<&ArtifactIntegrity>,
) -> Result<(), Error> {
    let required = matches!(op, OpClass::Engine | OpClass::Db | OpClass::PuzzleDb);
    let Some(integrity) = integrity else {
        return if required {
            Err(Error::InvalidInput(
                "signed artifact integrity metadata required".into(),
            ))
        } else {
            Ok(())
        };
    };
    if integrity.sha256.len() != 64
        || !integrity
            .sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(Error::InvalidInput("invalid artifact SHA-256".into()));
    }
    let key = minisign_verify::PublicKey::from_base64(ARTIFACT_MANIFEST_PUBLIC_KEY)
        .map_err(|_| Error::InvalidInput("artifact verification key is invalid".into()))?;
    let signature = minisign_verify::Signature::decode(&integrity.signature)
        .map_err(|_| Error::InvalidInput("invalid artifact manifest signature".into()))?;
    let payload = format!("{url}\n{}", integrity.sha256.to_ascii_lowercase());
    key.verify(payload.as_bytes(), &signature, true)
        .map_err(|_| Error::InvalidInput("artifact manifest signature verification failed".into()))
}

fn is_bearer_origin(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url.port_or_known_default() == Some(443)
        && matches!(
            url.host_str(),
            Some("lichess.org") | Some("database.lichess.org")
        )
}

#[cfg(test)]
#[allow(clippy::too_many_arguments)]
async fn download_file_core<F>(
    op: OpClass,
    url: &str,
    path: &Path,
    transport: &dyn crate::infra::net::DownloadTransport,
    token: Option<&str>,
    total_size: Option<u32>,
    progress_updater: F,
) -> Result<(), Error>
where
    F: FnMut(f32) -> Result<(), Error>,
{
    download_file_core_control(
        op,
        url,
        path,
        transport,
        token,
        total_size,
        CancellationToken::new(),
        progress_updater,
    )
    .await
}

#[cfg(test)]
#[allow(clippy::too_many_arguments)]
async fn download_file_core_control<F>(
    op: OpClass,
    url: &str,
    path: &Path,
    transport: &dyn crate::infra::net::DownloadTransport,
    token: Option<&str>,
    total_size: Option<u32>,
    cancellation: CancellationToken,
    progress_updater: F,
) -> Result<(), Error>
where
    F: FnMut(f32) -> Result<(), Error>,
{
    download_file_core_control_with_integrity(
        op,
        url,
        path,
        transport,
        token,
        total_size,
        cancellation,
        None,
        progress_updater,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn download_file_core_control_with_integrity<F>(
    op: OpClass,
    url: &str,
    path: &Path,
    transport: &dyn crate::infra::net::DownloadTransport,
    token: Option<&str>,
    total_size: Option<u32>,
    cancellation: CancellationToken,
    expected_sha256: Option<&str>,
    mut progress_updater: F,
) -> Result<(), Error>
where
    F: FnMut(f32) -> Result<(), Error>,
{
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let parsed_url =
        reqwest::Url::parse(url).map_err(|_| Error::InvalidInput("Invalid URL".into()))?;
    validate_download_url(&parsed_url)?;

    if token.is_some() {
        match op {
            OpClass::Lichess => {
                if !is_bearer_origin(&parsed_url) {
                    return Err(Error::InvalidInput("Unauthorized origin".into()));
                }
            }
            _ => return Err(Error::InvalidInput("Token only allowed for Lichess".into())),
        }
    }

    info!("Downloading file from {}", redact_url(&parsed_url));
    let mut req_url = parsed_url.clone();
    let mut redirects = 0;

    let mut res = loop {
        let mut headers = HeaderMap::new();
        if let Some(token) = token {
            if is_bearer_origin(&req_url) {
                if let Ok(auth_value) = format!("Bearer {token}").parse() {
                    headers.insert("Authorization", auth_value);
                }
            }
        }

        let res = tokio::select! {
            _ = cancellation.cancelled() => return Err(Error::Cancellation),
            response = tokio::time::timeout(Duration::from_secs(60), transport.request(req_url.as_str(), headers)) => response
                .map_err(|_| Error::EngineTimeout("download request timed out".into()))??,
        };

        if res.status >= 300 && res.status < 400 {
            if redirects >= 10 {
                return Err(Error::InvalidInput("Too many redirects".into()));
            }
            redirects += 1;
            let loc = res
                .headers
                .get(reqwest::header::LOCATION)
                .ok_or_else(|| Error::InvalidInput("Redirect missing location".into()))?
                .to_str()
                .map_err(|_| Error::InvalidInput("Invalid location header".into()))?;
            let next_url = req_url
                .join(loc)
                .map_err(|_| Error::InvalidInput("Invalid redirect URL".into()))?;

            validate_download_url(&next_url)?;

            req_url = next_url;
            continue;
        }

        if !(200..300).contains(&res.status) {
            return Err(Error::InvalidInput(format!("HTTP status {}", res.status)));
        }

        break res;
    };

    let declared_size = res.content_length;
    let limits = op.limits();
    if let Some(ds) = declared_size {
        if ds > limits.compressed {
            return Err(Error::ResourceLimit("File too large".into()));
        }
    }

    if let Some(ts) = total_size {
        if let Some(ds) = declared_size {
            if ts as u64 != ds {
                return Err(Error::InvalidInput(
                    "Declared size and Content-Length mismatch".into(),
                ));
            }
        }
    }

    let expected_size = total_size.map(|s| s as u64).or(declared_size);

    let target_dir = path.parent().unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(target_dir)?;
    let mut temp_file = tempfile::Builder::new()
        .prefix(".download")
        .tempfile_in(target_dir)
        .map_err(|e| Error::Io(Box::new(e)))?;

    let mut downloaded: u64 = 0;
    let mut digest = expected_sha256.map(|_| Sha256::new());

    loop {
        let item = tokio::select! {
            _ = cancellation.cancelled() => return Err(Error::Cancellation),
            item = res.stream.next() => item,
        };
        let Some(item) = item else { break };
        let chunk = item?;
        if let Some(digest) = digest.as_mut() {
            digest.update(&chunk);
        }
        downloaded += chunk.len() as u64;
        if downloaded > limits.compressed {
            return Err(Error::ResourceLimit("File too large".into()));
        }
        if let Some(expected) = expected_size {
            if downloaded > expected {
                return Err(Error::InvalidInput(
                    "Actual downloaded size exceeds expected size".into(),
                ));
            }
        }
        temp_file.write_all(&chunk)?;
        if let Some(total_size) = total_size {
            let progress = ((downloaded as f64 / total_size as f64) * 100.0).min(100.0) as f32;
            progress_updater(progress)?;
        }
    }

    if let Some(expected) = expected_size {
        if downloaded != expected {
            return Err(Error::InvalidInput(
                "Actual downloaded size mismatch".into(),
            ));
        }
    }
    if let Some(expected_sha256) = expected_sha256 {
        let actual = format!(
            "{:x}",
            digest
                .expect("hash exists when hash is required")
                .finalize()
        );
        if !actual.eq_ignore_ascii_case(expected_sha256) {
            return Err(Error::InvalidInput("artifact SHA-256 mismatch".into()));
        }
    }
    temp_file.flush()?;

    info!("Downloaded file to temporary location");

    let path = path.to_path_buf();
    crate::infra::blocking::BLOCKING_GATEWAY
        .spawn_cancellable(cancellation, move |cancellation| {
            if cancellation.is_cancelled() {
                return Err(Error::Cancellation);
            }
            let mut file = temp_file.into_file();
            use std::io::Seek;
            file.seek(std::io::SeekFrom::Start(0))?;

            let mut magic = [0u8; 512];
            let n = std::io::Read::read(&mut file, &mut magic)?;
            file.seek(std::io::SeekFrom::Start(0))?;

            let is_zip = n >= 4
                && matches!(
                    &magic[..4],
                    b"PK\x03\x04" | b"PK\x05\x06" | b"PK\x06\x06" | b"PK\x06\x07"
                );

            let mut is_gz = false;
            let mut is_tar = false;
            if !is_zip {
                if n >= 2 && magic[0] == 0x1F && magic[1] == 0x8B {
                    is_gz = true;
                } else {
                    if n >= 512 && &magic[257..262] == b"ustar" {
                        is_tar = true;
                    }
                    file.seek(std::io::SeekFrom::Start(0))?;
                }
            }

            if is_zip || is_tar || is_gz {
                if op.payload_format() != PayloadFormat::Archive {
                    return Err(Error::InvalidInput(
                        "Archive payload is not allowed for this operation".into(),
                    ));
                }
                if is_zip {
                    extract_zip_cancellable(file, &path, limits, cancellation)?;
                } else if is_tar {
                    extract_tar_cancellable(file, &path, limits, cancellation)?;
                } else {
                    extract_gz_cancellable(file, &path, limits, cancellation)?;
                }
            } else {
                let target_dir = path.parent().unwrap_or_else(|| Path::new("."));
                std::fs::create_dir_all(target_dir)?;
                let outcome = atomic_replace(&path, |target_file| {
                    let mut buffer = [0_u8; 64 * 1024];
                    loop {
                        if cancellation.is_cancelled() {
                            return Err(Error::Cancellation);
                        }
                        let read = file.read(&mut buffer)?;
                        if read == 0 {
                            break;
                        }
                        target_file.write_all(&buffer[..read])?;
                    }
                    Ok(())
                })?;
                crate::infra::fs::require_durable(
                    outcome,
                    crate::error::DurabilityStage::ArchiveFileReplacement,
                )?;
            }
            Ok(())
        })
        .await?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
#[allow(clippy::too_many_arguments)]
pub async fn download_file(
    id: String,
    url: String,
    destination: crate::infra::path_authority::PathRef,
    filename: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    total_size: Option<u32>,
    job_id: String,
    integrity: Option<ArtifactIntegrity>,
) -> Result<(), Error> {
    download_to_destination(
        &id,
        &url,
        destination,
        filename,
        &app,
        state.inner(),
        None,
        total_size,
        job_id,
        false,
        integrity.as_ref(),
    )
    .await
    .map(|_| ())
}

fn sanitize_download_error(error: Error) -> Error {
    match error {
        Error::Io(_) => Error::Io(Box::new(std::io::Error::other("I/O failure"))),
        error => error,
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) async fn download_to_destination<R: tauri::Runtime>(
    id: &str,
    url: &str,
    destination: crate::infra::path_authority::PathRef,
    filename: String,
    app: &tauri::AppHandle<R>,
    state: &AppState,
    bearer_token: Option<&str>,
    total_size: Option<u32>,
    job_id: String,
    register_pgn_artifact: bool,
    integrity: Option<&ArtifactIntegrity>,
) -> Result<Option<crate::infra::path_authority::ArtifactPublication>, Error> {
    let lease = state.download_registry.begin(&state.operations, &job_id)?;
    let cancellation = lease.cancellation_token();
    let operation = lease.into_operation();
    let id = id.to_owned();
    let url = url.to_owned();
    let app = app.clone();
    let state = state.clone();
    let bearer_token = bearer_token.map(str::to_owned);
    let integrity = integrity.cloned();
    crate::infra::operations::run_native_operation(operation, "download publication", async move {
        download_to_destination_inner(
            &id,
            &url,
            destination,
            filename,
            &app,
            &state,
            bearer_token.as_deref(),
            total_size,
            job_id,
            register_pgn_artifact,
            integrity.as_ref(),
            cancellation.clone(),
        )
        .await
        .map_err(sanitize_download_error)
    })
    .await
}

fn cleanup_download_reservation_best_effort(
    authority: &Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    reservation: &crate::infra::path_authority::PendingArtifactReservation,
) {
    let mut guard = match authority.lock() {
        Ok(guard) => guard,
        Err(_) => {
            let stage = "lock";
            let category = crate::error::ErrorCategory::Conflict;
            log::warn!("download reservation cleanup failed at {stage}: {category}");
            return;
        }
    };
    let Some(authority) = guard.as_mut() else {
        let stage = "initialization";
        let category = crate::error::ErrorCategory::Conflict;
        log::warn!("download reservation cleanup failed at {stage}: {category}");
        return;
    };
    authority.abandon_download_artifact(reservation);
}

fn report_download_terminal_progress<R: tauri::Runtime>(
    state: &AppState,
    app: &tauri::AppHandle<R>,
    progress_lease: &ProgressLease,
    job_id: &str,
    progress: f32,
    terminal_state: ProgressState,
) {
    if let Err(secondary) = update_progress_with_state(
        &state.progress_state,
        app,
        progress_lease,
        progress,
        terminal_state,
    ) {
        let category = secondary.category();
        let generation = progress_lease.generation;
        log::warn!("download {job_id} progress report generation {generation} failed: {category}");
    }
}

fn report_download_error<R: tauri::Runtime>(
    state: &AppState,
    app: &tauri::AppHandle<R>,
    progress_lease: &ProgressLease,
    job_id: &str,
    primary_error: &Error,
) {
    let terminal = if matches!(primary_error, Error::Cancellation) {
        ProgressState::Cancelled
    } else {
        ProgressState::Failed
    };
    report_download_terminal_progress(state, app, progress_lease, job_id, 0.0, terminal);
}

fn report_download_success<R: tauri::Runtime>(
    state: &AppState,
    app: &tauri::AppHandle<R>,
    progress_lease: &ProgressLease,
    job_id: &str,
) {
    report_download_terminal_progress(
        state,
        app,
        progress_lease,
        job_id,
        100.0,
        ProgressState::Succeeded,
    );
}

#[allow(clippy::too_many_arguments)]
async fn download_to_destination_inner<R: tauri::Runtime>(
    id: &str,
    url: &str,
    destination: crate::infra::path_authority::PathRef,
    filename: String,
    app: &tauri::AppHandle<R>,
    state: &AppState,
    bearer_token: Option<&str>,
    total_size: Option<u32>,
    job_id: String,
    register_pgn_artifact: bool,
    integrity: Option<&ArtifactIntegrity>,
    cancellation: CancellationToken,
) -> Result<Option<crate::infra::path_authority::ArtifactPublication>, Error> {
    // Validate and reserve all fallible producer prerequisites before starting
    // visible progress. No failed setup may leave a running progress entry.
    uuid::Uuid::parse_str(&job_id)
        .map_err(|_| Error::InvalidInput("download job ID must be a UUID".into()))?;
    let filename = std::ffi::OsString::from(filename);
    let (op, resolved) = {
        let mut authority_guard = state
            .pgn_path_authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
        let authority = authority_guard
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
        let operations = authority.download_operations(&destination)?;
        let op = OpClass::from_operations(&operations)?;
        validate_artifact_integrity(op, url, integrity)?;
        let resolved = authority.resolve(
            &destination,
            crate::infra::path_authority::PathOperation::DownloadFile,
            std::slice::from_ref(&filename),
        )?;
        (op, resolved)
    };
    let staged = tempfile::tempdir().map_err(|error| Error::Io(Box::new(error)))?;
    let staged_file = staged.path().join("payload");
    let progress_lease = begin_progress(&state.progress_state, app, id.to_owned())?;
    let result = match tokio::time::timeout(
        DOWNLOAD_DEADLINE,
        download_file_core_control_with_integrity(
            op,
            url,
            &staged_file,
            state.http_transport.as_ref(),
            bearer_token,
            total_size,
            cancellation.clone(),
            integrity.map(|metadata| metadata.sha256.as_str()),
            |progress| {
                update_progress_with_state(
                    &state.progress_state,
                    app,
                    &progress_lease,
                    progress,
                    ProgressState::Running,
                )
            },
        ),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => {
            let error = Error::EngineTimeout("download deadline exceeded".into());
            report_download_error(state, app, &progress_lease, &job_id, &error);
            return Err(error);
        }
    };
    if let Err(error) = result {
        report_download_error(state, app, &progress_lease, &job_id, &error);
        return Err(error);
    }

    let reservation = if register_pgn_artifact {
        let payload = match crate::infra::path_authority::hash_staged_payload_cancellable(
            staged_file.clone(),
            cancellation.clone(),
        )
        .await
        {
            Ok(payload) => payload,
            Err(error) => {
                report_download_error(state, app, &progress_lease, &job_id, &error);
                return Err(error);
            }
        };
        let reservation_result = (|| {
            let mut authority = state
                .pgn_path_authority
                .lock()
                .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
            let authority = authority
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
            authority.reserve_download_artifact(
                &destination,
                filename.clone(),
                payload,
                filename.to_string_lossy().into_owned(),
                vec![crate::infra::path_authority::PathOperation::ReadPgn],
            )
        })();
        match reservation_result {
            Ok(reservation) => Some(reservation),
            Err(error) => {
                report_download_error(state, app, &progress_lease, &job_id, &error);
                return Err(error);
            }
        }
    } else {
        None
    };
    let install_reservation = reservation.clone();
    let install_result = crate::infra::blocking::BLOCKING_GATEWAY
        .spawn_cancellable(cancellation.clone(), move |worker_cancellation| {
            match install_reservation.as_ref() {
                Some(reservation) => resolved
                    .atomic_install_reserved_download_cancellable(
                        reservation,
                        &staged_file,
                        worker_cancellation,
                    )
                    .map(|installed| {
                        (
                            installed.outcome,
                            Some((installed.identity, installed.ctime_nanos)),
                        )
                    }),
                None => {
                    let mut staged = std::fs::File::open(staged_file)?;
                    resolved
                        .atomic_replace_download_cancellable(worker_cancellation, |target| {
                            copy_cancellable(&mut staged, target, worker_cancellation)?;
                            Ok(())
                        })
                        .map(|outcome| (outcome, None))
                }
            }
        })
        .await;
    let (target_durability, installed_identity) = match install_result {
        Ok(outcome) => outcome,
        Err(error) => {
            if let Some(reservation) = reservation.as_ref() {
                cleanup_download_reservation_best_effort(&state.pgn_path_authority, reservation);
            }
            report_download_error(state, app, &progress_lease, &job_id, &error);
            return Err(error);
        }
    };
    let artifact = if let Some(reservation) = reservation.as_ref() {
        let Some((installed_identity, installed_ctime_nanos)) = installed_identity else {
            let error = Error::Conflict("artifact install has no inode marker".into());
            report_download_error(state, app, &progress_lease, &job_id, &error);
            return Err(error);
        };
        match crate::infra::path_authority::activate_download_artifact_runtime(
            &state.pgn_path_authority,
            reservation,
            installed_identity,
            installed_ctime_nanos,
        )
        .await
        {
            Ok(mut artifact) => {
                if let Some(durability) = download_target_durability(target_durability) {
                    artifact.durability = durability;
                }
                Some(artifact)
            }
            Err(error) => {
                report_download_error(state, app, &progress_lease, &job_id, &error);
                return Err(error);
            }
        }
    } else {
        None
    };
    report_download_success(state, app, &progress_lease, &job_id);
    Ok(artifact)
}

/// Installs a fully validated native-provider PGN staging file as one atomic artifact.
/// Callers may parse/concatenate many pages privately, but no partial file becomes visible.
pub(crate) async fn install_staged_pgn_artifact(
    destination: crate::infra::path_authority::PathRef,
    filename: String,
    staged: tempfile::NamedTempFile,
    state: &AppState,
    cancellation: &CancellationToken,
) -> Result<crate::infra::path_authority::ArtifactPublication, Error> {
    let filename = std::ffi::OsString::from(filename);
    let payload = crate::infra::path_authority::hash_staged_payload_cancellable(
        staged.path().to_path_buf(),
        cancellation.clone(),
    )
    .await?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let reservation = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .reserve_download_artifact(
            &destination,
            filename.clone(),
            payload,
            filename.to_string_lossy().into_owned(),
            vec![crate::infra::path_authority::PathOperation::ReadPgn],
        )?;
    let resolved = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(
            &destination,
            crate::infra::path_authority::PathOperation::DownloadFile,
            std::slice::from_ref(&filename),
        )?;
    let installation_reservation = reservation.clone();
    let install = crate::infra::blocking::BLOCKING_GATEWAY
        .spawn_cancellable(cancellation.clone(), move |worker_cancellation| {
            resolved.atomic_install_reserved_download_cancellable(
                &installation_reservation,
                staged.path(),
                worker_cancellation,
            )
        })
        .await;
    let target_durability = match install {
        Ok(installed) => installed,
        Err(error) => {
            cleanup_download_reservation_best_effort(&state.pgn_path_authority, &reservation);
            return Err(error);
        }
    };
    let mut artifact = crate::infra::path_authority::activate_download_artifact_runtime(
        &state.pgn_path_authority,
        &reservation,
        target_durability.identity,
        target_durability.ctime_nanos,
    )
    .await?;
    if let Some(durability) = download_target_durability(target_durability.outcome) {
        artifact.durability = durability;
    }
    Ok(artifact)
}

fn lichess_games_url(player: &str, since_ms: Option<i64>) -> Result<(reqwest::Url, String), Error> {
    let player = crate::lichess::lichess_user_segment(player)?.to_owned();
    if since_ms.is_some_and(|since_ms| since_ms < 0) {
        return Err(Error::InvalidInput(
            "invalid Lichess export timestamp".into(),
        ));
    }
    let mut url = reqwest::Url::parse("https://lichess.org/api/games/user/")
        .map_err(|_| Error::OAuthFailure("invalid Lichess endpoint".into()))?;
    url.path_segments_mut()
        .map_err(|_| Error::OAuthFailure("invalid Lichess endpoint".into()))?
        .push(&player);
    {
        let mut query = url.query_pairs_mut();
        query.append_pair(
            "perfType",
            "ultraBullet,bullet,blitz,rapid,classical,correspondence",
        );
        query.append_pair("rated", "true");
        query.append_pair("sort", "dateAsc");
        if let Some(since_ms) = since_ms {
            query.append_pair("since", &since_ms.to_string());
        }
    }
    Ok((url, player))
}

/// Authenticated Lichess export. The opaque handle is resolved in the native credential store;
/// neither its bearer token nor a native destination path crosses IPC.
#[tauri::command]
#[specta::specta]
#[allow(clippy::too_many_arguments)]
pub async fn download_lichess_games(
    handle: crate::credentials::LichessAccountHandle,
    destination: crate::infra::path_authority::PathRef,
    filename: String,
    player: String,
    since_ms: Option<i64>,
    estimated_size: Option<u32>,
    job_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<crate::infra::path_authority::ArtifactPublication, Error> {
    download_lichess_games_runtime(
        handle,
        destination,
        filename,
        player,
        since_ms,
        estimated_size,
        job_id,
        &app,
        state.inner(),
    )
    .await
    .map_err(sanitize_download_error)
}

#[allow(clippy::too_many_arguments)]
async fn download_lichess_games_runtime<R: tauri::Runtime>(
    handle: crate::credentials::LichessAccountHandle,
    destination: crate::infra::path_authority::PathRef,
    filename: String,
    player: String,
    since_ms: Option<i64>,
    estimated_size: Option<u32>,
    job_id: String,
    app: &tauri::AppHandle<R>,
    state: &AppState,
) -> Result<crate::infra::path_authority::ArtifactPublication, Error> {
    let operations = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .download_operations(&destination)?;
    if OpClass::from_operations(&operations)? != OpClass::Lichess {
        return Err(Error::InvalidInput(
            "Lichess download requires a Lichess destination".into(),
        ));
    }
    let (url, player) = lichess_games_url(&player, since_ms)?;
    let token = state
        .credentials
        .token_async(handle)
        .await?
        .ok_or_else(|| Error::OAuthFailure("authenticated Lichess account unavailable".into()))?;
    download_to_destination(
        &format!("lichess_{player}"),
        url.as_str(),
        destination,
        filename,
        app,
        state,
        Some(&token),
        estimated_size,
        job_id,
        true,
        None,
    )
    .await?
    .ok_or_else(|| Error::Conflict("Lichess download did not register an artifact".into()))
}

fn resolve_engine_archive_destination(
    state: &AppState,
    destination: &crate::infra::path_authority::PathRef,
    directory_name: &std::ffi::OsStr,
) -> Result<(OpClass, crate::infra::path_authority::ResolvedPath), Error> {
    let mut authority_guard = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_guard
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    let operations = authority.download_operations(destination)?;
    let op = OpClass::from_operations(&operations)?;
    if op != OpClass::Engine {
        return Err(Error::InvalidInput(
            "engine archive requires an engine destination".into(),
        ));
    }
    let resolved = authority.resolve(
        destination,
        crate::infra::path_authority::PathOperation::DownloadArchive,
        &[directory_name.to_os_string()],
    )?;
    Ok((op, resolved))
}

/// Downloads and atomically installs an engine archive into an authority-managed directory.
/// Archive extraction occurs entirely in a private staging directory; the sealed authority API
/// commits the completed tree only after all archive validation succeeds.
#[tauri::command]
#[specta::specta]
#[allow(clippy::too_many_arguments)] // IPC contract is generated and intentionally stable.
pub async fn download_engine_archive(
    id: String,
    url: String,
    destination: crate::infra::path_authority::PathRef,
    directory_name: String,
    job_id: String,
    integrity: ArtifactIntegrity,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let lease = state.download_registry.begin(&state.operations, &job_id)?;
    let cancellation = lease.cancellation_token();
    let operation = lease.into_operation();
    let state = state.inner().clone();
    crate::infra::operations::run_native_operation(
        operation,
        "download_engine_archive",
        async move {
            let result = async {
                let directory_name = std::ffi::OsString::from(directory_name);
                let (op, resolved) =
                    resolve_engine_archive_destination(&state, &destination, &directory_name)?;
                uuid::Uuid::parse_str(&job_id)
                    .map_err(|_| Error::InvalidInput("download job ID must be a UUID".into()))?;
                validate_artifact_integrity(op, &url, Some(&integrity))?;
                let staging = private_tempdir()?;
                let extracted = staging.path().join("extracted");
                let progress_lease = begin_progress(&state.progress_state, &app, id.clone())?;
                let result = match tokio::time::timeout(
                    DOWNLOAD_DEADLINE,
                    download_file_core_control_with_integrity(
                        op,
                        &url,
                        &extracted,
                        state.http_transport.as_ref(),
                        None,
                        None,
                        cancellation.clone(),
                        Some(&integrity.sha256),
                        |progress| {
                            update_progress_with_state(
                                &state.progress_state,
                                &app,
                                &progress_lease,
                                progress,
                                ProgressState::Running,
                            )
                        },
                    ),
                )
                .await
                {
                    Ok(result) => result,
                    Err(_) => {
                        let error = Error::EngineTimeout(
                            "engine archive download deadline exceeded".into(),
                        );
                        update_progress_with_state(
                            &state.progress_state,
                            &app,
                            &progress_lease,
                            0.0,
                            ProgressState::Failed,
                        )?;
                        return Err(error);
                    }
                };
                if let Err(error) = result {
                    let terminal = if matches!(error, Error::Cancellation) {
                        ProgressState::Cancelled
                    } else {
                        ProgressState::Failed
                    };
                    update_progress_with_state(
                        &state.progress_state,
                        &app,
                        &progress_lease,
                        0.0,
                        terminal,
                    )?;
                    return Err(error);
                }
                if cancellation.is_cancelled() {
                    update_progress_with_state(
                        &state.progress_state,
                        &app,
                        &progress_lease,
                        0.0,
                        ProgressState::Cancelled,
                    )?;
                    return Err(Error::Cancellation);
                }
                let install_result = crate::infra::blocking::BLOCKING_GATEWAY
                    .spawn(move || resolved.atomic_install_download_dir(&extracted))
                    .await;
                if let Err(error) = install_result {
                    update_progress_with_state(
                        &state.progress_state,
                        &app,
                        &progress_lease,
                        0.0,
                        ProgressState::Failed,
                    )?;
                    return Err(error);
                }
                update_progress_with_state(
                    &state.progress_state,
                    &app,
                    &progress_lease,
                    100.0,
                    ProgressState::Succeeded,
                )
            }
            .await;
            result.map_err(sanitize_download_error)
        },
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_download(id: String, state: tauri::State<'_, AppState>) -> Result<bool, Error> {
    state.download_registry.cancel(&state.operations, &id)
}

fn create_private_dir_all(path: &Path) -> Result<(), Error> {
    let mut builder = std::fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        // The effective mode is the requested mode intersected with the process umask.
        builder.mode(0o700);
    }
    builder.create(path)?;
    Ok(())
}

fn private_tempdir() -> Result<tempfile::TempDir, Error> {
    let mut builder = tempfile::Builder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        builder.permissions(std::fs::Permissions::from_mode(0o700));
    }
    builder
        .tempdir()
        .map_err(|error| Error::Io(Box::new(error)))
}

fn private_tempdir_in(prefix: &str, parent: &Path) -> Result<tempfile::TempDir, Error> {
    let mut builder = tempfile::Builder::new();
    builder.prefix(prefix);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        builder.permissions(std::fs::Permissions::from_mode(0o700));
    }
    builder
        .tempdir_in(parent)
        .map_err(|error| Error::Io(Box::new(error)))
}

fn validate_archive_path(path: &str) -> Result<PathBuf, Error> {
    if path.is_empty() || path.len() > MAX_ARCHIVE_PATH_BYTES {
        return Err(Error::InvalidInput("Invalid path length".into()));
    }
    let p = Path::new(path);
    if p.is_absolute() {
        return Err(Error::InvalidInput("Absolute path in archive".into()));
    }
    let mut normal_components = 0usize;
    for component in p.components() {
        match component {
            std::path::Component::Prefix(_) => {
                return Err(Error::InvalidInput("Prefix in path".into()))
            }
            std::path::Component::RootDir => {
                return Err(Error::InvalidInput("Root dir in path".into()))
            }
            std::path::Component::ParentDir => {
                return Err(Error::InvalidInput("Parent dir in path".into()))
            }
            std::path::Component::Normal(n) => {
                normal_components += 1;
                let s = n.to_string_lossy();
                if s.contains('\0') {
                    return Err(Error::InvalidInput("Null byte in path".into()));
                }
            }
            std::path::Component::CurDir => {}
        }
    }
    #[cfg(unix)]
    if normal_components > MAX_ARCHIVE_PATH_COMPONENTS {
        // Experimentally, reinstall cleanup accepts one fewer archive component than
        // `MAX_REMOVE_TREE_DEPTH`: the installed staging root occupies removal depth zero.
        return Err(Error::ResourceLimit(
            "Archive path has too many components".into(),
        ));
    }
    Ok(p.to_path_buf())
}

fn extract_zip_cancellable(
    file: std::fs::File,
    target_path: &Path,
    limits: ArchiveLimits,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let target_dir = target_path.parent().unwrap_or_else(|| Path::new("."));
    create_private_dir_all(target_dir)?;
    let temp_dir = private_tempdir_in(".zip", target_dir)?;

    let mut archive = zip::ZipArchive::new(file).map_err(|e| Error::InvalidInput(e.to_string()))?;

    let mut total_expanded = 0u64;
    if archive.len() > limits.entries {
        return Err(Error::ResourceLimit("Too many entries in zip".into()));
    }

    for i in 0..archive.len() {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let mut file = archive
            .by_index(i)
            .map_err(|_| Error::InvalidInput("Invalid zip entry".into()))?;

        let validated_path = validate_archive_path(file.name())?;

        let size = file.size();
        if size > limits.per_entry {
            return Err(Error::ResourceLimit("Zip entry too large".into()));
        }

        let compressed_size = file.compressed_size();
        if compressed_size > 0 && size > compressed_size.saturating_mul(limits.ratio) {
            return Err(Error::ResourceLimit(
                "High compression ratio detected".into(),
            ));
        }

        let outpath = temp_dir.path().join(&validated_path);
        if (*file.name()).ends_with('/') {
            create_private_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                create_private_dir_all(p)?;
            }
            let mut outfile = private_output_file(&outpath)?;
            bounded_copy(
                &mut file,
                &mut outfile,
                size,
                &mut total_expanded,
                limits.expanded,
                cancellation,
            )?;
        }
    }

    crate::infra::fs::atomic_install_dir(temp_dir.path(), target_path)?;
    Ok(())
}

fn extract_tar_cancellable(
    file: std::fs::File,
    target_path: &Path,
    limits: ArchiveLimits,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let target_dir = target_path.parent().unwrap_or_else(|| Path::new("."));
    create_private_dir_all(target_dir)?;
    let temp_dir = private_tempdir_in(".tar", target_dir)?;

    let mut archive = tar::Archive::new(file);
    let mut entry_count = 0;
    let mut total_expanded = 0u64;

    for entry in archive.entries()? {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let mut entry = entry?;

        entry_count += 1;
        if entry_count > limits.entries {
            return Err(Error::ResourceLimit("Too many entries in tar".into()));
        }

        let path_cow = entry.path()?;
        let path_str = path_cow
            .to_str()
            .ok_or_else(|| Error::InvalidInput("Non-Unicode path in archive".into()))?;
        let validated_path = validate_archive_path(path_str)?;

        let header = entry.header();
        let entry_type = header.entry_type();
        if !entry_type.is_file() && !entry_type.is_dir() {
            return Err(Error::InvalidInput(
                "Special files/links not allowed in archive".into(),
            ));
        }

        let size = entry.size();
        if size > limits.per_entry {
            return Err(Error::ResourceLimit("Tar entry too large".into()));
        }

        let outpath = temp_dir.path().join(&validated_path);
        if entry_type.is_dir() {
            create_private_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                create_private_dir_all(p)?;
            }
            let mut outfile = private_output_file(&outpath)?;
            bounded_copy(
                &mut entry,
                &mut outfile,
                size,
                &mut total_expanded,
                limits.expanded,
                cancellation,
            )?;
        }
    }

    crate::infra::fs::atomic_install_dir(temp_dir.path(), target_path)?;
    Ok(())
}

fn extract_gz_cancellable(
    file: std::fs::File,
    target_path: &Path,
    limits: ArchiveLimits,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let target_dir = target_path.parent().unwrap_or_else(|| Path::new("."));
    create_private_dir_all(target_dir)?;

    let outcome = atomic_replace(target_path, |target_file| {
        let mut decoder = flate2::read::GzDecoder::new(file);
        let compressed = decoder.get_ref().metadata()?.len();
        let mut total_expanded = 0;
        bounded_copy(
            &mut decoder,
            target_file,
            limits.per_entry,
            &mut total_expanded,
            limits.expanded,
            cancellation,
        )?;
        let expanded = target_file.metadata()?.len();
        if compressed == 0 || expanded > compressed.saturating_mul(limits.ratio) {
            return Err(Error::ResourceLimit(
                "High gzip compression ratio detected".into(),
            ));
        }
        Ok(())
    })?;
    crate::infra::fs::require_durable(outcome, crate::error::DurabilityStage::GzipFileReplacement)
}

fn bounded_copy(
    input: &mut impl Read,
    output: &mut impl Write,
    per_entry_limit: u64,
    total_expanded: &mut u64,
    total_limit: u64,
    cancellation: &CancellationToken,
) -> Result<u64, Error> {
    let mut buffer = [0u8; 64 * 1024];
    let mut written = 0u64;
    loop {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let read = input.read(&mut buffer)?;
        if read == 0 {
            return Ok(written);
        }
        written = written
            .checked_add(read as u64)
            .ok_or_else(|| Error::ResourceLimit("Archive entry size overflow".into()))?;
        *total_expanded = total_expanded
            .checked_add(read as u64)
            .ok_or_else(|| Error::ResourceLimit("Archive expanded size overflow".into()))?;
        if written > per_entry_limit || *total_expanded > total_limit {
            return Err(Error::ResourceLimit(
                "Archive expansion limit exceeded".into(),
            ));
        }
        output.write_all(&buffer[..read])?;
    }
}

fn copy_cancellable(
    input: &mut impl Read,
    output: &mut impl Write,
    cancellation: &CancellationToken,
) -> Result<u64, Error> {
    let mut buffer = [0_u8; 64 * 1024];
    let mut copied = 0_u64;
    loop {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let read = input.read(&mut buffer)?;
        if read == 0 {
            return Ok(copied);
        }
        output.write_all(&buffer[..read])?;
        copied = copied.checked_add(read as u64).ok_or_else(|| {
            Error::ResourceLimit("download payload exceeds supported size".into())
        })?;
    }
}

#[cfg(test)]
fn extract_zip(
    file: std::fs::File,
    target_path: &Path,
    limits: ArchiveLimits,
) -> Result<(), Error> {
    extract_zip_cancellable(file, target_path, limits, &CancellationToken::new())
}

#[cfg(test)]
fn extract_tar(
    file: std::fs::File,
    target_path: &Path,
    limits: ArchiveLimits,
) -> Result<(), Error> {
    extract_tar_cancellable(file, target_path, limits, &CancellationToken::new())
}

#[cfg(test)]
fn extract_gz(file: std::fs::File, target_path: &Path, limits: ArchiveLimits) -> Result<(), Error> {
    extract_gz_cancellable(file, target_path, limits, &CancellationToken::new())
}

fn private_output_file(path: &Path) -> Result<std::fs::File, Error> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    Ok(options.open(path)?)
}

#[tauri::command]
#[specta::specta]
pub async fn set_file_as_executable(
    file: crate::infra::path_authority::PathRef,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    crate::infra::operations::run_accepted_blocking(
        &state.operations,
        "set_file_as_executable",
        move || set_file_as_executable_blocking(&authority, file),
    )
    .await
}

fn set_file_as_executable_blocking(
    authority: &Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    file: crate::infra::path_authority::PathRef,
) -> Result<(), Error> {
    let mut authority = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    authority
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(
            &file,
            crate::infra::path_authority::PathOperation::EngineInstall,
            &[],
        )?
        .mark_engine_executable()
}

#[tauri::command]
#[specta::specta]
pub async fn file_exists(
    file: crate::infra::path_authority::PathRef,
    state: tauri::State<'_, AppState>,
) -> Result<bool, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    crate::infra::operations::run_accepted_blocking(&state.operations, "file_exists", move || {
        file_exists_blocking(&authority, file)
    })
    .await
}

fn file_exists_blocking(
    authority: &Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    file: crate::infra::path_authority::PathRef,
) -> Result<bool, Error> {
    let mut authority_guard = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_guard
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    file_exists_with_authority(authority, &file)
}

#[derive(Debug, Type, serde::Serialize)]
pub struct FileMetadata {
    pub last_modified: u32,
}

#[tauri::command]
#[specta::specta]
pub async fn get_file_metadata(
    file: crate::infra::path_authority::PathRef,
    state: tauri::State<'_, AppState>,
) -> Result<FileMetadata, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    crate::infra::operations::run_accepted_blocking(
        &state.operations,
        "get_file_metadata",
        move || get_file_metadata_blocking(&authority, file),
    )
    .await
}

fn get_file_metadata_blocking(
    authority: &Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    file: crate::infra::path_authority::PathRef,
) -> Result<FileMetadata, Error> {
    let mut authority_guard = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_guard
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    get_file_metadata_with_authority(authority, &file)
}

fn resolve_engine_binary_for_inspection(
    authority: &mut crate::infra::path_authority::PathAuthority,
    file: &crate::infra::path_authority::PathRef,
) -> Result<Option<crate::infra::path_authority::ResolvedPath>, Error> {
    match authority.resolve(
        file,
        crate::infra::path_authority::PathOperation::EngineBinaryInspect,
        &[],
    ) {
        Ok(resolved) => Ok(Some(resolved)),
        Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(Error::InvalidInput(_)) => Err(Error::InvalidInput(
            "engine binary inspection could not be authorized".into(),
        )),
        Err(error) => {
            log::warn!("engine binary inspection failed: {error}");
            Err(Error::Conflict(
                "engine binary inspection could not be completed".into(),
            ))
        }
    }
}

fn file_exists_with_authority(
    authority: &mut crate::infra::path_authority::PathAuthority,
    file: &crate::infra::path_authority::PathRef,
) -> Result<bool, Error> {
    Ok(resolve_engine_binary_for_inspection(authority, file)?.is_some())
}

fn get_file_metadata_with_authority(
    authority: &mut crate::infra::path_authority::PathAuthority,
    file: &crate::infra::path_authority::PathRef,
) -> Result<FileMetadata, Error> {
    let resolved = resolve_engine_binary_for_inspection(authority, file)?
        .ok_or_else(|| Error::Conflict("engine binary inspection could not be completed".into()))?;
    Ok(FileMetadata {
        last_modified: resolved.modified_seconds().map_err(|_| {
            Error::Conflict("engine binary inspection could not be completed".into())
        })?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn archive_copy_core_cancels_between_real_chunks_before_publication() {
        struct HeldReader {
            entered: Option<std::sync::mpsc::SyncSender<()>>,
            release: std::sync::mpsc::Receiver<()>,
            finished: bool,
        }
        impl Read for HeldReader {
            fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
                if self.finished {
                    return Ok(0);
                }
                self.finished = true;
                if let Some(entered) = self.entered.take() {
                    let _ = entered.send(());
                }
                let _ = self.release.recv_timeout(Duration::from_secs(5));
                buffer[..64].fill(3);
                Ok(64)
            }
        }

        let cancellation = CancellationToken::new();
        let worker_cancellation = cancellation.clone();
        let (entered_tx, entered_rx) = std::sync::mpsc::sync_channel(1);
        let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);
        let worker = std::thread::spawn(move || {
            let mut output = Vec::new();
            let mut total = 0;
            bounded_copy(
                &mut HeldReader {
                    entered: Some(entered_tx),
                    release: release_rx,
                    finished: false,
                },
                &mut output,
                1024,
                &mut total,
                1024,
                &worker_cancellation,
            )
        });
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        cancellation.cancel();
        release_tx.send(()).unwrap();
        assert!(matches!(worker.join().unwrap(), Err(Error::Cancellation)));
    }

    fn test_path_authority(dir: &tempfile::TempDir) -> crate::infra::path_authority::PathAuthority {
        crate::infra::path_authority::PathAuthority::open(
            dir.path().join("path-authority.json"),
            vec![],
        )
        .unwrap()
    }

    fn database_destination(
        dir: &tempfile::TempDir,
    ) -> (
        crate::infra::path_authority::PathAuthority,
        crate::infra::path_authority::PathRef,
    ) {
        let database_root = dir.path().join("databases");
        std::fs::create_dir(&database_root).unwrap();
        let mut authority = test_path_authority(dir);
        let root = authority
            .get_or_create_database_root(&database_root, "Databases", None)
            .unwrap();
        (authority, root.id)
    }

    #[test]
    fn from_operations_derives_exclusive_download_classes() {
        use crate::infra::path_authority::PathOperation::*;

        assert_eq!(
            OpClass::from_operations(&[DownloadFile]).unwrap(),
            OpClass::Lichess
        );
        assert_eq!(
            OpClass::from_operations(&[DownloadArchive, EngineInstall]).unwrap(),
            OpClass::Engine
        );
        assert_eq!(
            OpClass::from_operations(&[
                DatabaseRead,
                DatabaseMutate,
                DatabaseCreate,
                DatabaseExport,
                DownloadFile,
            ])
            .unwrap(),
            OpClass::Db
        );
        assert_eq!(
            OpClass::from_operations(&[PuzzleRead, PuzzleDelete, DownloadFile]).unwrap(),
            OpClass::PuzzleDb
        );
        assert_eq!(
            OpClass::from_operations(&[DownloadFile, EngineExecute]).unwrap(),
            OpClass::Engine
        );
        for operations in [
            vec![DatabaseRead, PuzzleRead],
            vec![EngineInstall, DatabaseRead],
            vec![EngineConfigure, PuzzleDelete],
            vec![],
            vec![ReadPgn],
        ] {
            assert!(matches!(
                OpClass::from_operations(&operations),
                Err(Error::InvalidInput(_))
            ));
        }
    }

    #[tokio::test]
    async fn lichess_prefixed_id_cannot_skip_signature() {
        let dir = tempdir().unwrap();
        let (authority, destination) = database_destination(&dir);
        let state = AppState::default();
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = tauri::test::mock_app();

        let error = download_to_destination(
            "lichess_spoof",
            "https://www.encroissant.org/database.db3",
            destination,
            "database.db3".into(),
            app.handle(),
            &state,
            None,
            None,
            uuid::Uuid::new_v4().to_string(),
            false,
            None,
        )
        .await
        .unwrap_err();

        assert_eq!(
            error.to_string(),
            "Invalid input: signed artifact integrity metadata required"
        );
    }

    #[tokio::test]
    async fn lichess_games_reject_database_destination() {
        let dir = tempdir().unwrap();
        let (authority, destination) = database_destination(&dir);
        let state = AppState::default();
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = tauri::test::mock_app();

        let error = download_lichess_games_runtime(
            crate::credentials::LichessAccountHandle::new(),
            destination,
            "games.pgn".into(),
            "player".into(),
            None,
            None,
            uuid::Uuid::new_v4().to_string(),
            app.handle(),
            &state,
        )
        .await
        .unwrap_err();
        assert!(matches!(error, Error::InvalidInput(_)));
    }

    #[test]
    fn download_engine_archive_rejects_database_destination() {
        let dir = tempdir().unwrap();
        let (authority, destination) = database_destination(&dir);
        let state = AppState::default();
        *state.pgn_path_authority.lock().unwrap() = Some(authority);

        let error = match resolve_engine_archive_destination(
            &state,
            &destination,
            std::ffi::OsStr::new("engine_1"),
        ) {
            Ok(_) => panic!("database destination must not resolve for an engine archive"),
            Err(error) => error,
        };
        assert!(matches!(error, Error::InvalidInput(_)));
    }

    #[test]
    fn download_io_serializes_without_path() {
        let error = sanitize_download_error(Error::Io(Box::new(std::io::Error::other(
            "/private/staging/payload: permission denied",
        ))));
        let serialized = serde_json::to_string(&error).unwrap();
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert_eq!(payload["category"], "io");
        assert_eq!(payload["message"], "I/O failure");
        assert!(!serialized.contains("staging"));
    }

    #[test]
    fn download_lichess_games_rejects_traversal_player_before_push() {
        assert!(matches!(
            lichess_games_url("../account", None),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn file_exists_rejects_a_capability_without_engine_inspection_authority() {
        let dir = tempdir().unwrap();
        let executable = dir.path().join("private-engine");
        std::fs::write(&executable, b"engine").unwrap();
        let mut authority = test_path_authority(&dir);
        let handle = authority
            .migrate_legacy_os_path(
                executable.as_os_str().to_os_string(),
                "engine",
                crate::infra::path_authority::PathClass::PersistentFile,
                vec![crate::infra::path_authority::PathOperation::EngineExecute],
            )
            .unwrap();

        let error = file_exists_with_authority(&mut authority, &handle.id).unwrap_err();
        let serialized = serde_json::to_string(&error).unwrap();
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert!(matches!(error, Error::InvalidInput(_)));
        assert_eq!(payload["category"], "invalid-input");
        assert_eq!(payload["message"], error.to_string());
        assert!(!serialized.contains(&executable.display().to_string()));
        assert!(!serialized.contains("Permission denied"));
        assert!(!serialized.contains("os error"));
    }

    #[test]
    fn file_exists_returns_false_only_after_the_registered_file_is_deleted() {
        let dir = tempdir().unwrap();
        let executable = dir.path().join("engine");
        std::fs::write(&executable, b"engine").unwrap();
        let mut authority = test_path_authority(&dir);
        let handle = authority
            .register_engine_file(&executable, "engine")
            .unwrap();
        assert!(file_exists_with_authority(&mut authority, handle.path_ref()).unwrap());

        std::fs::remove_file(&executable).unwrap();
        assert!(!file_exists_with_authority(&mut authority, handle.path_ref()).unwrap());
    }

    #[test]
    fn get_file_metadata_rejects_a_capability_without_engine_inspection_authority() {
        let dir = tempdir().unwrap();
        let executable = dir.path().join("private-engine");
        std::fs::write(&executable, b"engine").unwrap();
        let mut authority = test_path_authority(&dir);
        let handle = authority
            .migrate_legacy_os_path(
                executable.as_os_str().to_os_string(),
                "engine",
                crate::infra::path_authority::PathClass::PersistentFile,
                vec![crate::infra::path_authority::PathOperation::EngineExecute],
            )
            .unwrap();

        let error = get_file_metadata_with_authority(&mut authority, &handle.id).unwrap_err();
        let serialized = serde_json::to_string(&error).unwrap();
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert!(matches!(error, Error::InvalidInput(_)));
        assert_eq!(payload["category"], "invalid-input");
        assert_eq!(payload["message"], error.to_string());
        assert!(!serialized.contains(&executable.display().to_string()));
        assert!(!serialized.contains("Permission denied"));
        assert!(!serialized.contains("os error"));
    }

    #[test]
    fn get_file_metadata_redacts_a_deleted_engine_path_and_os_error() {
        let dir = tempdir().unwrap();
        let executable = dir.path().join("private-engine");
        std::fs::write(&executable, b"engine").unwrap();
        let mut authority = test_path_authority(&dir);
        let handle = authority
            .register_engine_file(&executable, "engine")
            .unwrap();
        std::fs::remove_file(&executable).unwrap();

        let error =
            get_file_metadata_with_authority(&mut authority, handle.path_ref()).unwrap_err();
        let serialized = serde_json::to_string(&error).unwrap();
        let payload: serde_json::Value =
            serde_json::from_str(&serialized).expect("serialized error is a JSON object");
        assert!(matches!(error, Error::Conflict(_)));
        assert_eq!(payload["category"], "conflict");
        assert_eq!(payload["message"], error.to_string());
        assert!(!serialized.contains(&executable.display().to_string()));
        assert!(!serialized.contains("No such file"));
        assert!(!serialized.contains("os error"));
    }

    #[test]
    fn download_durability_mapper_serializes_only_its_closed_label() {
        let durability = download_target_durability(
            crate::infra::fs::AtomicFileOutcome::CommittedDurabilityUncertain(
                std::io::Error::other(r"C:\private\download: access denied"),
            ),
        )
        .expect("uncertain durability");
        assert_eq!(
            serde_json::to_string(&durability).expect("serialize durability"),
            r#"{"DurabilityUncertain":"DownloadTargetReplacement"}"#
        );
    }

    #[test]
    fn download_registry_is_bounded_exact_and_cleans_up() {
        let registry = Arc::new(DownloadRegistry::default());
        let operations = crate::infra::operations::OperationRegistry::default();
        let first = registry.begin(&operations, "job").unwrap();
        assert!(registry.begin(&operations, "job").is_err());
        assert!(registry.cancel(&operations, "job").unwrap());
        assert!(first.cancellation_token().is_cancelled());
        drop(first);
        assert!(!registry.cancel(&operations, "job").unwrap());
    }

    #[test]
    fn test_extract_zip_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("test.zip");

        let file = std::fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);

        let options = zip::write::SimpleFileOptions::default();

        zip.start_file("/absolute/path.txt", options).unwrap();
        zip.write_all(b"content").unwrap();
        zip.start_file("../traversal.txt", options).unwrap();
        zip.write_all(b"content").unwrap();
        zip.finish().unwrap();

        let zip_file = std::fs::File::open(&zip_path).unwrap();
        let extract_path = dir.path().join("extracted");
        let result = extract_zip(zip_file, &extract_path, OpClass::Engine.limits());

        assert!(result.is_err());
    }

    #[test]
    fn test_extract_tar_limits() {
        let dir = tempdir().unwrap();
        let tar_path = dir.path().join("bomb.tar");
        let mut header = tar::Header::new_gnu();
        header.set_size(5);
        header.set_cksum();
        let mut tar = tar::Builder::new(std::fs::File::create(&tar_path).unwrap());
        tar.append_data(&mut header, "large.bin", b"12345".as_slice())
            .unwrap();
        tar.finish().unwrap();
        let limits = ArchiveLimits {
            compressed: 100,
            expanded: 4,
            per_entry: 4,
            entries: 1,
            ratio: 10,
        };
        let output = dir.path().join("output");
        assert!(extract_tar(std::fs::File::open(tar_path).unwrap(), &output, limits).is_err());
        assert!(!output.exists());
    }

    #[test]
    fn test_extract_tar_symlink_fault() {
        let dir = tempdir().unwrap();
        let tar_path = dir.path().join("symlink.tar");

        let mut header = tar::Header::new_gnu();
        header.set_size(0);
        header.set_entry_type(tar::EntryType::Symlink);
        header.set_cksum();
        let mut tar = tar::Builder::new(std::fs::File::create(&tar_path).unwrap());
        tar.append_data(&mut header, "link.txt", "".as_bytes())
            .unwrap();
        tar.finish().unwrap();

        let tar_file = std::fs::File::open(&tar_path).unwrap();
        let extract_path = dir.path().join("extracted");
        let result = extract_tar(tar_file, &extract_path, OpClass::Engine.limits());

        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().to_string(),
            "Invalid input: Special files/links not allowed in archive"
        );
    }

    use crate::infra::net::{DownloadResponse, DownloadTransport};
    use reqwest::header::{HeaderMap, HeaderValue};

    pub struct MockTransport {
        pub responses: std::sync::Mutex<Vec<Result<DownloadResponse, Error>>>,
        pub requests_seen: std::sync::Mutex<Vec<(String, HeaderMap)>>,
    }

    #[async_trait::async_trait]
    impl DownloadTransport for MockTransport {
        async fn request(&self, url: &str, headers: HeaderMap) -> Result<DownloadResponse, Error> {
            self.requests_seen
                .lock()
                .unwrap()
                .push((url.to_string(), headers.clone()));
            let mut resps = self.responses.lock().unwrap();
            if resps.is_empty() {
                return Err(Error::InvalidInput("No more mock responses".into()));
            }
            resps.remove(0)
        }
    }

    #[tokio::test]
    async fn test_download_file_http_error() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("out.txt");
        let mock = MockTransport {
            responses: std::sync::Mutex::new(vec![Ok(DownloadResponse {
                status: 500,
                headers: HeaderMap::new(),
                content_length: None,
                stream: Box::pin(futures_util::stream::empty()),
            })]),
            requests_seen: std::sync::Mutex::new(vec![]),
        };

        let res = download_file_core(
            OpClass::Lichess,
            "https://lichess.org/test",
            &target,
            &mock,
            None,
            None,
            |_| Ok(()),
        )
        .await;

        assert!(res.is_err());
        assert_eq!(
            res.unwrap_err().to_string(),
            "Invalid input: HTTP status 500"
        );
    }

    #[tokio::test]
    async fn test_download_file_interrupted_stream() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("out.txt");

        let stream = futures_util::stream::iter(vec![
            Ok(bytes::Bytes::from("hello")),
            Err(Error::InvalidInput("Network dropped".into())),
        ]);

        let mock = MockTransport {
            responses: std::sync::Mutex::new(vec![Ok(DownloadResponse {
                status: 200,
                headers: HeaderMap::new(),
                content_length: None,
                stream: Box::pin(stream),
            })]),
            requests_seen: std::sync::Mutex::new(vec![]),
        };

        let res = download_file_core(
            OpClass::Lichess,
            "https://lichess.org/test",
            &target,
            &mock,
            None,
            None,
            |_| Ok(()),
        )
        .await;

        assert!(res.is_err());
        assert_eq!(
            res.unwrap_err().to_string(),
            "Invalid input: Network dropped"
        );
    }

    #[tokio::test]
    async fn test_download_file_cross_origin_token_stripping() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("out.txt");

        let mut redirect_headers = HeaderMap::new();
        redirect_headers.insert(
            reqwest::header::LOCATION,
            HeaderValue::from_static("https://evil.com/file"),
        );

        let mock = MockTransport {
            responses: std::sync::Mutex::new(vec![
                Ok(DownloadResponse {
                    status: 302,
                    headers: redirect_headers,
                    content_length: None,
                    stream: Box::pin(futures_util::stream::empty()),
                }),
                Ok(DownloadResponse {
                    status: 200,
                    headers: HeaderMap::new(),
                    content_length: Some(0),
                    stream: Box::pin(futures_util::stream::empty()),
                }),
            ]),
            requests_seen: std::sync::Mutex::new(vec![]),
        };

        let res = download_file_core(
            OpClass::Lichess,
            "https://lichess.org/test",
            &target,
            &mock,
            Some("my_secret_token"),
            None,
            |_| Ok(()),
        )
        .await;

        assert!(res.is_ok());

        let reqs = mock.requests_seen.lock().unwrap();
        assert_eq!(reqs.len(), 2);
        // First request to lichess should have the token
        assert!(reqs[0].1.contains_key("Authorization"));
        // Second request to evil.com should NOT have the token
        assert!(!reqs[1].1.contains_key("Authorization"));
    }

    #[tokio::test]
    async fn rejects_bearer_token_on_lookalike_port() {
        let dir = tempdir().unwrap();
        let mock = MockTransport {
            responses: std::sync::Mutex::new(vec![]),
            requests_seen: std::sync::Mutex::new(vec![]),
        };
        let error = download_file_core(
            OpClass::Lichess,
            "https://lichess.org:444/export",
            &dir.path().join("out.pgn"),
            &mock,
            Some("secret"),
            None,
            |_| Ok(()),
        )
        .await
        .unwrap_err();
        assert_eq!(error.to_string(), "Invalid input: Unauthorized origin");
        assert!(mock.requests_seen.lock().unwrap().is_empty());
    }

    #[test]
    fn download_url_rejects_private_literal_addresses() {
        for url in [
            "https://127.0.0.1/file",
            "https://[::1]/file",
            "https://100.64.0.1/file",
            "https://[::ffff:127.0.0.1]/file",
        ] {
            let parsed = reqwest::Url::parse(url).unwrap();
            assert!(validate_download_url(&parsed).is_err(), "{url}");
        }
    }

    #[test]
    fn download_url_component_policy_rejects_each_credential_and_fragment_independently() {
        for url in [
            "https://user@example.com/file",
            "https://user:password@example.com/file",
            "https://example.com/file#fragment",
        ] {
            assert!(validate_download_url(&reqwest::Url::parse(url).unwrap()).is_err());
        }
        assert!(validate_download_url(
            &reqwest::Url::parse("https://example.com/file?query=allowed").unwrap()
        )
        .is_ok());
    }

    #[test]
    fn archive_path_policy_enforces_exact_length_and_component_boundaries() {
        assert!(validate_archive_path("").is_err());
        assert_eq!(
            validate_archive_path("safe/directory/file.bin").unwrap(),
            PathBuf::from("safe/directory/file.bin")
        );
        assert!(validate_archive_path("../escape").is_err());
        assert!(validate_archive_path("/absolute").is_err());
        assert!(validate_archive_path("nul\0byte").is_err());

        let maximum = "a".repeat(1024);
        assert_eq!(
            validate_archive_path(&maximum).unwrap(),
            PathBuf::from(&maximum)
        );
        assert!(validate_archive_path(&"a".repeat(1025)).is_err());
    }

    #[cfg(unix)]
    struct UmaskGuard(libc::mode_t);

    #[cfg(unix)]
    impl UmaskGuard {
        fn zero() -> Self {
            // SAFETY: this test holds `UMASK_TEST_LOCK` for the guard's whole lifetime.
            Self(unsafe { libc::umask(0) })
        }
    }

    #[cfg(unix)]
    impl Drop for UmaskGuard {
        fn drop(&mut self) {
            // SAFETY: restoring the value returned by `umask` while the lock is still held.
            unsafe {
                libc::umask(self.0);
            }
        }
    }

    #[cfg(unix)]
    static UMASK_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[cfg(unix)]
    fn assert_mode_700(path: &Path) {
        use std::os::unix::fs::PermissionsExt;

        assert_eq!(
            path.metadata().unwrap().permissions().mode() & 0o777,
            0o700,
            "unexpected mode for {}",
            path.display()
        );
    }

    #[cfg(unix)]
    #[test]
    fn archive_directory_creation_sites_are_private_with_zero_umask() {
        let _lock = UMASK_TEST_LOCK.lock().unwrap();
        let _umask = UmaskGuard::zero();
        let root = tempdir().unwrap();

        let outer_staging = private_tempdir().unwrap();
        assert_mode_700(outer_staging.path());

        let zip_archive = root.path().join("archive.zip");
        let mut zip = zip::ZipWriter::new(std::fs::File::create(&zip_archive).unwrap());
        let options = zip::write::SimpleFileOptions::default();
        zip.add_directory("explicit/", options).unwrap();
        zip.start_file("implicit/file", options).unwrap();
        zip.write_all(b"zip").unwrap();
        zip.finish().unwrap();
        let zip_target = root.path().join("zip-target").join("installed");
        extract_zip(
            std::fs::File::open(zip_archive).unwrap(),
            &zip_target,
            OpClass::Engine.limits(),
        )
        .unwrap();
        assert_mode_700(zip_target.parent().unwrap());
        assert_mode_700(&zip_target);
        assert_mode_700(&zip_target.join("explicit"));
        assert_mode_700(&zip_target.join("implicit"));

        let tar_archive = root.path().join("archive.tar");
        let mut tar = tar::Builder::new(std::fs::File::create(&tar_archive).unwrap());
        let mut directory_header = tar::Header::new_gnu();
        directory_header.set_entry_type(tar::EntryType::Directory);
        directory_header.set_mode(0o777);
        directory_header.set_size(0);
        directory_header.set_cksum();
        tar.append_data(&mut directory_header, "explicit", std::io::empty())
            .unwrap();
        let mut file_header = tar::Header::new_gnu();
        file_header.set_mode(0o666);
        file_header.set_size(3);
        file_header.set_cksum();
        tar.append_data(&mut file_header, "implicit/file", b"tar".as_slice())
            .unwrap();
        tar.finish().unwrap();
        drop(tar);
        let tar_target = root.path().join("tar-target").join("installed");
        extract_tar(
            std::fs::File::open(tar_archive).unwrap(),
            &tar_target,
            OpClass::Engine.limits(),
        )
        .unwrap();
        assert_mode_700(tar_target.parent().unwrap());
        assert_mode_700(&tar_target);
        assert_mode_700(&tar_target.join("explicit"));
        assert_mode_700(&tar_target.join("implicit"));

        let gzip_archive = root.path().join("archive.gz");
        let mut encoder = flate2::write::GzEncoder::new(
            std::fs::File::create(&gzip_archive).unwrap(),
            flate2::Compression::default(),
        );
        encoder.write_all(b"gzip").unwrap();
        encoder.finish().unwrap();
        let gzip_target = root.path().join("gzip-target").join("installed");
        extract_gz(
            std::fs::File::open(gzip_archive).unwrap(),
            &gzip_target,
            OpClass::Engine.limits(),
        )
        .unwrap();
        assert_mode_700(gzip_target.parent().unwrap());
    }

    #[test]
    fn gzip_extraction_keeps_the_installed_file_and_reports_uncertain_durability() {
        let root = tempdir().unwrap();
        let gzip_archive = root.path().join("archive.gz");
        let mut encoder = flate2::write::GzEncoder::new(
            std::fs::File::create(&gzip_archive).unwrap(),
            flate2::Compression::default(),
        );
        encoder.write_all(b"gzip").unwrap();
        encoder.finish().unwrap();
        let gzip_target = root.path().join("gzip-target").join("installed");
        crate::infra::fs::set_test_atomic_file_injector(Some(std::sync::Arc::new(
            crate::infra::fs::ParentSyncFault("uncertain"),
        )));
        let result = extract_gz(
            std::fs::File::open(gzip_archive).unwrap(),
            &gzip_target,
            OpClass::Engine.limits(),
        );
        crate::infra::fs::set_test_atomic_file_injector(None);
        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::GzipFileReplacement
            ))
        ));
        assert_eq!(std::fs::read(&gzip_target).unwrap(), b"gzip");
    }

    #[cfg(unix)]
    #[test]
    fn archive_path_policy_matches_the_measured_removal_boundary() {
        let accepted = std::iter::repeat_n("a", MAX_ARCHIVE_PATH_COMPONENTS)
            .collect::<Vec<_>>()
            .join("/");
        let rejected = std::iter::repeat_n("a", crate::infra::fs::MAX_REMOVE_TREE_DEPTH)
            .collect::<Vec<_>>()
            .join("/");

        assert!(validate_archive_path(&accepted).is_ok());
        assert!(matches!(
            validate_archive_path(&rejected),
            Err(Error::ResourceLimit(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn near_cap_zip_installs_and_reinstalls_cleanly() {
        let root = tempdir().unwrap();
        let archive_path = root.path().join("near-cap.zip");
        let entry = std::iter::repeat_n("a", MAX_ARCHIVE_PATH_COMPONENTS)
            .collect::<Vec<_>>()
            .join("/");
        let mut zip = zip::ZipWriter::new(std::fs::File::create(&archive_path).unwrap());
        zip.start_file(entry, zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"content").unwrap();
        zip.finish().unwrap();
        let target = root.path().join("installed");

        extract_zip(
            std::fs::File::open(&archive_path).unwrap(),
            &target,
            OpClass::Engine.limits(),
        )
        .unwrap();
        extract_zip(
            std::fs::File::open(&archive_path).unwrap(),
            &target,
            OpClass::Engine.limits(),
        )
        .unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn over_cap_cleanup_failure_serializes_only_its_closed_label() {
        let root = tempdir().unwrap();
        let target = root.path().join("installed");
        let entry =
            std::iter::repeat_n("a", crate::infra::fs::MAX_REMOVE_TREE_DEPTH).collect::<PathBuf>();

        for source_name in ["first", "second"] {
            let source = root.path().join(source_name);
            let output = source.join(&entry);
            std::fs::create_dir_all(output.parent().unwrap()).unwrap();
            std::fs::write(output, b"content").unwrap();
            let result = crate::infra::fs::atomic_install_dir(&source, &target);
            if source_name == "first" {
                result.unwrap();
            } else {
                let error = result.unwrap_err();
                assert!(matches!(
                    error,
                    Error::CommittedDurabilityUncertain(
                        crate::error::DurabilityStage::OldDirectoryCleanup
                    )
                ));
                let serialized = serde_json::to_string(&error).unwrap();
                let payload: serde_json::Value =
                    serde_json::from_str(&serialized).expect("serialized error is a JSON object");
                assert_eq!(payload["category"], "durability");
                assert_eq!(
                    payload["message"],
                    "Committed but durability uncertain: old directory cleanup"
                );
                assert!(!serialized.contains(&root.path().display().to_string()));
                assert!(!serialized.contains("directory cleanup exceeded"));
            }
        }
    }

    #[test]
    fn database_and_engine_artifacts_require_a_signed_manifest() {
        for op in [OpClass::Db, OpClass::Engine] {
            let error = validate_artifact_integrity(op, "https://www.encroissant.org/file", None)
                .unwrap_err();
            assert_eq!(
                error.to_string(),
                "Invalid input: signed artifact integrity metadata required"
            );
        }
    }

    #[test]
    fn puzzle_database_artifacts_require_valid_signed_manifest() {
        let url = "https://www.encroissant.org/puzzles/file.db3";
        let missing = validate_artifact_integrity(OpClass::PuzzleDb, url, None).unwrap_err();
        assert_eq!(
            missing.to_string(),
            "Invalid input: signed artifact integrity metadata required"
        );

        let invalid = ArtifactIntegrity {
            sha256: "a".repeat(64),
            signature: "invalid minisign signature".into(),
        };
        let invalid_signature =
            validate_artifact_integrity(OpClass::PuzzleDb, url, Some(&invalid)).unwrap_err();
        assert_eq!(
            invalid_signature.to_string(),
            "Invalid input: invalid artifact manifest signature"
        );
    }

    #[test]
    fn tampered_manifest_signature_is_rejected_before_download() {
        let integrity = ArtifactIntegrity {
            sha256: "a".repeat(64),
            signature: "untrusted comment: invalid\ninvalid\ntrusted comment: invalid\ninvalid"
                .into(),
        };
        assert!(validate_artifact_integrity(
            OpClass::Engine,
            "https://www.encroissant.org/engine.zip",
            Some(&integrity),
        )
        .is_err());
    }

    #[tokio::test]
    async fn checksum_mismatch_never_installs_the_downloaded_payload() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("payload.db3");
        let mock = MockTransport {
            responses: std::sync::Mutex::new(vec![Ok(DownloadResponse {
                status: 200,
                headers: HeaderMap::new(),
                content_length: Some(4),
                stream: Box::pin(futures_util::stream::iter(vec![Ok(bytes::Bytes::from(
                    "data",
                ))])),
            })]),
            requests_seen: std::sync::Mutex::new(vec![]),
        };
        let error = download_file_core_control_with_integrity(
            OpClass::Db,
            "https://www.encroissant.org/data.db3",
            &target,
            &mock,
            None,
            None,
            CancellationToken::new(),
            Some(&"0".repeat(64)),
            |_| Ok(()),
        )
        .await
        .unwrap_err();
        assert_eq!(
            error.to_string(),
            "Invalid input: artifact SHA-256 mismatch"
        );
        assert!(!target.exists());
    }

    #[tokio::test]
    async fn cancelled_download_never_starts_transport_or_touches_target() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("out.pgn");
        let token = CancellationToken::new();
        token.cancel();
        let mock = MockTransport {
            responses: std::sync::Mutex::new(vec![]),
            requests_seen: std::sync::Mutex::new(vec![]),
        };
        let error = download_file_core_control(
            OpClass::Lichess,
            "https://lichess.org/export",
            &target,
            &mock,
            None,
            None,
            token,
            |_| Ok(()),
        )
        .await
        .unwrap_err();
        assert!(matches!(error, Error::Cancellation));
        assert!(!target.exists());
        assert!(mock.requests_seen.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_download_file_length_mismatch() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("out.txt");

        let stream = futures_util::stream::iter(vec![Ok(bytes::Bytes::from("123"))]);

        let mock = MockTransport {
            responses: std::sync::Mutex::new(vec![Ok(DownloadResponse {
                status: 200,
                headers: HeaderMap::new(),
                content_length: Some(10), // Declared 10, actual 3
                stream: Box::pin(stream),
            })]),
            requests_seen: std::sync::Mutex::new(vec![]),
        };

        let res = download_file_core(
            OpClass::Lichess,
            "https://lichess.org/test",
            &target,
            &mock,
            None,
            None,
            |_| Ok(()),
        )
        .await;

        assert!(res.is_err());
        assert_eq!(
            res.unwrap_err().to_string(),
            "Invalid input: Actual downloaded size mismatch"
        );
    }

    struct ResetAtomicInjectorGuard;
    impl Drop for ResetAtomicInjectorGuard {
        fn drop(&mut self) {
            crate::infra::fs::set_test_atomic_file_injector(None);
        }
    }

    struct TargetParentSyncFault {
        skip: std::sync::atomic::AtomicUsize,
    }

    impl crate::infra::fs::AtomicWriterInjector for TargetParentSyncFault {
        fn inject(&self, point: crate::infra::fs::AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == crate::infra::fs::AtomicFileFaultPoint::ParentSync
                && self.skip.fetch_sub(1, std::sync::atomic::Ordering::SeqCst) == 0
            {
                return Err(std::io::Error::other("target parent sync failed"));
            }
            Ok(())
        }
    }

    struct HoldSecondPrecommit {
        seen: std::sync::atomic::AtomicUsize,
        entered: std::sync::Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
        release: std::sync::Mutex<std::sync::mpsc::Receiver<()>>,
    }

    impl crate::infra::fs::AtomicWriterInjector for HoldSecondPrecommit {
        fn inject(&self, point: crate::infra::fs::AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == crate::infra::fs::AtomicFileFaultPoint::PreCommitRevalidate
                && self.seen.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 1
            {
                if let Some(entered) = self.entered.lock().unwrap().take() {
                    let _ = entered.send(());
                }
                let _ = self
                    .release
                    .lock()
                    .unwrap()
                    .recv_timeout(Duration::from_secs(5));
            }
            Ok(())
        }
    }

    struct CancelSecondParentSync {
        seen: std::sync::atomic::AtomicUsize,
        cancellation: CancellationToken,
    }

    impl crate::infra::fs::AtomicWriterInjector for CancelSecondParentSync {
        fn inject(&self, point: crate::infra::fs::AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == crate::infra::fs::AtomicFileFaultPoint::ParentSync
                && self.seen.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 1
            {
                self.cancellation.cancel();
            }
            Ok(())
        }
    }

    fn test_downloads_destination(
        dir: &tempfile::TempDir,
    ) -> (
        crate::infra::path_authority::PathAuthority,
        crate::infra::path_authority::PathRef,
        PathBuf,
    ) {
        let download_root = dir.path().join("downloads");
        std::fs::create_dir(&download_root).unwrap();
        let app_root = crate::infra::path_authority::AppOwnedRoot::new(
            "downloads",
            download_root.clone(),
            vec![crate::infra::path_authority::PathOperation::DownloadFile],
        );
        let root_id = app_root.id.clone();
        let authority = crate::infra::path_authority::PathAuthority::open(
            dir.path().join("path-authority.json"),
            vec![app_root],
        )
        .unwrap();
        (authority, root_id, download_root)
    }

    fn test_progress_app() -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(
                crate::progress::ProgressEvent
            ))
            .mount_events(&app);
        app
    }

    fn mock_successful_response(payload: &'static [u8]) -> DownloadResponse {
        DownloadResponse {
            status: 200,
            headers: HeaderMap::new(),
            content_length: Some(payload.len() as u64),
            stream: Box::pin(futures_util::stream::iter(vec![Ok(
                bytes::Bytes::from_static(payload),
            )])),
        }
    }

    fn mock_successful_transport(
        payload: &'static [u8],
    ) -> Arc<dyn crate::infra::net::DownloadTransport> {
        Arc::new(MockTransport {
            responses: std::sync::Mutex::new(vec![Ok(mock_successful_response(payload))]),
            requests_seen: std::sync::Mutex::new(vec![]),
        })
    }

    #[tokio::test]
    async fn runtime_callers_pin_download_target_replacement_durability_override() {
        let _guard = ResetAtomicInjectorGuard;
        let dir = tempdir().unwrap();
        let (authority, destination, download_root) = test_downloads_destination(&dir);
        let mut state = AppState::default();
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = test_progress_app();

        // 1. download_to_destination caller with temporary-file install and injected target parent-sync failure
        let pgn_content: &'static [u8] = b"1. e4 c5 2. Nf3 d6";
        state.http_transport = mock_successful_transport(pgn_content);

        // Skip download staging (1) and reservation journal (2); fail target replacement parent sync (3)
        crate::infra::fs::set_test_atomic_file_injector(Some(Arc::new(TargetParentSyncFault {
            skip: std::sync::atomic::AtomicUsize::new(2),
        })));

        let job_id = uuid::Uuid::new_v4().to_string();
        let result = download_to_destination(
            "progress_download_override",
            "https://example.com/games.pgn",
            destination.clone(),
            "games.pgn".into(),
            app.handle(),
            &state,
            None,
            Some(pgn_content.len() as u32),
            job_id,
            true,
            None,
        )
        .await
        .unwrap()
        .expect("artifact publication");

        assert!(matches!(
            result.durability,
            crate::infra::path_authority::CommitDurability::DurabilityUncertain(
                crate::error::DurabilityStage::DownloadTargetReplacement
            )
        ));
        assert_eq!(
            std::fs::read(download_root.join("games.pgn")).unwrap(),
            pgn_content
        );
        {
            let auth = state.pgn_path_authority.lock().unwrap();
            assert!(auth
                .as_ref()
                .unwrap()
                .has_persistent_id(&result.handle.id.id));
        }

        // 2. install_staged_pgn_artifact caller with actual temporary file and injected target parent-sync failure
        // Skip reservation journal (1); fail target replacement parent sync (2)
        crate::infra::fs::set_test_atomic_file_injector(Some(Arc::new(TargetParentSyncFault {
            skip: std::sync::atomic::AtomicUsize::new(1),
        })));

        let staged_content = b"1. d4 Nf6 2. c4 g6";
        let mut staged_file = tempfile::NamedTempFile::new().unwrap();
        staged_file.write_all(staged_content).unwrap();

        let staged_result = install_staged_pgn_artifact(
            destination.clone(),
            "staged_games.pgn".into(),
            staged_file,
            &state,
            &CancellationToken::new(),
        )
        .await
        .unwrap();

        assert!(matches!(
            staged_result.durability,
            crate::infra::path_authority::CommitDurability::DurabilityUncertain(
                crate::error::DurabilityStage::DownloadTargetReplacement
            )
        ));
        assert_eq!(
            std::fs::read(download_root.join("staged_games.pgn")).unwrap(),
            staged_content
        );
        {
            let auth = state.pgn_path_authority.lock().unwrap();
            assert!(auth
                .as_ref()
                .unwrap()
                .has_persistent_id(&staged_result.handle.id.id));
        }
    }

    #[tokio::test]
    async fn staged_artifact_cancels_at_real_install_precommit_without_publication() {
        let _guard = ResetAtomicInjectorGuard;
        let dir = tempdir().unwrap();
        let (authority, destination, download_root) = test_downloads_destination(&dir);
        let state = AppState::default();
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let state = Arc::new(state);
        let target = download_root.join("held-install.pgn");
        std::fs::write(&target, b"previous").unwrap();
        let mut staged = tempfile::NamedTempFile::new().unwrap();
        staged.write_all(b"replacement").unwrap();
        let cancellation = CancellationToken::new();
        let task_cancellation = cancellation.clone();
        let (entered_tx, entered_rx) = tokio::sync::oneshot::channel();
        let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);
        crate::infra::fs::set_test_atomic_file_injector(Some(Arc::new(HoldSecondPrecommit {
            seen: std::sync::atomic::AtomicUsize::new(0),
            entered: std::sync::Mutex::new(Some(entered_tx)),
            release: std::sync::Mutex::new(release_rx),
        })));
        let task_state = Arc::clone(&state);
        let task = tokio::spawn(async move {
            install_staged_pgn_artifact(
                destination,
                "held-install.pgn".into(),
                staged,
                &task_state,
                &task_cancellation,
            )
            .await
        });
        tokio::time::timeout(Duration::from_secs(2), entered_rx)
            .await
            .unwrap()
            .unwrap();
        cancellation.cancel();
        release_tx.send(()).unwrap();
        assert!(matches!(task.await.unwrap(), Err(Error::Cancellation)));
        assert_eq!(std::fs::read(target).unwrap(), b"previous");
    }

    #[tokio::test]
    async fn staged_artifact_keeps_postrename_result_and_activation_after_late_cancellation() {
        let _guard = ResetAtomicInjectorGuard;
        let dir = tempdir().unwrap();
        let (authority, destination, download_root) = test_downloads_destination(&dir);
        let state = AppState::default();
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let cancellation = CancellationToken::new();
        crate::infra::fs::set_test_atomic_file_injector(Some(Arc::new(CancelSecondParentSync {
            seen: std::sync::atomic::AtomicUsize::new(0),
            cancellation: cancellation.clone(),
        })));
        let mut staged = tempfile::NamedTempFile::new().unwrap();
        staged.write_all(b"committed").unwrap();
        let artifact = install_staged_pgn_artifact(
            destination,
            "late-cancel.pgn".into(),
            staged,
            &state,
            &cancellation,
        )
        .await
        .unwrap();

        assert!(cancellation.is_cancelled());
        assert_eq!(
            std::fs::read(download_root.join("late-cancel.pgn")).unwrap(),
            b"committed"
        );
        assert!(state
            .pgn_path_authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .has_persistent_id(&artifact.handle.id.id));
    }

    type ObserverAction =
        Box<dyn Fn(crate::infra::path_authority::ActivationObserverStage) + Send + Sync>;

    struct SharedActivationObserver {
        corrupt_target: Option<PathBuf>,
        action: Option<ObserverAction>,
    }

    impl crate::infra::path_authority::ActivationObserver for SharedActivationObserver {
        fn observe(&self, stage: crate::infra::path_authority::ActivationObserverStage) {
            if stage == crate::infra::path_authority::ActivationObserverStage::BeforeRead {
                if let Some(target) = &self.corrupt_target {
                    std::fs::write(target, b"corrupted payload bytes that do not match")
                        .expect("fs::write must succeed in test observer");
                }
            }
            if let Some(action) = &self.action {
                action(stage);
            }
        }
    }

    #[tokio::test]
    async fn download_verification_failure_records_failed_progress_and_quarantines_intent() {
        let dir = tempdir().unwrap();
        let (mut authority, destination, download_root) = test_downloads_destination(&dir);
        let target_file = download_root.join("games.pgn");

        let observer = Arc::new(SharedActivationObserver {
            corrupt_target: Some(target_file),
            action: None,
        });
        authority.set_activation_observer(Some(observer));

        let mut state = AppState::default();
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = test_progress_app();

        let pgn_content: &'static [u8] = b"1. e4 e5 2. Nf3 Nc6";
        state.http_transport = mock_successful_transport(pgn_content);

        let job_id = uuid::Uuid::new_v4().to_string();
        let err = download_to_destination(
            "progress_verify_fail",
            "https://example.com/games.pgn",
            destination,
            "games.pgn".into(),
            app.handle(),
            &state,
            None,
            Some(pgn_content.len() as u32),
            job_id,
            true,
            None,
        )
        .await
        .unwrap_err();

        assert!(matches!(err, Error::Conflict(_)));
        let progress_item = state
            .progress_state
            .get("progress_verify_fail")
            .unwrap()
            .unwrap();
        assert_eq!(progress_item.state, ProgressState::Failed);
        assert!(progress_item.finished);

        let mut auth = state.pgn_path_authority.lock().unwrap();
        let auth = auth.as_mut().unwrap();
        assert_eq!(auth.descriptors().len(), 1);
        assert!(auth.has_pending_artifact_filename(Path::new("games.pgn")));
    }

    #[tokio::test]
    async fn download_verification_failure_primary_error_survives_stale_or_cleared_lease() {
        let dir = tempdir().unwrap();
        let (mut authority, destination, download_root) = test_downloads_destination(&dir);
        let target_file = download_root.join("games.pgn");

        let mut state = AppState::default();
        let pgn_content: &'static [u8] = b"1. e4 e5 2. Nf3 Nc6";
        state.http_transport = mock_successful_transport(pgn_content);
        let state = Arc::new(state);

        let progress_id = "progress_stale_verify".to_string();
        let action_progress_id = progress_id.clone();
        let state_weak = Arc::downgrade(&state);
        let observer = Arc::new(SharedActivationObserver {
            corrupt_target: Some(target_file),
            action: Some(Box::new(move |stage| {
                if stage == crate::infra::path_authority::ActivationObserverStage::BeforeRead {
                    let state = state_weak
                        .upgrade()
                        .expect("state_weak upgrade must succeed");
                    state.progress_state.clear(&action_progress_id).unwrap();
                }
            })),
        });
        authority.set_activation_observer(Some(observer));
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = test_progress_app();

        let job_id = uuid::Uuid::new_v4().to_string();
        let err = download_to_destination(
            "progress_stale_verify",
            "https://example.com/games.pgn",
            destination,
            "games.pgn".into(),
            app.handle(),
            &state,
            None,
            Some(pgn_content.len() as u32),
            job_id,
            true,
            None,
        )
        .await
        .unwrap_err();

        match &err {
            Error::Conflict(msg) => {
                assert_eq!(
                    msg,
                    "download artifact payload differs from its durable reservation"
                );
            }
            other => panic!("expected Error::Conflict with payload mismatch, got {other:?}"),
        }
        assert_eq!(err.category(), crate::error::ErrorCategory::Conflict);
        assert!(state
            .progress_state
            .get("progress_stale_verify")
            .unwrap()
            .is_none());
    }

    struct AuthorityUnsetTransport {
        state_weak: std::sync::Mutex<std::sync::Weak<AppState>>,
        payload: &'static [u8],
    }

    #[async_trait::async_trait]
    impl crate::infra::net::DownloadTransport for AuthorityUnsetTransport {
        async fn request(
            &self,
            _url: &str,
            _headers: HeaderMap,
        ) -> Result<DownloadResponse, Error> {
            let weak = self.state_weak.lock().unwrap().clone();
            let state = weak
                .upgrade()
                .expect("state must be alive during transport request");
            *state.pgn_path_authority.lock().unwrap() = None;
            Ok(mock_successful_response(self.payload))
        }
    }

    #[tokio::test]
    async fn download_authority_unavailable_after_transport_setup_records_failed_progress() {
        let dir = tempdir().unwrap();
        let (authority, destination, _) = test_downloads_destination(&dir);
        let mut state = AppState::default();
        let pgn_content: &'static [u8] = b"1. e4 e5 2. Nf3 Nc6";
        let transport = Arc::new(AuthorityUnsetTransport {
            state_weak: std::sync::Mutex::new(std::sync::Weak::new()),
            payload: pgn_content,
        });
        state.http_transport = transport.clone();
        let state = Arc::new(state);
        *transport.state_weak.lock().unwrap() = Arc::downgrade(&state);
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = test_progress_app();

        let job_id = uuid::Uuid::new_v4().to_string();
        let progress_id = "progress_authority_unavailable";
        let err = download_to_destination(
            progress_id,
            "https://example.com/games.pgn",
            destination,
            "games.pgn".into(),
            app.handle(),
            &state,
            None,
            Some(pgn_content.len() as u32),
            job_id,
            true,
            None,
        )
        .await
        .unwrap_err();

        assert!(matches!(err, Error::Conflict(_)));
        assert_eq!(err.category(), crate::error::ErrorCategory::Conflict);
        let progress_item = state.progress_state.get(progress_id).unwrap().unwrap();
        assert_eq!(progress_item.state, ProgressState::Failed);
        assert!(progress_item.finished);
    }

    async fn run_post_verification_lease_case(
        replace_with_new_lease: bool,
    ) -> (
        Option<crate::progress::ProgressItem>,
        crate::infra::path_authority::ArtifactPublication,
    ) {
        let dir = tempdir().unwrap();
        let (mut authority, destination, download_root) = test_downloads_destination(&dir);

        let mut state = AppState::default();
        let pgn_content: &'static [u8] = b"1. e4 e5 2. Nf3 Nc6";
        state.http_transport = mock_successful_transport(pgn_content);
        let state = Arc::new(state);

        let progress_id = "progress_post_verify";
        let action_progress_id = progress_id.to_string();
        let state_weak = Arc::downgrade(&state);
        let observer = Arc::new(SharedActivationObserver {
            corrupt_target: None,
            action: Some(Box::new(move |stage| {
                if stage == crate::infra::path_authority::ActivationObserverStage::PostVerification
                {
                    let state = state_weak
                        .upgrade()
                        .expect("state_weak upgrade must succeed");
                    if replace_with_new_lease {
                        state
                            .progress_state
                            .start(action_progress_id.clone())
                            .unwrap();
                    } else {
                        state.progress_state.clear(&action_progress_id).unwrap();
                    }
                }
            })),
        });
        authority.set_activation_observer(Some(observer));
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = test_progress_app();

        let job_id = uuid::Uuid::new_v4().to_string();
        let publication = download_to_destination(
            progress_id,
            "https://example.com/games.pgn",
            destination,
            "games.pgn".into(),
            app.handle(),
            &state,
            None,
            Some(pgn_content.len() as u32),
            job_id,
            true,
            None,
        )
        .await
        .expect("download must succeed despite stale terminal progress")
        .expect("registered pgn artifact publication must be present");

        {
            let mut auth = state.pgn_path_authority.lock().unwrap();
            let auth = auth.as_mut().unwrap();
            assert!(auth
                .resolve(
                    publication.handle.path_ref(),
                    crate::infra::path_authority::PathOperation::ReadPgn,
                    &[]
                )
                .is_ok());
            assert!(auth.has_persistent_id(&publication.handle.id.id));
        }

        assert_eq!(
            std::fs::read(download_root.join("games.pgn")).unwrap(),
            pgn_content
        );

        let item = state.progress_state.get(progress_id).unwrap();
        (item, publication)
    }

    #[tokio::test]
    async fn download_post_verification_stale_or_replaced_lease_preserves_published_artifact() {
        // Case 1: Replaced lease leaves replacement progress Running and preserves published capability
        let (item, publication) = run_post_verification_lease_case(true).await;
        assert_eq!(
            publication.durability,
            crate::infra::path_authority::CommitDurability::Durable
        );
        let item = item.expect("replacement progress must exist");
        assert_eq!(item.state, ProgressState::Running);
        assert!(!item.finished);
        assert_eq!(item.generation, 2);

        // Case 2: Cleared lease preserves published capability and leaves progress cleared
        let (item, publication) = run_post_verification_lease_case(false).await;
        assert_eq!(
            publication.durability,
            crate::infra::path_authority::CommitDurability::Durable
        );
        assert!(item.is_none());
    }

    struct CancellingTransport {
        job_id: String,
        progress_id: String,
        state_weak: std::sync::Mutex<std::sync::Weak<AppState>>,
        advance_generation: bool,
    }

    #[async_trait::async_trait]
    impl crate::infra::net::DownloadTransport for CancellingTransport {
        async fn request(
            &self,
            _url: &str,
            _headers: HeaderMap,
        ) -> Result<DownloadResponse, Error> {
            let weak = self.state_weak.lock().unwrap().clone();
            let state = weak
                .upgrade()
                .expect("state must be alive during transport request");
            let _ = state
                .download_registry
                .cancel(&state.operations, &self.job_id);
            if self.advance_generation {
                state
                    .progress_state
                    .start(self.progress_id.clone())
                    .unwrap();
            }
            Err(Error::Cancellation)
        }
    }

    async fn run_cancellation_lease_case(
        advance_generation: bool,
    ) -> (crate::progress::ProgressItem, Error) {
        let dir = tempdir().unwrap();
        let (authority, destination, _) = test_downloads_destination(&dir);
        let mut state = AppState::default();
        let job_id = uuid::Uuid::new_v4().to_string();
        let progress_id = "progress_cancel";
        let transport = Arc::new(CancellingTransport {
            job_id: job_id.clone(),
            progress_id: progress_id.into(),
            state_weak: std::sync::Mutex::new(std::sync::Weak::new()),
            advance_generation,
        });
        state.http_transport = transport.clone();
        let state = Arc::new(state);
        *transport.state_weak.lock().unwrap() = Arc::downgrade(&state);
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = test_progress_app();

        let err = download_to_destination(
            progress_id,
            "https://example.com/games.pgn",
            destination,
            "games.pgn".into(),
            app.handle(),
            &state,
            None,
            None,
            job_id,
            true,
            None,
        )
        .await
        .unwrap_err();

        let item = state.progress_state.get(progress_id).unwrap().unwrap();
        (item, err)
    }

    #[tokio::test]
    async fn download_cancellation_reporting_with_valid_and_stale_lease() {
        // Case 1: Valid lease cancellation transitions to Cancelled terminal state
        let (valid_item, valid_err) = run_cancellation_lease_case(false).await;
        assert!(matches!(valid_err, Error::Cancellation));
        assert_eq!(valid_item.state, ProgressState::Cancelled);
        assert!(valid_item.finished);

        // Case 2: Stale lease leaves replacement progress Running and returns original Error::Cancellation
        let (stale_item, stale_err) = run_cancellation_lease_case(true).await;
        assert!(matches!(stale_err, Error::Cancellation));
        assert_eq!(stale_item.state, ProgressState::Running);
        assert!(!stale_item.finished);
        assert_eq!(stale_item.progress, 0.0);
        assert_eq!(stale_item.generation, 2);
    }

    struct HeldTailTransport {
        started: std::sync::Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
        release: tokio::sync::Notify,
    }

    struct ReleaseHeldTransport(Arc<HeldTailTransport>);

    impl Drop for ReleaseHeldTransport {
        fn drop(&mut self) {
            self.0.release.notify_waiters();
        }
    }

    #[async_trait::async_trait]
    impl crate::infra::net::DownloadTransport for HeldTailTransport {
        async fn request(
            &self,
            _url: &str,
            _headers: HeaderMap,
        ) -> Result<DownloadResponse, Error> {
            if let Some(started) = self.started.lock().unwrap().take() {
                let _ = started.send(());
            }
            self.release.notified().await;
            Ok(mock_successful_response(b"caller-drop-tail"))
        }
    }

    #[tokio::test]
    async fn production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop() {
        for publication_fail in [false, true] {
            let dir = tempdir().unwrap();
            let (authority, destination, download_root) = test_downloads_destination(&dir);
            let (started_tx, started_rx) = tokio::sync::oneshot::channel();
            let transport = Arc::new(HeldTailTransport {
                started: std::sync::Mutex::new(Some(started_tx)),
                release: tokio::sync::Notify::new(),
            });
            let _release_on_drop = ReleaseHeldTransport(transport.clone());
            let mut state = AppState::default();
            state.http_transport = transport.clone();
            *state.pgn_path_authority.lock().unwrap() = Some(authority);
            let state = Arc::new(state);
            let app = test_progress_app();
            let app_handle = app.handle().clone();
            let owned_state = Arc::clone(&state);
            let job_id = uuid::Uuid::new_v4().to_string();
            let progress_id = format!("caller-drop-{publication_fail}");
            let filename = format!("caller-drop-{publication_fail}.bin");
            let task_progress = progress_id.clone();
            let task_filename = filename.clone();
            let operation = tokio::spawn(async move {
                download_to_destination(
                    &task_progress,
                    "https://example.com/held.bin",
                    destination,
                    task_filename,
                    &app_handle,
                    &owned_state,
                    None,
                    None,
                    job_id,
                    true,
                    None,
                )
                .await
            });

            tokio::time::timeout(Duration::from_secs(1), started_rx)
                .await
                .unwrap()
                .unwrap();
            operation.abort();
            if publication_fail {
                *state.pgn_path_authority.lock().unwrap() = None;
            }
            transport.release.notify_one();
            tokio::time::timeout(Duration::from_secs(2), async {
                while !state.operations.outstanding_labels().unwrap().is_empty() {
                    tokio::task::yield_now().await;
                }
            })
            .await
            .unwrap();

            let item = state.progress_state.get(&progress_id).unwrap().unwrap();
            if publication_fail {
                assert_eq!(item.state, ProgressState::Failed);
                assert!(!download_root.join(filename).exists());
            } else {
                assert_eq!(item.state, ProgressState::Succeeded);
                assert_eq!(
                    std::fs::read(download_root.join(filename)).unwrap(),
                    b"caller-drop-tail"
                );
            }
        }
    }
}
