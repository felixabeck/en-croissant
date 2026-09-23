//! Native, crash-consistent storage for practice decks.
//!
//! This module contains the synchronous practice store and its Tauri command wrappers. The
//! wrappers run these functions in the blocking gateway without changing the store's locking or
//! error semantics.

use crate::{
    error::{DurabilityStage, Error},
    infra::{
        blocking::BLOCKING_GATEWAY,
        fs::{self, DirectoryEntryKind},
        path_authority::AuthorizedDir,
    },
};
use chrono::Utc;
use parking_lot::{Mutex, MutexGuard};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashMap},
    ffi::OsStr,
    fs::File,
    io::Write,
    path::Path,
    sync::{Arc, OnceLock},
};
use tokio_util::sync::CancellationToken;

pub(crate) const PRACTICE_STORAGE_VERSION: u32 = 1;
pub(crate) const PRACTICE_SHARD_SEAL_BYTES: usize = 128 * 1024;
pub(crate) const PRACTICE_POSITIONS_MAX_BYTES: usize = 8 * 1024 * 1024;
pub(crate) const PRACTICE_ENTRY_MAX_BYTES: usize = 16 * 1024;
pub(crate) const PRACTICE_READ_MAX_ENTRIES: u32 = 500;
pub(crate) const PRACTICE_ID_MAX_BYTES: usize = 64;
pub(crate) const PRACTICE_LEGACY_MAX_BYTES: usize = 8 * 1024 * 1024;

