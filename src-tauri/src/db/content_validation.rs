use std::{
    collections::{HashMap, HashSet},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, Instant},
};

use diesel::{connection::SimpleConnection, Connection, SqliteConnection};
use once_cell::sync::Lazy;
use parking_lot::{Condvar, Mutex};
use serde::{Deserialize, Serialize};
use tauri_specta::Event as _;
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

use super::{
    bound_sqlite::{BoundDatabase, SqliteMode},
    cancellation_check, migrations,
    search_index::integrity_stamp_leaf,
    DatabaseContentFailure, DatabaseIdentity, DatabaseRepository,
};
use crate::{
    error::Error,
    infra::{
        blocking::BLOCKING_GATEWAY,
        fs::{
            atomic_replace_at_with_precommit, open_regular_at, require_durable, RegularFileAccess,
        },
        operations::{run_native_operation, OperationRegistry},
        path_authority::{DatabaseFileTarget, DatabaseHandle, PathAuthority, PathOperation},
    },
};

// Scans wait here before acquiring a gateway permit, leaving three permits for ordinary work.
static SCAN_SLOT: Lazy<Semaphore> = Lazy::new(|| Semaphore::new(1));
// Matches the authority registry's maximum number of distinct capability ids.
const MAX_CONTENT_ENTRIES: usize = 4096;
const VERSION: u8 = 1;
const MAX_STAMP_BYTES: usize = 4096;
const DELETE_WAIT_TIMEOUT: Duration = Duration::from_secs(60);
const DELETE_CANCELLATION_POLL: Duration = Duration::from_millis(25);

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
enum Verdict {
    Passed,
    IntegrityFailure,
    ForeignKeyFailure,
}

