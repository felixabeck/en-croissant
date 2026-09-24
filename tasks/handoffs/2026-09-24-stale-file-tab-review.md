# Plan-review record — f-20260923-01 (stale file-backed tabs)

Durable record of the plan review and cumulative code review for `f-20260923-01`. `tasks/plans/` is
gitignored, so this file is the surviving copy; everything below the rule is
`tasks/plans/2026-09-24-stale-file-tab.md` verbatim at closure of the build.

## Why this record exists

One drain session (`767c276a-499c-41b8-8170-256aa14b7d5c`, `/next-finding --pin f-20260923-01
full auto`), orchestrated by Claude Code (Opus 5.5) with Codex `gpt-6-luna` as the executor for
every lens and write leaf, on 2026-09-24. Plan review ran 14 rounds (86 issues, all dispositioned,
one focused architecture judgment on I-01); the cumulative code review ran three passes (R-01..R-15
plus closure). Implemented in c0fdcc56, 490831c7, 579058da, 3d0627ec, 99ebb375, 0712448a, 88d82829 and the closure commit that follows 88d82829.

## Successor ownership

Filed during this run (their own findings own these; load this record before reviewing them):

* orphaned tree key when tab-admission rollback removal throws (plan I-56) — inbox `20260924-085223-…`
* undecodable persisted tree replaced by a clean default (I-84) — inbox `20260924-112918-…`
* `delete_game` without a stamp expectation (cumulative review, pgn-index) — inbox `20260924-175708-…`
* `verify:app` aborts at its first Files-row click since ~17:00 (environment; owns the five pending
  staged-failure rows of the new freshness checks) — inbox `20260924-183629-…`
* freshness-panel contrast in light scheme (filed by the phase-3 leaf) — inbox `20260924-155952-…`

Dispositions a successor must not relitigate without new evidence: the bounded-latency reading of
"never show stale" (I-01, focused judgment BOUNDED-POLL-OK); no overwrite action in the conflict
panel (I-02); an accepted duplicate blank game after an uncertain Add Game (I-74); tabs are not
restored across an app restart on this platform (cumulative-review correction to I-71).

---

# Plan: a file-backed analysis tab never shows, syncs from, or saves back a stale game

Finding: `f-20260923-01` (frontend-state, entry=build). Drain session, `full auto`.

## MANDATE (fixed across every round)

An analysis tab whose game comes from a PGN file must never show, practice-sync from, or save
back a game text that is stale relative to the file on disk, and must never silently discard the
user's unsaved edits.

## Goal

1. Every file-backed tree carries the stamp of the exact game text it was seeded from, persisted
   **inside the tree state** so tree and stamp are always written together.
2. **Freshness bound (I-01, focused judgment r2: BOUNDED-POLL-OK).** Zero-latency detection of
   another program's write is not physically achievable (a watcher event and a poll both arrive
   after the write). The MANDATE is therefore implemented as: **from an external write to the
   stale view being reloaded or withheld is at most one poll interval (2 s) plus one read,
   and never longer** — a poll that has not answered within the interval withholds the view
   rather than extending the window. While the app runs, one app-level poll stats every distinct
   file of open file-backed tabs every 2 s and immediately on window focus.
3. A file-backed tab is rendered only while **verified**: after a restart, after being marked
   stale, while a poll is overdue, or while a conflict is unresolved, `TabSwitch` renders a
   freshness gate (loader, conflict panel, or unavailable panel) **instead of** the board and
   panels. So neither the board nor `PracticePanel` nor autosave ever sees an unverified or
   conflicting tree. Outcomes: clean + changed → reload silently; dirty + changed → conflict panel
   ("Reload from disk" / "Save my version as a new game…") — no action writes the conflicting tree over a game
   of the file or leaves a *verified* file-backed tab whose tree differs from disk other than by
   edits made after verification; game gone, file deleted, or file replaced by
   rename (handle identity changed) → unavailable panel ("Save my version as a new game…" / "Close tab").
0. **Dependency (I-41, measured):** a PGN picked through the native dialog is a `PersistentFile`
   capability bound to the file's (dev, inode) (`main.rs:985`, `path_authority/mod.rs:6691-6703`),
   and the app's own `write_game`/`delete_game` commit by atomic rename (`resolved.rs:614-645`),
   which changes the inode (measured: `mv` onto a file changes `stat %i`, an in-place write does
   not). Today such a handle is therefore dead after its first save (the next read/write is
   `Conflict: path authority is unavailable because its object changed`), and with the poll the
   tab would turn unavailable 2 s after every save. The app's own committed replacement must
   rebind the capability to the installed identity.
4. Every write to a file-backed game is a compare-and-swap in the native writer against a
   **required** expectation; a mismatch is refused with a typed error, and the tab goes into the
   conflict state (the same panel: "Reload from disk" / "Save my version as a new game…"). A tree without a stamp cannot write
   until reconciled. Residual stated: the native check and the atomic rename are not atomic
   against *another process* (no cross-process lock exists, `resolved.rs:638-645`,
   `fs.rs:833-869`); the window is the duration of one rename.
5. `FileCard`'s Open reads the game fresh instead of reusing its mount-time preview text.
6. "Add game" in a dirty tab asks first (the `ConfirmChangesModal` flow `InfoPanel.setPage` uses),
   and replaces the tree only after the append write succeeded.

## Evidence (locate, 2026-09-24)

* `createTab`/`commitNewTab` (`src/utils/tabs.ts:40-150`) always append a new tab; nothing focuses
  an existing tab on open. The "deck never received new positions" half of the filed observation
  was the PracticePanel hydration race fixed in `530149e3` (`f-20260923-02`). The verifier's
  `closeRestoredAnalysisTab` (`scripts/verify-app.mjs:798`, only caller ~1488, comment citing
  this finding) is the workaround phase 3 replaces with the real scenario.
* Restore: `workspaceAtom` → `loadWorkspace` (`src/state/workspace.ts`), tree per tab id in
  `tabStorage` (`src/state/store/tabStorage.ts`), store created on `TreeStateProvider` mount
  (`src/components/common/TreeStateContext.tsx:16`); `BoardsPage` uses `keepMounted={false}`, so
  every activation remounts `BoardAnalysis`. Nothing compares the restored tree with the file.
* `dirty` lives in the tree state (`src/utils/treeReducer.ts:11`), cleared by `store.save()`.
  `BoardAnalysis.tsx:79` autosaves a dirty persistent-origin tree **on mount** — i.e. today a
  restored dirty tab can overwrite a newer file the moment it is shown.
* Native: `read_games` (`src-tauri/src/pgn.rs:778`) returns only texts; `write_game`
  (`pgn.rs:969-1035`) scans under the per-file edit lock and commits through
  `commit_pgn_mutation`, which already refuses when the file revision changed between its own scan
  and commit (`Error::Conflict`), but takes no expected content from the renderer. `sha2 = "0.10"`
  is already a dependency (`src-tauri/Cargo.toml:81`).
* `WorkspaceEntry.lastModified` is second-resolution and whole-file; unsuitable as a per-game stamp.
* File-origin seeding sites: `openFile` (`src/utils/files.ts:61`, used by FileCard, DirectoryTree,
  app menu, ImportModal:137), `NewTabHome.tsx:152` (recent file), `ImportModal.tsx:71` (select
  file), `CreateRepertoireModal.tsx:65` (in-memory PGN after file creation), `InfoPanel.tsx:185`
  `setPage` (game switch replaces the tree and `gameNumber`), `BoardAnalysis.tsx:105` `addGame`
  (appends a default game and moves the tab to it), `saveToFile` Save-As branch (`tabs.ts:218`).
* Existing dialog: `ConfirmChangesModal` via `AppModal` (`ui:boundary:check` forbids direct `Modal`).

## Approach

### A. Native contract (`src-tauri/src/pgn.rs`, `error.rs`, `main.rs`)

* **Stamp:** lowercase hex SHA-256 of the exact bytes of game `n`'s scanned range — the bytes
  `read_games` returns for `n`. Computed only natively.
* **Revision:** opaque string encoding the existing `CacheKey` (`pgn.rs:39-49`: identity + size +
  mtime_ns + ctime_ns). Equality only.
* **`read_game(file, n, ticket) -> StampedGame { pgn, stamp, revision, present }`**, cancellable like
  `read_games` (`native_read_operation`); shares `read_games_core`'s scan/`read_ranges` path
  (extracted, not copied). The end slot `n == games.len()` of **any** file (empty or not) → `pgn: ""`,
  the empty-slot stamp, `present: false` — the slot `write_game` already accepts
  (`pgn.rs:1016-1024`) — so read-then-CAS can target it, and a tab whose game was deleted
  (e.g. file truncated to zero bytes) is told apart from a tab opened on an empty file: stored
  stamp ≠ empty-slot stamp and `present: false` → `unavailable` (I-43, I-62). `n > games.len()`
  → `InvalidInput` (renderer: "game no longer in file").
* **`file_revision(file, ticket) -> String`** (phase 2): revision of a fresh `pgn_snapshot()`,
  stat only, no scan. Errors keep today's categories: deleted → `missing-resource`, identity
  changed (rename-replace) → `conflict` from path resolution.
* **`write_game(file, n, pgn, expected: WriteExpectation) -> WriteStamp { stamp: Option<String> }`**
  with Specta tagged union `WriteExpectation = { kind: "game", stamp } | { kind: "append" }`,
  checked under the existing edit lock after `scan_current`: `game` → current bytes of
  `games[n]` must hash to `stamp`; `append` → `n == games.len()`. **There is no unconditional
  write kind**: every renderer write is a compare-and-swap (r5 root-cause, plan, tauri-security,
  persisted-state: an unconditional kind reachable with any `WritePgn` handle could overwrite a
  changed source). Mismatch → new `Error::StaleGame`
  (`ErrorCategory::StaleGame`, wire `"stale-game"`), file untouched. For `game`, the slot
  `n == games.len()` has the content "" (so an empty file's `read_game(0)` stamp saves back as
  an append — I-35). After the commit, still under the edit lock, the writer reads game `n`
  back and returns its stamp **only if the read-back text equals the submitted `pgn` after
  trimming surrounding whitespace** (the writer may add separator newlines, `pgn.rs:697-708`);
  otherwise — another program changed the file right after the commit, or the read-back failed —
  it returns `stamp: None`. So a later external change is never attributed to this write (I-69);
  `None` makes the renderer treat the tab as unverified, and a clean unverified tab reloads the
  other writer's text. A committed write never reports failure because of the read-back. (The
  unix atomic primitive opens its temporary write-only, `fs.rs:1574-1584`, so scanning the
  temporary is not available without widening that primitive — r9 plan.)
