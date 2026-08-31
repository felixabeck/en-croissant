use std::{
    collections::HashMap,
    fs::File,
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom, Write},
    sync::Arc,
};

use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::{error::Error, infra::blocking::BLOCKING_GATEWAY, AppState};

fn resolve_pgn(
    state: &AppState,
    file: &crate::infra::path_authority::FileWorkspaceHandle,
    operation: crate::infra::path_authority::PathOperation,
) -> Result<crate::infra::path_authority::ResolvedPath, Error> {
    let mut authority = state
        .pgn_path_authority
        .lock()
        .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
    authority
        .as_mut()
        .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
        .resolve(file.path_ref(), operation, &[])
}

const MAX_LINE_LEN: usize = 1024 * 1024;
const MAX_PAGE_LEN: usize = 1_000;
const MAX_PGN_BYTES: usize = 10 * 1024 * 1024;
const MAX_CACHE_ENTRIES: usize = 128;
const MAX_PGN_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_PGN_GAMES: usize = 100_000;

struct CancelOnDrop(CancellationToken);
impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        self.0.cancel();
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct FileRevision {
    size: u64,
    mtime_nanos: u128,
    ctime_nanos: i128,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct CacheKey {
    identity: crate::infra::path_authority::PgnSnapshotIdentity,
    revision: FileRevision,
}

#[derive(Debug, Clone)]
struct GameRange {
    start: u64,
    end: u64,
}

#[derive(Debug, Clone)]
struct CachedScan {
    games: Vec<GameRange>,
    last_used: u64,
}

#[derive(Default)]
struct PgnRepositoryInner {
    cache: HashMap<CacheKey, CachedScan>,
    locks: HashMap<crate::infra::path_authority::PgnSnapshotIdentity, Arc<Mutex<()>>>,
    clock: u64,
}

/// Bounded PGN state. Cache entries are revision-specific; edit locks are retained only while
/// another caller still owns an `Arc` for that exact canonical path.
pub struct PgnRepository {
    inner: std::sync::Mutex<PgnRepositoryInner>,
}

impl Default for PgnRepository {
    fn default() -> Self {
        Self {
            inner: std::sync::Mutex::new(PgnRepositoryInner::default()),
        }
    }
}

impl PgnRepository {
    fn inner(&self) -> Result<std::sync::MutexGuard<'_, PgnRepositoryInner>, Error> {
        self.inner
            .lock()
            .map_err(|_| Error::Conflict("PGN repository lock was poisoned".into()))
    }

    fn tick(inner: &mut PgnRepositoryInner) -> u64 {
        inner.clock = inner.clock.wrapping_add(1);
        inner.clock
    }

    fn edit_lock(
        &self,
        identity: crate::infra::path_authority::PgnSnapshotIdentity,
    ) -> Result<Arc<Mutex<()>>, Error> {
        let mut inner = self.inner()?;
        let lock = inner
            .locks
            .entry(identity)
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone();
        inner.locks.retain(|_, value| Arc::strong_count(value) > 1);
        Ok(lock)
    }

    fn get(&self, key: &CacheKey) -> Result<Option<Vec<GameRange>>, Error> {
        let mut inner = self.inner()?;
        let now = Self::tick(&mut inner);
        Ok(inner.cache.get_mut(key).map(|entry| {
            entry.last_used = now;
            entry.games.clone()
        }))
    }

    fn insert(&self, key: CacheKey, games: Vec<GameRange>) -> Result<(), Error> {
        let mut inner = self.inner()?;
        let now = Self::tick(&mut inner);
        if !inner.cache.contains_key(&key) && inner.cache.len() >= MAX_CACHE_ENTRIES {
            if let Some(oldest) = inner
                .cache
                .iter()
                .min_by_key(|(_, entry)| entry.last_used)
                .map(|(key, _)| key.clone())
            {
                inner.cache.remove(&oldest);
            }
        }
        inner.cache.insert(
            key,
            CachedScan {
                games,
                last_used: now,
            },
        );
        Ok(())
    }

    fn invalidate(
        &self,
        identity: &crate::infra::path_authority::PgnSnapshotIdentity,
    ) -> Result<(), Error> {
        let mut inner = self.inner()?;
        inner.cache.retain(|key, _| &key.identity != identity);
        inner.locks.retain(|_, value| Arc::strong_count(value) > 1);
        Ok(())
    }
}

