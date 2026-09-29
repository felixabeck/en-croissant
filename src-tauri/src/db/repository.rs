#[cfg(test)]
use std::path::Path;
use std::{
    collections::{HashMap, HashSet},
    io::{Read, Seek, SeekFrom, Write},
    ops::{Deref, DerefMut},
    path::PathBuf,
    sync::{Arc, Condvar, Mutex},
    time::{Duration, Instant},
};

#[cfg(all(test, unix))]
std::thread_local! {
    pub(crate) static FAIL_NEXT_REVISION_BUMP: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

#[cfg(all(test, unix))]
pub(crate) struct RevisionBumpFailureGuard;

#[cfg(all(test, unix))]
impl Drop for RevisionBumpFailureGuard {
    fn drop(&mut self) {
        FAIL_NEXT_REVISION_BUMP.with(|fail| fail.set(false));
    }
}

#[cfg(all(test, unix))]
pub(crate) fn fail_next_revision_bump() -> RevisionBumpFailureGuard {
    FAIL_NEXT_REVISION_BUMP.with(|fail| fail.set(true));
    RevisionBumpFailureGuard
}

use diesel::sql_types::{Nullable, Text};
use diesel::{
    prelude::*,
    r2d2::{CustomizeConnection, ManageConnection, Pool, PooledConnection},
    sql_query, Connection, OptionalExtension, SqliteConnection,
};
use parking_lot::Mutex as ParkingMutex;
use tokio_util::sync::CancellationToken;

use crate::error::Error;

use super::{
    bound_sqlite::{BoundDatabase, SqliteMode},
    migrations, ConnectionOptions, DatabaseSchemaIdentity,
};

const MAX_OPEN_DATABASES: usize = 16;
// Maximum number of pooled SQLite connections per database.
const MAX_CONNECTIONS_PER_DATABASE: u32 = 16;
// r2d2 retries a failed pooled open until this timeout; tests that drive a refused bound open
// shorten it so they do not wait the production 30 s.
const POOL_CONNECTION_TIMEOUT: Duration = if cfg!(test) {
    Duration::from_secs(2)
} else {
    Duration::from_secs(30)
};
// Must exceed `PRAGMA busy_timeout = 30000` in `db/mod.rs` so an ordinary
// contended write completes rather than tripping retirement.
const RETIRE_WAIT_TIMEOUT: Duration = Duration::from_secs(60);
const RETIRE_CANCELLATION_POLL: Duration = Duration::from_millis(25);

#[cfg(test)]
thread_local! {
    static SNAPSHOT_COPY_HOOK: std::cell::RefCell<Option<Box<dyn FnMut()>>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
struct SnapshotCopyHookGuard;

#[cfg(test)]
impl Drop for SnapshotCopyHookGuard {
    fn drop(&mut self) {
        SNAPSHOT_COPY_HOOK.with(|hook| *hook.borrow_mut() = None);
    }
}

#[cfg(all(test, unix))]
pub(crate) fn cancel_snapshot_copy_after_chunks(cancellation: CancellationToken, chunks: usize) {
    let mut seen = 0usize;
    SNAPSHOT_COPY_HOOK.with(|hook| {
        *hook.borrow_mut() = Some(Box::new(move || {
            seen += 1;
            if seen >= chunks {
                cancellation.cancel();
            }
        }));
    });
}

type SqlitePool = Pool<BoundConnectionManager>;
type AcquiredConnection = (
    Arc<DatabaseEntry>,
    EntryLease,
    PooledConnection<BoundConnectionManager>,
    std::fs::File,
);

/// Keeps the binding alive until after the SQLite connection closes. Field
/// order is deliberate: Rust drops `connection` before `_binding`.
struct BoundSqliteConnection {
    connection: SqliteConnection,
    _binding: BoundDatabase,
}

impl Deref for BoundSqliteConnection {
    type Target = SqliteConnection;

    fn deref(&self) -> &Self::Target {
        &self.connection
    }
}

impl DerefMut for BoundSqliteConnection {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.connection
    }
}

#[derive(Clone, Debug)]
struct BoundConnectionManager {
    database: BoundDatabase,
    uri: String,
}

impl ManageConnection for BoundConnectionManager {
    type Connection = BoundSqliteConnection;
    type Error = diesel::r2d2::Error;

    fn connect(&self) -> Result<Self::Connection, Self::Error> {
        let connection =
            SqliteConnection::establish(&self.uri).map_err(diesel::r2d2::Error::ConnectionError)?;
        Ok(BoundSqliteConnection {
            connection,
            _binding: self.database.clone(),
        })
    }

    fn is_valid(&self, connection: &mut Self::Connection) -> Result<(), Self::Error> {
        <SqliteConnection as diesel::r2d2::R2D2Connection>::ping(&mut connection.connection)
            .map_err(diesel::r2d2::Error::QueryError)
    }

    fn has_broken(&self, connection: &mut Self::Connection) -> bool {
        std::thread::panicking()
            || <SqliteConnection as diesel::r2d2::R2D2Connection>::is_broken(
                &mut connection.connection,
            )
    }
}

impl CustomizeConnection<BoundSqliteConnection, diesel::r2d2::Error> for ConnectionOptions {
    fn on_acquire(
        &self,
        connection: &mut BoundSqliteConnection,
    ) -> Result<(), diesel::r2d2::Error> {
        <ConnectionOptions as CustomizeConnection<SqliteConnection, diesel::r2d2::Error>>::on_acquire(
            self,
            &mut connection.connection,
        )
    }
}
/// A pooled connection cannot outlive the repository lifecycle lease which
/// admitted it. Keeping the two values together makes an unleased pooled
/// connection unrepresentable at the repository boundary.
pub struct DatabaseConnection {
    connection: DatabaseConnectionInner,
    _lease: Option<EntryLease>,
    _pinned_file: Option<std::fs::File>,
    _authority_snapshot: Option<tempfile::NamedTempFile>,
}

enum DatabaseConnectionInner {
    Pooled(PooledConnection<BoundConnectionManager>),
    Pinned(SqliteConnection),
}

impl Deref for DatabaseConnection {
    type Target = SqliteConnection;
    fn deref(&self) -> &Self::Target {
        match &self.connection {
            DatabaseConnectionInner::Pooled(connection) => connection,
            DatabaseConnectionInner::Pinned(connection) => connection,
        }
    }
}

impl DerefMut for DatabaseConnection {
    fn deref_mut(&mut self) -> &mut Self::Target {
        match &mut self.connection {
            DatabaseConnectionInner::Pooled(connection) => connection,
            DatabaseConnectionInner::Pinned(connection) => connection,
        }
    }
}

/// Canonical object identity used by caches that consume non-game SQLite
/// databases as well. The filesystem component catches replacement outside
/// this process; `data_revision` is persisted in the database's Info table.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DatabaseIdentity {
    pub data_revision: u64,
    pub object: (u64, u64),
    pub length: u64,
    pub modified: std::time::SystemTime,
}

struct DatabaseEntry {
    // Declared before `bound`: fields drop in order, so pooled connections close before the
    // entry's binding handle is released.
    pool: SqlitePool,
    bound: BoundDatabase,
    write_lock: Arc<ParkingMutex<()>>,
    index_lock: Arc<ParkingMutex<()>>,
    state: Mutex<EntryState>,
    lifecycle: Mutex<LifecycleState>,
    lifecycle_changed: Condvar,
}

#[derive(Default)]
struct LifecycleState {
    retiring: bool,
    active: usize,
}

struct EntryLease {
    entry: Arc<DatabaseEntry>,
}

impl Drop for EntryLease {
    fn drop(&mut self) {
        if let Ok(mut lifecycle) = self.entry.lifecycle.lock() {
            lifecycle.active = lifecycle.active.saturating_sub(1);
            self.entry.lifecycle_changed.notify_all();
        }
    }
}

#[derive(Default)]
struct EntryState {
    schema_identity: Option<DatabaseSchemaIdentity>,
    last_used: u64,
}

#[derive(Default)]
struct RepositoryState {
    entries: HashMap<EntryKey, Arc<DatabaseEntry>>,
    tombstones: HashSet<PathBuf>,
    building: HashSet<EntryKey>,
    clock: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct EntryKey {
    identity: (u64, u64),
    parent_identity: (u64, u64),
    path: PathBuf,
}

/// The sole owner of SQLite pools and per-database lifecycle state.
///
/// Paths are canonical before insertion, so aliases cannot produce separate
/// pools, locks, revisions, or cache invalidations. The bounded LRU eviction
/// only releases idle entries; live callers keep their entry alive via Arc.
pub struct DatabaseRepository {
    state: Mutex<RepositoryState>,
    build_changed: Condvar,
    retire_wait: Duration,
}

impl Default for DatabaseRepository {
    fn default() -> Self {
        Self {
            state: Mutex::new(RepositoryState::default()),
            build_changed: Condvar::new(),
            retire_wait: RETIRE_WAIT_TIMEOUT,
        }
    }
}

impl DatabaseRepository {
    #[cfg(all(test, unix))]
    fn with_retire_wait(retire_wait: Duration) -> Self {
        Self {
            state: Mutex::new(RepositoryState::default()),
            build_changed: Condvar::new(),
            retire_wait,
        }
    }

    pub fn connection(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: Option<&CancellationToken>,
    ) -> Result<DatabaseConnection, Error> {
        super::sqlite_cancellation::install()?;
        let (entry, lease, mut connection, probe) = self.acquire_probed(target, cancellation)?;
        let identity = DatabaseSchemaIdentity::from_file(&probe)?;
        let requires_validation = entry
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .schema_identity
            .as_ref()
            != Some(&identity);
        if requires_validation {
            migrations::validate_existing_database(&mut connection)?;
            self.mark_schema_validated_entry(&entry, identity)?;
        }
        Ok(DatabaseConnection {
            connection: DatabaseConnectionInner::Pooled(connection),
            _lease: Some(lease),
            _pinned_file: None,
            _authority_snapshot: None,
        })
    }

    pub fn initialization_connection(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: Option<&CancellationToken>,
    ) -> Result<DatabaseConnection, Error> {
        super::sqlite_cancellation::install()?;
        let (_entry, lease, connection, _probe) = self.acquire_probed(target, cancellation)?;
        Ok(DatabaseConnection {
            connection: DatabaseConnectionInner::Pooled(connection),
            _lease: Some(lease),
            _pinned_file: None,
            _authority_snapshot: None,
        })
    }

    /// Test-fixture helper for creating non-game SQLite schemas. Production
    /// puzzle reads must use a retained authority descriptor below.
    #[cfg(all(test, unix))]
    pub fn schema_specific_connection(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
    ) -> Result<DatabaseConnection, Error> {
        self.initialization_connection(target, None)
    }

    /// Opens SQLite from a private snapshot copied from the exact descriptor
    /// retained by path authority. SQLite's API accepts pathnames, not file
    /// descriptors, and resolves `/proc/self/fd` back to a mutable filename;
    /// a private snapshot is therefore the portable way to prevent an
    /// A→B→A replacement from redirecting the connection.
    pub fn schema_specific_connection_expected_file_cancellable(
        &self,
        file: std::fs::File,
        expected_object: (u64, u64),
        cancellation: &tokio_util::sync::CancellationToken,
    ) -> Result<DatabaseConnection, Error> {
        #[cfg(test)]
        let _copy_hook_guard = SnapshotCopyHookGuard;
        super::sqlite_cancellation::install()?;
        if crate::infra::path_authority::opened_file_identity(&file)? != expected_object {
            return Err(Error::Conflict(
                "database changed after capability resolution".into(),
            ));
        }
        let mut source = file.try_clone()?;
        source.seek(SeekFrom::Start(0))?;
        let mut snapshot = tempfile::NamedTempFile::new()?;
        let mut buffer = [0_u8; 64 * 1024];
        loop {
            if cancellation.is_cancelled() {
                return Err(Error::Cancellation);
            }
            let read = source.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            snapshot.as_file_mut().write_all(&buffer[..read])?;
            #[cfg(test)]
            SNAPSHOT_COPY_HOOK.with(|hook| {
                if let Some(hook) = hook.borrow_mut().as_mut() {
                    hook();
                }
            });
        }
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        snapshot.as_file_mut().sync_all()?;
        let snapshot_path = snapshot.path().to_string_lossy().into_owned();
        let connection = SqliteConnection::establish(&snapshot_path).map_err(|error| {
            Error::InvalidInput(format!(
                "could not open authority-pinned SQLite database snapshot: {error}"
            ))
        })?;
        Ok(DatabaseConnection {
            connection: DatabaseConnectionInner::Pinned(connection),
            _lease: None,
            _pinned_file: Some(file),
            _authority_snapshot: Some(snapshot),
        })
    }

    pub fn database_identity(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
    ) -> Result<DatabaseIdentity, Error> {
        self.database_identity_with_cancellation(target, None)
    }

    fn database_identity_with_cancellation(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: Option<&CancellationToken>,
    ) -> Result<DatabaseIdentity, Error> {
        let owned_cancellation;
        let cancellation = match cancellation {
            Some(cancellation) => cancellation,
            None => {
                owned_cancellation = CancellationToken::new();
                &owned_cancellation
            }
        };
        self.identity_from_probe(target, cancellation, true)
    }

    pub fn database_identity_expected(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        expected_object: (u64, u64),
        cancellation: Option<&CancellationToken>,
    ) -> Result<DatabaseIdentity, Error> {
        let identity = self.database_identity_with_cancellation(target, cancellation)?;
        if identity.object != expected_object {
            return Err(Error::Conflict(
                "database changed after capability resolution".into(),
            ));
        }
        Ok(identity)
    }

    pub(crate) fn identity_from_probe(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: &CancellationToken,
        hydrate: bool,
    ) -> Result<DatabaseIdentity, Error> {
        if !hydrate {
            let schema = self.probe_schema(target, cancellation)?;
            self.tombstone_conflict(target)?;
            super::cancellation_check(cancellation)?;
            return Ok(DatabaseIdentity {
                data_revision: 0,
                object: schema.object,
                length: schema.length,
                modified: schema.modified,
            });
        }

        let (s1, r1) = self.probe_schema_and_revision(target, cancellation)?;
        let (s2, r2) = self.probe_schema_and_revision(target, cancellation)?;
        let (s3, r3) = self.probe_schema_and_revision(target, cancellation)?;
        let (s4, r4) = self.probe_schema_and_revision(target, cancellation)?;
        self.tombstone_conflict(target)?;
        if s1 != s2 || s2 != s3 || s3 != s4 || r1 != r2 || r2 != r3 || r3 != r4 {
            return Err(Error::Conflict(
                "database changed while reading its identity".into(),
            ));
        }
        super::cancellation_check(cancellation)?;
        Ok(DatabaseIdentity {
            data_revision: r4,
            object: s4.object,
            length: s4.length,
            modified: s4.modified,
        })
    }