const POSITIONS_SUFFIX: &str = "-positions.json";
const STATE_SUFFIX: &str = "-state.json";
const SHARD_MARKER: &str = "-g";
const SHARD_SUFFIX: &str = "-reviews-";
const LOCK_SUFFIX: &str = ".lock";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeDeckSnapshot {
    pub positions_document: String,
    pub revision: u32,
    pub generation: u32,
    pub migrated: bool,
    pub unapplied_reviews: u32,
    pub orphans_acknowledged: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeReviewPage {
    pub entries: Vec<PracticeReviewEntry>,
    pub next_cursor: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeReviewEntry {
    pub id: String,
    pub entry: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PracticeMigrationStatus {
    Migrated,
    AlreadyMigrated,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeMigrationOutcome {
    pub status: PracticeMigrationStatus,
    pub entries: u32,
    pub positions: u32,
    pub positions_digest: String,
    pub entries_digest: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeDeckIdentity {
    pub file_id: String,
    pub game: i32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "PascalCase")]
pub(crate) enum PracticeStoreAnomalyKind {
    OrphanShard,
    DamagedDeck,
    IdentityMismatch,
    Unreadable,
    NotARegularFile,
    StrandedMigration,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeStoreAnomaly {
    pub kind: PracticeStoreAnomalyKind,
    pub leaf: String,
    pub file_id: Option<String>,
    pub game: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeDeckInventory {
    pub decks: Vec<PracticeDeckIdentity>,
    pub anomalies: Vec<PracticeStoreAnomaly>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum LegacySource {
    LocalStorage,
    None,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PositionsEnvelope {
    version: u32,
    file_id: String,
    game: i32,
    revision: u32,
    generation: u32,
    last_entry_id: Option<String>,
    last_entry_digest: Option<String>,
    applied_entries: u32,
    orphan_entries: u32,
    orphan_acknowledged_count: u32,
    legacy_source: LegacySource,
    migrated_at: Option<String>,
    migrated_entries: Option<u32>,
    migrated_positions_digest: Option<String>,
    positions: Vec<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewShardEnvelope {
    version: u32,
    file_id: String,
    game: i32,
    generation: u32,
    ordinal: u32,
    entries: Vec<ReviewShardEntry>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewShardEntry {
    id: String,
    rev: u32,
    entry: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MigrationStateEnvelope {
    version: u32,
    file_id: String,
    game: i32,
    phase: MigrationPhase,
    legacy_digest: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum MigrationPhase {
    Migrating,
    Migrated,
    Reset,
}

#[derive(Clone, Debug)]
struct ShardFile {
    leaf: String,
    envelope: ReviewShardEnvelope,
}

#[derive(Clone, Copy, Debug)]
struct Reconciliation {
    total_entries: u32,
    /// The envelope's orphan count plus the newly orphaned entries. Computed here, in the one
    /// validation every read shares, so a deck the inventory accepts can also be loaded.
    orphan_entries: u32,
}

struct ValidatedDeck {
    state: Option<MigrationStateEnvelope>,
    positions: Option<PositionsEnvelope>,
    shards: Vec<ShardFile>,
    shard_leaves: Vec<ShardLeafRecord>,
    reconciliation: Option<Reconciliation>,
}

struct DeckValidationFailure {
    error: Error,
    identity: Option<PracticeDeckIdentity>,
    io: bool,
}

impl DeckValidationFailure {
    fn new(error: Error, identity: Option<PracticeDeckIdentity>) -> Self {
        let io = matches!(&error, Error::Io(_));
        Self {
            error,
            identity,
            io,
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct Cursor {
    generation: u32,
    ordinal: u32,
    offset: u32,
}

#[derive(Clone, Debug)]
enum OwnedLeaf {
    Positions(String),
    State(String),
    Shard {
        hash: String,
        generation: u32,
        ordinal: u32,
    },
    Lock(String),
}

fn lock_registry() -> &'static Mutex<HashMap<String, Arc<Mutex<()>>>> {
    static REGISTRY: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// The registry is keyed by the native deck hash, so unrelated decks never serialize one another.
struct PracticeMutexLease {
    hash: String,
    lock: Option<Arc<Mutex<()>>>,
}

impl PracticeMutexLease {
    fn new(hash: &str) -> Self {
        let mut registry = lock_registry().lock();
        let lock = registry
            .entry(hash.to_owned())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone();
        Self {
            hash: hash.to_owned(),
            lock: Some(lock),
        }
    }

    fn lock(&self) -> Option<MutexGuard<'_, ()>> {
        self.lock.as_ref().map(|lock| lock.lock())
    }
}

impl Drop for PracticeMutexLease {
    fn drop(&mut self) {
        let Some(lock) = self.lock.take() else {
            return;
        };
        let mut registry = lock_registry().lock();
        if let Some(current) = registry.get(&self.hash) {
            if Arc::ptr_eq(current, &lock) && Arc::strong_count(current) == 2 {
                registry.remove(&self.hash);
            }
        }
    }
}

struct AdvisoryDeckLock {
    _file: File,
}

impl AdvisoryDeckLock {
    fn acquire(directory: &AuthorizedDir, hash: &str) -> Result<Self, Error> {
        let leaf = format!("{hash}{LOCK_SUFFIX}");
        let file = directory.open_or_create_regular_relative(Path::new(&leaf))?;
        #[cfg(unix)]
        rustix::fs::flock(&file, rustix::fs::FlockOperation::LockExclusive)
            .map_err(|error| Error::Io(Box::new(error.into())))?;
        #[cfg(windows)]
        lock_windows(&file)?;
        Ok(Self { _file: file })
    }
}

#[cfg(windows)]
fn lock_windows(file: &File) -> Result<(), Error> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::{
        Foundation::HANDLE,
        Storage::FileSystem::{LockFileEx, LOCKFILE_EXCLUSIVE_LOCK},
        System::IO::OVERLAPPED,
    };
    let mut overlapped: OVERLAPPED = unsafe { std::mem::zeroed() };
    let result = unsafe {
        // SAFETY: the handle is a live regular file and the OVERLAPPED value is exclusively owned.
        LockFileEx(
            file.as_raw_handle() as HANDLE,
            LOCKFILE_EXCLUSIVE_LOCK,
            0,
            u32::MAX,
            u32::MAX,
            &mut overlapped,
        )
    };
    if result == 0 {
        return Err(Error::Io(Box::new(std::io::Error::last_os_error())));
    }
    Ok(())
}

fn with_deck_lock<T>(
    directory: &AuthorizedDir,
    hash: &str,
    operation: impl FnOnce() -> Result<T, Error>,
) -> Result<T, Error> {
    let mutex = PracticeMutexLease::new(hash);
    let _guard = mutex
        .lock()
        .ok_or_else(|| Error::Conflict("practice mutex could not be acquired".into()))?;
    let _advisory = AdvisoryDeckLock::acquire(directory, hash)?;
    #[cfg(test)]
    run_critical_section_hook();
    operation()
}

fn hash_deck(file_id: &str, game: i32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(file_id.as_bytes());
    hasher.update([0]);
    hasher.update(game.to_string().as_bytes());
    format!("{:x}", hasher.finalize())
}

fn hash_migration_entry(
    file_id: &str,
    game: i32,
    index: usize,
    entry: &Value,
) -> Result<String, Error> {
    let canonical = canonical_bytes(entry)?;
    let mut hasher = Sha256::new();
    hasher.update(file_id.as_bytes());
    hasher.update([0]);
    hasher.update(game.to_string().as_bytes());
    hasher.update([0]);
    hasher.update(index.to_string().as_bytes());
    hasher.update([0]);
    hasher.update(canonical);
    Ok(format!("{:x}", hasher.finalize()))
}

fn canonical_value(value: &Value) -> Value {
    match value {
        Value::Array(values) => Value::Array(values.iter().map(canonical_value).collect()),
        Value::Object(object) => {
            let mut keys = object.keys().collect::<Vec<_>>();
            keys.sort_unstable();
            let mut sorted = Map::new();
            for key in keys {
                if let Some(value) = object.get(key) {
                    sorted.insert(key.clone(), canonical_value(value));
                }
            }
            Value::Object(sorted)
        }
        other => other.clone(),
    }
}

fn canonical_bytes(value: &Value) -> Result<Vec<u8>, Error> {
    serde_json::to_vec(&canonical_value(value))
        .map_err(|_| Error::InvalidInput("practice JSON cannot be canonicalized".into()))
}

fn digest_value(value: &Value) -> Result<String, Error> {
    let mut hasher = Sha256::new();
    hasher.update(canonical_bytes(value)?);
    Ok(format!("{:x}", hasher.finalize()))
}

fn invalid_leaf(leaf: &str, reason: &str) -> Error {
    Error::InvalidInput(format!("practice leaf {leaf}: {reason}"))
}

fn operation_io(operation: &str, leaf: &str, error: std::io::Error) -> Error {
    log::warn!("practice {operation} failed for leaf {leaf}: {error}");
    Error::Io(Box::new(std::io::Error::new(
        error.kind(),
        format!("practice {operation} failed for leaf {leaf}"),
    )))
}

fn operation_error(operation: &str, leaf: &str, error: Error) -> Error {
    match error {
        Error::Io(source) => operation_io(operation, leaf, *source),
        Error::InvalidInput(_) => invalid_leaf(leaf, "contents are invalid"),
        other => other,
    }
}

fn read_leaf_bytes(
    directory: &AuthorizedDir,
    leaf: &str,
    max_bytes: usize,
    operation: &str,
) -> Result<Option<Vec<u8>>, Error> {
    let mut file = match directory.open_regular_relative(Path::new(leaf)) {
        Ok(file) => file,
        Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(operation_error(operation, leaf, error)),
    };
    let declared = file
        .metadata()
        .map_err(|error| operation_io(operation, leaf, error))?
        .len();
    if declared > max_bytes as u64 {
        return Err(invalid_leaf(leaf, "document exceeds its size limit"));
    }
    fs::read_bounded_bytes(
        &mut file,
        declared,
        max_bytes,
        "practice document exceeds its size limit",
        || Ok(()),
    )
    .map(Some)
    .map_err(|error| operation_error(operation, leaf, error))
}

fn read_json<T: for<'de> Deserialize<'de>>(
    directory: &AuthorizedDir,
    leaf: &str,
    max_bytes: usize,
    operation: &str,
) -> Result<Option<T>, Error> {
    let Some(bytes) = read_leaf_bytes(directory, leaf, max_bytes, operation)? else {
        return Ok(None);
    };
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| invalid_leaf(leaf, "document is malformed JSON"))
}

fn write_json<T: Serialize>(
    directory: &AuthorizedDir,
    leaf: &str,
    value: &T,
    stage: DurabilityStage,
    operation: &str,
) -> Result<(), Error> {
    let bytes = serde_json::to_vec(value)
        .map_err(|_| invalid_leaf(leaf, "document cannot be serialized"))?;
    let (outcome, _) = directory
        .atomic_replace_leaf_identified(OsStr::new(leaf), |file| {
            file.write_all(&bytes)
                .map_err(|error| operation_io(operation, leaf, error))
        })
        .map_err(|error| operation_error(operation, leaf, error))?;
    fs::require_durable(outcome, stage)
}

fn valid_hash(hash: &str) -> bool {
    hash.len() == 64
        && hash
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn parse_owned_leaf(name: &str) -> Option<OwnedLeaf> {
    if let Some(hash) = name.strip_suffix(POSITIONS_SUFFIX) {
        if valid_hash(hash) {
            return Some(OwnedLeaf::Positions(hash.to_owned()));
        }
    }
    if let Some(hash) = name.strip_suffix(STATE_SUFFIX) {
        if valid_hash(hash) {
            return Some(OwnedLeaf::State(hash.to_owned()));
        }
    }
    if let Some(hash) = name.strip_suffix(LOCK_SUFFIX) {
        if valid_hash(hash) {
            return Some(OwnedLeaf::Lock(hash.to_owned()));
        }
    }
    let (hash, rest) = name.split_once(SHARD_MARKER)?;
    let (generation, ordinal) = rest.split_once(SHARD_SUFFIX)?;
    let generation = generation.parse().ok()?;
    let ordinal = ordinal.strip_suffix(".json")?.parse().ok()?;
    valid_hash(hash).then_some(OwnedLeaf::Shard {
        hash: hash.to_owned(),
        generation,
        ordinal,
    })
}

fn positions_leaf(hash: &str) -> String {
    format!("{hash}{POSITIONS_SUFFIX}")
}

fn state_leaf(hash: &str) -> String {
    format!("{hash}{STATE_SUFFIX}")
}

fn shard_leaf(hash: &str, generation: u32, ordinal: u32) -> String {
    format!("{hash}{SHARD_MARKER}{generation}{SHARD_SUFFIX}{ordinal}.json")
}

fn check_identity(leaf: &str, version: u32, file_id: &str, game: i32) -> Result<String, Error> {
    if version != PRACTICE_STORAGE_VERSION {
        return Err(invalid_leaf(leaf, "unsupported storage version"));
    }
    let hash = hash_deck(file_id, game);
    let expected = parse_owned_leaf(leaf).map(|owned| match owned {
        OwnedLeaf::Positions(hash) | OwnedLeaf::State(hash) => hash,
        OwnedLeaf::Shard { hash, .. } | OwnedLeaf::Lock(hash) => hash,
    });
    if expected.as_deref() != Some(hash.as_str()) {
        return Err(invalid_leaf(leaf, "identity does not match its leaf"));
    }
    Ok(hash)
}

fn validate_positions_document(raw: &str, leaf: &str) -> Result<Value, Error> {
    if raw.len() > PRACTICE_POSITIONS_MAX_BYTES {
        return Err(invalid_leaf(
            leaf,
            "positions document exceeds its size limit",
        ));
    }
    let value: Value =
        serde_json::from_str(raw).map_err(|_| invalid_leaf(leaf, "positions JSON is malformed"))?;
    let positions = value
        .as_object()
        .and_then(|object| object.get("positions"))
        .and_then(Value::as_array)
        .ok_or_else(|| invalid_leaf(leaf, "positions document has no positions array"))?;
    let canonical = Value::Object(Map::from_iter([(
        "positions".to_owned(),
        Value::Array(positions.clone()),
    )]));
    if canonical_bytes(&canonical)?.len() > PRACTICE_POSITIONS_MAX_BYTES {
        return Err(invalid_leaf(leaf, "positions array exceeds its size limit"));
    }
    Ok(canonical)
}

fn positions_array(value: &Value) -> Result<Vec<Value>, Error> {
    value
        .get("positions")
        .and_then(Value::as_array)
        .cloned()
        .ok_or_else(|| Error::InvalidInput("practice positions array is missing".into()))
}

fn positions_document(value: &Value) -> Result<String, Error> {
    serde_json::to_string(value)
        .map_err(|_| Error::InvalidInput("practice positions cannot be serialized".into()))
}

fn read_positions(
    directory: &AuthorizedDir,
    hash: &str,
) -> Result<Option<PositionsEnvelope>, Error> {
    let leaf = positions_leaf(hash);
    #[cfg(test)]
    let inject_io_failure = PRACTICE_POSITIONS_READ_IO_FAILURE_HOOK.with(|slot| {
        let mut slot = slot.borrow_mut();
        if slot.as_deref() == Some(hash) {
            slot.take().is_some()
        } else {
            false
        }
    });
    #[cfg(test)]
    if inject_io_failure {
        return Err(Error::Io(Box::new(std::io::Error::other(
            "injected positions read failure",
        ))));
    }
    let Some(mut envelope) = read_json::<PositionsEnvelope>(
        directory,
        &leaf,
        PRACTICE_POSITIONS_MAX_BYTES,
        "read positions",
    )?
    else {
        return Ok(None);
    };
    if check_identity(&leaf, envelope.version, &envelope.file_id, envelope.game)? != hash {
        return Err(invalid_leaf(&leaf, "identity does not match its deck"));
    }
    if envelope
        .last_entry_id
        .as_ref()
        .is_some_and(|id| id.len() > PRACTICE_ID_MAX_BYTES)
        || envelope
            .last_entry_digest
            .as_ref()
            .is_some_and(|digest| digest.len() != 64)
    {
        return Err(invalid_leaf(&leaf, "entry anchor is invalid"));
    }
    if envelope.legacy_source == LegacySource::LocalStorage
        && (envelope.migrated_entries.is_none() || envelope.migrated_positions_digest.is_none())
    {
        return Err(invalid_leaf(&leaf, "migration metadata is incomplete"));
    }
    envelope.positions = envelope
        .positions
        .into_iter()
        .map(|value| canonical_value(&value))
        .collect();
    Ok(Some(envelope))
}

fn read_state(
    directory: &AuthorizedDir,
    hash: &str,
) -> Result<Option<MigrationStateEnvelope>, Error> {
    let leaf = state_leaf(hash);
    let Some(state) = read_json::<MigrationStateEnvelope>(
        directory,
        &leaf,
        PRACTICE_LEGACY_MAX_BYTES,
        "read migration state",
    )?
    else {
        return Ok(None);
    };
    check_identity(&leaf, state.version, &state.file_id, state.game)?;
    if state.legacy_digest.len() != 64 {
        return Err(invalid_leaf(&leaf, "migration digest is invalid"));
    }
    Ok(Some(state))
}

fn read_shards(
    directory: &AuthorizedDir,
    hash: &str,
    generation: u32,
) -> Result<Vec<ShardFile>, Error> {
    let entries = fs::read_directory_entries_at(
        directory.directory_file(),
        &CancellationToken::new(),
        &mut |_| true,
    )?;
    let mut shards = Vec::new();
    for entry in entries {
        let name = entry.name.to_string_lossy().into_owned();
        let Some(OwnedLeaf::Shard {
            hash: entry_hash,
            generation: entry_generation,
            ordinal,
        }) = parse_owned_leaf(&name)
        else {
            continue;
        };
        if entry_hash != hash || entry_generation != generation {
            continue;
        }
        if entry.kind != DirectoryEntryKind::RegularFile {
            return Err(invalid_leaf(&name, "review shard is not a regular file"));
        }
        let Some(envelope) = read_json::<ReviewShardEnvelope>(
            directory,
            &name,
            PRACTICE_LEGACY_MAX_BYTES,
            "read review shard",
        )?
        else {
            return Err(invalid_leaf(&name, "review shard disappeared"));
        };
        if check_identity(&name, envelope.version, &envelope.file_id, envelope.game)? != hash
            || envelope.generation != generation
            || envelope.ordinal != ordinal
            || envelope.entries.is_empty()
        {
            return Err(invalid_leaf(&name, "review shard identity is invalid"));
        }
        for review in &envelope.entries {
            if review.id.is_empty() || review.id.len() > PRACTICE_ID_MAX_BYTES || review.rev == 0 {
                return Err(invalid_leaf(&name, "review entry identity is invalid"));
            }
        }
        shards.push(ShardFile {
            leaf: name,
            envelope,
        });
    }
    shards.sort_by_key(|shard| shard.envelope.ordinal);
    Ok(shards)
}

type ShardLeafRecord = (String, u32, u32, DirectoryEntryKind, (u64, u64));

fn all_shard_leaves(directory: &AuthorizedDir, hash: &str) -> Result<Vec<ShardLeafRecord>, Error> {
    let entries = fs::read_directory_entries_at(
        directory.directory_file(),
        &CancellationToken::new(),
        &mut |_| true,
    )?;
    Ok(entries
        .into_iter()
        .filter_map(|entry| {
            let name = entry.name.to_string_lossy().into_owned();
            match parse_owned_leaf(&name) {
                Some(OwnedLeaf::Shard {
                    hash: entry_hash,
                    generation,
                    ordinal,
                }) if entry_hash == hash => {
                    Some((name, generation, ordinal, entry.kind, entry.identity))
                }
                _ => None,
            }
        })
        .collect())
}

fn reconcile(
    envelope: &PositionsEnvelope,
    shards: &[ShardFile],
    leaf: &str,
) -> Result<Reconciliation, Error> {
    let total = shards.iter().try_fold(0_u32, |total, shard| {
        let count = u32::try_from(shard.envelope.entries.len())
            .map_err(|_| Error::Conflict("practice review count exceeded u32::MAX".into()))?;
        total
            .checked_add(count)
            .ok_or_else(|| Error::Conflict("practice review count exceeded u32::MAX".into()))
    })?;
    if total < envelope.applied_entries {
        return Err(invalid_leaf(leaf, "review history is missing entries"));
    }
    let orphan_entries = envelope
        .orphan_entries
        .checked_add(total - envelope.applied_entries)
        .ok_or_else(|| Error::Conflict("practice orphan count exceeded u32::MAX".into()))?;
    Ok(Reconciliation {
        total_entries: total,
        orphan_entries,
    })
}

fn next_counter(value: u32, label: &str) -> Result<u32, Error> {
    value
        .checked_add(1)
        .ok_or_else(|| Error::Conflict(format!("practice {label} reached its limit")))
}

fn read_validated_deck(
    directory: &AuthorizedDir,
    hash: &str,
) -> Result<ValidatedDeck, DeckValidationFailure> {
    let state_result = read_state(directory, hash);
    let positions_result = read_positions(directory, hash);
    let positions_identity = positions_result.as_ref().ok().and_then(|positions| {
        positions.as_ref().map(|positions| PracticeDeckIdentity {
            file_id: positions.file_id.clone(),
            game: positions.game,
        })
    });
    let state = state_result
        .map_err(|error| DeckValidationFailure::new(error, positions_identity.clone()))?;
    let state_identity = state.as_ref().map(|state| PracticeDeckIdentity {
        file_id: state.file_id.clone(),
        game: state.game,
    });
    let positions = positions_result
        .map_err(|error| DeckValidationFailure::new(error, state_identity.clone()))?;
    let Some(positions) = positions else {
        let shard_leaves = all_shard_leaves(directory, hash)
            .map_err(|error| DeckValidationFailure::new(error, state_identity.clone()))?;
        return Ok(ValidatedDeck {
            state,
            positions: None,
            shards: Vec::new(),
            shard_leaves,
            reconciliation: None,
        });
    };
    let identity = Some(PracticeDeckIdentity {
        file_id: positions.file_id.clone(),
        game: positions.game,
    });
    let shards = read_shards(directory, hash, positions.generation)
        .map_err(|error| DeckValidationFailure::new(error, identity.clone()))?;
    let reconciliation = reconcile(&positions, &shards, &positions_leaf(hash))
        .map_err(|error| DeckValidationFailure::new(error, identity))?;
    Ok(ValidatedDeck {
        state,
        positions: Some(positions),
        shards,
        shard_leaves: Vec::new(),
        reconciliation: Some(reconciliation),
    })
}

fn load_valid_deck(
    directory: &AuthorizedDir,
    hash: &str,
) -> Result<Option<(PositionsEnvelope, Vec<ShardFile>, Reconciliation)>, Error> {
    let loaded = read_validated_deck(directory, hash).map_err(|failure| failure.error)?;
    let Some(positions) = loaded.positions else {
        if loaded
            .state
            .as_ref()
            .is_some_and(|state| state.phase == MigrationPhase::Reset)
        {
            return Ok(None);
        }
        if loaded.state.is_some() || !loaded.shard_leaves.is_empty() {
            return Err(invalid_leaf(
                &positions_leaf(hash),
                "positions document is missing",
            ));
        }
        return Ok(None);
    };
    let reconciliation = loaded
        .reconciliation
        .ok_or_else(|| invalid_leaf(&positions_leaf(hash), "practice reconciliation is missing"))?;
    Ok(Some((positions, loaded.shards, reconciliation)))
}

fn snapshot_from(
    envelope: &PositionsEnvelope,
    reconciliation: Reconciliation,
) -> Result<PracticeDeckSnapshot, Error> {
    let positions = Value::Object(Map::from_iter([(
        "positions".to_owned(),
        Value::Array(envelope.positions.clone()),
    )]));
    let orphan_entries = reconciliation.orphan_entries;
    Ok(PracticeDeckSnapshot {
        positions_document: positions_document(&positions)?,
        revision: envelope.revision,
        generation: envelope.generation,
        migrated: envelope.legacy_source == LegacySource::LocalStorage,
        unapplied_reviews: orphan_entries,
        orphans_acknowledged: orphan_entries <= envelope.orphan_acknowledged_count,
    })
}

pub(crate) fn load_practice_deck_in(
    directory: &AuthorizedDir,
    file_id: &str,
    game: i32,
) -> Result<Option<PracticeDeckSnapshot>, Error> {
    let hash = hash_deck(file_id, game);
    with_deck_lock(directory, &hash, || {
        load_valid_deck(directory, &hash).and_then(|loaded| {
            loaded.map_or(Ok(None), |(envelope, _, reconciliation)| {
                snapshot_from(&envelope, reconciliation).map(Some)
            })
        })
    })
}

fn validate_entry(entry: &str, leaf: &str) -> Result<Value, Error> {
    if entry.len() > PRACTICE_ENTRY_MAX_BYTES {
        return Err(invalid_leaf(leaf, "review entry exceeds its size limit"));
    }
    serde_json::from_str(entry).map_err(|_| invalid_leaf(leaf, "review entry is malformed JSON"))
}

fn entry_digest(entry: &Value) -> Result<String, Error> {
    digest_value(entry)
}

fn shard_bytes(shard: &ReviewShardEnvelope) -> Result<Vec<u8>, Error> {
    serde_json::to_vec(shard)
        .map_err(|_| Error::InvalidInput("practice review shard cannot be serialized".into()))
}

fn append_sealed_review(
    shards: &mut Vec<ReviewShardEnvelope>,
    file_id: &str,
    game: i32,
    generation: u32,
    review: ReviewShardEntry,
) -> Result<(), Error> {
    let mut current = shards.pop().unwrap_or_else(|| ReviewShardEnvelope {
        version: PRACTICE_STORAGE_VERSION,
        file_id: file_id.to_owned(),
        game,
        generation,
        ordinal: 0,
        entries: Vec::new(),
    });
    let mut candidate = current.clone();
    candidate.entries.push(review.clone());
    if !current.entries.is_empty() && shard_bytes(&candidate)?.len() > PRACTICE_SHARD_SEAL_BYTES {
        shards.push(current.clone());
        current = ReviewShardEnvelope {
            version: PRACTICE_STORAGE_VERSION,
            file_id: file_id.to_owned(),
            game,
            generation,
            ordinal: next_counter(current.ordinal, "shard ordinal")?,
            entries: vec![review],
        };
    } else {
        current = candidate;
    }
    shards.push(current);
    Ok(())
}

// This shared appender carries the shard metadata and sealing policy, so rating and migration cannot diverge.
#[allow(clippy::too_many_arguments)]
fn append_review(
    directory: &AuthorizedDir,
    hash: &str,
    file_id: &str,
    game: i32,
    generation: u32,
    revision: u32,
    latest_shard: Option<&ReviewShardEnvelope>,
    entry_id: &str,
    entry: &Value,
) -> Result<(), Error> {
    let review = ReviewShardEntry {
        id: entry_id.to_owned(),
        rev: revision,
        entry: canonical_value(entry),
    };
    let mut next = latest_shard.cloned().into_iter().collect::<Vec<_>>();
    append_sealed_review(&mut next, file_id, game, generation, review)?;
    let target = next
        .last()
        .ok_or_else(|| Error::InvalidInput("practice review shard is empty".into()))?;
    let leaf = shard_leaf(hash, generation, target.ordinal);
    write_json(
        directory,
        &leaf,
        &target,
        DurabilityStage::PracticeReviewShard,
        "write review shard",
    )
}

fn write_positions(
    directory: &AuthorizedDir,
    hash: &str,
    envelope: &PositionsEnvelope,
) -> Result<(), Error> {
    let leaf = positions_leaf(hash);
    ensure_positions_size(envelope, &leaf)?;
    write_json(
        directory,
        &leaf,
        envelope,
        DurabilityStage::PracticePositions,
        "write positions",
    )
}

fn ensure_positions_size(envelope: &PositionsEnvelope, leaf: &str) -> Result<(), Error> {
    let bytes = serde_json::to_vec(envelope)
        .map_err(|_| invalid_leaf(leaf, "document cannot be serialized"))?;
    if bytes.len() > PRACTICE_POSITIONS_MAX_BYTES {
        return Err(invalid_leaf(
            leaf,
            "positions document exceeds its size limit",
        ));
    }
    Ok(())
}

fn find_entry_since(shards: &[ShardFile], base_revision: u32, entry_id: &str) -> Option<Value> {
    for shard in shards.iter().rev() {
        for review in shard.envelope.entries.iter().rev() {
            if review.rev <= base_revision {
                return None;
            }
            if review.id == entry_id {
                return Some(review.entry.clone());
            }
        }
    }
    None
}

fn entry_position(shards: &[ShardFile], entry_id: &str) -> Option<u32> {
    let mut position = 0_u32;
    for shard in shards {
        for review in &shard.envelope.entries {
            if review.id == entry_id {
                return Some(position);
            }
            position = position.checked_add(1)?;
        }
    }
    None
}

// This internal helper mirrors the stable IPC wire shape: one rating carries its optimistic snapshot and entry.
#[allow(clippy::too_many_arguments)]
pub(crate) fn record_practice_review_in(
    directory: &AuthorizedDir,
    file_id: &str,
    game: i32,
    generation: u32,
    revision: u32,
    base_revision: u32,
    positions_document: &str,
    entry: &str,
    entry_id: &str,
) -> Result<u32, Error> {
    if entry_id.is_empty() || entry_id.len() > PRACTICE_ID_MAX_BYTES {
        return Err(Error::InvalidInput("practice entry id is invalid".into()));
    }
    let positions_value = validate_positions_document(positions_document, "incoming-positions")?;
    let incoming_entry = validate_entry(entry, "incoming-review")?;
    let hash = hash_deck(file_id, game);
    with_deck_lock(directory, &hash, || {
        let (mut envelope, shards, reconciliation) = load_valid_deck(directory, &hash)?
            .ok_or_else(|| {
                invalid_leaf(
                    &positions_leaf(&hash),
                    "a rating needs a positions document",
                )
            })?;
        if envelope.generation != generation {
            return Err(Error::Conflict("practice deck generation changed".into()));
        }
        let incoming_digest = entry_digest(&incoming_entry)?;
        if envelope.last_entry_id.as_deref() == Some(entry_id) {
            if envelope.last_entry_digest.as_deref() != Some(incoming_digest.as_str()) {
                return Err(Error::InvalidInput(
                    "practice entry id was reused for different content".into(),
                ));
            }
            return Ok(envelope.revision);
        }
        if envelope.revision != revision {
            return Err(Error::Conflict("practice deck revision changed".into()));
        }
        let existing = find_entry_since(&shards, base_revision, entry_id);
        let existing_position = existing
            .as_ref()
            .and_then(|_| entry_position(&shards, entry_id));
        let appended = existing.is_none();
        if let Some(existing) = existing {
            if entry_digest(&existing)? != incoming_digest {
                return Err(Error::InvalidInput(
                    "practice entry id was reused for different content".into(),
                ));
            }
        }
        let next_revision = next_counter(envelope.revision, "revision")?;
        // An entry a previous attempt of this record appended is not an orphan: this retry applies it.
        let orphan_entries =
            if existing_position.is_some_and(|position| position >= envelope.applied_entries) {
                reconciliation
                    .orphan_entries
                    .checked_sub(1)
                    .ok_or_else(|| {
                        Error::InvalidInput("practice reconciliation count is inconsistent".into())
                    })?
            } else {
                reconciliation.orphan_entries
            };
        let incoming_positions = positions_array(&positions_value)?;
        let applied_entries = reconciliation
            .total_entries
            .checked_add(u32::from(appended))
            .ok_or_else(|| Error::Conflict("practice review count exceeded u32::MAX".into()))?;
        let mut next_envelope = envelope.clone();
        next_envelope.revision = next_revision;
        next_envelope.last_entry_id = Some(entry_id.to_owned());
        next_envelope.last_entry_digest = Some(incoming_digest.clone());
        next_envelope.applied_entries = applied_entries;
        next_envelope.orphan_entries = orphan_entries;
        next_envelope.positions = incoming_positions.clone();
        ensure_positions_size(&next_envelope, &positions_leaf(&hash))?;
        if appended {
            append_review(
                directory,
                &hash,
                file_id,
                game,
                generation,
                next_revision,
                shards.last().map(|shard| &shard.envelope),
                entry_id,
                &incoming_entry,
            )?;
            #[cfg(test)]
            run_record_after_append_hook()?;
        }
        envelope.revision = next_revision;
        envelope.last_entry_id = Some(entry_id.to_owned());
        envelope.last_entry_digest = Some(incoming_digest);
        envelope.applied_entries = applied_entries;
        envelope.orphan_entries = orphan_entries;
        envelope.positions = incoming_positions;
        write_positions(directory, &hash, &envelope)?;
        Ok(next_revision)
    })
}

fn new_positions(file_id: &str, game: i32, positions: Vec<Value>) -> PositionsEnvelope {
    PositionsEnvelope {
        version: PRACTICE_STORAGE_VERSION,
        file_id: file_id.to_owned(),
        game,
        revision: 1,
        generation: 0,
        last_entry_id: None,
        last_entry_digest: None,
        applied_entries: 0,
        orphan_entries: 0,
        orphan_acknowledged_count: 0,
        legacy_source: LegacySource::None,
        migrated_at: None,
        migrated_entries: None,
        migrated_positions_digest: None,
        positions,
    }
}

pub(crate) fn sync_practice_positions_in(
    directory: &AuthorizedDir,
    file_id: &str,
    game: i32,
    generation: u32,
    revision: u32,
    positions_document: &str,
) -> Result<u32, Error> {
    let positions_value = validate_positions_document(positions_document, "incoming-positions")?;
    let hash = hash_deck(file_id, game);
    with_deck_lock(directory, &hash, || {
        let state = read_state(directory, &hash)?;
        let positions = read_positions(directory, &hash)?;
        let shards = all_shard_leaves(directory, &hash)?;
        let Some(mut envelope) = positions else {
            let reset_state = state
                .as_ref()
                .is_some_and(|state| state.phase == MigrationPhase::Reset);
            if (!reset_state && state.is_some())
                || !shards.is_empty()
                || revision != 0
                || generation != 0
            {
                return Err(Error::Conflict(
                    "practice deck creation races existing state".into(),
                ));
            }
            let envelope = new_positions(file_id, game, positions_array(&positions_value)?);
            write_positions(directory, &hash, &envelope)?;
            return Ok(envelope.revision);
        };
        if envelope.generation != generation || envelope.revision != revision {
            return Err(Error::Conflict(
                "practice deck revision or generation changed".into(),
            ));
        }
        let shards = read_shards(directory, &hash, generation)?;
        let reconciliation = reconcile(&envelope, &shards, &positions_leaf(&hash))?;
        envelope.revision = next_counter(envelope.revision, "revision")?;
        envelope.applied_entries = reconciliation.total_entries;
        envelope.orphan_entries = reconciliation.orphan_entries;
        envelope.positions = positions_array(&positions_value)?;
        write_positions(directory, &hash, &envelope)?;
        Ok(envelope.revision)
    })
}

fn remove_leaf_if_present(directory: &AuthorizedDir, leaf: &str) -> Result<(), Error> {
    let entries = fs::read_directory_entries_at(
        directory.directory_file(),
        &CancellationToken::new(),
        &mut |name| name == OsStr::new(leaf),
    )?;
    let Some(entry) = entries.into_iter().next() else {
        return Ok(());
    };
    if entry.kind != DirectoryEntryKind::RegularFile {
        return Err(invalid_leaf(leaf, "cannot remove a non-regular leaf"));
    }
    directory
        .remove_leaf_identified_pair(OsStr::new(leaf), entry.identity)
        .map_err(|error| operation_error("remove practice leaf", leaf, error))
}

pub(crate) fn reset_practice_deck_in(
    directory: &AuthorizedDir,
    file_id: &str,
    game: i32,
    generation: u32,
    revision: u32,
    positions_document: &str,
) -> Result<u32, Error> {
    let positions_value = validate_positions_document(positions_document, "incoming-positions")?;
    let hash = hash_deck(file_id, game);
    with_deck_lock(directory, &hash, || {
        let Some(mut envelope) = read_positions(directory, &hash)? else {
            return Err(invalid_leaf(
                &positions_leaf(&hash),
                "cannot reset an empty deck",
            ));
        };
        if envelope.generation != generation || envelope.revision != revision {
            return Err(Error::Conflict(
                "practice deck revision or generation changed".into(),
            ));
        }
        let old_generation = envelope.generation;
        envelope.revision = if envelope.revision == u32::MAX {
            1
        } else {
            envelope.revision + 1
        };
        envelope.generation = next_counter(envelope.generation, "generation")?;
        envelope.last_entry_id = None;
        envelope.last_entry_digest = None;
        envelope.applied_entries = 0;
        envelope.orphan_entries = 0;
        envelope.orphan_acknowledged_count = 0;
        envelope.positions = positions_array(&positions_value)?;
        write_positions(directory, &hash, &envelope)?;
        // The reset has committed; from here on only the cleanup of the previous generation can
        // fail. `PartialRemoval` reports exactly that (applied, cleanup incomplete) and its
        // payload carries the cause's category only, never a path. The leftover shards belong to
        // an older generation and are inert.
        let old_shards = read_shards(directory, &hash, old_generation).map_err(|cause| {
            Error::PartialRemoval {
                removed_entries: 0,
                cause: Box::new(cause),
            }
        })?;
        for (removed_entries, shard) in old_shards.iter().enumerate() {
            remove_leaf_if_present(directory, &shard.leaf).map_err(|cause| {
                Error::PartialRemoval {
                    removed_entries,
                    cause: Box::new(cause),
                }
            })?;
        }
        Ok(envelope.revision)
    })
}

fn parse_cursor(cursor: Option<&str>) -> Result<Option<Cursor>, Error> {
    let Some(cursor) = cursor else {
        return Ok(None);
    };
    if cursor.is_empty() || cursor.len() > PRACTICE_ID_MAX_BYTES {
        return Err(Error::InvalidInput(
            "practice review cursor is invalid".into(),
        ));
    }
    let parts = cursor.split(':').collect::<Vec<_>>();
    if parts.len() != 3 {
        return Err(Error::InvalidInput(
            "practice review cursor is invalid".into(),
        ));
    }
    let generation = parts[0]
        .parse()
        .map_err(|_| Error::InvalidInput("practice review cursor is invalid".into()))?;
    let ordinal = parts[1]
        .parse()
        .map_err(|_| Error::InvalidInput("practice review cursor is invalid".into()))?;
    let offset = parts[2]
        .parse()
        .map_err(|_| Error::InvalidInput("practice review cursor is invalid".into()))?;
    Ok(Some(Cursor {
        generation,
        ordinal,
        offset,
    }))
}

pub(crate) fn load_practice_reviews_in(
    directory: &AuthorizedDir,
    file_id: &str,
    game: i32,
    cursor: Option<String>,
    limit: u32,
) -> Result<PracticeReviewPage, Error> {
    let hash = hash_deck(file_id, game);
    with_deck_lock(directory, &hash, || {
        let Some((envelope, shards, _)) = load_valid_deck(directory, &hash)? else {
            return Ok(PracticeReviewPage {
                entries: Vec::new(),
                next_cursor: None,
            });
        };
        let cursor = parse_cursor(cursor.as_deref())?;
        if cursor.is_some_and(|cursor| cursor.generation != envelope.generation) {
            return Err(Error::Conflict(
                "practice review cursor belongs to an older generation".into(),
            ));
        }
        let requested = limit.min(PRACTICE_READ_MAX_ENTRIES) as usize;
        if requested == 0 {
            return Ok(PracticeReviewPage {
                entries: Vec::new(),
                next_cursor: None,
            });
        }
        let (mut shard_index, mut offset) = match cursor {
            None => {
                let index = shards.len();
                let offset = shards
                    .last()
                    .map_or(0, |shard| shard.envelope.entries.len());
                (index, offset)
            }
            Some(cursor) => {
                let Some(index) = shards
                    .iter()
                    .position(|shard| shard.envelope.ordinal == cursor.ordinal)
                else {
                    return Err(Error::InvalidInput(
                        "practice review cursor is invalid".into(),
                    ));
                };
                let offset = usize::try_from(cursor.offset)
                    .map_err(|_| Error::InvalidInput("practice review cursor is invalid".into()))?;
                if offset > shards[index].envelope.entries.len() {
                    return Err(Error::InvalidInput(
                        "practice review cursor is invalid".into(),
                    ));
                }
                (index + 1, offset)
            }
        };
        let mut page = Vec::new();
        let mut next_cursor = None;
        while shard_index > 0 && page.len() < requested {
            let index = shard_index - 1;
            let shard = &shards[index];
            let start = if shard_index == shards.len()
                || cursor.is_some_and(|cursor| cursor.ordinal == shard.envelope.ordinal)
            {
                offset
            } else {
                shard.envelope.entries.len()
            };
            let mut next_offset = start;
            for review in shard.envelope.entries[..start].iter().rev() {
                if page.len() == requested {
                    break;
                }
                page.push(PracticeReviewEntry {
                    id: review.id.clone(),
                    entry: serde_json::to_string(&review.entry).map_err(|_| {
                        Error::InvalidInput("practice review cannot be serialized".into())
                    })?,
                });
                next_offset = next_offset.saturating_sub(1);
            }
            if page.len() == requested {
                if next_offset > 0 {
                    next_cursor = Some(format!(
                        "{}:{}:{}",
                        envelope.generation, shard.envelope.ordinal, next_offset
                    ));
                } else if index > 0 {
                    next_cursor = Some(format!(
                        "{}:{}:{}",
                        envelope.generation,
                        shards[index - 1].envelope.ordinal,
                        shards[index - 1].envelope.entries.len()
                    ));
                }
                break;
            }
            shard_index = index;
            offset = if shard_index > 0 {
                shards[shard_index - 1].envelope.entries.len()
            } else {
                0
            };
        }
        Ok(PracticeReviewPage {
            entries: page,
            next_cursor,
        })
    })
}

pub(crate) fn acknowledge_practice_orphans_in(
    directory: &AuthorizedDir,
    file_id: &str,
    game: i32,
    generation: u32,
    acknowledged_count: u32,
) -> Result<(), Error> {
    let hash = hash_deck(file_id, game);
    with_deck_lock(directory, &hash, || {
        let Some((mut envelope, ..)) = load_valid_deck(directory, &hash)? else {
            return Err(invalid_leaf(
                &positions_leaf(&hash),
                "cannot acknowledge an empty deck",
            ));
        };
        if envelope.generation != generation {
            return Err(Error::Conflict("practice deck generation changed".into()));
        }
        envelope.orphan_acknowledged_count = acknowledged_count;
        write_positions(directory, &hash, &envelope)
    })
}

fn parse_legacy_document(raw: &str) -> Result<(Value, Vec<Value>, Vec<Value>), Error> {
    if raw.len() > PRACTICE_LEGACY_MAX_BYTES {
        return Err(Error::InvalidInput(
            "legacy practice document exceeds its size limit".into(),
        ));
    }
    let value: Value = serde_json::from_str(raw)
        .map_err(|_| Error::InvalidInput("legacy practice document is malformed JSON".into()))?;
    let object = value
        .as_object()
        .ok_or_else(|| Error::InvalidInput("legacy practice document is not an object".into()))?;
    let positions = object
        .get("positions")
        .and_then(Value::as_array)
        .cloned()
        .ok_or_else(|| Error::InvalidInput("legacy practice positions are missing".into()))?;
    let logs = object
        .get("logs")
        .and_then(Value::as_array)
        .cloned()
        .ok_or_else(|| Error::InvalidInput("legacy practice logs are missing".into()))?;
    let positions_value = Value::Object(Map::from_iter([(
        "positions".to_owned(),
        Value::Array(positions.clone()),
    )]));
    if canonical_bytes(&positions_value)?.len() > PRACTICE_POSITIONS_MAX_BYTES {
        return Err(Error::InvalidInput(
            "legacy practice positions exceed their size limit".into(),
        ));
    }
    Ok((value, positions, logs))
}

fn migration_entries_digest(entries: &[ReviewShardEntry]) -> Result<String, Error> {
    let values = entries
        .iter()
        .map(|entry| {
            Value::Object(Map::from_iter([
                ("id".to_owned(), Value::String(entry.id.clone())),
                ("entry".to_owned(), entry.entry.clone()),
            ]))
        })
        .collect();
    digest_value(&Value::Array(values))
}

fn imported_shards(
    file_id: &str,
    game: i32,
    logs: &[Value],
) -> Result<Vec<ReviewShardEnvelope>, Error> {
    let mut result = Vec::new();
    for (index, entry) in logs.iter().enumerate() {
        let id = hash_migration_entry(file_id, game, index, entry)?;
        let rev = u32::try_from(index + 1)
            .map_err(|_| Error::Conflict("practice review count exceeded u32::MAX".into()))?;
        let review = ReviewShardEntry {
            id,
            rev,
            entry: canonical_value(entry),
        };
        append_sealed_review(&mut result, file_id, game, 0, review)?;
    }
    Ok(result)
}

fn migration_outcome(
    status: PracticeMigrationStatus,
    entries: &[ReviewShardEntry],
    positions: &[Value],
    positions_digest: String,
) -> Result<PracticeMigrationOutcome, Error> {
    Ok(PracticeMigrationOutcome {
        status,
        entries: u32::try_from(entries.len())
            .map_err(|_| Error::Conflict("practice review count exceeded u32::MAX".into()))?,
        positions: u32::try_from(positions.len())
            .map_err(|_| Error::Conflict("practice position count exceeded u32::MAX".into()))?,
        positions_digest,
        entries_digest: migration_entries_digest(entries)?,
    })
}

pub(crate) fn migrate_practice_deck_in(
    directory: &AuthorizedDir,
    file_id: &str,
    game: i32,
    legacy_document: &str,
) -> Result<PracticeMigrationOutcome, Error> {
    let hash = hash_deck(file_id, game);
    with_deck_lock(directory, &hash, || {
        let loaded = read_validated_deck(directory, &hash).map_err(|failure| failure.error)?;
        let state = loaded.state;
        if state
            .as_ref()
            .is_some_and(|state| state.phase == MigrationPhase::Reset)
        {
            return migration_outcome(
                PracticeMigrationStatus::AlreadyMigrated,
                &[],
                &[],
                String::new(),
            );
        }
        if let Some(positions) = loaded.positions {
            let shards = loaded.shards;
            loaded.reconciliation.ok_or_else(|| {
                invalid_leaf(&positions_leaf(&hash), "practice reconciliation is missing")
            })?;
            if let Some(state) = state {
                if state.phase == MigrationPhase::Migrating {
                    let mut migrated = state;
                    migrated.phase = MigrationPhase::Migrated;
                    write_json(
                        directory,
                        &state_leaf(&hash),
                        &migrated,
                        DurabilityStage::PracticeState,
                        "advance migration state",
                    )?;
                }
            }
            let all_entries = shards
                .iter()
                .flat_map(|shard| shard.envelope.entries.iter().cloned())
                .collect::<Vec<_>>();
            let positions_value = Value::Object(Map::from_iter([(
                "positions".to_owned(),
                Value::Array(positions.positions.clone()),
            )]));
            return migration_outcome(
                PracticeMigrationStatus::AlreadyMigrated,
                &all_entries,
                &positions.positions,
                digest_value(&positions_value)?,
            );
        }
        let existing_shards = loaded.shard_leaves;
        if state.is_none() && !existing_shards.is_empty() {
            return Err(Error::Conflict(
                "practice shards exist without a positions document".into(),
            ));
        }
        if state
            .as_ref()
            .is_some_and(|state| state.phase == MigrationPhase::Migrated)
        {
            return Err(invalid_leaf(
                &state_leaf(&hash),
                "migrated deck has no positions document",
            ));
        }
        let (legacy_value, positions, logs) = parse_legacy_document(legacy_document)?;
        let legacy_digest = digest_value(&legacy_value)?;
        if state.as_ref().is_some_and(|state| {
            state.phase == MigrationPhase::Migrating
                && !existing_shards.is_empty()
                && state.legacy_digest != legacy_digest
        }) {
            return Err(Error::Conflict(
                "practice migration is stranded with a different legacy value".into(),
            ));
        }
        let position_value = Value::Object(Map::from_iter([(
            "positions".to_owned(),
            Value::Array(positions.clone()),
        )]));
        let positions_digest = digest_value(&position_value)?;
        let logs_shards = imported_shards(file_id, game, &logs)?;
        let expected_entries = logs_shards
            .iter()
            .flat_map(|shard| shard.entries.iter().cloned())
            .collect::<Vec<_>>();
        let entry_count = u32::try_from(expected_entries.len())
            .map_err(|_| Error::Conflict("practice review count exceeded u32::MAX".into()))?;
        let last = expected_entries.last();
        let envelope = PositionsEnvelope {
            version: PRACTICE_STORAGE_VERSION,
            file_id: file_id.to_owned(),
            game,
            revision: 1,
            generation: 0,
            last_entry_id: last.map(|entry| entry.id.clone()),
            last_entry_digest: last.map(|entry| entry_digest(&entry.entry)).transpose()?,
            applied_entries: entry_count,
            orphan_entries: 0,
            orphan_acknowledged_count: 0,
            legacy_source: LegacySource::LocalStorage,
            migrated_at: Some(Utc::now().to_rfc3339()),
            migrated_entries: Some(entry_count),
            migrated_positions_digest: Some(positions_digest.clone()),
            positions,
        };
        ensure_positions_size(&envelope, &positions_leaf(&hash))?;
        let state_value = MigrationStateEnvelope {
            version: PRACTICE_STORAGE_VERSION,
            file_id: file_id.to_owned(),
            game,
            phase: MigrationPhase::Migrating,
            legacy_digest,
        };
        write_json(
            directory,
            &state_leaf(&hash),
            &state_value,
            DurabilityStage::PracticeState,
            "write migration state",
        )?;
        for (leaf, generation, _, kind, _) in existing_shards {
            if generation == 0 && kind != DirectoryEntryKind::RegularFile {
                return Err(invalid_leaf(&leaf, "migration shard is not a regular file"));
            }
        }
        for shard in read_shards(directory, &hash, 0)? {
            remove_leaf_if_present(directory, &shard.leaf)?;
        }
        for shard in &logs_shards {
            let leaf = shard_leaf(&hash, 0, shard.ordinal);
            write_json(
                directory,
                &leaf,
                shard,
                DurabilityStage::PracticeReviewShard,
                "write migration shard",
            )?;
        }
        #[cfg(test)]
        run_migration_before_readback_hook()?;
        let read_back = read_shards(directory, &hash, 0)?;
        let read_back_entries = read_back
            .iter()
            .flat_map(|shard| shard.envelope.entries.iter().cloned())
            .collect::<Vec<_>>();
        if migration_entries_digest(&read_back_entries)?
            != migration_entries_digest(&expected_entries)?
        {
            return Err(invalid_leaf(
                &state_leaf(&hash),
                "migration read-back digest differs",
            ));
        }
        #[cfg(test)]
        run_migration_before_positions_hook()?;
        write_positions(directory, &hash, &envelope)?;
        let mut migrated = state_value;
        migrated.phase = MigrationPhase::Migrated;
        write_json(
            directory,
            &state_leaf(&hash),
            &migrated,
            DurabilityStage::PracticeState,
            "advance migration state",
        )?;
        migration_outcome(
            PracticeMigrationStatus::Migrated,
            &expected_entries,
            &envelope.positions,
            positions_digest,
        )
    })
}

pub(crate) fn repair_practice_deck_in(
    directory: &AuthorizedDir,
    file_id: &str,
    game: i32,
) -> Result<(), Error> {
    let hash = hash_deck(file_id, game);
    with_deck_lock(directory, &hash, || {
        let (state, invalid_state) = match read_state(directory, &hash) {
            Ok(state) => (state, false),
            Err(Error::InvalidInput(_)) => (None, true),
            Err(error) => return Err(error),
        };
        let shards = all_shard_leaves(directory, &hash)?;
        let mut removed_entries = 0;
        let mut remove = |leaf: &str| -> Result<(), Error> {
            match remove_leaf_if_present(directory, leaf) {
                Ok(()) => {
                    removed_entries += 1;
                    Ok(())
                }
                Err(error) if removed_entries > 0 => Err(Error::PartialRemoval {
                    removed_entries,
                    cause: Box::new(error),
                }),
                Err(error) => Err(error),
            }
        };
        remove(&positions_leaf(&hash))?;
        for (leaf, _, _, kind, _) in &shards {
            if *kind != DirectoryEntryKind::RegularFile {
                let error = invalid_leaf(leaf, "repair found a non-regular shard");
                if removed_entries > 0 {
                    return Err(Error::PartialRemoval {
                        removed_entries,
                        cause: Box::new(error),
                    });
                }
                return Err(error);
            }
            remove(leaf)?;
        }
        let migration_unfinalized = state
            .as_ref()
            .is_some_and(|state| state.phase == MigrationPhase::Migrating);
        if invalid_state || migration_unfinalized {
            // Neither marker proves a Reset happened, so the deck returns to never-here and the
            // retained legacy value migrates again. For a malformed marker that may re-import
            // pre-Reset history; losing never-imported history is the worse outcome
            // (d-20260923-02).
            remove(&state_leaf(&hash))?;
        } else if let Some(mut state) = state {
            state.phase = MigrationPhase::Reset;
            if let Err(error) = write_json(
                directory,
                &state_leaf(&hash),
                &state,
                DurabilityStage::PracticeState,
                "reset migration state",
            ) {
                if removed_entries > 0 {
                    return Err(Error::PartialRemoval {
                        removed_entries,
                        cause: Box::new(error),
                    });
                }
                return Err(error);
            }
        }
        Ok(())
    })
}

fn anomaly(
    kind: PracticeStoreAnomalyKind,
    leaf: String,
    identity: Option<(&str, i32)>,
) -> PracticeStoreAnomaly {
    PracticeStoreAnomaly {
        kind,
        leaf,
        file_id: identity.map(|identity| identity.0.to_owned()),
        game: identity.map(|identity| identity.1),
    }
}

fn validation_failure_kind(failure: &DeckValidationFailure) -> PracticeStoreAnomalyKind {
    if failure.io {
        PracticeStoreAnomalyKind::Unreadable
    } else {
        PracticeStoreAnomalyKind::DamagedDeck
    }
}

pub(crate) fn list_practice_decks_in(
    directory: &AuthorizedDir,
) -> Result<PracticeDeckInventory, Error> {
    let entries = fs::read_directory_entries_at(
        directory.directory_file(),
        &CancellationToken::new(),
        &mut |_| true,
    )?;
    let mut decks = BTreeMap::<String, PracticeDeckIdentity>::new();
    let mut anomalies = Vec::new();
    let mut candidate_hashes = std::collections::BTreeSet::new();
    let mut shard_candidates = Vec::new();
    let mut position_leaf_hashes = std::collections::HashSet::new();
    for entry in entries {
        let leaf = entry.name.to_string_lossy().into_owned();
        let Some(owned) = parse_owned_leaf(&leaf) else {
            continue;
        };
        let hash = match &owned {
            OwnedLeaf::Positions(hash) | OwnedLeaf::State(hash) => hash.clone(),
            OwnedLeaf::Shard { hash, .. } => hash.clone(),
            OwnedLeaf::Lock(_) => continue,
        };
        candidate_hashes.insert(hash.clone());
        if entry.kind != DirectoryEntryKind::RegularFile {
            anomalies.push(anomaly(
                PracticeStoreAnomalyKind::NotARegularFile,
                leaf,
                None,
            ));
            continue;
        }
        if matches!(&owned, OwnedLeaf::Positions(_)) {
            position_leaf_hashes.insert(hash.clone());
        }
        if let OwnedLeaf::Shard {
            generation,
            ordinal,
            ..
        } = owned
        {
            shard_candidates.push((hash, leaf, generation, ordinal));
        }
    }

    let mut healthy_positions = std::collections::HashSet::new();
    for hash in candidate_hashes {
        match read_validated_deck(directory, &hash) {
            Ok(loaded) => {
                let identity = loaded
                    .positions
                    .as_ref()
                    .map(|positions| PracticeDeckIdentity {
                        file_id: positions.file_id.clone(),
                        game: positions.game,
                    })
                    .or_else(|| {
                        loaded.state.as_ref().map(|state| PracticeDeckIdentity {
                            file_id: state.file_id.clone(),
                            game: state.game,
                        })
                    });
                let Some(identity) = identity else {
                    continue;
                };
                decks
                    .entry(hash.clone())
                    .or_insert_with(|| identity.clone());
                if loaded.positions.is_some() {
                    healthy_positions.insert(hash.clone());
                    if loaded
                        .state
                        .as_ref()
                        .is_some_and(|state| state.phase == MigrationPhase::Migrating)
                    {
                        anomalies.push(anomaly(
                            PracticeStoreAnomalyKind::DamagedDeck,
                            positions_leaf(&hash),
                            Some((&identity.file_id, identity.game)),
                        ));
                    }
                } else if loaded
                    .state
                    .as_ref()
                    .is_some_and(|state| state.phase != MigrationPhase::Reset)
                {
                    anomalies.push(anomaly(
                        PracticeStoreAnomalyKind::DamagedDeck,
                        positions_leaf(&hash),
                        Some((&identity.file_id, identity.game)),
                    ));
                    if loaded
                        .state
                        .as_ref()
                        .is_some_and(|state| state.phase == MigrationPhase::Migrating)
                    {
                        anomalies.push(anomaly(
                            PracticeStoreAnomalyKind::StrandedMigration,
                            state_leaf(&hash),
                            Some((&identity.file_id, identity.game)),
                        ));
                    }
                }
            }
            Err(failure) => {
                if let Some(ref identity) = failure.identity {
                    decks
                        .entry(hash.clone())
                        .or_insert_with(|| identity.clone());
                    anomalies.push(anomaly(
                        validation_failure_kind(&failure),
                        positions_leaf(&hash),
                        Some((&identity.file_id, identity.game)),
                    ));
                } else {
                    anomalies.push(anomaly(
                        PracticeStoreAnomalyKind::Unreadable,
                        positions_leaf(&hash),
                        None,
                    ));
                }
            }
        }
    }

    for (hash, leaf, generation, ordinal) in shard_candidates {
        if healthy_positions.contains(&hash) || position_leaf_hashes.contains(&hash) {
            continue;
        }
        let value = match read_json::<ReviewShardEnvelope>(
            directory,
            &leaf,
            PRACTICE_LEGACY_MAX_BYTES,
            "inventory review shard",
        ) {
            Ok(Some(value)) => value,
            Ok(None) | Err(_) => {
                anomalies.push(anomaly(PracticeStoreAnomalyKind::Unreadable, leaf, None));
                continue;
            }
        };
        if value.generation != generation
            || value.ordinal != ordinal
            || check_identity(&leaf, value.version, &value.file_id, value.game).is_err()
        {
            anomalies.push(anomaly(
                PracticeStoreAnomalyKind::IdentityMismatch,
                leaf,
                None,
            ));
            continue;
        }
        if value.entries.is_empty()
            || value.entries.iter().any(|review| {
                review.id.is_empty() || review.id.len() > PRACTICE_ID_MAX_BYTES || review.rev == 0
            })
        {
            anomalies.push(anomaly(PracticeStoreAnomalyKind::Unreadable, leaf, None));
            continue;
        }
        anomalies.push(anomaly(
            PracticeStoreAnomalyKind::OrphanShard,
            leaf,
            Some((&value.file_id, value.game)),
        ));
    }

    Ok(PracticeDeckInventory {
        decks: decks.into_values().collect(),
        anomalies,
    })
}

pub(crate) fn authorize_practice_command(
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    file_id: &str,
    requires_read_pgn: bool,
) -> Result<(), Error> {
    let mut authority_lock = authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    let authority = authority_lock
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
    authority.authorize_practice_deck(
        &crate::infra::path_authority::PathRef {
            id: file_id.to_owned(),
        },
        requires_read_pgn,
    )
}

fn run_practice_command_blocking<T, F>(
    app: &tauri::AppHandle,
    authority: &std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>,
    file_id: Option<&str>,
    requires_read_pgn: bool,
    operation: F,
) -> Result<T, Error>
where
    F: FnOnce(&AuthorizedDir) -> Result<T, Error>,
{
    if let Some(file_id) = file_id {
        authorize_practice_command(authority, file_id, requires_read_pgn)?;
    }
    let directory = crate::infra::path_authority::ensure_app_owned_default_dir(
        &crate::infra::path_authority::AppDataDir::for_app(app)?,
        crate::infra::path_authority::AppOwnedDefaultRoot::Practice,
    )?;
    operation(&directory)
}

async fn run_practice_command<T, F>(
    app: tauri::AppHandle,
    authority: Arc<std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>>,
    file_id: String,
    requires_read_pgn: bool,
    operation: F,
) -> Result<T, Error>
where
    T: Send + 'static,
    F: FnOnce(&AuthorizedDir) -> Result<T, Error> + Send + 'static,
{
    BLOCKING_GATEWAY
        .spawn(move || {
            run_practice_command_blocking(
                &app,
                &authority,
                Some(&file_id),
                requires_read_pgn,
                operation,
            )
        })
        .await
}

async fn run_accepted_practice_command<T, F>(
    app: tauri::AppHandle,
    authority: Arc<std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>>,
    operations: &crate::infra::operations::OperationRegistry,
    operation_name: &'static str,
    file_id: Option<String>,
    requires_read_pgn: bool,
    operation: F,
) -> Result<T, Error>
where
    T: Send + 'static,
    F: FnOnce(&AuthorizedDir) -> Result<T, Error> + Send + 'static,
{
    crate::infra::operations::run_accepted_blocking(operations, operation_name, move || {
        run_practice_command_blocking(
            &app,
            &authority,
            file_id.as_deref(),
            requires_read_pgn,
            operation,
        )
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn load_practice_deck(
    file_id: String,
    game: i32,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Option<PracticeDeckSnapshot>, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    let authorization_file_id = file_id.clone();
    run_practice_command(
        app,
        authority,
        authorization_file_id,
        true,
        move |directory| load_practice_deck_in(directory, &file_id, game),
    )
    .await
}

#[tauri::command]
#[specta::specta]
// The command mirrors the stable IPC wire shape: one rating carries its optimistic snapshot and entry.
#[allow(clippy::too_many_arguments)]
pub async fn record_practice_review(
    file_id: String,
    game: i32,
    generation: u32,
    revision: u32,
    base_revision: u32,
    positions_document: String,
    entry: String,
    entry_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<u32, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    let authorization_file_id = file_id.clone();
    run_practice_command(
        app,
        authority,
        authorization_file_id,
        true,
        move |directory| {
            record_practice_review_in(
                directory,
                &file_id,
                game,
                generation,
                revision,
                base_revision,
                &positions_document,
                &entry,
                &entry_id,
            )
        },
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn sync_practice_positions(
    file_id: String,
    game: i32,
    generation: u32,
    revision: u32,
    positions_document: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<u32, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    let authorization_file_id = file_id.clone();
    run_practice_command(
        app,
        authority,
        authorization_file_id,
        true,
        move |directory| {
            sync_practice_positions_in(
                directory,
                &file_id,
                game,
                generation,
                revision,
                &positions_document,
            )
        },
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn reset_practice_deck(
    file_id: String,
    game: i32,
    generation: u32,
    revision: u32,
    positions_document: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<u32, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    let authorization_file_id = file_id.clone();
    run_practice_command(
        app,
        authority,
        authorization_file_id,
        true,
        move |directory| {
            reset_practice_deck_in(
                directory,
                &file_id,
                game,
                generation,
                revision,
                &positions_document,
            )
        },
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn load_practice_reviews(
    file_id: String,
    game: i32,
    cursor: Option<String>,
    limit: u32,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<PracticeReviewPage, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    let authorization_file_id = file_id.clone();
    run_practice_command(
        app,
        authority,
        authorization_file_id,
        true,
        move |directory| load_practice_reviews_in(directory, &file_id, game, cursor, limit),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn migrate_practice_deck(
    file_id: String,
    game: i32,
    legacy_document: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<PracticeMigrationOutcome, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    let authorization_file_id = file_id.clone();
    run_accepted_practice_command(
        app,
        authority,
        &state.operations,
        "migrate_practice_deck",
        Some(authorization_file_id),
        false,
        move |directory| migrate_practice_deck_in(directory, &file_id, game, &legacy_document),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn acknowledge_practice_orphans(
    file_id: String,
    game: i32,
    generation: u32,
    acknowledged_count: u32,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    let authorization_file_id = file_id.clone();
    run_practice_command(
        app,
        authority,
        authorization_file_id,
        true,
        move |directory| {
            acknowledge_practice_orphans_in(
                directory,
                &file_id,
                game,
                generation,
                acknowledged_count,
            )
        },
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn repair_practice_deck(
    file_id: String,
    game: i32,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    let authorization_file_id = file_id.clone();
    run_practice_command(
        app,
        authority,
        authorization_file_id,
        false,
        move |directory| repair_practice_deck_in(directory, &file_id, game),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn list_practice_decks(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<PracticeDeckInventory, Error> {
    let authority = Arc::clone(&state.pgn_path_authority);
    run_accepted_practice_command(
        app,
        authority,
        &state.operations,
        "list_practice_decks",
        None,
        false,
        list_practice_decks_in,
    )
    .await
}

#[cfg(test)]
type RecordAfterAppendHook = Box<dyn FnOnce() -> Result<(), Error>>;
#[cfg(test)]
type MigrationHook = Box<dyn FnOnce() -> Result<(), Error>>;

#[cfg(test)]
thread_local! {
    static CRITICAL_SECTION_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> = const { std::cell::RefCell::new(None) };
    static RECORD_AFTER_APPEND_HOOK: std::cell::RefCell<Option<RecordAfterAppendHook>> = const { std::cell::RefCell::new(None) };
    static MIGRATION_BEFORE_READBACK_HOOK: std::cell::RefCell<Option<MigrationHook>> = const { std::cell::RefCell::new(None) };
    static MIGRATION_BEFORE_POSITIONS_HOOK: std::cell::RefCell<Option<MigrationHook>> = const { std::cell::RefCell::new(None) };
    static PRACTICE_POSITIONS_READ_IO_FAILURE_HOOK: std::cell::RefCell<Option<String>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
fn run_critical_section_hook() {
    CRITICAL_SECTION_HOOK.with(|slot| {
        if let Some(hook) = slot.borrow_mut().take() {
            hook();
        }
    });
}

#[cfg(test)]
fn run_record_after_append_hook() -> Result<(), Error> {
    RECORD_AFTER_APPEND_HOOK.with(|slot| slot.borrow_mut().take().map_or(Ok(()), |hook| hook()))
}

#[cfg(test)]
fn run_migration_before_readback_hook() -> Result<(), Error> {
    MIGRATION_BEFORE_READBACK_HOOK
        .with(|slot| slot.borrow_mut().take().map_or(Ok(()), |hook| hook()))
}

#[cfg(test)]
fn run_migration_before_positions_hook() -> Result<(), Error> {
    MIGRATION_BEFORE_POSITIONS_HOOK
        .with(|slot| slot.borrow_mut().take().map_or(Ok(()), |hook| hook()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::fs::{
        set_test_atomic_file_injector, AtomicFileFaultPoint, AtomicWriterInjector, ParentSyncFault,
    };
    use crate::infra::path_authority::{
        ensure_app_owned_default_dir, AppDataDir, AppOwnedDefaultRoot, AuthorizedDir,
    };
    use std::{
        env, fs,
        path::PathBuf,
        process::Command,
        sync::{atomic::AtomicUsize, Arc, Barrier},
        thread,
        time::{Duration, Instant},
    };

    fn directory() -> (tempfile::TempDir, AuthorizedDir) {
        let temp = tempfile::tempdir().unwrap();
        let app_data = AppDataDir::for_test(temp.path());
        let directory =
            ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Practice).unwrap();
        (temp, directory)
    }

    fn positions() -> String {
        r#"{"positions":[{"fen":"start"}]}"#.to_owned()
    }

    fn entry(fen: &str) -> String {
        serde_json::json!({"fen": fen, "rating": 3}).to_string()
    }

    fn legacy(positions: &[Value], logs: &[Value]) -> String {
        serde_json::json!({"positions": positions, "logs": logs}).to_string()
    }

    fn leaf_bytes(directory: &AuthorizedDir, leaf: &str) -> Vec<u8> {
        fs::read(directory.path().join(leaf)).unwrap()
    }

    fn all_leaf_bytes(directory: &AuthorizedDir) -> BTreeMap<String, Vec<u8>> {
        fs::read_dir(directory.path())
            .unwrap()
            .map(|entry| {
                let entry = entry.unwrap();
                (
                    entry.file_name().to_string_lossy().into_owned(),
                    fs::read(entry.path()).unwrap(),
                )
            })
            .filter(|(leaf, _)| !leaf.ends_with(LOCK_SUFFIX))
            .collect()
    }

    fn write_test_shard(
        directory: &AuthorizedDir,
        file_id: &str,
        game: i32,
        generation: u32,
        ordinal: u32,
        entries: Vec<ReviewShardEntry>,
    ) {
        let hash = hash_deck(file_id, game);
        write_json(
            directory,
            &shard_leaf(&hash, generation, ordinal),
            &ReviewShardEnvelope {
                version: PRACTICE_STORAGE_VERSION,
                file_id: file_id.to_owned(),
                game,
                generation,
                ordinal,
                entries,
            },
            DurabilityStage::PracticeReviewShard,
            "test",
        )
        .unwrap();
    }

    fn write_test_state(
        directory: &AuthorizedDir,
        file_id: &str,
        game: i32,
        phase: MigrationPhase,
        legacy_digest: &str,
    ) {
        let hash = hash_deck(file_id, game);
        write_json(
            directory,
            &state_leaf(&hash),
            &MigrationStateEnvelope {
                version: PRACTICE_STORAGE_VERSION,
                file_id: file_id.to_owned(),
                game,
                phase,
                legacy_digest: legacy_digest.to_owned(),
            },
            DurabilityStage::PracticeState,
            "test",
        )
        .unwrap();
    }

    fn assert_damaged_identity(inventory: &PracticeDeckInventory, file_id: &str, game: i32) {
        assert!(inventory.anomalies.iter().any(|anomaly| {
            anomaly.kind == PracticeStoreAnomalyKind::DamagedDeck
                && anomaly.file_id.as_deref() == Some(file_id)
                && anomaly.game == Some(game)
        }));
    }

    #[test]
    fn validated_read_failures_distinguish_io_from_invalid_content() {
        let identity = Some(PracticeDeckIdentity {
            file_id: "file".to_owned(),
            game: 1,
        });
        let unreadable = DeckValidationFailure::new(
            Error::Io(Box::new(std::io::Error::other("permission denied"))),
            identity.clone(),
        );
        let damaged = DeckValidationFailure::new(
            Error::InvalidInput("malformed practice leaf".into()),
            identity,
        );

        assert_eq!(
            validation_failure_kind(&unreadable),
            PracticeStoreAnomalyKind::Unreadable
        );
        assert_eq!(
            validation_failure_kind(&damaged),
            PracticeStoreAnomalyKind::DamagedDeck
        );
    }

    #[test]
    fn inventory_keeps_identity_when_positions_read_fails_with_io() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        write_test_state(
            &directory,
            "file",
            1,
            MigrationPhase::Migrating,
            &"0".repeat(64),
        );
        let hash = hash_deck("file", 1);
        PRACTICE_POSITIONS_READ_IO_FAILURE_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(hash.clone());
        });

        let inventory = list_practice_decks_in(&directory).unwrap();

        assert!(inventory.anomalies.iter().any(|anomaly| {
            anomaly.kind == PracticeStoreAnomalyKind::Unreadable
                && anomaly.leaf == positions_leaf(&hash)
                && anomaly.file_id.as_deref() == Some("file")
                && anomaly.game == Some(1)
        }));
    }

    fn test_review(id: &str, rev: u32, value: Value) -> ReviewShardEntry {
        ReviewShardEntry {
            id: id.to_owned(),
            rev,
            entry: value,
        }
    }

    struct FailOnParentSync {
        call: AtomicUsize,
        fail_on: usize,
    }

    impl AtomicWriterInjector for FailOnParentSync {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == AtomicFileFaultPoint::ParentSync
                && self.call.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1 == self.fail_on
            {
                return Err(std::io::Error::other(
                    "injected practice parent sync failure",
                ));
            }
            Ok(())
        }
    }

    #[test]
    fn practice_round_trip_uses_the_app_owned_practice_root() {
        let (temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        let snapshot = load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .unwrap();
        assert_eq!(snapshot.revision, 2);
        assert!(temp
            .path()
            .join("practice")
            .join(format!("{}-positions.json", hash_deck("file", 1)))
            .exists());
    }

    #[test]
    fn missing_and_malformed_documents_are_not_empty_decks() {
        let (_temp, directory) = directory();
        assert!(load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .is_none());
        let leaf = positions_leaf(&hash_deck("file", 1));
        write_json(
            &directory,
            &leaf,
            &serde_json::json!({"bad": true}),
            DurabilityStage::PracticePositions,
            "test",
        )
        .unwrap();
        assert!(matches!(
            load_practice_deck_in(&directory, "file", 1),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn positions_and_shard_identities_are_verified_against_their_leaf_names() {
        let (_temp, directory1) = directory();
        let hash = hash_deck("file", 1);
        write_json(
            &directory1,
            &positions_leaf(&hash),
            &PositionsEnvelope {
                file_id: "other".to_owned(),
                ..new_positions("file", 1, vec![])
            },
            DurabilityStage::PracticePositions,
            "test",
        )
        .unwrap();
        assert!(matches!(
            load_practice_deck_in(&directory1, "file", 1),
            Err(Error::InvalidInput(_))
        ));

        let (_temp2, directory2) = directory();
        write_json(
            &directory2,
            &shard_leaf(&hash, 0, 9),
            &ReviewShardEnvelope {
                version: PRACTICE_STORAGE_VERSION,
                file_id: "file".to_owned(),
                game: 1,
                generation: 0,
                ordinal: 10,
                entries: vec![ReviewShardEntry {
                    id: "entry".to_owned(),
                    rev: 1,
                    entry: serde_json::json!({"fen": "a"}),
                }],
            },
            DurabilityStage::PracticeReviewShard,
            "test",
        )
        .unwrap();
        assert!(matches!(
            load_practice_reviews_in(&directory2, "file", 1, None, 1),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn inventory_retains_state_only_identity_and_surfaces_orphan_shards() {
        let (_temp, directory1) = directory();
        let hash = hash_deck("state", 2);
        write_json(
            &directory1,
            &state_leaf(&hash),
            &MigrationStateEnvelope {
                version: PRACTICE_STORAGE_VERSION,
                file_id: "state".to_owned(),
                game: 2,
                phase: MigrationPhase::Migrating,
                legacy_digest: "0".repeat(64),
            },
            DurabilityStage::PracticeState,
            "test",
        )
        .unwrap();
        let inventory = list_practice_decks_in(&directory1).unwrap();
        assert_eq!(
            inventory.decks,
            vec![PracticeDeckIdentity {
                file_id: "state".to_owned(),
                game: 2
            }]
        );
        assert!(inventory
            .anomalies
            .iter()
            .any(|anomaly| anomaly.kind == PracticeStoreAnomalyKind::StrandedMigration));

        let (_temp2, directory2) = directory();
        let hash = hash_deck("orphan", 3);
        write_json(
            &directory2,
            &shard_leaf(&hash, 0, 0),
            &ReviewShardEnvelope {
                version: PRACTICE_STORAGE_VERSION,
                file_id: "orphan".to_owned(),
                game: 3,
                generation: 0,
                ordinal: 0,
                entries: vec![ReviewShardEntry {
                    id: "entry".to_owned(),
                    rev: 1,
                    entry: serde_json::json!({"fen": "a"}),
                }],
            },
            DurabilityStage::PracticeReviewShard,
            "test",
        )
        .unwrap();
        let inventory = list_practice_decks_in(&directory2).unwrap();
        assert!(inventory.decks.is_empty());
        assert!(inventory.anomalies.iter().any(|anomaly| {
            anomaly.kind == PracticeStoreAnomalyKind::OrphanShard
                && anomaly.file_id.as_deref() == Some("orphan")
                && anomaly.game == Some(3)
        }));
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_leaf_is_refused_on_read_replace_and_delete() {
        use std::os::unix::fs::symlink;

        let (_temp, directory) = directory();
        let target_dir = tempfile::tempdir().unwrap();
        let target = target_dir.path().join("outside.json");
        fs::write(&target, b"outside").unwrap();
        let hash = hash_deck("file", 1);
        let leaf = positions_leaf(&hash);
        symlink(&target, directory.path().join(&leaf)).unwrap();
        assert!(load_practice_deck_in(&directory, "file", 1).is_err());
        assert!(directory
            .atomic_replace_leaf_identified(OsStr::new(&leaf), |file| {
                file.write_all(b"replacement").map_err(Error::from)
            })
            .is_err());
        let listed = crate::infra::fs::read_directory_entries_at(
            directory.directory_file(),
            &CancellationToken::new(),
            &mut |name| name == OsStr::new(&leaf),
        )
        .unwrap();
        assert_eq!(listed[0].kind, DirectoryEntryKind::Other);
        assert!(directory
            .remove_leaf_identified_pair(OsStr::new(&leaf), listed[0].identity)
            .is_err());
        assert!(target.exists());
        assert!(directory.path().join(&leaf).exists());
    }

    #[test]
    fn record_is_idempotent_and_rejects_reused_ids() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        assert_eq!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &entry("a"),
                "same"
            )
            .unwrap(),
            2
        );
        assert_eq!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                2,
                1,
                &positions(),
                &entry("a"),
                "same"
            )
            .unwrap(),
            2
        );
        assert!(matches!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                2,
                2,
                &positions(),
                &entry("b"),
                "same"
            ),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn orphan_count_survives_reload_and_later_writes() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        RECORD_AFTER_APPEND_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupted".into()))))
        });
        assert!(record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a"
        )
        .is_err());
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .unapplied_reviews,
            1
        );
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("b"),
            "b",
        )
        .unwrap();
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .unapplied_reviews,
            1
        );
        acknowledge_practice_orphans_in(&directory, "file", 1, 0, 1).unwrap();
        assert!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .orphans_acknowledged
        );
    }

    #[test]
    fn reset_bumps_generation_and_clears_orphans() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        let revision = reset_practice_deck_in(&directory, "file", 1, 0, 2, &positions()).unwrap();
        assert_eq!(revision, 3);
        let snapshot = load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .unwrap();
        assert_eq!(snapshot.generation, 1);
        assert_eq!(snapshot.unapplied_reviews, 0);
    }

    #[test]
    fn reset_maps_post_commit_shard_read_failure_to_partial_removal() {
        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        fs::write(directory.path().join(shard_leaf(&hash, 0, 0)), b"not-json").unwrap();

        let result = reset_practice_deck_in(&directory, "file", 1, 0, 1, &positions());

        assert!(matches!(result, Err(Error::PartialRemoval { .. })));
        assert_eq!(
            read_positions(&directory, &hash)
                .unwrap()
                .unwrap()
                .generation,
            1
        );
    }

    #[test]
    fn record_interruption_then_intervening_commit_requires_reconciliation_retry() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        RECORD_AFTER_APPEND_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupt A".into()))))
        });
        assert!(record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a"
        )
        .is_err());
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("b"),
            "b",
        )
        .unwrap();
        assert!(matches!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &entry("a"),
                "a"
            ),
            Err(Error::Conflict(_))
        ));
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            2,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        let page = load_practice_reviews_in(&directory, "file", 1, None, 500).unwrap();
        assert_eq!(
            page.entries
                .iter()
                .filter(|review| review.id == "a")
                .count(),
            1
        );
        assert_eq!(
            page.entries
                .iter()
                .filter(|review| review.id == "b")
                .count(),
            1
        );
    }

    #[test]
    fn record_interruption_immediate_retry_applies_the_tail_without_an_orphan() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        RECORD_AFTER_APPEND_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupt A".into()))))
        });
        assert!(record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a"
        )
        .is_err());
        assert_eq!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &entry("a"),
                "a"
            )
            .unwrap(),
            2
        );
        let snapshot = load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .unwrap();
        assert_eq!(snapshot.revision, 2);
        assert_eq!(snapshot.unapplied_reviews, 0);
        assert_eq!(
            load_practice_reviews_in(&directory, "file", 1, None, 500)
                .unwrap()
                .entries
                .iter()
                .filter(|review| review.id == "a")
                .count(),
            1
        );
    }

    #[test]
    fn record_interruption_then_orphan_persistence_keeps_the_count_sticky_on_retry() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        RECORD_AFTER_APPEND_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupt A".into()))))
        });
        assert!(record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a"
        )
        .is_err());
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("b"),
            "b",
        )
        .unwrap();
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .unapplied_reviews,
            1
        );
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            2,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .unapplied_reviews,
            1
        );
    }

    #[test]
    fn record_interruption_more_than_two_shards_still_finds_the_original_id() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        RECORD_AFTER_APPEND_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupt A".into()))))
        });
        let large = serde_json::json!({"fen":"a", "payload":"x".repeat(15_000)}).to_string();
        assert!(record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &large,
            "a"
        )
        .is_err());
        for index in 0..30_u32 {
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                index + 1,
                1,
                &positions(),
                &serde_json::json!({"fen": index, "payload":"x".repeat(15_000)}).to_string(),
                &format!("b{index}"),
            )
            .unwrap();
        }
        record_practice_review_in(&directory, "file", 1, 0, 31, 1, &positions(), &large, "a")
            .unwrap();
        let mut cursor = None;
        let mut ids = Vec::new();
        loop {
            let page = load_practice_reviews_in(&directory, "file", 1, cursor, 10).unwrap();
            ids.extend(page.entries.into_iter().map(|entry| entry.id));
            cursor = page.next_cursor;
            if cursor.is_none() {
                break;
            }
        }
        assert_eq!(ids.len(), 31);
        assert_eq!(ids.iter().filter(|id| id.as_str() == "a").count(), 1);
    }

    #[test]
    fn uncertain_shard_append_does_not_advance_the_positions_anchor() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        set_test_atomic_file_injector(Some(std::sync::Arc::new(ParentSyncFault(
            "practice shard parent sync",
        ))));
        let result = record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a",
        );
        set_test_atomic_file_injector(None);
        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                DurabilityStage::PracticeReviewShard
            ))
        ));
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .revision,
            1
        );
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        assert_eq!(
            load_practice_reviews_in(&directory, "file", 1, None, 500)
                .unwrap()
                .entries
                .len(),
            1
        );
    }

    #[test]
    fn revision_conflict_leaves_the_positions_bytes_unchanged() {
        let (temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        let leaf = positions_leaf(&hash_deck("file", 1));
        let before = fs::read(temp.path().join("practice").join(&leaf)).unwrap();
        assert!(matches!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                99,
                99,
                &positions(),
                &entry("a"),
                "a"
            ),
            Err(Error::Conflict(_))
        ));
        assert_eq!(
            before,
            fs::read(temp.path().join("practice").join(leaf)).unwrap()
        );
    }

    #[test]
    fn new_review_entries_are_bounded_but_legacy_entries_are_not_rejected_by_that_bound() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        let large_entry =
            serde_json::json!({"fen":"a", "payload":"x".repeat(PRACTICE_ENTRY_MAX_BYTES)})
                .to_string();
        assert!(matches!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &large_entry,
                "large"
            ),
            Err(Error::InvalidInput(_))
        ));
        let legacy = serde_json::json!({"positions":[{"fen":"a"}],"logs":[serde_json::from_str::<Value>(&large_entry).unwrap()]}).to_string();
        assert_eq!(
            migrate_practice_deck_in(&directory, "legacy", 1, &legacy)
                .unwrap()
                .entries,
            1
        );
    }

    #[test]
    fn migration_is_deterministic_and_keeps_the_state_leaf() {
        let (_temp, directory) = directory();
        let legacy = serde_json::json!({
            "positions": [{"fen": "a"}],
            "logs": [{"fen": "a", "rating": 3}, {"fen": "b", "rating": 4}]
        })
        .to_string();
        let outcome = migrate_practice_deck_in(&directory, "file", 1, &legacy).unwrap();
        assert_eq!(outcome.status, PracticeMigrationStatus::Migrated);
        let second = migrate_practice_deck_in(&directory, "file", 1, "not-read").unwrap();
        assert_eq!(second.status, PracticeMigrationStatus::AlreadyMigrated);
        assert!(directory
            .open_regular_relative(Path::new(&state_leaf(&hash_deck("file", 1))))
            .is_ok());
    }

    #[test]
    fn migration_uncertain_shard_write_leaves_a_retryable_migrating_state() {
        let (_temp, directory) = directory();
        let legacy = serde_json::json!({
            "positions": [{"fen": "a"}],
            "logs": [{"fen": "a"}]
        })
        .to_string();
        set_test_atomic_file_injector(Some(Arc::new(FailOnParentSync {
            call: AtomicUsize::new(0),
            fail_on: 2,
        })));
        let result = migrate_practice_deck_in(&directory, "file", 1, &legacy);
        set_test_atomic_file_injector(None);
        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                DurabilityStage::PracticeReviewShard
            ))
        ));
        assert!(read_positions(&directory, &hash_deck("file", 1))
            .unwrap()
            .is_none());
        assert_eq!(
            read_state(&directory, &hash_deck("file", 1))
                .unwrap()
                .unwrap()
                .phase,
            MigrationPhase::Migrating
        );
        assert_eq!(
            migrate_practice_deck_in(&directory, "file", 1, &legacy)
                .unwrap()
                .status,
            PracticeMigrationStatus::Migrated
        );
    }

    #[test]
    fn reset_uncertain_positions_write_preserves_old_generation_shards() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        let old_shard = directory
            .path()
            .join(shard_leaf(&hash_deck("file", 1), 0, 0));
        assert!(old_shard.exists());
        set_test_atomic_file_injector(Some(Arc::new(FailOnParentSync {
            call: AtomicUsize::new(0),
            fail_on: 1,
        })));
        let result = reset_practice_deck_in(&directory, "file", 1, 0, 2, &positions());
        set_test_atomic_file_injector(None);
        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                DurabilityStage::PracticePositions
            ))
        ));
        assert!(old_shard.exists());
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .generation,
            1
        );
    }

    #[test]
    fn migration_validates_before_deleting_existing_shards() {
        let (_temp, directory) = directory();
        let legacy = serde_json::json!({
            "positions": [{"fen": "a"}],
            "logs": [{"fen": "a"}]
        })
        .to_string();
        let hash = hash_deck("file", 1);
        let state_leaf_name = state_leaf(&hash);
        let state = MigrationStateEnvelope {
            version: PRACTICE_STORAGE_VERSION,
            file_id: "file".to_owned(),
            game: 1,
            phase: MigrationPhase::Migrating,
            legacy_digest: digest_value(&serde_json::from_str::<Value>(&legacy).unwrap()).unwrap(),
        };
        write_json(
            &directory,
            &state_leaf_name,
            &state,
            DurabilityStage::PracticeState,
            "test",
        )
        .unwrap();
        let shard_leaf_name = shard_leaf(&hash, 0, 0);
        let shard = ReviewShardEnvelope {
            version: PRACTICE_STORAGE_VERSION,
            file_id: "file".to_owned(),
            game: 1,
            generation: 0,
            ordinal: 0,
            entries: vec![ReviewShardEntry {
                id: "entry".to_owned(),
                rev: 1,
                entry: serde_json::json!({"fen": "a"}),
            }],
        };
        write_json(
            &directory,
            &shard_leaf_name,
            &shard,
            DurabilityStage::PracticeReviewShard,
            "test",
        )
        .unwrap();
        let state_before = fs::read(directory.path().join(&state_leaf_name)).unwrap();
        let shard_before = fs::read(directory.path().join(&shard_leaf_name)).unwrap();
        assert!(matches!(
            migrate_practice_deck_in(&directory, "file", 1, "not-json"),
            Err(Error::InvalidInput(_))
        ));
        assert_damaged_identity(&list_practice_decks_in(&directory).unwrap(), "file", 1);
        assert_eq!(
            state_before,
            fs::read(directory.path().join(&state_leaf_name)).unwrap()
        );
        assert_eq!(
            shard_before,
            fs::read(directory.path().join(&shard_leaf_name)).unwrap()
        );
    }

    #[test]
    fn repaired_reset_deck_can_be_rebuilt_without_reimporting_legacy_history() {
        let (_temp, directory) = directory();
        let legacy = serde_json::json!({
            "positions": [{"fen": "legacy"}],
            "logs": [{"fen": "old"}]
        })
        .to_string();
        migrate_practice_deck_in(&directory, "file", 1, &legacy).unwrap();
        repair_practice_deck_in(&directory, "file", 1).unwrap();
        assert!(load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .is_none());
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        assert_eq!(
            migrate_practice_deck_in(&directory, "file", 1, &legacy)
                .unwrap()
                .status,
            PracticeMigrationStatus::AlreadyMigrated
        );
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .positions_document,
            positions()
        );
    }

    #[test]
    fn native_deck_migration_is_already_migrated_and_never_parses_legacy() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        let before = all_leaf_bytes(&directory);
        assert_eq!(
            migrate_practice_deck_in(&directory, "file", 1, "not-json")
                .unwrap()
                .status,
            PracticeMigrationStatus::AlreadyMigrated
        );
        assert_eq!(before, all_leaf_bytes(&directory));
    }

    #[test]
    fn native_position_changes_survive_migration_with_the_original_legacy_value() {
        let (_temp, directory) = directory();
        let original = legacy(&[serde_json::json!({"fen": "original"})], &[]);
        sync_practice_positions_in(&directory, "sync", 1, 0, 0, &positions()).unwrap();
        sync_practice_positions_in(
            &directory,
            "sync",
            1,
            0,
            1,
            r#"{"positions":[{"fen":"changed"}]}"#,
        )
        .unwrap();
        assert_eq!(
            migrate_practice_deck_in(&directory, "sync", 1, &original)
                .unwrap()
                .status,
            PracticeMigrationStatus::AlreadyMigrated
        );
        assert_eq!(
            load_practice_deck_in(&directory, "sync", 1)
                .unwrap()
                .unwrap()
                .positions_document,
            r#"{"positions":[{"fen":"changed"}]}"#
        );

        sync_practice_positions_in(&directory, "reset", 1, 0, 0, &positions()).unwrap();
        reset_practice_deck_in(
            &directory,
            "reset",
            1,
            0,
            1,
            r#"{"positions":[{"fen":"reset"}]}"#,
        )
        .unwrap();
        assert_eq!(
            migrate_practice_deck_in(&directory, "reset", 1, &original)
                .unwrap()
                .status,
            PracticeMigrationStatus::AlreadyMigrated
        );
        assert_eq!(
            load_practice_deck_in(&directory, "reset", 1)
                .unwrap()
                .unwrap()
                .positions_document,
            r#"{"positions":[{"fen":"reset"}]}"#
        );
    }

    #[test]
    fn migrated_state_without_positions_is_invalid_and_does_not_reimport() {
        let (_temp, directory) = directory();
        let value = legacy(
            &[serde_json::json!({"fen": "a"})],
            &[serde_json::json!({"n": 1})],
        );
        migrate_practice_deck_in(&directory, "file", 1, &value).unwrap();
        let hash = hash_deck("file", 1);
        let state_before = leaf_bytes(&directory, &state_leaf(&hash));
        let shard_before = leaf_bytes(&directory, &shard_leaf(&hash, 0, 0));
        fs::remove_file(directory.path().join(positions_leaf(&hash))).unwrap();
        assert!(matches!(
            load_practice_deck_in(&directory, "file", 1),
            Err(Error::InvalidInput(_))
        ));
        assert!(matches!(
            migrate_practice_deck_in(&directory, "file", 1, "not-json"),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(state_before, leaf_bytes(&directory, &state_leaf(&hash)));
        assert_eq!(
            shard_before,
            leaf_bytes(&directory, &shard_leaf(&hash, 0, 0))
        );
        assert_damaged_identity(&list_practice_decks_in(&directory).unwrap(), "file", 1);
    }

    #[test]
    fn orphan_count_overflow_is_reported_by_the_inventory_that_load_rejects() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        let hash = hash_deck("file", 1);
        let mut envelope = read_positions(&directory, &hash).unwrap().unwrap();
        envelope.applied_entries = 0;
        envelope.orphan_entries = u32::MAX;
        write_positions(&directory, &hash, &envelope).unwrap();

        assert!(load_practice_deck_in(&directory, "file", 1).is_err());
        assert_damaged_identity(&list_practice_decks_in(&directory).unwrap(), "file", 1);
    }

    #[test]
    fn migrating_state_with_healthy_positions_advances_without_importing() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        let hash = hash_deck("file", 1);
        write_test_state(
            &directory,
            "file",
            1,
            MigrationPhase::Migrating,
            &"0".repeat(64),
        );
        assert_damaged_identity(&list_practice_decks_in(&directory).unwrap(), "file", 1);
        assert_eq!(
            migrate_practice_deck_in(&directory, "file", 1, "not-json")
                .unwrap()
                .status,
            PracticeMigrationStatus::AlreadyMigrated
        );
        assert_eq!(
            read_state(&directory, &hash).unwrap().unwrap().phase,
            MigrationPhase::Migrated
        );
    }

    #[test]
    fn malformed_positions_keep_a_migrating_state_unchanged() {
        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        write_test_state(
            &directory,
            "file",
            1,
            MigrationPhase::Migrating,
            &"0".repeat(64),
        );
        fs::write(
            directory.path().join(positions_leaf(&hash)),
            br#"{"positions": "not-an-array"}"#,
        )
        .unwrap();
        assert!(matches!(
            migrate_practice_deck_in(&directory, "file", 1, "not-json"),
            Err(Error::InvalidInput(_))
        ));
        assert_damaged_identity(&list_practice_decks_in(&directory).unwrap(), "file", 1);
        assert_eq!(
            read_state(&directory, &hash).unwrap().unwrap().phase,
            MigrationPhase::Migrating
        );
    }

    #[test]
    fn migration_digest_change_starts_clean_or_reports_a_stranded_migration() {
        let (_temp, directory) = directory();
        let first = legacy(
            &[serde_json::json!({"fen": "a"})],
            &[serde_json::json!({"n": 1})],
        );
        let second = legacy(
            &[serde_json::json!({"fen": "b"})],
            &[serde_json::json!({"n": 2})],
        );
        let first_digest = digest_value(&serde_json::from_str::<Value>(&first).unwrap()).unwrap();
        write_test_state(
            &directory,
            "clean",
            1,
            MigrationPhase::Migrating,
            &first_digest,
        );
        assert_eq!(
            migrate_practice_deck_in(&directory, "clean", 1, &second)
                .unwrap()
                .status,
            PracticeMigrationStatus::Migrated
        );

        write_test_state(
            &directory,
            "stranded",
            1,
            MigrationPhase::Migrating,
            &first_digest,
        );
        write_test_shard(
            &directory,
            "stranded",
            1,
            0,
            0,
            vec![test_review("old", 1, serde_json::json!({"old": true}))],
        );
        let hash = hash_deck("stranded", 1);
        let state_before = leaf_bytes(&directory, &state_leaf(&hash));
        let shard_before = leaf_bytes(&directory, &shard_leaf(&hash, 0, 0));
        assert!(matches!(
            migrate_practice_deck_in(&directory, "stranded", 1, &second),
            Err(Error::Conflict(_))
        ));
        assert_eq!(state_before, leaf_bytes(&directory, &state_leaf(&hash)));
        assert_eq!(
            shard_before,
            leaf_bytes(&directory, &shard_leaf(&hash, 0, 0))
        );
        assert!(list_practice_decks_in(&directory)
            .unwrap()
            .anomalies
            .iter()
            .any(|anomaly| {
                anomaly.kind == PracticeStoreAnomalyKind::StrandedMigration
                    && anomaly.file_id.as_deref() == Some("stranded")
            }));
    }

    #[test]
    fn orphan_shards_without_state_or_positions_are_conflicts_and_inventory_anomalies() {
        let (_temp, directory) = directory();
        write_test_shard(
            &directory,
            "orphan",
            7,
            0,
            0,
            vec![test_review("orphan-id", 1, serde_json::json!({"x": 1}))],
        );
        let hash = hash_deck("orphan", 7);
        let before = all_leaf_bytes(&directory);
        assert!(matches!(
            migrate_practice_deck_in(&directory, "orphan", 7, "not-json"),
            Err(Error::Conflict(_))
        ));
        assert_eq!(before, all_leaf_bytes(&directory));
        assert!(matches!(
            load_practice_deck_in(&directory, "orphan", 7),
            Err(Error::InvalidInput(_))
        ));
        assert!(list_practice_decks_in(&directory)
            .unwrap()
            .anomalies
            .iter()
            .any(|anomaly| {
                anomaly.kind == PracticeStoreAnomalyKind::OrphanShard
                    && anomaly.file_id.as_deref() == Some("orphan")
                    && anomaly.game == Some(7)
                    && anomaly.leaf == shard_leaf(&hash, 0, 0)
            }));
    }

    #[test]
    fn missing_review_shard_is_invalid_through_load_and_already_migrated() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        fs::remove_file(
            directory
                .path()
                .join(shard_leaf(&hash_deck("file", 1), 0, 0)),
        )
        .unwrap();
        assert!(matches!(
            load_practice_deck_in(&directory, "file", 1),
            Err(Error::InvalidInput(_))
        ));
        assert!(matches!(
            migrate_practice_deck_in(&directory, "file", 1, "not-json"),
            Err(Error::InvalidInput(_))
        ));
        assert_damaged_identity(&list_practice_decks_in(&directory).unwrap(), "file", 1);
    }

    #[test]
    fn shrinking_a_partial_migration_removes_surplus_generation_zero_shards() {
        let (_temp, directory) = directory();
        let old = legacy(
            &[serde_json::json!({"fen": "old"})],
            &[serde_json::json!({"n": 1}), serde_json::json!({"n": 2})],
        );
        let shrunk = legacy(
            &[serde_json::json!({"fen": "new"})],
            &[serde_json::json!({"n": 3})],
        );
        let shrunk_value: Value = serde_json::from_str(&shrunk).unwrap();
        let digest = digest_value(&shrunk_value).unwrap();
        write_test_state(&directory, "file", 1, MigrationPhase::Migrating, &digest);
        let logs = serde_json::from_str::<Value>(&old).unwrap()["logs"]
            .as_array()
            .unwrap()
            .clone();
        for shard in imported_shards("file", 1, &logs).unwrap() {
            write_json(
                &directory,
                &shard_leaf(&hash_deck("file", 1), 0, shard.ordinal),
                &shard,
                DurabilityStage::PracticeReviewShard,
                "test",
            )
            .unwrap();
        }
        migrate_practice_deck_in(&directory, "file", 1, &shrunk).unwrap();
        let expected = imported_shards(
            "file",
            1,
            &serde_json::from_str::<Value>(&shrunk).unwrap()["logs"]
                .as_array()
                .unwrap()
                .clone(),
        )
        .unwrap()
        .into_iter()
        .flat_map(|shard| shard.entries)
        .map(|entry| entry.id)
        .rev()
        .collect::<Vec<_>>();
        let actual = load_practice_reviews_in(&directory, "file", 1, None, 500)
            .unwrap()
            .entries
            .into_iter()
            .map(|entry| entry.id)
            .collect::<Vec<_>>();
        assert_eq!(actual, expected);
        assert_eq!(
            all_shard_leaves(&directory, &hash_deck("file", 1))
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn migration_readback_digest_disagreement_leaves_only_migrating_state() {
        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        let hook_hash = hash.clone();
        let root = directory.path().to_path_buf();
        MIGRATION_BEFORE_READBACK_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move || {
                let leaf = shard_leaf(&hook_hash, 0, 0);
                let mut shard: ReviewShardEnvelope =
                    serde_json::from_slice(&fs::read(root.join(&leaf)).unwrap()).unwrap();
                shard.entries[0].entry = serde_json::json!({"corrupted": true});
                fs::write(root.join(leaf), serde_json::to_vec(&shard).unwrap()).unwrap();
                Ok(())
            }));
        });
        let value = legacy(
            &[serde_json::json!({"fen": "a"})],
            &[serde_json::json!({"n": 1})],
        );
        assert!(matches!(
            migrate_practice_deck_in(&directory, "file", 1, &value),
            Err(Error::InvalidInput(_))
        ));
        assert!(read_positions(&directory, &hash).unwrap().is_none());
        assert_eq!(
            read_state(&directory, &hash).unwrap().unwrap().phase,
            MigrationPhase::Migrating
        );
    }

    #[test]
    fn reordered_shard_entries_change_the_returned_entries_digest() {
        let (_temp, directory) = directory();
        let logs = vec![serde_json::json!({"n": 1}), serde_json::json!({"n": 2})];
        let value = legacy(&[serde_json::json!({"fen": "a"})], &logs);
        let expected = imported_shards("file", 1, &logs).unwrap();
        let expected_entries = expected
            .iter()
            .flat_map(|shard| shard.entries.iter().cloned())
            .collect::<Vec<_>>();
        let expected_digest = migration_entries_digest(&expected_entries).unwrap();
        migrate_practice_deck_in(&directory, "file", 1, &value).unwrap();
        let hash = hash_deck("file", 1);
        let leaf = shard_leaf(&hash, 0, 0);
        let mut shard: ReviewShardEnvelope =
            serde_json::from_slice(&leaf_bytes(&directory, &leaf)).unwrap();
        shard.entries.reverse();
        write_json(
            &directory,
            &leaf,
            &shard,
            DurabilityStage::PracticeReviewShard,
            "test",
        )
        .unwrap();
        let outcome = migrate_practice_deck_in(&directory, "file", 1, "not-json").unwrap();
        assert_ne!(outcome.entries_digest, expected_digest);
    }

    #[test]
    fn generation_and_migration_markers_survive_native_writes_and_reset() {
        let (_temp, directory) = directory();
        let value = legacy(
            &[serde_json::json!({"fen": "legacy"})],
            &[serde_json::json!({"n": 1})],
        );
        migrate_practice_deck_in(&directory, "file", 1, &value).unwrap();
        let hash = hash_deck("file", 1);
        let original = read_positions(&directory, &hash).unwrap().unwrap();
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("new"),
            "new",
        )
        .unwrap();
        sync_practice_positions_in(&directory, "file", 1, 0, 2, &positions()).unwrap();
        reset_practice_deck_in(&directory, "file", 1, 0, 3, &positions()).unwrap();
        let current = read_positions(&directory, &hash).unwrap().unwrap();
        assert_eq!(current.generation, 1);
        assert_eq!(current.legacy_source, original.legacy_source);
        assert_eq!(current.migrated_at, original.migrated_at);
        assert_eq!(current.migrated_entries, original.migrated_entries);
        assert_eq!(
            current.migrated_positions_digest,
            original.migrated_positions_digest
        );
    }

    #[test]
    fn oversized_legacy_inputs_leave_existing_migration_leaves_untouched() {
        let (_temp, directory) = directory();
        let digest = "0".repeat(64);
        write_test_state(&directory, "file", 1, MigrationPhase::Migrating, &digest);
        write_test_shard(
            &directory,
            "file",
            1,
            0,
            0,
            vec![test_review("old", 1, serde_json::json!({"old": true}))],
        );
        let before = all_leaf_bytes(&directory);
        let oversized = "x".repeat(PRACTICE_LEGACY_MAX_BYTES + 1);
        assert!(matches!(
            migrate_practice_deck_in(&directory, "file", 1, &oversized),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(before, all_leaf_bytes(&directory));

        let under_legacy_near_positions_limit = serde_json::json!({
            "positions": ["x".repeat(PRACTICE_POSITIONS_MAX_BYTES - 2_048)],
            "logs": []
        })
        .to_string();
        assert!(under_legacy_near_positions_limit.len() < PRACTICE_LEGACY_MAX_BYTES);
        assert_eq!(
            migrate_practice_deck_in(&directory, "under", 1, &under_legacy_near_positions_limit)
                .unwrap()
                .status,
            PracticeMigrationStatus::Migrated
        );
        let over_positions = serde_json::json!({
            "positions": ["x".repeat(PRACTICE_POSITIONS_MAX_BYTES)],
            "logs": []
        })
        .to_string();
        let before_over = all_leaf_bytes(&directory);
        assert!(matches!(
            migrate_practice_deck_in(&directory, "file", 1, &over_positions),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(before_over, all_leaf_bytes(&directory));
    }

    #[test]
    fn successful_import_records_counts_last_entry_and_zero_unapplied_reviews() {
        let (_temp, directory) = directory();
        let logs = vec![serde_json::json!({"n": 1}), serde_json::json!({"n": 2})];
        let value = legacy(&[serde_json::json!({"fen": "a"})], &logs);
        let outcome = migrate_practice_deck_in(&directory, "file", 1, &value).unwrap();
        let hash = hash_deck("file", 1);
        let envelope = read_positions(&directory, &hash).unwrap().unwrap();
        let shards = read_shards(&directory, &hash, 0).unwrap();
        let entries = shards
            .iter()
            .flat_map(|shard| shard.envelope.entries.iter())
            .collect::<Vec<_>>();
        let last = entries.last().unwrap();
        assert_eq!(envelope.applied_entries, 2);
        assert_eq!(envelope.last_entry_id.as_deref(), Some(last.id.as_str()));
        assert_eq!(
            envelope.last_entry_digest.as_deref(),
            Some(entry_digest(&last.entry).unwrap().as_str())
        );
        assert_eq!(envelope.orphan_entries, 0);
        assert_eq!(outcome.entries, envelope.applied_entries);
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .unapplied_reviews,
            0
        );
    }

    #[test]
    fn sync_only_creates_empty_or_reset_decks_and_conflicts_with_migration_state_or_shards() {
        let (_temp, directory) = directory();
        write_test_state(
            &directory,
            "reset",
            1,
            MigrationPhase::Reset,
            &"0".repeat(64),
        );
        assert_eq!(
            sync_practice_positions_in(&directory, "reset", 1, 0, 0, &positions()).unwrap(),
            1
        );
        write_test_state(
            &directory,
            "migrating",
            1,
            MigrationPhase::Migrating,
            &"0".repeat(64),
        );
        assert!(matches!(
            sync_practice_positions_in(&directory, "migrating", 1, 0, 0, &positions()),
            Err(Error::Conflict(_))
        ));
        write_test_state(
            &directory,
            "migrated",
            1,
            MigrationPhase::Migrated,
            &"0".repeat(64),
        );
        assert!(matches!(
            sync_practice_positions_in(&directory, "migrated", 1, 0, 0, &positions()),
            Err(Error::Conflict(_))
        ));
        write_test_shard(
            &directory,
            "shards",
            1,
            0,
            0,
            vec![test_review("id", 1, serde_json::json!({"x": 1}))],
        );
        assert!(matches!(
            sync_practice_positions_in(&directory, "shards", 1, 0, 0, &positions()),
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn load_distinguishes_missing_positions_by_migration_phase() {
        let (_temp, directory) = directory();
        for (file_id, phase) in [
            ("migrating", MigrationPhase::Migrating),
            ("migrated", MigrationPhase::Migrated),
        ] {
            write_test_state(&directory, file_id, 1, phase, &"0".repeat(64));
            assert!(matches!(
                load_practice_deck_in(&directory, file_id, 1),
                Err(Error::InvalidInput(_))
            ));
        }
        write_test_state(
            &directory,
            "reset",
            1,
            MigrationPhase::Reset,
            &"0".repeat(64),
        );
        assert!(load_practice_deck_in(&directory, "reset", 1)
            .unwrap()
            .is_none());
    }

    #[test]
    fn orphan_acknowledgement_is_generation_checked_and_new_orphans_unacknowledge_it() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        RECORD_AFTER_APPEND_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupt A".into()))))
        });
        assert!(record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a"
        )
        .is_err());
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("b"),
            "b",
        )
        .unwrap();
        acknowledge_practice_orphans_in(&directory, "file", 1, 0, 1).unwrap();
        let before = load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .unwrap();
        assert!(before.orphans_acknowledged);
        RECORD_AFTER_APPEND_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupt C".into()))))
        });
        assert!(record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            2,
            1,
            &positions(),
            &entry("c"),
            "c"
        )
        .is_err());
        let after = load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .unwrap();
        assert_eq!(after.unapplied_reviews, before.unapplied_reviews + 1);
        assert!(!after.orphans_acknowledged);
        acknowledge_practice_orphans_in(&directory, "file", 1, 0, 1).unwrap();
        let still_same = load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .unwrap();
        assert_eq!(still_same.unapplied_reviews, after.unapplied_reviews);
        reset_practice_deck_in(&directory, "file", 1, 0, 2, &positions()).unwrap();
        assert!(matches!(
            acknowledge_practice_orphans_in(&directory, "file", 1, 0, 0),
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn revision_maximum_refuses_rating_but_allows_reset_and_rejects_old_generation() {
        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        let mut envelope = new_positions("file", 1, vec![serde_json::json!({"fen": "a"})]);
        envelope.revision = u32::MAX;
        envelope.applied_entries = 1;
        write_positions(&directory, &hash, &envelope).unwrap();
        write_test_shard(
            &directory,
            "file",
            1,
            0,
            0,
            vec![test_review("old", 1, serde_json::json!({"old": true}))],
        );
        assert_eq!(
            load_practice_reviews_in(&directory, "file", 1, None, 500)
                .unwrap()
                .entries
                .len(),
            1
        );
        let before = all_leaf_bytes(&directory);
        assert!(matches!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                u32::MAX,
                u32::MAX,
                &positions(),
                &entry("new"),
                "new"
            ),
            Err(Error::Conflict(_))
        ));
        assert_eq!(before, all_leaf_bytes(&directory));
        assert_eq!(
            reset_practice_deck_in(&directory, "file", 1, 0, u32::MAX, &positions()).unwrap(),
            1
        );
        let reset = read_positions(&directory, &hash).unwrap().unwrap();
        assert_eq!(reset.revision, 1);
        assert_eq!(reset.generation, 1);
        assert!(matches!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &entry("old-generation"),
                "old-generation"
            ),
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn repair_recovers_lost_positions_stranded_migration_and_malformed_positions() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "lost", 1, 0, 0, &positions()).unwrap();
        write_test_shard(
            &directory,
            "lost",
            1,
            0,
            0,
            vec![test_review("id", 1, serde_json::json!({"x": 1}))],
        );
        fs::remove_file(directory.path().join(positions_leaf(&hash_deck("lost", 1)))).unwrap();
        repair_practice_deck_in(&directory, "lost", 1).unwrap();
        assert!(load_practice_deck_in(&directory, "lost", 1)
            .unwrap()
            .is_none());

        write_test_state(
            &directory,
            "stranded",
            1,
            MigrationPhase::Migrating,
            &"0".repeat(64),
        );
        write_test_shard(
            &directory,
            "stranded",
            1,
            0,
            0,
            vec![test_review("id", 1, serde_json::json!({"x": 1}))],
        );
        repair_practice_deck_in(&directory, "stranded", 1).unwrap();
        assert!(load_practice_deck_in(&directory, "stranded", 1)
            .unwrap()
            .is_none());
        assert!(read_state(&directory, &hash_deck("stranded", 1))
            .unwrap()
            .is_none());

        let malformed_hash = hash_deck("malformed", 1);
        fs::write(
            directory.path().join(positions_leaf(&malformed_hash)),
            b"not-json",
        )
        .unwrap();
        repair_practice_deck_in(&directory, "malformed", 1).unwrap();
        assert!(load_practice_deck_in(&directory, "malformed", 1)
            .unwrap()
            .is_none());

        let malformed_state_hash = hash_deck("malformed-state", 1);
        fs::write(
            directory.path().join(state_leaf(&malformed_state_hash)),
            b"not-json",
        )
        .unwrap();
        repair_practice_deck_in(&directory, "malformed-state", 1).unwrap();
        assert!(!directory
            .path()
            .join(state_leaf(&malformed_state_hash))
            .exists());

        let mismatched_state_hash = hash_deck("mismatched-state", 1);
        write_json(
            &directory,
            &state_leaf(&mismatched_state_hash),
            &MigrationStateEnvelope {
                version: PRACTICE_STORAGE_VERSION,
                file_id: "other-file".to_owned(),
                game: 1,
                phase: MigrationPhase::Migrating,
                legacy_digest: "0".repeat(64),
            },
            DurabilityStage::PracticeState,
            "test",
        )
        .unwrap();
        repair_practice_deck_in(&directory, "mismatched-state", 1).unwrap();
        assert!(!directory
            .path()
            .join(state_leaf(&mismatched_state_hash))
            .exists());

        let never_hash = hash_deck("never", 1);
        fs::write(
            directory.path().join(positions_leaf(&never_hash)),
            b"not-json",
        )
        .unwrap();
        repair_practice_deck_in(&directory, "never", 1).unwrap();
        assert_eq!(
            migrate_practice_deck_in(
                &directory,
                "never",
                1,
                &legacy(&[serde_json::json!({"fen": "a"})], &[])
            )
            .unwrap()
            .status,
            PracticeMigrationStatus::Migrated
        );

        let migrated = legacy(&[serde_json::json!({"fen": "a"})], &[]);
        migrate_practice_deck_in(&directory, "migrated", 1, &migrated).unwrap();
        repair_practice_deck_in(&directory, "migrated", 1).unwrap();
        assert_eq!(
            migrate_practice_deck_in(&directory, "migrated", 1, "not-json")
                .unwrap()
                .status,
            PracticeMigrationStatus::AlreadyMigrated
        );
        assert_eq!(
            read_state(&directory, &hash_deck("migrated", 1))
                .unwrap()
                .unwrap()
                .phase,
            MigrationPhase::Reset
        );
    }

    #[test]
    fn repairing_migrating_state_reimports_the_retained_legacy_history() {
        let (_temp, directory) = directory();
        let legacy_document = legacy(
            &[serde_json::json!({"fen": "legacy-position"})],
            &[serde_json::json!({"fen": "legacy-review", "rating": 3})],
        );
        let legacy_value: Value = serde_json::from_str(&legacy_document).unwrap();
        let legacy_digest = digest_value(&legacy_value).unwrap();
        write_test_state(
            &directory,
            "file",
            1,
            MigrationPhase::Migrating,
            &legacy_digest,
        );
        write_test_shard(
            &directory,
            "file",
            1,
            0,
            0,
            vec![test_review(
                "interrupted",
                1,
                serde_json::json!({"fen": "partial"}),
            )],
        );

        repair_practice_deck_in(&directory, "file", 1).unwrap();
        assert!(read_state(&directory, &hash_deck("file", 1))
            .unwrap()
            .is_none());
        let migrated = migrate_practice_deck_in(&directory, "file", 1, &legacy_document).unwrap();

        assert_eq!(migrated.status, PracticeMigrationStatus::Migrated);
        assert_eq!(migrated.entries, 1);
        assert_eq!(migrated.positions, 1);
        let page = load_practice_reviews_in(&directory, "file", 1, None, 10).unwrap();
        assert_eq!(page.entries.len(), 1);
        assert!(page.entries[0].entry.contains("legacy-review"));
    }

    #[test]
    fn repairing_reset_state_keeps_legacy_migration_held() {
        let (_temp, directory) = directory();
        let legacy_document = legacy(&[serde_json::json!({"fen": "legacy"})], &[]);
        write_test_state(
            &directory,
            "file",
            1,
            MigrationPhase::Reset,
            &"0".repeat(64),
        );

        repair_practice_deck_in(&directory, "file", 1).unwrap();

        assert_eq!(
            read_state(&directory, &hash_deck("file", 1))
                .unwrap()
                .unwrap()
                .phase,
            MigrationPhase::Reset
        );
        assert_eq!(
            migrate_practice_deck_in(&directory, "file", 1, &legacy_document)
                .unwrap()
                .status,
            PracticeMigrationStatus::AlreadyMigrated
        );
    }

    #[test]
    fn repair_maps_state_write_failure_after_deletions_to_partial_removal() {
        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        write_test_state(
            &directory,
            "file",
            1,
            MigrationPhase::Migrated,
            &"0".repeat(64),
        );
        write_test_shard(
            &directory,
            "file",
            1,
            0,
            0,
            vec![test_review("id", 1, serde_json::json!({"x": 1}))],
        );
        set_test_atomic_file_injector(Some(Arc::new(FailOnParentSync {
            call: AtomicUsize::new(0),
            fail_on: 1,
        })));
        let result = repair_practice_deck_in(&directory, "file", 1);
        set_test_atomic_file_injector(None);

        assert!(matches!(result, Err(Error::PartialRemoval { .. })));
        assert!(!directory.path().join(positions_leaf(&hash)).exists());
        assert!(!directory.path().join(shard_leaf(&hash, 0, 0)).exists());
    }

    #[test]
    fn shard_sealing_starts_a_new_ordinal_at_the_budget_and_keeps_oversized_imports_alone() {
        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        write_positions(&directory, &hash, &new_positions("file", 1, vec![])).unwrap();
        let mut current = Vec::new();
        for index in 0..20_u32 {
            let value = serde_json::json!({"payload": "x".repeat(15_000)});
            append_review(
                &directory,
                &hash,
                "file",
                1,
                0,
                index + 1,
                read_shards(&directory, &hash, 0)
                    .unwrap()
                    .last()
                    .map(|shard| &shard.envelope),
                &format!("id-{index}"),
                &value,
            )
            .unwrap();
            current = read_shards(&directory, &hash, 0).unwrap();
            if current.len() == 2 {
                break;
            }
        }
        assert_eq!(current.len(), 2);
        assert!(shard_bytes(&current[0].envelope).unwrap().len() <= PRACTICE_SHARD_SEAL_BYTES);
        assert!(
            shard_bytes(&current[0].envelope).unwrap().len()
                + shard_bytes(&current[1].envelope).unwrap().len()
                > PRACTICE_SHARD_SEAL_BYTES
        );

        let exact_hash = hash_deck("exact", 1);
        write_positions(&directory, &exact_hash, &new_positions("exact", 1, vec![])).unwrap();
        let mut exact = Vec::new();
        for index in 0..30_u32 {
            append_review(
                &directory,
                &exact_hash,
                "exact",
                1,
                0,
                index + 1,
                read_shards(&directory, &exact_hash, 0)
                    .unwrap()
                    .last()
                    .map(|shard| &shard.envelope),
                &format!("id-{index}"),
                &serde_json::json!({"payload": "x".repeat(7_000)}),
            )
            .unwrap();
            exact = read_shards(&directory, &exact_hash, 0).unwrap();
            if exact.len() == 2 {
                break;
            }
        }
        let mut exact_first = exact[0].envelope.clone();
        let old_size = shard_bytes(&exact_first).unwrap().len();
        let old_payload = exact_first.entries.last().unwrap().entry["payload"]
            .as_str()
            .unwrap()
            .len();
        exact_first.entries.last_mut().unwrap().entry["payload"] =
            Value::String("x".repeat(old_payload + PRACTICE_SHARD_SEAL_BYTES - old_size));
        assert_eq!(
            shard_bytes(&exact_first).unwrap().len(),
            PRACTICE_SHARD_SEAL_BYTES
        );
        write_json(
            &directory,
            &shard_leaf(&exact_hash, 0, 0),
            &exact_first,
            DurabilityStage::PracticeReviewShard,
            "test",
        )
        .unwrap();
        append_review(
            &directory,
            &exact_hash,
            "exact",
            1,
            0,
            99,
            read_shards(&directory, &exact_hash, 0)
                .unwrap()
                .last()
                .map(|shard| &shard.envelope),
            "crosses-exact-budget",
            &serde_json::json!({"small": true}),
        )
        .unwrap();
        let exact_after = read_shards(&directory, &exact_hash, 0).unwrap();
        assert_eq!(exact_after.len(), 2);
        assert_eq!(exact_after[1].envelope.ordinal, 1);

        let oversized = serde_json::json!({
            "positions": [],
            "logs": [{"payload": "x".repeat(PRACTICE_SHARD_SEAL_BYTES)}]
        })
        .to_string();
        let outcome = migrate_practice_deck_in(&directory, "oversized", 1, &oversized).unwrap();
        assert_eq!(outcome.entries, 1);
        let imported = read_shards(&directory, &hash_deck("oversized", 1), 0).unwrap();
        assert_eq!(imported.len(), 1);
        assert!(shard_bytes(&imported[0].envelope).unwrap().len() > PRACTICE_SHARD_SEAL_BYTES);
    }

    #[test]
    fn admission_limits_reject_overages_accept_below_and_clamp_review_reads() {
        let below_positions = serde_json::json!({
            "positions": ["x".repeat(PRACTICE_POSITIONS_MAX_BYTES - 64)]
        })
        .to_string();
        assert!(validate_positions_document(&below_positions, "test").is_ok());
        let over_positions = serde_json::json!({
            "positions": ["x".repeat(PRACTICE_POSITIONS_MAX_BYTES)]
        })
        .to_string();
        assert!(validate_positions_document(&over_positions, "test").is_err());

        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        let at_entry_limit = format!("{{\"x\":\"{}\"}}", "x".repeat(PRACTICE_ENTRY_MAX_BYTES));
        assert!(matches!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &at_entry_limit,
                "too-large"
            ),
            Err(Error::InvalidInput(_))
        ));
        let below_entry_limit = format!(
            "{{\"x\":\"{}\"}}",
            "x".repeat(PRACTICE_ENTRY_MAX_BYTES - 16)
        );
        assert!(below_entry_limit.len() < PRACTICE_ENTRY_MAX_BYTES);
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &below_entry_limit,
            &"i".repeat(PRACTICE_ID_MAX_BYTES),
        )
        .unwrap();
        assert!(matches!(
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                2,
                1,
                &positions(),
                &entry("over-id"),
                &"i".repeat(PRACTICE_ID_MAX_BYTES + 1)
            ),
            Err(Error::InvalidInput(_))
        ));
        let hash = hash_deck("file", 1);
        let mut envelope = read_positions(&directory, &hash).unwrap().unwrap();
        envelope.applied_entries = 501;
        let entries = (0..501_u32)
            .map(|index| {
                test_review(
                    &format!("id-{index}"),
                    index + 1,
                    serde_json::json!({"n": index}),
                )
            })
            .collect();
        write_test_shard(&directory, "file", 1, 0, 0, entries);
        write_positions(&directory, &hash, &envelope).unwrap();
        let page = load_practice_reviews_in(&directory, "file", 1, None, u32::MAX).unwrap();
        assert_eq!(page.entries.len(), PRACTICE_READ_MAX_ENTRIES as usize);
        assert!(page.next_cursor.is_some());
        assert!(matches!(
            load_practice_reviews_in(
                &directory,
                "file",
                1,
                Some("x".repeat(PRACTICE_ID_MAX_BYTES + 1)),
                1
            ),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn paging_many_shards_returns_every_id_in_reverse_written_order() {
        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        let mut envelope = new_positions("file", 1, vec![]);
        envelope.applied_entries = 6;
        write_positions(&directory, &hash, &envelope).unwrap();
        for (ordinal, start) in [(0, 0), (1, 2), (2, 4)] {
            write_test_shard(
                &directory,
                "file",
                1,
                0,
                ordinal,
                (start..start + 2)
                    .map(|index| {
                        test_review(
                            &format!("id-{index}"),
                            index + 1,
                            serde_json::json!({"n": index}),
                        )
                    })
                    .collect(),
            );
        }
        let mut cursor = None;
        let mut ids = Vec::new();
        loop {
            let page = load_practice_reviews_in(&directory, "file", 1, cursor, 2).unwrap();
            ids.extend(page.entries.into_iter().map(|entry| entry.id));
            cursor = page.next_cursor;
            if cursor.is_none() {
                break;
            }
        }
        assert_eq!(ids, ["id-5", "id-4", "id-3", "id-2", "id-1", "id-0"]);
    }

    #[test]
    fn reset_clears_all_applied_orphan_and_acknowledged_counters() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            1,
            1,
            &positions(),
            &entry("a"),
            "a",
        )
        .unwrap();
        RECORD_AFTER_APPEND_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupt".into()))))
        });
        assert!(record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            2,
            2,
            &positions(),
            &entry("b"),
            "b"
        )
        .is_err());
        acknowledge_practice_orphans_in(&directory, "file", 1, 0, 1).unwrap();
        reset_practice_deck_in(&directory, "file", 1, 0, 2, &positions()).unwrap();
        let envelope = read_positions(&directory, &hash_deck("file", 1))
            .unwrap()
            .unwrap();
        assert_eq!(envelope.applied_entries, 0);
        assert_eq!(envelope.orphan_entries, 0);
        assert_eq!(envelope.orphan_acknowledged_count, 0);
    }

    #[test]
    fn many_interrupted_ratings_remain_visible_and_are_not_reduced_by_later_writes() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        for index in 0..5_u32 {
            RECORD_AFTER_APPEND_HOOK.with(|slot| {
                *slot.borrow_mut() = Some(Box::new(|| Err(Error::Conflict("interrupt".into()))))
            });
            assert!(record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &entry(&index.to_string()),
                &format!("orphan-{index}"),
            )
            .is_err());
        }
        let snapshot = load_practice_deck_in(&directory, "file", 1)
            .unwrap()
            .unwrap();
        assert_eq!(snapshot.unapplied_reviews, 5);
        assert_eq!(
            load_practice_reviews_in(&directory, "file", 1, None, 500)
                .unwrap()
                .entries
                .len(),
            5
        );
        sync_practice_positions_in(&directory, "file", 1, 0, 1, &positions()).unwrap();
        record_practice_review_in(
            &directory,
            "file",
            1,
            0,
            2,
            5,
            &positions(),
            &entry("later"),
            "later",
        )
        .unwrap();
        assert_eq!(
            load_practice_deck_in(&directory, "file", 1)
                .unwrap()
                .unwrap()
                .unapplied_reviews,
            5
        );
    }

    #[cfg(unix)]
    #[test]
    fn inventory_reports_owned_symlinks_as_not_regular_files() {
        use std::os::unix::fs::symlink;

        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        let target = directory.path().join("outside");
        fs::write(&target, b"outside").unwrap();
        symlink(&target, directory.path().join(positions_leaf(&hash))).unwrap();
        assert!(list_practice_decks_in(&directory)
            .unwrap()
            .anomalies
            .iter()
            .any(|anomaly| {
                anomaly.kind == PracticeStoreAnomalyKind::NotARegularFile
                    && anomaly.leaf == positions_leaf(&hash)
            }));
    }

    #[test]
    fn migration_retry_after_positions_write_interruption_is_byte_identical() {
        let (_temp, directory) = directory();
        let value = legacy(
            &[serde_json::json!({"fen": "a"})],
            &[serde_json::json!({"n": 1}), serde_json::json!({"n": 2})],
        );
        MIGRATION_BEFORE_POSITIONS_HOOK.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(|| {
                Err(Error::Conflict("interrupt migration".into()))
            }));
        });
        assert!(matches!(
            migrate_practice_deck_in(&directory, "file", 1, &value),
            Err(Error::Conflict(_))
        ));
        let hash = hash_deck("file", 1);
        let shards_before = all_leaf_bytes(&directory)
            .into_iter()
            .filter(|(leaf, _)| leaf.starts_with(&format!("{hash}-g")))
            .collect::<BTreeMap<_, _>>();
        assert!(read_positions(&directory, &hash).unwrap().is_none());
        migrate_practice_deck_in(&directory, "file", 1, &value).unwrap();
        let shards_after = all_leaf_bytes(&directory)
            .into_iter()
            .filter(|(leaf, _)| leaf.starts_with(&format!("{hash}-g")))
            .collect::<BTreeMap<_, _>>();
        assert_eq!(shards_before, shards_after);
        assert_eq!(
            load_practice_reviews_in(&directory, "file", 1, None, 500)
                .unwrap()
                .entries
                .len(),
            2
        );
    }

    #[test]
    fn review_pages_are_newest_first_and_limit_is_bounded() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        for index in 0..3 {
            record_practice_review_in(
                &directory,
                "file",
                1,
                0,
                index + 1,
                index + 1,
                &positions(),
                &entry(&index.to_string()),
                &index.to_string(),
            )
            .unwrap();
        }
        let page = load_practice_reviews_in(&directory, "file", 1, None, 2).unwrap();
        assert_eq!(page.entries.len(), 2);
        assert_eq!(page.entries[0].id, "2");
        let next = load_practice_reviews_in(&directory, "file", 1, page.next_cursor, 2).unwrap();
        assert_eq!(next.entries.len(), 1);
    }

    #[test]
    fn shard_ordinals_are_sorted_numerically_without_fixed_width_padding() {
        let (_temp, directory) = directory();
        let hash = hash_deck("file", 1);
        let positions_envelope = new_positions("file", 1, vec![serde_json::json!({"fen": "a"})]);
        write_positions(&directory, &hash, &positions_envelope).unwrap();
        for (ordinal, id, rev) in [(9, "nine", 1), (10, "ten", 2), (100_000, "large", 3)] {
            write_json(
                &directory,
                &shard_leaf(&hash, 0, ordinal),
                &ReviewShardEnvelope {
                    version: PRACTICE_STORAGE_VERSION,
                    file_id: "file".to_owned(),
                    game: 1,
                    generation: 0,
                    ordinal,
                    entries: vec![ReviewShardEntry {
                        id: id.to_owned(),
                        rev,
                        entry: serde_json::json!({"id": id}),
                    }],
                },
                DurabilityStage::PracticeReviewShard,
                "test",
            )
            .unwrap();
        }
        let page = load_practice_reviews_in(&directory, "file", 1, None, 500).unwrap();
        assert_eq!(
            page.entries
                .into_iter()
                .map(|entry| entry.id)
                .collect::<Vec<_>>(),
            ["large", "ten", "nine"]
        );
    }

    #[test]
    fn two_writers_from_one_revision_are_serialized() {
        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        let barrier = Arc::new(Barrier::new(3));
        let first_dir = Arc::new(directory);
        let second_dir = first_dir.clone();
        let first_barrier = barrier.clone();
        let first = thread::spawn(move || {
            first_barrier.wait();
            record_practice_review_in(
                &first_dir,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &entry("a"),
                "a",
            )
        });
        let second_barrier = barrier.clone();
        let second = thread::spawn(move || {
            second_barrier.wait();
            record_practice_review_in(
                &second_dir,
                "file",
                1,
                0,
                1,
                1,
                &positions(),
                &entry("b"),
                "b",
            )
        });
        barrier.wait();
        let first_result = first.join().unwrap();
        let second_result = second.join().unwrap();
        assert!(first_result.is_ok() ^ second_result.is_ok());
        assert!(matches!(first_result.or(second_result), Ok(2)));
    }

    #[cfg(unix)]
    #[test]
    fn cross_process_lock_serializes_a_paused_critical_section() {
        let child_mode = env::var("PRACTICE_CHILD_MODE").ok();
        if let Some(mode) = child_mode {
            let root = env::var_os("PRACTICE_CHILD_ROOT").expect("child root");
            let app_data = AppDataDir::for_test(&PathBuf::from(root));
            let directory = ensure_app_owned_default_dir(&app_data, AppOwnedDefaultRoot::Practice)
                .expect("practice root");
            if mode == "first" {
                let ready = env::var_os("PRACTICE_CHILD_READY").expect("ready path");
                CRITICAL_SECTION_HOOK.with(|slot| {
                    *slot.borrow_mut() = Some(Box::new(move || {
                        fs::write(ready, b"entered").expect("ready marker");
                        thread::sleep(Duration::from_millis(700));
                    }))
                });
                record_practice_review_in(
                    &directory,
                    "file",
                    1,
                    0,
                    1,
                    1,
                    &positions(),
                    &entry("a"),
                    "a",
                )
                .expect("first child commits");
            } else {
                let first = record_practice_review_in(
                    &directory,
                    "file",
                    1,
                    0,
                    1,
                    1,
                    &positions(),
                    &entry("b"),
                    "b",
                );
                assert!(matches!(first, Err(Error::Conflict(_))));
                record_practice_review_in(
                    &directory,
                    "file",
                    1,
                    0,
                    2,
                    1,
                    &positions(),
                    &entry("b"),
                    "b",
                )
                .expect("second child retries after conflict");
            }
            return;
        }

        let (_temp, directory) = directory();
        sync_practice_positions_in(&directory, "file", 1, 0, 0, &positions()).unwrap();
        let root = directory.path().parent().unwrap().to_path_buf();
        let ready = root.join("child-ready");
        let executable = env::current_exe().unwrap();
        let mut first = Command::new(&executable)
            .arg("--exact")
            .arg("practice::tests::cross_process_lock_serializes_a_paused_critical_section")
            .arg("--nocapture")
            .env("PRACTICE_CHILD_MODE", "first")
            .env("PRACTICE_CHILD_ROOT", &root)
            .env("PRACTICE_CHILD_READY", &ready)
            .spawn()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        while !ready.exists() && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(10));
        }
        assert!(
            ready.exists(),
            "first child did not enter its critical section"
        );
        let mut second = Command::new(&executable)
            .arg("--exact")
            .arg("practice::tests::cross_process_lock_serializes_a_paused_critical_section")
            .arg("--nocapture")
            .env("PRACTICE_CHILD_MODE", "second")
            .env("PRACTICE_CHILD_ROOT", &root)
            .spawn()
            .unwrap();
        assert!(first.wait().unwrap().success());
        assert!(second.wait().unwrap().success());
        let page = load_practice_reviews_in(&directory, "file", 1, None, 500).unwrap();
        assert_eq!(page.entries.len(), 2);
    }
}
