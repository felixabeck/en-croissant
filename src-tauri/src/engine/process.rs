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

#[cfg(test)]
use std::collections::HashMap;

use crate::error::Error;
use crate::infra::{
    blocking::{BlockingGateway, BLOCKING_GATEWAY},
    keyed_locks::{KeyedLockLease, KeyedLocks},
    path_authority::{EngineExecutable, EngineHandle, PathAuthority, PathOperation, PathRef},
};

use super::{
    normalize_uci_moves_for_fen,
    types::{
        resolve_engine_option_leases, validate_uci_text, EngineDeadlines, EngineKey, EngineOption,
        EngineRequestId, EngineState, GoMode, ResolvedEngineOption,
    },
};

#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

const MAX_LOG_LINES: usize = 2_000;
const MAX_LOG_BYTES: usize = 512 * 1024;
const MAX_RESOURCE_REDACTIONS: usize = 256;
const MAX_RESOURCE_REDACTION_BYTES: usize = 64 * 1024;
const MAX_ENGINE_LINE_BYTES: usize = 64 * 1024;
const MAX_ENGINE_STDERR_BYTES: usize = 512 * 1024;
const MAX_RETIRED_ENGINE_IDS: usize = 4096;
const MAX_RETIRED_PATH_REFS: usize = 4096;
const MAX_PENDING_ENGINE_SEARCHES: usize = 256;
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
        let (entry, was_truncated) = normalize_log_entry(entry);
        self.truncated |= was_truncated;
        self.evict_for(entry.byte_len(), true);
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

    fn redact(&mut self, values: &[String]) {
        if values.is_empty() {
            return;
        }

        let previous = std::mem::take(&mut self.entries);
        let mut entries = VecDeque::with_capacity(previous.len());
        for entry in previous {
            let entry = match entry {
                EngineLog::Gui(line) => EngineLog::Gui(redact_line(line, values)),
                EngineLog::Engine(line) => EngineLog::Engine(redact_line(line, values)),
                entry @ EngineLog::Truncated { .. } => entry,
            };
            let (entry, was_truncated) = normalize_log_entry(entry);
            self.truncated |= was_truncated;
            entries.push_back(entry);
        }
        self.entries = entries;
        self.bytes = self.entries.iter().map(EngineLog::byte_len).sum();
        self.evict_for(0, false);
    }

    fn evict_for(&mut self, incoming_bytes: usize, reserve_slot: bool) {
        let max_entries = MAX_LOG_LINES.saturating_sub(usize::from(reserve_slot));
        while !self.entries.is_empty()
            && (self.entries.len() > max_entries
                || self.bytes.saturating_add(incoming_bytes) > MAX_LOG_BYTES)
        {
            let Some(removed) = self.entries.pop_front() else {
                break;
            };
            self.bytes = self.bytes.saturating_sub(removed.byte_len());
            self.truncated = true;
            self.dropped_entries = self.dropped_entries.saturating_add(1);
        }
    }
}

fn normalize_log_entry(entry: EngineLog) -> (EngineLog, bool) {
    match entry {
        EngineLog::Gui(mut line) if line.len() > MAX_LOG_BYTES => {
            truncate_utf8(&mut line, MAX_LOG_BYTES.saturating_sub(16));
            line.push_str("… [truncated]");
            (EngineLog::Gui(line), true)
        }
        EngineLog::Engine(mut line) if line.len() > MAX_LOG_BYTES => {
            truncate_utf8(&mut line, MAX_LOG_BYTES.saturating_sub(16));
            line.push_str("… [truncated]");
            (EngineLog::Engine(line), true)
        }
        entry => (entry, false),
    }
}

fn redact_line(mut line: String, values: &[String]) -> String {
    for value in values {
        line = line.replace(value, "[redacted]");
    }
    line
}

#[derive(Debug, Default)]
struct ResourceRedactions {
    values: Vec<String>,
    bytes: usize,
}

impl ResourceRedactions {
    fn register(&mut self, values: &[String], logs: &mut BoundedLogs) -> Result<(), Error> {
        let mut additions = Vec::new();
        for value in values {
            if !value.is_empty()
                && !self.values.iter().any(|known| known == value)
                && !additions.iter().any(|known| known == value)
            {
                additions.push(value.clone());
            }
        }
        let added_bytes = additions.iter().map(String::len).sum::<usize>();
        if self.values.len().saturating_add(additions.len()) > MAX_RESOURCE_REDACTIONS
            || self.bytes.saturating_add(added_bytes) > MAX_RESOURCE_REDACTION_BYTES
        {
            return Err(Error::ResourceLimit(
                "engine resource redaction budget exhausted".into(),
            ));
        }
        if additions.is_empty() {
            return Ok(());
        }

        self.values.extend(additions);
        self.bytes = self.bytes.saturating_add(added_bytes);
        self.values
            .sort_by(|left, right| right.len().cmp(&left.len()).then_with(|| left.cmp(right)));
        logs.redact(&self.values);
        Ok(())
    }

    fn redact(&self, line: String) -> String {
        redact_line(line, &self.values)
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
    #[cfg(test)]
    terminate_failure: Option<TerminateFailure>,
}

#[async_trait]
trait ChildCleanup: Send {
    fn start_kill(&mut self) -> Result<(), Error>;
    async fn wait(&mut self) -> Result<(), Error>;
}

#[async_trait]
trait ChildControl: ChildCleanup {
    async fn write_quit(&mut self) -> Result<(), Error>;
}

#[async_trait]
impl ChildCleanup for ProcessChildControl {
    fn start_kill(&mut self) -> Result<(), Error> {
        #[cfg(test)]
        if matches!(self.terminate_failure, Some(TerminateFailure::QuitKillReap)) {
            return Err(std::io::Error::other("injected engine kill failure").into());
        }
        self.child.start_kill().map_err(Into::into)
    }

    async fn wait(&mut self) -> Result<(), Error> {
        #[cfg(test)]
        if self.terminate_failure == Some(TerminateFailure::ReapTimeout) {
            std::future::pending::<()>().await;
        }
        #[cfg(test)]
        if self.terminate_failure == Some(TerminateFailure::QuitKillReap) {
            return Err(Error::Conflict("injected engine reap failure".into()));
        }
        self.child.wait().await?;
        Ok(())
    }
}

#[async_trait]
impl ChildControl for ProcessChildControl {
    async fn write_quit(&mut self) -> Result<(), Error> {
        #[cfg(test)]
        if matches!(self.terminate_failure, Some(TerminateFailure::QuitKillReap)) {
            return Err(Error::Conflict("injected engine quit failure".into()));
        }
        self.stdin.write_all(b"quit\n").await?;
        self.stdin.flush().await?;
        Ok(())
    }
}

struct SpawnChildCleanup<'a> {
    child: &'a mut Child,
    #[cfg(test)]
    terminate_failure: Option<TerminateFailure>,
}

#[async_trait]
impl ChildCleanup for SpawnChildCleanup<'_> {
    fn start_kill(&mut self) -> Result<(), Error> {
        #[cfg(test)]
        if matches!(self.terminate_failure, Some(TerminateFailure::QuitKillReap)) {
            return match self.child.start_kill() {
                Ok(()) => Err(std::io::Error::other("injected engine kill failure").into()),
                Err(error) => Err(error.into()),
            };
        }
        self.child.start_kill().map_err(Into::into)
    }

    async fn wait(&mut self) -> Result<(), Error> {
        #[cfg(test)]
        if self.terminate_failure == Some(TerminateFailure::ReapTimeout) {
            std::future::pending::<()>().await;
        }
        #[cfg(test)]
        if self.terminate_failure == Some(TerminateFailure::ReapError) {
            self.child.wait().await?;
            return Err(Error::Conflict("injected engine reap failure".into()));
        }
        self.child.wait().await.map(|_| ()).map_err(Into::into)
    }
}

enum ForceKillAndReap {
    Reaped,
    ReapFailed {
        kill_error: Option<Error>,
        reap_error: Error,
    },
    ReapTimedOut {
        kill_error: Option<Error>,
        timeout: Duration,
    },
}

async fn force_kill_and_reap<C: ChildCleanup>(
    child: &mut C,
    kill_reap_timeout: Duration,
) -> ForceKillAndReap {
    let kill_error = child.start_kill().err();
    let reap = timeout(kill_reap_timeout, child.wait()).await;
    match reap {
        Ok(Ok(())) => {
            if let Some(kill) = kill_error.as_ref() {
                error!("engine force-kill reported an error but child reaped: {kill}");
            }
            ForceKillAndReap::Reaped
        }
        Ok(Err(reap_error)) => ForceKillAndReap::ReapFailed {
            kill_error,
            reap_error,
        },
        Err(_) => ForceKillAndReap::ReapTimedOut {
            kill_error,
            timeout: kill_reap_timeout,
        },
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
    match force_kill_and_reap(&mut child, kill_reap_timeout).await {
        ForceKillAndReap::Reaped => {
            error!("engine graceful shutdown failed but child reaped: {primary}");
            Ok(())
        }
        ForceKillAndReap::ReapFailed {
            kill_error: Some(kill),
            reap_error: reap,
        } => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("force-kill failed: {kill}; final reap failed: {reap}"),
        }),
        ForceKillAndReap::ReapFailed {
            kill_error: None,
            reap_error: reap,
        } => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("final reap failed: {reap}"),
        }),
        ForceKillAndReap::ReapTimedOut {
            kill_error: Some(kill),
            timeout,
        } => Err(Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("force-kill failed: {kill}; final reap exceeded {timeout:?}"),
        }),
        ForceKillAndReap::ReapTimedOut {
            kill_error: None,
            timeout,
        } => Err(Error::EngineTimeout(format!(
            "waiting for engine reap after force-kill exceeded {timeout:?}"
        ))),
    }
}

async fn cleanup_spawn_io_failure(
    child: &mut Child,
    primary: Error,
    kill_reap_timeout: Duration,
) -> Error {
    let mut cleanup = SpawnChildCleanup {
        child,
        #[cfg(test)]
        terminate_failure: take_terminate_failure(),
    };
    match force_kill_and_reap(&mut cleanup, kill_reap_timeout).await {
        ForceKillAndReap::Reaped => primary,
        ForceKillAndReap::ReapFailed {
            kill_error: Some(kill),
            reap_error: reap,
        } => Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("force-kill failed: {kill}; final reap failed: {reap}"),
        },
        ForceKillAndReap::ReapFailed {
            kill_error: None,
            reap_error: reap,
        } => Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("final reap failed: {reap}"),
        },
        ForceKillAndReap::ReapTimedOut {
            kill_error: Some(kill),
            timeout,
        } => Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("force-kill failed: {kill}; final reap exceeded {timeout:?}"),
        },
        ForceKillAndReap::ReapTimedOut {
            kill_error: None,
            timeout,
        } => Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: format!("final reap exceeded {timeout:?}"),
        },
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
    resource_redactions: ResourceRedactions,
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
    pub(crate) resources: Arc<[Arc<crate::infra::path_authority::EngineResourceLease>]>,
    resource_verify: Duration,
}

enum EngineCommand {
    Init(oneshot::Sender<Result<(), Error>>),
    ConfigureStart(oneshot::Sender<Result<(), Error>>),
    ConfigureNext(oneshot::Sender<Result<Option<String>, Error>>),
    SetOption {
        name: String,
        value: String,
        resource_values: Vec<String>,
        operation: Option<CancellationToken>,
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
    publish: Arc<StdMutex<()>>,
}

impl SupervisedEngine {
    pub fn new(
        generation: u64,
        engine_id: String,
        executable: PathRef,
        actor: Arc<EngineActor>,
        cancelled: Arc<AtomicBool>,
    ) -> Self {
        Self {
            generation,
            engine_id,
            executable,
            actor,
            cancelled,
            publish: Arc::new(StdMutex::new(())),
        }
    }

    pub fn mark_cancelled(&self) {
        let _publish = self
            .publish
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn try_publish<E>(&self, emit: impl FnOnce() -> Result<(), E>) -> Result<bool, E> {
        let _publish = self
            .publish
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if self.cancelled.load(Ordering::SeqCst) {
            return Ok(false);
        }
        emit()?;
        Ok(true)
    }
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
    admissions: Arc<DashMap<EngineKey, EngineAdmission>>,
    admission_coordination: StdMutex<()>,
    registration: Mutex<()>,
    retired: StdMutex<RetiredEngineIds>,
    retired_executables: StdMutex<RetiredExecutables>,
    // `lifecycle` provides the per-key transition locks. Lifecycle transitions
    // may capture actor snapshots before awaiting the exact-key lock, but they
    // recheck under that lock before mutation. `actors` itself is concurrent,
    // but cannot make remove → await shutdown → insert atomic.
    lifecycle: KeyedLocks<EngineKey>,
}

#[derive(Clone)]
struct EngineAdmission {
    generation: u64,
    engine_id: String,
    executable: PathRef,
    cancelled: Arc<AtomicBool>,
    prepared: bool,
}

pub(crate) struct AdmissionLease {
    admissions: Arc<DashMap<EngineKey, EngineAdmission>>,
    key: EngineKey,
    admission: EngineAdmission,
    operation_cancellation: Option<CancellationToken>,
    disarmed: bool,
}

impl AdmissionLease {
    fn generation(&self) -> u64 {
        self.admission.generation
    }

    fn cancel_error(&self) -> Option<Error> {
        (self.admission.cancelled.load(Ordering::SeqCst)
            || self
                .operation_cancellation
                .as_ref()
                .is_some_and(CancellationToken::is_cancelled))
        .then_some(Error::Cancellation)
    }

    fn disarm(&mut self) {
        self.disarmed = true;
    }

    fn operation_cancellation(&self) -> Option<CancellationToken> {
        self.operation_cancellation.clone()
    }

    fn cancellation_probe(&self) -> (Arc<AtomicBool>, Option<CancellationToken>) {
        (
            self.admission.cancelled.clone(),
            self.operation_cancellation.clone(),
        )
    }
}

impl Drop for AdmissionLease {
    fn drop(&mut self) {
        if self.disarmed {
            return;
        }
        cancel_admission_exact(
            &self.admissions,
            &self.key,
            self.admission.generation,
            &self.admission.cancelled,
        );
    }
}

fn cancel_admission_exact(
    admissions: &DashMap<EngineKey, EngineAdmission>,
    key: &EngineKey,
    generation: u64,
    cancelled: &AtomicBool,
) -> bool {
    // Flag the captured lease even if a newer admission has already replaced
    // its map entry. A late holder must still observe cancellation of its Arc.
    cancelled.store(true, Ordering::SeqCst);
    admissions
        .remove_if(key, |_, admission| admission.generation == generation)
        .is_some()
}

impl EngineSupervisor {
    fn allocate_generation(&self) -> Result<u64, Error> {
        self.next_generation
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |value| {
                value.checked_add(1)
            })
            .map(|previous| previous + 1)
            .map_err(|_| Error::ResourceLimit("engine generation exhausted".into()))
    }

    fn validate_admission_policy(
        &self,
        engine_id: &str,
        executable: &PathRef,
    ) -> Result<(), Error> {
        if self.sealed.load(Ordering::SeqCst) {
            return Err(Error::Conflict("application is shutting down".into()));
        }
        if self.is_retired(engine_id) {
            return Err(Error::Conflict("engine id is retired".into()));
        }
        if self.is_retired_executable(executable) {
            return Err(Error::Conflict("engine executable is retired".into()));
        }
        Ok(())
    }

