# Review handoff: f-20261001-02

PLAN-REFRESH publication input at NEW-BASE eb1ee092f127d49d2a842b9da5b1010326232d04, carrying the original ca0ab68689e0f4de8ca0b84df2be29963bcfc66c review lineage through the 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee refresh. Load this complete record before adopting or reviewing the implementation. The accepted contract and full append-only review history follow. Plan authorship and arbitration shared one context. Detection used the same Codex model family selected for implementation. No code or runtime proof was produced by this planner.


## Goal

Resolve f-20261001-02 by preventing ordinary descriptors of an inode from closing while a game-database SQLite binding can hold POSIX locks on it. Refresh the reviewed plan at base eb1ee092f127d49d2a842b9da5b1010326232d04, preserving its review lineage from ca0ab68689e0f4de8ca0b84df2be29963bcfc66c through the 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee refresh.

## MANDATE

### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it

* **ID:** f-20261001-02 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/resolved.rs` (~544, ~556, ~860: the generic resolver opens and retains an ordinary leaf descriptor in `ResolvedPath.file`); its consumers `src-tauri/src/puzzle.rs` (~103, ~123, ~160, ~188, ~213 puzzle reads through `schema_specific_connection_expected_file_cancellable`, which also `try_clone()`s the descriptor; ~610 puzzle deletion), `src-tauri/src/db/mod.rs` (~3123, an existing `WritePgn` export destination resolved and held through export), and the search-index sidecar reads `src-tauri/src/db/search.rs` (~335) and `src-tauri/src/db/search_index.rs` (~886).
* **Defect:** SQLite's unix locks are process-associated `fcntl` locks, and closing any ordinary descriptor of an inode releases every such lock the process holds on it (measured 2026-09-29 on atlas, recorded in `f-20260929-11` and `d-20260930-10`). Game-database pools are keyed by `DatabaseFileTarget`, but nothing stops the same inode from also being authorized as a puzzle database, a PGN import/export file or a search-index sidecar (a user pick of the same file, or a hard link). Each of those capabilities opens an ordinary descriptor on the leaf and closes it when the operation ends, possibly while a game-database pool on that inode holds a live SQLite lock — the same lock-release hazard `f-20260929-11` removes from the repository's own probes. Found by a locate probe of the `f-20260929-11` build run (2026-10-01), which classified these sites as "lockable open+close while pooled possible" only through such a cross-capability alias.
* **Why it matters:** with the lock silently gone, another process can checkpoint and unlink the `-wal`/`-shm` this process still uses, or write under a reader that believes it holds a lock — database corruption. Reachable only when one inode is authorized under two capability kinds, so far rarer than `f-20260929-11`.
* **Open question:** should path authority refuse (or a capability consumer detect) an inode that is live in a game-database pool when it is resolved under another capability kind — and if so, where is the cross-kind inode registry and what does the user see — or should each of these consumers stop holding an ordinary descriptor (identity by `fstatat` / `O_PATH`, snapshot copy through a non-lockable route), given that a puzzle snapshot and a PGN export genuinely read or write the bytes?
* **Related:** `f-20260929-11` (the repository's own probes; this finding is the residual outside the repository), `d-20260930-10`, `d-20260929-05` (cross-directory hard-link refusal for game databases only).

## Threat model and non-goals

Supported Linux, macOS and Windows. Same-process concurrent operations, accidental duplicate picks, hard-link aliases across authorized capability kinds, and swaps of an authorized leaf during verification are in scope. The adversary may mutate entries in an authorized directory, including substituting an active database inode or causing metadata inspection to fail. Preserve parent containment and no-follow behavior. Other processes use SQLite's usual locking contract. The fix does not promise protection against external writers that deliberately ignore locks or an operating-system/kernel failure.

No change to persistent capability schema, renderer IPC signatures, native dialogs, database schema, pool eviction policy or same-directory game-database hard-link naming. No new background process, service, watcher or source-text verifier.

## Traced premises

* `infra/path_authority/resolved.rs:96,176,481,553,754,908`: ResolvedPath, streaming transfers, PGN snapshots and puzzle duplicates currently own plain Files that escape resolution.
* `db/repository.rs:906,922`: puzzle snapshot copying takes a bare File and clones and retains the source descriptor independently of the original resolution.
* `db/sqlite_cancellation.rs:482,485`: the existing pinned-factory cancellation fixture passes a bare File into that snapshot factory and must migrate with its ownership contract.
* `db/mod.rs:3586–3597`: PGN export resolves and snapshots its destination before acquiring its database connection, so reverse ordering is reachable.
* `db/search.rs:321` and `db/search_index.rs:908,916,918`: preferred and legacy sidecar opens bypass PathAuthority resolution and clone into mapping consumers.
* `db/content_validation.rs:171`, `infra/path_authority/mod.rs:717,6378,6594,6671` and `infra/fs.rs:4933,2043`: integrity/workspace sidecars, engine/book carriers, open-or-create and archive sync are direct ordinary-file dependencies of the same capability boundary.
* `infra/fs.rs:4889`: generic Unix open_regular_at opens a lockable descriptor before fstat and flag adjustment. Every subsequent error currently drops it.
* `db/bound_sqlite.rs:182,214–233,579,638,663`: process-global binding creation, same-inode distinct-key admission, removal and quarantine already arbitrate descriptor safety for SQLite's own hooks under the binding registry mutex.
* `db/repository.rs:654,1063,1085–1087,1404–1409` and `db/content_validation.rs:561–573`: pool construction, read_revision and the content scan take a retired-predecessor admission and drop the repository state mutex before BoundDatabase::acquire. A retired pool's manager keeps its BoundDatabase until the retirement's connection and owner tickets drain.
* `infra/path_authority/mod.rs:7194`: game database targets use metadata and parent descriptors, so they need no ordinary data-file lease.
* `db/repository.rs:5942`: an existing forked-child F_GETLK observer checks actual SQLite locks without closing a fresh parent-process probe descriptor.
* Governing precedents: d-20261011-01 (superseding d-20260929-05's same-directory allowance) refuses any second distinct binding key for one inode, cross-parent or same-parent, including creation reservations. d-20261011-07 through d-20261011-13 retain LRU-evicted pools as bounded retirements and fence reopen, read_revision and the content scan on retired predecessors. d-20260930-10 establishes Linux O_PATH verification and bounded non-Linux quarantine. d-20261001-06 preserves descriptor-free metadata probes. d-20261009-08 through d-20261009-10 preserve nonblocking special-file refusal and unknown-descriptor retention.

Paths in this section are relative to `src-tauri/src/`. No runtime reproduction or platform compilation was run by the planner.

The refresh trace at 8bccb79c confirms those open paths still use ordinary Files. The process-generated drift from ca0ab686 changes position-search progress cancellation, setup construction, cache predicates and transient query/index metadata. Preserve those established semantics during the carrier migration, as already required by O2. Current precedents include d-20261009-15 through d-20261009-17, d-20261009-19 through d-20261009-22, d-20261009-24 and d-20261009-25. The bound SQLite, repository and generic filesystem ownership boundaries are unchanged by that drift. Build tier remains required because the shared cross-kind ownership design has not been implemented.

The refresh trace at eb1ee092 confirms every ordinary open path above is still a plain File. The process-generated drift from 8bccb79c changes four boundaries this plan integrates with. Bound SQLite now refuses a second distinct key per inode in BoundDatabase::acquire (f-20260929-05, d-20261011-01). The repository retains LRU-evicted pools as bounded retirements whose managers keep their bindings, and fences pool construction, cached acquisition, read_revision and the content scan on retired predecessors (f-20260930-01, d-20261011-07 through d-20261011-14). Pools take busy_timeout before WAL and use the production connection budget in tests. Search-index probe attempts resolve inside one shared closure. O1, O2 and O3 now cite these as preserved inputs. The cross-kind ordinary-descriptor hazard is unchanged, because none of those changes gives ordinary capability files an owner. Build tier remains required.

## Approach

### O1 — one inode admission and close boundary

Mandate basis: "one inode ... under two capability kinds" and "closes ... while a game-database pool ... holds a live SQLite lock".

Introduce one process-wide inode ownership primitive under infra, used by both bound SQLite registrations and ordinary capability-derived regular files. Identity is native file identity, independent of pathname, parent spelling and capability kind. On Unix, ordinary access and a bound SQLite lifetime are mutually exclusive for the same inode. Either acquisition order refuses the incompatible newcomer with the existing typed Conflict path before it can close an ordinary descriptor of the database. Compatible ordinary readers may coexist. Game-to-game binding admission stays as d-20261011-01 decides: one distinct binding key per inode across published registrations and creation reservations, with its two existing Conflict messages. The SQLite side of the shared primitive must not become a second per-inode liveness record that can diverge from that admission. The game-to-game and ordinary-versus-SQLite decisions read one per-inode SQLite admission state under one arbitration.

The SQLite reservation begins before connection creation can hold locks and survives pending creation, published registrations and every live connection. Ordinary ownership survives every actual source descriptor and clone. Close all ordinary descriptors before releasing their final ownership, under the same arbitration that admits a new SQLite reservation. There must be no check-to-open, check-to-close or final-drop-to-reacquire gap. Unwind, cancellation, failed creation and poisoned-state paths preserve lock safety and release owned reservations without panic. Do not hold any registry lock across await, callbacks or a nested registry acquisition. Preserve a documented lock order with the existing VFS registry and the repository's state mutex. Retired-predecessor admission is taken and its mutex dropped before binding acquisition, and that order must remain. An ownership refusal never waits on a retirement.

Use the existing VFS quarantine policy through this boundary rather than duplicate identity-liveness registries. Retention and admission cover creating SQLite reservations as well as published holders. Quarantine descriptors may drain only while new incompatible acquisition is excluded. Retain d-20260930-10's admission threshold of 8 and its allowance for already-admitted opens. Refuse at admission rather than closing a retained descriptor to clear capacity.

Bound SQLite sidecars need ordinary ownership too. Their raw descriptors are handed to SQLite, so retain their ordinary leases in the owning registration until all its connections close. This conservative lifetime may refuse another database binding longer than that sidecar descriptor is open, but never shorter. Private main-file descriptors remain owned by SQLite's existing close protocol. The native handoff is confined to this adapter and never offered as a general carrier escape.

### O2 — open safely and carry ownership through consumers

Mandate basis: "the generic resolver opens and retains an ordinary leaf descriptor" and "a puzzle snapshot and a PGN export genuinely read or write the bytes".

The ordinary regular-file opening boundary returns an owning carrier whose transfer and clone preserve O1, rather than an unguarded File plus a guard that callers can discard independently. Provide the I/O and native borrowed-descriptor operations existing consumers need, without a production consuming escape to a bare File or an untracked clone. Directory descriptors and private freshly created temporary files need no inode exclusion because they cannot be aliases of a pre-existing authorized data inode. A file created with exclusive create must still carry ownership if it becomes reachable by a database binding before its last descriptor closes.

On Linux, identify the retained leaf with O_PATH and fstat, perform admission, then reopen that exact descriptor with the required ordinary access. Never reopen the name after admission. Refusal, O_PATH inspection failure or proc reopen failure closes no lockable foreign inode. Unavailable proc fails closed. On macOS, serialize lockable open, identification and admission against SQLite acquisition, preserve the expected identity check, and quarantine any actually opened descriptor of an incompatible bound inode or an unclassified descriptor before returning an error. No failure may implicitly drop that unsafe descriptor. Preserve nonblocking special-file refusal and parent/no-follow checks. Windows preserves the current handle rights, share modes and handle-scoped lock behavior, without inventing Unix lock exclusion there.

Migrate resolution, PGN snapshot refresh and cloning, puzzle snapshot copying and retained source, puzzle deletion, PGN import/export, workspace readers and metadata sidecars, preferred and legacy search-index opening and mapping, verified image/artifact carriers and their direct consumers. Also route generic capability-derived regular opens inside the filesystem adapters through this ownership boundary whenever their objects can alias an authorized database. SQLite sidecar hooks must not close a sidecar descriptor that aliases another active database primary. Borrowed metadata-only probes stay descriptor-free on Unix.

Keep existing behavior governed by d-20261008-08 (descriptor-based PGN revision retries), d-20261008-15 and d-20261008-16 (opened-sidecar provenance and error propagation), d-20261005-06 (mapping invalidation), d-20261002-08 (sidecar deletion policy) and d-20260905-07 (authorized-directory containment). Keep the retirement and predecessor-barrier behavior of d-20261011-07 through d-20261011-13 unchanged. Ordinary ownership can last for an engine-resource lifetime. Cached SQLite bindings count even when idle, and a retired pool's binding counts until its retirement completes. Refusals are immediate, never a wait between the opposing nested operation orders.

### O3 — behavior, failure and platform witnesses

Mandate basis: "with the lock silently gone ... database corruption".

Prove lock survival with actual repository connections holding a read transaction and an external child observing the inode's POSIX lock. Cover each mandate consumer family through its production entry point, with same-name and hard-link aliases, compatible independent-file success and both acquisition orders. Include a retired-but-draining predecessor pool as a SQLite holder, and keep the existing d-20261011-01 same-parent and cross-parent binding refusals green. Cover a surviving duplicate after the original carrier drops, ownership transfer, last-owner release allowing retry, canceled or malformed puzzle/PGN/index operations, creation failure, and concurrent final close versus SQLite admission. Use deterministic hooks and barriers rather than sleep-based interleavings.

Platform-specific witnesses exercise leaf substitution and metadata/reopen errors at the actual opening boundary. Linux refusal paths must never create a lockable descriptor of the protected inode. macOS refusal paths must retain unsafe and unclassified descriptors, preserve locks, refuse further admission at capacity and drain safely at the last SQLite holder. Preserve original I/O errno when it is not a compatibility conflict. Process-isolate poison and global-quarantine tests. Windows proves the shared carrier compiles and ordinary supported operations still succeed, with native rights/share-mode fixtures.

Take a Git-derived withdrawal of the source fix while keeping the new regression tests, observe their intended failure, restore byte-identical source and rerun green. Compiler/unit proofs establish integration. Linux measurements establish Linux semantics. macOS and Windows runtime claims require the named pushed-head CI jobs. No source-pattern assertion substitutes for the lock witness.

## Decisions and trade-offs

Retain build tier. The existing decisions resolve platform primitives but do not select the cross-kind ownership and integration contract. This requires a coordinated concurrency and filesystem change rather than one exact mirrored edit.

One cohesive implementation phase owns the shared primitive and all carrier migrations, because changing the ordinary-file return type and integrating SQLite exclusion cannot ship separately without leaving a safety gap or broken consumers. Read-only review is delegated through the selected Codex executor. The root owns tracing, plan writing and arbitration. Round 1 runs every plan-capable lens. No full-history fork is used. All leaf prompts name applicable rule files.

## Decided autonomously

* **Question:** refuse concurrent cross-kind alias access or preserve it through retained descriptors? **Chosen:** symmetric Unix inode admission with lifetime-carrying ordinary files. **Rejected:** a pool-live check at resolution only, which misses reverse ordering, and retention of every successful ordinary descriptor until pool release, which can accumulate descriptors under normal repeated reads. **Reason:** refusal prevents the lock-release mechanism with explicit ownership. **Reversal path:** a measured close-safe shared-descriptor alternative covering all consumers and both orders can replace admission.
* **Question:** what error reaches the user? **Chosen:** existing Conflict presentation for an incompatible live inode, preserving native I/O errors and existing cancellation elsewhere. **Rejected:** new settings, new dialogs or persisted cross-kind prohibitions. **Reason:** transient resource conflict follows the precedents d-20260929-05 and d-20261011-01 and does not change what capability authorization promises. **Reversal path:** amend the ordinary admission error mapping and its caller tests.
* **Question:** who performs acceptance? **Chosen:** agent-run native lock witnesses and pushed-head platform CI. **Rejected:** a manual native picker test as the correctness gate. **Reason:** the defect is descriptor lifecycle, which the existing backend test harness observes directly. **Reversal path:** add manual acceptance only for a newly introduced native GTK surface.

## Risks / open questions

* macOS and Windows runtime evidence is unavailable in this planning snapshot. The adopting run must wait for rust-macos-test, rust-windows-test and the rust-platform matrix on its pushed SHA, and follow the existing remote-red refusal before pushing. f-20261008-06 is an open Windows puzzle-test failure that may block release, it is not settled by this plan.
* Wider generic File return-type changes require a complete importer inventory during implementation. Do not add a permissive raw-File escape to make compilation green.
* Global ownership must not reenter its mutex through destructor callbacks or from the VFS registry. Review the final diff for drop order and creation reservations.

## Not part of this task

Sibling findings remain open at their existing tiers, including f-20260929-04 (lens, retry diagnostics), f-20261002-02 (build, reused-inode test collisions), and f-20261008-06 (build, Windows puzzle deletion). f-20260929-05 (same-directory SQLite aliases) and f-20260930-01 (pool eviction/drain) are handled since this plan's prior base. Their decisions are inputs under O1 and O2, and this plan does not reopen them. Independent malformed content, index-provenance policy, renderer layout, renderer presentation of binding conflicts (f-20261009-03) and native GTK acceptance are outside this mandate.

## Phases

### Phase 1 — shared inode ownership and capability consumer migration

Files: `src-tauri/src/infra/mod.rs`, a new shared ownership module under `src-tauri/src/infra/`, `src-tauri/src/infra/fs.rs`, `src-tauri/src/infra/path_authority/{mod,resolved,verified}.rs`, `src-tauri/src/db/{bound_sqlite,repository,mod,search,search_index,content_validation,sqlite_cancellation,test_support}.rs`, `src-tauri/src/{puzzle,pgn,file_workspace,sound,practice,credentials,main,chess,game}.rs`, `src-tauri/src/engine/{process,types}.rs` and existing carrier-contract tests under `src-tauri/src/infra/platform_support/`. Edits in direct consumer files are limited to ownership-carrier integration and regression witnesses, preserving their domain semantics. The pinned-factory fixture in sqlite_cancellation.rs must acquire the shared ordinary carrier before passing it into the migrated puzzle snapshot factory, preserving its cancellation assertion. The traced importer inventory is frozen in this file list. Recheck it against the adopting revision before assigning the write leaf and put exact paths in its brief. No source edit belongs to this planning run.

Contract: O1 through O3. Touches filesystem capability ownership, concurrency and descriptor persistence in memory. No persisted schema or IPC type change. Executor Codex, role sensitive, model/effort resolved from `leaf.codex.write.sensitive`. One sequential write leaf, no root implementation.

Proof command: `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable && pnpm checks:pre-review && pnpm gates:contract:check`. Include the new native witnesses in the existing test binary, with Linux/macOS cfg parity. Record the Git-derived red/green withdrawal evidence. The root repeats the command and inspects the complete diff before the phase commit.

After cumulative diff review and repairs, run `pnpm build && pnpm verify:app` as the real-product startup/teardown smoke check. Its existing harness does not claim to reproduce the cross-capability race. No renderer pixels change, so no screenshot re-recording is proposed.

Final gates on the clean committed tree: `pnpm gates:push -- --rust --frontend --bindings`, selected from the canonical push mapping because the planned carrier consumer set includes main.rs. No floor, baseline or budget may be lowered. Then complete the project's push skill, pushed-head macOS/Windows runtime CI and installation when applicable. Record autonomous decisions and close the finding only in the adopting execution run through findings.py. Planner modes stop before Preflight, without locks, ledger writes, commits, push, dev server or browser.

## Carried to diff review

None at initial revision.

## Reviews

Plan authorship and arbitration shared one root Codex context. Detection ran on the same Codex model family selected for implementation. These are independent read-only leaf contexts, not independent model-family detection. No implementation or runtime platform verification occurred.

### Round 1 — initial frozen plan

Candidate: RUN_TMP/plan-r1.md at base ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. All 12 plan-capable lenses completed through leaf-launch.sh, with terminal markers confirmed by drain-poll-leaves.py. The code-quality and root-cause lenses explicitly exclude plan review. Raw prompts, reports and JSONL remain alongside the snapshot in RUN_TMP. Review leaf elapsed from snapshot to observed completion: 385.438 seconds. No known non-overlapping quota, dependency, release or other wait. Active wall elapsed is recorded separately when arbitration finishes, parallel leaf durations are not summed.

Raw counts: blocker 1, should-fix 0, nit 0. Unique opened I1, resolved none. Adopted plan-level corrections 1, carried 0, arbiter nits 0, Skip 0, Defer 0. No withdrawal, rewrite, split or correction-introduced defect. Downstream rework is not yet applicable.

| ID | Witnesses and raw verdict | Disposition | Evidence and affected obligation | Authority | Correction revision, dependency and closure |
| --- | --- | --- | --- | --- | --- |
| I1 | plan r1 finding 1, blocker, confidence 98, REVISE | Fix | db/sqlite_cancellation.rs:482 opens File, :485 passes it to repository.rs:531–535. Confirmed by root source read. O2 changes that factory's carrier contract. Its known test caller must migrate for integration and cancellation proof to compile. | MANDATE names puzzle reads through schema_specific_connection_expected_file_cancellable and its clones. Existing O2 already requires the owning carrier across those consumers. No new mechanism. | r2 adds sqlite_cancellation.rs to the frozen phase scope and explicitly preserves its cancellation assertion while acquiring the shared carrier. Dependencies none. Closure open pending review-plan check. |

Raw output below is preserved unchanged.

#### correctness r1

```text
No concrete correctness mismatch found in O1–O3. The plan covers both acquisition orders, clone ownership, final-close arbitration, and SQLite sidecar handoffs.