impl Verdict {
    fn message(&self) -> Option<&'static str> {
        match self {
            Self::Passed => None,
            Self::IntegrityFailure => Some("SQLite integrity_check failed"),
            Self::ForeignKeyFailure => Some("SQLite foreign_key_check failed"),
        }
    }
    fn from_result(result: Result<(), Error>) -> Result<Self, Error> {
        match result {
            Ok(()) => Ok(Self::Passed),
            Err(Error::InvalidInput(message)) if message == "SQLite integrity_check failed" => {
                Ok(Self::IntegrityFailure)
            }
            Err(Error::InvalidInput(message)) if message == "SQLite foreign_key_check failed" => {
                Ok(Self::ForeignKeyFailure)
            }
            Err(error) => Err(error),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct Stamp {
    version: u8,
    identity: DatabaseIdentity,
    verdict: Verdict,
}

struct Failure {
    identity: DatabaseIdentity,
    verdict: Verdict,
    pending: bool,
}
struct Scan {
    identity: DatabaseIdentity,
    token: CancellationToken,
}
#[derive(Default)]
struct State {
    failures: HashMap<PathBuf, Failure>,
    scans: HashMap<PathBuf, Vec<Scan>>,
    deleting: HashSet<PathBuf>,
}

#[derive(Default)]
pub(super) struct ContentValidationState {
    state: Mutex<State>,
    changed: Condvar,
}

fn read_stamp(target: &DatabaseFileTarget) -> Result<Option<Stamp>, Error> {
    let file = match open_regular_at(
        target.parent(),
        &integrity_stamp_leaf(target.leaf()),
        RegularFileAccess::ReadOnly,
    ) {
        Ok(file) => file,
        Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    let mut bytes = Vec::new();
    file.take((MAX_STAMP_BYTES + 1) as u64)
        .read_to_end(&mut bytes)?;
    if bytes.len() > MAX_STAMP_BYTES {
        return Ok(None);
    }
    Ok(serde_json::from_slice::<Stamp>(&bytes)
        .ok()
        .filter(|stamp| stamp.version == VERSION))
}

fn write_stamp(
    repository: &DatabaseRepository,
    target: &DatabaseFileTarget,
    identity: &DatabaseIdentity,
    verdict: &Verdict,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let stamp = Stamp {
        version: VERSION,
        identity: identity.clone(),
        verdict: verdict.clone(),
    };
    let bytes = serde_json::to_vec(&stamp).map_err(std::io::Error::other)?;
    let outcome = atomic_replace_at_with_precommit(
        target.parent(),
        &integrity_stamp_leaf(target.leaf()),
        || {
            cancellation_check(cancellation)?;
            if repository.database_identity_expected(target, identity.object, Some(cancellation))?
                != *identity
            {
                return Err(Error::Conflict(
                    "database changed after capability resolution".into(),
                ));
            }
            cancellation_check(cancellation)
        },
        |file| {
            file.write_all(&bytes)?;
            Ok(())
        },
    )?;
    require_durable(
        outcome,
        crate::error::DurabilityStage::WorkspaceSidecarReplacement,
    )
}

pub(super) fn write_passed_stamp(
    repository: &DatabaseRepository,
    target: &DatabaseFileTarget,
    identity: &DatabaseIdentity,
) -> Result<(), Error> {
    let mut state = repository.content_validation.state.lock();
    write_stamp(
        repository,
        target,
        identity,
        &Verdict::Passed,
        &CancellationToken::new(),
    )?;
    state.failures.remove(target.path());
    Ok(())
}

/// A committed create or migration remains successful if its optional stamp
/// cannot be published. The missing stamp will make the next metadata read scan.
pub(super) fn publish_passed_stamp(
    repository: &DatabaseRepository,
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    file: &DatabaseHandle,
    identity: &DatabaseIdentity,
) {
    if let Err(error) = mutate_target(authority, file)
        .and_then(|target| write_passed_stamp(repository, &target, identity))
    {
        log::warn!(
            "passed content validation stamp publication failed: {}",
            error.diagnostic()
        );
    }
}

pub(super) fn publish_committed_pass(
    repository: &DatabaseRepository,
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    file: &DatabaseHandle,
    target: &DatabaseFileTarget,
) {
    match repository.database_identity(target) {
        Ok(identity) => publish_passed_stamp(repository, authority, file, &identity),
        Err(error) => log::warn!(
            "passed content validation identity lookup failed: {}",
            error.diagnostic()
        ),
    }
}

fn mutate_target(
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    file: &DatabaseHandle,
) -> Result<DatabaseFileTarget, Error> {
    super::resolve_database(authority, file, PathOperation::DatabaseMutate)
}

/// Returns whether metadata must schedule a scan. A pending failed write is retried
/// once here; the verdict remains visible even if that retry also fails.
pub(super) fn inspect(
    repository: &DatabaseRepository,
    target: &DatabaseFileTarget,
    identity: &DatabaseIdentity,
    authority: &std::sync::Mutex<Option<PathAuthority>>,
    file: &DatabaseHandle,
) -> Result<bool, Error> {
    let mut state = repository.content_validation.state.lock();
    if state
        .failures
        .get(target.path())
        .is_some_and(|failure| failure.identity != *identity)
    {
        state.failures.remove(target.path());
    }
    let deleting = state.deleting.contains(target.path());
    if let Some(failure) = state.failures.get_mut(target.path()) {
        if failure.pending && !deleting {
            let result = mutate_target(authority, file).and_then(|target| {
                write_stamp(
                    repository,
                    &target,
                    identity,
                    &failure.verdict,
                    &CancellationToken::new(),
                )
            });
            if result.is_ok() {
                failure.pending = false;
            }
        }
        if let Some(message) = failure.verdict.message() {
            return Err(Error::InvalidInput(message.into()));
        }
    }
    match read_stamp(target) {
        Ok(Some(stamp)) if stamp.identity == *identity => {
            if let Some(message) = stamp.verdict.message() {
                if state.failures.len() < MAX_CONTENT_ENTRIES {
                    state.failures.insert(
                        target.path().to_path_buf(),
                        Failure {
                            identity: identity.clone(),
                            verdict: stamp.verdict,
                            pending: false,
                        },
                    );
                }
                return Err(Error::InvalidInput(message.into()));
            }
            Ok(false)
        }
        Ok(_) => Ok(true),
        Err(error) => {
            log::debug!(
                "content validation stamp lookup failed: {}",
                error.diagnostic()
            );
            Ok(true)
        }
    }
}

pub(super) struct DeletionGuard<'a> {
    validation: &'a ContentValidationState,
    path: PathBuf,
}

impl Drop for DeletionGuard<'_> {
    fn drop(&mut self) {
        self.validation.state.lock().deleting.remove(&self.path);
        self.validation.changed.notify_all();
    }
}

/// Refuses new scans, cancels this file's active and queued generations, and
/// waits for their query-only SQLite handles to close before Windows unlink.
pub(super) fn begin_delete<'a>(
    repository: &'a DatabaseRepository,
    path: &Path,
    cancellation: &CancellationToken,
) -> Result<DeletionGuard<'a>, Error> {
    let validation = &repository.content_validation;
    let mut state = validation.state.lock();
    if !state.deleting.insert(path.to_path_buf()) {
        return Err(Error::Conflict("database is being deleted".into()));
    }
    let guard = DeletionGuard {
        validation,
        path: path.to_path_buf(),
    };
    if let Some(scans) = state.scans.get(path) {
        for scan in scans {
            scan.token.cancel();
        }
    }
    let deadline = Instant::now() + DELETE_WAIT_TIMEOUT;
    while state.scans.contains_key(path) {
        if cancellation.is_cancelled() || Instant::now() >= deadline {
            drop(state);
            drop(guard);
            return Err(if cancellation.is_cancelled() {
                Error::Cancellation
            } else {
                Error::Conflict("database is being deleted".into())
            });
        }
        validation
            .changed
            .wait_for(&mut state, DELETE_CANCELLATION_POLL);
    }
    drop(state);
    Ok(guard)
}

