use std::{
    collections::{HashSet, VecDeque},
    process::Stdio,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex as StdMutex,
    },
    time::Duration,
};

use async_trait::async_trait;
use dashmap::DashMap;
use log::error;
use serde::Serialize;
use specta::Type;
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::{
    io::{AsyncBufRead, AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
    time::timeout,
};
use tokio_util::sync::CancellationToken;
use vampirc_uci::UciMessage;

use crate::error::Error;
use crate::infra::path_authority::{EngineExecutable, PathRef};

use super::{
    normalize_uci_moves_for_fen,
    types::{validate_uci_text, EngineDeadlines, EngineKey, EngineRequestId, EngineState, GoMode},
};

#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

const MAX_LOG_LINES: usize = 2_000;
const MAX_LOG_BYTES: usize = 512 * 1024;
const MAX_ENGINE_LINE_BYTES: usize = 64 * 1024;
const MAX_ENGINE_STDERR_BYTES: usize = 512 * 1024;
const MAX_RETIRED_ENGINE_IDS: usize = 4096;
const MAX_RETIRED_PATH_REFS: usize = 4096;
/// Join budget for the stderr drain after `io.terminate` returns. A stuck
/// drain is then aborted so `terminate` cannot stall on a logging task.
const STDERR_REAP_TIMEOUT: Duration = Duration::from_millis(200);

/// Engine transcript entries include explicit truncation metadata when bounded
/// retention has discarded older output.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum EngineLog {
    Gui(String),
    Engine(String),
    Truncated {
        #[serde(rename = "droppedEntries")]
        dropped_entries: u64,
    },
}

impl EngineLog {
    fn byte_len(&self) -> usize {
        match self {
            Self::Gui(line) | Self::Engine(line) => line.len(),
            Self::Truncated { .. } => 0,
        }
    }
}

#[derive(Debug, Default)]
struct BoundedLogs {
    entries: VecDeque<EngineLog>,
    bytes: usize,
    truncated: bool,
    dropped_entries: u64,
}

impl BoundedLogs {
    fn push(&mut self, entry: EngineLog) {
        // A pathological single UCI line must not turn the bounded log into an
        // unbounded allocation. It is retained with a visible suffix before
        // accounting, so it does not unnecessarily evict the whole transcript.
        let entry = match entry {
            EngineLog::Gui(mut line) if line.len() > MAX_LOG_BYTES => {
                truncate_utf8(&mut line, MAX_LOG_BYTES.saturating_sub(16));
                line.push_str("… [truncated]");
                self.truncated = true;
                EngineLog::Gui(line)
            }
            EngineLog::Engine(mut line) if line.len() > MAX_LOG_BYTES => {
                truncate_utf8(&mut line, MAX_LOG_BYTES.saturating_sub(16));
                line.push_str("… [truncated]");
                self.truncated = true;
                EngineLog::Engine(line)
            }
            entry => entry,
        };
        let entry_bytes = entry.byte_len();
        while !self.entries.is_empty()
            && (self.entries.len() >= MAX_LOG_LINES || self.bytes + entry_bytes > MAX_LOG_BYTES)
        {
            if let Some(removed) = self.entries.pop_front() {
                self.bytes = self.bytes.saturating_sub(removed.byte_len());
                self.truncated = true;
                self.dropped_entries = self.dropped_entries.saturating_add(1);
            }
        }
        self.bytes += entry.byte_len();
        self.entries.push_back(entry);
    }

    fn entries(&self) -> Vec<EngineLog> {
        let mut entries =
            Vec::with_capacity(self.entries.len() + if self.truncated { 1 } else { 0 });
        if self.truncated {
            entries.push(EngineLog::Truncated {
                dropped_entries: self.dropped_entries,
            });
        }
        entries.extend(self.entries.iter().cloned());
        entries
    }
}

fn truncate_utf8(value: &mut String, max_bytes: usize) {
    if value.len() <= max_bytes {
        return;
    }
    let mut end = max_bytes;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    value.truncate(end);
}

/// The minimal child-process surface used by the actor.  The production
/// implementation owns every child handle; deterministic tests can provide a
/// fake without creating or killing OS processes.
#[async_trait]
pub trait UciIo: Send {
    async fn write_line(&mut self, line: &str) -> Result<(), Error>;
    async fn read_line(&mut self) -> Result<Option<String>, Error>;
    async fn terminate(
        &mut self,
        quit_timeout: Duration,
        kill_reap_timeout: Duration,
    ) -> Result<(), Error>;
}

#[cfg(test)]
struct RecordingUciIo {
    writes: Arc<Mutex<Vec<String>>>,
    lines: VecDeque<Option<String>>,
}

#[cfg(test)]
#[async_trait]
impl UciIo for RecordingUciIo {
    async fn write_line(&mut self, line: &str) -> Result<(), Error> {
        self.writes.lock().await.push(line.into());
        Ok(())
    }

    async fn read_line(&mut self) -> Result<Option<String>, Error> {
        Ok(self.lines.pop_front().flatten())
    }

    async fn terminate(&mut self, _: Duration, _: Duration) -> Result<(), Error> {
        Ok(())
    }
}

struct ChildUciIo {
    control: Option<ProcessChildControl>,
    reader: BufReader<ChildStdout>,
    // Keep the validated descriptor open for the complete child lifetime.
    // Linux executes `/proc/self/fd/N`, so dropping it would invalidate the
    // sealed command target after process creation.
    _executable: EngineExecutable,
}

struct ProcessChildControl {
    stdin: ChildStdin,
    child: Child,
}

#[async_trait]
trait ChildControl: Send {
    async fn write_quit(&mut self) -> Result<(), Error>;
    fn start_kill(&mut self) -> Result<(), Error>;
    async fn wait(&mut self) -> Result<(), Error>;
}

#[async_trait]
impl ChildControl for ProcessChildControl {
    async fn write_quit(&mut self) -> Result<(), Error> {
        self.stdin.write_all(b"quit\n").await?;
        self.stdin.flush().await?;
        Ok(())
    }

    fn start_kill(&mut self) -> Result<(), Error> {
        self.child.start_kill().map_err(Into::into)
    }

    async fn wait(&mut self) -> Result<(), Error> {
        self.child.wait().await?;
        Ok(())
    }
}

async fn terminate_child<C: ChildControl>(
    mut child: C,
    quit_timeout: Duration,
    kill_reap_timeout: Duration,
) -> Result<(), Error> {
    let graceful_deadline = tokio::time::Instant::now() + quit_timeout;
    let quit = tokio::time::timeout_at(graceful_deadline, child.write_quit())
        .await
        .map_err(|_| Error::EngineTimeout("writing quit to engine".into()))
        .and_then(|result| result);
    let graceful_wait = tokio::time::timeout_at(graceful_deadline, child.wait()).await;
    if matches!(graceful_wait, Ok(Ok(()))) {
        if let Err(error) = quit {
            error!("engine quit write failed after child exited: {error}");
        }
        return Ok(());
    }

    let primary = match (quit, graceful_wait) {
        (Err(error), _) => error,
        (Ok(()), Ok(Err(error))) => error,
        (Ok(()), Err(_)) => Error::EngineTimeout("waiting for engine exit".into()),
        (Ok(()), Ok(Ok(()))) => return Ok(()),
    };
    let kill = child.start_kill().err();
    let reap = timeout(kill_reap_timeout, child.wait()).await;
    match (kill, reap) {
        (kill, Ok(Ok(()))) => {
            if let Some(kill) = kill {
                error!("engine force-kill reported an error but child reaped: {kill}");
            }
            error!("engine graceful shutdown failed but child reaped: {primary}");
            Ok(())
        }
        (Some(kill), Ok(Err(reap))) => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("force-kill failed: {kill}; final reap failed: {reap}"),
        }),
        (None, Ok(Err(reap))) => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("final reap failed: {reap}"),
        }),
        (Some(kill), Err(_)) => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!(
                "force-kill failed: {kill}; final reap exceeded {kill_reap_timeout:?}"
            ),
        }),
        (None, Err(_)) => Err(Error::EngineTimeout(format!(
            "waiting for engine reap after force-kill exceeded {kill_reap_timeout:?}"
        ))),
    }
}

async fn read_bounded_engine_line<R: AsyncBufRead + Unpin>(
    reader: &mut R,
) -> Result<Option<String>, Error> {
    let mut line = Vec::new();
    loop {
        let (take, ended) = {
            let available = reader.fill_buf().await?;
            if available.is_empty() {
                return if line.is_empty() {
                    Ok(None)
                } else {
                    String::from_utf8(line)
                        .map(Some)
                        .map_err(|_| Error::InvalidInput("engine emitted non-UTF-8 output".into()))
                };
            }

            let take = available
                .iter()
                .position(|byte| *byte == b'\n')
                .map(|index| index + 1)
                .unwrap_or(available.len());
            if line.len().saturating_add(take) > MAX_ENGINE_LINE_BYTES {
                // The caller treats this as a protocol failure and terminates
                // the child; do not consume an unbounded remainder first.
                return Err(Error::ResourceLimit(format!(
                    "engine emitted a line larger than {MAX_ENGINE_LINE_BYTES} bytes"
                )));
            }
            line.extend_from_slice(&available[..take]);
            (take, available[take - 1] == b'\n')
        };
        reader.consume(take);
        if ended {
            if line.last() == Some(&b'\n') {
                line.pop();
            }
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            return String::from_utf8(line)
                .map(Some)
                .map_err(|_| Error::InvalidInput("engine emitted non-UTF-8 output".into()));
        }
    }
}

async fn discard_engine_line_remainder<R: AsyncBufRead + Unpin>(
    reader: &mut R,
) -> std::io::Result<()> {
    loop {
        let (consumed, ended) = {
            let available = reader.fill_buf().await?;
            if available.is_empty() {
                return Ok(());
            }
            match available.iter().position(|byte| *byte == b'\n') {
                Some(index) => (index + 1, true),
                None => (available.len(), false),
            }
        };
        reader.consume(consumed);
        if ended {
            return Ok(());
        }
    }
}

async fn drain_engine_stderr<R: AsyncBufRead + Unpin>(reader: &mut R) {
    let mut total = 0usize;
    let mut truncated = false;
    loop {
        match read_bounded_engine_line(reader).await {
            Ok(Some(line)) => {
                let next_total = total.saturating_add(line.len());
                if next_total > MAX_ENGINE_STDERR_BYTES {
                    if !truncated {
                        error!("Engine stderr truncated after {MAX_ENGINE_STDERR_BYTES} bytes");
                        truncated = true;
                    }
                    continue;
                }
                total = next_total;
                error!("Engine stderr: {line}");
            }
            Ok(None) => return,
            Err(Error::InvalidInput(reason)) => {
                error!("Engine stderr discarded non-UTF-8 line: {reason}");
            }
            Err(Error::ResourceLimit(reason)) => {
                error!("Engine stderr discarded oversized line: {reason}");
                if let Err(error) = discard_engine_line_remainder(reader).await {
                    error!("Engine stderr drain ended while discarding oversized line: {error}");
                    return;
                }
            }
            Err(error) => {
                error!("Engine stderr drain ended: {error}");
                return;
            }
        }
    }
}

struct AbortJoinHandleOnDrop {
    handle: Option<tokio::task::JoinHandle<()>>,
}

impl AbortJoinHandleOnDrop {
    fn new(handle: tokio::task::JoinHandle<()>) -> Self {
        Self {
            handle: Some(handle),
        }
    }

    fn disarm(&mut self) {
        self.handle.take();
    }
}

impl Drop for AbortJoinHandleOnDrop {
    fn drop(&mut self) {
        if let Some(handle) = self.handle.take() {
            handle.abort();
        }
    }
}

#[async_trait]
impl UciIo for ChildUciIo {
    async fn write_line(&mut self, line: &str) -> Result<(), Error> {
        let control = self.control.as_mut().ok_or(Error::EngineDisconnected)?;
        control.stdin.write_all(line.as_bytes()).await?;
        control.stdin.write_all(b"\n").await?;
        control.stdin.flush().await?;
        Ok(())
    }

    async fn read_line(&mut self) -> Result<Option<String>, Error> {
        read_bounded_engine_line(&mut self.reader).await
    }

    async fn terminate(
        &mut self,
        quit_timeout: Duration,
        kill_reap_timeout: Duration,
    ) -> Result<(), Error> {
        let control = self.control.take().ok_or(Error::EngineDisconnected)?;
        terminate_child(control, quit_timeout, kill_reap_timeout).await
    }
}