Limitation: this is plan review. Implementation drop order, mutex interactions, and macOS/Windows runtime behavior remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### error-handling r1

```text
VERDICT: APPROVED
```

#### minimalism r1

```text
No bloat or duplication findings. The shared ownership boundary has multiple existing consumers, and the carrier migrations address descriptor lifetimes required by the mandate. The plan explicitly reuses quarantine policy and limits consumer edits to integration and regression witnesses.

VERDICT: APPROVED
```

#### plan r1

```text
[blocker] tasks/plans/2026-10-09-cross-capability-sqlite-locks.md:101 — O2 changes the puzzle snapshot factory’s ownership contract, but the file list omits `src-tauri/src/db/sqlite_cancellation.rs:482`, which opens a bare `File` and passes it to `schema_specific_connection_expected_file_cancellable` at line 485. The factory currently accepts `File` at `src-tauri/src/db/repository.rs:533`. Address this consumer in the frozen migration scope before delegation. Deferring importer inventory to implementation leaves a known caller unaddressed (confidence: 98).

Limitation: platform runtime behavior was not exercised during this read-only review (confidence: 100).

VERDICT: REVISE
```

#### tests r1

```text
The proposed proofs would catch a revert: external lock assertions cover lock survival, duplicate/drop/retry witnesses cover ownership lifetime, and native CI runs the platform tests. O3 also requires observed Git-derived red/green evidence. No verification gaps found at plan altitude.

VERDICT: APPROVED
```

#### chess-semantics r1

```text
NOT APPLICABLE: O1–O3 govern inode admission, descriptor ownership and lock verification. Consumer edits preserve domain semantics. The plan changes no in-memory chess tree, position identity, move path, parity, legality or metadata round trip.

VERDICT: APPROVED
```

#### engine-protocol r1

```text
No in-lens defects found in the plan’s ownership-carrier integration. Engine identity, result guards and process supervision remain preserved by its contract. Runtime verification remains for implementation.

VERDICT: APPROVED
```

#### ipc-contract r1

```text
NOT APPLICABLE: O1–O3 cover native inode admission, descriptor ownership and lock witnesses. The plan explicitly preserves renderer IPC signatures and limits consumer edits to ownership-carrier integration. It introduces no event, command, payload, listener or Tauri capability-scope change.

VERDICT: APPROVED
```

#### persisted-state r1

```text
NOT APPLICABLE: O1–O3 and all planned files concern backend inode ownership and descriptor lifetimes. The plan explicitly preserves persisted schemas and renderer IPC signatures, with no renderer storage, atom-family or tab-lifecycle changes.

VERDICT: APPROVED
```

#### pgn-index r1

```text
No findings within this lens. The plan preserves PGN streaming, descriptor-based revision retries, search-index provenance and invalidation, and import transaction boundaries during ownership migration.

VERDICT: APPROVED
```

#### platform-semantics r1

```text
No platform-semantics findings. The plan covers Linux descriptor reopening, macOS quarantine and close arbitration, and preservation of Windows handle behavior.

Verification remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. Runtime proof requires pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and clippy evidence only.

VERDICT: APPROVED
```

#### tauri-security r1

```text
No security-boundary defects found in the r1 plan. O1–O3 require sealed descriptor ownership, preserved no-follow containment, safe failure retention and native lock witnesses.

Limitation: this is plan review only. Implementation and platform runtime behavior remain unverified. No token/session or signed-manifest behavior change is proposed.

VERDICT: APPROVED
```

### Round 1 — arbitration completion

Wall elapsed including source confirmation, correction writing and arbitration: 511.358 seconds. Active review wall time: 511.358 seconds, with zero known non-overlapping waits. The earlier 385.438 seconds is the narrower leaf-completion interval. Adopted count remains r1=1. I1 awaits its r2 closure check, with no other open issue.

### Round 2 — I1 closure

Candidate: RUN_TMP/plan-r2.md at the unchanged base, with body-only candidate tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r2.body.md and exact delta tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r2.diff. Root checked the complete delta and the source-confirmed caller inventory before launch. Only review-plan ran because it is the sole I1 witness and no new domain contract changed. The original review-plan body was preserved in the closure prompt. Prior snapshot, full history, current issue, corrected mechanism, source trace and dependent cancellation proof were supplied.

The leaf completed through leaf-launch.sh, confirmed by drain-poll-leaves.py. Wall and active review elapsed including arbitration: 183.640 seconds. Known non-overlapping waits: quota 0, dependency 0, release 0, other 0. No parallel-duration summation.

Raw counts: blocker 0, should-fix 0, nit 0. Opened none, resolved I1. Adopted plan-level corrections r2=0. Unique totals: opened 1, resolved 1, open 0. Carried 0, Skip 0, Defer 0, arbiter nits 0. No inherited history, withdrawal, rewrite, split or correction-introduced defect. Implementation and downstream rework have not begun.

| ID | Disposition and closure | Evidence | Remaining obligation |
| --- | --- | --- | --- |
| I1 | Fix, closed_round 2 | review-plan explicitly reports I1 CLOSED against r2 body:102 and verifies sqlite_cancellation.rs:485 with repository.rs:531. Root confirms the exact file-list and carrier-acquisition correction. | No open plan issue. Compilation and native runtime witnesses remain execution obligations O2–O3. |

#### plan r2

```text
I1 CLOSED — r2 plan `tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r2.body.md:102` includes `sqlite_cancellation.rs` and requires shared-carrier acquisition while preserving cancellation. The caller at `src-tauri/src/db/sqlite_cancellation.rs:485` matches the factory at `src-tauri/src/db/repository.rs:531`. All traced factory callers are now in scope (confidence: 98).

Limitation: compiler and platform runtime proofs were not run during this read-only review (confidence: 100).

VERDICT: APPROVED
```

### Final planner state

Completed rounds 2, measured review wall time 694.998 seconds, adoptions r1=1 r2=0. All 12 plan-capable lenses covered, with 13 completed leaf reports. The sole blocker was source-confirmed, corrected and explicitly closed in r2. No unresolved or carried review issue. Mandatory implementation proof and native platform CI remain pending because this run stops before Preflight.

The full record is copied to tasks/plans/reviews-handoff.md for the supervisor to publish with the plan. The adopting run must load it before review, preserve I1's witness and closure history, record the autonomous technical decisions in tasks/decisions.md, and promote the review history to a tracked tasks/handoffs/2026-10-09-f-20261001-02-review.md before closing the finding. No ledger, tracked source, commit, push or installation belongs to this planning run.


### Round 3 — PLAN-REFRESH drift at 8bccb79c

Refresh resumed on 2026-10-10 with the approved r1–r2 plan and a clean checkout. There was no uncommitted source work to preserve or completed implementation to close in the ledger. The explicit PLAN-REFRESH no-writer contract governs this lane. Original plan, metadata, handoff and verified 13-row review manifest were preserved under RUN_TMP/refresh-8bccb79c-seed before any update. The prior record below the Reviews heading remains byte-identical as this round is appended.

Original base: ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. New base: 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee. Source drift: RUN_TMP/drift-ca0ab68689e0f4de8ca0b84df2be29963bcfc66c-8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee.diff, exactly the process-generated git diff, root-confirmed sha256 a823133fe4b3fed024291ec48937a89e23675415a527790ce65e837e98ce81f0. The strict drift scope requires each finding to name a changed path or symbol and the invalidated O1, O2 or O3 obligation.

Tier revalidation retained build. Root confirmed the changed search context still uses the ordinary preferred sidecar File at db/search.rs:322, and the legacy File and clone at db/search_index.rs:908. Export still resolves its ordinary destination before obtaining its database connection at db/mod.rs:3587–3594. Bound SQLite, the repository and generic filesystem ownership code are unchanged by this drift. The cross-kind protection is therefore still an unimplemented coordinated ownership design. No new mechanism or acceptance contract was adopted.

Candidate: RUN_TMP/plan-r3.md, with tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r3.body.md. Plan delta: tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r3.diff. Its changes update the current base, relocated citations, existing decision context and planner-mode wording. Root inspected the full delta before launch. Every prompt included both full SHAs, the production drift file, fixed MANDATE, complete prior history, current decision excerpts, named rules and pending implementation proofs.

All twelve REFRESH-LENSES ran exactly once through leaf-launch.sh in parallel. Codex was the selected executor, with role review-plan for plan and sensitive for the other lenses. Every report has a confirmed completed terminal marker and an APPROVED verdict. Plan authorship and arbitration shared one root context. Detection ran on the same Codex model family selected for implementation, with session separation and no family separation.

Wall and active review elapsed including arbitration: 207.604 seconds. Leaf-completion interval: 190.124 seconds. Known non-overlapping waits: quota 0, dependency 0, release 0, other 0. Ordinary polling while leaves worked is review elapsed. Parallel leaf durations are not summed.

Raw counts: blocker 0, should-fix 0, nit 0. New issues 0, adoptions r3=0, carried 0, Skip 0, Defer 0, arbiter nits 0. I1 remains closed in r2, confirmed again by the r3 plan lens. No reopening, withdrawal, rewrite, split or correction-introduced defect. No source implementation or downstream rework. Findings-ledger check passed read-only: 515 findings, 167 pickable, 3 blocked. No out-of-drift defect was reported or filed.

Raw r3 outputs follow unchanged.

#### chess-semantics r3

```text
No chess-domain findings in the r3 delta or production drift that invalidate O1–O3. O2 preserves setup construction, position matching, continuation handling and repertoire cache semantics.

Read-only review. No runtime proofs run.

VERDICT: APPROVED
```

#### correctness r3

```text
No correctness defect found within the r3 drift scope. The changed search/index paths remain covered by O2, and export still exercises the reverse acquisition order covered by O1.

Limitation: carrier implementation, drop ordering and native lock/platform behavior remain unverified in this read-only plan review (confidence: 100).

VERDICT: APPROVED
```

#### engine-protocol r3

```text
NOT APPLICABLE: The r3 delta preserves O1–O3 ownership obligations. Production drift changes database search, progress, setup and cache behavior, with no changes to engine supervision, UCI sequencing or asynchronous engine-result routing that invalidate those obligations.

VERDICT: APPROVED
```

#### error-handling r3

```text
No error-handling drift invalidates O1–O3. The refresh preserves typed conflicts, native I/O errors, cancellation and intentional best-effort progress diagnostics.

Limitation: implementation and native lock/platform runtime proofs remain pending (confidence: 100).

VERDICT: APPROVED
```

#### ipc-contract r3

```text
No IPC-contract findings in the r3 delta or production drift that invalidate O1–O3. Progress remains Specta-registered, with matching operation identity, generation and percentage units. Command signatures and capability scopes are unchanged.

VERDICT: APPROVED
```

#### minimalism r3

```text
No bloat or duplication defects found within the r3 refresh scope. The drift leaves O1–O3 necessary. The shared ownership module still has multiple concrete consumers, and O2 preserves the changed domain semantics without adding deliverables.

VERDICT: APPROVED
```

#### persisted-state r3

```text
NOT APPLICABLE: The plan delta and production drift affect backend inode ownership, database semantics, transient progress and repertoire caches. They change no renderer storage keys, persisted atoms, hydration or tab lifecycle. O1–O3 introduce no persisted renderer-state contract.

VERDICT: APPROVED
```

#### pgn-index r3

```text
No PGN/index defects found within the r3 drift scope. O2 preserves the changed setup, search cancellation, cache predicates and stored index format while covering both sidecar open paths and PGN export ordering.

Runtime and platform proof remain pending under O3. No files changed or gates run.

VERDICT: APPROVED
```

#### plan r3

```text
No drift-scoped plan defects found. The changed search paths introduce no omitted ownership-carrier consumer and do not invalidate O1–O3. I1 remains closed.

Limitation: compilation, native lock witnesses and platform runtime proofs were not run in this read-only review (confidence: 100).

VERDICT: APPROVED
```

#### platform-semantics r3

```text
No platform-semantics findings within the r3 drift scope. The changed paths do not invalidate O1–O3.

Verification remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe ran in this review. Runtime proof requires pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and Clippy evidence only.

VERDICT: APPROVED
```

#### tauri-security r3

```text
No in-lens drift defects found that invalidate O1–O3. Changed progress diagnostics remain native through `src-tauri/src/progress.rs:451` and the log targets at `src-tauri/src/main.rs:1981`.

Limitation: this is a read-only plan review. Native lock witnesses and macOS/Windows runtime evidence remain mandatory execution proofs.

VERDICT: APPROVED
```

#### tests r3

```text
No drift-induced verification gaps found. O1–O3 retain external SQLite lock assertions, ownership/drop/retry witnesses and mandatory compiled red/green withdrawal evidence. The phase command includes the new consumer regressions, and native CI jobs run all Rust targets.

Limitation: implementation and platform runtime proof remain pending. Drift records unavailable GitHub Actions execution, so O3 cannot be declared complete until exact-SHA CI succeeds (confidence: 100).

VERDICT: APPROVED
```

### Final refresh state

Completed cumulative rounds 3, review wall time 902.602 seconds, adoptions r1=1 r2=0 r3=0. This refresh added one drift round and 12 completed leaf reports to the inherited two rounds and 13 reports. Unique issues opened 1, resolved 1, open 0. I1's original witness, correction and r2 closure are preserved unchanged in metadata. There are no carried or deferred review obligations.

The reviewed ownership plan stands at NEW-BASE 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee. Implementation, Git-derived red/green lock witnesses and exact-SHA native platform CI remain mandatory for the adopting run. The planner stops before Preflight. The supervisor owns publication, and the adopter records the existing autonomous decisions and promotes this full history to a tracked handoff before closing f-20261001-02. No new autonomous design decision reverses a precedent in this refresh.

### Round 4 — PLAN-REFRESH drift at eb1ee092

Refresh resumed on 2026-10-12 with the approved r1–r3 plan and a clean checkout at NEW-BASE. There was no uncommitted source work to preserve or completed implementation to close in the ledger. The explicit PLAN-REFRESH no-writer contract governs this lane. Original plan, metadata and handoff were preserved under RUN_TMP/refresh-eb1ee092-seed before any update. The prior record below the Reviews heading remains byte-identical as this round is appended.

Previous base: 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee. New base: eb1ee092f127d49d2a842b9da5b1010326232d04. Source drift: RUN_TMP/drift-8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee-eb1ee092f127d49d2a842b9da5b1010326232d04.diff, exactly the process-generated git diff, root-confirmed sha256 bd112bff78ae2887fa8462261a4aedf8b0f44563bdcb6e2e48cdf6c1e21a64ea (228 commits, 48046 lines). The strict drift scope requires each finding to name a changed path or symbol and the invalidated O1, O2 or O3 obligation.

Tier revalidation retained build. The open cross-kind ownership question is not settled by d-20261011-01 (same-kind binding admission only) or d-20260930-10. Root traced the drift in the plan's paths. Drift touched bound_sqlite.rs (f1c56ef5, 03be4187: one distinct binding key per inode, d-20261011-01), repository.rs (6f631aac, db366326, 302a55a6, 035654c6, aad87640: bounded LRU retirement with predecessor admission, pool worker threads, test connection budget, busy_timeout order), content_validation.rs (scan predecessor admission), search.rs (1d6362e9: shared probe-attempt resolution), db/mod.rs (pragma order, resolve count), and test-only flock retry helpers in infra/fs.rs and path_authority/mod.rs. Root confirmed every ordinary open path still yields a plain File: search.rs:321, search_index.rs:908,916,918, and repository.rs:906,922. Root also confirmed predecessor admission drops the repository state mutex before BoundDatabase::acquire (repository.rs:654–700,1085–1087,1404–1409, content_validation.rs:561–562). BoundConnectionManager owns its BoundDatabase (repository.rs:293–300), and Retirement::complete requires drained connection and owner tickets (repository.rs:566–571).

Root-authored refresh corrections in this candidate, each reviewed by this round's lenses: (1) O1 replaces the superseded d-20260929-05 game-to-game wording with d-20261011-01 and requires one per-inode SQLite admission state under one arbitration. (2) The O1 lock order names the repository state mutex and forbids an ownership refusal from waiting on a retirement. (3) O2 preserves d-20261011-07 through d-20261011-13 and counts a retired pool's binding until retirement completes. (4) O3 adds a retired-but-draining predecessor holder witness and keeps the d-20261011-01 refusal regressions green. (5) Traced premises carry relocated citations and a refresh trace, and Not part of this task records f-20260929-05 and f-20260930-01 as handled and names f-20261009-03. These are drift-required updates to existing obligations, not new mechanisms. Authority: the MANDATE words "while a game-database pool holds SQLite locks on it" cover a retired pool that still owns its binding and connections, and d-20261011-01 and d-20261011-07 through d-20261011-13 are recorded precedents. No new component, lock, protocol or state file was added.

Candidate: RUN_TMP/plan-r4.md, with tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r4.body.md. Plan delta: tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r4.diff (REVISED: Goal, Traced premises, O1, O2, O3, Decided autonomously, Not part of this task). Root inspected the full delta before launch. Every prompt included both full SHAs, the drift file and its hash, fixed MANDATE, the full prior history by reference, current decision excerpts (RUN_TMP/decisions-r4.md, 41 entries), named rules, the corrected mechanism and pending implementation proofs. The lens bodies were transferred unchanged from the current review-*.md sources.

All twelve REFRESH-LENSES ran exactly once through leaf-launch.sh in parallel. Codex was the selected executor, with role review-plan for plan and sensitive for the other lenses. drain-poll-leaves.py confirmed 12/12 completed terminal records. Every report has an APPROVED verdict. Four lenses returned NOT APPLICABLE with reasons the arbiter checked and accepted: chess-semantics, engine-protocol, ipc-contract and persisted-state. Plan authorship and arbitration shared one root context. Detection ran on the same Codex model family selected for implementation, with session separation and no family separation.

Wall and active review elapsed including arbitration: 212.566 seconds. Leaf-completion interval: 171.127 seconds. Known non-overlapping waits: quota 0, dependency 0, release 0, other 0. Ordinary polling while leaves worked is review elapsed. Parallel leaf durations are not summed. Plan writing before the snapshot is excluded.

Raw counts: blocker 0, should-fix 0, nit 0. New issues 0, adoptions r4=0, carried 0, Skip 0, Defer 0, arbiter nits 0. Every applicable lens explicitly judged corrections (1)–(5) correct and sufficient. I1 remains closed in r2. No reopening, withdrawal, rewrite, split or correction-introduced defect. No source implementation or downstream rework. No out-of-drift defect was reported or filed.

Raw r4 outputs follow unchanged.

#### chess-semantics r4

```text
NOT APPLICABLE: The plan delta and affected production drift change inode admission, descriptor ownership, pool retirement and index acquisition. They do not change in-memory chess trees, position identity, move paths, parity or metadata round trips. Corrections (1)–(5) introduce no chess-domain obligation requiring further review by this lens.

VERDICT: APPROVED
```

#### correctness r4

```text
No correctness defect found within the r4 drift scope. Corrections (1)–(5) are correct and sufficient at plan level:

- O1 preserves distinct-key refusal across live bindings and creation reservations under one arbitration.
- Repository predecessor admission releases its state mutex before binding acquisition.
- O2 retains protection for idle bindings and draining retired pools.
- O3 adds the retired-holder witness and preserves hard-link refusal regressions.
- Updated source citations match the current consumer boundaries.

Limitation: implementation drop order, concurrent interleavings and native platform behavior remain unverified. Required runtime proofs are still pending (confidence: 100).

VERDICT: APPROVED
```