    fn cancel_admission(&self, key: &EngineKey, admission: &EngineAdmission) -> bool {
        cancel_admission_exact(
            &self.admissions,
            key,
            admission.generation,
            &admission.cancelled,
        )
    }

    fn cancel_admissions_matching(&self, predicate: impl Fn(&EngineKey, &EngineAdmission) -> bool) {
        let targets: Vec<_> = self
            .admissions
            .iter()
            .filter(|entry| predicate(entry.key(), entry.value()))
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect();
        for (key, admission) in targets {
            self.cancel_admission(&key, &admission);
        }
    }

    async fn admit(
        &self,
        key: EngineKey,
        engine_id: String,
        executable: PathRef,
        prepared: bool,
    ) -> Result<AdmissionLease, Error> {
        validate_uci_text("engine", &engine_id)?;
        self.validate_admission_policy(&engine_id, &executable)?;
        let generation = self.allocate_generation()?;
        let admission = EngineAdmission {
            generation,
            engine_id,
            executable,
            cancelled: Arc::new(AtomicBool::new(false)),
            prepared,
        };
        let lease = AdmissionLease {
            admissions: self.admissions.clone(),
            key,
            admission,
            operation_cancellation: None,
            disarmed: false,
        };
        {
            let _coordination = self
                .admission_coordination
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            self.validate_admission_policy(
                &lease.admission.engine_id,
                &lease.admission.executable,
            )?;
            if prepared
                && self
                    .admissions
                    .iter()
                    .filter(|entry| entry.value().prepared && entry.key() != &lease.key)
                    .count()
                    >= MAX_PENDING_ENGINE_SEARCHES
            {
                return Err(Error::ResourceLimit(
                    "too many pending engine searches".into(),
                ));
            }
            if let Some(previous) = self
                .admissions
                .insert(lease.key.clone(), lease.admission.clone())
            {
                previous.cancelled.store(true, Ordering::SeqCst);
            }
        }
        let _registration = self.registration.lock().await;
        if let Some(error) = lease.cancel_error() {
            return Err(error);
        }
        self.validate_admission_policy(&lease.admission.engine_id, &lease.admission.executable)?;
        Ok(lease)
    }

    /// Reserves the exact engine generation and binds its publication barrier to the owning
    /// native operation. Cancellation is checked by the admission lease before an actor can be
    /// published, without creating a second engine identity or cancellation registry.
    pub(crate) async fn admit_for_operation(
        &self,
        key: EngineKey,
        engine_id: String,
        executable: PathRef,
        cancellation: CancellationToken,
    ) -> Result<AdmissionLease, Error> {
        let mut admission = self.admit(key, engine_id, executable, false).await?;
        admission.operation_cancellation = Some(cancellation);
        if let Some(error) = admission.cancel_error() {
            return Err(error);
        }
        Ok(admission)
    }

    pub(crate) async fn admit_for_launch(
        &self,
        key: EngineKey,
        engine_id: String,
        executable: PathRef,
    ) -> Result<AdmissionLease, Error> {
        self.admit(key, engine_id, executable, false).await
    }

    pub async fn prepare_engine_search(
        &self,
        key: EngineKey,
        engine_id: String,
        executable: PathRef,
    ) -> Result<String, Error> {
        let mut lease = self.admit(key, engine_id, executable, true).await?;
        let generation = lease.generation();
        lease.disarm();
        Ok(generation.to_string())
    }