/// One-owner UCI actor. Its state/request generation is intentionally kept
/// beside IO, so an old `bestmove` cannot be attributed to a replacement
/// search.
struct EngineRuntime {
    io: Box<dyn UciIo>,
    state: EngineState,
    next_request: u64,
    deadlines: EngineDeadlines,
    logs: BoundedLogs,
    /// Drain task for this runtime's child stderr. Taken and joined in
    /// `terminate`; aborted in `Drop` if the runtime is discarded first.
    stderr_drain_task: Option<tokio::task::JoinHandle<()>>,
}

/// Cloneable client handle for the single-owner engine task. No caller holds a
/// mutex over process I/O: an in-flight stdout read is always selected against
/// control messages by the owning task.
#[derive(Clone)]
pub struct EngineActor {
    tx: mpsc::Sender<EngineCommand>,
    control_tx: mpsc::Sender<EngineCommand>,
    // The task owns the runtime (and therefore the child process handles).
    // Keep its handle with every clone so lifecycle callers can await its
    // completion instead of detaching it after `Terminate`.
    task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    interrupt: CancellationToken,
}

enum EngineCommand {
    Init(oneshot::Sender<Result<(), Error>>),
    ConfigureStart(oneshot::Sender<Result<(), Error>>),
    ConfigureNext(oneshot::Sender<Result<Option<String>, Error>>),
    SetOption {
        name: String,
        value: String,
        reply: oneshot::Sender<Result<(), Error>>,
    },
    SetPosition {
        fen: String,
        moves: Vec<String>,
        reply: oneshot::Sender<Result<(), Error>>,
    },
    EnsureReady(oneshot::Sender<Result<(), Error>>),
    StartSearch {
        mode: GoMode,
        reply: oneshot::Sender<Result<EngineRequestId, Error>>,
    },
    NextSearch {
        id: EngineRequestId,
        reply: oneshot::Sender<Result<Option<String>, Error>>,
    },
    Stop(oneshot::Sender<Result<(), Error>>),
    Terminate(oneshot::Sender<Result<(), Error>>),
    Logs(oneshot::Sender<Vec<EngineLog>>),
}

#[derive(Clone)]
pub struct SupervisedEngine {
    pub generation: u64,
    pub engine_id: String,
    pub executable: PathRef,
    pub actor: Arc<EngineActor>,
    pub cancelled: Arc<std::sync::atomic::AtomicBool>,
}

#[derive(Default)]
struct RetiredExecutables {
    order: VecDeque<PathRef>,
    ids: HashSet<PathRef>,
}

impl RetiredExecutables {
    fn insert(&mut self, executable: PathRef) {
        if !self.ids.insert(executable.clone()) {
            return;
        }
        self.order.push_back(executable);
        if self.order.len() > MAX_RETIRED_PATH_REFS {
            if let Some(oldest) = self.order.pop_front() {
                self.ids.remove(&oldest);
            }
        }
    }
}

#[derive(Default)]
struct RetiredEngineIds {
    order: VecDeque<String>,
    ids: HashSet<String>,
}

impl RetiredEngineIds {
    fn insert(&mut self, engine_id: String) {
        if !self.ids.insert(engine_id.clone()) {
            return;
        }
        self.order.push_back(engine_id);
        if self.order.len() > MAX_RETIRED_ENGINE_IDS {
            if let Some(oldest) = self.order.pop_front() {
                self.ids.remove(&oldest);
            }
        }
    }
}

/// Owns the registry boundary for interactive, report, config-probe, and game
/// engines. Replacement removes exactly one opaque key, shuts down that actor,
/// then publishes the new generation. `retire_engine` reaps every actor owned
/// by an application engine id. `retire_executables` tombstones PathRefs and
/// terminates matching actors without retiring the application id.
#[derive(Default)]
pub struct EngineSupervisor {
    next_generation: AtomicU64,
    sealed: AtomicBool,
    actors: DashMap<EngineKey, SupervisedEngine>,
    registration: Mutex<()>,
    retired: StdMutex<RetiredEngineIds>,
    retired_executables: StdMutex<RetiredExecutables>,
    // Every lifecycle transition for an exact key takes this lock before it
    // observes or mutates `actors`.  The map itself is concurrent, but it
    // cannot make remove → await shutdown → insert atomic.
    lifecycle: DashMap<EngineKey, Arc<Mutex<()>>>,
}

impl EngineSupervisor {
    async fn reject_replacement_during_shutdown(actor: &EngineActor) -> Error {
        if let Err(error) = actor.terminate().await {
            error!("engine spawned during shutdown could not be terminated cleanly: {error}");
        }
        Error::Conflict("application is shutting down".into())
    }

    async fn reject_retired_replacement(actor: &EngineActor) -> Error {
        let primary = Error::Conflict("engine id is retired".into());
        match actor.terminate().await {
            Ok(()) => primary,
            Err(cleanup) => Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: cleanup.to_string(),
            },
        }
    }

    async fn reject_retired_executable(actor: &EngineActor) -> Error {
        let primary = Error::Conflict("engine executable is retired".into());
        match actor.terminate().await {
            Ok(()) => primary,
            Err(cleanup) => Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: cleanup.to_string(),
            },
        }
    }

    fn with_retired<T>(&self, operation: impl FnOnce(&mut RetiredEngineIds) -> T) -> T {
        match self.retired.lock() {
            Ok(mut retired) => operation(&mut retired),
            Err(poisoned) => operation(&mut poisoned.into_inner()),
        }
    }

    fn is_retired(&self, engine_id: &str) -> bool {
        self.with_retired(|retired| retired.ids.contains(engine_id))
    }

    fn with_retired_executables<T>(
        &self,
        operation: impl FnOnce(&mut RetiredExecutables) -> T,
    ) -> T {
        match self.retired_executables.lock() {
            Ok(mut retired) => operation(&mut retired),
            Err(poisoned) => operation(&mut poisoned.into_inner()),
        }
    }

    fn is_retired_executable(&self, executable: &PathRef) -> bool {
        self.with_retired_executables(|retired| retired.ids.contains(executable))
    }

    fn lifecycle_slot(&self, key: &EngineKey) -> Arc<Mutex<()>> {
        self.lifecycle
            .entry(key.clone())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    #[cfg(test)]
    pub async fn replace(
        &self,
        key: EngineKey,
        actor: EngineActor,
    ) -> Result<SupervisedEngine, Error> {
        let engine_id = key.engine.clone();
        let executable = PathRef {
            id: format!("test-{}", key.engine),
        };
        self.replace_handle(key, Arc::new(actor), engine_id, executable)
            .await
    }

    pub async fn replace_handle(
        &self,
        key: EngineKey,
        actor: Arc<EngineActor>,
        engine_id: String,
        executable: PathRef,
    ) -> Result<SupervisedEngine, Error> {
        validate_uci_text("engine", &engine_id)?;
        let lifecycle = self.lifecycle_slot(&key);
        let _transition = lifecycle.lock().await;
        if self.sealed.load(Ordering::SeqCst) {
            return Err(Self::reject_replacement_during_shutdown(&actor).await);
        }
        if self.is_retired(&engine_id) {
            return Err(Self::reject_retired_replacement(&actor).await);
        }
        if self.is_retired_executable(&executable) {
            return Err(Self::reject_retired_executable(&actor).await);
        }
        if let Some(previous) = self.actors.get(&key).map(|entry| entry.clone()) {
            let previous_actor = previous.actor.clone();
            let stop = previous_actor.stop_current().await;
            let terminate = previous_actor.terminate().await;
            self.actors.remove(&key);
            combine_shutdown_results(stop, terminate)?;
        }
        let registration = self.registration.lock().await;
        if self.sealed.load(Ordering::SeqCst) {
            drop(registration);
            return Err(Self::reject_replacement_during_shutdown(&actor).await);
        }
        if self.is_retired(&engine_id) {
            drop(registration);
            return Err(Self::reject_retired_replacement(&actor).await);
        }
        if self.is_retired_executable(&executable) {
            drop(registration);
            return Err(Self::reject_retired_executable(&actor).await);
        }
        let generation = self
            .next_generation
            .fetch_add(1, Ordering::Relaxed)
            .checked_add(1)
            .ok_or_else(|| Error::ResourceLimit("engine generation exhausted".into()))?;
        let entry = SupervisedEngine {
            generation,
            engine_id,
            executable,
            actor,
            cancelled: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        };
        self.actors.insert(key, entry.clone());
        Ok(entry)
    }

    pub async fn terminate_exact(&self, key: &EngineKey, generation: u64) -> Result<(), Error> {
        let lifecycle = self.lifecycle_slot(key);
        let _transition = lifecycle.lock().await;
        let Some(current) = self.actors.get(key).map(|entry| entry.clone()) else {
            return Ok(());
        };
        if current.generation != generation {
            return Ok(());
        }
        let result = current.actor.terminate().await;
        self.actors.remove(key);
        result
    }

    pub async fn stop_exact(&self, key: &EngineKey) -> Result<(), Error> {
        let lifecycle = self.lifecycle_slot(key);
        let _transition = lifecycle.lock().await;
        let Some(current) = self.actors.get(key).map(|entry| entry.clone()) else {
            return Ok(());
        };
        match current.actor.stop_current().await {
            Ok(()) => Ok(()),
            Err(primary) => {
                let cleanup = current.actor.terminate().await;
                self.actors.remove(key);
                match cleanup {
                    Ok(()) => Err(primary),
                    Err(cleanup) => Err(Error::OperationAndCleanup {
                        primary: primary.to_string(),
                        cleanup: cleanup.to_string(),
                    }),
                }
            }
        }
    }

    pub fn get_exact(&self, key: &EngineKey) -> Option<SupervisedEngine> {
        self.actors.get(key).map(|entry| entry.clone())
    }

    pub fn cancel_exact(&self, key: &EngineKey, generation: u64) -> bool {
        let Some(current) = self.actors.get(key) else {
            return false;
        };
        if current.generation != generation {
            return false;
        }
        current.cancelled.store(true, Ordering::SeqCst);
        true
    }

    pub async fn terminate_tab(&self, tab: &str) -> Result<(), Error> {
        // Same publication barrier as `terminate_all` / `retire_engine`: wait
        // for in-flight `replace_handle` inserts before scanning, then drain
        // until this tab has no actors.
        drop(self.registration.lock().await);
        let mut failures = Vec::new();
        loop {
            match self.terminate_matching(|key, _| key.tab == tab).await {
                Ok(()) => {}
                Err(error) => failures.push(error.to_string()),
            }
            if !self.actors.iter().any(|entry| entry.key().tab == tab) {
                break;
            }
        }
        aggregate_shutdown_failures(failures)
    }

    pub async fn retire_engine(&self, engine_id: String) -> Result<(), Error> {
        validate_uci_text("engine", &engine_id)?;
        self.with_retired(|retired| retired.insert(engine_id.clone()));
        // Synchronize with the final publication check in `replace_handle`.
        // Once this barrier is crossed, a retired id cannot be inserted.
        drop(self.registration.lock().await);
        let mut failures = Vec::new();
        loop {
            match self
                .terminate_matching(|key, engine| {
                    key.engine == engine_id || engine.engine_id == engine_id
                })
                .await
            {
                Ok(()) => {}
                Err(error) => failures.push(error.to_string()),
            }
            if !self.actors.iter().any(|entry| {
                entry.key().engine == engine_id || entry.value().engine_id == engine_id
            }) {
                break;
            }
        }
        aggregate_shutdown_failures(failures)
    }

    pub async fn retire_executables(&self, executables: Vec<PathRef>) -> Result<(), Error> {
        if executables.is_empty() {
            return Ok(());
        }
        let executable_set: HashSet<_> = executables.iter().cloned().collect();
        self.with_retired_executables(|retired| {
            for executable in executables {
                retired.insert(executable);
            }
        });
        // Synchronize with the final publication check in `replace_handle`.
        drop(self.registration.lock().await);
        let mut failures = Vec::new();
        loop {
            match self
                .terminate_matching(|_, engine| executable_set.contains(&engine.executable))
                .await
            {
                Ok(()) => {}
                Err(error) => failures.push(error.to_string()),
            }
            if !self
                .actors
                .iter()
                .any(|entry| executable_set.contains(&entry.value().executable))
            {
                break;
            }
        }
        aggregate_shutdown_failures(failures)
    }

    pub async fn terminate_all(&self) -> Result<(), Error> {
        let mut failures = Vec::new();
        self.sealed.store(true, Ordering::SeqCst);
        // Synchronize with the final publication check in `replace*`. Once
        // this barrier is crossed, no production path can add another actor.
        drop(self.registration.lock().await);
        loop {
            let targets: Vec<_> = self
                .actors
                .iter()
                .map(|entry| (entry.key().clone(), entry.value().generation))
                .collect();
            if targets.is_empty() {
                break;
            }
            if let Err(error) = self.terminate_targets(targets).await {
                failures.push(error.to_string());
            }
        }
        aggregate_shutdown_failures(failures)
    }

    async fn terminate_targets(&self, targets: Vec<(EngineKey, u64)>) -> Result<(), Error> {
        let results = futures_util::future::join_all(targets.into_iter().map(
            |(key, generation)| async move {
                let result = self.terminate_exact(&key, generation).await;
                (key, result)
            },
        ))
        .await;
        let failures = results
            .into_iter()
            .filter_map(|(key, result)| {
                result
                    .err()
                    .map(|error| format!("{}:{}: {error}", key.tab, key.engine))
            })
            .collect();
        aggregate_shutdown_failures(failures)
    }

    async fn terminate_matching<P>(&self, predicate: P) -> Result<(), Error>
    where
        P: Fn(&EngineKey, &SupervisedEngine) -> bool,
    {
        let targets = self
            .actors
            .iter()
            .filter(|entry| predicate(entry.key(), entry.value()))
            .map(|entry| (entry.key().clone(), entry.value().generation))
            .collect();
        self.terminate_targets(targets).await
    }
}

