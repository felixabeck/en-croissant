use std::{
    collections::HashMap,
    fs::File,
    io::{self, BufRead, BufReader, Read, Seek, SeekFrom, Write},
    sync::Arc,
};

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

    #[cfg(test)]
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
    let outcome = resolved.replace_pgn_atomic(&snapshot, |source, temporary| {
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
    })?;
    crate::infra::fs::require_durable(outcome, crate::error::DurabilityStage::PgnEdit)
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
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let (start, count) = checked_range(start, end)?;
    let snapshot = resolved.pgn_snapshot()?;
    let read_file = snapshot.file.try_clone()?;
    let (_key, games) = scan_current(snapshot, repository, cancellation).await?;
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
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
    #[cfg(test)]
    let test_hook = repository.read_chunk_hook()?;
    BLOCKING_GATEWAY
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
        .await
}

async fn commit_pgn_mutation(
    resolved: crate::infra::path_authority::ResolvedPath,
    key: CacheKey,
    target: GameRange,
    replacement: Option<Vec<u8>>,
    repository: &PgnRepository,
    operation_name: &'static str,
    cancellation: &CancellationToken,
) -> Result<(), Error> {
    if cancellation.is_cancelled() {
        return Err(Error::Cancellation);
    }
    let commit_snapshot = resolved.pgn_snapshot()?;
    if snapshot_key(&commit_snapshot) != key {
        return Err(Error::Conflict("PGN changed after scan".into()));
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
            edit_existing(&resolved, key, commit_snapshot, target, replacement, token)
        })
        .await;

    let edit_outcome = match edit_result {
        Ok(()) => Ok(()),
        Err(Error::CommittedDurabilityUncertain(stage)) => {
            Err(Error::CommittedDurabilityUncertain(stage))
        }
        Err(err) => return Err(err),
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
    let lease = state.operations.accept("delete_game")?;
    let resolved = resolve_pgn(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::WritePgn,
    )?;
    let repository = state.pgn_repository.clone();
    delete_game_core(lease, resolved, n, repository).await
}

pub async fn delete_game_core(
    lease: OperationLease,
    resolved: crate::infra::path_authority::ResolvedPath,
    n: i32,
    repository: PgnRepository,
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
            range,
            None,
            &repository,
            "delete_game",
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
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let lease = state.operations.accept("write_game")?;
    let resolved = resolve_pgn(
        &state,
        &file,
        crate::infra::path_authority::PathOperation::WritePgn,
    )?;
    let repository = state.pgn_repository.clone();
    write_game_core(lease, resolved, n, pgn, repository).await
}

pub async fn write_game_core(
    lease: OperationLease,
    resolved: crate::infra::path_authority::ResolvedPath,
    n: i32,
    pgn: String,
    repository: PgnRepository,
) -> Result<(), Error> {
    let cancellation = lease.token();
    crate::infra::operations::run_native_operation(lease, "write_game", async move {
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
        commit_pgn_mutation(
            resolved,
            key,
            target,
            Some(replacement),
            &repository,
            "write_game",
            &cancellation,
        )
        .await
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

    #[test]
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
            result,
            Err(Error::CommittedDurabilityUncertain(
                crate::error::DurabilityStage::PgnEdit
            ))
        ));
        assert_eq!(
            std::fs::read_to_string(&path).expect("edited PGN"),
            "[Event \"after\"]\n\n1. d4 *\n"
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
        let caller_task = tokio::spawn(write_game_core(
            lease,
            resolved,
            0,
            replacement,
            repository.clone(),
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
        let caller_task = tokio::spawn(delete_game_core(lease, resolved, 0, repository.clone()));

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
        let caller_task = tokio::spawn(write_game_core(
            lease,
            resolved,
            0,
            replacement,
            repository.clone(),
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
        let lease = operations
            .accept(if write { "write_game" } else { "delete_game" })
            .expect("accept edit");
        let task = if write {
            tokio::spawn(write_game_core(
                lease,
                resolved,
                0,
                "[Event \"Replacement\"]\n\n1. c4\n".into(),
                repository.clone(),
            ))
        } else {
            tokio::spawn(delete_game_core(lease, resolved, 0, repository.clone()))
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