fn snapshot_key(snapshot: &crate::infra::path_authority::PgnSnapshot) -> CacheKey {
    CacheKey {
        identity: snapshot.identity.clone(),
        revision: FileRevision {
            size: snapshot.revision.size,
            mtime_nanos: snapshot.revision.mtime_nanos,
            ctime_nanos: snapshot.revision.ctime_nanos,
        },
    }
}

fn is_tag_header(line: &str, in_brace_comment: bool) -> bool {
    if in_brace_comment || !line.starts_with('[') {
        return false;
    }
    let bytes = line.as_bytes();
    let Some(space) = bytes
        .iter()
        .position(|byte| *byte == b' ' || *byte == b'\t')
    else {
        return false;
    };
    if space <= 1
        || !bytes[1..space]
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        return false;
    }
    let rest = line[space..].trim_start_matches([' ', '\t']);
    let Some(value) = rest.strip_prefix('"') else {
        return false;
    };
    let mut escaped = false;
    for (index, character) in value.char_indices() {
        if escaped {
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == '"' {
            return value[index + character.len_utf8()..].trim_matches([' ', '\t', '\r', '\n'])
                == "]";
        }
    }
    false
}

fn update_brace_comment(line: &str, in_brace_comment: &mut bool) {
    for character in line.chars() {
        match character {
            '{' => *in_brace_comment = true,
            '}' => *in_brace_comment = false,
            _ => {}
        }
    }
}