struct RegistrationGuard {
    supervisor: Arc<EngineSupervisor>,
    key: EngineKey,
    generation: u64,
    taken: bool,
}

#[cfg(test)]
static REGISTRATION_CLEANUP_ERRORS: StdMutex<Vec<String>> = StdMutex::new(Vec::new());

fn log_registration_cleanup_error(key: &EngineKey, error: &Error) {
    let message = format!(
        "cancelled engine registration could not be terminated cleanly for {}:{}: {error}",
        key.tab, key.engine
    );
    #[cfg(test)]
    match REGISTRATION_CLEANUP_ERRORS.lock() {
        Ok(mut errors) => errors.push(message.clone()),
        Err(poisoned) => poisoned.into_inner().push(message.clone()),
    }
    error!("{message}");
}

impl RegistrationGuard {
    fn disarm(&mut self) {
        self.taken = true;
    }
}

impl Drop for RegistrationGuard {
    fn drop(&mut self) {
        if self.taken {
            return;
        }
        let supervisor = self.supervisor.clone();
        let key = self.key.clone();
        let generation = self.generation;
        tokio::spawn(async move {
            if let Err(error) = supervisor.terminate_exact(&key, generation).await {
                log_registration_cleanup_error(&key, &error);
            }
        });
    }
}

/// Spawns and publishes an actor before any protocol initialization begins.
/// The registration guard owns cancellation cleanup until initialization has
/// either completed or synchronously removed the exact generation.
pub(crate) async fn spawn_registered<T, F, Fut>(
    supervisor: Arc<EngineSupervisor>,
    key: EngineKey,
    executable: EngineExecutable,
    engine_id: String,
    executable_ref: PathRef,
    initialize: F,
) -> Result<(SupervisedEngine, T), Error>
where
    F: FnOnce(Arc<EngineActor>) -> Fut,
    Fut: std::future::Future<Output = Result<T, Error>>,
{
    let actor = Arc::new(EngineActor::spawn(executable, EngineDeadlines::default()).await?);
    initialize_registered_actor(
        supervisor,
        key,
        actor,
        engine_id,
        executable_ref,
        initialize,
    )
    .await
}

async fn initialize_registered_actor<T, F, Fut>(
    supervisor: Arc<EngineSupervisor>,
    key: EngineKey,
    actor: Arc<EngineActor>,
    engine_id: String,
    executable_ref: PathRef,
    initialize: F,
) -> Result<(SupervisedEngine, T), Error>
where
    F: FnOnce(Arc<EngineActor>) -> Fut,
    Fut: std::future::Future<Output = Result<T, Error>>,
{
    let supervised = match supervisor
        .replace_handle(key.clone(), actor.clone(), engine_id, executable_ref)
        .await
    {
        Ok(supervised) => supervised,
        Err(primary) => {
            return match actor.terminate().await {
                Ok(()) => Err(primary),
                Err(cleanup) => Err(Error::OperationAndCleanup {
                    primary: primary.to_string(),
                    cleanup: cleanup.to_string(),
                }),
            };
        }
    };
    let mut guard = RegistrationGuard {
        supervisor: supervisor.clone(),
        key: key.clone(),
        generation: supervised.generation,
        taken: false,
    };
    match initialize(actor).await {
        Ok(value) => {
            guard.disarm();
            Ok((supervised, value))
        }
        Err(primary) => {
            let cleanup = supervisor
                .terminate_exact(&key, supervised.generation)
                .await;
            guard.disarm();
            match cleanup {
                Ok(()) => Err(primary),
                Err(cleanup) => Err(Error::OperationAndCleanup {
                    primary: primary.to_string(),
                    cleanup: cleanup.to_string(),
                }),
            }
        }
    }
}

fn combine_shutdown_results(
    stop: Result<(), Error>,
    terminate: Result<(), Error>,
) -> Result<(), Error> {
    match (stop, terminate) {
        (Ok(()), Ok(())) => Ok(()),
        (Err(stop), Ok(())) => Err(stop),
        (Ok(()), Err(terminate)) => Err(terminate),
        (Err(stop), Err(terminate)) => Err(Error::OperationAndCleanup {
            primary: stop.to_string(),
            cleanup: terminate.to_string(),
        }),
    }
}

fn aggregate_shutdown_failures(failures: Vec<String>) -> Result<(), Error> {
    if failures.is_empty() {
        Ok(())
    } else {
        Err(Error::Conflict(format!(
            "failed to terminate one or more engines: {}",
            failures.join("; ")
        )))
    }
}

impl EngineRuntime {
    pub fn new(io: Box<dyn UciIo>, deadlines: EngineDeadlines) -> Self {
        Self {
            io,
            state: EngineState::Idle,
            next_request: 0,
            deadlines,
            logs: BoundedLogs::default(),
            stderr_drain_task: None,
        }
    }

    pub async fn spawn(
        executable: EngineExecutable,
        deadlines: EngineDeadlines,
    ) -> Result<Self, Error> {
        let command_target = executable.command_target();
        let working_directory = executable.working_directory().to_path_buf();
        let mut command = Command::new(command_target);
        command
            .current_dir(working_directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            // Backstop for the one exit path `terminate` does not own: an actor
            // dropped without being terminated. It cannot help on process exit,
            // where nothing is dropped at all — that is what the bounded
            // shutdown in `main` is for.
            .kill_on_drop(true);
        #[cfg(unix)]
        {
            let inherited_fds = executable.inherited_fds();
            // Tokio closes inherited descriptors by default. Clear CLOEXEC only
            // in the fork child immediately before exec; no process-global FD
            // flag is changed and concurrent spawns cannot observe a leak.
            unsafe {
                command.pre_exec(move || {
                    for fd in &inherited_fds {
                        let flags = libc::fcntl(*fd, libc::F_GETFD);
                        if flags < 0
                            || libc::fcntl(*fd, libc::F_SETFD, flags & !libc::FD_CLOEXEC) < 0
                        {
                            return Err(std::io::Error::last_os_error());
                        }
                    }
                    Ok(())
                });
            }
        }
        #[cfg(target_os = "windows")]
        command.creation_flags(CREATE_NO_WINDOW);

        let mut child = timeout(deadlines.spawn, async { command.spawn() })
            .await
            .map_err(|_| Error::EngineTimeout("spawning engine".into()))??;
        let stdin = child.stdin.take().ok_or(Error::NoStdin)?;
        let stdout = child.stdout.take().ok_or(Error::NoStdout)?;
        let stderr_drain_task = child.stderr.take().map(|stderr| {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr);
                drain_engine_stderr(&mut reader).await;
            })
        });
        let mut runtime = Self::new(
            Box::new(ChildUciIo {
                control: Some(ProcessChildControl { stdin, child }),
                reader: BufReader::new(stdout),
                _executable: executable,
            }),
            deadlines,
        );
        runtime.stderr_drain_task = stderr_drain_task;
        Ok(runtime)
    }

    async fn init_uci_cancellable(
        &mut self,
        cancellation: &CancellationToken,
    ) -> Result<(), Error> {
        self.send("uci").await?;
        self.wait_for_cancellable("uciok", self.deadlines.uciok, cancellation)
            .await?;
        self.send("isready").await?;
        self.wait_for_cancellable("readyok", self.deadlines.readyok, cancellation)
            .await
    }

    pub async fn ensure_ready(&mut self) -> Result<(), Error> {
        self.send("isready").await?;
        self.wait_for("readyok", self.deadlines.readyok).await
    }

    pub async fn start_uci_configuration(&mut self) -> Result<(), Error> {
        self.send("uci").await
    }

    async fn next_configuration_line_cancellable(
        &mut self,
        cancellation: &CancellationToken,
    ) -> Result<Option<String>, Error> {
        tokio::select! {
            _ = cancellation.cancelled() => Err(Error::EngineDisconnected),
            result = timeout(self.deadlines.uciok, self.read_line()) => {
                result.map_err(|_| Error::EngineTimeout("waiting for uciok".into()))?
            }
        }
    }

    pub async fn set_option(&mut self, name: &str, value: &str) -> Result<(), Error> {
        validate_uci_text("option name", name)?;
        validate_uci_text("option value", value)?;
        self.send(&format!("setoption name {name} value {value}"))
            .await
    }

    pub async fn set_position(&mut self, fen: &str, moves: &[String]) -> Result<(), Error> {
        validate_uci_text("FEN", fen)?;
        let normalized_moves = normalize_uci_moves_for_fen(fen, moves)?;
        let command = if normalized_moves.is_empty() {
            format!("position fen {fen}")
        } else {
            format!("position fen {fen} moves {}", normalized_moves.join(" "))
        };
        self.send(&command).await
    }

    pub async fn start_search(&mut self, mode: &GoMode) -> Result<EngineRequestId, Error> {
        if matches!(
            self.state,
            EngineState::Searching { .. } | EngineState::Stopping { .. }
        ) {
            self.stop_current().await?;
        }
        self.next_request = self
            .next_request
            .checked_add(1)
            .ok_or_else(|| Error::ResourceLimit("engine request generation exhausted".into()))?;
        let id = EngineRequestId(self.next_request);
        self.send(&mode.to_uci_string()?).await?;
        self.state = EngineState::Searching { request_id: id };
        Ok(id)
    }

    pub async fn stop_current(&mut self) -> Result<(), Error> {
        let send_stop = match self.state {
            EngineState::Searching { request_id } => {
                self.state = EngineState::Stopping { request_id };
                true
            }
            // A prior cancellation may have written `stop` while the actor
            // was servicing a pending read. Do not permit a new `position` or
            // `go` until that exact search's required `bestmove` is drained.
            EngineState::Stopping { .. } => false,
            EngineState::Idle | EngineState::Terminating => return Ok(()),
        };
        let result = async {
            if send_stop {
                self.send("stop").await?;
            }
            loop {
                let line = timeout(self.deadlines.stop, self.read_line())
                    .await
                    .map_err(|_| Error::EngineTimeout("waiting for bestmove after stop".into()))?;
                let Some(line) = line? else {
                    return Err(Error::EngineDisconnected);
                };
                if matches!(vampirc_uci::parse_one(&line), UciMessage::BestMove { .. }) {
                    return Ok(());
                }
            }
        }
        .await;
        // A failed stop has no trustworthy protocol boundary. Mark the
        // runtime poisoned; every command handler that observes this error
        // terminates the actor rather than allowing a later request to reuse
        // an unread old `bestmove`.
        self.state = if result.is_ok() {
            EngineState::Idle
        } else {
            EngineState::Terminating
        };
        result
    }

    pub async fn terminate(&mut self) -> Result<(), Error> {
        self.state = EngineState::Terminating;
        let result = self
            .io
            .terminate(self.deadlines.quit, self.deadlines.kill_reap)
            .await;
        self.reap_stderr_drain().await;
        self.state = EngineState::Idle;
        result
    }

    async fn reap_stderr_drain(&mut self) {
        let Some(handle) = self.stderr_drain_task.take() else {
            return;
        };
        let mut guard = AbortJoinHandleOnDrop::new(handle);
        let Some(handle) = guard.handle.as_mut() else {
            return;
        };
        match timeout(STDERR_REAP_TIMEOUT, handle).await {
            Ok(Ok(())) => guard.disarm(),
            Ok(Err(error)) => {
                error!("Engine stderr drain task failed while joining: {error}");
                guard.disarm();
            }
            Err(_) => {
                let Some(handle) = guard.handle.as_mut() else {
                    return;
                };
                handle.abort();
                match handle.await {
                    Ok(()) => error!("Engine stderr drain exceeded join budget and was aborted"),
                    Err(error) if error.is_cancelled() => {
                        error!("Engine stderr drain exceeded join budget and was aborted: {error}");
                    }
                    Err(error) => {
                        error!("Engine stderr drain failed after abort: {error}");
                    }
                }
                guard.disarm();
            }
        }
    }

    async fn send(&mut self, command: &str) -> Result<(), Error> {
        validate_uci_text("UCI command", command)?;
        self.logs.push(EngineLog::Gui(format!("{command}\n")));
        timeout(self.deadlines.readyok, self.io.write_line(command))
            .await
            .map_err(|_| Error::EngineTimeout("writing engine command".into()))?
    }

    async fn read_line(&mut self) -> Result<Option<String>, Error> {
        let line = self.io.read_line().await?;
        if let Some(line) = &line {
            if line.len() > MAX_ENGINE_LINE_BYTES {
                return Err(Error::ResourceLimit(format!(
                    "engine emitted a line larger than {MAX_ENGINE_LINE_BYTES} bytes"
                )));
            }
            self.logs.push(EngineLog::Engine(line.clone()));
        }
        Ok(line)
    }

    async fn wait_for(&mut self, expected: &str, wait: Duration) -> Result<(), Error> {
        loop {
            let line = timeout(wait, self.read_line())
                .await
                .map_err(|_| Error::EngineTimeout(format!("waiting for {expected}")))?;
            let Some(line) = line? else {
                return Err(Error::EngineDisconnected);
            };
            // UCI acknowledgements are complete protocol tokens. Prefix
            // matching would accept e.g. `uciok-not-really` from a malformed
            // or hostile executable and advance the state machine.
            if line.trim() == expected {
                return Ok(());
            }
        }
    }

    async fn wait_for_cancellable(
        &mut self,
        expected: &str,
        wait: Duration,
        cancellation: &CancellationToken,
    ) -> Result<(), Error> {
        loop {
            let line = tokio::select! {
                _ = cancellation.cancelled() => return Err(Error::EngineDisconnected),
                line = timeout(wait, self.read_line()) => {
                    line.map_err(|_| Error::EngineTimeout(format!("waiting for {expected}")))?
                }
            };
            let Some(line) = line? else {
                return Err(Error::EngineDisconnected);
            };
            if line.trim() == expected {
                return Ok(());
            }
        }
    }
}

