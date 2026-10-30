# Review record: new game to database (build 2026-10-30)

Cumulative plan and plan-review history of the build run `new-game-to-database` (worktree branch `build/new-game-to-database-20261030`). Raw lens reports were in `/tmp/build-newgame-1474822` (temporary). Decisions: d-20261030-06, d-20261030-07 (superseded by d-20261030-09, then d-20261030-10), d-20261030-08. Finding: f-20261030-06. The plan file `tasks/plans/2026-10-30-new-game-to-database.md` named in those records lives in an ignored directory; its full text is preserved in this handoff.

## Plan: Add new games directly to a games database

### Goal

A user can create a new game straight into a games database ("New game") and can store any
analysis-board game into a chosen database ("Save to database…"), without first creating a PGN
file and importing it. Trashing a game PGN file no longer leaves an orphan "search index is
unavailable" row in the Library.

### MANDATE

Felix, 2026-10-30 (verbatim): "I want to add a new game to Meine Partien, but I don't know how this
works best. Before I already tried it, but it was very...Circusious because at first I had to
create a file and then I wanted to insert this into the database but I also didn't manage to do
this so I'm not sure yeah if we find a better way to include new games somehow directly into a
database". After the recommendation: "There already is a button for add games, but this button
just lets me download a PGN or upload a PGN file. Here we need something new, I think." Then:
"Yes, then build this properly. I think both points are worth it. Full auto executor codex on a
separate work tree."

The two approved points (recommendation Felix accepted):

1. A "New game" button in the database detail Actions row (next to Add Games / Export to PGN)
   that opens an empty board tab bound to that database. The first save adds the game to the
   database, later saves update that same game.
2. A "Save to database…" entry for a board tab that lets the user pick a target database and
   store the current game there, covering pasted, imported and analysed games.

Add Games (PGN file import) stays unchanged. Also in scope, presented to Felix in the same
recommendation ("Fix the leftover entry at the same time"): deleting/trashing a game PGN file
must not leave its linked-collection entry behind as a "The search index is unavailable…" row.
Observed: `Beck-Müller-2026-10-22.pgn` trashed, registry record
`422bb80e-e75e-45d1-b797-7e3206c80956` still listed.

### Threat model and non-goals

Input adversary: none beyond ordinary user input. The PGN comes from the user's own board tree
(serialized by `serializeStoreTree`), never from a network peer. Environments: Linux, macOS,
Windows desktop. Linked collections exist only where `linked_collections_supported()` is true
(Linux, macOS); on Windows every database is standalone. Failure classes that matter: duplicate
inserts from repeated or racing saves, an insert whose outcome is uncertain, a tab whose bound
database handle is lost after restart, writing to a linked index directly (refused by existing
guards), and deleting collection cache files another owner still needs.

Non-goals: play-mode (`BoardGame`) save, puzzles tabs, bulk import changes, a general File-menu
Save/Save As redesign, Windows linked collections.

### Traced premises

Frozen from Locate (probes `probe-1..3-r1`, 2026-10-30, base `e6986bef`):

- `src/state/workspaceTypes.ts:5` — `gameOriginSchema` is a zod discriminated union: `none`,
  `file`, `temp_file`, `database { database, gameId, linked? }`. Tabs persist in the versioned
  `"workspace"` sessionStorage envelope (`src/state/workspace.ts:17`, `:370`, `:392`).
- `src/state/pathOwners.ts:148` — `consumeTabs` retains database-handle ownership for database
  origins read from the persisted workspace.
- `src/utils/tabs.ts:551`, `:571`, `:610` — `createTab` defaults to origin `none`, resolves
  database origins through `tauri.resolveLinkedGame`; a linked game becomes a `file` origin.
- `src/utils/tabs.ts:771`–`973` — `saveToFile` is the single save entry; origin `none` first save
  picks a PGN destination and appends through `appendStoreGame` (`:693`) with the durable
  `appendAttempted` marker blocking repeats after uncertain results (`:811`, `:829`);
  database origin: `collectionForDatabase` refusal with `Collections.RetiredTab` (`:882`), else
  `tauri.writeDbGame(database, gameId, pgn)` then `finishWrite` (`:859`).