* **Rebind after own commit (phase 0):** after `write_game`/`delete_game` commit a replacement
  through a `PersistentFile` capability, the stored identity of **that** capability is updated to
  the installed identity, inside the same edit lock, using the installed identity reported by the
  existing `atomic_replace_at_identified*` primitive (never by re-stat of the pathname), and only
  when the pre-commit check proved the replaced object was the stored one. Registry persistence
  follows the authority's existing write path. Workspace (directory-rooted) handles are
  unaffected. A replacement made by another program still yields `conflict` → `unavailable`.
* Platform: `src/platform/tauri.ts` gives `readGame`/`fileRevision` the cancellation-ticket
  treatment of `readGames`; `src/platform/errors.ts` maps `stale-game` (app `validation`).

### B. Stamp in the tree; seeding and writing sites (phase 1)

* `TreeState` gains `sourceStamp: string | null` (default `null`) and `appendAttempted: boolean`
  (default `false`; see D — it survives a restart with the tree, I-71). An **absent**
  `appendAttempted` (pre-upgrade tree) migrates to `false`; a **present but wrong-typed** one
  fails closed to `true`, since it can only come from a tree written after this change (I-80). `migrateTreeForStorage`
  coerces an absent or wrong-typed value to `null` (the existing pattern for `report.operationId`,
  `tabStorage.ts:170-190`), so no stored tree is rejected. Tree and stamp are persisted by the
  same tab-storage write. `store.save(stamp)` sets `dirty: false` and `sourceStamp` in one
  `set`. `gameOrigin` and the workspace envelope are **not** changed.
* Shared loader in `src/utils/files.ts`: `readFileGame(handle, n, signal)` →
  `{ pgn, stamp, revision, present }`; `loadFileGame(...)` → `{ tree (with sourceStamp), revision,
  present }` — `present` is carried through, and reconcile routes `present: false` with a stored
  stamp other than the empty stamp to `unavailable` (I-43).
  Used by `openFile` (loses its `pgn` option — goal 5; `NewTabHome`'s recent-file open is routed
  through `openFile` instead of its own copy of tab creation, origin setup, repertoire selection
  and recent-file registration, keeping its file-name title via an option — I-47),
  `ImportModal` file select, `InfoPanel.setPage` (which, like reconcile, re-checks `dirty` immediately before `setState`; a
  tree edited during the load is not replaced — the confirm flow opens instead, I-48), and
  reconcile (C). `CreateRepertoireModal`
  opens the created file via `openFile` rather than seeding in-memory text.
* `saveToFile`: file origin → `expected = { kind: "game", stamp: tree.sourceStamp }`; a `null`
  stamp returns the new `SaveResult` `"conflict"` without writing. A user save of a (legacy, no longer constructed) `temp_file` origin — the only origin whose
  save goes through the picker — first reads its **source** slot and requires the tree's
  `sourceStamp`; a mismatch or `null` → `"conflict"` before any picker opens; the same source check
  runs again **after** the picker closed, immediately before the write, so a source changed while
  the picker was open is also refused (I-65; the residual is the milliseconds between that check
  and the write, the I-34 class).
  Save-As keeps today's target slot (`fileOrigin?.gameNumber ?? 0` of the picked file,
  `tabs.ts:192-220`) but writes it as a CAS: it reads that slot of the picked file
  (`readFileGame`; the empty slot when `n == count`) and writes with `{ kind: "game", stamp }` —
  behaviour unchanged for the user, no unconditional write kind needed. The tab's `gameOrigin` is
  switched to the picked file only **after** the write succeeded (today it is switched before, `tabs.ts:197-216`); a failed
  Save-As leaves origin, tree and stamp untouched (I-44).
  Before the write the origin (file key, game number) is captured. On success, if the origin
  changed meanwhile (e.g. the user switched games), nothing is applied to the tree and the result
  is `"superseded"` (never `"saved"`), so no caller closes the tab or switches the page on it
  (I-36). Otherwise
  the current tree is re-serialised with the same options; if it equals the text just written →
  `store.save(returnedStamp)` (clears dirty) and the result is `"saved"`; otherwise (any edit
  meanwhile, including header-only edits) only `sourceStamp` is updated, `dirty` stays true and
  the result is the new `"superseded"` — `ConfirmChangesModal` does **not** close the tab on it
  (it says changes were made during saving and offers Save again), autosave re-fires because
  `dirty` is still true (I-36). A returned `stamp: None` (read-back failed or the file changed
  right after the commit) → `sourceStamp: null`, `dirty` **stays true**, result `"conflict"` (callers
  treat it like a refused save: the close dialog closes and the tab shows the conflict panel —
  not "changes were made during saving", which would misstate the cause), tab `unverified` — the reconcile then finds a dirty stampless tree → conflict panel, so an
  external write landing right after this save can never silently replace the user's text
  (I-81).
  `StaleGame` → `"conflict"`. Every consumer handles `"conflict"` by putting the tab into the
  conflict state (C) — `BoardAnalysis` manual/auto save and `ConfirmChangesModal` (close-tab and
  page-switch): on `"conflict"` from the close-tab dialog, the dialog closes, the tab is not
  closed, and it is activated showing the conflict panel (I-38). `saveToFile` returns the typed
  error with `"failed"`; `ConfirmChangesModal` shows that typed message instead of the generic
  one (I-46); the manual save path (`userSaveFile`, hotkey and controls,
  `BoardAnalysis.tsx:71`) shows it through `notifyUnlessCancelled` (today ignored). Autosave
  failure policy is unchanged (I-66 withdrawn: a failed write leaves `dirty` set, and closing
  prompts). A Save-As completion is bound to the tab id that started it (`updateTab(id, …)`,
  not the active-tab setter), so switching tabs during the picker/write cannot attach the
  destination to another tab (I-70).
* `BoardAnalysis.addGame`: dirty → `ConfirmChangesModal` first; then the tab is set to the
  registry state `appending` (the gate withholds the board and starts **no** reconcile read, so
  neither an edit nor a reconcile of the old game can race the append; after the write resolves
  the tab goes to `unverified` and reconciles the resulting origin — I-73), `writeGame(n =
  cached numGames, defaultPGN, { kind: "append" })`; on success the tab's origin moves to game
  `n` (`numGames + 1`) and the gate's reconcile loads it fresh (real stamp). `StaleGame` (someone
  appended, refused before writing) → notify, `numGames` refreshed via `countPgnGames` so the
  next Add Game targets the real end, origin untouched, the gate reconciles the old game; any
  other failure (incl. `CommittedDurabilityUncertain` and post-commit cache errors, where the
  blank game may be on disk) → typed notification saying the new game may have been added,
  count refreshed, origin untouched, the gate reconciles the old game. The tab never moves to a
  game it cannot prove it wrote (r11: a count delta cannot tell whose append landed — I-74).

### C. Freshness registry, gate and reconcile (phase 1) + poll (phase 2)

* **Registry** `src/state/fileFreshness.ts` (in memory, never persisted), per tab id:
  `state: "unverified" | "overdue" | "appending" | "verified" | "conflict" | "unavailable"`, `verifiedRevision`, conflict
  reason. A tab with no entry is `unverified`. Entries are removed on tab close alongside the
  existing `treeStores` cleanup (`tree.ts:155-161`); bounded by open tabs. React subscribes via a
  small jotai atom family or `useSyncExternalStore`.
* **Gate** `FileFreshnessGate` inside `TreeStateProvider` in `TabSwitch` for file/temp_file
  analysis tabs: `verified` → children; `unverified` → loader + reconcile, then re-evaluate;
  `conflict` → conflict panel (inline, replacing board and panels, so no `PracticePanel`, no
  autosave, no save); `unavailable` → unavailable panel.
* **Reconcile(tab):** single-flight per tab — while a `readFileGame` for the tab is outstanding
  (including one that was aborted but has not settled), a newer trigger only marks "re-run after
  settle", so repeated invalidations cannot accumulate native reads (I-24, r8 plan).
  `readFileGame(handle, gameNumber)` with an AbortController (aborted on
  unmount; applied only if tab id, file key, gameNumber and store identity still
  match — `InfoPanel.setPage`'s `isObsolete` discipline — **and** the tab's freshness epoch is
  unchanged: every registry transition (poll invalidation, unavailable, conflict) increments a
  per-tab epoch, so a read that started before the poll invalidated the tab cannot mark it
  verified, I-49). Compare stamp first; parse only to
  reload. Immediately before any `setState` it re-reads `dirty` and the tree root identity from
  the store; if the user edited meanwhile, it becomes a conflict instead of a reload.
  * equal → `verified` (+ revision).
  * differs or `sourceStamp == null`, clean → parse, `setState` tree + stamp, `verified`.
  * differs or `null`, dirty → `conflict` (reason `changed`), tree untouched.
  * `InvalidInput` (game gone), `missing-resource` (deleted), `conflict` category from path
    resolution (replaced) → `unavailable`.
  * other errors → stays `unverified`; the gate shows the backend category's message and Retry.