impl Drop for EngineRuntime {
    fn drop(&mut self) {
        if let Some(handle) = self.stderr_drain_task.take() {
            handle.abort();
        }
    }
}

impl EngineActor {
    #[cfg(test)]
    pub fn new(io: Box<dyn UciIo>, deadlines: EngineDeadlines) -> Self {
        Self::from_runtime(EngineRuntime::new(io, deadlines))
    }

    #[cfg(test)]
    pub fn recording_test_actor(lines: &[&str]) -> (Arc<Self>, Arc<Mutex<Vec<String>>>) {
        let writes = Arc::new(Mutex::new(Vec::new()));
        let io = RecordingUciIo {
            writes: writes.clone(),
            lines: lines.iter().map(|line| Some((*line).into())).collect(),
        };
        (
            Arc::new(Self::new(Box::new(io), EngineDeadlines::default())),
            writes,
        )
    }

    fn from_runtime(runtime: EngineRuntime) -> Self {
        let (tx, rx) = mpsc::channel(32);
        // Lifecycle and observability controls never sit behind bulk analysis
        // work. A flooded normal queue therefore cannot delay stop, kill or
        // log snapshots for a silent engine.
        let (control_tx, control_rx) = mpsc::channel(8);
        let interrupt = CancellationToken::new();
        let task = tokio::spawn(engine_actor_loop(
            runtime,
            rx,
            control_rx,
            interrupt.clone(),
        ));
        Self {
            tx,
            control_tx,
            task: Arc::new(Mutex::new(Some(task))),
            interrupt,
        }
    }

    pub async fn spawn(
        executable: EngineExecutable,
        deadlines: EngineDeadlines,
    ) -> Result<Self, Error> {
        Ok(Self::from_runtime(
            EngineRuntime::spawn(executable, deadlines).await?,
        ))
    }

    #[cfg(test)]
    pub async fn spawn_initialized(
        executable: EngineExecutable,
        deadlines: EngineDeadlines,
    ) -> Result<Self, Error> {
        let actor = Self::spawn(executable, deadlines).await?;
        if let Err(error) = actor.init_uci().await {
            return match actor.terminate().await {
                Ok(()) => Err(error),
                Err(cleanup) => Err(Error::OperationAndCleanup {
                    primary: error.to_string(),
                    cleanup: cleanup.to_string(),
                }),
            };
        }
        Ok(actor)
    }

    async fn request<T>(
        &self,
        command: EngineCommand,
        reply: oneshot::Receiver<T>,
    ) -> Result<T, Error> {
        self.tx
            .send(command)
            .await
            .map_err(|_| Error::EngineDisconnected)?;
        reply.await.map_err(|_| Error::EngineDisconnected)
    }

    async fn request_control<T>(
        &self,
        command: EngineCommand,
        reply: oneshot::Receiver<T>,
    ) -> Result<T, Error> {
        self.control_tx
            .send(command)
            .await
            .map_err(|_| Error::EngineDisconnected)?;
        reply.await.map_err(|_| Error::EngineDisconnected)
    }

    pub async fn init_uci(&self) -> Result<(), Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(EngineCommand::Init(reply_tx), reply).await?
    }
    pub async fn start_uci_configuration(&self) -> Result<(), Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(EngineCommand::ConfigureStart(reply_tx), reply)
            .await?
    }
    pub async fn next_configuration_line(&self) -> Result<Option<String>, Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(EngineCommand::ConfigureNext(reply_tx), reply)
            .await?
    }
    pub async fn set_option(&self, name: &str, value: &str) -> Result<(), Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(
            EngineCommand::SetOption {
                name: name.into(),
                value: value.into(),
                reply: reply_tx,
            },
            reply,
        )
        .await?
    }
    pub async fn set_position(&self, fen: &str, moves: &[String]) -> Result<(), Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(
            EngineCommand::SetPosition {
                fen: fen.into(),
                moves: moves.to_vec(),
                reply: reply_tx,
            },
            reply,
        )
        .await?
    }
    pub async fn ensure_ready(&self) -> Result<(), Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(EngineCommand::EnsureReady(reply_tx), reply)
            .await?
    }
    pub async fn start_search(&self, mode: &GoMode) -> Result<EngineRequestId, Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(
            EngineCommand::StartSearch {
                mode: mode.clone(),
                reply: reply_tx,
            },
            reply,
        )
        .await?
    }
    pub async fn wait_bestmove_cancellable(
        &self,
        request: EngineRequestId,
        cancellation: &CancellationToken,
    ) -> Result<String, Error> {
        loop {
            tokio::select! {
                _ = cancellation.cancelled() => {
                    self.stop_current().await?;
                    return Err(Error::AnalysisCancelled);
                }
                line = self.next_search_line(request) => {
                    let Some(line) = line? else {
                        return Err(Error::EngineDisconnected);
                    };
                    if let UciMessage::BestMove { best_move, .. } = vampirc_uci::parse_one(&line) {
                        return Ok(best_move.to_string());
                    }
                }
            }
        }
    }
    pub async fn next_search_line(&self, id: EngineRequestId) -> Result<Option<String>, Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(
            EngineCommand::NextSearch {
                id,
                reply: reply_tx,
            },
            reply,
        )
        .await?
    }
    pub async fn next_search_line_cancellable(
        &self,
        id: EngineRequestId,
        cancelled: &std::sync::atomic::AtomicBool,
    ) -> Result<Option<String>, Error> {
        if cancelled.load(Ordering::SeqCst) {
            self.stop_current().await?;
            return Err(Error::AnalysisCancelled);
        }
        loop {
            tokio::select! {
                result = self.next_search_line(id) => return result,
                _ = tokio::time::sleep(Duration::from_millis(25)) => {
                    if cancelled.load(Ordering::SeqCst) {
                        self.stop_current().await?;
                        return Err(Error::AnalysisCancelled);
                    }
                }
            }
        }
    }
    pub async fn stop_current(&self) -> Result<(), Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request_control(EngineCommand::Stop(reply_tx), reply)
            .await?
    }
    pub async fn terminate(&self) -> Result<(), Error> {
        self.interrupt.cancel();
        let (reply_tx, reply) = oneshot::channel();
        let termination = self
            .request_control(EngineCommand::Terminate(reply_tx), reply)
            .await
            .and_then(|result| result);
        let reaped = self.reap_task().await;
        // A poisoned actor may already have exited after reaping its child
        // before this control request can be delivered. That is a successful
        // shutdown boundary, not a reason to retain its supervisor entry.
        if matches!(&termination, Err(Error::EngineDisconnected)) && reaped.is_ok() {
            Ok(())
        } else {
            combine_shutdown_results(termination, reaped)
        }
    }

    async fn reap_task(&self) -> Result<(), Error> {
        // Take the handle before awaiting so a concurrent lifecycle call never
        // holds the mutex across an await. The command reply is sent only as
        // the actor exits, so the caller that takes this handle owns reaping.
        let task = self.task.lock().await.take();
        let Some(task) = task else {
            return Ok(());
        };
        task.await
            .map_err(|error| Error::Conflict(format!("engine actor task failed: {error}")))
    }
    pub async fn logs(&self) -> Result<Vec<EngineLog>, Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request_control(EngineCommand::Logs(reply_tx), reply)
            .await
    }
}

async fn engine_actor_loop(
    mut runtime: EngineRuntime,
    mut rx: mpsc::Receiver<EngineCommand>,
    mut control_rx: mpsc::Receiver<EngineCommand>,
    interrupt: CancellationToken,
) {
    let mut terminated = false;
    while let Some(command) = tokio::select! {
        biased;
        command = control_rx.recv() => command,
        command = rx.recv() => command,
    } {
        match command {
            EngineCommand::Init(reply) => {
                let _ = reply.send(runtime.init_uci_cancellable(&interrupt).await);
            }
            EngineCommand::ConfigureStart(reply) => {
                let _ = reply.send(runtime.start_uci_configuration().await);
            }
            EngineCommand::ConfigureNext(reply) => {
                let _ = reply.send(
                    runtime
                        .next_configuration_line_cancellable(&interrupt)
                        .await,
                );
            }
            EngineCommand::SetOption { name, value, reply } => {
                let _ = reply.send(runtime.set_option(&name, &value).await);
            }
            EngineCommand::SetPosition { fen, moves, reply } => {
                let _ = reply.send(runtime.set_position(&fen, &moves).await);
            }
            EngineCommand::EnsureReady(reply) => {
                let _ = reply.send(runtime.ensure_ready().await);
            }
            EngineCommand::StartSearch { mode, reply } => {
                let _ = reply.send(runtime.start_search(&mode).await);
            }
            EngineCommand::NextSearch { id, reply } => {
                if !service_search_read(&mut runtime, id, reply, &mut rx, &mut control_rx).await {
                    terminated = true;
                    break;
                }
            }
            EngineCommand::Stop(reply) => {
                let result = stop_at_protocol_boundary(&mut runtime).await;
                let failed = result.is_err();
                let _ = reply.send(result);
                if failed {
                    terminated = true;
                    break;
                }
            }
            EngineCommand::Terminate(reply) => {
                let result = runtime.terminate().await;
                let _ = reply.send(result);
                terminated = true;
                break;
            }
            EngineCommand::Logs(reply) => {
                let _ = reply.send(runtime.logs.entries());
            }
        }
    }
    if !terminated {
        if let Err(error) = runtime.terminate().await {
            error!("engine actor failed to terminate after command channels closed: {error}");
        }
    }
}

/// A failed UCI stop means stdout can no longer be correlated with a request.
/// The only safe recovery is to reap the process and permanently close this
/// actor, never to accept another `position`/`go` on the same stream.
async fn stop_at_protocol_boundary(runtime: &mut EngineRuntime) -> Result<(), Error> {
    match runtime.stop_current().await {
        Ok(()) => Ok(()),
        Err(primary) => match runtime.terminate().await {
            Ok(()) => Err(primary),
            Err(cleanup) => Err(Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: cleanup.to_string(),
            }),
        },
    }
}

