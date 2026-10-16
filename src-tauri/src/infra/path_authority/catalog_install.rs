//! Native provenance for catalog trees. Records confer no path capability.
use super::*;
use crate::infra::fs::{
    open_removal_directory_at, open_verified_directory, remove_entry_at, MAX_REMOVE_TREE_DEPTH,
};

const MAX_INVENTORY_ENTRIES: usize = 16_384;
const MAX_INVENTORY_BYTES: u64 = 4 * 1024 * 1024 * 1024;

pub(super) type CatalogUses = BTreeMap<(PathBuf, u64, u64), BTreeMap<String, bool>>;

/// Durable evidence of child use, independent of archive ownership or resource authority.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub(super) struct CatalogUse {
    path: NativePath,
    identity: Identity,
    sessions: BTreeMap<String, bool>,
}

fn validate_use(
    path: &Path,
    a: u64,
    b: u64,
    sessions: &BTreeMap<String, bool>,
) -> Result<(), Error> {
    if !path.is_absolute()
        || (a == 0 && b == 0)
        || sessions.is_empty()
        || sessions
            .keys()
            .any(|session| Uuid::parse_str(session).is_err())
        || path.components().any(|part| {
            matches!(
                part,
                std::path::Component::CurDir | std::path::Component::ParentDir
            )
        })
    {
        return Err(Error::InvalidInput("invalid catalog use evidence".into()));
    }
    let components = path
        .components()
        .filter_map(|part| match part {
            std::path::Component::Normal(name) => Some(name.to_os_string()),
            _ => None,
        })
        .collect::<Vec<_>>();
    validate_components(&components)
}

fn validate_uses(uses: &CatalogUses) -> Result<(), Error> {
    let mut count = uses.len();
    for ((path, a, b), sessions) in uses {
        count = count
            .checked_add(sessions.len())
            .ok_or_else(invalid_record)?;
        if count > MAX_AUTHORITY_IDS {
            return Err(Error::ResourceLimit(
                "catalog use evidence limit reached".into(),
            ));
        }
        validate_use(path, *a, *b, sessions)?;
    }
    Ok(())
}

pub(super) fn encode_uses(uses: &CatalogUses) -> Vec<CatalogUse> {
    uses.iter()
        .map(|((path, a, b), sessions)| CatalogUse {
            path: NativePath::from_path(path),
            identity: Identity { a: *a, b: *b },
            sessions: sessions.clone(),
        })
        .collect()
}

pub(super) fn decode_uses(records: Vec<CatalogUse>) -> Result<CatalogUses, Error> {
    if records.len() > MAX_AUTHORITY_IDS
        || records
            .iter()
            .try_fold(records.len(), |count, record| {
                count.checked_add(record.sessions.len())
            })
            .is_none_or(|count| count > MAX_AUTHORITY_IDS)
        || serde_json::to_vec(&records)
            .map_err(|error| Error::InvalidInput(error.to_string()))?
            .len()
            > MAX_REGISTRY_BYTES
    {
        return Err(Error::ResourceLimit(
            "catalog use evidence limit reached".into(),
        ));
    }
    let mut uses = CatalogUses::new();
    for record in records {
        let path = record.path.to_path()?;
        validate_use(
            &path,
            record.identity.a,
            record.identity.b,
            &record.sessions,
        )?;
        if uses
            .insert(
                (path, record.identity.a, record.identity.b),
                record.sessions,
            )
            .is_some()
        {
            return Err(Error::InvalidInput("duplicate catalog use binding".into()));
        }
    }
    Ok(uses)
}

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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Reachability {
    /// Identity-confirmed descendant, recursive ancestor or exact pending reservation.
    Member,
    Disjoint,
    Uncertain,
}

impl Reachability {
    fn protects(self) -> bool {
        self != Self::Disjoint
    }
}

// Workspace ancestors do not own their children. Explicit directory resources do.
fn reaches(
    record: &CatalogInstall,
    path: &Path,
    recursive: bool,
    bound_identity: Option<&Identity>,
) -> Result<Reachability, Error> {
    // Inspection failure requires conservative retention and durable use, but is never
    // positive membership for cleaning refusal. None of these views authorize deletion.
    let physical = filesystem_reaches(
        &target(record)?,
        &record.identity,
        &record.root.identity,
        path,
        recursive,
        bound_identity,
    )
    .unwrap_or(Reachability::Uncertain);
    if physical == Reachability::Member {
        return Ok(physical);
    }
    if let Some(binding) = bound_identity {
        if *binding == record.identity
            || record
                .inventory
                .iter()
                .any(|entry| entry.identity == *binding)
        {
            return Ok(Reachability::Member);
        }
        if !recursive {
            // A known node outside the complete managed identity set cannot own independent
            // managed objects merely because its old locator disappeared. Physical membership
            // above still covers added objects. Collection independently rejects any changed
            // inventory before deletion, so this negative evidence grants no deletion authority.
            return Ok(Reachability::Disjoint);
        }
    }
    Ok(physical)
}

struct ReachabilityBinding {
    path: PathBuf,
    existing: bool,
}

impl ReachabilityBinding {
    fn resolve(path: &Path) -> Result<Self, Error> {
        match fs::canonicalize(path) {
            Ok(path) => Ok(Self {
                path,
                existing: true,
            }),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                // Only a missing final leaf has a useful partial binding. A dangling link,
                // unavailable parent or other uncertainty must conservatively retain trees.
                match fs::symlink_metadata(path) {
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    _ => return Err(Error::Conflict("uncertain catalog reachability".into())),
                }
                let parent = fs::canonicalize(path.parent().ok_or_else(invalid_record)?)?;
                Ok(Self {
                    path: parent.join(path.file_name().ok_or_else(invalid_record)?),
                    existing: false,
                })
            }
            Err(error) => Err(error.into()),
        }
    }

    fn has_ancestor(&self, expected: &Identity) -> Result<bool, Error> {
        let start = if self.existing {
            self.path.as_path()
        } else {
            self.path.parent().ok_or_else(invalid_record)?
        };
        // Include the existing leaf. This also recognizes moved trees and aliases when
        // their original provenance locator is unavailable or now names a substitute.
        for ancestor in start.ancestors() {
            if identity(ancestor)? == *expected {
                return Ok(true);
            }
        }
        Ok(false)
    }
}

fn filesystem_reaches(
    tree: &Path,
    expected_tree: &Identity,
    expected_root: &Identity,
    path: &Path,
    recursive: bool,
    bound_identity: Option<&Identity>,
) -> Result<Reachability, Error> {
    let current = ReachabilityBinding::resolve(path);
    let current_identity = match &current {
        Ok(binding) if binding.existing => identity(&binding.path).map(Some),
        _ => Ok(None),
    };
    let actual = current_identity.as_ref().ok().and_then(Option::as_ref);
    let binding = bound_identity.or(actual);
    let current_matches = bound_identity.is_none() || actual == bound_identity;
    if binding == Some(expected_tree) {
        return Ok(Reachability::Member);
    }
    if current_matches {
        if let Ok(path) = &current {
            if path.has_ancestor(expected_tree)? {
                return Ok(Reachability::Member);
            }
        }
    }
    let tree = ReachabilityBinding::resolve(tree)?;
    let original_target = if tree.existing {
        identity(&tree.path)? == *expected_tree
    } else {
        identity(tree.path.parent().ok_or_else(invalid_record)?)? == *expected_root
    };
    if original_target && recursive {
        if let Some(binding) = binding {
            if tree.has_ancestor(binding)? {
                return Ok(Reachability::Member);
            }
        }
    }
    // A different object at the old pathname says nothing about the historical binding.
    // Only the positive identity evidence above can confirm a relocated recursive use.
    if bound_identity.is_some() && !current_matches {
        return Ok(Reachability::Uncertain);
    }
    let path = current?;
    current_identity?;
    if tree.existing {
        if !original_target {
            // Identical spellings can name an independent replacement root or tree.
            // A recursive resource could still contain the displaced original elsewhere.
            return Ok(if recursive || !path.existing {
                Reachability::Uncertain
            } else {
                Reachability::Disjoint
            });
        }
        return Ok(if path.existing {
            Reachability::Disjoint
        } else {
            Reachability::Uncertain
        });
    }
    if !original_target {
        return Ok(if recursive || !path.existing {
            Reachability::Uncertain
        } else {
            Reachability::Disjoint
        });
    }
    if path.existing {
        return Ok(Reachability::Disjoint);
    }
    if identity(path.path.parent().ok_or_else(invalid_record)?)? == *expected_root {
        // An absent destination at its verified original root remains a pending reservation.
        // Different missing leaf spellings are uncertain, never confirmed filesystem aliases.
        return Ok(if tree.path.file_name() == path.path.file_name() {
            Reachability::Member
        } else {
            Reachability::Uncertain
        });
    }
    // A previously used resource can lose its final pathname before provenance is published.
    // Its existing parent cannot establish where that resource's original binding went.
    Ok(Reachability::Uncertain)
}

