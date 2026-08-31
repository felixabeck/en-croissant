use std::{
    collections::HashMap,
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
use crate::progress::{begin_progress, update_progress_with_state, ProgressState};
use crate::AppState;

const MAX_ACTIVE_DOWNLOADS: usize = 32;
const DOWNLOAD_DEADLINE: Duration = Duration::from_secs(60 * 60);
const ARTIFACT_MANIFEST_PUBLIC_KEY: &str =
    "RWSF3PMxhuaQf7613UytN4bdF7FQyBymLJVDIG3OE8xNa+0fcs6KE6/J";

fn download_target_durability(
    outcome: crate::infra::fs::AtomicFileOutcome,
) -> Option<crate::infra::path_authority::CommitDurability> {
    match outcome {
        crate::infra::fs::AtomicFileOutcome::DurableCommit => None,
        crate::infra::fs::AtomicFileOutcome::CommittedDurabilityUncertain(error) => {
            log::warn!("download target replacement parent sync failed: {error}");
            Some(
                crate::infra::path_authority::CommitDurability::DurabilityUncertain(
                    crate::error::DurabilityStage::DownloadTargetReplacement,
                ),
            )
        }
    }
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
pub struct DownloadRegistry {
    active: Mutex<HashMap<String, CancellationToken>>,
}

pub struct DownloadLease {
    registry: Arc<DownloadRegistry>,
    id: String,
    token: CancellationToken,
}

impl DownloadRegistry {
    pub fn begin(self: &Arc<Self>, id: &str) -> Result<DownloadLease, Error> {
        let mut active = self.active.lock().expect("download registry poisoned");
        if active.contains_key(id) {
            return Err(Error::Conflict(
                "download operation is already active".into(),
            ));
        }
        if active.len() >= MAX_ACTIVE_DOWNLOADS {
            return Err(Error::ResourceLimit("too many active downloads".into()));
        }
        let token = CancellationToken::new();
        active.insert(id.to_owned(), token.clone());
        Ok(DownloadLease {
            registry: Arc::clone(self),
            id: id.to_owned(),
            token,
        })
    }

    pub fn cancel(&self, id: &str) -> bool {
        let active = self.active.lock().expect("download registry poisoned");
        let Some(token) = active.get(id) else {
            return false;
        };
        token.cancel();
        true
    }
}

impl DownloadLease {
    pub(crate) fn cancellation_token(&self) -> CancellationToken {
        self.token.clone()
    }
}

impl Drop for DownloadLease {
    fn drop(&mut self) {
        let mut active = self
            .registry
            .active
            .lock()
            .expect("download registry poisoned");
        if active
            .get(&self.id)
            .is_some_and(|registered| registered == &self.token)
        {
            active.remove(&self.id);
        }
    }
}

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
    fn from_id(id: &str) -> Result<Self, Error> {
        if id.starts_with("lichess_") {
            Ok(Self::Lichess)
        } else if id.starts_with("engine_") {
            Ok(Self::Engine)
        } else if id.starts_with("db_") {
            Ok(Self::Db)
        } else if id.starts_with("puzzle_db_") {
            Ok(Self::PuzzleDb)
        } else {
            Err(Error::InvalidInput("Unknown operation class".into()))
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
    id: &str,
    url: &str,
    integrity: Option<&ArtifactIntegrity>,
) -> Result<(), Error> {
    let required = matches!(
        OpClass::from_id(id)?,
        OpClass::Engine | OpClass::Db | OpClass::PuzzleDb
    );
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
    id: &str,
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
        id,
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
    id: &str,
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
        id,
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
    id: &str,
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
    let op = OpClass::from_id(id)?;

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
                    extract_zip(file, &path, limits)?;
                } else if is_tar {
                    extract_tar(file, &path, limits)?;
                } else {
                    extract_gz(file, &path, limits)?;
                }
            } else {
                let target_dir = path.parent().unwrap_or_else(|| Path::new("."));
                std::fs::create_dir_all(target_dir)?;
                match atomic_replace(&path, |target_file| {
                    std::io::copy(&mut file, target_file)?;
                    Ok(())
                })? {
                    crate::infra::fs::AtomicFileOutcome::DurableCommit => {}
                    crate::infra::fs::AtomicFileOutcome::CommittedDurabilityUncertain(e) => {
                        log::warn!("archive file replacement parent sync failed: {e}");
                        return Err(Error::CommittedDurabilityUncertain(
                            crate::error::DurabilityStage::ArchiveFileReplacement,
                        ));
                    }
                }
            }
            if cancellation.is_cancelled() {
                return Err(Error::Cancellation);
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

#[allow(clippy::too_many_arguments)]
pub(crate) async fn download_to_destination(
    id: &str,
    url: &str,
    destination: crate::infra::path_authority::PathRef,
    filename: String,
    app: &tauri::AppHandle,
    state: &AppState,
    bearer_token: Option<&str>,
    total_size: Option<u32>,
    job_id: String,
    register_pgn_artifact: bool,
    integrity: Option<&ArtifactIntegrity>,
) -> Result<Option<crate::infra::path_authority::ArtifactPublication>, Error> {
    // Validate and reserve all fallible producer prerequisites before starting
    // visible progress. No failed setup may leave a running progress entry.
    uuid::Uuid::parse_str(&job_id)
        .map_err(|_| Error::InvalidInput("download job ID must be a UUID".into()))?;
    validate_artifact_integrity(id, url, integrity)?;
    let lease = state.download_registry.begin(&job_id)?;
    let staged = tempfile::tempdir().map_err(|error| Error::Io(Box::new(error)))?;
    let staged_file = staged.path().join("payload");
    let filename = std::ffi::OsString::from(filename);
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
    let progress_lease = begin_progress(&state.progress_state, app, id.to_owned())?;
    let result = match tokio::time::timeout(
        DOWNLOAD_DEADLINE,
        download_file_core_control_with_integrity(
            id,
            url,
            &staged_file,
            state.http_transport.as_ref(),
            bearer_token,
            total_size,
            lease.cancellation_token(),
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
            update_progress_with_state(
                &state.progress_state,
                app,
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
        update_progress_with_state(&state.progress_state, app, &progress_lease, 0.0, terminal)?;
        return Err(error);
    }

    let reservation = if register_pgn_artifact {
        let reservation = state
            .pgn_path_authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
            .reserve_download_artifact(
                &destination,
                filename.clone(),
                &staged_file,
                filename.to_string_lossy().into_owned(),
                vec![crate::infra::path_authority::PathOperation::ReadPgn],
            );
        match reservation {
            Ok(reservation) => Some(reservation),
            Err(error) => {
                update_progress_with_state(
                    &state.progress_state,
                    app,
                    &progress_lease,
                    0.0,
                    ProgressState::Failed,
                )?;
                return Err(error);
            }
        }
    } else {
        None
    };
    let install_reservation = reservation.clone();
    let install_result = crate::infra::blocking::BLOCKING_GATEWAY
        .spawn(move || match install_reservation.as_ref() {
            Some(reservation) => resolved
                .atomic_install_reserved_download(reservation, &staged_file)
                .map(|installed| {
                    (
                        installed.outcome,
                        Some((installed.identity, installed.ctime_nanos)),
                    )
                }),
            None => {
                let mut staged = std::fs::File::open(staged_file)?;
                resolved
                    .atomic_replace_download(|target| {
                        std::io::copy(&mut staged, target)?;
                        Ok(())
                    })
                    .map(|outcome| (outcome, None))
            }
        })
        .await;
    let (target_durability, installed_identity) = match install_result {
        Ok(outcome) => outcome,
        Err(error) => {
            if let Some(reservation) = reservation.as_ref() {
                if let Ok(mut authority) = state.pgn_path_authority.lock() {
                    if let Some(authority) = authority.as_mut() {
                        authority.abandon_download_artifact(reservation);
                    }
                }
            }
            update_progress_with_state(
                &state.progress_state,
                app,
                &progress_lease,
                0.0,
                ProgressState::Failed,
            )?;
            return Err(error);
        }
    };
    let artifact = if let Some(reservation) = reservation.as_ref() {
        let Some((installed_identity, installed_ctime_nanos)) = installed_identity else {
            let error = Error::Conflict("artifact install has no inode marker".into());
            update_progress_with_state(
                &state.progress_state,
                app,
                &progress_lease,
                0.0,
                ProgressState::Failed,
            )?;
            return Err(error);
        };
        let marker = state
            .pgn_path_authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
            .mark_download_artifact_committed(
                reservation,
                installed_identity,
                installed_ctime_nanos,
            );
        if let Err(error) = marker {
            update_progress_with_state(
                &state.progress_state,
                app,
                &progress_lease,
                0.0,
                ProgressState::Failed,
            )?;
            return Err(error);
        }
        match state
            .pgn_path_authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
            .activate_download_artifact(reservation)
        {
            Ok(mut artifact) => {
                if let Some(durability) = download_target_durability(target_durability) {
                    artifact.durability = durability;
                }
                Some(artifact)
            }
            Err(error) => {
                update_progress_with_state(
                    &state.progress_state,
                    app,
                    &progress_lease,
                    0.0,
                    ProgressState::Failed,
                )?;
                return Err(error);
            }
        }
    } else {
        None
    };
    update_progress_with_state(
        &state.progress_state,
        app,
        &progress_lease,
        100.0,
        ProgressState::Succeeded,
    )?;
    Ok(artifact)
}

/// Installs a fully validated native-provider PGN staging file as one atomic artifact.
/// Callers may parse/concatenate many pages privately, but no partial file becomes visible.
pub(crate) async fn install_staged_pgn_artifact(
    destination: crate::infra::path_authority::PathRef,
    filename: String,
    staged: tempfile::NamedTempFile,
    state: &AppState,
) -> Result<crate::infra::path_authority::ArtifactPublication, Error> {
    let filename = std::ffi::OsString::from(filename);
    let reservation = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .reserve_download_artifact(
            &destination,
            filename.clone(),
            staged.path(),
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
        .spawn(move || {
            resolved.atomic_install_reserved_download(&installation_reservation, staged.path())
        })
        .await;
    let target_durability = match install {
        Ok(installed) => installed,
        Err(error) => {
            if let Ok(mut authority) = state.pgn_path_authority.lock() {
                if let Some(authority) = authority.as_mut() {
                    authority.abandon_download_artifact(&reservation);
                }
            }
            return Err(error);
        }
    };
    let mut authority = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    authority.mark_download_artifact_committed(
        &reservation,
        target_durability.identity,
        target_durability.ctime_nanos,
    )?;
    let mut artifact = authority.activate_download_artifact(&reservation)?;
    if let Some(durability) = download_target_durability(target_durability.outcome) {
        artifact.durability = durability;
    }
    Ok(artifact)
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
    let token = state
        .credentials
        .token(&handle)?
        .ok_or_else(|| Error::OAuthFailure("authenticated Lichess account unavailable".into()))?;
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
            if since_ms < 0 {
                return Err(Error::InvalidInput(
                    "invalid Lichess export timestamp".into(),
                ));
            }
            query.append_pair("since", &since_ms.to_string());
        }
    }
    download_to_destination(
        &format!("lichess_{player}"),
        url.as_str(),
        destination,
        filename,
        &app,
        state.inner(),
        Some(&token),
        estimated_size,
        job_id,
        true,
        None,
    )
    .await?
    .ok_or_else(|| Error::Conflict("Lichess download did not register an artifact".into()))
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
    if !id.starts_with("engine_") {
        return Err(Error::InvalidInput("engine archive ID required".into()));
    }
    uuid::Uuid::parse_str(&job_id)
        .map_err(|_| Error::InvalidInput("download job ID must be a UUID".into()))?;
    validate_artifact_integrity(&id, &url, Some(&integrity))?;
    let lease = state.download_registry.begin(&job_id)?;
    let staging = tempfile::tempdir().map_err(|error| Error::Io(Box::new(error)))?;
    let extracted = staging.path().join("extracted");
    let resolved = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(
            &destination,
            crate::infra::path_authority::PathOperation::DownloadArchive,
            &[std::ffi::OsString::from(directory_name)],
        )?;
    let progress_lease = begin_progress(&state.progress_state, &app, id.clone())?;
    let result = match tokio::time::timeout(
        DOWNLOAD_DEADLINE,
        download_file_core_control_with_integrity(
            &id,
            &url,
            &extracted,
            state.http_transport.as_ref(),
            None,
            None,
            lease.cancellation_token(),
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
            let error = Error::EngineTimeout("engine archive download deadline exceeded".into());
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
        update_progress_with_state(&state.progress_state, &app, &progress_lease, 0.0, terminal)?;
        return Err(error);
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

#[tauri::command]
#[specta::specta]
pub async fn cancel_download(id: String, state: tauri::State<'_, AppState>) -> Result<bool, Error> {
    Ok(state.download_registry.cancel(&id))
}

fn validate_archive_path(path: &str) -> Result<PathBuf, Error> {
    if path.is_empty() || path.len() > 1024 {
        return Err(Error::InvalidInput("Invalid path length".into()));
    }
    let p = Path::new(path);
    if p.is_absolute() {
        return Err(Error::InvalidInput("Absolute path in archive".into()));
    }
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
                let s = n.to_string_lossy();
                if s.contains('\0') {
                    return Err(Error::InvalidInput("Null byte in path".into()));
                }
            }
            std::path::Component::CurDir => {}
        }
    }
    Ok(p.to_path_buf())
}

fn extract_zip(
    file: std::fs::File,
    target_path: &Path,
    limits: ArchiveLimits,
) -> Result<(), Error> {
    let target_dir = target_path.parent().unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(target_dir)?;
    let temp_dir = tempfile::Builder::new()
        .prefix(".zip")
        .tempdir_in(target_dir)
        .map_err(|e| Error::Io(Box::new(e)))?;

    let mut archive = zip::ZipArchive::new(file).map_err(|e| Error::InvalidInput(e.to_string()))?;

    let mut total_expanded = 0u64;
    if archive.len() > limits.entries {
        return Err(Error::ResourceLimit("Too many entries in zip".into()));
    }

    for i in 0..archive.len() {
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
            std::fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                std::fs::create_dir_all(p)?;
            }
            let mut outfile = private_output_file(&outpath)?;
            bounded_copy(
                &mut file,
                &mut outfile,
                size,
                &mut total_expanded,
                limits.expanded,
            )?;
        }
    }

    crate::infra::fs::atomic_install_dir(temp_dir.path(), target_path)?;
    Ok(())
}

fn extract_tar(
    file: std::fs::File,
    target_path: &Path,
    limits: ArchiveLimits,
) -> Result<(), Error> {
    let target_dir = target_path.parent().unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(target_dir)?;
    let temp_dir = tempfile::Builder::new()
        .prefix(".tar")
        .tempdir_in(target_dir)
        .map_err(|e| Error::Io(Box::new(e)))?;

    let mut archive = tar::Archive::new(file);
    let mut entry_count = 0;
    let mut total_expanded = 0u64;

    for entry in archive.entries()? {
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
            std::fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                std::fs::create_dir_all(p)?;
            }
            let mut outfile = private_output_file(&outpath)?;
            bounded_copy(
                &mut entry,
                &mut outfile,
                size,
                &mut total_expanded,
                limits.expanded,
            )?;
        }
    }

    crate::infra::fs::atomic_install_dir(temp_dir.path(), target_path)?;
    Ok(())
}