async fn service_search_read(
    runtime: &mut EngineRuntime,
    id: EngineRequestId,
    reply: oneshot::Sender<Result<Option<String>, Error>>,
    rx: &mut mpsc::Receiver<EngineCommand>,
    control_rx: &mut mpsc::Receiver<EngineCommand>,
) -> bool {
    if runtime.state != (EngineState::Searching { request_id: id })
        && runtime.state != (EngineState::Stopping { request_id: id })
    {
        let _ = reply.send(Ok(None));
        return true;
    }
    loop {
        tokio::select! {
            biased;
            control = control_rx.recv() => if let Some(control) = control { match control {
                    EngineCommand::Terminate(control_reply) => {
                        let result = runtime.terminate().await;
                        let _ = control_reply.send(result);
                        let _ = reply.send(Err(Error::EngineDisconnected));
                        return false;
                    }
                    EngineCommand::Stop(control_reply) => {
                        let result = stop_at_protocol_boundary(runtime).await;
                        let failed = result.is_err();
                        let _ = control_reply.send(result);
                        let _ = reply.send(if failed {
                            Err(Error::EngineDisconnected)
                        } else {
                            Ok(None)
                        });
                        return !failed;
                    }
                    EngineCommand::Logs(control_reply) => {
                        let _ = control_reply.send(runtime.logs.entries());
                    }
                    other => reject_command_during_search(other),
                } },
            result = timeout(runtime.deadlines.search, runtime.read_line()) => {
                let result = match result {
                    Ok(Ok(Some(line))) => {
                        if matches!(vampirc_uci::parse_one(&line), UciMessage::BestMove { .. }) {
                            runtime.state = EngineState::Idle;
                        }
                        Ok(Some(line))
                    }
                    Ok(Ok(None)) => {
                        runtime.state = EngineState::Idle;
                        Err(Error::EngineDisconnected)
                    }
                    Ok(Err(error)) => Err(error),
                    Err(_) => Err(Error::EngineTimeout("waiting for engine search output".into())),
                };
                let _ = reply.send(result);
                return true;
            }
            command = rx.recv() => match command {
                Some(EngineCommand::Terminate(control_reply)) => {
                    let result = runtime.terminate().await;
                    let _ = control_reply.send(result);
                    let _ = reply.send(Err(Error::EngineDisconnected));
                    return false;
                }
                Some(EngineCommand::Stop(control_reply)) => {
                    let result = stop_at_protocol_boundary(runtime).await;
                    let failed = result.is_err();
                    let _ = control_reply.send(result);
                    let _ = reply.send(if failed {
                        Err(Error::EngineDisconnected)
                    } else {
                        Ok(None)
                    });
                    return !failed;
                }
                Some(EngineCommand::Logs(control_reply)) => {
                    // Logs are observational. They must remain available while
                    // stdout is silent without cancelling the active search.
                    let _ = control_reply.send(runtime.logs.entries());
                }
                Some(other) => reject_command_during_search(other),
                None => {
                    let _ = runtime.terminate().await;
                    let _ = reply.send(Err(Error::EngineDisconnected));
                    return false;
                }
            }
        }
    }
}

