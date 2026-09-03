use std::{
    ffi::{OsStr, OsString},
    fs::File,
    io::{self, Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
};

use memmap2::Mmap;
use rayon::prelude::*;
use rkyv::{Archive, Deserialize, Serialize};

use crate::{
    db::DatabaseIdentity,
    error::{DurabilityStage, Error},
    infra::fs::{atomic_replace, atomic_replace_at, remove_optional_regular_at, AtomicFileOutcome},
};

const MAGIC: &[u8; 4] = b"ECSI";
const VERSION: u32 = 6;
// The rkyv payload contains `u128` freshness data and therefore requires a
// 16-byte aligned start inside the mmap.
const HEADER_SIZE: usize = 16;

fn verify_header(header: &[u8]) -> io::Result<()> {
    if header.len() < HEADER_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "File too small for header",
        ));
    }

    if &header[0..4] != MAGIC {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid magic bytes",
        ));
    }

    let version = u32::from_le_bytes(header[4..8].try_into().unwrap());
    if version != VERSION {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Unsupported version: {} (expected {})", version, VERSION),
        ));
    }

    Ok(())
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Archive, Serialize, Deserialize)]
#[rkyv(compare(PartialEq), derive(Debug))]
#[repr(u8)]
pub enum GameResult {
    #[default]
    None = 0,
    WhiteWin = 1,
    BlackWin = 2,
    Draw = 3,
    Other = 4,
}

impl GameResult {
    pub fn from_str(s: Option<&str>) -> Self {
        match s {
            Some("1-0") => GameResult::WhiteWin,
            Some("0-1") => GameResult::BlackWin,
            Some("1/2-1/2") => GameResult::Draw,
            Some(_) => GameResult::Other,
            None => GameResult::None,
        }
    }

    pub fn to_str(self) -> Option<&'static str> {
        match self {
            GameResult::None => None,
            GameResult::WhiteWin => Some("1-0"),
            GameResult::BlackWin => Some("0-1"),
            GameResult::Draw => Some("1/2-1/2"),
            GameResult::Other => Some("*"),
        }
    }
}

#[derive(Debug, Clone, Archive, Serialize, Deserialize)]
#[rkyv(compare(PartialEq), derive(Debug))]
pub struct SearchGameEntry {
    pub id: i32,
    pub white_id: i32,
    pub black_id: i32,
    pub date: Option<String>,
    pub result: GameResult,
    pub pawn_home: u16,
    pub white_material: u8,
    pub black_material: u8,
    pub white_elo: i16,
    pub black_elo: i16,
    pub fen: Option<String>,
    pub moves: Vec<u8>,
}

#[derive(Clone, Debug, Archive, Serialize, Deserialize)]
pub struct SearchIndex {
    pub entries: Vec<SearchGameEntry>,
}

/// Lossless, platform-specific native path data that can safely be persisted
/// in an archive. The enum remains platform-neutral so an archive's provenance
/// is explicit even when it is inspected on a different platform.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Archive, Serialize, Deserialize)]
pub enum NativePath {
    Unix(Vec<u8>),
    Windows(Vec<u16>),
}

impl NativePath {
    fn from_path(path: &Path) -> Self {
        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStrExt;

            Self::Unix(path.as_os_str().as_bytes().to_vec())
        }
        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;

            Self::Windows(path.as_os_str().encode_wide().collect())
        }
        #[cfg(not(any(unix, windows)))]
        compile_error!("search indexes need a native path codec");
    }
}

impl Default for NativePath {
    fn default() -> Self {
        #[cfg(unix)]
        {
            Self::Unix(Vec::new())
        }
        #[cfg(windows)]
        {
            Self::Windows(Vec::new())
        }
        #[cfg(not(any(unix, windows)))]
        compile_error!("search indexes need a native path codec");
    }
}

/// Provenance recorded with every archive. The canonical database identity,
/// repository revision and filesystem freshness must agree before an archive
/// can be used for a query.
#[derive(Clone, Debug, Default, PartialEq, Eq, Hash, Archive, Serialize, Deserialize)]
pub struct IndexSource {
    pub database: NativePath,
    pub object: (u64, u64),
    pub revision: u64,
    pub database_length: u64,
    pub database_modified_nanos: u128,
}

impl IndexSource {
    pub fn from_database(database: &Path, revision: u64) -> Result<Self, Error> {
        let database = database.canonicalize()?;
        let metadata = database.metadata()?;
        let database_modified_nanos = metadata
            .modified()?
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .map_err(std::io::Error::other)?
            .as_nanos();
        Ok(Self {
            database: NativePath::from_path(&database),
            object: crate::infra::path_authority::opened_file_identity(&File::open(&database)?)?,
            revision,
            database_length: metadata.len(),
            database_modified_nanos,
        })
    }