#### engine-protocol r4

```text
NOT APPLICABLE: The r4 corrections (1)–(5) concern SQLite inode admission, pool retirement, descriptor ownership and lock witnesses. No engine supervisor or UCI protocol code changed. Engine carrier integration remains unchanged in scope. The corrections introduce no engine identity, process supervision or asynchronous result-routing obligation for this lens to assess.

VERDICT: APPROVED
```

#### error-handling r4

```text
No error-handling drift defect invalidates O1–O3. Corrections (1)–(5) are correct and sufficient within this lens: they preserve typed conflicts, cancellation and I/O errors, retain ownership through failed retirement, and require failure witnesses for draining pools.

Limitation: implementation, immediate-refusal behavior and native platform runtime proofs remain unverified in this read-only plan review (confidence: 100).

VERDICT: APPROVED
```

#### ipc-contract r4

```text
NOT APPLICABLE: O1–O3 and corrections (1)–(5) concern internal inode admission, descriptor ownership and SQLite retirement. The relevant production drift changes no IPC event, command signature, payload, Specta registration or capability scope. The corrections introduce no IPC requirement or invalidate an existing contract within this lens.

VERDICT: APPROVED
```

#### minimalism r4

```text
No bloat or duplication defects found within r4 drift scope.

Corrections (1)–(5) are correct and sufficient for this lens. O1 requires one authoritative SQLite admission state. O2 preserves existing retirement ownership and barriers. O3’s retired-but-draining witness tests a concrete new lifetime, without expanding MANDATE. Updated citations and exclusions add no implementation deliverables.

The shared module has multiple concrete consumers. The smallest sufficient implementation remains a shared admission boundary, sealed carrier, and necessary consumer migrations.

Limitation: implementation size and helper necessity remain for cumulative diff review (confidence: 100). No files changed or runtime proofs run.

VERDICT: APPROVED
```

#### persisted-state r4

```text
NOT APPLICABLE: O1–O3 and corrections (1)–(5) concern backend inode admission, descriptor ownership and lock witnesses. They introduce no renderer storage keys, atom families, hydration or tab lifecycle changes. Renderer changes elsewhere in DRIFT do not invalidate these obligations within this lens.

VERDICT: APPROVED
```

#### pgn-index r4

```text
No PGN/index defects found within the r4 drift scope. Corrections (1)–(5) are correct and sufficient for this lens: O1 preserves unified inode admission, O2 preserves descriptor-based PGN retries and search-index provenance/invalidation, and O3 covers retired-but-draining SQLite holders.

Read-only review. No files changed or runtime proofs run. Native lock witnesses and platform CI remain required.

VERDICT: APPROVED
```

#### plan r4

```text
No drift-scoped plan defects found. Corrections (1)–(5) are correct and sufficient at plan level: binding admission matches `bound_sqlite.rs:214`, lock ordering matches `repository.rs:1085` and `content_validation.rs:561`, and retirement ownership matches `repository.rs:293,566`. O2 still covers the changed consumers, and O3 requires a retired-holder lock witness.

Limitation: compilation, regression withdrawal and native platform proofs were not run in this read-only review (confidence: 100).

VERDICT: APPROVED
```

#### platform-semantics r4

```text
No platform findings within drift scope. Corrections (1)–(5) are correct and sufficient for this lens: they preserve distinct-binding admission, repository lock order, retired binding ownership, native lock witnesses and relocated consumer premises.

Proof remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. Native runtime evidence must come from pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and Clippy evidence, not runtime evidence.

VERDICT: APPROVED
```

#### tauri-security r4

```text
No drift-scoped security findings. Corrections (1)–(5) are correct and sufficient at plan level: they preserve shared inode admission, mutex ordering, retired-binding ownership, draining-pool witnesses and the affected consumer boundaries.

Changed pool diagnostics remain renderer-safe. O2 retains containment, no-follow checks and sealed descriptor ownership. No credential/session or signed-manifest change occurs in the production drift.

Limitation: implementation, native lock witnesses and macOS/Windows runtime evidence remain unverified and mandatory under O3. No files changed or gates run.

VERDICT: APPROVED
```

#### tests r4

```text
Corrections (1)–(5) are correct and sufficient within this verification lens. O3 adds the drift-relevant retired-but-draining holder witness and preserves binding-refusal regressions. External lock assertions would catch unsafe descriptor closure. Clone/drop/retry witnesses cover ownership lifetime, and mandatory Git-derived red/green withdrawal checks whether the anchors detect a revert.

The phase command selects the Rust test binary. macOS and Windows CI run all Rust targets. No drift-induced verification gap found.

Limitation: these are proposed proofs. Implementation, withdrawal results and exact-SHA platform runtime evidence remain pending (confidence: 100).

VERDICT: APPROVED
```

### Final refresh state (r4)

Completed cumulative rounds 4, review wall time 1115.168 seconds, adoptions r1=1 r2=0 r3=0 r4=0. This refresh added one drift round and 12 completed leaf reports to the inherited three rounds and 25 reports. Unique issues opened 1, resolved 1, open 0. I1's original witness, correction and r2 closure are preserved unchanged in metadata. There are no carried or deferred review obligations.

The reviewed ownership plan stands at NEW-BASE eb1ee092f127d49d2a842b9da5b1010326232d04. Implementation, Git-derived red/green lock witnesses and exact-SHA native platform CI remain mandatory for the adopting run. The planner stops before Preflight. The supervisor owns publication. The adopter records the existing autonomous decisions and promotes this full history to a tracked handoff before closing f-20261001-02. No new autonomous design decision reverses a precedent in this refresh.


## Evidence

### Manifest

[
  {
    "artefact": "lens-chess-semantics-r1.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r1.prompt",
    "report": "lens-chess-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r1.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r1.prompt",
    "report": "lens-correctness-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r1.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r1.prompt",
    "report": "lens-engine-protocol-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r1.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r1.prompt",
    "report": "lens-error-handling-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r1.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r1.prompt",
    "report": "lens-ipc-contract-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r1.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r1.prompt",
    "report": "lens-minimalism-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r1.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r1.prompt",
    "report": "lens-persisted-state-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r1.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r1.prompt",
    "report": "lens-pgn-index-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/2026-10-09-cross-capability-sqlite-locks.md:101 — O2 changes the puzzle snapshot factory’s ownership contract, but the file list omits `src-tauri/src/db/sqlite_cancellation.rs:482`, which opens a bare `File` and passes it to `schema_specific_connection_expected_file_cancellable` at line 485. The factory currently accepts `File` at `src-tauri/src/db/repository.rs:533`. Address this consumer in the frozen migration scope before delegation. Deferring importer inventory to implementation leaves a known caller unaddressed (confidence: 98)."
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r1.prompt",
    "report": "lens-plan-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r2.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r2.prompt",
    "report": "lens-plan-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r1.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r1.prompt",
    "report": "lens-platform-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r1.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r1.prompt",
    "report": "lens-tauri-security-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r1.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r1.prompt",
    "report": "lens-tests-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r3.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r3.prompt",
    "report": "lens-chess-semantics-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r3.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r3.prompt",
    "report": "lens-correctness-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r3.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r3.prompt",
    "report": "lens-engine-protocol-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r3.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r3.prompt",
    "report": "lens-error-handling-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r3.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r3.prompt",
    "report": "lens-ipc-contract-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r3.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r3.prompt",
    "report": "lens-minimalism-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r3.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r3.prompt",
    "report": "lens-persisted-state-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r3.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r3.prompt",
    "report": "lens-pgn-index-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r3.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r3.prompt",
    "report": "lens-plan-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r3.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r3.prompt",
    "report": "lens-platform-semantics-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r3.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r3.prompt",
    "report": "lens-tauri-security-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r3.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r3.prompt",
    "report": "lens-tests-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r4.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r4.prompt",
    "report": "lens-chess-semantics-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r4.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r4.prompt",
    "report": "lens-correctness-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r4.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r4.prompt",
    "report": "lens-engine-protocol-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r4.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r4.prompt",
    "report": "lens-error-handling-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r4.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r4.prompt",
    "report": "lens-ipc-contract-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r4.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r4.prompt",
    "report": "lens-minimalism-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r4.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r4.prompt",
    "report": "lens-persisted-state-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r4.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r4.prompt",
    "report": "lens-pgn-index-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r4.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r4.prompt",
    "report": "lens-plan-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r4.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r4.prompt",
    "report": "lens-platform-semantics-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r4.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r4.prompt",
    "report": "lens-tauri-security-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r4.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r4.prompt",
    "report": "lens-tests-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "The frozen ownership migration scope omitted sqlite_cancellation.rs, whose pinned-factory fixture passes a bare File to the changed puzzle snapshot factory.",
    "closed_round": 2,
    "correction": "Added sqlite_cancellation.rs to the frozen phase scope and required shared-carrier acquisition while preserving its cancellation assertion. Confirmed the caller and factory in source. Review-plan explicitly closed I1 against the r2 candidate.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I1",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      }
    ]
  }
]

### delta-r2.txt

ROUND: 2
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r2.diff
REVISED:
## Traced premises
## Phases > ### Phase 1 — shared inode ownership and capability consumer migration
SETTLED:
# Plan: preserve SQLite locks across capability aliases
## Goal
## MANDATE
## MANDATE > ### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it
## Threat model and non-goals
## Approach
## Approach > ### O1 — one inode admission and close boundary
## Approach > ### O2 — open safely and carry ownership through consumers
## Approach > ### O3 — behavior, failure and platform witnesses
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r3.txt

ROUND: 3
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r3.diff
REVISED:
## Goal
## Traced premises
## Phases > ### Phase 1 — shared inode ownership and capability consumer migration
SETTLED:
# Plan: preserve SQLite locks across capability aliases
## MANDATE
## MANDATE > ### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it
## Threat model and non-goals
## Approach
## Approach > ### O1 — one inode admission and close boundary
## Approach > ### O2 — open safely and carry ownership through consumers
## Approach > ### O3 — behavior, failure and platform witnesses
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r4.txt

ROUND: 4
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r4.diff
REVISED:
## Goal
## Traced premises
## Approach > ### O1 — one inode admission and close boundary
## Approach > ### O2 — open safely and carry ownership through consumers
## Approach > ### O3 — behavior, failure and platform witnesses
## Decided autonomously
## Not part of this task
SETTLED:
# Plan: preserve SQLite locks across capability aliases
## MANDATE
## MANDATE > ### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it
## Threat model and non-goals
## Approach
## Decisions and trade-offs
## Risks / open questions
## Phases
## Phases > ### Phase 1 — shared inode ownership and capability consumer migration
## Carried to diff review

### lens-chess-semantics-r1.txt

NOT APPLICABLE: O1–O3 govern inode admission, descriptor ownership and lock verification. Consumer edits preserve domain semantics. The plan changes no in-memory chess tree, position identity, move path, parity, legality or metadata round trip.

VERDICT: APPROVED
### lens-chess-semantics-r3.txt

No chess-domain findings in the r3 delta or production drift that invalidate O1–O3. O2 preserves setup construction, position matching, continuation handling and repertoire cache semantics.

Read-only review. No runtime proofs run.

VERDICT: APPROVED
### lens-chess-semantics-r4.txt

NOT APPLICABLE: The plan delta and affected production drift change inode admission, descriptor ownership, pool retirement and index acquisition. They do not change in-memory chess trees, position identity, move paths, parity or metadata round trips. Corrections (1)–(5) introduce no chess-domain obligation requiring further review by this lens.

VERDICT: APPROVED
### lens-correctness-r1.txt

No concrete correctness mismatch found in O1–O3. The plan covers both acquisition orders, clone ownership, final-close arbitration, and SQLite sidecar handoffs.

Limitation: this is plan review. Implementation drop order, mutex interactions, and macOS/Windows runtime behavior remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r3.txt

No correctness defect found within the r3 drift scope. The changed search/index paths remain covered by O2, and export still exercises the reverse acquisition order covered by O1.

Limitation: carrier implementation, drop ordering and native lock/platform behavior remain unverified in this read-only plan review (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r4.txt

No correctness defect found within the r4 drift scope. Corrections (1)–(5) are correct and sufficient at plan level:

- O1 preserves distinct-key refusal across live bindings and creation reservations under one arbitration.
- Repository predecessor admission releases its state mutex before binding acquisition.
- O2 retains protection for idle bindings and draining retired pools.
- O3 adds the retired-holder witness and preserves hard-link refusal regressions.
- Updated source citations match the current consumer boundaries.

Limitation: implementation drop order, concurrent interleavings and native platform behavior remain unverified. Required runtime proofs are still pending (confidence: 100).

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

No in-lens defects found in the plan’s ownership-carrier integration. Engine identity, result guards and process supervision remain preserved by its contract. Runtime verification remains for implementation.

VERDICT: APPROVED
### lens-engine-protocol-r3.txt

NOT APPLICABLE: The r3 delta preserves O1–O3 ownership obligations. Production drift changes database search, progress, setup and cache behavior, with no changes to engine supervision, UCI sequencing or asynchronous engine-result routing that invalidate those obligations.

VERDICT: APPROVED
### lens-engine-protocol-r4.txt

NOT APPLICABLE: The r4 corrections (1)–(5) concern SQLite inode admission, pool retirement, descriptor ownership and lock witnesses. No engine supervisor or UCI protocol code changed. Engine carrier integration remains unchanged in scope. The corrections introduce no engine identity, process supervision or asynchronous result-routing obligation for this lens to assess.

VERDICT: APPROVED
### lens-error-handling-r1.txt

VERDICT: APPROVED
### lens-error-handling-r3.txt

No error-handling drift invalidates O1–O3. The refresh preserves typed conflicts, native I/O errors, cancellation and intentional best-effort progress diagnostics.

Limitation: implementation and native lock/platform runtime proofs remain pending (confidence: 100).

VERDICT: APPROVED
### lens-error-handling-r4.txt

No error-handling drift defect invalidates O1–O3. Corrections (1)–(5) are correct and sufficient within this lens: they preserve typed conflicts, cancellation and I/O errors, retain ownership through failed retirement, and require failure witnesses for draining pools.

Limitation: implementation, immediate-refusal behavior and native platform runtime proofs remain unverified in this read-only plan review (confidence: 100).

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

NOT APPLICABLE: O1–O3 cover native inode admission, descriptor ownership and lock witnesses. The plan explicitly preserves renderer IPC signatures and limits consumer edits to ownership-carrier integration. It introduces no event, command, payload, listener or Tauri capability-scope change.

VERDICT: APPROVED
### lens-ipc-contract-r3.txt

No IPC-contract findings in the r3 delta or production drift that invalidate O1–O3. Progress remains Specta-registered, with matching operation identity, generation and percentage units. Command signatures and capability scopes are unchanged.

VERDICT: APPROVED
### lens-ipc-contract-r4.txt

NOT APPLICABLE: O1–O3 and corrections (1)–(5) concern internal inode admission, descriptor ownership and SQLite retirement. The relevant production drift changes no IPC event, command signature, payload, Specta registration or capability scope. The corrections introduce no IPC requirement or invalidate an existing contract within this lens.

VERDICT: APPROVED
### lens-minimalism-r1.txt

No bloat or duplication findings. The shared ownership boundary has multiple existing consumers, and the carrier migrations address descriptor lifetimes required by the mandate. The plan explicitly reuses quarantine policy and limits consumer edits to integration and regression witnesses.

VERDICT: APPROVED
### lens-minimalism-r3.txt

No bloat or duplication defects found within the r3 refresh scope. The drift leaves O1–O3 necessary. The shared ownership module still has multiple concrete consumers, and O2 preserves the changed domain semantics without adding deliverables.

VERDICT: APPROVED
### lens-minimalism-r4.txt

No bloat or duplication defects found within r4 drift scope.

Corrections (1)–(5) are correct and sufficient for this lens. O1 requires one authoritative SQLite admission state. O2 preserves existing retirement ownership and barriers. O3’s retired-but-draining witness tests a concrete new lifetime, without expanding MANDATE. Updated citations and exclusions add no implementation deliverables.

The shared module has multiple concrete consumers. The smallest sufficient implementation remains a shared admission boundary, sealed carrier, and necessary consumer migrations.

Limitation: implementation size and helper necessity remain for cumulative diff review (confidence: 100). No files changed or runtime proofs run.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: O1–O3 and all planned files concern backend inode ownership and descriptor lifetimes. The plan explicitly preserves persisted schemas and renderer IPC signatures, with no renderer storage, atom-family or tab-lifecycle changes.

VERDICT: APPROVED
### lens-persisted-state-r3.txt

NOT APPLICABLE: The plan delta and production drift affect backend inode ownership, database semantics, transient progress and repertoire caches. They change no renderer storage keys, persisted atoms, hydration or tab lifecycle. O1–O3 introduce no persisted renderer-state contract.

VERDICT: APPROVED
### lens-persisted-state-r4.txt

NOT APPLICABLE: O1–O3 and corrections (1)–(5) concern backend inode admission, descriptor ownership and lock witnesses. They introduce no renderer storage keys, atom families, hydration or tab lifecycle changes. Renderer changes elsewhere in DRIFT do not invalidate these obligations within this lens.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

No findings within this lens. The plan preserves PGN streaming, descriptor-based revision retries, search-index provenance and invalidation, and import transaction boundaries during ownership migration.

VERDICT: APPROVED
### lens-pgn-index-r3.txt

No PGN/index defects found within the r3 drift scope. O2 preserves the changed setup, search cancellation, cache predicates and stored index format while covering both sidecar open paths and PGN export ordering.

Runtime and platform proof remain pending under O3. No files changed or gates run.

VERDICT: APPROVED
### lens-pgn-index-r4.txt

No PGN/index defects found within the r4 drift scope. Corrections (1)–(5) are correct and sufficient for this lens: O1 preserves unified inode admission, O2 preserves descriptor-based PGN retries and search-index provenance/invalidation, and O3 covers retired-but-draining SQLite holders.

Read-only review. No files changed or runtime proofs run. Native lock witnesses and platform CI remain required.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] tasks/plans/2026-10-09-cross-capability-sqlite-locks.md:101 — O2 changes the puzzle snapshot factory’s ownership contract, but the file list omits `src-tauri/src/db/sqlite_cancellation.rs:482`, which opens a bare `File` and passes it to `schema_specific_connection_expected_file_cancellable` at line 485. The factory currently accepts `File` at `src-tauri/src/db/repository.rs:533`. Address this consumer in the frozen migration scope before delegation. Deferring importer inventory to implementation leaves a known caller unaddressed (confidence: 98).

Limitation: platform runtime behavior was not exercised during this read-only review (confidence: 100).

VERDICT: REVISE
### lens-plan-r2.txt

I1 CLOSED — r2 plan `tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r2.body.md:102` includes `sqlite_cancellation.rs` and requires shared-carrier acquisition while preserving cancellation. The caller at `src-tauri/src/db/sqlite_cancellation.rs:485` matches the factory at `src-tauri/src/db/repository.rs:531`. All traced factory callers are now in scope (confidence: 98).

Limitation: compiler and platform runtime proofs were not run during this read-only review (confidence: 100).

VERDICT: APPROVED
### lens-plan-r3.txt

No drift-scoped plan defects found. The changed search paths introduce no omitted ownership-carrier consumer and do not invalidate O1–O3. I1 remains closed.

Limitation: compilation, native lock witnesses and platform runtime proofs were not run in this read-only review (confidence: 100).

VERDICT: APPROVED
### lens-plan-r4.txt

No drift-scoped plan defects found. Corrections (1)–(5) are correct and sufficient at plan level: binding admission matches `bound_sqlite.rs:214`, lock ordering matches `repository.rs:1085` and `content_validation.rs:561`, and retirement ownership matches `repository.rs:293,566`. O2 still covers the changed consumers, and O3 requires a retired-holder lock witness.

Limitation: compilation, regression withdrawal and native platform proofs were not run in this read-only review (confidence: 100).

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

No platform-semantics findings. The plan covers Linux descriptor reopening, macOS quarantine and close arbitration, and preservation of Windows handle behavior.

Verification remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. Runtime proof requires pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and clippy evidence only.

VERDICT: APPROVED
### lens-platform-semantics-r3.txt

No platform-semantics findings within the r3 drift scope. The changed paths do not invalidate O1–O3.

Verification remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe ran in this review. Runtime proof requires pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and Clippy evidence only.

VERDICT: APPROVED
### lens-platform-semantics-r4.txt

