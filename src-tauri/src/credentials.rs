//! Native-only Lichess credential storage.
//!
//! Tokens are held exclusively by the operating-system credential manager.  The on-disk registry
//! contains only public metadata and a durable journal used to complete interrupted add/delete
//! operations without ever serialising a bearer token.

use crate::{
    error::Error,
    infra::blocking::BLOCKING_GATEWAY,
    infra::fs::{atomic_replace, AtomicFileOutcome},
};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tokio_util::sync::CancellationToken;

/// Appended to the bundle identifier to form the OS credential-manager service name.  The release
/// and development identifiers deliberately produce disjoint namespaces so neither build can
/// access tokens stored by the other.
const KEYRING_SERVICE_SUFFIX: &str = ".lichess";
const REGISTRY_FILE: &str = "lichess-accounts.json";
const REGISTRY_VERSION: u8 = 2;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(transparent)]
pub struct LichessAccountHandle(pub String);

impl LichessAccountHandle {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }

    fn key(&self) -> String {
        format!("lichess-account:{}", self.0)
    }

    fn valid(&self) -> bool {
        self.0.parse::<uuid::Uuid>().is_ok()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct LichessAccountMetadata {
    pub handle: LichessAccountHandle,
    pub username: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct LichessAccountStoreResult {
    pub account: LichessAccountMetadata,
    pub durability_uncertain: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct RemovedLichessCredential {
    pub token: Option<String>,
    pub durability_uncertain: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "state", content = "account", rename_all = "snake_case")]
enum AccountRecord {
    Active(LichessAccountMetadata),
    PendingAdd(LichessAccountMetadata),
    PendingDelete(LichessAccountMetadata),
}

impl AccountRecord {
    fn metadata(&self) -> &LichessAccountMetadata {
        match self {
            Self::Active(account) | Self::PendingAdd(account) | Self::PendingDelete(account) => {
                account
            }
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct RegistryFile {
    version: u8,
    accounts: BTreeMap<String, AccountRecord>,
}

pub trait CredentialStore: Send + Sync + 'static {
    fn set(&self, key: &str, secret: &str) -> Result<(), Error>;
    fn get(&self, key: &str) -> Result<Option<String>, Error>;
    fn delete(&self, key: &str) -> Result<(), Error>;
}

/// The operating-system credential manager is shared by every build on the machine, so the service
/// name is derived from the bundle identifier rather than hard-coded.  A development build runs
/// under the development identifier and therefore cannot read, overwrite or delete the tokens of
/// an installed release.
pub struct OsCredentialStore {
    service: String,
}

impl OsCredentialStore {
    pub fn new(identifier: &str) -> Self {
        Self {
            service: format!("{identifier}{KEYRING_SERVICE_SUFFIX}"),
        }
    }
}

impl CredentialStore for OsCredentialStore {
    fn set(&self, key: &str, secret: &str) -> Result<(), Error> {
        Entry::new(&self.service, key)
            .and_then(|entry| entry.set_password(secret))
            .map_err(|source| Error::CredentialFailure(source.to_string()))
    }

    fn get(&self, key: &str) -> Result<Option<String>, Error> {
        match Entry::new(&self.service, key).and_then(|entry| entry.get_password()) {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(source) => Err(Error::CredentialFailure(source.to_string())),
        }
    }

    fn delete(&self, key: &str) -> Result<(), Error> {
        match Entry::new(&self.service, key).and_then(|entry| entry.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(source) => Err(Error::CredentialFailure(source.to_string())),
        }
    }
}

/// Stands in until the real store is injected with the running bundle identifier.  It refuses every
/// operation instead of guessing a namespace: a fallback would silently address the installed
/// release's secrets from a development build.
struct UnboundCredentialStore;

impl UnboundCredentialStore {
    fn refuse<T>() -> Result<T, Error> {
        Err(Error::CredentialFailure(
            "credential storage was used before it was bound to an application identifier".into(),
        ))
    }
}

impl CredentialStore for UnboundCredentialStore {
    fn set(&self, _key: &str, _secret: &str) -> Result<(), Error> {
        Self::refuse()
    }

    fn get(&self, _key: &str) -> Result<Option<String>, Error> {
        Self::refuse()
    }

    fn delete(&self, _key: &str) -> Result<(), Error> {
        Self::refuse()
    }
}

#[cfg(test)]
#[derive(Default)]
pub struct MemoryCredentialStore(Mutex<BTreeMap<String, String>>);

#[cfg(test)]
impl CredentialStore for MemoryCredentialStore {
    fn set(&self, key: &str, secret: &str) -> Result<(), Error> {
        self.0
            .lock()
            .expect("memory credential mutex poisoned")
            .insert(key.into(), secret.into());
        Ok(())
    }

    fn get(&self, key: &str) -> Result<Option<String>, Error> {
        Ok(self
            .0
            .lock()
            .expect("memory credential mutex poisoned")
            .get(key)
            .cloned())
    }

    fn delete(&self, key: &str) -> Result<(), Error> {
        self.0
            .lock()
            .expect("memory credential mutex poisoned")
            .remove(key);
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RegistryCommit {
    Durable,
    CommittedDurabilityUncertain,
}

trait RegistryPersistence: Send + Sync + 'static {
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<RegistryCommit, Error>;
}

#[derive(Default)]
struct AtomicRegistryPersistence;

impl RegistryPersistence for AtomicRegistryPersistence {
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<RegistryCommit, Error> {
        match atomic_replace(path, |file| {
            file.write_all(bytes)
                .map_err(|source| Error::CredentialFailure(source.to_string()))
        })? {
            AtomicFileOutcome::DurableCommit => Ok(RegistryCommit::Durable),
            // The rename happened.  Keeping the new in-memory state is the only truthful action;
            // compensating can destroy the only committed copy after a parent-fsync failure.
            AtomicFileOutcome::CommittedDurabilityUncertain(error) => {
                log::warn!("credential registry replacement parent sync failed: {error}");
                Ok(RegistryCommit::CommittedDurabilityUncertain)
            }
        }
    }
}

#[cfg(test)]
struct UncertainRegistryPersistence;

#[cfg(test)]
impl RegistryPersistence for UncertainRegistryPersistence {
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<RegistryCommit, Error> {
        AtomicRegistryPersistence.write(path, bytes)?;
        Ok(RegistryCommit::CommittedDurabilityUncertain)
    }
}

/// One mutex covers the public journal and all credential-store mutations.  It prevents this
/// process from exposing an account before a durable intent exists or interleaving compensations.
pub struct CredentialManager {
    store: Arc<dyn CredentialStore>,
    persistence: Arc<dyn RegistryPersistence>,
    registry: Mutex<RegistryFile>,
    registry_path: Mutex<Option<PathBuf>>,
}

impl Default for CredentialManager {
    fn default() -> Self {
        Self::new(Arc::new(UnboundCredentialStore))
    }
}

impl CredentialManager {
    pub fn new(store: Arc<dyn CredentialStore>) -> Self {
        Self::with_persistence(store, Arc::new(AtomicRegistryPersistence))
    }

    #[cfg(test)]
    pub(crate) fn with_uncertain_persistence(store: Arc<dyn CredentialStore>) -> Self {
        Self::with_persistence(store, Arc::new(UncertainRegistryPersistence))
    }

    fn with_persistence(
        store: Arc<dyn CredentialStore>,
        persistence: Arc<dyn RegistryPersistence>,
    ) -> Self {
        Self {
            store,
            persistence,
            registry: Mutex::new(RegistryFile::default()),
            registry_path: Mutex::new(None),
        }
    }

    pub fn initialize(&self, app_data: &Path) -> Result<(), Error> {
        fs::create_dir_all(app_data)
            .map_err(|source| Error::CredentialFailure(source.to_string()))?;
        #[cfg(unix)]
        secure_directory(app_data)?;
        let path = app_data.join(REGISTRY_FILE);
        let registry = self.load_registry(&path)?;
        *self
            .registry
            .lock()
            .expect("credential registry mutex poisoned") = registry;
        *self
            .registry_path
            .lock()
            .expect("credential path mutex poisoned") = Some(path.clone());
        // Commit legacy metadata-only registries to the journalled format before reconciliation
        // is allowed to touch the native credential manager.
        let registry = self
            .registry
            .lock()
            .expect("credential registry mutex poisoned");
        log_uncertain_commit(
            self.persist_locked(&registry)?,
            "credential registry initialization",
        );
        drop(registry);
        #[cfg(unix)]
        secure_registry_file(&path)?;
        self.reconcile()
    }

    pub fn list(&self) -> Vec<LichessAccountMetadata> {
        self.registry
            .lock()
            .expect("credential registry mutex poisoned")
            .accounts
            .values()
            .filter_map(|record| match record {
                AccountRecord::Active(account) => Some(account.clone()),
                AccountRecord::PendingAdd(_) | AccountRecord::PendingDelete(_) => None,
            })
            .collect()
    }

    pub fn token(&self, handle: &LichessAccountHandle) -> Result<Option<String>, Error> {
        if !handle.valid() {
            return Ok(None);
        }
        self.store.get(&handle.key())
    }

    async fn spawn_blocking<T, F>(self: &Arc<Self>, work: F) -> Result<T, Error>
    where
        T: Send + 'static,
        F: FnOnce(Arc<Self>) -> Result<T, Error> + Send + 'static,
    {
        let manager = self.clone();
        BLOCKING_GATEWAY
            .spawn_cancellable(CancellationToken::new(), move |_| work(manager))
            .await
    }

    pub async fn token_async(
        self: &Arc<Self>,
        handle: LichessAccountHandle,
    ) -> Result<Option<String>, Error> {
        self.spawn_blocking(move |manager| manager.token(&handle))
            .await
    }

    pub(crate) fn store_lichess_token(
        &self,
        username: String,
        token: String,
    ) -> Result<LichessAccountStoreResult, Error> {
        let mut registry = self
            .registry
            .lock()
            .expect("credential registry mutex poisoned");
        // Re-authentication must retain the public opaque handle.  Otherwise a successful
        // refresh would orphan the old keyring entry and every persisted renderer session.
        if let Some(existing) = registry.accounts.values().find_map(|record| match record {
            AccountRecord::Active(metadata)
                if metadata.username.eq_ignore_ascii_case(username.trim()) =>
            {
                Some(metadata.clone())
            }
            AccountRecord::Active(_)
            | AccountRecord::PendingAdd(_)
            | AccountRecord::PendingDelete(_) => None,
        }) {
            self.store
                .set(&existing.handle.key(), &token)
                .map_err(|_| Error::CredentialRecoveryRequired)?;
            return Ok(LichessAccountStoreResult {
                account: existing,
                durability_uncertain: false,
            });
        }
        let metadata = LichessAccountMetadata {
            handle: LichessAccountHandle::new(),
            username,
        };
        registry.accounts.insert(
            metadata.handle.0.clone(),
            AccountRecord::PendingAdd(metadata.clone()),
        );
        let mut durability_uncertain = matches!(
            self.persist_locked(&registry)?,
            RegistryCommit::CommittedDurabilityUncertain
        );
        if self.store.set(&metadata.handle.key(), &token).is_err() {
            // A credential manager may write the secret and still fail while committing its own
            // metadata. The already-durable intent must remain: startup can inspect the keyring
            // and either finalise this add or remove a genuinely absent secret. Compensating here
            // could orphan a secret after a write-then-error outcome.
            return Err(Error::CredentialRecoveryRequired);
        }
        registry.accounts.insert(
            metadata.handle.0.clone(),
            AccountRecord::Active(metadata.clone()),
        );
        match self.persist_locked(&registry) {
            Ok(RegistryCommit::Durable) => {}
            Ok(RegistryCommit::CommittedDurabilityUncertain) => {
                durability_uncertain = true;
            }
            Err(error) => {
                registry.accounts.insert(
                    metadata.handle.0.clone(),
                    AccountRecord::PendingAdd(metadata.clone()),
                );
                return Err(error);
            }
        }
        Ok(LichessAccountStoreResult {
            account: metadata,
            durability_uncertain,
        })
    }

    pub(crate) async fn store_lichess_token_async(
        self: &Arc<Self>,
        username: String,
        token: String,
    ) -> Result<LichessAccountStoreResult, Error> {
        self.spawn_blocking(move |manager| manager.store_lichess_token(username, token))
            .await
    }

    /// Removes local access first. Provider revocation is deliberately a separate best-effort
    /// network concern; its failure cannot make the local deletion result untrue.
    pub(crate) fn remove(
        &self,
        handle: &LichessAccountHandle,
    ) -> Result<Option<RemovedLichessCredential>, Error> {
        if !handle.valid() {
            return Ok(None);
        }
        let mut registry = self
            .registry
            .lock()
            .expect("credential registry mutex poisoned");
        let Some(record) = registry.accounts.get(&handle.0).cloned() else {
            return Ok(None);
        };
        let metadata = record.metadata().clone();
        registry.accounts.insert(
            handle.0.clone(),
            AccountRecord::PendingDelete(metadata.clone()),
        );
        let mut durability_uncertain = matches!(
            self.persist_locked(&registry)?,
            RegistryCommit::CommittedDurabilityUncertain
        );
        let token = self.token(&metadata.handle)?;
        self.store.delete(&metadata.handle.key())?;
        registry.accounts.remove(&handle.0);
        match self.persist_locked(&registry) {
            Ok(RegistryCommit::Durable) => {}
            Ok(RegistryCommit::CommittedDurabilityUncertain) => {
                durability_uncertain = true;
            }
            Err(error) => {
                registry
                    .accounts
                    .insert(handle.0.clone(), AccountRecord::PendingDelete(metadata));
                return Err(error);
            }
        }
        Ok(Some(RemovedLichessCredential {
            token,
            durability_uncertain,
        }))
    }

    pub async fn remove_async(
        self: &Arc<Self>,
        handle: LichessAccountHandle,
    ) -> Result<Option<RemovedLichessCredential>, Error> {
        self.spawn_blocking(move |manager| manager.remove(&handle))
            .await
    }

    fn reconcile(&self) -> Result<(), Error> {
        let mut registry = self
            .registry
            .lock()
            .expect("credential registry mutex poisoned");
        let records: Vec<(String, AccountRecord)> = registry
            .accounts
            .iter()
            .map(|(handle, record)| (handle.clone(), record.clone()))
            .collect();
        for (handle, record) in records {
            let metadata = record.metadata().clone();
            match record {
                AccountRecord::Active(_) => {
                    if self.store.get(&metadata.handle.key())?.is_none() {
                        registry.accounts.remove(&handle);
                        log_uncertain_commit(
                            self.persist_locked(&registry)?,
                            "credential registry active-account reconciliation",
                        );
                    }
                }
                AccountRecord::PendingAdd(_) => {
                    if self.store.get(&metadata.handle.key())?.is_some() {
                        registry
                            .accounts
                            .insert(handle, AccountRecord::Active(metadata));
                    } else {
                        registry.accounts.remove(&handle);
                    }
                    log_uncertain_commit(
                        self.persist_locked(&registry)?,
                        "credential registry pending-add reconciliation",
                    );
                }
                AccountRecord::PendingDelete(_) => {
                    self.store.delete(&metadata.handle.key())?;
                    registry.accounts.remove(&handle);
                    log_uncertain_commit(
                        self.persist_locked(&registry)?,
                        "credential registry pending-delete reconciliation",
                    );
                }
            }
        }
        Ok(())
    }

    fn load_registry(&self, path: &Path) -> Result<RegistryFile, Error> {
        let mut file = match open_registry_file(path) {
            Ok(file) => file,
            Err(source) if source.kind() == std::io::ErrorKind::NotFound => {
                return Ok(RegistryFile {
                    version: REGISTRY_VERSION,
                    accounts: BTreeMap::new(),
                });
            }
            Err(source) => return Err(Error::CredentialFailure(source.to_string())),
        };
        #[cfg(unix)]
        chmod_registry_file(&file)?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)
            .map_err(|source| Error::CredentialFailure(source.to_string()))?;
        let value: serde_json::Value = serde_json::from_slice(&bytes)
            .map_err(|_| Error::CredentialFailure("credential registry is invalid".into()))?;
        let version = value.get("version").and_then(serde_json::Value::as_u64);
        let mut registry = if version == Some(1) {
            #[derive(Deserialize)]
            struct Legacy {
                accounts: Vec<LichessAccountMetadata>,
            }
            let legacy: Legacy = serde_json::from_value(value)
                .map_err(|_| Error::CredentialFailure("credential registry is invalid".into()))?;
            RegistryFile {
                version: REGISTRY_VERSION,
                accounts: legacy
                    .accounts
                    .into_iter()
                    .map(|account| (account.handle.0.clone(), AccountRecord::Active(account)))
                    .collect(),
            }
        } else {
            serde_json::from_value::<RegistryFile>(value)
                .map_err(|_| Error::CredentialFailure("credential registry is invalid".into()))?
        };
        self.validate_registry(&registry)?;
        registry.version = REGISTRY_VERSION;
        Ok(registry)
    }

    fn validate_registry(&self, registry: &RegistryFile) -> Result<(), Error> {
        if registry.version != REGISTRY_VERSION {
            return Err(Error::CredentialFailure(
                "credential registry is invalid".into(),
            ));
        }
        let handles: BTreeSet<_> = registry.accounts.keys().collect();
        if handles.len() != registry.accounts.len()
            || registry.accounts.iter().any(|(handle, record)| {
                handle != &record.metadata().handle.0
                    || !record.metadata().handle.valid()
                    || record.metadata().username.trim().is_empty()
            })
        {
            return Err(Error::CredentialFailure(
                "credential registry is invalid".into(),
            ));
        }
        Ok(())
    }

    fn persist_locked(&self, registry: &RegistryFile) -> Result<RegistryCommit, Error> {
        let path = self
            .registry_path
            .lock()
            .expect("credential path mutex poisoned")
            .clone();
        let Some(path) = path else {
            return Ok(RegistryCommit::Durable);
        };
        let bytes = serde_json::to_vec(registry)
            .map_err(|source| Error::CredentialFailure(source.to_string()))?;
        self.persistence
            .write(&path, &bytes)
            .map_err(|_| Error::CredentialFailure("credential registry update failed".into()))
    }
}

fn log_uncertain_commit(commit: RegistryCommit, operation: &str) {
    if commit == RegistryCommit::CommittedDurabilityUncertain {
        log::warn!("{operation} committed, but durability could not be confirmed");
    }
}

#[cfg(unix)]
fn secure_directory(path: &Path) -> Result<(), Error> {
    use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

    let directory = fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW)
        .open(path)
        .map_err(|source| Error::CredentialFailure(source.to_string()))?;
    directory
        .set_permissions(PermissionsExt::from_mode(0o700))
        .map_err(|source| Error::CredentialFailure(source.to_string()))
}

fn open_registry_file(path: &Path) -> std::io::Result<fs::File> {
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    options.open(path)
}

#[cfg(unix)]
fn chmod_registry_file(file: &fs::File) -> Result<(), Error> {
    use std::os::unix::fs::PermissionsExt;
    file.set_permissions(PermissionsExt::from_mode(0o600))
        .map_err(|source| Error::CredentialFailure(source.to_string()))
}

#[cfg(unix)]
fn secure_registry_file(path: &Path) -> Result<(), Error> {
    let file =
        open_registry_file(path).map_err(|source| Error::CredentialFailure(source.to_string()))?;
    chmod_registry_file(&file)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Default)]
    struct ThreadRecordingStore {
        inner: MemoryCredentialStore,
        threads: Mutex<Vec<std::thread::ThreadId>>,
    }

    impl CredentialStore for ThreadRecordingStore {
        fn set(&self, key: &str, secret: &str) -> Result<(), Error> {
            self.threads
                .lock()
                .unwrap()
                .push(std::thread::current().id());
            self.inner.set(key, secret)
        }

        fn get(&self, key: &str) -> Result<Option<String>, Error> {
            self.threads
                .lock()
                .unwrap()
                .push(std::thread::current().id());
            self.inner.get(key)
        }

        fn delete(&self, key: &str) -> Result<(), Error> {
            self.threads
                .lock()
                .unwrap()
                .push(std::thread::current().id());
            self.inner.delete(key)
        }
    }

    #[derive(Default)]
    struct FailStore {
        inner: MemoryCredentialStore,
        fail_set: bool,
        fail_delete: bool,
    }
    impl CredentialStore for FailStore {
        fn set(&self, key: &str, secret: &str) -> Result<(), Error> {
            if self.fail_set {
                Err(Error::CredentialFailure("injected".into()))
            } else {
                self.inner.set(key, secret)
            }
        }
        fn get(&self, key: &str) -> Result<Option<String>, Error> {
            self.inner.get(key)
        }
        fn delete(&self, key: &str) -> Result<(), Error> {
            if self.fail_delete {
                Err(Error::CredentialFailure("injected".into()))
            } else {
                self.inner.delete(key)
            }
        }
    }

    #[derive(Default)]
    struct WriteThenErrorStore(MemoryCredentialStore);
    impl CredentialStore for WriteThenErrorStore {
        fn set(&self, key: &str, secret: &str) -> Result<(), Error> {
            self.0.set(key, secret)?;
            Err(Error::CredentialFailure(
                "injected post-write failure".into(),
            ))
        }
        fn get(&self, key: &str) -> Result<Option<String>, Error> {
            self.0.get(key)
        }
        fn delete(&self, key: &str) -> Result<(), Error> {
            self.0.delete(key)
        }
    }

    struct FailPersistence {
        writes: Mutex<usize>,
        fail_on: usize,
    }
    impl RegistryPersistence for FailPersistence {
        fn write(&self, path: &Path, bytes: &[u8]) -> Result<RegistryCommit, Error> {
            let mut writes = self.writes.lock().unwrap();
            *writes += 1;
            if *writes == self.fail_on {
                return Err(Error::CredentialFailure("injected".into()));
            }
            AtomicRegistryPersistence.write(path, bytes)
        }
    }

    struct UncertainOnWrite {
        writes: Mutex<usize>,
        uncertain_on: usize,
    }
    impl RegistryPersistence for UncertainOnWrite {
        fn write(&self, path: &Path, bytes: &[u8]) -> Result<RegistryCommit, Error> {
            let mut writes = self.writes.lock().unwrap();
            *writes += 1;
            AtomicRegistryPersistence.write(path, bytes)?;
            if *writes == self.uncertain_on {
                Ok(RegistryCommit::CommittedDurabilityUncertain)
            } else {
                Ok(RegistryCommit::Durable)
            }
        }
    }

    #[test]
    fn public_registry_survives_restart_without_secret() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::new(store.clone());
        manager.initialize(temp.path()).unwrap();
        let result = manager
            .store_lichess_token("Felix".into(), "not-in-registry".into())
            .unwrap();
        let account = result.account;
        let content = fs::read_to_string(temp.path().join(REGISTRY_FILE)).unwrap();
        assert!(!content.contains("not-in-registry"));
        let after_restart = CredentialManager::new(store);
        after_restart.initialize(temp.path()).unwrap();
        assert_eq!(after_restart.list(), vec![account]);
    }

    #[test]
    fn failed_keyring_add_is_not_visible_or_retained_after_restart() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(FailStore {
            fail_set: true,
            ..Default::default()
        });
        let manager = CredentialManager::new(store.clone());
        manager.initialize(temp.path()).unwrap();
        assert!(manager
            .store_lichess_token("a".into(), "secret".into())
            .is_err());
        assert!(manager.list().is_empty());
        let after_restart = CredentialManager::new(store);
        after_restart.initialize(temp.path()).unwrap();
        assert!(after_restart.list().is_empty());
    }

    #[test]
    fn write_then_error_keyring_add_recovers_after_restart_without_leaking_a_token() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(WriteThenErrorStore::default());
        let manager = CredentialManager::new(store.clone());
        manager.initialize(temp.path()).unwrap();
        assert!(matches!(
            manager.store_lichess_token("a".into(), "secret".into()),
            Err(Error::CredentialRecoveryRequired)
        ));
        assert!(manager.list().is_empty());
        assert!(!fs::read_to_string(temp.path().join(REGISTRY_FILE))
            .unwrap()
            .contains("secret"));
        let after_restart = CredentialManager::new(store);
        after_restart.initialize(temp.path()).unwrap();
        assert_eq!(after_restart.list().len(), 1);
    }

    #[test]
    fn pending_delete_reconciles_idempotently_after_restart() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::new(store.clone());
        manager.initialize(temp.path()).unwrap();
        let account = manager
            .store_lichess_token("a".into(), "secret".into())
            .unwrap()
            .account;
        {
            let mut registry = manager.registry.lock().unwrap();
            registry.accounts.insert(
                account.handle.0.clone(),
                AccountRecord::PendingDelete(account.clone()),
            );
            manager.persist_locked(&registry).unwrap();
        }
        let after_restart = CredentialManager::new(store.clone());
        after_restart.initialize(temp.path()).unwrap();
        assert!(after_restart.list().is_empty());
        assert_eq!(store.get(&account.handle.key()).unwrap(), None);
    }

    #[test]
    fn final_add_write_failure_keeps_journal_for_restart_reconciliation() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::with_persistence(
            store.clone(),
            Arc::new(FailPersistence {
                writes: Mutex::new(0),
                fail_on: 3,
            }),
        );
        manager.initialize(temp.path()).unwrap();
        assert!(manager
            .store_lichess_token("a".into(), "secret".into())
            .is_err());
        assert!(manager.list().is_empty());
        let after_restart = CredentialManager::new(store);
        after_restart.initialize(temp.path()).unwrap();
        assert_eq!(after_restart.list().len(), 1);
    }

    #[test]
    fn durability_uncertain_pending_add_journal_is_reported() {
        let temp = tempfile::tempdir().unwrap();
        let manager = CredentialManager::with_persistence(
            Arc::new(MemoryCredentialStore::default()),
            Arc::new(UncertainOnWrite {
                writes: Mutex::new(0),
                uncertain_on: 2,
            }),
        );
        manager.initialize(temp.path()).unwrap();
        let result = manager
            .store_lichess_token("a".into(), "secret".into())
            .unwrap();
        assert!(result.durability_uncertain);
        assert_eq!(manager.list(), vec![result.account]);
    }

    #[test]
    fn durability_uncertain_final_add_journal_is_reported() {
        let temp = tempfile::tempdir().unwrap();
        let manager = CredentialManager::with_persistence(
            Arc::new(MemoryCredentialStore::default()),
            Arc::new(UncertainOnWrite {
                writes: Mutex::new(0),
                uncertain_on: 3,
            }),
        );
        manager.initialize(temp.path()).unwrap();
        let result = manager
            .store_lichess_token("a".into(), "secret".into())
            .unwrap();
        assert!(result.durability_uncertain);
        assert_eq!(manager.list(), vec![result.account]);
    }

    #[test]
    fn durability_uncertain_pending_delete_journal_is_reported() {
        let temp = tempfile::tempdir().unwrap();
        let manager = CredentialManager::with_persistence(
            Arc::new(MemoryCredentialStore::default()),
            Arc::new(UncertainOnWrite {
                writes: Mutex::new(0),
                uncertain_on: 4,
            }),
        );
        manager.initialize(temp.path()).unwrap();
        let account = manager
            .store_lichess_token("a".into(), "secret".into())
            .unwrap()
            .account;
        let removal = manager.remove(&account.handle).unwrap().unwrap();
        assert!(removal.durability_uncertain);
        assert_eq!(removal.token.as_deref(), Some("secret"));
        assert!(manager.list().is_empty());
    }

    #[test]
    fn durability_uncertain_final_delete_journal_is_reported() {
        let temp = tempfile::tempdir().unwrap();
        let manager = CredentialManager::with_persistence(
            Arc::new(MemoryCredentialStore::default()),
            Arc::new(UncertainOnWrite {
                writes: Mutex::new(0),
                uncertain_on: 5,
            }),
        );
        manager.initialize(temp.path()).unwrap();
        let account = manager
            .store_lichess_token("a".into(), "secret".into())
            .unwrap()
            .account;
        let removal = manager.remove(&account.handle).unwrap().unwrap();
        assert!(removal.durability_uncertain);
        assert_eq!(removal.token.as_deref(), Some("secret"));
        assert!(manager.list().is_empty());
    }

    #[test]
    fn reauthentication_reuses_the_existing_opaque_handle() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::new(store.clone());
        manager.initialize(temp.path()).unwrap();
        let first = manager
            .store_lichess_token("Felix".into(), "first-token".into())
            .unwrap()
            .account;
        let second = manager
            .store_lichess_token("felix".into(), "replacement-token".into())
            .unwrap();
        assert!(!second.durability_uncertain);
        assert_eq!(first, second.account);
        assert_eq!(manager.list(), vec![first.clone()]);
        assert_eq!(
            store.get(&first.handle.key()).unwrap().as_deref(),
            Some("replacement-token")
        );
        assert!(!fs::read_to_string(temp.path().join(REGISTRY_FILE))
            .unwrap()
            .contains("replacement-token"));
    }

    #[cfg(unix)]
    #[test]
    fn registry_and_its_parent_are_private() {
        use std::os::unix::fs::PermissionsExt;
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().join("credentials");
        let manager = CredentialManager::new(Arc::new(MemoryCredentialStore::default()));
        manager.initialize(&directory).unwrap();
        assert_eq!(
            fs::metadata(&directory).unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            fs::metadata(directory.join(REGISTRY_FILE))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }

    /// The configured release and development identifiers must produce their corresponding,
    /// disjoint credential-manager service names.
    #[test]
    fn keyring_service_is_derived_from_the_bundle_identifier() {
        assert_eq!(
            OsCredentialStore::new("com.chessriddle.encroissant").service,
            "com.chessriddle.encroissant.lichess"
        );
        assert_eq!(
            OsCredentialStore::new("com.chessriddle.encroissant.dev").service,
            "com.chessriddle.encroissant.dev.lichess"
        );
    }

    #[test]
    fn keyring_lockfile_includes_a_platform_backend() {
        let manifest = include_str!("../Cargo.toml");
        let lockfile = include_str!("../Cargo.lock");

        for feature in [
            "sync-secret-service",
            "crypto-rust",
            "apple-native",
            "windows-native",
        ] {
            assert!(
                manifest.contains(feature),
                "missing keyring feature {feature}"
            );
        }
        assert!(lockfile.contains("name = \"dbus-secret-service\""));
    }

    #[tokio::test]
    async fn async_store_methods_do_not_run_on_the_caller_thread() {
        let caller = std::thread::current().id();
        let store = Arc::new(ThreadRecordingStore::default());
        let manager = Arc::new(CredentialManager::new(store.clone()));
        let temp = tempfile::tempdir().unwrap();
        manager.initialize(temp.path()).unwrap();

        let unknown = LichessAccountHandle::new();
        assert_eq!(manager.token_async(unknown).await.unwrap(), None);
        let account = manager
            .store_lichess_token_async("user".into(), "secret".into())
            .await
            .unwrap()
            .account;
        assert_eq!(
            manager
                .remove_async(account.handle)
                .await
                .unwrap()
                .and_then(|removal| removal.token),
            Some("secret".into()),
        );

        let observed = store.threads.lock().unwrap();
        assert!(!observed.is_empty());
        assert!(observed.iter().all(|thread| *thread != caller));
    }

    #[cfg(unix)]
    #[test]
    fn initialize_refuses_a_symlinked_app_data_directory() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("target");
        fs::create_dir(&target).unwrap();
        let link = temp.path().join("credentials");
        symlink(&target, &link).unwrap();
        let manager = CredentialManager::new(Arc::new(MemoryCredentialStore::default()));

        assert!(manager.initialize(&link).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn initialize_refuses_a_symlinked_registry_file() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().join("credentials");
        fs::create_dir(&directory).unwrap();
        let target = temp.path().join("registry-target.json");
        fs::write(&target, r#"{"version":2,"accounts":{}}"#).unwrap();
        symlink(&target, directory.join(REGISTRY_FILE)).unwrap();
        let manager = CredentialManager::new(Arc::new(MemoryCredentialStore::default()));

        assert!(manager.initialize(&directory).is_err());
    }

    /// Guessing a namespace would silently reach into the release's secrets, so the placeholder that
    /// stands in before the identifier is known must refuse rather than fall back.  Asserted on the
    /// message: the variant alone cannot be told apart from a keyring backend failure.
    #[test]
    fn unbound_store_refuses_every_operation() {
        let store = UnboundCredentialStore;
        for outcome in [
            store.set("lichess-account:x", "secret").err(),
            store.get("lichess-account:x").err(),
            store.delete("lichess-account:x").err(),
        ] {
            match outcome {
                Some(Error::CredentialFailure(message)) => {
                    assert!(
                        message.contains("before it was bound to an application identifier"),
                        "unexpected message: {message}"
                    );
                }
                other => panic!("expected a refusal, got {other:?}"),
            }
        }
    }

    #[test]
    fn invalid_and_absent_handles_do_not_reach_the_credential_store() {
        let invalid = LichessAccountMetadata {
            handle: LichessAccountHandle("not-a-uuid".into()),
            username: "invalid".into(),
        };
        let manager = CredentialManager {
            store: Arc::new(UnboundCredentialStore),
            persistence: Arc::new(AtomicRegistryPersistence),
            registry: Mutex::new(RegistryFile {
                version: REGISTRY_VERSION,
                accounts: BTreeMap::from([(
                    invalid.handle.0.clone(),
                    AccountRecord::Active(invalid.clone()),
                )]),
            }),
            registry_path: Mutex::new(None),
        };
        let absent = LichessAccountHandle("56d05779-a8d4-426b-97a6-a237a4b4d31d".into());

        assert_eq!(
            (
                manager.token(&invalid.handle).ok(),
                manager.remove(&invalid.handle).ok(),
                manager.remove(&absent).ok(),
                manager.list(),
            ),
            (Some(None), Some(None), Some(None), vec![invalid],)
        );
    }

    #[test]
    fn registry_version_migration_and_pathless_persistence_are_explicit() {
        let manager = CredentialManager::default();
        let current = RegistryFile {
            version: REGISTRY_VERSION,
            accounts: BTreeMap::new(),
        };
        let outdated = RegistryFile {
            version: REGISTRY_VERSION - 1,
            accounts: BTreeMap::new(),
        };
        let temp = tempfile::tempdir().unwrap();
        let legacy_path = temp.path().join(REGISTRY_FILE);
        let legacy = LichessAccountMetadata {
            handle: LichessAccountHandle("56d05779-a8d4-426b-97a6-a237a4b4d31d".into()),
            username: "Felix".into(),
        };
        let write = fs::write(
            &legacy_path,
            r#"{"version":1,"accounts":[{"handle":"56d05779-a8d4-426b-97a6-a237a4b4d31d","username":"Felix"}]}"#,
        );
        let migrated = manager.load_registry(&legacy_path).ok().map(|registry| {
            (
                registry.version,
                registry
                    .accounts
                    .values()
                    .map(|record| record.metadata().clone())
                    .collect::<Vec<_>>(),
            )
        });

        assert_eq!(
            (
                manager.validate_registry(&outdated).is_err(),
                manager.persist_locked(&current).ok(),
                write.is_ok(),
                migrated,
            ),
            (
                true,
                Some(RegistryCommit::Durable),
                true,
                Some((REGISTRY_VERSION, vec![legacy])),
            )
        );
    }
}