    pub fn from_database_identity(
        identity: &super::repository::DatabaseIdentity,
    ) -> Result<Self, Error> {
        let database_modified_nanos = identity
            .modified
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .map_err(std::io::Error::other)?
            .as_nanos();
        Ok(Self {
            database: NativePath::from_path(&identity.path),
            object: identity.object,
            revision: identity.data_revision,
            database_length: identity.length,
            database_modified_nanos,
        })
    }
}

#[derive(Clone, Debug, Archive, Serialize, Deserialize)]
struct SearchArchive {
    source: IndexSource,
    index: SearchIndex,
}

impl SearchIndex {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            entries: Vec::with_capacity(capacity),
        }
    }

    pub fn push(&mut self, entry: SearchGameEntry) {
        self.entries.push(entry);
    }

    pub fn write_to<P: AsRef<Path>>(&self, path: P) -> Result<(), Error> {
        match self.write_to_with_source(path, IndexSource::default())? {
            AtomicFileOutcome::DurableCommit => Ok(()),
            AtomicFileOutcome::CommittedDurabilityUncertain(error) => {
                log::warn!("search index parent sync failed: {error}");
                Err(Error::CommittedDurabilityUncertain(
                    DurabilityStage::SearchIndexReplacement,
                ))
            }
        }
    }

    pub fn write_to_with_source<P: AsRef<Path>>(
        &self,
        path: P,
        source: IndexSource,
    ) -> Result<AtomicFileOutcome, Error> {
        let bytes = self.archive_bytes(source)?;
        atomic_replace(path.as_ref(), |file| write_archive(file, &bytes))
    }

    pub(crate) fn write_to_at(
        &self,
        parent: &File,
        leaf: &OsStr,
        source: IndexSource,
    ) -> Result<AtomicFileOutcome, Error> {
        let bytes = self.archive_bytes(source)?;
        atomic_replace_at(parent, leaf, |file| write_archive(file, &bytes))
    }

    fn archive_bytes(&self, source: IndexSource) -> Result<Vec<u8>, Error> {
        let archive = SearchArchive {
            source,
            index: self.clone(),
        };
        let bytes = rkyv::to_bytes::<rkyv::rancor::Error>(&archive)
            .map_err(|e| Error::InvalidInput(format!("search index serialization failed: {e}")))?;
        rkyv::access::<ArchivedSearchArchive, rkyv::rancor::Error>(&bytes).map_err(|error| {
            Error::InvalidInput(format!(
                "search index validation before publish failed: {error}"
            ))
        })?;
        Ok(bytes.to_vec())
    }
}

fn write_archive(file: &mut File, bytes: &[u8]) -> Result<(), Error> {
    file.write_all(MAGIC).map_err(Error::from)?;
    file.write_all(&VERSION.to_le_bytes())
        .map_err(Error::from)?;
    file.write_all(&[0; HEADER_SIZE - 8]).map_err(Error::from)?;
    file.write_all(bytes).map_err(Error::from)
}

impl Default for SearchIndex {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SearchGameEntryRef<'a> {
    pub id: i32,
    pub white_id: i32,
    pub black_id: i32,
    pub date: Option<&'a str>,
    pub result: GameResult,
    pub pawn_home: u16,
    pub white_material: u8,
    pub black_material: u8,
    pub white_elo: i16,
    pub black_elo: i16,
    pub fen: Option<&'a str>,
    pub moves: &'a [u8],
}

impl<'a> From<&'a SearchGameEntry> for SearchGameEntryRef<'a> {
    fn from(entry: &'a SearchGameEntry) -> Self {
        Self {
            id: entry.id,
            white_id: entry.white_id,
            black_id: entry.black_id,
            date: entry.date.as_deref(),
            result: entry.result,
            pawn_home: entry.pawn_home,
            white_material: entry.white_material,
            black_material: entry.black_material,
            white_elo: entry.white_elo,
            black_elo: entry.black_elo,
            fen: entry.fen.as_deref(),
            moves: &entry.moves,
        }
    }
}