* **Conflict panel** (reasons `changed` and `save-refused`, same actions): "Reload from disk"
  (`loadFileGame`, replace tree, `verified`) or "Save my version as a new game…": the PGN picker, then the tree
  is written to the picked file with `{ kind: "append" }` at its current game count and on success
  the tab's origin becomes that file at the appended index; if the write returned a stamp →
  `store.save(stamp)`, `verified`. `StaleGame` (a lost race, refused before writing) → message, the
  action stays available. Every other outcome — `stamp: None`, or any error (the game may or may
  not be on disk: `CommittedDurabilityUncertain` and post-commit cache errors return after the
  rename, `pgn.rs:891-906`, `fs.rs:896-915`) — leaves origin and tree unchanged with `dirty` still
  set. **Before** the native append the action sets the persisted tree flag
  `appendAttempted: true` and flushes tab storage for that tab (`tabStorage.flush`,
  `tabStorage.ts:339-360`, which reports the tabs it could not persist); if that tab's flush
  failed, the action aborts without appending, sets the flag back to `false`, and reports the
  storage failure through the existing persist-error path (`flush({ notify: true })`), leaving
  the action available for a retry (I-82). A stamped success clears the flag with
  `store.save(stamp)`; `StaleGame` clears it (nothing was written); every other outcome leaves
  it set. While it is set the action is **disabled**, across restarts and crashes (I-71), with a message that the game may already
  have been added to that file; only "Reload from disk" (which clears the flag with the tree) and
  closing (which prompts) remain. From the moment any panel action is invoked until it settles
  (picker included), **every** panel action — the invoked one too — is disabled, so neither a
  second append nor a reload can start while one is pending (I-83, I-85). So the same text can never be appended twice, and no uncertain outcome is ever treated
  as a durable save (I-63, I-71; no read-back comparison, so writer newline normalisation is
  irrelevant — r9 pgn-index); cancelling the picker leaves the
  panel. It never overwrites a game — not even when the user picks the original file — so the
  newer disk version survives beside the user's version. There is no "overwrite with my
  version" and no detached origin-less copy (r6 plan: a detached dirty copy closes without a
  prompt, `tabs.ts:30-33`, `BoardsPage.tsx:105-107`). An action that fails: `InvalidInput` (game gone),
  `missing-resource`, path `conflict` → `unavailable`; other errors → the panel shows the backend
  category message and stays (I-42).
  **Unavailable panel:** "Save my version as a new game…" (as above) / "Close tab" (the existing close flow; the
  origin is still persistent, so a dirty tree gets the unsaved-changes prompt, whose Save routes
  to the same save-as-new-game action — `ConfirmChangesModal` takes the tab's freshness state and,
  for `unavailable`, its Save runs that action instead of `saveToFile`, I-64). Strings via i18next, `AppModal`
  not needed (inline panel; `ui:boundary:check` applies to any `ActionIcon`).
* **Poll (phase 2)** in `src/state/fileFreshness.ts`, started once from the root layout
  (`src/routes/__root.tsx`) so it runs on every route (a Files-page visit does not pause it):
  every 2 s and on window `focus`, for each distinct handle of open file-backed tabs,
  `fileRevision(handle)`; **at most one native query outstanding per handle** — a new one starts
  only after the previous settled, so no cancelled-but-running native reads accumulate against
  the 128-read registry cap (`operations.rs:16,200-202`). Revision ≠ a tab's `verifiedRevision`
  → that tab `unverified` (the mounted gate reconciles at once; an unmounted tab reconciles on
  activation) — except a tab in `appending`, which keeps that state for **every** poll outcome (changed
  revision, rejection, timeout); the latest outcome is recorded and applied when the append
  settles (I-73). Every open tab on a handle is matched,
  including several tabs sharing one handle. A query unanswered after 2 s → its tabs go **directly** to `overdue` (never through
  `unverified`, which would start a gate read — I-24).
  `missing-resource` / `conflict` → tabs `unavailable`; any other rejection → tabs `unverified`
  (withheld; the gate shows the message + Retry, and the poll keeps retrying). At the 2 s
  deadline a query is aborted and its tabs enter the registry state `overdue`: the gate shows
  "file is not responding" and does **not** start its own reconcile read for that handle; the
  tabs return to `unverified` (and reconcile) only after that query settled and a fresh
  `fileRevision` answered — a stuck native call
  therefore fails safe (withheld), never open, and never multiplies (I-24).
  Interval, focus listener and in-flight controllers are cleared on unmount.

## Decisions and trade-offs

* **Policy** (orchestrator, recorded in `tasks/decisions.md`): clean → silent reload; dirty →
  ask; save → CAS; unverified tab → gated until reconciled. Rejected: always reload (silently discards unsaved edits — violates MANDATE);
  always keep+warn (shows stale text for clean tabs for no reason). Reversal: the outcome switch
  in `useFileGameReconcile` and `FileConflictModal`.
* **Native content hash over renderer hash or mtime**: per-game (an edit to another game in the
  same file does not conflict), exact, and checkable atomically under the native edit lock.
  Rejected: renderer-side hash + read-before-write (TOCTOU between read and write, and
  `crypto.subtle` availability in the WebKitGTK custom scheme is unmeasured); whole-file
  size/mtime (false conflicts on unrelated games, second resolution on listings).
* **Stat poll over an OS file watcher** (focused judgment r2): a `stat` per distinct open file
  every 2 s is negligible and needs no new dependency or native subscription lifecycle; a watcher
  is asynchronous too, so it does not remove the latency window. A rename-replace breaks the
  handle's identity binding either way and is handled as `unavailable`. Rejected: `notify`-based watcher (not a dependency; rename/replace
  and handle-identity semantics would need their own lifecycle); focus-only detection (round 1:
  leaves a focused tab stale indefinitely — violates MANDATE).
* **Stamp inside the tree state, not in `gameOrigin`** (r2 persisted-state): tree and stamp are
  persisted by one write, so a crash cannot pair a new stamp with an old tree; the workspace
  schema and `pathOwners` are untouched.
* **Legacy stampless trees**: clean → reload, dirty → conflict once; never an unconditional
  write-back (`{kind:"game"}` needs a stamp; no unconditional kind exists).
* **Ordinary Save-As keeps its slot, as a read-then-CAS** (r6 correctness, minimalism,
  persisted-state, pgn-index, root-cause, security: changing it to append is a user-visible
  change outside the MANDATE). Rejected: an unconditional `replace` kind (reachable with any
  `WritePgn` handle, r5 tauri-security); append for every Save-As (r6).
* **Conflict/unavailable resolution appends the user's version as a new game** — the only
  action that keeps the user's edits file-backed without overwriting the newer disk version,
  whichever file the user picks. Reversal: the action handler in the conflict panel.
* **Conflict as an inline panel replacing the board** rather than a modal over it: the only way
  to guarantee `PracticePanel`, autosave and save never see the conflicting tree.
* **Conflict resolution is reload or save-as-new-game, never overwrite** (r3-r6 root-cause/plan):
  "keep my version and stay file-backed", "overwrite with my version" and a detached copy each
  either write over a newer disk version or lose edits silently on close.
* **Rebind the capability after the app's own atomic replace (phase 0)** rather than treating the
  identity change as "replaced by someone else": the pre-commit check under the edit lock proves
  the replaced object was the authorized one, and the primitive reports the installed identity.
  Rejected: in-place writes (lose atomic durability); re-resolving by pathname (substitution race).
* **Missing game/file:** the tab stops claiming the game (save as a new game / close with the
  unsaved-changes prompt) rather than silently retargeting another game index.

## Risks / open questions

* `edit_existing` separator normalisation: the returned stamp must be computed from the
  post-commit bytes, not from the submitted `pgn` — pinned by a Rust test that writes and then
  `read_game`s.
* `InfoPanel`'s dirty-check-before-page-switch already uses `ConfirmChangesModal`; unchanged.
* Practice sync reads the in-memory tree; the gate keeps `PracticePanel` unmounted unless the
  tab is `verified`, and a reload while mounted changes `root`, which its existing sync effect
  diffs from.
* `RepertoireInfo` (`src/components/panels/practice/RepertoireInfo.tsx:169-197`) uses `dirty` as
  its "recompute coverage" trigger and clears it with `store.save()` without writing the file.
  Under reload-when-clean that turns unsaved edits into silently reloaded ones, so phase 1 makes
  it track its own last-computed `root` identity and removes the `save()` call (I-54, r5 plan).

## Not part of this task

* A filesystem watcher. Database-origin tabs (`kind: "database"`). Game-number drift when another
  program inserts games before `n` (the stamp mismatch surfaces it as a change; resolving the
  "same game moved" identity is not in scope). `temp_file` has no constructor today; it gets the
  same optional field and code paths but no new constructor.

## Phases

Order is a real dependency: phase 0 makes picked-file handles survive the app's own writes, which
phases 1-2 rely on; phase 2's poll drives the registry built in phase 1; phase 3 proves it in the
real app. Phase 2 touches `pgn.rs`/`main.rs`/bindings/`fileFreshness.ts` again only to add
`file_revision` with its sole consumer (a command without one fails `ipc:consumers:check`).

0. **Capability survives the app's own PGN replacement** — `src-tauri/src/pgn.rs`
   (`write_game_core`/`delete_game_core`/`edit_existing`), `src-tauri/src/infra/path_authority/**`
   (rebind entry point), `src-tauri/src/infra/fs.rs` only if the identified primitive needs
   exposing. `--role sensitive`. Tests: through a `PersistentFile` capability, `write_game` twice
   and `delete_game` then `read_games` all succeed (today the second call is `Conflict`); the
   stored identity equals the new inode and survives an authority reload from `registry.json`;
   a rename-replace by "another program" between writes still yields `Conflict`; a workspace
   (directory) handle is unaffected. PROOF: `cargo test --manifest-path src-tauri/Cargo.toml pgn && cargo test --manifest-path src-tauri/Cargo.toml path_authority && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`
