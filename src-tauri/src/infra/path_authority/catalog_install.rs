//! Native provenance for catalog trees. Records confer no path capability.
use super::*;
use crate::infra::fs::{
    open_removal_directory_at, open_verified_directory, remove_entry_at, MAX_REMOVE_TREE_DEPTH,
};

const MAX_INVENTORY_ENTRIES: usize = 16_384;
const MAX_INVENTORY_BYTES: u64 = 4 * 1024 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(super) struct CatalogInstall {
    root: StoredEntry,
    destination: NativePath,
    identity: Identity,
    inventory: Vec<ManagedEntry>,
    #[serde(default)]
    cleaning: bool,
    /// User changes after partial cleanup end automatic deletion, but cannot make the damaged
    /// destination adoptable. Retain the original inventory until the old tree is gone.
    #[serde(default)]
    preserved: bool,
    #[serde(default)]
    users: BTreeSet<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct ManagedEntry {
    relative: NativePath,
    identity: Identity,
    directory: bool,
    sha256: Option<String>,
}

fn invalid_record() -> Error {
    Error::InvalidInput("invalid catalog install provenance".into())
}

fn relative_path(path: &NativePath) -> Result<PathBuf, Error> {
    let path = path.to_path()?;
    if path.as_os_str().is_empty()
        || path
            .components()
            .any(|part| !matches!(part, std::path::Component::Normal(_)))
    {
        return Err(invalid_record());
    }
    validate_components(&relative_components(&path))?;
    Ok(path)
}

pub(super) fn validate_records(records: &BTreeMap<String, CatalogInstall>) -> Result<(), Error> {
    if records.len() > MAX_AUTHORITY_IDS {
        return Err(invalid_record());
    }
    let mut targets = BTreeSet::new();
    for (id, record) in records {
        if Uuid::parse_str(id).is_err()
            || (record.preserved && !record.cleaning)
            || record.inventory.len() > MAX_INVENTORY_ENTRIES
            || record.users.len() > MAX_AUTHORITY_IDS
            || record
                .users
                .iter()
                .any(|user| Uuid::parse_str(user).is_err())
        {
            return Err(invalid_record());
        }
        validate_persisted_shape(&record.root)?;
        let root = record.root.path.to_path()?;
        if !root.is_absolute()
            || record.root.purpose != Some(EntryPurpose::EngineRoot)
            || !record.root.target_is_dir
        {
            return Err(invalid_record());
        }
        let leaf = relative_path(&record.destination)?;
        if leaf.components().count() != 1
            || !targets.insert((
                root.join(&leaf),
                record.root.identity.a,
                record.root.identity.b,
            ))
        {
            return Err(invalid_record());
        }
        let mut paths = BTreeMap::new();
        for entry in &record.inventory {
            let path = relative_path(&entry.relative)?;
            if entry.directory != entry.sha256.is_none()
                || entry.sha256.as_ref().is_some_and(|digest| {
                    digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit())
                })
                || path.components().count() >= MAX_REMOVE_TREE_DEPTH
                || paths.insert(path, entry.directory).is_some()
            {
                return Err(invalid_record());
            }
        }
        for path in paths.keys() {
            if let Some(parent) = path
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
            {
                if paths.get(parent) != Some(&true) {
                    return Err(invalid_record());
                }
            }
        }
    }
    Ok(())
}

fn target(record: &CatalogInstall) -> Result<PathBuf, Error> {
    Ok(record
        .root
        .path
        .to_path()?
        .join(relative_path(&record.destination)?))
}

// Workspace ancestors do not own their children. Explicit directory resources do.
fn reaches(tree: &Path, path: &Path, recursive: bool) -> bool {
    path.starts_with(tree) || (recursive && tree.starts_with(path))
}

fn entry_reaches(record: &CatalogInstall, entry: &StoredEntry) -> Result<bool, Error> {
    Ok(reaches(
        &target(record)?,
        &entry.path.to_path()?,
        entry.target_is_dir && entry.purpose == Some(EntryPurpose::EngineResource),
    ))
}

fn inventory(directory: &fs::File, root_device: u64) -> Result<Vec<ManagedEntry>, Error> {
    let mut entries = Vec::new();
    let mut bytes = 0;
    let mut buffer = vec![0; 64 * 1024];
    walk(
        directory,
        Path::new(""),
        root_device,
        &mut bytes,
        &mut entries,
        &mut buffer,
    )?;
    Ok(entries)
}

fn walk(
    directory: &fs::File,
    relative: &Path,
    root_device: u64,
    bytes: &mut u64,
    inventory: &mut Vec<ManagedEntry>,
    buffer: &mut [u8],
) -> Result<(), Error> {
    let entries = read_directory_entries_at(
        directory,
        &CancellationToken::new(),
        Some(MAX_INVENTORY_ENTRIES),
        &mut |_| true,
    )?;
    for entry in entries {
        if inventory.len() >= MAX_INVENTORY_ENTRIES
            || relative.components().count() + 1 >= MAX_REMOVE_TREE_DEPTH
        {
            return Err(Error::ResourceLimit(
                "catalog inventory traversal limit reached".into(),
            ));
        }
        let path = relative.join(&entry.name);
        let directory_entry = entry.kind == DirectoryEntryKind::Directory;
        let digest = match entry.kind {
            DirectoryEntryKind::Directory => {
                if entry.identity.0 != root_device {
                    return Err(Error::InvalidInput(
                        "catalog inventory refuses a mount boundary".into(),
                    ));
                }
                None
            }
            DirectoryEntryKind::RegularFile => {
                let mut file =
                    open_regular_at(directory, &entry.name, RegularFileAccess::ReadOnly)?;
                if opened_file_identity(&file)? != entry.identity {
                    return Err(Error::Conflict("catalog inventory entry changed".into()));
                }
                let mut hash = Sha256::new();
                loop {
                    let read = file.read(buffer)?;
                    if read == 0 {
                        break;
                    }
                    *bytes = bytes.saturating_add(read as u64);
                    if *bytes > MAX_INVENTORY_BYTES {
                        return Err(Error::ResourceLimit(
                            "catalog inventory content limit reached".into(),
                        ));
                    }
                    hash.update(&buffer[..read]);
                }
                Some(format!("{:x}", hash.finalize()))
            }
            DirectoryEntryKind::Other => {
                return Err(Error::Conflict(
                    "catalog inventory contains a foreign entry".into(),
                ));
            }
        };
        inventory.push(ManagedEntry {
            relative: NativePath::from_path(&path),
            identity: Identity {
                a: entry.identity.0,
                b: entry.identity.1,
            },
            directory: directory_entry,
            sha256: digest,
        });
        if directory_entry {
            let child =
                open_removal_directory_at(directory, &entry.name, entry.identity)?.into_file();
            walk(&child, &path, root_device, bytes, inventory, buffer)?;
        }
        assert_entry_identity(directory, &entry.name, entry.identity, directory_entry)?;
    }
    Ok(())
}