No platform findings within drift scope. Corrections (1)–(5) are correct and sufficient for this lens: they preserve distinct-binding admission, repository lock order, retired binding ownership, native lock witnesses and relocated consumer premises.

Proof remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. Native runtime evidence must come from pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and Clippy evidence, not runtime evidence.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

No security-boundary defects found in the r1 plan. O1–O3 require sealed descriptor ownership, preserved no-follow containment, safe failure retention and native lock witnesses.

Limitation: this is plan review only. Implementation and platform runtime behavior remain unverified. No token/session or signed-manifest behavior change is proposed.

VERDICT: APPROVED
### lens-tauri-security-r3.txt

No in-lens drift defects found that invalidate O1–O3. Changed progress diagnostics remain native through `src-tauri/src/progress.rs:451` and the log targets at `src-tauri/src/main.rs:1981`.

Limitation: this is a read-only plan review. Native lock witnesses and macOS/Windows runtime evidence remain mandatory execution proofs.

VERDICT: APPROVED
### lens-tauri-security-r4.txt

No drift-scoped security findings. Corrections (1)–(5) are correct and sufficient at plan level: they preserve shared inode admission, mutex ordering, retired-binding ownership, draining-pool witnesses and the affected consumer boundaries.

Changed pool diagnostics remain renderer-safe. O2 retains containment, no-follow checks and sealed descriptor ownership. No credential/session or signed-manifest change occurs in the production drift.

Limitation: implementation, native lock witnesses and macOS/Windows runtime evidence remain unverified and mandatory under O3. No files changed or gates run.

VERDICT: APPROVED
### lens-tests-r1.txt

The proposed proofs would catch a revert: external lock assertions cover lock survival, duplicate/drop/retry witnesses cover ownership lifetime, and native CI runs the platform tests. O3 also requires observed Git-derived red/green evidence. No verification gaps found at plan altitude.

VERDICT: APPROVED
### lens-tests-r3.txt

No drift-induced verification gaps found. O1–O3 retain external SQLite lock assertions, ownership/drop/retry witnesses and mandatory compiled red/green withdrawal evidence. The phase command includes the new consumer regressions, and native CI jobs run all Rust targets.

Limitation: implementation and platform runtime proof remain pending. Drift records unavailable GitHub Actions execution, so O3 cannot be declared complete until exact-SHA CI succeeds (confidence: 100).

VERDICT: APPROVED
### lens-tests-r4.txt

Corrections (1)–(5) are correct and sufficient within this verification lens. O3 adds the drift-relevant retired-but-draining holder witness and preserves binding-refusal regressions. External lock assertions would catch unsafe descriptor closure. Clone/drop/retry witnesses cover ownership lifetime, and mandatory Git-derived red/green withdrawal checks whether the anchors detect a revert.

The phase command selects the Rust test binary. macOS and Windows CI run all Rust targets. No drift-induced verification gap found.

Limitation: these are proposed proofs. Implementation, withdrawal results and exact-SHA platform runtime evidence remain pending (confidence: 100).

VERDICT: APPROVED
### plan-r1.md

# Plan: preserve SQLite locks across capability aliases

## Goal

Resolve f-20261001-02 by preventing ordinary descriptors of an inode from closing while a game-database SQLite binding can hold POSIX locks on it. Produce a reviewed plan only at base ca0ab68689e0f4de8ca0b84df2be29963bcfc66c.

## MANDATE

### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it