1. **Stamped read, CAS write, stamp in tree, registry + gate + reconcile + panels, all seeding and
   saving sites** — `src-tauri/src/{pgn,error,main}.rs`, `src/bindings/generated.ts`
   (`pnpm bindings:generate`), `src/platform/{tauri,errors}.ts`,
   `src/utils/{treeReducer,files,tabs}.ts`, `src/state/store/{tree,tabStorage}.ts`,
   `src/state/fileFreshness.ts`, `src/components/files/FileCard.tsx`,
   `src/components/tabs/{BoardsPage,FileFreshnessGate,NewTabHome,ImportModal,CreateRepertoireModal,ConfirmChangesModal}.tsx`,
   `src/components/panels/info/InfoPanel.tsx`, `src/components/boards/BoardAnalysis.tsx`,
   `src/components/panels/practice/RepertoireInfo.tsx`, locale catalogs (`pnpm i18n:extract`),
   and the colocated tests of every touched file (e.g. `src/utils/tabs.test.ts`,
   `src/state/store/tabStorage.test.ts`, `src/platform/tauri.test.ts`,
   `src/components/tabs/ConfirmChangesModal.test.tsx`; new `*.test.ts(x)` beside each new module).
   `--role sensitive`.
   Tests — Rust: `read_game` on a two-game BOM-prefixed CRLF fixture returns game 1's exact bytes
   and its SHA-256; a write's returned stamp equals the following `read_game(n)` stamp, and is
   `None` when a test hook changes the file between commit and read-back (I-69);
   `read_game(len)` on a non-empty file → empty-slot stamp, `present: false`, and
   a `game` CAS with it appends; `read_game(len + 1)` errors (I-62); a committed write whose
   post-commit read-back fails (existing read hook seam) returns success with `stamp: None`
   (I-61); empty file `read_game(0)` →
   `present: false` and its stamp saving back through `game` at `n == 0` (I-35, I-43);
   `Error::StaleGame` serialises as `ErrorPayload.category == "stale-game"` (paired with the
   renderer mapping test, I-50); `game` CAS match writes and returned stamp
   equals a following `read_game`; mismatch → `StaleGame`, file byte-identical; `append` at `len`
   succeeds, `StaleGame` after another append; no `replace` kind exists in the binding.
   Vitest — `saveToFile`: sends the tree stamp; `"conflict"` on `stale-game`; `"conflict"` with no
   `writeGame` call for a `null` stamp; an edit during the in-flight write — including a header-only
   edit — keeps `dirty` and stores the new stamp (I-36); a save completing after a game switch applies nothing and returns `"superseded"`, so
   save-and-close keeps the tab and page-switch does not replace the new game's edits;
   save-and-close with an edit during the write returns `"superseded"` and the tab stays open
   with the edit; failed Save-As leaves origin/tree/stamp untouched (I-44); ordinary Save-As
   writes the same slot as today through read-then-CAS; `BoardAnalysis` save `"conflict"` → conflict panel; manual save `"failed"` →
   notification; `ConfirmChangesModal` close-tab `"conflict"` → dialog closed, tab kept and active
   with the conflict panel; page-switch `"conflict"` → page not switched, tree intact, conflict
   panel; typed failure message shown (I-46); `FileCard` Open after the file changed seeds the fresh text; `addGame`:
   dirty → confirm modal, no write, and the edited tree intact while open and after cancel; the board is withheld (gate loader) while the append write is
   pending; success → origin at the new game, gate reloads it with its stamp (I-40); `StaleGame` → origin untouched; other failure → typed notification, origin untouched (I-45);
   `NewTabHome` recent open goes through `openFile` (I-47); `InfoPanel.setPage` with an edit
   during the load does not replace the tree (I-48); tabStorage: a valid `sourceStamp` survives
   write + rehydrate, a wrong-typed one and an absent one (pre-upgrade dirty tree) become `null`
   with the tree kept, and for `appendAttempted` (absent → `false`, wrong-typed → `true`, tree and
   `dirty` kept — I-78, I-80) (I-37); gate: unverified →
   loader, not board, until reconcile; equal → children, no tree write; clean+changed → replaced; clean with `sourceStamp: null` →
   the fresh disk tree is what renders (I-79);
   dirty+changed → conflict panel, board/`PracticePanel` not mounted, `saveToFile` not called,
   the store's tree still equals the edited tree;
   edit during in-flight reconcile → conflict, not reload, and the tree still equals the edit; stale result after unmount ignored;
   a reconcile result arriving after a poll invalidation (epoch changed) is ignored (I-49); a
   generic `readFileGame` failure keeps the gate withholding with message + Retry; a dirty tree
   with `sourceStamp: null` → conflict panel, not rendered; game gone / `present: false` for a
   non-empty stamp / `missing-resource` / path `conflict` → unavailable, while `present: false`
   with the empty-file stamp stays usable (`verified`); "Save my version as a new game…" appends at the counted
   index even when the original file is picked, the appended PGN equals the serialised edited
   tree, it moves the origin there and clears `dirty`;  
   `ConfirmChangesModal` Save on an `unavailable` tab runs the append action (I-64); a legacy
   `temp_file` user save with a changed or `null` source stamp → `"conflict"`, no picker; a
   source changed while the picker is open → `"conflict"`, no write (I-65); a Save-As finishing
   after a tab switch updates only its own tab (I-70); `appendAttempted` is flushed to tab storage before the native append
   is called, and a failed flush aborts the action with no write; an append with `stamp: None`,
   `CommittedDurabilityUncertain` or another error keeps origin, tree and `dirty`, and a second
   click — also after a simulated restart (store rehydrated from tab storage, including a crash
   right after the native call) — writes nothing; an append `StaleGame` clears the flag and leaves
   the action enabled (I-71); a failed pre-append flush writes nothing, clears the flag, reports
   the storage error, and a retry after storage recovers appends (I-82); while an append is
   pending (picker open or write held in flight) neither "Reload from disk" nor a second append
   starts, and while a reload is pending no append starts and the tree is replaced once (I-83,
   I-85); a save whose write returns `stamp: None` keeps `dirty`, returns `"conflict"`, and from
   the close dialog closes the dialog and shows the conflict panel (I-81); Add Game `StaleGame` refreshes the count and a retry appends and
   loads at the refreshed end; an uncertain Add Game leaves the origin on the old game even when
   the recount shows one more game (I-74); reconcile single-flight: repeated invalidations while a
   `readFileGame` is pending start no second native read, and exactly one queued reconcile runs
   after it settles (I-24); `addGame` while `appending`: the gate starts no reconcile read until the append settled
   (I-73); `CreateRepertoireModal` creates a tab with a file origin
   through `openFile`; cancelling its picker leaves the panel and the tree;
   closing a tab from the unavailable panel with a dirty tree prompts; a write returning
   `stamp: None` stores `sourceStamp: null` and marks the tab unverified; a panel action failing with
   `InvalidInput` → unavailable; `ImportModal` file select yields a tab with a file origin and the
   freshly read game; `RepertoireInfo` coverage completion leaves `dirty` untouched (I-54); each panel action,
   including a failing action (I-42).
   PROOF: `cargo test --manifest-path src-tauri/Cargo.toml && pnpm bindings:check && pnpm exec tsgo --noEmit && pnpm vitest run src/utils src/state src/platform src/components && pnpm tauri:boundary:check && pnpm ipc:consumers:check && pnpm ui:boundary:check && pnpm i18n:check && pnpm i18n:jsx`
2. **Poll** — `src-tauri/src/{pgn,main}.rs` (`file_revision`), `src/bindings/generated.ts`,
   `src/platform/tauri.ts`, `src/state/fileFreshness.ts` (poll), `src/routes/__root.tsx`.
   `--role sensitive`. Tests — Rust: `file_revision` changes after an in-place external write and
   after the app's own write (and the handle stays usable, phase 0), `missing-resource` after
   delete, `conflict` after an external rename-replace. Vitest (fake timers): a revision change is
   acted on within 2 s (active → unverified → reconciled; unmounted → unverified); a query pending
   at 2 s is aborted and its tabs withheld; repeated ticks while it stays unsettled issue **no**
   further native call and a mounted gate starts no reconcile read (`overdue`, entered directly);
   two tabs on two different files: a change to the second file is detected while the first is
   active (unmounted tab → unverified); two tabs sharing one handle are both withheld and reconciled on a change; the
   real poll with an `appending` tab (append held in flight) — for a changed revision, a rejected
   query and a timeout alike — changes nothing and starts no read, and the recorded outcome is
   applied after the append settles (I-73); when it finally settles, a fresh query verifies and releases the tabs
   (I-24); a generic rejection → unverified + retry next tick;
   focus → immediate tick; delete/replace → unavailable; runs with no `BoardsPage` mounted;
   interval, listener and controllers cleared on unmount; registry entry removed on tab close.
   PROOF: `cargo test --manifest-path src-tauri/Cargo.toml pgn && pnpm bindings:check && pnpm exec tsgo --noEmit && pnpm vitest run src/state src/routes src/components/tabs && pnpm ipc:consumers:check && pnpm lint:ci`
3. **Proofs in the real app and in pixels** — `scripts/verify-app.mjs`: the large-deck extension
   step keeps the restored tab and **does not reopen the file** (`closeRestoredAnalysisTab` and
   the `openFilesEntry` call there are removed; the helper is deleted with its last caller). It
   records `t0`, rewrites the PGN in place, and waits on the gate's `data-file-freshness`
   attribute (added in phase 1 on the gate wrapper: `verified|unverified|conflict|unavailable`
   plus a reload counter) until the restored tab has reloaded or shows the conflict panel; it
   asserts the elapsed time ≤ 2 s poll + the measured read time of that file, logged (I-01
   proof); if the conflict panel is shown it clicks "Reload from disk"; then the existing
   `loadPracticeDeckThroughIpc` wait for 12,500 positions proves the deck synced from the
   reloaded tree of the restored tab — the finding's exact scenario. Plus one Playwright spec for
   the conflict and unavailable panels, **registered in a `playwright.config.ts` project**
   (projects match explicit filenames, `playwright.config.ts:30-65`), snapshots recorded only in
   the pinned container (`d-20260919-13`). `--role normal`.
   PROOF: `node --check scripts/verify-app.mjs && pnpm test:e2e:container`, then the orchestrator
   runs `pnpm build && pnpm verify:app` once.

## Reviews

### Round 1 (r1, 2026-09-24) — 9 lenses (Codex gpt-6-luna), raw reports in `/tmp/build-767c276a-499c-41b8-8170-256aa14b7d5c/lens-*.txt`

Raw verdicts: plan REVISE, minimalism APPROVED, persisted-state REVISE, ipc-contract REVISE,
pgn-index REVISE, error-handling REVISE, tests REVISE, correctness REVISE, root-cause REVISE.