impl PathAuthority {
    pub(super) fn catalog_admission_count(&self) -> usize {
        self.catalog_installs.len()
            + self.catalog_uses.len()
            + self
                .catalog_installs
                .values()
                .map(|record| record.users.len())
                .sum::<usize>()
    }

    fn commit_catalog(&mut self, records: BTreeMap<String, CatalogInstall>) -> Result<(), Error> {
        let baseline = self.registry_admission_snapshot(
            &self.persistent,
            &self.active_database_root,
            &self.active_puzzle_root,
            &self.active_engine_root,
            &self.pending_artifacts,
            &self.provisional_attachments,
            &self.retired_attachments,
            &self.image_cleanup,
        )?;
        validate_records(&records)?;
        let previous = std::mem::replace(&mut self.catalog_installs, records);
        let result = self.commit_candidate_with_pending_baseline(
            self.persistent.clone(),
            self.pending_artifacts.clone(),
            None,
            Some(baseline),
        );
        match result {
            Ok(durability) => {
                self.catalog_protected
                    .retain(|id| self.catalog_installs.contains_key(id));
                require_durable(durability)
            }
            Err(error) => {
                self.catalog_installs = previous;
                Err(error)
            }
        }
    }

    pub(super) fn protect_catalog_path(
        &mut self,
        path: &Path,
        recursive: bool,
        child_use: bool,
    ) -> Result<(), Error> {
        let affected = self
            .catalog_installs
            .iter()
            .filter_map(|(id, record)| match target(record) {
                Ok(tree) if reaches(&tree, path, recursive) => Some(Ok(id.clone())),
                Ok(_) => None,
                Err(error) => Some(Err(error)),
            })
            .collect::<Result<Vec<_>, _>>()?;
        if affected.iter().any(|id| self.catalog_installs[id].cleaning) {
            return Err(Error::Conflict(
                "catalog install cleanup is in progress".into(),
            ));
        }
        if child_use && (recursive || !affected.is_empty()) && !self.catalog_uses.contains_key(path)
        {
            if self.registry_unique_id_count() >= MAX_AUTHORITY_IDS {
                return Err(Error::ResourceLimit(
                    "catalog session use limit reached".into(),
                ));
            }
            self.catalog_uses.insert(path.to_path_buf(), recursive);
        }
        if child_use
            && affected.iter().any(|id| {
                !self.catalog_installs[id]
                    .users
                    .contains(&self.catalog_session)
            })
        {
            let mut records = self.catalog_installs.clone();
            for id in &affected {
                records
                    .get_mut(id)
                    .ok_or_else(invalid_record)?
                    .users
                    .insert(self.catalog_session.clone());
            }
            self.commit_catalog(records)?;
        } else if !affected.is_empty() && self.registry_durability_pending {
            self.retry_registry_durability()?;
        }
        self.catalog_protected.extend(affected);
        Ok(())
    }

    /// Called under authority serialization on the existing blocking worker.
    pub(crate) fn publish_catalog_install(
        &mut self,
        destination: &PathRef,
        resolved: &ResolvedPath,
        staging: &Path,
    ) -> Result<(), Error> {
        let path = resolved.target().ok_or_else(invalid_record)?;
        self.protect_catalog_path(path, false, false)?;
        if crate::infra::fs::archive_destination_directory_exists(path)? {
            return Ok(());
        }
        let root = self
            .persistent
            .get(&destination.id)
            .ok_or_else(invalid_record)?
            .stored
            .clone();
        let root_path = root.path.to_path()?;
        if path.parent() != Some(root_path.as_path())
            || root.purpose != Some(EntryPurpose::EngineRoot)
        {
            return Err(invalid_record());
        }
        if staging.parent() != Some(root_path.as_path()) {
            return Err(Error::InvalidInput(
                "catalog staging must share the destination parent".into(),
            ));
        }
        let root_directory =
            open_verified_directory(&root_path, (root.identity.a, root.identity.b))?.into_file();
        let identity = validate_target(staging, PathClass::PersistentCustomRoot)?;
        let directory = open_removal_directory_at(
            &root_directory,
            staging.file_name().ok_or_else(invalid_record)?,
            (identity.a, identity.b),
        )?
        .into_file();
        let mut record = CatalogInstall {
            root,
            destination: NativePath::from_path(Path::new(
                path.file_name().ok_or_else(invalid_record)?,
            )),
            inventory: inventory(&directory, identity.a)?,
            identity: identity.clone(),
            cleaning: false,
            preserved: false,
            users: BTreeSet::new(),
        };
        // A recursive resource may have been handed to a child before provenance existed.
        if self
            .catalog_uses
            .iter()
            .any(|(used, recursive)| reaches(path, used, *recursive))
        {
            record.users.insert(self.catalog_session.clone());
        }
        let mut records = self.catalog_installs.clone();
        let mut replaced = Vec::new();
        for (id, existing) in &records {
            // A replacement root at this spelling is a different cleanup locator. Preserve its
            // predecessor's exact binding even if the native root entry has been retired.
            if existing.root.identity == record.root.identity && target(existing)? == path {
                replaced.push(id.clone());
            }
        }
        for id in replaced {
            let existing = records.remove(&id).ok_or_else(invalid_record)?;
            record.users.extend(existing.users);
        }
        let id = Uuid::new_v4().to_string();
        records.insert(id.clone(), record);
        self.commit_catalog(records)?;
        self.catalog_protected.insert(id);
        assert_entry_identity(
            &root_directory,
            staging.file_name().ok_or_else(invalid_record)?,
            (identity.a, identity.b),
            true,
        )?;
        resolved.atomic_install_download_dir(staging)
    }

    /// The caller must first prove sealed admission, drained operations and successful reaping.
    pub(crate) fn clear_catalog_session_use(&mut self) -> Result<(), Error> {
        let previous = self.catalog_installs.clone();
        let mut records = self.catalog_installs.clone();
        for record in records.values_mut() {
            record.users.remove(&self.catalog_session);
        }
        let result = self.commit_catalog(records);
        if result.is_err() {
            // A failed or unconfirmed clear is never positive in-memory evidence of child exit.
            // Preserve the markers for retry even when replacement crossed the rename boundary.
            self.catalog_installs = previous;
        }
        result
    }