pub(super) fn forget(repository: &DatabaseRepository, path: &Path) {
    repository
        .content_validation
        .state
        .lock()
        .failures
        .remove(path);
}

struct ScanGuard {
    repository: Arc<DatabaseRepository>,
    path: PathBuf,
    identity: DatabaseIdentity,
}
impl Drop for ScanGuard {
    fn drop(&mut self) {
        let mut state = self.repository.content_validation.state.lock();
        if let Some(scans) = state.scans.get_mut(&self.path) {
            scans.retain(|scan| scan.identity != self.identity);
            if scans.is_empty() {
                state.scans.remove(&self.path);
            }
        }
        self.repository.content_validation.changed.notify_all();
    }
}

pub(super) async fn schedule<R: tauri::Runtime>(
    repository: Arc<DatabaseRepository>,
    authority: Arc<std::sync::Mutex<Option<PathAuthority>>>,
    operations: &OperationRegistry,
    app: tauri::AppHandle<R>,
    file: DatabaseHandle,
    path: PathBuf,
    identity: DatabaseIdentity,
) {
    // Another metadata read may have observed a missing stamp before a scan
    // finished. Re-read outside the state lock before admitting another scan.
    let stamp_authority = Arc::clone(&authority);
    let stamp_file = file.clone();
    if BLOCKING_GATEWAY
        .spawn(move || {
            mutate_target(&stamp_authority, &stamp_file).and_then(|target| read_stamp(&target))
        })
        .await
        .ok()
        .flatten()
        .is_some_and(|stamp| stamp.identity == identity)
    {
        return;
    }
    let (lease, token) = {
        let mut state = repository.content_validation.state.lock();
        if state.deleting.contains(&path)
            || state
                .failures
                .get(&path)
                .is_some_and(|failure| failure.identity == identity)
            || state
                .scans
                .get(&path)
                .is_some_and(|scans| scans.iter().any(|scan| scan.identity == identity))
        {
            return;
        }
        if state.scans.values().map(Vec::len).sum::<usize>() + state.failures.len()
            >= MAX_CONTENT_ENTRIES
        {
            return;
        }
        let lease = match operations.accept("database_content_validation") {
            Ok(lease) => lease,
            Err(_) => return,
        };
        let token = lease.token();
        let scans = state.scans.entry(path.clone()).or_default();
        for previous in scans.iter() {
            previous.token.cancel();
        }
        scans.push(Scan {
            identity: identity.clone(),
            token: token.clone(),
        });
        (lease, token)
    };
    let guard = ScanGuard {
        repository: Arc::clone(&repository),
        path,
        identity: identity.clone(),
    };
    tauri::async_runtime::spawn(async move {
        let _ = run_native_operation(lease, "database_content_validation", async move {
            let _guard = guard;
            let slot = tokio::select! {
                biased;
                _ = token.cancelled() => return Err(Error::Cancellation),
                slot = SCAN_SLOT.acquire() => slot.map_err(|_| Error::Cancellation)?,
            };
            let result = BLOCKING_GATEWAY
                .spawn_cancellable(token, move |cancellation| {
                    let target = mutate_target(&authority, &file)?;
                    scan_worker(&repository, &target, &identity, cancellation, |event| {
                        let _ = event.emit(&app);
                    })
                })
                .await;
            drop(slot);
            result
        })
        .await;
    });
}