| ID | Claim | Witnesses | Disposition | Correction (r2) |
|---|---|---|---|---|
| I-01 | Focused tab stays stale until next save if file changes while app keeps focus | plan#1, correctness#1, persisted-state#1, pgn-index#2, root-cause#1 | Fix | Goal 2 + C: 2 s stat poll of open files; latency bound stated |
| I-02 | Restored tree renders / practice-syncs before async reconcile resolves; read failure leaves it shown | correctness#2, correctness#3, error-handling#1, root-cause#1 | Fix | Goal 2a + C gate: unverified tab renders loader until reconcile resolves |
| I-03 | Stampless (`None`) write is unconditional; manual save/close-save of a legacy dirty tab overwrites | correctness#4, persisted-state#2, pgn-index#1 | Fix | A: `expected` required; B: stampless origin → `"conflict"` without write |
| I-04 | `addGame` resets a dirty tree, discarding edits | correctness#5, plan#2 | Fix | Goal 5, B: dirty guard via ConfirmChangesModal |
| I-05 | Game removed externally (out of bounds) leaves stale tree | correctness#6 | Fix | C: `gone` dialog (keep as unsaved copy / close) |
| I-06 | `addGame` append at cached index overwrites a game appended meanwhile | correctness#7 | Fix | B: empty-slot stamp as `expected` |
| I-07 | Verifier comment correction is outside mandate | correctness#8, error-handling#4, minimalism#4, persisted-state#4, pgn-index#3 | Fix (moot) | Phase 3 replaces the workaround itself; the helper/comment go with it |
| I-08 | I/O-error notification not actionable | error-handling#2 | Fix | C: gate error shows backend-category message + Retry |
| I-09 | Commit succeeded but re-read failed reported as failure | error-handling#3 | Fix | A: success with `stamp: None` → tab unverified |
| I-10 | Phase 1 registers `read_game` without a production consumer → `ipc:consumers:check` red | ipc-contract#1 | Fix | Phase 1 now includes all consumers |
| I-11 | Parse eagerly on every reconcile | minimalism#1 | Fix | C: compare stamp first, parse only on reload |
| I-12 | Reconcile hook has one caller → inline | minimalism#2 | Skip | Superseded: the reconcile now has three callers (gate, poll, modal reload) in `fileFreshness.ts` |
| I-13 | `isStaleGameError` single caller | minimalism#3 | Skip | Two callers (`saveToFile`, `addGame`) |
| I-14 | Malformed stored stamp invalidates the tab, dropping its tree | persisted-state#3 | Fix | B: `.optional().catch(undefined)` + test |
| I-15 | Verifier has no sessionStorage decode helper | plan#3, tests#4 | Fix | Phase 3 asserts through the existing IPC deck helper instead |
| I-16 | Verifier proof does not show the deck syncs from the reloaded tree | plan#4 | Fix | Phase 3 keeps the restored tab and waits on 12,500 deck positions |
| I-17 | Phases 1–3 revisit the same writeGame call sites | plan#5 | Fix | Phases restructured: stamp layer (all consumers) / freshness / verifier |
| I-18 | No renderer test proves save passes the stamp and routes CAS failure to conflict | tests#1 | Fix | Phase 1 tests |
| I-19 | No FileCard fresh-read regression test | tests#2 | Fix | Phase 1 tests |
| I-20 | `read_game(0)` empty file untested | tests#3 | Fix | Phase 1 tests |

Round 1 elapsed ≈ 9 min wall (parallel). Opened 20, adopted (Fix) 18, skipped 2.

### Round 2 (r2 → correction r3, 2026-09-24) — 9 lenses + focused I-01 judgment (review-plan rung), raw in `$RUN_TMP/lens2-*.txt`, `lens-judge-i01.txt`

Raw verdicts: plan REVISE, minimalism APPROVED, persisted-state REVISE, ipc-contract REVISE,
pgn-index REVISE, error-handling REVISE, tests REVISE, correctness REVISE, root-cause REVISE.
Focused judgment on I-01: `JUDGMENT: BOUNDED-POLL-OK (92)` — bounded latency is the only
achievable reading; 2 s stat poll acceptable; obligations: end-to-end bound tested incl.
delayed polls and rename-replace; dirty conflict must not be shown/synced/saved.

Closure checks r2: CLOSED — I-03, I-04, I-05, I-06 (correctness); I-08, I-09 (error-handling);
I-10 (ipc); I-11 (minimalism); I-14 (persisted-state); I-15, I-16 (plan); I-19, I-20 (tests);
I-02 (root-cause) but STILL-OPEN per correctness/error-handling (dirty conflict renders
children) → re-corrected in r3. STILL-OPEN — I-01 (all), I-07 (correctness/minimalism: helper
removal) , I-17 (plan: BoardAnalysis in two phases), I-18 (tests: consumer wiring untested).

| ID | Claim | Witnesses | Disposition | Correction (r3) |
|---|---|---|---|---|
| I-01 | (cont.) 2 s window vs "never" | correctness#1, error-handling#1, persisted-state#1, plan#2, root-cause#1, tests#1 | Fix per judgment | Goal 2: bound defined end-to-end, overdue poll withholds; phase 2 fake-timer tests assert it |
| I-02 | (cont.) dirty conflict renders children → PracticePanel syncs stale tree | correctness#3, persisted-state#2, plan#2, error-handling#2 | Fix | Goal 3/C: `conflict` state renders inline panel instead of board; tested |
| I-07 | (cont.) helper removal is cleanup | correctness nit, minimalism#1 | Skip | Only caller is removed in phase 3; leaving an uncalled helper is dead code, not scope expansion; evidence line corrected |
| I-17 | (cont.) BoardAnalysis in two phases | plan#6 | Fix | Phase 2 no longer touches BoardAnalysis; overlap on pgn/main/bindings/fileFreshness justified by ipc consumer check |
| I-18 | (cont.) conflict consumer wiring untested | tests#2, plan#5 | Fix | Phase 1 tests for BoardAnalysis and ConfirmChangesModal `"conflict"` |
| I-21 | Poll mounted in BoardsPage stops on other routes | correctness#2 | Fix | Poll started from `__root.tsx`; test with no BoardsPage |
| I-22 | Edit during in-flight reconcile silently replaced | correctness#4 | Fix | C: re-check dirty/root identity before `setState` |
| I-23 | Append CAS failure after `reset()` leaves default tree on old game | correctness#5 | Fix | B: reset only after successful append |
| I-24 | Active-tab reconcile failure / rejected `fileRevision` leaves stale tree shown | error-handling#2, plan#3 | Fix | C: errors keep `unverified` (gate withholds); deleted/replaced → `unavailable` |
| I-25 | Save-As read failure / manual save failure unnotified | error-handling#3 | Fix | B: Save-As uses `replace` (no pre-read); manual `"failed"` notifies |
| I-26 | `fileRevision` in phase 1 without consumer | ipc#1 | Fix | moved to phase 2 with the poll |
| I-27 | Poll inactive tabs is unneeded | minimalism#2 | Skip | Needed so an unmounted tab changed while inactive is withheld at activation without an extra blocking stat on every tab switch; also required for the gone/replaced state |
| I-28 | Save-As destination pre-read outside mandate | minimalism#3 | Fix | `replace` expectation, no pre-read |
| I-29 | New stamp in workspace + old tree after lost debounced write | persisted-state#3 | Fix | stamp moved into TreeState (one write) |
| I-30 | No renderer way to obtain the append-slot stamp | pgn-index#1, plan#4 | Fix | `WriteExpectation` `append` kind checked natively |
| I-31 | Rename-replace breaks handle identity; poll cannot see it | pgn-index#2, plan#1, judge | Fix | `conflict` from resolution → `unavailable`; Rust + vitest tests |
| I-32 | Deleted file never routed to gone | plan#3, tests#3 | Fix | `missing-resource` → `unavailable`; tests |
| I-33 | Visible UI without pixel proof | tests#4 | Fix | phase 3 Playwright spec in the container |
| I-34 | CAS not atomic against another process (judge) | judge | Skip (residual stated) | No cross-process lock exists on these platforms; window = one rename; stated in Goal 4 |

Round 2 elapsed ≈ 11 min wall + judgment 4 min. Opened 14 new (I-21..I-34), adopted 12, skipped 3 (I-07 cont., I-27, I-34).

### Round 3 (r3 → correction r4, 2026-09-24) — 10 lenses (+ chess-semantics, newly affected), raw in `$RUN_TMP/lens3-*.txt`

Raw verdicts: plan REVISE, minimalism APPROVED, persisted-state REVISE, ipc-contract REVISE,
pgn-index REVISE, error-handling REVISE, tests REVISE, correctness REVISE, root-cause REVISE,
chess-semantics APPROVED.