    pub(crate) fn collect_catalog_installs(&mut self) -> Result<(), Error> {
        if !self
            .completed_owner_families
            .contains(&PathOwnerFamily::Engines)
        {
            return Ok(());
        }
        if self.registry_durability_pending {
            self.retry_registry_durability()?;
        }
        let mut failures = Vec::new();
        for id in self.catalog_installs.keys().cloned().collect::<Vec<_>>() {
            let record = self.catalog_installs[&id].clone();
            if !record.users.is_empty() {
                log::warn!(
                    "catalog install {id} retained for unresolved session use: {:?}",
                    record.users
                );
                continue;
            }
            if self.catalog_protected.contains(&id) {
                continue;
            }
            let mut live = false;
            for entry in self
                .persistent
                .values()
                .chain(self.retired_attachments.values())
            {
                live |= entry_reaches(&record, &entry.stored)?;
            }
            if live {
                continue;
            }
            if let Err(error) = self.collect_catalog_install(&id, &record) {
                log::warn!(
                    "catalog install {id} cleanup failed: {}",
                    error.diagnostic()
                );
                failures.push(error);
            }
        }
        failures.into_iter().next().map_or(Ok(()), Err)
    }

    fn forget_catalog_install(&mut self, id: &str) -> Result<(), Error> {
        let mut records = self.catalog_installs.clone();
        records.remove(id);
        self.commit_catalog(records)
    }

    fn collect_catalog_install(&mut self, id: &str, record: &CatalogInstall) -> Result<(), Error> {
        let root = open_verified_directory(
            &record.root.path.to_path()?,
            (record.root.identity.a, record.root.identity.b),
        )?
        .into_file();
        let leaf = relative_path(&record.destination)?;
        let entries = read_directory_entries_at(
            &root,
            &CancellationToken::new(),
            Some(crate::infra::fs::MAX_DIRECTORY_LISTING_ENTRIES),
            &mut |name| name == leaf.as_os_str(),
        )?;
        let Some(entry) = entries.first() else {
            return self.forget_catalog_install(id);
        };
        if entry.identity != (record.identity.a, record.identity.b)
            || entry.kind != DirectoryEntryKind::Directory
        {
            return self.forget_catalog_install(id);
        }
        if record.preserved {
            return Ok(());
        }
        let directory =
            open_removal_directory_at(&root, leaf.as_os_str(), entry.identity)?.into_file();
        let observed = match inventory(&directory, record.root.identity.a) {
            Ok(entries) => entries,
            Err(Error::Conflict(_)) => return self.preserve_changed_catalog_install(id, record),
            Err(error) => return Err(error),
        };
        let matches = observed
            .iter()
            .all(|entry| record.inventory.contains(entry))
            && (record.cleaning || observed.len() == record.inventory.len());
        if !matches {
            log::info!("catalog install {id} relinquished after user modification");
            return self.preserve_changed_catalog_install(id, record);
        }
        if !record.cleaning {
            let mut records = self.catalog_installs.clone();
            records.get_mut(id).ok_or_else(invalid_record)?.cleaning = true;
            self.commit_catalog(records)?;
        }
        // Keep the complete original inventory through partial removal and uncertain parent sync.
        remove_entry_at(&root, leaf.as_os_str(), entry.identity, true)?;
        self.forget_catalog_install(id)
    }

    fn preserve_changed_catalog_install(
        &mut self,
        id: &str,
        record: &CatalogInstall,
    ) -> Result<(), Error> {
        if !record.cleaning {
            return self.forget_catalog_install(id);
        }
        let mut records = self.catalog_installs.clone();
        records.get_mut(id).ok_or_else(invalid_record)?.preserved = true;
        self.commit_catalog(records)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::fs::{
        install_test_atomic_file_injector, set_test_atomic_dir_injector, AtomicDirFaultPoint,
        AtomicDirInjector, AtomicFileFaultPoint, AtomicWriterInjector, ParentSyncFault,
    };

    struct Fixture {
        temp: tempfile::TempDir,
        root: PathBuf,
        handle: EngineRootHandle,
        authority: PathAuthority,
    }

    impl Fixture {
        fn new() -> Self {
            let temp = tempfile::tempdir().unwrap();
            let root = temp.path().join("engines");
            fs::create_dir(&root).unwrap();
            let mut authority =
                PathAuthority::open(temp.path().join("registry.json"), vec![]).unwrap();
            let handle = authority
                .get_or_create_engine_root(&root, "Engines", None)
                .unwrap();
            let root = authority.engine_root_path(&handle).unwrap();
            authority.set_active_engine_root(&handle).unwrap();
            Self {
                temp,
                root,
                handle,
                authority,
            }
        }

        fn reopen(&mut self) {
            self.authority =
                PathAuthority::open(self.temp.path().join("registry.json"), vec![]).unwrap();
        }

        fn stage(&self) -> tempfile::TempDir {
            let stage = tempfile::tempdir_in(&self.root).unwrap();
            fs::write(stage.path().join("engine"), b"managed engine").unwrap();
            fs::create_dir(stage.path().join("data")).unwrap();
            fs::write(stage.path().join("data/network"), b"managed network").unwrap();
            stage
        }

        fn publish_stage(&mut self, name: &str, stage: &Path) -> Result<(), Error> {
            let resolved = self.authority.resolve(
                self.handle.path_ref(),
                PathOperation::DownloadArchive,
                &[OsString::from(name)],
            )?;
            self.authority
                .publish_catalog_install(self.handle.path_ref(), &resolved, stage)
        }

        fn install(&mut self, name: &str) {
            let stage = self.stage();
            self.publish_stage(name, stage.path()).unwrap();
        }

        fn engine(&mut self, name: &str) -> EngineHandle {
            self.authority
                .register_installed_engine(&self.handle, &format!("{name}/engine"))
                .unwrap()
        }

        fn reconcile(&mut self, retained_ids: Vec<PathRef>, trusted: bool) -> Result<(), Error> {
            require_durable(self.authority.reconcile_startup_owners(StartupPathOwners {
                retained_ids,
                trusted_families: if trusted {
                    vec![PathOwnerFamily::Engines]
                } else {
                    vec![]
                },
            })?)?;
            self.authority.collect_catalog_installs()
        }

        fn resource(&mut self, path: &Path, directory: bool) -> EngineResourceHandle {
            let kind = if directory {
                EngineResourceHandleKind::Directory
            } else {
                EngineResourceHandleKind::File
            };
            let grant = self
                .authority
                .grant_dialog(
                    path,
                    "Resource",
                    PathClass::BoundedDialogGrant,
                    PathOperation::EngineResourceRead,
                    Duration::from_secs(30),
                    2,
                )
                .unwrap();
            self.authority
                .promote_engine_resource(&grant, kind, "Resource")
                .unwrap()
        }
    }

    struct FileFault(AtomicFileFaultPoint);
    impl AtomicWriterInjector for FileFault {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == self.0 {
                Err(std::io::Error::other("catalog registry fault"))
            } else {
                Ok(())
            }
        }
    }

