//! Native-only Lichess credential storage.
//!
//! Tokens are held exclusively by the operating-system credential manager.  The on-disk registry
//! contains only public metadata and a durable journal used to complete interrupted add/delete
//! operations without ever serialising a bearer token.

use crate::{
    error::Error,
    infra::fs::{atomic_replace, AtomicFileOutcome},
};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

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
            AtomicFileOutcome::CommittedDurabilityUncertain(_) => {
                Ok(RegistryCommit::CommittedDurabilityUncertain)
            }
        }
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
        fs::set_permissions(
            app_data,
            std::os::unix::fs::PermissionsExt::from_mode(0o700),
        )
        .map_err(|source| Error::CredentialFailure(source.to_string()))?;
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
        #[cfg(unix)]
        if path.exists() {
            fs::set_permissions(&path, std::os::unix::fs::PermissionsExt::from_mode(0o600))
                .map_err(|source| Error::CredentialFailure(source.to_string()))?;
        }
        // Commit legacy metadata-only registries to the journalled format before reconciliation
        // is allowed to touch the native credential manager.
        let registry = self
            .registry
            .lock()
            .expect("credential registry mutex poisoned");
        self.persist_locked(&registry)?;
        drop(registry);
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

    pub(crate) fn store_lichess_token(
        &self,
        username: String,
        token: String,
    ) -> Result<LichessAccountMetadata, Error> {
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
            return Ok(existing);
        }
        let metadata = LichessAccountMetadata {
            handle: LichessAccountHandle::new(),
            username,
        };
        registry.accounts.insert(
            metadata.handle.0.clone(),
            AccountRecord::PendingAdd(metadata.clone()),
        );
        self.persist_locked(&registry)?;
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
        if let Err(error) = self.persist_locked(&registry) {
            registry.accounts.insert(
                metadata.handle.0.clone(),
                AccountRecord::PendingAdd(metadata.clone()),
            );
            return Err(error);
        }
        Ok(metadata)
    }

    /// Removes local access first. Provider revocation is deliberately a separate best-effort
    /// network concern; its failure cannot make the local deletion result untrue.
    pub fn remove(&self, handle: &LichessAccountHandle) -> Result<Option<String>, Error> {
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
        self.persist_locked(&registry)?;
        let token = self.token(&metadata.handle)?;
        self.store.delete(&metadata.handle.key())?;
        registry.accounts.remove(&handle.0);
        if let Err(error) = self.persist_locked(&registry) {
            registry
                .accounts
                .insert(handle.0.clone(), AccountRecord::PendingDelete(metadata));
            return Err(error);
        }
        Ok(token)
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
                        self.persist_locked(&registry)?;
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
                    self.persist_locked(&registry)?;
                }
                AccountRecord::PendingDelete(_) => {
                    self.store.delete(&metadata.handle.key())?;
                    registry.accounts.remove(&handle);
                    self.persist_locked(&registry)?;
                }
            }
        }
        Ok(())
    }

    fn load_registry(&self, path: &Path) -> Result<RegistryFile, Error> {
        if !path.exists() {
            return Ok(RegistryFile {
                version: REGISTRY_VERSION,
                accounts: BTreeMap::new(),
            });
        }
        let bytes =
            fs::read(path).map_err(|source| Error::CredentialFailure(source.to_string()))?;
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

#[cfg(test)]
mod tests {
    use super::*;

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

    struct UncertainPersistence;
    impl RegistryPersistence for UncertainPersistence {
        fn write(&self, path: &Path, bytes: &[u8]) -> Result<RegistryCommit, Error> {
            AtomicRegistryPersistence.write(path, bytes)?;
            Ok(RegistryCommit::CommittedDurabilityUncertain)
        }
    }

    #[test]
    fn public_registry_survives_restart_without_secret() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::new(store.clone());
        manager.initialize(temp.path()).unwrap();
        let account = manager
            .store_lichess_token("Felix".into(), "not-in-registry".into())
            .unwrap();
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
            .unwrap();
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
    fn durability_uncertain_after_rename_retains_committed_state() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::with_persistence(store, Arc::new(UncertainPersistence));
        manager.initialize(temp.path()).unwrap();
        let account = manager
            .store_lichess_token("a".into(), "secret".into())
            .unwrap();
        assert_eq!(manager.list(), vec![account]);
    }

    #[test]
    fn reauthentication_reuses_the_existing_opaque_handle() {
        let temp = tempfile::tempdir().unwrap();
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::new(store.clone());
        manager.initialize(temp.path()).unwrap();
        let first = manager
            .store_lichess_token("Felix".into(), "first-token".into())
            .unwrap();
        let second = manager
            .store_lichess_token("felix".into(), "replacement-token".into())
            .unwrap();
        assert_eq!(first, second);
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
}