    fn probe_schema_and_revision(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: &CancellationToken,
    ) -> Result<(DatabaseSchemaIdentity, u64), Error> {
        let schema = self.probe_schema(target, cancellation)?;
        let revision = self.read_revision(target, cancellation)?;
        Ok((schema, revision))
    }

    fn probe_schema(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: &CancellationToken,
    ) -> Result<DatabaseSchemaIdentity, Error> {
        super::cancellation_check(cancellation)?;
        self.tombstone_conflict(target)?;
        let file = self.open_current(target)?;
        let identity = DatabaseSchemaIdentity::from_file(&file)?;
        if identity.object != target.identity() {
            return Err(Error::Conflict(
                "database changed after capability resolution".into(),
            ));
        }
        Ok(identity)
    }

    fn read_revision(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: &CancellationToken,
    ) -> Result<u64, Error> {
        super::cancellation_check(cancellation)?;
        super::sqlite_cancellation::install()?;
        let bound = BoundDatabase::acquire(target)?;
        let uri = bound.uri(SqliteMode::ReadOnly)?;
        let refusal_count = bound.refusal_count();
        let connection =
            SqliteConnection::establish(&uri).map_err(crate::error::map_sqlite_establish);
        let mut connection = match connection {
            Ok(connection) => connection,
            Err(error) => {
                return Err(self.classify_bound_open_error(target, &bound, refusal_count, error));
            }
        };
        let revision = super::sqlite_cancellation::with_sqlite_cancellation(cancellation, || {
            read_data_revision(&mut connection)
        })?;
        #[cfg(test)]
        run_test_hook(TestHook::AfterReadRevision, target.path());
        Ok(revision)
    }

    fn tombstone_conflict(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
    ) -> Result<(), Error> {
        if self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .tombstones
            .contains(target.path())
        {
            return Err(Error::Conflict("database is being deleted".into()));
        }
        Ok(())
    }

    #[cfg(all(test, unix))]
    pub fn mark_schema_validated(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
    ) -> Result<(), Error> {
        let (_key, entry, file) = self.entry(target, None)?;
        self.mark_schema_validated_entry(&entry, DatabaseSchemaIdentity::from_file(&file)?)
    }

    #[cfg(all(test, unix))]
    pub fn with_write_lock<T>(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        let (_, entry, _) = self.entry(target, None)?;
        let _lease = entry.acquire()?;
        let _guard = entry.write_lock.lock();
        operation()
    }

    pub fn with_write_lock_cancellable<T>(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: &CancellationToken,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        let (_, entry, _) = self.entry(target, Some(cancellation))?;
        let _lease = entry.acquire()?;
        let _guard =
            crate::infra::cancellable_lock::lock_cancellable(&entry.write_lock, cancellation)?;
        operation()
    }

    pub fn with_index_lock<T>(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        let (_, entry, _) = self.entry(target, None)?;
        let _lease = entry.acquire()?;
        let _guard = entry.index_lock.lock();
        operation()
    }

    pub fn with_index_lock_cancellable<T>(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: &CancellationToken,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        let (_, entry, _) = self.entry(target, Some(cancellation))?;
        let _lease = entry.acquire()?;
        let _guard =
            crate::infra::cancellable_lock::lock_cancellable(&entry.index_lock, cancellation)?;
        operation()
    }

    /// Evicts every resource owned by this canonical database. A future open
    /// receives a fresh pool and therefore cannot use a deleted/replaced file.
    #[cfg(all(test, unix))]
    pub fn close_and_invalidate(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
    ) -> Result<(), Error> {
        let key = entry_key(target)?;
        let entry = self.remove_entry(&key)?;
        if let Some(entry) = entry {
            entry.retire_and_wait(self.retire_wait)?;
        }
        Ok(())
    }

    #[cfg(all(test, unix))]
    pub fn deletion_is_waiting(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
    ) -> Result<bool, Error> {
        let key = entry_key(target)?;
        let entry = self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .entries
            .get(&key)
            .cloned();
        Ok(entry.is_some_and(|entry| {
            entry
                .lifecycle
                .lock()
                .map(|lifecycle| lifecycle.retiring && lifecycle.active != 0)
                .unwrap_or(false)
        }))
    }

    #[cfg(all(test, unix))]
    pub(crate) fn is_building(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
    ) -> Result<bool, Error> {
        let key = entry_key(target)?;
        Ok(self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .building
            .contains(&key))
    }

    /// Reserves a database name before unlinking it so no concurrent command
    /// can recreate a pool for the soon-to-be-deleted inode. The reservation
    /// is released only after the deletion operation has reached a terminal
    /// success/failure result.
    #[cfg(all(test, unix))]
    pub fn delete_exclusive<T>(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.delete_exclusive_inner(target, None, operation)
    }

    /// Reserves and retires a database entry cooperatively. Cancellation may stop the wait only
    /// before `operation` starts; once unlink begins, the operation and its caller-owned cleanup
    /// tail retain the committed outcome.
    pub fn delete_exclusive_cancellable<T>(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: &CancellationToken,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        self.delete_exclusive_inner(target, Some(cancellation), operation)
    }

    fn delete_exclusive_inner<T>(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: Option<&CancellationToken>,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        if cancellation.is_some_and(CancellationToken::is_cancelled) {
            return Err(Error::Cancellation);
        }
        let key = entry_key(target)?;
        let path = target.path().to_owned();
        let entry = {
            let state = self
                .state
                .lock()
                .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
            let mut state = self.wait_while_building(state, &key, cancellation)?;
            if !state.tombstones.insert(path.clone()) {
                return Err(Error::Conflict(
                    "database deletion is already in progress".into(),
                ));
            }
            state.entries.get(&key).cloned()
        };
        let mut tombstone = TombstoneGuard::new(self, path.clone(), entry.clone());
        if let Some(entry) = &entry {
            entry.retire_and_wait_cancellable(self.retire_wait, cancellation)?;
        }
        if cancellation.is_some_and(CancellationToken::is_cancelled) {
            return Err(Error::Cancellation);
        }
        let result = operation();
        let mut state = self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
        state.entries.remove(&key);
        state.tombstones.remove(&path);
        tombstone.disarm();
        result
    }

    fn entry(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: Option<&CancellationToken>,
    ) -> Result<(EntryKey, Arc<DatabaseEntry>, std::fs::File), Error> {
        // Identity and lock-only callers can create the pool before `connection()` is reached.
        // Register the SQLite auto-extension at the one shared construction boundary so every
        // pooled connection receives the cancellation progress handler.
        super::sqlite_cancellation::install()?;
        let key = entry_key(target)?;
        let mut initial_probe = self.entry_probe(target, &key, cancellation)?;
        loop {
            let mut state = self
                .state
                .lock()
                .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
            if state.tombstones.contains(target.path()) {
                return Err(Error::Conflict("database is being deleted".into()));
            }
            state.clock = state.clock.saturating_add(1);
            let now = state.clock;
            if let Some(entry) = state.entries.get(&key).cloned() {
                let retiring = entry
                    .lifecycle
                    .lock()
                    .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?
                    .retiring;
                if retiring {
                    return Err(Error::Conflict(
                        "database is being replaced or deleted".into(),
                    ));
                }
                entry
                    .state
                    .lock()
                    .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
                    .last_used = now;
                return Ok((key, entry, initial_probe));
            }
            if state.building.contains(&key) {
                drop(state);
                self.wait_while_building_key(&key, cancellation)?;
                initial_probe = self.entry_probe(target, &key, cancellation)?;
                continue;
            }
            state.building.insert(key.clone());
            drop(state);
            let mut build_guard = BuildGuard {
                repository: self,
                key: key.clone(),
                finished: false,
            };

            drop(initial_probe);
            let pre_build_probe = self.open_current(target)?;
            drop(pre_build_probe);
            #[cfg(all(test, unix))]
            run_test_hook(TestHook::PreBuild, target.path());
            let bound = BoundDatabase::acquire(target)?;
            let uri = bound.uri(SqliteMode::ReadWrite)?;
            let pool = Pool::builder()
                .max_size(MAX_CONNECTIONS_PER_DATABASE)
                .min_idle(Some(0))
                .connection_timeout(POOL_CONNECTION_TIMEOUT)
                .connection_customizer(Box::new(ConnectionOptions))
                .build(BoundConnectionManager {
                    database: bound.clone(),
                    uri,
                })?;
            #[cfg(all(test, unix))]
            run_test_hook(TestHook::PostBuild, target.path());
            initial_probe = self.open_current(target)?;

            let mut state = self
                .state
                .lock()
                .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
            #[cfg(all(test, unix))]
            run_test_hook(TestHook::PreInsert, target.path());
            if cancellation.is_some_and(CancellationToken::is_cancelled) {
                drop(state);
                drop(build_guard);
                return Err(Error::Cancellation);
            }
            if state.tombstones.contains(target.path()) {
                drop(state);
                drop(build_guard);
                return Err(Error::Conflict("database is being deleted".into()));
            }
            state.clock = state.clock.saturating_add(1);
            let entry = Arc::new(DatabaseEntry {
                pool,
                bound,
                write_lock: Arc::new(ParkingMutex::new(())),
                index_lock: Arc::new(ParkingMutex::new(())),
                state: Mutex::new(EntryState {
                    last_used: state.clock,
                    ..EntryState::default()
                }),
                lifecycle: Mutex::new(LifecycleState::default()),
                lifecycle_changed: Condvar::new(),
            });
            state.entries.insert(key.clone(), entry.clone());
            self.evict_idle_entries(&mut state, &key);
            state.building.remove(&key);
            self.build_changed.notify_all();
            build_guard.finish();
            drop(build_guard);
            return Ok((key, entry, initial_probe));
        }
    }

    fn mark_schema_validated_entry(
        &self,
        entry: &Arc<DatabaseEntry>,
        identity: DatabaseSchemaIdentity,
    ) -> Result<(), Error> {
        entry
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .schema_identity = Some(identity);
        Ok(())
    }

    #[cfg(all(test, unix))]
    fn remove_entry(&self, key: &EntryKey) -> Result<Option<Arc<DatabaseEntry>>, Error> {
        Ok(self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .entries
            .remove(key))
    }

    fn retire_replaced(
        &self,
        key: &EntryKey,
        entry: &Arc<DatabaseEntry>,
        cancellation: Option<&CancellationToken>,
    ) -> Result<(), Error> {
        entry.retire_and_wait_cancellable(self.retire_wait, cancellation)?;
        let mut state = self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
        if state
            .entries
            .get(key)
            .is_some_and(|current| Arc::ptr_eq(current, entry))
        {
            state.entries.remove(key);
        }
        Ok(())
    }

    fn evict_idle_entries(&self, state: &mut RepositoryState, protected: &EntryKey) {
        while state.entries.len() > MAX_OPEN_DATABASES {
            let eviction = state
                .entries
                .iter()
                .filter(|(key, entry)| {
                    *key != protected && Arc::strong_count(entry) == 1 && entry.is_idle()
                })
                .filter_map(|(path, entry)| {
                    entry
                        .state
                        .lock()
                        .ok()
                        .map(|entry_state| (path.clone(), entry_state.last_used))
                })
                .min_by_key(|(_, last_used)| *last_used)
                .map(|(path, _)| path);
            match eviction {
                Some(path) => {
                    state.entries.remove(&path);
                }
                None => break,
            }
        }
    }

    fn open_current(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
    ) -> Result<std::fs::File, Error> {
        let result = target.open_current();
        #[cfg(test)]
        run_test_hook(TestHook::AfterOpenCurrent, target.path());
        result
    }

    fn entry_probe(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        key: &EntryKey,
        cancellation: Option<&CancellationToken>,
    ) -> Result<std::fs::File, Error> {
        match self.open_current(target) {
            Ok(file) => Ok(file),
            Err(error @ Error::Conflict(_)) => match self.open_current(target) {
                Ok(file) => Ok(file),
                Err(Error::Conflict(_)) => {
                    let stale_entry = self
                        .state
                        .lock()
                        .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
                        .entries
                        .get(key)
                        .cloned();
                    if let Some(entry) = stale_entry {
                        let active = entry
                            .lifecycle
                            .lock()
                            .map_err(|_| {
                                Error::Conflict("database lifecycle lock poisoned".into())
                            })?
                            .active;
                        if active == 0 {
                            self.retire_replaced(key, &entry, cancellation)?;
                        }
                    }
                    Err(error)
                }
                Err(error) => Err(error),
            },
            Err(error) => Err(error),
        }
    }

    fn acquire_probed(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        cancellation: Option<&CancellationToken>,
    ) -> Result<AcquiredConnection, Error> {
        let (key, entry, initial_probe) = self.entry(target, cancellation)?;
        drop(initial_probe);
        let lease = entry.acquire()?;
        #[cfg(all(test, unix))]
        run_test_hook(TestHook::PreGet, target.path());
        let pre_get_probe = match self.open_current(target) {
            Ok(file) => file,
            Err(error) => {
                drop(lease);
                return Err(self.retire_after_probe_conflict(&key, &entry, error, cancellation)?);
            }
        };
        drop(pre_get_probe);
        let refusal_count = entry.bound.refusal_count();
        #[cfg(test)]
        run_test_hook(TestHook::BeforePoolGet, target.path());
        let connection = match entry.pool.get() {
            Ok(connection) => connection,
            Err(error) => {
                #[cfg(test)]
                run_test_hook(TestHook::PoolGetFailed, target.path());
                let error: Error = error.into();
                let error =
                    self.classify_bound_open_error(target, &entry.bound, refusal_count, error);
                drop(lease);
                return Err(self.retire_after_probe_conflict(&key, &entry, error, cancellation)?);
            }
        };
        #[cfg(test)]
        run_test_hook(TestHook::PostGet, target.path());
        let post_get_probe = match self.open_current(target) {
            Ok(file) => file,
            Err(error) => {
                drop(connection);
                drop(lease);
                return Err(self.retire_after_probe_conflict(&key, &entry, error, cancellation)?);
            }
        };
        Ok((entry, lease, connection, post_get_probe))
    }

    fn classify_bound_open_error(
        &self,
        target: &crate::infra::path_authority::DatabaseFileTarget,
        bound: &BoundDatabase,
        refusal_count_before: u64,
        error: Error,
    ) -> Error {
        let refused_identity = bound.refusal_count() > refusal_count_before;
        #[cfg(test)]
        if refused_identity {
            run_test_hook(TestHook::BoundRefusal, target.path());
        }
        classify_bound_open_error_result(
            refused_identity,
            || target.open_current().map(drop),
            error,
        )
    }