- `src/components/boards/BoardAnalysis.tsx:101`, `:102`, `:308` and
  `src/components/boards/BoardControls.tsx:135` — the only analysis save UI is the "Save PGN"
  icon / `SAVE_FILE` shortcut calling `userSaveFile`; autosave runs `saveToFile` without
  `isUserSave` when the tree is dirty and its origin is persistent (`src/state/atoms.ts:499`).
- `src-tauri/src/db/mod.rs:4035`, `:4064`, `:4094` — `write_db_game` (native-operation lifecycle,
  `BLOCKING_GATEWAY.spawn_cancellable`), `write_db_game_blocking` (DatabaseMutate authority,
  parses first game via `Importer`), `write_parsed_db_game` (updates an existing id).
- `src-tauri/src/db/mod.rs:405` and `src-tauri/src/db/ops.rs:64` — `TempGame::insert_to_db`
  discards `create_game`'s returned `Game` (whose `id` is the new `Games.ID`).
- `src-tauri/src/db/mod.rs:233`, `:310`, `:263`, `:292`, `:3550` — `resolve_database` path
  authority + linked-index guards, `with_validated_mutation` (write lock, revision-bumping
  transaction), search-cache invalidation, `update_database_counts`.
- `src-tauri/src/db/linked_collections.rs:2237`, `:2292` — direct create/mutate on a linked index
  is refused.