Closure checks r3: CLOSED — I-01 (design; correctness, persisted-state, pgn-index, tests, chess,
plan), I-17, I-18, I-21, I-22, I-23, I-26, I-28, I-30, I-32, I-33 (tests: open again → I-39),
I-10, I-11, I-12 (minimalism: closed in substance), I-07 (minimalism, correctness). STILL-OPEN —
I-01 proof (root-cause: no real-app timing), I-02 ("Keep my version": plan, root-cause), I-24
(plan, error-handling: generic poll rejection), I-25 (plan: untested, minimalism: out of scope),
I-29 (plan: valid stamp persistence untested), I-31 (plan: app's own rename), I-16 reopened
(plan: verifier still reopens through FileCard).

| ID | Claim | Witnesses | Disposition | Correction (r4) |
|---|---|---|---|---|
| I-01 | (proof) bound not measured in the real app | root-cause#2 | Fix | phase 3 measures write→gate-state elapsed via `data-file-freshness` |
| I-02 | (cont.) "Keep my version" leaves verified stale tree; autosave/practice | plan#2, root-cause#1 | Fix | actions: Reload / Overwrite now (CAS) / Keep as unsaved copy |
| I-16 | (reopened) verifier reopens via FileCard, bypassing the restored tab | plan#4 | Fix | phase 3 removes the `openFilesEntry` call; waits on restored tab |
| I-24 | (cont.) generic poll rejection / never-settling query | plan#5, error-handling#1 | Fix | C poll: other rejections → unverified + retry; 2 s abort |
| I-25 | (cont.) manual-save notification: untested / out of scope | plan#7, minimalism nit, error-handling#3 | Fix | kept (adopted in r2 under the async-rule error path); typed error surfaced; test on `userSaveFile` |
| I-29 | (cont.) valid stamp persistence untested | plan#6, persisted-state#1 | Fix | I-37 test |
| I-31 | (cont.) app's own atomic rename breaks `PersistentFile` handle | plan#1 | Fix | new phase 0 rebind (I-41) |
| I-35 | empty-file save cannot match `game` CAS | correctness#1, ipc#1, pgn-index#1 | Fix | `game` at `n == len` compares against "" |
| I-36 | edit during in-flight save marked clean | correctness#2, plan#3 | Fix | root-identity check before `store.save` |
| I-37 | contradictory no-key test vs migrate-to-null | persisted-state#1, plan#6 | Fix | test replaced: valid stamp survives rehydrate; wrong-typed → null |
| I-38 | close-tab dialog has no outcome for `"conflict"` | error-handling#2 | Fix | dialog closes, tab activated with conflict panel; test |
| I-39 | new Playwright spec not selected by any project | tests#1 | Fix | register in `playwright.config.ts` |
| I-40 | addGame success path untested | tests#2 | Fix | addGame reworked (gate + reload) and tested |
| I-41 | picked-file handle dead after app's own save (pre-existing, measured inode change) | plan#1 | Fix (dependency, same-area direct dependency per rule 4b) | phase 0 |
| I-42 | conflict-panel action failures unhandled | error-handling#4 | Fix | C panel: failure transitions |

Round 3 elapsed ≈ 12 min wall. Opened 8 new (I-35..I-42), adopted 15 corrections, 0 skipped.
Measurement for I-41 (rule 12b): `echo a > f; stat -c %i f` → 10523041; `mv t f` → 10523042;
`echo c > f` → 10523042.

### Round 4 (r4 → correction r5, 2026-09-24) — 10 lenses (+ tauri-security, newly affected by phase 0), raw in `$RUN_TMP/lens4-*.txt`

Raw verdicts: plan REVISE, minimalism REVISE, persisted-state REVISE, ipc-contract REVISE,
pgn-index REVISE, error-handling APPROVED, tests REVISE, correctness REVISE, root-cause REVISE,
tauri-security REVISE.

Closure checks r4: CLOSED — I-01 (all), I-16, I-25 (all but persisted-state), I-29, I-31, I-35,
I-37, I-38, I-39, I-40, I-41 (design), I-42 (error-handling, security); STILL-OPEN — I-02
(overwrite action: root-cause, plan), I-24 (never-settling query, late reconcile: plan,
error-handling), I-36 (header-only edit: correctness, plan), I-41 proof (cargo filters), I-42
(correctness: `InvalidInput`).

| ID | Claim | Witnesses | Disposition | Correction (r5) |
|---|---|---|---|---|
| I-02 | "Overwrite with my version" writes stale-based text over newer disk | root-cause#1, plan#1 | Fix | action removed; reload or detach; Save-As is the explicit route |
| I-24 | never-settling `fileRevision` blocks the slot | plan#4, error-handling#1 | Fix | slot released at deadline; generation ignores late result; test |
| I-36 | header-only edit during save cleared | correctness#1, plan#2 | Fix | re-serialise-and-compare after write; header test |
| I-41 | phase 0 proof: two cargo filters | correctness#4, tauri-security#1, tests#1, plan#5 | Fix | split invocations |
| I-42 | panel action `InvalidInput` not routed to unavailable | correctness#3 | Fix | added |
| I-43 | empty-file special case masks deleted game 0 | pgn-index#1 | Fix | `present` flag |
| I-44 | Save-As switches origin before write | persisted-state#1 | Fix | origin after success; test |
| I-45 | addGame non-stale failures unspecified | error-handling#2 | Fix | typed notification, refresh count, reconcile |
| I-46 | close/page-switch dialog loses typed failure | error-handling#3 | Fix | typed message; test |
| I-47 | NewTabHome duplicates openFile | minimalism#1 | Fix | routed through openFile (rule 11, second copy) |
| I-48 | InfoPanel.setPage replaces a tree edited during load | correctness#2 | Fix | final dirty re-check; test |
| I-49 | reconcile after poll invalidation marks verified | plan#3 | Fix | per-tab epoch; test |
| I-50 | no proof Rust serialises `stale-game` | ipc#1 | Fix | Rust serialisation test |
| I-51 | absent-stamp (pre-upgrade) hydration untested | persisted-state#2 | Fix | folded into I-37 test |
| I-52 | manual-save notification out of mandate | persisted-state#3 | Skip | I-25 kept under the async-resource rule's error-path clause; closed by 8 of 9 lenses |
| I-53 | tests: generic reconcile failure; addGame cancel keeps tree; page-switch conflict | tests#2-4 | Fix | added |

Round 4 elapsed ≈ 14 min wall. Opened 11 new (I-43..I-53), adopted 16, skipped 1.

### Round 5 (r5 → correction r6, 2026-09-24) — 10 lenses, raw in `$RUN_TMP/lens5-*.txt`

Raw verdicts: plan REVISE, minimalism REVISE, persisted-state REVISE, ipc-contract REVISE,
pgn-index REVISE, error-handling APPROVED, tests REVISE, correctness REVISE, root-cause REVISE,
tauri-security REVISE.

Closure checks r5: CLOSED — I-41, I-42 (all but tests), I-44..I-53 (plan), I-47 (minimalism),
I-50 (ipc), I-36 (ipc, security, tests), I-24 (correctness, ipc, security). STILL-OPEN — I-02
(Goal 4 leftover text; Save-As `replace` after detach: minimalism, persisted-state, tests, plan,
root-cause, security), I-24 (native accumulation: plan, root-cause, error-handling), I-36
(game switch during save; save-and-close: correctness, plan), I-43 (`present` dropped by the
loader: correctness, ipc, pgn-index).

| ID | Claim | Witnesses | Disposition | Correction (r6) |
|---|---|---|---|---|
| I-02 | Goal 4 leftover "Overwrite file"; `replace` reachable after detach / with any handle | minimalism#1, persisted-state#1-2, tests#1, plan#1,#4, root-cause#1, tauri-security#1 | Fix | text fixed; `replace` kind removed; Save-As appends via `append` CAS |
| I-24 | released slot lets cancelled native reads accumulate to the 128 cap | plan#2, root-cause#2, error-handling#1, tests#5 | Fix | at most one outstanding native query per handle; overdue → withheld until it settles; test |
| I-36 | save completing after a game switch / save-and-close with an edit during the write | correctness#1, plan#3 | Fix | origin captured; `"superseded"` result keeps the tab open |
| I-43 | `present` dropped by `readFileGame` | correctness#2, ipc#1, pgn-index#1 | Fix | carried through; reconcile branch |
| I-54 | `RepertoireInfo` clears `dirty` without saving → silent reload of edits | plan#5 | Fix (same-area, now a MANDATE path) | tracks its own last-computed root; test |
| I-55 | tests: dirty null-stamp gate, keep-as-copy outcome, ImportModal origin, `InvalidInput` action | tests#2-4,#6 | Fix | added |
| I-56 | orphaned tree key when rollback removal throws (`tabs.ts:83`) | persisted-state#3 | Defer | pre-existing quota leak on a double failure, not a stale-text path; filed as its own finding |

Round 5 elapsed ≈ 17 min wall. Opened 3 new (I-54..I-56), adopted 6 corrections, deferred 1.

### Round 6 (r6 → correction r7, 2026-09-24) — 10 lenses, raw in `$RUN_TMP/lens6-*.txt`

Raw verdicts: plan REVISE, minimalism REVISE, persisted-state REVISE, ipc-contract APPROVED,
pgn-index REVISE, error-handling REVISE, tests APPROVED, correctness REVISE, root-cause REVISE,
tauri-security REVISE.

Closure checks r6: CLOSED — I-02 (all), I-43 (all), I-54 (all), I-55 (all), I-24 (correctness,
ipc, minimalism, persisted-state, pgn-index, security, tests), I-36 (correctness, ipc,
minimalism, persisted-state, pgn-index, security, tests). STILL-OPEN — I-24 (gate reconcile
during a pending poll: plan, root-cause, error-handling), I-36 (no non-saving result on origin
change: plan, root-cause, error-handling).

| ID | Claim | Witnesses | Disposition | Correction (r7) |
|---|---|---|---|---|
| I-24 | gate reconcile verifies while the timed-out poll is still pending | plan#2, root-cause#1, error-handling#1 | Fix | `overdue` state: gate starts no read until the query settled and a fresh one answered |
| I-36 | origin change during save has no non-saving result | plan#3, root-cause#2, error-handling#2 | Fix | `"superseded"`; save-and-close and page-switch tests |
| I-57 | Save-As → append is a user-visible change outside the MANDATE | correctness#1, minimalism#1, persisted-state#1, pgn-index#1, plan#5, root-cause#3, tauri-security#1 | Fix | ordinary Save-As keeps its slot as read-then-CAS; append only in the conflict action |
| I-58 | detached dirty copy closes without prompt | plan#4 | Fix | detach removed; "Save my version as a new game…" keeps the tab file-backed |
| I-59 | review input FILES list incomplete | plan#1 | Fix | full list supplied from r7 |
| I-60 | `read_game` stamp test self-consistent only; needs a multi-game BOM/CRLF fixture | pgn-index#2 | Fix | added |
| I-61 | tests: empty-file `present:false` stays usable; `stamp: None` path; append retry | tests#1-3 | Fix | added |

Round 6 elapsed ≈ 20 min wall. Opened 5 new (I-57..I-61), adopted 7 corrections.

### Round 7 (r7 → correction r8, 2026-09-24) — 9 lenses (ipc-contract APPROVED in r6 and untouched by r7: no command/type change), raw in `$RUN_TMP/lens7-*.txt`

Raw verdicts: plan REVISE, minimalism APPROVED, persisted-state REVISE, pgn-index REVISE,
error-handling APPROVED, tests REVISE, correctness REVISE, root-cause REVISE, tauri-security
APPROVED.

Closure checks r7: CLOSED — I-24 (all but persisted-state), I-36 (all), I-57 (all), I-58 (all),
I-59 (all but plan), I-60 (all), I-61 (all but plan). STILL-OPEN — I-24 (persisted-state:
`unverified` before `overdue`), I-59 (plan: test files), I-61 (plan: native `stamp: None` test).

| ID | Claim | Witnesses | Disposition | Correction (r8) |
|---|---|---|---|---|
| I-24 | timeout transitions through `unverified` first | persisted-state#1 | Fix | direct to `overdue` |
| I-59 | test files not listed | plan#1 | Fix | colocated tests named |
| I-61 | native `stamp: None` path untested | plan#3 | Fix | Rust test via read hook seam |
| I-62 | read-then-CAS cannot stamp `n == count` of a non-empty file | correctness#1, pgn-index#1, root-cause#2 | Fix | end slot of any file readable, `present: false` |
| I-63 | append `stamp: None` marks tree clean/verified | persisted-state#2 | Fix | stays dirty, unverified → conflict |
| I-64 | Save from the close prompt of an unavailable tab does not append | plan#2 | Fix | modal routes to the append action; test |
| I-65 | legacy `temp_file` Save-As can write a stale tree over its own source | root-cause#1 | Fix | source stamp verified before the picker |
| I-66 | autosave failures unsurfaced | error-handling#1 | Fix | one notification per distinct error |
| I-67 | automatic append retry unnecessary | minimalism#1 | Fix | removed; user retries |
| I-68 | tests: dirty tree survives conflict; appended text equals edits; multi-file poll; CreateRepertoireModal origin | tests#1-3 | Fix | added |

Round 7 elapsed ≈ 17 min wall. Opened 7 new (I-62..I-68), adopted 10.

### Round 8 (r8 → correction r9, 2026-09-24) — 8 lenses (tauri-security APPROVED r7, untouched), raw in `$RUN_TMP/lens8-*.txt`

Raw verdicts: plan REVISE, persisted-state APPROVED, pgn-index REVISE, tests REVISE, correctness
REVISE, root-cause REVISE, minimalism APPROVED, error-handling REVISE.

Closure checks r8: CLOSED — I-24 (all but plan), I-59 (all but plan), I-61..I-64, I-67, I-68
(all); I-65 (pgn-index); I-66 (correctness, error-handling). STILL-OPEN — I-24 (plan: pending
`readGame` accumulation), I-59 (plan: FILES input), I-65 (correctness, root-cause: picker race),
I-66 (pgn-index, plan, root-cause: out of scope).

| ID | Claim | Witnesses | Disposition | Correction (r9) |
|---|---|---|---|---|
| I-24 | pending reconcile reads accumulate on repeated invalidation | plan#1 | Fix | reconcile single-flight per tab; test |
| I-59 | FILES input omits test files | plan#2 | Fix | supplied from r9 |
| I-65 | source changes while the picker is open | correctness#2, root-cause#1, tests#1 | Fix | source re-check after picker; null-stamp and picker-race tests |
| I-66 | autosave notification out of scope | pgn-index#1, plan#3, root-cause#2 | Withdrawn | removed; autosave policy unchanged |
| I-69 | post-commit read-back can attribute a later external write to this save | correctness#1 | Fix | stamp from the written temporary before install |
| I-70 | Save-As completion attaches destination to the tab active at completion | correctness#3 | Fix | bound to its own tab id |
| I-71 | append after `stamp: None` / durability-uncertain can duplicate the game | error-handling#1 | Fix | read-back resolution, button disabled while resolving |
| I-72 | tests: addGame board withheld during append; in-flight reconcile keeps the edit | tests#2-3 | Fix | added |

Round 8 elapsed ≈ 18 min wall. Opened 4 new (I-69..I-72), adopted 8 corrections, 1 withdrawal.

### Round 9 (r9 → correction r10, 2026-09-24) — 6 lenses, raw in `$RUN_TMP/lens9-*.txt`

Raw verdicts: plan REVISE, pgn-index REVISE, tests REVISE, correctness REVISE, root-cause
REVISE, error-handling REVISE.

Closure checks r9: CLOSED — I-24 (all but tests), I-59 (all but plan), I-65 (all), I-69
(correctness, error-handling, pgn-index, tests), I-70 (all), I-72 (all but correctness).
STILL-OPEN — I-24 (tests: queued rerun), I-59 (plan), I-69 (plan: temporary is write-only;
root-cause: stale test wording), I-71 (error-handling, pgn-index, plan, root-cause), I-72
(correctness: gate reconcile races the append).

| ID | Claim | Witnesses | Disposition | Correction (r10) |
|---|---|---|---|---|
| I-24 | queued rerun after settle untested | tests#1 | Fix | test added |
| I-59 | FILES omits existing suites (BoardAnalysis, RepertoireInfo, InfoPanel, NewTabHome, CreateRepertoireModal, BoardsPage) | plan#3 | Fix | supplied from r10 |
| I-69 | temporary is write-only (`fs.rs:1574-1584`); test targets removed read-back | plan#1, root-cause#3, tests#2 | Fix | post-commit read-back accepted only when it equals the submitted text (trimmed), else `None`; tests |
| I-71 | append recovery: read-back error, generic post-commit errors, newline normalisation, uncertain treated as durable | error-handling#1, pgn-index#1, plan#2, root-cause#1-2 | Fix | action one-shot per conflict; any non-stamped outcome keeps dirty tree and disables it; no read-back comparison |
| I-73 | Add Game: gate reconcile verifies the old game while the append is pending | correctness#1 | Fix | `appending` state, no reconcile until the write resolved; test |

Round 9 elapsed ≈ 16 min wall. Opened 1 new (I-73), adopted 5 corrections.

### Round 10 (r10 → correction r11, 2026-09-24) — 6 lenses, raw in `$RUN_TMP/lens10-*.txt`

Raw verdicts: plan REVISE, pgn-index APPROVED, tests REVISE, correctness REVISE, root-cause
REVISE, error-handling REVISE.

Closure checks r10: CLOSED — I-24, I-59, I-69 (all); I-71 (error-handling, pgn-index, plan,
tests); I-73 (error-handling, pgn-index, tests). STILL-OPEN — I-71 (correctness, root-cause:
lockout lost on restart), I-73 (correctness, plan: poll overrides `appending`).

| ID | Claim | Witnesses | Disposition | Correction (r11) |
|---|---|---|---|---|
| I-71 | append lockout is in memory only; a restart re-enables a possibly committed append | correctness#1, root-cause#1 | Fix | persisted `appendAttempted` in the tree state; restart test |
| I-73 | poll moves an `appending` tab to `unverified` | correctness#2, plan#1 | Fix | poll records, does not transition, while `appending`; test in phase 2 with the real poll |
| I-74 | Add Game retry after uncertain commit duplicates; `StaleGame` keeps a stale count | error-handling#1-2 | Fix | recount; one more game → origin moves; `StaleGame` refreshes count |
| I-75 | conflict-append `StaleGame` wrongly disables the action | error-handling#3 | Fix | stays enabled |
| I-76 | two tabs sharing one handle untested | plan#2 | Fix | phase 2 test |
| I-77 | phase-1 proof filter `pgn` skips the `error.rs` serialisation test | tests#1 | Fix | full `cargo test` in the phase-1 proof |

Round 10 elapsed ≈ 30 min wall (root-cause leaf ran 28 min). Opened 4 new (I-74..I-77), adopted 6.

### Round 11 (r11 → correction r12, 2026-09-24) — 6 lenses (+ persisted-state, newly affected by `appendAttempted`), raw in `$RUN_TMP/lens11-*.txt`

Raw verdicts: plan REVISE, tests REVISE, correctness REVISE, root-cause REVISE, error-handling
REVISE, persisted-state REVISE.

Closure checks r11: CLOSED — I-75, I-76, I-77 (all); I-71 (correctness, plan, tests); I-73
(root-cause, persisted-state, tests); I-74 (persisted-state). STILL-OPEN — I-71 (error-handling,
persisted-state, root-cause: marker set after the call and debounced), I-73 (correctness, plan,
error-handling: poll errors/timeouts release `appending`), I-74 (correctness, error-handling,
plan, root-cause: a count delta cannot identify whose append landed; tests: retry index).

| ID | Claim | Witnesses | Disposition | Correction (r12) |
|---|---|---|---|---|
| I-71 | lockout set after the append and flushed lazily | error-handling#1, persisted-state#1, root-cause#1 | Fix | flag set and flushed before the native call; failed flush aborts; crash test |
| I-73 | poll rejection/timeout still leaves `appending` | correctness#1, plan#1, error-handling#3 | Fix | every poll outcome deferred while `appending`; tests |
| I-74 | recount-and-move can adopt another program's game; retry index untested | correctness#2, error-handling#2, plan#2, root-cause#2, tests#2 | Fix | recount-and-move removed; uncertain Add Game notifies only; a possible duplicate blank game on a later click is accepted (no user text involved, nothing stale — outside the MANDATE) |
| I-78 | `appendAttempted` migration untested | plan#3 | Fix | absent/wrong-typed → `false`, tree kept |
| I-79 | clean null-stamp reload untested | tests#1 | Fix | added |

Round 11 elapsed ≈ 14 min wall. Opened 2 new (I-78, I-79), adopted 5.

### Round 12 (r12 → correction r13, 2026-09-24) — 6 lenses, raw in `$RUN_TMP/lens12-*.txt`

Raw verdicts: plan REVISE, tests APPROVED, correctness REVISE, root-cause REVISE, error-handling
REVISE, persisted-state REVISE.

Closure checks r12: CLOSED — I-73, I-74, I-79 (all); I-71 (correctness, persisted-state,
root-cause, tests); I-78 (error-handling, persisted-state, plan, root-cause, tests). STILL-OPEN —
I-71 (error-handling, plan), I-78 (correctness: wrong-typed marker re-enables).

| ID | Claim | Witnesses | Disposition | Correction (r13) |
|---|---|---|---|---|
| I-80 | wrong-typed `appendAttempted` migrates to `false`, re-enabling a possibly committed append | correctness#1, error-handling#1 | Fix | absent → false, wrong-typed → true (fail closed) |
| I-81 | save with read-back `None` clears dirty; an external write right after the save then silently replaces the user's text | root-cause#1 | Fix | `None` keeps dirty, `"superseded"`, conflict panel; test |
| I-82 | failed pre-append flush leaves the marker set with no message | error-handling#2, persisted-state#1 | Fix | clear marker, `flush({notify:true})`, retry; test |
| I-83 | "Reload from disk" can run during a pending append | plan#1 | Fix | panel actions mutually exclusive while one is pending; test |
| I-84 | corrupt tree blob → clean default → edits lost (pre-existing hydration) | persisted-state#2 | Defer | not a stale-text path and no worse under this plan; filed as its own finding (inbox `20260924-112918-…`) |

Round 12 elapsed ≈ 14 min wall. Opened 5 new (I-80..I-84), adopted 4, deferred 1.

### Round 13 (r13 → correction r14, 2026-09-24) — 5 lenses, raw in `$RUN_TMP/lens13-*.txt`

Raw verdicts: plan REVISE, correctness APPROVED, root-cause APPROVED, error-handling REVISE,
persisted-state APPROVED.

Closure checks r13: CLOSED — I-78, I-80, I-81, I-82 (all); I-71 (correctness, error-handling,
persisted-state, root-cause); I-83 (correctness, error-handling, persisted-state, root-cause).
STILL-OPEN — I-71 (plan: survival across a new app session), I-83 (plan: converse direction).

| ID | Claim | Witnesses | Disposition | Correction (r14) |
|---|---|---|---|---|
| I-71 | restart proof only rehydrates; sessionStorage survival across a new app session unproven | plan#1 | Skip (evidence) | `verify-app.mjs:1211-1226` `reopenAssertionSession` closes the real app, starts a new process and restores tabs from the same storage — the survival this relies on is already proven in the real app, and phase 3's scenario runs on exactly such a restored tab |
| I-83 | converse (append during pending reload) untested | plan#2 | Fix | test added |
| I-85 | the pending append action itself can be re-invoked while its picker is open | error-handling#1 | Fix | guard from invocation covers every action including the invoked one |
| I-86 | `stamp: None` save reported as `"superseded"` misstates the cause in the close dialog | error-handling#2 | Fix | `"conflict"`; close-dialog test |

Round 13 elapsed ≈ 12 min wall. Opened 2 new (I-85, I-86), adopted 3, skipped 1 with evidence.

### Round 14 (r14, closure check, 2026-09-24) — plan, error-handling; raw in `$RUN_TMP/lens14-*.txt`

Raw verdicts: plan APPROVED, error-handling APPROVED. CLOSED: I-71 (Skip confirmed by plan),
I-83, I-85, I-86. Every adopted correction I-01..I-86 has a recorded closure check; open: none.
Skips: I-07, I-12, I-13, I-27, I-34, I-52, I-71 (restart evidence). Deferred and filed: I-56,
I-84. Withdrawn: I-66. Plan review closed at r14.

Totals: 14 completed rounds; 86 unique issues opened, 86 resolved (Fix 74, Skip 8, Defer 2,
Withdrawn 1, focused judgment 1 on I-01). Wall ≈ 3 h 40 min of review elapsed (parallel lenses,
no quota waits).

## Cumulative diff review (step 6, 2026-09-24) — 11 lenses on `225a9814..3d0627ec`, Codex gpt-6-luna (same family as the phase writer; orchestrator is Claude and arbitrates), raw in `$RUN_TMP/lens-rev-*.txt`

Raw verdicts: correctness REVISE, root-cause APPROVED, tests REVISE, code-quality APPROVED,
error-handling REVISE, minimalism REVISE, persisted-state APPROVED, ipc-contract APPROVED,
pgn-index REVISE, tauri-security APPROVED, chess-semantics REVISE.

Correction to the plan record: I-71's Skip evidence was wrong. `reopenAssertionSession` restores
the authority registry, not tabs; measured in `verify:app` on 2026-09-24 (renderer-state dump):
after a real restart only "New Tab" exists, because the workspace lives in `sessionStorage`,
which WebKitGTK does not keep past the process. Tabs are restored only across a webview
reload, so `appendAttempted` still matters there; the finding's "restored from the previous
session" premise does not occur on this platform, while mid-session staleness, the stale
FileCard preview and the overwriting save were real.

| ID | Finding | Verdict |
|---|---|---|
| R-01 | legacy null-stamp tree marked clean by the old RepertoireInfo bug is silently reloaded (chess-semantics) | Fix A |
| R-02 | null-stamp clean tree + empty file shows a blank game (correctness) | Fix A |
| R-03 | PgnInput drops `sourceStamp` (chess-semantics) | Fix B |
| R-04 | poll during the app's own rename→rebind window marks the tab unavailable forever (pgn-index) | Fix C |
| R-05 | scan→commit revision conflict on save marks the tab unavailable (correctness) | Fix D |
| R-06 | Add Game advances origin on `stamp: null` (correctness) | Fix E |
| R-07 | recount failure after `StaleGame` swallowed (error-handling) | Fix E |
| R-08 | unavailable-save failure generic in the modal (error-handling) | Fix F |
| R-09 | duplicated panel markup; triplicated origin comparison; unused `createTab` option; unused `require_durable` generalisation (minimalism) | Fix G |
| R-10 | flush-failure, action-failure and Add Game retry tests missing (tests) | Fix E/H |
| R-11 | verifier header table / named interval (code-quality) | Fix I |
| R-12 | new verifier checks lack staged-failure rows; `verify:app` not run (tests, root-cause) | Fix — orchestrator stages and runs |
| R-13 | ImportModal materialises the whole PGN (pgn-index) | Skip — pre-existing, already `f-20260908-04` |
| R-14 | vendored `scripts/findings.py` semantics untested here (tests) | Skip — agent-kit owns the behaviour suite; this repo pins byte parity by contract (`pnpm findings:kit:check`) |
| R-15 | `verify:app` red: restored tab never appears after restart | Fix I — scenario reworked to the mid-session case (see correction above) |

### Repair re-review (`3d0627ec..99ebb375`, 7 lenses) and closure round (`99ebb375..88d82829`, 5 lenses), 2026-09-24

Re-review raw verdicts: correctness REVISE, chess-semantics APPROVED, pgn-index REVISE,
error-handling REVISE, minimalism REVISE, tests REVISE, code-quality APPROVED. R-01..R-11 CLOSED
by their witnesses. New: Add Game after a Save-As appended to the old file (correctness) — Fix,
0712448a; post-append count error swallowed (error-handling) — Fix; write-tracking wrapper
repeated (minimalism) — Fix (`writeFileGame`); tests via production writers and the real modal
action — Fix; `delete_game` without a stamp expectation (pgn-index) — Defer, filed (inbox
`20260924-175708-…`); orchestrator-found: every save withheld the board at the next poll — Fix,
99ebb375 (`WriteStamp.revision`).

Closure raw verdicts: correctness REVISE, error-handling REVISE, minimalism REVISE, tests REVISE,
code-quality REVISE. Dispositions: open/parse race verified at R0 until the next poll — Skip,
settled bounded-latency reading (I-01); cross-process check→rename window — Skip, recorded
residual (I-34, d-20260924-02); retried delete after a failed rebind — Defer to the `delete_game`
expectation finding (a stamped delete refuses the retry); setPage read failure leaves the old
game verified — Skip, the tree still matches its unchanged origin; uncertain Add Game message,
unbound Save-As `"conflict"` notice, `withFileWrite` for delete, recovery-timeout constant and
stage label, InfoPanel revision assertion — Fix, this commit. Real-app freshness proof and its
five staged-failure rows — Defer: `verify:app` aborts at a pre-existing step on every build
including the unchanged `3d0627ec` tree (control run), filed as an environment finding (inbox
`20260924-183629-…`); pixel proof via `e2e-container` runs in the final gates.

Totals across code review: three passes, 22 distinct findings (R-01..R-15 + 7 re-review/closure),
Fix 17, Skip 4, Defer 3 (filed).

### Push-resume delta review (`88d82829..e641f628`, 6 lenses) and two closure rounds, 2026-09-24

The first push attempt stopped on kit parity; the drain resumed the session after `e641f628`
re-vendored the kit. The commits after the last review pass (`69d5c3b5` stamp pattern and
`Tab.Close` reuse, `83108b9d` bundle ceiling, `6113e7cb`, ledger/handoff records) were reviewed;
`scripts/findings.py` stays out of scope (kit-owned, byte parity proven by `findings:kit:check`).

Delta raw verdicts: correctness REVISE, root-cause REVISE, tests APPROVED, persisted-state
APPROVED, code-quality APPROVED, minimalism APPROVED. Dispositions: the 2 s window between an
external edit and the next poll (root-cause) — Skip, settled bounded-latency reading (I-01,
BOUNDED-POLL-OK); a Save-As destination's `missing-resource`/`invalid-input` marked the tab
unavailable and claimed "may have been written" (correctness) — Fix, `f5975b94`; the
`withFileWrite` rejection path (tests) — Skip, `files.test.ts` "writeFileGame tracks the write
through rejection" already asserts the poll resumes; file-backed Save conflict notice unproven
(tests), positional hotkey lookup (code-quality), one-caller `isStamp` (minimalism) — Fix,
`f5975b94`.

Closure 1 raw verdicts (`f5975b94`): correctness REVISE, tests REVISE, minimalism APPROVED,
code-quality APPROVED. Both REVISEs were one defect: `commit_pgn_mutation` returned the
capability rebind's raw error after the replacement was installed, so a registry `Io(NotFound)`
surfaced as `missing-resource` for a written game — Fix, `9b69a11b`: every post-replacement
failure (rebind, cache invalidation) is `CommittedDurabilityUncertain` with its own stage, and a
save of the tab's own file then drops the stamp so the gate verifies by text.

Closure 2 raw verdicts (`e641f628..9b69a11b`): correctness, root-cause, error-handling,
ipc-contract, pgn-index APPROVED; tests REVISE (invalidation branch unproven) — Fix, `10893c3a`;
error-handling should-fix (warnings lacked the file identity) — Fix, `10893c3a`. Closure 3
(`10893c3a`): tests and error-handling APPROVED, both findings CLOSED.

Totals for the resumed push: 9 distinct findings, Fix 7, Skip 2, Defer 0. All lenses Codex
`gpt-6-luna`; the orchestrator (Claude) arbitrated.