    fn retire_after_probe_conflict(
        &self,
        key: &EntryKey,
        entry: &Arc<DatabaseEntry>,
        error: Error,
        cancellation: Option<&CancellationToken>,
    ) -> Result<Error, Error> {
        if !matches!(&error, Error::Conflict(_)) {
            return Err(error);
        }
        let active = entry
            .lifecycle
            .lock()
            .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?
            .active;
        if active == 0 {
            self.retire_replaced(key, entry, cancellation)?;
        }
        Ok(error)
    }

    fn wait_while_building_key(
        &self,
        key: &EntryKey,
        cancellation: Option<&CancellationToken>,
    ) -> Result<(), Error> {
        let state = self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
        drop(self.wait_while_building(state, key, cancellation)?);
        Ok(())
    }

    fn wait_while_building<'a>(
        &self,
        mut state: std::sync::MutexGuard<'a, RepositoryState>,
        key: &EntryKey,
        cancellation: Option<&CancellationToken>,
    ) -> Result<std::sync::MutexGuard<'a, RepositoryState>, Error> {
        let deadline = Instant::now() + self.retire_wait;
        while state.building.contains(key) {
            if cancellation.is_some_and(CancellationToken::is_cancelled) {
                return Err(Error::Cancellation);
            }
            let now = Instant::now();
            if now >= deadline {
                return Err(Error::Conflict("database construction timed out".into()));
            }
            let duration = if cancellation.is_some() {
                deadline
                    .saturating_duration_since(now)
                    .min(RETIRE_CANCELLATION_POLL)
            } else {
                deadline.saturating_duration_since(now)
            };
            let (guard, result) = self
                .build_changed
                .wait_timeout(state, duration)
                .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
            state = guard;
            if result.timed_out() && state.building.contains(key) && Instant::now() >= deadline {
                return Err(Error::Conflict("database construction timed out".into()));
            }
        }
        Ok(state)
    }
}

fn entry_key(target: &crate::infra::path_authority::DatabaseFileTarget) -> Result<EntryKey, Error> {
    Ok(EntryKey {
        identity: target.identity(),
        parent_identity: crate::infra::path_authority::opened_file_identity(target.parent())?,
        path: target.path().to_owned(),
    })
}

fn classify_bound_open_error_result(
    refused_identity: bool,
    open_current: impl FnOnce() -> Result<(), Error>,
    original: Error,
) -> Error {
    if refused_identity {
        return Error::Conflict("database changed after capability resolution".into());
    }
    match open_current() {
        Err(Error::Conflict(_)) => {
            Error::Conflict("database changed after capability resolution".into())
        }
        Err(error) => error,
        Ok(()) => original,
    }
}

#[derive(QueryableByName)]
struct RevisionRow {
    #[diesel(sql_type = Nullable<Text>)]
    value: Option<String>,
}

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

pub(crate) fn read_data_revision(conn: &mut SqliteConnection) -> Result<u64, Error> {
    let info_exists = sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'Info'",
    )
    .get_result::<CountRow>(conn)?
    .count
        != 0;
    if !info_exists {
        return Ok(0);
    }

    let Some(row) = sql_query("SELECT Value AS value FROM Info WHERE Name = 'DataRevision'")
        .get_result::<RevisionRow>(conn)
        .optional()?
    else {
        return Ok(0);
    };
    let Some(value) = row.value else {
        return Err(Error::InvalidInput(
            "DataRevision is not a non-negative i64".into(),
        ));
    };
    let value = value
        .parse::<i64>()
        .map_err(|_| Error::InvalidInput("DataRevision is not a non-negative i64".into()))?;
    if value < 0 {
        return Err(Error::InvalidInput(
            "DataRevision is not a non-negative i64".into(),
        ));
    }
    u64::try_from(value)
        .map_err(|_| Error::InvalidInput("DataRevision is not a non-negative i64".into()))
}

struct BuildGuard<'a> {
    repository: &'a DatabaseRepository,
    key: EntryKey,
    finished: bool,
}

impl BuildGuard<'_> {
    fn finish(&mut self) {
        self.finished = true;
    }
}

impl Drop for BuildGuard<'_> {
    fn drop(&mut self) {
        if self.finished {
            return;
        }
        if let Ok(mut state) = self.repository.state.lock() {
            state.building.remove(&self.key);
            self.repository.build_changed.notify_all();
        }
    }
}

struct TombstoneGuard<'a> {
    repository: &'a DatabaseRepository,
    path: PathBuf,
    entry: Option<Arc<DatabaseEntry>>,
    disarmed: bool,
}

impl<'a> TombstoneGuard<'a> {
    fn new(
        repository: &'a DatabaseRepository,
        path: PathBuf,
        entry: Option<Arc<DatabaseEntry>>,
    ) -> Self {
        Self {
            repository,
            path,
            entry,
            disarmed: false,
        }
    }

    fn disarm(&mut self) {
        self.disarmed = true;
    }
}

impl Drop for TombstoneGuard<'_> {
    fn drop(&mut self) {
        if self.disarmed {
            return;
        }
        if let Some(entry) = &self.entry {
            let _ = entry.cancel_retirement();
        }
        if let Ok(mut state) = self.repository.state.lock() {
            state.tombstones.remove(&self.path);
        }
    }
}

#[cfg(test)]
#[derive(Clone, Copy)]
pub(crate) enum TestHook {
    #[cfg(unix)]
    PreBuild,
    #[cfg(unix)]
    PostBuild,
    #[cfg(unix)]
    PreInsert,
    #[cfg(unix)]
    PreGet,
    BeforePoolGet,
    PoolGetFailed,
    BoundRefusal,
    PostGet,
    AfterOpenCurrent,
    AfterReadRevision,
    #[cfg(unix)]
    AfterBumpOp,
    #[cfg(unix)]
    BeforeRevisionBump,
}

#[cfg(test)]
#[derive(Default)]
pub(crate) struct TestHooks {
    generation: u64,
    scope: Option<PathBuf>,
    #[cfg(unix)]
    pub(crate) pre_build: Option<Box<dyn FnMut() + Send>>,
    #[cfg(unix)]
    pub(crate) post_build: Option<Box<dyn FnMut() + Send>>,
    #[cfg(unix)]
    pub(crate) pre_insert: Option<Box<dyn FnMut() + Send>>,
    #[cfg(unix)]
    pub(crate) pre_get: Option<Box<dyn FnMut() + Send>>,
    pub(crate) before_pool_get: Option<Box<dyn FnMut() + Send>>,
    pub(crate) pool_get_failed: Option<Box<dyn FnMut() + Send>>,
    pub(crate) bound_refusal: Option<Box<dyn FnMut() + Send>>,
    pub(crate) post_get: Option<Box<dyn FnMut() + Send>>,
    pub(crate) after_open_current: Option<Box<dyn FnMut(usize) + Send>>,
    pub(crate) after_read_revision: Option<Box<dyn FnMut() + Send>>,
    #[cfg(unix)]
    pub(crate) after_bump_op: Option<Box<dyn FnMut() + Send>>,
    #[cfg(unix)]
    pub(crate) before_revision_bump: Option<Box<dyn FnMut() + Send>>,
    pub(crate) open_current_count: usize,
}

#[cfg(test)]
static TEST_HOOKS: std::sync::OnceLock<std::sync::Mutex<TestHooks>> = std::sync::OnceLock::new();

#[cfg(test)]
static TEST_HOOK_SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[cfg(test)]
static NEXT_TEST_HOOK_GENERATION: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(1);

#[cfg(test)]
fn test_hook_scope_matches(hooks: &TestHooks, path: &Path) -> bool {
    let normalized_path = normalize_test_hook_path(path);
    hooks
        .scope
        .as_deref()
        .is_some_and(|scope| normalized_path.starts_with(scope))
}

#[cfg(test)]
fn normalize_test_hook_path(scope: &Path) -> PathBuf {
    if scope.is_dir() {
        return scope.canonicalize().unwrap_or_else(|_| scope.to_path_buf());
    }

    let Some(file_name) = scope.file_name().filter(|name| !name.is_empty()) else {
        return scope.to_path_buf();
    };
    let parent = scope
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    std::fs::canonicalize(parent)
        .map(|parent| parent.join(file_name))
        .unwrap_or_else(|_| scope.to_path_buf())
}

#[cfg(test)]
pub(crate) struct TestHooksGuard {
    previous: Option<TestHooks>,
    _serial: std::sync::MutexGuard<'static, ()>,
}

#[cfg(test)]
pub(crate) fn configure_test_hooks(
    scope: impl AsRef<Path>,
    configure: impl FnOnce(&mut TestHooks),
) -> TestHooksGuard {
    let serial = TEST_HOOK_SERIAL
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let scope = normalize_test_hook_path(scope.as_ref());
    let generation = NEXT_TEST_HOOK_GENERATION.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let mut guard = TestHooksGuard {
        previous: None,
        _serial: serial,
    };
    let hooks_mutex = TEST_HOOKS.get_or_init(|| std::sync::Mutex::new(TestHooks::default()));
    let mut hooks = hooks_mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    guard.previous = Some(std::mem::take(&mut *hooks));
    hooks.generation = generation;
    hooks.scope = Some(scope);
    configure(&mut hooks);
    guard
}

#[cfg(test)]
impl Drop for TestHooksGuard {
    fn drop(&mut self) {
        let Some(previous) = self.previous.take() else {
            return;
        };
        if let Some(hooks) = TEST_HOOKS.get() {
            let mut hooks = hooks
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            let _ = std::mem::replace(&mut *hooks, previous);
        }
    }
}

#[cfg(test)]
pub(crate) fn run_test_hook(hook: TestHook, path: &Path) {
    match hook {
        #[cfg(unix)]
        TestHook::PreBuild | TestHook::PostBuild | TestHook::PreInsert | TestHook::PreGet => {
            run_noarg_test_hook(hook, path)
        }
        TestHook::BeforePoolGet
        | TestHook::PoolGetFailed
        | TestHook::BoundRefusal
        | TestHook::PostGet => run_noarg_test_hook(hook, path),
        TestHook::AfterOpenCurrent => run_after_open_current_test_hook(path),
        TestHook::AfterReadRevision => run_noarg_test_hook(hook, path),
        #[cfg(unix)]
        TestHook::AfterBumpOp => run_noarg_test_hook(hook, path),
        #[cfg(unix)]
        TestHook::BeforeRevisionBump => run_noarg_test_hook(hook, path),
    }
}

#[cfg(test)]
fn run_noarg_test_hook(hook: TestHook, path: &Path) {
    let hooks_mutex = TEST_HOOKS.get_or_init(|| std::sync::Mutex::new(TestHooks::default()));
    let mut hooks = hooks_mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if !test_hook_scope_matches(&hooks, path) {
        return;
    }
    let mut callback = match hook {
        #[cfg(unix)]
        TestHook::PreBuild => hooks.pre_build.take(),
        #[cfg(unix)]
        TestHook::PostBuild => hooks.post_build.take(),
        #[cfg(unix)]
        TestHook::PreInsert => hooks.pre_insert.take(),
        #[cfg(unix)]
        TestHook::PreGet => hooks.pre_get.take(),
        TestHook::BeforePoolGet => hooks.before_pool_get.take(),
        TestHook::PoolGetFailed => hooks.pool_get_failed.take(),
        TestHook::BoundRefusal => hooks.bound_refusal.take(),
        TestHook::PostGet => hooks.post_get.take(),
        TestHook::AfterOpenCurrent => None,
        TestHook::AfterReadRevision => hooks.after_read_revision.take(),
        #[cfg(unix)]
        TestHook::AfterBumpOp => hooks.after_bump_op.take(),
        #[cfg(unix)]
        TestHook::BeforeRevisionBump => hooks.before_revision_bump.take(),
    };
    let generation = hooks.generation;
    drop(hooks);
    if let Some(mut callback_fn) = callback.take() {
        callback_fn();
        let mut hooks = hooks_mutex
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if hooks.generation == generation {
            match hook {
                #[cfg(unix)]
                TestHook::PreBuild => hooks.pre_build = Some(callback_fn),
                #[cfg(unix)]
                TestHook::PostBuild => hooks.post_build = Some(callback_fn),
                #[cfg(unix)]
                TestHook::PreInsert => hooks.pre_insert = Some(callback_fn),
                #[cfg(unix)]
                TestHook::PreGet => hooks.pre_get = Some(callback_fn),
                TestHook::BeforePoolGet | TestHook::PoolGetFailed | TestHook::BoundRefusal => {}
                TestHook::PostGet | TestHook::AfterOpenCurrent => {}
                TestHook::AfterReadRevision => hooks.after_read_revision = Some(callback_fn),
                #[cfg(unix)]
                TestHook::AfterBumpOp => hooks.after_bump_op = Some(callback_fn),
                #[cfg(unix)]
                TestHook::BeforeRevisionBump => hooks.before_revision_bump = Some(callback_fn),
            }
        }
    }
}

#[cfg(test)]
fn run_after_open_current_test_hook(path: &Path) {
    let hooks_mutex = TEST_HOOKS.get_or_init(|| std::sync::Mutex::new(TestHooks::default()));
    let mut hooks = hooks_mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if !test_hook_scope_matches(&hooks, path) {
        return;
    }
    hooks.open_current_count = hooks.open_current_count.saturating_add(1);
    let (mut callback, count, generation) = (
        hooks.after_open_current.take(),
        hooks.open_current_count,
        hooks.generation,
    );
    drop(hooks);
    if let Some(mut callback_fn) = callback.take() {
        callback_fn(count);
        let mut hooks = hooks_mutex
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if hooks.generation == generation {
            hooks.after_open_current = Some(callback_fn);
        }
    }
}

impl DatabaseEntry {
    fn acquire(self: &Arc<Self>) -> Result<EntryLease, Error> {
        let mut lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?;
        if lifecycle.retiring {
            return Err(Error::Conflict(
                "database is being replaced or deleted".into(),
            ));
        }
        lifecycle.active = lifecycle.active.saturating_add(1);
        Ok(EntryLease {
            entry: self.clone(),
        })
    }

    #[cfg(all(test, unix))]
    fn retire_and_wait(&self, timeout: Duration) -> Result<(), Error> {
        self.retire_and_wait_cancellable(timeout, None)
    }