fn malformed(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn read_bounded_line<R: Read>(reader: &mut BufReader<R>, line: &mut Vec<u8>) -> io::Result<usize> {
    line.clear();
    let mut limited = reader.by_ref().take((MAX_LINE_LEN + 1) as u64);
    let bytes = limited.read_until(b'\n', line)?;
    if bytes > MAX_LINE_LEN {
        return Err(malformed("PGN line exceeds the 1 MiB limit"));
    }
    Ok(bytes)
}

fn validate_game_count(game_count: usize) -> io::Result<()> {
    if game_count > MAX_PGN_GAMES {
        return Err(malformed("PGN game count exceeds configured limit"));
    }
    Ok(())
}

/// Strict, synchronous byte-range scanner. Every range excludes a UTF-8 BOM and is
/// `[start, end)`, with `end` equal to the next game's first tag byte or EOF.
#[cfg(test)]
fn scan_games<R: Read + Seek>(reader: R) -> io::Result<Vec<GameRange>> {
    scan_games_cancelled(reader, &CancellationToken::new())
}

fn scan_games_cancelled<R: Read + Seek>(
    reader: R,
    cancellation: &CancellationToken,
) -> io::Result<Vec<GameRange>> {
    let mut reader = BufReader::new(reader);
    let mut bom = [0; 3];
    let initial = reader.read(&mut bom)?;
    let start = if initial == bom.len() && bom == [0xEF, 0xBB, 0xBF] {
        3
    } else {
        reader.seek(SeekFrom::Start(0))?;
        0
    };
    let mut games: Vec<GameRange> = Vec::new();
    let mut line = Vec::new();
    let mut game_start = None;
    let mut has_movetext = false;
    let mut in_brace_comment = false;
    loop {
        if cancellation.is_cancelled() {
            return Err(io::Error::new(
                io::ErrorKind::Interrupted,
                "PGN scan cancelled",
            ));
        }
        let line_start = reader.stream_position()?;
        let bytes = read_bounded_line(&mut reader, &mut line)?;
        if bytes == 0 {
            break;
        }
        let line = std::str::from_utf8(&line).map_err(|_| malformed("PGN is not valid UTF-8"))?;
        let header = is_tag_header(line, in_brace_comment);
        let escaped_or_line_comment = !in_brace_comment
            && (line.trim_start_matches([' ', '\t']).starts_with(';')
                || line.trim_start_matches([' ', '\t']).starts_with('%'));
        let non_whitespace = !escaped_or_line_comment && !line.trim().is_empty();
        if header && has_movetext {
            games
                .last_mut()
                .expect("game start implies a game range")
                .end = line_start;
            game_start = Some(line_start);
            has_movetext = false;
            games.push(GameRange {
                start: line_start,
                end: line_start,
            });
            validate_game_count(games.len())?;
        } else if non_whitespace && game_start.is_none() {
            game_start = Some(line_start.max(start));
            games.push(GameRange {
                start: line_start.max(start),
                end: line_start.max(start),
            });
        }
        if non_whitespace && !header {
            has_movetext = true;
        }
        if !header && !escaped_or_line_comment {
            update_brace_comment(line, &mut in_brace_comment);
        }
    }
    let end = reader.stream_position()?;
    if let Some(last) = games.last_mut() {
        last.end = end;
    }
    if in_brace_comment {
        return Err(malformed("PGN brace comment is not closed before EOF"));
    }
    Ok(games)
}

fn scan_file(
    snapshot: crate::infra::path_authority::PgnSnapshot,
    cancellation: &CancellationToken,
) -> Result<(CacheKey, Vec<GameRange>), Error> {
    if snapshot.revision.size > MAX_PGN_FILE_BYTES {
        return Err(Error::ResourceLimit("PGN file exceeds 64 MiB".into()));
    }
    let key = snapshot_key(&snapshot);
    let games = scan_games_cancelled(snapshot.file, cancellation)?;
    Ok((key, games))
}

async fn scan_current(
    snapshot: crate::infra::path_authority::PgnSnapshot,
    repository: &PgnRepository,
) -> Result<(CacheKey, Vec<GameRange>), Error> {
    let key = snapshot_key(&snapshot);
    if let Some(games) = repository.get(&key)? {
        return Ok((key, games));
    }
    let cancellation = CancellationToken::new();
    let _cancel_on_drop = CancelOnDrop(cancellation.clone());
    let (key, games) = BLOCKING_GATEWAY
        .spawn_cancellable(cancellation, move |token| scan_file(snapshot, token))
        .await?;
    repository.insert(key.clone(), games.clone())?;
    Ok((key, games))
}

fn checked_index(n: i32) -> Result<usize, Error> {
    Ok(crate::infra::validation::ValidGameIndex::new(n)?.as_usize())
}

fn checked_range(start: i32, end: i32) -> Result<(usize, usize), Error> {
    let range = crate::infra::validation::ValidGameRange::new(start, end)?;
    let start = range.start;
    let count = range.count;
    if count > MAX_PAGE_LEN {
        return Err(Error::ResourceLimit(format!(
            "PGN page exceeds {MAX_PAGE_LEN} games"
        )));
    }
    Ok((start, count))
}

fn read_ranges(
    mut file: File,
    ranges: Vec<GameRange>,
    cancellation: &CancellationToken,
) -> Result<Vec<String>, Error> {
    let mut games = Vec::with_capacity(ranges.len());
    for range in ranges {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let bytes = range
            .end
            .checked_sub(range.start)
            .ok_or_else(|| Error::Conflict("invalid cached PGN byte range".into()))?;
        let len = usize::try_from(bytes)
            .map_err(|_| Error::ResourceLimit("PGN game is too large".into()))?;
        if len > MAX_PGN_BYTES {
            return Err(Error::ResourceLimit("PGN game exceeds 10 MiB".into()));
        }
        file.seek(SeekFrom::Start(range.start))?;
        let mut data = vec![0; len];
        file.read_exact(&mut data)?;
        games.push(
            String::from_utf8(data)
                .map_err(|error| malformed(&format!("invalid UTF-8 PGN: {error}")))?,
        );
    }
    Ok(games)
}

fn copy_range(
    source: &mut File,
    target: &mut File,
    start: u64,
    end: u64,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let len = end
        .checked_sub(start)
        .ok_or_else(|| Error::Conflict("invalid PGN byte range".into()))?;
    source.seek(SeekFrom::Start(start))?;
    let mut remaining = len;
    let mut buffer = [0; 64 * 1024];
    while remaining > 0 {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let chunk = usize::try_from(remaining.min(buffer.len() as u64))
            .map_err(|_| Error::ResourceLimit("PGN copy range is too large".into()))?;
        let read = source.read(&mut buffer[..chunk])?;
        if read == 0 {
            return Err(Error::Conflict("PGN snapshot ended while copying".into()));
        }
        target.write_all(&buffer[..read])?;
        remaining -= u64::try_from(read)
            .map_err(|_| Error::ResourceLimit("PGN copy range is too large".into()))?;
    }
    Ok(())
}

fn outcome(result: crate::infra::fs::AtomicFileOutcome) -> Result<(), Error> {
    if let Some(stage) = crate::infra::fs::map_atomic_file_outcome(
        result,
        crate::error::DurabilityStage::PgnEdit,
        |error| log::warn!("PGN edit parent sync failed: {error}"),
    ) {
        Err(Error::CommittedDurabilityUncertain(stage))
    } else {
        Ok(())
    }
}

fn edit_existing(
    resolved: &crate::infra::path_authority::ResolvedPath,
    expected: CacheKey,
    snapshot: crate::infra::path_authority::PgnSnapshot,
    target: GameRange,
    replacement: Option<Vec<u8>>,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    outcome(resolved.replace_pgn_atomic(&snapshot, |source, temporary| {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        copy_range(source, temporary, 0, target.start, cancellation)?;
        if let Some(ref replacement) = replacement {
            if target.start > 0 && !replacement.starts_with(b"\n") {
                source.seek(SeekFrom::Start(target.start - 1))?;
                let mut prior = [0];
                source.read_exact(&mut prior)?;
                if prior[0] != b'\n' {
                    temporary.write_all(b"\n")?;
                }
            }
            temporary.write_all(replacement)?;
            if !replacement.ends_with(b"\n")
                && (target.end < expected.revision.size || target.end == target.start)
            {
                temporary.write_all(b"\n")?;
            }
        } else if target.start > 0 && target.end < expected.revision.size {
            source.seek(SeekFrom::Start(target.start - 1))?;
            let mut prior = [0];
            source.read_exact(&mut prior)?;
            source.seek(SeekFrom::Start(target.end))?;
            let mut following = [0];
            source.read_exact(&mut following)?;
            if prior[0] != b'\n' && following[0] != b'\n' {
                temporary.write_all(b"\n")?;
            }
        }
        copy_range(
            source,
            temporary,
            target.end,
            expected.revision.size,
            cancellation,
        )?;
        Ok(())
    })?)
}

#[tauri::command]
#[specta::specta]
pub async fn count_pgn_games(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    state: tauri::State<'_, AppState>,
) -> Result<i32, Error> {
    count_pgn_games_core(
        resolve_pgn(
            &state,
            &file,
            crate::infra::path_authority::PathOperation::ReadPgn,
        )?,
        state,
    )
    .await
}

pub async fn count_pgn_games_core(
    resolved: crate::infra::path_authority::ResolvedPath,
    state: tauri::State<'_, AppState>,
) -> Result<i32, Error> {
    let (key, games) = scan_current(resolved.pgn_snapshot()?, &state.pgn_repository).await?;
    let _ = key;
    i32::try_from(games.len())
        .map_err(|_| Error::ResourceLimit("PGN count exceeds IPC limit".into()))
}

#[tauri::command]
#[specta::specta]
pub async fn read_games(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    start: i32,
    end: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, Error> {
    read_games_core(
        resolve_pgn(
            &state,
            &file,
            crate::infra::path_authority::PathOperation::ReadPgn,
        )?,
        start,
        end,
        state,
    )
    .await
}

pub async fn read_games_core(
    resolved: crate::infra::path_authority::ResolvedPath,
    start: i32,
    end: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, Error> {
    let (start, count) = checked_range(start, end)?;
    let snapshot = resolved.pgn_snapshot()?;
    let read_file = snapshot.file.try_clone()?;
    let (_key, games) = scan_current(snapshot, &state.pgn_repository).await?;
    let end = start
        .checked_add(count)
        .ok_or_else(|| Error::InvalidInput("game range overflows".into()))?;
    let requested = games.get(start..end).unwrap_or(&[]).to_vec();
    let cancellation = CancellationToken::new();
    let _cancel_on_drop = CancelOnDrop(cancellation.clone());
    BLOCKING_GATEWAY
        .spawn_cancellable(cancellation, move |token| {
            read_ranges(read_file, requested, token)
        })
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_game(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    n: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    delete_game_core(
        resolve_pgn(
            &state,
            &file,
            crate::infra::path_authority::PathOperation::WritePgn,
        )?,
        n,
        state,
    )
    .await
}

pub async fn delete_game_core(
    resolved: crate::infra::path_authority::ResolvedPath,
    n: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let n = checked_index(n)?;
    let scan_snapshot = resolved.pgn_snapshot()?;
    let identity = scan_snapshot.identity.clone();
    let lock = state.pgn_repository.edit_lock(identity.clone())?;
    let _guard = lock.lock().await;
    let (key, games) = scan_current(scan_snapshot, &state.pgn_repository).await?;
    let range = games
        .get(n)
        .cloned()
        .ok_or_else(|| Error::InvalidInput("game index is out of bounds".into()))?;
    let commit_snapshot = resolved.pgn_snapshot()?;
    if snapshot_key(&commit_snapshot) != key {
        return Err(Error::Conflict("PGN changed after scan".into()));
    }
    let cancellation = CancellationToken::new();
    let _cancel_on_drop = CancelOnDrop(cancellation.clone());
    BLOCKING_GATEWAY
        .spawn_cancellable(cancellation, move |token| {
            edit_existing(&resolved, key, commit_snapshot, range, None, token)
        })
        .await?;
    state.pgn_repository.invalidate(&identity)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn write_game(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    n: i32,
    pgn: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    write_game_core(
        resolve_pgn(
            &state,
            &file,
            crate::infra::path_authority::PathOperation::WritePgn,
        )?,
        n,
        pgn,
        state,
    )
    .await
}

pub async fn write_game_core(
    resolved: crate::infra::path_authority::ResolvedPath,
    n: i32,
    pgn: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let n = checked_index(n)?;
    if pgn.len() > MAX_PGN_BYTES {
        return Err(Error::ResourceLimit(
            "replacement PGN exceeds 10 MiB".into(),
        ));
    }
    // Validate text before creating a replacement; malformed UTF-8 cannot enter through String.
    let replacement = pgn.into_bytes();
    let scan_snapshot = resolved.pgn_snapshot()?;
    let identity = scan_snapshot.identity.clone();
    let lock = state.pgn_repository.edit_lock(identity.clone())?;
    let _guard = lock.lock().await;
    let (key, games) = scan_current(scan_snapshot, &state.pgn_repository).await?;
    let target = if let Some(range) = games.get(n).cloned() {
        range
    } else if n == games.len() {
        GameRange {
            start: key.revision.size,
            end: key.revision.size,
        }
    } else {
        return Err(Error::InvalidInput("game index is out of bounds".into()));
    };
    let commit_snapshot = resolved.pgn_snapshot()?;
    if snapshot_key(&commit_snapshot) != key {
        return Err(Error::Conflict("PGN changed after scan".into()));
    }
    let cancellation = CancellationToken::new();
    let _cancel_on_drop = CancelOnDrop(cancellation.clone());
    BLOCKING_GATEWAY
        .spawn_cancellable(cancellation, move |token| {
            edit_existing(
                &resolved,
                key,
                commit_snapshot,
                target,
                Some(replacement),
                token,
            )
        })
        .await?;
    state.pgn_repository.invalidate(&identity)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn ranges_preserve_bom_line_endings_and_comment_headers() {
        let data = b"\xef\xbb\xbf[Event \"A\"]\r\n\r\n1. e4 {\r\n[Event \"not a tag\"]\r\n} e5\r\n[Event \"B\"]\r\n\r\n1. d4\r\n";
        let ranges = scan_games(Cursor::new(data)).expect("scan PGN");
        assert_eq!(ranges.len(), 2);
        assert_eq!(
            &data[ranges[0].start as usize..ranges[0].end as usize],
            b"[Event \"A\"]\r\n\r\n1. e4 {\r\n[Event \"not a tag\"]\r\n} e5\r\n"
        );
    }

    #[test]
    fn empty_short_and_invalid_utf8_inputs_are_exact() {
        assert!(scan_games(Cursor::new(b"".as_slice()))
            .expect("empty scan")
            .is_empty());
        assert!(scan_games(Cursor::new(b"\xef\xbb".as_slice())).is_err());
        assert!(scan_games(Cursor::new(b"\xff".as_slice())).is_err());
    }

    #[test]
    fn signed_bounds_are_checked_before_conversion() {
        assert!(checked_index(-1).is_err());
        assert!(checked_range(-1, 0).is_err());
        assert!(checked_range(1, 0).is_err());
        assert!(checked_range(0, 1_000).is_err());
        assert_eq!(checked_range(0, 999).expect("bounded range"), (0, 1_000));
    }

    #[test]
    fn header_clusters_and_malformed_headers_do_not_split_games() {
        let data = b"[Event \"A\"]\n[Site \"x\\\"y\"]\n\n1. e4\n[Event \"B\"]\n\n1. d4\n[Event \"unterminated]\n";
        let ranges = scan_games(Cursor::new(data)).expect("scan PGN");
        assert_eq!(ranges.len(), 2);
        assert_eq!(
            &data[ranges[1].start as usize..ranges[1].end as usize],
            b"[Event \"B\"]\n\n1. d4\n[Event \"unterminated]\n"
        );
    }

    #[test]
    fn tag_header_grammar_accepts_underscore_and_rejects_empty_tag_names() {
        assert!(is_tag_header("[Tag_Name \"value\"]\n", false));
        assert!(!is_tag_header("[ \"value\"]\n", false));
        assert!(!is_tag_header("[Tag-Name \"value\"]\n", false));
        assert!(!is_tag_header("[Tag_Name \"value\"]\n", true));
    }

    #[test]
    fn braces_in_quoted_tag_values_do_not_start_comments() {
        let data = b"[Event \"{literal\"]\n\n1. e4\n[Event \"B\"]\n\n1. d4\n";
        assert_eq!(scan_games(Cursor::new(data)).expect("scan PGN").len(), 2);
    }

    #[test]
    fn line_comments_and_unclosed_brace_comments_are_handled_explicitly() {
        let data =
            b"  ; { [Event \"ignored\"]\n\t% [Event \"ignored too\"]\n[Event \"A\"]\n\n1. e4\n";
        assert_eq!(scan_games(Cursor::new(data)).expect("scan PGN").len(), 1);
        assert!(scan_games(Cursor::new(
            b"[Event \"A\"]\n\n1. e4 {unterminated".as_slice()
        ))
        .is_err());
        let comment_close = b"[Event \"A\"]\n\n1. e4 {\n; }\n[Event \"B\"]\n\n1. d4\n";
        assert_eq!(
            scan_games(Cursor::new(comment_close))
                .expect("brace closes inside comment")
                .len(),
            2
        );
    }

    #[test]
    fn oversized_line_fails_before_string_allocation() {
        for (content_bytes, newline, expected_ok) in [
            (MAX_LINE_LEN - 1, true, true),
            (MAX_LINE_LEN, false, true),
            (MAX_LINE_LEN, true, false),
            (MAX_LINE_LEN + 1, false, false),
        ] {
            let mut data = vec![b'x'; content_bytes];
            if newline {
                data.push(b'\n');
            }
            assert_eq!(scan_games(Cursor::new(data)).is_ok(), expected_ok);
        }
    }

    #[test]
    fn game_count_limit_accepts_exact_capacity_and_rejects_one_more() {
        assert!(validate_game_count(MAX_PGN_GAMES - 1).is_ok());
        assert!(validate_game_count(MAX_PGN_GAMES).is_ok());
        assert!(validate_game_count(MAX_PGN_GAMES + 1).is_err());
    }

    #[test]
    fn read_and_seek_errors_propagate_without_retrying() {
        struct FailingRead;
        impl Read for FailingRead {
            fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
                Err(io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "read failure",
                ))
            }
        }
        impl Seek for FailingRead {
            fn seek(&mut self, _: SeekFrom) -> io::Result<u64> {
                Ok(0)
            }
        }
        struct FailingSeek;
        impl Read for FailingSeek {
            fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
                let bom = [0xEF, 0xBB, 0xBF];
                buffer[..bom.len()].copy_from_slice(&bom);
                Ok(bom.len())
            }
        }
        impl Seek for FailingSeek {
            fn seek(&mut self, _: SeekFrom) -> io::Result<u64> {
                Err(io::Error::other("seek failure"))
            }
        }
        assert_eq!(
            scan_games(FailingRead).expect_err("read error").kind(),
            io::ErrorKind::PermissionDenied
        );
        assert_eq!(
            scan_games(FailingSeek).expect_err("seek error").kind(),
            io::ErrorKind::Other
        );
    }
}
