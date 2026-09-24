use std::{
    collections::HashMap,
    fs::File,
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom, Write},
    sync::Arc,
};

use serde::Serialize;
use sha2::{Digest, Sha256};
use specta::Type;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::{
    error::Error,
    infra::{blocking::BLOCKING_GATEWAY, operations::OperationLease},
    AppState,
};

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

#[derive(Clone)]
pub(crate) struct PgnCapabilityRebind {
    authority: Arc<std::sync::Mutex<Option<crate::infra::path_authority::PathAuthority>>>,
    path_ref: crate::infra::path_authority::PathRef,
}

impl PgnCapabilityRebind {
    fn after_replace(
        &self,
        expected_identity: (u64, u64),
        installed_identity: (u64, u64),
    ) -> Result<(), Error> {
        let mut authority = self
            .authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
        let authority = authority
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
        authority.rebind_pgn_file_after_replace(
            &self.path_ref,
            expected_identity,
            installed_identity,
        )
    }

    fn resolve_read(&self) -> Result<crate::infra::path_authority::ResolvedPath, Error> {
        let mut authority = self
            .authority
            .lock()
            .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
        authority
            .as_mut()
            .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?
            .resolve(
                &self.path_ref,
                crate::infra::path_authority::PathOperation::ReadPgn,
                &[],
            )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StampedGame {
    pub pgn: String,
    pub stamp: String,
    pub revision: String,
    pub present: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WriteExpectation {
    Game { stamp: String },
    Append,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WriteStamp {
    pub stamp: Option<String>,
}

const MAX_LINE_LEN: usize = 1024 * 1024;
const MAX_PAGE_LEN: usize = 1_000;
const MAX_PGN_BYTES: usize = 10 * 1024 * 1024;
const MAX_CACHE_ENTRIES: usize = 128;
const MAX_CACHE_BYTES: usize = 4 * 1024 * 1024;

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

#[derive(Debug, Clone, Copy)]
struct GameRange {
    start: u64,
    end: u64,
}

#[derive(Debug, Clone)]
struct CachedScan {
    games: Arc<[GameRange]>,
    last_used: u64,
}

#[cfg(test)]
#[derive(Clone)]
pub(crate) struct BoundedHook {
    entered: Arc<std::sync::Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    release: Arc<std::sync::Mutex<std::sync::mpsc::Receiver<()>>>,
}

#[cfg(test)]
#[derive(Clone, Default)]
struct OneShotSignal(Arc<std::sync::Mutex<Option<tokio::sync::oneshot::Sender<()>>>>);

#[cfg(test)]
impl OneShotSignal {
    fn new() -> (Self, tokio::sync::oneshot::Receiver<()>) {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        (
            Self(Arc::new(std::sync::Mutex::new(Some(sender)))),
            receiver,
        )
    }

    fn notify(&self) {
        if let Ok(mut sender) = self.0.lock() {
            if let Some(sender) = sender.take() {
                let _ = sender.send(());
            }
        }
    }
}

#[cfg(test)]
impl BoundedHook {
    pub(crate) fn new() -> (
        Self,
        tokio::sync::oneshot::Receiver<()>,
        std::sync::mpsc::SyncSender<()>,
    ) {
        let (entered_tx, entered_rx) = tokio::sync::oneshot::channel();
        let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);
        (
            Self {
                entered: Arc::new(std::sync::Mutex::new(Some(entered_tx))),
                release: Arc::new(std::sync::Mutex::new(release_rx)),
            },
            entered_rx,
            release_tx,
        )
    }

    pub(crate) fn notify_and_wait(&self) {
        if let Ok(mut guard) = self.entered.lock() {
            if let Some(tx) = guard.take() {
                let _ = tx.send(());
            }
        }
        if let Ok(guard) = self.release.lock() {
            let _ = guard.recv_timeout(std::time::Duration::from_secs(5));
        }
    }
}

#[cfg(test)]
std::thread_local! {
    static TEST_READ_CHUNK_HOOK: std::cell::RefCell<Option<BoundedHook>> = const { std::cell::RefCell::new(None) };
    static TEST_SCAN_LINE_HOOK: std::cell::RefCell<Option<BoundedHook>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
fn set_read_chunk_hook(hook: Option<BoundedHook>) {
    TEST_READ_CHUNK_HOOK.with(|cell| *cell.borrow_mut() = hook);
}

#[cfg(test)]
fn current_read_chunk_hook() -> Option<BoundedHook> {
    TEST_READ_CHUNK_HOOK.with(|cell| cell.borrow().clone())
}

#[cfg(test)]
fn set_scan_line_hook(hook: Option<BoundedHook>) {
    TEST_SCAN_LINE_HOOK.with(|cell| *cell.borrow_mut() = hook);
}

#[cfg(test)]
fn current_scan_line_hook() -> Option<BoundedHook> {
    TEST_SCAN_LINE_HOOK.with(|cell| cell.borrow().clone())
}

#[derive(Default)]
struct PgnRepositoryInner {
    cache: HashMap<CacheKey, CachedScan>,
    locks: HashMap<crate::infra::path_authority::PgnSnapshotIdentity, Arc<Mutex<()>>>,
    clock: u64,
    retained_bytes: usize,
    #[cfg(test)]
    read_chunk_hook: Option<BoundedHook>,
    #[cfg(test)]
    scan_line_hook: Option<BoundedHook>,
    #[cfg(test)]
    edit_worker_hook: Option<BoundedHook>,
    #[cfg(test)]
    edit_lock_wait_signal: Option<OneShotSignal>,
    #[cfg(test)]
    count_hook: Option<BoundedHook>,
    #[cfg(test)]
    post_commit_hook: Option<BoundedHook>,
    #[cfg(test)]
    atomic_file_injector: Option<Arc<dyn crate::infra::fs::AtomicWriterInjector + Send + Sync>>,
}

/// Bounded PGN state. Cache entries are revision-specific; edit locks are retained only while
/// another caller still owns an `Arc` for that exact canonical path.
#[derive(Clone)]
pub struct PgnRepository {
    inner: Arc<std::sync::Mutex<PgnRepositoryInner>>,
    cache_byte_limit: usize,
}

impl Default for PgnRepository {
    fn default() -> Self {
        Self {
            inner: Arc::new(std::sync::Mutex::new(PgnRepositoryInner::default())),
            cache_byte_limit: MAX_CACHE_BYTES,
        }
    }
}

impl PgnRepository {
    fn inner(&self) -> Result<std::sync::MutexGuard<'_, PgnRepositoryInner>, Error> {
        self.inner
            .lock()
            .map_err(|_| Error::Conflict("PGN repository lock was poisoned".into()))
    }

    #[cfg(test)]
    pub(crate) fn set_read_chunk_hook(&self, hook: Option<BoundedHook>) -> Result<(), Error> {
        self.inner()?.read_chunk_hook = hook;
        Ok(())
    }

    #[cfg(test)]
    pub(crate) fn read_chunk_hook(&self) -> Result<Option<BoundedHook>, Error> {
        Ok(self.inner()?.read_chunk_hook.clone())
    }

    #[cfg(test)]
    fn set_post_commit_hook(&self, hook: Option<BoundedHook>) -> Result<(), Error> {
        self.inner()?.post_commit_hook = hook;
        Ok(())
    }

    #[cfg(test)]
    fn post_commit_hook(&self) -> Result<Option<BoundedHook>, Error> {
        Ok(self.inner()?.post_commit_hook.clone())
    }

    #[cfg(test)]
    fn set_scan_line_hook(&self, hook: Option<BoundedHook>) -> Result<(), Error> {
        self.inner()?.scan_line_hook = hook;
        Ok(())
    }

    #[cfg(test)]
    fn scan_line_hook(&self) -> Result<Option<BoundedHook>, Error> {
        Ok(self.inner()?.scan_line_hook.clone())
    }

    #[cfg(test)]
    pub(crate) fn set_edit_worker_hook(&self, hook: Option<BoundedHook>) -> Result<(), Error> {
        self.inner()?.edit_worker_hook = hook;
        Ok(())
    }

    #[cfg(test)]
    pub(crate) fn edit_worker_hook(&self) -> Result<Option<BoundedHook>, Error> {
        Ok(self.inner()?.edit_worker_hook.clone())
    }

    #[cfg(test)]
    fn observe_edit_lock_wait(&self) -> Result<tokio::sync::oneshot::Receiver<()>, Error> {
        let (signal, receiver) = OneShotSignal::new();
        self.inner()?.edit_lock_wait_signal = Some(signal);
        Ok(receiver)
    }

    #[cfg(test)]
    fn notify_edit_lock_wait(&self) -> Result<(), Error> {
        if let Some(signal) = self.inner()?.edit_lock_wait_signal.take() {
            signal.notify();
        }
        Ok(())
    }

    #[cfg(all(test, unix))]
    pub(crate) fn set_count_hook(&self, hook: Option<BoundedHook>) -> Result<(), Error> {
        self.inner()?.count_hook = hook;
        Ok(())
    }

    #[cfg(test)]
    pub(crate) fn count_hook(&self) -> Result<Option<BoundedHook>, Error> {
        Ok(self.inner()?.count_hook.clone())
    }

    #[cfg(test)]
    pub(crate) fn set_atomic_file_injector(
        &self,
        injector: Option<Arc<dyn crate::infra::fs::AtomicWriterInjector + Send + Sync>>,
    ) -> Result<(), Error> {
        self.inner()?.atomic_file_injector = injector;
        Ok(())
    }

    #[cfg(test)]
    pub(crate) fn atomic_file_injector(
        &self,
    ) -> Result<Option<Arc<dyn crate::infra::fs::AtomicWriterInjector + Send + Sync>>, Error> {
        Ok(self.inner()?.atomic_file_injector.clone())
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

    fn get(&self, key: &CacheKey) -> Result<Option<Arc<[GameRange]>>, Error> {
        let mut inner = self.inner()?;
        let now = Self::tick(&mut inner);
        Ok(inner.cache.get_mut(key).map(|entry| {
            entry.last_used = now;
            entry.games.clone()
        }))
    }

    fn retain_if_within_budget(&self, key: CacheKey, games: Arc<[GameRange]>) -> Result<(), Error> {
        let mut inner = self.inner()?;
        let now = Self::tick(&mut inner);
        if let Some(replaced) = inner.cache.remove(&key) {
            inner.retained_bytes = inner
                .retained_bytes
                .saturating_sub(std::mem::size_of_val(replaced.games.as_ref()));
        }
        let retained_bytes = std::mem::size_of_val(games.as_ref());
        if retained_bytes > self.cache_byte_limit {
            return Ok(());
        }
        while inner.cache.len() >= MAX_CACHE_ENTRIES
            || inner.retained_bytes > self.cache_byte_limit - retained_bytes
        {
            if let Some(oldest) = inner
                .cache
                .iter()
                .min_by_key(|(_, entry)| entry.last_used)
                .map(|(key, _)| key.clone())
            {
                if let Some(evicted) = inner.cache.remove(&oldest) {
                    inner.retained_bytes = inner
                        .retained_bytes
                        .saturating_sub(std::mem::size_of_val(evicted.games.as_ref()));
                }
            } else {
                break;
            }
        }
        inner.retained_bytes += retained_bytes;
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
        let removed_bytes = inner
            .cache
            .iter()
            .filter(|(key, _)| &key.identity == identity)
            .map(|(_, entry)| std::mem::size_of_val(entry.games.as_ref()))
            .sum::<usize>();
        inner.cache.retain(|key, _| &key.identity != identity);
        inner.retained_bytes = inner.retained_bytes.saturating_sub(removed_bytes);
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
    let mut in_quoted_string = false;
    let mut escaped = false;
    for character in line.chars() {
        if *in_brace_comment {
            if character == '}' {
                *in_brace_comment = false;
            }
            continue;
        }
        if escaped {
            escaped = false;
            continue;
        }
        if in_quoted_string && character == '\\' {
            escaped = true;
            continue;
        }
        match character {
            '"' => in_quoted_string = !in_quoted_string,
            ';' if !in_quoted_string => break,
            '{' if !in_quoted_string => *in_brace_comment = true,
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
        #[cfg(test)]
        if let Some(hook) = current_scan_line_hook() {
            hook.notify_and_wait();
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
) -> Result<(CacheKey, Arc<[GameRange]>), Error> {
    let key = snapshot_key(&snapshot);
    let games = map_scan_result(
        scan_games_cancelled(snapshot.file, cancellation),
        cancellation,
    )?
    .into();
    Ok((key, games))
}

fn map_scan_result<T>(result: io::Result<T>, cancellation: &CancellationToken) -> Result<T, Error> {
    match result {
        Err(error) if error.kind() == io::ErrorKind::Interrupted && cancellation.is_cancelled() => {
            Err(Error::Cancellation)
        }
        result => result.map_err(Error::from),
    }
}

async fn scan_current(
    snapshot: crate::infra::path_authority::PgnSnapshot,
    repository: &PgnRepository,
    cancellation: &CancellationToken,
) -> Result<(CacheKey, Arc<[GameRange]>), Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let key = snapshot_key(&snapshot);
    if let Some(games) = repository.get(&key)? {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        return Ok((key, games));
    }
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    #[cfg(test)]
    let scan_line_hook = repository.scan_line_hook()?;
    let (key, games) = BLOCKING_GATEWAY
        .spawn_cancellable(cancellation.clone(), move |token| {
            #[cfg(test)]
            let _guard = scan_line_hook.map(|hook| {
                set_scan_line_hook(Some(hook));
                struct HookGuard;
                impl Drop for HookGuard {
                    fn drop(&mut self) {
                        set_scan_line_hook(None);
                    }
                }
                HookGuard
            });
            scan_file(snapshot, token)
        })
        .await?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    repository.retain_if_within_budget(key.clone(), games.clone())?;
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

fn read_range_bytes(
    file: &mut File,
    range: GameRange,
    cancellation: &CancellationToken,
) -> Result<Vec<u8>, Error> {
    let bytes = range
        .end
        .checked_sub(range.start)
        .ok_or_else(|| Error::Conflict("invalid cached PGN byte range".into()))?;
    let len =
        usize::try_from(bytes).map_err(|_| Error::ResourceLimit("PGN game is too large".into()))?;
    if len > MAX_PGN_BYTES {
        return Err(Error::ResourceLimit("PGN game exceeds 10 MiB".into()));
    }
    file.seek(SeekFrom::Start(range.start))?;
    let mut data = vec![0; len];
    let mut offset = 0;
    while offset < len {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let chunk = (len - offset).min(64 * 1024);
        file.read_exact(&mut data[offset..offset + chunk])?;
        offset += chunk;
        #[cfg(test)]
        if let Some(hook) = current_read_chunk_hook() {
            hook.notify_and_wait();
        }
    }
    Ok(data)
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
        let data = read_range_bytes(&mut file, range, cancellation)?;
        games.push(
            String::from_utf8(data)
                .map_err(|error| malformed(&format!("invalid UTF-8 PGN: {error}")))?,
        );
    }
    Ok(games)
}

async fn scan_and_read_ranges<T>(
    resolved: crate::infra::path_authority::ResolvedPath,
    repository: &PgnRepository,
    cancellation: &CancellationToken,
    select: impl FnOnce(&CacheKey, &[GameRange]) -> Result<(T, Vec<GameRange>), Error>,
) -> Result<(CacheKey, T, Vec<String>), Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let snapshot = resolved.pgn_snapshot()?;
    let read_file = snapshot.file.try_clone()?;
    let (key, games) = scan_current(snapshot, repository, cancellation).await?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let (selection, requested) = select(&key, &games)?;
    #[cfg(test)]
    let test_hook = repository.read_chunk_hook()?;
    let values = BLOCKING_GATEWAY
        .spawn_cancellable(cancellation.clone(), move |token| {
            #[cfg(test)]
            let _guard = test_hook.map(|hook| {
                set_read_chunk_hook(Some(hook));
                struct HookGuard;
                impl Drop for HookGuard {
                    fn drop(&mut self) {
                        set_read_chunk_hook(None);
                    }
                }
                HookGuard
            });
            read_ranges(read_file, requested, token)
        })
        .await?;
    Ok((key, selection, values))
}

fn game_stamp(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn revision_string(key: &CacheKey) -> String {
    let (device, inode) = key.identity.pair();
    format!(
        "{device}:{inode}:{}:{}:{}",
        key.revision.size, key.revision.mtime_nanos, key.revision.ctime_nanos
    )
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

fn edit_existing(
    resolved: &crate::infra::path_authority::ResolvedPath,
    expected: CacheKey,
    snapshot: crate::infra::path_authority::PgnSnapshot,
    target: GameRange,
    replacement: Option<Vec<u8>>,
    cancellation: &CancellationToken,
) -> Result<crate::infra::fs::AtomicInstalledFile, Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    resolved.replace_pgn_atomic(&snapshot, |source, temporary| {
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
    })
}

#[tauri::command]
#[specta::specta]
pub async fn count_pgn_games(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    ticket: Option<String>,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<i32, Error> {
    let operation = crate::native_read_operation(ticket, &window, &state, "count_pgn_games")?;
    let cancellation = operation.token();
    let repository = state.pgn_repository.clone();
    let resolved = resolve_pgn(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::ReadPgn,
    )?;
    crate::infra::operations::run_native_operation(operation, "count_pgn_games", async move {
        count_pgn_games_core(resolved, &cancellation, &repository).await
    })
    .await
}

pub async fn count_pgn_games_core(
    resolved: crate::infra::path_authority::ResolvedPath,
    cancellation: &CancellationToken,
    repository: &PgnRepository,
) -> Result<i32, Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    #[cfg(test)]
    if let Some(hook) = repository.count_hook()? {
        hook.notify_and_wait();
    }
    let (key, games) = scan_current(resolved.pgn_snapshot()?, repository, cancellation).await?;
    let _ = key;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    i32::try_from(games.len())
        .map_err(|_| Error::ResourceLimit("PGN count exceeds IPC limit".into()))
}

#[tauri::command]
#[specta::specta]
pub async fn read_games(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    start: i32,
    end: i32,
    ticket: Option<String>,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, Error> {
    let operation = crate::native_read_operation(ticket, &window, &state, "read_games")?;
    let cancellation = operation.token();
    let repository = state.pgn_repository.clone();
    let resolved = resolve_pgn(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::ReadPgn,
    )?;
    crate::infra::operations::run_native_operation(operation, "read_games", async move {
        read_games_core(resolved, start, end, &cancellation, &repository).await
    })
    .await
}

pub async fn read_games_core(
    resolved: crate::infra::path_authority::ResolvedPath,
    start: i32,
    end: i32,
    cancellation: &CancellationToken,
    repository: &PgnRepository,
) -> Result<Vec<String>, Error> {
    let (start, count) = checked_range(start, end)?;
    let (_, (), values) = scan_and_read_ranges(resolved, repository, cancellation, |_, games| {
        let end = start
            .checked_add(count)
            .ok_or_else(|| Error::InvalidInput("game range overflows".into()))?;
        let requested = if games.is_empty() && start == 0 && count == 1 {
            Vec::new()
        } else {
            games
                .get(start..end)
                .ok_or_else(|| Error::InvalidInput("game index is out of bounds".into()))?
                .to_vec()
        };
        Ok(((), requested))
    })
    .await?;
    Ok(values)
}

#[tauri::command]
#[specta::specta]
pub async fn read_game(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    n: i32,
    ticket: Option<String>,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<StampedGame, Error> {
    let operation = crate::native_read_operation(ticket, &window, &state, "read_game")?;
    let cancellation = operation.token();
    let repository = state.pgn_repository.clone();
    let resolved = resolve_pgn(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::ReadPgn,
    )?;
    crate::infra::operations::run_native_operation(operation, "read_game", async move {
        read_game_core(resolved, n, &cancellation, &repository).await
    })
    .await
}

async fn read_game_core(
    resolved: crate::infra::path_authority::ResolvedPath,
    n: i32,
    cancellation: &CancellationToken,
    repository: &PgnRepository,
) -> Result<StampedGame, Error> {
    let n = checked_index(n)?;
    let (key, present, values) =
        scan_and_read_ranges(resolved, repository, cancellation, |_key, games| {
            if n < games.len() {
                Ok((true, vec![games[n]]))
            } else if n == games.len() {
                Ok((false, Vec::new()))
            } else {
                Err(Error::InvalidInput("game index is out of bounds".into()))
            }
        })
        .await?;
    let pgn = if present {
        values
            .into_iter()
            .next()
            .ok_or_else(|| Error::Conflict("PGN read returned no selected game".into()))?
    } else {
        String::new()
    };
    Ok(StampedGame {
        stamp: game_stamp(pgn.as_bytes()),
        pgn,
        revision: revision_string(&key),
        present,
    })
}

struct PgnMutation {
    target: GameRange,
    replacement: Option<Vec<u8>>,
    expectation: Option<WriteExpectation>,
    operation_name: &'static str,
    rebind: Option<PgnCapabilityRebind>,
}

async fn commit_pgn_mutation(
    resolved: crate::infra::path_authority::ResolvedPath,
    key: CacheKey,
    mutation: PgnMutation,
    repository: &PgnRepository,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    let PgnMutation {
        target,
        replacement,
        expectation,
        operation_name,
        rebind,
    } = mutation;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let commit_snapshot = resolved.pgn_snapshot()?;
    if snapshot_key(&commit_snapshot) != key {
        return Err(Error::Conflict("PGN changed after scan".into()));
    }
    if let Some(expectation) = expectation {
        let matched = match expectation {
            WriteExpectation::Append => {
                target.start == key.revision.size && target.end == key.revision.size
            }
            WriteExpectation::Game { stamp } => {
                let mut file = commit_snapshot.file.try_clone()?;
                let range = target;
                let actual = BLOCKING_GATEWAY
                    .spawn_cancellable(cancellation.clone(), move |token| {
                        let bytes = read_range_bytes(&mut file, range, token)?;
                        Ok(game_stamp(&bytes))
                    })
                    .await?;
                actual == stamp
            }
        };
        if !matched {
            return Err(Error::StaleGame);
        }
    }
    let identity = key.identity.clone();
    #[cfg(test)]
    let edit_hook = repository.edit_worker_hook()?;
    #[cfg(test)]
    let atomic_injector = repository.atomic_file_injector()?;

    let edit_result = BLOCKING_GATEWAY
        .spawn_cancellable(cancellation.clone(), move |token| {
            #[cfg(test)]
            if let Some(ref hook) = edit_hook {
                hook.notify_and_wait();
            }
            #[cfg(test)]
            let _injector_guard = atomic_injector.map(|inj| {
                crate::infra::fs::set_test_atomic_file_injector(Some(inj));
                struct InjectorGuard;
                impl Drop for InjectorGuard {
                    fn drop(&mut self) {
                        crate::infra::fs::set_test_atomic_file_injector(None);
                    }
                }
                InjectorGuard
            });
            let installed = edit_existing(
                &resolved,
                key.clone(),
                commit_snapshot,
                target,
                replacement,
                token,
            )?;
            let rebind_result =
                rebind.map(|rebind| rebind.after_replace(key.identity.pair(), installed.identity));
            Ok((installed, rebind_result))
        })
        .await;

    let (installed, rebind_result) = match edit_result {
        Ok(result) => result,
        Err(err) => return Err(err),
    };
    let pgn_outcome = crate::infra::fs::require_durable(
        installed.outcome,
        crate::error::DurabilityStage::PgnEdit,
    );
    let rebind_outcome = match rebind_result {
        Some(result) => result,
        None => Ok(()),
    };
    let edit_outcome = match (pgn_outcome, rebind_outcome) {
        (Ok(()), Ok(())) => Ok(()),
        (Err(error), Ok(())) | (Ok(()), Err(error)) => Err(error),
        (Err(primary), Err(cleanup)) => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: cleanup.to_string(),
        }),
    };

    if let Err(invalidation_error) = repository.invalidate(&identity) {
        log::warn!("{operation_name} cache invalidation failed: {invalidation_error}");
        if edit_outcome.is_ok() {
            return Err(invalidation_error);
        }
    }

    edit_outcome
}

#[tauri::command]
#[specta::specta]
pub async fn delete_game(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    n: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    crate::infra::platform_support::off_unix_refusal("PGN atomic replacement", cfg!(unix))?;
    let lease = state.operations.accept("delete_game")?;
    let resolved = resolve_pgn(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::WritePgn,
    )?;
    let repository = state.pgn_repository.clone();
    let rebind = PgnCapabilityRebind {
        authority: Arc::clone(&state.pgn_path_authority),
        path_ref: file.path_ref().clone(),
    };
    delete_game_core(lease, resolved, n, repository, Some(rebind)).await
}

pub async fn delete_game_core(
    lease: OperationLease,
    resolved: crate::infra::path_authority::ResolvedPath,
    n: i32,
    repository: PgnRepository,
    rebind: Option<PgnCapabilityRebind>,
) -> Result<(), Error> {
    let cancellation = lease.token();
    crate::infra::operations::run_native_operation(lease, "delete_game", async move {
        let n = checked_index(n)?;
        let scan_snapshot = resolved.pgn_snapshot()?;
        let identity = scan_snapshot.identity.clone();
        let lock = repository.edit_lock(identity.clone())?;
        #[cfg(test)]
        repository.notify_edit_lock_wait()?;
        let _guard = tokio::select! {
            guard = lock.lock() => guard,
            _ = cancellation.cancelled() => return Err(Error::Cancellation),
        };
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let (key, games) = scan_current(scan_snapshot, &repository, &cancellation).await?;
        let range = games
            .get(n)
            .cloned()
            .ok_or_else(|| Error::InvalidInput("game index is out of bounds".into()))?;
        commit_pgn_mutation(
            resolved,
            key,
            PgnMutation {
                target: range,
                replacement: None,
                expectation: None,
                operation_name: "delete_game",
                rebind,
            },
            &repository,
            &cancellation,
        )
        .await
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn write_game(
    file: crate::infra::path_authority::FileWorkspaceHandle,
    n: i32,
    pgn: String,
    expected: WriteExpectation,
    state: tauri::State<'_, AppState>,
) -> Result<WriteStamp, Error> {
    crate::infra::platform_support::off_unix_refusal("PGN atomic replacement", cfg!(unix))?;
    let lease = state.operations.accept("write_game")?;
    let resolved = resolve_pgn(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::WritePgn,
    )?;
    let repository = state.pgn_repository.clone();
    let rebind = PgnCapabilityRebind {
        authority: Arc::clone(&state.pgn_path_authority),
        path_ref: file.path_ref().clone(),
    };
    write_game_core(lease, resolved, n, pgn, expected, repository, Some(rebind)).await
}

pub async fn write_game_core(
    lease: OperationLease,
    resolved: crate::infra::path_authority::ResolvedPath,
    n: i32,
    pgn: String,
    expected: WriteExpectation,
    repository: PgnRepository,
    rebind: Option<PgnCapabilityRebind>,
) -> Result<WriteStamp, Error> {
    let cancellation = lease.token();
    crate::infra::operations::run_native_operation(lease, "write_game", async move {
        let game_number = n;
        let n = checked_index(n)?;
        if pgn.len() > MAX_PGN_BYTES {
            return Err(Error::ResourceLimit(
                "replacement PGN exceeds 10 MiB".into(),
            ));
        }
        // Validate text before creating a replacement; malformed UTF-8 cannot enter through String.
        let replacement = pgn.as_bytes().to_vec();
        let scan_snapshot = resolved.pgn_snapshot()?;
        let identity = scan_snapshot.identity.clone();
        let lock = repository.edit_lock(identity.clone())?;
        #[cfg(test)]
        repository.notify_edit_lock_wait()?;
        let _guard = tokio::select! {
            guard = lock.lock() => guard,
            _ = cancellation.cancelled() => return Err(Error::Cancellation),
        };
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let (key, games) = scan_current(scan_snapshot, &repository, &cancellation).await?;
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
        let readback_capability = rebind.clone();
        commit_pgn_mutation(
            resolved,
            key,
            PgnMutation {
                target,
                replacement: Some(replacement),
                expectation: Some(expected),
                operation_name: "write_game",
                rebind,
            },
            &repository,
            &cancellation,
        )
        .await?;

        #[cfg(test)]
        if let Some(hook) = repository.post_commit_hook()? {
            hook.notify_and_wait();
        }

        let stamp = if let Some(rebind) = readback_capability {
            if let Ok(readback_path) = rebind.resolve_read() {
                match read_game_core(readback_path, game_number, &cancellation, &repository).await {
                    Ok(readback) if readback.pgn.trim() == pgn.trim() => Some(readback.stamp),
                    _ => None,
                }
            } else {
                None
            }
        } else {
            None
        };
        Ok(WriteStamp { stamp })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{BufWriter, Cursor},
        path::Path,
        time::Duration,
    };
    use tauri::Manager;

    fn resolved_for(
        directory: &tempfile::TempDir,
        path: &Path,
    ) -> crate::infra::path_authority::ResolvedPath {
        let mut authority = crate::infra::path_authority::PathAuthority::open(
            directory.path().join("registry.json"),
            vec![],
        )
        .expect("open path authority");
        let descriptor = authority
            .create_pgn_export_destination(path, "test PGN")
            .expect("register PGN");
        authority
            .resolve(
                descriptor.handle.path_ref(),
                crate::infra::path_authority::PathOperation::ReadPgn,
                &[],
            )
            .expect("resolve PGN")
    }

    fn snapshot_for(
        directory: &tempfile::TempDir,
        path: &Path,
    ) -> crate::infra::path_authority::PgnSnapshot {
        resolved_for(directory, path)
            .pgn_snapshot()
            .expect("snapshot PGN")
    }

    fn with_line_ending(value: &str, line_ending: &str) -> Vec<u8> {
        value.replace('\n', line_ending).into_bytes()
    }

    fn for_each_scan_variant(mut assertion: impl FnMut(&str, &[u8])) {
        for line_ending in ["\n", "\r\n"] {
            for bom in [b"".as_slice(), b"\xef\xbb\xbf".as_slice()] {
                assertion(line_ending, bom);
            }
        }
    }

    fn assert_scan_variants(leading: &str, expected_games: &[&str]) {
        for_each_scan_variant(|line_ending, bom| {
            let leading = with_line_ending(leading, line_ending);
            let expected_games: Vec<Vec<u8>> = expected_games
                .iter()
                .map(|game| with_line_ending(game, line_ending))
                .collect();
            let mut data = bom.to_vec();
            data.extend_from_slice(&leading);
            for game in &expected_games {
                data.extend_from_slice(game);
            }

            let ranges = scan_games(Cursor::new(&data)).expect("scan PGN fixture");
            assert_eq!(ranges.len(), expected_games.len());
            let mut expected_start = (bom.len() + leading.len()) as u64;
            for (range, expected_game) in ranges.iter().zip(&expected_games) {
                let expected_end = expected_start + expected_game.len() as u64;
                assert_eq!(range.start, expected_start);
                assert_eq!(range.end, expected_end);
                assert_eq!(
                    &data[range.start as usize..range.end as usize],
                    expected_game
                );
                expected_start = expected_end;
            }
        });
    }

    fn assert_invalid_scan_variants(data: &str) {
        for_each_scan_variant(|line_ending, bom| {
            let data = with_line_ending(data, line_ending);
            let mut fixture = bom.to_vec();
            fixture.extend_from_slice(&data);
            assert_eq!(
                scan_games(Cursor::new(fixture))
                    .expect_err("unterminated comment must fail")
                    .kind(),
                io::ErrorKind::InvalidData
            );
        });
    }

    fn writable_for(
        directory: &tempfile::TempDir,
        path: &Path,
    ) -> crate::infra::path_authority::ResolvedPath {
        let mut authority = crate::infra::path_authority::PathAuthority::open(
            directory.path().join("registry.json"),
            vec![],
        )
        .expect("open path authority");
        let descriptor = authority
            .create_pgn_export_destination(path, "test PGN")
            .expect("register PGN");
        authority
            .resolve(
                descriptor.handle.path_ref(),
                crate::infra::path_authority::PathOperation::WritePgn,
                &[],
            )
            .expect("resolve writable PGN")
    }

    #[cfg(unix)]
    fn promote_pgn_file(
        authority: &mut crate::infra::path_authority::PathAuthority,
        path: &Path,
    ) -> crate::infra::path_authority::FileWorkspaceHandle {
        use crate::infra::path_authority::{PathClass, PathOperation};

        let operations = vec![PathOperation::ReadPgn, PathOperation::WritePgn];
        let grant = authority
            .grant_dialog_operations(
                path,
                "picked PGN",
                PathClass::BoundedDialogGrant,
                operations.clone(),
                Duration::from_secs(60),
                1,
            )
            .expect("grant picked PGN");
        let committed = authority
            .promote_dialog(&grant, PathClass::PersistentFile, "picked PGN", operations)
            .expect("promote picked PGN");
        crate::infra::path_authority::FileWorkspaceHandle::new(committed.id)
    }

    #[cfg(unix)]
    fn promote_pgn_workspace(
        authority: &mut crate::infra::path_authority::PathAuthority,
        path: &Path,
    ) -> crate::infra::path_authority::FileWorkspaceHandle {
        use crate::infra::path_authority::{PathClass, PathOperation};

        let operations = vec![PathOperation::ReadPgn, PathOperation::WritePgn];
        let grant = authority
            .grant_dialog_operations(
                path,
                "PGN workspace",
                PathClass::BoundedDialogGrant,
                operations.clone(),
                Duration::from_secs(60),
                1,
            )
            .expect("grant PGN workspace");
        let committed = authority
            .promote_dialog(
                &grant,
                PathClass::PersistentCustomRoot,
                "PGN workspace",
                operations,
            )
            .expect("promote PGN workspace");
        crate::infra::path_authority::FileWorkspaceHandle::new(committed.id)
    }

    #[cfg(unix)]
    fn fs_identity(path: &Path) -> (u64, u64) {
        use std::os::unix::fs::MetadataExt;

        let metadata = std::fs::metadata(path).expect("stat PGN fixture");
        (metadata.dev(), metadata.ino())
    }

    #[cfg(unix)]
    fn registry_identity(
        registry_path: &Path,
        id: &crate::infra::path_authority::PathRef,
    ) -> (u64, u64) {
        let bytes = std::fs::read(registry_path).expect("read path registry");
        let registry: serde_json::Value =
            serde_json::from_slice(&bytes).expect("decode path registry");
        let entries = registry
            .get("entries")
            .and_then(serde_json::Value::as_array)
            .expect("registry entries");
        let entry = entries
            .iter()
            .find(|entry| {
                entry
                    .get("id")
                    .and_then(|id| id.get("id"))
                    .and_then(serde_json::Value::as_str)
                    == Some(id.id.as_str())
            })
            .expect("capability registry entry");
        let identity = entry.get("identity").expect("stored identity");
        (
            identity
                .get("a")
                .and_then(serde_json::Value::as_u64)
                .expect("stored device identity"),
            identity
                .get("b")
                .and_then(serde_json::Value::as_u64)
                .expect("stored inode identity"),
        )
    }

    #[cfg(unix)]
    async fn write_through_capability(
        app: &tauri::AppHandle<tauri::test::MockRuntime>,
        handle: &crate::infra::path_authority::FileWorkspaceHandle,
        n: i32,
        pgn: String,
    ) -> Result<WriteStamp, Error> {
        let (lease, resolved, readback_path, repository, rebind) = {
            let state = app.state::<AppState>();
            let lease = state.operations.accept("write_game")?;
            let resolved = resolve_pgn(
                &state,
                handle,
                crate::infra::path_authority::PathOperation::WritePgn,
            )?;
            let readback_path = resolve_pgn(
                &state,
                handle,
                crate::infra::path_authority::PathOperation::ReadPgn,
            )?;
            let repository = state.pgn_repository.clone();
            let rebind = PgnCapabilityRebind {
                authority: Arc::clone(&state.pgn_path_authority),
                path_ref: handle.path_ref().clone(),
            };
            (lease, resolved, readback_path, repository, rebind)
        };
        let current =
            read_game_core(readback_path, n, &CancellationToken::new(), &repository).await?;
        write_game_core(
            lease,
            resolved,
            n,
            pgn,
            WriteExpectation::Game {
                stamp: current.stamp,
            },
            repository,
            Some(rebind),
        )
        .await
    }

    #[cfg(unix)]
    async fn append_through_capability(
        app: &tauri::AppHandle<tauri::test::MockRuntime>,
        handle: &crate::infra::path_authority::FileWorkspaceHandle,
        n: i32,
        pgn: String,
    ) -> Result<WriteStamp, Error> {
        let (lease, resolved, repository, rebind) = {
            let state = app.state::<AppState>();
            let lease = state.operations.accept("write_game")?;
            let resolved = resolve_pgn(
                &state,
                handle,
                crate::infra::path_authority::PathOperation::WritePgn,
            )?;
            let repository = state.pgn_repository.clone();
            let rebind = PgnCapabilityRebind {
                authority: Arc::clone(&state.pgn_path_authority),
                path_ref: handle.path_ref().clone(),
            };
            (lease, resolved, repository, rebind)
        };
        write_game_core(
            lease,
            resolved,
            n,
            pgn,
            WriteExpectation::Append,
            repository,
            Some(rebind),
        )
        .await
    }

    #[cfg(unix)]
    async fn delete_through_capability(
        app: &tauri::AppHandle<tauri::test::MockRuntime>,
        handle: &crate::infra::path_authority::FileWorkspaceHandle,
        n: i32,
    ) -> Result<(), Error> {
        let (lease, resolved, repository, rebind) = {
            let state = app.state::<AppState>();
            let lease = state.operations.accept("delete_game")?;
            let resolved = resolve_pgn(
                &state,
                handle,
                crate::infra::path_authority::PathOperation::WritePgn,
            )?;
            let repository = state.pgn_repository.clone();
            let rebind = PgnCapabilityRebind {
                authority: Arc::clone(&state.pgn_path_authority),
                path_ref: handle.path_ref().clone(),
            };
            (lease, resolved, repository, rebind)
        };
        delete_game_core(lease, resolved, n, repository, Some(rebind)).await
    }

    #[test]
    #[cfg_attr(not(unix), ignore = "unported on this platform: f-20260914-10")]
    fn edit_existing_keeps_the_replacement_and_reports_uncertain_pgn_edit() {
        let directory = tempfile::tempdir().expect("PGN directory");
        let path = directory.path().join("games.pgn");
        std::fs::write(&path, "[Event \"before\"]\n\n1. e4 *\n").expect("PGN");
        let resolved = writable_for(&directory, &path);
        let snapshot = resolved.pgn_snapshot().expect("snapshot");
        let key = snapshot_key(&snapshot);
        let range = GameRange {
            start: 0,
            end: snapshot.revision.size,
        };
        crate::infra::fs::set_test_atomic_file_injector(Some(std::sync::Arc::new(
            crate::infra::fs::ParentSyncFault("uncertain"),
        )));
        let result = edit_existing(
            &resolved,
            key,
            snapshot,
            range,
            Some(b"[Event \"after\"]\n\n1. d4 *\n".to_vec()),
            &CancellationToken::new(),
        );
        crate::infra::fs::set_test_atomic_file_injector(None);
        assert!(matches!(
            crate::infra::fs::require_durable(
                result.expect("atomic replacement installed").outcome,
                crate::error::DurabilityStage::PgnEdit,
            ),
            Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::PgnEdit
            ))
        ));
        assert_eq!(
            std::fs::read_to_string(&path).expect("edited PGN"),
            "[Event \"after\"]\n\n1. d4 *\n"
        );
    }

    #[tokio::test]
    #[cfg(unix)]
    async fn persistent_file_capability_survives_own_replacements_and_registry_reload() {
        use crate::infra::path_authority::{PathAuthority, PathOperation};

        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("picked.pgn");
        let registry = directory.path().join("registry.json");
        std::fs::write(
            &path,
            "[Event \"First\"]\n\n1. e4 *\n\n[Event \"Second\"]\n\n1. d4 *\n",
        )
        .expect("write PGN fixture");
        let mut authority =
            PathAuthority::open(registry.clone(), vec![]).expect("open path authority");
        let handle = promote_pgn_file(&mut authority, &path);
        let app = mock_app();
        let authority_arc = {
            let state = app.state::<AppState>();
            let authority_arc = Arc::clone(&state.pgn_path_authority);
            *authority_arc.lock().expect("path authority lock") = Some(authority);
            authority_arc
        };

        let original_identity = fs_identity(&path);
        write_through_capability(
            &app,
            &handle,
            0,
            "[Event \"First write\"]\n\n1. d4 *\n".into(),
        )
        .await
        .expect("first capability write");
        let first_identity = fs_identity(&path);
        assert_ne!(first_identity, original_identity);
        assert_eq!(
            registry_identity(&registry, handle.path_ref()),
            first_identity
        );

        write_through_capability(
            &app,
            &handle,
            0,
            "[Event \"Second write\"]\n\n1. c4 *\n".into(),
        )
        .await
        .expect("second capability write");
        let second_identity = fs_identity(&path);
        assert_ne!(second_identity, first_identity);
        assert_eq!(
            registry_identity(&registry, handle.path_ref()),
            second_identity
        );

        delete_through_capability(&app, &handle, 0)
            .await
            .expect("capability delete");
        let deleted_identity = fs_identity(&path);
        assert_ne!(deleted_identity, second_identity);
        assert_eq!(
            registry_identity(&registry, handle.path_ref()),
            deleted_identity
        );

        let reloaded =
            PathAuthority::open(registry.clone(), vec![]).expect("reload path authority");
        *authority_arc.lock().expect("path authority lock") = Some(reloaded);
        let (resolved, repository) = {
            let state = app.state::<AppState>();
            let resolved = resolve_pgn(&state, &handle, PathOperation::ReadPgn)
                .expect("resolve capability after reload");
            (resolved, state.pgn_repository.clone())
        };
        let games = read_games_core(resolved, 0, 0, &CancellationToken::new(), &repository)
            .await
            .expect("read games after reload");
        assert_eq!(games.len(), 1);
        assert!(games[0].contains("[Event \"Second\"]"));
        assert_eq!(
            registry_identity(&registry, handle.path_ref()),
            deleted_identity
        );
    }

    #[tokio::test]
    #[cfg(unix)]
    async fn external_rename_replace_between_persistent_file_writes_stays_conflict() {
        use crate::infra::path_authority::PathAuthority;

        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("picked.pgn");
        let registry = directory.path().join("registry.json");
        std::fs::write(&path, "[Event \"Before\"]\n\n1. e4 *\n").expect("write PGN fixture");
        let mut authority =
            PathAuthority::open(registry.clone(), vec![]).expect("open path authority");
        let handle = promote_pgn_file(&mut authority, &path);
        let app = mock_app();
        {
            let state = app.state::<AppState>();
            *state
                .pgn_path_authority
                .lock()
                .expect("path authority lock") = Some(authority);
        }

        write_through_capability(
            &app,
            &handle,
            0,
            "[Event \"App write\"]\n\n1. d4 *\n".into(),
        )
        .await
        .expect("first capability write");
        let stored_identity = registry_identity(&registry, handle.path_ref());

        let external = directory.path().join("external.pgn");
        std::fs::write(&external, "[Event \"External\"]\n\n1. c4 *\n")
            .expect("write external replacement");
        std::fs::rename(&external, &path).expect("replace PGN from another writer");
        assert_ne!(fs_identity(&path), stored_identity);

        assert!(matches!(
            write_through_capability(
                &app,
                &handle,
                0,
                "[Event \"Must not commit\"]\n\n1. Nf3 *\n".into(),
            )
            .await,
            Err(Error::Conflict(_))
        ));
        assert_eq!(
            registry_identity(&registry, handle.path_ref()),
            stored_identity
        );
        assert!(std::fs::read_to_string(&path)
            .expect("read external PGN")
            .contains("[Event \"External\"]"));
    }

    #[tokio::test]
    #[cfg(unix)]
    async fn pgn_write_rebind_does_not_change_directory_rooted_workspace_handle() {
        use crate::infra::path_authority::{PathAuthority, PathOperation};
        use std::ffi::OsString;

        let directory = tempfile::tempdir().expect("temporary directory");
        let workspace_path = directory.path().join("workspace");
        std::fs::create_dir(&workspace_path).expect("create workspace");
        let path = workspace_path.join("study.pgn");
        std::fs::write(&path, "[Event \"Before\"]\n\n1. e4 *\n").expect("write PGN fixture");
        let registry = directory.path().join("registry.json");
        let mut authority =
            PathAuthority::open(registry.clone(), vec![]).expect("open path authority");
        let workspace = promote_pgn_workspace(&mut authority, &workspace_path);
        let child = authority
            .register_workspace_child_observed(
                &workspace,
                &[OsString::from("study.pgn")],
                "study.pgn",
                fs_identity(&path),
                false,
                PathOperation::WritePgn,
            )
            .expect("register workspace PGN");
        let root_identity = fs_identity(&workspace_path);
        assert_eq!(
            registry_identity(&registry, workspace.path_ref()),
            root_identity
        );

        let app = mock_app();
        let authority_arc = {
            let state = app.state::<AppState>();
            let authority_arc = Arc::clone(&state.pgn_path_authority);
            *authority_arc.lock().expect("path authority lock") = Some(authority);
            authority_arc
        };
        write_through_capability(&app, &child, 0, "[Event \"After\"]\n\n1. d4 *\n".into())
            .await
            .expect("write workspace PGN");

        assert_eq!(fs_identity(&workspace_path), root_identity);
        assert_eq!(
            registry_identity(&registry, workspace.path_ref()),
            root_identity
        );
        let resolved_root = authority_arc
            .lock()
            .expect("path authority lock")
            .as_mut()
            .expect("path authority initialized")
            .workspace_root(&workspace, PathOperation::ReadPgn)
            .expect("resolve unchanged workspace root");
        assert_eq!(resolved_root, workspace_path);
        assert_eq!(
            registry_identity(&registry, child.path_ref()),
            fs_identity(&path)
        );
    }

    fn key_with_size(key: &CacheKey, size: u64) -> CacheKey {
        CacheKey {
            identity: key.identity.clone(),
            revision: FileRevision {
                size,
                mtime_nanos: key.revision.mtime_nanos,
                ctime_nanos: key.revision.ctime_nanos,
            },
        }
    }

    fn mock_app() -> tauri::AppHandle<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(AppState::default());
        app.handle().clone()
    }

    #[tokio::test]
    async fn read_games_core_returns_complete_pages_and_rejects_missing_ranges() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("two-games.pgn");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4\n[Event \"B\"]\n\n1. d4\n")
            .expect("write PGN");
        let app = mock_app();
        let state = app.state::<AppState>();

        let page = read_games_core(
            resolved_for(&directory, &path),
            0,
            1,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await
        .expect("read complete two-game page");
        assert_eq!(page.len(), 2);
        assert!(page[0].starts_with("[Event \"A\"]"));
        assert!(page[1].starts_with("[Event \"B\"]"));

        let partial = read_games_core(
            resolved_for(&directory, &path),
            1,
            2,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await;
        assert!(matches!(
            partial,
            Err(Error::InvalidInput(message)) if message == "game index is out of bounds"
        ));

        let missing = read_games_core(
            resolved_for(&directory, &path),
            2,
            2,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await;
        assert!(matches!(
            missing,
            Err(Error::InvalidInput(message)) if message == "game index is out of bounds"
        ));
    }

    #[tokio::test]
    async fn read_games_core_preserves_only_the_empty_file_opening_range() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("empty.pgn");
        std::fs::write(&path, b"").expect("write empty PGN");
        let app = mock_app();
        let state = app.state::<AppState>();

        let opening = read_games_core(
            resolved_for(&directory, &path),
            0,
            0,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await
        .expect("empty opening range remains valid");
        assert!(opening.is_empty());

        let missing = read_games_core(
            resolved_for(&directory, &path),
            1,
            1,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await;
        assert!(matches!(
            missing,
            Err(Error::InvalidInput(message)) if message == "game index is out of bounds"
        ));
    }

    #[tokio::test]
    async fn read_game_stamps_exact_bom_prefixed_crlf_game_bytes() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("stamped-games.pgn");
        let first = b"[Event \"A\"]\r\n\r\n1. e4 *\r\n";
        let second = b"[Event \"B\"]\r\n\r\n1. d4 *\r\n";
        let mut fixture = b"\xef\xbb\xbf".to_vec();
        fixture.extend_from_slice(first);
        fixture.extend_from_slice(second);
        std::fs::write(&path, fixture).expect("write PGN fixture");
        let app = mock_app();
        let state = app.state::<AppState>();

        let game = read_game_core(
            resolved_for(&directory, &path),
            1,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await
        .expect("read second game with stamp");

        assert_eq!(game.pgn.as_bytes(), second);
        assert_eq!(game.stamp, game_stamp(second));
        assert!(game.present);
        assert!(!game.revision.is_empty());
    }

    #[tokio::test]
    async fn read_game_returns_the_empty_end_slot_and_rejects_beyond_it() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("end-slot.pgn");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4 *\n").expect("write PGN fixture");
        let app = mock_app();
        let state = app.state::<AppState>();

        let end = read_game_core(
            resolved_for(&directory, &path),
            1,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await
        .expect("read the append slot");
        assert_eq!(end.pgn, "");
        assert_eq!(end.stamp, game_stamp(b""));
        assert!(!end.present);

        let beyond = read_game_core(
            resolved_for(&directory, &path),
            2,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await;
        assert!(matches!(beyond, Err(Error::InvalidInput(_))));
    }

    #[tokio::test]
    async fn game_cas_at_end_of_empty_file_appends_and_returns_readback_stamp() {
        use crate::infra::path_authority::PathAuthority;

        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("empty-capability.pgn");
        let registry = directory.path().join("registry.json");
        std::fs::write(&path, b"").expect("write empty PGN");
        let mut authority = PathAuthority::open(registry, vec![]).expect("open authority");
        let handle = promote_pgn_file(&mut authority, &path);
        let app = mock_app();
        {
            let state = app.state::<AppState>();
            *state
                .pgn_path_authority
                .lock()
                .expect("path authority lock") = Some(authority);
        }
        let before = {
            let state = app.state::<AppState>();
            read_game_core(
                resolve_pgn(
                    &state,
                    &handle,
                    crate::infra::path_authority::PathOperation::ReadPgn,
                )
                .expect("resolve empty PGN"),
                0,
                &CancellationToken::new(),
                &state.pgn_repository,
            )
            .await
            .expect("read empty slot")
        };
        assert!(!before.present);
        assert_eq!(before.stamp, game_stamp(b""));

        let submitted = "[Event \"Created\"]\n\n1. e4 *\n";
        let written = write_through_capability(&app, &handle, 0, submitted.into())
            .await
            .expect("CAS write into empty slot");
        let after = {
            let state = app.state::<AppState>();
            read_game_core(
                resolve_pgn(
                    &state,
                    &handle,
                    crate::infra::path_authority::PathOperation::ReadPgn,
                )
                .expect("resolve written PGN"),
                0,
                &CancellationToken::new(),
                &state.pgn_repository,
            )
            .await
            .expect("read written game")
        };
        assert!(after.present);
        assert_eq!(written.stamp.as_deref(), Some(after.stamp.as_str()));
        assert_eq!(after.pgn.trim(), submitted.trim());
    }

    #[tokio::test]
    async fn stale_game_cas_refuses_without_changing_file_bytes() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("stale-cas.pgn");
        let original = b"[Event \"Before\"]\n\n1. e4 *\n";
        std::fs::write(&path, original).expect("write initial PGN");
        let app = mock_app();
        let state = app.state::<AppState>();
        let stale = read_game_core(
            writable_for(&directory, &path),
            0,
            &CancellationToken::new(),
            &state.pgn_repository,
        )
        .await
        .expect("read original game");
        let changed = b"[Event \"External\"]\n\n1. d4 d5 2. c4 *\n";
        std::fs::write(&path, changed).expect("external in-place write");

        let lease = state.operations.accept("write_game").expect("accept write");
        let result = write_game_core(
            lease,
            writable_for(&directory, &path),
            0,
            "[Event \"Replacement\"]\n\n1. c4 *\n".into(),
            WriteExpectation::Game { stamp: stale.stamp },
            state.pgn_repository.clone(),
            None,
        )
        .await;

        assert!(matches!(result, Err(Error::StaleGame)));
        assert_eq!(std::fs::read(&path).expect("read unchanged PGN"), changed);
    }

    #[tokio::test]
    async fn append_expectation_succeeds_at_end_and_rejects_after_another_append() {
        use crate::infra::path_authority::PathAuthority;

        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("append-cas.pgn");
        let registry = directory.path().join("registry.json");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4 *\n").expect("write initial PGN");
        let mut authority = PathAuthority::open(registry, vec![]).expect("open authority");
        let handle = promote_pgn_file(&mut authority, &path);
        let app = mock_app();
        let state = app.state::<AppState>();
        *state
            .pgn_path_authority
            .lock()
            .expect("path authority lock") = Some(authority);
        let result = write_game_core(
            state
                .operations
                .accept("write_game")
                .expect("accept append"),
            resolve_pgn(
                &state,
                &handle,
                crate::infra::path_authority::PathOperation::WritePgn,
            )
            .expect("resolve writable PGN"),
            1,
            "[Event \"B\"]\n\n1. d4 *\n".into(),
            WriteExpectation::Append,
            state.pgn_repository.clone(),
            Some(PgnCapabilityRebind {
                authority: Arc::clone(&state.pgn_path_authority),
                path_ref: handle.path_ref().clone(),
            }),
        )
        .await
        .expect("append at current end");
        assert!(result.stamp.is_some());
        let after_first = std::fs::read(&path).expect("read first append");
        let stale = append_through_capability(
            &app,
            &handle,
            1,
            "[Event \"Wrong end\"]\n\n1. c4 *\n".into(),
        )
        .await;
        assert!(matches!(stale, Err(Error::StaleGame)));
        assert_eq!(
            std::fs::read(&path).expect("read after stale append"),
            after_first
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    #[cfg(unix)]
    async fn committed_write_returns_no_stamp_if_post_commit_readback_differs() {
        use crate::infra::path_authority::PathAuthority;

        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("post-commit-change.pgn");
        let registry = directory.path().join("registry.json");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4 *\n").expect("write initial PGN");
        let mut authority = PathAuthority::open(registry, vec![]).expect("open authority");
        let handle = promote_pgn_file(&mut authority, &path);
        let app = mock_app();
        let state = app.state::<AppState>();
        *state
            .pgn_path_authority
            .lock()
            .expect("path authority lock") = Some(authority);
        let (hook, entered, release) = BoundedHook::new();
        state
            .pgn_repository
            .set_post_commit_hook(Some(hook))
            .expect("set post-commit hook");
        let writer_app = app.clone();
        let writer_handle = handle.clone();
        let task = tokio::spawn(async move {
            write_through_capability(
                &writer_app,
                &writer_handle,
                0,
                "[Event \"Written\"]\n\n1. d4 *\n".into(),
            )
            .await
        });
        tokio::time::timeout(Duration::from_secs(5), entered)
            .await
            .expect("post-commit hook entry timeout")
            .expect("post-commit hook entry");
        std::fs::write(&path, b"[Event \"External\"]\n\n1. c4 *\n")
            .expect("external in-place write after commit");
        drop(release);

        let written = task.await.expect("join writer").expect("committed write");
        assert_eq!(written.stamp, None);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    #[cfg(unix)]
    async fn committed_write_returns_success_without_stamp_if_readback_fails() {
        use crate::infra::path_authority::PathAuthority;

        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("post-commit-read-failure.pgn");
        let registry = directory.path().join("registry.json");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4 *\n").expect("write initial PGN");
        let mut authority = PathAuthority::open(registry, vec![]).expect("open authority");
        let handle = promote_pgn_file(&mut authority, &path);
        let app = mock_app();
        let state = app.state::<AppState>();
        *state
            .pgn_path_authority
            .lock()
            .expect("path authority lock") = Some(authority);
        let (hook, entered, release) = BoundedHook::new();
        state
            .pgn_repository
            .set_post_commit_hook(Some(hook))
            .expect("set post-commit hook");
        let writer_app = app.clone();
        let writer_handle = handle.clone();
        let task = tokio::spawn(async move {
            write_through_capability(
                &writer_app,
                &writer_handle,
                0,
                "[Event \"Written\"]\n\n1. d4 *\n".into(),
            )
            .await
        });
        tokio::time::timeout(Duration::from_secs(5), entered)
            .await
            .expect("post-commit hook entry timeout")
            .expect("post-commit hook entry");
        std::fs::write(&path, b"[Event \"External\"]\n\n\xff\n")
            .expect("replace bytes with invalid UTF-8 after commit");
        drop(release);

        let written = task.await.expect("join writer").expect("committed write");
        assert_eq!(written.stamp, None);
    }

    #[tokio::test]
    async fn cancel_long_single_game_read() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("long-game.pgn");
        let mut content = String::from("[Event \"Long Game\"]\n\n");
        while content.len() < 128 * 1024 {
            content.push_str(
                "1. e4 e5 2. Nf3 Nc6 { Comment padding to ensure multiple read chunks } ",
            );
        }
        content.push_str("1-0\n");
        std::fs::write(&path, content.as_bytes()).expect("write large PGN");

        let app = mock_app();
        let state = app.state::<AppState>();
        let resolved = resolved_for(&directory, &path);
        let token = CancellationToken::new();

        let (hook, entered, release) = BoundedHook::new();
        state
            .pgn_repository
            .set_read_chunk_hook(Some(hook))
            .expect("set read chunk hook");

        let repo = state.pgn_repository.clone();
        let token_clone = token.clone();
        let read_task =
            tokio::spawn(async move { read_games_core(resolved, 0, 0, &token_clone, &repo).await });

        // Prove stopping already-running actual read work: wait until chunk reading is active
        tokio::time::timeout(Duration::from_secs(5), entered)
            .await
            .expect("read chunk entered timeout")
            .expect("entered must receive");

        // Cancel while running in the chunk reading loop
        token.cancel();
        drop(release);

        let result = read_task.await.expect("read task must join");
        assert!(matches!(result, Err(Error::Cancellation)));
    }

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
    fn quoted_literal_brace_without_semicolon_does_not_start_a_comment() {
        assert_scan_variants(
            "",
            &[
                "[Event \"A\"]\n\n1. e4 \"quoted { literal\" e5\n",
                "[Event \"B\"]\n\n1. d4\n",
            ],
        );
    }

    #[test]
    fn escaped_quote_before_literal_brace_keeps_the_brace_quoted() {
        assert_scan_variants(
            "",
            &[
                "[Event \"A\"]\n\n1. e4 \"quoted \\\" { literal\" e5\n",
                "[Event \"B\"]\n\n1. d4\n",
            ],
        );
    }

    #[test]
    fn unterminated_comment_after_a_closing_quote_is_invalid_data() {
        assert_invalid_scan_variants("[Event \"A\"]\n\n1. e4 \"quoted literal\" {unterminated\n");
    }

    #[test]
    fn quoted_semicolon_before_an_unterminated_comment_is_invalid_data() {
        assert_invalid_scan_variants("[Event \"A\"]\n\n1. e4 \"quoted ; literal\" {unterminated\n");
    }

    #[test]
    fn percent_escape_lines_with_unmatched_braces_do_not_mask_games() {
        assert_scan_variants(
            "% { unmatched before games\n",
            &[
                "[Event \"A\"]\n\n1. e4\n% { unmatched between games\n",
                "[Event \"B\"]\n\n1. d4\n",
            ],
        );
    }

    #[test]
    fn inline_semicolon_comments_cannot_open_brace_comments() {
        let data = b"[Event \"A\"]\n\n1. e4 ; { ignored\n[Event \"B\"]\n\n1. d4\n";
        let ranges = scan_games(Cursor::new(data)).expect("scan PGN");
        assert_eq!(ranges.len(), 2);
        assert_eq!(
            &data[ranges[0].start as usize..ranges[0].end as usize],
            b"[Event \"A\"]\n\n1. e4 ; { ignored\n"
        );
        assert_eq!(
            &data[ranges[1].start as usize..ranges[1].end as usize],
            b"[Event \"B\"]\n\n1. d4\n"
        );
    }

    #[test]
    fn semicolons_and_braces_inside_comments_and_quoted_movetext_keep_their_context() {
        let data = b"[Event \"A\"]\n\n1. e4 { ; remains a brace comment\n} \"quoted ; { ignored\" e5\n[Event \"B\"]\n\n1. d4\n";
        let ranges = scan_games(Cursor::new(data)).expect("scan PGN");
        assert_eq!(ranges.len(), 2);
        assert_eq!(
            &data[ranges[0].start as usize..ranges[0].end as usize],
            b"[Event \"A\"]\n\n1. e4 { ; remains a brace comment\n} \"quoted ; { ignored\" e5\n"
        );
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
    fn scan_file_accepts_a_generated_300_mib_pgn() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("large.pgn");
        let file = File::create(&path).expect("create large PGN");
        let mut writer = BufWriter::new(file);
        writer
            .write_all(b"% generated without a corpus-sized fixture\n")
            .expect("write PGN preface");
        let mut comment_line = vec![b'a'; MAX_LINE_LEN - 1];
        comment_line.push(b'\n');
        for game in 0..301 {
            writeln!(writer, "[Event \"{game}\"]\n\n1. e4 {{").expect("write game header");
            writer
                .write_all(&comment_line)
                .expect("write bounded comment line");
            writer.write_all(b"} e5 1/2-1/2\n\n").expect("finish game");
        }
        writer.flush().expect("flush large PGN");

        let snapshot = snapshot_for(&directory, &path);
        let read_file = snapshot.file.try_clone().expect("clone PGN descriptor");
        assert!(snapshot.revision.size > 300 * 1024 * 1024);
        let expected_size = snapshot.revision.size;
        let (_, games) = scan_file(snapshot, &CancellationToken::new()).expect("scan large PGN");
        assert_eq!(games.len(), 301);
        assert_eq!(games[300].end, expected_size);
        let late_page = read_ranges(read_file, games[300..].to_vec(), &CancellationToken::new())
            .expect("read final game");
        assert_eq!(late_page.len(), 1);
        assert!(late_page[0].starts_with("[Event \"300\"]"));
        assert!(late_page[0].ends_with("} e5 1/2-1/2\n\n"));
    }

    #[test]
    fn scan_file_reads_a_late_page_beyond_100_000_games() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("many-games.pgn");
        let file = File::create(&path).expect("create many-game PGN");
        let mut writer = BufWriter::new(file);
        for game in 0..100_005 {
            writeln!(writer, "[Event \"{game}\"]\n\n1. e4\n").expect("write game");
        }
        writer.flush().expect("flush many-game PGN");

        let snapshot = snapshot_for(&directory, &path);
        let read_file = snapshot.file.try_clone().expect("clone PGN descriptor");
        let (_, games) =
            scan_file(snapshot, &CancellationToken::new()).expect("scan many-game PGN");
        assert_eq!(games.len(), 100_005);
        let late_page = read_ranges(
            read_file,
            games[100_000..100_005].to_vec(),
            &CancellationToken::new(),
        )
        .expect("read late page");
        assert_eq!(late_page.len(), 5);
        assert!(late_page[0].contains("[Event \"100000\"]"));
        assert!(late_page[4].contains("[Event \"100004\"]"));
    }

    #[tokio::test]
    async fn cache_hits_share_range_storage() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("cache.pgn");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4\n").expect("write PGN");
        let resolved = resolved_for(&directory, &path);
        let repository = PgnRepository::default();
        let (_, scanned) = scan_current(
            resolved.pgn_snapshot().expect("first snapshot"),
            &repository,
            &CancellationToken::new(),
        )
        .await
        .expect("initial scan");
        let (_, hit) = scan_current(
            resolved.pgn_snapshot().expect("second snapshot"),
            &repository,
            &CancellationToken::new(),
        )
        .await
        .expect("cached scan");
        assert!(Arc::ptr_eq(&scanned, &hit));
    }

    /// A same-length in-place rewrite that restores the last-write timestamp must still miss the
    /// offset cache. On Unix the inode `ctime` moves; on Windows the open handle's `ChangeTime`
    /// does. The rewrite goes through the pathname (`std::fs::write`) so identity, size and mtime
    /// stay equal and only the change stamp separates the two snapshots.
    #[tokio::test]
    async fn same_length_rewrite_restoring_mtime_misses_offset_cache() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("rewrite.pgn");
        let two_games = b"[Event \"A\"]\n\n1. e4\n[Event \"B\"]\n\n1. d4\n";
        std::fs::write(&path, two_games).expect("write two-game PGN");
        let resolved = resolved_for(&directory, &path);

        let first_mtime = std::fs::metadata(&path)
            .expect("read metadata")
            .modified()
            .expect("read modified time");
        let first = resolved.pgn_snapshot().expect("first snapshot");
        let first_identity = first.identity.clone();
        let first_revision = first.revision.clone();
        let repository = PgnRepository::default();
        let (_, first_games) = scan_current(first, &repository, &CancellationToken::new())
            .await
            .expect("initial scan");
        assert_eq!(first_games.len(), 2);

        // A one-game PGN padded with trailing whitespace to the exact byte length of the two-game
        // file, so the rewrite preserves `size` and cannot be blamed on a length change.
        let mut one_game = b"[Event \"A\"]\n\n1. e4\n".to_vec();
        one_game.resize(two_games.len(), b' ');
        std::fs::write(&path, &one_game).expect("same-length in-place rewrite");
        std::fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .expect("open rewrite for timestamp restore")
            .set_modified(first_mtime)
            .expect("restore last-write timestamp");

        let second = resolved.pgn_snapshot().expect("second snapshot");
        assert_eq!(
            second.identity, first_identity,
            "in-place rewrite keeps the same identity"
        );
        assert_eq!(
            second.revision.size, first_revision.size,
            "rewrite preserves the byte length"
        );
        assert_eq!(
            second.revision.mtime_nanos, first_revision.mtime_nanos,
            "rewrite restores the last-write timestamp"
        );
        #[cfg(windows)]
        assert_ne!(
            second.revision.ctime_nanos, first_revision.ctime_nanos,
            "ChangeTime must move when a rewrite restores LastWriteTime"
        );

        let (_, second_games) = scan_current(second, &repository, &CancellationToken::new())
            .await
            .expect("rescan after rewrite");
        assert!(
            !Arc::ptr_eq(&first_games, &second_games),
            "stale offset ranges must not be reused after the rewrite"
        );
        assert_eq!(second_games.len(), 1, "rewritten PGN holds one game");
    }

    /// Pins the Windows change stamp to an inline `GetFileInformationByHandleEx(FileBasicInfo)`
    /// query inside `pgn_snapshot_file`. Extracting it beside `windows_file_identity` would move
    /// the tokens out of the acceptance slice, so the pin reads the producer text directly.
    #[test]
    fn windows_pgn_revision_stamp_source_pin() {
        use crate::infra::blocking::source_scan::body_at_indent;

        let source = include_str!("infra/path_authority/resolved.rs");
        let slice = body_at_indent(source, "fn pgn_snapshot_file");
        assert!(
            slice.contains("GetFileInformationByHandleEx"),
            "the Windows change stamp must query the already-open handle"
        );
        assert!(
            slice.contains("ChangeTime"),
            "the Windows change stamp must be FILE_BASIC_INFO.ChangeTime"
        );
        assert!(
            !slice.contains("creation_time"),
            "the Windows change stamp must not fall back to creation_time"
        );
    }

    #[test]
    fn cache_byte_eviction_replacement_and_invalidation_account_exactly() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("cache-accounting.pgn");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4\n").expect("write PGN");
        let base = snapshot_key(&snapshot_for(&directory, &path));
        let range_bytes = std::mem::size_of::<GameRange>();
        let repository = PgnRepository {
            inner: Arc::new(std::sync::Mutex::new(PgnRepositoryInner::default())),
            cache_byte_limit: range_bytes * 4,
        };
        let key_one = key_with_size(&base, 1);
        let key_two = key_with_size(&base, 2);
        let key_three = key_with_size(&base, 3);
        let two_ranges: Arc<[GameRange]> = vec![GameRange { start: 0, end: 1 }; 2].into();
        repository
            .retain_if_within_budget(key_one.clone(), two_ranges.clone())
            .expect("insert first scan");
        repository
            .retain_if_within_budget(key_two.clone(), two_ranges.clone())
            .expect("insert second scan");
        assert!(repository
            .get(&key_one)
            .expect("touch first scan")
            .is_some());
        repository
            .retain_if_within_budget(key_three.clone(), two_ranges)
            .expect("insert third scan");
        assert!(repository.get(&key_one).expect("read first scan").is_some());
        assert!(repository
            .get(&key_two)
            .expect("read evicted scan")
            .is_none());
        assert!(repository
            .get(&key_three)
            .expect("read third scan")
            .is_some());

        let one_range: Arc<[GameRange]> = vec![GameRange { start: 0, end: 1 }].into();
        repository
            .retain_if_within_budget(key_one.clone(), one_range)
            .expect("replace first scan");
        assert_eq!(
            repository.inner().expect("inspect cache").retained_bytes,
            range_bytes * 3
        );
        repository
            .invalidate(&base.identity)
            .expect("invalidate identity");
        let inner = repository.inner().expect("inspect invalidated cache");
        assert!(inner.cache.is_empty());
        assert_eq!(inner.retained_bytes, 0);
    }

    #[tokio::test]
    async fn oversized_scan_is_returned_but_not_retained() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("oversized-cache.pgn");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4\n[Event \"B\"]\n\n1. d4\n")
            .expect("write PGN");
        let resolved = resolved_for(&directory, &path);
        let snapshot = resolved.pgn_snapshot().expect("snapshot PGN");
        let read_file = snapshot.file.try_clone().expect("clone PGN descriptor");
        let range_bytes = std::mem::size_of::<GameRange>();
        let repository = PgnRepository {
            inner: Arc::new(std::sync::Mutex::new(PgnRepositoryInner::default())),
            cache_byte_limit: range_bytes,
        };
        let (key, ranges) = scan_current(snapshot, &repository, &CancellationToken::new())
            .await
            .expect("scan remains available to caller");
        assert_eq!(ranges.len(), 2);
        let games = read_ranges(read_file, ranges.to_vec(), &CancellationToken::new())
            .expect("read returned ranges");
        assert!(games[0].starts_with("[Event \"A\"]"));
        assert!(games[1].starts_with("[Event \"B\"]"));
        assert!(repository.get(&key).expect("read cache").is_none());
        assert_eq!(repository.inner().expect("inspect cache").retained_bytes, 0);
    }

    #[tokio::test]
    #[cfg_attr(not(unix), ignore = "unported on this platform: f-20260914-10")]
    async fn held_accepted_write_caller_dropped_commits_and_invalidates_cache() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("write-held.pgn");
        std::fs::write(&path, b"[Event \"Initial\"]\n\n1. e4\n").expect("write PGN");
        let resolved = writable_for(&directory, &path);
        let snapshot = resolved.pgn_snapshot().expect("snapshot");

        let app = mock_app();
        let state = app.state::<AppState>();
        let repository = state.pgn_repository.clone();
        let operations = state.operations.clone();

        // Warm the cache so we can verify post-worker invalidation
        let (old_key, _) = scan_current(snapshot, &repository, &CancellationToken::new())
            .await
            .expect("warm cache");
        assert!(repository.get(&old_key).unwrap().is_some());

        // Install bounded hook on the worker
        let (hook, entered, release) = BoundedHook::new();
        repository
            .set_edit_worker_hook(Some(hook))
            .expect("set edit hook");

        let lease = operations.accept("write_game").unwrap();
        let replacement = "[Event \"Updated\"]\n\n1. d4 d5 1-0\n".to_string();
        let expected_stamp = read_game_core(
            writable_for(&directory, &path),
            0,
            &CancellationToken::new(),
            &repository,
        )
        .await
        .expect("read initial game")
        .stamp;
        let caller_task = tokio::spawn(write_game_core(
            lease,
            resolved,
            0,
            replacement,
            WriteExpectation::Game {
                stamp: expected_stamp,
            },
            repository.clone(),
            None,
        ));

        // Wait until worker is actively inside the blocking edit task
        tokio::time::timeout(Duration::from_secs(5), entered)
            .await
            .expect("timeout waiting for worker entry")
            .expect("worker must enter blocking task");

        // Drop the caller future while the accepted worker is running
        caller_task.abort();
        let _ = caller_task.await;

        // Release the worker to finish commit and invalidation
        drop(release);

        let drained = tokio::task::spawn_blocking(move || {
            operations.wait_for_drain(Duration::from_secs(5)).unwrap()
        })
        .await
        .unwrap();
        assert!(drained, "operations must drain after held write");

        // Assert exact old cached identity was invalidated and removed
        assert!(
            repository.get(&old_key).unwrap().is_none(),
            "exact old cache identity must be invalidated"
        );

        let content = std::fs::read_to_string(&path).expect("read committed file");
        assert!(
            content.contains("[Event \"Updated\"]"),
            "file on disk must contain the updated game"
        );
    }

    #[tokio::test]
    #[cfg_attr(not(unix), ignore = "unported on this platform: f-20260914-10")]
    async fn held_accepted_delete_caller_dropped_commits_and_invalidates_cache() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("delete-held.pgn");
        std::fs::write(
            &path,
            b"[Event \"First\"]\n\n1. e4\n\n[Event \"Second\"]\n\n1. d4\n",
        )
        .expect("write PGN");
        let resolved = writable_for(&directory, &path);
        let snapshot = resolved.pgn_snapshot().expect("snapshot");

        let app = mock_app();
        let state = app.state::<AppState>();
        let repository = state.pgn_repository.clone();
        let operations = state.operations.clone();

        // Warm the cache
        let (old_key, _) = scan_current(snapshot, &repository, &CancellationToken::new())
            .await
            .expect("warm cache");
        assert!(repository.get(&old_key).unwrap().is_some());

        // Install bounded hook on the worker
        let (hook, entered, release) = BoundedHook::new();
        repository
            .set_edit_worker_hook(Some(hook))
            .expect("set edit hook");

        let lease = operations.accept("delete_game").unwrap();
        let caller_task = tokio::spawn(delete_game_core(
            lease,
            resolved,
            0,
            repository.clone(),
            None,
        ));

        // Wait until worker is actively inside the blocking edit task
        tokio::time::timeout(Duration::from_secs(5), entered)
            .await
            .expect("timeout waiting for worker entry")
            .expect("worker must enter blocking task");

        // Drop the caller future while the accepted worker is running
        caller_task.abort();
        let _ = caller_task.await;

        // Release the worker to finish commit and invalidation
        drop(release);

        let drained = tokio::task::spawn_blocking(move || {
            operations.wait_for_drain(Duration::from_secs(5)).unwrap()
        })
        .await
        .unwrap();
        assert!(drained, "operations must drain after held delete");

        // Assert exact old cached identity was invalidated and removed
        assert!(
            repository.get(&old_key).unwrap().is_none(),
            "exact old cache identity must be invalidated"
        );

        let content = std::fs::read_to_string(&path).expect("read committed file");
        assert!(
            !content.contains("[Event \"First\"]") && content.contains("[Event \"Second\"]"),
            "file on disk must have first game deleted and second game preserved"
        );
    }

    #[tokio::test]
    #[cfg_attr(not(unix), ignore = "unported on this platform: f-20260914-10")]
    async fn held_accepted_write_caller_dropped_with_uncertain_durability_invalidates_cache() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("write-uncertain.pgn");
        std::fs::write(&path, b"[Event \"Initial\"]\n\n1. e4\n").expect("write PGN");
        let resolved = writable_for(&directory, &path);
        let snapshot = resolved.pgn_snapshot().expect("snapshot");

        let app = mock_app();
        let state = app.state::<AppState>();
        let repository = state.pgn_repository.clone();
        let operations = state.operations.clone();

        // Warm the cache
        let (old_key, _) = scan_current(snapshot, &repository, &CancellationToken::new())
            .await
            .expect("warm cache");
        assert!(repository.get(&old_key).unwrap().is_some());

        // Configure atomic file injector for parent sync fault (committed durability uncertain)
        repository
            .set_atomic_file_injector(Some(std::sync::Arc::new(
                crate::infra::fs::ParentSyncFault("injected sync fault"),
            )))
            .expect("set atomic injector");

        // Install bounded hook on the worker
        let (hook, entered, release) = BoundedHook::new();
        repository
            .set_edit_worker_hook(Some(hook))
            .expect("set edit hook");

        let lease = operations.accept("write_game").unwrap();
        let replacement = "[Event \"Updated\"]\n\n1. d4 d5 1-0\n".to_string();
        let expected_stamp = read_game_core(
            writable_for(&directory, &path),
            0,
            &CancellationToken::new(),
            &repository,
        )
        .await
        .expect("read initial game")
        .stamp;
        let caller_task = tokio::spawn(write_game_core(
            lease,
            resolved,
            0,
            replacement,
            WriteExpectation::Game {
                stamp: expected_stamp,
            },
            repository.clone(),
            None,
        ));

        // Wait until worker is actively inside the blocking edit task
        tokio::time::timeout(Duration::from_secs(5), entered)
            .await
            .expect("timeout waiting for worker entry")
            .expect("worker must enter blocking task");

        // Drop the caller future
        caller_task.abort();
        let _ = caller_task.await;

        // Release the worker
        drop(release);

        let drained = tokio::task::spawn_blocking(move || {
            operations.wait_for_drain(Duration::from_secs(5)).unwrap()
        })
        .await
        .unwrap();
        assert!(drained, "operations must drain after held write");

        // Assert exact old cached identity was invalidated despite durability uncertainty
        assert!(
            repository.get(&old_key).unwrap().is_none(),
            "cache identity must be invalidated on committed durability uncertainty"
        );

        let content = std::fs::read_to_string(&path).expect("read committed file");
        assert!(
            content.contains("[Event \"Updated\"]"),
            "committed file must be on disk"
        );
    }

    async fn queued_edit_shutdown_preserves_file(write: bool) {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join(if write {
            "queued-write.pgn"
        } else {
            "queued-delete.pgn"
        });
        let original = b"[Event \"First\"]\n\n1. e4\n\n[Event \"Second\"]\n\n1. d4\n";
        std::fs::write(&path, original).expect("write PGN");
        let resolved = writable_for(&directory, &path);
        let snapshot = resolved.pgn_snapshot().expect("snapshot");
        let identity = snapshot.identity.clone();
        let app = mock_app();
        let state = app.state::<AppState>();
        let repository = state.pgn_repository.clone();
        let operations = state.operations.clone();
        let (old_key, _) = scan_current(snapshot, &repository, &CancellationToken::new())
            .await
            .expect("warm cache");
        let lock = repository.edit_lock(identity).expect("edit lock");
        let held = lock.lock().await;
        let waiting = repository
            .observe_edit_lock_wait()
            .expect("observe edit wait");
        let expected_stamp = if write {
            Some(
                read_game_core(
                    writable_for(&directory, &path),
                    0,
                    &CancellationToken::new(),
                    &repository,
                )
                .await
                .expect("read game before queued write")
                .stamp,
            )
        } else {
            None
        };
        let lease = operations
            .accept(if write { "write_game" } else { "delete_game" })
            .expect("accept edit");
        let task = if write {
            let write_repository = repository.clone();
            tokio::spawn(async move {
                write_game_core(
                    lease,
                    resolved,
                    0,
                    "[Event \"Replacement\"]\n\n1. c4\n".into(),
                    WriteExpectation::Game {
                        stamp: expected_stamp.unwrap_or_else(|| game_stamp(b"")),
                    },
                    write_repository,
                    None,
                )
                .await
                .map(|_| ())
            })
        } else {
            tokio::spawn(delete_game_core(
                lease,
                resolved,
                0,
                repository.clone(),
                None,
            ))
        };
        tokio::time::timeout(Duration::from_secs(5), waiting)
            .await
            .expect("edit wait timeout")
            .expect("edit reached held lock");
        operations
            .seal_and_request_cancellation()
            .expect("request shutdown cancellation");
        let error = tokio::time::timeout(Duration::from_secs(5), task)
            .await
            .expect("queued edit must stop while lock remains held")
            .expect("join queued edit")
            .expect_err("queued edit must cancel");
        assert!(matches!(error, Error::Cancellation));
        assert_eq!(std::fs::read(&path).expect("read unchanged PGN"), original);
        assert!(
            repository.get(&old_key).expect("read cache").is_some(),
            "pre-mutation cancellation must preserve the current scan cache"
        );
        drop(held);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn shutdown_cancels_write_queued_at_actual_edit_lock() {
        queued_edit_shutdown_preserves_file(true).await;
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn shutdown_cancels_delete_queued_at_actual_edit_lock() {
        queued_edit_shutdown_preserves_file(false).await;
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn active_production_scan_serializes_as_cancellation() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("cancelled.pgn");
        std::fs::write(&path, b"[Event \"A\"]\n\n1. e4\n").expect("write PGN");
        let repository = PgnRepository::default();
        let (hook, entered, release) = BoundedHook::new();
        repository
            .set_scan_line_hook(Some(hook))
            .expect("set scan hook");
        let cancellation = CancellationToken::new();
        let worker_token = cancellation.clone();
        let task = tokio::spawn(async move {
            count_pgn_games_core(resolved_for(&directory, &path), &worker_token, &repository).await
        });
        tokio::time::timeout(Duration::from_secs(5), entered)
            .await
            .expect("scan entry timeout")
            .expect("scan entered");
        cancellation.cancel();
        release.send(()).expect("release scan");
        let error = task
            .await
            .expect("join active scan")
            .expect_err("cancelled scan must fail");
        assert!(matches!(error, Error::Cancellation));
        let serialized = serde_json::to_value(&error).expect("serialize cancellation");
        assert_eq!(serialized["category"], "cancellation");
    }

    #[test]
    fn unrelated_interrupted_and_malformed_scans_remain_io_errors() {
        let interrupted = map_scan_result::<()>(
            Err(io::Error::new(io::ErrorKind::Interrupted, "unrelated read")),
            &CancellationToken::new(),
        )
        .expect_err("unrelated interruption must remain I/O");
        assert!(matches!(
            interrupted,
            Error::Io(ref source) if source.kind() == io::ErrorKind::Interrupted
        ));

        let malformed = scan_games(Cursor::new(b"[Event \"A\"]\n\n{ open\n"))
            .expect_err("unclosed comment must be malformed");
        assert_eq!(malformed.kind(), io::ErrorKind::InvalidData);
        let serialized = serde_json::to_value(Error::from(malformed)).expect("serialize I/O");
        assert_eq!(serialized["category"], "io");
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