impl<'a> From<&'a ArchivedSearchGameEntry> for SearchGameEntryRef<'a> {
    fn from(entry: &'a ArchivedSearchGameEntry) -> Self {
        Self {
            id: entry.id.into(),
            white_id: entry.white_id.into(),
            black_id: entry.black_id.into(),
            date: entry.date.as_ref().map(|date| date.as_str()),
            result: match entry.result {
                ArchivedGameResult::None => GameResult::None,
                ArchivedGameResult::WhiteWin => GameResult::WhiteWin,
                ArchivedGameResult::BlackWin => GameResult::BlackWin,
                ArchivedGameResult::Draw => GameResult::Draw,
                ArchivedGameResult::Other => GameResult::Other,
            },
            pawn_home: entry.pawn_home.into(),
            white_material: entry.white_material,
            black_material: entry.black_material,
            white_elo: entry.white_elo.into(),
            black_elo: entry.black_elo.into(),
            fen: entry.fen.as_ref().map(|fen| fen.as_str()),
            moves: &entry.moves,
        }
    }
}

pub struct SearchGameData {
    pub id: i32,
    pub white_id: i32,
    pub black_id: i32,
    pub date: Option<String>,
    pub result: Option<String>,
    pub moves: Vec<u8>,
    pub fen: Option<String>,
    pub pawn_home: i32,
    pub white_material: i32,
    pub black_material: i32,
    pub white_elo: Option<i32>,
    pub black_elo: Option<i32>,
}

impl SearchGameEntry {
    pub fn from_game_data(data: SearchGameData) -> Result<Self, Error> {
        crate::db::encoding::try_iter_mainline_move_bytes(&data.moves)?;
        Ok(Self {
            id: data.id,
            white_id: data.white_id,
            black_id: data.black_id,
            date: data.date,
            result: GameResult::from_str(data.result.as_deref()),
            pawn_home: u16::try_from(data.pawn_home).map_err(|_| {
                Error::InvalidInput(format!("pawn_home out of range: {}", data.pawn_home))
            })?,
            white_material: u8::try_from(data.white_material).map_err(|_| {
                Error::InvalidInput(format!(
                    "white_material out of range: {}",
                    data.white_material
                ))
            })?,
            black_material: u8::try_from(data.black_material).map_err(|_| {
                Error::InvalidInput(format!(
                    "black_material out of range: {}",
                    data.black_material
                ))
            })?,
            white_elo: i16::try_from(data.white_elo.unwrap_or(0)).map_err(|_| {
                Error::InvalidInput(format!("white_elo out of range: {:?}", data.white_elo))
            })?,
            black_elo: i16::try_from(data.black_elo.unwrap_or(0)).map_err(|_| {
                Error::InvalidInput(format!("black_elo out of range: {:?}", data.black_elo))
            })?,
            fen: data.fen,
            moves: data.moves,
        })
    }
}

#[derive(Clone)]
pub struct MmapSearchIndex {
    /// The mapping owns the bytes. Archive references are created only for an
    /// individual method call, never stored with a fabricated lifetime.
    mmap: Arc<Mmap>,
    entry_count: usize,
    source: IndexSource,
}

impl MmapSearchIndex {
    #[cfg(test)]
    pub fn open<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        Self::open_file(File::open(path)?)
    }

    pub(crate) fn open_file(file: File) -> io::Result<Self> {
        // `Mmap::map` is unsafe because callers must retain the mapping. This
        // type owns it, never exposes mutable bytes, and validates every rkyv
        // offset before any archive data is read.
        let mmap = Arc::new(unsafe { Mmap::map(&file)? });
        verify_header(&mmap)?;
        let entry_count = {
            let archived =
                rkyv::access::<ArchivedSearchArchive, rkyv::rancor::Error>(&mmap[HEADER_SIZE..])
                    .map_err(|error| {
                        io::Error::new(
                            io::ErrorKind::InvalidData,
                            format!("invalid search index archive: {error}"),
                        )
                    })?;
            archived.index.entries.len()
        };
        let source = rkyv::from_bytes::<SearchArchive, rkyv::rancor::Error>(&mmap[HEADER_SIZE..])
            .map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("invalid search index archive: {error}"),
                )
            })?
            .source;
        Ok(Self {
            mmap,
            entry_count,
            source,
        })
    }

    fn archived(&self) -> &ArchivedSearchArchive {
        // `open` fully validates this immutable mapping. The checked access is
        // repeated to keep the lifetime local and avoid self-referential state.
        rkyv::access::<ArchivedSearchArchive, rkyv::rancor::Error>(&self.mmap[HEADER_SIZE..])
            .expect("validated immutable search archive")
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.entry_count
    }

    pub fn source(&self) -> &IndexSource {
        &self.source
    }

    #[cfg(test)]
    #[inline]
    pub fn get_entry_ref(&self, index: usize) -> Option<SearchGameEntryRef<'_>> {
        self.archived()
            .index
            .entries
            .get(index)
            .map(SearchGameEntryRef::from)
    }

    #[cfg(test)]
    pub fn iter(&self) -> impl ExactSizeIterator + '_ {
        self.archived()
            .index
            .entries
            .iter()
            .map(SearchGameEntryRef::from)
    }

    pub fn par_iter(&self) -> impl ParallelIterator<Item = SearchGameEntryRef<'_>> + '_ {
        self.archived()
            .index
            .entries
            .par_iter()
            .map(SearchGameEntryRef::from)
    }

    #[cfg(test)]
    pub fn is_valid<P: AsRef<Path>>(path: P) -> bool {
        Self::open(path).is_ok()
    }
}