    fn retire_and_wait_cancellable(
        &self,
        timeout: Duration,
        cancellation: Option<&CancellationToken>,
    ) -> Result<(), Error> {
        let mut lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?;
        lifecycle.retiring = true;
        let deadline = Instant::now() + timeout;
        while lifecycle.active != 0 {
            if cancellation.is_some_and(CancellationToken::is_cancelled) {
                lifecycle.retiring = false;
                self.lifecycle_changed.notify_all();
                return Err(Error::Cancellation);
            }
            let now = Instant::now();
            if now >= deadline {
                lifecycle.retiring = false;
                self.lifecycle_changed.notify_all();
                return Err(Error::Conflict("database retirement timed out".into()));
            }
            let (guard, wait_result) = self
                .lifecycle_changed
                .wait_timeout(
                    lifecycle,
                    if cancellation.is_some() {
                        deadline
                            .saturating_duration_since(now)
                            .min(RETIRE_CANCELLATION_POLL)
                    } else {
                        deadline.saturating_duration_since(now)
                    },
                )
                .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?;
            lifecycle = guard;
            if wait_result.timed_out() && lifecycle.active != 0 && Instant::now() >= deadline {
                lifecycle.retiring = false;
                self.lifecycle_changed.notify_all();
                return Err(Error::Conflict("database retirement timed out".into()));
            }
        }
        if cancellation.is_some_and(CancellationToken::is_cancelled) {
            lifecycle.retiring = false;
            self.lifecycle_changed.notify_all();
            return Err(Error::Cancellation);
        }
        Ok(())
    }

    fn cancel_retirement(&self) -> Result<(), Error> {
        let mut lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?;
        lifecycle.retiring = false;
        self.lifecycle_changed.notify_all();
        Ok(())
    }

    fn is_idle(&self) -> bool {
        self.lifecycle
            .lock()
            .map(|lifecycle| lifecycle.active == 0 && !lifecycle.retiring)
            .unwrap_or(false)
    }
}

