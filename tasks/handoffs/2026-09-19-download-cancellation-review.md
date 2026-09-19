# Plan-review record — f-20260906-07 (download cancellation), 2026-09-19/20

Durable record under rule 12a and `build` step 10. The plan itself lived at the git-ignored
`tasks/plans/2026-09-19-download-cancellation.md`; its complete `## Reviews` history is copied
below so this file alone recovers the run. Raw lens reports were retained at
`/tmp/build-13b31f81-b2df-4eac-b76a-05609dce6a23/r<N>/lens-*.txt` (ephemeral).

MANDATE (verbatim, fixed across all 25 rounds):


MANDATE (fixed, verbatim from the ledger title): "Download cancellation never reaches the download:
`cancel_download` has no renderer caller and the three download flows discard their job id." A user
who starts a database, puzzle-database or default-engine download from its card can press Cancel,
and the network and disk work actually stops: no artifact is published, and the progress bar clears.
A Cancel pressed at any moment after the button was clicked (including before the native command
has registered its download) must not be lost.

## Final plan (r25, approved)

## Approach

### O1 — Native download identity is native-minted, owner-bound and cancellable before it starts

Today the renderer passes `crypto.randomUUID()` as `job_id`; `DownloadRegistry::begin`
(`src-tauri/src/fs.rs:82-93`) calls `OperationRegistry::accept_download`, and
`cancel_download` → `cancel_accepted` (`src-tauri/src/infra/operations.rs:349`) returns
`Ok(false)` for an id not yet accepted. A Cancel that arrives before `begin` is therefore lost and
the download starts afterwards.

Adopt the existing reservation protocol (`prepare_reservation` / `claim_reservation` /
`cancel_reservation`, operations.rs:155-270, used by native reads and analysis):

* `OperationRegistry::prepare_download(owner) -> ticket` — a download-kind reservation in `reads`
  (same TTL `READ_RESERVATION_TTL`, same `MAX_NATIVE_READS` bound, same sealed refusal). The
  reservation records its kind explicitly, so a download ticket can be neither claimed nor
  cancelled as a read/analysis and vice versa (today kind is inferred from `tab`).
* `OperationRegistry::cancel_download(ticket, owner) -> Result<bool, Error>`:
  * reserved download owned by `owner` → transitions to a distinct **cancelled** reserved state
    (kept until claimed or until the reservation TTL purges it, so it stays bounded) → `Ok(true)`;
  * accepted download whose recorded owner is `owner` → its token is cancelled → `Ok(true)`;
  * unknown ticket (never issued, expired, or already finished and released) → `Ok(false)`;
  * ticket owned by another webview, or a read/analysis ticket → `Conflict`.
* `OperationRegistry::release_download(ticket, owner) -> Result<(), Error>` — removes a reserved or
  cancelled-reserved download ticket of `owner`; no-op for an unknown or accepted ticket; wrong
  owner/kind → `Conflict`. Command `release_download(id, window)`. Used only by the renderer's
  failure cleanup after its run settled (no claim can be in flight then), so a ticket never
  outlives the renderer operation that prepared it.
* `OperationRegistry::claim_download(ticket, owner, label, cap) -> OperationLease` — under ONE
  lock acquisition: a cancelled reservation is consumed and fails with `Error::Cancellation`;
  an unknown/expired ticket fails with a `Conflict` naming the unknown download reservation (NOT
  Cancellation — a genuine failure must stay visible); wrong owner / wrong kind / already claimed
  are `Conflict`s. On success the reservation is removed from `reads` and admitted into `accepted`
  with the same checks `accept_bounded_with_id(ticket, label, true, cap)` makes today (download
  cap, total cap, sealed, duplicate), recording `owner` on the entry. The lease is
  `LeaseKind::Accepted`: the work stays completion-owned (dropping the command future does not
  cancel it) and `wait_for_drain` / `seal_and_request_cancellation` treat it exactly as today.
* `DownloadRegistry`/`DownloadLease` (fs.rs:73-113) are pass-through shims (`let _ = self;`);
  delete them and call `state.operations.claim_download(...)` directly (removing
  `AppState::download_registry`, main.rs:746/781). **Each download claims its ticket exactly
  once, at the command boundary**: `download_file` and `download_lichess_games` (at the top of
  `download_lichess_games_runtime`, before fs.rs:1200-1217) claim and pass the claimed lease into
  `download_to_destination`, which no longer claims (it takes the lease instead of `job_id`);
  `download_engine_archive` (~1278) and `download_chess_com_games` (chesscom.rs:231) claim in
  their own bodies. The `uuid::Uuid::parse_str(&job_id)` checks (fs.rs ~1291, chesscom.rs:226)
  and in `download_to_destination_inner` (fs.rs:885-886) are deleted: `claim_download` rejects any
  ticket it did not mint. **The claim is each command's first fallible
  step** (before destination, URL, credential or timestamp validation — today Lichess and
  Chess.com validate first, fs.rs:1200-1217, chesscom.rs:227-231): a validation failure then
  releases the claimed lease on the ordinary drop path instead of leaving an unclaimed reservation,
  and every command's claim is reachable by the core tests (Command wiring, Tests). Delete
  `accept_download` and `cancel_accepted` once they have no caller (their tests move to the new
  API).
* Commands: new `#[tauri::command] prepare_download(window) -> String` in fs.rs;
  `cancel_download(id, window) -> bool` becomes owner-checked (`window.label()`). The four download
  commands — `download_file`, `download_engine_archive`, `download_lichess_games`,
  `download_chess_com_games` — take `window: tauri::WebviewWindow` (Specta-injected, so their
  generated argument lists do not change) and claim `job_id` with `window.label()` as owner.
  `prepare_download` and `release_download` are added to `collect_commands!`; `pnpm bindings:generate` regenerates the
  binding. Reserved downloads are dropped by the existing window-destroy `cancel_owner` path
  (main.rs:826-840) like every reservation; accepted downloads' window-destroy behaviour is
  now cancelled by the same path: `cancel_owner` also cancels the tokens of accepted downloads
  whose recorded owner is the destroyed webview (async-resource rule: cleanup on every exit path;
  the owner is recorded anyway for the cancel check).

### O2 — Completion linearizes cancellation: a published artifact is never reported as cancelled

The acknowledgement the UI acts on is the download's own terminal result, not the cancel
command: `run_native_operation` resolves only after the whole workflow (including publication)
finished. So:

* A download command that was cancelled before its commit point rejects with
  `Error::Cancellation` and has published nothing; the existing precommit hooks
  (`resolved.rs:312-320`, `:360-367`, and the `is_cancelled()` check before
  `publish_engine_archive_tree`, fs.rs:1336) are those commit points.
* **Cancellation before progress:** `download_to_destination_inner` (fs.rs ~908),
  `download_engine_archive` (fs.rs ~1305) and `download_chess_com_games_core` (chesscom.rs:290)
  check the token before `begin_progress`, so a
  download cancelled before it reached its progress lease never starts a progress generation
  (async-resource rule: cancellation is checked before use).
* **Native commit gate (linearizes cancel with publication):** an accepted download entry gains a
  `committing` flag. A gate handle created from the claimed lease (registry + ticket; the lease
  itself still moves into `run_native_operation`) offers `begin_commit()`: under the registry lock,
  if the token is cancelled → `Err(Cancellation)`, else set `committing` → `Ok`. Every publication
  step calls `begin_commit()` as its **last** fallible check before the artifact becomes visible:
  inside the precommit closures that today test `is_cancelled()` (`resolved.rs:312-320` for
  `atomic_replace_download_cancellable`, `:360-367` for
  `atomic_install_reserved_download_cancellable` — reached from the file, Lichess and Chess.com
  flows; the executor traces every download caller of both and of `install_staged_pgn_artifact`,
  fs.rs ~1060) and replacing the check before `publish_engine_archive_tree` (fs.rs:1336).
  `OperationRegistry::cancel_download` on an accepted entry that is `committing` returns
  `Ok(false)` and does **not** cancel the token. Hence `cancel_download → true` ⇔ no artifact of
  that download will be published; `false` ⇔ it was not cancelled (unknown ticket, or already
  committing). How the gate reaches the precommit closures (an extra parameter, or a precommit
  callback in place of the bare token for the download callers only) is the executor's choice; other
  callers of those path-authority functions keep their behaviour.
* **Invariant the executor must verify for every flow (download_file/db+puzzle, engine archive,
  lichess, chess.com):** no cancellation check placed *after* the artifact became visible converts
  a published artifact into `Cancellation`. If one exists, remove it or move it before the commit
  point. A cancel that arrives after the commit point therefore leaves the download's own
  post-commit result in place (success, or a typed post-commit outcome such as
  `CommittedDurabilityUncertain`, infra/fs.rs:637-650), never `Cancellation`.
* The renderer (O3) takes the download job's own settlement as the answer: rejected with
  `Cancellation` → the cancel took effect (nothing was published); resolved or rejected with any
  other error → it did not, and that result is shown as it is. `Cancellation` is only ever
  produced for the user's cancel: the deadline path (`await_staging_deadline`, fs.rs:40-52) cancels
  the same token but returns `EngineTimeout`, which stays a visible error.

### O3 — One renderer download-job registry, keyed by progress id, outliving the card

New module `src/utils/downloadJobs.ts` (one owner for all three cards — rule 11):

* `runDownloadJob(progressId, run: (ticket: string) => Promise<T>): Promise<T>` — registers an
  entry for `progressId` (a second start while one is registered is refused — the button is
  disabled while in progress anyway), obtains a ticket via `withDownloadTicket`, and calls
  `run(ticket)` unless a cancel was requested meanwhile (then throws `cancellationError()` from
  `@/platform/tauri` without invoking — the ticket is then released). If `prepareDownload` rejects
  while a cancel is pending, it throws `cancellationError()` (the job never started); a
  `prepareDownload` rejection **without** a pending cancel stays the real error. Every other
  settlement of `run` passes through unchanged. The entry is removed in `finally`, on every exit
  path, so the map is bounded by in-flight downloads. When `run` rejected, `withDownloadTicket`
  releases the ticket (`releaseDownload`, failure logged, not thrown), so a ticket prepared but
  never claimed (card setup failed before the download command) does not stay reserved until its
  TTL.