fn reject_command_during_search(command: EngineCommand) {
    let error = || Error::Conflict("engine is busy searching; stop or terminate it first".into());
    match command {
        EngineCommand::Init(reply)
        | EngineCommand::ConfigureStart(reply)
        | EngineCommand::EnsureReady(reply) => {
            let _ = reply.send(Err(error()));
        }
        EngineCommand::ConfigureNext(reply) | EngineCommand::NextSearch { reply, .. } => {
            let _ = reply.send(Err(error()));
        }
        EngineCommand::SetOption { reply, .. } | EngineCommand::SetPosition { reply, .. } => {
            let _ = reply.send(Err(error()));
        }
        EngineCommand::StartSearch { reply, .. } => {
            let _ = reply.send(Err(error()));
        }
        EngineCommand::Stop(reply) => {
            let _ = reply.send(Err(error()));
        }
        EngineCommand::Terminate(reply) => {
            let _ = reply.send(Err(error()));
        }
        EngineCommand::Logs(reply) => {
            let _ = reply.send(Vec::new());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        collections::VecDeque,
        io,
        sync::{
            atomic::{AtomicBool, AtomicUsize, Ordering as AtomicOrdering},
            Arc,
        },
    };
    use tokio::{io::AsyncBufReadExt, sync::Mutex};

    /// A real child process, spawned exactly the way production spawns an engine,
    /// must read the inode that was authorized at spawn time — not whatever the
    /// visible path resolves to once the option is applied. The fixture is a
    /// shebang script on purpose: it is the case that forces the interpreter to
    /// reopen the engine image through its inherited descriptor, and it is also
    /// how users install wrapper-script engines.
    #[cfg(unix)]
    #[tokio::test]
    async fn inherited_resource_fd_survives_path_replacement_for_uci_child() {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("uci-child.sh");
        // Echoes back the file the `setoption` value points at, so the assertion
        // below reads the bytes the child itself resolved.
        std::fs::write(
            &script,
            "#!/bin/sh\nwhile IFS= read -r line; do case \"$line\" in uci) echo uciok;; isready) echo readyok;; setoption*) p=${line#*value }; cat \"$p\";; quit) exit 0;; esac; done\n",
        )
        .unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let resource = directory.path().join("resource.bin");
        // The trailing newline matters: the child pipes `cat` output straight into
        // the UCI line protocol, so an unterminated body would fuse with `readyok`.
        std::fs::write(&resource, b"pinned-bytes\n").unwrap();
        let lease = crate::infra::path_authority::EngineResourceLease::test_file(
            std::fs::File::open(&resource).unwrap(),
        );
        // The production UCI value, not a hand-built path: this is what
        // `resolve_engine_options` hands to `setoption`.
        let uci_value = lease.uci_value();
        let executable = crate::infra::path_authority::EngineExecutable::test_fixture(
            std::fs::File::open(&script).unwrap(),
            directory.path().to_path_buf(),
            vec![lease],
        );
        let actor = EngineActor::spawn_initialized(executable, EngineDeadlines::default())
            .await
            .unwrap();

        // Replace the resource behind its visible path after the engine is live.
        std::fs::remove_file(&resource).unwrap();
        std::fs::write(&resource, b"replacement-bytes\n").unwrap();
        assert_eq!(
            std::fs::read_to_string(&resource).unwrap(),
            "replacement-bytes\n",
            "the visible path must really have been replaced for this test to mean anything",
        );

        actor.set_option("Book", &uci_value).await.unwrap();
        actor.ensure_ready().await.unwrap();
        let engine_lines: Vec<String> = actor
            .logs()
            .await
            .unwrap()
            .iter()
            .filter_map(|entry| match entry {
                EngineLog::Engine(line) => Some(line.trim().to_owned()),
                _ => None,
            })
            .collect();
        assert!(
            engine_lines.iter().any(|line| line == "pinned-bytes"),
            "child did not read the authorized inode; engine output was {engine_lines:?}",
        );
        assert!(
            !engine_lines.iter().any(|line| line == "replacement-bytes"),
            "child followed the replaced path; engine output was {engine_lines:?}",
        );
        actor.terminate().await.unwrap();
    }

    struct FakeIo {
        writes: Arc<Mutex<Vec<String>>>,
        lines: VecDeque<Option<String>>,
        terminate_calls: Arc<AtomicUsize>,
        fail_write: bool,
        fail_stop: bool,
        read_delay: Option<Duration>,
        terminate_delay: Option<Duration>,
    }
    type RecordedWrites = Arc<Mutex<Vec<String>>>;
    type FakeActor = (EngineActor, RecordedWrites);
    type FakeActorWithTermination = (FakeActor, Arc<AtomicUsize>);

    #[async_trait]
    impl UciIo for FakeIo {
        async fn write_line(&mut self, line: &str) -> Result<(), Error> {
            if self.fail_write || (self.fail_stop && line == "stop") {
                return Err(io::Error::new(io::ErrorKind::BrokenPipe, "fake stdin closed").into());
            }
            self.writes.lock().await.push(line.into());
            Ok(())
        }
        async fn read_line(&mut self) -> Result<Option<String>, Error> {
            if let Some(delay) = self.read_delay.take() {
                tokio::time::sleep(delay).await;
            }
            Ok(self.lines.pop_front().flatten())
        }
        async fn terminate(&mut self, _: Duration, _: Duration) -> Result<(), Error> {
            if let Some(delay) = self.terminate_delay {
                tokio::time::sleep(delay).await;
            }
            self.terminate_calls.fetch_add(1, AtomicOrdering::SeqCst);
            Ok(())
        }
    }

    enum FakeWait {
        Ready,
        Pending,
    }

    struct FakeChildControl {
        waits: VecDeque<FakeWait>,
        quit_pending: bool,
        kill_error: bool,
        kill_calls: Arc<AtomicUsize>,
        dropped: Arc<AtomicBool>,
    }

    impl Drop for FakeChildControl {
        fn drop(&mut self) {
            self.dropped.store(true, AtomicOrdering::SeqCst);
        }
    }

    #[async_trait]
    impl ChildControl for FakeChildControl {
        async fn write_quit(&mut self) -> Result<(), Error> {
            if self.quit_pending {
                std::future::pending().await
            } else {
                Ok(())
            }
        }

        fn start_kill(&mut self) -> Result<(), Error> {
            self.kill_calls.fetch_add(1, AtomicOrdering::SeqCst);
            if self.kill_error {
                Err(io::Error::other("fake force-kill failed").into())
            } else {
                Ok(())
            }
        }

        async fn wait(&mut self) -> Result<(), Error> {
            match self.waits.pop_front().unwrap_or(FakeWait::Pending) {
                FakeWait::Ready => Ok(()),
                FakeWait::Pending => std::future::pending().await,
            }
        }
    }

    fn child_control(
        waits: impl IntoIterator<Item = FakeWait>,
    ) -> (FakeChildControl, Arc<AtomicUsize>, Arc<AtomicBool>) {
        let kill_calls = Arc::new(AtomicUsize::new(0));
        let dropped = Arc::new(AtomicBool::new(false));
        (
            FakeChildControl {
                waits: waits.into_iter().collect(),
                quit_pending: false,
                kill_error: false,
                kill_calls: kill_calls.clone(),
                dropped: dropped.clone(),
            },
            kill_calls,
            dropped,
        )
    }

    #[tokio::test]
    async fn terminate_child_skips_force_kill_when_graceful_wait_succeeds() {
        let (child, kill_calls, dropped) = child_control([FakeWait::Ready]);
        terminate_child(child, Duration::from_millis(5), Duration::from_millis(5))
            .await
            .unwrap();
        assert_eq!(kill_calls.load(AtomicOrdering::SeqCst), 0);
        assert!(dropped.load(AtomicOrdering::SeqCst));
    }

    #[tokio::test]
    async fn terminate_child_force_kills_then_reaps_after_graceful_timeout() {
        let (child, kill_calls, _) = child_control([FakeWait::Pending, FakeWait::Ready]);
        terminate_child(child, Duration::from_millis(5), Duration::from_millis(5))
            .await
            .unwrap();
        assert_eq!(kill_calls.load(AtomicOrdering::SeqCst), 1);
    }

    #[tokio::test]
    async fn terminate_child_drops_child_after_force_kill_reap_timeout() {
        let (child, _, dropped) = child_control([FakeWait::Pending, FakeWait::Pending]);
        let result =
            terminate_child(child, Duration::from_millis(5), Duration::from_millis(5)).await;
        assert!(matches!(result, Err(Error::EngineTimeout(_))));
        assert!(dropped.load(AtomicOrdering::SeqCst));
    }

    #[tokio::test]
    async fn terminate_child_reports_kill_and_reap_failure_then_drops_child() {
        let (mut child, _, dropped) = child_control([FakeWait::Pending, FakeWait::Pending]);
        child.kill_error = true;
        let result =
            terminate_child(child, Duration::from_millis(5), Duration::from_millis(5)).await;
        assert!(matches!(result, Err(Error::OperationAndCleanup { .. })));
        assert!(dropped.load(AtomicOrdering::SeqCst));
    }

    #[tokio::test]
    async fn terminate_child_bounds_a_stuck_quit_write() {
        let (mut child, _, _) = child_control([FakeWait::Ready]);
        child.quit_pending = true;
        let _ = tokio::time::timeout(
            Duration::from_millis(30),
            terminate_child(child, Duration::from_millis(5), Duration::from_millis(5)),
        )
        .await
        .expect("quit write must be bounded");
    }

    #[test]
    fn production_child_termination_delegates_to_bounded_helper() {
        let source = include_str!("process.rs");
        let implementation = source
            .split_once("impl UciIo for ChildUciIo")
            .map(|(_, suffix)| suffix)
            .expect("ChildUciIo implementation must exist")
            .split_once("/// One-owner UCI actor")
            .map(|(implementation, _)| implementation)
            .expect("ChildUciIo implementation must precede EngineRuntime");
        assert!(
            implementation.contains("terminate_child(control, quit_timeout, kill_reap_timeout)"),
            "ChildUciIo::terminate must use the bounded production helper"
        );
    }
    fn actor(lines: &[&str]) -> FakeActor {
        actor_with(lines, false, None).0
    }

    fn actor_with(
        lines: &[&str],
        fail_write: bool,
        read_delay: Option<Duration>,
    ) -> FakeActorWithTermination {
        let writes = Arc::new(Mutex::new(Vec::new()));
        let terminate_calls = Arc::new(AtomicUsize::new(0));
        let io = FakeIo {
            writes: writes.clone(),
            lines: lines.iter().map(|line| Some((*line).into())).collect(),
            terminate_calls: terminate_calls.clone(),
            fail_write,
            fail_stop: false,
            read_delay,
            terminate_delay: None,
        };
        let deadlines = EngineDeadlines {
            search: Duration::from_millis(20),
            stop: Duration::from_millis(20),
            ..EngineDeadlines::default()
        };
        (
            (EngineActor::new(Box::new(io), deadlines), writes),
            terminate_calls,
        )
    }

    fn actor_with_terminate_delay(delay: Duration) -> FakeActorWithTermination {
        let writes = Arc::new(Mutex::new(Vec::new()));
        let terminate_calls = Arc::new(AtomicUsize::new(0));
        let io = FakeIo {
            writes: writes.clone(),
            lines: VecDeque::new(),
            terminate_calls: terminate_calls.clone(),
            fail_write: false,
            fail_stop: false,
            read_delay: None,
            terminate_delay: Some(delay),
        };
        (
            (
                EngineActor::new(Box::new(io), EngineDeadlines::default()),
                writes,
            ),
            terminate_calls,
        )
    }

    fn actor_with_stop_failure(lines: &[&str]) -> FakeActorWithTermination {
        let writes = Arc::new(Mutex::new(Vec::new()));
        let terminate_calls = Arc::new(AtomicUsize::new(0));
        let io = FakeIo {
            writes: writes.clone(),
            lines: lines.iter().map(|line| Some((*line).into())).collect(),
            terminate_calls: terminate_calls.clone(),
            fail_write: false,
            fail_stop: true,
            read_delay: None,
            terminate_delay: None,
        };
        (
            (
                EngineActor::new(Box::new(io), EngineDeadlines::default()),
                writes,
            ),
            terminate_calls,
        )
    }

    fn path_ref(id: &str) -> PathRef {
        PathRef { id: id.into() }
    }

    struct TerminateErrorIo;

    struct PendingTerminateErrorIo;

    #[async_trait]
    impl UciIo for PendingTerminateErrorIo {
        async fn write_line(&mut self, _: &str) -> Result<(), Error> {
            Ok(())
        }

        async fn read_line(&mut self) -> Result<Option<String>, Error> {
            std::future::pending().await
        }

        async fn terminate(&mut self, _: Duration, _: Duration) -> Result<(), Error> {
            Err(io::Error::other("fake cancelled terminate failed").into())
        }
    }

    #[async_trait]
    impl UciIo for TerminateErrorIo {
        async fn write_line(&mut self, _: &str) -> Result<(), Error> {
            Ok(())
        }

        async fn read_line(&mut self) -> Result<Option<String>, Error> {
            Ok(None)
        }

        async fn terminate(&mut self, _: Duration, _: Duration) -> Result<(), Error> {
            Err(io::Error::other("fake terminate failed").into())
        }
    }

    #[tokio::test]
    async fn initialization_and_termination_failure_are_combined_and_unpublished() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("engine-config".into(), "probe".into()).unwrap();
        let actor = Arc::new(EngineActor::new(
            Box::new(TerminateErrorIo),
            EngineDeadlines::default(),
        ));

        let result = initialize_registered_actor(
            supervisor.clone(),
            key.clone(),
            actor,
            "probe".into(),
            path_ref("probe-path"),
            |actor| async move { actor.init_uci().await },
        )
        .await;

        assert!(matches!(result, Err(Error::OperationAndCleanup { .. })));
        assert!(supervisor.get_exact(&key).is_none());
    }

    #[tokio::test]
    async fn cancelled_registration_logs_a_failed_reap() {
        match REGISTRATION_CLEANUP_ERRORS.lock() {
            Ok(mut errors) => errors.clear(),
            Err(poisoned) => poisoned.into_inner().clear(),
        }
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("engine-config".into(), "cancelled-probe".into()).unwrap();
        let actor = Arc::new(EngineActor::new(
            Box::new(PendingTerminateErrorIo),
            EngineDeadlines::default(),
        ));
        let initialization = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            async move {
                initialize_registered_actor(
                    supervisor,
                    key,
                    actor,
                    "cancelled-probe".into(),
                    path_ref("probe-path"),
                    |actor| async move { actor.init_uci().await },
                )
                .await
            }
        });
        while supervisor.get_exact(&key).is_none() {
            tokio::task::yield_now().await;
        }

        initialization.abort();
        let _ = initialization.await;
        tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                let logged = match REGISTRATION_CLEANUP_ERRORS.lock() {
                    Ok(errors) => errors.iter().any(|message| {
                        message.contains(
                            "cancelled engine registration could not be terminated cleanly",
                        ) && message.contains("I/O failure")
                    }),
                    Err(poisoned) => poisoned.into_inner().iter().any(|message| {
                        message.contains(
                            "cancelled engine registration could not be terminated cleanly",
                        ) && message.contains("I/O failure")
                    }),
                };
                if logged {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("Drop cleanup failure must be logged");
        assert!(supervisor.get_exact(&key).is_none());
    }
    #[tokio::test]
    async fn replacement_waits_for_old_bestmove_before_go() {
        let (actor, writes) = actor(&["bestmove e2e4"]);
        let first = actor.start_search(&GoMode::Depth(1)).await.unwrap();
        let second = actor.start_search(&GoMode::Depth(2)).await.unwrap();
        assert_ne!(first, second);
        assert_eq!(
            *writes.lock().await,
            vec!["go depth 1", "stop", "go depth 2"]
        );
    }
    #[tokio::test]
    async fn eof_is_disconnect_not_empty_success() {
        let (actor, _) = actor(&[]);
        let id = actor.start_search(&GoMode::Depth(1)).await.unwrap();
        assert!(matches!(
            actor.next_search_line(id).await,
            Err(Error::EngineDisconnected)
        ));
    }

    #[tokio::test]
    async fn disconnected_logs_are_an_error() {
        let (actor, _) = actor(&[]);
        actor.terminate().await.unwrap();
        assert!(matches!(actor.logs().await, Err(Error::EngineDisconnected)));
    }

    #[tokio::test]
    async fn registered_initialization_is_visible_and_cancellation_removes_it() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let ((actor, _), _) =
            actor_with(&["uciok", "readyok"], false, Some(Duration::from_secs(60)));
        let initialization = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            async move {
                initialize_registered_actor(
                    supervisor,
                    key,
                    Arc::new(actor),
                    "engine".into(),
                    path_ref("engine-path"),
                    |actor| async move { actor.init_uci().await },
                )
                .await
            }
        });

        tokio::time::timeout(Duration::from_secs(1), async {
            while supervisor.get_exact(&key).is_none() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("actor must be registered while uciok is pending");

        initialization.abort();
        let _ = initialization.await;
        tokio::time::timeout(Duration::from_secs(1), async {
            while supervisor.get_exact(&key).is_some() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("registration guard must remove a cancelled initialization");
    }

    #[tokio::test]
    async fn terminate_all_reaps_an_actor_awaiting_uciok() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("engine-config".into(), "probe".into()).unwrap();
        let ((actor, _), terminated) =
            actor_with(&["uciok", "readyok"], false, Some(Duration::from_secs(60)));
        let initialization = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            async move {
                initialize_registered_actor(
                    supervisor,
                    key,
                    Arc::new(actor),
                    "probe".into(),
                    path_ref("shared-path"),
                    |actor| async move { actor.init_uci().await },
                )
                .await
            }
        });
        while supervisor.get_exact(&key).is_none() {
            tokio::task::yield_now().await;
        }

        supervisor.terminate_all().await.unwrap();

        assert!(supervisor.get_exact(&key).is_none());
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(initialization.await.unwrap().is_err());
    }

    #[tokio::test]
    async fn two_probe_keys_can_share_one_executable_path_ref() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let shared_path = path_ref("shared-path");
        let mut initializations = Vec::new();
        let mut keys = Vec::new();
        for probe in ["probe-1", "probe-2"] {
            let key = EngineKey::new("engine-config".into(), probe.into()).unwrap();
            let ((actor, _), _) =
                actor_with(&["uciok", "readyok"], false, Some(Duration::from_secs(60)));
            initializations.push(tokio::spawn({
                let supervisor = supervisor.clone();
                let key = key.clone();
                let shared_path = shared_path.clone();
                async move {
                    initialize_registered_actor(
                        supervisor,
                        key,
                        Arc::new(actor),
                        probe.into(),
                        shared_path,
                        |actor| async move { actor.init_uci().await },
                    )
                    .await
                }
            }));
            keys.push(key);
        }
        tokio::time::timeout(Duration::from_secs(1), async {
            while keys.iter().any(|key| supervisor.get_exact(key).is_none()) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("both probes must publish independently");

        for initialization in initializations {
            initialization.abort();
            let _ = initialization.await;
        }
        tokio::time::timeout(Duration::from_secs(1), async {
            while keys.iter().any(|key| supervisor.get_exact(key).is_some()) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn cancellation_stops_the_exact_active_request() {
        let (actor, writes) = actor(&["bestmove e2e4"]);
        let id = actor.start_search(&GoMode::Depth(1)).await.unwrap();
        let cancelled = std::sync::atomic::AtomicBool::new(true);
        assert!(matches!(
            actor.next_search_line_cancellable(id, &cancelled).await,
            Err(Error::AnalysisCancelled)
        ));
        assert_eq!(*writes.lock().await, vec!["go depth 1", "stop"]);
    }

    #[tokio::test]
    async fn failed_stop_reaps_the_actor_and_rejects_a_new_search() {
        let ((actor, _), terminate_calls) = actor_with_stop_failure(&[]);
        actor.start_search(&GoMode::Depth(1)).await.unwrap();
        assert!(actor.stop_current().await.is_err());
        assert_eq!(terminate_calls.load(AtomicOrdering::SeqCst), 1);
        assert!(matches!(
            actor.start_search(&GoMode::Depth(2)).await,
            Err(Error::EngineDisconnected)
        ));
    }
    #[tokio::test]
    async fn line_limited_logs_report_the_exact_drop_count() {
        let mut logs = BoundedLogs::default();
        for _ in 0..MAX_LOG_LINES + 10 {
            logs.push(EngineLog::Engine("line".into()));
        }
        assert_eq!(logs.entries.len(), MAX_LOG_LINES);
        assert!(logs.truncated);
        assert_eq!(logs.dropped_entries, 10);
        assert!(matches!(
            logs.entries().first(),
            Some(EngineLog::Truncated {
                dropped_entries: 10
            })
        ));
    }

    #[test]
    fn byte_limited_logs_report_the_exact_drop_count() {
        let mut logs = BoundedLogs::default();
        logs.push(EngineLog::Gui("a".repeat(MAX_LOG_BYTES / 2)));
        logs.push(EngineLog::Engine("b".repeat(MAX_LOG_BYTES / 2)));
        logs.push(EngineLog::Gui("c".into()));

        assert_eq!(logs.entries.len(), 2);
        assert_eq!(logs.bytes, MAX_LOG_BYTES / 2 + 1);
        assert_eq!(logs.dropped_entries, 1);
        assert!(matches!(
            logs.entries().first(),
            Some(EngineLog::Truncated { dropped_entries: 1 })
        ));
    }

    #[tokio::test]
    async fn exact_generation_cleanup_cannot_remove_replacement() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("a".into(), "engine".into()).unwrap();
        let (first, _) = actor(&[]);
        let first = supervisor.replace(key.clone(), first).await.unwrap();
        let (second, _) = actor(&[]);
        let second = supervisor.replace(key.clone(), second).await.unwrap();
        supervisor
            .terminate_exact(&key, first.generation)
            .await
            .unwrap();
        assert_eq!(
            supervisor.get_exact(&key).unwrap().generation,
            second.generation
        );
    }

    #[tokio::test]
    async fn terminate_exact_removes_entry_when_termination_reports_an_error() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let actor = EngineActor::new(Box::new(TerminateErrorIo), EngineDeadlines::default());
        let supervised = supervisor.replace(key.clone(), actor).await.unwrap();

        assert!(supervisor
            .terminate_exact(&key, supervised.generation)
            .await
            .is_err());
        assert!(supervisor.get_exact(&key).is_none());
    }

    #[tokio::test]
    async fn terminate_all_reaps_every_registered_actor() {
        let supervisor = EngineSupervisor::default();
        let mut registered = Vec::new();
        for (tab, engine) in [("first", "a"), ("second", "b")] {
            let key = EngineKey::new(tab.into(), engine.into()).unwrap();
            let ((actor, _), terminated) = actor_with(&[], false, None);
            supervisor.replace(key.clone(), actor).await.unwrap();
            registered.push((key, terminated));
        }

        supervisor.terminate_all().await.unwrap();

        for (key, terminated) in registered {
            assert_eq!(
                terminated.load(AtomicOrdering::SeqCst),
                1,
                "every registered actor must be terminated, not only the first"
            );
            assert!(
                supervisor.get_exact(&key).is_none(),
                "a terminated actor must leave no registry entry behind"
            );
        }
    }

    #[tokio::test]
    async fn failed_stop_removes_entry_and_allows_replacement() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let ((old, _), terminated) = actor_with_stop_failure(&[]);
        old.start_search(&GoMode::Depth(1)).await.unwrap();
        supervisor.replace(key.clone(), old).await.unwrap();

        assert!(supervisor.stop_exact(&key).await.is_err());
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());

        let (replacement, _) = actor(&[]);
        supervisor.replace(key.clone(), replacement).await.unwrap();
        assert!(supervisor.get_exact(&key).is_some());
        supervisor.terminate_all().await.unwrap();
    }

    #[tokio::test]
    async fn retire_engine_reaps_matching_owners_across_tabs_only() {
        let supervisor = EngineSupervisor::default();
        let mut retired = Vec::new();
        for tab in ["first", "second"] {
            let key = EngineKey::new(tab.into(), "owner".into()).unwrap();
            let ((actor, _), terminated) = actor_with(&[], false, None);
            supervisor.replace(key.clone(), actor).await.unwrap();
            retired.push((key, terminated));
        }
        let survivor_key = EngineKey::new("first".into(), "other".into()).unwrap();
        let ((survivor, _), survivor_terminated) = actor_with(&[], false, None);
        supervisor
            .replace(survivor_key.clone(), survivor)
            .await
            .unwrap();

        supervisor.retire_engine("owner".into()).await.unwrap();

        for (key, terminated) in retired {
            assert!(supervisor.get_exact(&key).is_none());
            assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        }
        assert!(supervisor.get_exact(&survivor_key).is_some());
        assert_eq!(survivor_terminated.load(AtomicOrdering::SeqCst), 0);
        supervisor.terminate_all().await.unwrap();
    }

    #[tokio::test]
    async fn retire_engine_matches_analysis_owner_not_operation_key() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("analysis".into(), "operation".into()).unwrap();
        let ((actor, _), terminated) = actor_with(&[], false, None);
        supervisor
            .replace_handle(
                key.clone(),
                Arc::new(actor),
                "engine-E".into(),
                PathRef {
                    id: "engine-path".into(),
                },
            )
            .await
            .unwrap();

        supervisor.retire_engine("other".into()).await.unwrap();
        assert!(supervisor.get_exact(&key).is_some());
        supervisor.retire_engine("engine-E".into()).await.unwrap();
        assert!(supervisor.get_exact(&key).is_none());
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
    }

    #[tokio::test]
    async fn retired_engine_id_refuses_static_and_registration_blocked_replacements() {
        let supervisor = Arc::new(EngineSupervisor::default());
        supervisor.retire_engine("retired".into()).await.unwrap();
        let key = EngineKey::new("tab".into(), "retired".into()).unwrap();
        let ((actor, _), terminated) = actor_with(&[], false, None);
        assert!(matches!(
            supervisor.replace(key.clone(), actor).await,
            Err(Error::Conflict(message)) if message == "engine id is retired"
        ));
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());

        supervisor
            .retire_engine("cleanup-fails".into())
            .await
            .unwrap();
        let cleanup_key = EngineKey::new("tab".into(), "cleanup-fails".into()).unwrap();
        let cleanup_actor =
            EngineActor::new(Box::new(TerminateErrorIo), EngineDeadlines::default());
        assert!(matches!(
            supervisor.replace(cleanup_key, cleanup_actor).await,
            Err(Error::OperationAndCleanup { .. })
        ));

        let registration = supervisor.registration.lock().await;
        let race_key = EngineKey::new("tab".into(), "racing".into()).unwrap();
        let race_lifecycle = supervisor.lifecycle_slot(&race_key);
        let ((racing, _), racing_terminated) = actor_with(&[], false, None);
        let replacement = tokio::spawn({
            let supervisor = supervisor.clone();
            let race_key = race_key.clone();
            async move { supervisor.replace(race_key, racing).await }
        });
        while race_lifecycle.try_lock().is_ok() {
            tokio::task::yield_now().await;
        }
        let retirement = tokio::spawn({
            let supervisor = supervisor.clone();
            async move { supervisor.retire_engine("racing".into()).await }
        });
        while !supervisor.is_retired("racing") {
            tokio::task::yield_now().await;
        }
        drop(registration);

        retirement.await.unwrap().unwrap();
        assert!(matches!(
            replacement.await.unwrap(),
            Err(Error::Conflict(_))
        ));
        assert_eq!(racing_terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&race_key).is_none());
    }

    #[tokio::test]
    async fn retired_engine_ids_evict_the_oldest_at_the_bound() {
        let supervisor = EngineSupervisor::default();
        for index in 0..=MAX_RETIRED_ENGINE_IDS {
            supervisor
                .retire_engine(format!("engine-{index}"))
                .await
                .unwrap();
        }
        assert!(!supervisor.is_retired("engine-0"));
        assert!(supervisor.is_retired(&format!("engine-{MAX_RETIRED_ENGINE_IDS}")));
    }

    #[tokio::test]
    async fn retired_executable_refuses_a_different_engine_id() {
        let supervisor = EngineSupervisor::default();
        let executable = path_ref("retired-path");
        supervisor
            .retire_executables(vec![executable.clone()])
            .await
            .unwrap();
        let key = EngineKey::new("tab".into(), "new-operation".into()).unwrap();
        let ((actor, _), terminated) = actor_with(&[], false, None);

        assert!(matches!(
            supervisor
                .replace_handle(key.clone(), Arc::new(actor), "different-id".into(), executable)
                .await,
            Err(Error::Conflict(message)) if message == "engine executable is retired"
        ));
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());
    }

    #[tokio::test]
    async fn retired_executable_recheck_blocks_a_concurrent_publication() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let registration = supervisor.registration.lock().await;
        let executable = path_ref("racing-path");
        let key = EngineKey::new("tab".into(), "operation".into()).unwrap();
        let lifecycle = supervisor.lifecycle_slot(&key);
        let ((actor, _), terminated) = actor_with(&[], false, None);
        let replacement = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            let executable = executable.clone();
            async move {
                supervisor
                    .replace_handle(key, Arc::new(actor), "engine-id".into(), executable)
                    .await
            }
        });
        while lifecycle.try_lock().is_ok() {
            tokio::task::yield_now().await;
        }
        let retirement = tokio::spawn({
            let supervisor = supervisor.clone();
            let executable = executable.clone();
            async move { supervisor.retire_executables(vec![executable]).await }
        });
        while !supervisor.is_retired_executable(&executable) {
            tokio::task::yield_now().await;
        }
        drop(registration);

        retirement.await.unwrap().unwrap();
        assert!(matches!(
            replacement.await.unwrap(),
            Err(Error::Conflict(_))
        ));
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());
    }

    #[tokio::test]
    async fn retired_executables_evict_the_oldest_at_the_bound() {
        let supervisor = EngineSupervisor::default();
        for index in 0..=MAX_RETIRED_PATH_REFS {
            supervisor
                .retire_executables(vec![path_ref(&format!("path-{index}"))])
                .await
                .unwrap();
        }
        assert!(!supervisor.is_retired_executable(&path_ref("path-0")));
        assert!(
            supervisor.is_retired_executable(&path_ref(&format!("path-{MAX_RETIRED_PATH_REFS}")))
        );

        let oldest_key = EngineKey::new("tab".into(), "oldest".into()).unwrap();
        let (oldest, _) = actor(&[]);
        supervisor
            .replace_handle(
                oldest_key.clone(),
                Arc::new(oldest),
                "engine-id".into(),
                path_ref("path-0"),
            )
            .await
            .unwrap();
        let newest_key = EngineKey::new("tab".into(), "newest".into()).unwrap();
        let (newest, _) = actor(&[]);
        assert!(supervisor
            .replace_handle(
                newest_key,
                Arc::new(newest),
                "other-engine-id".into(),
                path_ref(&format!("path-{MAX_RETIRED_PATH_REFS}")),
            )
            .await
            .is_err());
        supervisor.terminate_all().await.unwrap();
    }

    #[tokio::test]
    async fn terminate_all_terminates_registered_actors_concurrently() {
        let supervisor = EngineSupervisor::default();
        let per_actor_delay = Duration::from_millis(100);
        for index in 0..4 {
            let key = EngineKey::new("tab".into(), format!("engine-{index}")).unwrap();
            let ((actor, _), _) = actor_with_terminate_delay(per_actor_delay);
            supervisor.replace(key, actor).await.unwrap();
        }

        let started = std::time::Instant::now();
        supervisor.terminate_all().await.unwrap();
        assert!(
            started.elapsed() < Duration::from_millis(250),
            "four 100 ms terminations must overlap rather than taking their 400 ms sum"
        );
    }

    #[tokio::test]
    async fn terminate_all_seals_the_supervisor_against_replacement() {
        let supervisor = EngineSupervisor::default();
        supervisor.terminate_all().await.unwrap();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let ((actor, _), terminated) = actor_with(&[], false, None);

        assert!(matches!(
            supervisor.replace(key, actor).await,
            Err(Error::Conflict(message)) if message == "application is shutting down"
        ));
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
    }

    #[tokio::test]
    async fn terminate_all_drains_an_actor_published_during_shutdown() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let initial_key = EngineKey::new("tab".into(), "initial".into()).unwrap();
        let ((initial, _), _) = actor_with_terminate_delay(Duration::from_millis(100));
        supervisor.replace(initial_key, initial).await.unwrap();

        let shutdown = tokio::spawn({
            let supervisor = supervisor.clone();
            async move { supervisor.terminate_all().await }
        });
        while !supervisor.sealed.load(Ordering::SeqCst) {
            tokio::task::yield_now().await;
        }
        let slipped_key = EngineKey::new("tab".into(), "slipped".into()).unwrap();
        let ((slipped, _), terminated) = actor_with(&[], false, None);
        supervisor.actors.insert(
            slipped_key.clone(),
            SupervisedEngine {
                generation: 99,
                engine_id: "slipped".into(),
                executable: PathRef {
                    id: "slipped-path".into(),
                },
                actor: Arc::new(slipped),
                cancelled: Arc::new(AtomicBool::new(false)),
            },
        );

        shutdown.await.unwrap().unwrap();
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&slipped_key).is_none());
    }

    #[tokio::test]
    async fn uci_acknowledgements_are_exact_and_timeout_is_bounded() {
        let (actor, _) = actor(&["uciok-not-an-ack"]);
        assert!(matches!(
            actor.init_uci().await,
            Err(Error::EngineDisconnected)
        ));
    }

    #[tokio::test]
    async fn broken_stdin_does_not_enter_or_leave_a_search_state() {
        let ((actor, _), _) = actor_with(&[], true, None);
        assert!(matches!(
            actor.start_search(&GoMode::Depth(1)).await,
            Err(Error::Io(_))
        ));
    }

    #[tokio::test]
    async fn oversized_engine_output_is_rejected_before_log_growth() {
        let oversized = "x".repeat(MAX_ENGINE_LINE_BYTES + 1);
        let writes = Arc::new(Mutex::new(Vec::new()));
        let terminate_calls = Arc::new(AtomicUsize::new(0));
        let io = FakeIo {
            writes,
            lines: VecDeque::from([Some(oversized)]),
            terminate_calls,
            fail_write: false,
            fail_stop: false,
            read_delay: None,
            terminate_delay: None,
        };
        let actor = EngineActor::new(Box::new(io), EngineDeadlines::default());
        let id = actor.start_search(&GoMode::Depth(1)).await.unwrap();
        assert!(matches!(
            actor.next_search_line(id).await,
            Err(Error::ResourceLimit(_))
        ));
        assert!(actor.logs().await.unwrap().len() <= MAX_LOG_LINES);
    }

    #[tokio::test]
    async fn child_reader_enforces_the_line_limit_before_allocating_the_payload() {
        let (mut writer, reader) = tokio::io::duplex(1024);
        let payload = vec![b'x'; MAX_ENGINE_LINE_BYTES + 1];
        let writer = tokio::spawn(async move { writer.write_all(&payload).await });
        let mut reader = BufReader::new(reader);
        let result = read_bounded_engine_line(&mut reader).await;
        assert!(matches!(result, Err(Error::ResourceLimit(_))));
        drop(reader);
        // Closing the hostile stream is expected to interrupt its writer.
        let _ = writer.await;
    }

    #[tokio::test]
    async fn child_reader_normalizes_line_endings() {
        let (mut writer, reader) = tokio::io::duplex(64);
        let writer = tokio::spawn(async move { writer.write_all(b"readyok\r\n").await.unwrap() });
        let mut reader = BufReader::new(reader);
        assert_eq!(
            read_bounded_engine_line(&mut reader).await.unwrap(),
            Some("readyok".into())
        );
        writer.await.unwrap();
    }

    #[tokio::test]
    async fn replacement_reaps_old_actor_even_when_stop_fails() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let ((old, _), terminated) = actor_with_stop_failure(&[]);
        old.start_search(&GoMode::Depth(1)).await.unwrap();
        supervisor.replace(key.clone(), old).await.unwrap();
        let (replacement, _) = actor(&[]);
        assert!(supervisor.replace(key.clone(), replacement).await.is_err());
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());
    }

    #[tokio::test]
    async fn broken_stdin_does_not_retain_an_already_reaped_actor() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let ((old, _), terminated) = actor_with(&[], true, None);
        supervisor.replace(key.clone(), old).await.unwrap();

        let (replacement, _) = actor(&[]);
        let replacement = supervisor.replace(key.clone(), replacement).await.unwrap();
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert_eq!(
            supervisor.get_exact(&key).unwrap().generation,
            replacement.generation
        );
    }

    #[tokio::test]
    async fn termination_preempts_a_silent_search_read() {
        let ((actor, _), _) = actor_with(&[], false, Some(Duration::from_secs(1)));
        let request = actor.start_search(&GoMode::Depth(1)).await.unwrap();
        let waiting = tokio::spawn({
            let actor = actor.clone();
            async move { actor.next_search_line(request).await }
        });
        tokio::time::sleep(Duration::from_millis(5)).await;
        tokio::time::timeout(Duration::from_millis(50), actor.terminate())
            .await
            .expect("terminate must preempt stdout wait")
            .unwrap();
        assert!(matches!(
            waiting.await.unwrap(),
            Err(Error::EngineDisconnected)
        ));
    }

    #[tokio::test]
    async fn termination_reaps_the_actor_task() {
        let ((actor, _), terminated) = actor_with(&[], false, None);

        actor.terminate().await.unwrap();

        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(actor.task.lock().await.is_none());
    }

    fn fake_io() -> FakeIo {
        FakeIo {
            writes: Arc::new(Mutex::new(Vec::new())),
            lines: VecDeque::new(),
            terminate_calls: Arc::new(AtomicUsize::new(0)),
            fail_write: false,
            fail_stop: false,
            read_delay: None,
            terminate_delay: None,
        }
    }

    fn pending_stderr_drain(finished: Arc<AtomicBool>) -> tokio::task::JoinHandle<()> {
        pending_stderr_drain_started(finished, None)
    }

    fn pending_stderr_drain_started(
        finished: Arc<AtomicBool>,
        started: Option<oneshot::Sender<()>>,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            struct Flag(Arc<AtomicBool>);
            impl Drop for Flag {
                fn drop(&mut self) {
                    self.0.store(true, AtomicOrdering::SeqCst);
                }
            }
            let _flag = Flag(finished);
            if let Some(started) = started {
                let _ = started.send(());
            }
            std::future::pending::<()>().await;
        })
    }

    #[tokio::test]
    async fn stop_current_keeps_the_stderr_drain_alive() {
        let mut io = fake_io();
        io.lines.push_back(Some("bestmove e2e4".into()));
        let mut runtime = EngineRuntime::new(Box::new(io), EngineDeadlines::default());
        let finished = Arc::new(AtomicBool::new(false));
        let (started_tx, started_rx) = oneshot::channel();
        runtime.stderr_drain_task = Some(pending_stderr_drain_started(
            finished.clone(),
            Some(started_tx),
        ));
        started_rx.await.unwrap();
        runtime.start_search(&GoMode::Depth(1)).await.unwrap();

        runtime.stop_current().await.unwrap();

        assert!(runtime.stderr_drain_task.is_some());
        assert!(
            !finished.load(AtomicOrdering::SeqCst),
            "stop must not abort the stderr drain"
        );
    }

    #[tokio::test]
    async fn stderr_drain_consumes_input_after_the_log_budget_is_exceeded() {
        let chunk = vec![b'x'; MAX_ENGINE_LINE_BYTES / 2];
        let mut input = Vec::new();
        while input.len() <= MAX_ENGINE_STDERR_BYTES {
            input.extend_from_slice(&chunk);
            input.push(b'\n');
        }
        input.extend_from_slice(b"still-alive\n");
        let mut reader = BufReader::new(std::io::Cursor::new(input));

        drain_engine_stderr(&mut reader).await;

        assert!(
            reader.fill_buf().await.unwrap().is_empty(),
            "stderr drain must continue through EOF"
        );
    }

    #[tokio::test]
    async fn stderr_drain_discards_an_oversized_line_and_consumes_the_next_line() {
        let mut input = vec![b'x'; MAX_ENGINE_LINE_BYTES + 1];
        input.extend_from_slice(b"\nstill-alive\n");
        let mut reader = BufReader::new(std::io::Cursor::new(input));

        drain_engine_stderr(&mut reader).await;

        assert!(
            reader.fill_buf().await.unwrap().is_empty(),
            "oversized stderr lines must not stop or spin the drain"
        );
    }

    #[tokio::test]
    async fn terminate_lets_the_stderr_drain_finish_naturally_after_child_reap() {
        let finished_naturally = Arc::new(AtomicBool::new(false));
        let flag = finished_naturally.clone();
        let drain = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(30)).await;
            flag.store(true, AtomicOrdering::SeqCst);
        });
        let mut runtime = EngineRuntime::new(Box::new(fake_io()), EngineDeadlines::default());
        runtime.stderr_drain_task = Some(drain);

        runtime.terminate().await.unwrap();

        assert!(
            finished_naturally.load(AtomicOrdering::SeqCst),
            "terminate must join the drain after child reap instead of aborting it immediately"
        );
    }

    #[tokio::test]
    async fn cancelling_terminate_aborts_the_taken_stderr_drain() {
        let finished = Arc::new(AtomicBool::new(false));
        let (started_tx, started_rx) = oneshot::channel();
        let mut runtime = EngineRuntime::new(Box::new(fake_io()), EngineDeadlines::default());
        runtime.stderr_drain_task = Some(pending_stderr_drain_started(
            finished.clone(),
            Some(started_tx),
        ));
        started_rx.await.unwrap();

        assert!(
            tokio::time::timeout(Duration::from_millis(5), runtime.terminate())
                .await
                .is_err(),
            "terminate must still be joining when the cancellation timeout fires"
        );
        tokio::time::timeout(Duration::from_millis(200), async {
            while !finished.load(AtomicOrdering::SeqCst) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("a cancelled reap must leave the stderr drain terminal");
    }

    #[tokio::test]
    async fn terminate_joins_a_finished_stderr_drain() {
        let handle = tokio::spawn(async {});
        let mut runtime = EngineRuntime::new(Box::new(fake_io()), EngineDeadlines::default());
        runtime.stderr_drain_task = Some(handle);
        tokio::time::timeout(Duration::from_millis(50), runtime.terminate())
            .await
            .expect("joining a finished stderr drain must not wait out the reap timeout")
            .unwrap();
        assert!(runtime.stderr_drain_task.is_none());
    }

    #[tokio::test]
    async fn terminate_aborts_a_stuck_stderr_drain() {
        let finished = Arc::new(AtomicBool::new(false));
        let mut runtime = EngineRuntime::new(Box::new(fake_io()), EngineDeadlines::default());
        runtime.stderr_drain_task = Some(pending_stderr_drain(finished.clone()));
        tokio::time::timeout(
            STDERR_REAP_TIMEOUT + Duration::from_millis(100),
            runtime.terminate(),
        )
        .await
        .expect("terminate must abort a stuck stderr drain")
        .unwrap();
        assert!(runtime.stderr_drain_task.is_none());
        assert!(
            finished.load(AtomicOrdering::SeqCst),
            "stderr drain must reach a terminal state on terminate"
        );
    }

    #[tokio::test]
    async fn dropping_the_runtime_aborts_the_stderr_drain() {
        let finished = Arc::new(AtomicBool::new(false));
        let (started_tx, started_rx) = oneshot::channel();
        {
            let mut runtime = EngineRuntime::new(Box::new(fake_io()), EngineDeadlines::default());
            runtime.stderr_drain_task = Some(pending_stderr_drain_started(
                finished.clone(),
                Some(started_tx),
            ));
            started_rx.await.unwrap();
        }
        let deadline = tokio::time::Instant::now() + Duration::from_millis(200);
        while !finished.load(AtomicOrdering::SeqCst) {
            if tokio::time::Instant::now() > deadline {
                panic!("stderr drain must be aborted when the runtime is dropped");
            }
            tokio::task::yield_now().await;
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn spawn_owns_the_stderr_drain_until_terminate() {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("uci-stderr.sh");
        std::fs::write(
            &script,
            "#!/bin/sh\necho boot >&2\nwhile IFS= read -r line; do case \"$line\" in quit) exit 0;; esac; done\n",
        )
        .unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let executable = crate::infra::path_authority::EngineExecutable::test_fixture(
            std::fs::File::open(&script).unwrap(),
            directory.path().to_path_buf(),
            vec![],
        );
        let mut runtime = EngineRuntime::spawn(executable, EngineDeadlines::default())
            .await
            .unwrap();
        assert!(
            runtime.stderr_drain_task.is_some(),
            "spawn must keep the stderr drain JoinHandle"
        );
        tokio::time::timeout(Duration::from_secs(2), runtime.terminate())
            .await
            .expect("terminate must join the stderr drain after the child exits")
            .unwrap();
        assert!(runtime.stderr_drain_task.is_none());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn real_child_ignoring_quit_is_force_killed_within_reap_budget() {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("ignore-quit.sh");
        std::fs::write(&script, "#!/bin/sh\nwhile IFS= read -r line; do :; done\n").unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let executable = crate::infra::path_authority::EngineExecutable::test_fixture(
            std::fs::File::open(&script).unwrap(),
            directory.path().to_path_buf(),
            vec![],
        );
        let deadlines = EngineDeadlines {
            quit: Duration::from_millis(20),
            kill_reap: Duration::from_millis(200),
            ..EngineDeadlines::default()
        };
        let mut runtime = EngineRuntime::spawn(executable, deadlines).await.unwrap();
        let started = std::time::Instant::now();

        runtime.terminate().await.unwrap();

        assert!(
            started.elapsed() < Duration::from_millis(500),
            "quit-ignoring child must not outlive quit + kill_reap + slack"
        );
    }

    #[tokio::test]
    async fn logs_preempt_a_silent_search_read_without_cancelling_the_search() {
        let ((actor, _), _) = actor_with(&["bestmove e2e4"], false, Some(Duration::from_secs(1)));
        let request = actor.start_search(&GoMode::Depth(1)).await.unwrap();
        let waiting = tokio::spawn({
            let actor = actor.clone();
            async move { actor.next_search_line(request).await }
        });
        tokio::time::sleep(Duration::from_millis(5)).await;

        tokio::time::timeout(Duration::from_millis(50), actor.logs())
            .await
            .expect("logs must preempt stdout wait")
            .unwrap();
        assert_eq!(
            tokio::time::timeout(Duration::from_millis(50), waiting)
                .await
                .expect("search must remain active after logs")
                .unwrap()
                .unwrap(),
            Some("bestmove e2e4".into())
        );
    }

    #[tokio::test]
    async fn terminate_bypasses_a_flooded_normal_command_queue() {
        let ((actor, _), _) = actor_with(&[], false, Some(Duration::from_secs(1)));
        let request = actor.start_search(&GoMode::Depth(1)).await.unwrap();
        let waiting = tokio::spawn({
            let actor = actor.clone();
            async move { actor.next_search_line(request).await }
        });
        tokio::time::sleep(Duration::from_millis(5)).await;

        let mut queued = Vec::new();
        for index in 0..32 {
            let actor = actor.clone();
            queued.push(tokio::spawn(async move {
                actor.set_option(&format!("Option{index}"), "1").await
            }));
        }
        tokio::time::sleep(Duration::from_millis(5)).await;

        tokio::time::timeout(Duration::from_millis(50), actor.terminate())
            .await
            .expect("terminate must bypass normal queue")
            .unwrap();
        assert!(matches!(
            waiting.await.unwrap(),
            Err(Error::EngineDisconnected)
        ));
        for task in queued {
            let _ = task.await;
        }
    }
}
