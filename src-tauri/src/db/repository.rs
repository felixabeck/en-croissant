use std::{
    collections::{HashMap, HashSet},
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
    sync::{Arc, Condvar, Mutex},
};

use diesel::{
    r2d2::{ConnectionManager, Pool, PooledConnection},
    Connection, SqliteConnection,
};

use crate::error::Error;

use super::{migrations, ConnectionOptions, DatabaseSchemaIdentity};

const MAX_OPEN_DATABASES: usize = 16;

type SqlitePool = Pool<ConnectionManager<SqliteConnection>>;
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
    Pooled(PooledConnection<ConnectionManager<SqliteConnection>>),
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

/// Keeps the repository entry alive while a caller owns a synchronous write
/// critical section. This prevents LRU eviction from splitting the lock from
/// the pool that is subsequently acquired inside that section.
pub struct DatabaseWriteLease {
    _lease: EntryLease,
    lock: Arc<Mutex<()>>,
}

impl DatabaseWriteLease {
    pub fn lock(&self) -> Result<std::sync::MutexGuard<'_, ()>, Error> {
        self.lock
            .lock()
            .map_err(|_| Error::Conflict("database write lock poisoned".into()))
    }
}

/// Canonical object identity used by caches that consume non-game SQLite
/// databases as well. The filesystem component catches replacement outside
/// this process; `data_revision` is the in-process invalidation sequence.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DatabaseIdentity {
    pub path: PathBuf,
    pub data_revision: u64,
    pub object: (u64, u64),
    pub length: u64,
    pub modified: std::time::SystemTime,
}

struct DatabaseEntry {
    pool: SqlitePool,
    write_lock: Arc<Mutex<()>>,
    index_lock: Arc<Mutex<()>>,
    state: Mutex<EntryState>,
    lifecycle: Mutex<LifecycleState>,
    lifecycle_changed: Condvar,
}

#[derive(Default)]
struct LifecycleState {
    retiring: bool,
    active: usize,
    object: Option<(u64, u64)>,
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
    data_revision: u64,
    last_used: u64,
}

#[derive(Default)]
struct RepositoryState {
    entries: HashMap<PathBuf, Arc<DatabaseEntry>>,
    tombstones: HashSet<PathBuf>,
    clock: u64,
}

/// The sole owner of SQLite pools and per-database lifecycle state.
///
/// Paths are canonical before insertion, so aliases cannot produce separate
/// pools, locks, revisions, or cache invalidations. The bounded LRU eviction
/// only releases idle entries; live callers keep their entry alive via Arc.
#[derive(Default)]
pub struct DatabaseRepository {
    state: Mutex<RepositoryState>,
}

impl DatabaseRepository {
    pub fn connection(&self, path: &Path) -> Result<DatabaseConnection, Error> {
        loop {
            let (canonical, entry) = self.entry(path)?;
            if !entry.path_matches_known_object(&canonical)? {
                self.retire_replaced(&canonical, &entry)?;
                continue;
            }
            let lease = entry.acquire()?;
            let mut connection = entry.pool.get()?;
            if !entry.confirm_current_object(&canonical)? {
                drop(connection);
                drop(lease);
                self.retire_replaced(&canonical, &entry)?;
                continue;
            }
            let identity = DatabaseSchemaIdentity::from_path(&canonical)?;
            let requires_validation = entry
                .state
                .lock()
                .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
                .schema_identity
                .as_ref()
                != Some(&identity);
            if requires_validation {
                migrations::validate_existing_database(&mut connection)?;
                self.mark_schema_validated_entry(&entry, &canonical)?;
            }
            return Ok(DatabaseConnection {
                connection: DatabaseConnectionInner::Pooled(connection),
                _lease: Some(lease),
                _pinned_file: None,
                _authority_snapshot: None,
            });
        }
    }

    pub fn initialization_connection(&self, path: &Path) -> Result<DatabaseConnection, Error> {
        loop {
            let (canonical, entry) = self.entry(path)?;
            if !entry.path_matches_known_object(&canonical)? {
                self.retire_replaced(&canonical, &entry)?;
                continue;
            }
            let lease = entry.acquire()?;
            let connection = entry.pool.get()?;
            if entry.confirm_current_object(&canonical)? {
                return Ok(DatabaseConnection {
                    connection: DatabaseConnectionInner::Pooled(connection),
                    _lease: Some(lease),
                    _pinned_file: None,
                    _authority_snapshot: None,
                });
            }
            drop(connection);
            drop(lease);
            self.retire_replaced(&canonical, &entry)?;
        }
    }

    /// Test-fixture helper for creating non-game SQLite schemas. Production
    /// puzzle reads must use a retained authority descriptor below.
    #[cfg(test)]
    pub fn schema_specific_connection(&self, path: &Path) -> Result<DatabaseConnection, Error> {
        self.initialization_connection(path)
    }