    pub(crate) async fn consume_engine_search(
        &self,
        key: EngineKey,
        engine_id: String,
        executable: PathRef,
        generation: &str,
    ) -> Result<AdmissionLease, Error> {
        let generation = generation.parse::<u64>().map_err(|_| {
            Error::Conflict("engine search reservation is invalid or expired".into())
        })?;
        let _registration = self.registration.lock().await;
        let admission = {
            let _coordination = self
                .admission_coordination
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let Some(admission) = self.admissions.get(&key).map(|entry| entry.clone()) else {
                return Err(Error::Conflict(
                    "engine search reservation is invalid or expired".into(),
                ));
            };
            if admission.generation != generation {
                return Err(Error::Conflict(
                    "engine search reservation is invalid or expired".into(),
                ));
            }
            if admission.engine_id != engine_id
                || admission.executable != executable
                || !admission.prepared
            {
                return Err(Error::Conflict(
                    "engine search reservation does not match the request".into(),
                ));
            }
            if admission.cancelled.load(Ordering::SeqCst) {
                return Err(Error::Cancellation);
            }
            self.admissions.insert(
                key.clone(),
                EngineAdmission {
                    prepared: false,
                    ..admission.clone()
                },
            );
            admission
        };
        Ok(AdmissionLease {
            admissions: self.admissions.clone(),
            key,
            admission: EngineAdmission {
                prepared: false,
                ..admission
            },
            operation_cancellation: None,
            disarmed: false,
        })
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

    fn lifecycle_lease(&self, key: &EngineKey) -> KeyedLockLease<'_, EngineKey> {
        self.lifecycle.lease(key.clone())
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

    #[cfg(test)]
    pub async fn replace_handle(
        &self,
        key: EngineKey,
        actor: Arc<EngineActor>,
        engine_id: String,
        executable: PathRef,
    ) -> Result<SupervisedEngine, Error> {
        let mut actor_guard = PendingActorGuard::new(actor.clone(), key.clone(), None);
        let admission = match self
            .admit(key.clone(), engine_id.clone(), executable.clone(), false)
            .await
        {
            Ok(admission) => {
                actor_guard.set_generation(admission.generation());
                admission
            }
            Err(primary) => {
                let error = reject_actor(&actor, primary).await;
                actor_guard.disarm();
                return Err(error);
            }
        };
        let result = self.publish_admitted(key, actor, admission).await;
        actor_guard.disarm();
        result
    }

    async fn publish_admitted(
        &self,
        key: EngineKey,
        actor: Arc<EngineActor>,
        mut admission: AdmissionLease,
    ) -> Result<SupervisedEngine, Error> {
        let lifecycle = self.lifecycle_lease(&key);
        let _transition = lifecycle.lock().await;
        if let Some(error) = admission.cancel_error() {
            return Err(reject_actor(&actor, error).await);
        }
        if let Err(error) = self.validate_admission_policy(
            &admission.admission.engine_id,
            &admission.admission.executable,
        ) {
            return Err(reject_actor(&actor, error).await);
        }
        if let Some(previous) = self.actors.get(&key).map(|entry| entry.clone()) {
            previous.mark_cancelled();
            let previous_actor = previous.actor.clone();
            let stop = previous_actor.stop_current().await;
            let terminate = previous_actor.terminate().await;
            self.actors.remove(&key);
            if let Err(primary) = combine_shutdown_results(stop, terminate) {
                return Err(reject_actor(&actor, primary).await);
            }
        }
        let registration = self.registration.lock().await;
        if let Err(error) = self.validate_admission_policy(
            &admission.admission.engine_id,
            &admission.admission.executable,
        ) {
            drop(registration);
            return Err(reject_actor(&actor, error).await);
        }
        let published = {
            let _coordination = self
                .admission_coordination
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let current = self.admissions.get(&key).map(|entry| entry.clone());
            if current.as_ref().is_none_or(|current| {
                current.generation != admission.generation()
                    || current.cancelled.load(Ordering::SeqCst)
            }) {
                None
            } else {
                let generation = admission.generation();
                let entry = SupervisedEngine::new(
                    generation,
                    admission.admission.engine_id.clone(),
                    admission.admission.executable.clone(),
                    actor.clone(),
                    admission.admission.cancelled.clone(),
                );
                self.actors.insert(key, entry.clone());
                self.admissions.remove_if(&admission.key, |_, current| {
                    current.generation == generation
                });
                Some(entry)
            }
        };
        drop(registration);
        let Some(entry) = published else {
            return Err(reject_actor(&actor, Error::Cancellation).await);
        };
        admission.disarm();
        Ok(entry)
    }

    pub async fn terminate_exact(&self, key: &EngineKey, generation: u64) -> Result<(), Error> {
        let lifecycle = self.lifecycle_lease(key);
        let _transition = lifecycle.lock().await;
        let Some(current) = self.actors.get(key).map(|entry| entry.clone()) else {
            return Ok(());
        };
        if current.generation != generation {
            return Ok(());
        }
        current.mark_cancelled();
        let result = current.actor.terminate().await;
        self.actors.remove(key);
        result
    }

    #[cfg(test)]
    pub async fn stop_exact(&self, key: &EngineKey) -> Result<(), Error> {
        self.stop_generation(key, None).await
    }

    pub async fn stop_generation(
        &self,
        key: &EngineKey,
        generation: Option<u64>,
    ) -> Result<(), Error> {
        let generation = generation
            .or_else(|| self.admissions.get(key).map(|entry| entry.generation))
            .or_else(|| self.actors.get(key).map(|entry| entry.generation));
        let Some(generation) = generation else {
            return Ok(());
        };
        let registration = self.registration.lock().await;
        {
            let _coordination = self
                .admission_coordination
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            if let Some(admission) = self.admissions.get(key).map(|entry| entry.clone()) {
                if admission.generation == generation {
                    self.cancel_admission(key, &admission);
                }
            }
        }
        drop(registration);
        let lifecycle = self.lifecycle_lease(key);
        let _transition = lifecycle.lock().await;
        let Some(current) = self.actors.get(key).map(|entry| entry.clone()) else {
            return Ok(());
        };
        if current.generation != generation {
            return Ok(());
        }
        current.mark_cancelled();
        let stop = current.actor.stop_current().await;
        let terminate = current.actor.terminate().await;
        self.actors.remove(key);
        combine_shutdown_results(stop, terminate)
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
        current.mark_cancelled();
        true
    }

    pub async fn terminate_tab(&self, tab: &str) -> Result<(), Error> {
        // Same publication barrier as `terminate_all` / `retire_engine`: wait
        // for in-flight admission and `publish_admitted` checks before scanning,
        // then drain until this tab has no actors.
        let registration = self.registration.lock().await;
        let _coordination = self
            .admission_coordination
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        self.cancel_admissions_matching(|key, _| key.tab == tab);
        drop(_coordination);
        drop(registration);
        let mut failures = Vec::new();
        loop {
            failures.extend(self.terminate_matching(|key, _| key.tab == tab).await);
            if !self.actors.iter().any(|entry| entry.key().tab == tab) {
                break;
            }
        }
        aggregate_shutdown_failures(failures)
    }

    pub async fn retire_engine(&self, engine_id: String) -> Result<(), Error> {
        validate_uci_text("engine", &engine_id)?;
        self.with_retired(|retired| retired.insert(engine_id.clone()));
        // Synchronize with admission and the final `publish_admitted` check.
        // Once this barrier is crossed, a retired id cannot be published.
        let registration = self.registration.lock().await;
        let _coordination = self
            .admission_coordination
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        self.cancel_admissions_matching(|key, admission| {
            key.engine == engine_id || admission.engine_id == engine_id
        });
        drop(_coordination);
        drop(registration);
        let mut failures = Vec::new();
        loop {
            failures.extend(
                self.terminate_matching(|key, engine| {
                    key.engine == engine_id || engine.engine_id == engine_id
                })
                .await,
            );
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
        // Synchronize with admission and the final `publish_admitted` check.
        let registration = self.registration.lock().await;
        let _coordination = self
            .admission_coordination
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        self.cancel_admissions_matching(|_, admission| {
            executable_set.contains(&admission.executable)
        });
        drop(_coordination);
        drop(registration);
        let mut failures = Vec::new();
        loop {
            failures.extend(
                self.terminate_matching(|_, engine| executable_set.contains(&engine.executable))
                    .await,
            );
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
        // Synchronize with admission and the final `publish_admitted` check.
        // Once this barrier is crossed, no production path can add an actor.
        let registration = self.registration.lock().await;
        let _coordination = self
            .admission_coordination
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        self.cancel_admissions_matching(|_, _| true);
        drop(_coordination);
        drop(registration);
        loop {
            let targets: Vec<_> = self
                .actors
                .iter()
                .map(|entry| (entry.key().clone(), entry.value().generation))
                .collect();
            if targets.is_empty() {
                break;
            }
            failures.extend(self.terminate_targets(targets).await);
        }
        aggregate_shutdown_failures(failures)
    }

    async fn terminate_targets(&self, targets: Vec<(EngineKey, u64)>) -> Vec<ActorShutdownFailure> {
        let results = futures_util::future::join_all(targets.into_iter().map(
            |(key, generation)| async move {
                let result = self.terminate_exact(&key, generation).await;
                (key, generation, result)
            },
        ))
        .await;
        results
            .into_iter()
            .filter_map(|(key, generation, result)| {
                result.err().map(|error| ActorShutdownFailure {
                    key,
                    generation,
                    error,
                })
            })
            .collect()
    }

    async fn terminate_matching<P>(&self, predicate: P) -> Vec<ActorShutdownFailure>
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

async fn reject_actor(actor: &EngineActor, primary: Error) -> Error {
    match actor.terminate().await {
        Ok(()) => primary,
        Err(cleanup) => Error::OperationAndCleanup {
            primary: primary.to_string(),
            cleanup: cleanup.to_string(),
        },
    }
}

struct ActorShutdownFailure {
    key: EngineKey,
    generation: u64,
    error: Error,
}

struct RegistrationGuard {
    supervisor: Arc<EngineSupervisor>,
    key: EngineKey,
    generation: u64,
    taken: bool,
}

struct PendingActorGuard {
    actor: Option<Arc<EngineActor>>,
    key: EngineKey,
    generation: Option<u64>,
}

impl PendingActorGuard {
    fn new(actor: Arc<EngineActor>, key: EngineKey, generation: Option<u64>) -> Self {
        Self {
            actor: Some(actor),
            key,
            generation,
        }
    }

    #[cfg(test)]
    fn set_generation(&mut self, generation: u64) {
        self.generation = Some(generation);
    }

    fn disarm(&mut self) {
        self.actor = None;
    }
}

impl Drop for PendingActorGuard {
    fn drop(&mut self) {
        let Some(actor) = self.actor.take() else {
            return;
        };
        let key = self.key.clone();
        let generation = self.generation;
        tokio::spawn(async move {
            if let Err(error) = actor.terminate().await {
                log_pending_actor_cleanup_error(&key, generation, &error);
            }
        });
    }
}

#[cfg(test)]
static REGISTRATION_CLEANUP_ERRORS: StdMutex<Vec<String>> = StdMutex::new(Vec::new());

#[cfg(test)]
static PENDING_ACTOR_CLEANUP_ERRORS: StdMutex<Vec<String>> = StdMutex::new(Vec::new());

#[cfg(test)]
static SHUTDOWN_FAILURE_LOGS: StdMutex<Vec<String>> = StdMutex::new(Vec::new());

fn log_pending_actor_cleanup_error(key: &EngineKey, generation: Option<u64>, error: &Error) {
    let generation = generation
        .map(|generation| generation.to_string())
        .unwrap_or_else(|| "not-yet-assigned".into());
    let message = format!(
        "dropped engine admission actor cleanup failed for {}:{} generation={generation} category={}",
        key.tab,
        key.engine,
        error.category()
    );
    #[cfg(test)]
    match PENDING_ACTOR_CLEANUP_ERRORS.lock() {
        Ok(mut errors) => errors.push(message.clone()),
        Err(poisoned) => poisoned.into_inner().push(message.clone()),
    }
    error!("{message}");
}

fn log_registration_cleanup_error(key: &EngineKey, error: &Error) {
    let message = format!(
        "cancelled engine registration cleanup failed for {}:{} category={}",
        key.tab,
        key.engine,
        error.category()
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

#[derive(Debug)]
enum PinFailure {
    Primary(Error),
    #[cfg(target_os = "macos")]
    OperationAndCleanup {
        primary: Error,
        cleanup: Error,
    },
}

impl PinFailure {
    fn into_error(self, key: &EngineKey, engine_id: &str) -> Error {
        #[cfg(not(target_os = "macos"))]
        let _ = (key, engine_id);
        match self {
            Self::Primary(error) => error,
            #[cfg(target_os = "macos")]
            Self::OperationAndCleanup { primary, cleanup } => {
                error!(
                    "engine launch pin failed for key={}:{} engine_id={} primary_category={} cleanup_category={}",
                    key.tab,
                    key.engine,
                    engine_id,
                    primary.category(),
                    cleanup.category()
                );
                Error::OperationAndCleanup {
                    primary: primary.to_string(),
                    cleanup: cleanup.to_string(),
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn cleanup_materialized_files(
    files: Vec<crate::infra::path_authority::MaterializedFile>,
) -> Option<Error> {
    let mut first = None;
    for file in files {
        if let Err(error) = file.remove() {
            if first.is_none() {
                first = Some(error);
            }
        }
    }
    first
}

#[cfg(target_os = "macos")]
fn pin_engine_launch(
    executable: &mut EngineExecutable,
    key: &EngineKey,
    engine_id: &str,
    is_cancelled: &dyn Fn() -> bool,
) -> Result<Vec<(String, String, Error)>, PinFailure> {
    let root = executable.launch_root().cloned().ok_or_else(|| {
        PinFailure::Primary(Error::Conflict(
            "engine launch root is not initialized".into(),
        ))
    })?;
    let reclaim = root.reclaim();
    let reclaim_failures = reclaim
        .failed
        .into_iter()
        .map(|(leaf, error)| (leaf.engine_key, leaf.engine_id, error))
        .collect::<Vec<_>>();
    let count = executable
        .resource_leases()
        .iter()
        .filter(|lease| !lease.is_directory())
        .count()
        + 1;
    let mut files =
        match root.reserve_leaves(count, &format!("{}:{}", key.tab, key.engine), engine_id) {
            Ok(files) => files,
            Err(error) => return Err(PinFailure::Primary(error)),
        };
    let result = (|| {
        files[0].create_from(executable.image_file(), 0o700, is_cancelled)?;
        let mut file_index = 1;
        for lease in executable.resource_leases() {
            if lease.is_directory() {
                continue;
            }
            lease.file().metadata().map_err(Error::from)?;
            files[file_index].create_from(lease.file(), 0o600, is_cancelled)?;
            lease.set_pinned_target(files[file_index].path())?;
            file_index += 1;
        }
        if is_cancelled() {
            return Err(Error::Cancellation);
        }
        let command_path = files[0].path();
        let retained = std::mem::take(&mut files);
        executable.set_launch_materialization(command_path, retained);
        Ok(())
    })();
    if let Err(primary) = result {
        if let Some(cleanup) = cleanup_materialized_files(files) {
            return Err(PinFailure::OperationAndCleanup { primary, cleanup });
        }
        return Err(PinFailure::Primary(primary));
    }
    Ok(reclaim_failures)
}

struct LaunchResult {
    executable: EngineExecutable,
    resolved: Vec<ResolvedEngineOption>,
    reclaim_failures: Vec<(String, String, Error)>,
}

pub(crate) async fn resolve_launch(
    authority: Arc<std::sync::Mutex<Option<PathAuthority>>>,
    engine: EngineHandle,
    operation: PathOperation,
    options: &[EngineOption],
    admission: &AdmissionLease,
) -> Result<(EngineExecutable, Vec<ResolvedEngineOption>), Error> {
    let (admission_cancelled, operation_cancellation) = admission.cancellation_probe();
    let engine_id = admission.admission.engine_id.clone();
    let key = admission.key.clone();
    let error_key = key.clone();
    let error_engine_id = engine_id.clone();
    let options = options.to_vec();
    #[cfg(test)]
    let resolution_trace = crate::infra::path_authority::take_engine_resolution_trace_for_worker();
    let result = BLOCKING_GATEWAY
        .spawn(move || {
            #[cfg(test)]
            let _resolution_trace_guard =
                crate::infra::path_authority::install_engine_resolution_trace_for_worker(
                    resolution_trace,
                );
            let is_cancelled = || {
                admission_cancelled.load(Ordering::SeqCst)
                    || operation_cancellation
                        .as_ref()
                        .is_some_and(CancellationToken::is_cancelled)
            };
            if is_cancelled() {
                return Ok(Err(PinFailure::Primary(Error::Cancellation)));
            }
            #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
            let (mut executable, mut resolved) = {
                let mut guard = authority
                    .lock()
                    .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
                let authority = guard
                    .as_mut()
                    .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
                let executable = authority.engine_executable(&engine, operation)?;
                let resolved = resolve_engine_option_leases(authority, &options)?;
                (executable, resolved)
            };
            if is_cancelled() {
                return Ok(Err(PinFailure::Primary(Error::Cancellation)));
            }
            #[cfg(test)]
            if let Ok(mut hook) = ENGINE_LAUNCH_RESOLUTION_HOOK
                .get_or_init(|| std::sync::Mutex::new(None))
                .lock()
            {
                if let Some(hook) = hook.take() {
                    hook();
                }
            }
            #[cfg(target_os = "macos")]
            let reclaim_failures =
                match pin_engine_launch(&mut executable, &key, &engine_id, &is_cancelled) {
                    Ok(reclaim_failures) => reclaim_failures,
                    Err(failure) => return Ok(Err(failure)),
                };
            #[cfg(test)]
            if take_engine_launch_value_failure() {
                return Ok(Err(PinFailure::Primary(Error::Conflict(
                    "injected engine launch value construction failure".into(),
                ))));
            }
            #[cfg(test)]
            if let Ok(mut hook) = ENGINE_LAUNCH_POST_PIN_HOOK
                .get_or_init(|| std::sync::Mutex::new(None))
                .lock()
            {
                if let Some(hook) = hook.take() {
                    hook();
                }
            }
            #[cfg(not(target_os = "macos"))]
            let reclaim_failures = Vec::new();
            for option in &mut resolved {
                option.refresh_resource_values();
            }
            Ok(Ok(LaunchResult {
                executable: executable.with_resource_leases(
                    resolved
                        .iter()
                        .flat_map(|option| option.resources.iter().cloned())
                        .collect(),
                ),
                resolved,
                reclaim_failures,
            }))
        })
        .await?;
    let result = result.map_err(|failure| failure.into_error(&error_key, &error_engine_id))?;
    for (reclaim_key, reclaim_id, error) in result.reclaim_failures {
        error!(
            "engine launch leaf reclaim failed for key={} engine_id={} category={}",
            reclaim_key,
            reclaim_id,
            error.category()
        );
    }
    if let Some(error) = admission.cancel_error() {
        return Err(error);
    }
    Ok((result.executable, result.resolved))
}

pub(crate) async fn resolve_option_leases(
    authority: Arc<std::sync::Mutex<Option<PathAuthority>>>,
    options: &[EngineOption],
    cancellation: CancellationToken,
) -> Result<Vec<ResolvedEngineOption>, Error> {
    let options = options.to_vec();
    BLOCKING_GATEWAY
        .spawn(move || {
            if cancellation.is_cancelled() {
                return Err(Error::Cancellation);
            }
            let mut guard = authority
                .lock()
                .map_err(|_| Error::Conflict("path authority lock was poisoned".into()))?;
            let authority = guard
                .as_mut()
                .ok_or_else(|| Error::Conflict("path authority is not initialized".into()))?;
            resolve_engine_option_leases(authority, &options)
        })
        .await
}

/// Spawns and publishes an actor before any protocol initialization begins.
/// The registration guard owns cancellation cleanup until initialization has
/// either completed or synchronously removed the exact generation.
pub(crate) async fn spawn_registered<T, F, Fut>(
    supervisor: Arc<EngineSupervisor>,
    key: EngineKey,
    executable: EngineExecutable,
    admission: AdmissionLease,
    initialize: F,
) -> Result<(SupervisedEngine, T), Error>
where
    F: FnOnce(Arc<EngineActor>) -> Fut,
    Fut: std::future::Future<Output = Result<T, Error>>,
{
    if let Some(error) = admission.cancel_error() {
        return Err(error);
    }
    let actor = Arc::new(EngineActor::spawn(executable, EngineDeadlines::default()).await?);
    initialize_admitted_actor(supervisor, key, actor, admission, initialize).await
}

#[cfg(test)]
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
    let admission = supervisor
        .admit(key.clone(), engine_id, executable_ref, false)
        .await?;
    initialize_admitted_actor(supervisor, key, actor, admission, initialize).await
}

async fn initialize_admitted_actor<T, F, Fut>(
    supervisor: Arc<EngineSupervisor>,
    key: EngineKey,
    actor: Arc<EngineActor>,
    admission: AdmissionLease,
    initialize: F,
) -> Result<(SupervisedEngine, T), Error>
where
    F: FnOnce(Arc<EngineActor>) -> Fut,
    Fut: std::future::Future<Output = Result<T, Error>>,
{
    let operation_cancellation = admission.operation_cancellation();
    let mut actor_guard =
        PendingActorGuard::new(actor.clone(), key.clone(), Some(admission.generation()));
    let published = supervisor
        .publish_admitted(key.clone(), actor.clone(), admission)
        .await;
    actor_guard.disarm();
    let supervised = match published {
        Ok(supervised) => supervised,
        Err(primary) => return Err(primary),
    };
    let mut guard = RegistrationGuard {
        supervisor: supervisor.clone(),
        key: key.clone(),
        generation: supervised.generation,
        taken: false,
    };
    let initialized = initialize(actor);
    tokio::pin!(initialized);
    let initialized = match operation_cancellation {
        Some(cancellation) => tokio::select! {
            biased;
            _ = cancellation.cancelled() => Err(Error::Cancellation),
            value = &mut initialized => value,
        },
        None => initialized.await,
    };
    match initialized {
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

fn aggregate_shutdown_failures(failures: Vec<ActorShutdownFailure>) -> Result<(), Error> {
    let mut representative = None;
    for failure in failures {
        let message = format!(
            "engine cleanup failed for {}:{} generation={} category={}",
            failure.key.tab,
            failure.key.engine,
            failure.generation,
            failure.error.category()
        );
        #[cfg(test)]
        match SHUTDOWN_FAILURE_LOGS.lock() {
            Ok(mut errors) => errors.push(message.clone()),
            Err(poisoned) => poisoned.into_inner().push(message.clone()),
        }
        error!("{message}");
        if representative.is_none() {
            representative = Some(failure.error);
        }
    }
    representative.map_or(Ok(()), Err)
}

impl EngineRuntime {
    pub fn new(io: Box<dyn UciIo>, deadlines: EngineDeadlines) -> Self {
        Self {
            io,
            state: EngineState::Idle,
            next_request: 0,
            deadlines,
            logs: BoundedLogs::default(),
            resource_redactions: ResourceRedactions::default(),
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
        #[cfg(target_os = "linux")]
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
        #[cfg(test)]
        observe_spawned_child(&child);
        #[cfg(test)]
        let forced_io_failure = take_spawn_io_failure();
        let stdin = child.stdin.take();
        #[cfg(test)]
        let stdin = if forced_io_failure == Some(SpawnIoFailure::NoStdin) {
            None
        } else {
            stdin
        };
        let stdin = match stdin {
            Some(stdin) => stdin,
            None => {
                return Err(cleanup_spawn_io_failure(
                    &mut child,
                    Error::NoStdin,
                    deadlines.kill_reap,
                )
                .await)
            }
        };
        #[cfg(test)]
        let stdout = if forced_io_failure == Some(SpawnIoFailure::NoStdout) {
            None
        } else {
            child.stdout.take()
        };
        #[cfg(not(test))]
        let stdout = child.stdout.take();
        let stdout = match stdout {
            Some(stdout) => stdout,
            None => {
                return Err(cleanup_spawn_io_failure(
                    &mut child,
                    Error::NoStdout,
                    deadlines.kill_reap,
                )
                .await)
            }
        };
        let stderr_drain_task = child.stderr.take().map(|stderr| {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr);
                drain_engine_stderr(&mut reader).await;
            })
        });
        let mut runtime = Self::new(
            Box::new(ChildUciIo {
                control: Some(ProcessChildControl {
                    stdin,
                    child,
                    #[cfg(test)]
                    terminate_failure: take_terminate_failure(),
                }),
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

    async fn set_option_with_resources(
        &mut self,
        name: &str,
        value: &str,
        resource_values: &[String],
        operation: Option<&CancellationToken>,
    ) -> Result<(), Error> {
        validate_uci_text("option name", name)?;
        validate_uci_text("option value", value)?;
        self.resource_redactions
            .register(resource_values, &mut self.logs)?;
        #[cfg(test)]
        if !resource_values.is_empty() {
            let hook = SET_OPTION_BEFORE_SEND_HOOK.with(|slot| slot.borrow_mut().take());
            if let Some(hook) = hook {
                hook();
            }
        }
        if operation.is_some_and(CancellationToken::is_cancelled) {
            return Err(Error::Cancellation);
        }
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
        self.logs.push(EngineLog::Gui(
            self.resource_redactions.redact(format!("{command}\n")),
        ));
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
            self.logs.push(EngineLog::Engine(
                self.resource_redactions.redact(line.clone()),
            ));
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
    pub(crate) fn set_test_option_before_send_hook(hook: Option<Box<dyn FnOnce() + Send>>) {
        set_option_before_send_hook(hook);
    }

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

    #[cfg(test)]
    pub fn recording_test_actor_with_resources(
        lines: &[&str],
        resources: Vec<Arc<crate::infra::path_authority::EngineResourceLease>>,
    ) -> (Arc<Self>, Arc<Mutex<Vec<String>>>) {
        Self::recording_test_actor_with_resources_and_deadlines(
            lines,
            resources,
            EngineDeadlines::default(),
        )
    }

    #[cfg(test)]
    pub fn recording_test_actor_with_resources_and_deadlines(
        lines: &[&str],
        resources: Vec<Arc<crate::infra::path_authority::EngineResourceLease>>,
        deadlines: EngineDeadlines,
    ) -> (Arc<Self>, Arc<Mutex<Vec<String>>>) {
        let writes = Arc::new(Mutex::new(Vec::new()));
        let io = RecordingUciIo {
            writes: writes.clone(),
            lines: lines.iter().map(|line| Some((*line).into())).collect(),
        };
        (
            Arc::new(Self::from_runtime_with_resources(
                EngineRuntime::new(Box::new(io), deadlines),
                Arc::from(resources),
            )),
            writes,
        )
    }

    #[cfg(test)]
    fn from_runtime(runtime: EngineRuntime) -> Self {
        Self::from_runtime_with_resources(runtime, Arc::from([]))
    }

    fn from_runtime_with_resources(
        runtime: EngineRuntime,
        resources: Arc<[Arc<crate::infra::path_authority::EngineResourceLease>]>,
    ) -> Self {
        let resource_verify = runtime.deadlines.resource_verify;
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
            resources,
            resource_verify,
        }
    }

    pub async fn spawn(
        executable: EngineExecutable,
        deadlines: EngineDeadlines,
    ) -> Result<Self, Error> {
        let resources = Arc::from(executable.resource_leases().to_vec());
        Ok(Self::from_runtime_with_resources(
            EngineRuntime::spawn(executable, deadlines).await?,
            resources,
        ))
    }

    #[cfg(all(test, unix))]
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
        self.set_option_with_operation(name, value, &[], None).await
    }
    pub(crate) async fn set_option_with_resources(
        &self,
        name: &str,
        value: &str,
        resource_values: &[String],
    ) -> Result<(), Error> {
        self.set_option_with_operation(name, value, resource_values, None)
            .await
    }
    pub(crate) async fn set_option_with_operation(
        &self,
        name: &str,
        value: &str,
        resource_values: &[String],
        operation: Option<CancellationToken>,
    ) -> Result<(), Error> {
        let (reply_tx, reply) = oneshot::channel();
        self.request(
            EngineCommand::SetOption {
                name: name.into(),
                value: value.into(),
                resource_values: resource_values.to_vec(),
                operation,
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

pub(crate) async fn verify_option_resources(
    actor: &EngineActor,
    options: &[ResolvedEngineOption],
    operation: Option<&CancellationToken>,
) -> Result<(), Error> {
    verify_option_resources_in(&BLOCKING_GATEWAY, actor, options, operation).await
}

pub(crate) async fn verify_option_resources_in(
    gateway: &BlockingGateway,
    actor: &EngineActor,
    options: &[ResolvedEngineOption],
    operation: Option<&CancellationToken>,
) -> Result<(), Error> {
    let resources = actor.resources.clone();
    let values = options
        .iter()
        .flat_map(|option| option.resource_values.iter().cloned())
        .collect::<Vec<_>>();
    #[cfg(test)]
    let verify_hook_key = values.first().cloned();
    let verify = gateway.spawn(move || {
        #[cfg(test)]
        if let Some(key) = verify_hook_key {
            if let Ok(mut hooks) = RESOURCE_VERIFY_HOOKS
                .get_or_init(|| std::sync::Mutex::new(HashMap::new()))
                .lock()
            {
                if let Some(hook) = hooks.remove(&key) {
                    hook();
                }
            }
        }
        for value in values {
            let Some(resource) = resources
                .iter()
                .find(|resource| resource.uci_value() == value)
            else {
                return Err(Error::Conflict(
                    "engine option resource was not produced by the launched engine".into(),
                ));
            };
            resource.verify_current()?;
        }
        Ok(())
    });
    let operation = operation.cloned();
    tokio::pin!(verify);
    tokio::select! {
        biased;
        _ = actor.interrupt.cancelled() => Err(Error::Cancellation),
        _ = async {
            if let Some(operation) = &operation {
                operation.cancelled().await;
            } else {
                std::future::pending::<()>().await;
            }
        } => Err(Error::Cancellation),
        result = tokio::time::timeout(actor.resource_verify, &mut verify) => {
            result.map_err(|_| Error::EngineTimeout("verifying engine option resources".into()))?
        }
    }
}

#[cfg(test)]
type ResourceVerifyHook = Box<dyn FnOnce() + Send>;

#[cfg(test)]
type ResourceVerifyHooks = std::sync::Mutex<HashMap<String, ResourceVerifyHook>>;

#[cfg(test)]
static RESOURCE_VERIFY_HOOKS: std::sync::OnceLock<ResourceVerifyHooks> = std::sync::OnceLock::new();

#[cfg(test)]
fn set_resource_verify_hook(key: String, hook: Option<Box<dyn FnOnce() + Send>>) {
    let mut hooks = RESOURCE_VERIFY_HOOKS
        .get_or_init(|| std::sync::Mutex::new(HashMap::new()))
        .lock()
        .unwrap();
    if let Some(hook) = hook {
        hooks.insert(key, hook);
    } else {
        hooks.remove(&key);
    }
}

#[cfg(test)]
std::thread_local! {
    static SET_OPTION_BEFORE_SEND_HOOK: std::cell::RefCell<Option<ResourceVerifyHook>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
fn set_option_before_send_hook(hook: Option<Box<dyn FnOnce() + Send>>) {
    SET_OPTION_BEFORE_SEND_HOOK.with(|slot| *slot.borrow_mut() = hook);
}

#[cfg(test)]
type EngineLaunchResolutionHook = Box<dyn FnOnce() + Send>;

#[cfg(test)]
static ENGINE_LAUNCH_RESOLUTION_HOOK: std::sync::OnceLock<
    std::sync::Mutex<Option<EngineLaunchResolutionHook>>,
> = std::sync::OnceLock::new();

#[cfg(test)]
fn set_engine_launch_resolution_hook(hook: Option<EngineLaunchResolutionHook>) {
    *ENGINE_LAUNCH_RESOLUTION_HOOK
        .get_or_init(|| std::sync::Mutex::new(None))
        .lock()
        .unwrap() = hook;
}

#[cfg(test)]
type EngineLaunchPostPinHook = Box<dyn FnOnce() + Send>;

#[cfg(test)]
static ENGINE_LAUNCH_POST_PIN_HOOK: std::sync::OnceLock<
    std::sync::Mutex<Option<EngineLaunchPostPinHook>>,
> = std::sync::OnceLock::new();

#[cfg(test)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn set_engine_launch_post_pin_hook(hook: Option<EngineLaunchPostPinHook>) {
    *ENGINE_LAUNCH_POST_PIN_HOOK
        .get_or_init(|| std::sync::Mutex::new(None))
        .lock()
        .unwrap() = hook;
}

#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SpawnIoFailure {
    NoStdin,
    NoStdout,
}

#[cfg(test)]
std::thread_local! {
    static SPAWN_IO_FAILURE: std::cell::RefCell<Option<SpawnIoFailure>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
type SpawnChildObserver = Box<dyn FnOnce(Option<u32>) + Send>;

#[cfg(test)]
static SPAWN_CHILD_OBSERVER: std::sync::OnceLock<std::sync::Mutex<Option<SpawnChildObserver>>> =
    std::sync::OnceLock::new();

#[cfg(test)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn set_spawn_io_failure(failure: Option<SpawnIoFailure>) {
    SPAWN_IO_FAILURE.with(|slot| *slot.borrow_mut() = failure);
}

#[cfg(test)]
fn take_spawn_io_failure() -> Option<SpawnIoFailure> {
    SPAWN_IO_FAILURE.with(|slot| slot.borrow_mut().take())
}

#[cfg(test)]
fn set_spawn_child_observer(observer: Option<SpawnChildObserver>) {
    *SPAWN_CHILD_OBSERVER
        .get_or_init(|| std::sync::Mutex::new(None))
        .lock()
        .unwrap() = observer;
}

#[cfg(test)]
fn observe_spawned_child(child: &Child) {
    let observer = SPAWN_CHILD_OBSERVER
        .get_or_init(|| std::sync::Mutex::new(None))
        .lock()
        .unwrap()
        .take();
    if let Some(observer) = observer {
        observer(child.id());
    }
}

#[cfg(test)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TerminateFailure {
    QuitKillReap,
    ReapTimeout,
    ReapError,
}

#[cfg(test)]
std::thread_local! {
    static TERMINATE_FAILURE: std::cell::RefCell<Option<TerminateFailure>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
fn set_terminate_failure(failure: Option<TerminateFailure>) {
    TERMINATE_FAILURE.with(|slot| *slot.borrow_mut() = failure);
}

#[cfg(test)]
fn take_terminate_failure() -> Option<TerminateFailure> {
    TERMINATE_FAILURE.with(|slot| slot.borrow_mut().take())
}

#[cfg(test)]
static ENGINE_LAUNCH_VALUE_FAILURE: std::sync::OnceLock<std::sync::Mutex<bool>> =
    std::sync::OnceLock::new();

#[cfg(test)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn set_engine_launch_value_failure(failure: bool) {
    *ENGINE_LAUNCH_VALUE_FAILURE
        .get_or_init(|| std::sync::Mutex::new(false))
        .lock()
        .unwrap() = failure;
}

#[cfg(test)]
fn take_engine_launch_value_failure() -> bool {
    ENGINE_LAUNCH_VALUE_FAILURE
        .get_or_init(|| std::sync::Mutex::new(false))
        .lock()
        .map(|mut failure| std::mem::take(&mut *failure))
        .unwrap_or(false)
}

impl EngineActor {
    pub(crate) async fn resolve_launch(
        authority: Arc<std::sync::Mutex<Option<PathAuthority>>>,
        engine: EngineHandle,
        operation: PathOperation,
        options: &[EngineOption],
        admission: &AdmissionLease,
    ) -> Result<(EngineExecutable, Vec<ResolvedEngineOption>), Error> {
        resolve_launch(authority, engine, operation, options, admission).await
    }

    pub(crate) async fn resolve_option_leases(
        authority: Arc<std::sync::Mutex<Option<PathAuthority>>>,
        options: &[EngineOption],
        cancellation: CancellationToken,
    ) -> Result<Vec<ResolvedEngineOption>, Error> {
        resolve_option_leases(authority, options, cancellation).await
    }

    pub(crate) async fn verify_option_resources(
        actor: &Arc<Self>,
        options: &[ResolvedEngineOption],
        operation: Option<&CancellationToken>,
    ) -> Result<(), Error> {
        verify_option_resources(actor, options, operation).await
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
            EngineCommand::SetOption {
                name,
                value,
                resource_values,
                operation,
                reply,
            } => {
                let _ = reply.send(
                    runtime
                        .set_option_with_resources(
                            &name,
                            &value,
                            &resource_values,
                            operation.as_ref(),
                        )
                        .await,
                );
            }
            EngineCommand::SetPosition { fen, moves, reply } => {
                let _ = reply.send(runtime.set_position(&fen, &moves).await);
            }
            EngineCommand::EnsureReady(reply) => {
                let _ = reply.send(runtime.ensure_ready().await);
            }
            EngineCommand::StartSearch { mode, reply } => {
                let started = runtime.start_search(&mode).await;
                let result = recover_failed_protocol(&mut runtime, started).await;
                let failed = result.is_err();
                let _ = reply.send(result);
                if failed {
                    terminated = true;
                    break;
                }
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

/// A failed UCI stop or `go` means stdout can no longer be correlated with a
/// request. The only safe recovery is to reap the process and permanently close
/// this actor, never to accept another `position`/`go` on the same stream.
async fn recover_failed_protocol<T>(
    runtime: &mut EngineRuntime,
    result: Result<T, Error>,
) -> Result<T, Error> {
    match result {
        Ok(value) => Ok(value),
        Err(primary) => match runtime.terminate().await {
            Ok(()) => Err(primary),
            Err(cleanup) => Err(Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: cleanup.to_string(),
            }),
        },
    }
}

async fn stop_at_protocol_boundary(runtime: &mut EngineRuntime) -> Result<(), Error> {
    let result = runtime.stop_current().await;
    recover_failed_protocol(runtime, result).await
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
    async fn authorized_resource_survives_path_replacement_for_uci_child() {
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
        #[allow(unused_mut)]
        #[allow(unused_mut)]
        let mut executable = crate::infra::path_authority::EngineExecutable::test_fixture(
            std::fs::File::open(&script).unwrap(),
            directory.path().to_path_buf(),
            vec![lease],
        );
        #[cfg(target_os = "macos")]
        {
            let root =
                crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path()).unwrap();
            executable.set_test_launch_root(root);
            let key = EngineKey::new("resource-test".into(), "engine".into()).unwrap();
            pin_engine_launch(&mut executable, &key, "engine", &|| false).unwrap();
        }
        // The production UCI value, not a hand-built path: this is what
        // `resolve_engine_options` hands to `setoption`.
        let uci_value = executable.resource_leases()[0].uci_value();
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

        actor
            .set_option_with_resources("Book", &uci_value, std::slice::from_ref(&uci_value))
            .await
            .unwrap();
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
        assert!(actor.logs().await.unwrap().iter().all(|entry| match entry {
            EngineLog::Gui(line) | EngineLog::Engine(line) => !line.contains(&uci_value),
            EngineLog::Truncated { .. } => true,
        }));
        actor.terminate().await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn spawned_engine_reads_a_directory_resource_through_the_authorized_value() {
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("directory-child.sh");
        std::fs::write(
            &script,
            "#!/bin/sh\nwhile IFS= read -r line; do case \"$line\" in uci) echo uciok;; isready) echo readyok;; setoption*) value=${line#*value }; cat \"$value/authorized\";; quit) exit 0;; esac; done\n",
        )
        .unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let resource_path = directory.path().join("tables");
        std::fs::create_dir(&resource_path).unwrap();
        std::fs::write(resource_path.join("authorized"), b"directory-authorized\n").unwrap();
        let resource_file = std::fs::File::open(&resource_path).unwrap();
        #[cfg(target_os = "macos")]
        let resource =
            crate::infra::path_authority::EngineResourceLease::test_directory(resource_file);
        #[cfg(target_os = "linux")]
        let resource = crate::infra::path_authority::EngineResourceLease::test_file(resource_file);
        let resource = Arc::new(resource);
        let value = resource.uci_value();
        let image = std::fs::File::open(&script).unwrap();
        #[allow(unused_mut)]
        let mut executable = crate::infra::path_authority::EngineExecutable::test_fixture(
            image,
            directory.path().to_path_buf(),
            vec![],
        )
        .with_resource_leases(vec![resource.clone()]);
        #[cfg(target_os = "macos")]
        {
            executable.set_test_launch_root(
                crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path()).unwrap(),
            );
            let key = EngineKey::new("directory-test".into(), "engine".into()).unwrap();
            pin_engine_launch(&mut executable, &key, "engine", &|| false).unwrap();
        }
        let actor = EngineActor::spawn_initialized(executable, EngineDeadlines::default())
            .await
            .unwrap();
        #[cfg(target_os = "linux")]
        {
            std::fs::rename(&resource_path, directory.path().join("tables-original")).unwrap();
            std::fs::create_dir(&resource_path).unwrap();
            std::fs::write(resource_path.join("replacement"), b"replacement\n").unwrap();
        }
        let options = [ResolvedEngineOption {
            name: "SyzygyPath".into(),
            value: value.clone(),
            resources: vec![resource],
            resource_values: vec![value.clone()],
        }];
        verify_option_resources(&actor, &options, None)
            .await
            .unwrap();
        actor
            .set_option_with_resources("SyzygyPath", &value, std::slice::from_ref(&value))
            .await
            .unwrap();
        assert_eq!(
            actor.next_configuration_line().await.unwrap(),
            Some("directory-authorized".into())
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
    impl ChildCleanup for FakeChildControl {
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

    #[async_trait]
    impl ChildControl for FakeChildControl {
        async fn write_quit(&mut self) -> Result<(), Error> {
            if self.quit_pending {
                std::future::pending().await
            } else {
                Ok(())
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

    #[derive(Clone, Copy)]
    enum TypedTerminateFailure {
        Timeout,
        OperationAndCleanup,
    }

    struct TypedTerminateErrorIo {
        failure: TypedTerminateFailure,
        terminate_calls: Arc<AtomicUsize>,
    }

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

    #[async_trait]
    impl UciIo for TypedTerminateErrorIo {
        async fn write_line(&mut self, _: &str) -> Result<(), Error> {
            Ok(())
        }

        async fn read_line(&mut self) -> Result<Option<String>, Error> {
            Ok(None)
        }

        async fn terminate(&mut self, _: Duration, _: Duration) -> Result<(), Error> {
            self.terminate_calls.fetch_add(1, AtomicOrdering::SeqCst);
            match self.failure {
                TypedTerminateFailure::Timeout => {
                    Err(Error::EngineTimeout("typed timeout sentinel".into()))
                }
                TypedTerminateFailure::OperationAndCleanup => Err(Error::OperationAndCleanup {
                    primary: "typed primary sentinel".into(),
                    cleanup: "typed cleanup sentinel".into(),
                }),
            }
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
        assert!(supervisor.admissions.is_empty());
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
                        message.contains("cancelled engine registration cleanup failed")
                            && message.contains("category=I/O failure")
                    }),
                    Err(poisoned) => poisoned.into_inner().iter().any(|message| {
                        message.contains("cancelled engine registration cleanup failed")
                            && message.contains("category=I/O failure")
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
    async fn pending_actor_cleanup_log_carries_key_and_generation() {
        let key = EngineKey::new("pending-log-tab".into(), "pending-log-engine".into()).unwrap();
        let actor = Arc::new(EngineActor::new(
            Box::new(TerminateErrorIo),
            EngineDeadlines::default(),
        ));
        drop(PendingActorGuard::new(actor, key, Some(42)));
        let unassigned_key =
            EngineKey::new("pending-log-tab".into(), "unassigned-engine".into()).unwrap();
        let unassigned_actor = Arc::new(EngineActor::new(
            Box::new(TerminateErrorIo),
            EngineDeadlines::default(),
        ));
        drop(PendingActorGuard::new(
            unassigned_actor,
            unassigned_key,
            None,
        ));

        tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                let logged = match PENDING_ACTOR_CLEANUP_ERRORS.lock() {
                    Ok(errors) => errors.clone(),
                    Err(poisoned) => poisoned.into_inner().clone(),
                };
                let assigned = logged.iter().any(|message| {
                    message.contains("pending-log-tab:pending-log-engine")
                        && message.contains("generation=42")
                        && message.contains("category=I/O failure")
                });
                let unassigned = logged.iter().any(|message| {
                    message.contains("pending-log-tab:unassigned-engine")
                        && message.contains("generation=not-yet-assigned")
                        && message.contains("category=I/O failure")
                });
                if assigned && unassigned {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("pending actor cleanup failure must carry its ownership identity");
    }
    #[tokio::test]
    async fn start_search_stop_timeout_reaps_the_actor_instead_of_accepting_another_go() {
        let ((actor, writes), terminated) =
            actor_with(&[], false, Some(Duration::from_millis(200)));
        actor.start_search(&GoMode::Depth(1)).await.unwrap();
        let error = actor.start_search(&GoMode::Depth(2)).await.unwrap_err();
        assert!(matches!(
            error,
            Error::EngineTimeout(message) if message == "waiting for bestmove after stop"
        ));
        assert!(matches!(
            actor.start_search(&GoMode::Depth(3)).await,
            Err(Error::EngineDisconnected)
        ));
        let writes = writes.lock().await;
        assert_eq!(
            writes.iter().filter(|line| line.starts_with("go ")).count(),
            1
        );
        drop(writes);
        assert!(terminated.load(AtomicOrdering::SeqCst) >= 1);
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
    async fn dropped_replacement_waiting_for_registration_reaps_actor_and_admission() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let registration = supervisor.registration.lock().await;
        let ((actor, _), terminated) = actor_with(&[], false, None);
        let replacement = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            async move {
                supervisor
                    .replace_handle(
                        key,
                        Arc::new(actor),
                        "engine".into(),
                        path_ref("engine-path"),
                    )
                    .await
            }
        });
        tokio::time::timeout(Duration::from_secs(1), async {
            while !supervisor.admissions.contains_key(&key) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("admission must be visible before the registration wait");

        replacement.abort();
        let _ = replacement.await;
        drop(registration);
        tokio::time::timeout(Duration::from_secs(1), async {
            while !supervisor.admissions.is_empty() || terminated.load(AtomicOrdering::SeqCst) == 0
            {
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("dropping the replacement must reclaim its admission and actor");
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());
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

    #[test]
    fn resource_redactions_sanitize_retained_lines_and_platform_path_shapes() {
        let unix = "/proc/self/fd/17".to_string();
        let windows = r"C:\tablebases\new".to_string();
        let multi = format!("{unix}:{windows}");
        let mut logs = BoundedLogs::default();
        logs.push(EngineLog::Gui(format!(
            "setoption name Book value {multi}\n"
        )));
        logs.push(EngineLog::Engine(format!("echo {multi}")));

        let mut redactions = ResourceRedactions::default();
        redactions
            .register(&[unix.clone(), windows.clone()], &mut logs)
            .unwrap();

        let entries = logs.entries();
        assert!(entries.iter().all(|entry| match entry {
            EngineLog::Gui(line) | EngineLog::Engine(line) => {
                !line.contains(&unix) && !line.contains(&windows)
            }
            EngineLog::Truncated { .. } => true,
        }));
        assert_eq!(redactions.redact(multi), "[redacted]:[redacted]");
    }

    #[test]
    fn resource_redaction_uses_registered_provenance_not_path_shape() {
        let registered = "/launch/root/authorized.leaf".to_string();
        let unregistered = "/launch/root/unregistered.leaf".to_string();
        let mut logs = BoundedLogs::default();
        logs.push(EngineLog::Gui(format!(
            "setoption name Book value {registered}:{unregistered}\n"
        )));
        let mut redactions = ResourceRedactions::default();
        redactions
            .register(std::slice::from_ref(&registered), &mut logs)
            .unwrap();
        assert!(logs.entries().iter().any(|entry| matches!(
            entry,
            EngineLog::Gui(line)
                if line == "setoption name Book value [redacted]:/launch/root/unregistered.leaf\n"
        )));
    }

    #[tokio::test]
    async fn resource_option_redacts_both_transcript_directions_after_a_swap() {
        let old_unix = "/proc/self/fd/17".to_string();
        let old_unix_other = "/proc/self/fd/18".to_string();
        let old_value = format!("{old_unix}:{old_unix_other}");
        let new_windows = r"C:\tablebases\new".to_string();
        let (actor, writes) = EngineActor::recording_test_actor(&[&old_value, &new_windows]);

        actor
            .set_option_with_resources("Book", &old_value, &[old_unix, old_unix_other])
            .await
            .unwrap();
        actor
            .set_option_with_resources("Book", &new_windows, std::slice::from_ref(&new_windows))
            .await
            .unwrap();
        actor.set_option("Threads", "4").await.unwrap();

        // The parser receives raw child lines even though the actor log is
        // sanitized, and the wire command remains byte-for-byte unchanged.
        assert_eq!(
            actor.next_configuration_line().await.unwrap(),
            Some(old_value.clone())
        );
        assert_eq!(
            actor.next_configuration_line().await.unwrap(),
            Some(new_windows.clone())
        );
        assert_eq!(
            *writes.lock().await,
            vec![
                format!("setoption name Book value {old_value}"),
                format!("setoption name Book value {new_windows}"),
                "setoption name Threads value 4".into(),
            ]
        );

        let logs = actor.logs().await.unwrap();
        assert!(logs.iter().all(|entry| match entry {
            EngineLog::Gui(line) | EngineLog::Engine(line) => {
                !line.contains("/proc/self/fd/") && !line.contains(r"C:\tablebases\new")
            }
            EngineLog::Truncated { .. } => true,
        }));
        assert!(logs.iter().any(|entry| matches!(
            entry,
            EngineLog::Gui(line) if line == "setoption name Threads value 4\n"
        )));
        actor.terminate().await.unwrap();
    }

    #[tokio::test]
    async fn resource_redaction_budget_fails_before_sending_a_new_value() {
        let mut redactions = ResourceRedactions::default();
        let mut logs = BoundedLogs::default();
        let oversized = "x".repeat(MAX_RESOURCE_REDACTION_BYTES + 1);
        assert!(matches!(
            redactions.register(std::slice::from_ref(&oversized), &mut logs),
            Err(Error::ResourceLimit(_))
        ));
        assert!(logs.entries.is_empty());

        let writes = Arc::new(Mutex::new(Vec::new()));
        let io = RecordingUciIo {
            writes: writes.clone(),
            lines: VecDeque::new(),
        };
        let mut runtime = EngineRuntime::new(Box::new(io), EngineDeadlines::default());
        for index in 0..MAX_RESOURCE_REDACTIONS {
            let value = format!("/resource/{index}");
            runtime
                .set_option_with_resources("Book", &value, std::slice::from_ref(&value), None)
                .await
                .unwrap();
        }
        let overflow = "/resource/overflow".to_string();
        assert!(matches!(
            runtime
                .set_option_with_resources(
                    "Book",
                    &overflow,
                    std::slice::from_ref(&overflow),
                    None,
                )
                .await,
            Err(Error::ResourceLimit(_))
        ));
        assert_eq!(writes.lock().await.len(), MAX_RESOURCE_REDACTIONS);
        assert!(!runtime
            .logs
            .entries()
            .iter()
            .any(|entry| matches!(entry, EngineLog::Gui(line) if line.contains(&overflow))));
    }

    #[tokio::test]
    async fn resource_redaction_byte_budget_is_cumulative_and_deduplicated() {
        let first = "a".repeat(30_000);
        let second = "b".repeat(35_000);
        let overflow = "c".repeat(1_000);
        assert!(first.len() <= MAX_RESOURCE_REDACTION_BYTES);
        assert!(second.len() <= MAX_RESOURCE_REDACTION_BYTES);
        assert!(overflow.len() <= MAX_RESOURCE_REDACTION_BYTES);
        assert!(first.len() + second.len() <= MAX_RESOURCE_REDACTION_BYTES);
        assert!(first.len() + second.len() + overflow.len() > MAX_RESOURCE_REDACTION_BYTES);
        let echoed = format!("echo {first}");
        let (actor, writes) = EngineActor::recording_test_actor(&[&echoed]);

        actor
            .set_option_with_resources("Book", &first, std::slice::from_ref(&first))
            .await
            .unwrap();
        // A duplicate registration must not consume another 30,000 bytes;
        // otherwise the individually valid second value would be rejected.
        actor
            .set_option_with_resources("Book", &first, std::slice::from_ref(&first))
            .await
            .unwrap();
        actor
            .set_option_with_resources("Book", &second, std::slice::from_ref(&second))
            .await
            .unwrap();

        let result = actor
            .set_option_with_resources("Book", &overflow, std::slice::from_ref(&overflow))
            .await;
        assert!(matches!(result, Err(Error::ResourceLimit(_))));
        assert_eq!(writes.lock().await.len(), 3);

        // Both prior values remain known after the rejected registration, so
        // retained commands and a delayed engine echo stay masked.
        assert_eq!(actor.next_configuration_line().await.unwrap(), Some(echoed));
        let logs = actor.logs().await.unwrap();
        assert!(logs.iter().all(|entry| match entry {
            EngineLog::Gui(line) | EngineLog::Engine(line) => {
                !line.contains(&first) && !line.contains(&second) && !line.contains(&overflow)
            }
            EngineLog::Truncated { .. } => true,
        }));
        assert!(logs.iter().any(|entry| matches!(
            entry,
            EngineLog::Engine(line) if line == "echo [redacted]"
        )));
        actor.terminate().await.unwrap();
    }

    #[tokio::test]
    async fn overlapping_resource_redactions_are_longest_first_in_retained_and_echoed_logs() {
        let short = "/proc/self/fd/1".to_string();
        let long = "/proc/self/fd/10".to_string();
        let echoed = format!("echo {long}");
        let (actor, _) = EngineActor::recording_test_actor(&[&echoed]);

        actor
            .set_option_with_resources("Book", &short, std::slice::from_ref(&short))
            .await
            .unwrap();
        actor
            .set_option_with_resources("Book", &long, std::slice::from_ref(&long))
            .await
            .unwrap();
        assert_eq!(actor.next_configuration_line().await.unwrap(), Some(echoed));

        let logs = actor.logs().await.unwrap();
        assert!(logs.iter().any(|entry| matches!(
            entry,
            EngineLog::Gui(line) if line == "setoption name Book value [redacted]\n"
        )));
        assert!(logs.iter().any(|entry| matches!(
            entry,
            EngineLog::Engine(line) if line == "echo [redacted]"
        )));
        assert!(logs.iter().all(|entry| match entry {
            EngineLog::Gui(line) | EngineLog::Engine(line) => {
                !line.contains(&short) && !line.contains(&long)
            }
            EngineLog::Truncated { .. } => true,
        }));
        actor.terminate().await.unwrap();
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
    async fn broad_stop_snapshots_empty_and_never_targets_a_later_actor() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        supervisor.stop_generation(&key, None).await.unwrap();

        let ((actor, _), terminated) = actor_with(&[], false, None);
        let replacement = supervisor.replace(key.clone(), actor).await.unwrap();
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 0);
        assert_eq!(
            supervisor.get_exact(&key).unwrap().generation,
            replacement.generation
        );
        supervisor.terminate_all().await.unwrap();
    }

    #[tokio::test]
    async fn broad_stop_captured_before_registration_wait_cannot_stop_replacement() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let (first, _) = actor(&[]);
        supervisor.replace(key.clone(), first).await.unwrap();
        let lifecycle = supervisor.lifecycle_lease(&key);
        let transition = lifecycle.lock().await;
        let registration = supervisor.registration.lock().await;
        let stop = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            async move { supervisor.stop_generation(&key, None).await }
        });
        tokio::task::yield_now().await;

        let ((replacement_actor, _), replacement_terminated) = actor_with(&[], false, None);
        let replacement_generation = supervisor.allocate_generation().unwrap();
        supervisor.actors.insert(
            key.clone(),
            SupervisedEngine::new(
                replacement_generation,
                "engine".into(),
                path_ref("replacement-path"),
                Arc::new(replacement_actor),
                Arc::new(AtomicBool::new(false)),
            ),
        );
        drop(registration);
        drop(transition);

        stop.await.unwrap().unwrap();
        assert_eq!(replacement_terminated.load(AtomicOrdering::SeqCst), 0);
        assert_eq!(
            supervisor.get_exact(&key).unwrap().generation,
            replacement_generation
        );
        supervisor.terminate_all().await.unwrap();
    }

    #[tokio::test]
    async fn generation_stop_waiting_on_lifecycle_cannot_stop_replacement() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let (first_actor, _) = actor(&[]);
        let first = supervisor.replace(key.clone(), first_actor).await.unwrap();
        let lifecycle = supervisor.lifecycle_lease(&key);
        let transition = lifecycle.lock().await;
        let registration = supervisor.registration.lock().await;
        let stop = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            async move {
                supervisor
                    .stop_generation(&key, Some(first.generation))
                    .await
            }
        });
        tokio::task::yield_now().await;

        let ((replacement_actor, _), replacement_terminated) = actor_with(&[], false, None);
        let replacement_generation = supervisor.allocate_generation().unwrap();
        supervisor.actors.insert(
            key.clone(),
            SupervisedEngine::new(
                replacement_generation,
                "engine".into(),
                path_ref("replacement-path"),
                Arc::new(replacement_actor),
                Arc::new(AtomicBool::new(false)),
            ),
        );
        drop(registration);
        drop(transition);

        stop.await.unwrap().unwrap();
        assert_eq!(replacement_terminated.load(AtomicOrdering::SeqCst), 0);
        assert_eq!(
            supervisor.get_exact(&key).unwrap().generation,
            replacement_generation
        );
        supervisor.terminate_all().await.unwrap();
    }

    #[tokio::test]
    async fn exact_stop_reaps_an_idle_published_actor_before_it_can_search() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let ((actor, _), terminated) = actor_with(&[], false, None);
        let supervised = supervisor.replace(key.clone(), actor).await.unwrap();

        supervisor
            .stop_generation(&key, Some(supervised.generation))
            .await
            .unwrap();

        assert!(supervised.cancelled.load(AtomicOrdering::SeqCst));
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());
    }

    #[tokio::test]
    async fn consume_cannot_overwrite_a_newer_admission_while_registration_waits() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let executable = path_ref("engine-path");
        let first = supervisor
            .prepare_engine_search(key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();
        let registration = supervisor.registration.lock().await;
        let consumed_generation = first.clone();
        let consume = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            let executable = executable.clone();
            async move {
                supervisor
                    .consume_engine_search(key, "engine".into(), executable, &consumed_generation)
                    .await
            }
        });
        tokio::task::yield_now().await;
        let newer = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            let executable = executable.clone();
            async move {
                supervisor
                    .prepare_engine_search(key, "engine".into(), executable)
                    .await
            }
        });
        while supervisor
            .admissions
            .get(&key)
            .is_some_and(|entry| entry.generation.to_string() == first)
        {
            tokio::task::yield_now().await;
        }
        drop(registration);

        assert!(matches!(consume.await.unwrap(), Err(Error::Conflict(_))));
        let newer = newer.await.unwrap().unwrap();
        assert_eq!(
            supervisor
                .admissions
                .get(&key)
                .unwrap()
                .generation
                .to_string(),
            newer
        );
    }

    #[tokio::test]
    async fn publication_cannot_overwrite_a_newer_admission() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let executable = path_ref("engine-path");
        let first = supervisor
            .prepare_engine_search(key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();
        let admission = supervisor
            .consume_engine_search(key.clone(), "engine".into(), executable.clone(), &first)
            .await
            .unwrap();
        let registration = supervisor.registration.lock().await;
        let ((actor, _), terminated) = actor_with(&[], false, None);
        let publish = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            async move {
                supervisor
                    .publish_admitted(key, Arc::new(actor), admission)
                    .await
            }
        });
        tokio::task::yield_now().await;
        let newer = tokio::spawn({
            let supervisor = supervisor.clone();
            let key = key.clone();
            let executable = executable.clone();
            async move {
                supervisor
                    .prepare_engine_search(key, "engine".into(), executable)
                    .await
            }
        });
        while supervisor
            .admissions
            .get(&key)
            .is_some_and(|entry| entry.generation.to_string() == first)
        {
            tokio::task::yield_now().await;
        }
        drop(registration);

        assert!(matches!(publish.await.unwrap(), Err(Error::Cancellation)));
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        let newer = newer.await.unwrap().unwrap();
        assert_eq!(
            supervisor
                .admissions
                .get(&key)
                .unwrap()
                .generation
                .to_string(),
            newer
        );
        assert!(supervisor.get_exact(&key).is_none());
    }

    #[tokio::test]
    async fn prepared_searches_reject_stale_mismatched_and_replayed_generations() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let executable = path_ref("engine-path");
        let stale = supervisor
            .prepare_engine_search(key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();
        let current = supervisor
            .prepare_engine_search(key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();

        assert!(matches!(
            supervisor
                .consume_engine_search(key.clone(), "engine".into(), executable.clone(), &stale,)
                .await,
            Err(Error::Conflict(_))
        ));
        assert!(matches!(
            supervisor
                .consume_engine_search(
                    key.clone(),
                    "other".into(),
                    executable.clone(),
                    &current,
                )
                .await,
            Err(Error::Conflict(message)) if message.contains("does not match")
        ));
        let lease = supervisor
            .consume_engine_search(key.clone(), "engine".into(), executable, &current)
            .await
            .unwrap();
        drop(lease);
        assert!(matches!(
            supervisor
                .consume_engine_search(key, "engine".into(), path_ref("engine-path"), &current,)
                .await,
            Err(Error::Conflict(_))
        ));
        assert!(supervisor.admissions.is_empty());
    }

    #[tokio::test]
    async fn generation_stop_cancels_pending_reservation_before_start() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let executable = path_ref("engine-path");
        let generation = supervisor
            .prepare_engine_search(key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();

        supervisor
            .stop_generation(&key, Some(generation.parse().unwrap()))
            .await
            .unwrap();

        assert!(matches!(
            supervisor
                .consume_engine_search(key.clone(), "engine".into(), executable, &generation)
                .await,
            Err(Error::Conflict(_))
        ));
        assert!(supervisor.admissions.is_empty());
        assert!(supervisor.get_exact(&key).is_none());
    }

    #[tokio::test]
    async fn generation_exhaustion_allocates_last_value_once_without_retaining_an_overflow() {
        let supervisor = EngineSupervisor::default();
        supervisor
            .next_generation
            .store(u64::MAX - 1, Ordering::SeqCst);
        let last_key = EngineKey::new("last-generation".into(), "engine".into()).unwrap();
        let overflow_key = EngineKey::new("overflow-generation".into(), "engine".into()).unwrap();
        let executable = path_ref("engine-path");

        let last = supervisor
            .prepare_engine_search(last_key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();
        assert_eq!(last, u64::MAX.to_string());
        assert!(matches!(
            supervisor
                .prepare_engine_search(overflow_key.clone(), "engine".into(), executable)
                .await,
            Err(Error::ResourceLimit(message)) if message == "engine generation exhausted"
        ));
        assert_eq!(supervisor.next_generation.load(Ordering::SeqCst), u64::MAX);
        assert!(supervisor.admissions.contains_key(&last_key));
        assert!(!supervisor.admissions.contains_key(&overflow_key));
        assert_eq!(supervisor.admissions.len(), 1);
    }

    #[test]
    fn dropping_replaced_admission_cancels_its_arc_without_removing_the_replacement() {
        let admissions = Arc::new(DashMap::new());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let old_cancelled = Arc::new(AtomicBool::new(false));
        let old = EngineAdmission {
            generation: 1,
            engine_id: "engine".into(),
            executable: path_ref("old"),
            cancelled: old_cancelled.clone(),
            prepared: false,
        };
        let lease = AdmissionLease {
            admissions: admissions.clone(),
            key: key.clone(),
            admission: old,
            operation_cancellation: None,
            disarmed: false,
        };
        admissions.insert(
            key.clone(),
            EngineAdmission {
                generation: 2,
                engine_id: "engine".into(),
                executable: path_ref("new"),
                cancelled: Arc::new(AtomicBool::new(false)),
                prepared: false,
            },
        );

        drop(lease);

        assert!(old_cancelled.load(Ordering::SeqCst));
        assert_eq!(admissions.get(&key).unwrap().generation, 2);
    }

    #[tokio::test]
    async fn prepared_search_capacity_refuses_without_evicting_and_reclaims() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let executable = path_ref("engine-path");
        let mut reservations = Vec::new();
        for index in 0..MAX_PENDING_ENGINE_SEARCHES {
            let key = EngineKey::new(format!("tab-{index}"), "engine".into()).unwrap();
            let generation = supervisor
                .prepare_engine_search(key.clone(), "engine".into(), executable.clone())
                .await
                .unwrap();
            reservations.push((key, generation));
        }
        let overflow = EngineKey::new("overflow".into(), "engine".into()).unwrap();
        assert!(matches!(
            supervisor
                .prepare_engine_search(overflow.clone(), "engine".into(), executable.clone())
                .await,
            Err(Error::ResourceLimit(_))
        ));

        let (first_key, first_generation) = reservations.remove(0);
        drop(
            supervisor
                .consume_engine_search(
                    first_key,
                    "engine".into(),
                    executable.clone(),
                    &first_generation,
                )
                .await
                .unwrap(),
        );
        assert!(supervisor
            .prepare_engine_search(overflow, "engine".into(), executable)
            .await
            .is_ok());
    }

    #[tokio::test]
    async fn tab_close_cancels_consumed_admission_and_reaps_late_actor() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("closing".into(), "engine".into()).unwrap();
        let other_key = EngineKey::new("other".into(), "engine".into()).unwrap();
        let executable = path_ref("engine-path");
        let generation = supervisor
            .prepare_engine_search(key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();
        let admission = supervisor
            .consume_engine_search(
                key.clone(),
                "engine".into(),
                executable.clone(),
                &generation,
            )
            .await
            .unwrap();
        let other_generation = supervisor
            .prepare_engine_search(other_key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();
        supervisor.terminate_tab("closing").await.unwrap();
        let ((actor, _), terminated) = actor_with(&[], false, None);

        assert!(matches!(
            supervisor
                .publish_admitted(key.clone(), Arc::new(actor), admission)
                .await,
            Err(Error::Cancellation)
        ));
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());
        assert!(supervisor
            .consume_engine_search(other_key, "engine".into(), executable, &other_generation)
            .await
            .is_ok());
    }

    #[tokio::test]
    async fn operation_cancellation_during_initialization_reaps_only_its_exact_actor() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("analysis".into(), "owned".into()).unwrap();
        let other_key = EngineKey::new("analysis".into(), "other".into()).unwrap();
        let operation = CancellationToken::new();
        let admission = supervisor
            .admit_for_operation(
                key.clone(),
                "owned-engine".into(),
                path_ref("owned-path"),
                operation.clone(),
            )
            .await
            .unwrap();
        let ((actor, _), terminated) = actor_with(&[], false, None);
        let (entered_tx, entered_rx) = tokio::sync::oneshot::channel();
        let initializing = tokio::spawn(initialize_admitted_actor(
            supervisor.clone(),
            key.clone(),
            Arc::new(actor),
            admission,
            move |_| async move {
                let _ = entered_tx.send(());
                std::future::pending::<Result<(), Error>>().await
            },
        ));
        tokio::time::timeout(Duration::from_secs(1), entered_rx)
            .await
            .unwrap()
            .unwrap();

        let other_operation = CancellationToken::new();
        let other_admission = supervisor
            .admit_for_operation(
                other_key.clone(),
                "other-engine".into(),
                path_ref("other-path"),
                other_operation.clone(),
            )
            .await
            .unwrap();
        operation.cancel();

        assert!(matches!(
            tokio::time::timeout(Duration::from_secs(1), initializing)
                .await
                .unwrap()
                .unwrap(),
            Err(Error::Cancellation)
        ));
        assert_eq!(terminated.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&key).is_none());
        assert!(!other_operation.is_cancelled());
        assert!(other_admission.cancel_error().is_none());
        assert!(supervisor.admissions.contains_key(&other_key));
    }

    #[tokio::test]
    async fn shutdown_cancels_pending_search_and_refuses_publication() {
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let executable = path_ref("engine-path");
        let generation = supervisor
            .prepare_engine_search(key.clone(), "engine".into(), executable.clone())
            .await
            .unwrap();

        supervisor.terminate_all().await.unwrap();

        assert!(matches!(
            supervisor
                .consume_engine_search(key, "engine".into(), executable, &generation)
                .await,
            Err(Error::Conflict(_))
        ));
        assert!(supervisor.admissions.is_empty());
    }

    #[tokio::test]
    async fn shutdown_rejection_preserves_actor_cleanup_failure() {
        let supervisor = EngineSupervisor::default();
        supervisor.terminate_all().await.unwrap();
        let key = EngineKey::new("shutdown".into(), "cleanup-fails".into()).unwrap();
        let actor = EngineActor::new(Box::new(TerminateErrorIo), EngineDeadlines::default());

        assert!(matches!(
            supervisor.replace(key, actor).await,
            Err(Error::OperationAndCleanup { .. })
        ));
    }

    #[tokio::test]
    async fn replacing_a_live_actor_cancels_the_previous_generation() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let (old, _) = actor(&[]);
        let first = supervisor.replace(key.clone(), old).await.unwrap();
        let (replacement, _) = actor(&[]);
        let second = supervisor.replace(key.clone(), replacement).await.unwrap();

        assert_ne!(first.generation, second.generation);
        assert!(first.cancelled.load(Ordering::SeqCst));
        let published = first
            .try_publish(|| -> Result<(), Error> {
                panic!("replaced generation must not publish");
            })
            .unwrap();
        assert!(!published);
        assert!(!second.cancelled.load(Ordering::SeqCst));
        supervisor
            .terminate_exact(&key, second.generation)
            .await
            .unwrap();
    }

    #[test]
    fn cancel_and_publish_share_the_publication_lock() {
        let source = include_str!("process.rs");
        let production = source
            .split_once("mod tests {")
            .map(|(prefix, _)| prefix)
            .expect("test module should exist");
        for function in ["pub fn mark_cancelled(", "pub fn try_publish<E>("] {
            let body = crate::infra::blocking::source_scan::body_at_indent(production, function);
            assert!(
                body.contains(".publish"),
                "{function} must take the publication lock"
            );
        }
    }

    #[tokio::test]
    async fn terminate_exact_marks_the_generation_cancelled_before_reaping() {
        let supervisor = EngineSupervisor::default();
        let key = EngineKey::new("tab".into(), "engine".into()).unwrap();
        let (actor, _) = actor(&[]);
        let supervised = supervisor.replace(key.clone(), actor).await.unwrap();

        supervisor
            .terminate_exact(&key, supervised.generation)
            .await
            .unwrap();

        assert!(supervised.cancelled.load(Ordering::SeqCst));
        assert!(supervisor.get_exact(&key).is_none());
        let published = supervised
            .try_publish(|| -> Result<(), Error> {
                panic!("cancelled generation must not publish");
            })
            .unwrap();
        assert!(!published);
    }

    #[tokio::test]
    async fn try_publish_skips_after_mark_cancelled_without_emitting() {
        let (actor, _) = actor(&[]);
        let actor = Arc::new(actor);
        let supervised = SupervisedEngine::new(
            7,
            "engine".into(),
            path_ref("engine-path"),
            actor.clone(),
            Arc::new(AtomicBool::new(false)),
        );
        supervised.mark_cancelled();
        let published = supervised
            .try_publish(|| -> Result<(), Error> {
                panic!("cancelled generation must not publish");
            })
            .unwrap();
        assert!(!published);
        assert!(supervised.cancelled.load(Ordering::SeqCst));
        actor.terminate().await.unwrap();
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
        assert_eq!(supervisor.lifecycle.len(), 0);
    }

    #[tokio::test]
    async fn lifecycle_leases_are_reclaimed_after_distinct_missing_engine_operations() {
        let supervisor = EngineSupervisor::default();
        for index in 0..2_000 {
            let key = EngineKey::new(format!("tab-{index}"), format!("engine-{index}")).unwrap();
            supervisor.terminate_exact(&key, 1).await.unwrap();
            supervisor.stop_exact(&key).await.unwrap();
        }
        assert_eq!(supervisor.lifecycle.len(), 0);
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
    async fn shutdown_aggregation_preserves_types_logs_identity_and_completes_all_targets() {
        match SHUTDOWN_FAILURE_LOGS.lock() {
            Ok(mut logs) => logs.clear(),
            Err(poisoned) => poisoned.into_inner().clear(),
        }
        let supervisor = EngineSupervisor::default();
        let timeout_key = EngineKey::new("typed".into(), "timeout".into()).unwrap();
        let combined_key = EngineKey::new("typed".into(), "combined".into()).unwrap();
        let timeout_calls = Arc::new(AtomicUsize::new(0));
        let combined_calls = Arc::new(AtomicUsize::new(0));
        let timeout_actor = EngineActor::new(
            Box::new(TypedTerminateErrorIo {
                failure: TypedTerminateFailure::Timeout,
                terminate_calls: timeout_calls.clone(),
            }),
            EngineDeadlines::default(),
        );
        let combined_actor = EngineActor::new(
            Box::new(TypedTerminateErrorIo {
                failure: TypedTerminateFailure::OperationAndCleanup,
                terminate_calls: combined_calls.clone(),
            }),
            EngineDeadlines::default(),
        );
        let timeout = supervisor
            .replace(timeout_key.clone(), timeout_actor)
            .await
            .unwrap();
        let combined = supervisor
            .replace(combined_key.clone(), combined_actor)
            .await
            .unwrap();

        let failures = supervisor
            .terminate_targets(vec![
                (timeout_key.clone(), timeout.generation),
                (combined_key.clone(), combined.generation),
            ])
            .await;
        assert_eq!(failures.len(), 2);
        assert!(matches!(failures[0].error, Error::EngineTimeout(_)));
        assert!(matches!(
            failures[1].error,
            Error::OperationAndCleanup { .. }
        ));
        assert_eq!(timeout_calls.load(AtomicOrdering::SeqCst), 1);
        assert_eq!(combined_calls.load(AtomicOrdering::SeqCst), 1);
        assert!(supervisor.get_exact(&timeout_key).is_none());
        assert!(supervisor.get_exact(&combined_key).is_none());

        assert!(matches!(
            aggregate_shutdown_failures(failures),
            Err(Error::EngineTimeout(_))
        ));
        let logs = match SHUTDOWN_FAILURE_LOGS.lock() {
            Ok(logs) => logs.clone(),
            Err(poisoned) => poisoned.into_inner().clone(),
        };
        assert!(logs.iter().any(|message| {
            message.contains("typed:timeout")
                && message.contains(&format!("generation={}", timeout.generation))
                && message.contains("category=engine timeout")
        }));
        assert!(logs.iter().any(|message| {
            message.contains("typed:combined")
                && message.contains(&format!("generation={}", combined.generation))
                && message.contains("category=operation and cleanup failure")
        }));
        assert!(logs.iter().all(|message| {
            !message.contains("typed timeout sentinel")
                && !message.contains("typed primary sentinel")
                && !message.contains("typed cleanup sentinel")
        }));

        assert!(matches!(
            aggregate_shutdown_failures(vec![ActorShutdownFailure {
                key: combined_key,
                generation: combined.generation,
                error: Error::OperationAndCleanup {
                    primary: "primary".into(),
                    cleanup: "cleanup".into(),
                },
            }]),
            Err(Error::OperationAndCleanup { .. })
        ));
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
        let ((racing, _), racing_terminated) = actor_with(&[], false, None);
        let replacement = tokio::spawn({
            let supervisor = supervisor.clone();
            let race_key = race_key.clone();
            async move { supervisor.replace(race_key, racing).await }
        });
        while !supervisor.admissions.contains_key(&race_key) {
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
        while !supervisor.admissions.contains_key(&key) {
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
            SupervisedEngine::new(
                99,
                "slipped".into(),
                PathRef {
                    id: "slipped-path".into(),
                },
                Arc::new(slipped),
                Arc::new(AtomicBool::new(false)),
            ),
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

    #[cfg(unix)]
    fn assert_child_is_reaped(pid: u32) {
        let result = unsafe { libc::kill(pid as libc::pid_t, 0) };
        assert_eq!(result, -1, "child {pid} still exists after spawn failure");
        assert_eq!(
            io::Error::last_os_error().raw_os_error(),
            Some(libc::ESRCH),
            "child {pid} was not reaped"
        );
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn spawn_io_take_failures_force_kill_and_reap_child() {
        use std::os::unix::fs::PermissionsExt;

        for failure in [SpawnIoFailure::NoStdin, SpawnIoFailure::NoStdout] {
            let directory = tempfile::tempdir().unwrap();
            let script = directory.path().join("spawn-io-failure-engine.sh");
            std::fs::write(&script, "#!/bin/sh\nwhile IFS= read -r line; do :; done\n").unwrap();
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
            let executable = EngineExecutable::test_fixture(
                std::fs::File::open(&script).unwrap(),
                directory.path().to_path_buf(),
                Vec::new(),
            );
            let (pid_tx, pid_rx) = std::sync::mpsc::channel();
            set_spawn_child_observer(Some(Box::new(move |pid| {
                let _ = pid_tx.send(pid);
            })));
            set_spawn_io_failure(Some(failure));
            let result = EngineRuntime::spawn(
                executable,
                EngineDeadlines {
                    kill_reap: Duration::from_millis(200),
                    ..EngineDeadlines::default()
                },
            )
            .await;
            set_spawn_io_failure(None);
            set_spawn_child_observer(None);

            let pid = pid_rx
                .recv_timeout(Duration::from_secs(1))
                .unwrap()
                .expect("spawn observer must see a real child pid");
            match failure {
                SpawnIoFailure::NoStdin => assert!(matches!(result, Err(Error::NoStdin))),
                SpawnIoFailure::NoStdout => assert!(matches!(result, Err(Error::NoStdout))),
            }
            assert_child_is_reaped(pid);
        }

        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("spawn-io-reap-failure-engine.sh");
        std::fs::write(&script, "#!/bin/sh\nwhile IFS= read -r line; do :; done\n").unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let executable = EngineExecutable::test_fixture(
            std::fs::File::open(&script).unwrap(),
            directory.path().to_path_buf(),
            Vec::new(),
        );
        let (pid_tx, pid_rx) = std::sync::mpsc::channel();
        set_spawn_child_observer(Some(Box::new(move |pid| {
            let _ = pid_tx.send(pid);
        })));
        set_spawn_io_failure(Some(SpawnIoFailure::NoStdin));
        set_terminate_failure(Some(TerminateFailure::ReapError));
        let result = EngineRuntime::spawn(
            executable,
            EngineDeadlines {
                kill_reap: Duration::from_millis(200),
                ..EngineDeadlines::default()
            },
        )
        .await;
        set_spawn_io_failure(None);
        set_terminate_failure(None);
        set_spawn_child_observer(None);

        let pid = pid_rx
            .recv_timeout(Duration::from_secs(1))
            .unwrap()
            .expect("spawn observer must see a real child pid");
        assert!(matches!(result, Err(Error::OperationAndCleanup { .. })));
        assert_child_is_reaped(pid);
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

    #[cfg(unix)]
    #[tokio::test(flavor = "current_thread")]
    async fn resource_verification_isolated_gateway_keeps_actor_control_responsive() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("resource");
        std::fs::write(&path, b"resource").unwrap();
        let lease = Arc::new(
            crate::infra::path_authority::EngineResourceLease::test_file(
                std::fs::File::open(&path).unwrap(),
            ),
        );
        let value = lease.uci_value();
        let (actor, writes) = EngineActor::recording_test_actor_with_resources(&[], vec![lease]);
        let options = vec![ResolvedEngineOption {
            name: "EvalFile".into(),
            value: value.clone(),
            resources: Vec::new(),
            resource_values: vec![value.clone()],
        }];
        let gateway = BlockingGateway::new(1);
        let (entered_tx, entered_rx) = tokio::sync::oneshot::channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        set_resource_verify_hook(
            value.clone(),
            Some(Box::new(move || {
                let _ = entered_tx.send(());
                release_rx.recv().unwrap();
            })),
        );
        let task_gateway = gateway.clone();
        let verification = tokio::spawn({
            let actor = actor.clone();
            async move { verify_option_resources_in(&task_gateway, &actor, &options, None).await }
        });
        tokio::time::timeout(std::time::Duration::from_secs(1), entered_rx)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(gateway.available_permits(), 0);
        tokio::time::timeout(std::time::Duration::from_millis(100), actor.terminate())
            .await
            .unwrap()
            .unwrap();
        release_tx.send(()).unwrap();
        assert!(matches!(
            verification.await.unwrap(),
            Err(Error::Cancellation)
        ));
        assert!(writes.lock().await.is_empty());
    }

    #[cfg(unix)]
    #[tokio::test(flavor = "current_thread")]
    async fn resource_verification_timeout_returns_without_sending_setoption() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("resource");
        std::fs::write(&path, b"resource").unwrap();
        let lease = Arc::new(
            crate::infra::path_authority::EngineResourceLease::test_file(
                std::fs::File::open(&path).unwrap(),
            ),
        );
        let value = lease.uci_value();
        let deadlines = EngineDeadlines {
            resource_verify: std::time::Duration::from_millis(500),
            ..EngineDeadlines::default()
        };
        let (actor, writes) = EngineActor::recording_test_actor_with_resources_and_deadlines(
            &[],
            vec![lease],
            deadlines,
        );
        let options = vec![ResolvedEngineOption {
            name: "EvalFile".into(),
            value: value.clone(),
            resources: Vec::new(),
            resource_values: vec![value.clone()],
        }];
        let (entered_tx, entered_rx) = tokio::sync::oneshot::channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        set_resource_verify_hook(
            value.clone(),
            Some(Box::new(move || {
                let _ = entered_tx.send(());
                release_rx.recv().unwrap();
            })),
        );
        let gateway = BlockingGateway::new(1);
        let task_gateway = gateway.clone();
        let verification = tokio::spawn({
            let actor = actor.clone();
            async move { verify_option_resources_in(&task_gateway, &actor, &options, None).await }
        });
        tokio::time::timeout(std::time::Duration::from_secs(1), entered_rx)
            .await
            .unwrap()
            .unwrap();
        assert!(matches!(
            verification.await.unwrap(),
            Err(Error::EngineTimeout(message)) if message == "verifying engine option resources"
        ));
        release_tx.send(()).unwrap();
        assert!(writes.lock().await.is_empty());
        actor.terminate().await.unwrap();
    }

    #[tokio::test]
    async fn unheld_resource_values_are_refused_before_the_first_setoption() {
        let (actor, writes) = EngineActor::recording_test_actor(&[]);
        let options = [ResolvedEngineOption {
            name: "EvalFile".into(),
            value: "/unheld/resource".into(),
            resources: Vec::new(),
            resource_values: vec!["/unheld/resource".into()],
        }];
        assert!(matches!(
            verify_option_resources(&actor, &options, None).await,
            Err(Error::Conflict(message))
                if message == "engine option resource was not produced by the launched engine"
        ));
        assert!(writes.lock().await.is_empty());
        actor.terminate().await.unwrap();
    }

    #[tokio::test]
    async fn a_second_unheld_resource_is_refused_without_partial_option_writes() {
        let (actor, writes) = EngineActor::recording_test_actor(&[]);
        let options = [ResolvedEngineOption {
            name: "Tablebases".into(),
            value: "/first:/second".into(),
            resources: Vec::new(),
            resource_values: vec!["/first".into(), "/second".into()],
        }];
        assert!(matches!(
            verify_option_resources(&actor, &options, None).await,
            Err(Error::Conflict(_))
        ));
        assert!(writes.lock().await.is_empty());
        actor.terminate().await.unwrap();
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn a_replaced_second_resource_is_refused_without_partial_option_writes() {
        let directory = tempfile::tempdir().unwrap();
        let first_path = directory.path().join("first");
        let second_path = directory.path().join("second");
        std::fs::write(&first_path, b"first").unwrap();
        std::fs::write(&second_path, b"second").unwrap();
        let first = Arc::new(
            crate::infra::path_authority::EngineResourceLease::test_file(
                std::fs::File::open(&first_path).unwrap(),
            ),
        );
        let second = Arc::new(
            crate::infra::path_authority::EngineResourceLease::test_file(
                std::fs::File::open(&second_path).unwrap(),
            ),
        );
        let first_value = first.uci_value();
        let second_value = second.uci_value();
        let (actor, writes) = EngineActor::recording_test_actor_with_resources(
            &[],
            vec![first.clone(), second.clone()],
        );
        std::fs::rename(&second_path, directory.path().join("second-original")).unwrap();
        std::fs::write(&second_path, b"replacement").unwrap();
        let options = [ResolvedEngineOption {
            name: "Tablebases".into(),
            value: format!("{first_value}:{second_value}"),
            resources: vec![first, second],
            resource_values: vec![first_value, second_value],
        }];
        assert!(matches!(
            verify_option_resources(&actor, &options, None).await,
            Err(Error::Conflict(message))
                if message == "engine resource changed after authorization"
        ));
        assert!(writes.lock().await.is_empty());
        actor.terminate().await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test(flavor = "current_thread")]
    async fn resolved_executable_stays_authorized_after_source_replacement_before_spawn() {
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("authorized-engine.sh");
        std::fs::write(
            &script,
            "#!/bin/sh\nwhile IFS= read -r line; do case \"$line\" in uci) echo uciok;; isready) echo readyok;; quit) exit 0;; esac; done\n",
        )
        .unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let replacement = script.clone();
        let authority = {
            #[cfg(target_os = "macos")]
            {
                PathAuthority::open_with_launch_root(
                    directory.path().join("registry.json"),
                    Vec::new(),
                    crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path())
                        .unwrap(),
                )
                .unwrap()
            }
            #[cfg(not(target_os = "macos"))]
            {
                PathAuthority::open(directory.path().join("registry.json"), Vec::new()).unwrap()
            }
        };
        let mut authority = authority;
        let engine = authority
            .register_engine_file(&script, "authorized-engine")
            .unwrap();
        let authority = Arc::new(std::sync::Mutex::new(Some(authority)));
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("replacement".into(), "authorized-engine".into()).unwrap();
        let admission = supervisor
            .admit_for_launch(key, "authorized-engine".into(), engine.id.clone())
            .await
            .unwrap();
        set_engine_launch_resolution_hook(Some(Box::new(move || {
            std::fs::rename(&replacement, replacement.with_extension("replaced")).unwrap();
            std::fs::write(&replacement, "#!/bin/sh\nexit 22\n").unwrap();
        })));
        let (executable, _) = EngineActor::resolve_launch(
            authority,
            engine,
            PathOperation::EngineExecute,
            &[],
            &admission,
        )
        .await
        .unwrap();
        set_engine_launch_resolution_hook(None);

        let actor = EngineActor::spawn_initialized(executable, EngineDeadlines::default())
            .await
            .unwrap();
        actor.terminate().await.unwrap();
    }

    #[cfg(unix)]
    #[tokio::test(flavor = "current_thread")]
    async fn launch_resolution_and_materialization_run_off_the_async_caller() {
        use crate::infra::path_authority::{EngineResourceHandleKind, PathAuthority, PathClass};
        use std::thread::ThreadId;

        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("thread-engine.sh");
        std::fs::write(&script, "#!/bin/sh\n").unwrap();
        let resource_path = directory.path().join("thread-resource.bin");
        std::fs::write(&resource_path, b"resource").unwrap();
        let root = std::thread::current().id();
        let trace = Arc::new(std::sync::Mutex::new(Vec::<(&'static str, ThreadId)>::new()));
        crate::infra::path_authority::set_engine_resolution_trace(Some(trace.clone()));
        let mut authority = {
            #[cfg(target_os = "macos")]
            {
                PathAuthority::open_with_launch_root(
                    directory.path().join("registry.json"),
                    Vec::new(),
                    crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path())
                        .unwrap(),
                )
                .unwrap()
            }
            #[cfg(target_os = "linux")]
            {
                PathAuthority::open(directory.path().join("registry.json"), Vec::new()).unwrap()
            }
        };
        let engine = authority
            .register_engine_file(&script, "thread-engine")
            .unwrap();
        let grant = authority
            .grant_dialog(
                &resource_path,
                "thread-resource",
                PathClass::SingleDialogGrant,
                PathOperation::EngineResourceRead,
                Duration::from_secs(30),
                1,
            )
            .unwrap();
        let resource = authority
            .promote_engine_resource(&grant, EngineResourceHandleKind::File, "thread-resource")
            .unwrap();
        #[cfg(target_os = "macos")]
        let launch_root = authority.engine_launch_root().unwrap();
        let authority = Arc::new(std::sync::Mutex::new(Some(authority)));
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("thread-test".into(), "thread-engine".into()).unwrap();
        let admission = supervisor
            .admit_for_launch(key, "thread-engine".into(), engine.id.clone())
            .await
            .unwrap();
        let result = EngineActor::resolve_launch(
            authority,
            engine,
            PathOperation::EngineExecute,
            &[EngineOption::Resource {
                name: "EvalFile".into(),
                resources: vec![resource],
            }],
            &admission,
        )
        .await;
        crate::infra::path_authority::set_engine_resolution_trace(None);
        let (executable, _) = result.unwrap();
        let trace = trace.lock().unwrap().clone();
        #[cfg(target_os = "linux")]
        let expected = vec!["executable", "resource"];
        #[cfg(target_os = "macos")]
        let expected = vec!["executable", "resource", "leaf", "leaf"];
        assert_eq!(
            trace.iter().map(|(kind, _)| *kind).collect::<Vec<_>>(),
            expected
        );
        assert!(trace.iter().all(|(_, thread)| *thread != root));
        #[cfg(target_os = "macos")]
        {
            drop(executable);
            assert!(launch_root.reclaim().removed >= 1);
        }
        #[cfg(target_os = "linux")]
        drop(executable);
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn launch_without_an_initialized_root_is_refused_before_spawn() {
        use crate::infra::path_authority::PathAuthority;
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("missing-launch-root-engine.sh");
        std::fs::write(&script, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let mut authority =
            PathAuthority::open(directory.path().join("registry.json"), Vec::new()).unwrap();
        let engine = authority
            .register_engine_file(&script, "missing-root-engine")
            .unwrap();
        let authority = Arc::new(std::sync::Mutex::new(Some(authority)));
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("missing-root".into(), "missing-root-engine".into()).unwrap();
        let admission = supervisor
            .admit_for_launch(key, "missing-root-engine".into(), engine.id.clone())
            .await
            .unwrap();
        assert!(matches!(
            EngineActor::resolve_launch(
                authority,
                engine,
                PathOperation::EngineExecute,
                &[],
                &admission,
            )
            .await,
            Err(Error::Conflict(message))
                if message == "engine launch root is not initialized"
        ));
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn launch_value_construction_failure_releases_pinned_leaves() {
        use crate::infra::path_authority::PathAuthority;
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("value-failure-engine.sh");
        std::fs::write(&script, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let root =
            crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path()).unwrap();
        let mut authority = PathAuthority::open_with_launch_root(
            directory.path().join("registry.json"),
            Vec::new(),
            root.clone(),
        )
        .unwrap();
        let engine = authority
            .register_engine_file(&script, "value-failure-engine")
            .unwrap();
        let authority = Arc::new(std::sync::Mutex::new(Some(authority)));
        let supervisor = Arc::new(EngineSupervisor::default());
        let key = EngineKey::new("value-failure".into(), "value-failure-engine".into()).unwrap();
        let admission = supervisor
            .admit_for_launch(key, "value-failure-engine".into(), engine.id.clone())
            .await
            .unwrap();
        set_engine_launch_value_failure(true);
        let result = EngineActor::resolve_launch(
            authority,
            engine,
            PathOperation::EngineExecute,
            &[],
            &admission,
        )
        .await;
        set_engine_launch_value_failure(false);
        assert!(matches!(
            result,
            Err(Error::Conflict(message))
                if message == "injected engine launch value construction failure"
        ));
        assert_eq!(root.registry_snapshot_for_test().0, 1);
        assert_eq!(root.reclaim().removed, 1);
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn cancellation_after_pinning_releases_leaves_before_spawn() {
        use crate::infra::path_authority::PathAuthority;
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().unwrap();
        let script = directory.path().join("post-pin-cancel-engine.sh");
        std::fs::write(&script, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let root =
            crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path()).unwrap();
        let mut authority = PathAuthority::open_with_launch_root(
            directory.path().join("registry.json"),
            Vec::new(),
            root.clone(),
        )
        .unwrap();
        let engine = authority
            .register_engine_file(&script, "post-pin-cancel-engine")
            .unwrap();
        let authority = Arc::new(std::sync::Mutex::new(Some(authority)));
        let supervisor = Arc::new(EngineSupervisor::default());
        let key =
            EngineKey::new("post-pin-cancel".into(), "post-pin-cancel-engine".into()).unwrap();
        let admission = supervisor
            .admit_for_launch(key, "post-pin-cancel-engine".into(), engine.id.clone())
            .await
            .unwrap();
        let cancelled = admission.admission.cancelled.clone();
        set_engine_launch_post_pin_hook(Some(Box::new(move || {
            cancelled.store(true, AtomicOrdering::SeqCst);
        })));
        let result = EngineActor::resolve_launch(
            authority,
            engine,
            PathOperation::EngineExecute,
            &[],
            &admission,
        )
        .await;
        set_engine_launch_post_pin_hook(None);
        assert!(matches!(result, Err(Error::Cancellation)));
        assert_eq!(root.registry_snapshot_for_test().0, 1);
        assert_eq!(root.reclaim().removed, 1);
        assert!(supervisor
            .get_exact(
                &EngineKey::new("post-pin-cancel".into(), "post-pin-cancel-engine".into()).unwrap()
            )
            .is_none());
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn child_io_take_failures_release_pinned_leaves_after_spawn() {
        use std::os::unix::fs::PermissionsExt;

        for failure in [SpawnIoFailure::NoStdin, SpawnIoFailure::NoStdout] {
            let directory = tempfile::tempdir().unwrap();
            let script = directory.path().join("io-failure-engine.sh");
            std::fs::write(&script, "#!/bin/sh\nwhile IFS= read -r line; do :; done\n").unwrap();
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
            let root =
                crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path()).unwrap();
            let mut executable = EngineExecutable::test_fixture(
                std::fs::File::open(&script).unwrap(),
                directory.path().to_path_buf(),
                Vec::new(),
            );
            executable.set_test_launch_root(root.clone());
            let key = EngineKey::new("io-failure".into(), "io-failure-engine".into()).unwrap();
            pin_engine_launch(&mut executable, &key, "io-failure-engine", &|| false).unwrap();
            set_spawn_io_failure(Some(failure));
            let result = EngineActor::spawn(executable, EngineDeadlines::default()).await;
            match failure {
                SpawnIoFailure::NoStdin => assert!(matches!(result, Err(Error::NoStdin))),
                SpawnIoFailure::NoStdout => assert!(matches!(result, Err(Error::NoStdout))),
            }
            set_spawn_io_failure(None);
            assert_eq!(root.registry_snapshot_for_test().0, 1);
            assert_eq!(root.reclaim().removed, 1);
        }
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn apple_fallback_materializes_and_runs_the_authorized_engine_image() {
        use crate::infra::path_authority::EngineLaunchFailure;
        use std::os::unix::fs::PermissionsExt;

        for failure in [
            EngineLaunchFailure::CloneExdev,
            EngineLaunchFailure::CloneEnotsup,
        ] {
            let directory = tempfile::tempdir().unwrap();
            let script = directory.path().join("fallback-engine.sh");
            std::fs::write(
                &script,
                "#!/bin/sh\nwhile IFS= read -r line; do case \"$line\" in uci) echo uciok;; isready) echo readyok;; quit) exit 0;; esac; done\n",
            )
            .unwrap();
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
            let root =
                crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path()).unwrap();
            let mut executable = EngineExecutable::test_fixture(
                std::fs::File::open(&script).unwrap(),
                directory.path().to_path_buf(),
                Vec::new(),
            );
            executable.set_test_launch_root(root.clone());
            let key = EngineKey::new("fallback".into(), "fallback-engine".into()).unwrap();
            crate::infra::path_authority::set_engine_launch_failure(Some(failure));
            pin_engine_launch(&mut executable, &key, "fallback-engine", &|| false).unwrap();
            crate::infra::path_authority::set_engine_launch_failure(None);
            std::fs::rename(&script, directory.path().join("authorized-original.sh")).unwrap();
            std::fs::write(&script, "#!/bin/sh\nexit 22\n").unwrap();
            let actor = EngineActor::spawn_initialized(executable, EngineDeadlines::default())
                .await
                .unwrap();
            actor.terminate().await.unwrap();
            assert_eq!(root.reclaim().removed, 1);
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn real_child_termination_failures_cover_error_and_timeout_reap_branches() {
        use std::os::unix::fs::PermissionsExt;

        for (failure, expected_timeout) in [
            (TerminateFailure::QuitKillReap, false),
            (TerminateFailure::ReapTimeout, true),
        ] {
            let directory = tempfile::tempdir().unwrap();
            let script = directory.path().join("termination-failure-engine.sh");
            std::fs::write(&script, "#!/bin/sh\nwhile IFS= read -r line; do :; done\n").unwrap();
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
            let executable = EngineExecutable::test_fixture(
                std::fs::File::open(&script).unwrap(),
                directory.path().to_path_buf(),
                Vec::new(),
            );
            let deadlines = EngineDeadlines {
                quit: Duration::from_millis(20),
                kill_reap: Duration::from_millis(30),
                ..EngineDeadlines::default()
            };
            set_terminate_failure(Some(failure));
            let mut runtime = EngineRuntime::spawn(executable, deadlines).await.unwrap();
            set_terminate_failure(None);
            let result = runtime.terminate().await;
            if expected_timeout {
                assert!(matches!(result, Err(Error::EngineTimeout(_))));
            } else {
                assert!(matches!(result, Err(Error::OperationAndCleanup { .. })));
            }
            drop(runtime);
        }
    }

    #[cfg(target_os = "macos")]
    #[tokio::test(flavor = "current_thread")]
    async fn apple_directory_resource_replacement_is_refused_before_setoption() {
        let directory = tempfile::tempdir().unwrap();
        let tables = directory.path().join("tables");
        std::fs::create_dir(&tables).unwrap();
        std::fs::write(tables.join("authorized"), b"authorized").unwrap();
        let lease = Arc::new(
            crate::infra::path_authority::EngineResourceLease::test_directory(
                std::fs::File::open(&tables).unwrap(),
            ),
        );
        let value = lease.uci_value();
        let (actor, writes) = EngineActor::recording_test_actor_with_resources(&[], vec![lease]);
        std::fs::rename(&tables, directory.path().join("tables-original")).unwrap();
        std::fs::create_dir(&tables).unwrap();
        std::fs::write(tables.join("replacement"), b"replacement").unwrap();
        let options = [ResolvedEngineOption {
            name: "SyzygyPath".into(),
            value: value.clone(),
            resources: Vec::new(),
            resource_values: vec![value],
        }];
        assert!(matches!(
            verify_option_resources(&actor, &options, None).await,
            Err(Error::Conflict(message))
                if message == "engine resource changed after authorization"
        ));
        assert!(writes.lock().await.is_empty());
        actor.terminate().await.unwrap();
    }

    #[cfg(target_os = "macos")]
    #[tokio::test(flavor = "current_thread")]
    async fn apple_directory_resource_removal_and_file_swap_are_refused_before_setoption() {
        use std::os::unix::fs::PermissionsExt;

        for replacement in ["remove", "file"] {
            let directory = tempfile::tempdir().unwrap();
            let script = directory.path().join("directory-check-engine.sh");
            std::fs::write(
                &script,
                "#!/bin/sh\nwhile IFS= read -r line; do case \"$line\" in uci) echo uciok;; isready) echo readyok;; setoption*) echo setoption-unexpected;; quit) exit 0;; esac; done\n",
            )
            .unwrap();
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
            let tables = directory.path().join("tables");
            std::fs::create_dir(&tables).unwrap();
            std::fs::write(tables.join("authorized"), b"authorized").unwrap();
            let resource = Arc::new(
                crate::infra::path_authority::EngineResourceLease::test_directory(
                    std::fs::File::open(&tables).unwrap(),
                ),
            );
            let value = resource.uci_value();
            let root =
                crate::infra::path_authority::EngineLaunchRoot::for_test(directory.path()).unwrap();
            let mut executable = EngineExecutable::test_fixture(
                std::fs::File::open(&script).unwrap(),
                directory.path().to_path_buf(),
                Vec::new(),
            )
            .with_resource_leases(vec![resource.clone()]);
            executable.set_test_launch_root(root);
            let key =
                EngineKey::new("directory-check".into(), "directory-check-engine".into()).unwrap();
            pin_engine_launch(&mut executable, &key, "directory-check-engine", &|| false).unwrap();
            let actor = EngineActor::spawn_initialized(executable, EngineDeadlines::default())
                .await
                .unwrap();
            if replacement == "remove" {
                std::fs::remove_dir_all(&tables).unwrap();
            } else {
                std::fs::remove_dir_all(&tables).unwrap();
                std::fs::write(&tables, b"replacement-file").unwrap();
            }
            let options = [ResolvedEngineOption {
                name: "SyzygyPath".into(),
                value: value.clone(),
                resources: vec![resource],
                resource_values: vec![value],
            }];
            assert!(matches!(
                verify_option_resources(&actor, &options, None).await,
                Err(Error::Conflict(message))
                    if message == "engine resource changed after authorization"
            ));
            assert!(actor.logs().await.unwrap().iter().all(|entry| match entry {
                EngineLog::Gui(line) | EngineLog::Engine(line) => {
                    !line.contains("setoption")
                }
                EngineLog::Truncated { .. } => true,
            }));
            actor.terminate().await.unwrap();
        }
    }
}