pub(super) fn scan_worker(
    repository: &DatabaseRepository,
    target: &DatabaseFileTarget,
    identity: &DatabaseIdentity,
    cancellation: &CancellationToken,
    emit: impl FnOnce(DatabaseContentFailure),
) -> Result<(), Error> {
    cancellation_check(cancellation)?;
    super::sqlite_cancellation::install()?;
    if repository.database_identity_expected(target, identity.object, Some(cancellation))?
        != *identity
    {
        return Err(Error::Conflict(
            "database changed after capability resolution".into(),
        ));
    }
    let bound = BoundDatabase::acquire(target)?;
    // SQLite 3.39 ignores stored CHECK violations on SQLITE_OPEN_READONLY.
    // mode=rw never creates the primary; query_only prevents scan mutations.
    let mut connection = SqliteConnection::establish(&bound.uri(SqliteMode::ReadWrite)?)
        .map_err(crate::error::map_sqlite_establish)?;
    connection.batch_execute("PRAGMA query_only=ON;")?;
    #[cfg(test)]
    test_checkpoint(target.path(), cancellation);
    let verdict = Verdict::from_result(super::sqlite_cancellation::with_sqlite_cancellation(
        cancellation,
        || migrations::validate_content(&mut connection),
    ))?;
    drop(connection);
    drop(bound);
    {
        let mut state = repository.content_validation.state.lock();
        cancellation_check(cancellation)?;
        if repository.database_identity_expected(target, identity.object, Some(cancellation))?
            != *identity
        {
            return Err(Error::Conflict(
                "database changed after capability resolution".into(),
            ));
        }
        if let Some(message) = verdict.message() {
            if state.failures.len() >= MAX_CONTENT_ENTRIES
                && !state.failures.contains_key(target.path())
            {
                return Err(Error::ResourceLimit(
                    "too many content validation verdicts".into(),
                ));
            }
            state.failures.insert(
                target.path().to_path_buf(),
                Failure {
                    identity: identity.clone(),
                    verdict: verdict.clone(),
                    pending: true,
                },
            );
            let result = write_stamp(repository, target, identity, &verdict, cancellation);
            if result.is_err() && cancellation.is_cancelled() {
                state.failures.remove(target.path());
                return Err(Error::Cancellation);
            }
            if result.is_err() {
                match repository.database_identity_expected(
                    target,
                    identity.object,
                    Some(cancellation),
                ) {
                    Ok(current) if current != *identity => {
                        state.failures.remove(target.path());
                        return Err(Error::Conflict(
                            "database changed after capability resolution".into(),
                        ));
                    }
                    _ => {}
                }
                if cancellation.is_cancelled() {
                    state.failures.remove(target.path());
                    return Err(Error::Cancellation);
                }
            }
            if result.is_ok() {
                if let Some(failure) = state.failures.get_mut(target.path()) {
                    failure.pending = false;
                }
            }
            // The in-process verdict is committed before the best-effort event.
            drop(state);
            emit(DatabaseContentFailure {
                filename: target.leaf().to_string_lossy().into_owned(),
                message: message.into(),
            });
            result
        } else {
            write_stamp(repository, target, identity, &verdict, cancellation)
        }
    }
}

#[cfg(test)]
type TestCheckpoint = Arc<dyn Fn(&Path, &CancellationToken) + Send + Sync>;
#[cfg(test)]
pub(super) static TEST_CHECKPOINT: Lazy<Mutex<Option<TestCheckpoint>>> =
    Lazy::new(|| Mutex::new(None));
#[cfg(test)]
fn test_checkpoint(path: &Path, token: &CancellationToken) {
    let hook = TEST_CHECKPOINT.lock().clone();
    if let Some(hook) = hook {
        hook(path, token);
    }
}