- `src/bindings/generated.ts:1304` — `CollectionDescriptor` carries `file: FileWorkspaceHandle`
  (the collection's authoritative PGN) and `database: DatabaseHandle | null`.
- `src-tauri/src/main.rs:2083` — commands registered in Specta `collect_commands!`;
  `src/platform/tauri.ts:114`, `:382` derive the facade from generated bindings.
- Orphan root cause: `src-tauri/src/file_workspace.rs:2199` trash moves the PGN into
  `.en-croissant-trash/<UUID>/` and rebinds its handle; `:2174` reconciles collections, but the
  workspace walk excludes the trash directory (`:675`); `linked_collections.rs:1904` retains the
  record, `:1673`/`:2092` recovery fails with `StaleGame`, `:2021` reports `unavailable`;
  `src/components/library/LibraryPage.tsx:118`, `:138` render non-ready records absent from the
  tree as missing peers with `Collections.Unavailable`. Restore (`file_workspace.rs:2274`)
  reconciles the record back; permanent deletion (`:2458`) removes path authority but never the
  collection record. Cache companions and owners: `linked_collections.rs:579`, `:629`, `:645`,
  `legacy.rs:10`. `referenceDbAtom` persists a database handle (`src/state/atoms.ts:629`).
- Product precedent `docs/context/PRODUCT-DECISIONS.md` 2026-10-04: a user's own PGN file in the
  library folder is the truth; a database is either the search index of such a file or a
  standalone reference collection; edits to a linked collection go to the file.

### Approach

### A. Native single-game insert

A new Specta command `insert_db_game(file: DatabaseHandle, pgn: String) -> i32` beside
`write_db_game`, sharing its lifecycle (native operation, cancellation, blocking gateway,
DatabaseMutate authority, linked-index refusal, revision-bumping transaction, count update,
search-cache invalidation). It parses exactly the first game with the existing `Importer`
(same as `write_db_game`; empty/no-move input → existing `NoMovesFound`-class error), inserts it
through the importer's insert helper changed to return the new id, and returns that id only after
the transaction commits. Standalone-database tests compile on every platform (Windows included). One insert implementation: `convert_pgn` keeps using the same helper.
Registered in `collect_commands!`, bindings regenerated, never hand-edited.

### B. Save target: "database draft" origin

A new `GameOrigin` variant `{ kind: "databaseDraft", database: DatabaseHandle }` for a tab whose
game does not exist yet in its target database. One variant serves standalone and linked
targets: the concrete target is resolved at save time, so a database that became (or stopped
being) a linked index between tab creation and save is handled. Obligations:

- Persistence equals every other tab: the variant is added to `gameOriginSchema`, stored in the
  same sessionStorage workspace envelope and tree storage, and restored on reload within the
  session. No restart promise beyond what ordinary tabs already have. `pathOwners.consumeTabs`
  retains the draft's database-handle ownership exactly as for `database` origins, so the handle
  stays usable after reload; every exhaustive switch over origin kinds (`sameOrigin`, freshness
  polling, recovery gates, tab duplication) handles the variant explicitly.
- Save resolution: only an explicit user save (`isUserSave`) stores a draft. Autosave never stores
  a draft. At save time `collectionForDatabase(database)` decides: standalone → `insertDbGame`;
  linked index → append the game to the collection's authoritative PGN
  (`CollectionDescriptor.file`) at its current game count through the existing append path
  (`appendStoreGame` with that destination supplied instead of the export picker), after which
  existing reconciliation re-indexes it (product precedent 2026-10-04: edits go to the file).
  A confirmed store admits the successor origin through the existing successor-origin path:
  `{ kind: "database", database, gameId }` for an insert, the `file` origin for an append.
  Later saves and autosave use the unchanged database/file origin paths.

### B2. Store-elsewhere attempt marker and single flight

Both entry points (draft first save, Save to database…) store the game in a location that is
not the tab's current persistent origin. Their duplicate protection is a dedicated persisted
per-tree marker naming the attempted destination (database handle key or PGN file key), not the
existing `appendAttempted` flag, because `tree.save()` clears `appendAttempted` on every ordinary
save (`src/state/store/tree.ts` `save`). Contract:

- The marker is written durably before the native call and survives ordinary saves, autosave,
  and reload hydration.
- It is cleared only by that attempt's own outcome: confirmed success, or a confirmed no-write
  rejection (validation errors raised before the transaction, such as `NoMovesFound` for an
  empty board, refused authority, or a refused linked index). Uncertain outcomes (IPC failure,
  durability-uncertain append, ownership lost after commit) keep it.
- While it is set, a new store to the same destination from that tab is refused with the
  existing "may already have been added" warning; the user can still save the tab's current
  origin or store to a different destination. No additional retry or dismiss control is added
  (same stance as the existing `appendAttempted` contract of d-20261017-12).
- Single flight per tab: a store-elsewhere attempt waits for any in-flight save of that tab to
  settle and blocks new saves and autosave of that tab until it settles; two store attempts on
  one tab never overlap.

The existing origin-`none` first-save path keeps its `appendAttempted` contract
(d-20261017-12) unchanged.

### C. "New game" button

In the database detail Actions row (`useDatabaseLibrary.tsx`, `success` databases) and in the
linked-collection detail (`LinkedCollection.tsx`, enabled only when the collection is ready and
has a database handle), a "New game" button opens an empty analysis tab with origin
`databaseDraft` for that database and navigates to the board.

### D. "Save to database…"

An analysis-board control next to the existing "Save PGN" icon opens a modal listing the
games databases the Library already shows (the existing database list source; error and
non-ready entries excluded). Confirm stores the current serialized game into the chosen target
with the same resolution as B (standalone insert or linked append) under the B2 marker and
single flight, then rebinds the tab to the stored game (Save-As semantics: later saves go to
the new location; the previous file or database game is left unchanged). A success
notification names the target database.

### E. Trashed collection sources

A linked-collection record whose authoritative PGN is in the workspace trash is not an
unavailable collection. Obligations:

- Native reconciliation recognises a source handle bound inside `.en-croissant-trash` and
  reports a distinct status `trashed` (added to `CollectionStatus` through Specta) instead of
  `unavailable`.
- A record whose source is trashed is matched during discovery only by its own handle, never by
  locator, so a new file created at the trashed file's former name gets its own record and does
  not take over the trashed one; restore then reconciles the trashed record back by handle.
- Every production consumer of collection status treats a trashed non-account record as
  absent: the Library missing-peer list (`LibraryPage.tsx`), database lists (`src/utils/db.ts`
  non-ready → error entry), game-reference failure reporting (`src/utils/gameReferences.ts`),
  and the Save to database target list.
- Account collections keep today's behaviour: a trashed account record is treated as non-ready
  exactly like today's `unavailable`. `src/utils/db.ts` keeps producing its existing error
  entry for it, so `findAccountDatabase` returns the same canonical linked error entry as today,
  native `prepare_account_collection` returns it as non-ready, and the account card keeps its
  existing unavailable message; restoring the account PGN recovers it. Only the Library
  missing-peer row is hidden. Changing account sync semantics after an account PGN is trashed is
  not part of this task.
- The persisted `referenceDbAtom` preference is never cleared because its collection is
  trashed: while trashed, consumers derive an unavailable effective reference (the existing
  pattern of `DatabasePanel.tsx` / `RepertoireInfo.tsx`), so restore brings the selection back.
  It is cleared only when reconciliation removes the record whose database it names; an
  unrelated selection is never cleared.
- Removal is reconciliation-driven: when a trashed source no longer exists (permanently deleted
  or trash purged), reconciliation removes the record and the cache files that only that
  record owns, respecting existing maintenance owner rules for batches, migration/creation
  records and identity evidence. Permanent delete triggers reconciliation as it already does
  after trash; a removal failure there is logged, never turns a committed permanent delete into
  a user-facing failure, and the record stays hidden and is retried at the next reconciliation.
- The existing orphan (`Beck-Müller-2026-10-22.pgn`, source in trash) is hidden by this rule
  with no manual step.

### F. Text and translations

New user-facing strings ("New game", "Save to database…", modal title and labels, success,
and uncertain-result texts) go through i18next with `pnpm i18n:extract` and are
translated in every shipped catalogue under `src/translation/`, as `docs/localization.md` and
`scripts/i18n-completeness.mjs` require.

### G. Verification level

Both entry points get a Playwright e2e spec (container run, committed snapshots) that clicks
"New game" and "Save to database…", completes the modal and asserts the saved state shown in the
UI, and `pnpm verify:app` (the real Tauri app) gets one journey that creates a game through
"New game", saves it, edits and saves again, and asserts through the native database read path
that exactly one new row exists with the edited moves. Step-7 verify-ui inspects screenshots.

### Decisions and trade-offs

Decided autonomously (full auto; recorded in `tasks/decisions.md`):

1. Draft origin over inserting an empty row on "New game": an empty row would leave junk games
   when a tab is abandoned. Rejected: immediate empty insert.
2. Autosave never stores a draft; the first store requires an explicit save. Rejected: autosave
   insert on first move (an abandoned scratch game would land in the database).
3. "Save to database…" uses Save-As semantics (tab rebinds to the stored game). Rejected: copy
   while keeping the old binding (later edits would silently diverge from what was stored).
4. Linked-collection targets append to the collection's PGN, never insert into the index
   (product precedent 2026-10-04). One draft variant, target resolved at save time.
5. Store-elsewhere attempts use a dedicated destination-keyed persisted marker plus per-tab
   single flight. Rejected: reusing `appendAttempted` (cleared by every ordinary save).
6. Trashed sources get a hidden `trashed` state; removal is reconciliation-driven once the
   trashed source is gone. Rejected: deleting the record on trash (restore would lose the
   collection identity and reference selection) and a user-facing error for cleanup failure
   after a committed permanent delete.

### Risks / open questions

- Older builds reading a workspace with a `databaseDraft` origin fail schema validation for that
  tab; sessionStorage is per session, so only a downgrade inside one session is affected.
  (A round-1 records-lens claim that the whole workspace would reset was withdrawn in the
  closure round: base `src/state/workspace.ts` validates each tab with
  `tabSchema.nullable().catch(null)` and drops only invalid tabs, so this text was right.)
- An uncertain store leaves its marker set; the user sees the "may already have been added"
  warning and cannot store the same tab to that destination again (checking the database
  shows whether the game arrived), instead of risking a silent duplicate.

### Not part of this task

Play-mode save, puzzles, File-menu redesign, Windows linked collections, changing Add Games,
bulk duplicate detection beyond the existing Remove Duplicates action, tab persistence across
app restart, account sync behaviour after an account PGN is trashed.

### Phases

Phase 1 then Phase 2, sequential. Each phase is independently gate-clean: Phase 1 ships the
native command together with its production consumers (required by `pnpm ipc:consumers:check`);
Phase 2 touches no Phase 1 file except regenerated bindings and translation catalogues.

### Phase 1 — Add games to a database (Approaches A, B, B2, C, D, F, G)

Files: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/ops.rs` (if needed), `src-tauri/src/main.rs`,
`src/bindings/generated.ts` (regenerated via `pnpm bindings:generate`), `src/state/workspaceTypes.ts`,
`src/state/pathOwners.ts`, `src/state/store/tree.ts`, `src/state/store/tabStorage.ts` (marker
persistence), `src/utils/tabs.ts`, `src/components/boards/BoardAnalysis.tsx`,
`src/components/boards/BoardControls.tsx`, a new save-to-database modal under
`src/components/boards/`, `src/components/databases/useDatabaseLibrary.tsx`,
`src/components/library/LinkedCollection.tsx`, other origin-kind switches the executor finds,
`src/translation/*.json`, a new `e2e/` spec with container snapshots registered as its own
project in `playwright.config.ts` (every project matches an explicitly named spec),
`scripts/verify-app.mjs` journey, colocated tests. Sensitive (db/**, main.rs, bindings, src/state/**). Role: sensitive.

Native tests (standalone cases in a module compiled on every platform, not under
`#[cfg(all(test, unix))]`; linked-only cases stay platform-gated): insert then read back
returns the returned id with the same moves and headers; a second `write_db_game` on that id
updates it with no extra row; empty input rejected with no row; linked index refused; failed
revision bump leaves Games unchanged and does not invalidate cache; parse cancellation leaves no
row; authority (Mutate permits, Create refuses); Info counts updated; `convert_pgn` still
imports through the shared helper.

Renderer tests: workspace schema round-trip including a corrupt draft; pathOwners retains the
draft handle; explicit draft save inserts once and admits the database origin, then an edit
and save updates that same id (no second insert); autosave of a draft stores nothing; linked
draft appends to the collection file at its game count; empty-board rejection clears the marker
and a corrected save succeeds; uncertain result keeps the marker across an ordinary save of the
previous origin and across rehydration, and refuses a retry to the same destination; overlapping store
submissions produce exactly one native store; a store submitted while an ordinary save is in
flight starts its native call only after that save settles, and a save or autosave submitted
while a store is in flight does not start until the store settles (asserted on call ordering
with controllable deferred native mocks); Save to database rebinds; both New game buttons create the right
origin.

PROOF COMMAND (run each, in order):
1. `PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml --locked insert_db_game`
2. `pnpm bindings:check`
3. `PATH="$HOME/.cargo/bin:$PATH" cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`
4. `pnpm exec tsgo --noEmit`
5. `pnpm exec vitest run src/state src/utils/tabs src/components/boards src/components/databases src/components/library`
6. `pnpm i18n:check && pnpm ipc:consumers:check`
7. `pnpm test:e2e:container -- <new spec file>`

### Phase 2 — Trashed collection sources (Approach E)

Files: `src-tauri/src/db/linked_collections.rs`, `src-tauri/src/file_workspace.rs`,
`src/bindings/generated.ts` (regenerated), `src/components/library/LibraryPage.tsx`,
`src/utils/db.ts`, `src/utils/gameReferences.ts`, `src/components/home/accountDatabase.ts`
(only if its status handling needs to name `trashed` to keep today's behaviour), reference consumers (`DatabasePanel.tsx`, `RepertoireInfo.tsx` pattern), the Phase 1 save-to-database target list
filter only if it does not already exclude non-ready collections, the `referenceDbAtom`
consumer in `src/state/atoms.ts`, colocated tests. Sensitive. Role: sensitive.

Tests: trash → status `trashed`, not listed as missing peer, not in database lists or reference
failures; trash then create a new file at the same name → new record, trashed record untouched;
restore → same record id ready; permanent delete → record and solely owned cache files removed
at reconciliation, shared batch/migration owners untouched; injected removal failure → permanent
delete still succeeds, record hidden, removed on next reconciliation; reference selection
preserved while trashed and restored, cleared only when its record is removed; for a trashed account collection with an index handle,
the database list still contains its canonical error entry and `findAccountDatabase` returns
that entry unchanged; without an index handle it resolves to `unavailable` unchanged; native
account preparation returns it as non-ready.

PROOF COMMAND (run each, in order):
1. `PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml --locked linked_collections`
2. `PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml --locked file_workspace`
3. `pnpm bindings:check`
4. `pnpm exec tsgo --noEmit`
5. `pnpm exec vitest run src/components/library src/components/home src/utils src/state`

### Reviews

### Round 1 (r1, 10 lenses, Codex openai.high, read-only)

Verdicts: plan REVISE, correctness REVISE, persisted-state REVISE, tests REVISE,
platform-semantics REVISE, error-handling APPROVED (2 should-fix), minimalism APPROVED,
ipc-contract APPROVED, pgn-index APPROVED, tauri-security APPROVED. Raw reports:
`$RUN_TMP/lens-<lens>-r1.txt` (RUN_TMP=/tmp/build-newgame-1474822).

| ID | Claim | Witnesses (lens#finding) | Disposition | Evidence / correction |
|---|---|---|---|---|
| R1-01 | Reusing `appendAttempted` lets an unrelated save clear an uncertain insert marker → duplicate | correctness#1, persisted-state#2, plan#1 | Fix | Verified `src/state/store/tree.ts` `save` sets `appendAttempted: false`. Correction: Approach B2 dedicated destination-keyed marker + single flight. |
| R1-02 | Drafts do not survive app restart (sessionStorage) | correctness#2, persisted-state#1 | Fix | Restart survival was the plan's own acceptance text, not MANDATE. Correction: B states persistence equals every other tab (reload within session); restart listed under Not part of this task. |
| R1-03 | Confirmed pre-insert rejection must clear the marker | error-handling#1 | Fix | B2 confirmed no-write rejection clears; test named. |
| R1-04 | Permanent-delete cleanup partial-failure semantics undefined | error-handling#2 | Fix | E: reconciliation-driven removal, failure logged, retried, never a user-facing failure after committed delete; injected-failure test. |
| R1-05 | Linked "New game" has no persistent first-save target | plan#2 | Fix | B: one `databaseDraft` variant, target resolved at save time via `collectionForDatabase`; linked → append at game count. |
| R1-06 | `trashed` consumers `src/utils/db.ts`, `src/utils/gameReferences.ts` unaddressed | plan#3 | Fix | Verified `db.ts:278`, `gameReferences.ts:370`. E lists every consumer; Phase 2 files. |
| R1-07 | Locator reuse lets a new same-name file take over the trashed record | plan#4 | Fix | Verified `linked_collections.rs:1849` matches handle or locator. E: trashed records match only by handle; test named. |
| R1-08 | Localization requires every catalogue | plan#5 | Fix | Verified `scripts/i18n-completeness.mjs:79`. F corrected. |
| R1-09 | No browser or real-app proof of the entry points | plan#6, tests#1 | Fix | G: e2e container spec + verify:app journey; Phase 1 proof 7. |
| R1-10 | Phase 3 proof passes two cargo filters | plan#7 | Fix | Separate invocations. |
| R1-11 | Phases not independently gate-clean (command without consumer), file overlap | plan#8 | Fix | Phases 1+2 merged into Phase 1; trash phase no longer touches `LinkedCollection.tsx`. |
| R1-12 | Standalone insert tests would be Unix-only | platform-semantics#1 | Fix | Verified `src-tauri/src/db/mod.rs:4365` `#[cfg(all(test, unix))]`. A and Phase 1 require an all-platform module. |
| R1-13 | No test that a later save updates the same id | tests#2 | Fix | Phase 1 native and renderer tests named. |
| R1-14 | No overlap / rehydrate tests for uncertainty | tests#3 | Fix | Phase 1 renderer tests named (with R1-01). |

Adopted r1 = 14.

### Round 2 (r2 closure, 7 lenses)

Verdicts: plan REVISE, tests REVISE, correctness APPROVED, persisted-state APPROVED (1 should-fix),
platform-semantics APPROVED, error-handling APPROVED, tauri-security APPROVED (first look, no
findings). Closed: R1-01, R1-02, R1-03, R1-04, R1-05, R1-07, R1-08, R1-10, R1-11, R1-12, R1-13,
R1-14. NOT CLOSED: R1-06 (plan), R1-09 (tests).

| ID | Claim | Witnesses | Disposition | Evidence / correction |
|---|---|---|---|---|
| R1-06 (reopened) | `src/components/home/accountDatabase.ts:28` still counts a trashed account collection as registered → unavailable | plan r2#1 | Fix | Verified `accountDatabase.ts:25-33`. E consumer list and Phase 2 files include it. |
| R1-09 (reopened) | New e2e spec not registered in `playwright.config.ts` | tests r2#1 | Fix | Verified every project uses an explicit `testMatch`. Phase 1 files register the spec. |
| R2-01 | Clearing `referenceDbAtom` on trash loses the selection across restore | persisted-state r2#1 | Fix | E: preference preserved while trashed, effective reference derived unavailable, cleared only on record removal. |
| R2-02 | "I checked, store again" action lacks authority | plan r2#2 | Fix | Action removed; marker blocks only the same destination from that tab, consistent with d-20261017-12. |
| R2-03 | "Exactly one native store" does not prove serialization against an in-flight save | tests r2#2 | Fix | Phase 1 test names ordering assertions with deferred mocks. |

Adopted r2 = 5.

### Round 3 (r3 closure, 3 lenses)

Verdicts: plan REVISE, tests APPROVED (1 should-fix), persisted-state APPROVED. Closed: R1-09,
R2-01, R2-02, R2-03. NOT CLOSED: R1-06 (second failed closure of this lineage).

Escalation (second failed lineage closure, build §4): source trace instead of another patch.
Invariant: every consumer must give a trashed record a coherent outcome. Previous answer (r2):
exclude trashed account collections in `accountDatabase.ts`. New evidence:
`src-tauri/src/db/linked_collections.rs:2402-2423` native preparation still returns the retained
account record, and `src/components/home/AccountCard.tsx:309-313` throws `Collections.Unavailable`
for any non-ready descriptor, so the r2 exclusion created a renderer/native mismatch. Judgment:
the account flow is outside the MANDATE (Felix's report is a trashed game file); the simplest
correct mechanism is to keep the account flow unchanged, treating `trashed` as non-ready there
exactly like today's `unavailable`. Change: E account bullet replaced; Phase 2 test asserts the
unchanged account outcome. Focused fresh-context review-plan verifies in r4.

| ID | Claim | Witnesses | Disposition | Evidence / correction |
|---|---|---|---|---|
| R1-06 (reopened twice) | Native account preparation returns the trashed record while the renderer excludes it | plan r3#1 | Fix | Escalation judgment above. |
| R3-01 | No assertion for the trashed account collection resolution | tests r3#2 | Fix | Phase 2 test asserts unchanged `unavailable` resolution and native non-ready preparation. |

Adopted r3 = 2.

### Round 4 (r4 focused closure, 2 lenses)

Verdicts: plan REVISE, tests APPROVED. Closed: R1-06 (focused fresh-context review-plan accepts
the unchanged-account mechanism). NOT CLOSED: R3-01 (plan).

| ID | Claim | Witnesses | Disposition | Evidence / correction |
|---|---|---|---|---|
| R3-01 (reopened) | With a retained index handle, today's account path returns the canonical linked error entry from `db.ts:279`, not `unavailable`; requiring `unavailable` changes the flow | plan r4#1 | Fix | Verified `src/components/home/accountDatabase.ts:20-54`. E: database-list exclusion applies to non-account records only; account record keeps its error entry; Phase 2 tests both the handle and no-index cases. |

Adopted r4 = 1.

### Round 5 (r5 closure, 2 lenses)

Verdicts: plan APPROVED, tests APPROVED. Closed: R3-01 (R1-06 reconfirmed). No open issues.
Adopted r5 = 0. Adoptions per round: r1=14 r2=5 r3=2 r4=1 r5=0. Unique issues: 18 (R1-01..R1-14,
R2-01..R2-03, R3-01; R1-06/R1-09/R3-01 reopened and closed within their lineage). Escalation used
once (R1-06, round 3). Family: plan written and arbitrated by Claude (Opus), lenses on Codex
(OpenAI), so plan review was family-separated.

## Implementation and cumulative diff review

Phases: Phase 1 (`f73eb740`, Codex openai.high sensitive, one resume after the leaf stopped on an
intermediate red), Phase 2 (`bd0452f3`, sensitive, two proof-fix rounds: a cleanup-failure test
injector and an unplanned locator rewrite reverted to the existing contract). Repairs before
review: `96835d03` (20 existing e2e snapshots re-recorded through the container; diffs show only
the new controls and reflow; the Library detail pane scrolls, `LibraryPage.tsx` split
`overflow: auto`), `93de6143` (bundle total ceiling via the feature-growth route,
d-20261030-08). An intermittent axe colour-contrast failure on a fading Settings tooltip in
`engine-gap: … in dark` failed 2 of 8 runs on this branch and 0 of 8 on base `4bd75ea8`; the
node is the sidebar link tooltip, not a changed component, so it is recorded here and not filed
(rule 4d single load flake) unless it reddens final gates.

Diff review round 1 (`4bd75ea8..93de6143`, 12 code lenses + records lens, Codex openai.high;
code authored by Codex, so detection is same-family; plan authorship and arbitration by Claude):
APPROVED chess-semantics, ipc-contract, persisted-state, platform-semantics, root-cause,
tauri-security, minimalism (1 nit), error-handling (1 should-fix), tests (2 should-fix); REVISE
correctness, code-quality, pgn-index, records.

| ID | Finding | Lens | Disposition | Repair |
|---|---|---|---|---|
| CR1-01 | Queued draft save inserts a duplicate after a queued Save to database rebinds the tab | correctness | Fix | `784b3e25` |
| CR1-02 | Bare 100/256 store-attempt bounds | code-quality | Fix | `784b3e25` |
| CR1-03 | `getDatabases` writes reference preferences | code-quality | Fix | `8a26314d` |
| CR1-04 | Save to database modal discards typed listing failures | error-handling | Fix | `8a26314d` |
| CR1-05 | `insert_db_game_blocking` forwarding layer | minimalism | Fix | fix(pgn) commit |
| CR1-06 | `headersToPGN` does not escape header values; insert rejects `Open "A" Cup` | pgn-index | Fix | fix(pgn) commit; first attempt changed native Event/Site spelling and was reverted (6694b6e7 contract); decode once in `databaseGameSeed` |
| CR1-07 | No storeAttempts persistence-failure test | tests | Fix | `784b3e25` |
| CR1-08 | No linked-append uncertainty retention test | tests | Fix | `784b3e25` |
| CR1-09 | d-20261029-15 / -18 not superseded by the new ceiling | records | Fix | trailers → d-20261030-08 |
| CR1-10 | d-20261030-07 reversal claimed registry shape unchanged (`trash_locator` added) | records | Fix | d-20261030-09 supersedes d-20261030-07; its two-way compatibility claim was wrong (base `Record` denies unknown fields), corrected by d-20261030-10 |
| CR1-11 | Downgrade risk understated (whole workspace resets) | records | Withdrawn | The lens withdrew it in closure: base filters invalid tabs individually; the original risk text stands |
| CR1-12 | Records name the ignored plan path | records | Fix | header note: plan preserved in this handoff |
| CR1-13 | "Unique issues: 19" should be 18 | records | Fix | corrected |

Out-of-diff defect filed: f-20261030-07 (vendored `RawHeader::decode` drops a literal backslash
after an escaped backslash). Closure round 2 (`93de6143..HEAD`, 8 code lenses): CR1-01..CR1-08
CLOSED with evidence, no new findings, all APPROVED. Records closure: CR1-09, CR1-10, CR1-12, CR1-13 CLOSED; CR1-11 withdrawn; one new records finding (d-20261030-09 compatibility claim) fixed by d-20261030-10. diff_adopted_per_round: r1=13 r2=1.