fn entry_reaches(record: &CatalogInstall, entry: &StoredEntry) -> Result<Reachability, Error> {
    reaches(
        record,
        &entry.path.to_path()?,
        entry.target_is_dir && entry.purpose == Some(EntryPurpose::EngineResource),
        Some(&entry.identity),
    )
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
                let (_, digest) = sha256_read_core(
                    &mut file,
                    buffer,
                    || Ok(()),
                    |read| {
                        *bytes = bytes.checked_add(read).ok_or_else(|| {
                            Error::ResourceLimit("catalog inventory content limit reached".into())
                        })?;
                        if *bytes > MAX_INVENTORY_BYTES {
                            return Err(Error::ResourceLimit(
                                "catalog inventory content limit reached".into(),
                            ));
                        }
                        Ok(())
                    },
                )?;
                Some(digest)
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
            + self.catalog_uses.values().map(BTreeMap::len).sum::<usize>()
            + self
                .catalog_installs
                .values()
                .map(|record| record.users.len())
                .sum::<usize>()
    }

    fn commit_catalog(&mut self, records: BTreeMap<String, CatalogInstall>) -> Result<(), Error> {
        self.commit_catalog_state(records, self.catalog_uses.clone(), false)
    }

    /// One atomic lifecycle candidate owns both scope uses and their derived install markers.
    fn commit_catalog_state(
        &mut self,
        records: BTreeMap<String, CatalogInstall>,
        uses: CatalogUses,
        clearing: bool,
    ) -> Result<(), Error> {
        // Capture admission before changing either state, including the first zero-install use.
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
        validate_uses(&uses)?;
        let previous = std::mem::replace(&mut self.catalog_installs, records);
        let previous_uses = std::mem::replace(&mut self.catalog_uses, uses);
        let result = self.commit_candidate_with_pending_baseline(
            self.persistent.clone(),
            self.pending_artifacts.clone(),
            None,
            Some(baseline),
        );
        match result {
            Ok(durability) => {
                if clearing && !matches!(durability, CommitDurability::Durable) {
                    // Unconfirmed clear is never positive in-memory evidence of child exit.
                    self.catalog_installs = previous;
                    self.catalog_uses = previous_uses;
                }
                self.catalog_protected
                    .retain(|id| self.catalog_installs.contains_key(id));
                require_durable(durability)
            }
            Err(error) => {
                self.catalog_installs = previous;
                self.catalog_uses = previous_uses;
                Err(error)
            }
        }
    }

    pub(super) fn protect_catalog_path(
        &mut self,
        path: &Path,
        recursive: bool,
        child_use: bool,
        bound_identity: Option<&Identity>,
    ) -> Result<(), Error> {
        self.protect_catalog_contexts(&[(path, recursive, bound_identity.cloned())], child_use)
    }

    pub(super) fn protect_catalog_contexts(
        &mut self,
        contexts: &[(&Path, bool, Option<Identity>)],
        child_use: bool,
    ) -> Result<(), Error> {
        let mut affected = BTreeSet::new();
        for (id, record) in &self.catalog_installs {
            for (path, recursive, binding) in contexts {
                let relation = reaches(record, path, *recursive, binding.as_ref())?;
                if record.cleaning && relation == Reachability::Member {
                    return Err(Error::Conflict(
                        "catalog install cleanup is in progress".into(),
                    ));
                }
                if relation.protects() {
                    affected.insert(id.clone());
                }
            }
        }
        if child_use {
            let mut uses = self.catalog_uses.clone();
            for (path, recursive, binding) in contexts {
                let binding = binding.as_ref().ok_or_else(|| {
                    Error::Conflict("resolved child use has no terminal binding".into())
                })?;
                let scope = uses
                    .entry((path.to_path_buf(), binding.a, binding.b))
                    .or_default()
                    .entry(self.catalog_session.clone())
                    .or_default();
                *scope |= *recursive;
            }
            let mut records = self.catalog_installs.clone();
            for id in &affected {
                records
                    .get_mut(id)
                    .ok_or_else(invalid_record)?
                    .users
                    .insert(self.catalog_session.clone());
            }
            if uses != self.catalog_uses
                || records != self.catalog_installs
                || self.registry_durability_pending
            {
                self.commit_catalog_state(records, uses, false)?;
            }
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
        self.protect_catalog_path(path, false, false, None)?;
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
        for ((used, a, b), sessions) in &self.catalog_uses {
            let binding = Identity { a: *a, b: *b };
            for (session, recursive) in sessions {
                if reaches(&record, used, *recursive, Some(&binding))?.protects() {
                    record.users.insert(session.clone());
                }
            }
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
        let mut records = self.catalog_installs.clone();
        for record in records.values_mut() {
            record.users.remove(&self.catalog_session);
        }
        let mut uses = self.catalog_uses.clone();
        for sessions in uses.values_mut() {
            sessions.remove(&self.catalog_session);
        }
        uses.retain(|_, sessions| !sessions.is_empty());
        self.commit_catalog_state(records, uses, true)
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
            'uses: for ((path, a, b), sessions) in &self.catalog_uses {
                let binding = Identity { a: *a, b: *b };
                for recursive in sessions.values() {
                    if reaches(&record, path, *recursive, Some(&binding))?.protects() {
                        live = true;
                        break 'uses;
                    }
                }
            }
            for entry in self
                .persistent
                .values()
                .chain(self.retired_attachments.values())
            {
                live |= entry_reaches(&record, &entry.stored)?.protects();
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

    #[cfg(target_os = "linux")]
    async fn finish_session(authority: PathAuthority) {
        let authority = SharedPathAuthority::installed(authority);
        let supervisor = crate::engine::EngineSupervisor::default();
        let games = crate::game::GameManager::new();
        let operations = crate::infra::operations::OperationRegistry::default();
        assert!(
            crate::shutdown_with_catalog_authority(
                crate::shutdown_backend_with_attachments(
                    &supervisor,
                    &games,
                    None,
                    &operations,
                    std::future::ready(Ok(())),
                    std::future::ready(Ok(())),
                    Duration::from_secs(20),
                ),
                authority.clone(),
                Duration::from_secs(20),
            )
            .await
        );
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

    fn cr6_cleaning_fixture() -> Fixture {
        let mut f = Fixture::new();
        f.install("managed");
        f.reopen();
        #[cfg(unix)]
        {
            use crate::infra::fs::{scoped_test_removal_injector, RemovalFault, RemovalFaultPoint};
            let _guard = scoped_test_removal_injector(Arc::new(RemovalFault(
                RemovalFaultPoint::BeforeTopOpen,
            )));
            assert!(f.reconcile(vec![], true).is_err());
        }
        #[cfg(windows)]
        {
            // Seed the same durable pre-removal retry state. Unix additionally proves the
            // production removal failure above, while Windows exercises resolution below.
            let mut records = f.authority.catalog_installs.clone();
            records.values_mut().next().unwrap().cleaning = true;
            f.authority.commit_catalog(records).unwrap();
        }
        f.reopen();
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.cleaning && record.users.is_empty()));
        f
    }

    fn cr6_independent_engine(f: &mut Fixture) -> EngineHandle {
        let directory = f.temp.path().join("independent");
        fs::create_dir(&directory).unwrap();
        let executable = directory.join("engine");
        fs::write(&executable, b"independent engine").unwrap();
        f.authority
            .register_engine_file(&executable, "Independent")
            .unwrap()
    }

    #[test]
    fn catalog_install_cr6_unavailable_cleaning_root_marks_unrelated_handoff_durably() {
        let mut f = cr6_cleaning_fixture();
        let engine = cr6_independent_engine(&mut f);
        let original = f.authority.catalog_installs.clone();
        let moved = f.temp.path().join("moved-root");
        fs::rename(&f.root, &moved).unwrap();
        let session = f.authority.catalog_session.clone();
        drop(
            f.authority
                .engine_executable(&engine, PathOperation::EngineExecute)
                .unwrap(),
        );
        let persisted = PathAuthority::open(f.temp.path().join("registry.json"), vec![]).unwrap();
        for (id, record) in &original {
            assert!(!persisted.catalog_installs[id].users.contains(&session));
            assert_eq!(persisted.catalog_installs[id].root, record.root);
            assert!(persisted.catalog_installs[id].cleaning);
            assert!(!f.authority.catalog_protected.contains(id));
        }
        assert_eq!(persisted.catalog_uses.len(), 2);
        assert!(persisted
            .catalog_uses
            .values()
            .all(|sessions| sessions.get(&session) == Some(&false)));
        drop(persisted);
        f.reopen();
        assert!(matches!(
            f.reconcile(vec![engine.path_ref().clone()], true),
            Err(Error::Io(_))
        ));
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| !record.users.contains(&session)));
        assert!(moved.join("managed/data/network").exists());
    }

    #[test]
    fn catalog_install_cr6_uncertain_marker_failure_refuses_handoff() {
        for uncertain in [false, true] {
            let mut f = cr6_cleaning_fixture();
            let engine = cr6_independent_engine(&mut f);
            fs::rename(&f.root, f.temp.path().join("moved-root")).unwrap();
            let fault: Arc<dyn AtomicWriterInjector + Send + Sync> = if uncertain {
                Arc::new(ParentSyncFault("uncertain catalog use"))
            } else {
                Arc::new(FileFault(AtomicFileFaultPoint::Write))
            };
            let _guard = install_test_atomic_file_injector(fault);
            for _ in 0..2 {
                let error = match f
                    .authority
                    .engine_executable(&engine, PathOperation::EngineExecute)
                {
                    Ok(_) => panic!("uncertain session use must be durable before handoff"),
                    Err(error) => error,
                };
                assert!(
                    matches!(error, Error::Io(_) | Error::CommittedDurabilityUncertain(_)),
                    "{error:?}"
                );
            }
            drop(_guard);
            drop(
                f.authority
                    .engine_executable(&engine, PathOperation::EngineExecute)
                    .unwrap(),
            );
            let session = f.authority.catalog_session.clone();
            f.reopen();
            assert!(f
                .authority
                .catalog_uses
                .values()
                .all(|sessions| sessions.get(&session) == Some(&false)));
            assert_eq!(f.authority.catalog_uses.len(), 2);
        }
    }

    #[test]
    fn catalog_install_cr6_replacement_root_and_tree_allow_independent_engine() {
        for replace_root in [false, true] {
            let mut f = cr6_cleaning_fixture();
            let original = f.authority.catalog_installs.clone();
            let old_tree = f.root.join("managed");
            let moved = f.temp.path().join("original-binding");
            if replace_root {
                fs::rename(&f.root, &moved).unwrap();
                fs::create_dir(&f.root).unwrap();
                let binding = identity(&f.root).unwrap();
                f.handle = f
                    .authority
                    .get_or_create_engine_root(
                        &f.root,
                        "Replacement",
                        Some(VerifiedIdentity::from_pair((binding.a, binding.b))),
                    )
                    .unwrap();
                f.root = f.authority.engine_root_path(&f.handle).unwrap();
            } else {
                fs::rename(&old_tree, &moved).unwrap();
            }
            fs::create_dir(f.root.join("managed")).unwrap();
            let executable = f.root.join("managed/engine");
            fs::write(&executable, b"independent replacement").unwrap();
            let engine = f
                .authority
                .register_engine_file(&executable, "Replacement")
                .unwrap();
            drop(
                f.authority
                    .engine_executable(&engine, PathOperation::EngineExecute)
                    .unwrap(),
            );
            for (id, record) in &original {
                assert_eq!(&f.authority.catalog_installs[id], record);
            }
            assert_eq!(fs::read(&executable).unwrap(), b"independent replacement");
            assert!(moved
                .join(if replace_root {
                    "managed/data/network"
                } else {
                    "data/network"
                })
                .exists());
        }
    }

    #[test]
    fn catalog_install_cr6_moved_cleaning_descendants_are_refused() {
        for move_root in [false, true] {
            let mut f = Fixture::new();
            f.install("managed");
            let moved = f.temp.path().join("moved-binding");
            if move_root {
                fs::rename(&f.root, &moved).unwrap();
            } else {
                fs::rename(f.root.join("managed"), &moved).unwrap();
            }
            let tree = if move_root {
                moved.join("managed")
            } else {
                moved.clone()
            };
            #[cfg(unix)]
            let selected = {
                let alias = f.temp.path().join("alias");
                std::os::unix::fs::symlink(&tree, &alias).unwrap();
                alias.join("engine")
            };
            #[cfg(windows)]
            let selected = tree.join("engine");
            let engine = f
                .authority
                .register_engine_file(&selected, "Moved")
                .unwrap();
            let resource = f.resource(&tree, true);
            // Persist a retry state after acquiring handles at their moved filesystem binding.
            let mut records = f.authority.catalog_installs.clone();
            records.values_mut().next().unwrap().cleaning = true;
            f.authority.commit_catalog(records).unwrap();
            f.reopen();
            assert!(
                matches!(f.authority.engine_executable(&engine, PathOperation::EngineExecute), Err(Error::Conflict(message)) if message == "catalog install cleanup is in progress")
            );
            assert!(
                matches!(f.authority.engine_resource(&resource), Err(Error::Conflict(message)) if message == "catalog install cleanup is in progress")
            );
            assert!(tree.join("data/network").exists());
            assert!(f
                .authority
                .catalog_installs
                .values()
                .all(|record| record.users.is_empty()));
        }
    }

    #[test]
    fn catalog_install_cr6_missing_cleaning_reservation_refuses_reuse() {
        let mut f = cr6_cleaning_fixture();
        let moved = f.temp.path().join("moved-tree");
        fs::rename(f.root.join("managed"), &moved).unwrap();
        let stage = f.stage();
        assert!(
            matches!(f.publish_stage("managed", stage.path()), Err(Error::Conflict(message)) if message == "catalog install cleanup is in progress")
        );
        assert!(!f.root.join("managed").exists());
        assert!(stage.path().join("engine").exists());
        assert!(moved.join("engine").exists());
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.cleaning));
    }

    #[test]
    fn catalog_install_cr6_distinct_absent_leaf_is_not_cleaning_membership() {
        let mut f = cr6_cleaning_fixture();
        let moved = f.temp.path().join("moved-tree");
        fs::rename(f.root.join("managed"), &moved).unwrap();
        let original = f.authority.catalog_installs.clone();
        let stage = f.stage();
        f.publish_stage("other", stage.path()).unwrap();
        assert_eq!(f.authority.catalog_installs.len(), 2);
        for (id, record) in original {
            assert_eq!(f.authority.catalog_installs[&id], record);
            assert!(f.authority.catalog_protected.contains(&id));
        }
        assert!(!f.root.join("managed").exists());
        assert!(f.root.join("other/data/network").exists());
        assert!(moved.join("data/network").exists());
    }

    #[test]
    fn catalog_install_cr6_retained_uncertainty_keeps_unavailable_provenance() {
        let mut f = cr6_cleaning_fixture();
        let _engine = cr6_independent_engine(&mut f);
        let resource = f.resource(&f.temp.path().join("independent"), true);
        let original = f.authority.catalog_installs.clone();
        fs::rename(&f.root, f.temp.path().join("moved-root")).unwrap();
        f.reopen();
        f.reconcile(vec![resource.path_ref().clone()], true)
            .unwrap();
        assert_eq!(f.authority.catalog_installs, original);
    }

    #[test]
    fn catalog_install_cr6_unavailable_prepublication_resource_marks_new_tree() {
        let mut f = Fixture::new();
        let original_root = f.root.clone();
        let resource = f.resource(&original_root, true);
        drop(f.authority.engine_resource(&resource).unwrap());
        let moved = f.temp.path().join("moved-root");
        fs::rename(&f.root, &moved).unwrap();
        let binding = identity(&moved).unwrap();
        f.handle = f
            .authority
            .get_or_create_engine_root(
                &moved,
                "Moved root",
                Some(VerifiedIdentity::from_pair((binding.a, binding.b))),
            )
            .unwrap();
        f.root = f.authority.engine_root_path(&f.handle).unwrap();
        f.authority.set_active_engine_root(&f.handle).unwrap();
        assert!(f
            .authority
            .catalog_uses
            .keys()
            .any(|(path, _, _)| path == &original_root));
        f.install("later");
        let session = f.authority.catalog_session.clone();
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&session)));
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&session)));
        assert!(f.root.join("later/data/network").exists());
    }

    fn phase3_select_root(f: &mut Fixture, path: &Path) {
        let binding = identity(path).unwrap();
        f.handle = f
            .authority
            .get_or_create_engine_root(
                path,
                "Moved root",
                Some(VerifiedIdentity::from_pair((binding.a, binding.b))),
            )
            .unwrap();
        f.root = f.authority.engine_root_path(&f.handle).unwrap();
        f.authority.set_active_engine_root(&f.handle).unwrap();
    }

    fn select_unrelated_workspace_for_cleanup(f: &mut Fixture) {
        // These locator tests must not retain a selected workspace's displaced historical
        // binding. Retire that selection natively, then let startup prune its unowned entry.
        let selected = f.temp.path().join("selected-workspace");
        fs::create_dir(&selected).unwrap();
        let handle = f
            .authority
            .get_or_create_engine_root(&selected, "Selected workspace", None)
            .unwrap();
        f.authority.set_active_engine_root(&handle).unwrap();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn catalog_install_phase3_historical_directory_lease_retains_later_publication() {
        let mut f = Fixture::new();
        let original = f.root.clone();
        let resource = f.resource(&original, true);
        let lease = f.authority.engine_resource(&resource).unwrap();
        let leased = PathBuf::from(lease.uci_value().unwrap());
        let moved = f.temp.path().join("moved-root");
        fs::rename(&original, &moved).unwrap();
        fs::create_dir(&original).unwrap();
        phase3_select_root(&mut f, &moved);
        f.install("later");
        assert_eq!(
            fs::read(leased.join("later/data/network")).unwrap(),
            b"managed network"
        );
        let session = f.authority.catalog_session.clone();
        let persisted = PathAuthority::open(f.temp.path().join("registry.json"), vec![]).unwrap();
        assert!(persisted
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&session)));
        drop(persisted);
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert_eq!(
            fs::read(leased.join("later/data/network")).unwrap(),
            b"managed network"
        );
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&session)));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn catalog_install_phase3_repeated_path_bindings_are_distinct_and_admitted() {
        let mut f = Fixture::new();
        let spelling = f.root.clone();
        let first = f.resource(&spelling, true);
        let first_lease = f.authority.engine_resource(&first).unwrap();
        let first_moved = f.temp.path().join("first-root");
        fs::rename(&spelling, &first_moved).unwrap();
        fs::create_dir(&spelling).unwrap();
        let binding = identity(&spelling).unwrap();
        let id = f
            .authority
            .get_or_create_root(
                &spelling,
                "Second binding",
                vec![PathOperation::EngineResourceRead],
                "resource",
                Some(VerifiedIdentity::from_pair((binding.a, binding.b))),
            )
            .unwrap();
        let second = EngineResourceHandle::new(
            id,
            EngineResourceHandleKind::Directory,
            "Second binding".into(),
        );
        let before = f.authority.registry_unique_id_count();
        let second_lease = f.authority.engine_resource(&second).unwrap();
        assert_eq!(f.authority.catalog_uses.len(), 2);
        assert_eq!(f.authority.registry_unique_id_count(), before + 2);
        drop(f.authority.engine_resource(&second).unwrap());
        assert_eq!(
            f.authority.catalog_uses.len(),
            2,
            "same binding is deduplicated"
        );
        let second_moved = f.temp.path().join("second-root");
        fs::rename(&spelling, &second_moved).unwrap();
        fs::create_dir(&spelling).unwrap();
        phase3_select_root(&mut f, &first_moved);
        f.install("first");
        phase3_select_root(&mut f, &second_moved);
        f.install("second");
        let session = f.authority.catalog_session.clone();
        assert_eq!(f.authority.catalog_installs.len(), 2);
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&session)));
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(PathBuf::from(first_lease.uci_value().unwrap())
            .join("first/engine")
            .exists());
        assert!(PathBuf::from(second_lease.uci_value().unwrap())
            .join("second/engine")
            .exists());
    }

    #[test]
    fn catalog_install_phase3_terminal_component_identity_does_not_protect_sibling() {
        let mut f = Fixture::new();
        let root = f.root.clone();
        fs::create_dir(root.join("selected")).unwrap();
        let resource = f.resource(&root, true);
        let resolved = f
            .authority
            .resolve(
                resource.path_ref(),
                PathOperation::EngineResourceRead,
                &[OsString::from("selected")],
            )
            .unwrap();
        assert_eq!(
            opened_file_identity(resolved.directory().unwrap()).unwrap(),
            {
                let binding = identity(&root.join("selected")).unwrap();
                (binding.a, binding.b)
            }
        );
        f.install("sibling");
        assert!(
            f.authority
                .catalog_installs
                .values()
                .all(|record| record.users.is_empty()),
            "terminal directory use does not recursively own its workspace ancestor"
        );
    }

    #[test]
    fn catalog_install_phase3_file_resource_used_before_publication_gets_marker() {
        let mut f = Fixture::new();
        let stage = f.stage();
        let resource = f.resource(&stage.path().join("engine"), false);
        drop(f.authority.engine_resource(&resource).unwrap());
        f.publish_stage("later", stage.path()).unwrap();
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&f.authority.catalog_session)));
    }

    #[test]
    fn catalog_install_phase3_retained_binding_survives_path_replacement() {
        let mut f = Fixture::new();
        let original = f.root.clone();
        let resource = f.resource(&original, true);
        let moved = f.temp.path().join("moved-root");
        fs::rename(&original, &moved).unwrap();
        fs::create_dir(&original).unwrap();
        phase3_select_root(&mut f, &moved);
        f.install("later");
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.is_empty()));
        f.reopen();
        f.reconcile(vec![resource.path_ref().clone()], true)
            .unwrap();
        assert!(f.root.join("later/data/network").exists());
        assert_eq!(f.authority.catalog_installs.len(), 1);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn catalog_install_phase3_historical_marker_failure_refuses_new_handoff() {
        for uncertain in [false, true] {
            let mut f = Fixture::new();
            let original = f.root.clone();
            let resource = f.resource(&original, true);
            let lease = f.authority.engine_resource(&resource).unwrap();
            let moved = f.temp.path().join("moved-root");
            fs::rename(&original, &moved).unwrap();
            fs::create_dir(&original).unwrap();
            phase3_select_root(&mut f, &moved);
            f.install("later");
            let origin = f.authority.catalog_session.clone();
            f.reopen();
            let nested = f.resource(&moved.join("later/data"), true);
            let fault: Arc<dyn AtomicWriterInjector + Send + Sync> = if uncertain {
                Arc::new(ParentSyncFault("historical marker sync"))
            } else {
                Arc::new(FileFault(AtomicFileFaultPoint::Write))
            };
            let guard = install_test_atomic_file_injector(fault);
            for _ in 0..2 {
                assert!(matches!(
                    f.authority.engine_resource(&nested),
                    Err(Error::Io(_) | Error::CommittedDurabilityUncertain(_))
                ));
            }
            drop(guard);
            drop(f.authority.engine_resource(&nested).unwrap());
            let current = f.authority.catalog_session.clone();
            f.reopen();
            assert!(f
                .authority
                .catalog_installs
                .values()
                .all(|record| record.users.contains(&origin) && record.users.contains(&current)));
            assert!(PathBuf::from(lease.uci_value().unwrap())
                .join("later/engine")
                .exists());
        }
    }

    #[test]
    fn catalog_install_phase3_existing_cleaning_tree_refuses_recursive_ancestor() {
        let mut f = cr6_cleaning_fixture();
        let root = f.root.clone();
        let resource = f.resource(&root, true);
        assert!(f.root.join("managed/engine").exists());
        assert!(
            matches!(f.authority.engine_resource(&resource), Err(Error::Conflict(message)) if message == "catalog install cleanup is in progress")
        );
    }

    #[cfg(target_os = "linux")]
    #[derive(Clone)]
    struct InheritedDirectoryChild {
        actor: Arc<crate::engine::EngineActor>,
        supervisor: Arc<crate::engine::EngineSupervisor>,
        value: String,
        resource: Option<EngineResourceHandle>,
    }

    #[cfg(target_os = "linux")]
    impl InheritedDirectoryChild {
        async fn spawn(f: &mut Fixture) -> Self {
            let path = f.root.clone();
            Self::spawn_resource(f, &path).await
        }

        async fn spawn_resource(f: &mut Fixture, path: &Path) -> Self {
            let resource = f.resource(path, true);
            let lease = Arc::new(f.authority.engine_resource(&resource).unwrap());
            let value = lease.uci_value().unwrap();
            let probe = f.temp.path().join("probe");
            fs::create_dir(&probe).unwrap();
            Self::spawn_image(
                f,
                &probe.join("resource-child"),
                Some((resource, lease)),
                value,
            )
            .await
        }

        async fn spawn_image(
            f: &mut Fixture,
            script: &Path,
            resource: Option<(EngineResourceHandle, Arc<EngineResourceLease>)>,
            value: String,
        ) -> Self {
            use crate::engine::{EngineActor, EngineDeadlines, EngineKey, EngineSupervisor};
            use std::os::unix::fs::PermissionsExt;
            fs::write(script, b"#!/bin/sh\nwhile IFS= read -r line; do case \"$line\" in uci) echo uciok;; isready) echo readyok;; setoption*) value=${line#*value }; cat \"$value\"; echo;; quit) exit 0;; esac; done\n").unwrap();
            fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
            let engine = f
                .authority
                .register_engine_file(&script, "Resource child")
                .unwrap();
            let executable = f
                .authority
                .engine_executable(&engine, PathOperation::EngineExecute)
                .unwrap()
                .with_resource_leases(
                    resource
                        .as_ref()
                        .map(|(_, lease)| lease.clone())
                        .into_iter()
                        .collect(),
                );
            let key = EngineKey::new("historical-resource".into(), "child".into()).unwrap();
            let supervisor = Arc::new(EngineSupervisor::default());
            let actor = Arc::new(
                EngineActor::spawn_initialized(executable, EngineDeadlines::default())
                    .await
                    .unwrap(),
            );
            let registration = supervisor
                .replace_handle(
                    key,
                    actor.clone(),
                    "child".into(),
                    engine.path_ref().clone(),
                )
                .await;
            if let Err(error) = registration {
                let cleanup = actor.terminate().await;
                assert!(cleanup.is_ok(), "failed registration child must be reaped");
                panic!("resource child registration failed: {error:?}");
            }
            InheritedDirectoryChild {
                actor,
                supervisor,
                value,
                resource: resource.map(|(handle, _)| handle),
            }
        }

        async fn assert_network(&self) {
            self.assert_contents("later/data/network").await;
        }

        async fn assert_contents(&self, relative: &str) {
            let value = format!("{}/{relative}", self.value);
            self.actor
                .set_option_with_resources("SyzygyPath", &value, std::slice::from_ref(&value))
                .await
                .unwrap();
            assert_eq!(
                tokio::time::timeout(Duration::from_secs(2), self.actor.next_configuration_line())
                    .await
                    .unwrap()
                    .unwrap()
                    .as_deref(),
                Some("managed network")
            );
        }

        async fn reap(&self) {
            let cleanup = self.supervisor.terminate_all().await;
            let fallback = self.actor.terminate().await;
            assert!(
                cleanup.is_ok(),
                "supervised child must be reaped: {cleanup:?}"
            );
            assert!(
                fallback.is_ok(),
                "actor reap must be confirmed: {fallback:?}"
            );
            eprintln!(
                "historical-resource child reaping confirmed before propagating test outcome"
            );
        }
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn catalog_install_phase3_inherited_resource_child_survives_publication_and_restart() {
        let mut f = Fixture::new();
        let original = f.root.clone();
        let child = InheritedDirectoryChild::spawn(&mut f).await;
        // Observe worker panics only after the parent has confirmed physical child reaping.
        let outcome = tokio::spawn({
            let child = child.clone();
            async move {
                let moved = f.temp.path().join("moved-root");
                fs::rename(&original, &moved).unwrap();
                fs::create_dir(&original).unwrap();
                phase3_select_root(&mut f, &moved);
                f.install("later");
                child.assert_network().await;
                let session = f.authority.catalog_session.clone();
                assert!(f
                    .authority
                    .catalog_installs
                    .values()
                    .all(|record| record.users.contains(&session)));
                f.reopen();
                f.reconcile(vec![], true).unwrap();
                child.assert_network().await;
            }
        })
        .await;
        child.reap().await;
        outcome.unwrap();
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn catalog_install_phase4_three_sessions_preserve_prepublication_child_use() {
        let mut f = Fixture::new();
        let child = InheritedDirectoryChild::spawn(&mut f).await;
        let origin = f.authority.catalog_session.clone();
        assert!(f.authority.catalog_installs.is_empty());
        let outcome = tokio::spawn({
            let child = child.clone();
            async move {
                f.reopen();
                let publisher = f.authority.catalog_session.clone();
                assert_ne!(origin, publisher);
                f.authority
                    .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                        retained_ids: Some(vec![]),
                        abandoned_ids: vec![],
                        startup: true,
                    })
                    .unwrap();
                assert!(!f
                    .authority
                    .persistent
                    .contains_key(&child.resource.as_ref().unwrap().path_ref().id));
                assert!(f
                    .authority
                    .retired_attachments
                    .contains_key(&child.resource.as_ref().unwrap().path_ref().id));
                let image: serde_json::Value =
                    serde_json::from_slice(&fs::read(f.temp.path().join("registry.json")).unwrap())
                        .unwrap();
                assert!(!image["entries"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(
                        |entry| entry["id"]["id"] == child.resource.as_ref().unwrap().path_ref().id
                    ));
                f.install("later");
                child.assert_network().await;
                finish_session(f.authority).await;
                f.authority =
                    PathAuthority::open(f.temp.path().join("registry.json"), vec![]).unwrap();
                assert_ne!(f.authority.catalog_session, publisher);
                assert!(!f
                    .authority
                    .persistent
                    .contains_key(&child.resource.as_ref().unwrap().path_ref().id));
                f.reconcile(vec![], true).unwrap();
                child.assert_network().await;
                assert_eq!(f.authority.catalog_installs.len(), 1);
                assert!(f
                    .authority
                    .catalog_installs
                    .values()
                    .all(|record| record.users.contains(&origin)
                        && !record.users.contains(&publisher)));
            }
        })
        .await;
        child.reap().await;
        outcome.unwrap();
    }

    #[test]
    fn catalog_install_phase4_zero_install_handoff_requires_durability_and_retry() {
        for uncertain in [false, true] {
            let mut f = Fixture::new();
            let root = f.root.clone();
            let resource = f.resource(&root, true);
            let fault: Arc<dyn AtomicWriterInjector + Send + Sync> = if uncertain {
                Arc::new(ParentSyncFault("zero-install use sync"))
            } else {
                Arc::new(FileFault(AtomicFileFaultPoint::Write))
            };
            let guard = install_test_atomic_file_injector(fault);
            for _ in 0..2 {
                assert!(matches!(
                    f.authority.engine_resource(&resource),
                    Err(Error::Io(_) | Error::CommittedDurabilityUncertain(_))
                ));
                assert!(f.authority.catalog_installs.is_empty());
            }
            drop(guard);
            drop(f.authority.engine_resource(&resource).unwrap());
            let origin = f.authority.catalog_session.clone();
            f.reopen();
            f.install("later");
            assert!(f
                .authority
                .catalog_installs
                .values()
                .all(|record| record.users.contains(&origin)));
        }
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn catalog_install_context1_eligibility_rechecks_completed_ancestor_substitution() {
        let mut f = Fixture::new();
        let outer = f.temp.path().join("outer");
        let container = outer.join("container");
        let root = container.join("engines");
        fs::create_dir_all(&root).unwrap();
        phase3_select_root(&mut f, &root);
        let leased = f.temp.path().join("leased");
        fs::create_dir(&leased).unwrap();
        let child = InheritedDirectoryChild::spawn_resource(&mut f, &leased).await;
        let origin = f.authority.catalog_session.clone();
        let outcome = tokio::spawn({
            let child = child.clone();
            async move {
                f.reopen();
                f.authority
                    .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                        retained_ids: Some(vec![]),
                        abandoned_ids: vec![],
                        startup: true,
                    })
                    .unwrap();
                assert!(!f
                    .authority
                    .persistent
                    .contains_key(&child.resource.as_ref().unwrap().path_ref().id));
                f.install("later");
                let record = f
                    .authority
                    .catalog_installs
                    .values()
                    .next()
                    .unwrap()
                    .clone();
                assert!(
                    !record.users.contains(&origin),
                    "publication must be unrelated to A"
                );
                assert!(f
                    .authority
                    .catalog_uses
                    .iter()
                    .all(|((path, a, b), sessions)| {
                        !sessions.contains_key(&origin)
                            || reaches(
                                &record,
                                path,
                                sessions[&origin],
                                Some(&Identity { a: *a, b: *b }),
                            )
                            .unwrap()
                                == Reachability::Disjoint
                    }));
                let root_identity = identity(&f.root).unwrap();
                let parent_identity = identity(&container).unwrap();
                let original_path = f.root.clone();
                finish_session(f.authority).await;
                let displaced = f.temp.path().join("displaced-outer");
                fs::rename(&outer, &displaced).unwrap();
                fs::rename(&leased, &outer).unwrap();
                fs::rename(displaced.join("container"), &container).unwrap();
                assert_eq!(f.root, original_path);
                assert_eq!(identity(&f.root).unwrap(), root_identity);
                assert_eq!(identity(&container).unwrap(), parent_identity);
                assert_eq!(identity(&f.root.join("later")).unwrap(), record.identity);
                let directory = open_verified_directory(
                    &f.root.join("later"),
                    (record.identity.a, record.identity.b),
                )
                .unwrap()
                .into_file();
                assert_eq!(
                    inventory(&directory, record.identity.a).unwrap(),
                    record.inventory
                );
                f.authority =
                    PathAuthority::open(f.temp.path().join("registry.json"), vec![]).unwrap();
                assert!(f
                    .authority
                    .catalog_installs
                    .values()
                    .all(|r| !r.users.contains(&origin)));
                f.reconcile(vec![], true).unwrap();
                child
                    .assert_contents("container/engines/later/data/network")
                    .await;
                assert!(f.root.join("later/data/network").exists());
                assert_eq!(f.authority.catalog_installs.len(), 1);
            }
        })
        .await;
        child.reap().await;
        outcome.unwrap();
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn catalog_install_context1_stale_file_nodes_do_not_own_unrelated_installs() {
        for replacement in [false, true] {
            let mut f = Fixture::new();
            let path = f.temp.path().join("network.nnue");
            fs::write(&path, b"original leased bytes").unwrap();
            let resource = f.resource(&path, false);
            let lease = f.authority.engine_resource(&resource).unwrap();
            let origin = f.authority.catalog_session.clone();
            f.reopen();
            f.authority
                .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                    retained_ids: Some(vec![]),
                    abandoned_ids: vec![],
                    startup: true,
                })
                .unwrap();
            fs::remove_file(&path).unwrap();
            if replacement {
                fs::write(&path, b"independent replacement").unwrap();
            }
            f.install("later");
            let projected = f
                .authority
                .catalog_installs
                .values()
                .any(|record| record.users.contains(&origin));
            finish_session(f.authority).await;
            f.authority = PathAuthority::open(f.temp.path().join("registry.json"), vec![]).unwrap();
            f.reconcile(vec![], true).unwrap();
            assert_eq!(
                fs::read(PathBuf::from(lease.uci_value().unwrap())).unwrap(),
                b"original leased bytes"
            );
            assert!(
                !f.root.join("later").exists(),
                "a stale file node retained an unrelated managed install"
            );
            assert!(
                !projected,
                "a stale file node cannot own unrelated managed objects"
            );
            assert!(f
                .authority
                .catalog_uses
                .values()
                .any(|sessions| sessions.contains_key(&origin)));
            assert_eq!(
                fs::read(PathBuf::from(lease.uci_value().unwrap())).unwrap(),
                b"original leased bytes"
            );
        }
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn catalog_install_context1_removed_image_cwd_keeps_relative_data_without_resource() {
        let mut f = Fixture::new();
        let stage = f.stage();
        let image = stage.path().join("engine");
        let child = InheritedDirectoryChild::spawn_image(&mut f, &image, None, ".".into()).await;
        let origin = f.authority.catalog_session.clone();
        let outcome = tokio::spawn({
            let child = child.clone();
            async move {
                assert!(child.resource.is_none());
                let image_identity = identity(&image).unwrap();
                let cwd_identity = identity(stage.path()).unwrap();
                fs::remove_file(&image).unwrap();
                f.publish_stage("later", stage.path()).unwrap();
                let record = f.authority.catalog_installs.values().next().unwrap();
                assert_eq!(record.identity, cwd_identity);
                assert!(record
                    .inventory
                    .iter()
                    .all(|entry| entry.identity != image_identity));
                f.reopen();
                f.authority
                    .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                        retained_ids: Some(vec![]),
                        abandoned_ids: vec![],
                        startup: true,
                    })
                    .unwrap();
                f.reconcile(vec![], true).unwrap();
                child.assert_contents("data/network").await;
                assert!(f
                    .authority
                    .catalog_installs
                    .values()
                    .all(|record| record.users.contains(&origin)));
                assert!(f
                    .authority
                    .catalog_uses
                    .iter()
                    .any(
                        |((_, a, b), sessions)| (*a, *b) == (cwd_identity.a, cwd_identity.b)
                            && sessions.get(&origin) == Some(&false)
                    ));
            }
        })
        .await;
        child.reap().await;
        outcome.unwrap();
    }

    #[test]
    fn catalog_install_context1_added_file_membership_still_refuses_cleaning() {
        let mut f = Fixture::new();
        f.install("managed");
        let added = f.root.join("managed/data/user-network");
        fs::write(&added, b"user data").unwrap();
        let resource = f.resource(&added, false);
        let mut records = f.authority.catalog_installs.clone();
        records.values_mut().next().unwrap().cleaning = true;
        f.authority.commit_catalog(records).unwrap();
        f.reopen();
        assert!(
            matches!(f.authority.engine_resource(&resource), Err(Error::Conflict(message)) if message == "catalog install cleanup is in progress")
        );
        assert_eq!(fs::read(&added).unwrap(), b"user data");
    }

    #[test]
    fn catalog_install_context1_image_and_cwd_are_one_durable_handoff() {
        struct CountWrites(std::sync::atomic::AtomicUsize);
        impl AtomicWriterInjector for CountWrites {
            fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == AtomicFileFaultPoint::Write {
                    self.0.fetch_add(1, Ordering::SeqCst);
                }
                Ok(())
            }
        }
        for fault in [None, Some(false), Some(true)] {
            let mut f = Fixture::new();
            let engine = cr6_independent_engine(&mut f);
            let origin = f.authority.catalog_session.clone();
            let counter = Arc::new(CountWrites(std::sync::atomic::AtomicUsize::new(0)));
            let injector: Arc<dyn AtomicWriterInjector + Send + Sync> = match fault {
                None => counter.clone(),
                Some(false) => Arc::new(FileFault(AtomicFileFaultPoint::Write)),
                Some(true) => Arc::new(ParentSyncFault("multi-context use sync")),
            };
            let guard = install_test_atomic_file_injector(injector);
            if fault.is_some() {
                for _ in 0..2 {
                    assert!(matches!(
                        f.authority
                            .engine_executable(&engine, PathOperation::EngineExecute),
                        Err(Error::Io(_) | Error::CommittedDurabilityUncertain(_))
                    ));
                }
            } else {
                drop(
                    f.authority
                        .engine_executable(&engine, PathOperation::EngineExecute)
                        .unwrap(),
                );
                assert_eq!(
                    counter.0.load(Ordering::SeqCst),
                    1,
                    "all contexts must enter one atomic write"
                );
            }
            drop(guard);
            drop(
                f.authority
                    .engine_executable(&engine, PathOperation::EngineExecute)
                    .unwrap(),
            );
            let disk: Registry =
                serde_json::from_slice(&fs::read(f.temp.path().join("registry.json")).unwrap())
                    .unwrap();
            let uses = decode_uses(disk.catalog_uses).unwrap();
            let cwd = f.temp.path().join("independent");
            for path in [&cwd, &cwd.join("engine")] {
                let binding = identity(path).unwrap();
                assert_eq!(
                    uses[&(path.clone(), binding.a, binding.b)].get(&origin),
                    Some(&false)
                );
            }
            assert_eq!(uses.len(), 2);
            assert!(disk.catalog_installs.is_empty());
        }
    }

    #[test]
    fn catalog_install_context1_directory_read_uses_actual_terminal_scope() {
        let mut f = Fixture::new();
        fs::create_dir(f.root.join("selected")).unwrap();
        let grant = f
            .authority
            .grant_dialog(
                &f.root,
                "Directory",
                PathClass::BoundedDialogGrant,
                PathOperation::EngineResourceRead,
                Duration::from_secs(30),
                2,
            )
            .unwrap();
        // A transient root has no EngineResource purpose. Its terminal directory still supplies
        // explicit resource contents, while the unselected workspace siblings remain independent.
        let resolved = f
            .authority
            .resolve(
                &grant,
                PathOperation::EngineResourceRead,
                &[OsString::from("selected")],
            )
            .unwrap();
        let binding = opened_file_identity(resolved.directory().unwrap()).unwrap();
        let key = (f.root.join("selected"), binding.0, binding.1);
        assert!(f.authority.catalog_uses[&key][&f.authority.catalog_session]);
        f.install("sibling");
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.is_empty()));
        phase3_select_root(&mut f, &key.0);
        f.install("nested");
        assert!(f
            .authority
            .catalog_installs
            .values()
            .filter(|record| target(record).unwrap() == f.root.join("nested"))
            .all(|record| record.users.contains(&f.authority.catalog_session)));
        assert_eq!(f.authority.catalog_installs.len(), 2);
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn catalog_install_context1_node_exclusion_still_preserves_changed_inventory() {
        let mut f = Fixture::new();
        let path = f.temp.path().join("network.nnue");
        fs::write(&path, b"original leased bytes").unwrap();
        let resource = f.resource(&path, false);
        let lease = f.authority.engine_resource(&resource).unwrap();
        let binding = identity(&path).unwrap();
        let origin = f.authority.catalog_session.clone();
        f.reopen();
        f.authority
            .reconcile_engine_attachments(EngineAttachmentAction::Reconcile {
                retained_ids: Some(vec![]),
                abandoned_ids: vec![],
                startup: true,
            })
            .unwrap();
        f.install("later");
        let record = f.authority.catalog_installs.values().next().unwrap();
        assert!(!record.users.contains(&origin));
        let added = f.root.join("later/data/user-network");
        fs::hard_link(&path, &added).unwrap();
        fs::remove_file(&path).unwrap();
        assert_eq!(
            reaches(record, &path, false, Some(&binding)).unwrap(),
            Reachability::Disjoint
        );
        finish_session(f.authority).await;
        f.authority = PathAuthority::open(f.temp.path().join("registry.json"), vec![]).unwrap();
        f.reconcile(vec![], true).unwrap();
        // Negative node evidence cannot bypass the independent complete-inventory check.
        assert!(f.authority.catalog_installs.is_empty());
        assert_eq!(fs::read(&added).unwrap(), b"original leased bytes");
        assert_eq!(
            fs::read(f.root.join("later/data/network")).unwrap(),
            b"managed network"
        );
        assert_eq!(
            fs::read(PathBuf::from(lease.uci_value().unwrap())).unwrap(),
            b"original leased bytes"
        );
    }

    #[test]
    fn catalog_install_phase4_recursive_broadening_is_durable_and_monotonic() {
        for uncertain in [false, true] {
            let mut f = Fixture::new();
            let image = f.root.join("probe-image");
            fs::write(&image, b"engine image").unwrap();
            let engine = f.authority.register_engine_file(&image, "Image").unwrap();
            drop(
                f.authority
                    .engine_executable(&engine, PathOperation::EngineExecute)
                    .unwrap(),
            );
            let origin = f.authority.catalog_session.clone();
            let binding = identity(&f.root).unwrap();
            let key = (f.root.clone(), binding.a, binding.b);
            assert!(!f.authority.catalog_uses[&key][&origin]);
            let resource = f.resource(&f.root.clone(), true);
            let fault: Arc<dyn AtomicWriterInjector + Send + Sync> = if uncertain {
                Arc::new(ParentSyncFault("recursive use sync"))
            } else {
                Arc::new(FileFault(AtomicFileFaultPoint::Write))
            };
            let guard = install_test_atomic_file_injector(fault);
            for _ in 0..2 {
                assert!(matches!(
                    f.authority.engine_resource(&resource),
                    Err(Error::Io(_) | Error::CommittedDurabilityUncertain(_))
                ));
            }
            drop(guard);
            drop(f.authority.engine_resource(&resource).unwrap());
            let count = f.authority.registry_unique_id_count();
            drop(
                f.authority
                    .engine_executable(&engine, PathOperation::EngineExecute)
                    .unwrap(),
            );
            assert_eq!(f.authority.registry_unique_id_count(), count);
            f.reopen();
            assert_eq!(f.authority.catalog_uses.len(), 2);
            assert!(f.authority.catalog_uses[&key][&origin]);
            f.install("later");
            assert!(f
                .authority
                .catalog_installs
                .values()
                .all(|record| record.users.contains(&origin)));
        }
    }

    #[test]
    fn catalog_install_phase4_clear_owns_only_its_session_and_rolls_back_both_states() {
        for uncertain in [false, true] {
            let mut f = Fixture::new();
            let resource = f.resource(&f.root.clone(), true);
            drop(f.authority.engine_resource(&resource).unwrap());
            let origin = f.authority.catalog_session.clone();
            f.reopen();
            let publisher = f.authority.catalog_session.clone();
            drop(f.authority.engine_resource(&resource).unwrap());
            f.install("later");
            let uses = f.authority.catalog_uses.clone();
            let records = f.authority.catalog_installs.clone();
            let fault: Arc<dyn AtomicWriterInjector + Send + Sync> = if uncertain {
                Arc::new(ParentSyncFault("session clear sync"))
            } else {
                Arc::new(FileFault(AtomicFileFaultPoint::Write))
            };
            let guard = install_test_atomic_file_injector(fault);
            assert!(matches!(
                f.authority.clear_catalog_session_use(),
                Err(Error::Io(_) | Error::CommittedDurabilityUncertain(_))
            ));
            assert_eq!(f.authority.catalog_uses, uses);
            assert_eq!(f.authority.catalog_installs, records);
            let disk: Registry =
                serde_json::from_slice(&fs::read(f.temp.path().join("registry.json")).unwrap())
                    .unwrap();
            let disk_uses = decode_uses(disk.catalog_uses).unwrap();
            let sessions = disk_uses.values().next().unwrap();
            assert!(sessions.contains_key(&origin));
            assert_eq!(sessions.contains_key(&publisher), !uncertain);
            assert!(disk
                .catalog_installs
                .values()
                .all(|record| record.users.contains(&origin)
                    && record.users.contains(&publisher) == !uncertain));
            drop(guard);
            f.authority.clear_catalog_session_use().unwrap();
            f.reopen();
            assert_eq!(
                f.authority
                    .catalog_uses
                    .values()
                    .next()
                    .unwrap()
                    .keys()
                    .collect::<Vec<_>>(),
                vec![&origin]
            );
            // C has no authority to discharge A, even after owner pruning.
            f.authority.clear_catalog_session_use().unwrap();
            f.reconcile(vec![], true).unwrap();
            f.reopen();
            assert!(f.root.join("later/data/network").exists());
            assert!(f.authority.catalog_uses.values().all(|sessions| sessions
                .contains_key(&origin)
                && !sessions.contains_key(&publisher)));
            assert!(f
                .authority
                .catalog_installs
                .values()
                .all(|record| record.users == BTreeSet::from([origin.clone()])));
        }
    }

    #[test]
    fn catalog_install_phase4_legacy_absence_preserves_unknown_install_users_without_grant() {
        let mut f = Fixture::new();
        f.install("old");
        let engine = f.engine("old");
        drop(
            f.authority
                .engine_executable(&engine, PathOperation::EngineExecute)
                .unwrap(),
        );
        let origin = f.authority.catalog_session.clone();
        let registry_path = f.temp.path().join("registry.json");
        let mut registry: serde_json::Value =
            serde_json::from_slice(&fs::read(&registry_path).unwrap()).unwrap();
        registry.as_object_mut().unwrap().remove("catalog_uses");
        fs::write(&registry_path, serde_json::to_vec(&registry).unwrap()).unwrap();
        f.reopen();
        assert!(f.authority.catalog_uses.is_empty());
        f.authority.clear_catalog_session_use().unwrap();
        f.reconcile(vec![], true).unwrap();
        assert!(f.root.join("old/data/network").exists());
        assert!(f
            .authority
            .engine_executable(&engine, PathOperation::EngineExecute)
            .is_err());
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&origin)));
    }

    #[test]
    fn catalog_install_phase4_registry_rejects_malformed_and_oversized_use_evidence() {
        let mut f = Fixture::new();
        let resource = f.resource(&f.root.clone(), true);
        drop(f.authority.engine_resource(&resource).unwrap());
        let registry_path = f.temp.path().join("registry.json");
        let original: serde_json::Value =
            serde_json::from_slice(&fs::read(&registry_path).unwrap()).unwrap();
        let template = encode_uses(&f.authority.catalog_uses).pop().unwrap();
        let mut cases = Vec::new();
        let mut record = template.clone();
        record.path = NativePath::from_path(Path::new("relative"));
        cases.push(vec![record]);
        let mut record = template.clone();
        record.path = NativePath::from_path(&f.root.join("../elsewhere"));
        cases.push(vec![record]);
        let mut record = template.clone();
        record.identity = Identity { a: 0, b: 0 };
        cases.push(vec![record]);
        let mut record = template.clone();
        record.sessions = BTreeMap::from([("invalid-session".into(), true)]);
        cases.push(vec![record]);
        let mut record = template.clone();
        record.sessions.clear();
        cases.push(vec![record]);
        let mut record = template.clone();
        record.path = NativePath::Unix {
            bytes: "invalid!".into(),
        };
        cases.push(vec![record]);
        cases.push(vec![template.clone(), template.clone()]);
        let mut record = template.clone();
        record.sessions = (0..MAX_AUTHORITY_IDS)
            .map(|_| (Uuid::new_v4().to_string(), true))
            .collect();
        cases.push(vec![record]);
        cases.push(vec![template.clone(); MAX_AUTHORITY_IDS + 1]);
        let mut record = template;
        record.path = NativePath::from_path(&f.root.join("x".repeat(MAX_REGISTRY_BYTES)));
        cases.push(vec![record]);
        for records in cases {
            let mut registry = original.clone();
            registry["catalog_uses"] = serde_json::to_value(records).unwrap();
            fs::write(&registry_path, serde_json::to_vec(&registry).unwrap()).unwrap();
            assert!(matches!(
                PathAuthority::open(registry_path.clone(), vec![]),
                Err(Error::InvalidInput(_) | Error::ResourceLimit(_))
            ));
        }
    }

    #[test]
    fn catalog_install_phase4_shared_capacity_refuses_new_binding_and_reuses_durable_use() {
        let started = std::time::Instant::now();
        let mut f = Fixture::new();
        let resources = f.temp.path().join("resources");
        fs::create_dir(&resources).unwrap();
        let existing_path = resources.join("r0");
        fs::create_dir(&existing_path).unwrap();
        fs::write(existing_path.join("authorized"), b"durable contents").unwrap();
        let overflow_path = resources.join("overflow");
        fs::create_dir(&overflow_path).unwrap();
        fs::write(overflow_path.join("authorized"), b"new contents").unwrap();
        let _root = f.resource(&resources, true);
        let existing = f.resource(&existing_path, true);
        let overflow = f.resource(&overflow_path, true);
        let mut uses = f.authority.catalog_uses.clone();
        let available = MAX_AUTHORITY_IDS - f.authority.registry_unique_id_count();
        assert_eq!(available % 2, 0);
        for index in 0..available / 2 {
            let name = format!("r{index}");
            let path = resources.join(&name);
            if index != 0 {
                fs::create_dir(&path).unwrap();
            }
            let binding = identity(&path).unwrap();
            uses.insert(
                (path, binding.a, binding.b),
                BTreeMap::from([(f.authority.catalog_session.clone(), true)]),
            );
        }
        f.authority
            .commit_catalog_state(f.authority.catalog_installs.clone(), uses, false)
            .unwrap();
        let inspected = PathAuthority::open(f.temp.path().join("registry.json"), vec![]).unwrap();
        assert_eq!(inspected.catalog_uses, f.authority.catalog_uses);
        assert_eq!(inspected.registry_unique_id_count(), MAX_AUTHORITY_IDS);
        drop(inspected);
        eprintln!(
            "native capacity fixture: {} bindings, {} admission units, setup {:?}",
            f.authority.catalog_uses.len(),
            f.authority.registry_unique_id_count(),
            started.elapsed()
        );
        assert!(
            matches!(
                f.authority.engine_resource(&overflow),
                Err(Error::ResourceLimit(_))
            ),
            "new binding crossed shared admission at {}",
            f.authority.registry_unique_id_count()
        );
        let lease = f.authority.engine_resource(&existing).unwrap();
        assert_eq!(
            fs::read(PathBuf::from(lease.uci_value().unwrap()).join("authorized")).unwrap(),
            b"durable contents"
        );
        assert_eq!(f.authority.registry_unique_id_count(), MAX_AUTHORITY_IDS);
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

    #[tokio::test]
    async fn catalog_install_production_shutdown_durably_clears_only_after_success() {
        for outcome in ["success", "failure", "timeout"] {
            let mut f = Fixture::new();
            f.install("old");
            let engine = f.engine("old");
            drop(
                f.authority
                    .engine_executable(&engine, PathOperation::EngineExecute)
                    .unwrap(),
            );
            let session = f.authority.catalog_session.clone();
            assert!(f
                .authority
                .catalog_installs
                .values()
                .all(|record| record.users.contains(&session)));
            let authority = SharedPathAuthority::installed(f.authority);
            let supervisor = crate::engine::EngineSupervisor::default();
            let games = crate::game::GameManager::new();
            let operations = crate::infra::operations::OperationRegistry::default();
            let budget = if outcome == "timeout" {
                Duration::from_millis(100)
            } else {
                Duration::from_secs(5)
            };
            let teardown = crate::shutdown_backend_with_attachments(
                &supervisor,
                &games,
                None,
                &operations,
                async {
                    match outcome {
                        "failure" => Err("catalog teardown refused".into()),
                        "timeout" => std::future::pending().await,
                        _ => Ok(()),
                    }
                },
                std::future::ready(Ok(())),
                budget,
            );
            assert_eq!(
                crate::shutdown_with_catalog_authority(teardown, authority.clone(), budget).await,
                outcome == "success"
            );
            assert!(operations.prepare_download("after-shutdown").is_err());
            drop(authority);
            f.authority = PathAuthority::open(f.temp.path().join("registry.json"), vec![]).unwrap();
            assert_eq!(
                f.authority
                    .catalog_installs
                    .values()
                    .any(|record| record.users.contains(&session)),
                outcome != "success"
            );
            f.reconcile(vec![], true).unwrap();
            assert_eq!(
                f.root.join("old/data/network").exists(),
                outcome != "success"
            );
        }
    }

    #[cfg(unix)]
    fn alias_catalog_locator(f: &mut Fixture) {
        let alias = f.temp.path().join("alias");
        std::os::unix::fs::symlink(f.temp.path().parent().unwrap(), &alias).unwrap();
        let root = alias
            .join(f.temp.path().file_name().unwrap())
            .join("engines");
        let binding = identity(&f.root).unwrap();
        assert_eq!(identity(&root).unwrap(), binding);
        // This is only supplemental retention evidence. Cleanup retains its independent
        // no-follow boundary and is never authorized through this alias.
        let mut records = f.authority.catalog_installs.clone();
        for record in records.values_mut() {
            record.root.path = NativePath::from_path(&root);
        }
        f.authority.commit_catalog(records).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn catalog_install_filesystem_alias_retained_executable_and_recursive_ancestor() {
        for recursive in [false, true] {
            let mut f = Fixture::new();
            f.install("old");
            let retained = if recursive {
                let root = f.root.clone();
                f.resource(&root, true).path_ref().clone()
            } else {
                f.engine("old").path_ref().clone()
            };
            f.authority.clear_catalog_session_use().unwrap();
            alias_catalog_locator(&mut f);
            f.reopen();
            let record = f.authority.catalog_installs.values().next().unwrap();
            let entry = &f.authority.persistent[&retained.id].stored;
            assert!(entry_reaches(record, entry).unwrap().protects());
            f.reconcile(vec![retained], true).unwrap();
            assert!(f.root.join("old/data/network").exists());
            assert_eq!(f.authority.catalog_installs.len(), 1);
        }
    }

    #[cfg(unix)]
    #[test]
    fn catalog_install_filesystem_alias_current_session_use_is_durable() {
        let mut f = Fixture::new();
        f.install("old");
        let engine = f.engine("old");
        f.authority.clear_catalog_session_use().unwrap();
        alias_catalog_locator(&mut f);
        f.reopen();
        drop(
            f.authority
                .engine_executable(&engine, PathOperation::EngineExecute)
                .unwrap(),
        );
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&f.authority.catalog_session)));
        f.reconcile(vec![], true).unwrap();
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.root.join("old/data/network").exists());
    }

    #[cfg(unix)]
    #[test]
    fn catalog_install_filesystem_alias_prepublication_ancestor_use_is_durable() {
        let mut f = Fixture::new();
        let root = f.root.clone();
        let resource = f.resource(&root, true);
        let lease = f.authority.engine_resource(&resource).unwrap();
        let renamed = f.temp.path().join("renamed");
        fs::rename(&root, &renamed).unwrap();
        std::os::unix::fs::symlink(&renamed, &root).unwrap();
        assert_eq!(
            fs::canonicalize(&root).unwrap(),
            fs::canonicalize(&renamed).unwrap()
        );
        // Model the root's new spelling while preserving the earlier successful resource use.
        f.authority
            .persistent
            .get_mut(&f.handle.path_ref().id)
            .unwrap()
            .stored
            .path = NativePath::from_path(&renamed);
        f.root = renamed;
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
    fn catalog_install_filesystem_bindings_keep_disjoint_paths_and_uncertainty_conservative() {
        let temp = tempfile::tempdir().unwrap();
        let lower = temp.path().join("engines");
        let upper = temp.path().join("Engines");
        fs::create_dir(&lower).unwrap();
        let relation = |tree: &Path, path: &Path, recursive| {
            let expected_tree = identity(tree).unwrap_or(Identity { a: 0, b: 0 });
            let expected_root = identity(tree.parent().unwrap()).unwrap();
            filesystem_reaches(tree, &expected_tree, &expected_root, path, recursive, None)
                .unwrap_or(Reachability::Uncertain)
        };
        if !upper.exists() {
            fs::create_dir(&upper).unwrap();
            assert_eq!(relation(&lower, &upper, true), Reachability::Disjoint);
        }
        let unrelated = temp.path().join("unrelated");
        fs::create_dir(&unrelated).unwrap();
        assert_eq!(relation(&lower, &unrelated, true), Reachability::Disjoint);
        assert_eq!(
            relation(&lower.join("missing-install"), &lower, true),
            Reachability::Member
        );
        assert_eq!(
            relation(&lower.join("missing-install"), &unrelated, true),
            Reachability::Disjoint
        );
        assert_eq!(
            relation(&lower, &temp.path().join("unavailable/leaf"), false),
            Reachability::Uncertain
        );
        let file = lower.join("file");
        let alias = unrelated.join("file-alias");
        fs::write(&file, b"binding").unwrap();
        fs::hard_link(&file, &alias).unwrap();
        assert!(
            relation(&file, &alias, false) == Reachability::Member,
            "existing leaf aliases use identity, not canonical strings"
        );
    }

    #[test]
    fn catalog_install_inventory_digest_enforces_cumulative_cap_and_checked_accounting() {
        let f = Fixture::new();
        let stage = f.stage();
        let binding = identity(stage.path()).unwrap();
        let directory = open_verified_directory(stage.path(), (binding.a, binding.b))
            .unwrap()
            .into_file();
        for mut bytes in [MAX_INVENTORY_BYTES - 1, u64::MAX] {
            let error = walk(
                &directory,
                Path::new(""),
                binding.a,
                &mut bytes,
                &mut Vec::new(),
                &mut vec![0; 64 * 1024],
            )
            .unwrap_err();
            assert!(
                matches!(error, Error::ResourceLimit(ref message) if message == "catalog inventory content limit reached"),
                "{error:?}"
            );
        }
    }

    #[cfg(windows)]
    fn rename_case_alias(f: &mut Fixture) -> bool {
        let renamed = f.temp.path().join("Engines");
        fs::rename(&f.root, &renamed).unwrap();
        if !f.root.exists() {
            eprintln!("case-sensitive fixture filesystem, case-alias runtime scenario skipped");
            return false;
        }
        assert_eq!(identity(&f.root).unwrap(), identity(&renamed).unwrap());
        f.root = renamed;
        true
    }

    #[cfg(windows)]
    #[test]
    fn catalog_install_windows_case_rename_retained_executable_and_recursive_ancestor() {
        for recursive in [false, true] {
            let mut f = Fixture::new();
            f.install("old");
            let engine = f.engine("old");
            f.authority.clear_catalog_session_use().unwrap();
            if !rename_case_alias(&mut f) {
                continue;
            }
            let retained = if recursive {
                let root = f.root.clone();
                f.resource(&root, true).path_ref().clone()
            } else {
                engine.path_ref().clone()
            };
            f.reopen();
            f.reconcile(vec![retained], true).unwrap();
            assert!(f.root.join("old/data/network").exists());
        }
    }

    #[cfg(windows)]
    #[test]
    fn catalog_install_windows_case_rename_current_session_use() {
        let mut f = Fixture::new();
        f.install("old");
        let engine = f.engine("old");
        f.authority.clear_catalog_session_use().unwrap();
        if !rename_case_alias(&mut f) {
            return;
        }
        f.reopen();
        drop(
            f.authority
                .engine_executable(&engine, PathOperation::EngineExecute)
                .unwrap(),
        );
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&f.authority.catalog_session)));
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.root.join("old/data/network").exists());
    }

    #[cfg(windows)]
    #[test]
    fn catalog_install_windows_case_rename_prepublication_ancestor_use() {
        let mut f = Fixture::new();
        let root = f.root.clone();
        let resource = f.resource(&root, true);
        let lease = f.authority.engine_resource(&resource).unwrap();
        // Windows pins the selected directory against rename while the descriptor is held.
        // Session reachability must outlive that descriptor for the rest of this process.
        drop(lease);
        if !rename_case_alias(&mut f) {
            return;
        }
        f.authority
            .persistent
            .get_mut(&f.handle.path_ref().id)
            .unwrap()
            .stored
            .path = NativePath::from_path(&f.root);
        f.install("later");
        assert!(f
            .authority
            .catalog_installs
            .values()
            .all(|record| record.users.contains(&f.authority.catalog_session)));
        f.reopen();
        f.reconcile(vec![], true).unwrap();
        assert!(f.root.join("later/data/network").exists());
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
        select_unrelated_workspace_for_cleanup(&mut f);
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
        select_unrelated_workspace_for_cleanup(&mut f);
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
