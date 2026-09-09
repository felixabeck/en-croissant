use std::{
    ffi::{OsStr, OsString},
    fs::File,
    io::{self, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::Arc,
};

use memmap2::Mmap;
use rayon::prelude::*;
use rkyv::{Archive, Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

use crate::{
    db::DatabaseIdentity,
    error::{DurabilityStage, Error},
    infra::fs::{atomic_replace_at, remove_optional_regular_at, AtomicFileOutcome},
};

// Only the test-only helpers below still replace an index by pathname; production
// writes go through the descriptor-relative `atomic_replace_at`.
#[cfg(test)]
use crate::infra::fs::atomic_replace;

const MAGIC: &[u8; 4] = b"ECSI";
const VERSION: u32 = 7;
const ARCHIVE_ALIGNMENT: usize = 16;
const HEADER_SIZE: usize = 32;
const CHUNK_HEADER_SIZE: usize = 16;
// Native paths are normally at most tens of KiB. This leaves ample room for
// platform encodings while preventing corrupt provenance from driving a large allocation.
const MAX_SOURCE_BYTES: usize = 1024 * 1024;
pub(crate) const CHUNK_ENTRY_LIMIT: usize = 4_096;
pub(crate) const CHUNK_PAYLOAD_TARGET_BYTES: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone, Copy)]
struct ArchiveHeader {
    source_len: usize,
    entry_count: usize,
    chunk_count: usize,
}

fn invalid_data(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.into())
}

fn read_u64(bytes: &[u8], offset: usize, name: &str) -> io::Result<u64> {
    let end = offset
        .checked_add(8)
        .ok_or_else(|| invalid_data(format!("{name} offset overflow")))?;
    let value = bytes
        .get(offset..end)
        .ok_or_else(|| invalid_data(format!("missing {name}")))?;
    Ok(u64::from_le_bytes(
        value
            .try_into()
            .map_err(|_| invalid_data(format!("invalid {name}")))?,
    ))
}

fn checked_usize(value: u64, name: &str) -> io::Result<usize> {
    usize::try_from(value).map_err(|_| invalid_data(format!("{name} exceeds platform limits")))
}

fn align_up(offset: usize) -> io::Result<usize> {
    offset
        .checked_add(ARCHIVE_ALIGNMENT - 1)
        .map(|value| value & !(ARCHIVE_ALIGNMENT - 1))
        .ok_or_else(|| invalid_data("archive offset overflow"))
}

fn verify_header(header: &[u8]) -> io::Result<ArchiveHeader> {
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

    let version = u32::from_le_bytes(
        header[4..8]
            .try_into()
            .map_err(|_| invalid_data("invalid version field"))?,
    );
    if version != VERSION {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Unsupported version: {} (expected {})", version, VERSION),
        ));
    }

    Ok(ArchiveHeader {
        source_len: checked_usize(read_u64(header, 8, "source length")?, "source length")?,
        entry_count: checked_usize(read_u64(header, 16, "entry count")?, "entry count")?,
        chunk_count: checked_usize(read_u64(header, 24, "chunk count")?, "chunk count")?,
    })
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
pub struct SearchIndexChunk {
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
    #[cfg(test)]
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

#[cfg(test)]
impl SearchIndexChunk {
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
        crate::infra::fs::require_durable(
            self.write_to_with_source(path, IndexSource::default())?,
            DurabilityStage::SearchIndexReplacement,
        )
    }

    pub fn write_to_with_source<P: AsRef<Path>>(
        &self,
        path: P,
        source: IndexSource,
    ) -> Result<AtomicFileOutcome, Error> {
        atomic_replace(path.as_ref(), |file| {
            write_chunked_archive(file, source, self.entries.iter().cloned().map(Ok))
        })
    }
}

pub(crate) fn write_entries_to_at<I>(
    parent: &File,
    leaf: &OsStr,
    source: IndexSource,
    entries: I,
    cancellation: &CancellationToken,
) -> Result<AtomicFileOutcome, Error>
where
    I: IntoIterator<Item = Result<SearchGameEntry, Error>>,
{
    atomic_replace_at(parent, leaf, |file| {
        let mut entries = entries.into_iter();
        write_chunked_archive_cancellable(file, source, &mut entries, cancellation)
    })
}