    /// Opens SQLite from a private snapshot copied from the exact descriptor
    /// retained by path authority. SQLite's API accepts pathnames, not file
    /// descriptors, and resolves `/proc/self/fd` back to a mutable filename;
    /// a private snapshot is therefore the portable way to prevent an
    /// A→B→A replacement from redirecting the connection.
    pub fn schema_specific_connection_expected_file(
        &self,
        file: std::fs::File,
        expected_object: (u64, u64),
    ) -> Result<DatabaseConnection, Error> {
        if crate::infra::path_authority::opened_file_identity(&file)? != expected_object {
            return Err(Error::Conflict(
                "database changed after capability resolution".into(),
            ));
        }
        use std::io::{Seek, SeekFrom};

        let mut source = file.try_clone()?;
        source.seek(SeekFrom::Start(0))?;
        let mut snapshot = tempfile::NamedTempFile::new()?;
        std::io::copy(&mut source, snapshot.as_file_mut())?;
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

    pub fn database_identity(&self, path: &Path) -> Result<DatabaseIdentity, Error> {
        let (path, _) = self.entry(path)?;
        let metadata = path.metadata()?;
        let object =
            crate::infra::path_authority::opened_file_identity(&std::fs::File::open(&path)?)?;
        let data_revision = self.data_revision(&path)?;
        Ok(DatabaseIdentity {
            path,
            data_revision,
            object,
            length: metadata.len(),
            modified: metadata.modified()?,
        })
    }

    pub fn database_identity_expected(
        &self,
        path: &Path,
        expected_object: (u64, u64),
    ) -> Result<DatabaseIdentity, Error> {
        let identity = self.database_identity(path)?;
        if identity.object != expected_object {
            return Err(Error::Conflict(
                "database changed after capability resolution".into(),
            ));
        }
        Ok(identity)
    }

    pub fn mark_schema_validated(&self, path: &Path) -> Result<(), Error> {
        let (canonical, entry) = self.entry(path)?;
        self.mark_schema_validated_entry(&entry, &canonical)
    }

    pub fn data_changed(&self, path: &Path) -> Result<u64, Error> {
        let (_, entry) = self.entry(path)?;
        let mut state = entry
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
        state.data_revision = state.data_revision.saturating_add(1);
        Ok(state.data_revision)
    }

    pub fn data_revision(&self, path: &Path) -> Result<u64, Error> {
        let (_, entry) = self.entry(path)?;
        let revision = entry
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .data_revision;
        Ok(revision)
    }

    pub fn with_write_lock<T>(
        &self,
        path: &Path,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        let (_, entry) = self.entry(path)?;
        let _lease = entry.acquire()?;
        let _guard = entry
            .write_lock
            .lock()
            .map_err(|_| Error::Conflict("database write lock poisoned".into()))?;
        operation()
    }

    pub fn write_lease(&self, path: &Path) -> Result<DatabaseWriteLease, Error> {
        let (_, entry) = self.entry(path)?;
        Ok(DatabaseWriteLease {
            lock: entry.write_lock.clone(),
            _lease: entry.acquire()?,
        })
    }

    pub fn with_index_lock<T>(
        &self,
        path: &Path,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        let (_, entry) = self.entry(path)?;
        let _lease = entry.acquire()?;
        let _guard = entry
            .index_lock
            .lock()
            .map_err(|_| Error::Conflict("database index lock poisoned".into()))?;
        operation()
    }

    /// Evicts every resource owned by this canonical database. A future open
    /// receives a fresh pool and therefore cannot use a deleted/replaced file.
    #[cfg(test)]
    pub fn close_and_invalidate(&self, path: &Path) -> Result<(), Error> {
        let canonical = canonical_database_path(path)?;
        let entry = self.remove_entry(&canonical)?;
        if let Some(entry) = entry {
            entry.retire_and_wait()?;
        }
        Ok(())
    }

    /// Reserves a database name before unlinking it so no concurrent command
    /// can recreate a pool for the soon-to-be-deleted inode. The reservation
    /// is released only after the deletion operation has reached a terminal
    /// success/failure result.
    pub fn delete_exclusive<T>(
        &self,
        path: &Path,
        operation: impl FnOnce() -> Result<T, Error>,
    ) -> Result<T, Error> {
        let canonical = canonical_database_path(path)?;
        let entry = {
            let mut state = self
                .state
                .lock()
                .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
            if !state.tombstones.insert(canonical.clone()) {
                return Err(Error::Conflict(
                    "database deletion is already in progress".into(),
                ));
            }
            state.entries.get(&canonical).cloned()
        };
        if let Some(entry) = &entry {
            entry.retire_and_wait()?;
        }
        let result = operation();
        let mut state = self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
        state.entries.remove(&canonical);
        state.tombstones.remove(&canonical);
        result
    }

    fn entry(&self, path: &Path) -> Result<(PathBuf, Arc<DatabaseEntry>), Error> {
        let canonical = canonical_database_path(path)?;
        let key = canonical
            .to_str()
            .ok_or_else(|| Error::InvalidInput("Path is not valid UTF-8".into()))?
            .to_owned();
        let mut state = self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
        if state.tombstones.contains(&canonical) {
            return Err(Error::Conflict("database is being deleted".into()));
        }
        state.clock = state.clock.saturating_add(1);
        let now = state.clock;
        if let Some(entry) = state.entries.get(&canonical) {
            entry
                .state
                .lock()
                .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
                .last_used = now;
            return Ok((canonical, entry.clone()));
        }

        let pool = Pool::builder()
            .max_size(16)
            .connection_customizer(Box::new(ConnectionOptions))
            .build(ConnectionManager::<SqliteConnection>::new(key))?;
        let entry = Arc::new(DatabaseEntry {
            pool,
            write_lock: Arc::new(Mutex::new(())),
            index_lock: Arc::new(Mutex::new(())),
            state: Mutex::new(EntryState {
                last_used: now,
                ..EntryState::default()
            }),
            lifecycle: Mutex::new(LifecycleState::default()),
            lifecycle_changed: Condvar::new(),
        });
        state.entries.insert(canonical.clone(), entry.clone());
        self.evict_idle_entries(&mut state, &canonical);
        Ok((canonical, entry))
    }

    fn mark_schema_validated_entry(
        &self,
        entry: &Arc<DatabaseEntry>,
        path: &Path,
    ) -> Result<(), Error> {
        entry
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .schema_identity = Some(DatabaseSchemaIdentity::from_path(path)?);
        Ok(())
    }

    #[cfg(test)]
    fn remove_entry(&self, canonical: &Path) -> Result<Option<Arc<DatabaseEntry>>, Error> {
        Ok(self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?
            .entries
            .remove(canonical))
    }

    fn retire_replaced(&self, canonical: &Path, entry: &Arc<DatabaseEntry>) -> Result<(), Error> {
        entry.retire_and_wait()?;
        let mut state = self
            .state
            .lock()
            .map_err(|_| Error::Conflict("database repository state poisoned".into()))?;
        if state
            .entries
            .get(canonical)
            .is_some_and(|current| Arc::ptr_eq(current, entry))
        {
            state.entries.remove(canonical);
        }
        Ok(())
    }

    fn evict_idle_entries(&self, state: &mut RepositoryState, protected: &Path) {
        while state.entries.len() > MAX_OPEN_DATABASES {
            let eviction = state
                .entries
                .iter()
                .filter(|(path, entry)| {
                    path.as_path() != protected && Arc::strong_count(entry) == 1 && entry.is_idle()
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
}

impl DatabaseEntry {
    fn path_matches_known_object(&self, path: &Path) -> Result<bool, Error> {
        let object = match std::fs::File::open(path) {
            Ok(file) => crate::infra::path_authority::opened_file_identity(&file)?,
            // A yet-to-be-created database has no object to compare. Pool
            // creation establishes it before the connection is returned.
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(true),
            Err(error) => return Err(error.into()),
        };
        let lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?;
        Ok(!lifecycle.retiring && lifecycle.object.is_none_or(|known| known == object))
    }

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

    /// Establishes the object identity from a newly acquired connection path.
    /// A pool is never reused after its pathname resolves to another object.
    fn confirm_current_object(&self, path: &Path) -> Result<bool, Error> {
        let object =
            crate::infra::path_authority::opened_file_identity(&std::fs::File::open(path)?)?;
        let mut lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?;
        if lifecycle.retiring {
            return Ok(false);
        }
        match lifecycle.object {
            None => {
                lifecycle.object = Some(object);
                Ok(true)
            }
            Some(known) => Ok(known == object),
        }
    }

    fn retire_and_wait(&self) -> Result<(), Error> {
        let mut lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?;
        lifecycle.retiring = true;
        while lifecycle.active != 0 {
            lifecycle = self
                .lifecycle_changed
                .wait(lifecycle)
                .map_err(|_| Error::Conflict("database lifecycle lock poisoned".into()))?;
        }
        Ok(())
    }

    fn is_idle(&self) -> bool {
        self.lifecycle
            .lock()
            .map(|lifecycle| lifecycle.active == 0 && !lifecycle.retiring)
            .unwrap_or(false)
    }
}

/// Normalizes a path for use as a repository identity key.
///
/// This is not a containment check. It canonicalizes the existing ancestor and preserves any
/// missing suffix, so a non-existent final component is accepted.
fn canonical_database_path(path: &Path) -> Result<PathBuf, Error> {
    if path.exists() {
        let meta = std::fs::symlink_metadata(path)?;
        if meta.is_symlink() {
            return Err(Error::InvalidInput("Symlink target is not allowed".into()));
        }
        let canon = std::fs::canonicalize(path)?;
        return Ok(canon);
    }

    let mut current = path.to_path_buf();
    let mut components_to_add = Vec::new();
    while !current.exists() {
        if let Some(file_name) = current.file_name() {
            components_to_add.push(file_name.to_os_string());
        } else {
            return Err(Error::InvalidInput("Invalid path component".into()));
        }
        if !current.pop() {
            break;
        }
    }

    if !current.exists() {
        return Err(Error::InvalidInput("No existing ancestor".into()));
    }

    let mut canon = std::fs::canonicalize(&current)?;
    for comp in components_to_add.into_iter().rev() {
        canon.push(comp);
    }

    Ok(canon)
}

#[cfg(test)]
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

        let mut connection = repository.initialization_connection(&path).unwrap();
        migrations::prepare_database(&mut connection, "title", "description").unwrap();
        drop(connection);
        repository.mark_schema_validated(&path).unwrap();
        repository.connection(&alias).unwrap();

        assert_eq!(repository.state.lock().unwrap().entries.len(), 1);
        assert_eq!(repository.data_revision(&path).unwrap(), 0);
        assert_eq!(repository.data_changed(&alias).unwrap(), 1);
        assert_eq!(repository.data_revision(&path).unwrap(), 1);
    }

    #[test]
    fn close_evicts_a_database_so_a_replacement_is_revalidated() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let repository = DatabaseRepository::default();
        let mut connection = repository.initialization_connection(&path).unwrap();
        migrations::prepare_database(&mut connection, "title", "description").unwrap();
        drop(connection);
        repository.mark_schema_validated(&path).unwrap();
        repository.close_and_invalidate(&path).unwrap();

        assert!(repository.state.lock().unwrap().entries.is_empty());
        repository.connection(&path).unwrap();
    }

    #[test]
    fn deletion_tombstone_blocks_reacquisition_until_the_terminal_result() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let repository = DatabaseRepository::default();
        let mut connection = repository.initialization_connection(&path).unwrap();
        migrations::prepare_database(&mut connection, "title", "description").unwrap();
        drop(connection);
        repository.mark_schema_validated(&path).unwrap();

        repository
            .delete_exclusive(&path, || {
                assert!(matches!(
                    repository.connection(&path),
                    Err(Error::Conflict(message)) if message.contains("being deleted")
                ));
                Ok(())
            })
            .unwrap();
        repository.connection(&path).unwrap();
    }

    #[test]
    fn replacement_at_the_same_path_never_reuses_an_old_pooled_connection() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("database.db3");
        let replacement = directory.path().join("replacement.db3");
        let repository = DatabaseRepository::default();
        let mut connection = repository.initialization_connection(&path).unwrap();
        migrations::prepare_database(&mut connection, "old", "description").unwrap();
        drop(connection);
        repository.mark_schema_validated(&path).unwrap();
        let old_entry = repository.entry(&path).unwrap().1;
        let old_object = old_entry.lifecycle.lock().unwrap().object.unwrap();

        let mut replacement_connection =
            repository.initialization_connection(&replacement).unwrap();
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

        let mut connection = repository.connection(&path).unwrap();
        let new_entry = repository.entry(&path).unwrap().1;
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
        let mut setup = repository.initialization_connection(&path).unwrap();
        migrations::prepare_database(&mut setup, "title", "description").unwrap();
        drop(setup);
        repository.mark_schema_validated(&path).unwrap();
        let active_read = repository.connection(&path).unwrap();
        let (started, started_rx) = mpsc::channel();
        let (done, done_rx) = mpsc::channel();
        let repo = repository.clone();
        let delete_path = path.clone();
        std::thread::spawn(move || {
            started.send(()).unwrap();
            let result = repo.delete_exclusive(&delete_path, || Ok(()));
            done.send(result.is_ok()).unwrap();
        });
        started_rx.recv().unwrap();
        assert!(done_rx.recv_timeout(Duration::from_millis(100)).is_err());
        drop(active_read);
        assert!(done_rx.recv_timeout(Duration::from_secs(2)).unwrap());
    }

    #[test]
    fn lru_never_evicts_an_active_lease() {
        let directory = tempfile::tempdir().unwrap();
        let repository = DatabaseRepository::default();
        let mut leases = Vec::new();
        for index in 0..=MAX_OPEN_DATABASES {
            let path = directory.path().join(format!("{index}.db3"));
            leases.push(repository.initialization_connection(&path).unwrap());
        }
        assert_eq!(
            repository.state.lock().unwrap().entries.len(),
            MAX_OPEN_DATABASES + 1
        );
        drop(leases);
    }
}