fn extract_gz(file: std::fs::File, target_path: &Path, limits: ArchiveLimits) -> Result<(), Error> {
    let target_dir = target_path.parent().unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(target_dir)?;

    match atomic_replace(target_path, |target_file| {
        let mut decoder = flate2::read::GzDecoder::new(file);
        let compressed = decoder.get_ref().metadata()?.len();
        let mut total_expanded = 0;
        bounded_copy(
            &mut decoder,
            target_file,
            limits.per_entry,
            &mut total_expanded,
            limits.expanded,
        )?;
        let expanded = target_file.metadata()?.len();
        if compressed == 0 || expanded > compressed.saturating_mul(limits.ratio) {
            return Err(Error::ResourceLimit(
                "High gzip compression ratio detected".into(),
            ));
        }
        Ok(())
    })? {
        crate::infra::fs::AtomicFileOutcome::DurableCommit => {}
        crate::infra::fs::AtomicFileOutcome::CommittedDurabilityUncertain(e) => {
            log::warn!("gzip file replacement parent sync failed: {e}");
            return Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::GzipFileReplacement,
            ));
        }
    }
    Ok(())
}

fn bounded_copy(
    input: &mut impl Read,
    output: &mut impl Write,
    per_entry_limit: u64,
    total_expanded: &mut u64,
    total_limit: u64,
) -> Result<u64, Error> {
    let mut buffer = [0u8; 64 * 1024];
    let mut written = 0u64;
    loop {
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
    let mut authority = state
        .pgn_path_authority
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
    Ok(state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(
            &file,
            crate::infra::path_authority::PathOperation::EngineInstall,
            &[],
        )
        .is_ok())
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
    let resolved = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(
            &file,
            crate::infra::path_authority::PathOperation::EngineInstall,
            &[],
        )?;
    Ok(FileMetadata {
        last_modified: resolved.modified_seconds()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

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
        let first = registry.begin("job").unwrap();
        assert!(registry.begin("job").is_err());
        assert!(registry.cancel("job"));
        assert!(first.token.is_cancelled());
        drop(first);
        assert!(!registry.cancel("job"));
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
            "lichess_test",
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
            "lichess_test",
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
            "lichess_test",
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
            "lichess_test",
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

    #[test]
    fn database_and_engine_artifacts_require_a_signed_manifest() {
        for id in ["db_1", "engine_1"] {
            let error = validate_artifact_integrity(id, "https://www.encroissant.org/file", None)
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
        let missing = validate_artifact_integrity("puzzle_db_1", url, None).unwrap_err();
        assert_eq!(
            missing.to_string(),
            "Invalid input: signed artifact integrity metadata required"
        );

        let invalid = ArtifactIntegrity {
            sha256: "a".repeat(64),
            signature: "invalid minisign signature".into(),
        };
        let invalid_signature =
            validate_artifact_integrity("puzzle_db_1", url, Some(&invalid)).unwrap_err();
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
            "engine_1",
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
            "db_1",
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
            "lichess_test",
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
            "lichess_test",
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
}