fn write_header<W: Write + ?Sized>(
    file: &mut W,
    source_len: u64,
    entry_count: u64,
    chunk_count: u64,
) -> Result<(), Error> {
    file.write_all(MAGIC).map_err(Error::from)?;
    file.write_all(&VERSION.to_le_bytes())
        .map_err(Error::from)?;
    file.write_all(&source_len.to_le_bytes())?;
    file.write_all(&entry_count.to_le_bytes())?;
    file.write_all(&chunk_count.to_le_bytes())?;
    Ok(())
}

fn write_padding<W: Write + ?Sized>(file: &mut W, position: usize) -> Result<usize, Error> {
    let aligned = align_up(position).map_err(Error::from)?;
    file.write_all(&[0; ARCHIVE_ALIGNMENT][..aligned - position])?;
    Ok(aligned)
}

fn estimated_entry_bytes(entry: &SearchGameEntry) -> usize {
    std::mem::size_of::<SearchGameEntry>()
        .saturating_add(entry.date.as_ref().map_or(0, String::len))
        .saturating_add(entry.fen.as_ref().map_or(0, String::len))
        .saturating_add(entry.moves.len())
}

fn write_chunk<W: Write + ?Sized>(
    file: &mut W,
    entries: &mut Vec<SearchGameEntry>,
    cancellation: &CancellationToken,
) -> Result<u64, Error> {
    for entry in entries.iter() {
        crate::db::encoding::try_iter_mainline_move_bytes_cancellable(&entry.moves, cancellation)?;
    }
    let index = SearchIndexChunk {
        entries: std::mem::take(entries),
    };
    let bytes = rkyv::to_bytes::<rkyv::rancor::Error>(&index).map_err(|error| {
        Error::InvalidInput(format!("search index serialization failed: {error}"))
    })?;
    rkyv::access::<ArchivedSearchIndexChunk, rkyv::rancor::Error>(&bytes).map_err(|error| {
        Error::InvalidInput(format!(
            "search index validation before publish failed: {error}"
        ))
    })?;
    let payload_len = u64::try_from(bytes.len())
        .map_err(|_| Error::ResourceLimit("search index chunk is too large".into()))?;
    let entry_count = u64::try_from(index.entries.len())
        .map_err(|_| Error::ResourceLimit("search index chunk has too many entries".into()))?;
    file.write_all(&payload_len.to_le_bytes())?;
    file.write_all(&entry_count.to_le_bytes())?;
    file.write_all(&bytes)?;
    Ok(entry_count)
}

#[cfg(test)]
fn write_chunked_archive<W, I>(file: &mut W, source: IndexSource, entries: I) -> Result<(), Error>
where
    W: Write + Seek,
    I: IntoIterator<Item = Result<SearchGameEntry, Error>>,
{
    let mut entries = entries.into_iter();
    write_chunked_archive_cancellable(file, source, &mut entries, &CancellationToken::new())
}

trait WriteSeek: Write + Seek {}

impl<W: Write + Seek + ?Sized> WriteSeek for W {}