    struct DirFault(AtomicDirFaultPoint);
    impl AtomicDirInjector for DirFault {
        fn inject(&self, point: AtomicDirFaultPoint) -> std::io::Result<()> {
            if point == self.0 {
                Err(std::io::Error::other("catalog publication fault"))
            } else {
                Ok(())
            }
        }
    }
    struct DirFaultReset;
    impl Drop for DirFaultReset {
        fn drop(&mut self) {
            set_test_atomic_dir_injector(None);
        }
    }

    #[test]
    fn catalog_install_upgrade_restart_reclaims_only_unowned_versions_and_releases_capacity() {
        let mut f = Fixture::new();
        for version in 0..8 {
            let name = format!("digest-{version}");
            f.install(&name);
            let engine = f.engine(&name);
            f.reconcile(vec![], true).unwrap();
            assert!(
                f.root.join(&name).exists(),
                "installation is protected during this session"
            );
            f.authority.clear_catalog_session_use().unwrap();
            f.reopen();
            // Duplicate engines and either saved player's identical native handle retain the tree.
            f.reconcile(vec![engine.path_ref().clone(); 3], true)
                .unwrap();
            assert!(f.root.join(&name).exists());
            assert_eq!(f.authority.catalog_installs.len(), 1);
            assert!(f.authority.catalog_admission_count() <= 1);
        }
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.authority.catalog_installs.is_empty());
        assert!(fs::read_dir(&f.root).unwrap().next().is_none());
    }

    #[test]
    fn catalog_install_adoption_never_mints_or_replaces_provenance() {
        let mut f = Fixture::new();
        fs::create_dir(f.root.join("legacy")).unwrap();
        fs::write(f.root.join("legacy/keep"), b"user").unwrap();
        f.install("legacy");
        assert!(f.authority.catalog_installs.is_empty());
        f.install("managed");
        let original = f.authority.catalog_installs.clone();
        f.install("managed");
        assert_eq!(f.authority.catalog_installs, original);
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.root.join("legacy/keep").exists());
        assert!(!f.root.join("managed").exists());
    }

    #[test]
    fn catalog_install_untrusted_owners_and_explicit_resources_keep_trees() {
        for ancestor in [false, true] {
            let mut f = Fixture::new();
            f.install("old");
            f.reopen();
            f.reconcile(vec![], false).unwrap();
            assert!(f.root.join("old/data/network").exists());
            let path = if ancestor {
                f.root.clone()
            } else {
                f.root.join("old/data/network")
            };
            let resource = f.resource(&path, ancestor);
            f.reopen();
            f.reconcile(vec![resource.path_ref().clone()], true)
                .unwrap();
            assert!(f.root.join("old/data/network").exists());
        }
    }

    #[test]
    fn catalog_install_session_markers_survive_reopen_and_only_originating_session_clears() {
        let mut f = Fixture::new();
        f.install("old");
        let engine = f.engine("old");
        let origin = f.authority.catalog_session.clone();
        let executable = f
            .authority
            .engine_executable(&engine, PathOperation::EngineConfigure)
            .unwrap();
        f.install("new");
        f.reconcile(vec![], true).unwrap();
        assert!(f.root.join("old/data/network").exists());
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(
            f.root.join("old/data/network").exists(),
            "unconfirmed shutdown cannot end child use"
        );
        f.authority.clear_catalog_session_use().unwrap();
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert_eq!(
            f.authority.catalog_installs.values().next().unwrap().users,
            BTreeSet::from([origin])
        );
        assert!(f.root.join("old/engine").exists());
        drop(executable);
    }

    #[test]
    fn catalog_install_successful_shutdown_clears_use_durably_for_next_restart() {
        let mut f = Fixture::new();
        f.install("old");
        let engine = f.engine("old");
        let executable = f
            .authority
            .engine_executable(&engine, PathOperation::EngineExecute)
            .unwrap();
        drop(executable);
        f.authority.clear_catalog_session_use().unwrap();
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(!f.root.join("old").exists());
    }

    #[test]
    fn catalog_install_ancestor_resource_used_before_publication_gets_durable_marker() {
        let mut f = Fixture::new();
        let root = f.root.clone();
        let resource = f.resource(&root, true);
        let lease = f.authority.engine_resource(&resource).unwrap();
        f.install("later");
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&f.authority.catalog_session)));
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.root.join("later/data/network").exists());
        drop(lease);
    }

    #[test]
    fn catalog_install_marker_write_failure_or_uncertainty_refuses_handoff() {
        for uncertain in [false, true] {
            let mut f = Fixture::new();
            f.install("managed");
            let engine = f.engine("managed");
            f.authority.clear_catalog_session_use().unwrap();
            f.reopen();
            let fault: Arc<dyn AtomicWriterInjector + Send + Sync> = if uncertain {
                Arc::new(ParentSyncFault("catalog marker sync"))
            } else {
                Arc::new(FileFault(AtomicFileFaultPoint::Write))
            };
            let guard = install_test_atomic_file_injector(fault);
            assert!(f
                .authority
                .engine_executable(&engine, PathOperation::EngineExecute)
                .is_err());
            if uncertain {
                assert!(
                    f.authority
                        .engine_executable(&engine, PathOperation::EngineExecute)
                        .is_err(),
                    "an uncertain marker cannot be reused without durable retry"
                );
            }
            drop(guard);
            let executable = f
                .authority
                .engine_executable(&engine, PathOperation::EngineExecute)
                .unwrap();
            drop(executable);
        }
    }

    #[test]
    fn catalog_install_registry_faults_abort_before_publication_and_reload_truthfully() {
        for point in [
            AtomicFileFaultPoint::Write,
            AtomicFileFaultPoint::Rename,
            AtomicFileFaultPoint::ParentSync,
        ] {
            let mut f = Fixture::new();
            let stage = f.stage();
            let guard = install_test_atomic_file_injector(Arc::new(FileFault(point)));
            assert!(f.publish_stage("managed", stage.path()).is_err());
            assert!(!f.root.join("managed").exists());
            drop(guard);
            f.reopen();
            assert_eq!(
                f.authority.catalog_installs.len(),
                usize::from(point == AtomicFileFaultPoint::ParentSync)
            );
            f.reconcile(vec![], true).unwrap();
            assert!(f.authority.catalog_installs.is_empty());
        }
    }

    #[test]
    fn catalog_install_publication_rename_and_sync_faults_keep_provenance() {
        for point in [
            AtomicDirFaultPoint::InstallRename,
            AtomicDirFaultPoint::ParentSync,
        ] {
            let mut f = Fixture::new();
            let stage = f.stage();
            let _reset = DirFaultReset;
            set_test_atomic_dir_injector(Some(Box::new(DirFault(point))));
            assert!(f.publish_stage("managed", stage.path()).is_err());
            assert_eq!(
                f.root.join("managed").exists(),
                point == AtomicDirFaultPoint::ParentSync
            );
            set_test_atomic_dir_injector(None);
            f.reopen();
            assert_eq!(f.authority.catalog_installs.len(), 1);
            f.reconcile(vec![], true).unwrap();
            assert!(f.authority.catalog_installs.is_empty());
            assert!(!f.root.join("managed").exists());
        }
    }

    #[test]
    fn catalog_install_user_changes_relinquish_ownership_without_removal() {
        for change in ["addition", "edit", "missing", "replacement"] {
            let mut f = Fixture::new();
            f.install("managed");
            let tree = f.root.join("managed");
            match change {
                "addition" => fs::write(tree.join("user-file"), b"keep").unwrap(),
                "edit" => fs::write(tree.join("data/network"), b"edited").unwrap(),
                "missing" => fs::remove_file(tree.join("engine")).unwrap(),
                _ => {
                    fs::rename(tree.join("engine"), f.root.join("old-inode")).unwrap();
                    fs::write(tree.join("engine"), b"managed engine").unwrap();
                }
            }
            f.reopen();
            f.reconcile(vec![], true).unwrap();
            assert!(tree.exists(), "{change}");
            assert!(f.authority.catalog_installs.is_empty(), "{change}");
        }
    }

    #[test]
    fn catalog_install_replacement_root_publication_preserves_each_exact_binding() {
        let mut f = Fixture::new();
        f.install("same");
        let old_binding = f
            .authority
            .catalog_installs
            .values()
            .next()
            .unwrap()
            .root
            .identity
            .clone();
        let detached = f.temp.path().join("original-root");
        fs::rename(&f.root, &detached).unwrap();
        fs::create_dir(&f.root).unwrap();
        let new_binding = validate_target(&f.root, PathClass::PersistentCustomRoot).unwrap();
        f.handle = f
            .authority
            .get_or_create_engine_root(
                &f.root,
                "Recovered engines",
                Some(VerifiedIdentity::from_pair((new_binding.a, new_binding.b))),
            )
            .unwrap();
        f.root = f.authority.engine_root_path(&f.handle).unwrap();
        f.authority.set_active_engine_root(&f.handle).unwrap();
        f.install("same");
        assert_eq!(f.authority.catalog_installs.len(), 2);
        assert!(f
            .authority
            .catalog_installs
            .values()
            .any(|record| record.root.identity == old_binding));
        f.reopen();
        assert!(
            f.reconcile(vec![], true).is_err(),
            "the unavailable original root remains retryable"
        );
        assert_eq!(f.authority.catalog_installs.len(), 1);
        assert!(!f.root.join("same").exists());
        assert!(detached.join("same/engine").exists());
        fs::remove_dir(&f.root).unwrap();
        fs::rename(detached, &f.root).unwrap();
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(!f.root.join("same").exists());
        assert!(f.authority.catalog_installs.is_empty());
    }

    #[test]
    fn catalog_install_root_substitution_retains_locator_and_tree_substitution_completes_record() {
        let mut f = Fixture::new();
        f.install("managed");
        let detached = f.temp.path().join("detached-root");
        fs::rename(&f.root, &detached).unwrap();
        fs::create_dir(&f.root).unwrap();
        fs::create_dir(f.root.join("managed")).unwrap();
        fs::write(f.root.join("managed/foreign"), b"foreign").unwrap();
        f.reopen();
        assert!(f.reconcile(vec![], true).is_err());
        assert_eq!(f.authority.catalog_installs.len(), 1);
        assert!(detached.join("managed/engine").exists());
        assert!(f.root.join("managed/foreign").exists());
        fs::remove_file(f.root.join("managed/foreign")).unwrap();
        fs::remove_dir(f.root.join("managed")).unwrap();
        fs::remove_dir(&f.root).unwrap();
        fs::rename(detached, &f.root).unwrap();
        fs::rename(f.root.join("managed"), f.root.join("original-tree")).unwrap();
        fs::create_dir(f.root.join("managed")).unwrap();
        fs::write(f.root.join("managed/foreign"), b"foreign").unwrap();
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.authority.catalog_installs.is_empty());
        assert!(f.root.join("managed/foreign").exists());
        assert!(f.root.join("original-tree/engine").exists());
    }

    #[test]
    fn catalog_install_legacy_registry_and_malformed_records_are_checked() {
        let mut f = Fixture::new();
        let path = f.temp.path().join("registry.json");
        let mut value: serde_json::Value =
            serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        value.as_object_mut().unwrap().remove("catalog_installs");
        fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
        f.reopen();
        assert!(f.authority.catalog_installs.is_empty());
        f.install("managed");
        let valid = f.authority.catalog_installs.clone();
        for malformed in ["destination", "inventory", "root", "users"] {
            let mut records = valid.clone();
            let record = records.values_mut().next().unwrap();
            match malformed {
                "destination" => {
                    record.destination = NativePath::from_path(Path::new("../outside"))
                }
                "inventory" => {
                    record.inventory = vec![record.inventory[0].clone(); MAX_INVENTORY_ENTRIES + 1]
                }
                "root" => record.root.purpose = Some(EntryPurpose::EngineResource),
                _ => {
                    record.users.insert("not-a-session".into());
                }
            }
            assert!(validate_records(&records).is_err(), "{malformed}");
            let mut value = serde_json::to_value(&value).unwrap();
            value["catalog_installs"] = serde_json::to_value(&records).unwrap();
            fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
            assert!(
                PathAuthority::open(path.clone(), vec![]).is_err(),
                "{malformed}"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn catalog_install_partial_removal_refuses_reinstall_then_restart_retries_and_fresh_install_works(
    ) {
        use crate::infra::fs::{scoped_test_removal_injector, RemovalFault, RemovalFaultPoint};
        let mut f = Fixture::new();
        f.install("managed");
        f.reopen();
        let guard = scoped_test_removal_injector(Arc::new(RemovalFault(
            RemovalFaultPoint::AfterEntryRemoved,
        )));
        assert!(matches!(
            f.reconcile(vec![], true),
            Err(Error::PartialRemoval { .. })
        ));
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.cleaning));
        drop(guard);
        let stage = f.stage();
        assert!(matches!(
            f.publish_stage("managed", stage.path()),
            Err(Error::Conflict(_))
        ));
        assert!(f
            .authority
            .persistent
            .values()
            .all(|entry| entry.stored.purpose != Some(EntryPurpose::EngineExecutable)));
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(!f.root.join("managed").exists());
        f.install("managed");
        let engine = f.engine("managed");
        f.authority.clear_catalog_session_use().unwrap();
        f.reopen();
        f.reconcile(vec![engine.path_ref().clone()], true).unwrap();
        let executable = f
            .authority
            .engine_executable(&engine, PathOperation::EngineExecute)
            .unwrap();
        drop(executable);
    }

    #[cfg(unix)]
    #[test]
    fn catalog_install_deletion_and_parent_sync_failures_retain_retry_state() {
        use crate::infra::fs::{scoped_test_removal_injector, RemovalFault, RemovalFaultPoint};
        for point in [
            RemovalFaultPoint::BeforeTopOpen,
            RemovalFaultPoint::ParentSync,
        ] {
            let mut f = Fixture::new();
            f.install("managed");
            f.reopen();
            let guard = scoped_test_removal_injector(Arc::new(RemovalFault(point)));
            let error = f.reconcile(vec![], true).unwrap_err();
            assert_eq!(
                f.root.join("managed").exists(),
                point == RemovalFaultPoint::BeforeTopOpen
            );
            if point == RemovalFaultPoint::ParentSync {
                assert!(matches!(error, Error::CommittedDurabilityUncertain(_)));
            }
            assert!(f
                .authority
                .catalog_installs
                .values()
                .all(|record| record.cleaning));
            drop(guard);
            f.reopen();
            f.reconcile(vec![], true).unwrap();
            assert!(f.authority.catalog_installs.is_empty());
        }
    }

    #[test]
    fn catalog_install_cleanup_state_write_failure_keeps_complete_tree() {
        let mut f = Fixture::new();
        f.install("managed");
        f.reopen();
        f.reconcile(vec![], false).unwrap();
        require_durable(
            f.authority
                .reconcile_startup_owners(StartupPathOwners {
                    retained_ids: vec![],
                    trusted_families: vec![PathOwnerFamily::Engines],
                })
                .unwrap(),
        )
        .unwrap();
        let guard =
            install_test_atomic_file_injector(Arc::new(FileFault(AtomicFileFaultPoint::Write)));
        assert!(f.authority.collect_catalog_installs().is_err());
        assert!(f.root.join("managed/engine").exists());
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| !record.cleaning));
        drop(guard);
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(!f.root.join("managed").exists());
    }

    #[test]
    fn catalog_install_retained_direct_consumer_and_failed_owner_commit_keep_tree() {
        let mut f = Fixture::new();
        f.install("managed");
        let book = f
            .authority
            .register_opening_book(&f.root.join("managed/data/network"), "Book")
            .unwrap();
        f.reopen();
        f.reconcile(vec![book.path_ref().clone()], true).unwrap();
        assert!(f.root.join("managed/engine").exists());
        f.reopen();
        let guard =
            install_test_atomic_file_injector(Arc::new(FileFault(AtomicFileFaultPoint::Write)));
        assert!(f
            .authority
            .reconcile_startup_owners(StartupPathOwners {
                retained_ids: vec![],
                trusted_families: vec![PathOwnerFamily::Engines, PathOwnerFamily::OpeningBook],
            })
            .is_err());
        f.authority.collect_catalog_installs().unwrap();
        assert!(f.root.join("managed/data/network").exists());
        drop(guard);
        require_durable(
            f.authority
                .reconcile_startup_owners(StartupPathOwners {
                    retained_ids: vec![],
                    trusted_families: vec![PathOwnerFamily::Engines, PathOwnerFamily::OpeningBook],
                })
                .unwrap(),
        )
        .unwrap();
        f.authority.collect_catalog_installs().unwrap();
        assert!(!f.root.join("managed").exists());
    }

    #[test]
    fn catalog_install_failed_or_uncertain_clear_retains_origin_markers_for_retry() {
        for point in [
            AtomicFileFaultPoint::Write,
            AtomicFileFaultPoint::ParentSync,
        ] {
            let mut f = Fixture::new();
            f.install("managed");
            let engine = f.engine("managed");
            drop(
                f.authority
                    .engine_executable(&engine, PathOperation::EngineExecute)
                    .unwrap(),
            );
            let guard = install_test_atomic_file_injector(Arc::new(FileFault(point)));
            assert!(f.authority.clear_catalog_session_use().is_err());
            assert!(f
                .authority
                .catalog_installs
                .values()
                .all(|record| record.users.contains(&f.authority.catalog_session)));
            drop(guard);
            f.authority.clear_catalog_session_use().unwrap();
            f.reopen();
            f.reconcile(vec![], true).unwrap();
            assert!(!f.root.join("managed").exists());
        }
    }

    #[test]
    fn catalog_install_completion_registry_failure_reopens_missing_tree_idempotently() {
        struct CompletionFault(std::sync::atomic::AtomicUsize);
        impl AtomicWriterInjector for CompletionFault {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::Write
                    && self.0.fetch_add(1, Ordering::SeqCst) >= 1
                {
                    Err(std::io::Error::other("catalog completion write failed"))
                } else {
                    Ok(())
                }
            }
        }
        let mut f = Fixture::new();
        f.install("managed");
        f.reopen();
        let guard = install_test_atomic_file_injector(Arc::new(CompletionFault(
            std::sync::atomic::AtomicUsize::new(0),
        )));
        assert!(f.reconcile(vec![], true).is_err());
        assert!(!f.root.join("managed").exists());
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.cleaning));
        drop(guard);
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.authority.catalog_installs.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn catalog_install_modified_partial_cleanup_preserves_files_and_refuses_both_adoption_paths() {
        use crate::infra::fs::{scoped_test_removal_injector, RemovalFault, RemovalFaultPoint};
        let mut f = Fixture::new();
        f.install("managed");
        // Preserve a resolution from before cleanup to exercise serialized publication adoption.
        let resolved = f
            .authority
            .resolve(
                f.handle.path_ref(),
                PathOperation::DownloadArchive,
                &[OsString::from("managed")],
            )
            .unwrap();
        f.reopen();
        let guard = scoped_test_removal_injector(Arc::new(RemovalFault(
            RemovalFaultPoint::AfterEntryRemoved,
        )));
        assert!(matches!(
            f.reconcile(vec![], true),
            Err(Error::PartialRemoval { .. })
        ));
        drop(guard);
        fs::write(f.root.join("managed/user-addition"), b"keep").unwrap();
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert_eq!(
            fs::read(f.root.join("managed/user-addition")).unwrap(),
            b"keep"
        );
        let stage = f.stage();
        assert!(matches!(
            f.publish_stage("managed", stage.path()),
            Err(Error::Conflict(_))
        ));
        assert!(matches!(
            f.authority
                .publish_catalog_install(f.handle.path_ref(), &resolved, stage.path()),
            Err(Error::Conflict(_))
        ));
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.root.join("managed/user-addition").exists());
        assert!(matches!(
            f.publish_stage("managed", stage.path()),
            Err(Error::Conflict(_))
        ));
    }

    #[cfg(windows)]
    #[test]
    fn catalog_install_reparse_addition_preserves_foreign_target() {
        let mut f = Fixture::new();
        f.install("managed");
        let foreign = f.temp.path().join("foreign");
        fs::create_dir(&foreign).unwrap();
        fs::write(foreign.join("keep"), b"keep").unwrap();
        crate::infra::fs::windows_test_junction(&f.root.join("managed/link"), &foreign);
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert_eq!(fs::read(foreign.join("keep")).unwrap(), b"keep");
        assert!(f.root.join("managed/engine").exists());
        assert!(f.authority.catalog_installs.is_empty());
    }

    #[test]
    fn catalog_install_inventory_admission_refuses_excess_entries_before_publication() {
        let mut f = Fixture::new();
        let stage = f.stage();
        for index in 0..MAX_INVENTORY_ENTRIES {
            fs::write(stage.path().join(format!("entry-{index}")), b"").unwrap();
        }
        let error = f.publish_stage("too-large", stage.path()).unwrap_err();
        assert!(
            matches!(error.unlabelled(), Error::ResourceLimit(_)),
            "{}",
            error.diagnostic()
        );
        assert!(!f.root.join("too-large").exists());
        assert!(f.authority.catalog_installs.is_empty());
    }

    #[tokio::test]
    async fn catalog_install_startup_command_retains_unavailable_root_without_failing_reconciliation(
    ) {
        use tauri::Manager;
        let mut f = Fixture::new();
        f.install("managed");
        let detached = f.temp.path().join("detached");
        fs::rename(&f.root, &detached).unwrap();
        f.reopen();
        let state = crate::AppState::default();
        state.pgn_path_authority.install(f.authority).unwrap();
        let app = tauri::test::mock_app();
        app.manage(state.clone());
        crate::reconcile_startup_path_owners(
            StartupPathOwners {
                retained_ids: vec![],
                trusted_families: vec![PathOwnerFamily::Engines],
            },
            app.state::<crate::AppState>(),
        )
        .await
        .unwrap();
        assert!(detached.join("managed/data/network").exists());
        state
            .pgn_path_authority
            .with_mut(|authority| {
                assert_eq!(authority.catalog_installs.len(), 1);
                assert!(authority
                    .completed_owner_families
                    .contains(&PathOwnerFamily::Engines));
            })
            .unwrap();
        fs::rename(detached, &f.root).unwrap();
        crate::reconcile_startup_path_owners(
            StartupPathOwners {
                retained_ids: vec![],
                trusted_families: vec![PathOwnerFamily::Engines],
            },
            app.state::<crate::AppState>(),
        )
        .await
        .unwrap();
        assert!(!f.root.join("managed").exists());
    }

    #[test]
    fn catalog_install_admission_bounds_records_inventory_and_bytes_before_rename() {
        let mut f = Fixture::new();
        f.install("seed");
        let template = f
            .authority
            .catalog_installs
            .values()
            .next()
            .unwrap()
            .clone();
        let count = MAX_AUTHORITY_IDS - f.authority.persistent.len();
        let records = (0..count)
            .map(|index| {
                let mut record = template.clone();
                record.destination = NativePath::from_path(Path::new(&format!("reserved-{index}")));
                (Uuid::new_v4().to_string(), record)
            })
            .collect();
        f.authority.commit_catalog(records).unwrap();
        let stage = f.stage();
        assert!(matches!(
            f.publish_stage("overflow", stage.path()),
            Err(Error::ResourceLimit(_))
        ));
        assert!(!f.root.join("overflow").exists());
        f.authority.commit_catalog(BTreeMap::new()).unwrap();
        let mut oversized = template;
        oversized.root.display_name = "x".repeat(MAX_REGISTRY_BYTES);
        let records = BTreeMap::from([(Uuid::new_v4().to_string(), oversized)]);
        assert!(matches!(
            f.authority.commit_catalog(records),
            Err(Error::ResourceLimit(_))
        ));
        assert!(f.authority.catalog_installs.is_empty());
        f.install("after-capacity-release");
    }

    #[test]
    fn catalog_install_repeated_aborted_missing_target_publications_bound_protection() {
        let mut f = Fixture::new();
        for _ in 0..32 {
            let stage = f.stage();
            let _reset = DirFaultReset;
            set_test_atomic_dir_injector(Some(Box::new(DirFault(
                AtomicDirFaultPoint::InstallRename,
            ))));
            assert!(f.publish_stage("aborted", stage.path()).is_err());
            assert!(!f.root.join("aborted").exists());
            assert_eq!(f.authority.catalog_installs.len(), 1);
            assert_eq!(f.authority.catalog_protected.len(), 1);
            assert_eq!(f.authority.registry_unique_id_count(), 2);
        }
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.authority.catalog_installs.is_empty());
        assert!(f.authority.catalog_protected.is_empty());
        f.install("fresh");
        assert!(f.root.join("fresh/data/network").exists());
    }

    #[test]
    fn catalog_install_concurrent_publication_adopts_winner_identity() {
        let mut f = Fixture::new();
        let stages = [f.stage(), f.stage()];
        fs::write(stages[1].path().join("engine"), b"second staged engine").unwrap();
        let resolved = [0, 1].map(|_| {
            f.authority
                .resolve(
                    f.handle.path_ref(),
                    PathOperation::DownloadArchive,
                    &[OsString::from("same")],
                )
                .unwrap()
        });
        let authority = SharedPathAuthority::installed(f.authority);
        let barrier = Arc::new(std::sync::Barrier::new(3));
        let threads = stages
            .into_iter()
            .zip(resolved)
            .map(|(stage, resolved)| {
                let authority = authority.clone();
                let destination = f.handle.path_ref().clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    crate::fs::publish_engine_archive_tree(
                        &authority,
                        &destination,
                        &resolved,
                        stage.path(),
                    )
                    .unwrap();
                })
            })
            .collect::<Vec<_>>();
        barrier.wait();
        for thread in threads {
            thread.join().unwrap();
        }
        authority
            .with_mut(|authority| {
                assert_eq!(authority.catalog_installs.len(), 1);
                let record = authority.catalog_installs.values().next().unwrap();
                let directory = open_verified_directory(
                    &f.root.join("same"),
                    (record.identity.a, record.identity.b),
                )
                .unwrap()
                .into_file();
                assert_eq!(
                    inventory(&directory, record.identity.a).unwrap().len(),
                    record.inventory.len()
                );
                assert!(inventory(&directory, record.identity.a)
                    .unwrap()
                    .iter()
                    .all(|entry| record.inventory.contains(entry)));
            })
            .unwrap();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn catalog_install_mount_refusal_precedes_deletion_and_retains_record() {
        use crate::infra::fs::{scoped_test_removal_injector, RemovalInjector};
        struct Mount;
        impl RemovalInjector for Mount {
            fn statx_mount_attributes(
                &self,
                _: std::os::fd::RawFd,
            ) -> Option<std::io::Result<(u64, u64)>> {
                let mount = rustix::fs::StatxAttributes::MOUNT_ROOT.bits();
                Some(Ok((mount, mount)))
            }
        }
        let mut f = Fixture::new();
        f.install("managed");
        f.reopen();
        let guard = scoped_test_removal_injector(Arc::new(Mount));
        assert!(f.reconcile(vec![], true).is_err());
        assert!(f.root.join("managed/engine").exists());
        assert_eq!(f.authority.catalog_installs.len(), 1);
        drop(guard);
        f.reconcile(vec![], true).unwrap();
        assert!(!f.root.join("managed").exists());
    }

    #[test]
    fn catalog_install_depth_refusal_keeps_record_and_foreign_contents() {
        let mut f = Fixture::new();
        f.install("managed");
        let mut deep = f.root.join("managed");
        for _ in 0..MAX_REMOVE_TREE_DEPTH {
            deep = deep.join("deep");
            fs::create_dir(&deep).unwrap();
        }
        fs::write(deep.join("foreign"), b"keep").unwrap();
        f.reopen();
        assert!(matches!(
            f.reconcile(vec![], true),
            Err(Error::ResourceLimit(_))
        ));
        assert!(deep.join("foreign").exists());
        assert_eq!(f.authority.catalog_installs.len(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn catalog_install_symlink_addition_preserves_foreign_target() {
        let mut f = Fixture::new();
        f.install("managed");
        let foreign = f.temp.path().join("foreign");
        fs::write(&foreign, b"keep").unwrap();
        std::os::unix::fs::symlink(&foreign, f.root.join("managed/link")).unwrap();
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert_eq!(fs::read(foreign).unwrap(), b"keep");
        assert!(f.root.join("managed/engine").exists());
        assert!(f.authority.catalog_installs.is_empty());
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn catalog_install_running_uci_game_survives_upgrade_and_unconfirmed_restart() {
        use crate::engine::{EngineActor, EngineDeadlines, EngineSupervisor, GoMode};
        use std::os::unix::fs::PermissionsExt;
        let mut f = Fixture::new();
        let stage = f.stage();
        fs::write(stage.path().join("engine"),
            b"#!/bin/sh\nwhile IFS= read -r line; do case \"$line\" in uci) echo uciok;; isready) if [ -f data/network ]; then echo readyok; else exit 3; fi;; go*) echo 'bestmove e2e4';; quit) exit 0;; esac; done\n").unwrap();
        fs::set_permissions(
            stage.path().join("engine"),
            fs::Permissions::from_mode(0o700),
        )
        .unwrap();
        f.publish_stage("old", stage.path()).unwrap();
        let old = f.engine("old");
        let executable = f
            .authority
            .engine_executable(&old, PathOperation::EngineExecute)
            .unwrap();
        let actor = Arc::new(
            EngineActor::spawn_initialized(executable, EngineDeadlines::default())
                .await
                .unwrap(),
        );
        let supervisor = EngineSupervisor::default();
        let key = crate::game::game_side_engine_key("catalog-game", 1, "white", "owner").unwrap();
        supervisor
            .replace_handle(
                key.clone(),
                actor.clone(),
                "owner".into(),
                old.path_ref().clone(),
            )
            .await
            .unwrap();
        f.install("new");
        let new = f.engine("new");
        supervisor
            .retire_engine_binary(
                "owner".into(),
                old.path_ref().clone(),
                new.path_ref().clone(),
            )
            .await
            .unwrap();
        f.reconcile(vec![new.path_ref().clone()], true).unwrap();
        f.reopen();
        f.reconcile(vec![new.path_ref().clone()], true).unwrap();
        assert!(f.root.join("old/data/network").exists());
        actor.ensure_ready().await.unwrap();
        let request = actor.start_search(&GoMode::Depth(1)).await.unwrap();
        assert_eq!(
            actor.next_search_line(request).await.unwrap().as_deref(),
            Some("bestmove e2e4")
        );
        assert!(supervisor.get_exact(&key).is_some());
        supervisor.terminate_all().await.unwrap();
        f.authority.clear_catalog_session_use().unwrap();
        f.reopen();
        f.reconcile(vec![new.path_ref().clone()], true).unwrap();
        assert!(
            f.root.join("old/data/network").exists(),
            "later sessions cannot erase unresolved origin use"
        );
    }
}
