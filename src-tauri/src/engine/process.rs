use std::{
    collections::VecDeque,
    process::Stdio,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
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
use crate::infra::path_authority::EngineExecutable;

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
    async fn terminate(&mut self, quit_timeout: Duration) -> Result<(), Error>;
}

struct ChildUciIo {
    stdin: ChildStdin,
    reader: BufReader<ChildStdout>,
    child: Child,
    // Keep the validated descriptor open for the complete child lifetime.
    // Linux executes `/proc/self/fd/N`, so dropping it would invalidate the
    // sealed command target after process creation.
    _executable: EngineExecutable,
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

#[async_trait]
impl UciIo for ChildUciIo {
    async fn write_line(&mut self, line: &str) -> Result<(), Error> {
        self.stdin.write_all(line.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await?;
        Ok(())
    }

    async fn read_line(&mut self) -> Result<Option<String>, Error> {
        read_bounded_engine_line(&mut self.reader).await
    }

    async fn terminate(&mut self, quit_timeout: Duration) -> Result<(), Error> {
        let quit = self.write_line("quit").await;
        let waited = timeout(quit_timeout, self.child.wait()).await;
        if matches!(waited, Ok(Ok(_))) {
            if let Err(error) = quit {
                // The process is conclusively reaped. A broken stdin cannot
                // resurrect it, so lifecycle callers must be allowed to drop
                // this actor rather than retaining a dead registry entry.
                error!("engine quit write failed after child exited: {error}");
            }
            return Ok(());
        }

        // A failed graceful wait is never a reason to abandon the child. Try
        // force-kill and then *always* await reaping, including if start_kill
        // itself reports an error (the child may have exited concurrently).
        let primary = match (quit, waited) {
            (Err(quit), _) => quit,
            (Ok(()), Ok(Err(wait))) => wait.into(),
            (Ok(()), Err(_)) => Error::EngineTimeout("waiting for engine exit".into()),
            (Ok(()), Ok(Ok(_))) => {
                return Ok(());
            }
        };
        let kill = self.child.start_kill().err();
        let reap = self.child.wait().await.err();
        match (kill, reap) {
            (kill, None) => {
                if let Some(kill) = kill {
                    error!("engine force-kill reported an error but child reaped: {kill}");
                }
                error!("engine graceful shutdown failed but child reaped: {primary}");
                Ok(())
            }
            (Some(kill), Some(reap)) => Err(Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: format!("force-kill failed: {kill}; final reap failed: {reap}"),
            }),
            (None, Some(reap)) => Err(Error::OperationAndCleanup {
                primary: primary.to_string(),
                cleanup: format!("final reap failed: {reap}"),
            }),
        }
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
    pub actor: Arc<EngineActor>,
    pub cancelled: Arc<std::sync::atomic::AtomicBool>,
}

/// Owns the registry boundary for interactive engines.  Replacement removes
/// exactly one opaque key, shuts down that actor, then publishes the new
/// generation.  It deliberately has no prefix APIs.
#[derive(Default)]
pub struct EngineSupervisor {
    next_generation: AtomicU64,
    sealed: AtomicBool,
    actors: DashMap<EngineKey, SupervisedEngine>,
    registration: Mutex<()>,
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
        let lifecycle = self.lifecycle_slot(&key);
        let _transition = lifecycle.lock().await;
        if self.sealed.load(Ordering::SeqCst) {
            return Err(Self::reject_replacement_during_shutdown(&actor).await);
        }
        if let Some(previous) = self.actors.get(&key).map(|entry| entry.clone()) {
            let previous_actor = previous.actor.clone();
            // A replacement must observe the old search boundary before any
            // new `position`/`go` is sent to its own process.
            let stop = previous_actor.stop_current().await;
            let terminate = previous_actor.terminate().await;
            if terminate.is_ok() {
                self.actors.remove(&key);
            }
            combine_shutdown_results(stop, terminate)?;
        }
        let registration = self.registration.lock().await;
        if self.sealed.load(Ordering::SeqCst) {
            drop(registration);
            return Err(Self::reject_replacement_during_shutdown(&actor).await);
        }
        let generation = self
            .next_generation
            .fetch_add(1, Ordering::Relaxed)
            .checked_add(1)
            .ok_or_else(|| Error::ResourceLimit("engine generation exhausted".into()))?;
        let entry = SupervisedEngine {
            generation,
            actor: Arc::new(actor),
            cancelled: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        };
        self.actors.insert(key, entry.clone());
        Ok(entry)
    }