fn write_chunked_archive_cancellable(
    file: &mut dyn WriteSeek,
    source: IndexSource,
    entries: &mut dyn Iterator<Item = Result<SearchGameEntry, Error>>,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let source_bytes = rkyv::to_bytes::<rkyv::rancor::Error>(&source).map_err(|error| {
        Error::InvalidInput(format!("index source serialization failed: {error}"))
    })?;
    rkyv::access::<ArchivedIndexSource, rkyv::rancor::Error>(&source_bytes).map_err(|error| {
        Error::InvalidInput(format!(
            "index source validation before publish failed: {error}"
        ))
    })?;
    let source_len = u64::try_from(source_bytes.len())
        .map_err(|_| Error::ResourceLimit("search index source is too large".into()))?;
    if source_bytes.len() > MAX_SOURCE_BYTES {
        return Err(Error::ResourceLimit(
            "search index source exceeds the metadata limit".into(),
        ));
    }
    if !source_bytes.len().is_multiple_of(ARCHIVE_ALIGNMENT) {
        return Err(Error::InvalidInput(
            "serialized index source has invalid alignment".into(),
        ));
    }
    write_header(file, source_len, 0, 0)?;
    file.write_all(&source_bytes)?;

    let mut chunk = Vec::with_capacity(CHUNK_ENTRY_LIMIT);
    let mut estimated_bytes = 0_usize;
    let mut total_entries = 0_u64;
    let mut chunk_count = 0_u64;
    for entry in entries {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let entry = entry?;
        crate::db::encoding::try_iter_mainline_move_bytes_cancellable(&entry.moves, cancellation)?;
        let entry_bytes = estimated_entry_bytes(&entry);
        if !chunk.is_empty()
            && (chunk.len() >= CHUNK_ENTRY_LIMIT
                || estimated_bytes.saturating_add(entry_bytes) > CHUNK_PAYLOAD_TARGET_BYTES)
        {
            if cancellation.is_cancelled() {
                return Err(Error::Cancellation);
            }
            total_entries = total_entries
                .checked_add(write_chunk(file, &mut chunk, cancellation)?)
                .ok_or_else(|| Error::ResourceLimit("search index entry count overflow".into()))?;
            chunk_count = chunk_count
                .checked_add(1)
                .ok_or_else(|| Error::ResourceLimit("search index chunk count overflow".into()))?;
            let position = usize::try_from(file.stream_position()?)
                .map_err(|_| Error::ResourceLimit("search index position overflow".into()))?;
            let _ = write_padding(file, position)?;
            estimated_bytes = 0;
        }
        estimated_bytes = estimated_bytes.saturating_add(entry_bytes);
        chunk.push(entry);
    }
    if !chunk.is_empty() {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        total_entries = total_entries
            .checked_add(write_chunk(file, &mut chunk, cancellation)?)
            .ok_or_else(|| Error::ResourceLimit("search index entry count overflow".into()))?;
        chunk_count = chunk_count
            .checked_add(1)
            .ok_or_else(|| Error::ResourceLimit("search index chunk count overflow".into()))?;
        let position = usize::try_from(file.stream_position()?)
            .map_err(|_| Error::ResourceLimit("search index position overflow".into()))?;
        let _ = write_padding(file, position)?;
    }
    file.seek(SeekFrom::Start(0))?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    write_header(file, source_len, total_entries, chunk_count)?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    Ok(())
}