pub fn get_index_path(db_path: &Path) -> PathBuf {
    let filename = db_path
        .file_name()
        .map(preferred_sidecar_leaf)
        .unwrap_or_else(|| "database.ecsi".into());
    db_path.with_file_name(filename)
}

pub(crate) fn preferred_sidecar_leaf(database_leaf: &OsStr) -> OsString {
    let mut leaf = database_leaf.to_os_string();
    leaf.push(".ecsi");
    leaf
}

/// Pre-2.0 builds replaced the database extension (`foo.db3` → `foo.ecsi`).
/// Keep discovery separate from new writes, which always use `foo.db3.ecsi`
/// and therefore cannot collide with a database whose base name differs only
/// by extension.
pub fn legacy_index_path(db_path: &Path) -> PathBuf {
    let filename = db_path
        .file_name()
        .map(legacy_sidecar_leaf)
        .unwrap_or_else(|| "database.ecsi".into());
    db_path.with_file_name(filename)
}

pub(crate) fn legacy_sidecar_leaf(database_leaf: &OsStr) -> OsString {
    Path::new(database_leaf)
        .with_extension("ecsi")
        .into_os_string()
}

/// Promotes the pre-2.0 extension-replacing sidecar without ever overwriting
/// an appended sidecar. Only a validated V6 archive whose complete recorded
/// database provenance matches `db_path` is eligible. The new file is
/// atomically published and synced by `atomic_replace_at`; only then is the
/// legacy name removed. If both names are present, the appended name wins and
/// the legacy file is deliberately kept: it may belong to another database
/// with the same stem.
///
/// POSIX does not expose a pathname compare-and-unlink primitive. We retain
/// the opened legacy file and re-check its identity immediately before publish
/// and removal; an external rename in the final check-to-unlink window can
/// still replace that pathname. In that case provenance on every later load
/// forces regeneration, while this bounded filesystem race remains visible
/// rather than being misrepresented as atomic deletion.
#[cfg(test)]
pub fn promote_legacy_index_sidecar(db_path: &Path) -> Result<Option<PathBuf>, Error> {
    let database = db_path.canonicalize()?;
    let metadata = database.metadata()?;
    let object = crate::infra::path_authority::opened_file_identity(&File::open(&database)?)?;
    let identity = DatabaseIdentity {
        path: database.clone(),
        data_revision: 0,
        object,
        length: metadata.len(),
        modified: metadata.modified()?,
    };
    let (parent, database_leaf) = crate::infra::fs::open_verified_parent(&database, object, false)?;
    let preferred_leaf = preferred_sidecar_leaf(&database_leaf);
    let legacy_leaf = legacy_sidecar_leaf(&database_leaf);
    Ok(
        promote_legacy_index_sidecar_at(&parent, &preferred_leaf, &legacy_leaf, &identity)?
            .then(|| database.with_file_name(preferred_leaf)),
    )
}

