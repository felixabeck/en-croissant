# SQLite pathname open (f-20260912-07, f-20260929-01) — plan review record

Scope: cluster `sqlite-pathname-open` — bind every SQLite open of an authorized database (the
repository pool and the identity probe's `read_revision`) to the retained authorized parent
descriptor and the authority-bound leaf inode. Plan (ignored run artefact):
`tasks/plans/2026-09-29-sqlite-bound-vfs.md`. This tracked record preserves the complete issue
and round history so that the plan, its snapshots and the lens reports under `/tmp` may disappear.
Governing decisions: `d-20260929-01`, `d-20260929-03`; decisions recorded by this run are named in
the findings' closing notes.

## Lineage and run facts

* Picked by `/next-finding --pin f-20260912-07 full auto` in drain session
  `1af0f1fc-ab06-4981-9a3d-47a89d71c541` (drain run `fe3f6a25-fb43-4a79-b22a-8795670316d1`),
  2026-09-29. Both members filed at `build`; the live open question was the one recorded in
  `f-20260912-07`'s reopen annotation (shared with `f-20260929-01`).
* Orchestrator: Claude Code (Opus 5.5). Executor: Codex (`review-plan` role for the plan lens,
  `sensitive` for every other lens and for the implementation phase). Plan authorship and
  arbitration shared one context; detection ran in separate Codex processes of a different model
  family.
* Locate was done in the orchestrator with measurements (rule 12b), all in the disposable probe
  `/tmp/vfsprobe` (libsqlite3-sys `=0.25.2` bundled = SQLite 3.39.2) and Python probes:
  `/proc/self/fd/<parent>` naming is resolved back to a pathname by `unixFullPathname`; the
  syscall-hook + bound-VFS mechanism keeps sidecars in the held directory across parent renames
  and refuses a swapped leaf; `ctor` install runs before `main`; a per-binding VFS refuses
  foreign tokens (`xAccess` → 3338); DELETE→WAL conversion opens `-journal` with create flags;
  `faccessat(AT_SYMLINK_NOFOLLOW)` never follows; the percent-encoded `/<cfbound>/` prefix works.
* Plan review: 11 completed rounds, no rewrite, no split, no pauses. Per-round wall time (plan
  snapshot to last report): r1 26 min (8 lenses), r2 22 (7), r3 24 (7), r4 37 (6), r5 29 (6),
  r6 30 (6), r7 32 (6), r8 24 (5), r9 71 (5), r10 43 (5), r11 26 (2); total ≈ 6 h 05 min between
  05:59 and 12:24 CEST. Waits are not separable from active review (polling is review time).
* `plan_adopted_per_round`: r1=11 r2=11 r3=6 r4=5 r5=7 r6=5 r7=4 r8=5 r9=6 r10=1 r11=0
  (adoption counts, including withdrawals adopted as corrections: P5 withdrew N6; V4 withdrew U1's
  creation case and W5 reversed V4 by measurement).
* Unique issues: 72 (R1–R11, N1–N12, P1–P8, Q1–Q5, S1–S8, T1–T6, U1–U6, V1–V5, W1–W7, X1–X3).
  Skip: N10, P3, S3, T4, U4, X2, X3. Defer (filed): U5, W4, and N6/P5 (FIFO, withdrawn and filed).
  Open: 0.
* Correction-introduced defects: N2 (r1's fail-closed install broke Windows between phases); P1
  (R8's "restore in the next hook" was wrong); Q2 (P4's "report absent"); S1 (Q2 covered only
  unprefixed names); S8/T6/U2/U6 (the super-journal refusal and shared VFS iterated through
  per-binding VFS, shared lifetime, one name per database); V1/V2/W3 (binding keying); W1 (V5's
  cleanup); W5 (V4's withdrawal was refuted by measurement); X1/X3 (prefix reservation).
* Final latest verdicts: plan r11 APPROVED; minimalism r10, tests r10, tauri-security r10
  APPROVED; error-handling r7 APPROVED; pgn-index r3 APPROVED; ipc-contract r1 APPROVED;
  correctness r11 REVISE (X3), closed by the arbiter with trace evidence (rule 12a).

## Successor ownership

Filed through the inbox spool while a drain held the ledger; ids are allocated at merge. None
inherits an open issue of this run; each carries its own open question.

* FIFO / non-regular `-shm` sidecar can block the identity probe — inbox
  `20260929-071945-307309-1790659185646737657-3` (`build`), from N6/P5/S3.
* r2d2 retries/logs a refused pooled open for 30 s without a database identifier — inbox
  `20260929-093457-1961181-1790667297378353979-3` (`lens`), from U5.
* Same-directory hard-link names share SQLite's `-shm` with separate `-wal` files — inbox
  `20260929-111342-2397783-1790673222462378910-3` (`build`), from W4.

A successor working any of these should load this record before its own plan review.

## Issues and rounds (verbatim from the plan's `## Reviews`)

### Round 1 (r1) — 8 lenses, Codex, all `--role sensitive` except `review-plan`

Raw verdicts: plan REVISE, minimalism APPROVED, correctness REVISE, tests REVISE, error-handling
APPROVED, pgn-index REVISE, tauri-security REVISE, ipc-contract APPROVED. Raw reports:
`$RUN_TMP/lens-*-r1.txt` (`/tmp/build-1af0f1fc-ab06-4981-9a3d-47a89d71c541`), preserved in the
tracked handoff.

| ID | Claim | Witnesses (lens#finding) | Disposition | Correction (r2) |
|---|---|---|---|---|
| R1 | `findReusableFd` stats the name and reuses a cached fd of whatever inode it reports, bypassing the open-only identity check | correctness#1 (99) | Fix | O1 "Leaf identity on every leaf-resolving hook": stat/lstat/access check identity, leaf unlink refused; new cached-descriptor test |
| R2 | First-use `xSetSystemCall` races other threads' SQLite use (unsynchronised table); "aligned store" rationale unsupported | correctness#2 (97), plan#3 (97), pgn-index#2 (97) | Fix | O1 "Install at load time": `ctor` constructor before `main`/test threads; fail-closed stored outcome; Risks rewritten |
| R3 | Parent-swap test swaps at `PreBuild`, which `entry()`'s final `open_current` rejects before any SQLite open; not red when reverted | plan#1 (99), tests#1 (99), error-handling#1 (99), pgn-index#1 (99) | Fix | New `BeforePoolGet` hook after the last probe; observe at `PostGet` while connection open |
| R4 | `-journal` claimed but not exercised; sidecar ops only checked by final presence | plan#2 (97), tests#3 (91) | Fix | Rollback-journal test; observation while connection open |
| R5 | Registry bound "MAX_OPEN_DATABASES" is false for active entries | plan#4 (98) | Fix | Retention wording: one binding per live entry + in-flight revision read |
| R6 | Phase 2 adds `rust:windows:check` / `rust-platform` beyond mandate | correctness#3 (94), error-handling#4 (95), pgn-index#4 (94), tauri-security#2 (96) | Fix (partial) | `rust-platform` dropped; `rust:windows:check` kept and cited as the push skill's required gate for `src-tauri/**` |
| R7 | Windows helper export redundant — `open_windows_child` already `pub(crate)` | minimalism#1 (99) | Fix | Phase 2 files |
| R8 | A→B→A test cannot restore A: with the binding `read_revision` fails before `AfterReadRevision` | error-handling#2 (98) | Fix | Unconditional restore (next hook invocation + drop guard) |
| R9 | Lazy pool open failure returns `Error::R2d2`, bypassing Conflict mapping and retirement; refusal-reason thread-local cannot work (r2d2 worker threads) | error-handling#3 (95), pgn-index#3 (95) | Fix | O2 error mapping by re-probe after `pool.get()`/establish failure; pool refusal mapping test |
| R10 | A→B→A revision test only on unix; Windows `CreateFileW` path not exercised against it | tests#2 (89) | Fix | Phase 2 tests run revision and parent-swap tests on Windows |
| R11 | Revision-read sidecars not covered by any parent-swap test | tauri-security#1 (99) | Fix | "Revision read, parent swap" test |

Measured for R9: r2d2 0.8.10 `add_connection` runs `manager.connect()` + customizer on its thread
pool and `get_timeout` returns `Error(internals.last_error)` after the timeout
(`~/.cargo/registry/src/*/r2d2-0.8.10/src/lib.rs:219-264, 418-442`). For R2: `ctor 0.2.7` present in
`Cargo.lock` via `tauri-utils` (`cargo tree -i ctor@0.2.7`).
Round 1 adopted: 11 (all Fix). Unique issues opened: R1–R11; closed: none yet.

### Round 2 (r2) — 7 lenses (plan, minimalism, correctness, tests, error-handling, pgn-index, tauri-security)

Raw verdicts: plan REVISE, minimalism REVISE, correctness APPROVED, tests REVISE, error-handling
APPROVED, pgn-index REVISE, tauri-security REVISE. Reports `$RUN_TMP/lens-*-r2.txt`.
Closure: R2 (install race) — correctness asked for an ordering probe: measured in `/tmp/vfsprobe`
with a `#[ctor::ctor]` install, output `installed before main: true` followed by the unchanged
T1–T4 results (Linux); macOS/Windows ordering is proven by the CI witnesses, which fail closed if
the constructor did not run. R3, R5, R6, R7, R8, R11 (unix) reported closed by their witnesses.
R1 and R4 reopened by tests (test strength) → N4/N3. R9 partial → N1. R10 → N2.

| ID | Claim | Witnesses | Disposition | Correction (r3) |
|---|---|---|---|---|
| N1 (R9) | A restored before the re-probe → original establish error (`InvalidInput`), not `Conflict` | plan#3 (95), error-handling#1 (92) | Fix | Per-binding refusal counter + one classification helper; transient-restore test |
| N2 (R10) | Windows witnesses need repository test hooks that are `cfg(all(test, unix))`; Phase 1 fail-closed binding breaks Windows until Phase 2 | plan#2 (97), pgn-index#2 (94) | Fix | Phase 1 binds unix only (Windows on pathname until Phase 2); Phase 2 widens the hooks to `cfg(test)` |
| N3 (R4) | No test observes unlink or opening an existing sidecar | plan#1 (97), tests#2 (98) | Fix | After-close unlink assertions; existing-WAL revision test; journal gone after commit |
| N4 (R1) | Cached-descriptor test does not force SQLite to park a descriptor | tests#1 (95), tauri-security#1 (95) | Fix | Second connection holds a shared lock while the first closes (`sqlite3.c:37605-37613`) |
| N5 | Pool swap test may reuse a connection opened before the swap | pgn-index#1 (98) | Fix | Fresh repository, database seeded without it |
| N6 | Planted FIFO sidecar can block the probe via the read-only `-shm` fallback | tauri-security#2 (91) | Fix | Regular-file check with `O_NONBLOCK`; FIFO test |
| N7 | Same re-probe/classification rule written twice | minimalism#1 (90) | Fix | One helper (see N1) |
| N8 | `lstat` hook unnecessary (only `unixFullPathname` calls it) | minimalism#2 (97) | Fix | Hook dropped; `sqlite3.c:41940` is the only `osLstat` call (grep) |
| N9 | Goal claims unlinking the main database | minimalism#3 (95) | Fix | Goal reworded |
| N10 | `-journal` extends the mandate | tauri-security#3 (98) | Skip | A hot journal is replayed into the database on open, so a journal outside the authorized parent changes what "read the authorized leaf" returns (MANDATE); reason stated at the test |
| N11 | Windows test obligation broader than required witnesses | correctness#2 (96) | Fix | Phase 2 names exactly the required witnesses |
| N12 | Install ordering unproven | correctness#1 (97) | Fix (evidence) | Linux probe above; other platforms by CI witnesses, fail closed |

Round 2 adopted: 11 (N1–N9, N11, N12). Open: N1–N12 pending r3 closure.

### Round 3 (r3) — 7 lenses

Raw verdicts: plan REVISE, minimalism APPROVED, correctness APPROVED, tests REVISE, error-handling
APPROVED, pgn-index APPROVED, tauri-security REVISE. Reports `$RUN_TMP/lens-*-r3.txt`.
Closed in r3 by their witnesses: N2 (phasing part), N3, N4, N5, N7, N8, N9, N11; N12 on Linux
(macOS/Windows by CI witnesses). N10 Skip unchallenged (tauri-security, error-handling confirm).

| ID | Claim | Witnesses | Disposition | Correction (r4) |
|---|---|---|---|---|
| P1 | A→B→A test restores A only in the next `AfterOpenCurrent`, which runs after `open_current` already failed on B → `Conflict` even with pathname opens; not red today | plan#1 (99) | Fix | Restore in `AfterReadRevision` (pathname path) + refusal-path hook + drop guard |
| P2 (N2) | Windows witnesses have no Windows-capable fixture: `for_test_path` and `repository::tests` are unix-gated | plan#2 (97), tests#1 (98) | Fix | Phase 2 widens `for_test_path`/`test_target` (platform-neutral `acquire_target`) and adds a `cfg(test)` witness module |
| P3 (N1) | Shared per-binding counter misattributes a concurrent refusal to another caller's unrelated `pool.get()` failure | plan#3 (94), error-handling#1 (92) | Skip | `read_revision` owns its binding exclusively (one per call), so there the counter is exact. For the pool, r2d2 itself reports one pool-wide `last_error` to every waiting caller (`r2d2-0.8.10/src/lib.rs:256, 442`), so no per-caller attribution exists to preserve; and a refusal during the call is direct evidence the authorized name did not denote the authorized object during that call — the `Conflict` condition. `retire_after_probe_conflict` retires only when `active == 0`, so a busy entry is not torn down. |
| P4 | Hostile hot-journal super-journal path is accessed/opened/deleted outside the parent through the pass-through | tauri-security#1 (99) | Fix | Bound VFS `xOpen`/`xAccess`/`xDelete` refuse unprefixed names; direct-VFS escape test |
| P5 (N6) | FIFO/non-regular sidecar policy is outside the mandate; unmeasured | correctness#1 (94), minimalism#1 (84), plan limitation | Fix (withdraw) | N6 correction withdrawn; filed as inbox `20260929-071945-307309-1790659185646737657-3` (`build`, open question) |
| P6 | FIFO refusal reason lost in error mapping | error-handling#2 (86) | Withdrawn with N6 | — |
| P7 | Transient-restore test duplicates the A→B→A test | minimalism#2 (82) | Fix | Merged into one test (P1) |
| P8 | Pool refusal case leaves B installed, so the counter path of `acquire_probed` is untested | tests#2 (96) | Fix | Pool case restores A in the refusal hook before classification |

Round 3 adopted: 6 (P1, P2, P4, P5, P7, P8). Open: P1, P2, P4, P7, P8 pending r4 closure; P3 Skip.

### Round 4 (r4) — 6 lenses (plan, minimalism, correctness, tests, error-handling, tauri-security)

Raw verdicts: plan (see below), minimalism REVISE, correctness REVISE, tests APPROVED, error-handling
REVISE, tauri-security REVISE. Reports `$RUN_TMP/lens-*-r4.txt`. Closed by witnesses: P1, P2, P4
(mechanism; its `xAccess` result corrected as Q2), P5, P7, P8 (tests, tauri-security); P3 Skip
upheld by tests and tauri-security.

| ID | Claim | Witnesses | Disposition | Correction (r5) |
|---|---|---|---|---|
| Q1 | Sidecar names are resolved following symlinks; a planted `-wal`/`-journal` symlink reads a file outside the parent | correctness#1 (99), tauri-security#1 (92) | Fix | O1 "No symlinks under the parent": no-follow open/stat/access for every bound name; symlinked-sidecar test |
| Q2 (P4) | Reporting an unprefixed super-journal as absent makes `pager_playback` finalize a hot journal without rollback → partially committed data visible | correctness#2 (98), error-handling#1 (95) | Fix | `xAccess` returns `SQLITE_IOERR_ACCESS`; source trace `sqlite3.c:56637-56643, 56780-56795` |
| Q3 | Parent-swap setup duplicated; `replace_parent_with_same_inode_hard_link` already exists | minimalism#1 (87) | Fix | Promote the existing fixture; one sidecar-observation helper |

Round 4 adopted: 3. Open: Q1–Q3 pending r5 closure.

review-plan r4 (arrived after the table above): REVISE — P1, P4, P5, P7 closed; P3 Skip upheld.

| ID | Claim | Witnesses | Disposition | Correction (r5) |
|---|---|---|---|---|
| Q4 (P2) | Phase 2 writes `path_authority/mod.rs`, which the lens input FILES marked read-only | plan#1 (99) | Fix | The lens packet's FILES list was stale; r5 input lists `path_authority/mod.rs` as written (fixture visibility in Phase 1, `for_test_path` gate in Phase 2). The plan text already names both. |
| Q5 (P8) | Pool refusal test: restoring A in the refusal hook lets r2d2's retry succeed, so the classifier never runs, and with the binding reverted `post_get_probe` returns `Conflict` anyway — passes both ways | plan#2 (98), r2d2 `lib.rs:272-278, 436-442` | Fix | B is a rollback-mode database left in place; A restored by a `PoolGetFailed` hook after `pool.get()` errs; assert `Conflict`, retirement, and B's `journal_mode` unchanged (never opened) |

Round 4 adopted total: 5 (Q1–Q5).

### Round 5 (r5) — 6 lenses (plan, minimalism, correctness, tests, error-handling, tauri-security)

Raw verdicts: plan REVISE, minimalism APPROVED, correctness (see below), tests REVISE,
error-handling REVISE, tauri-security REVISE. Closed by witnesses: Q2 (non-prefix case), Q3, Q4;
Q5 closed for tests, reopened by plan as S5. P3, N10 Skip upheld.

| ID | Claim | Witnesses | Disposition | Correction (r6) |
|---|---|---|---|---|
| S1 (Q2) | A prefixed but unresolvable name reaches `unixAccess`, whose failed `stat` becomes `SQLITE_OK`/`res=0` ("absent") → unsafe hot-journal finalization | error-handling#1 (91), tauri-security#1 (98) | Fix | Bound VFS refuses unresolvable prefixed names before delegating; `xAccess` → `SQLITE_IOERR_ACCESS`; escape test extended |
| S2 (Q1) | `access` = no-follow `fstatat` then `faccessat` re-resolves → swap-to-symlink window | tauri-security#2 (93) | Fix | Single `faccessat(AT_SYMLINK_NOFOLLOW)`; measured (see O1) |
| S3 (N6/P5) | Non-regular (FIFO) sidecar can block the probe | tauri-security#3 (91) | Skip | Re-raise of P5 without new evidence; P5 withdrew it under the adoption gate (no MANDATE obligation fails — a FIFO causes a hang, not a mixed identity or an out-of-parent sidecar) and it is filed as its own `build` finding (inbox `20260929-071945-307309-1790659185646737657-3`) |
| S4 (Q1) | Unix symlink witness is not red on revert (SQLite already passes `O_NOFOLLOW`, `sqlite3.c:41660-41676`); no Windows reparse-point witness although `winOpen` follows links | plan#1 (99), tests#1 (96) | Fix | Unix: direct hook-level regression guard; Windows: symlinked `-wal` carrying a revision bump, red on revert |
| S5 (Q5) | Pool refusal test may run on a warm pool and never reach `PoolGetFailed` | plan#2 (99) | Fix | Fresh repository for every pool witness; assert the hook ran |
| S6 | Phases 1 and 2 overlap in files | plan#3 (96) | Fix | Merged into one phase (also removes the temporary Windows pathname branch) |
| S7 | No witness opens an existing hot journal after a parent swap | tests#2 (94) | Fix | Crashed-writer copy fixture; bound open must roll back |

Round 5 adopted: 6 (S1, S2, S4–S7). S3 Skip.

correctness r5 (arrived last): REVISE — #1 is S2 (already corrected in r6).

| ID | Claim | Witnesses | Disposition | Correction (r6) |
|---|---|---|---|---|
| S8 | A hot journal can name another registered token's file as its super-journal; `pager_delsuper` opens and may delete it (another database's `-wal`) | correctness#2 (93) | Fix | Bound VFS `xOpen` refuses `SQLITE_OPEN_SUPER_JOURNAL`; open precedes delete in `pager_delsuper`; escape test extended |

Round 5 adopted total: 7 (S1, S2, S4–S8).

### Round 6 (r6) — 6 lenses

Raw verdicts: plan APPROVED, minimalism APPROVED, error-handling APPROVED, correctness REVISE,
tests REVISE, tauri-security REVISE. Closed by witnesses: S1, S4, S5, S6, S7 (open witness),
S2 (plan, correctness); S3, P3, N10 Skip upheld by plan and tauri-security.

| ID | Claim | Witnesses | Disposition | Correction (r7) |
|---|---|---|---|---|
| T1 | Rollback-journal parent swap not witnessed through `read_revision` (read-only hot-journal path) | tauri-security#1 (97) | Fix | Hot-journal witness (a) through `read_revision` |
| T2 (S7) | Hot-journal witness unix-only; `-journal` held-parent placement and unlink unobserved | tests#1 (96) | Fix | Witness on all platforms; (b) asserts journal removed from held dir, never in replacement |
| T3 | Windows hooks' `GetLastError` semantics unspecified; `winAccess` treats not-found as absent | error-handling#1 (86) | Fix | O3 error-code rule: absence only for genuinely absent names; refusals set non-absence errors; reparse sidecar reported existing, open fails |
| T4 (S2) | No regression anchor for the access check-then-use race | tests#2 (93) | Skip | The corrected hook is a single `faccessat(AT_SYMLINK_NOFOLLOW)` call, so no window exists to anchor; the static-symlink hook test pins the no-follow property. A test that fails on a two-call reimplementation would have to scan source, which this repository's history shows costs more than it protects (auto-memory: source-scan tests, f-20260830-06). |
| T5 | Registry witness duplicates the escape matrix | minimalism#1 (84) | Fix | Escape matrix uses a dropped token; registry witness trimmed |
| T6 (S8) | Shared VFS: a hot journal naming another binding's absent `-wal` as super-journal gets "absent" from `xAccess` → rollback skipped | correctness#1 (99) | Fix | One VFS per binding, restricted to its own token; `Arc` lifetime via custom r2d2 manager wrapper; escape and lifetime witnesses |

Round 6 adopted: 5 (T1, T2, T3, T5, T6). T4 Skip.

Measured for T6 (after r7 launch, `/tmp/vfsprobe`, SQLite 3.39.2): a `#[repr(C)]` per-binding VFS
(`cfb-7`, copy of `unix` + token, own `xOpen`/`xAccess`/`xDelete`) — own-token write OK with
`-wal`/`-shm` in the held dir; foreign-token open `rc=14`; `xAccess` on a foreign-token name
`rc=3338` (`SQLITE_IOERR_ACCESS`); `xAccess` on an own absent sidecar `rc=0 res=0`; after
`sqlite3_vfs_unregister`, `sqlite3_vfs_find("cfb-7")` is null.

### Round 7 (r7) — 6 lenses

Raw verdicts: plan REVISE, correctness REVISE, minimalism APPROVED, tests APPROVED, error-handling
APPROVED, tauri-security APPROVED. Closed by witnesses: T1, T2, T3, T5; T6's cross-token refusal
(its lifetime/naming reopened as U2/U6). T4, S3, P3, N10 Skip upheld by all six.

| ID | Claim | Witnesses | Disposition | Correction (r8) |
|---|---|---|---|---|
| U1 | Journal *creation* is witnessed only without a parent swap | plan#1 (98) | Fix | Journal creation/removal case now runs after a parent swap |
| U2 (T6) | Dropping `BoundDatabase` removes the registry entry while connections (holding only the VFS `Arc`) still need path resolution (`fileHasMoved`, close-time unlink) | plan#2 (97) | Fix | One shared registration owns registry entry + VFS; connections hold it; binding-lifetime witness exercises SQL and close-time unlink after the handle drops |
| U3 | `portable_tests` is private; the fixture is unreachable from `db` tests | plan#3 (96) | Fix | Fixture moves into a `cfg(test) pub(crate)` support module |
| U4 | Blanket `SQLITE_OPEN_SUPER_JOURNAL` refusal is redundant with the per-token VFS | minimalism#1 (90, nit) | Skip | Not redundant: a hot journal may name the binding's **own** `-wal` as super-journal; the own-token `xAccess` says it exists, `pager_delsuper` opens it, parses it as a child-journal list and, finding no child pointing back, deletes it — losing uncheckpointed WAL frames (`sqlite3.c:56341-56385`). Only the open refusal stops that. |
| U5 | Refused pool opens are retried/logged at error level for 30 s without a database identifier | error-handling#1 (89) | Defer | Pre-existing r2d2 behaviour for any establish failure, not a MANDATE obligation; filed as inbox `20260929-093457-1961181-1790667297378353979-3` (`lens`) |
| U6 (T6) | Per-call tokens give pool and `read_revision` different filenames; Windows keys `-shm` nodes by filename → second node's DMS lock → `SQLITE_BUSY` on a healthy probe | correctness#1 (97) | Fix | One binding per (parent identity, leaf identity, leaf name) via a weak map; one-name witness |

Round 7 adopted: 4 (U1, U2, U3, U6). U4 Skip, U5 Defer.

### Round 8 (r8) — 5 lenses (plan, correctness, minimalism, tests, tauri-security)

Raw verdicts: plan REVISE, correctness REVISE, minimalism APPROVED, tests APPROVED,
tauri-security REVISE. Closed by witnesses: U2, U3 (all), U6 for identical spellings (plan,
tests, minimalism). U4, U5, T4, S3, P3 (rechecked by plan after U6), N10 upheld.

| ID | Claim | Witnesses | Disposition | Correction (r9) |
|---|---|---|---|---|
| V1 | Hard-link targets under different parents get separate bindings, but SQLite's unix VFS shares the per-inode record and `-shm` node; the second reuses the first's `-shm` from outside its parent and pairs it with its own `-wal` | correctness#1 (97) | Fix | Binding keyed by leaf identity; cross-directory concurrent binding → `Conflict`; recorded in Decided autonomously |
| V2 (U6) | Windows case-variant spellings of one file get different tokens → two `-shm` nodes → `SQLITE_BUSY` | plan#1 (92) | Fix | Same keying: same inode + same parent shares one binding regardless of spelling; witness extended |
| V3 | Read-only `read_revision` cannot checkpoint, so its post-close unlink assertion is unachievable | tauri-security#1 (97), `sqlite3.c:63840-63888` | Fix | Revision witness asserts held-only placement during and after; unlink proven by the pool witness |
| V4 (U1) | The DELETE-mode writer creation case exceeds the mandate: production never creates a rollback journal | plan#2 (94) | Fix (withdraw U1's correction) | Recurring dispute resolved by trace: `ConnectionOptions` sets WAL before any statement (`db/mod.rs:176-190`), `read_revision` is read-only; creation case removed, hot-journal witnesses stay |
| V5 | Identity weak-map cleanup unspecified | minimalism#1 (84, nit) | Fix | Last holder's drop removes its key |

Round 8 adopted: 5 (V1–V5, V4 as a withdrawal).

### Round 9 (r9) — 5 lenses (plan, correctness, minimalism, tests, tauri-security)

Raw verdicts: plan REVISE, correctness REVISE, minimalism APPROVED, tests APPROVED (should-fix),
tauri-security REVISE. Closed: V2, V3, V5 mechanism (correctness), V1 (correctness, minimalism,
tauri-security). Note: the r8 table's V1 correction said "keyed by leaf identity"; r10 refines the
key to (leaf identity, parent identity, leaf name) with a cross-directory inode check — see W3.

| ID | Claim | Witnesses | Disposition | Correction (r10) |
|---|---|---|---|---|
| W1 (V5) | Weak-map cleanup can remove a newer registration inserted by a concurrent acquirer (drop/acquire race), re-enabling a second live cross-directory binding | tauri-security#1 (96) | Fix | Compare-and-remove by token; deterministic stale-drop witness |
| W2 (V5) | No witness that the identity map entry is removed (dead `Weak`s could accumulate) | tests#1 (90) | Fix | Map-length assertion after last drop |
| W3 | Same-directory hard-link aliases sharing one binding break the surviving alias when the binding's leaf name is deleted | correctness#2 (89) | Fix | Same-directory hard-link names keep separate bindings; only Windows case variants of one entry share (name compared like the hook's case-insensitive open) |
| W4 | Same-directory aliases share SQLite's `-shm` while each derives its own `-wal`; plan has no safe-pairing witness | plan#2 (96) | Defer | Pre-existing SQLite hard-link hazard, identical with pathname opens; the binding keeps both sidecar sets inside the one authorized parent, which is all the MANDATE requires. Filed as inbox `20260929-111342-2397783-1790673222462378910-3` (`build`, open question). Rule 12a: correctness#2 and plan#2 pull in opposite directions, so the trace decides — see W3. |
| W5 (V4) | Journal creation is reachable: DELETE→WAL conversion in `ConnectionOptions` writes through a rollback journal | correctness#1 (99) | Fix (reverses V4) | Measured with the probe hook log (`OPEN …/d.db3-journal flags=0xa0042`); pool witness on a rollback-mode database with a per-binding test-only open log |
| W6 | Own-token leaf identity mismatch makes the delegated `unixAccess` answer "absent" → hot-journal super-journal check skips rollback | plan#1 (98) | Fix | Binding answers `xAccess` for its own names itself; identity mismatch → `SQLITE_IOERR_ACCESS`; escape matrix extended |
| W7 (V3) | Read-only close may still checkpoint and delete sidecars, so the after-close held-directory assertion is unreliable | plan#3 (89) | Fix | Held placement asserted while alive; after close only "replacement has none" |

Round 9 adopted: 6 (W1, W2, W3, W5, W6, W7). W4 Defer.

### Round 10 (r10) — 5 lenses (plan, correctness, minimalism, tests, tauri-security)

Raw verdicts: plan APPROVED, minimalism APPROVED, tests APPROVED, tauri-security APPROVED,
correctness REVISE. W1–W3, W5–W7 closed by plan, tests, minimalism, tauri-security; W4 Defer
upheld by plan, minimalism, tauri-security.

| ID | Claim | Witnesses | Disposition | Correction (r11) |
|---|---|---|---|---|
| X1 | The "reserved" prefix is not reserved: a real file at `/.cfbound/N/<leaf>` opened plainly by SQLite would be routed to the binding's parent while token N is live | correctness#1 (88) | Fix | Prefix `/<chessfable-bound>/`: root-owned on unix/macOS, illegal characters on Windows; URI percent-encoded; measured in the probe |
| X2 | Custom `ManageConnection` + wrapper duplicates the entry-owned lifetime; use the standard manager | minimalism#1 (88, nit) | Skip | Not a duplicate: r2d2 establishes connections on its worker threads (`r2d2-0.8.10/src/lib.rs:219-264`), and a worker mid-`connect()` holds an upgraded `Arc<SharedPool>` while the `DatabaseEntry` (and with it the entry-owned binding) can drop; only a per-connection `Arc` keeps the VFS and registry entry alive for that in-flight connection. The lifetime witness pins exactly that. |

Round 10 adopted: 1 (X1). X2 Skip.

### Round 11 (r11) — review-plan, correctness

Raw verdicts: plan APPROVED (X1 closed), correctness REVISE.

| ID | Claim | Witnesses | Disposition | Correction |
|---|---|---|---|---|
| X3 (X1) | `/<chessfable-bound>/` is creatable by root on unix/macOS; a root-run process with such a real file, plainly opened by SQLite, would be routed to a live binding | correctness#1 (88) | Skip | Recurring dispute (X1) → decided by trace (rule 12a): after this change the only production plain-path SQLite open is the puzzle snapshot's `NamedTempFile` in the temp directory (`repository.rs:417`); the pool (`:804`) and `read_revision` (`:540`) become bound; every other `establish` site is inside a test module (grep of `establish(`/`ConnectionManager::<` over `src-tauri/src`). A collision needs root to create `/<chessfable-bound>/<live token>/<leaf>` **and** a production plain open of it, which does not exist. The module doc now states that invariant (documentation only; no semantic or proof change, so no further lens round). |

**Closure (r11):** every issue R1–X3 carries a disposition; every adopted substantive correction
was closure-checked by `review-plan` and its witness lenses in a later round (final approvals:
plan r11, minimalism r10, tests r10, tauri-security r10, error-handling r7, pgn-index r3,
ipc-contract r1; correctness's last REVISE, X3, is rejected with trace evidence). Completed
rounds: 11. Deferred/filed from review: FIFO sidecar (inbox `…-1790659185646737657-3`), r2d2 log
noise (`…-1790667297378353979-3`), same-directory hard-link hazard (`…-1790673222462378910-3`).

## Implementation and cumulative diff review

* One phase (Codex write leaf, `sensitive`, resume thread `01a0ecb2-9c16-7c00-a214-745c6fa10e60`),
  12:25–13:50 CEST; fix round 1 (15 clippy lints) on the same thread. Committed as `9ea21bc0`.
  Red-on-revert confirmed by the implementer for the pool parent-swap, rollback-mode conversion
  journal, hot-journal pool recovery, pool refusal mapping, revision parent-swap, hot-journal
  revision, A→B→A and cached-descriptor witnesses.
* Cumulative review of `9ea21bc0` (8 Codex lenses): correctness, pgn-index — Windows
  `DeleteFileW` lacked `SYNCHRONIZE` (C1); code-quality — bare dispositions (C2), module-wide
  `allow(unexpected_cfgs)` (C3); minimalism — duplicated VFS shell (C4), `read_revision` wrapper
  (C5); root-cause APPROVED with Windows/macOS runtime pending (C6); tests — dangling-symlink test
  (C7), no concurrent-acquire test (C8), lifetime witness bypassed the pool (C9); tauri-security —
  FIFO `-journal` can block the probe (C10, **Defer**: same issue as the filed FIFO finding);
  error-handling — classifier dropped the probe's Io error (C11); orchestrator's full `cargo test`
  — `raw_device_is_read_once` red, a raw `st_dev` read outside the canonical helper (C12). All
  others **Fix** in `dcf0fb13`. The implementer's first C12 fix opened and closed the database leaf
  inside the `stat`/`access` hooks; the orchestrator rejected it (close() drops the process's POSIX
  locks, and `fileHasMoved` stats the leaf on write transactions) and specified the
  `raw_libc_stat_identity` sibling helper instead; the orchestrator added the pre-open identity
  check.
* Re-review of `dcf0fb13` (6 lenses): D1 synthetic size constant, D2 one matcher, D3 post-open
  mismatch still closed a foreign inode's descriptor (pgn-index, tauri-security), D4 zero-byte
  journal semantics, D5 lock-survival assertion, D6 Windows case folding differs from the kernel,
  D7 Windows delete opened with `FILE_SHARE_DELETE` — all **Fix** in `7512d2dc`. The orchestrator
  additionally removed `Weak::upgrade` liveness scans under the registry lock (latent re-entrant
  deadlock through `Registration::drop`).
* Re-review of `7512d2dc` (6 lenses): correctness APPROVED. Quarantine unbounded (pgn-index,
  tauri-security) and the `fstat`-failure branch still closes — the robust fix (Linux `O_PATH`
  verification + `/proc/self/fd` reopen; no macOS equivalent) is a same-area open design question,
  **Defer** to its own `build` finding (inbox `20260929-154918-796752-1790689758641451773-3`, Root
  `sqlite-pathname-open`); this run bounds the quarantine per inode. tests — integration witness
  for the post-open branch (E1), zero-byte journal never opened (E2), Windows rename-race anchor
  (E3); code-quality/minimalism polish (Q1–Q3) — **Fix** in the next repair commit.
* Additional successor: the O_PATH hardening finding above.
* Repair round 3 committed as `63d9ad1c` (quarantine cap of eight per inode; post-open branch,
  empty-journal and Windows rename-race witnesses; polish). Its re-review (5 lenses, after one
  launch was discarded because the prompt named a wrong SHA): tests, pgn-index, tauri-security
  APPROVED; code-quality APPROVED with a naming should-fix; minimalism REVISE for a duplicated
  test-hook setter — both applied in the follow-up refactor commit. No finding remains open in
  this run; Windows and macOS execution is proven by the CI run on the pushed commit.
* Decisions recorded: `d-20260929-04` (mechanism), `d-20260929-05` (cross-directory hard-link
  conflict).