#[cfg(test)]
impl Default for SearchIndexChunk {
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
        Self::from_game_data_cancellable(data, &CancellationToken::new())
    }

    pub(crate) fn from_game_data_cancellable(
        data: SearchGameData,
        cancellation: &CancellationToken,
    ) -> Result<Self, Error> {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        crate::db::encoding::try_iter_mainline_move_bytes_cancellable(&data.moves, cancellation)?;
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

#[derive(Clone, Debug)]
pub struct MmapSearchIndex {
    /// The mapping owns the bytes. Archive references are created only for an
    /// individual method call, never stored with a fabricated lifetime.
    mmap: Arc<Mmap>,
    entry_count: usize,
    source: IndexSource,
    chunks: Arc<[ChunkMetadata]>,
}

#[derive(Clone, Debug)]
struct ChunkMetadata {
    payload_offset: usize,
    payload_len: usize,
    #[cfg(test)]
    first_entry: usize,
    entry_count: usize,
}

impl MmapSearchIndex {
    #[cfg(test)]
    pub fn open<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        Self::open_file(File::open(path)?)
    }

    pub(crate) fn open_file(file: File) -> io::Result<Self> {
        Self::open_file_inner(file, None)
    }

    pub(crate) fn open_file_cancellable(
        file: File,
        cancellation: &CancellationToken,
    ) -> Result<Self, Error> {
        Self::open_file_inner(file, Some(cancellation)).map_err(|error| {
            if error.kind() == io::ErrorKind::Interrupted && cancellation.is_cancelled() {
                Error::Cancellation
            } else {
                Error::from(error)
            }
        })
    }

    fn open_file_inner(file: File, cancellation: Option<&CancellationToken>) -> io::Result<Self> {
        let check = || {
            if cancellation.is_some_and(CancellationToken::is_cancelled) {
                Err(io::Error::new(io::ErrorKind::Interrupted, "cancelled"))
            } else {
                Ok(())
            }
        };
        check()?;
        let file_len = checked_usize(file.metadata()?.len(), "archive file length")?;
        if file_len < HEADER_SIZE {
            return Err(invalid_data("File too small for header"));
        }
        // `Mmap::map` is unsafe because callers must retain the mapping. This
        // type owns it, never exposes mutable bytes, and validates every rkyv
        // offset before any archive data is read.
        let mmap = Arc::new(unsafe { Mmap::map(&file)? });
        let header = verify_header(&mmap)?;
        if header.source_len > MAX_SOURCE_BYTES {
            return Err(invalid_data("index source exceeds the metadata limit"));
        }
        if !header.source_len.is_multiple_of(ARCHIVE_ALIGNMENT) {
            return Err(invalid_data("misaligned index source length"));
        }
        let source_end = HEADER_SIZE
            .checked_add(header.source_len)
            .ok_or_else(|| invalid_data("source bounds overflow"))?;
        let source_bytes = mmap
            .get(HEADER_SIZE..source_end)
            .ok_or_else(|| invalid_data("truncated index source"))?;
        if !(source_bytes.as_ptr() as usize).is_multiple_of(ARCHIVE_ALIGNMENT) {
            return Err(invalid_data("misaligned index source"));
        }
        let source = rkyv::from_bytes::<IndexSource, rkyv::rancor::Error>(source_bytes)
            .map_err(|error| invalid_data(format!("invalid index source archive: {error}")))?;

        let mut cursor = source_end;
        let minimum_chunk_bytes = CHUNK_HEADER_SIZE + ARCHIVE_ALIGNMENT;
        if header.chunk_count > mmap.len().saturating_sub(cursor) / minimum_chunk_bytes + 1 {
            return Err(invalid_data("declared chunk count exceeds archive bounds"));
        }
        let mut chunks = Vec::new();
        let mut counted_entries = 0_usize;
        for _ in 0..header.chunk_count {
            check()?;
            if cursor % ARCHIVE_ALIGNMENT != 0 {
                return Err(invalid_data("misaligned chunk header"));
            }
            let payload_len = checked_usize(
                read_u64(&mmap, cursor, "chunk payload length")?,
                "chunk payload length",
            )?;
            let entry_count_offset = cursor
                .checked_add(8)
                .ok_or_else(|| invalid_data("chunk entry-count offset overflow"))?;
            let entry_count = checked_usize(
                read_u64(&mmap, entry_count_offset, "chunk entry count")?,
                "chunk entry count",
            )?;
            if payload_len == 0 || entry_count == 0 || entry_count > CHUNK_ENTRY_LIMIT {
                return Err(invalid_data("invalid chunk length or entry count"));
            }
            let payload_offset = cursor
                .checked_add(CHUNK_HEADER_SIZE)
                .ok_or_else(|| invalid_data("chunk payload offset overflow"))?;
            if payload_offset % ARCHIVE_ALIGNMENT != 0 {
                return Err(invalid_data("misaligned chunk payload"));
            }
            let payload_end = payload_offset
                .checked_add(payload_len)
                .ok_or_else(|| invalid_data("chunk payload bounds overflow"))?;
            let payload = mmap
                .get(payload_offset..payload_end)
                .ok_or_else(|| invalid_data("truncated search index chunk"))?;
            if !(payload.as_ptr() as usize).is_multiple_of(ARCHIVE_ALIGNMENT) {
                return Err(invalid_data("misaligned search index chunk"));
            }
            let archived = rkyv::access::<ArchivedSearchIndexChunk, rkyv::rancor::Error>(payload)
                .map_err(|error| {
                invalid_data(format!("invalid search index chunk: {error}"))
            })?;
            if archived.entries.len() != entry_count {
                return Err(invalid_data("chunk entry count does not match payload"));
            }
            for entry in archived.entries.iter() {
                check()?;
                let validation = match cancellation {
                    Some(cancellation) => {
                        crate::db::encoding::try_iter_mainline_move_bytes_cancellable(
                            entry.moves.as_slice(),
                            cancellation,
                        )
                        .map(|_| ())
                    }
                    None => {
                        crate::db::encoding::try_iter_mainline_move_bytes(entry.moves.as_slice())
                            .map(|_| ())
                    }
                };
                validation.map_err(|error| match error {
                    Error::Cancellation => {
                        io::Error::new(io::ErrorKind::Interrupted, "search index open cancelled")
                    }
                    error => invalid_data(format!("invalid move stream: {error}")),
                })?;
            }
            chunks.push(ChunkMetadata {
                payload_offset,
                payload_len,
                #[cfg(test)]
                first_entry: counted_entries,
                entry_count,
            });
            counted_entries = counted_entries
                .checked_add(entry_count)
                .ok_or_else(|| invalid_data("total entry count overflow"))?;
            cursor = align_up(payload_end)?;
            let padding = mmap
                .get(payload_end..cursor)
                .ok_or_else(|| invalid_data("truncated chunk padding"))?;
            if padding.iter().any(|byte| *byte != 0) {
                return Err(invalid_data("non-zero chunk padding"));
            }
        }
        if counted_entries != header.entry_count {
            return Err(invalid_data("total entry count does not match chunks"));
        }
        if cursor != mmap.len() {
            return Err(invalid_data("trailing bytes after search index chunks"));
        }
        Ok(Self {
            mmap,
            entry_count: header.entry_count,
            source,
            chunks: chunks.into(),
        })
    }

    fn archived_chunk(&self, chunk: &ChunkMetadata) -> &ArchivedSearchIndexChunk {
        // `open` fully validates this immutable mapping. The checked access is
        // repeated to keep the lifetime local and avoid self-referential state.
        rkyv::access::<ArchivedSearchIndexChunk, rkyv::rancor::Error>(
            &self.mmap[chunk.payload_offset..chunk.payload_offset + chunk.payload_len],
        )
        .expect("validated immutable search archive")
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.entry_count
    }

    pub fn source(&self) -> &IndexSource {
        &self.source
    }

    // The mapping's borrow remains local to this test-facing accessor.
    #[cfg(test)]
    #[inline]
    pub fn get_entry_ref(&self, index: usize) -> Option<SearchGameEntryRef<'_>> {
        let chunk = self.chunks.iter().find(|chunk| {
            chunk
                .first_entry
                .checked_add(chunk.entry_count)
                .is_some_and(|end| index < end)
        })?;
        self.archived_chunk(chunk)
            .entries
            .get(index - chunk.first_entry)
            .map(SearchGameEntryRef::from)
    }

    // The caller's reference remains tied to the immutable mapping.
    #[cfg(test)]
    pub fn iter(&self) -> SearchIndexIter<'_> {
        SearchIndexIter {
            index: self,
            next: 0,
        }
    }

    pub fn par_iter(&self) -> impl ParallelIterator<Item = SearchGameEntryRef<'_>> + '_ {
        self.chunks.par_iter().flat_map_iter(|chunk| {
            self.archived_chunk(chunk)
                .entries
                .iter()
                .take(chunk.entry_count)
                .map(SearchGameEntryRef::from)
        })
    }

    #[cfg(test)]
    pub fn is_valid<P: AsRef<Path>>(path: P) -> bool {
        Self::open(path).is_ok()
    }
}