* **ID:** f-20261001-02 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/resolved.rs` (~544, ~556, ~860: the generic resolver opens and retains an ordinary leaf descriptor in `ResolvedPath.file`); its consumers `src-tauri/src/puzzle.rs` (~103, ~123, ~160, ~188, ~213 puzzle reads through `schema_specific_connection_expected_file_cancellable`, which also `try_clone()`s the descriptor; ~610 puzzle deletion), `src-tauri/src/db/mod.rs` (~3123, an existing `WritePgn` export destination resolved and held through export), and the search-index sidecar reads `src-tauri/src/db/search.rs` (~335) and `src-tauri/src/db/search_index.rs` (~886).
* **Defect:** SQLite's unix locks are process-associated `fcntl` locks, and closing any ordinary descriptor of an inode releases every such lock the process holds on it (measured 2026-09-29 on atlas, recorded in `f-20260929-11` and `d-20260930-10`). Game-database pools are keyed by `DatabaseFileTarget`, but nothing stops the same inode from also being authorized as a puzzle database, a PGN import/export file or a search-index sidecar (a user pick of the same file, or a hard link). Each of those capabilities opens an ordinary descriptor on the leaf and closes it when the operation ends, possibly while a game-database pool on that inode holds a live SQLite lock — the same lock-release hazard `f-20260929-11` removes from the repository's own probes. Found by a locate probe of the `f-20260929-11` build run (2026-10-01), which classified these sites as "lockable open+close while pooled possible" only through such a cross-capability alias.
* **Why it matters:** with the lock silently gone, another process can checkpoint and unlink the `-wal`/`-shm` this process still uses, or write under a reader that believes it holds a lock — database corruption. Reachable only when one inode is authorized under two capability kinds, so far rarer than `f-20260929-11`.
* **Open question:** should path authority refuse (or a capability consumer detect) an inode that is live in a game-database pool when it is resolved under another capability kind — and if so, where is the cross-kind inode registry and what does the user see — or should each of these consumers stop holding an ordinary descriptor (identity by `fstatat` / `O_PATH`, snapshot copy through a non-lockable route), given that a puzzle snapshot and a PGN export genuinely read or write the bytes?
* **Related:** `f-20260929-11` (the repository's own probes; this finding is the residual outside the repository), `d-20260930-10`, `d-20260929-05` (cross-directory hard-link refusal for game databases only).

## Threat model and non-goals

Supported Linux, macOS and Windows. Same-process concurrent operations, accidental duplicate picks, hard-link aliases across authorized capability kinds, and swaps of an authorized leaf during verification are in scope. The adversary may mutate entries in an authorized directory, including substituting an active database inode or causing metadata inspection to fail. Preserve parent containment and no-follow behavior. Other processes use SQLite's usual locking contract. The fix does not promise protection against external writers that deliberately ignore locks or an operating-system/kernel failure.

No change to persistent capability schema, renderer IPC signatures, native dialogs, database schema, pool eviction policy or same-directory game-database hard-link naming. No new background process, service, watcher or source-text verifier.

## Traced premises

* `infra/path_authority/resolved.rs:96,176,481,553,754,908`: ResolvedPath, streaming transfers, PGN snapshots and puzzle duplicates currently own plain Files that escape resolution.
* `db/repository.rs:531`: puzzle snapshot copying clones and retains the source descriptor independently of the original resolution.
* `db/mod.rs:3556`: PGN export resolves and snapshots its destination before acquiring its database connection, so reverse ordering is reachable.
* `db/search.rs:344` and `db/search_index.rs:914`: preferred and legacy sidecar opens bypass PathAuthority resolution and clone into mapping consumers.
* `db/content_validation.rs:170`, `infra/path_authority/mod.rs:717,6378,6594,6671` and `infra/fs.rs:4914,2024`: integrity/workspace sidecars, engine/book carriers, open-or-create and archive sync are direct ordinary-file dependencies of the same capability boundary.
* `infra/fs.rs:4870`: generic Unix open_regular_at opens a lockable descriptor before fstat and flag adjustment. Every subsequent error currently drops it.
* `db/bound_sqlite.rs:165,543,602,627`: process-global binding creation, removal and quarantine already arbitrate descriptor safety for SQLite's own hooks.
* `infra/path_authority/mod.rs:7194`: game database targets use metadata and parent descriptors, so they need no ordinary data-file lease.
* `db/repository.rs:3479`: an existing forked-child F_GETLK observer checks actual SQLite locks without closing a fresh parent-process probe descriptor.
* Governing precedents: d-20260929-05 retains game-binding directory exclusion. d-20260930-10 establishes Linux O_PATH verification and bounded non-Linux quarantine. d-20261001-06 preserves descriptor-free metadata probes. d-20261009-08 through d-20261009-10 preserve nonblocking special-file refusal and unknown-descriptor retention.

Paths in this section are relative to `src-tauri/src/`. No runtime reproduction or platform compilation was run by the planner.

## Approach

### O1 — one inode admission and close boundary

Mandate basis: "one inode ... under two capability kinds" and "closes ... while a game-database pool ... holds a live SQLite lock".

Introduce one process-wide inode ownership primitive under infra, used by both bound SQLite registrations and ordinary capability-derived regular files. Identity is native file identity, independent of pathname, parent spelling and capability kind. On Unix, ordinary access and a bound SQLite lifetime are mutually exclusive for the same inode. Either acquisition order refuses the incompatible newcomer with the existing typed Conflict path before it can close an ordinary descriptor of the database. Compatible ordinary readers may coexist. Existing game-to-game binding rules remain governed by d-20260929-05.

The SQLite reservation begins before connection creation can hold locks and survives pending creation, published registrations and every live connection. Ordinary ownership survives every actual source descriptor and clone. Close all ordinary descriptors before releasing their final ownership, under the same arbitration that admits a new SQLite reservation. There must be no check-to-open, check-to-close or final-drop-to-reacquire gap. Unwind, cancellation, failed creation and poisoned-state paths preserve lock safety and release owned reservations without panic. Do not hold any registry lock across await, callbacks or a nested registry acquisition. Preserve a documented lock order with the existing VFS registry.

Use the existing VFS quarantine policy through this boundary rather than duplicate identity-liveness registries. Retention and admission cover creating SQLite reservations as well as published holders. Quarantine descriptors may drain only while new incompatible acquisition is excluded. Retain d-20260930-10's admission threshold of 8 and its allowance for already-admitted opens. Refuse at admission rather than closing a retained descriptor to clear capacity.

Bound SQLite sidecars need ordinary ownership too. Their raw descriptors are handed to SQLite, so retain their ordinary leases in the owning registration until all its connections close. This conservative lifetime may refuse another database binding longer than that sidecar descriptor is open, but never shorter. Private main-file descriptors remain owned by SQLite's existing close protocol. The native handoff is confined to this adapter and never offered as a general carrier escape.

### O2 — open safely and carry ownership through consumers

Mandate basis: "the generic resolver opens and retains an ordinary leaf descriptor" and "a puzzle snapshot and a PGN export genuinely read or write the bytes".

The ordinary regular-file opening boundary returns an owning carrier whose transfer and clone preserve O1, rather than an unguarded File plus a guard that callers can discard independently. Provide the I/O and native borrowed-descriptor operations existing consumers need, without a production consuming escape to a bare File or an untracked clone. Directory descriptors and private freshly created temporary files need no inode exclusion because they cannot be aliases of a pre-existing authorized data inode. A file created with exclusive create must still carry ownership if it becomes reachable by a database binding before its last descriptor closes.

On Linux, identify the retained leaf with O_PATH and fstat, perform admission, then reopen that exact descriptor with the required ordinary access. Never reopen the name after admission. Refusal, O_PATH inspection failure or proc reopen failure closes no lockable foreign inode. Unavailable proc fails closed. On macOS, serialize lockable open, identification and admission against SQLite acquisition, preserve the expected identity check, and quarantine any actually opened descriptor of an incompatible bound inode or an unclassified descriptor before returning an error. No failure may implicitly drop that unsafe descriptor. Preserve nonblocking special-file refusal and parent/no-follow checks. Windows preserves the current handle rights, share modes and handle-scoped lock behavior, without inventing Unix lock exclusion there.

Migrate resolution, PGN snapshot refresh and cloning, puzzle snapshot copying and retained source, puzzle deletion, PGN import/export, workspace readers and metadata sidecars, preferred and legacy search-index opening and mapping, verified image/artifact carriers and their direct consumers. Also route generic capability-derived regular opens inside the filesystem adapters through this ownership boundary whenever their objects can alias an authorized database. SQLite sidecar hooks must not close a sidecar descriptor that aliases another active database primary. Borrowed metadata-only probes stay descriptor-free on Unix.

Keep existing behavior governed by d-20261008-08 (descriptor-based PGN revision retries), d-20261008-15 and d-20261008-16 (opened-sidecar provenance and error propagation), d-20261005-06 (mapping invalidation), d-20261002-08 (sidecar deletion policy) and d-20260905-07 (authorized-directory containment). Ordinary ownership can last for an engine-resource lifetime, and cached SQLite bindings count even when idle. Refusals are immediate, never a wait between the opposing nested operation orders.

### O3 — behavior, failure and platform witnesses

Mandate basis: "with the lock silently gone ... database corruption".

Prove lock survival with actual repository connections holding a read transaction and an external child observing the inode's POSIX lock. Cover each mandate consumer family through its production entry point, with same-name and hard-link aliases, compatible independent-file success and both acquisition orders. Cover a surviving duplicate after the original carrier drops, ownership transfer, last-owner release allowing retry, canceled or malformed puzzle/PGN/index operations, creation failure, and concurrent final close versus SQLite admission. Use deterministic hooks and barriers rather than sleep-based interleavings.

Platform-specific witnesses exercise leaf substitution and metadata/reopen errors at the actual opening boundary. Linux refusal paths must never create a lockable descriptor of the protected inode. macOS refusal paths must retain unsafe and unclassified descriptors, preserve locks, refuse further admission at capacity and drain safely at the last SQLite holder. Preserve original I/O errno when it is not a compatibility conflict. Process-isolate poison and global-quarantine tests. Windows proves the shared carrier compiles and ordinary supported operations still succeed, with native rights/share-mode fixtures.

Take a Git-derived withdrawal of the source fix while keeping the new regression tests, observe their intended failure, restore byte-identical source and rerun green. Compiler/unit proofs establish integration. Linux measurements establish Linux semantics. macOS and Windows runtime claims require the named pushed-head CI jobs. No source-pattern assertion substitutes for the lock witness.

## Decisions and trade-offs

Retain build tier. The existing decisions resolve platform primitives but do not select the cross-kind ownership and integration contract. This requires a coordinated concurrency and filesystem change rather than one exact mirrored edit.

One cohesive implementation phase owns the shared primitive and all carrier migrations, because changing the ordinary-file return type and integrating SQLite exclusion cannot ship separately without leaving a safety gap or broken consumers. Read-only review is delegated through the selected Codex executor. The root owns tracing, plan writing and arbitration. Round 1 runs every plan-capable lens. No full-history fork is used. All leaf prompts name applicable rule files.

## Decided autonomously

* **Question:** refuse concurrent cross-kind alias access or preserve it through retained descriptors? **Chosen:** symmetric Unix inode admission with lifetime-carrying ordinary files. **Rejected:** a pool-live check at resolution only, which misses reverse ordering, and retention of every successful ordinary descriptor until pool release, which can accumulate descriptors under normal repeated reads. **Reason:** refusal prevents the lock-release mechanism with explicit ownership. **Reversal path:** a measured close-safe shared-descriptor alternative covering all consumers and both orders can replace admission.
* **Question:** what error reaches the user? **Chosen:** existing Conflict presentation for an incompatible live inode, preserving native I/O errors and existing cancellation elsewhere. **Rejected:** new settings, new dialogs or persisted cross-kind prohibitions. **Reason:** transient resource conflict follows the precedent d-20260929-05 and does not change what capability authorization promises. **Reversal path:** amend the ordinary admission error mapping and its caller tests.
* **Question:** who performs acceptance? **Chosen:** agent-run native lock witnesses and pushed-head platform CI. **Rejected:** a manual native picker test as the correctness gate. **Reason:** the defect is descriptor lifecycle, which the existing backend test harness observes directly. **Reversal path:** add manual acceptance only for a newly introduced native GTK surface.

## Risks / open questions

* macOS and Windows runtime evidence is unavailable in this planning snapshot. The adopting run must wait for rust-macos-test, rust-windows-test and the rust-platform matrix on its pushed SHA, and follow the existing remote-red refusal before pushing. f-20261008-06 is an open Windows puzzle-test failure that may block release, it is not settled by this plan.
* Wider generic File return-type changes require a complete importer inventory during implementation. Do not add a permissive raw-File escape to make compilation green.
* Global ownership must not reenter its mutex through destructor callbacks or from the VFS registry. Review the final diff for drop order and creation reservations.

## Not part of this task

Sibling findings remain open at their existing tiers, including f-20260929-05 (build, same-directory SQLite aliases), f-20260930-01 (build, pool eviction/drain), f-20260929-04 (lens, retry diagnostics), f-20261002-02 (build, reused-inode test collisions), and f-20261008-06 (build, Windows puzzle deletion). Independent malformed content, index-provenance policy, renderer layout and native GTK acceptance are outside this mandate.

## Phases

### Phase 1 — shared inode ownership and capability consumer migration

Files: `src-tauri/src/infra/mod.rs`, a new shared ownership module under `src-tauri/src/infra/`, `src-tauri/src/infra/fs.rs`, `src-tauri/src/infra/path_authority/{mod,resolved,verified}.rs`, `src-tauri/src/db/{bound_sqlite,repository,mod,search,search_index,content_validation,test_support}.rs`, `src-tauri/src/{puzzle,pgn,file_workspace,sound,practice,credentials,main,chess,game}.rs`, `src-tauri/src/engine/{process,types}.rs` and existing carrier-contract tests under `src-tauri/src/infra/platform_support/`. Edits in direct consumer files are limited to ownership-carrier integration and regression witnesses, preserving their domain semantics. Resolve importers before assigning the write leaf and put exact paths in its brief. No source edit belongs to this planning run.

Contract: O1 through O3. Touches filesystem capability ownership, concurrency and descriptor persistence in memory. No persisted schema or IPC type change. Executor Codex, role sensitive, model/effort resolved from `leaf.codex.write.sensitive`. One sequential write leaf, no root implementation.

Proof command: `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable && pnpm checks:pre-review && pnpm gates:contract:check`. Include the new native witnesses in the existing test binary, with Linux/macOS cfg parity. Record the Git-derived red/green withdrawal evidence. The root repeats the command and inspects the complete diff before the phase commit.

After cumulative diff review and repairs, run `pnpm build && pnpm verify:app` as the real-product startup/teardown smoke check. Its existing harness does not claim to reproduce the cross-capability race. No renderer pixels change, so no screenshot re-recording is proposed.

Final gates on the clean committed tree: `pnpm gates:push -- --rust --frontend --bindings`, selected from the canonical push mapping because the planned carrier consumer set includes main.rs. No floor, baseline or budget may be lowered. Then complete the project's push skill, pushed-head macOS/Windows runtime CI and installation when applicable. Record autonomous decisions and close the finding only in the adopting execution run through findings.py. Plan-only stops before Preflight, without locks, ledger writes, commits, push, dev server or browser.

## Carried to diff review

None at initial revision.

### plan-r2.md

# Plan: preserve SQLite locks across capability aliases

## Goal

Resolve f-20261001-02 by preventing ordinary descriptors of an inode from closing while a game-database SQLite binding can hold POSIX locks on it. Produce a reviewed plan only at base ca0ab68689e0f4de8ca0b84df2be29963bcfc66c.

## MANDATE

### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it

* **ID:** f-20261001-02 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/resolved.rs` (~544, ~556, ~860: the generic resolver opens and retains an ordinary leaf descriptor in `ResolvedPath.file`); its consumers `src-tauri/src/puzzle.rs` (~103, ~123, ~160, ~188, ~213 puzzle reads through `schema_specific_connection_expected_file_cancellable`, which also `try_clone()`s the descriptor; ~610 puzzle deletion), `src-tauri/src/db/mod.rs` (~3123, an existing `WritePgn` export destination resolved and held through export), and the search-index sidecar reads `src-tauri/src/db/search.rs` (~335) and `src-tauri/src/db/search_index.rs` (~886).
* **Defect:** SQLite's unix locks are process-associated `fcntl` locks, and closing any ordinary descriptor of an inode releases every such lock the process holds on it (measured 2026-09-29 on atlas, recorded in `f-20260929-11` and `d-20260930-10`). Game-database pools are keyed by `DatabaseFileTarget`, but nothing stops the same inode from also being authorized as a puzzle database, a PGN import/export file or a search-index sidecar (a user pick of the same file, or a hard link). Each of those capabilities opens an ordinary descriptor on the leaf and closes it when the operation ends, possibly while a game-database pool on that inode holds a live SQLite lock — the same lock-release hazard `f-20260929-11` removes from the repository's own probes. Found by a locate probe of the `f-20260929-11` build run (2026-10-01), which classified these sites as "lockable open+close while pooled possible" only through such a cross-capability alias.
* **Why it matters:** with the lock silently gone, another process can checkpoint and unlink the `-wal`/`-shm` this process still uses, or write under a reader that believes it holds a lock — database corruption. Reachable only when one inode is authorized under two capability kinds, so far rarer than `f-20260929-11`.
* **Open question:** should path authority refuse (or a capability consumer detect) an inode that is live in a game-database pool when it is resolved under another capability kind — and if so, where is the cross-kind inode registry and what does the user see — or should each of these consumers stop holding an ordinary descriptor (identity by `fstatat` / `O_PATH`, snapshot copy through a non-lockable route), given that a puzzle snapshot and a PGN export genuinely read or write the bytes?
* **Related:** `f-20260929-11` (the repository's own probes; this finding is the residual outside the repository), `d-20260930-10`, `d-20260929-05` (cross-directory hard-link refusal for game databases only).

## Threat model and non-goals

Supported Linux, macOS and Windows. Same-process concurrent operations, accidental duplicate picks, hard-link aliases across authorized capability kinds, and swaps of an authorized leaf during verification are in scope. The adversary may mutate entries in an authorized directory, including substituting an active database inode or causing metadata inspection to fail. Preserve parent containment and no-follow behavior. Other processes use SQLite's usual locking contract. The fix does not promise protection against external writers that deliberately ignore locks or an operating-system/kernel failure.

No change to persistent capability schema, renderer IPC signatures, native dialogs, database schema, pool eviction policy or same-directory game-database hard-link naming. No new background process, service, watcher or source-text verifier.

## Traced premises

* `infra/path_authority/resolved.rs:96,176,481,553,754,908`: ResolvedPath, streaming transfers, PGN snapshots and puzzle duplicates currently own plain Files that escape resolution.
* `db/repository.rs:531`: puzzle snapshot copying clones and retains the source descriptor independently of the original resolution.
* `db/sqlite_cancellation.rs:482,485`: the existing pinned-factory cancellation fixture passes a bare File into that snapshot factory and must migrate with its ownership contract.
* `db/mod.rs:3556`: PGN export resolves and snapshots its destination before acquiring its database connection, so reverse ordering is reachable.
* `db/search.rs:344` and `db/search_index.rs:914`: preferred and legacy sidecar opens bypass PathAuthority resolution and clone into mapping consumers.
* `db/content_validation.rs:170`, `infra/path_authority/mod.rs:717,6378,6594,6671` and `infra/fs.rs:4914,2024`: integrity/workspace sidecars, engine/book carriers, open-or-create and archive sync are direct ordinary-file dependencies of the same capability boundary.
* `infra/fs.rs:4870`: generic Unix open_regular_at opens a lockable descriptor before fstat and flag adjustment. Every subsequent error currently drops it.
* `db/bound_sqlite.rs:165,543,602,627`: process-global binding creation, removal and quarantine already arbitrate descriptor safety for SQLite's own hooks.
* `infra/path_authority/mod.rs:7194`: game database targets use metadata and parent descriptors, so they need no ordinary data-file lease.
* `db/repository.rs:3479`: an existing forked-child F_GETLK observer checks actual SQLite locks without closing a fresh parent-process probe descriptor.
* Governing precedents: d-20260929-05 retains game-binding directory exclusion. d-20260930-10 establishes Linux O_PATH verification and bounded non-Linux quarantine. d-20261001-06 preserves descriptor-free metadata probes. d-20261009-08 through d-20261009-10 preserve nonblocking special-file refusal and unknown-descriptor retention.

Paths in this section are relative to `src-tauri/src/`. No runtime reproduction or platform compilation was run by the planner.

## Approach

### O1 — one inode admission and close boundary

Mandate basis: "one inode ... under two capability kinds" and "closes ... while a game-database pool ... holds a live SQLite lock".

Introduce one process-wide inode ownership primitive under infra, used by both bound SQLite registrations and ordinary capability-derived regular files. Identity is native file identity, independent of pathname, parent spelling and capability kind. On Unix, ordinary access and a bound SQLite lifetime are mutually exclusive for the same inode. Either acquisition order refuses the incompatible newcomer with the existing typed Conflict path before it can close an ordinary descriptor of the database. Compatible ordinary readers may coexist. Existing game-to-game binding rules remain governed by d-20260929-05.

The SQLite reservation begins before connection creation can hold locks and survives pending creation, published registrations and every live connection. Ordinary ownership survives every actual source descriptor and clone. Close all ordinary descriptors before releasing their final ownership, under the same arbitration that admits a new SQLite reservation. There must be no check-to-open, check-to-close or final-drop-to-reacquire gap. Unwind, cancellation, failed creation and poisoned-state paths preserve lock safety and release owned reservations without panic. Do not hold any registry lock across await, callbacks or a nested registry acquisition. Preserve a documented lock order with the existing VFS registry.

Use the existing VFS quarantine policy through this boundary rather than duplicate identity-liveness registries. Retention and admission cover creating SQLite reservations as well as published holders. Quarantine descriptors may drain only while new incompatible acquisition is excluded. Retain d-20260930-10's admission threshold of 8 and its allowance for already-admitted opens. Refuse at admission rather than closing a retained descriptor to clear capacity.

Bound SQLite sidecars need ordinary ownership too. Their raw descriptors are handed to SQLite, so retain their ordinary leases in the owning registration until all its connections close. This conservative lifetime may refuse another database binding longer than that sidecar descriptor is open, but never shorter. Private main-file descriptors remain owned by SQLite's existing close protocol. The native handoff is confined to this adapter and never offered as a general carrier escape.

### O2 — open safely and carry ownership through consumers

Mandate basis: "the generic resolver opens and retains an ordinary leaf descriptor" and "a puzzle snapshot and a PGN export genuinely read or write the bytes".

The ordinary regular-file opening boundary returns an owning carrier whose transfer and clone preserve O1, rather than an unguarded File plus a guard that callers can discard independently. Provide the I/O and native borrowed-descriptor operations existing consumers need, without a production consuming escape to a bare File or an untracked clone. Directory descriptors and private freshly created temporary files need no inode exclusion because they cannot be aliases of a pre-existing authorized data inode. A file created with exclusive create must still carry ownership if it becomes reachable by a database binding before its last descriptor closes.

On Linux, identify the retained leaf with O_PATH and fstat, perform admission, then reopen that exact descriptor with the required ordinary access. Never reopen the name after admission. Refusal, O_PATH inspection failure or proc reopen failure closes no lockable foreign inode. Unavailable proc fails closed. On macOS, serialize lockable open, identification and admission against SQLite acquisition, preserve the expected identity check, and quarantine any actually opened descriptor of an incompatible bound inode or an unclassified descriptor before returning an error. No failure may implicitly drop that unsafe descriptor. Preserve nonblocking special-file refusal and parent/no-follow checks. Windows preserves the current handle rights, share modes and handle-scoped lock behavior, without inventing Unix lock exclusion there.

Migrate resolution, PGN snapshot refresh and cloning, puzzle snapshot copying and retained source, puzzle deletion, PGN import/export, workspace readers and metadata sidecars, preferred and legacy search-index opening and mapping, verified image/artifact carriers and their direct consumers. Also route generic capability-derived regular opens inside the filesystem adapters through this ownership boundary whenever their objects can alias an authorized database. SQLite sidecar hooks must not close a sidecar descriptor that aliases another active database primary. Borrowed metadata-only probes stay descriptor-free on Unix.

Keep existing behavior governed by d-20261008-08 (descriptor-based PGN revision retries), d-20261008-15 and d-20261008-16 (opened-sidecar provenance and error propagation), d-20261005-06 (mapping invalidation), d-20261002-08 (sidecar deletion policy) and d-20260905-07 (authorized-directory containment). Ordinary ownership can last for an engine-resource lifetime, and cached SQLite bindings count even when idle. Refusals are immediate, never a wait between the opposing nested operation orders.

### O3 — behavior, failure and platform witnesses

Mandate basis: "with the lock silently gone ... database corruption".

Prove lock survival with actual repository connections holding a read transaction and an external child observing the inode's POSIX lock. Cover each mandate consumer family through its production entry point, with same-name and hard-link aliases, compatible independent-file success and both acquisition orders. Cover a surviving duplicate after the original carrier drops, ownership transfer, last-owner release allowing retry, canceled or malformed puzzle/PGN/index operations, creation failure, and concurrent final close versus SQLite admission. Use deterministic hooks and barriers rather than sleep-based interleavings.

Platform-specific witnesses exercise leaf substitution and metadata/reopen errors at the actual opening boundary. Linux refusal paths must never create a lockable descriptor of the protected inode. macOS refusal paths must retain unsafe and unclassified descriptors, preserve locks, refuse further admission at capacity and drain safely at the last SQLite holder. Preserve original I/O errno when it is not a compatibility conflict. Process-isolate poison and global-quarantine tests. Windows proves the shared carrier compiles and ordinary supported operations still succeed, with native rights/share-mode fixtures.

Take a Git-derived withdrawal of the source fix while keeping the new regression tests, observe their intended failure, restore byte-identical source and rerun green. Compiler/unit proofs establish integration. Linux measurements establish Linux semantics. macOS and Windows runtime claims require the named pushed-head CI jobs. No source-pattern assertion substitutes for the lock witness.

## Decisions and trade-offs

Retain build tier. The existing decisions resolve platform primitives but do not select the cross-kind ownership and integration contract. This requires a coordinated concurrency and filesystem change rather than one exact mirrored edit.

One cohesive implementation phase owns the shared primitive and all carrier migrations, because changing the ordinary-file return type and integrating SQLite exclusion cannot ship separately without leaving a safety gap or broken consumers. Read-only review is delegated through the selected Codex executor. The root owns tracing, plan writing and arbitration. Round 1 runs every plan-capable lens. No full-history fork is used. All leaf prompts name applicable rule files.

## Decided autonomously

* **Question:** refuse concurrent cross-kind alias access or preserve it through retained descriptors? **Chosen:** symmetric Unix inode admission with lifetime-carrying ordinary files. **Rejected:** a pool-live check at resolution only, which misses reverse ordering, and retention of every successful ordinary descriptor until pool release, which can accumulate descriptors under normal repeated reads. **Reason:** refusal prevents the lock-release mechanism with explicit ownership. **Reversal path:** a measured close-safe shared-descriptor alternative covering all consumers and both orders can replace admission.
* **Question:** what error reaches the user? **Chosen:** existing Conflict presentation for an incompatible live inode, preserving native I/O errors and existing cancellation elsewhere. **Rejected:** new settings, new dialogs or persisted cross-kind prohibitions. **Reason:** transient resource conflict follows the precedent d-20260929-05 and does not change what capability authorization promises. **Reversal path:** amend the ordinary admission error mapping and its caller tests.
* **Question:** who performs acceptance? **Chosen:** agent-run native lock witnesses and pushed-head platform CI. **Rejected:** a manual native picker test as the correctness gate. **Reason:** the defect is descriptor lifecycle, which the existing backend test harness observes directly. **Reversal path:** add manual acceptance only for a newly introduced native GTK surface.

## Risks / open questions

* macOS and Windows runtime evidence is unavailable in this planning snapshot. The adopting run must wait for rust-macos-test, rust-windows-test and the rust-platform matrix on its pushed SHA, and follow the existing remote-red refusal before pushing. f-20261008-06 is an open Windows puzzle-test failure that may block release, it is not settled by this plan.
* Wider generic File return-type changes require a complete importer inventory during implementation. Do not add a permissive raw-File escape to make compilation green.
* Global ownership must not reenter its mutex through destructor callbacks or from the VFS registry. Review the final diff for drop order and creation reservations.

## Not part of this task

Sibling findings remain open at their existing tiers, including f-20260929-05 (build, same-directory SQLite aliases), f-20260930-01 (build, pool eviction/drain), f-20260929-04 (lens, retry diagnostics), f-20261002-02 (build, reused-inode test collisions), and f-20261008-06 (build, Windows puzzle deletion). Independent malformed content, index-provenance policy, renderer layout and native GTK acceptance are outside this mandate.

## Phases

### Phase 1 — shared inode ownership and capability consumer migration

Files: `src-tauri/src/infra/mod.rs`, a new shared ownership module under `src-tauri/src/infra/`, `src-tauri/src/infra/fs.rs`, `src-tauri/src/infra/path_authority/{mod,resolved,verified}.rs`, `src-tauri/src/db/{bound_sqlite,repository,mod,search,search_index,content_validation,sqlite_cancellation,test_support}.rs`, `src-tauri/src/{puzzle,pgn,file_workspace,sound,practice,credentials,main,chess,game}.rs`, `src-tauri/src/engine/{process,types}.rs` and existing carrier-contract tests under `src-tauri/src/infra/platform_support/`. Edits in direct consumer files are limited to ownership-carrier integration and regression witnesses, preserving their domain semantics. The pinned-factory fixture in sqlite_cancellation.rs must acquire the shared ordinary carrier before passing it into the migrated puzzle snapshot factory, preserving its cancellation assertion. The traced importer inventory is frozen in this file list. Recheck it against the adopting revision before assigning the write leaf and put exact paths in its brief. No source edit belongs to this planning run.

Contract: O1 through O3. Touches filesystem capability ownership, concurrency and descriptor persistence in memory. No persisted schema or IPC type change. Executor Codex, role sensitive, model/effort resolved from `leaf.codex.write.sensitive`. One sequential write leaf, no root implementation.

Proof command: `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable && pnpm checks:pre-review && pnpm gates:contract:check`. Include the new native witnesses in the existing test binary, with Linux/macOS cfg parity. Record the Git-derived red/green withdrawal evidence. The root repeats the command and inspects the complete diff before the phase commit.

After cumulative diff review and repairs, run `pnpm build && pnpm verify:app` as the real-product startup/teardown smoke check. Its existing harness does not claim to reproduce the cross-capability race. No renderer pixels change, so no screenshot re-recording is proposed.

Final gates on the clean committed tree: `pnpm gates:push -- --rust --frontend --bindings`, selected from the canonical push mapping because the planned carrier consumer set includes main.rs. No floor, baseline or budget may be lowered. Then complete the project's push skill, pushed-head macOS/Windows runtime CI and installation when applicable. Record autonomous decisions and close the finding only in the adopting execution run through findings.py. Plan-only stops before Preflight, without locks, ledger writes, commits, push, dev server or browser.

## Carried to diff review

None at initial revision.

## Reviews

Plan authorship and arbitration shared one root Codex context. Detection ran on the same Codex model family selected for implementation. These are independent read-only leaf contexts, not independent model-family detection. No implementation or runtime platform verification occurred.

### Round 1 — initial frozen plan

Candidate: RUN_TMP/plan-r1.md at base ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. All 12 plan-capable lenses completed through leaf-launch.sh, with terminal markers confirmed by drain-poll-leaves.py. The code-quality and root-cause lenses explicitly exclude plan review. Raw prompts, reports and JSONL remain alongside the snapshot in RUN_TMP. Review leaf elapsed from snapshot to observed completion: 385.438 seconds. No known non-overlapping quota, dependency, release or other wait. Active wall elapsed is recorded separately when arbitration finishes, parallel leaf durations are not summed.

Raw counts: blocker 1, should-fix 0, nit 0. Unique opened I1, resolved none. Adopted plan-level corrections 1, carried 0, arbiter nits 0, Skip 0, Defer 0. No withdrawal, rewrite, split or correction-introduced defect. Downstream rework is not yet applicable.

| ID | Witnesses and raw verdict | Disposition | Evidence and affected obligation | Authority | Correction revision, dependency and closure |
| --- | --- | --- | --- | --- | --- |
| I1 | plan r1 finding 1, blocker, confidence 98, REVISE | Fix | db/sqlite_cancellation.rs:482 opens File, :485 passes it to repository.rs:531–535. Confirmed by root source read. O2 changes that factory's carrier contract. Its known test caller must migrate for integration and cancellation proof to compile. | MANDATE names puzzle reads through schema_specific_connection_expected_file_cancellable and its clones. Existing O2 already requires the owning carrier across those consumers. No new mechanism. | r2 adds sqlite_cancellation.rs to the frozen phase scope and explicitly preserves its cancellation assertion while acquiring the shared carrier. Dependencies none. Closure open pending review-plan check. |

Raw output below is preserved unchanged.

#### correctness r1

```text
No concrete correctness mismatch found in O1–O3. The plan covers both acquisition orders, clone ownership, final-close arbitration, and SQLite sidecar handoffs.

Limitation: this is plan review. Implementation drop order, mutex interactions, and macOS/Windows runtime behavior remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### error-handling r1

```text
VERDICT: APPROVED
```

#### minimalism r1

```text
No bloat or duplication findings. The shared ownership boundary has multiple existing consumers, and the carrier migrations address descriptor lifetimes required by the mandate. The plan explicitly reuses quarantine policy and limits consumer edits to integration and regression witnesses.

VERDICT: APPROVED
```

#### plan r1

```text
[blocker] tasks/plans/2026-10-09-cross-capability-sqlite-locks.md:101 — O2 changes the puzzle snapshot factory’s ownership contract, but the file list omits `src-tauri/src/db/sqlite_cancellation.rs:482`, which opens a bare `File` and passes it to `schema_specific_connection_expected_file_cancellable` at line 485. The factory currently accepts `File` at `src-tauri/src/db/repository.rs:533`. Address this consumer in the frozen migration scope before delegation. Deferring importer inventory to implementation leaves a known caller unaddressed (confidence: 98).

Limitation: platform runtime behavior was not exercised during this read-only review (confidence: 100).

VERDICT: REVISE
```

#### tests r1

```text
The proposed proofs would catch a revert: external lock assertions cover lock survival, duplicate/drop/retry witnesses cover ownership lifetime, and native CI runs the platform tests. O3 also requires observed Git-derived red/green evidence. No verification gaps found at plan altitude.

VERDICT: APPROVED
```

#### chess-semantics r1

```text
NOT APPLICABLE: O1–O3 govern inode admission, descriptor ownership and lock verification. Consumer edits preserve domain semantics. The plan changes no in-memory chess tree, position identity, move path, parity, legality or metadata round trip.

VERDICT: APPROVED
```

#### engine-protocol r1

```text
No in-lens defects found in the plan’s ownership-carrier integration. Engine identity, result guards and process supervision remain preserved by its contract. Runtime verification remains for implementation.

VERDICT: APPROVED
```

#### ipc-contract r1

```text
NOT APPLICABLE: O1–O3 cover native inode admission, descriptor ownership and lock witnesses. The plan explicitly preserves renderer IPC signatures and limits consumer edits to ownership-carrier integration. It introduces no event, command, payload, listener or Tauri capability-scope change.

VERDICT: APPROVED
```

#### persisted-state r1

```text
NOT APPLICABLE: O1–O3 and all planned files concern backend inode ownership and descriptor lifetimes. The plan explicitly preserves persisted schemas and renderer IPC signatures, with no renderer storage, atom-family or tab-lifecycle changes.

VERDICT: APPROVED
```

#### pgn-index r1

```text
No findings within this lens. The plan preserves PGN streaming, descriptor-based revision retries, search-index provenance and invalidation, and import transaction boundaries during ownership migration.

VERDICT: APPROVED
```

#### platform-semantics r1

```text
No platform-semantics findings. The plan covers Linux descriptor reopening, macOS quarantine and close arbitration, and preservation of Windows handle behavior.

Verification remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. Runtime proof requires pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and clippy evidence only.

VERDICT: APPROVED
```

#### tauri-security r1

```text
No security-boundary defects found in the r1 plan. O1–O3 require sealed descriptor ownership, preserved no-follow containment, safe failure retention and native lock witnesses.

Limitation: this is plan review only. Implementation and platform runtime behavior remain unverified. No token/session or signed-manifest behavior change is proposed.

VERDICT: APPROVED
```

### plan-r3.md

# Plan: preserve SQLite locks across capability aliases

## Goal

Resolve f-20261001-02 by preventing ordinary descriptors of an inode from closing while a game-database SQLite binding can hold POSIX locks on it. Refresh the reviewed plan at base 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee, preserving its original review lineage from ca0ab68689e0f4de8ca0b84df2be29963bcfc66c.

## MANDATE

### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it

* **ID:** f-20261001-02 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/resolved.rs` (~544, ~556, ~860: the generic resolver opens and retains an ordinary leaf descriptor in `ResolvedPath.file`); its consumers `src-tauri/src/puzzle.rs` (~103, ~123, ~160, ~188, ~213 puzzle reads through `schema_specific_connection_expected_file_cancellable`, which also `try_clone()`s the descriptor; ~610 puzzle deletion), `src-tauri/src/db/mod.rs` (~3123, an existing `WritePgn` export destination resolved and held through export), and the search-index sidecar reads `src-tauri/src/db/search.rs` (~335) and `src-tauri/src/db/search_index.rs` (~886).
* **Defect:** SQLite's unix locks are process-associated `fcntl` locks, and closing any ordinary descriptor of an inode releases every such lock the process holds on it (measured 2026-09-29 on atlas, recorded in `f-20260929-11` and `d-20260930-10`). Game-database pools are keyed by `DatabaseFileTarget`, but nothing stops the same inode from also being authorized as a puzzle database, a PGN import/export file or a search-index sidecar (a user pick of the same file, or a hard link). Each of those capabilities opens an ordinary descriptor on the leaf and closes it when the operation ends, possibly while a game-database pool on that inode holds a live SQLite lock — the same lock-release hazard `f-20260929-11` removes from the repository's own probes. Found by a locate probe of the `f-20260929-11` build run (2026-10-01), which classified these sites as "lockable open+close while pooled possible" only through such a cross-capability alias.
* **Why it matters:** with the lock silently gone, another process can checkpoint and unlink the `-wal`/`-shm` this process still uses, or write under a reader that believes it holds a lock — database corruption. Reachable only when one inode is authorized under two capability kinds, so far rarer than `f-20260929-11`.
* **Open question:** should path authority refuse (or a capability consumer detect) an inode that is live in a game-database pool when it is resolved under another capability kind — and if so, where is the cross-kind inode registry and what does the user see — or should each of these consumers stop holding an ordinary descriptor (identity by `fstatat` / `O_PATH`, snapshot copy through a non-lockable route), given that a puzzle snapshot and a PGN export genuinely read or write the bytes?
* **Related:** `f-20260929-11` (the repository's own probes; this finding is the residual outside the repository), `d-20260930-10`, `d-20260929-05` (cross-directory hard-link refusal for game databases only).

## Threat model and non-goals

Supported Linux, macOS and Windows. Same-process concurrent operations, accidental duplicate picks, hard-link aliases across authorized capability kinds, and swaps of an authorized leaf during verification are in scope. The adversary may mutate entries in an authorized directory, including substituting an active database inode or causing metadata inspection to fail. Preserve parent containment and no-follow behavior. Other processes use SQLite's usual locking contract. The fix does not promise protection against external writers that deliberately ignore locks or an operating-system/kernel failure.

No change to persistent capability schema, renderer IPC signatures, native dialogs, database schema, pool eviction policy or same-directory game-database hard-link naming. No new background process, service, watcher or source-text verifier.

## Traced premises

* `infra/path_authority/resolved.rs:96,176,481,553,754,908`: ResolvedPath, streaming transfers, PGN snapshots and puzzle duplicates currently own plain Files that escape resolution.
* `db/repository.rs:531`: puzzle snapshot copying clones and retains the source descriptor independently of the original resolution.
* `db/sqlite_cancellation.rs:482,485`: the existing pinned-factory cancellation fixture passes a bare File into that snapshot factory and must migrate with its ownership contract.
* `db/mod.rs:3587`: PGN export resolves and snapshots its destination before acquiring its database connection, so reverse ordering is reachable.
* `db/search.rs:322` and `db/search_index.rs:908`: preferred and legacy sidecar opens bypass PathAuthority resolution and clone into mapping consumers.
* `db/content_validation.rs:170`, `infra/path_authority/mod.rs:717,6378,6594,6671` and `infra/fs.rs:4914,2024`: integrity/workspace sidecars, engine/book carriers, open-or-create and archive sync are direct ordinary-file dependencies of the same capability boundary.
* `infra/fs.rs:4870`: generic Unix open_regular_at opens a lockable descriptor before fstat and flag adjustment. Every subsequent error currently drops it.
* `db/bound_sqlite.rs:165,543,602,627`: process-global binding creation, removal and quarantine already arbitrate descriptor safety for SQLite's own hooks.
* `infra/path_authority/mod.rs:7194`: game database targets use metadata and parent descriptors, so they need no ordinary data-file lease.
* `db/repository.rs:3479`: an existing forked-child F_GETLK observer checks actual SQLite locks without closing a fresh parent-process probe descriptor.
* Governing precedents: d-20260929-05 retains game-binding directory exclusion. d-20260930-10 establishes Linux O_PATH verification and bounded non-Linux quarantine. d-20261001-06 preserves descriptor-free metadata probes. d-20261009-08 through d-20261009-10 preserve nonblocking special-file refusal and unknown-descriptor retention.

Paths in this section are relative to `src-tauri/src/`. No runtime reproduction or platform compilation was run by the planner.

The refresh trace at 8bccb79c confirms those open paths still use ordinary Files. The process-generated drift from ca0ab686 changes position-search progress cancellation, setup construction, cache predicates and transient query/index metadata. Preserve those established semantics during the carrier migration, as already required by O2. Current precedents include d-20261009-15 through d-20261009-17, d-20261009-19 through d-20261009-22, d-20261009-24 and d-20261009-25. The bound SQLite, repository and generic filesystem ownership boundaries are unchanged by that drift. Build tier remains required because the shared cross-kind ownership design has not been implemented.

## Approach

### O1 — one inode admission and close boundary

Mandate basis: "one inode ... under two capability kinds" and "closes ... while a game-database pool ... holds a live SQLite lock".

Introduce one process-wide inode ownership primitive under infra, used by both bound SQLite registrations and ordinary capability-derived regular files. Identity is native file identity, independent of pathname, parent spelling and capability kind. On Unix, ordinary access and a bound SQLite lifetime are mutually exclusive for the same inode. Either acquisition order refuses the incompatible newcomer with the existing typed Conflict path before it can close an ordinary descriptor of the database. Compatible ordinary readers may coexist. Existing game-to-game binding rules remain governed by d-20260929-05.

The SQLite reservation begins before connection creation can hold locks and survives pending creation, published registrations and every live connection. Ordinary ownership survives every actual source descriptor and clone. Close all ordinary descriptors before releasing their final ownership, under the same arbitration that admits a new SQLite reservation. There must be no check-to-open, check-to-close or final-drop-to-reacquire gap. Unwind, cancellation, failed creation and poisoned-state paths preserve lock safety and release owned reservations without panic. Do not hold any registry lock across await, callbacks or a nested registry acquisition. Preserve a documented lock order with the existing VFS registry.

Use the existing VFS quarantine policy through this boundary rather than duplicate identity-liveness registries. Retention and admission cover creating SQLite reservations as well as published holders. Quarantine descriptors may drain only while new incompatible acquisition is excluded. Retain d-20260930-10's admission threshold of 8 and its allowance for already-admitted opens. Refuse at admission rather than closing a retained descriptor to clear capacity.

Bound SQLite sidecars need ordinary ownership too. Their raw descriptors are handed to SQLite, so retain their ordinary leases in the owning registration until all its connections close. This conservative lifetime may refuse another database binding longer than that sidecar descriptor is open, but never shorter. Private main-file descriptors remain owned by SQLite's existing close protocol. The native handoff is confined to this adapter and never offered as a general carrier escape.

### O2 — open safely and carry ownership through consumers

Mandate basis: "the generic resolver opens and retains an ordinary leaf descriptor" and "a puzzle snapshot and a PGN export genuinely read or write the bytes".

The ordinary regular-file opening boundary returns an owning carrier whose transfer and clone preserve O1, rather than an unguarded File plus a guard that callers can discard independently. Provide the I/O and native borrowed-descriptor operations existing consumers need, without a production consuming escape to a bare File or an untracked clone. Directory descriptors and private freshly created temporary files need no inode exclusion because they cannot be aliases of a pre-existing authorized data inode. A file created with exclusive create must still carry ownership if it becomes reachable by a database binding before its last descriptor closes.

On Linux, identify the retained leaf with O_PATH and fstat, perform admission, then reopen that exact descriptor with the required ordinary access. Never reopen the name after admission. Refusal, O_PATH inspection failure or proc reopen failure closes no lockable foreign inode. Unavailable proc fails closed. On macOS, serialize lockable open, identification and admission against SQLite acquisition, preserve the expected identity check, and quarantine any actually opened descriptor of an incompatible bound inode or an unclassified descriptor before returning an error. No failure may implicitly drop that unsafe descriptor. Preserve nonblocking special-file refusal and parent/no-follow checks. Windows preserves the current handle rights, share modes and handle-scoped lock behavior, without inventing Unix lock exclusion there.

Migrate resolution, PGN snapshot refresh and cloning, puzzle snapshot copying and retained source, puzzle deletion, PGN import/export, workspace readers and metadata sidecars, preferred and legacy search-index opening and mapping, verified image/artifact carriers and their direct consumers. Also route generic capability-derived regular opens inside the filesystem adapters through this ownership boundary whenever their objects can alias an authorized database. SQLite sidecar hooks must not close a sidecar descriptor that aliases another active database primary. Borrowed metadata-only probes stay descriptor-free on Unix.

Keep existing behavior governed by d-20261008-08 (descriptor-based PGN revision retries), d-20261008-15 and d-20261008-16 (opened-sidecar provenance and error propagation), d-20261005-06 (mapping invalidation), d-20261002-08 (sidecar deletion policy) and d-20260905-07 (authorized-directory containment). Ordinary ownership can last for an engine-resource lifetime, and cached SQLite bindings count even when idle. Refusals are immediate, never a wait between the opposing nested operation orders.

### O3 — behavior, failure and platform witnesses

Mandate basis: "with the lock silently gone ... database corruption".

Prove lock survival with actual repository connections holding a read transaction and an external child observing the inode's POSIX lock. Cover each mandate consumer family through its production entry point, with same-name and hard-link aliases, compatible independent-file success and both acquisition orders. Cover a surviving duplicate after the original carrier drops, ownership transfer, last-owner release allowing retry, canceled or malformed puzzle/PGN/index operations, creation failure, and concurrent final close versus SQLite admission. Use deterministic hooks and barriers rather than sleep-based interleavings.

Platform-specific witnesses exercise leaf substitution and metadata/reopen errors at the actual opening boundary. Linux refusal paths must never create a lockable descriptor of the protected inode. macOS refusal paths must retain unsafe and unclassified descriptors, preserve locks, refuse further admission at capacity and drain safely at the last SQLite holder. Preserve original I/O errno when it is not a compatibility conflict. Process-isolate poison and global-quarantine tests. Windows proves the shared carrier compiles and ordinary supported operations still succeed, with native rights/share-mode fixtures.

Take a Git-derived withdrawal of the source fix while keeping the new regression tests, observe their intended failure, restore byte-identical source and rerun green. Compiler/unit proofs establish integration. Linux measurements establish Linux semantics. macOS and Windows runtime claims require the named pushed-head CI jobs. No source-pattern assertion substitutes for the lock witness.

## Decisions and trade-offs

Retain build tier. The existing decisions resolve platform primitives but do not select the cross-kind ownership and integration contract. This requires a coordinated concurrency and filesystem change rather than one exact mirrored edit.

One cohesive implementation phase owns the shared primitive and all carrier migrations, because changing the ordinary-file return type and integrating SQLite exclusion cannot ship separately without leaving a safety gap or broken consumers. Read-only review is delegated through the selected Codex executor. The root owns tracing, plan writing and arbitration. Round 1 runs every plan-capable lens. No full-history fork is used. All leaf prompts name applicable rule files.

## Decided autonomously

* **Question:** refuse concurrent cross-kind alias access or preserve it through retained descriptors? **Chosen:** symmetric Unix inode admission with lifetime-carrying ordinary files. **Rejected:** a pool-live check at resolution only, which misses reverse ordering, and retention of every successful ordinary descriptor until pool release, which can accumulate descriptors under normal repeated reads. **Reason:** refusal prevents the lock-release mechanism with explicit ownership. **Reversal path:** a measured close-safe shared-descriptor alternative covering all consumers and both orders can replace admission.
* **Question:** what error reaches the user? **Chosen:** existing Conflict presentation for an incompatible live inode, preserving native I/O errors and existing cancellation elsewhere. **Rejected:** new settings, new dialogs or persisted cross-kind prohibitions. **Reason:** transient resource conflict follows the precedent d-20260929-05 and does not change what capability authorization promises. **Reversal path:** amend the ordinary admission error mapping and its caller tests.
* **Question:** who performs acceptance? **Chosen:** agent-run native lock witnesses and pushed-head platform CI. **Rejected:** a manual native picker test as the correctness gate. **Reason:** the defect is descriptor lifecycle, which the existing backend test harness observes directly. **Reversal path:** add manual acceptance only for a newly introduced native GTK surface.

## Risks / open questions

* macOS and Windows runtime evidence is unavailable in this planning snapshot. The adopting run must wait for rust-macos-test, rust-windows-test and the rust-platform matrix on its pushed SHA, and follow the existing remote-red refusal before pushing. f-20261008-06 is an open Windows puzzle-test failure that may block release, it is not settled by this plan.
* Wider generic File return-type changes require a complete importer inventory during implementation. Do not add a permissive raw-File escape to make compilation green.
* Global ownership must not reenter its mutex through destructor callbacks or from the VFS registry. Review the final diff for drop order and creation reservations.

## Not part of this task

Sibling findings remain open at their existing tiers, including f-20260929-05 (build, same-directory SQLite aliases), f-20260930-01 (build, pool eviction/drain), f-20260929-04 (lens, retry diagnostics), f-20261002-02 (build, reused-inode test collisions), and f-20261008-06 (build, Windows puzzle deletion). Independent malformed content, index-provenance policy, renderer layout and native GTK acceptance are outside this mandate.

## Phases

### Phase 1 — shared inode ownership and capability consumer migration

Files: `src-tauri/src/infra/mod.rs`, a new shared ownership module under `src-tauri/src/infra/`, `src-tauri/src/infra/fs.rs`, `src-tauri/src/infra/path_authority/{mod,resolved,verified}.rs`, `src-tauri/src/db/{bound_sqlite,repository,mod,search,search_index,content_validation,sqlite_cancellation,test_support}.rs`, `src-tauri/src/{puzzle,pgn,file_workspace,sound,practice,credentials,main,chess,game}.rs`, `src-tauri/src/engine/{process,types}.rs` and existing carrier-contract tests under `src-tauri/src/infra/platform_support/`. Edits in direct consumer files are limited to ownership-carrier integration and regression witnesses, preserving their domain semantics. The pinned-factory fixture in sqlite_cancellation.rs must acquire the shared ordinary carrier before passing it into the migrated puzzle snapshot factory, preserving its cancellation assertion. The traced importer inventory is frozen in this file list. Recheck it against the adopting revision before assigning the write leaf and put exact paths in its brief. No source edit belongs to this planning run.

Contract: O1 through O3. Touches filesystem capability ownership, concurrency and descriptor persistence in memory. No persisted schema or IPC type change. Executor Codex, role sensitive, model/effort resolved from `leaf.codex.write.sensitive`. One sequential write leaf, no root implementation.

Proof command: `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable && pnpm checks:pre-review && pnpm gates:contract:check`. Include the new native witnesses in the existing test binary, with Linux/macOS cfg parity. Record the Git-derived red/green withdrawal evidence. The root repeats the command and inspects the complete diff before the phase commit.

After cumulative diff review and repairs, run `pnpm build && pnpm verify:app` as the real-product startup/teardown smoke check. Its existing harness does not claim to reproduce the cross-capability race. No renderer pixels change, so no screenshot re-recording is proposed.

Final gates on the clean committed tree: `pnpm gates:push -- --rust --frontend --bindings`, selected from the canonical push mapping because the planned carrier consumer set includes main.rs. No floor, baseline or budget may be lowered. Then complete the project's push skill, pushed-head macOS/Windows runtime CI and installation when applicable. Record autonomous decisions and close the finding only in the adopting execution run through findings.py. Planner modes stop before Preflight, without locks, ledger writes, commits, push, dev server or browser.

## Carried to diff review

None at initial revision.

## Reviews

Plan authorship and arbitration shared one root Codex context. Detection ran on the same Codex model family selected for implementation. These are independent read-only leaf contexts, not independent model-family detection. No implementation or runtime platform verification occurred.

### Round 1 — initial frozen plan

Candidate: RUN_TMP/plan-r1.md at base ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. All 12 plan-capable lenses completed through leaf-launch.sh, with terminal markers confirmed by drain-poll-leaves.py. The code-quality and root-cause lenses explicitly exclude plan review. Raw prompts, reports and JSONL remain alongside the snapshot in RUN_TMP. Review leaf elapsed from snapshot to observed completion: 385.438 seconds. No known non-overlapping quota, dependency, release or other wait. Active wall elapsed is recorded separately when arbitration finishes, parallel leaf durations are not summed.

Raw counts: blocker 1, should-fix 0, nit 0. Unique opened I1, resolved none. Adopted plan-level corrections 1, carried 0, arbiter nits 0, Skip 0, Defer 0. No withdrawal, rewrite, split or correction-introduced defect. Downstream rework is not yet applicable.

| ID | Witnesses and raw verdict | Disposition | Evidence and affected obligation | Authority | Correction revision, dependency and closure |
| --- | --- | --- | --- | --- | --- |
| I1 | plan r1 finding 1, blocker, confidence 98, REVISE | Fix | db/sqlite_cancellation.rs:482 opens File, :485 passes it to repository.rs:531–535. Confirmed by root source read. O2 changes that factory's carrier contract. Its known test caller must migrate for integration and cancellation proof to compile. | MANDATE names puzzle reads through schema_specific_connection_expected_file_cancellable and its clones. Existing O2 already requires the owning carrier across those consumers. No new mechanism. | r2 adds sqlite_cancellation.rs to the frozen phase scope and explicitly preserves its cancellation assertion while acquiring the shared carrier. Dependencies none. Closure open pending review-plan check. |

Raw output below is preserved unchanged.

#### correctness r1

```text
No concrete correctness mismatch found in O1–O3. The plan covers both acquisition orders, clone ownership, final-close arbitration, and SQLite sidecar handoffs.

Limitation: this is plan review. Implementation drop order, mutex interactions, and macOS/Windows runtime behavior remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### error-handling r1

```text
VERDICT: APPROVED
```

#### minimalism r1

```text
No bloat or duplication findings. The shared ownership boundary has multiple existing consumers, and the carrier migrations address descriptor lifetimes required by the mandate. The plan explicitly reuses quarantine policy and limits consumer edits to integration and regression witnesses.

VERDICT: APPROVED
```

#### plan r1

```text
[blocker] tasks/plans/2026-10-09-cross-capability-sqlite-locks.md:101 — O2 changes the puzzle snapshot factory’s ownership contract, but the file list omits `src-tauri/src/db/sqlite_cancellation.rs:482`, which opens a bare `File` and passes it to `schema_specific_connection_expected_file_cancellable` at line 485. The factory currently accepts `File` at `src-tauri/src/db/repository.rs:533`. Address this consumer in the frozen migration scope before delegation. Deferring importer inventory to implementation leaves a known caller unaddressed (confidence: 98).

Limitation: platform runtime behavior was not exercised during this read-only review (confidence: 100).

VERDICT: REVISE
```

#### tests r1

```text
The proposed proofs would catch a revert: external lock assertions cover lock survival, duplicate/drop/retry witnesses cover ownership lifetime, and native CI runs the platform tests. O3 also requires observed Git-derived red/green evidence. No verification gaps found at plan altitude.

VERDICT: APPROVED
```

#### chess-semantics r1

```text
NOT APPLICABLE: O1–O3 govern inode admission, descriptor ownership and lock verification. Consumer edits preserve domain semantics. The plan changes no in-memory chess tree, position identity, move path, parity, legality or metadata round trip.

VERDICT: APPROVED
```

#### engine-protocol r1

```text
No in-lens defects found in the plan’s ownership-carrier integration. Engine identity, result guards and process supervision remain preserved by its contract. Runtime verification remains for implementation.

VERDICT: APPROVED
```

#### ipc-contract r1

```text
NOT APPLICABLE: O1–O3 cover native inode admission, descriptor ownership and lock witnesses. The plan explicitly preserves renderer IPC signatures and limits consumer edits to ownership-carrier integration. It introduces no event, command, payload, listener or Tauri capability-scope change.

VERDICT: APPROVED
```

#### persisted-state r1

```text
NOT APPLICABLE: O1–O3 and all planned files concern backend inode ownership and descriptor lifetimes. The plan explicitly preserves persisted schemas and renderer IPC signatures, with no renderer storage, atom-family or tab-lifecycle changes.

VERDICT: APPROVED
```

#### pgn-index r1

```text
No findings within this lens. The plan preserves PGN streaming, descriptor-based revision retries, search-index provenance and invalidation, and import transaction boundaries during ownership migration.

VERDICT: APPROVED
```

#### platform-semantics r1

```text
No platform-semantics findings. The plan covers Linux descriptor reopening, macOS quarantine and close arbitration, and preservation of Windows handle behavior.

Verification remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. Runtime proof requires pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and clippy evidence only.

VERDICT: APPROVED
```

#### tauri-security r1

```text
No security-boundary defects found in the r1 plan. O1–O3 require sealed descriptor ownership, preserved no-follow containment, safe failure retention and native lock witnesses.

Limitation: this is plan review only. Implementation and platform runtime behavior remain unverified. No token/session or signed-manifest behavior change is proposed.

VERDICT: APPROVED
```

### Round 1 — arbitration completion

Wall elapsed including source confirmation, correction writing and arbitration: 511.358 seconds. Active review wall time: 511.358 seconds, with zero known non-overlapping waits. The earlier 385.438 seconds is the narrower leaf-completion interval. Adopted count remains r1=1. I1 awaits its r2 closure check, with no other open issue.

### Round 2 — I1 closure

Candidate: RUN_TMP/plan-r2.md at the unchanged base, with body-only candidate tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r2.body.md and exact delta tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r2.diff. Root checked the complete delta and the source-confirmed caller inventory before launch. Only review-plan ran because it is the sole I1 witness and no new domain contract changed. The original review-plan body was preserved in the closure prompt. Prior snapshot, full history, current issue, corrected mechanism, source trace and dependent cancellation proof were supplied.

The leaf completed through leaf-launch.sh, confirmed by drain-poll-leaves.py. Wall and active review elapsed including arbitration: 183.640 seconds. Known non-overlapping waits: quota 0, dependency 0, release 0, other 0. No parallel-duration summation.

Raw counts: blocker 0, should-fix 0, nit 0. Opened none, resolved I1. Adopted plan-level corrections r2=0. Unique totals: opened 1, resolved 1, open 0. Carried 0, Skip 0, Defer 0, arbiter nits 0. No inherited history, withdrawal, rewrite, split or correction-introduced defect. Implementation and downstream rework have not begun.

| ID | Disposition and closure | Evidence | Remaining obligation |
| --- | --- | --- | --- |
| I1 | Fix, closed_round 2 | review-plan explicitly reports I1 CLOSED against r2 body:102 and verifies sqlite_cancellation.rs:485 with repository.rs:531. Root confirms the exact file-list and carrier-acquisition correction. | No open plan issue. Compilation and native runtime witnesses remain execution obligations O2–O3. |

#### plan r2

```text
I1 CLOSED — r2 plan `tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r2.body.md:102` includes `sqlite_cancellation.rs` and requires shared-carrier acquisition while preserving cancellation. The caller at `src-tauri/src/db/sqlite_cancellation.rs:485` matches the factory at `src-tauri/src/db/repository.rs:531`. All traced factory callers are now in scope (confidence: 98).

Limitation: compiler and platform runtime proofs were not run during this read-only review (confidence: 100).

VERDICT: APPROVED
```

### Final planner state

Completed rounds 2, measured review wall time 694.998 seconds, adoptions r1=1 r2=0. All 12 plan-capable lenses covered, with 13 completed leaf reports. The sole blocker was source-confirmed, corrected and explicitly closed in r2. No unresolved or carried review issue. Mandatory implementation proof and native platform CI remain pending because this run stops before Preflight.

The full record is copied to tasks/plans/reviews-handoff.md for the supervisor to publish with the plan. The adopting run must load it before review, preserve I1's witness and closure history, record the autonomous technical decisions in tasks/decisions.md, and promote the review history to a tracked tasks/handoffs/2026-10-09-f-20261001-02-review.md before closing the finding. No ledger, tracked source, commit, push or installation belongs to this planning run.

### plan-r4.md

# Plan: preserve SQLite locks across capability aliases

## Goal

Resolve f-20261001-02 by preventing ordinary descriptors of an inode from closing while a game-database SQLite binding can hold POSIX locks on it. Refresh the reviewed plan at base eb1ee092f127d49d2a842b9da5b1010326232d04, preserving its review lineage from ca0ab68689e0f4de8ca0b84df2be29963bcfc66c through the 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee refresh.

## MANDATE

### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it

* **ID:** f-20261001-02 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority/resolved.rs` (~544, ~556, ~860: the generic resolver opens and retains an ordinary leaf descriptor in `ResolvedPath.file`); its consumers `src-tauri/src/puzzle.rs` (~103, ~123, ~160, ~188, ~213 puzzle reads through `schema_specific_connection_expected_file_cancellable`, which also `try_clone()`s the descriptor; ~610 puzzle deletion), `src-tauri/src/db/mod.rs` (~3123, an existing `WritePgn` export destination resolved and held through export), and the search-index sidecar reads `src-tauri/src/db/search.rs` (~335) and `src-tauri/src/db/search_index.rs` (~886).
* **Defect:** SQLite's unix locks are process-associated `fcntl` locks, and closing any ordinary descriptor of an inode releases every such lock the process holds on it (measured 2026-09-29 on atlas, recorded in `f-20260929-11` and `d-20260930-10`). Game-database pools are keyed by `DatabaseFileTarget`, but nothing stops the same inode from also being authorized as a puzzle database, a PGN import/export file or a search-index sidecar (a user pick of the same file, or a hard link). Each of those capabilities opens an ordinary descriptor on the leaf and closes it when the operation ends, possibly while a game-database pool on that inode holds a live SQLite lock — the same lock-release hazard `f-20260929-11` removes from the repository's own probes. Found by a locate probe of the `f-20260929-11` build run (2026-10-01), which classified these sites as "lockable open+close while pooled possible" only through such a cross-capability alias.
* **Why it matters:** with the lock silently gone, another process can checkpoint and unlink the `-wal`/`-shm` this process still uses, or write under a reader that believes it holds a lock — database corruption. Reachable only when one inode is authorized under two capability kinds, so far rarer than `f-20260929-11`.
* **Open question:** should path authority refuse (or a capability consumer detect) an inode that is live in a game-database pool when it is resolved under another capability kind — and if so, where is the cross-kind inode registry and what does the user see — or should each of these consumers stop holding an ordinary descriptor (identity by `fstatat` / `O_PATH`, snapshot copy through a non-lockable route), given that a puzzle snapshot and a PGN export genuinely read or write the bytes?
* **Related:** `f-20260929-11` (the repository's own probes; this finding is the residual outside the repository), `d-20260930-10`, `d-20260929-05` (cross-directory hard-link refusal for game databases only).

## Threat model and non-goals

Supported Linux, macOS and Windows. Same-process concurrent operations, accidental duplicate picks, hard-link aliases across authorized capability kinds, and swaps of an authorized leaf during verification are in scope. The adversary may mutate entries in an authorized directory, including substituting an active database inode or causing metadata inspection to fail. Preserve parent containment and no-follow behavior. Other processes use SQLite's usual locking contract. The fix does not promise protection against external writers that deliberately ignore locks or an operating-system/kernel failure.

No change to persistent capability schema, renderer IPC signatures, native dialogs, database schema, pool eviction policy or same-directory game-database hard-link naming. No new background process, service, watcher or source-text verifier.

## Traced premises

* `infra/path_authority/resolved.rs:96,176,481,553,754,908`: ResolvedPath, streaming transfers, PGN snapshots and puzzle duplicates currently own plain Files that escape resolution.
* `db/repository.rs:906,922`: puzzle snapshot copying takes a bare File and clones and retains the source descriptor independently of the original resolution.
* `db/sqlite_cancellation.rs:482,485`: the existing pinned-factory cancellation fixture passes a bare File into that snapshot factory and must migrate with its ownership contract.
* `db/mod.rs:3586–3597`: PGN export resolves and snapshots its destination before acquiring its database connection, so reverse ordering is reachable.
* `db/search.rs:321` and `db/search_index.rs:908,916,918`: preferred and legacy sidecar opens bypass PathAuthority resolution and clone into mapping consumers.
* `db/content_validation.rs:171`, `infra/path_authority/mod.rs:717,6378,6594,6671` and `infra/fs.rs:4933,2043`: integrity/workspace sidecars, engine/book carriers, open-or-create and archive sync are direct ordinary-file dependencies of the same capability boundary.
* `infra/fs.rs:4889`: generic Unix open_regular_at opens a lockable descriptor before fstat and flag adjustment. Every subsequent error currently drops it.
* `db/bound_sqlite.rs:182,214–233,579,638,663`: process-global binding creation, same-inode distinct-key admission, removal and quarantine already arbitrate descriptor safety for SQLite's own hooks under the binding registry mutex.
* `db/repository.rs:654,1063,1085–1087,1404–1409` and `db/content_validation.rs:561–573`: pool construction, read_revision and the content scan take a retired-predecessor admission and drop the repository state mutex before BoundDatabase::acquire. A retired pool's manager keeps its BoundDatabase until the retirement's connection and owner tickets drain.
* `infra/path_authority/mod.rs:7194`: game database targets use metadata and parent descriptors, so they need no ordinary data-file lease.
* `db/repository.rs:5942`: an existing forked-child F_GETLK observer checks actual SQLite locks without closing a fresh parent-process probe descriptor.
* Governing precedents: d-20261011-01 (superseding d-20260929-05's same-directory allowance) refuses any second distinct binding key for one inode, cross-parent or same-parent, including creation reservations. d-20261011-07 through d-20261011-13 retain LRU-evicted pools as bounded retirements and fence reopen, read_revision and the content scan on retired predecessors. d-20260930-10 establishes Linux O_PATH verification and bounded non-Linux quarantine. d-20261001-06 preserves descriptor-free metadata probes. d-20261009-08 through d-20261009-10 preserve nonblocking special-file refusal and unknown-descriptor retention.

Paths in this section are relative to `src-tauri/src/`. No runtime reproduction or platform compilation was run by the planner.

The refresh trace at 8bccb79c confirms those open paths still use ordinary Files. The process-generated drift from ca0ab686 changes position-search progress cancellation, setup construction, cache predicates and transient query/index metadata. Preserve those established semantics during the carrier migration, as already required by O2. Current precedents include d-20261009-15 through d-20261009-17, d-20261009-19 through d-20261009-22, d-20261009-24 and d-20261009-25. The bound SQLite, repository and generic filesystem ownership boundaries are unchanged by that drift. Build tier remains required because the shared cross-kind ownership design has not been implemented.

The refresh trace at eb1ee092 confirms every ordinary open path above is still a plain File. The process-generated drift from 8bccb79c changes four boundaries this plan integrates with. Bound SQLite now refuses a second distinct key per inode in BoundDatabase::acquire (f-20260929-05, d-20261011-01). The repository retains LRU-evicted pools as bounded retirements whose managers keep their bindings, and fences pool construction, cached acquisition, read_revision and the content scan on retired predecessors (f-20260930-01, d-20261011-07 through d-20261011-14). Pools take busy_timeout before WAL and use the production connection budget in tests. Search-index probe attempts resolve inside one shared closure. O1, O2 and O3 now cite these as preserved inputs. The cross-kind ordinary-descriptor hazard is unchanged, because none of those changes gives ordinary capability files an owner. Build tier remains required.

## Approach

### O1 — one inode admission and close boundary

Mandate basis: "one inode ... under two capability kinds" and "closes ... while a game-database pool ... holds a live SQLite lock".

Introduce one process-wide inode ownership primitive under infra, used by both bound SQLite registrations and ordinary capability-derived regular files. Identity is native file identity, independent of pathname, parent spelling and capability kind. On Unix, ordinary access and a bound SQLite lifetime are mutually exclusive for the same inode. Either acquisition order refuses the incompatible newcomer with the existing typed Conflict path before it can close an ordinary descriptor of the database. Compatible ordinary readers may coexist. Game-to-game binding admission stays as d-20261011-01 decides: one distinct binding key per inode across published registrations and creation reservations, with its two existing Conflict messages. The SQLite side of the shared primitive must not become a second per-inode liveness record that can diverge from that admission. The game-to-game and ordinary-versus-SQLite decisions read one per-inode SQLite admission state under one arbitration.

The SQLite reservation begins before connection creation can hold locks and survives pending creation, published registrations and every live connection. Ordinary ownership survives every actual source descriptor and clone. Close all ordinary descriptors before releasing their final ownership, under the same arbitration that admits a new SQLite reservation. There must be no check-to-open, check-to-close or final-drop-to-reacquire gap. Unwind, cancellation, failed creation and poisoned-state paths preserve lock safety and release owned reservations without panic. Do not hold any registry lock across await, callbacks or a nested registry acquisition. Preserve a documented lock order with the existing VFS registry and the repository's state mutex. Retired-predecessor admission is taken and its mutex dropped before binding acquisition, and that order must remain. An ownership refusal never waits on a retirement.

Use the existing VFS quarantine policy through this boundary rather than duplicate identity-liveness registries. Retention and admission cover creating SQLite reservations as well as published holders. Quarantine descriptors may drain only while new incompatible acquisition is excluded. Retain d-20260930-10's admission threshold of 8 and its allowance for already-admitted opens. Refuse at admission rather than closing a retained descriptor to clear capacity.

Bound SQLite sidecars need ordinary ownership too. Their raw descriptors are handed to SQLite, so retain their ordinary leases in the owning registration until all its connections close. This conservative lifetime may refuse another database binding longer than that sidecar descriptor is open, but never shorter. Private main-file descriptors remain owned by SQLite's existing close protocol. The native handoff is confined to this adapter and never offered as a general carrier escape.

### O2 — open safely and carry ownership through consumers

Mandate basis: "the generic resolver opens and retains an ordinary leaf descriptor" and "a puzzle snapshot and a PGN export genuinely read or write the bytes".

The ordinary regular-file opening boundary returns an owning carrier whose transfer and clone preserve O1, rather than an unguarded File plus a guard that callers can discard independently. Provide the I/O and native borrowed-descriptor operations existing consumers need, without a production consuming escape to a bare File or an untracked clone. Directory descriptors and private freshly created temporary files need no inode exclusion because they cannot be aliases of a pre-existing authorized data inode. A file created with exclusive create must still carry ownership if it becomes reachable by a database binding before its last descriptor closes.

On Linux, identify the retained leaf with O_PATH and fstat, perform admission, then reopen that exact descriptor with the required ordinary access. Never reopen the name after admission. Refusal, O_PATH inspection failure or proc reopen failure closes no lockable foreign inode. Unavailable proc fails closed. On macOS, serialize lockable open, identification and admission against SQLite acquisition, preserve the expected identity check, and quarantine any actually opened descriptor of an incompatible bound inode or an unclassified descriptor before returning an error. No failure may implicitly drop that unsafe descriptor. Preserve nonblocking special-file refusal and parent/no-follow checks. Windows preserves the current handle rights, share modes and handle-scoped lock behavior, without inventing Unix lock exclusion there.

Migrate resolution, PGN snapshot refresh and cloning, puzzle snapshot copying and retained source, puzzle deletion, PGN import/export, workspace readers and metadata sidecars, preferred and legacy search-index opening and mapping, verified image/artifact carriers and their direct consumers. Also route generic capability-derived regular opens inside the filesystem adapters through this ownership boundary whenever their objects can alias an authorized database. SQLite sidecar hooks must not close a sidecar descriptor that aliases another active database primary. Borrowed metadata-only probes stay descriptor-free on Unix.

Keep existing behavior governed by d-20261008-08 (descriptor-based PGN revision retries), d-20261008-15 and d-20261008-16 (opened-sidecar provenance and error propagation), d-20261005-06 (mapping invalidation), d-20261002-08 (sidecar deletion policy) and d-20260905-07 (authorized-directory containment). Keep the retirement and predecessor-barrier behavior of d-20261011-07 through d-20261011-13 unchanged. Ordinary ownership can last for an engine-resource lifetime. Cached SQLite bindings count even when idle, and a retired pool's binding counts until its retirement completes. Refusals are immediate, never a wait between the opposing nested operation orders.

### O3 — behavior, failure and platform witnesses

Mandate basis: "with the lock silently gone ... database corruption".

Prove lock survival with actual repository connections holding a read transaction and an external child observing the inode's POSIX lock. Cover each mandate consumer family through its production entry point, with same-name and hard-link aliases, compatible independent-file success and both acquisition orders. Include a retired-but-draining predecessor pool as a SQLite holder, and keep the existing d-20261011-01 same-parent and cross-parent binding refusals green. Cover a surviving duplicate after the original carrier drops, ownership transfer, last-owner release allowing retry, canceled or malformed puzzle/PGN/index operations, creation failure, and concurrent final close versus SQLite admission. Use deterministic hooks and barriers rather than sleep-based interleavings.

Platform-specific witnesses exercise leaf substitution and metadata/reopen errors at the actual opening boundary. Linux refusal paths must never create a lockable descriptor of the protected inode. macOS refusal paths must retain unsafe and unclassified descriptors, preserve locks, refuse further admission at capacity and drain safely at the last SQLite holder. Preserve original I/O errno when it is not a compatibility conflict. Process-isolate poison and global-quarantine tests. Windows proves the shared carrier compiles and ordinary supported operations still succeed, with native rights/share-mode fixtures.

Take a Git-derived withdrawal of the source fix while keeping the new regression tests, observe their intended failure, restore byte-identical source and rerun green. Compiler/unit proofs establish integration. Linux measurements establish Linux semantics. macOS and Windows runtime claims require the named pushed-head CI jobs. No source-pattern assertion substitutes for the lock witness.

## Decisions and trade-offs

Retain build tier. The existing decisions resolve platform primitives but do not select the cross-kind ownership and integration contract. This requires a coordinated concurrency and filesystem change rather than one exact mirrored edit.

One cohesive implementation phase owns the shared primitive and all carrier migrations, because changing the ordinary-file return type and integrating SQLite exclusion cannot ship separately without leaving a safety gap or broken consumers. Read-only review is delegated through the selected Codex executor. The root owns tracing, plan writing and arbitration. Round 1 runs every plan-capable lens. No full-history fork is used. All leaf prompts name applicable rule files.

## Decided autonomously

* **Question:** refuse concurrent cross-kind alias access or preserve it through retained descriptors? **Chosen:** symmetric Unix inode admission with lifetime-carrying ordinary files. **Rejected:** a pool-live check at resolution only, which misses reverse ordering, and retention of every successful ordinary descriptor until pool release, which can accumulate descriptors under normal repeated reads. **Reason:** refusal prevents the lock-release mechanism with explicit ownership. **Reversal path:** a measured close-safe shared-descriptor alternative covering all consumers and both orders can replace admission.
* **Question:** what error reaches the user? **Chosen:** existing Conflict presentation for an incompatible live inode, preserving native I/O errors and existing cancellation elsewhere. **Rejected:** new settings, new dialogs or persisted cross-kind prohibitions. **Reason:** transient resource conflict follows the precedents d-20260929-05 and d-20261011-01 and does not change what capability authorization promises. **Reversal path:** amend the ordinary admission error mapping and its caller tests.
* **Question:** who performs acceptance? **Chosen:** agent-run native lock witnesses and pushed-head platform CI. **Rejected:** a manual native picker test as the correctness gate. **Reason:** the defect is descriptor lifecycle, which the existing backend test harness observes directly. **Reversal path:** add manual acceptance only for a newly introduced native GTK surface.

## Risks / open questions

* macOS and Windows runtime evidence is unavailable in this planning snapshot. The adopting run must wait for rust-macos-test, rust-windows-test and the rust-platform matrix on its pushed SHA, and follow the existing remote-red refusal before pushing. f-20261008-06 is an open Windows puzzle-test failure that may block release, it is not settled by this plan.
* Wider generic File return-type changes require a complete importer inventory during implementation. Do not add a permissive raw-File escape to make compilation green.
* Global ownership must not reenter its mutex through destructor callbacks or from the VFS registry. Review the final diff for drop order and creation reservations.

## Not part of this task

Sibling findings remain open at their existing tiers, including f-20260929-04 (lens, retry diagnostics), f-20261002-02 (build, reused-inode test collisions), and f-20261008-06 (build, Windows puzzle deletion). f-20260929-05 (same-directory SQLite aliases) and f-20260930-01 (pool eviction/drain) are handled since this plan's prior base. Their decisions are inputs under O1 and O2, and this plan does not reopen them. Independent malformed content, index-provenance policy, renderer layout, renderer presentation of binding conflicts (f-20261009-03) and native GTK acceptance are outside this mandate.

## Phases

### Phase 1 — shared inode ownership and capability consumer migration

Files: `src-tauri/src/infra/mod.rs`, a new shared ownership module under `src-tauri/src/infra/`, `src-tauri/src/infra/fs.rs`, `src-tauri/src/infra/path_authority/{mod,resolved,verified}.rs`, `src-tauri/src/db/{bound_sqlite,repository,mod,search,search_index,content_validation,sqlite_cancellation,test_support}.rs`, `src-tauri/src/{puzzle,pgn,file_workspace,sound,practice,credentials,main,chess,game}.rs`, `src-tauri/src/engine/{process,types}.rs` and existing carrier-contract tests under `src-tauri/src/infra/platform_support/`. Edits in direct consumer files are limited to ownership-carrier integration and regression witnesses, preserving their domain semantics. The pinned-factory fixture in sqlite_cancellation.rs must acquire the shared ordinary carrier before passing it into the migrated puzzle snapshot factory, preserving its cancellation assertion. The traced importer inventory is frozen in this file list. Recheck it against the adopting revision before assigning the write leaf and put exact paths in its brief. No source edit belongs to this planning run.

Contract: O1 through O3. Touches filesystem capability ownership, concurrency and descriptor persistence in memory. No persisted schema or IPC type change. Executor Codex, role sensitive, model/effort resolved from `leaf.codex.write.sensitive`. One sequential write leaf, no root implementation.

Proof command: `cargo test --manifest-path src-tauri/Cargo.toml --bin chessfable && pnpm checks:pre-review && pnpm gates:contract:check`. Include the new native witnesses in the existing test binary, with Linux/macOS cfg parity. Record the Git-derived red/green withdrawal evidence. The root repeats the command and inspects the complete diff before the phase commit.

After cumulative diff review and repairs, run `pnpm build && pnpm verify:app` as the real-product startup/teardown smoke check. Its existing harness does not claim to reproduce the cross-capability race. No renderer pixels change, so no screenshot re-recording is proposed.

Final gates on the clean committed tree: `pnpm gates:push -- --rust --frontend --bindings`, selected from the canonical push mapping because the planned carrier consumer set includes main.rs. No floor, baseline or budget may be lowered. Then complete the project's push skill, pushed-head macOS/Windows runtime CI and installation when applicable. Record autonomous decisions and close the finding only in the adopting execution run through findings.py. Planner modes stop before Preflight, without locks, ledger writes, commits, push, dev server or browser.

## Carried to diff review

None at initial revision.

## Reviews

Plan authorship and arbitration shared one root Codex context. Detection ran on the same Codex model family selected for implementation. These are independent read-only leaf contexts, not independent model-family detection. No implementation or runtime platform verification occurred.

### Round 1 — initial frozen plan

Candidate: RUN_TMP/plan-r1.md at base ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. All 12 plan-capable lenses completed through leaf-launch.sh, with terminal markers confirmed by drain-poll-leaves.py. The code-quality and root-cause lenses explicitly exclude plan review. Raw prompts, reports and JSONL remain alongside the snapshot in RUN_TMP. Review leaf elapsed from snapshot to observed completion: 385.438 seconds. No known non-overlapping quota, dependency, release or other wait. Active wall elapsed is recorded separately when arbitration finishes, parallel leaf durations are not summed.

Raw counts: blocker 1, should-fix 0, nit 0. Unique opened I1, resolved none. Adopted plan-level corrections 1, carried 0, arbiter nits 0, Skip 0, Defer 0. No withdrawal, rewrite, split or correction-introduced defect. Downstream rework is not yet applicable.

| ID | Witnesses and raw verdict | Disposition | Evidence and affected obligation | Authority | Correction revision, dependency and closure |
| --- | --- | --- | --- | --- | --- |
| I1 | plan r1 finding 1, blocker, confidence 98, REVISE | Fix | db/sqlite_cancellation.rs:482 opens File, :485 passes it to repository.rs:531–535. Confirmed by root source read. O2 changes that factory's carrier contract. Its known test caller must migrate for integration and cancellation proof to compile. | MANDATE names puzzle reads through schema_specific_connection_expected_file_cancellable and its clones. Existing O2 already requires the owning carrier across those consumers. No new mechanism. | r2 adds sqlite_cancellation.rs to the frozen phase scope and explicitly preserves its cancellation assertion while acquiring the shared carrier. Dependencies none. Closure open pending review-plan check. |

Raw output below is preserved unchanged.

#### correctness r1

```text
No concrete correctness mismatch found in O1–O3. The plan covers both acquisition orders, clone ownership, final-close arbitration, and SQLite sidecar handoffs.

Limitation: this is plan review. Implementation drop order, mutex interactions, and macOS/Windows runtime behavior remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### error-handling r1

```text
VERDICT: APPROVED
```

#### minimalism r1

```text
No bloat or duplication findings. The shared ownership boundary has multiple existing consumers, and the carrier migrations address descriptor lifetimes required by the mandate. The plan explicitly reuses quarantine policy and limits consumer edits to integration and regression witnesses.

VERDICT: APPROVED
```

#### plan r1

```text
[blocker] tasks/plans/2026-10-09-cross-capability-sqlite-locks.md:101 — O2 changes the puzzle snapshot factory’s ownership contract, but the file list omits `src-tauri/src/db/sqlite_cancellation.rs:482`, which opens a bare `File` and passes it to `schema_specific_connection_expected_file_cancellable` at line 485. The factory currently accepts `File` at `src-tauri/src/db/repository.rs:533`. Address this consumer in the frozen migration scope before delegation. Deferring importer inventory to implementation leaves a known caller unaddressed (confidence: 98).

Limitation: platform runtime behavior was not exercised during this read-only review (confidence: 100).

VERDICT: REVISE
```

#### tests r1

```text
The proposed proofs would catch a revert: external lock assertions cover lock survival, duplicate/drop/retry witnesses cover ownership lifetime, and native CI runs the platform tests. O3 also requires observed Git-derived red/green evidence. No verification gaps found at plan altitude.

VERDICT: APPROVED
```

#### chess-semantics r1

```text
NOT APPLICABLE: O1–O3 govern inode admission, descriptor ownership and lock verification. Consumer edits preserve domain semantics. The plan changes no in-memory chess tree, position identity, move path, parity, legality or metadata round trip.

VERDICT: APPROVED
```

#### engine-protocol r1

```text
No in-lens defects found in the plan’s ownership-carrier integration. Engine identity, result guards and process supervision remain preserved by its contract. Runtime verification remains for implementation.

VERDICT: APPROVED
```

#### ipc-contract r1

```text
NOT APPLICABLE: O1–O3 cover native inode admission, descriptor ownership and lock witnesses. The plan explicitly preserves renderer IPC signatures and limits consumer edits to ownership-carrier integration. It introduces no event, command, payload, listener or Tauri capability-scope change.

VERDICT: APPROVED
```

#### persisted-state r1

```text
NOT APPLICABLE: O1–O3 and all planned files concern backend inode ownership and descriptor lifetimes. The plan explicitly preserves persisted schemas and renderer IPC signatures, with no renderer storage, atom-family or tab-lifecycle changes.

VERDICT: APPROVED
```

#### pgn-index r1

```text
No findings within this lens. The plan preserves PGN streaming, descriptor-based revision retries, search-index provenance and invalidation, and import transaction boundaries during ownership migration.

VERDICT: APPROVED
```

#### platform-semantics r1

```text
No platform-semantics findings. The plan covers Linux descriptor reopening, macOS quarantine and close arbitration, and preservation of Windows handle behavior.

Verification remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe was run. Runtime proof requires pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and clippy evidence only.

VERDICT: APPROVED
```

#### tauri-security r1

```text
No security-boundary defects found in the r1 plan. O1–O3 require sealed descriptor ownership, preserved no-follow containment, safe failure retention and native lock witnesses.

Limitation: this is plan review only. Implementation and platform runtime behavior remain unverified. No token/session or signed-manifest behavior change is proposed.

VERDICT: APPROVED
```

### Round 1 — arbitration completion

Wall elapsed including source confirmation, correction writing and arbitration: 511.358 seconds. Active review wall time: 511.358 seconds, with zero known non-overlapping waits. The earlier 385.438 seconds is the narrower leaf-completion interval. Adopted count remains r1=1. I1 awaits its r2 closure check, with no other open issue.

### Round 2 — I1 closure

Candidate: RUN_TMP/plan-r2.md at the unchanged base, with body-only candidate tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r2.body.md and exact delta tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r2.diff. Root checked the complete delta and the source-confirmed caller inventory before launch. Only review-plan ran because it is the sole I1 witness and no new domain contract changed. The original review-plan body was preserved in the closure prompt. Prior snapshot, full history, current issue, corrected mechanism, source trace and dependent cancellation proof were supplied.

The leaf completed through leaf-launch.sh, confirmed by drain-poll-leaves.py. Wall and active review elapsed including arbitration: 183.640 seconds. Known non-overlapping waits: quota 0, dependency 0, release 0, other 0. No parallel-duration summation.

Raw counts: blocker 0, should-fix 0, nit 0. Opened none, resolved I1. Adopted plan-level corrections r2=0. Unique totals: opened 1, resolved 1, open 0. Carried 0, Skip 0, Defer 0, arbiter nits 0. No inherited history, withdrawal, rewrite, split or correction-introduced defect. Implementation and downstream rework have not begun.

| ID | Disposition and closure | Evidence | Remaining obligation |
| --- | --- | --- | --- |
| I1 | Fix, closed_round 2 | review-plan explicitly reports I1 CLOSED against r2 body:102 and verifies sqlite_cancellation.rs:485 with repository.rs:531. Root confirms the exact file-list and carrier-acquisition correction. | No open plan issue. Compilation and native runtime witnesses remain execution obligations O2–O3. |

#### plan r2

```text
I1 CLOSED — r2 plan `tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r2.body.md:102` includes `sqlite_cancellation.rs` and requires shared-carrier acquisition while preserving cancellation. The caller at `src-tauri/src/db/sqlite_cancellation.rs:485` matches the factory at `src-tauri/src/db/repository.rs:531`. All traced factory callers are now in scope (confidence: 98).

Limitation: compiler and platform runtime proofs were not run during this read-only review (confidence: 100).

VERDICT: APPROVED
```

### Final planner state

Completed rounds 2, measured review wall time 694.998 seconds, adoptions r1=1 r2=0. All 12 plan-capable lenses covered, with 13 completed leaf reports. The sole blocker was source-confirmed, corrected and explicitly closed in r2. No unresolved or carried review issue. Mandatory implementation proof and native platform CI remain pending because this run stops before Preflight.

The full record is copied to tasks/plans/reviews-handoff.md for the supervisor to publish with the plan. The adopting run must load it before review, preserve I1's witness and closure history, record the autonomous technical decisions in tasks/decisions.md, and promote the review history to a tracked tasks/handoffs/2026-10-09-f-20261001-02-review.md before closing the finding. No ledger, tracked source, commit, push or installation belongs to this planning run.


### Round 3 — PLAN-REFRESH drift at 8bccb79c

Refresh resumed on 2026-10-10 with the approved r1–r2 plan and a clean checkout. There was no uncommitted source work to preserve or completed implementation to close in the ledger. The explicit PLAN-REFRESH no-writer contract governs this lane. Original plan, metadata, handoff and verified 13-row review manifest were preserved under RUN_TMP/refresh-8bccb79c-seed before any update. The prior record below the Reviews heading remains byte-identical as this round is appended.

Original base: ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. New base: 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee. Source drift: RUN_TMP/drift-ca0ab68689e0f4de8ca0b84df2be29963bcfc66c-8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee.diff, exactly the process-generated git diff, root-confirmed sha256 a823133fe4b3fed024291ec48937a89e23675415a527790ce65e837e98ce81f0. The strict drift scope requires each finding to name a changed path or symbol and the invalidated O1, O2 or O3 obligation.

Tier revalidation retained build. Root confirmed the changed search context still uses the ordinary preferred sidecar File at db/search.rs:322, and the legacy File and clone at db/search_index.rs:908. Export still resolves its ordinary destination before obtaining its database connection at db/mod.rs:3587–3594. Bound SQLite, the repository and generic filesystem ownership code are unchanged by this drift. The cross-kind protection is therefore still an unimplemented coordinated ownership design. No new mechanism or acceptance contract was adopted.

Candidate: RUN_TMP/plan-r3.md, with tasks/plans/.plan-2026-10-09-cross-capability-sqlite-locks.md-r3.body.md. Plan delta: tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r3.diff. Its changes update the current base, relocated citations, existing decision context and planner-mode wording. Root inspected the full delta before launch. Every prompt included both full SHAs, the production drift file, fixed MANDATE, complete prior history, current decision excerpts, named rules and pending implementation proofs.

All twelve REFRESH-LENSES ran exactly once through leaf-launch.sh in parallel. Codex was the selected executor, with role review-plan for plan and sensitive for the other lenses. Every report has a confirmed completed terminal marker and an APPROVED verdict. Plan authorship and arbitration shared one root context. Detection ran on the same Codex model family selected for implementation, with session separation and no family separation.

Wall and active review elapsed including arbitration: 207.604 seconds. Leaf-completion interval: 190.124 seconds. Known non-overlapping waits: quota 0, dependency 0, release 0, other 0. Ordinary polling while leaves worked is review elapsed. Parallel leaf durations are not summed.

Raw counts: blocker 0, should-fix 0, nit 0. New issues 0, adoptions r3=0, carried 0, Skip 0, Defer 0, arbiter nits 0. I1 remains closed in r2, confirmed again by the r3 plan lens. No reopening, withdrawal, rewrite, split or correction-introduced defect. No source implementation or downstream rework. Findings-ledger check passed read-only: 515 findings, 167 pickable, 3 blocked. No out-of-drift defect was reported or filed.

Raw r3 outputs follow unchanged.

#### chess-semantics r3

```text
No chess-domain findings in the r3 delta or production drift that invalidate O1–O3. O2 preserves setup construction, position matching, continuation handling and repertoire cache semantics.

Read-only review. No runtime proofs run.

VERDICT: APPROVED
```

#### correctness r3

```text
No correctness defect found within the r3 drift scope. The changed search/index paths remain covered by O2, and export still exercises the reverse acquisition order covered by O1.

Limitation: carrier implementation, drop ordering and native lock/platform behavior remain unverified in this read-only plan review (confidence: 100).

VERDICT: APPROVED
```

#### engine-protocol r3

```text
NOT APPLICABLE: The r3 delta preserves O1–O3 ownership obligations. Production drift changes database search, progress, setup and cache behavior, with no changes to engine supervision, UCI sequencing or asynchronous engine-result routing that invalidate those obligations.

VERDICT: APPROVED
```

#### error-handling r3

```text
No error-handling drift invalidates O1–O3. The refresh preserves typed conflicts, native I/O errors, cancellation and intentional best-effort progress diagnostics.

Limitation: implementation and native lock/platform runtime proofs remain pending (confidence: 100).

VERDICT: APPROVED
```

#### ipc-contract r3

```text
No IPC-contract findings in the r3 delta or production drift that invalidate O1–O3. Progress remains Specta-registered, with matching operation identity, generation and percentage units. Command signatures and capability scopes are unchanged.

VERDICT: APPROVED
```

#### minimalism r3

```text
No bloat or duplication defects found within the r3 refresh scope. The drift leaves O1–O3 necessary. The shared ownership module still has multiple concrete consumers, and O2 preserves the changed domain semantics without adding deliverables.

VERDICT: APPROVED
```

#### persisted-state r3

```text
NOT APPLICABLE: The plan delta and production drift affect backend inode ownership, database semantics, transient progress and repertoire caches. They change no renderer storage keys, persisted atoms, hydration or tab lifecycle. O1–O3 introduce no persisted renderer-state contract.

VERDICT: APPROVED
```

#### pgn-index r3

```text
No PGN/index defects found within the r3 drift scope. O2 preserves the changed setup, search cancellation, cache predicates and stored index format while covering both sidecar open paths and PGN export ordering.

Runtime and platform proof remain pending under O3. No files changed or gates run.

VERDICT: APPROVED
```

#### plan r3

```text
No drift-scoped plan defects found. The changed search paths introduce no omitted ownership-carrier consumer and do not invalidate O1–O3. I1 remains closed.

Limitation: compilation, native lock witnesses and platform runtime proofs were not run in this read-only review (confidence: 100).

VERDICT: APPROVED
```

#### platform-semantics r3

```text
No platform-semantics findings within the r3 drift scope. The changed paths do not invalidate O1–O3.

Verification remains pending. Neither `pnpm rust:windows:check` nor the non-Linux Unix source probe ran in this review. Runtime proof requires pushed-head `rust-macos-test` and `rust-windows-test`. The `rust-platform` matrix provides compilation and Clippy evidence only.

VERDICT: APPROVED
```

#### tauri-security r3

```text
No in-lens drift defects found that invalidate O1–O3. Changed progress diagnostics remain native through `src-tauri/src/progress.rs:451` and the log targets at `src-tauri/src/main.rs:1981`.

Limitation: this is a read-only plan review. Native lock witnesses and macOS/Windows runtime evidence remain mandatory execution proofs.

VERDICT: APPROVED
```

#### tests r3

```text
No drift-induced verification gaps found. O1–O3 retain external SQLite lock assertions, ownership/drop/retry witnesses and mandatory compiled red/green withdrawal evidence. The phase command includes the new consumer regressions, and native CI jobs run all Rust targets.

Limitation: implementation and platform runtime proof remain pending. Drift records unavailable GitHub Actions execution, so O3 cannot be declared complete until exact-SHA CI succeeds (confidence: 100).

VERDICT: APPROVED
```

### Final refresh state

Completed cumulative rounds 3, review wall time 902.602 seconds, adoptions r1=1 r2=0 r3=0. This refresh added one drift round and 12 completed leaf reports to the inherited two rounds and 13 reports. Unique issues opened 1, resolved 1, open 0. I1's original witness, correction and r2 closure are preserved unchanged in metadata. There are no carried or deferred review obligations.

The reviewed ownership plan stands at NEW-BASE 8bccb79ce0fd37b7ab8b60875b99e5a4b1b5e5ee. Implementation, Git-derived red/green lock witnesses and exact-SHA native platform CI remain mandatory for the adopting run. The planner stops before Preflight. The supervisor owns publication, and the adopter records the existing autonomous decisions and promotes this full history to a tracked handoff before closing f-20261001-02. No new autonomous design decision reverses a precedent in this refresh.

### delta-r2.txt

ROUND: 2
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r2.diff
REVISED:
## Traced premises
## Phases > ### Phase 1 — shared inode ownership and capability consumer migration
SETTLED:
# Plan: preserve SQLite locks across capability aliases
## Goal
## MANDATE
## MANDATE > ### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it
## Threat model and non-goals
## Approach
## Approach > ### O1 — one inode admission and close boundary
## Approach > ### O2 — open safely and carry ownership through consumers
## Approach > ### O3 — behavior, failure and platform witnesses
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r3.txt

ROUND: 3
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-0/wt/tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r3.diff
REVISED:
## Goal
## Traced premises
## Phases > ### Phase 1 — shared inode ownership and capability consumer migration
SETTLED:
# Plan: preserve SQLite locks across capability aliases
## MANDATE
## MANDATE > ### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it
## Threat model and non-goals
## Approach
## Approach > ### O1 — one inode admission and close boundary
## Approach > ### O2 — open safely and carry ownership through consumers
## Approach > ### O3 — behavior, failure and platform witnesses
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r4.txt

ROUND: 4
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/.plan-delta-2026-10-09-cross-capability-sqlite-locks.md-r4.diff
REVISED:
## Goal
## Traced premises
## Approach > ### O1 — one inode admission and close boundary
## Approach > ### O2 — open safely and carry ownership through consumers
## Approach > ### O3 — behavior, failure and platform witnesses
## Decided autonomously
## Not part of this task
SETTLED:
# Plan: preserve SQLite locks across capability aliases
## MANDATE
## MANDATE > ### A database inode authorized under a second capability kind can be opened and closed lockably while a game-database pool holds SQLite locks on it
## Threat model and non-goals
## Approach
## Decisions and trade-offs
## Risks / open questions
## Phases
## Phases > ### Phase 1 — shared inode ownership and capability consumer migration
## Carried to diff review