#[cfg(unix)]
pub(crate) fn promote_legacy_index_sidecar_at(
    parent: &File,
    preferred_leaf: &OsStr,
    legacy_leaf: &OsStr,
    db_identity: &DatabaseIdentity,
) -> Result<bool, Error> {
    use rustix::{
        fs::{self as rfs, AtFlags, Mode, OFlags},
        io::Errno,
    };

    match rfs::statat(parent, preferred_leaf, AtFlags::SYMLINK_NOFOLLOW) {
        Ok(_) => return Ok(false),
        Err(error) if error == Errno::NOENT => {}
        Err(error) => return Err(Error::Io(Box::new(error.into()))),
    }
    let mut source = match rfs::openat(
        parent,
        legacy_leaf,
        OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
        Mode::empty(),
    ) {
        Ok(file) => File::from(file),
        Err(error) if error == Errno::NOENT || error == Errno::LOOP => return Ok(false),
        Err(error) => return Err(Error::Io(Box::new(error.into()))),
    };
    if !source.metadata()?.is_file() {
        return Ok(false);
    }
    let archive = match MmapSearchIndex::open_file(source.try_clone()?) {
        Ok(archive) => archive,
        Err(_) => return Ok(false),
    };
    let expected = IndexSource::from_database_identity(db_identity)?;
    if archive.source() != &expected {
        return Ok(false);
    }
    let legacy_object = crate::infra::path_authority::opened_file_identity(&source)?;
    let outcome = atomic_replace_at(parent, preferred_leaf, |destination| {
        legacy_file_identity_at(parent, legacy_leaf, legacy_object)?;
        let mut buffer = [0_u8; 64 * 1024];
        loop {
            let read = source.read(&mut buffer).map_err(Error::from)?;
            if read == 0 {
                break;
            }
            destination
                .write_all(&buffer[..read])
                .map_err(Error::from)?;
        }
        Ok(())
    })?;
    match outcome {
        AtomicFileOutcome::DurableCommit => {
            legacy_file_identity_at(parent, legacy_leaf, legacy_object)?;
            remove_optional_regular_at(parent, legacy_leaf)?;
            Ok(true)
        }
        AtomicFileOutcome::CommittedDurabilityUncertain(error) => {
            log::warn!("search index parent sync failed: {error}");
            Err(Error::CommittedDurabilityUncertain(
                DurabilityStage::SearchIndexReplacement,
            ))
        }
    }
}