#[cfg(test)]
pub(crate) fn test_target(path: &Path) -> crate::infra::path_authority::DatabaseFileTarget {
    crate::infra::path_authority::DatabaseFileTarget::for_test_path(path)
        .expect("test database path must produce a target")
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use diesel::RunQueryDsl;
    use std::{sync::mpsc, time::Duration};

    #[derive(diesel::QueryableByName)]
    struct TestText {
        #[diesel(sql_type = diesel::sql_types::Text)]
        value: String,
    }

    #[test]
    fn aliases_share_one_pool_and_revision_sequence() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let alias = directory.path().join(".").join("database.db3");
        let repository = DatabaseRepository::default();

        let mut connection = repository
            .initialization_connection(&test_target(&path), None)
            .unwrap();
        assert!(!repository.is_building(&test_target(&path)).unwrap());
        migrations::prepare_database(&mut connection, "title", "description").unwrap();
        drop(connection);
        repository
            .mark_schema_validated(&test_target(&path))
            .unwrap();
        repository.connection(&test_target(&alias), None).unwrap();

        assert_eq!(repository.state.lock().unwrap().entries.len(), 1);
        let mut revision_connection = repository
            .initialization_connection(&test_target(&alias), None)
            .unwrap();
        assert_eq!(read_data_revision(&mut revision_connection).unwrap(), 0);
        revision_connection
            .transaction::<_, Error, _>(|db| {
                crate::db::bump_revision_in_transaction(
                    db,
                    &alias,
                    &CancellationToken::new(),
                    |_| Ok(()),
                )
            })
            .unwrap();
        assert_eq!(read_data_revision(&mut revision_connection).unwrap(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn bump_hook_matches_a_canonical_scope_for_a_raw_alias_path() {
        use diesel::connection::SimpleConnection;

        let directory = tempfile::tempdir().unwrap();
        let real_parent = directory.path().join("real");
        std::fs::create_dir(&real_parent).unwrap();
        let linked_parent = directory.path().join("linked");
        std::os::unix::fs::symlink(&real_parent, &linked_parent).unwrap();
        let raw_alias = linked_parent.join("database.db3");
        let scoped_target = test_target(&raw_alias);
        let canonical_scope = scoped_target.path().to_path_buf();
        let mut connection =
            SqliteConnection::establish(canonical_scope.to_str().unwrap()).unwrap();
        connection
            .batch_execute(
                "CREATE TABLE Info (Name TEXT PRIMARY KEY, Value TEXT);\
                 INSERT INTO Info (Name, Value) VALUES ('DataRevision', '0');",
            )
            .unwrap();
        let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed = Arc::clone(&calls);
        let _hooks = configure_test_hooks(&canonical_scope, move |hooks| {
            hooks.after_bump_op = Some(Box::new(move || {
                observed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            }));
        });

        connection
            .transaction::<_, Error, _>(|db| {
                crate::db::bump_revision_in_transaction(
                    db,
                    &raw_alias,
                    &CancellationToken::new(),
                    |_| Ok(()),
                )
            })
            .unwrap();

        assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
    }

    #[cfg(unix)]
    #[test]
    fn hard_link_bindings_have_separate_repository_entries() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let alias = directory.path().join("alias.db3");
        std::fs::File::create(&path).unwrap();
        std::fs::hard_link(&path, &alias).unwrap();
        let repository = DatabaseRepository::default();
        let path_target = test_target(&path);
        let alias_target = test_target(&alias);

        repository
            .initialization_connection(&path_target, None)
            .unwrap();
        repository
            .initialization_connection(&alias_target, None)
            .unwrap();
        let path_entry = repository.entry(&path_target, None).unwrap().1;
        let alias_entry = repository.entry(&alias_target, None).unwrap().1;

        assert!(!Arc::ptr_eq(&path_entry, &alias_entry));
        assert_eq!(repository.state.lock().unwrap().entries.len(), 2);
    }

    #[test]
    fn construction_does_not_hold_the_repository_mutex() {
        let directory = tempfile::tempdir().unwrap();
        let first_path = directory.path().join("first.db3");
        let second_path = directory.path().join("second.db3");
        let first_target = test_target(&first_path);
        let second_target = test_target(&second_path);
        let repository = Arc::new(DatabaseRepository::default());
        let (entered, entered_rx) = mpsc::channel();
        let (release, release_rx) = mpsc::channel();
        let first_build = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let first_build_callback = Arc::clone(&first_build);
        let expected_thread = Arc::new(std::sync::Mutex::new(None));
        let expected_thread_callback = Arc::clone(&expected_thread);
        let _hooks = configure_test_hooks(&first_path, |hooks| {
            hooks.pre_build = Some(Box::new(move || {
                let is_expected_thread =
                    expected_thread_callback.lock().ok().is_some_and(|thread| {
                        thread
                            .as_ref()
                            .is_some_and(|expected| *expected == std::thread::current().id())
                    });
                if is_expected_thread
                    && first_build_callback.swap(false, std::sync::atomic::Ordering::SeqCst)
                {
                    entered.send(()).unwrap();
                    release_rx.recv().unwrap();
                }
            }));
        });

        let worker_repository = Arc::clone(&repository);
        let worker_expected_thread = Arc::clone(&expected_thread);
        let worker = std::thread::spawn(move || {
            *worker_expected_thread.lock().unwrap() = Some(std::thread::current().id());
            worker_repository.initialization_connection(&first_target, None)
        });
        entered_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        let second_started = Instant::now();
        repository
            .initialization_connection(&second_target, None)
            .unwrap();
        assert!(second_started.elapsed() < Duration::from_secs(1));
        release.send(()).unwrap();
        worker.join().unwrap().unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn test_hooks_are_scoped_to_the_database_path() {
        let directory = tempfile::tempdir().unwrap();
        let real_parent = directory.path().join("real");
        std::fs::create_dir(&real_parent).unwrap();
        let linked_parent = directory.path().join("linked");
        std::os::unix::fs::symlink(&real_parent, &linked_parent).unwrap();
        let path_a = linked_parent.join("database-a.db3");
        let path_b = linked_parent.join("database-b.db3");
        let target_a = test_target(&path_a);
        let repository = Arc::new(DatabaseRepository::default());
        let opens = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed = Arc::clone(&opens);
        let _hooks = configure_test_hooks(&path_a, move |hooks| {
            hooks.after_open_current = Some(Box::new(move |_| {
                observed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            }));
        });

        repository
            .initialization_connection(&target_a, None)
            .unwrap();
        let a_opens_before_b = opens.load(std::sync::atomic::Ordering::SeqCst);
        assert!(a_opens_before_b > 0, "database A's hook must fire");

        let worker_repository = Arc::clone(&repository);
        let worker = std::thread::spawn(move || {
            worker_repository.initialization_connection(&test_target(&path_b), None)
        });
        worker.join().unwrap().unwrap();

        assert_eq!(
            opens.load(std::sync::atomic::Ordering::SeqCst),
            a_opens_before_b,
            "opening an unrelated database must not run or count database A's hook"
        );
    }

    struct StaleHookCallback {
        entered: mpsc::Sender<()>,
        release: mpsc::Receiver<()>,
        first_call: Arc<std::sync::atomic::AtomicBool>,
        calls: Arc<std::sync::atomic::AtomicUsize>,
    }

    impl StaleHookCallback {
        fn invoke(&self) {
            self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            if self
                .first_call
                .swap(false, std::sync::atomic::Ordering::SeqCst)
            {
                self.entered.send(()).unwrap();
                self.release.recv().unwrap();
            }
        }
    }

    fn install_stale_hook(hooks: &mut TestHooks, hook: TestHook, callback: StaleHookCallback) {
        match hook {
            TestHook::AfterOpenCurrent => {
                hooks.after_open_current = Some(Box::new(move |_| callback.invoke()));
            }
            TestHook::AfterReadRevision => {
                hooks.after_read_revision = Some(Box::new(move || callback.invoke()));
            }
            _ => unreachable!("stale hook test only supports callback forms"),
        }
    }

    fn install_counting_hook(
        hooks: &mut TestHooks,
        hook: TestHook,
        calls: Arc<std::sync::atomic::AtomicUsize>,
    ) {
        match hook {
            TestHook::AfterOpenCurrent => {
                hooks.after_open_current = Some(Box::new(move |_| {
                    calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                }));
            }
            TestHook::AfterReadRevision => {
                hooks.after_read_revision = Some(Box::new(move || {
                    calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                }));
            }
            _ => unreachable!("stale hook test only supports callback forms"),
        }
    }

    fn stale_hook_writeback_case(hook: TestHook) {
        let directory = tempfile::tempdir().unwrap();
        let path_a = directory.path().join("database-a.db3");
        let path_b = directory.path().join("database-b.db3");
        let (entered, entered_rx) = mpsc::channel();
        let (release, release_rx) = mpsc::channel();
        let a_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed_a_calls = Arc::clone(&a_calls);
        let _a_hooks = configure_test_hooks(&path_a, move |hooks| {
            install_stale_hook(
                hooks,
                hook,
                StaleHookCallback {
                    entered,
                    release: release_rx,
                    first_call: Arc::new(std::sync::atomic::AtomicBool::new(true)),
                    calls: observed_a_calls,
                },
            );
        });

        let worker_path = path_a.clone();
        let worker = std::thread::spawn(move || {
            run_test_hook(hook, &worker_path);
        });
        entered_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        drop(_a_hooks);

        let b_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed_b_calls = Arc::clone(&b_calls);
        let _b_hooks = configure_test_hooks(&path_b, move |hooks| {
            install_counting_hook(hooks, hook, observed_b_calls);
        });

        release.send(()).unwrap();
        worker.join().unwrap();
        run_test_hook(hook, &path_b);

        assert_eq!(
            b_calls.load(std::sync::atomic::Ordering::SeqCst),
            1,
            "database B's callback must run after its configuration"
        );
        assert_eq!(
            a_calls.load(std::sync::atomic::Ordering::SeqCst),
            1,
            "database A's callback must not run during database B's dispatch"
        );
    }

    #[test]
    fn stale_hook_callback_cannot_overwrite_new_configuration() {
        stale_hook_writeback_case(TestHook::AfterOpenCurrent);
    }

    #[test]
    fn stale_noarg_hook_callback_cannot_overwrite_new_configuration() {
        stale_hook_writeback_case(TestHook::AfterReadRevision);
    }

    #[test]
    fn panicking_hook_configuration_does_not_poison_following_configuration() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database-a.db3");
        let fresh_path = directory.path().join("database-b.db3");
        let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed_calls = Arc::clone(&calls);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _hooks = configure_test_hooks(&path, move |hooks| {
                hooks.after_open_current = Some(Box::new(move |_| {
                    observed_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                }));
                panic!("injected hook configuration panic");
            });
        }));
        assert!(result.is_err());
        let repository = DatabaseRepository::default();
        repository
            .initialization_connection(&test_target(&path), None)
            .unwrap();
        assert_eq!(
            calls.load(std::sync::atomic::Ordering::SeqCst),
            0,
            "a hook from a panicking configuration must not remain installed"
        );

        let fresh_calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed_fresh_calls = Arc::clone(&fresh_calls);
        let _hooks = configure_test_hooks(&fresh_path, move |hooks| {
            hooks.after_open_current = Some(Box::new(move |_| {
                observed_fresh_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            }));
        });
        run_test_hook(TestHook::AfterOpenCurrent, &fresh_path);
        assert_eq!(
            fresh_calls.load(std::sync::atomic::Ordering::SeqCst),
            1,
            "a fresh hook must dispatch after mutex poisoning"
        );
    }

    #[test]
    fn cancelled_build_is_not_published() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let target = test_target(&path);
        let repository = Arc::new(DatabaseRepository::default());
        let cancellation = CancellationToken::new();
        let (entered, entered_rx) = mpsc::channel();
        let (release, release_rx) = mpsc::channel();
        let expected_thread = Arc::new(std::sync::Mutex::new(None));
        let expected_thread_callback = Arc::clone(&expected_thread);
        let _hooks = configure_test_hooks(&path, |hooks| {
            hooks.pre_insert = Some(Box::new(move || {
                let is_expected_thread =
                    expected_thread_callback.lock().ok().is_some_and(|thread| {
                        thread
                            .as_ref()
                            .is_some_and(|expected| *expected == std::thread::current().id())
                    });
                if is_expected_thread {
                    entered.send(()).unwrap();
                    release_rx.recv().unwrap();
                }
            }));
        });

        let worker_repository = Arc::clone(&repository);
        let worker_token = cancellation.clone();
        let worker_expected_thread = Arc::clone(&expected_thread);
        let worker = std::thread::spawn(move || {
            *worker_expected_thread.lock().unwrap() = Some(std::thread::current().id());
            worker_repository.connection(&target, Some(&worker_token))
        });
        entered_rx.recv_timeout(Duration::from_secs(1)).unwrap();
        cancellation.cancel();
        release.send(()).unwrap();
        assert!(matches!(worker.join().unwrap(), Err(Error::Cancellation)));
        assert!(repository.state.lock().unwrap().entries.is_empty());
        assert!(!repository.is_building(&test_target(&path)).unwrap());
        drop(_hooks);
        repository
            .initialization_connection(&test_target(&path), None)
            .expect("an uncancelled retry must build a fresh pool");
    }

    #[test]
    fn unlinked_before_get_is_rejected_by_the_prompt_probe() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let target = test_target(&path);
        let repository = DatabaseRepository::default();
        repository.initialization_connection(&target, None).unwrap();
        let expected_thread = Arc::new(std::sync::Mutex::new(None));
        let expected_thread_callback = Arc::clone(&expected_thread);
        let _hooks = configure_test_hooks(&path, |hooks| {
            hooks.pre_get = Some(Box::new({
                let path = path.clone();
                move || {
                    let is_expected_thread =
                        expected_thread_callback.lock().ok().is_some_and(|thread| {
                            thread
                                .as_ref()
                                .is_some_and(|expected| *expected == std::thread::current().id())
                        });
                    if is_expected_thread {
                        std::fs::remove_file(&path).unwrap();
                    }
                }
            }));
        });

        let started = Instant::now();
        *expected_thread.lock().unwrap() = Some(std::thread::current().id());
        let result = repository.initialization_connection(&target, None);
        assert!(matches!(
            result,
            Err(Error::Conflict(message))
                if message == "database changed after capability resolution"
        ));
        assert!(started.elapsed() < Duration::from_secs(1));
        assert!(!path.exists());
        assert!(!repository.is_building(&target).unwrap());
    }

    #[cfg(unix)]
    #[test]
    fn swap_after_get_is_rejected_without_retiring_an_outer_lease() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let saved = directory.path().join("saved.db3");
        let replacement = directory.path().join("replacement.db3");
        std::fs::File::create(&path).unwrap();
        std::fs::hard_link(&path, &saved).unwrap();
        std::fs::File::create(&replacement).unwrap();
        let target = test_target(&path);
        let repository = DatabaseRepository::default();
        drop(repository.initialization_connection(&target, None).unwrap());
        let old_entry = repository.entry(&target, None).unwrap().1;
        let expected_thread = Arc::new(std::sync::Mutex::new(None));
        let expected_thread_callback = Arc::clone(&expected_thread);
        let _hooks = configure_test_hooks(&path, |hooks| {
            hooks.post_get = Some(Box::new({
                let path = path.clone();
                let replacement = replacement.clone();
                move || {
                    let is_expected_thread =
                        expected_thread_callback.lock().ok().is_some_and(|thread| {
                            thread
                                .as_ref()
                                .is_some_and(|expected| *expected == std::thread::current().id())
                        });
                    if is_expected_thread {
                        std::fs::remove_file(&path).unwrap();
                        std::fs::rename(&replacement, &path).unwrap();
                    }
                }
            }));
        });

        *expected_thread.lock().unwrap() = Some(std::thread::current().id());
        let result = repository.with_write_lock(&target, || {
            repository
                .initialization_connection(&target, None)
                .map(|_| ())
        });
        assert!(matches!(
            result,
            Err(Error::Conflict(message))
                if message == "database changed after capability resolution"
        ));
        let key = entry_key(&target).unwrap();
        let current_entry = repository
            .state
            .lock()
            .unwrap()
            .entries
            .get(&key)
            .cloned()
            .unwrap();
        assert!(Arc::ptr_eq(&old_entry, &current_entry));
        assert!(!old_entry.lifecycle.lock().unwrap().retiring);

        drop(_hooks);
        std::fs::remove_file(&path).unwrap();
        std::fs::hard_link(&saved, &path).unwrap();
        repository.close_and_invalidate(&target).unwrap();
    }

    #[test]
    fn stale_probe_confirms_once_then_retires_an_idle_entry() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let replacement = directory.path().join("replacement.db3");
        std::fs::File::create(&path).unwrap();
        std::fs::File::create(&replacement).unwrap();
        let target = test_target(&path);
        let repository = DatabaseRepository::default();
        drop(repository.initialization_connection(&target, None).unwrap());
        std::fs::remove_file(&path).unwrap();
        std::fs::rename(&replacement, &path).unwrap();
        let probe_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let probe_count_callback = Arc::clone(&probe_count);
        let expected_thread = Arc::new(std::sync::Mutex::new(None));
        let expected_thread_callback = Arc::clone(&expected_thread);
        let _hooks = configure_test_hooks(&path, |hooks| {
            hooks.after_open_current = Some(Box::new(move |_| {
                let is_expected_thread =
                    expected_thread_callback.lock().ok().is_some_and(|thread| {
                        thread
                            .as_ref()
                            .is_some_and(|expected| *expected == std::thread::current().id())
                    });
                if is_expected_thread {
                    probe_count_callback.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                }
            }));
        });

        *expected_thread.lock().unwrap() = Some(std::thread::current().id());
        let result = repository.initialization_connection(&target, None);
        assert!(matches!(
            result,
            Err(Error::Conflict(message))
                if message == "database changed after capability resolution"
        ));
        assert_eq!(
            probe_count.load(std::sync::atomic::Ordering::SeqCst),
            2,
            "a conflict gets exactly one confirm probe"
        );
        assert!(repository.state.lock().unwrap().entries.is_empty());
    }

    #[test]
    fn unlinked_before_pool_build_is_a_prompt_conflict_and_clears_building() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let target = test_target(&path);
        let repository = DatabaseRepository::default();
        let expected_thread = Arc::new(std::sync::Mutex::new(None));
        let expected_thread_callback = Arc::clone(&expected_thread);
        let _hooks = configure_test_hooks(&path, |hooks| {
            hooks.pre_build = Some(Box::new({
                let path = path.clone();
                move || {
                    let is_expected_thread =
                        expected_thread_callback.lock().ok().is_some_and(|thread| {
                            thread
                                .as_ref()
                                .is_some_and(|expected| *expected == std::thread::current().id())
                        });
                    if is_expected_thread {
                        std::fs::remove_file(&path).unwrap();
                    }
                }
            }));
        });

        let started = Instant::now();
        *expected_thread.lock().unwrap() = Some(std::thread::current().id());
        let result = repository.initialization_connection(&target, None);
        assert!(matches!(
            result,
            Err(Error::Conflict(message))
                if message == "database changed after capability resolution"
        ));
        assert!(started.elapsed() < Duration::from_secs(1));
        assert!(!path.exists());
        assert!(!repository.is_building(&target).unwrap());
    }

    #[test]
    fn close_evicts_a_database_so_a_replacement_is_revalidated() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let repository = DatabaseRepository::default();
        let mut connection = repository
            .initialization_connection(&test_target(&path), None)
            .unwrap();
        migrations::prepare_database(&mut connection, "title", "description").unwrap();
        drop(connection);
        repository
            .mark_schema_validated(&test_target(&path))
            .unwrap();
        repository
            .close_and_invalidate(&test_target(&path))
            .unwrap();

        assert!(repository.state.lock().unwrap().entries.is_empty());
        repository.connection(&test_target(&path), None).unwrap();
    }

    #[test]
    fn deletion_tombstone_blocks_reacquisition_until_the_terminal_result() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let repository = DatabaseRepository::default();
        let target = test_target(&path);
        let mut connection = repository.initialization_connection(&target, None).unwrap();
        migrations::prepare_database(&mut connection, "title", "description").unwrap();
        drop(connection);
        repository.mark_schema_validated(&target).unwrap();

        repository
            .delete_exclusive(&target, || {
                assert!(matches!(
                    repository.connection(&target, None),
                    Err(Error::Conflict(message)) if message.contains("being deleted")
                ));
                Ok(())
            })
            .unwrap();
        repository.connection(&test_target(&path), None).unwrap();
    }

    #[test]
    fn replacement_at_the_same_path_never_reuses_an_old_pooled_connection() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let replacement = directory.path().join("replacement.db3");
        let repository = DatabaseRepository::default();
        let mut connection = repository
            .initialization_connection(&test_target(&path), None)
            .unwrap();
        migrations::prepare_database(&mut connection, "old", "description").unwrap();
        drop(connection);
        let old_target = test_target(&path);
        repository.mark_schema_validated(&old_target).unwrap();
        let old_entry = repository.entry(&old_target, None).unwrap().1;
        let old_object = old_target.identity();

        let mut replacement_connection = repository
            .initialization_connection(&test_target(&replacement), None)
            .unwrap();
        migrations::prepare_database(&mut replacement_connection, "new", "description").unwrap();
        diesel::connection::SimpleConnection::batch_execute(
            &mut *replacement_connection,
            "PRAGMA wal_checkpoint(TRUNCATE);",
        )
        .unwrap();
        drop(replacement_connection);
        for suffix in ["-wal", "-shm"] {
            let stale = PathBuf::from(format!("{}{}", path.display(), suffix));
            let _ = std::fs::remove_file(stale);
        }
        std::fs::rename(&replacement, &path).unwrap();
        let new_object = crate::infra::path_authority::opened_file_identity(
            &std::fs::File::open(&path).unwrap(),
        )
        .unwrap();
        assert_ne!(old_object, new_object);

        let new_target = test_target(&path);
        let mut connection = repository.connection(&new_target, None).unwrap();
        let new_entry = repository.entry(&new_target, None).unwrap().1;
        assert!(!Arc::ptr_eq(&old_entry, &new_entry));
        let title = diesel::sql_query("SELECT Value AS value FROM Info WHERE Name = 'Title'")
            .get_result::<TestText>(&mut *connection)
            .unwrap();
        assert_eq!(title.value, "new");
    }

    #[test]
    fn active_connection_blocks_delete_until_its_lease_is_released() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let repository = Arc::new(DatabaseRepository::default());
        let target = test_target(&path);
        let mut setup = repository.initialization_connection(&target, None).unwrap();
        migrations::prepare_database(&mut setup, "title", "description").unwrap();
        drop(setup);
        repository.mark_schema_validated(&target).unwrap();
        let active_read = repository.connection(&target, None).unwrap();
        let (started, started_rx) = mpsc::channel();
        let (done, done_rx) = mpsc::channel();
        let repo = repository.clone();
        let delete_path = path.clone();
        std::thread::spawn(move || {
            started.send(()).unwrap();
            let result = repo.delete_exclusive(&test_target(&delete_path), || Ok(()));
            done.send(result.is_ok()).unwrap();
        });
        started_rx.recv().unwrap();
        assert!(done_rx.recv_timeout(Duration::from_millis(100)).is_err());
        drop(active_read);
        assert!(done_rx.recv_timeout(Duration::from_secs(2)).unwrap());
    }

    #[test]
    fn active_connection_delete_wait_cancels_and_restores_admission() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let repository = Arc::new(DatabaseRepository::default());
        let target = test_target(&path);
        let mut setup = repository.initialization_connection(&target, None).unwrap();
        migrations::prepare_database(&mut setup, "title", "description").unwrap();
        drop(setup);
        repository.mark_schema_validated(&target).unwrap();
        let active_read = repository.connection(&target, None).unwrap();
        let cancellation = CancellationToken::new();
        let worker_token = cancellation.clone();
        let worker_repository = Arc::clone(&repository);
        let worker_path = path.clone();
        let (done, done_rx) = mpsc::channel();
        let operation_ran = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let worker_operation_ran = Arc::clone(&operation_ran);
        let worker = std::thread::spawn(move || {
            let result = worker_repository.delete_exclusive_cancellable(
                &test_target(&worker_path),
                &worker_token,
                || {
                    worker_operation_ran.store(true, std::sync::atomic::Ordering::SeqCst);
                    Ok(())
                },
            );
            done.send(result).unwrap();
        });

        let deadline = Instant::now() + Duration::from_secs(2);
        while !repository.deletion_is_waiting(&target).unwrap() {
            assert!(
                Instant::now() < deadline,
                "delete never entered retirement wait"
            );
            std::thread::yield_now();
        }
        cancellation.cancel();
        assert!(matches!(
            done_rx.recv_timeout(Duration::from_secs(1)).unwrap(),
            Err(Error::Cancellation)
        ));
        worker.join().unwrap();
        assert!(!operation_ran.load(std::sync::atomic::Ordering::SeqCst));

        drop(active_read);
        repository.connection(&test_target(&path), None).unwrap();
        repository
            .delete_exclusive(&test_target(&path), || Ok(()))
            .unwrap();
    }

    #[test]
    fn retire_wait_timeout_unwinds_tombstone_and_retiring_flag() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let repository = DatabaseRepository::with_retire_wait(Duration::from_millis(200));
        let target = test_target(&path);
        let mut setup = repository.initialization_connection(&target, None).unwrap();
        migrations::prepare_database(&mut setup, "title", "description").unwrap();
        drop(setup);
        repository.mark_schema_validated(&target).unwrap();
        let held_lease = repository.connection(&target, None).unwrap();

        let result = repository.delete_exclusive(&target, || Ok(()));
        assert!(
            matches!(result, Err(Error::Conflict(ref message)) if message.contains("timed out")),
            "held lease must expire retire_and_wait: {result:?}"
        );

        let key = entry_key(&target).unwrap();
        let state = repository.state.lock().unwrap();
        assert!(
            !state.tombstones.contains(target.path()),
            "timeout must remove the deletion tombstone"
        );
        let entry = state
            .entries
            .get(&key)
            .expect("timeout must leave the entry in the repository")
            .clone();
        drop(state);
        assert!(
            !entry.lifecycle.lock().unwrap().retiring,
            "timeout must clear the retiring flag"
        );

        drop(held_lease);
        repository.connection(&test_target(&path), None).unwrap();
        repository
            .delete_exclusive(&test_target(&path), || Ok(()))
            .unwrap();
    }

    #[test]
    fn lru_never_evicts_an_active_lease() {
        let directory = tempfile::tempdir().unwrap();
        let repository = DatabaseRepository::default();
        let mut leases = Vec::new();
        for index in 0..=MAX_OPEN_DATABASES {
            let path = directory.path().join(format!("{index}.db3"));
            leases.push(
                repository
                    .initialization_connection(&test_target(&path), None)
                    .unwrap(),
            );
        }
        assert_eq!(
            repository.state.lock().unwrap().entries.len(),
            MAX_OPEN_DATABASES + 1
        );
        drop(leases);
    }

    #[test]
    fn production_generation_write_and_index_lock_waits_cancel_while_contended() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let repository = Arc::new(DatabaseRepository::default());
        let connection = repository
            .initialization_connection(&test_target(&path), None)
            .unwrap();
        drop(connection);
        let target = test_target(&path);
        let entry = repository.entry(&target, None).unwrap().1;

        for (name, held) in [
            ("write", entry.write_lock.lock()),
            ("index", entry.index_lock.lock()),
        ] {
            let cancellation = CancellationToken::new();
            let worker_token = cancellation.clone();
            let worker_repository = Arc::clone(&repository);
            let worker_path = path.clone();
            let (done_tx, done_rx) = std::sync::mpsc::channel();
            let worker = std::thread::spawn(move || {
                let result = if name == "write" {
                    worker_repository.with_write_lock_cancellable(
                        &test_target(&worker_path),
                        &worker_token,
                        || Ok(()),
                    )
                } else {
                    worker_repository.with_index_lock_cancellable(
                        &test_target(&worker_path),
                        &worker_token,
                        || Ok(()),
                    )
                };
                let _ = done_tx.send(result);
            });
            cancellation.cancel();
            assert!(matches!(
                done_rx.recv_timeout(Duration::from_secs(1)).unwrap(),
                Err(Error::Cancellation)
            ));
            worker.join().unwrap();
            drop(held);
        }
    }

    fn revision_fixture(initial: i64) -> (tempfile::TempDir, PathBuf, DatabaseRepository) {
        use diesel::connection::SimpleConnection;

        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("revision.db3");
        let mut connection = SqliteConnection::establish(path.to_str().unwrap()).unwrap();
        connection
            .batch_execute("CREATE TABLE Info (Name TEXT PRIMARY KEY, Value TEXT);")
            .unwrap();
        connection
            .batch_execute(&format!(
                "INSERT INTO Info (Name, Value) VALUES ('DataRevision', '{initial}');"
            ))
            .unwrap();
        drop(connection);
        (directory, path, DatabaseRepository::default())
    }

    #[cfg(unix)]
    #[test]
    fn identity_sandwich_rejects_object_swap() {
        let (directory, path, repository) = revision_fixture(0);
        let replacement = directory.path().join("replacement.db3");
        std::fs::write(&replacement, std::fs::read(&path).unwrap()).unwrap();
        let target = test_target(&path);
        let _hooks = configure_test_hooks(&path, {
            let path = path.clone();
            let replacement = replacement.clone();
            move |hooks| {
                hooks.after_open_current = Some(Box::new(move |count| {
                    if count == 1 {
                        std::fs::rename(&replacement, &path).unwrap();
                    }
                }));
            }
        });
        assert!(matches!(
            repository.identity_from_probe(&target, &CancellationToken::new(), true),
            Err(Error::Conflict(_))
        ));
    }

    fn bump_file_revision(path: &Path) {
        let mut connection = SqliteConnection::establish(path.to_str().unwrap()).unwrap();
        connection
            .transaction::<_, Error, _>(|db| {
                crate::db::bump_revision_in_transaction(db, path, &CancellationToken::new(), |_| {
                    Ok(())
                })
            })
            .unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn identity_sandwich_rejects_wal_revision_after_r1() {
        let (_directory, path, repository) = revision_fixture(0);
        let target = test_target(&path);
        let changed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let changed_callback = std::sync::Arc::clone(&changed);
        let _hooks = configure_test_hooks(path.clone(), move |hooks| {
            hooks.after_read_revision = Some(Box::new(move || {
                if !changed_callback.swap(true, std::sync::atomic::Ordering::SeqCst) {
                    bump_file_revision(&path);
                }
            }));
        });
        assert!(matches!(
            repository.identity_from_probe(&target, &CancellationToken::new(), true),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn identity_sandwich_rejects_wal_revision_after_r2() {
        let (_directory, path, repository) = revision_fixture(0);
        let target = test_target(&path);
        let reads = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let reads_callback = std::sync::Arc::clone(&reads);
        let _hooks = configure_test_hooks(path.clone(), move |hooks| {
            hooks.after_read_revision = Some(Box::new(move || {
                if reads_callback.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 1 {
                    bump_file_revision(&path);
                }
            }));
        });
        assert!(matches!(
            repository.identity_from_probe(&target, &CancellationToken::new(), true),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn identity_sandwich_rejects_object_swap_after_r3() {
        let (directory, path, repository) = revision_fixture(0);
        let replacement = directory.path().join("replacement.db3");
        std::fs::write(&replacement, std::fs::read(&path).unwrap()).unwrap();
        let target = test_target(&path);
        let _hooks = configure_test_hooks(&path, {
            let path = path.clone();
            move |hooks| {
                hooks.after_open_current = Some(Box::new(move |count| {
                    if count == 3 {
                        std::fs::rename(&replacement, &path).unwrap();
                    }
                }));
            }
        });
        assert!(matches!(
            repository.identity_from_probe(&target, &CancellationToken::new(), true),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn identity_sandwich_rejects_wal_revision_after_r3() {
        let (_directory, path, repository) = revision_fixture(0);
        let target = test_target(&path);
        let reads = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let reads_callback = std::sync::Arc::clone(&reads);
        let _hooks = configure_test_hooks(path.clone(), move |hooks| {
            hooks.after_read_revision = Some(Box::new(move || {
                if reads_callback.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 2 {
                    bump_file_revision(&path);
                }
            }));
        });
        assert!(matches!(
            repository.identity_from_probe(&target, &CancellationToken::new(), true),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn identity_from_probe_observes_cancellation() {
        {
            let (_directory, path, repository) = revision_fixture(0);
            let target = test_target(&path);
            let cancellation = CancellationToken::new();
            cancellation.cancel();
            let opens = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
            let observed = std::sync::Arc::clone(&opens);
            let _hooks = configure_test_hooks(&path, |hooks| {
                hooks.after_open_current = Some(Box::new(move |_| {
                    observed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                }));
            });
            assert!(matches!(
                repository.identity_from_probe(&target, &cancellation, true),
                Err(Error::Cancellation)
            ));
            assert_eq!(opens.load(std::sync::atomic::Ordering::SeqCst), 0);
        }

        {
            let (_directory, path, repository) = revision_fixture(0);
            let target = test_target(&path);
            let cancellation = CancellationToken::new();
            let callback_token = cancellation.clone();
            let opens = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
            let reads = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
            let observed_opens = std::sync::Arc::clone(&opens);
            let observed_reads = std::sync::Arc::clone(&reads);
            let _hooks = configure_test_hooks(&path, move |hooks| {
                hooks.after_open_current = Some(Box::new(move |_| {
                    observed_opens.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                }));
                hooks.after_read_revision = Some(Box::new(move || {
                    observed_reads.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    callback_token.cancel();
                }));
            });
            assert!(matches!(
                repository.identity_from_probe(&target, &cancellation, true),
                Err(Error::Cancellation)
            ));
            assert_eq!(opens.load(std::sync::atomic::Ordering::SeqCst), 1);
            assert_eq!(reads.load(std::sync::atomic::Ordering::SeqCst), 1);
        }

        {
            let (_directory, path, repository) = revision_fixture(0);
            let target = test_target(&path);
            let cancellation = CancellationToken::new();
            let reads = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
            let observed_reads = std::sync::Arc::clone(&reads);
            let callback_token = cancellation.clone();
            let _hooks = configure_test_hooks(&path, move |hooks| {
                hooks.after_read_revision = Some(Box::new(move || {
                    if observed_reads.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1 == 4 {
                        callback_token.cancel();
                    }
                }));
            });
            assert!(matches!(
                repository.identity_from_probe(&target, &cancellation, true),
                Err(Error::Cancellation)
            ));
            assert_eq!(reads.load(std::sync::atomic::Ordering::SeqCst), 4);
        }
    }

    #[cfg(unix)]
    #[test]
    fn identity_from_probe_cancels_during_read_data_revision() {
        let (_directory, path, repository) = revision_fixture(0);
        let target = test_target(&path);
        let cancellation = CancellationToken::new();
        let revisions = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed = std::sync::Arc::clone(&revisions);
        let _hooks = configure_test_hooks(&path, move |hooks| {
            hooks.after_read_revision = Some(Box::new(move || {
                observed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            }));
        });
        let checkpoints =
            crate::db::sqlite_cancellation::cancel_on_callback(cancellation.clone(), 1);
        let _identity = repository.identity_from_probe(&target, &cancellation, true);
        assert!(checkpoints.load(std::sync::atomic::Ordering::SeqCst) > 0);
        assert!(matches!(_identity, Err(Error::Cancellation)));
        assert_eq!(revisions.load(std::sync::atomic::Ordering::SeqCst), 0);
    }

    #[cfg(unix)]
    #[test]
    fn identity_from_probe_hydrate_false_rejects_mid_probe_tombstone() {
        let (_directory, path, repository) = revision_fixture(0);
        let target = test_target(&path);
        let repository = std::sync::Arc::new(repository);
        let callback_repository = std::sync::Arc::clone(&repository);
        let callback_path = path.clone();
        let _hooks = configure_test_hooks(&path, move |hooks| {
            hooks.after_open_current = Some(Box::new(move |count| {
                if count == 1 {
                    callback_repository
                        .state
                        .lock()
                        .unwrap()
                        .tombstones
                        .insert(callback_path.clone());
                }
            }));
        });
        assert!(matches!(
            repository.identity_from_probe(&target, &CancellationToken::new(), false),
            Err(Error::Conflict(message)) if message == "database is being deleted"
        ));
    }

    #[cfg(unix)]
    #[test]
    fn identity_from_probe_hydrate_true_rejects_terminal_tombstone() {
        let (_directory, path, repository) = revision_fixture(0);
        let target = test_target(&path);
        let repository = std::sync::Arc::new(repository);
        let callback_repository = std::sync::Arc::clone(&repository);
        let callback_path = path.clone();
        let reads = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed_reads = std::sync::Arc::clone(&reads);
        let _hooks = configure_test_hooks(&path, move |hooks| {
            hooks.after_read_revision = Some(Box::new(move || {
                if observed_reads.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1 == 4 {
                    let mut state = callback_repository.state.lock().unwrap();
                    state.tombstones.insert(callback_path.clone());
                }
            }));
        });
        assert!(matches!(
            repository.identity_from_probe(&target, &CancellationToken::new(), true),
            Err(Error::Conflict(message)) if message == "database is being deleted"
        ));
        assert_eq!(reads.load(std::sync::atomic::Ordering::SeqCst), 4);
    }

    #[test]
    fn read_data_revision_malformed_is_error() {
        for value in [None, Some("bad"), Some("-1"), Some("9223372036854775808")] {
            let mut connection = SqliteConnection::establish(":memory:").unwrap();
            diesel::connection::SimpleConnection::batch_execute(
                &mut connection,
                "CREATE TABLE Info (Name TEXT PRIMARY KEY, Value TEXT);",
            )
            .unwrap();
            match value {
                Some(value) => diesel::sql_query(format!(
                    "INSERT INTO Info (Name, Value) VALUES ('DataRevision', '{value}');"
                ))
                .execute(&mut connection)
                .unwrap(),
                None => diesel::sql_query(
                    "INSERT INTO Info (Name, Value) VALUES ('DataRevision', NULL);",
                )
                .execute(&mut connection)
                .unwrap(),
            };
            assert!(matches!(
                read_data_revision(&mut connection),
                Err(Error::InvalidInput(message))
                    if message == "DataRevision is not a non-negative i64"
            ));
        }
    }

    #[test]
    fn read_data_revision_missing_table_is_zero() {
        let mut connection = SqliteConnection::establish(":memory:").unwrap();
        assert_eq!(read_data_revision(&mut connection).unwrap(), 0);
    }

    #[test]
    fn read_data_revision_missing_row_is_zero() {
        let mut connection = SqliteConnection::establish(":memory:").unwrap();
        diesel::connection::SimpleConnection::batch_execute(
            &mut connection,
            "CREATE TABLE Info (Name TEXT PRIMARY KEY, Value TEXT);",
        )
        .unwrap();
        assert_eq!(read_data_revision(&mut connection).unwrap(), 0);
    }

    #[test]
    fn read_data_revision_puzzle_schema_without_info_is_zero() {
        let mut connection = SqliteConnection::establish(":memory:").unwrap();
        diesel::connection::SimpleConnection::batch_execute(
            &mut connection,
            "CREATE TABLE puzzles (id INTEGER PRIMARY KEY, fen TEXT, moves TEXT, rating INTEGER, rating_deviation INTEGER, popularity INTEGER, nb_plays INTEGER);",
        )
        .unwrap();
        assert_eq!(read_data_revision(&mut connection).unwrap(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn identity_from_probe_tombstone() {
        let (_directory, path, repository) = revision_fixture(0);
        let target = test_target(&path);
        let opens = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed = std::sync::Arc::clone(&opens);
        let _hooks = configure_test_hooks(&path, |hooks| {
            hooks.after_open_current = Some(Box::new(move |_| {
                observed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            }));
        });
        repository
            .state
            .lock()
            .unwrap()
            .tombstones
            .insert(path.clone());
        assert!(matches!(
            repository.identity_from_probe(&target, &CancellationToken::new(), true),
            Err(Error::Conflict(message)) if message == "database is being deleted"
        ));
        assert_eq!(opens.load(std::sync::atomic::Ordering::SeqCst), 0);
    }

    #[test]
    fn data_changed_overflow_is_error() {
        let (_directory, _path, repository) = revision_fixture(i64::MAX);
        let target = test_target(&_path);
        let mut connection = repository.initialization_connection(&target, None).unwrap();
        let result = connection.transaction::<_, Error, _>(|db| {
            crate::db::bump_revision_in_transaction(db, &_path, &CancellationToken::new(), |_| {
                Ok(())
            })
        });
        assert!(matches!(
            result,
            Err(Error::InvalidInput(message)) if message == "DataRevision overflow"
        ));
        let mut check = SqliteConnection::establish(_path.to_str().unwrap()).unwrap();
        assert_eq!(read_data_revision(&mut check).unwrap(), i64::MAX as u64);
    }

    #[test]
    fn identity_from_probe_source_has_no_pool() {
        let source = include_str!("repository.rs");
        let body = source
            .split("pub(crate) fn identity_from_probe")
            .nth(1)
            .unwrap()
            .split("fn tombstone_conflict")
            .next()
            .unwrap();
        assert!(!body.contains("Pool::builder"));
        assert!(!body.contains("entry("));
        assert!(!body.contains("repository.connection("));
    }
}

#[cfg(test)]
mod bound_sqlite_witnesses {
    use super::*;
    use crate::{
        db::bound_sqlite::{BoundDatabase, SqliteMode},
        infra::path_authority::database_test_support::replace_parent_with_same_inode_hard_link,
    };
    use diesel::connection::SimpleConnection as _;
    use rusqlite::Connection;
    use std::{
        collections::BTreeSet,
        ffi::OsStr,
        fs,
        path::{Path, PathBuf},
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc, Mutex,
        },
    };

    #[derive(Clone, Debug, Default, Eq, PartialEq)]
    struct SidecarListing {
        held: BTreeSet<String>,
        replacement: BTreeSet<String>,
    }

    struct ParentSwapGuard {
        path: PathBuf,
        held_parent: PathBuf,
    }

    impl ParentSwapGuard {
        fn replace(path: &Path) -> Self {
            let held_parent = replace_parent_with_same_inode_hard_link(path);
            Self {
                path: path.to_path_buf(),
                held_parent,
            }
        }

        fn listing(&self, leaf: &str) -> SidecarListing {
            SidecarListing {
                held: sidecar_listing(&self.held_parent, leaf),
                replacement: sidecar_listing(self.path.parent().expect("database parent"), leaf),
            }
        }

        fn restore(&mut self) {
            let parent = self.path.parent().expect("database parent");
            if self.held_parent.exists() {
                let _ = fs::remove_dir_all(parent);
                fs::rename(&self.held_parent, parent).expect("restore authorized parent");
            }
        }
    }

    impl Drop for ParentSwapGuard {
        fn drop(&mut self) {
            self.restore();
        }
    }

    struct LeafSwapGuard {
        path: PathBuf,
        backup: PathBuf,
        replacement: PathBuf,
    }

    impl LeafSwapGuard {
        fn new(path: &Path, replacement: &Path) -> Self {
            let backup = path.with_file_name(format!(
                "{}.leaf-swap-original",
                path.file_name().expect("database leaf").to_string_lossy()
            ));
            Self {
                path: path.to_path_buf(),
                backup,
                replacement: replacement.to_path_buf(),
            }
        }

        fn swap_to_replacement(&mut self) {
            if self.backup.exists() {
                return;
            }
            fs::rename(&self.path, &self.backup).expect("move authorized database aside");
            fs::hard_link(&self.replacement, &self.path).expect("link replacement database");
        }

        fn restore(&mut self) {
            if self.backup.exists() {
                let _ = fs::remove_file(&self.path);
                fs::rename(&self.backup, &self.path).expect("restore authorized database leaf");
            }
        }
    }

    impl Drop for LeafSwapGuard {
        fn drop(&mut self) {
            self.restore();
        }
    }

    fn sidecar_listing(parent: &Path, leaf: &str) -> BTreeSet<String> {
        let names = [
            format!("{leaf}-wal"),
            format!("{leaf}-shm"),
            format!("{leaf}-journal"),
        ];
        fs::read_dir(parent)
            .expect("list database parent")
            .filter_map(Result::ok)
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|entry| names.iter().any(|name| name == entry))
            .collect()
    }

    fn seed_database(path: &Path, revision: i64, journal_mode: &str) {
        let connection = Connection::open(path).expect("open database fixture");
        connection
            .execute_batch(&format!(
                "PRAGMA journal_mode = {journal_mode};\
                 CREATE TABLE Info (Name TEXT PRIMARY KEY, Value TEXT);\
                 INSERT INTO Info (Name, Value) VALUES ('DataRevision', '{revision}');"
            ))
            .expect("seed database fixture");
    }

    fn read_revision_from_plain_path(path: &Path) -> u64 {
        let connection = Connection::open(path).expect("open fixture to inspect revision");
        connection
            .query_row(
                "SELECT CAST(Value AS INTEGER) FROM Info WHERE Name = 'DataRevision'",
                [],
                |row| row.get(0),
            )
            .expect("read fixture revision")
    }

    fn journal_mode(path: &Path) -> String {
        let connection = Connection::open(path).expect("open fixture to inspect journal mode");
        connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .expect("read fixture journal mode")
    }

    fn new_database_parent(root: &Path) -> PathBuf {
        let parent = root.join("authorized");
        fs::create_dir(&parent).expect("create database parent");
        parent
    }

    #[cfg(target_os = "linux")]
    fn assert_sqlite_shared_read_lock_is_held(path: &Path) {
        use std::os::fd::AsRawFd;

        const PENDING_BYTE: libc::off_t = 0x4000_0000;
        const SHARED_FIRST: libc::off_t = PENDING_BYTE + 2;
        const SHARED_SIZE: libc::off_t = 510;

        let probe = fs::File::open(path).expect("open database inode for lock probe");
        let mut lock: libc::flock = unsafe { std::mem::zeroed() };
        lock.l_type = libc::F_WRLCK as _;
        lock.l_whence = libc::SEEK_SET as _;
        lock.l_start = SHARED_FIRST;
        lock.l_len = SHARED_SIZE;
        lock.l_pid = 0;
        let result = unsafe { libc::fcntl(probe.as_raw_fd(), libc::F_OFD_GETLK, &mut lock) };
        assert_eq!(result, 0, "query SQLite shared-byte locks");
        assert_ne!(
            lock.l_type,
            libc::F_UNLCK as libc::c_short,
            "a fresh descriptor must still see the held SQLite read lock"
        );
    }

    #[test]
    fn pool_parent_swap_keeps_wal_and_shm_in_held_parent_and_unlinks_them_there() {
        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join("pool.db3");
        seed_database(&path, 3, "WAL");
        let target = test_target(&path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        let repository = DatabaseRepository::default();
        let swap = Arc::new(Mutex::new(None));
        let observed = Arc::new(Mutex::new(None));
        let swap_path = path.clone();
        let swap_before = Arc::clone(&swap);
        let swap_after = Arc::clone(&swap);
        let observed_after = Arc::clone(&observed);
        let leaf = "pool.db3".to_owned();
        let _hooks = configure_test_hooks(&path, move |hooks| {
            hooks.before_pool_get = Some(Box::new(move || {
                *swap_before.lock().unwrap() = Some(ParentSwapGuard::replace(&swap_path));
            }));
            hooks.post_get = Some(Box::new(move || {
                if let Some(swap) = swap_after.lock().unwrap().as_ref() {
                    *observed_after.lock().unwrap() = Some(swap.listing(&leaf));
                }
            }));
        });

        assert!(matches!(
            repository.initialization_connection(&target, None),
            Err(Error::Conflict(_))
        ));
        let during = observed
            .lock()
            .unwrap()
            .clone()
            .expect("post-get observation");
        assert!(during.held.contains("pool.db3-wal"), "{during:?}");
        assert!(during.held.contains("pool.db3-shm"), "{during:?}");
        assert!(during.replacement.is_empty(), "{during:?}");
        assert!(bound
            .opened_names()
            .iter()
            .any(|name| name == OsStr::new("pool.db3-wal")));

        let mut swap = swap.lock().unwrap().take().expect("parent swap");
        assert!(!sidecar_listing(&swap.held_parent, "pool.db3")
            .iter()
            .any(|name| name.ends_with("-wal") || name.ends_with("-shm")));
        assert!(sidecar_listing(path.parent().unwrap(), "pool.db3").is_empty());
        drop(bound);
        swap.restore();
    }

    #[test]
    fn revision_parent_swap_reads_the_existing_wal_from_the_held_parent() {
        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join("revision.db3");
        seed_database(&path, 1, "WAL");
        let writer = Connection::open(&path).unwrap();
        writer
            .execute_batch("PRAGMA wal_autocheckpoint = 0;")
            .unwrap();
        writer
            .execute(
                "UPDATE Info SET Value = '23' WHERE Name = 'DataRevision'",
                [],
            )
            .unwrap();
        let target = test_target(&path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        let repository = DatabaseRepository::default();
        let swap = Arc::new(Mutex::new(None));
        let observed = Arc::new(Mutex::new(None));
        let swap_path = path.clone();
        let swap_after_probe = Arc::clone(&swap);
        let swap_after_read = Arc::clone(&swap);
        let observed_after_read = Arc::clone(&observed);
        let leaf = "revision.db3".to_owned();
        let _hooks = configure_test_hooks(&path, move |hooks| {
            hooks.after_open_current = Some(Box::new(move |count| {
                if count == 1 {
                    *swap_after_probe.lock().unwrap() = Some(ParentSwapGuard::replace(&swap_path));
                }
            }));
            hooks.after_read_revision = Some(Box::new(move || {
                if let Some(swap) = swap_after_read.lock().unwrap().as_ref() {
                    *observed_after_read.lock().unwrap() = Some(swap.listing(&leaf));
                }
            }));
        });

        let pre_swap = repository.open_current(&target).unwrap();
        drop(pre_swap);
        assert_eq!(
            repository
                .read_revision(&target, &CancellationToken::new())
                .unwrap(),
            23
        );
        assert!(matches!(
            repository.database_identity(&target),
            Err(Error::Conflict(_))
        ));
        let during = observed
            .lock()
            .unwrap()
            .clone()
            .expect("revision observation");
        assert!(during.held.contains("revision.db3-wal"), "{during:?}");
        assert!(during.held.contains("revision.db3-shm"), "{during:?}");
        assert!(during.replacement.is_empty(), "{during:?}");
        assert!(bound
            .opened_names()
            .iter()
            .any(|name| name == OsStr::new("revision.db3-wal")));

        let mut swap = swap.lock().unwrap().take().expect("parent swap");
        assert!(sidecar_listing(path.parent().unwrap(), "revision.db3").is_empty());
        drop(writer);
        drop(bound);
        swap.restore();
    }

    #[test]
    fn zero_length_rollback_journal_is_absent_for_revision_read() {
        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join("empty-journal.db3");
        seed_database(&path, 17, "DELETE");
        let journal = PathBuf::from(format!("{}-journal", path.to_string_lossy()));
        fs::File::create(&journal).expect("create empty rollback journal");

        let target = test_target(&path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        let repository = DatabaseRepository::default();
        assert_eq!(
            repository
                .read_revision(&target, &CancellationToken::new())
                .unwrap(),
            17
        );
        assert!(!bound
            .opened_names()
            .iter()
            .any(|name| name == OsStr::new("empty-journal.db3-journal")));
    }

    #[test]
    fn rollback_mode_pool_conversion_opens_journal_only_in_the_held_parent() {
        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join("rollback.db3");
        seed_database(&path, 4, "DELETE");
        let target = test_target(&path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        let repository = DatabaseRepository::default();
        let swap = Arc::new(Mutex::new(None));
        let observed = Arc::new(Mutex::new(None));
        let swap_path = path.clone();
        let swap_before = Arc::clone(&swap);
        let swap_after = Arc::clone(&swap);
        let observed_after = Arc::clone(&observed);
        let leaf = "rollback.db3".to_owned();
        let _hooks = configure_test_hooks(&path, move |hooks| {
            hooks.before_pool_get = Some(Box::new(move || {
                *swap_before.lock().unwrap() = Some(ParentSwapGuard::replace(&swap_path));
            }));
            hooks.post_get = Some(Box::new(move || {
                if let Some(swap) = swap_after.lock().unwrap().as_ref() {
                    *observed_after.lock().unwrap() = Some(swap.listing(&leaf));
                }
            }));
        });

        assert!(matches!(
            repository.initialization_connection(&target, None),
            Err(Error::Conflict(_))
        ));
        let during = observed
            .lock()
            .unwrap()
            .clone()
            .expect("post-get observation");
        assert!(!during.held.contains("rollback.db3-journal"), "{during:?}");
        assert!(during.replacement.is_empty(), "{during:?}");
        assert!(bound
            .opened_names()
            .iter()
            .any(|name| name == OsStr::new("rollback.db3-journal")));
        assert_eq!(journal_mode(&path), "wal");

        let mut swap = swap.lock().unwrap().take().expect("parent swap");
        assert!(sidecar_listing(&swap.held_parent, "rollback.db3").is_empty());
        assert!(sidecar_listing(path.parent().unwrap(), "rollback.db3").is_empty());
        drop(bound);
        swap.restore();
    }

    struct HotJournalFixture {
        root: tempfile::TempDir,
        path: PathBuf,
        _writer: Connection,
    }

    fn hot_journal_fixture(name: &str) -> HotJournalFixture {
        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join(format!("{name}.db3"));
        let source = root.path().join(format!("{name}-source.db3"));
        let writer = Connection::open(&source).unwrap();
        writer
            .execute_batch(
                "PRAGMA journal_mode = DELETE;\
                 PRAGMA synchronous = FULL;\
                 PRAGMA cache_size = 1;\
                 PRAGMA cache_spill = ON;\
                 CREATE TABLE Payload (Id INTEGER PRIMARY KEY, Data BLOB);\
                 INSERT INTO Payload (Data) VALUES (zeroblob(8192));",
            )
            .unwrap();
        for _ in 0..80 {
            writer
                .execute("INSERT INTO Payload (Data) VALUES (zeroblob(8192))", [])
                .unwrap();
        }
        writer
            .execute_batch(
                "CREATE TABLE Info (Name TEXT PRIMARY KEY, Value TEXT);\
                 INSERT INTO Info (Name, Value) VALUES ('DataRevision', '1');\
                 BEGIN IMMEDIATE;\
                 UPDATE Info SET Value = '2' WHERE Name = 'DataRevision';\
                 UPDATE Payload SET Data = randomblob(8192);",
            )
            .unwrap();
        let source_journal = PathBuf::from(format!("{}-journal", source.to_string_lossy()));
        assert!(fs::metadata(&source_journal).unwrap().len() > 512);
        fs::copy(&source, &path).unwrap();
        let destination_journal = PathBuf::from(format!("{}-journal", path.to_string_lossy()));
        fs::copy(source_journal, destination_journal).unwrap();
        HotJournalFixture {
            root,
            path,
            _writer: writer,
        }
    }

    #[test]
    fn revision_read_does_not_skip_a_held_hot_journal_after_parent_swap() {
        let fixture = hot_journal_fixture("revision-hot");
        let target = test_target(&fixture.path);
        let repository = DatabaseRepository::default();
        let swap = Arc::new(Mutex::new(None));
        let hot_path = fixture.path.clone();
        let swap_after_probe = Arc::clone(&swap);
        let _hooks = configure_test_hooks(&fixture.path, move |hooks| {
            hooks.after_open_current = Some(Box::new(move |count| {
                if count == 1 {
                    *swap_after_probe.lock().unwrap() = Some(ParentSwapGuard::replace(&hot_path));
                }
            }));
        });
        let pre_swap = repository.open_current(&target).unwrap();
        drop(pre_swap);
        let result = repository.read_revision(&target, &CancellationToken::new());
        assert!(
            !matches!(result, Ok(2)),
            "hot journal returned spilled revision: {result:?}"
        );
        let mut swap = swap.lock().unwrap().take().expect("parent swap");
        let held = sidecar_listing(&swap.held_parent, "revision-hot.db3");
        let replacement = sidecar_listing(fixture.path.parent().unwrap(), "revision-hot.db3");
        assert!(held.contains("revision-hot.db3-journal"), "{held:?}");
        assert!(replacement.is_empty(), "{replacement:?}");
        drop(target);
        swap.restore();
        let _ = fixture.root.path();
    }

    #[test]
    fn read_write_pool_rolls_back_held_hot_journal_and_removes_it_from_held_parent() {
        let fixture = hot_journal_fixture("pool-hot");
        let target = test_target(&fixture.path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        let repository = DatabaseRepository::default();
        let swap = Arc::new(Mutex::new(None));
        let observed = Arc::new(Mutex::new(None));
        let hot_path = fixture.path.clone();
        let swap_before = Arc::clone(&swap);
        let swap_after = Arc::clone(&swap);
        let observed_after = Arc::clone(&observed);
        let leaf = "pool-hot.db3".to_owned();
        let _hooks = configure_test_hooks(&fixture.path, move |hooks| {
            hooks.before_pool_get = Some(Box::new(move || {
                *swap_before.lock().unwrap() = Some(ParentSwapGuard::replace(&hot_path));
            }));
            hooks.post_get = Some(Box::new(move || {
                if let Some(swap) = swap_after.lock().unwrap().as_ref() {
                    *observed_after.lock().unwrap() = Some(swap.listing(&leaf));
                }
            }));
        });

        assert!(matches!(
            repository.initialization_connection(&target, None),
            Err(Error::Conflict(_))
        ));
        let during = observed
            .lock()
            .unwrap()
            .clone()
            .expect("post-get observation");
        assert!(!during.held.contains("pool-hot.db3-journal"), "{during:?}");
        assert!(during.replacement.is_empty(), "{during:?}");
        let mut swap = swap.lock().unwrap().take().expect("parent swap");
        assert!(sidecar_listing(&swap.held_parent, "pool-hot.db3").is_empty());
        assert!(sidecar_listing(fixture.path.parent().unwrap(), "pool-hot.db3").is_empty());
        drop(bound);
        swap.restore();
        assert_eq!(read_revision_from_plain_path(&fixture.path), 1);
        let _ = fixture.root.path();
    }

    #[test]
    fn leaf_a_to_b_to_a_refusal_is_conflict_and_restores_the_authorized_leaf() {
        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join("leaf.db3");
        let b_path = parent.join("replacement.db3");
        seed_database(&path, 11, "WAL");
        seed_database(&b_path, 22, "WAL");
        let target = test_target(&path);
        let repository = DatabaseRepository::default();
        let leaf_swap = Arc::new(Mutex::new(LeafSwapGuard::new(&path, &b_path)));
        let after_open = Arc::clone(&leaf_swap);
        let after_read = Arc::clone(&leaf_swap);
        let on_refusal = Arc::clone(&leaf_swap);
        let refusal_seen = Arc::new(AtomicBool::new(false));
        let refusal_seen_hook = Arc::clone(&refusal_seen);
        let _hooks = configure_test_hooks(&path, move |hooks| {
            hooks.after_open_current = Some(Box::new(move |_| {
                after_open.lock().unwrap().swap_to_replacement();
            }));
            hooks.after_read_revision = Some(Box::new(move || {
                #[cfg(unix)]
                after_read.lock().unwrap().restore();
                #[cfg(windows)]
                let _ = &after_read;
            }));
            hooks.bound_refusal = Some(Box::new(move || {
                refusal_seen_hook.store(true, Ordering::SeqCst);
                on_refusal.lock().unwrap().restore();
            }));
        });

        assert!(matches!(
            repository.database_identity(&target),
            Err(Error::Conflict(_))
        ));
        assert!(refusal_seen.load(Ordering::SeqCst));
        assert_eq!(read_revision_from_plain_path(&path), 11);
        leaf_swap.lock().unwrap().restore();
    }

    #[test]
    fn pool_refusal_counter_maps_r2d2_failure_to_conflict_and_retires_entry() {
        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join("pool-refusal.db3");
        let b_path = parent.join("replacement.db3");
        seed_database(&path, 1, "WAL");
        seed_database(&b_path, 9, "DELETE");
        let target = test_target(&path);
        let repository = DatabaseRepository::default();
        let leaf_swap = Arc::new(Mutex::new(LeafSwapGuard::new(&path, &b_path)));
        let before_pool = Arc::clone(&leaf_swap);
        let after_failure = Arc::clone(&leaf_swap);
        let failed_hook_seen = Arc::new(AtomicBool::new(false));
        let failed_hook = Arc::clone(&failed_hook_seen);
        let refusal_hook_seen = Arc::new(AtomicBool::new(false));
        let refusal_hook = Arc::clone(&refusal_hook_seen);
        let _hooks = configure_test_hooks(&path, move |hooks| {
            hooks.before_pool_get = Some(Box::new(move || {
                before_pool.lock().unwrap().swap_to_replacement();
            }));
            hooks.pool_get_failed = Some(Box::new(move || {
                failed_hook.store(true, Ordering::SeqCst);
                after_failure.lock().unwrap().restore();
            }));
            hooks.bound_refusal = Some(Box::new(move || {
                refusal_hook.store(true, Ordering::SeqCst);
            }));
        });

        assert!(matches!(
            repository.initialization_connection(&target, None),
            Err(Error::Conflict(_))
        ));
        assert!(failed_hook_seen.load(Ordering::SeqCst));
        assert!(refusal_hook_seen.load(Ordering::SeqCst));
        let key = entry_key(&target).unwrap();
        assert!(!repository.state.lock().unwrap().entries.contains_key(&key));
        assert_eq!(journal_mode(&b_path), "delete");
        leaf_swap.lock().unwrap().restore();
    }

    #[test]
    fn bound_refusal_keeps_an_unchanged_permission_failure_non_conflict() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let root = tempfile::tempdir().unwrap();
            let parent = new_database_parent(root.path());
            let path = parent.join("unreadable.db3");
            seed_database(&path, 1, "WAL");
            let target = test_target(&path);
            fs::set_permissions(&path, fs::Permissions::from_mode(0o0)).unwrap();
            let repository = DatabaseRepository::default();
            let result = repository.initialization_connection(&target, None);
            let bound = BoundDatabase::acquire(&target).unwrap();
            let refusal_count = bound.refusal_count();
            let permission_error = Error::Io(Box::new(std::io::Error::from(
                std::io::ErrorKind::PermissionDenied,
            )));
            let classified = repository.classify_bound_open_error(
                &target,
                &bound,
                refusal_count,
                permission_error,
            );
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
            assert!(matches!(
                result,
                Err(Error::Io(source))
                    if source.kind() == std::io::ErrorKind::PermissionDenied
            ));
            assert!(matches!(
                classified,
                Error::Io(source) if source.kind() == std::io::ErrorKind::PermissionDenied
            ));

            let probed_io_error = classify_bound_open_error_result(
                false,
                || {
                    Err(Error::Io(Box::new(std::io::Error::from(
                        std::io::ErrorKind::PermissionDenied,
                    ))))
                },
                Error::InvalidInput("less specific SQLite establish failure".into()),
            );
            assert!(matches!(
                probed_io_error,
                Error::Io(source) if source.kind() == std::io::ErrorKind::PermissionDenied
            ));
        }
    }

    #[cfg(unix)]
    #[test]
    fn leaf_identity_stat_refuses_a_parked_descriptor_for_another_inode() {
        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join("cached.db3");
        let b_path = parent.join("replacement.db3");
        seed_database(&path, 1, "DELETE");
        seed_database(&b_path, 2, "DELETE");
        let target = test_target(&path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        let mut leaf_swap = LeafSwapGuard::new(&path, &b_path);
        leaf_swap.swap_to_replacement();

        let first =
            Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        let second =
            Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        second.execute_batch("BEGIN;").unwrap();
        second
            .query_row(
                "SELECT Value FROM Info WHERE Name='DataRevision'",
                [],
                |row| row.get::<_, String>(0),
            )
            .unwrap();
        first
            .query_row(
                "SELECT Value FROM Info WHERE Name='DataRevision'",
                [],
                |row| row.get::<_, String>(0),
            )
            .unwrap();
        drop(first);

        let result = Connection::open_with_flags(
            bound.uri(SqliteMode::ReadOnly).unwrap(),
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_URI,
        );
        assert!(result.is_err());
        assert!(bound.refusal_count() > 0);
        #[cfg(target_os = "linux")]
        assert_sqlite_shared_read_lock_is_held(&b_path);
        drop(second);
        drop(bound);
        leaf_swap.restore();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn post_open_leaf_swap_quarantines_foreign_descriptor_without_dropping_locks() {
        use crate::db::bound_sqlite::quarantined_descriptor_fds;

        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path_a = parent.join("race-a.db3");
        let path_b = parent.join("race-b.db3");
        seed_database(&path_a, 1, "DELETE");
        seed_database(&path_b, 2, "DELETE");
        let target_a = test_target(&path_a);
        let target_b = test_target(&path_b);
        let bound_a = BoundDatabase::acquire(&target_a).unwrap();
        let bound_b = BoundDatabase::acquire(&target_b).unwrap();
        let b_identity = target_b.identity();

        let b_reader =
            Connection::open_with_flags(&path_b, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
                .unwrap();
        b_reader.execute_batch("BEGIN;").unwrap();
        b_reader
            .query_row(
                "SELECT Value FROM Info WHERE Name='DataRevision'",
                [],
                |row| row.get::<_, String>(0),
            )
            .unwrap();

        let swap = Arc::new(Mutex::new(LeafSwapGuard::new(&path_a, &path_b)));
        let swap_in_hook = Arc::clone(&swap);
        bound_a
            .set_before_openat_hook(move || {
                swap_in_hook.lock().unwrap().swap_to_replacement();
            })
            .unwrap();

        let result =
            DatabaseRepository::default().read_revision(&target_a, &CancellationToken::new());
        assert!(matches!(result, Err(Error::Conflict(_))), "{result:?}");
        assert!(bound_a.refusal_count() > 0);
        assert_sqlite_shared_read_lock_is_held(&path_b);

        let quarantined = quarantined_descriptor_fds(b_identity);
        assert!(
            !quarantined.is_empty(),
            "post-open descriptor was not quarantined"
        );
        for fd in &quarantined {
            assert_ne!(unsafe { libc::fcntl(*fd, libc::F_GETFD) }, -1);
        }

        drop(b_reader);
        drop(bound_a);
        drop(bound_b);
        // Observed through the registry: a closed descriptor number can be reused at once by a
        // parallel test.
        assert!(quarantined_descriptor_fds(b_identity).is_empty());
        let mut swap = swap.lock().unwrap();
        swap.restore();
    }

    #[cfg(windows)]
    #[test]
    fn windows_reparse_sidecar_is_reported_as_present_but_never_followed() {
        use std::os::windows::fs::symlink_file;

        let root = tempfile::tempdir().unwrap();
        let parent = new_database_parent(root.path());
        let path = parent.join("reparse.db3");
        let baseline = parent.join("baseline.db3");
        let wal_copy = parent.join("external-wal");
        seed_database(&path, 1, "WAL");
        fs::copy(&path, &baseline).unwrap();
        let writer = Connection::open(&path).unwrap();
        writer
            .execute_batch("PRAGMA wal_autocheckpoint=0;")
            .unwrap();
        writer
            .execute("UPDATE Info SET Value='2' WHERE Name='DataRevision'", [])
            .unwrap();
        fs::copy(
            PathBuf::from(format!("{}-wal", path.to_string_lossy())),
            &wal_copy,
        )
        .unwrap();
        drop(writer);
        fs::copy(&baseline, &path).unwrap();
        let wal_path = PathBuf::from(format!("{}-wal", path.to_string_lossy()));
        let _ = fs::remove_file(&wal_path);
        symlink_file(&wal_copy, &wal_path).unwrap();
        let target = test_target(&path);
        let repository = DatabaseRepository::default();
        assert!(repository
            .read_revision(&target, &CancellationToken::new())
            .is_err());
    }

    #[test]
    fn bound_uri_mode_is_read_only_for_revision_and_plain_connections_are_unbound() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("uri-check.db3");
        seed_database(&path, 5, "WAL");
        let target = test_target(&path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        assert!(bound.uri(SqliteMode::ReadOnly).unwrap().contains("mode=ro"));
        assert!(bound
            .uri(SqliteMode::ReadWrite)
            .unwrap()
            .contains("mode=rw"));
        let plain = Connection::open(&path).unwrap();
        plain.execute_batch("SELECT 1;").unwrap();
    }

    #[test]
    fn pool_and_revision_reader_share_one_binding_while_wal_is_open() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("shared-wal.db3");
        seed_database(&path, 7, "WAL");
        let target = test_target(&path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        let repository = DatabaseRepository::default();
        let pool_connection = repository.initialization_connection(&target, None).unwrap();
        assert_eq!(
            repository
                .read_revision(&target, &CancellationToken::new())
                .unwrap(),
            7
        );
        let same_binding = BoundDatabase::acquire(&target).unwrap();
        assert_eq!(bound.token(), same_binding.token());
        assert!(bound
            .opened_names()
            .iter()
            .any(|name| name == OsStr::new("shared-wal.db3-wal")));
        drop(pool_connection);
    }

    #[test]
    fn pooled_connection_keeps_the_vfs_registered_until_connection_close() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("binding-lifetime.db3");
        seed_database(&path, 3, "WAL");
        let target = test_target(&path);
        let bound = BoundDatabase::acquire(&target).unwrap();
        let token = bound.token();
        let uri = bound.uri(SqliteMode::ReadWrite).unwrap();
        let pool = Pool::builder()
            .max_size(MAX_CONNECTIONS_PER_DATABASE)
            .min_idle(Some(0))
            .connection_timeout(POOL_CONNECTION_TIMEOUT)
            .connection_customizer(Box::new(ConnectionOptions))
            .build(BoundConnectionManager {
                database: bound.clone(),
                uri,
            })
            .unwrap();
        let mut pooled = pool.get().unwrap();
        drop(bound);
        drop(pool);
        pooled
            .batch_execute(
                "PRAGMA wal_autocheckpoint = 0;\
                 CREATE TABLE Lifetime (Value INTEGER);\
                 INSERT INTO Lifetime VALUES (1);\
                 INSERT INTO Lifetime VALUES (2);",
            )
            .unwrap();
        assert!(
            sidecar_listing(path.parent().unwrap(), "binding-lifetime.db3")
                .contains("binding-lifetime.db3-wal")
        );
        drop(pooled);
        let name = std::ffi::CString::new(format!("chessfable-bound-{token}")).unwrap();
        assert!(unsafe { rusqlite::ffi::sqlite3_vfs_find(name.as_ptr()) }.is_null());
        assert!(sidecar_listing(path.parent().unwrap(), "binding-lifetime.db3").is_empty());
    }
}