#[cfg(test)]
pub struct SearchIndexIter<'a> {
    index: &'a MmapSearchIndex,
    next: usize,
}

#[cfg(test)]
impl<'a> Iterator for SearchIndexIter<'a> {
    type Item = SearchGameEntryRef<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        let entry = self.index.get_entry_ref(self.next)?;
        self.next += 1;
        Some(entry)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.index.len().saturating_sub(self.next);
        (remaining, Some(remaining))
    }
}

// The iterator's borrowed entries never outlive the mapping.
#[cfg(test)]
impl ExactSizeIterator for SearchIndexIter<'_> {}

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
/// an appended sidecar. Only a validated current-version archive whose complete recorded
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
    Ok(promote_legacy_index_sidecar_at(
        &parent,
        &preferred_leaf,
        &legacy_leaf,
        &identity,
        &CancellationToken::new(),
    )?
    .then(|| database.with_file_name(preferred_leaf)))
}

#[cfg(unix)]
pub(crate) fn promote_legacy_index_sidecar_at(
    parent: &File,
    preferred_leaf: &OsStr,
    legacy_leaf: &OsStr,
    db_identity: &DatabaseIdentity,
    cancellation: &CancellationToken,
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
    let archive = match MmapSearchIndex::open_file_cancellable(source.try_clone()?, cancellation) {
        Ok(archive) => archive,
        Err(Error::Io(error)) if error.kind() == io::ErrorKind::InvalidData => return Ok(false),
        Err(error) => return Err(error),
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
            if cancellation.is_cancelled() {
                return Err(Error::Cancellation);
            }
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
    use crate::infra::fs::{open_verified_parent, set_test_atomic_file_injector};
    use tempfile::tempdir;

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
        let index = SearchIndexChunk {
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
        let mut index = SearchIndexChunk::with_capacity(1000);
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

        let mut index = SearchIndexChunk::with_capacity(100);
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

    fn test_entry(id: i32, moves: Vec<u8>) -> SearchGameEntry {
        SearchGameEntry {
            id,
            white_id: id.saturating_mul(2),
            black_id: id.saturating_mul(2).saturating_add(1),
            date: Some(format!("2026.09.{:02}", id.rem_euclid(30) + 1)),
            result: GameResult::Draw,
            pawn_home: 0x0f0f,
            white_material: 31,
            black_material: 30,
            white_elo: 2_100,
            black_elo: 2_000,
            fen: None,
            moves,
        }
    }

    #[test]
    fn chunked_roundtrip_preserves_sequential_and_parallel_order() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("chunks.ecsi");
        let entries = (0..CHUNK_ENTRY_LIMIT + 17)
            .map(|id| test_entry(i32::try_from(id).unwrap(), vec![12, 12, 9, 9]))
            .collect::<Vec<_>>();
        SearchIndexChunk {
            entries: entries.clone(),
        }
        .write_to(&path)
        .unwrap();

        let mapped = MmapSearchIndex::open(&path).unwrap();
        assert_eq!(mapped.chunks.len(), 2);
        assert!(mapped
            .chunks
            .iter()
            .all(|chunk| chunk.entry_count <= CHUNK_ENTRY_LIMIT));
        let sequential = mapped.iter().map(|entry| entry.id).collect::<Vec<_>>();
        let parallel = mapped.par_iter().map(|entry| entry.id).collect::<Vec<_>>();
        let expected = entries.iter().map(|entry| entry.id).collect::<Vec<_>>();
        assert_eq!(sequential, expected);
        assert_eq!(parallel, expected);
        let borrowed = mapped.get_entry_ref(CHUNK_ENTRY_LIMIT).unwrap().moves;
        let mapping =
            mapped.mmap.as_ptr() as usize..mapped.mmap.as_ptr() as usize + mapped.mmap.len();
        assert!(mapping.contains(&(borrowed.as_ptr() as usize)));
    }

    struct ObservedArchiveWriter {
        inner: std::io::Cursor<Vec<u8>>,
        produced: Arc<std::sync::atomic::AtomicUsize>,
        first_chunk_write_at: Arc<std::sync::atomic::AtomicUsize>,
    }

    impl Write for ObservedArchiveWriter {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            let produced = self.produced.load(std::sync::atomic::Ordering::Relaxed);
            if produced > 0 {
                let _ = self.first_chunk_write_at.compare_exchange(
                    usize::MAX,
                    produced,
                    std::sync::atomic::Ordering::Relaxed,
                    std::sync::atomic::Ordering::Relaxed,
                );
            }
            self.inner.write(bytes)
        }

        fn flush(&mut self) -> io::Result<()> {
            self.inner.flush()
        }
    }

    impl Seek for ObservedArchiveWriter {
        fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
            self.inner.seek(position)
        }
    }

    #[test]
    fn production_writer_publishes_a_chunk_before_exhausting_its_input() {
        let total = CHUNK_ENTRY_LIMIT * 2 + 1;
        let produced = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let first_chunk_write_at = Arc::new(std::sync::atomic::AtomicUsize::new(usize::MAX));
        let counter = Arc::clone(&produced);
        let rows = (0..total).map(move |id| {
            counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            Ok(test_entry(i32::try_from(id).unwrap(), vec![]))
        });
        let mut writer = ObservedArchiveWriter {
            inner: std::io::Cursor::new(Vec::new()),
            produced: Arc::clone(&produced),
            first_chunk_write_at: Arc::clone(&first_chunk_write_at),
        };
        write_chunked_archive(&mut writer, IndexSource::default(), rows).unwrap();

        assert_eq!(produced.load(std::sync::atomic::Ordering::Relaxed), total);
        assert!(
            first_chunk_write_at.load(std::sync::atomic::Ordering::Relaxed)
                <= CHUNK_ENTRY_LIMIT + 1
        );
    }

    #[test]
    fn oversized_entry_gets_its_own_chunk() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("oversized.ecsi");
        SearchIndexChunk {
            entries: vec![
                test_entry(1, vec![7; CHUNK_PAYLOAD_TARGET_BYTES + 1]),
                test_entry(2, vec![8]),
            ],
        }
        .write_to(&path)
        .unwrap();
        let mapped = MmapSearchIndex::open(&path).unwrap();
        assert_eq!(mapped.chunks.len(), 2);
        assert_eq!(mapped.chunks[0].entry_count, 1);
        assert_eq!(
            mapped.get_entry_ref(0).unwrap().moves.len(),
            CHUNK_PAYLOAD_TARGET_BYTES + 1
        );
        assert_eq!(mapped.get_entry_ref(1).unwrap().moves, &[8]);
    }

    #[test]
    fn empty_archive_has_source_without_chunks() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("empty.ecsi");
        SearchIndexChunk::default().write_to(&path).unwrap();
        let mapped = MmapSearchIndex::open(&path).unwrap();
        assert_eq!(mapped.len(), 0);
        assert!(mapped.chunks.is_empty());
        assert_eq!(mapped.iter().len(), 0);
    }

    #[test]
    fn framing_rejects_corrupt_counts_lengths_alignment_and_trailing_bytes() {
        fn mutate_valid(mutator: impl FnOnce(&mut Vec<u8>)) -> io::Error {
            let dir = tempdir().unwrap();
            let path = dir.path().join("mutated.ecsi");
            SearchIndexChunk {
                entries: vec![test_entry(1, vec![12, 12])],
            }
            .write_to(&path)
            .unwrap();
            let mut bytes = std::fs::read(&path).unwrap();
            mutator(&mut bytes);
            std::fs::write(&path, bytes).unwrap();
            MmapSearchIndex::open(&path).unwrap_err()
        }

        assert_eq!(
            mutate_valid(|bytes| bytes[4..8].copy_from_slice(&6_u32.to_le_bytes())).kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            mutate_valid(|bytes| bytes[8..16].copy_from_slice(&u64::MAX.to_le_bytes())).kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            mutate_valid(|bytes| {
                bytes[8..16].copy_from_slice(&((MAX_SOURCE_BYTES + 1) as u64).to_le_bytes())
            })
            .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            mutate_valid(|bytes| {
                let source_len = read_u64(bytes, 8, "source").unwrap() as usize;
                bytes[8..16].copy_from_slice(&((source_len + 1) as u64).to_le_bytes());
            })
            .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            mutate_valid(|bytes| bytes[16..24].copy_from_slice(&2_u64.to_le_bytes())).kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            mutate_valid(|bytes| {
                let source_len = read_u64(bytes, 8, "source").unwrap() as usize;
                let chunk = align_up(HEADER_SIZE + source_len).unwrap();
                bytes[chunk + 8..chunk + 16].copy_from_slice(&2_u64.to_le_bytes());
            })
            .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            mutate_valid(|bytes| {
                let source_len = read_u64(bytes, 8, "source").unwrap() as usize;
                let chunk = align_up(HEADER_SIZE + source_len).unwrap();
                bytes[chunk..chunk + 8].copy_from_slice(&u64::MAX.to_le_bytes());
            })
            .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            mutate_valid(|bytes| {
                bytes.pop();
            })
            .kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(
            mutate_valid(|bytes| bytes.push(1)).kind(),
            io::ErrorKind::InvalidData
        );
    }

    #[test]
    fn rejects_misaligned_source_length_from_an_emitted_archive() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("source-alignment.ecsi");
        SearchIndexChunk::default().write_to(&path).unwrap();
        let mut bytes = std::fs::read(&path).unwrap();
        let source_len = read_u64(&bytes, 8, "source").unwrap();
        assert_eq!(source_len % ARCHIVE_ALIGNMENT as u64, 0);
        bytes[8..16].copy_from_slice(&(source_len - 1).to_le_bytes());
        std::fs::write(&path, bytes).unwrap();

        assert_eq!(
            MmapSearchIndex::open(&path)
                .expect_err("misaligned source length must fail")
                .kind(),
            io::ErrorKind::InvalidData
        );
    }

    #[test]
    fn rejects_nonzero_chunk_padding_from_an_emitted_archive() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("chunk-padding.ecsi");
        let mut padding_offset = None;
        for move_bytes in 0..ARCHIVE_ALIGNMENT {
            SearchIndexChunk {
                entries: vec![test_entry(1, vec![0; move_bytes])],
            }
            .write_to(&path)
            .unwrap();
            let bytes = std::fs::read(&path).unwrap();
            let source_len = read_u64(&bytes, 8, "source").unwrap() as usize;
            let chunk_header = align_up(HEADER_SIZE + source_len).unwrap();
            let payload_len = read_u64(&bytes, chunk_header, "payload").unwrap() as usize;
            let payload_end = chunk_header + CHUNK_HEADER_SIZE + payload_len;
            if payload_end < align_up(payload_end).unwrap() {
                padding_offset = Some(payload_end);
                break;
            }
        }
        let padding_offset = padding_offset.expect("fixture must force chunk padding");
        let mut bytes = std::fs::read(&path).unwrap();
        bytes[padding_offset] = 1;
        std::fs::write(&path, bytes).unwrap();

        assert_eq!(
            MmapSearchIndex::open(&path)
                .expect_err("nonzero chunk padding must fail")
                .kind(),
            io::ErrorKind::InvalidData
        );
    }

    #[test]
    fn iterator_failure_preserves_the_previous_index() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("atomic.ecsi");
        SearchIndexChunk {
            entries: vec![test_entry(7, vec![])],
        }
        .write_to(&path)
        .unwrap();
        let parent = File::open(dir.path()).unwrap();
        let rows = vec![
            Ok(test_entry(8, vec![])),
            Err(Error::InvalidInput("injected row failure".into())),
        ];
        let result = write_entries_to_at(
            &parent,
            OsStr::new("atomic.ecsi"),
            IndexSource::default(),
            rows,
            &CancellationToken::new(),
        );
        assert!(matches!(result, Err(Error::InvalidInput(_))));
        let mapped = MmapSearchIndex::open(&path).unwrap();
        assert_eq!(mapped.get_entry_ref(0).unwrap().id, 7);
    }

    #[cfg(unix)]
    #[test]
    fn operational_open_failure_is_not_reclassified_as_invalid_archive() {
        let dir = tempdir().unwrap();
        let error = MmapSearchIndex::open(dir.path()).unwrap_err();
        assert_ne!(error.kind(), io::ErrorKind::InvalidData);
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
        let error = MmapSearchIndex::open(&truncated).expect_err("truncated archive must fail");
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);

        let corrupt = dir.path().join("corrupt.ecsi");
        std::fs::write(
            &corrupt,
            [MAGIC.as_slice(), &VERSION.to_le_bytes(), &[0xff; 32]].concat(),
        )
        .unwrap();
        let error = MmapSearchIndex::open(&corrupt).expect_err("corrupt archive must fail");
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
        let first = SearchIndexChunk::default();
        first.write_to(&path).unwrap();
        let second = SearchIndexChunk::with_capacity(1);
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
        SearchIndexChunk::default()
            .write_to_with_source(&legacy, source)
            .unwrap()
            .expect_durable();
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
        SearchIndexChunk::default()
            .write_to_with_source(
                &collision_legacy,
                IndexSource::from_database(&collision_database, 0).unwrap(),
            )
            .unwrap()
            .expect_durable();
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
        SearchIndexChunk::default()
            .write_to_with_source(
                &legacy,
                IndexSource::from_database_identity(&identity).unwrap(),
            )
            .unwrap()
            .expect_durable();
        let (parent, database_leaf) = open_verified_parent(&database, object, false).unwrap();
        let preferred_leaf = preferred_sidecar_leaf(&database_leaf);
        let legacy_leaf = legacy_sidecar_leaf(&database_leaf);

        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "injected parent sync failure",
        ))));
        let result = promote_legacy_index_sidecar_at(
            &parent,
            &preferred_leaf,
            &legacy_leaf,
            &identity,
            &CancellationToken::new(),
        );
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
        set_test_atomic_file_injector(Some(Arc::new(crate::infra::fs::ParentSyncFault(
            "injected parent sync failure",
        ))));
        let result = SearchIndexChunk::default().write_to(&path);
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

        let result = write_entries_to_at(
            &parent,
            leaf,
            IndexSource::default(),
            std::iter::empty(),
            &CancellationToken::new(),
        );
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
        SearchIndexChunk::default()
            .write_to_with_source(&shared_legacy, IndexSource::from_database(&db3, 0).unwrap())
            .unwrap()
            .expect_durable();

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
        SearchIndexChunk::default()
            .write_to_with_source(&path, source.clone())
            .unwrap()
            .expect_durable();
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
        SearchIndexChunk::default()
            .write_to_with_source(&first_index, first_source.clone())
            .unwrap()
            .expect_durable();
        SearchIndexChunk::default()
            .write_to_with_source(&second_index, second_source.clone())
            .unwrap()
            .expect_durable();

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