#[cfg(unix)]
fn legacy_file_identity_at(
    parent: &File,
    leaf: &OsStr,
    expected: (u64, u64),
) -> Result<(u64, u64), Error> {
    use rustix::fs::{self as rfs, AtFlags, FileType};
    let stat = rfs::statat(parent, leaf, AtFlags::SYMLINK_NOFOLLOW)
        .map_err(|error| Error::Io(Box::new(error.into())))?;
    if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
        return Err(Error::Conflict(
            "legacy search sidecar changed during promotion".into(),
        ));
    }
    let identity = (stat.st_dev, stat.st_ino);
    if identity != expected {
        return Err(Error::Conflict(
            "legacy search sidecar changed during promotion".into(),
        ));
    }
    Ok(identity)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::fs::{
        open_verified_parent, set_test_atomic_file_injector, AtomicFileFaultPoint,
        AtomicWriterInjector,
    };
    use tempfile::tempdir;

    struct ParentSyncFailure;
    impl AtomicWriterInjector for ParentSyncFailure {
        fn inject(&self, point: AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == AtomicFileFaultPoint::ParentSync {
                Err(std::io::Error::other("injected parent sync failure"))
            } else {
                Ok(())
            }
        }
    }

    #[test]
    fn test_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.ecsi");

        // Create test entries
        let entries = vec![
            SearchGameEntry {
                id: 1,
                white_id: 100,
                black_id: 200,
                date: Some("2024.01.15".to_string()),
                result: GameResult::WhiteWin,
                pawn_home: 0xFFFF,
                white_material: 39,
                black_material: 39,
                white_elo: 2700,
                black_elo: 2650,
                fen: None,
                moves: vec![12, 12, 9, 9], // e4 e5 Nf3 Nc6
            },
            SearchGameEntry {
                id: 2,
                white_id: 150,
                black_id: 250,
                date: None,
                result: GameResult::Draw,
                pawn_home: 0xF0F0,
                white_material: 30,
                black_material: 28,
                white_elo: 0,
                black_elo: 2400,
                fen: Some(
                    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2".to_string(),
                ),
                moves: vec![15, 10],
            },
        ];

        // Write
        let index = SearchIndex {
            entries: entries.clone(),
        };
        index.write_to(&path).unwrap();

        // Verify valid
        assert!(MmapSearchIndex::is_valid(&path));

        // Read back using mmap
        let index = MmapSearchIndex::open(&path).unwrap();
        assert_eq!(index.len(), entries.len());

        for (i, original) in entries.iter().enumerate() {
            let loaded = index.get_entry_ref(i).unwrap();
            assert_eq!(loaded.id, original.id);
            assert_eq!(loaded.white_id, original.white_id);
            assert_eq!(loaded.black_id, original.black_id);
            assert_eq!(loaded.result, original.result);
            assert_eq!(loaded.pawn_home, original.pawn_home);
            assert_eq!(loaded.white_material, original.white_material);
            assert_eq!(loaded.black_material, original.black_material);
            assert_eq!(loaded.fen, original.fen.as_deref());
            assert_eq!(loaded.moves, original.moves);
        }

        // Test iterator
        let loaded_vec: Vec<_> = index.iter().collect();
        assert_eq!(loaded_vec.len(), entries.len());
    }

    #[test]
    fn test_game_result_encoding() {
        assert_eq!(GameResult::from_str(Some("1-0")), GameResult::WhiteWin);
        assert_eq!(GameResult::from_str(Some("0-1")), GameResult::BlackWin);
        assert_eq!(GameResult::from_str(Some("1/2-1/2")), GameResult::Draw);
        assert_eq!(GameResult::from_str(Some("*")), GameResult::Other);
        assert_eq!(GameResult::from_str(None), GameResult::None);

        assert_eq!(GameResult::WhiteWin.to_str(), Some("1-0"));
        assert_eq!(GameResult::BlackWin.to_str(), Some("0-1"));
        assert_eq!(GameResult::Draw.to_str(), Some("1/2-1/2"));
        assert_eq!(GameResult::None.to_str(), None);
    }

    #[test]
    fn test_large_index() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("large.ecsi");

        let results = [
            GameResult::None,
            GameResult::WhiteWin,
            GameResult::BlackWin,
            GameResult::Draw,
            GameResult::Other,
        ];

        // Create many entries
        let mut index = SearchIndex::with_capacity(1000);
        for i in 0..1000 {
            index.push(SearchGameEntry {
                id: i,
                white_id: i * 2,
                black_id: i * 2 + 1,
                date: if i % 2 == 0 {
                    Some("2024.01.15".to_string())
                } else {
                    None
                },
                result: results[(i % 5) as usize],
                pawn_home: 0xFFFF,
                white_material: 39,
                black_material: 39,
                white_elo: 2000 + (i % 800) as i16,
                black_elo: 1900 + (i % 700) as i16,
                fen: if i % 3 == 0 {
                    Some("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1".to_string())
                } else {
                    None
                },
                moves: vec![12, 12, 9, 9],
            });
        }
        index.write_to(&path).unwrap();

        // Load with mmap
        let index = MmapSearchIndex::open(&path).unwrap();
        assert_eq!(index.len(), 1000);

        // Verify random access
        let entry = index.get_entry_ref(500).unwrap();
        assert_eq!(entry.id, 500);
        assert_eq!(entry.white_id, 1000);
        assert_eq!(entry.black_id, 1001);
    }

    #[test]
    fn test_parallel_iteration() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("parallel.ecsi");

        let mut index = SearchIndex::with_capacity(100);
        for i in 0..100 {
            index.push(SearchGameEntry {
                id: i,
                white_id: i,
                black_id: i,
                date: None,
                result: GameResult::None,
                pawn_home: 0,
                white_material: 0,
                black_material: 0,
                white_elo: 0,
                black_elo: 0,
                fen: None,
                moves: vec![],
            });
        }
        index.write_to(&path).unwrap();

        let mmap_index = MmapSearchIndex::open(&path).unwrap();

        // Test parallel iteration
        let sum: i32 = mmap_index.par_iter().map(|e| e.id).sum();
        assert_eq!(sum, (0..100i32).sum::<i32>());
    }

    #[test]
    fn rejects_truncated_or_corrupt_archives() {
        let dir = tempdir().unwrap();
        let truncated = dir.path().join("truncated.ecsi");
        std::fs::write(
            &truncated,
            [MAGIC.as_slice(), &VERSION.to_le_bytes()].concat(),
        )
        .unwrap();
        let error = MmapSearchIndex::open(&truncated)
            .err()
            .expect("truncated archive must fail");
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);

        let corrupt = dir.path().join("corrupt.ecsi");
        std::fs::write(
            &corrupt,
            [MAGIC.as_slice(), &VERSION.to_le_bytes(), &[0xff; 32]].concat(),
        )
        .unwrap();
        let error = MmapSearchIndex::open(&corrupt)
            .err()
            .expect("corrupt archive must fail");
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(!MmapSearchIndex::is_valid(&corrupt));
    }

    #[test]
    fn rejects_out_of_range_database_values() {
        let error = SearchGameEntry::from_game_data(SearchGameData {
            id: 1,
            white_id: 2,
            black_id: 3,
            date: None,
            result: None,
            moves: vec![],
            fen: None,
            pawn_home: -1,
            white_material: 39,
            black_material: 39,
            white_elo: Some(2_000),
            black_elo: Some(2_000),
        })
        .unwrap_err();
        assert!(matches!(error, Error::InvalidInput(_)));
    }

    #[test]
    fn atomic_write_never_leaves_a_partial_replacement() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("atomic.ecsi");
        let first = SearchIndex::default();
        first.write_to(&path).unwrap();
        let second = SearchIndex::with_capacity(1);
        second.write_to(&path).unwrap();
        assert!(MmapSearchIndex::is_valid(&path));
    }

    #[test]
    fn sidecar_appends_instead_of_replacing_database_extension() {
        let database = Path::new("/tmp/opening.db3");
        assert_eq!(
            get_index_path(database),
            PathBuf::from("/tmp/opening.db3.ecsi")
        );
        assert_eq!(
            legacy_index_path(database),
            PathBuf::from("/tmp/opening.ecsi")
        );
        assert_ne!(
            get_index_path(Path::new("/tmp/opening.db")),
            get_index_path(database)
        );
    }

    #[test]
    fn legacy_sidecar_is_atomically_promoted_without_overwriting_a_collision() {
        let dir = tempdir().unwrap();
        let database = dir.path().join("games.db3");
        std::fs::write(&database, b"database").unwrap();
        let legacy = legacy_index_path(&database);
        let source = IndexSource::from_database(&database, 0).unwrap();
        SearchIndex::default()
            .write_to_with_source(&legacy, source)
            .unwrap();
        let preferred = get_index_path(&database);
        assert_eq!(
            promote_legacy_index_sidecar(&database).unwrap(),
            Some(preferred.clone())
        );
        assert!(MmapSearchIndex::open(&preferred).is_ok());
        assert!(!legacy.exists());

        let collision_database = dir.path().join("other.db3");
        std::fs::write(&collision_database, b"database").unwrap();
        let collision_legacy = legacy_index_path(&collision_database);
        let collision_preferred = get_index_path(&collision_database);
        SearchIndex::default()
            .write_to_with_source(
                &collision_legacy,
                IndexSource::from_database(&collision_database, 0).unwrap(),
            )
            .unwrap();
        std::fs::write(&collision_preferred, b"preferred").unwrap();
        assert_eq!(
            promote_legacy_index_sidecar(&collision_database).unwrap(),
            None
        );
        assert_eq!(std::fs::read(&collision_preferred).unwrap(), b"preferred");
        assert!(collision_legacy.exists());
    }

    #[cfg(unix)]
    #[test]
    fn search_index_promotion_parent_sync_keeps_legacy_sidecar() {
        let dir = tempdir().unwrap();
        let database = dir.path().join("uncertain.db3");
        std::fs::write(&database, b"database").unwrap();
        let metadata = database.metadata().unwrap();
        let object =
            crate::infra::path_authority::opened_file_identity(&File::open(&database).unwrap())
                .unwrap();
        let identity = DatabaseIdentity {
            path: database.clone(),
            data_revision: 0,
            object,
            length: metadata.len(),
            modified: metadata.modified().unwrap(),
        };
        let legacy = legacy_index_path(&database);
        SearchIndex::default()
            .write_to_with_source(
                &legacy,
                IndexSource::from_database_identity(&identity).unwrap(),
            )
            .unwrap();
        let (parent, database_leaf) = open_verified_parent(&database, object, false).unwrap();
        let preferred_leaf = preferred_sidecar_leaf(&database_leaf);
        let legacy_leaf = legacy_sidecar_leaf(&database_leaf);

        set_test_atomic_file_injector(Some(Arc::new(ParentSyncFailure)));
        let result =
            promote_legacy_index_sidecar_at(&parent, &preferred_leaf, &legacy_leaf, &identity);
        set_test_atomic_file_injector(None);

        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                DurabilityStage::SearchIndexReplacement
            ))
        ));
        assert!(database.with_file_name(preferred_leaf).exists());
        assert!(legacy.exists());
    }

    #[test]
    fn search_index_write_to_reports_uncertain_parent_sync() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("uncertain.ecsi");
        set_test_atomic_file_injector(Some(Arc::new(ParentSyncFailure)));
        let result = SearchIndex::default().write_to(&path);
        set_test_atomic_file_injector(None);

        assert!(matches!(
            result,
            Err(Error::CommittedDurabilityUncertain(
                DurabilityStage::SearchIndexReplacement
            ))
        ));
        assert!(path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn search_index_write_to_at_refuses_substituted_symlink() {
        use std::os::unix::fs::symlink;

        let dir = tempdir().unwrap();
        let outside = dir.path().join("outside");
        std::fs::write(&outside, b"outside").unwrap();
        let parent = File::open(dir.path()).unwrap();
        let leaf = OsStr::new("database.db3.ecsi");
        symlink(&outside, dir.path().join(leaf)).unwrap();

        let result = SearchIndex::default().write_to_at(&parent, leaf, IndexSource::default());
        assert!(matches!(result, Err(Error::InvalidInput(_))));
        assert_eq!(std::fs::read(&outside).unwrap(), b"outside");
    }

    #[test]
    fn same_stem_legacy_sidecar_is_not_promoted_for_another_database_object() {
        let dir = tempdir().unwrap();
        let db3 = dir.path().join("foo.db3");
        let sqlite = dir.path().join("foo.sqlite");
        std::fs::write(&db3, b"db3").unwrap();
        std::fs::write(&sqlite, b"sqlite").unwrap();
        let shared_legacy = legacy_index_path(&db3);
        assert_eq!(shared_legacy, legacy_index_path(&sqlite));
        SearchIndex::default()
            .write_to_with_source(&shared_legacy, IndexSource::from_database(&db3, 0).unwrap())
            .unwrap();

        assert_eq!(promote_legacy_index_sidecar(&sqlite).unwrap(), None);
        assert!(shared_legacy.exists());
        assert!(!get_index_path(&sqlite).exists());
    }

    #[test]
    fn promote_skips_a_legacy_directory_and_unreadable_bytes() {
        let dir = tempdir().unwrap();
        let database = dir.path().join("games.db3");
        std::fs::write(&database, b"database").unwrap();
        let legacy = legacy_index_path(&database);
        std::fs::create_dir(&legacy).unwrap();
        assert_eq!(promote_legacy_index_sidecar(&database).unwrap(), None);
        std::fs::remove_dir(&legacy).unwrap();
        std::fs::write(&legacy, b"not an archive").unwrap();
        assert_eq!(promote_legacy_index_sidecar(&database).unwrap(), None);
        assert!(legacy.exists());
        assert!(!get_index_path(&database).exists());
    }

    #[test]
    fn unprovenanced_legacy_sidecar_is_left_for_regeneration() {
        let dir = tempdir().unwrap();
        let database = dir.path().join("old.db3");
        std::fs::write(&database, b"database").unwrap();
        let legacy = legacy_index_path(&database);
        std::fs::write(&legacy, b"pre-v5 archive").unwrap();
        assert_eq!(promote_legacy_index_sidecar(&database).unwrap(), None);
        assert!(legacy.exists());
        assert!(!get_index_path(&database).exists());
    }

    #[test]
    fn archive_source_roundtrips_with_the_index() {
        let dir = tempdir().unwrap();
        let database = dir.path().join("source.db3");
        std::fs::write(&database, b"database").unwrap();
        let source = IndexSource::from_database(&database, 9).unwrap();
        let path = get_index_path(&database);
        SearchIndex::default()
            .write_to_with_source(&path, source.clone())
            .unwrap();
        assert_eq!(MmapSearchIndex::open(&path).unwrap().source(), &source);
    }

    #[test]
    fn replacement_database_has_a_distinct_object_identity() {
        let dir = tempdir().unwrap();
        let database = dir.path().join("replacement.db3");
        let replacement = dir.path().join("replacement.tmp");
        std::fs::write(&database, b"same-size").unwrap();
        let before = IndexSource::from_database(&database, 0).unwrap();
        std::fs::write(&replacement, b"same-size").unwrap();
        std::fs::rename(&replacement, &database).unwrap();
        let after = IndexSource::from_database(&database, 0).unwrap();
        assert_eq!(before.database_length, after.database_length);
        assert_ne!(before.object, after.object);
        assert_ne!(before, after);
    }

    #[cfg(unix)]
    #[test]
    fn non_utf8_database_paths_have_distinct_archived_provenance() {
        use std::{ffi::OsString, os::unix::ffi::OsStringExt};

        let dir = tempdir().unwrap();
        let first_database = dir
            .path()
            .join(OsString::from_vec(b"source-\x80.db3".to_vec()));
        let second_database = dir
            .path()
            .join(OsString::from_vec(b"source-\x81.db3".to_vec()));
        std::fs::write(&first_database, b"first database").unwrap();
        std::fs::write(&second_database, b"second database").unwrap();

        assert_eq!(
            first_database.to_string_lossy(),
            second_database.to_string_lossy(),
            "the former string representation would have collided"
        );

        let first_source = IndexSource::from_database(&first_database, 7).unwrap();
        let second_source = IndexSource::from_database(&second_database, 7).unwrap();
        assert_ne!(first_source.database, second_source.database);
        assert_ne!(first_source, second_source);

        let first_index = get_index_path(&first_database);
        let second_index = get_index_path(&second_database);
        SearchIndex::default()
            .write_to_with_source(&first_index, first_source.clone())
            .unwrap();
        SearchIndex::default()
            .write_to_with_source(&second_index, second_source.clone())
            .unwrap();

        assert_eq!(
            MmapSearchIndex::open(first_index).unwrap().source(),
            &first_source
        );
        assert_eq!(
            MmapSearchIndex::open(second_index).unwrap().source(),
            &second_source
        );
    }
}