    pub async fn replace_handle(
        &self,
        key: EngineKey,
        actor: Arc<EngineActor>,
    ) -> Result<SupervisedEngine, Error> {
        let lifecycle = self.lifecycle_slot(&key);
        let _transition = lifecycle.lock().await;
        if self.sealed.load(Ordering::SeqCst) {
            return Err(Self::reject_replacement_during_shutdown(&actor).await);
        }
        if let Some(previous) = self.actors.get(&key).map(|entry| entry.clone()) {
            let previous_actor = previous.actor.clone();
            let stop = previous_actor.stop_current().await;
            let terminate = previous_actor.terminate().await;
            if terminate.is_ok() {
                self.actors.remove(&key);
            }
            combine_shutdown_results(stop, terminate)?;
        }
        let registration = self.registration.lock().await;
        if self.sealed.load(Ordering::SeqCst) {
            drop(registration);
            return Err(Self::reject_replacement_during_shutdown(&actor).await);
        }
        let generation = self
            .next_generation
            .fetch_add(1, Ordering::Relaxed)
            .checked_add(1)
            .ok_or_else(|| Error::ResourceLimit("engine generation exhausted".into()))?;
        let entry = SupervisedEngine {
            generation,
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
        if result.is_ok() {
            self.actors.remove(key);
        }
        result
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
        let targets: Vec<_> = self
            .actors
            .iter()
            .filter(|entry| entry.key().tab == tab)
            .map(|entry| (entry.key().clone(), entry.value().generation))
            .collect();
        self.terminate_targets(targets).await
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
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut stderr_reader = BufReader::new(stderr);
                let mut total = 0usize;
                while let Ok(Some(line)) = read_bounded_engine_line(&mut stderr_reader).await {
                    total = total.saturating_add(line.len());
                    if total > MAX_ENGINE_STDERR_BYTES {
                        error!("Engine stderr truncated after {MAX_ENGINE_STDERR_BYTES} bytes");
                        break;
                    }
                    error!("Engine stderr: {line}");
                }
            });
        }
        Ok(Self::new(
            Box::new(ChildUciIo {
                stdin,
                reader: BufReader::new(stdout),
                child,
                _executable: executable,
            }),
            deadlines,
        ))
    }

    pub async fn init_uci(&mut self) -> Result<(), Error> {
        self.send("uci").await?;
        self.wait_for("uciok", self.deadlines.uciok).await?;
        self.ensure_ready().await
    }

    pub async fn ensure_ready(&mut self) -> Result<(), Error> {
        self.send("isready").await?;
        self.wait_for("readyok", self.deadlines.readyok).await
    }

    pub async fn start_uci_configuration(&mut self) -> Result<(), Error> {
        self.send("uci").await
    }

    pub async fn next_configuration_line(&mut self) -> Result<Option<String>, Error> {
        timeout(self.deadlines.uciok, self.read_line())
            .await
            .map_err(|_| Error::EngineTimeout("waiting for uciok".into()))?
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
        let result = self.io.terminate(self.deadlines.quit).await;
        self.state = EngineState::Idle;
        result
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
}

impl EngineActor {
    #[cfg(test)]
    pub fn new(io: Box<dyn UciIo>, deadlines: EngineDeadlines) -> Self {
        Self::from_runtime(EngineRuntime::new(io, deadlines))
    }

    fn from_runtime(runtime: EngineRuntime) -> Self {
        let (tx, rx) = mpsc::channel(32);
        // Lifecycle and observability controls never sit behind bulk analysis
        // work. A flooded normal queue therefore cannot delay stop, kill or
        // log snapshots for a silent engine.
        let (control_tx, control_rx) = mpsc::channel(8);
        let task = tokio::spawn(engine_actor_loop(runtime, rx, control_rx));
        Self {
            tx,
            control_tx,
            task: Arc::new(Mutex::new(Some(task))),
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
    pub async fn logs(&self) -> Vec<EngineLog> {
        let (reply_tx, reply) = oneshot::channel();
        self.request_control(EngineCommand::Logs(reply_tx), reply)
            .await
            .unwrap_or_default()
    }
}

async fn engine_actor_loop(
    mut runtime: EngineRuntime,
    mut rx: mpsc::Receiver<EngineCommand>,
    mut control_rx: mpsc::Receiver<EngineCommand>,
) {
    let mut terminated = false;
    while let Some(command) = tokio::select! {
        biased;
        command = control_rx.recv() => command,
        command = rx.recv() => command,
    } {
        match command {
            EngineCommand::Init(reply) => {
                let _ = reply.send(runtime.init_uci().await);
            }
            EngineCommand::ConfigureStart(reply) => {
                let _ = reply.send(runtime.start_uci_configuration().await);
            }
            EngineCommand::ConfigureNext(reply) => {
                let _ = reply.send(runtime.next_configuration_line().await);
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
        let _ = runtime.terminate().await;
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
            atomic::{AtomicUsize, Ordering as AtomicOrdering},
            Arc,
        },
    };
    use tokio::sync::Mutex;

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
        async fn terminate(&mut self, _: Duration) -> Result<(), Error> {
            if let Some(delay) = self.terminate_delay {
                tokio::time::sleep(delay).await;
            }
            self.terminate_calls.fetch_add(1, AtomicOrdering::SeqCst);
            Ok(())
        }
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
        assert!(actor.logs().await.len() <= MAX_LOG_LINES);
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
            .expect("logs must preempt stdout wait");
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