* `cancelDownloadJob(progressId): Promise<{ clearedGeneration: bigint | null }>` — marks the entry cancelled, awaits its ticket,
  awaits `tauri.cancelDownload(ticket)` (a rejection propagates; the boolean is not needed — e.g.
  `false` after a pre-invoke cancel already released the ticket), then always awaits the job's
  settlement, which is the single source of the answer:
  resolves if the job rejected with a cancellation error — exactly the predicate
  `errorUnlessCancelled(error) === null` (`src/platform/errors.ts:251`; pinned to the IPC display of
  `Error::Cancellation`, `d-20260830-05`) — 
  rejects with a distinguishable `DownloadCancelLostError` ("the download already completed")
  when the job **resolved**, and re-throws the job's own typed error when it failed for another
  reason (setup failure, `EngineTimeout`, a post-publication failure) — the cards notify only a
  failure of the cancel itself, because the job's own rejection is already reported by the
  `runUnlessCancelled` wrapper around it. No
  entry → rejects. If the ticket promise rejects while this cancel is pending, the job rejects with
  cancellation (`runDownloadJob` rule) and `cancelDownloadJob` resolves — the job never started.
* `useDownloadJob(progressId)` hook (same module) returns whether a job is registered for that id,
  via `useSyncExternalStore`, so a card passes `onCancel` only when a cancellable job exists.
  Because the registry is module-level, a card that is unmounted (the modals unmount children)
  and reopened still finds its job and can cancel it. After a renderer reload there is no entry,
  so no Cancel control renders (the native job is completion-owned and finishes; showing a Cancel
  that cannot act would be dishonest).
* **The job clears its own progress when it was cancelled, before releasing its entry.** A
  cancelled download that had started progress ends terminal `Cancelled` but keeps its last
  percentage (`progress.max(existing.progress)`, progress.rs:198), which `ProgressButton` still
  draws as a bar (`!completed && progress !== 0`, ProgressButton.tsx:96-104); so a clear is
  needed. `runDownloadJob`, when `run` settled with `Cancellation`, awaits
  `tauri.clearProgress(progressId)` (best-effort: a rejection is logged through
  `@/platform/native` `warn` and does not change the settlement) **before** its `finally` removes
  the registry entry, and keeps the generation that clear returns (`u64`, a fresh clock value:
  higher than every generation that existed at the clear, lower than any started after it,
  progress.rs:240-247, :95-98). Because a start for a registered `progressId` is refused, no retry can
  begin — let alone reach `begin_progress` — until that clear has completed natively: the id-only
  clear can never remove a retry's entry. `cancelDownloadJob` resolves after that. The download
  cards pass a new `ProgressButton` prop `clearOnCancel={false}` (default `true`, keeping
  ReportPanel's behaviour). `ProgressButton`'s `onCancel` type widens to
  `() => void | Promise<void | { clearedGeneration: bigint | null }>` (ReportPanel's
  `Promise<void>` still conforms). With `clearOnCancel={false}` `handleCancel` skips its own native `clear()`,
  sets `setInProgress(false)`, and:
  * with a `clearedGeneration` → calls `useProgress`'s new local `fence(generation)`: `floor =
    max(floor, generation)` and null the displayed item if its generation is lower. No IPC, no
    event needed, and no dependency on what is displayed: any late event or snapshot of the
    cancelled job (or earlier) is below the fence; a retry's items are above it.
  * with `null` → calls `useProgress`'s new local `discard()`: `floor = max(floor,
    displayed.generation + 1)` and null the display (no IPC). `null` now occurs only when the
    progress store itself is unusable (poisoned lock), because `clear_progress` no longer fails
    after it cleared (next bullet); at the moment `onCancel` resolves no retry can be displayed yet
    (the job's entry was released in the same settlement chain), so the displayed item belongs to
    the cancelled job or earlier.
* **`clear_progress` returns the generation whenever it cleared** (progress.rs:451-468): today it
  removes the entry and then propagates an emit failure, so the caller loses the generation of a
  clear that happened. The cleared-event emit becomes best-effort after the store clear (logged
  through `log::warn!`); the command fails only when the store clear itself fails, i.e. when the
  progress store's mutex is poisoned — a state in which `start`, every transition and
  `get_progress` fail as well, so no further progress can be produced or displayed for any id. Its callers
  (ReportPanel via `useProgress.clear`, AddEngine's failure cleanup, the job) only gain from
  always receiving the generation. A remounted card needs no fence: it subscribes before its
  snapshot, the entry is gone (snapshot `null`), and events emitted before the clear precede its
  registration on the same ordered event channel. A job cancelled before `begin_progress` has no entry; its
  clear is a harmless no-op.
* **No bar for a cancelled terminal item** (ProgressButton.tsx:96-104): the bar renders only when
  `!completed && progress !== 0` **and** the item is not a finished `Cancelled` item. A cancelled
  job's terminal item — which keeps its last percentage (progress.rs:198) — therefore shows the
  idle button with no bar even if the job's native clear was rejected. `Failed` and all other
  states render exactly as today. ReportPanel is unaffected in practice: it clears on cancel, so no
  cancelled item survives to render; where one would (a failed clear), hiding its bar is the same
  correction.
* **`cleared`-event guard** (useProgress.ts:64-68), for the remaining id-based clears
  (the job's cancel clear, ReportPanel, AddEngine's failure cleanup): the handler nulls the displayed item only if its
  generation is lower than the event's (a cleared event carries a fresh clock value, higher than
  every generation that existed at the clear, lower than any started after it), and
  `minimumGeneration` only ever rises (`max`). A delayed cleared event can then not erase a retry.
  Hook-local, no new state.
* **Subscribe, then snapshot** (useProgress.ts:27-52 vs :60-72): today `getProgress` is requested
  in parallel with the asynchronous listener registration (useTauriListener.ts:33-47), so an event
  emitted between the snapshot and the registration — e.g. the terminal `Cancelled` item right
  after a remount — is lost and a stale running snapshot stays on screen. `useTauriListener` gains
  an optional `onSettled(registered: boolean)` callback, called once when the registration
  resolves (`true`) or rejects (`false`), never after abort; `useProgress` keeps a `settled` state
  set from it (a failed registration still gets its snapshot, as today), and its snapshot effect runs on
  `[id, settled]` — only once settled, and again on every `id` change (the listener is
  registered once for all ids because `subscribeProgress` is stable, useProgress.ts:54-60), so the
  existing changing-id contract (useProgress.test.tsx:232-254, ReportPanel's changing progress id)
  holds. Every event after the snapshot is then observed, and the merge below orders snapshot and
  events.
* **Terminal wins** in `newestProgress` (useProgress.ts:7-25): a **finished** incoming item always
  replaces a non-finished current item of the same generation (today `incoming.progress >=
  current.progress` discards a terminal `Cancelled` item at progress 0 behind a running one).
* **Ordering invariant:** the job's `run` includes the card's own failure cleanup (AddEngine's
  catch-path `clearProgress`), and a job's entry is removed only after `run` settled, while a start
  for a registered `progressId` is refused — so that cleanup can never run after a retry started.
* **Cancel visibility:** a card passes `inProgress={inProgress || hasJob}` to `ProgressButton`, so
  after a remount during the window before native progress began, Cancel is still rendered for a
  registered job.
* **The job is the whole card operation**, not only the transfer: for the engine card it is
  download → `registerInstalledEngineHandle` → `getEngineConfig`. A Cancel after the archive was
  published loses the race (`cancelDownload` → `false`, the job resolves) and the engine ends up
  installed, which is the truthful outcome: the artifact exists.
* `ProgressButton.handleCancel`: `onCancel` rejects → keep the running UI (the job's own result
  then drives it); `ProgressButton` itself keeps swallowing that rejection (ProgressButton.tsx:63-66)
  so it cannot double-report what its caller already reported — the **cards** report it, exactly as
  ReportPanel does (ReportPanel.tsx:74-88): their `onCancel` catches, notifies through
  `notifyUnlessCancelled` when the failure is the cancel itself, and rethrows. Resolves → `clear()` unless `clearOnCancel` is `false`, then
  `setInProgress(false)`.

Card wiring — `src/components/databases/AddDatabase.tsx` (`DatabaseCard`),
`src/components/puzzles/AddPuzzle.tsx` (`PuzzleDbCard`), `src/components/engines/AddEngine.tsx`
(default-engine card) + `src/utils/engines.ts`:

* Each card wraps its download in `runDownloadJob(progressId, (ticket) => …)` and passes the ticket
  as `jobId` instead of `crypto.randomUUID()`; `onCancel` wired through one shared card helper (in `downloadJobs.ts`, so all three cards use the
  same shape — rule 11), not a bare call:

  ```ts
  // onCancel={hasJob ? () => cancelDownload(progressId, t("Common.Error")) : undefined}
  export async function cancelDownload(progressId: string, errorTitle: string) {
      try {
          return await cancelDownloadJob(progressId); // { clearedGeneration } reaches ProgressButton
      } catch (error) {
          // The job's own failure is already reported by the runUnlessCancelled wrapper
          // around runDownloadJob; only a failure of the cancellation itself is ours.
          if (!(error instanceof DownloadCancelLostError) && isCancelRequestFailure(error)) {
              notifyUnlessCancelled(errorTitle, error);
          }
          throw error; // ProgressButton keeps the running UI
      }
  }
  ```

  The helper returns the resolved outcome, so `clearedGeneration` reaches `ProgressButton`'s
  `fence`/`discard` branch. `cancelDownloadJob` rejects with exactly three distinguishable kinds:
  * `DownloadCancelLostError` — the job resolved (the cancel lost the race) **or** no job is
    registered for that id (nothing to cancel): notified by nobody; the UI shows the download's own
    outcome.
  * `DownloadCancelRequestError` (`isCancelRequestFailure`) — the `cancelDownload` IPC itself
    failed: notified by the card helper. A `prepareDownload` failure is **not** in this class: it
    belongs to the job, which settles as cancellation when a cancel is pending (O3 above) and
    otherwise reports the real error through the `runUnlessCancelled` wrapper.
  * the job's own typed error, re-thrown unchanged — notified by the `runUnlessCancelled` wrapper.

  A cancel IPC failure followed by a job failure is deliberately two notifications: they are two
  different facts (the cancel could not be delivered; the download then failed), and suppressing
  either would hide one of them.
  `installDefaultEngine(engine, progressId, ticket)` keeps both identities apart: `progressId`
  stays the progress id passed as `downloadEngineArchive`'s first argument (what the card's
  `useProgress` observes), and the prepared `ticket` becomes its `jobId`; after a cancelled download it never reaches
  `registerInstalledEngineHandle` / `getEngineConfig` (the await rejects).
* Error suppression wraps the job from **outside**: `runUnlessCancelled(title, () =>
  runDownloadJob(progressId, async (ticket) => …))` (and AddEngine's `try/catch` around
  `runDownloadJob`), so `run` itself rejects on failure and `runDownloadJob`'s ticket cleanup
  sees it. A cancellation-category rejection is suppressed there, so a user cancel shows no error
  notification.
* AddEngine's failure cleanup (`tauri.clearProgress(progressId)`, AddEngine.tsx:228-234) moves
  **inside** the job's `run`, is skipped for cancellation errors, stays best-effort (a cleanup
  rejection is logged through `@/platform/native` `warn`, never replacing the error), and rethrows
  the original error so it is still reported.
* Compatibility only (no new UI, outside acceptance): `src/utils/lichess/api.tsx:395` and
  `src/utils/chess.com/api.tsx:63` wrap their call in `withDownloadTicket((ticket) => …)`, because
  the native claim now requires a prepared ticket.
* **One ticket lifecycle (rule 11):** `withDownloadTicket(run)` is exported from
  `src/platform/tauri.ts` and implemented on the existing `withPreparedTicket`
  (tauri.ts:228-283) with `prepare: commands.prepareDownload`, `cancel: commands.releaseDownload`
  (its continuation-failure cleanup) and no signal; `logCleanupFailure`'s message is generalized
  from "native read cleanup" to name the operation kind. `runDownloadJob` uses
  `withDownloadTicket` and adds only the progress-id registry and the pre-invoke cancelled check
  inside its continuation; its own failure cleanup is therefore `releaseDownload`, not
  `cancelDownload`.

### Tests

Rust (`operations.rs`, `fs.rs`, `chesscom.rs`):
* registry: prepare→claim→drop leaves no entry; cancel before claim → `Ok(true)`, claim fails with
  `Cancellation`, no accepted entry; unknown/expired ticket claim → `Conflict` (not Cancellation);
  cancel after claim → `Ok(true)` and the token is cancelled; cancel after release → `Ok(false)`;
  foreign-owner claim and cancel refused; kind confusion refused both ways; download cap enforced
  through claim; sealing drops a reserved download and cancels an accepted one.
* flow: through `download_to_destination` with a lease claimed from a `prepare_download` ticket
  and a transport that yields a first chunk and then blocks until cancelled (or observes its
  stream being dropped): `cancel_download` mid-stream → the call rejects with `Cancellation`, the
  transport observed the stream stop, the destination has no artifact. Pre-claim cancellation
  (a ticket cancelled before the command → the transport saw zero requests) is exercised through
  the command cores (see "Command wiring" below), since the helper now receives an
  already-claimed lease. Plus engine archive: cancel before publish → nothing installed.
* commit gate: cancel racing publication at both sides of `begin_commit` — a test hook placed
  immediately after `begin_commit` (cancel there → `cancel_download` returns `false`, the call
  resolves `Ok`, artifact present) and immediately before it (cancel there → `true`, the call
  rejects `Cancellation`, no artifact) — for the regular-file path (`download_to_destination`,
  plain branch), the Lichess reserved branch of `download_to_destination` (fs.rs:982-1008,
  `register_pgn_artifact = true`), the Chess.com path (`install_staged_pgn_artifact`,
  chesscom.rs:375-379) and the engine-archive path.
* post-commit typed outcome with a concurrent cancel: a test hook right after `begin_commit`
  cancels (→ `false`) and a forced post-rename durability failure yields
  `CommittedDurabilityUncertain` (not `Cancellation`).
* registry: `release_download` removes a reserved and a cancelled-reserved ticket (capacity is
  returned), is a no-op for accepted/unknown, refuses a foreign owner.
* registry: a second `cancel_download` on an already-cancelled reservation is `Ok(true)` and
  idempotent (still bounded by TTL/`MAX_NATIVE_READS`).
* owner destroy: `cancel_owner(label)` cancels an accepted **download** of that owner (and not of
  another owner); a non-download accepted operation still survives (existing test at
  operations.rs:725-739 is updated to keep asserting that, and extended for downloads). The
  window-destroy log line in `main.rs:833-840` names downloads as well as reads.
* owner destroy also covers a **reserved** (pre-claim) download of the destroyed owner: it is
  dropped and a later claim fails.
* flow races (use the existing `infra/test_hooks.rs` hook points, as `chesscom.rs` tests do with
  `hold_atomic_point`, or add one keyed hook where none exists): cancel after claim but before
  `begin_progress` → `Cancellation` and no progress generation was started
  (assert on the progress store) — one assertion each for the file, Lichess (reserved branch,
  fs.rs:943-980), engine-archive and Chess.com paths. Engine archive: the same blocking-stream mid-transfer cancel as
  `download_to_destination` → `Cancellation`, stream stopped, nothing installed.
* Existing tests that call `download_to_destination` with literal UUIDs (e.g. fs.rs:3788-3800)
  claim a lease from a prepared ticket and pass the lease (one small test helper:
  prepare + claim); tests of the three self-claiming commands pass a prepared ticket. Every
  direct `DownloadRegistry` consumer moves to the registry API: `chesscom.rs:580` (test helper),
  `:824-827` and `:906-909` (cancellation tests), `fs.rs:2378-2386` (registry test, rewritten
  against `prepare/claim/cancel/release_download`) and `fs.rs:4311-4312` (cancellation transport);
  the source-scan tests in `main.rs` (~3678-3711) stay green (update the needles they assert if
  the `download_registry.begin` spelling they check changes — keep what they prove).

Vitest:
* `src/utils/downloadJobs.test.ts` against the real module with `@/platform/tauri` mocked:
  run passes the prepared ticket; cancel before prepare resolves → run never invoked, job rejects
  with cancellation, cancel resolves; cancel mid-run → `cancelDownload(ticket)` called, cancel
  resolves after the job rejects with cancellation; job resolves despite cancel → cancel rejects;
  `cancelDownload` rejects → cancel rejects; prepare rejects with cancel pending → cancellation;
  after the delayed prepare resolves, `cancelDownload(preparedTicket)` is called; a rejected `run`
  leads to `releaseDownload(ticket)` (P26), never to `cancelDownload`; a cancel requested before
  invoke resolves even though `cancelDownload` then answers `false`;
  a pending cancel whose prepare rejects resolves while the job rejects with cancellation;
  entry removed on every exit path; a second `runDownloadJob` for a registered id is refused;
  hook reflects registration across unmount/remount.
* `ProgressButton.test.tsx`: successful `onCancel` → `clear` called and `setInProgress(false)`;
  rejecting `onCancel` → no clear, no `setInProgress(false)`.
* Card tests (`AddDatabase.test.tsx`, `AddPuzzle.test.tsx`, `AddEngine.test.tsx`) with the real
  `downloadJobs` module and a mocked facade: the download command receives the prepared ticket as
  `jobId`; Cancel is offered while the job is registered and calls `cancelDownload` with that
  ticket; no error notification on the resulting cancellation; the job is registered (Cancel
  rendered, `prepareDownload` called) **before** the card's workspace/destination IPCs resolve,
  so the window between the click and the download command is cancellable; a setup IPC that rejects
  after Cancel is reported as that error (the cancel did not take effect) and the UI keeps its
  state; a download cancelled mid-transfer shows no bar and no notification. Engine card: `getEngineConfig` rejecting after a Cancel that answered `false` shows the error. `engines.test.ts`:
  `installDefaultEngine` passes the ticket and calls neither `registerInstalledEngineHandle` nor
  `getEngineConfig` after a cancelled download; `src/utils/engines.controller.test.ts:160-205`
  (another `installDefaultEngine` consumer) is updated to the ticket-taking contract and mocks
  `prepareDownload`/`releaseDownload`; `AddEngine.test.tsx`: Cancel while
  `getEngineConfig` is pending → Cancel is rendered, `cancelDownload` is called with the job's ticket
  and returns `false` (race lost), the engine is added, no clear; a card remounted during a
  registered job renders Cancel; a failure cleanup whose `clearProgress` rejects logs a warning and
  the original error is still reported. `ProgressButton.test.tsx`: with `clearOnCancel={false}` a
  resolved `onCancel` does not call `clear` and does `setInProgress(false)`; a rejecting
  `onCancel` keeps the running UI and is not reported by `ProgressButton` itself; a terminal
  `Cancelled` item at progress 50 renders no bar; a `Failed` item, a running item at 50 and a
  succeeded item under `completeOnProgressSuccess={false}` render as today. The card tests assert
  that a failing `cancelDownload` is notified once by the card, and that a job failure after Cancel
  is notified once by the `runUnlessCancelled` wrapper, not twice, and that a lost race
  (`DownloadCancelLostError`, including the no-registered-job case) is notified by nobody — each
  asserted on the error class, not merely on "rejects" — and that the helper returns the
  `clearedGeneration` outcome to its caller. One combined-race case: the `cancelDownload` IPC rejects and the
  job then fails with its own typed error — the card notifies the first, the `runUnlessCancelled`
  wrapper the second, each exactly once. `useProgress`:
  `fence(g)` nulls a displayed item below `g`, rejects a later event and a later snapshot below
  `g` even when nothing was displayed, and shows an item at or above `g`; `discard()` hides the
  displayed generation and still shows a higher one; with clearOnCancel={false} `ProgressButton`
  calls `fence` for an outcome with a generation and `discard` for a null one; `progress.rs`:
  `clear_progress` gets its own emitter-injected core (`clear_progress_with(store, id,
  emit_cleared)`, the shape `update_progress_with_emitter` has at :293-300, since the command
  emits directly today at :451-468); with a failing emitter it still returns the generation, and
  the command shell forwards to it (source-scan pin); `cancelDownloadJob` resolves with the job's cleared generation; a rejected listener registration
  still requests the snapshot. The three card tests
  assert `clearOnCancel={false}` reaches `ProgressButton`. `downloadJobs.test.ts`: a job settling
  with `Cancellation` awaits `clearProgress(progressId)` before its entry is released (a
  `runDownloadJob` for the same id started while that clear is pending is refused); a rejecting
  clear is logged and the job still settles as cancelled (the card test then shows no bar for the
  terminal item); a job settling any other way does not
  clear.  `useTauriListener`:
  `onSettled(true)` fires once after registration, `onSettled(false)` once after a rejected
  registration, neither after an abort. `useProgress.test.tsx`:
  the snapshot is requested only after the listener registered, and again for a changed id;
  a delayed `cleared` event lower than the displayed generation does not erase
  it and does not lower the floor; an event emitted before the
  snapshot resolves is not lost (terminal `Cancelled` then stale running snapshot → shows the
  terminal item); a terminal item at progress 0 replaces a running item of the same generation at
  progress 50; existing clear behaviour unchanged. `src/utils/lichess/api.test.ts` and a new `src/utils/chess.com/api.test.ts`:
  `downloadLichess` / `downloadChessCom` pass the ticket from `prepareDownload` as `jobId`, and a
  rejected download command leads to `releaseDownload(ticket)`. `downloadJobs.test.ts` also:
  `cancelDownloadJob` with no entry rejects; a job that fails with a non-cancellation error
  **without** a prior cancel rejects it; a job that rejects with a non-cancellation error after a
  cancel (setup IPC failure, `EngineTimeout`, post-publication failure) keeps its typed error and
  `cancelDownloadJob` rejects; a `prepareDownload` rejection without a cancel stays the real error. `tauri.test.ts`: `withDownloadTicket` prepares, passes the ticket, releases on rejection,
  does not release on success.
* Command wiring (commands take the concrete Wry `AppHandle`/`WebviewWindow`, fs.rs:720-721,
  chesscom.rs:224-225, so they cannot be registered on `MockRuntime`; round 9, P47):
  * **registration** of `prepare_download`, `release_download` and `cancel_download` is proven by `pnpm bindings:check` (the checked-in binding is exported from
    the production builder at main.rs:2243) plus `tsc`, because the renderer facade calls the
    generated `commands.prepareDownload` / `releaseDownload` / `cancelDownload`;
  * **owner threading:** each of the seven commands (`prepare_download`, `cancel_download`,
    `release_download`, and the four downloads) is a thin shell that passes `window.label()` to a
    runtime-generic core taking `owner: &str` (the download cores already exist or are the claim
    call itself). A source-scan test in the existing style (main.rs:3660-3711, `body_at_indent`)
    pins that each command body passes `window.label()` exactly once to its core/claim and
    contains no second claim;
  * **behaviour through the cores** (each test uses the same code the command calls): foreign
    owner → `Conflict`; a cancelled ticket → `Cancellation` with zero transport requests; a fresh
    ticket with an input rejected after the claim → not an owner/claim conflict **and** the ticket
    is consumed; a **valid** `download_file` core run against the blocking fake transport
    (integrity satisfied the way existing signed-download tests do), cancelled mid-stream through
    the cancel core → `Cancellation`, stream stopped, no artifact, terminal `Cancelled` progress;
    `release_download` core: foreign owner refused, owner removes the reservation.
* Engine-archive cancel tests additionally assert the terminal `ProgressState::Cancelled` item.
* **claim-first per command:** for each of the four download cores, a **cancelled** ticket combined
  with an input that the command's own validation would reject (bad destination / timestamp /
  credential handle / directory name) yields `Cancellation`, not the validation error — proving
  the claim precedes validation.

## Decisions and trade-offs

* **(a) ProgressButton.onCancel → native download cancel, not (b) `clear_progress` cancelling the
  download.** Precedent: `ReportPanel.tsx:74-88` (`onCancel` → `tauri.cancelAnalysis`, then
  `ProgressButton` clears). A progress id is a display identity (one per card, reused across
  downloads); making `clear_progress` cancel work would couple the display store to operation
  ownership. Rejected (b).
* **Native-minted reservation over a renderer-UUID tombstone.** A tombstone set keeps
  renderer-chosen ids and needs its own bound for ids that never arrive; the reservation protocol
  already exists, is bounded, owner-bound and TTL'd. Rejected: tombstone; rejected: renderer-only
  flag checked before invoking (the IPC-in-flight window remains).
* **Claim moves the entry from `reads` into `accepted`**, keeping completion-owned semantics, the
  download cap and drain accounting. Rejected: a download-kind active read entry.
* **Native commit gate adopted (round 3, reversing the r2 disposition of P3):** three lenses over two
  rounds traced that a cancel between the last precommit check and the rename (`infra/fs.rs:833-873`)
  or before `publish_engine_archive_tree` makes `cancel_download` report success while the artifact
  is still published — contrary to the mandate's "no artifact published". The gate makes
  `cancel_download`'s answer exact. Rejected: terminal-result-only linearization (r2).
* **The job clears its own progress under its registry entry; subscribe-then-snapshot** (rounds
  14-16, superseding the generation-bound `clear_progress`, `ClearOutcome` and per-id floor store
  adopted in rounds 3-13, and the round-15 local `discard()`). Rounds 3-16 kept finding races in
  id-based clearing (P16, P46, P53, P55, P63, P66, P70) because each fix added state. Root trace:
  (1) the retry race exists only when a clear can be processed after a retry began — performing
  the clear inside the job, before the registry entry that refuses retries is released, makes
  that impossible without any generation state; (2) the stale-snapshot class came from requesting
  the snapshot before the listener was registered. Rejected: the generation-bound clear family
  (unbounded floor retention for per-report ids, `Kept` gives no floor, clear/emit failure modes);
  a local-only `discard()` (cannot fence when no item is displayed, and a remounted hook loses it;
  round 16); relying on "terminal at 0" (false — progress.rs:198 keeps the maximum).
* **Settlement is the answer, no reclassification** (round 14, superseding the r12-r13
  "effective cancel" and "cancellation wins" rules): the deadline path cancels the same token and
  must stay `EngineTimeout` (fs.rs:40-52), so a token-wide rewrite would hide real timeouts; and a
  failure that surfaces after a user's cancel is shown as it is. Only a real `Cancellation` from
  native, a pre-invoke cancel, or a `prepareDownload` failure with a cancel pending count as
  cancelled.
* **No `verify:app` download scenario and no MockRuntime command registry:** the driver has no
  download flow (new tooling, rule 6d, and live signed remote artifacts), and the production
  commands are concrete-runtime so they cannot be registered on `MockRuntime` without
  genericizing the command surface. Registration is proven by `bindings:check` + `tsc`, owner
  threading by source-scan pins on thin command shells, behaviour through the generic cores.
* **Renderer reload** empties the job registry while a native download continues; this is the
  general "renderer reload orphans native operation handles" class, not specific to downloads,
  and is filed as its own finding rather than solved here.
* **Module-level renderer job registry keyed by progress id**, not a card-local AbortController
  (lost on modal unmount — round-1 finding) and not an AbortSignal on the facade (abort is
  fire-and-forget, so the UI could clear before the native cancel was acknowledged — round-1
  finding). After a renderer reload no Cancel is offered; accepted as the honest state.

## Risks / open questions

* Four commands change the semantics of `job_id`; every renderer caller must move in the same
  commit, or downloads fail at runtime (the type is `string`, so tsc cannot catch a missed
  caller). `grep -rn "downloadFile\|downloadEngineArchive\|downloadLichessGames\|downloadChessComGames" src e2e`
  must show only migrated callers.
* e2e mock IPC (`e2e/`) may implement download commands; grep and add `prepare_download` if any
  spec reaches a download.
* Coverage ratchets: new code needs the tests above; the shrink allowance covers deletions.

## Not part of this task

* Cancel UI for Lichess/Chess.com account downloads (their callers only migrate to prepared tickets).
* `set_file_as_executable` (`f-20260906-08`), the command-consumer gate (`f-20260906-12`).
* Aborting a download when its modal/card unmounts.

## Phases

One phase — the Rust contract change and every renderer caller must land in one commit (see
Risks); splitting would leave a committed state in which every download fails at runtime.

### Phase 1 — download reservations end to end
* Files: `src-tauri/src/infra/operations.rs`, `src-tauri/src/fs.rs`, `src-tauri/src/chesscom.rs`,
  `src-tauri/src/main.rs`, `src-tauri/src/infra/path_authority/resolved.rs` (+ `mod.rs` as needed), `src/hooks/useProgress.ts`, `src/platform/useTauriListener.ts`, `src/components/common/ProgressButton.tsx`, `src-tauri/src/progress.rs` (`clear_progress` only), `src/bindings/generated.ts` (regenerated only), `src/components/databases/AddDatabase.tsx`, `src/components/puzzles/AddPuzzle.tsx`,
  `src/components/engines/AddEngine.tsx`, `src/utils/engines.ts`, `src/utils/downloadJobs.ts` (new), `src/platform/tauri.ts`, `src/utils/lichess/api.tsx`,
  `src/utils/chess.com/api.tsx`, every test file named under Tests (`downloadJobs.test.ts` new, `tauri.test.ts`, `useProgress.test.tsx`, `ProgressButton.test.tsx`, `AddDatabase.test.tsx`, `AddPuzzle.test.tsx`, `AddEngine.test.tsx`, `engines.test.ts`, `engines.controller.test.ts`, `lichess/api.test.ts`, `chess.com/api.test.ts` new, `src/platform/useTauriListener.test.tsx`, plus the Rust tests in `operations.rs`, `fs.rs`, `chesscom.rs`, `progress.rs`, `main.rs`), and any `e2e/` IPC mock that answers download commands.
* Touches: concurrency (operation registry), API contract (Specta commands), path-authority
  adjacent download code. Role: `sensitive`.
* PROOF (each command's exit status must be 0; no pipes):
  `pnpm gates:contract:check`,
  `cargo test --manifest-path src-tauri/Cargo.toml --locked`,
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`,
  `pnpm bindings:check`, `pnpm exec tsc --noEmit`, and
  `pnpm exec vitest run src/utils/downloadJobs src/hooks src/platform src/components/databases src/components/puzzles src/components/engines src/utils/engines src/utils/lichess src/utils/chess.com src/components/common/ProgressButton`.

## Reviews

### Round 1 (r1 snapshot = $RUN_TMP/plan-r1.md; 9 lenses on codex: plan[review-plan], minimalism, ipc-contract, tauri-security, engine-protocol, correctness, root-cause, error-handling, tests [sensitive]; wall ~20 min)

Raw verdicts: plan REVISE · minimalism REVISE · ipc-contract REVISE · tauri-security REVISE ·
engine-protocol APPROVED · correctness REVISE · root-cause REVISE · error-handling REVISE · tests REVISE.
Raw reports retained at `$RUN_TMP/lens-*.txt` (run dir /tmp/build-13b31f81-…).

Issues (stable IDs):
* **P1** card-local controller lost on modal unmount; reopened Cancel only clears the bar
  (error-handling b1, root-cause b1, plan b2). **Fix** → O3 module-level registry keyed by progress id + hook. Evidence: AppModal unmounts children (plan lens, AppModal.tsx:15-21).
* **P2** abort is fire-and-forget; bar clears before native cancel is acknowledged, a failed cancel
  IPC leaves the download running (error-handling b2, ipc-contract b1). **Fix** → O3 `cancelDownloadJob` awaits `cancelDownload` then the job's settlement; facade AbortSignal design withdrawn.
* **P3** publication race: cancel after the last check still publishes (error-handling b3,
  root-cause b2, tauri-security b1, plan b3). **Fix** → O2: acknowledgement = job terminal result; invariant that no post-commit check turns a publication into Cancellation. Rejected native commit-barrier state (Decisions).
* **P4** prepare fails with abort pending → error shown (error-handling s1). **Fix** → O3 runDownloadJob.
* **P5** unknown ticket must not map to Cancellation (error-handling s2, correctness s1). **Fix** → O1 distinct cancelled state; unknown → Conflict.
* **P6** `logCleanupFailure` message says native read (error-handling s3). **Withdrawn** with the facade design (P2).
* **P7** Lichess/Chess.com migration exceeds mandate (engine-protocol nit, ipc-contract s1,
  root-cause nit). **Skip** — required compatibility: claim now requires a prepared ticket; stated as outside acceptance.
* **P8** three duplicated controller wirings → extract (minimalism s1). **Fix** → O3 single module (rule 11).
* **P9** `DownloadRegistry` pass-through shim (minimalism s2). **Fix** → O1 delete shim (same area, rule 4b).
* **P10** proof pipe masks exit / multiple filters (tests b2, plan b5). **Fix** → PROOF without pipes, full `cargo test`.
* **P11** tests do not prove in-flight stop / publication skip (tests b1, root-cause s1). **Fix** → Tests: blocking-stream transport mid-stream cancel, no artifact.
* **P12** no real IPC/product test (tests b3, plan b6). **Fix** → verify:app scenario in step 7, contract gate in proof; unavailability recorded, never a pass.
* **P13** ProgressButton cancel→clear not asserted (tests s1). **Fix** → Tests.
* **P14** engine: test must also forbid registration after cancelled download (plan b4). **Fix** → Tests.
* **P15** engine finalization after download is uncancellable while Cancel is visible (correctness b1). **Fix** → O3 job = whole card operation; late cancel loses the race truthfully.
* **P16** AddEngine catch `clearProgress` can clear a retry's bar (correctness b2). **Fix** → O3 ordering invariant.
* **P17** worker starts progress after cancellation (correctness b3). **Fix** → O2 cancellation-before-progress check.
* **P18** round-1 packet lacks history/revision (plan b1). **Skip** — round 1 has no prior history; round 2 packet carries it.

### Round 2 (candidate r2; same 9 lenses; wall ~15 min)

Raw verdicts: plan REVISE · minimalism APPROVED · ipc-contract REVISE · tauri-security REVISE ·
engine-protocol REVISE · correctness REVISE · root-cause REVISE · error-handling REVISE · tests REVISE.
Closed by all reporting lenses: P2, P4, P5, P8, P9, P10, P13, P14. P1 closed except the remount
visibility gap (now P20). Reports retained at `$RUN_TMP/lens-*.txt` (r2).

New / reopened:
* **P16 (reopened)** AddEngine catch `clearProgress` runs after entry removal (error-handling, ipc-contract, plan, engine-protocol). **Fix** r3 → cleanup inside the job, skipped for cancellation; dispatch-order argument for ProgressButton's clear; concurrent-start test.
* **P19** double claim: `download_file`/lichess delegate to `download_to_destination`, which claims (correctness b1, ipc-contract b1, plan b1). **Fix** r3 → claim exactly once at today's claim sites; helper takes owner.
* **P20** Cancel invisible after remount before native progress began (root-cause b2, engine-protocol b2). **Fix** r3 → `inProgress || hasJob`.
* **P21** accepted downloads survive owner webview destroy (plan b4). **Fix** r3 → `cancel_owner` cancels owner's accepted downloads.
* **P17 (extended)** chess.com `begin_progress` before check (correctness s1, engine-protocol s1, error-handling s1). **Fix** r3; no-progress-generation assertion (tests s1).
* **P3 (still open for root-cause, tauri-security, tests)** cancel between precommit check and rename publishes. **Disposition:** native barrier rejected with reasoning (O2 "Why no additional native commit barrier"): outcome is indistinguishable from a cancel a moment after rename; the invariant excludes the inverse lie. **Fix** the test gap: race tests via test hooks (after commit point → Ok + artifact; before claim/progress → Cancellation). Needs closure check in r3.
* **P11 (extended)** engine archive in-flight cancel test (tests b1). **Fix** r3.
* **P12 (reopened)** verify:app has no download scenario (tests b3). **Fix** r3 → MockRuntime IPC test for registration + window injection; verify:app scenario rejected (rule 6d).
* **P15 (test gap)** cancel during engine finalization untested (tests s5). **Fix** r3 → AddEngine test.
* **P22** renderer reload leaves no Cancel while the native job runs (engine-protocol b2). **Defer** → filed as its own finding (general reload-orphans-handles class; different area).
* **P23** proof omits full push gates (plan b3). **Skip** — phase proof is the per-phase oracle; the complete gate set runs in build step 8 per the push skill.
* **P24** cancelled reservation purged after 60 s TTL → Conflict (plan s1). **Skip** — prepare and claim both run inside `runDownloadJob` with only the card's two short workspace IPCs between; a 60 s gap is itself a failure worth surfacing.
* **P25** tests are after-only, no base reproduction (root-cause s1). **Skip** — the new API does not exist on base; the base defect is established by reading (cancel_accepted → Ok(false) for unknown id; no renderer caller), recorded in the finding.
* **P7** scope note repeated (ipc-contract s1, root-cause nit): remains **Skip**; compatibility plumbing, now asked to carry caller tests — covered by grep-migration risk + existing api tests.

### Round 3 (candidate r3; 8 lenses — minimalism approved in r2; wall ~17 min)

Raw verdicts: plan REVISE · ipc-contract REVISE · tauri-security REVISE · engine-protocol REVISE ·
correctness REVISE · root-cause REVISE · error-handling REVISE · tests REVISE.
Closed by all reporting lenses: P11, P20. Reports retained at `$RUN_TMP/lens-*.txt` (r3).

* **P3 (recurring, 3rd round)** — rule 12a: traced the execution path instead of another broad
  fan-out: the precommit closure (`resolved.rs:360-367`) is followed by a non-cancellable rename
  (`infra/fs.rs:833-873`); the engine path checks at `fs.rs:1336` then publishes. Evidence
  sufficient; the r2 disposition is **reversed** → **Fix** r4: native commit gate (O2). No focused
  architecture judgment needed since the arbiter adopts the lenses' position.
* **P16 (reopened, id-only clear)** (correctness b2, engine-protocol b1, ipc-contract b1, tests b4). **Fix** r4 → generation-bound `clear_progress` + tests.
* **P12 (reopened)** MockRuntime test must invoke a download command (error-handling b1, ipc-contract b2, tests b2). **Fix** r4 → three IPC invocations of `download_file`.
* **P19 (test gap)** public-command double claim untested (tests b6). **Fix** r4 → covered by P12 (b)/(c).
* **P21 (test gap)** owner-destroy accepted download untested; existing test asserts survival (plan b1, error-handling s3, ipc-contract s3, tests s7). **Fix** r4; log message (error-handling s2) **Fix**.
* **P15 (test gap)** finalization cancel must assert Cancel offered + native cancel attempted (tests b3). **Fix** r4.
* **P17 (test gap)** per-path no-generation assertions (tests s5). **Fix** r4. Atomicity of check vs `begin_progress` (correctness s3): **Skip** — a cancel racing that check still terminates its own generation as Cancelled; with the generation-bound clear and one job per progress id no other job's bar is affected.
* **P26** prepared-but-unclaimed ticket stays reserved on card failure (plan s1, error-handling s2). **Fix** r4 → `finally` cancels on failure. Exhaustion of 128 slots within 60 s by clicking: not reachable; no further bound work.
* **P27** Lichess/Chess.com caller tests missing (tests s8). **Fix** r4.

### Round 4 (candidate r4; 9 lenses; wall ~20 min)

Raw verdicts: plan REVISE · minimalism REVISE · ipc-contract REVISE · tauri-security REVISE ·
engine-protocol REVISE · correctness REVISE · root-cause REVISE · error-handling REVISE · tests REVISE.
Closed by all reporting lenses: P12 (except ipc-contract's four-command breadth, below), P15, P17,
P19 (ipc-contract breadth aside), P21, P27. P3 mechanism closed by correctness, engine-protocol,
error-handling, tauri-security, minimalism; open only for stale Decisions text and the
reserved-artifact race test. Reports at `$RUN_TMP/lens-*.txt` (r4).

* **P28** Decisions still carried the rejected terminal-result bullet (minimalism, ipc-contract, plan, root-cause, error-handling). **Fix** r5 → removed.
* **P29** `isCancellation` does not exist (plan b1). **Fix** r5 → `errorUnlessCancelled(error) === null`.
* **P16 (renderer side + `None` wildcard)** (correctness b1, engine-protocol b1/s1, error-handling b1, ipc-contract b2, plan b4, root-cause b2). **Fix** r5 → `None` = terminal-only; `Option<u64>` result; renderer resets only on `Some`; cleared-event generation guard; tests.
* **P30** AddEngine cleanup location contradictory (plan b5, ipc-contract b2). **Fix** r5 → inside the job, terminal-only clear.
* **P26 (extended)** Lichess/Chess.com prepared tickets leak on pre-claim failure (error-handling s1, ipc-contract s2, plan b3, root-cause s1); suppression inside run hides failure (root-cause s2); cleanup untested (plan b8, tests s3). **Fix** r5 → `withDownloadTicket`, suppression outside, tests. Second cancel semantics (ipc-contract s1): **Fix** → idempotent `Ok(true)`, TTL-bounded.
* **P31** cancel pending while prepare rejects leaves bar (engine-protocol b2). **Fix** r5.
* **P3 (tests)** reserved-artifact commit-gate race (plan b6, tests b2). **Fix** r5.
* **P12 breadth** four-command IPC coverage (ipc-contract b3). **Fix** r5 → every command reachable under MockRuntime, others via direct claim-label tests named in the report.
* **P32** `src/hooks` missing from proof (plan b7). **Fix** r5.
* **P33** pre-registration cancel must assert `cancelDownload(preparedTicket)` (tests b1). **Fix** r5.
* **P34** path-authority same-inode symlink relocation (tauri-security b1). **Skip** — pre-existing, already tracked as `f-20260918-02`; unrelated to cancellation.
* **P7** scope nits (engine-protocol, root-cause): remains **Skip** (compatibility plumbing).

### Round 5 (candidate r5; 8 lenses; wall ~17 min)

Raw verdicts: plan REVISE · minimalism REVISE · ipc-contract REVISE · engine-protocol REVISE ·
correctness REVISE · root-cause REVISE · error-handling APPROVED · tests REVISE.
Closed by all reporting lenses: P28, P29, P30, P31, P32, P33. P3 closed except the Lichess
reserved branch; P12 closed except ipc-contract's unconditional-breadth demand. Reports at `$RUN_TMP/lens-*.txt` (r5).

* **P16 (renderer ack/floor)** late `Some` ack resets a retry; non-monotonic floor (correctness b1/b2, engine-protocol b1). **Fix** r6 → monotonic `max` floor, generation-guarded null for ack and event. Trace: useProgress.ts:64-68 sets `minimumGeneration = payload.generation` unconditionally; :77-80 same after clear.
* **P36** clear emit failure after state change fails the command (error-handling s1). **Fix** r6 → best-effort emit, logged.
* **P3 (Lichess)** Lichess publishes through `download_to_destination`'s reserved branch, not `install_staged_pgn_artifact` (plan b1). Trace: fs.rs:1218-1230 → :982-1008. **Fix** r6 → race test on that branch.
* **P12 (breadth)** four commands unconditionally through IPC (ipc-contract b2). **Fix** r6 → claim first in each command (also removes pre-claim leak, P26), all four invoked.
* **P26 (retention)** cancel keeps a cancelled reservation until TTL (root-cause b1); caller-level cleanup untested (tests b1). **Fix** r6 → `release_download` + claim-first + caller tests.
* **P37** `withDownloadTicket` duplicates `withPreparedTicket` (minimalism s1). **Fix** r6 → built on it.
* **P38** `cancelDownloadJob` no-entry / non-cancellation-failure tests (tests s2). **Fix** r6.
* **P35** two webviews share a URL-derived progress id (ipc-contract b1). **Skip** — the app has exactly one webview: `tauri.conf.json:67-72` declares one window and production code builds no other (`WebviewWindowBuilder` appears only in a main.rs test).
* **P39** engine-lifecycle claims in `engine/process.rs` / `chess.rs` (engine-protocol b2, b3, s4-s6): pre-existing, outside this plan's files and area. **Skip** — all five already tracked: `f-20260911-02` (unscoped Stop), `f-20260911-03` (stop deadline), `f-20260914-23` (`kill_engine` reserved generation), `f-20260914-35` (config probe), and the `PendingActorGuard` entry at `tasks/findings.md:9062`. A duplicate filed by mistake was withdrawn from the inbox before merge.
* **P40** correction packet lacked per-issue trace (plan b2). **Fix** r6 → traces cited per issue above.

### Round 6 (candidate r6; 9 lenses; wall ~16 min)

Raw verdicts: plan REVISE · minimalism REVISE · ipc-contract REVISE · tauri-security APPROVED ·
engine-protocol REVISE · correctness REVISE · root-cause REVISE · error-handling REVISE · tests REVISE.
Closed by all reporting lenses: P3, P37, P38, P40. Reports at `$RUN_TMP/lens-*.txt` (r6).

* **P41** `release_download` not registered (correctness b2, error-handling b1, ipc-contract b1, plan b1). **Fix** r7.
* **P26 (text)** stale `cancelDownload(ticket)` test line contradicts `releaseDownload` (error-handling s2, ipc-contract b2, plan b2, tests b2, minimalism s1). **Fix** r7.
* **P12 (Lichess claim placement)** claim inside `download_to_destination` is after Lichess validation fs.rs:1200-1217 (correctness b1, engine-protocol b1, ipc-contract b3). **Fix** r7 → claim at command boundary, lease threaded into the helper; (c) asserts the ticket was consumed (plan b3, tests b3).
* **P42** pre-invoke cancel: ticket released before `cancelDownload` → `false` → reject (error-handling s1). **Fix** r7 → boolean informational; settlement decides.
* **P16 (tests)** floor monotonicity anchor (plan b4, tests s4). **Fix** r7.
* **P36 (tests)** emit-failure test (plan b5, tests b1). **Fix** r7 → emitter seam. **P43** `begin_progress` emit failure leaves a running entry (error-handling s3): same function family, **Fix** r7 (best-effort).
* **P44** `release_download` through IPC, reserved owner-destroy (tests s5, s6). **Fix** r7.
* **P45** duplicate after-commit race assertion (minimalism nit). **Fix** r7 → removed.
* **P46** remount + early cancel: stale `getProgress` recreates running bar (root-cause b1). **Skip** — trace: `newestProgress` (useProgress.ts:7-25) keeps a finished item over a non-finished one of the same generation, and the download's terminal Cancelled item is emitted natively (`report_download_error`) for the same generation, so whichever of the stale load and the terminal event arrives second, the finished Cancelled item wins; with no displayed item `clear()` sends nothing and `setInProgress(false)` runs.

### Round 7 (candidate r7; 8 lenses; wall ~15 min)

Raw verdicts: plan REVISE · minimalism APPROVED · ipc-contract APPROVED ·
engine-protocol REVISE · correctness APPROVED · root-cause REVISE · error-handling APPROVED · tests REVISE.
Closed by all reporting lenses: P12, P16, P26, P36, P41, P42, P43, P44, P45.

* **P46 (reopened — r6 Skip withdrawn)** (engine-protocol b1, root-cause b1, error-handling s1). My r6 trace was wrong: `newestProgress` line 24 keeps the higher-progress running item over a same-generation terminal item at progress 0, and a listener registered after the terminal event misses it. **Fix** r8 → terminal-wins in `newestProgress`; `clear` sends `None` with no item; tests.
* **P47** no valid end-to-end IPC download cancel (tests b1). **Fix** r8.
* **P48** redundant UUID-parse checks (minimalism nit). **Fix** r8.
* **P50** flow test still passes a ticket to the helper that now takes a lease (plan b1). **Fix** r8 → helper tests pass a lease; pre-claim cases go through the public command.
* **P49** `install_staged_pgn_artifact` reservation leak on `resolve` failure (error-handling s2): pre-existing, independent of cancellation. **Defer** → filed (native-fs, lens).

### Round 8 (candidate r8; 7 lenses; wall ~15 min)

Raw verdicts: plan REVISE · minimalism APPROVED · engine-protocol APPROVED · correctness APPROVED ·
root-cause APPROVED · error-handling APPROVED · tests REVISE.

* **P46 (plan b1)** `None` is a no-op for a running entry, so no floor. Trace: `cancelDownloadJob` resolves only after the job settled with Cancellation; `report_download_error` (fs.rs:837-850) writes the terminal item before the command returns, so the entry is terminal at clear time. **Fix** r9 → stated in O3. **(tests b1)** contradictory test line. **Fix** r9.
* **P47 (plan b2, tests b2)** trace missing / test-local builder could hide a missing production registration. Trace: main.rs:2243-2363 builds the registry inline in `main()`. **Fix** r9 → extract and share the production builder.
* **P48 (plan s1)** third UUID parse at fs.rs:885-886. **Fix** r9.
* **P50 (plan b3)** existing helper tests must claim a lease (fs.rs:3788-3800 passes UUIDs). **Fix** r9.
* **P51 (tests b3)** card tests must pin job registration before setup IPCs. **Fix** r9.

### Round 9 (candidate r9; plan, tests, ipc-contract; wall ~12 min)

Raw verdicts: plan REVISE · tests REVISE · ipc-contract APPROVED.
Closed: P46, P48, P50, P51 (all three lenses).

* **P47 (plan b1)** MockRuntime cannot register the concrete-runtime production commands (fs.rs:720-721, chesscom.rs:224-225; main.rs:2243-2363 builds for the default runtime). Probe: `grep -n "tauri::AppHandle," src-tauri/src/fs.rs` — every download command takes the concrete handle. **Fix** r10 → bindings:check + tsc for registration, source-scan pins for `window.label()` threading (precedent main.rs:3660-3711), behaviour through the cores; the `MockRuntime` registry test is withdrawn.
* **P52 (tests b1)** engine-archive terminal Cancelled assertion. **Fix** r10.
* **P53 (tests s2)** `clear_progress` never exercised through the production handler. **Fix** r10 → covered by the same registration route (bindings:check + tsc) and store/helper tests; handler-level invocation is infeasible for the reason in P47.
* **P40-style packet (plan b2)** per-issue probe results: the Round 9 lines now carry the probe for P47; the remaining corrections are text-level specification changes whose evidence is the cited source line.

### Round 10 (candidate r10; plan, tests, ipc-contract; wall ~12 min)

Raw verdicts: plan REVISE · tests REVISE · ipc-contract REVISE. Closed: P52 (all); P47 closed by tests and ipc-contract, open for plan only on the stale MockRuntime sentence.

* **P47 (text)** stale "MockRuntime IPC below" reference (plan b1). **Fix** r11 → points at command cores.
* **P53** production `clear_progress` shell unproven (ipc-contract b1, plan b2, tests b1). **Fix** r11 → runtime-generic `clear_progress_with` core on MockRuntime + source-scan pin on the shell.
* **P46 (reopened, eviction)** `None` result gives no floor when the entry was purged (plan b3). Trace: progress.rs:100-103 purges by TTL; useProgress.ts:15-17 accepts any item when current is null. **Fix** r11 → `ClearOutcome::Absent { floor }`.
* **P54** claim-first not proven per command (tests s2). **Fix** r11 → cancelled ticket + invalid input → Cancellation, per core.

### Round 11 (candidate r11; plan, tests, ipc-contract, correctness; wall ~12 min)

Raw verdicts: plan REVISE · tests REVISE · ipc-contract REVISE · correctness APPROVED. Closed: P46, P47, P54 (all four).

* **P55** stale `Some` wording vs `ClearOutcome` (ipc-contract b1). **Fix** r12.
* **P56** setup IPC rejecting after Cancel reports an error (plan b1; AddDatabase.tsx:248-258, notifyError.ts:5-25). **Fix** r12 → cancel-requested rejection settles as cancellation; resolution still wins.
* **P57** unaddressed `DownloadRegistry` consumers (plan b2). **Fix** r12 → listed.
* **P58** "six" vs seven commands (plan s1). **Fix** r12.
* **P59** P46 rationale premise ignored the pre-progress path (plan s2). **Fix** r12.
* **P53 (return value)** shell must return helper outcome unchanged (tests b1). **Fix** r12.
* **P23 (again, tests b2)** full push gates / UI verification not in the phase proof. **Skip** — unchanged reason: build step 7 (verify-ui) and step 8 (complete gate set from the push skill) run them after the phase.

### Round 12 (candidate r12; plan, tests, ipc-contract, error-handling; wall ~13 min)

Raw verdicts: plan REVISE · tests APPROVED · ipc-contract REVISE · error-handling REVISE. Closed: P53, P57, P58, P59 (all).

* **P56 (overreach)** mapping every post-cancel rejection to cancellation hides real post-publication failures (error-handling b1, ipc-contract b1, plan b2; chess.rs:3411-3443, infra/fs.rs:637-650). **Fix** r13 → effective-cancel rule (before invoke, or native `true`); typed error otherwise; tests (tests s1, s2).
* **P60** O2 "must be `true`" vs O3 "informational" contradiction (plan b1; tauri.ts:258-275). **Fix** r13 → one rule in O2, O3 records the answer for classification.
* **P17 (Lichess)** pre-progress test lacks Lichess reserved branch (plan b3; fs.rs:1218-1230, :943-980). **Fix** r13.
* **P55 (tail)** emitter-failure test still said `Some` (plan b4). **Fix** r13.
* **P61** wrong Chess.com trace (`JobProgress::drop`) (plan s1; chesscom.rs:253-273, :383-385). **Fix** r13.

### Round 13 (candidate r13; plan, ipc-contract, error-handling, tests, correctness; wall ~13 min)

Raw verdicts: plan REVISE · ipc-contract APPROVED · error-handling REVISE · tests APPROVED · correctness REVISE. Closed: P17, P55, P60, P61 (all).

* **P56 (true-cancel racing native failure)** (error-handling b1, plan b1; fs.rs:600-615). **Fix** r14 → O2 "cancellation wins" rule, debug-logged, tested; reason recorded (non-actionable after an acknowledged cancel with no artifact).
* **P62** `engines.controller.test.ts:160-205` consumer of `installDefaultEngine` unaddressed (plan b2). **Fix** r14.
* **P63** hook-local floor misses a remounted card (correctness b1; useProgress.ts:29 `useRef`). **Fix** r14 → module-level per-id floor store with subscribe.

### Round 14 (candidate r14; plan, error-handling, correctness, persisted-state [newly applicable: src/hooks]; wall ~13 min)

Raw verdicts: plan REVISE · error-handling REVISE · correctness REVISE · persisted-state REVISE. Closed: P62 (except evidence note).

Rule 12a applied: the progress-clearing dispute had returned in rounds 3, 4, 5, 7, 8, 10, 11, 13, 14 (P16/P46/P63 lineage). Broad fixing stopped; traced the real path instead: useTauriListener.ts:33-47 registers asynchronously while useProgress.ts:34-51 requests the snapshot in parallel; the download cancel path's clear is unnecessary because every cancelled flow ends terminal-at-0 or with no entry (fs.rs:837-850, chesscom.rs:253-273/:383-385; ProgressButton.tsx:49/:96-104 render that as idle). **Rewrite** of O3's progress part (see Decisions): withdrawn — generation-bound clear, `ClearOutcome`, per-id floor store, clear/begin emitter seam (P16, P36, P43, P53, P55, P63 corrections withdrawn; their issues are resolved by removal of the clear on this path, not deferred). Focused fresh-context judgment of the rewrite: round 15 `review-plan` plus the lenses that raised the lineage.

* **P64** token-wide "cancellation wins" hides `EngineTimeout` (correctness b1, error-handling b1, plan b1; fs.rs:40-52, chesscom.rs:293-371). **Fix** r15 → rule withdrawn; settlement decides.
* **P65** post-commit cancel "yields success" contradicts `CommittedDurabilityUncertain` (correctness b2; infra/fs.rs:637-650). **Fix** r15 → O2 wording.
* **P66** `Kept` gives no floor (correctness b3); floor map unbounded for per-report ids (plan b2; ReportPanel.tsx:37-38); AddEngine clear bypasses floor (persisted-state b1). **Resolved by the rewrite** (mechanism removed).
* **P67** AddEngine cleanup failure semantics (error-handling s1; AddEngine.tsx:228-234). **Fix** r15 → best-effort, logged, original error rethrown.
* **P62 evidence** (plan b3): consumer confirmed at `src/utils/engines.controller.test.ts:160-205` (`installDefaultEngine` called without a ticket; no prepare/release mocks) — probe: read of that range in round 14 by the plan lens itself.

### Round 15 (fresh-context judgment of the rule-12a rewrite; 7 lenses; wall ~14 min)

Raw verdicts: plan REVISE · correctness REVISE · persisted-state REVISE · error-handling APPROVED · tests REVISE · engine-protocol REVISE · ipc-contract APPROVED. Closed: P64 (all), P67 (all); P65 closed except a test anchor. The rewrite's core (no native clear on the cancel path, subscribe-then-snapshot, terminal-wins) was accepted by all seven; the reports are local gaps.

* **P68** AddEngine's surviving failure `clearProgress` → delayed cleared event erases a retry (correctness b2, persisted-state b1; useProgress.ts:64-68). **Fix** r16 → hook-local cleared-event generation guard + monotonic floor (no store).
* **P69** snapshot-on-registration misses id changes (correctness b3, plan b1; useTauriListener.ts:27-55, useProgress.ts:54-60, useProgress.test.tsx:232-254). **Fix** r16 → snapshot effect on `[id, registered]`.
* **P70** stale running bar when the terminal emit fails, the entry is evicted at capacity, or `begin_progress`'s emit fails (correctness b1, plan b2, engine-protocol b1, error-handling s1/P43). **Fix** r16 → local-only `discard()` on cancel; `begin_progress` emit best-effort.
* **P71** card tests must pin the `clearOnCancel` prop (tests b1). **Fix** r16.
* **P65 (test)** post-commit durability failure with concurrent cancel (tests s1). **Fix** r16.
* **P72** AddEngine cleanup `clearProgress` reject after state removal leaves bar (error-handling s2). **Fix** covered by P68 guard? No — this is a rejected clear with native state gone: the job then rethrows the original error; the card's bar comes from the store, which is cleared; the displayed stale item is local. **Skip** — pre-existing failure-path cosmetics of AddEngine outside the cancel mandate; a reload or the next event corrects it.
* **P39 (again)** engine process claims (engine-protocol b2-s5). **Skip** — already tracked (Round 5).

### Round 16 (closure check; plan, correctness, persisted-state, tests, engine-protocol; wall ~13 min)

Raw verdicts: plan REVISE · correctness REVISE · persisted-state REVISE · tests APPROVED · engine-protocol REVISE. Closed: P65, P68, P69 (all).

* **P70 (premise error)** a cancelled item keeps its last percentage (progress.rs:198 `progress.max(existing.progress)`), so "terminal at 0" was false and a bar stays after remount (correctness b2); `discard()` cannot fence when no item is displayed (engine-protocol b1, persisted-state b1, plan b2). **Fix** r17 → `discard()` withdrawn; the job itself awaits `clearProgress(progressId)` after a `Cancellation` settlement and **before** releasing its registry entry, so retries (refused while registered) cannot overlap the id-only clear; the cleared-event guard + subscribe-then-snapshot cover the hook. Evidence that this ordering is strict: `runDownloadJob` refuses a start for a registered id (O3), and the entry is released in `finally` after the awaited clear.
* **P71 (text)** `"local"`/`false` contradiction (correctness b1, persisted-state b2, plan s1). **Fix** r17 → one boolean prop, consistent everywhere.
* **P47 (text)** line 62 still said "through IPC" (plan b1). **Fix** r17.
* **P73** engine: keep `progressId` and ticket apart (engine-protocol s1; engines.ts:315-330). **Fix** r17.

### Round 17 (closure check; plan, correctness, persisted-state, engine-protocol; wall ~12 min)

Raw verdicts: plan REVISE · correctness APPROVED · persisted-state REVISE · engine-protocol REVISE. Closed: P47, P71, P73 (all).

* **P70 (clear failure)** a rejected/unemitted job clear leaves the terminal item at its last percentage drawn as a bar (plan b1, persisted-state b1, engine-protocol b1; progress.rs:198, :451-468; ProgressButton.tsx:96-104). **Fix** r18 → render rule: no bar for a finished non-success item, so the visible outcome no longer depends on the clear.

### Round 18 (closure check; plan, persisted-state, engine-protocol; wall ~11 min)

Raw verdicts: plan REVISE · persisted-state APPROVED · engine-protocol REVISE.

* **P70 (both emits lost)** terminal emit and clear emit both failing leave a mounted running item (engine-protocol b1, plan b1; fs.rs:824-834, progress.rs:451-468). **Fix** r19 → `refresh()` native pull with compare-and-set after a download cancel; independent of events.
* **P74** render rule hid `Failed` bars too, changing ReportPanel (plan s1; ReportPanel.tsx:120-135). **Fix** r19 → `Cancelled` only.
* **P75** snapshot gated on successful registration loses the snapshot when registration rejects (plan s2; useTauriListener.ts:44-50). **Fix** r19 → `onSettled(boolean)`.

### Round 19 (closure check; plan, engine-protocol, persisted-state; wall ~12 min)

Raw verdicts: plan REVISE · engine-protocol APPROVED · persisted-state REVISE. Closed: P74, P75 (all).

* **P70 (fence)** `refresh()` on `null` does not fence a late pre-clear event (persisted-state b1, plan b1; progress.rs:240-247 returns the fresh generation that was being discarded). **Fix** r20 → the job keeps the cleared generation; `fence(g)` locally; `refresh()` only when the clear was rejected. Refresh rejection semantics (plan b2): **Fix** r20 → logged, not notified.
* **P43 (withdrawn again)** `begin_progress` best-effort changes a contract shared with analysis and database jobs (plan s1; chess.rs:1141, db/mod.rs:8476). **Defer** → withdrawn from this plan; the stuck-running-entry-on-emit-failure defect is pre-existing for every progress user and is filed as its own finding.
* **P7 (again)** Lichess/Chess.com migration scope (plan s2). **Skip** — unchanged reason: the native claim contract requires a prepared ticket for all four commands; no UI or acceptance added.

### Round 20 (closure check; plan, persisted-state, error-handling; wall ~11 min)

Raw verdicts: plan REVISE · persisted-state REVISE · error-handling REVISE. Closed: P43 (withdrawn/filed).

* **P70 (clear-failure fallback)** `clear_progress` removes the entry then fails on emit, so the job receives no generation and `refresh()` had no fence (error-handling b1, persisted-state b1, plan b1; progress.rs:240-247, :451-468). **Fix** r21 → `clear_progress` returns the generation whenever it cleared (emit best-effort); the `null` path becomes a poisoned store only, handled by local `discard()`; remount needs no fence (subscribe-then-snapshot, entry gone, ordered event channel).
* **P76** `cancelDownloadJob` / `onCancel` type contract (plan b2; ProgressButton.tsx:10-15). **Fix** r21.

### Round 21 (closure check; plan, persisted-state, error-handling, ipc-contract; wall ~11 min)

Raw verdicts: all four REVISE. Closed: P76 (all).

* **P77** `clear_progress` emits directly, so the transition emitter seam cannot prove its
  emit-failure behaviour (plan b1, ipc-contract s1; progress.rs:451-468). **Fix** r22 → its own
  `clear_progress_with` core plus a shell source-scan pin.
* **P78** a rejected `cancelDownload` is swallowed by `ProgressButton` (error-handling s1;
  ProgressButton.tsx:63-66). **Fix** r22 → reported through `notifyListenerError`.
* **P70 (poisoned store / lost emits)** `discard()` has no generation when nothing is displayed and
  the clear rejected; a remounted card could keep a stale running item if both the terminal and the
  cleared emit were lost (error-handling b1, ipc-contract b1, persisted-state b1, plan b2).
  **Skip**, with the trace: (a) after r21 `clear_progress` rejects **only** on a poisoned progress
  mutex (progress.rs:240-247) — in that state `start`, every transition and `get_progress` fail
  too, so no id can show or gain progress and the reopened card's own snapshot errors; (b) with the
  clear succeeding, a remounted hook registers its listener before its snapshot and the entry is
  already gone, so it can only display a running item received *before* the cleared event on the
  same ordered event channel — and that cleared event nulls it through the r16 generation guard.
  Both residuals therefore require a webview whose event delivery is already failing, not an
  ordinary interleaving. No further mechanism is added for them.

### Round 22 corrections (r23 candidate)

* **P79** duplicate notification / ReportPanel contact (plan s1, error-handling s2; ReportPanel.tsx:74-88, :120-136). **Fix** → `ProgressButton` keeps swallowing; the cards report as ReportPanel does; `cancelDownloadJob` distinguishes "lost the race" from the job's own typed failure so each is notified once.
* **P80** incomplete FILES list (plan b1). **Fix** → every test file named.

*(A round launched against an unrevised plan was voided: `plan-review-delta.py` exited 3 (UNCHANGED) because the edit script had aborted before writing. Its reports are kept at `$RUN_TMP/void-r23/` and are not counted as a review round.)*

### Round 23 (closure check; plan, error-handling, tests; wall ~10 min)

Raw verdicts: plan REVISE · error-handling REVISE · tests REVISE.

* **P79** card wiring still showed a bare `cancelDownloadJob` call while the text required
  catch-and-report (plan b1, error-handling b1; ProgressButton.tsx:57-66, ReportPanel.tsx:74-82).
  **Fix** r24 → one shared card helper with the explicit shape, and three distinguishable
  rejection kinds with exactly one notification owner each; tests assert the error class
  (tests s1).
* **P80** `src/platform/useTauriListener.test.tsx` missing from the FILES list (plan b2, tests b1).
  **Fix** r24.

### Round 24 (closure check; plan, error-handling, tests, minimalism; wall ~10 min)

Raw verdicts: plan REVISE · error-handling APPROVED · tests APPROVED · minimalism APPROVED. Closed: P80 (all).

* **P79** the card helper dropped `cancelDownloadJob`'s return value, so `clearedGeneration` never
  reached the fence (plan b1; ProgressButton.tsx:57-74); `prepareDownload` failures were
  classified into the cancel class although a pending cancel must settle the job as cancellation
  (plan b2; tauri.ts:263-275); the no-entry rejection was a fourth untyped path
  (error-handling s2). **Fix** r25 → helper returns the outcome; three kinds only, with
  `prepareDownload` explicitly on the job path and no-entry folded into the lost-race class; the
  cancel-failure-then-job-failure case is recorded as deliberately two notifications
  (error-handling s1).

### Round 25 (closure; plan, error-handling; wall ~8 min)

Raw verdicts: **plan APPROVED · error-handling APPROVED**. P79 closed by both. The single
remaining `should-fix` (error-handling: the combined cancel-failure-then-job-failure race was
defined but not tested) is adopted verbatim as a test case; it is a test-list addition with no
change to behaviour, state, ownership, contracts or proof semantics, so no further lens round is
required (rule 12a, typographical/reference-only clause applied to a reviewer's own requested
addition).

**Closure state:** every issue P1-P80 carries an explicit disposition (Fix applied / Skip with
reason / Defer filed / Withdrawn with reason) and every adopted substantive correction has an
explicit reviewer closure result in a later round. No `REVISE` was rewritten: the raw verdicts of
all 25 rounds stand as recorded above.

**Cumulative metrics.** 25 completed rounds (one launched round voided: `plan-review-delta.py`
exit 3 on an unrevised plan; its reports are retained at `$RUN_TMP/void-r23/` and it is not
counted). 130 lens reports over ~5 h 10 min wall, all active review (no quota, dependency or
release waits). Unique issues opened 80, resolved 80: 60 Fix, 11 Skip, 4 Defer (filed as
findings), 5 withdrawn by a later rewrite. Two rewrites, both under rule 12a: round 14 (progress
clearing: the generation-bound clear family withdrawn) and round 16 (the local `discard()`
withdrawn for the job-owned clear). No split. Correction-introduced defects: 9 (P46 reopened
twice, P16/P26/P47/P53/P55/P70 each once) — every one found by a later round of the same review.
`plan_adopted_per_round`: r1=15 r2=8 r3=9 r4=8 r5=8 r6=6 r7=4 r8=5 r9=3 r10=4 r11=5 r12=5 r13=3
r14=4 r15=5 r16=4 r17=1 r18=3 r19=2 r20=2 r21=2 r22=2 r23=2 r24=1 r25=1.
