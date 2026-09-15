# macOS engine launch and removed held directory — plan review record

Durable record of the plan review for findings `f-20260914-31` (macOS engine launch through
`/proc/self/fd`) and `f-20260914-32` (removed held directory on APFS), required by rule 12a. The run
plan itself (`tasks/plans/2026-09-14-macos-engine-launch-and-removed-dir.md`, final revision r16) is
gitignored; this file carries its goal and the complete issue and round history so the review can be
recovered without it. Raw lens reports lived under `/tmp/build-macos-runtime/` and are ephemeral.

- **Mandate:** the Defect, Why it matters and Open question bullets of `f-20260914-31` and
  `f-20260914-32`, and Felix, 2026-09-14: „continue autonomously until everything is fixed … full auto“.
- **Probe evidence:** GitHub Actions runs 34871741087, 34872901465, 34875031951 (macOS runner).
- **Decisions:** recorded in `tasks/decisions.md` with this file as their review reference.

## Goal

Close `f-20260914-31` and `f-20260914-32`, the two defects that keep `rust-macos-test` red on
master (run 34869067618, `6ac915bb`: 1101 passed / 10 failed). Done means: engines launch on macOS
with file and directory resources; the executable and file resources keep the substitution
resistance the Linux arm has; a directory removed while it is walked is refused on macOS as on
Linux; the Test workflow — red today only on `rust-macos-test` — is green on the pushed master, and
no existing test is skipped or cfg'd out for these findings.

MANDATE (fixed across rounds): the `Defect`, `Why it matters` and `Open question` bullets of
`f-20260914-31` and `f-20260914-32` in `tasks/findings.md`, and Felix, 2026-09-14: "continue
autonomously until everything is fixed … full auto".

## Reviews

### Round 1 (revision r1) — six Codex lenses, all REVISE

Raw verdicts: review-plan REVISE · review-minimalism REVISE · review-tests REVISE ·
review-error-handling REVISE · review-engine-protocol REVISE · review-tauri-security REVISE.
Raw reports: `/tmp/build-macos-runtime/lens-*.txt` (ephemeral; promoted to the handoff at step 10).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R1-01 | Per-`setoption` resource recheck has no access to leases; runtime receives strings only (plan 99, error-handling 98, engine-protocol 98, tauri-security 93) | Fix | Verification must be lease-owned at the runtime send boundary |
| R1-02 | Pathname + identity recheck leaves a TOCTOU window; violates the pinning requirement of f-31 (engine-protocol 99, tauri-security 98) | Fix | Redesign around descriptor-sourced materialisation; measure `fclonefileat` first (rule 12b) |
| R1-03 | Negative test replaces before spawn, not before `setoption` (plan 95, tests 94) | Fix | Test must mutate after spawn and before the resource send |
| R1-04 | No spawned engine consumes a directory resource (plan 94, tests 97) | Fix | Add a live directory-resource engine fixture |
| R1-05 | No test removes the held directory during the walk (plan 93) | Fix | Use the existing per-entry hook |
| R1-06 | f-32 open question includes recursive-delete and install walks; plan deferred it (plan 96) | Fix | Answer inside this plan |
| R1-07 | `tasks/decisions.md` missing from FILES (plan 99) | Fix | Add |
| R1-08 | "Whole Test workflow green", "byte-for-byte", advisory cross clippy exceed mandate (minimalism 95, error-handling 99, engine-protocol 100, tauri-security 99, tests 95) | Fix (partial) | Drop byte-for-byte and advisory clippy from proof. Keep workflow-green: Felix's mandate "continue autonomously until everything is fixed" names the whole run, which is red only on this job |
| R1-09 | A's identity helper and B's predicate duplicate the path-vs-descriptor comparison (minimalism 89) | Fix | One helper |
| R1-10 | Removal predicate has one caller; inline (minimalism 96) | Fix | Superseded by R1-06 placement; decided in r2 |
| R1-11 | Resource-lease extraction repeated three times in chess.rs/game.rs (minimalism 99) | Fix | Rule 11, same files phase 2 edits |
| R1-12 | Duplicate path-authority lock/resolution wrappers chess.rs:63 / game.rs:1081 (minimalism 96) | Fix | Rule 11, same files |
| R1-13 | Target extraction repeated in file/directory branches of `engine_resource` (minimalism nit 94) | Fix | |
| R1-14 | CI never asserts the named tests ran on macOS (tests 99) | Fix | Orchestrator verifies each named test's `ok` line in the job log; no new checker (rule 6d) |
| R1-15 | No `ENOENT` regression anchor for the recheck (tests 94) | Fix | |
| R1-16 | No removal + same-name replacement test for the removal predicate (tests 94) | Fix | |
| R1-17 | Recheck must map `ENOTDIR` like `ENOENT` (error-handling 93) | Fix | |
| R1-18 | Proof must collect the post-push `rust-macos-test` result (error-handling 96) | Fix | |
| R1-19 | `F_GETPATH` primitive is Apple-only; plan scoped it to all non-Linux Unix (tauri-security 90) | Fix | Scope to `target_vendor = "apple"`, fail closed elsewhere |

Correction revision for all R1 issues: r2. Closure checks: round 2.

### Round 2 (revision r2) — six Codex lenses

Raw verdicts: review-plan REVISE · review-minimalism APPROVED · review-tests REVISE ·
review-error-handling REVISE · review-engine-protocol REVISE · review-tauri-security REVISE.
Raw reports: `/tmp/build-macos-runtime/lens2-*.txt`.

R1 closure results (per lens, raw): R1-01 closed (plan, minimalism, error-handling, engine-protocol,
tauri-security; tests partial) · R1-02 open (plan, engine-protocol, tauri-security: destination
leaf and directory pathname races; tests partial) · R1-03 closed (plan, error-handling,
tauri-security; engine-protocol partial: destination race untested) · R1-04, R1-05, R1-07, R1-09,
R1-10, R1-11, R1-12, R1-13, R1-14, R1-15, R1-16, R1-17, R1-18, R1-19 closed by every reporting lens
· R1-06 closed (plan, minimalism, error-handling, engine-protocol) / not closed (tauri-security:
recursive-delete rename-away) / partial (tests) · R1-08 partial with workflow scope disputed (plan,
tauri-security) / closed under its disposition (error-handling, engine-protocol, minimalism).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R2-01 | Materialised UUID leaf is a pathname a same-UID process can replace before spawn/open (plan 99, engine-protocol 99, tauri-security 98) | Skip (focused judgment) | Same-UID mutation of app-private state is outside the boundary the Linux arm defends (L1); judgment APPROVED, below |
| R2-02 | Apple directory resources remain pathname-based after `verify_current` (tauri-security 97) | Fix (record) | Judgment Q3 (a): keep the pre-send check, record the measured residual in `tasks/decisions.md` |
| R2-03 | Startup sweep can remove a concurrent instance's live leaves; no single-instance guard (error-handling 97, tauri-security 97) | Fix | A1 per-instance directory with `flock`; grep confirmed no single-instance plugin |
| R2-04 | `get_engine_config` spawn path not routed through A6 (engine-protocol 96) | Fix | Materialisation moved to `EngineRuntime::spawn`, reached by all four flows (traced); A6 lists all four |
| R2-05 | Report re-resolution: fresh Apple leases have no materialised path; restoration needs source identity (plan 95, engine-protocol 94) | Fix | Fresh leases never reach spawn; restoration compares recorded `VerifiedIdentity` (A4) |
| R2-06 | Partial leaf after create has no cleanup owner (error-handling 96, engine-protocol 95) | Fix | Guard owns the leaf from creation (A2) |
| R2-07 | Synchronous removal in `Drop` on async paths; failure only logged (error-handling 91) | Fix | One unlink handed to the gateway when a runtime is current; sweep bounds leftovers (A2) |
| R2-08 | Materialisation lacks a cancellation token and before/after checks (error-handling 91, engine-protocol 91) | Fix | Admission token threaded; checks before, per chunk, after, before `Command::spawn` |
| R2-09 | `getpath` absence errors must map to `NotFound` (error-handling 86) | Fix | B2 |
| R2-10 | Moving the check into the walker lets `NotFound` pre-empt cancellation (error-handling 85) | Fix | B2 cancellation precedence |
| R2-11 | Shared walker check does not stop recursive delete through a held child renamed out of the root (tauri-security 99) | Skip (orchestrator-verified) | `remove_tree_at` (`infra/fs.rs:1185-1293`) opens every child `NOFOLLOW` relative to a held parent, checks inode identity and mount crossing before descent, and unlinks by name relative to held descriptors. Renaming a held directory away changes where that directory lives, not which entries are reachable from it: every removed entry was already reachable from the authorized tree through that held descriptor, and links and special files are refused. Not introduced by this plan; removal detection was never the containment mechanism |
| R2-12 | `ensure_app_owned_default_dir` follows ancestor symlinks for the new root (tauri-security 96) | Skip (settled by f-20260905-10) | That open finding owns the ancestor window for every default root; annotated to include `EngineLaunch` |
| R2-13 | No real `ChildUciIo` assertion that a rejected lease sends no `setoption` (tests 94) | Fix | A7 |
| R2-14 | No recursive-delete removal-during-walk test (tests 98) | Fix | B3 |
| R2-15 | No seam replacing the source between descriptor acquisition and clone/copy (tests 92) | Fix | A7 |
| R2-16 | Workflow-green bar expands mandate (plan 97, tauri-security nit 96) | Skip (settled by R1-08) | No new evidence; Felix's instruction names the whole run |

Correction revision for adopted R2 issues: r3.

### Focused judgment (rule 12a) — recurring dispute R1-02 → R2-01/R2-02

- **Contested invariant:** does launching from an app-private materialised clone, and sending Apple
  directory resources as a verified canonical path, preserve f-20260914-31's pinning invariant as
  this codebase defines it?
- **Previous answers:** R1-02 (recheck window, adopted → r2); R2-01 (leaf replaceable by same UID);
  R2-02 (directory pathname race).
- **New evidence:** L1/L2 Linux probe; runner clone probe (run 34875031951); `/dev/fd` directory
  probe (run 34871741087); 0o700 root principals; registry path writable by the same user
  (`main.rs` setup `app_config_dir()/path-authority.json`); recorded attacker tests stage pathname
  substitution only; no single-instance plugin.
- **Judgment** (fresh-context `review-plan` leaf, `lens3-judgment`, role review-plan): Q1 no —
  same-UID mutation is outside the defended boundary; Q2 yes — L2-class substitution resistance;
  Q3 (a) — pre-send identity check plus recorded residual, refusal rejected; Q4 no substantive
  change. Raw verdict: **APPROVED** (confidence 94, limitation: no local macOS runtime).
- **Resulting obligations:** A2/A3 unchanged in mechanism; A3 and "Decisions" record the residual.

### Round 3 (revision r3) — six Codex lenses

Raw verdicts: review-plan REVISE · review-minimalism APPROVED · review-tests REVISE ·
review-error-handling REVISE · review-engine-protocol REVISE · review-tauri-security REVISE.
Raw reports: `/tmp/build-macos-runtime/lens4-*.txt`. No lens reopened R2-01, R2-11, R2-12 or R2-16.

Closure results (raw, abbreviated): R2-02 closed in text (all; decision record pending) · R2-03
closed (tests, error-handling, engine-protocol, tauri-security) / open (plan: launch context not
threaded) · R2-04 closed routing (all) / value handoff open (plan, engine-protocol, tauri-security) ·
R2-05 open (plan, tests, engine-protocol, tauri-security) · R2-06 closed (all) · R2-07 open (plan:
detached; error-handling, engine-protocol: nested gateway) / closed (tests, tauri-security) · R2-08
open (tests, engine-protocol) / closed (plan, error-handling) · R2-09 open (tests: no `ENOTDIR`
anchor) / closed (others) · R2-10 partial (plan, tests, error-handling) / closed (engine-protocol) ·
R2-13 open (tests: no-held-lease needs real child) / closed (others) · R2-14 open (tests: not
revert-distinguishing) / closed (others) · R2-15 closed (all).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R3-01 | Option values and resource provenance are built in `resolve_engine_options` before spawn, so spawn-time materialisation cannot reach them (plan 99, engine-protocol 99, tauri-security 99) | Fix | Split resolution: leases under the lock, materialise after unlock, then build values (r4 A2) |
| R3-02 | `EngineRuntime::spawn` has no path to the launch directory (plan 98) | Fix | Materialisation moves to the resolution helper, which reaches the authority (r4 A2) |
| R3-03 | `Drop` cleanup detaches a task with no owner (plan 93) and re-enters `BLOCKING_GATEWAY` from inside a gateway closure (error-handling 96, engine-protocol 89) | Fix | Owned cleanup on terminate through the gateway; inline unlink only on abnormal paths (r4 A2) |
| R3-04 | Walker/recursive-delete APIs take no token; external `remove_entry_at` callers not in FILES (plan 91) | Fix | Removal check becomes a shared post-walk function called by each consumer after its own cancellation check; no signature change to walkers (r4 B2) |
| R3-05 | Ordinary admissions carry no cancellation token; tab close/shutdown cancel the admission flag, so materialisation can proceed after cancellation (engine-protocol 96) | Fix | Admit before materialising; check `AdmissionLease::cancel_error()` (r4 A2), per engine-lifecycle "admit a spawn before its first asynchronous … wait" |
| R3-06 | No failure policy for sibling lock open/`flock` errors or sweep failures (error-handling 85) | Fix | Fail safe: only a proven-unlocked sibling is removed (r4 A1) |
| R3-07 | Engine-archive install at `src-tauri/src/fs.rs:1227` ignores cancellation and reports success (error-handling 97) | Skip (false positive, orchestrator-verified) | Cancellation is checked at `:1222` before the install; `atomic_install_download_dir` commits atomically, so a completed install reported as succeeded is truthful and aborting it midway would leave the partial tree the atomic contract forbids |
| R3-08 | Report identity test may fail earlier than the restore (tests 98) | Fix | Direct restore-level assertion (r4 A7) |
| R3-09 | Removal tests not revert-distinguishing; exact walker `NotFound` and same-name preservation required (tests 99) | Fix | r4 B3 |
| R3-10 | No cancellation test after materialisation / before `Command::spawn` (tests 94) | Fix | r4 A7 |
| R3-11 | No-held-lease test must use a real `ChildUciIo` (tests 93) | Fix | r4 A7 |
| R3-12 | Cancellation-precedence test not tied to a shared-walker caller (tests 95) | Fix | r4 B3 |
| R3-13 | No test for the Apple `ENOTDIR` branch (tests 91) | Fix | r4 B3 |
| R3-14 | No test that setup creates and injects the instance directory and lock (tests 90) | Fix | Extract the setup step into a testable function (r4 A1, A7) |

Correction revision for adopted R3 issues and the still-open R2-03, R2-04, R2-05, R2-07, R2-08,
R2-09, R2-10, R2-13 and R2-14 closure gaps: r4.

### Round 4 (revision r4) — five Codex lenses (minimalism omitted: approved r2 and r3, drove no r4 correction)

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling APPROVED ·
review-engine-protocol REVISE · review-tauri-security APPROVED.
Raw reports: `/tmp/build-macos-runtime/lens5-*.txt`. No lens reopened R2-01, R2-11, R2-12, R2-16 or
R3-07.

Closure results (raw, abbreviated): R3-01, R3-02, R3-04, R3-09, R3-12, R3-13, R2-09, R2-10, R2-13,
R2-14 closed (all reporting lenses) · R3-03 closed (plan, tauri-security) / partial (error-handling:
double cleanup; engine-protocol: inline `Drop` blocks) · R3-05 closed (plan, error-handling,
tauri-security) / open (tests: no ordering assertion; engine-protocol: not synchronized through
spawn) · R3-06 closed (plan, error-handling, engine-protocol, tauri-security) / open (tests) · R3-08
closed (error-handling, engine-protocol, tauri-security) / partial (plan: no identity data source;
tests: production call untested) · R3-10 open (plan: not atomic) / partial (engine-protocol) /
closed (tests, error-handling, tauri-security) · R3-11 closed (all) · R3-14 closed (plan,
error-handling, engine-protocol, tauri-security) / open (tests: wiring untested) · R2-03 closed /
partial (tests) · R2-04 closed / partial (tests: no config runtime test) · R2-05 open (plan) /
partial (tests) / closed (engine-protocol, tauri-security) · R2-07 closed / partial
(engine-protocol) · R2-08 closed / partial (engine-protocol).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R4-01 | Report path has no data source for the child-held `VerifiedIdentity`; restore gets string maps (plan 98) | Fix | `inherited_identities` recorded before the leases move (r5 A2) — superseded in r6 by R5-04 |
| R4-02 | Apple directory renamed away between positions keeps identity but the inherited path fails verification (plan 96) | Fix (specify) | Fail closed rather than send a path the engine cannot open; asserted (r5 A2, A7; r6 restated by R5-01) |
| R4-03 | Pre-spawn cancellation check is not atomic with process creation; "no child started" cannot hold (plan 97, engine-protocol 97) | Fix | Guarantee restated as the existing reap-the-late-actor contract (r5 A2 step 5, A7) |
| R4-04 | `PendingActorGuard::Drop` terminates through an untracked `tokio::spawn` that shutdown does not own (`engine/process.rs:1351-1363`, engine-protocol 91) | Defer (filed f-20260914-34) | Orchestrator-verified; pre-existing and outside MANDATE; owning pending-actor termination across shutdown is its own design question |
| R4-05 | Inline `unlinkat` in `Drop` on abnormal paths blocks a Tokio worker (engine-protocol 93) | Fix | `Drop` performs no filesystem work; every removal is explicit on an awaitable or already-blocking path (r5 A2) |
| R4-06 | `working_directory` is the original mutable pathname (engine-protocol 89) | Skip | Same on the Linux arm today; the working directory is not part of the pinning invariant, and a vanished directory fails the spawn rather than substituting anything |
| R4-07 | End-to-end report "resource changed between positions" test replaced by a helper test (tests 98) | Fix | Both tests (r5 A7; r6 keeps the end-to-end test) |
| R4-08 | Terminate removes leaves and `Drop` removes them again, logging `ENOENT` (error-handling 96) | Fix | Removal consumes the guards (r5 A2) |
| R4-09 | Tests do not prove `main.rs` wires the launch root into `PathAuthority` (tests 97) | Fix | Type-enforced: Apple production constructor requires `EngineLaunchRoot`; root-less constructors are test/non-Apple only (r5 A1; r6 extends to `open_with_clock`) |
| R4-10 | `get_engine_config` has no runtime launch test (tests 95) | Fix | r5 A7 |
| R4-11 | No test proves admission precedes resolution and pinning (tests 91) | Fix | Pre-cancelled admission with a resolution counter (r5 A7; r6 adds the empty-instance-directory assertion) |
| R4-12 | Sweep lacks flock/removal failure and continuation cases (tests 90) | Fix | r5 A7 |
| R4-13 | Multi-resource options: only single values tested (tests 88) | Fix | r5 A7 |
| R4-14 | Report-analysis helper failures after the progress lease starts could skip terminalization (error-handling 94) | Fix | Route the initial launch through `fail_analysis_progress_before_child` (r5 A2; r6 keeps per-position failures on `fail_analysis_progress!`, R5-08) |
| R4-15 | Recursive delete wraps the post-walk `NotFound` in `PartialRemoval` after progress (`infra/fs.rs:1824`, error-handling 96) | Fix | Orchestrator-verified; B3 assertion adjusted |
| R4-16 | `fclonefileat` needs a non-existent destination; "guard owns a leaf before any byte" is ambiguous (plan 89) | Fix | Reserve the name, create the entry only by clone or fallback (r5 A2) |

Correction revision for adopted R4 issues: r5.

### Round 5 (revision r5) — four Codex lenses (minimalism and tauri-security omitted: both approved r4 and drove no r5 correction)

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling APPROVED ·
review-engine-protocol REVISE.
Raw reports: `/tmp/build-macos-runtime/lens6-*.txt`. No lens reopened R2-01, R2-11, R2-12, R2-16,
R3-07, R4-04 or R4-06.

Closure results (raw, abbreviated): R4-03, R4-05, R4-08, R4-10, R4-12, R4-13, R4-15, R4-16 closed
(all reporting lenses) · R4-01 closed (plan, error-handling, engine-protocol) / partial (tests) ·
R4-02 open (plan, error-handling: fresh resolution fails before verification) / partial (tests) /
closed (engine-protocol) · R4-07 closed / partial (tests: not revert-distinguishing) · R4-09 open
(plan: `open_with_clock`) / closed (tests, error-handling, engine-protocol) · R4-11 closed / partial
(tests: pinning unobserved) · R4-14 closed (plan, error-handling) / open (engine-protocol:
post-publication failures misrouted) · R3-03, R3-06, R3-14, R2-03, R2-04, R2-07, R2-08 closed · R3-05,
R3-08, R3-10, R2-05 partial (tests) / closed (others).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R5-01 | A renamed-away Apple directory fails fresh resolution in `validate_target` with an I/O error before any `Conflict` mapping or `verify_current` (plan 97, error-handling 96) | Fix | Outcome restated: the report fails closed with the resolution error (r6 A2, A7) |
| R5-02 | `PathAuthority::open_with_clock` is a second public root-less constructor in the Apple build (plan 94) | Fix | Both root-less constructors gated `any(test, not(apple))`; its only other callers are tests (r6 A1) |
| R5-03 | Workflow-green bar expands mandate (plan 98) | Skip (settled by R1-08, R2-16) | No new evidence |
| R5-04 | Two-position report test is not revert-distinguishing: the authority rejects a replaced persistent resource before `restore_inherited_resource_provenance` (tests 98) | Fix | Orchestrator-verified (`PathAuthority::resolve` persisted-identity check); the redundant identity map is removed and the end-to-end test pins the per-position re-resolution (r6 A2, A7); R3-08's helper assertion is superseded with it |
| R5-05 | No deterministic seam for cancellation between pinning and spawn (tests 92) | Fix | Test-only seam (r6 A7) |
| R5-06 | Pre-cancelled admission test observes resolution but not pinning (tests 88) | Fix | Also assert the instance directory stays empty (r6 A7) |
| R5-07 | Stop deadline resets on every `info` line (`engine/process.rs:1747`, `:1842`; engine-protocol 99) | Skip (settled by f-20260911-03) | Already filed, open; outside MANDATE |
| R5-08 | Routing every report `resolve_launch` failure through `fail_analysis_progress_before_child` would skip terminating the already-published engine on later positions (engine-protocol 96) | Fix | Only the first-position launch uses the before-child path; later positions keep `fail_analysis_progress!` (r6 A2) |
| R5-09 | A fresh token for config/game admissions owns nothing after publication; an aborted config command leaves its probe registered (engine-protocol 93) | Fix + Defer (filed) | Flows without an operation token use `EngineSupervisor::admit` (r6 A2 step 1); the pre-existing probe left registered on command drop is filed as `f-20260914-35` |
| R5-10 | `kill_engine` checks only published actors, not pending admissions (`chess.rs:458`; engine-protocol 94) | Skip (settled by f-20260914-23) | Already filed, open; outside MANDATE |
| R5-11 | Unscoped Stop prefers the newest pending admission over the live actor (`engine/process.rs:1101`; engine-protocol 91) | Skip (settled by f-20260911-02) | Already filed, open; outside MANDATE |

Correction revision for adopted R5 issues: r6.

### Round 6 (revision r6) — four Codex lenses (minimalism and tauri-security omitted: both approved r4 and drove no r5/r6 correction)

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling REVISE ·
review-engine-protocol REVISE.
Raw reports: `/tmp/build-macos-runtime/lens7-*.txt`. No lens reopened R2-01, R2-11, R2-12, R2-16,
R3-07, R4-04, R4-06, R5-03, R5-07, R5-10 or R5-11.

Closure results (raw, abbreviated): R5-01, R5-02, R5-04, R5-05, R5-06, R5-08 and the carried R4-01,
R4-02, R4-07, R4-09, R4-11, R4-14, R3-05, R3-08, R3-10, R2-05 closed (plan, tests, error-handling,
engine-protocol) · R5-09 closed (error-handling, engine-protocol) / open (plan: `admit` is private) /
extra (tests).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R6-01 | The listing pre-stat hook runs before `statat`, so a removal there fails at the entry before the post-walk check; the listing and install tests have no deterministic path to the new assertion (tests 96, plan 97) | Fix | One test-only injection point after the `walk_directory` loop, shared by all three callers (r7 B3) |
| R6-02 | New tests are unnamed while post-push verification matches `... ok` lines (tests 90) | Fix | Required list derived from the pushed diff, per job (r7 "Verification after push") |
| R6-03 | `EngineSupervisor::admit` for config/game is outside the mandate (tests 88) | Skip | Admission before pinning is required by R3-05 and `engine-lifecycle.md`; `admit` is the admission those flows already get today, not new scope |
| R6-04 | Sweeping before the own lock is held — and any create-then-lock order — lets another instance's sweep remove a live instance (error-handling 95) | Fix | Own lock file created already locked with `O_EXLOCK` before its directory and before the sweep (r7 A1) |
| R6-05 | `start_game` has no construction owner after engine initialization (`game.rs:1380`; engine-protocol 98) | Skip (settled by f-20260908-02) | Already filed, open; outside MANDATE |
| R6-06 | Leaves are left to the sweep when `Command::spawn` fails after pinning, because the consumed executable's guards only log (engine-protocol 93) | Fix | `EngineRuntime::spawn` removes them on that failure (r7 A2 cleanup) |
| R6-07 | `rustix::fs::flock(LockExclusiveNonBlocking)` does not exist; rustix 1.1.4 names it `FlockOperation::NonBlockingLockExclusive` (plan 99) | Fix | r7 A1 |
| R6-08 | `EngineSupervisor::admit` is private to `engine/process.rs`; `chess.rs`/`game.rs` cannot call it (plan 98) | Fix | New `pub(crate) admit_for_launch` wrapper (r7 A2 step 1) |
| R6-09 | The new `UciIo` method names only `ChildUciIo` and `RecordingUciIo`; `FakeIo` and the three termination fakes would not compile (plan 96) | Fix | Required method without a default; every implementation named (r7 A4) |
| R6-10 | Atomic-install removal needs a per-entry `sync_tree` seam that does not exist (plan 95) | Fix | Covered by the shared post-walk injection point (r7 B3) |
| R6-11 | The claimed typed refusal for Unix targets other than Linux and Apple does not exist today (plan 94) | Fix | Refusal arm added by this plan, stated as new (r7 platform arms, B2) |

Correction revision for adopted R6 issues: r7 (this text).

### Round 7 (revision r7) — four Codex lenses (minimalism and tauri-security omitted: both approved r4 and drove no later correction)

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling REVISE ·
review-engine-protocol REVISE.
Raw reports: `/tmp/build-macos-runtime/lens8-*.txt`. No lens reopened a settled issue.

Closure results (raw): R6-01, R6-02, R6-07, R6-08, R6-09, R6-10, R5-09 closed (all reporting
lenses) · R6-04 closed (plan, error-handling, engine-protocol) / open (tests: race unproved) · R6-06
closed (plan, tests, engine-protocol) / partial (error-handling: `NoStdin`/`NoStdout`) · R6-11 open
(plan: arm never compiled; tests) / partial (error-handling) / closed (engine-protocol).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R7-01 | Cancellation after pinning and before `EngineActor::spawn` has no leaf remover; `Drop` only logs (error-handling 98, engine-protocol 97) | Fix | Released-leaf registry: every drop releases, reclaim at next pinning, at exit shutdown, and by the sweep (r8 A2) |
| R7-02 | `EngineRuntime::spawn` can fail after spawning (`NoStdin`/`NoStdout`) and drop the executable without removal (error-handling 90) | Fix | Covered by the registry (r8 A2) |
| R7-03 | A failing `terminate` (quit or reap error, timeout) skips the leaf removal, and `terminate_exact` then drops the owner (engine-protocol 96) | Fix | Covered by the registry; tested (r8 A2, A7) |
| R7-04 | Cleanup logs carry only the random leaf name, not engine key or id (error-handling 84) | Fix | Registry entries carry engine key and id (r8 A2) |
| R7-05 | The lock test never races initializers, so a create-then-lock regression passes (tests 99) | Fix | Competing sweep injected right after lock-file creation (r8 A7) |
| R7-06 | The other-Unix refusal arm is never compiled or executed by any listed target (plan 99, tests 98, error-handling 91) | Fix | Replaced by a `compile_error!` for Unix targets that are neither Linux nor Apple (r8 platform arms, B2) |

Correction revision for adopted R7 issues: r8 (this text).

### Round 8 (revision r8) — four Codex lenses (minimalism and tauri-security omitted: both approved r4 and drove no later correction)

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling REVISE ·
review-engine-protocol REVISE.
Raw reports: `/tmp/build-macos-runtime/lens9-*.txt`. No lens reopened a settled issue.

Closure results (raw): R7-03, R7-05, R6-04 closed (plan, error-handling, engine-protocol) / partial
(tests) · R7-04 closed (plan, error-handling, engine-protocol) / partial (tests: log unasserted) ·
R7-01 mechanism closed (plan, tests) / partial (error-handling: publication abort; engine-protocol:
unbounded) · R7-02 closed (plan, engine-protocol) / partial (tests, error-handling: untested) · R7-06
and R6-11 closed for non-Apple Unix (plan, engine-protocol) / open (error-handling: Apple vendor) /
partial (tests) · R6-06 closed in mechanism (plan, engine-protocol) / partial (tests, error-handling).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R8-01 | Phase 1 proof uses `cargo test --lib`, but the package has no library target (plan 99) | Fix | Measured: `--lib` → rc 101 "no library targets found"; filter form lists 77 tests (r9 proofs) |
| R8-02 | Released-leaf registry has no finite bound when removals keep failing (plan 97, engine-protocol 97, error-handling 92) | Fix | Cap of 64 with a typed `ResourceLimit` refusal before materialising (r9 A2, A7) |
| R8-03 | `target_vendor = "apple"` also matches iOS, tvOS and watchOS, bypassing the `compile_error!` (plan 93, engine-protocol 93, error-handling 95) | Fix | `target_os = "macos"` throughout, as existing macOS code does (r9) |
| R8-04 | Publication-abort actors held by the untracked task keep leaves past the exit reclaim (error-handling 97) | Fix (restate) | Guarantee restated: those and budget leftovers go to the next start's sweep; the underlying task is `f-20260914-34` (r9 A2) |
| R8-05 | A free lock file without its directory has no defined sweep handling (error-handling 96) | Fix | Removed like any free lock file (r9 A1) |
| R8-06 | `NoStdin`/`NoStdout` after spawn are claimed but untested (tests 98, error-handling 90) | Fix | Test-only hook for both (r9 A7) |
| R8-07 | Terminate-failure test lacks the timeout branch and a real `ChildUciIo` (tests 92) | Fix | r9 A7 |
| R8-08 | Failed-reclaim log content with engine key and id is unasserted (tests 98) | Fix | `LogCaptureScope` assertion (r9 A7) |
| R8-09 | Lock-race test does not assert its hook fired (tests 96) | Fix | r9 A7 |
| R8-10 | The `compile_error!` arm is never compiled for another Unix target (tests 95) | Skip | A `compile_error!` has no runtime behaviour; the three supported targets compiling proves its guard does not match them, and an unsupported target that it failed to reject would only build what it builds today, in an unsupported configuration CI does not produce |
| R8-11 | Redaction test cannot distinguish provenance from path shape (tests 89) | Fix | Registered path redacted, same-shape unregistered path kept (r9 A7) |
| R8-12 | `EvalListener.tsx:222` `isCurrentAttempt` ignores engine membership and `loaded`, so an unloaded remote engine's pending result can update cache and progress (engine-protocol 92) | Defer (filed) | Renderer area outside MANDATE and not read by this run; filed after verification |

Correction revision for adopted R8 issues: r9 (this text).

### Round 9 (revision r9) — four Codex lenses (minimalism and tauri-security omitted: both approved r4 and drove no later correction)

Raw verdicts: review-plan REVISE · review-tests APPROVED · review-error-handling APPROVED ·
review-engine-protocol REVISE.
Raw reports: `/tmp/build-macos-runtime/lens10-*.txt`. No lens reopened a settled issue.

Closure results (raw): R8-01, R8-03, R8-06, R8-07, R8-09, R8-11, R7-02, R7-06, R6-06, R6-11 closed (all
reporting lenses) · R8-02 and R7-01 not closed (plan, error-handling, engine-protocol: cap bypass) /
closed (tests) · R8-04 not closed (plan: exit reclaim runs concurrently) / closed (others) · R8-05
closed (plan, error-handling, engine-protocol) / partial (tests: no anchor) · R8-08 and R7-04 not
closed (plan: thread-local capture) / closed (others).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R9-01 | The cap is checked only before pinning while active leaves are uncounted until `Drop`; one launch creates several leaves and launches overlap, so the registry can exceed 64 (plan 99, error-handling 96, engine-protocol 96) | Fix | Slots reserved under the registry lock before any leaf exists; `live` counts active and released leaves (r10 A2) |
| R9-02 | The exit reclaim is said to run after engine teardown, but `shutdown_backend_with_attachments` joins teardown concurrently (`main.rs:1733-1748`; plan 97) | Fix | Reclaim awaited after the existing `tokio::join!` (r10 A2) |
| R9-03 | `LogCaptureScope` storage is thread-local and cannot observe a log written on the gateway's blocking worker (`error.rs:491-512`; plan 93) | Fix | Reclaim returns a report the async caller logs; tests assert the report (r10 A2, A7) |
| R9-04 | No test for a free lock file without its directory (tests 96) | Fix | r10 A7 |
| R9-05 | The `EXDEV` fallback lacks a byte-content or executable assertion (tests 89) | Fix | r10 A7 |
| R9-06 | `EngineRuntime::spawn` drops an already-spawned child on `NoStdin`/`NoStdout`; `kill_on_drop` does not await the reap (`engine/process.rs:1604-1636`; error-handling 95) | Fix (own commit, outside the plan's phases) | Pre-existing, same file and area as phase 2, specifiable, not a design question (rule 4b): kill and await the reap within the existing kill-reap deadline before returning the error; reviewed in the cumulative diff review |
| R9-07 | Synchronous `verify_resources` runs Apple `getpath`/`lstat` inside the Tokio engine actor, so a stalled filesystem blocks `stop`/`terminate` (engine-protocol 93) | Fix | Async, on the gateway, raced against the actor's interrupt (r10 A4) |

Correction revision for adopted R9 issues: r10 (this text).

### Round 10 (revision r10) — four Codex lenses

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling APPROVED ·
review-engine-protocol REVISE. Raw reports: `/tmp/build-macos-runtime/lens11-*.txt`. No settled issue reopened.

Closure results (raw): R9-01/R8-02/R7-01, R9-02/R8-04, R9-03/R8-08/R7-04, R9-04/R8-05, R9-05 closed
(plan, error-handling, engine-protocol) / partial (tests: R9-01, R9-03) · R9-07 open (plan,
tests, engine-protocol: Stop blocked behind a stalled command) / partial (error-handling:
gateway permits) · R9-06 disposition unchanged.

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R10-01 | Racing verification against the actor interrupt does not keep Stop/Terminate responsive: the actor awaits the command, Stop only queues, the supervisor waits for Stop before Terminate (`engine/process.rs:2163-2173`, `:2096-2100`, `:1128-1130`); no stall test (plan 99, 97; tests 98; engine-protocol 98) | Fix | Verification moves out of the actor into the calling flow, on the gateway with cancellation and a deadline, plus a stall test (r11 A4, A7) |
| R10-02 | Resolution under the authority lock is unspecified synchronous work on a Tokio worker (error-handling 91) | Fix | Steps 2–3 run as one cancellable gateway job (r11 A2) |
| R10-03 | `ResourceLimit("engine launch cleanup is failing")` misattributes capacity exhaustion (error-handling 96) | Fix | Message "engine launch leaf limit reached" (r11 A2) |
| R10-04 | Apple launch fixtures build authorities with the root-less constructor; no test launch root (plan 93) | Fix | `EngineLaunchRoot::for_test` through the root-taking constructor (r11 A1) |
| R10-05 | Cap test lacks a barrier and outcome assertions (tests 93) | Fix | r11 A7 |
| R10-06 | Caller logging of the report is untested (tests 94) | Fix | r11 A7 |
| R10-07 | `ENOTSUP` fallback branch untested (tests 95) | Fix | r11 A7 |
| R10-08 | Stalled verification jobs can occupy gateway permits (error-handling 94) | Fix (bounded, recorded) | Blocking filesystem calls cannot be aborted; the flow stops waiting at the verification deadline (r11 A4); the permit is released when the kernel returns |

Correction revision for adopted R10 issues: r11 (this text).

### Round 11 (revision r11) — four Codex lenses

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling APPROVED ·
review-engine-protocol REVISE. Raw reports: `/tmp/build-macos-runtime/lens12-*.txt`. No settled issue reopened.

Closure results (raw): R10-01/R9-07 closed (tests, error-handling) / not closed (plan: depends on the
missing cancellation adapter; engine-protocol: dispatch race) · R10-02 closed (plan, error-handling,
engine-protocol) / open (tests: no boundary proof) · R10-03 closed / partial (tests: message not
asserted) · R10-04 closed / open (tests: wiring unproven) · R10-05..R10-07, R9-01, R9-03 closed (all) ·
R10-08 closed (error-handling, engine-protocol) / partial (tests: permit accounting).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R11-01 | `spawn_cancellable` needs a `CancellationToken`, but interactive/config/game admissions expose only an `AtomicBool` (`engine/process.rs:676-700`, `infra/blocking.rs:478-501`) (plan 96, error-handling 96) | Fix | No adapter needed: the pinning job runs on `spawn`, awaited to completion, observing the admission probe; verification selects on the actor `interrupt` token and the operation token (r12 A2, A4) |
| R11-02 | Verification completing while cancellation lands can still queue `SetOption` to a cancelled actor (engine-protocol 97) | Fix | Token re-check after verification; a terminated actor rejects later commands (`engine/process.rs:2206-2211`); test (r12 A4, A7) |
| R11-03 | `UCI_Chess960` (`chess.rs:134-140`) and earlier options are sent before a later resource fails verification (engine-protocol 99) | Fix | One preflight helper runs first in `set_options` and the game closure (r12 A4, A7) |
| R11-04 | A cleanup failure after a pinning failure is not surfaced (error-handling 91) | Fix | `OperationAndCleanup`, leaf kept as released (r12 A2, A7) |
| R11-05 | Nothing proves resolution/pinning run off the Tokio worker (tests 96) | Fix | Hook asserting no current runtime handle (r12 A7) |
| R11-06 | The refusal message is not asserted (tests 99) | Fix | r12 A7 |
| R11-07 | Apple fixture wiring to the launch root is unproven (tests 93) | Fix | Missing root refuses launch, plus test (r12 A1, A7) |
| R11-08 | Permit accounting during a stall is unproven (tests 90) | Fix | `available_permits` assertion (r12 A7) |

Correction revision for adopted R11 issues: r12 (this text).

### Round 12 (revision r12) — four Codex lenses

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling APPROVED ·
review-engine-protocol REVISE. Raw reports: `/tmp/build-macos-runtime/lens13-*.txt`. No settled issue reopened.

Closure results (raw): R11-01 closed (plan, error-handling, engine-protocol) / partial (tests:
flow-level admission order) · R11-02 closed (plan, tests, error-handling) / open (engine-protocol) ·
R11-03, R11-05, R11-06, R11-07 closed (all) · R11-04 closed (plan, tests, engine-protocol) / diagnostic
surface open (error-handling) · R11-08 closed (error-handling, engine-protocol) / open (plan: private
semaphore) / partial (tests: shared gateway) · R10-01/R9-07, R10-02, R10-03, R10-04 closed (all) ·
R10-08 closed except with R11-08 (plan).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R12-01 | The verifier has no access to the executable's held lease set; report positions after the first drop fresh leases and reuse inherited values (`chess.rs:787-803`, `engine/process.rs:517-529`) (plan 98, engine-protocol 94) | Fix | Actor handle stores the held leases; values match against that set (r13 A4, A7) |
| R12-02 | `set_options` has no operation token (`chess.rs:123-127`, `:1118-1177`) (plan 95) | Fix | `operation` parameter, report passes its token (r13 A4) |
| R12-03 | The final token check is not synchronized with dispatch; `cancel_analysis` does not terminate the actor (`chess.rs:854-865`, `engine/process.rs:2163-2173`) (engine-protocol 98) | Fix | Token carried in `SetOption`, checked in the actor arm immediately before the write; test (r13 A4, A7) |
| R12-04 | `available_permits` is private and the global gateway is shared by parallel tests (`infra/blocking.rs:19-20,452-506`) (plan 96, tests 89) | Fix | Gateway-parameter variant with an isolated test gateway and a test-only accessor (r13 A4, A7) |
| R12-05 | Admission-order test bypasses the four production flows (tests 96) | Fix | One sealed-supervisor case per flow (r13 A7) |
| R12-06 | Same-name recreation is proven only for listing (tests 95) | Fix | Sentinel cases for install and recursive delete (r13 B3) |
| R12-07 | Launch-root modes unasserted (tests 91) | Fix | r13 A7 |
| R12-08 | Sweep logging unasserted (tests 85) | Fix | `LogCaptureScope` on the test thread (r13 A7) |
| R12-09 | A sweep removal failing with `PartialRemoval` leaves a partly deleted sibling and an untested outcome (`infra/fs.rs:1813-1827`) (error-handling 96) | Fix | Lock kept so the next start retries; test (r13 A1, A7) |
| R12-10 | `OperationAndCleanup` reaches IPC only as generic text; no native diagnostic (`error.rs:250-251,438-447`) (error-handling 94) | Fix | Caller log with key, id and both categories; test (r13 A2, A7) |

Correction revision for adopted R12 issues: r13 (this text).

### Round 13 (revision r13) — four Codex lenses

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling APPROVED ·
review-engine-protocol REVISE. Raw reports: `/tmp/build-macos-runtime/lens14-*.txt`.

Closure results (raw): R12-01, R12-04, R12-06..R12-09, R11-08/R10-08 closed (all) · R12-02 closed
(plan: report path; error-handling; engine-protocol) / open (tests: not driven through
`analyze_game_core`) · R12-03 closed (tests, error-handling, engine-protocol) / open (plan: write
boundary) · R12-05 closed (tests, error-handling, engine-protocol) / open (plan: sealed case impossible
for interactive) · R12-10 and R11-04 closed (tests, engine-protocol) / open (plan, error-handling:
categories lost) · R11-01 closed / partial (plan) · R11-02 closed / open (plan).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R13-01 | Interactive cancellation sets `SupervisedEngine::cancelled` through `cancel_exact` and never cancels the interrupt, so a stalled verifier times out instead of cancelling (`chess.rs:854`, `engine/process.rs:1139`, `:2101`) (plan 98) | Fix | `EngineCommandCancellation` with the flag polled at 25 ms (r14 A4, A7) |
| R13-02 | The actor-arm check precedes synchronous preparation and awaits before the write (`engine/process.rs:1688`, `:1815`, `:2163`) (plan 96) | Fix | Check inside `set_option_with_resources` immediately before `send`, whose first await is the write; hook test at that point (r14 A4, A7) |
| R13-03 | Sealed supervisor cannot reach interactive analysis: `consume_engine_search` never checks `sealed` (`engine/process.rs:877`, `:1242`) (plan 98) | Fix | Interactive case uses a removed reservation with its exact error (r14 A7) |
| R13-04 | `OperationAndCleanup` keeps only strings, so the caller cannot log categories (`error.rs:245-254`) (plan 99, error-handling 99) | Fix | Typed private `PinFailure` logged before conversion; `error.rs` unchanged (r14 A2) |
| R13-05 | `infra/blocking.rs` missing from Files and Phase 2 (plan 98) | Fix | r14 Files, Phase 2 |
| R13-06 | `LogCaptureScope` is thread-local; the runtime flavour is not pinned (`error.rs:491-512`) (plan 89) | Fix | Explicit current-thread flavour (r14 A7) |
| R13-07 | Cancellation cases do not run through `analyze_game_core` or the interactive flow (tests 94) | Fix | r14 A7 |
| R13-08 | A runtime-handle hook in the job does not prove where resolution runs (tests 88) | Fix | Hooks at the resolution functions' entries (r14 A7) |
| (re-reports) | Engine-protocol listed seven existing defects outside this mandate: `PendingActorGuard::drop` untracked task, stop deadline reset per line, config probe left registered, game construction cancellation, unscoped stop preferring a pending admission, `kill_engine` ignoring a reservation, `EvalListener` loaded guard (engine-protocol 96-99) | Defer (already filed) | f-20260914-34, f-20260911-03, f-20260914-35, f-20260908-02, f-20260911-02, f-20260914-23, f-20260914-37; settled as R4-04, R5-07, R6-05, R5-11, R5-10, R8-12 with no new evidence |

Correction revision for adopted R13 issues: r14 (this text).

### Round 14 (revision r14) — four Codex lenses

Raw verdicts: review-plan REVISE · review-tests REVISE · review-error-handling APPROVED ·
review-engine-protocol REVISE. Raw reports: `/tmp/build-macos-runtime/lens15-*.txt`.

Closure results (raw): R13-02, R13-04, R13-05, R13-06 closed (all) · R13-01 closed (plan, tests) /
partial (error-handling, engine-protocol: wrong cancellation route) · R13-03 closed (plan,
error-handling, engine-protocol) / open (tests) · R13-07 closed (plan, tests) / open or partial
(error-handling, engine-protocol) · R13-08 closed (tests, engine-protocol) / open (plan,
error-handling: unsound oracle) · R12-02, R12-03, R12-05, R12-10, R11-01, R11-02, R11-04 closed (all).

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R14-01 | `Handle::try_current()` succeeds inside a `spawn_blocking` job, so the R13-08 oracle fails the correct implementation (plan 99, error-handling 99) | Fix | Measured: `tokio-1.50.0/src/runtime/blocking/pool.rs:471` calls `rt.enter()` in the worker. Thread-identity oracle under a current-thread runtime (r15 A7) |
| R14-02 | `cancel_analysis` targets `EngineKey("analysis", id)`; interactive searches are cancelled by `stop_engine`/`kill_engine`, so the interactive cases cannot drive the flag (engine-protocol 99, error-handling 99) | Fix | Traced: `stop_generation` terminates the actor (`engine/process.rs:1128-1132`), cancelling the interrupt (`:2102`). The flag route is removed; interactive and game rely on the interrupt, report on its token; tests drive `stop_engine` (r15 A4, A7) |
| R14-03 | A flag cancellation landing during the write lets the interactive flow reach `go` and read indefinitely (engine-protocol 96) | Fix (dissolved by R14-02) | Interactive cancellation terminates the actor, which rejects `go` (`engine/process.rs:2206-2211`); the interactive hook case asserts no `go` (r15 A4, A7) |
| R14-04 | The interactive admission case stays green if a sealed check in `consume_engine_search` is absent (tests 98) | Skip | No such check is part of this plan (R13-03 changed only the test's route). The case guards admission before resolution through the resolution counter, and resolving first fails it |
| R13-01 (withdrawn) | Interactive cancellation needs the supervised flag | Withdrawn in r15 | Its premise traced `cancel_analysis`, which does not cancel interactive searches; see R14-02 |

Correction revision for adopted R14 issues: r15 (this text).

### Round 15 (revision r15) — four Codex lenses

Raw verdicts: review-plan APPROVED · review-tests REVISE · review-error-handling APPROVED ·
review-engine-protocol APPROVED. Raw reports: `/tmp/build-macos-runtime/lens16-*.txt`.

Closure results (raw): R14-01, R14-02, R13-07, R13-08 closed (all) · R14-03 closed (plan,
error-handling, engine-protocol) / open (tests: the hook terminates before `go` is reached). A
whitespace-only edit (one blank line before the Round 14 record) was made after launch; semantics and
proof unchanged, snapshot refreshed.

| ID | Claim (witnesses) | Disposition | Reason |
|---|---|---|---|
| R15-01 | The interactive hook terminates inside `set_options`, so `go` is never issued and "no go" proves nothing about rejection after termination (`chess.rs:742-744`) (tests 99) | Fix | Second hook between `set_options` and `go`, asserting `go` was attempted and rejected (r16 A7) |

Correction revision for adopted R15 issues: r16 (this text). Re-review: review-plan and review-tests
(the driving lens); no other domain lens is newly affected by a test-only case.

### Round 16 (revision r16) — closure check: review-plan, review-tests

Raw verdicts: review-plan APPROVED · review-tests APPROVED. Raw reports:
`/tmp/build-macos-runtime/lens17-*.txt`. Closure results: R15-01 closed (both), R14-03 closed (both).

### Closure (r16)

Every issue R1-01 … R15-01 carries an explicit disposition above. Every adopted substantive
correction received a reviewer closure check: r15's corrections by all four lenses (round 15), r16's
by review-plan and the driving lens review-tests (round 16). No required review is missing or failed,
and no adopted mandate defect is open or deferred. Plan review is closed at r16.

Metrics: 16 completed rounds (rounds 1–9 before this session's compaction, 10–16 after), no rewrite,
no split. `plan_adopted_per_round` (this session's rounds): r10=8 r11=8 r12=10 r13=8 r14=3 r15=1.
Withdrawn: R13-01 (r15). Out-of-mandate re-reports settled against existing findings, not counted.

## Diff review — round 1 (range origin/master..1e884b2b)

Ten Codex lenses, all `--role sensitive`, over Phase 1 (`506891a8`), Phase 2 (`3878a6a9`) and the
R9-06 reaping commit (`1e884b2b`). Raw verdicts: review-correctness REVISE · review-root-cause
REVISE · review-tests REVISE · review-error-handling REVISE · review-minimalism REVISE ·
review-code-quality REVISE · review-tauri-security REVISE · review-engine-protocol REVISE ·
review-chess-semantics APPROVED · review-ipc-contract APPROVED. Early gates on the same tree:
`pnpm gates:contract:check` green; `pnpm gate:ensure backend-coverage` red on one test (D1-05).

Every blocker below was verified in source by the orchestrator before triage.

| ID | Finding (witnesses) | Verdict | Reason |
|---|---|---|---|
| D1-01 | macOS file resources are never pinned: `pin_engine_launch` runs on the executable from `engine_executable()` before option leases are attached by `with_resource_leases`, so only the executable leaf exists and `uci_value` falls back to the original mutable path (root-cause 100, tauri-security 99, engine-protocol 99) | Fix | Core of `f-20260914-31`; pin the effective option leases in the same gateway job, test through `resolve_launch` |
| D1-02 | Resource verification runs before last-wins duplicate collapse, and pinning counts every duplicate's leases (correctness 96, 94) | Fix | Collapse first; verify and pin only effective options |
| D1-03 | A poisoned `pinned_target` mutex silently falls back to the unpinned path (error-handling 91) | Fix | Non-poisonable once-set targets; missing pin is a typed error |
| D1-04 | A poisoned launch registry makes `reclaim` report success and `Drop` lose tracking (error-handling 94) | Fix | Poison recovery on every registry access, as `admission_coordination` does |
| D1-05 | `launch_resolution_and_materialization_run_off_the_async_caller` fails under the instrumented coverage build: the trace hand-off is one process-global slot shared by parallel tests | Fix | Red gate; per-test deterministic trace |
| D1-06 | Lock-race hook cannot catch a mkdir-before-lock reordering (tests 99) | Fix | Assert the instance directory is absent in the hook |
| D1-07 | Exit reclaim untested: shutdown tests inject `ready(Ok(()))` (tests 99) | Fix | Test through the real shutdown path |
| D1-08 | Real-child termination test checks error variants only, not reaping (tests 97) | Fix | Pid-reaped assertion |
| D1-09 | Reclaim-failure log in `resolve_launch` untested (tests 95) | Fix | `LogCaptureScope`, current-thread runtime |
| D1-10 | Unnamed leaf modes `0o700`/`0o600` (code-quality 97) | Fix | Named constants |
| D1-11 | Unexplained `allow(unused_mut)` (code-quality 96) | Fix | Restructure or state the reason |
| D1-12 | `allow(dead_code)` on platform-specific test helpers (code-quality 95) | Fix | `cfg` on the using target |
| D1-13 | Dead `MaterializedFile::created` (code-quality 99, minimalism 99) | Fix | Remove |
| D1-14 | `fs.rs` uses `target_vendor = "apple"` while the rest uses `target_os = "macos"` (code-quality 98) | Fix | Align on `target_os = "macos"` |
| D1-15 | Three pass-through `EngineActor` methods (minimalism 99) | Fix | One canonical API |
| D1-16 | Test-only game engine init duplicates production init (minimalism 99) | Fix | Shared initialisation with executable injection |
| D1-17 | Test-only `resolve_engine_options` shim (minimalism 99) | Fix | Delete, update callers |
| D1-18 | `cleanup_spawn_io_failure` repeats `terminate_child`'s reap-error mapping (minimalism 94; also seen by the orchestrator when inspecting `1e884b2b`) | Fix | Rule 11: one mapping, parameterised |
| D1-19 | A trailing line of a finished search can be consumed as the next search's result (engine-protocol 94) | Defer | Pre-existing (blame `17fac36f`, `97c29add`, `e4e0f8d3`); filed as `f-20260915-01` |
| D1-20 | A destroyed webview does not stop a silent report analysis search (engine-protocol 97) | Defer | Pre-existing (blame `d835ac77`, same at `origin/master`); filed as `f-20260915-02` |

Correction: one Codex fix round resuming the Phase 2 session. Re-review after it: every lens whose
findings drove a Fix (correctness, root-cause, tests, error-handling, minimalism, code-quality,
tauri-security, engine-protocol).


## Diff review — round 2 (range origin/master..ba539255)

Correction commit `ba539255` (Codex resume of the Phase 2 session, finished after an orchestrator
stop at the start of its proof). Orchestrator verification on that tree before commit: `cargo fmt
--check`, native clippy `-D warnings`, `cargo test --all-targets` three times (1152 passed, 1 ignored
each), aarch64-apple-darwin clippy with check-only CC/AR stubs, `pnpm gate:ensure backend-coverage`
(ratchet and floors passed). After commit: `pnpm gates:contract:check`, `cargo check`,
`pnpm gate:ensure backend-test` and `backend-coverage` (receipts recorded), `findings:kit:check`,
all green. macOS-only tests (D1-01, D1-03, D1-04, D1-06, D1-07, D1-09) compile under the Apple target
here; their runtime proof is the `rust-macos-test` job.

Lenses run under executor `gemini` (agy for read-only leaves), all `--role sensitive`.
Raw verdicts: review-correctness REVISE · review-tests APPROVED · review-error-handling APPROVED ·
review-minimalism REVISE · review-code-quality REVISE · review-engine-protocol APPROVED ·
review-root-cause (agy: empty final response, relaunched on Codex) REVISE ·
review-tauri-security (agy: status ERROR, provider 503, not a quota failure; relaunched on Codex)
APPROVED.

Round-1 closure results (raw): D1-01 closed (tests, engine-protocol, root-cause, tauri-security) · D1-02 closed
(correctness, tests, engine-protocol) · D1-03 closed (error-handling, tauri-security) · D1-04 closed (tests,
error-handling) · D1-05 closed (tests, root-cause) · D1-06..D1-09 closed (tests) · D1-10..D1-14 closed
(code-quality; D1-13 also minimalism) · D1-15..D1-18 closed (minimalism). tauri-security also reports f-20260914-32 closed.

| ID | Finding (witnesses) | Verdict | Reason |
|---|---|---|---|
| D2-01 | `MaterializedFile::create_from` reopens the cloned leaf `O_RDWR` only to `fchmod` it; `fclonefileat` keeps a read-only source mode, so a 0o555 engine or 0o444 resource fails with `EACCES` and never launches (correctness 98) | Fix | Measured here as uid 1000: `open(O_RDWR)` of an owned 0o555 file → `EACCES`; `fchmod` via `O_RDONLY` → ok. Open read-only; macOS test with read-only sources on the clone and copy paths |
| D2-02 | `MaterializedFile::remove` and `EngineLaunchRoot::reclaim` repeat the statat/NOENT/remove_entry_at block (minimalism 93) | Fix | Rule 11, one helper |
| D2-03 | `prepare_report_options` reimplements last-wins collapse beside `effective_engine_options` (minimalism 95, code-quality 93) | Fix | Rule 11; identical semantics verified in source |
| D2-04 | `resolve_launch` attaches option leases to the executable twice (minimalism 90) | Fix | Attach once before pinning |
| D2-05 | `EngineResourceLease::uci_value` is `Result` on macOS and `String` elsewhere, forcing cfg-split call sites and Linux-only test branches (minimalism 88, code-quality 92, 90) | Fix | One signature on every platform removes the scaffolding |
| D2-06 | Unexplained `cfg_attr(macos, allow(dead_code))` on `AppOwnedRoot::new` from `3878a6a9` (code-quality 96) | Fix | Gate on its real callers or state the reason |
| D2-07 | Garbled test comment in process.rs (code-quality 95) | Fix | |
| D2-08 | Test literals `0o600` beside `ENGINE_RESOURCE_LEAF_MODE` (code-quality 88) | Fix | |
| D2-09 | Write-only `EngineProcess.resource_leases` has no retention comment (code-quality 87) | Fix | |
| D2-10 | The `EngineLaunch` root is created by pathname `create_dir_all`, so an ancestor symlink can redirect it, and spawn reopens the materialised executable by path (root-cause 98) | Skip (settled) | Both halves are settled with no new evidence: the ancestor-symlink window is R2-12, owned by open `f-20260905-10` and annotated to include `EngineLaunch`; the by-path leaf reopen is R2-01, outside the defended boundary per the focused judgment (APPROVED) |

Correction: one Codex fix round resuming the Phase 2 session for D2-01 to D2-09. Re-review after it: correctness (D2-01), minimalism (D2-02 to D2-05), code-quality (D2-03, D2-05 to D2-09), tests (D2-01).

## Diff review — round 3 (range origin/master..20d69da4)

Correction for D2-01 to D2-09 plus one red gate found by the orchestrator while verifying that
correction:

| ID | Finding (witnesses) | Verdict | Reason |
|---|---|---|---|
| D2-11 | On `x86_64-pc-windows-*` the test target fails `clippy --all-targets -D warnings` with 11 dead-code errors: test-only hooks and fixtures (`set_after_resource_verification_hook`, `set_interactive_before_go_hook`, `set_interactive_go_attempt_hook`, the `EngineActor` recording fixtures and option hook, `set_resource_verify_hook`, `set_option_before_send_hook`, `set_engine_launch_resolution_hook`, `set_engine_resolution_trace`, `set_spawn_child_observer`, `set_terminate_failure`, `spawn_configured_game_engine_with_executable`) whose only users are Unix-gated tests (orchestrator, Windows cross clippy with check-only CC/AR/windres stubs) | Fix | Red gate: CI `rust-platform` runs exactly that clippy on `x86_64-pc-windows-msvc`; all 12 helpers are new in this range (`git grep` on `origin/master` finds none). Gate each on the cfg of its real users, never `allow(dead_code)` |

Orchestrator verification of the D2 tree before D2-11: `cargo fmt --check`, native clippy, three full
test runs (1152 passed, 1 ignored each), aarch64-apple-darwin clippy, `pnpm gate:ensure
backend-coverage` (ratchet and floors passed).

Correction commit `20d69da4` (Codex resumes of the Phase 2 session for D2-01 to D2-09, then D2-11). Orchestrator verification on that tree before commit: `cargo fmt --check`, native clippy, three full test runs (1152 passed, 1 ignored each), aarch64-apple-darwin clippy, x86_64-pc-windows-gnu clippy `--all-targets -D warnings` with check-only CC/AR/windres stubs, `pnpm gate:ensure backend-coverage` (ratchet and floors passed). The D2-01 read-only launch tests are macOS-only; their runtime proof is the `rust-macos-test` job.

Lenses under executor `gemini` (agy), all `--role sensitive`: the four lenses whose findings drove
round-2 Fixes. Raw verdicts: review-correctness APPROVED · review-minimalism APPROVED ·
review-code-quality APPROVED · review-tests REVISE.

Round-2 closure results (raw): D2-01 closed (correctness) / partial (tests: clone path closed, copy
fallback cannot distinguish) · D2-02, D2-04 closed (minimalism) · D2-03, D2-05 closed (minimalism,
code-quality) · D2-06..D2-09 closed (code-quality) · D2-11 closed (correctness, code-quality) · D1-02
carried, closed (correctness).

| ID | Finding (witnesses) | Verdict | Reason |
|---|---|---|---|
| D3-01 | macOS branch of `engine_resource_leases_pin_files_and_directories` asserts `verify_current` refuses a replaced FILE lease, but macOS `verify_current` returns `Ok` for every non-directory lease because files are pinned; the test panics on the macOS runner (tests 100) | Fix | Verified in source (`path_authority/mod.rs` `verify_current` short-circuit; assertion at the macOS file branch). Red on `rust-macos-test`; this test was one of the ten original `f-20260914-31` failures. Assert the pinned leaf keeps the authorised bytes instead, plus a sweep of every macOS test for the same file-vs-directory contradiction |
| D3-02 | macOS-only `a_replaced_second_resource_is_refused_without_partial_option_writes` builds FILE leases and expects a path-change refusal (tests 100) | Fix | Verified: `test_file` sets `is_directory: false`; red on `rust-macos-test`. Use directory leases, the only kind path-checked on macOS |
| D3-03 | `a_second_unheld_resource_is_refused_without_partial_option_writes` fails on the first value and never reaches the second (tests 95) | Fix | Verified: the actor holds no resources. Hold the first, leave the second unheld |
| D3-04 | No test reaches `PinFailure::OperationAndCleanup` or its caller diagnostic (tests 92) | Fix | Verified by grep: the log line and variant have no test |
| D3-05 | `spawn_configured_game_engine_with_resolved` strips and re-attaches leases that production `resolve_launch` already attached, only for the test helper (minimalism 86) | Fix | Verified in `game.rs`; attach in the test helper |
| D3-06 | `stdin` extraction in `EngineRuntime::spawn` shadows under cfg while `stdout` uses disjoint cfgs (code-quality 85) | Fix | Local symmetry |
| D3-07 | Bare `+ 1` executable slot in the leaf count (code-quality 85) | Fix | |
| D3-08 | Lock-file mode `0o600` literal beside the named leaf-mode constants (code-quality 82) | Fix | |
| D3-09 | D2-01 copy fallback cannot be revert-distinguished (tests 98, closure note) | Skip | Not a defect: `create_regular_at` creates the copy leaf `0o600`, so reopening it `O_RDWR` cannot fail with `EACCES`; the defect exists only on the clone path, which `resolve_launch_pins_file_resource_before_value_construction` covers with 0o555/0o444 sources |

Correction: one Codex fix round resuming the Phase 2 session for D3-01 to D3-08. Re-review after it:
tests (D3-01 to D3-04, D2-01 carried), minimalism (D3-05), code-quality (D3-06 to D3-08).

## Diff review — round 4 (range origin/master..1ad9513e)

Correction commit `1ad9513e` (Codex resume of the Phase 2 session for D3-01 to D3-08). The leaf's
required sweep of every macOS-only test and macOS branch for assertions that contradict macOS
semantics (file leases pinned, directory leases path-checked) listed twelve sites; only D3-01 and D3-02
contradicted them, and both were fixed. D3-03 was shown red with the first resource left unheld and
green restored. D3-01, D3-02 and D3-04 are macOS-only; they compile under the Apple target here and
their runtime proof is the `rust-macos-test` job.

Orchestrator verification on that tree before commit: `cargo fmt --check`; clippy `--all-targets -D warnings` for the native, aarch64-apple-darwin and x86_64-pc-windows-gnu targets (cross targets with check-only CC/AR/windres stubs); three full test runs (1152 passed, 1 ignored each); `pnpm gate:ensure backend-coverage` (ratchet and floors passed).

Lenses: the three whose findings drove round-3 Fixes, launched under executor `gemini` (agy), all
`--role sensitive`. review-minimalism completed on agy. review-tests and review-code-quality ended with
an identified agy quota failure ("Individual quota reached … Resets in 3h31m") and were relaunched
once on Codex through `leaf-quota-retry.py` (executor-profiles §1d); later lenses in this run go to
Codex directly until the quota resets.
Raw verdicts: review-minimalism APPROVED · review-tests (Codex retry) APPROVED ·
review-code-quality (Codex retry) APPROVED.

Round-3 closure results (raw): D3-05 closed (minimalism) · D3-01..D3-04 closed (tests) · macOS file/directory sweep closed (tests) · D2-01 carried, closed for the clone path (tests) · D3-06..D3-08 closed (code-quality). The tests lens also reports the mandate closed: `f-20260914-31` (executable, file-resource and directory substitution anchors) and `f-20260914-32` (removal, replacement, `ENOTDIR`, recursive delete, install), all running in `rust-macos-test`.

| ID | Finding (witnesses) | Verdict | Reason |
|---|---|---|---|
| D4-01 | The macOS `getpath` → `PathBuf` conversion is repeated verbatim in `engine_resource` (file and directory branches) and `engine_executable` (minimalism 82), and again in the test lease and executable constructors | Fix | Verified in source at all sites; rule 11, one private helper |
| D4-02 | `engine/types.rs` re-exports `resolve_launch`, `resolve_option_leases` and `verify_option_resources` from `process`, while `engine/mod.rs` already holds the module's `process` re-exports (code-quality 96) | Fix | Verified in source; move them beside the existing `pub(crate) use process::{…}` |
| D4-03 | `map_force_kill_and_reap` takes a bare `true` in `terminate_child` and `false` in `cleanup_spawn_io_failure`, so the timeout classification is invisible at the call sites (code-quality 94) | Fix | Verified in source; a named policy instead of the boolean |

Correction: one Codex fix round resuming the Phase 2 session for D4-01 to D4-03. Closure check after
it: minimalism (D4-01) and code-quality (D4-02, D4-03), on Codex while the agy quota is exhausted.
No review lens has an open `Fix` from rounds 1 to 3.

## Diff review — round 5 (range origin/master..42dbac5b)

Correction commit `42dbac5b` (Codex resume of the Phase 2 session for D4-01 to D4-03). Orchestrator
verification on that tree before commit: `cargo fmt --check`; clippy `--all-targets -D warnings` for the
native, aarch64-apple-darwin and x86_64-pc-windows-gnu targets; three full test runs (1152 passed,
1 ignored each); `pnpm gate:ensure backend-coverage` (ratchet and floors passed).

Closure check by the two lenses whose findings drove round-4 Fixes, launched directly on Codex (agy
quota exhausted), `--role sensitive`. Raw verdicts: review-minimalism REVISE · review-code-quality
APPROVED.

Round-4 closure results (raw): D4-01 closed (minimalism) · D4-02, D4-03 closed (code-quality).
code-quality reports the mandate closure evidence for `f-20260914-31` and `f-20260914-32` unchanged.

| ID | Finding (witnesses) | Verdict | Reason |
|---|---|---|---|
| D5-01 | `EngineActor::recording_test_actor` repeats the writes/`RecordingUciIo` construction of `recording_test_actor_with_resources_and_deadlines` (minimalism 96) | Fix | Verified in source; the resource variant is new in this range. Rule 11, one shared test constructor |
| D5-02 | `BlockingGateway::available_permits` is a one-caller test-only pass-through; the other ten assertions read `gateway.semaphore.available_permits()` directly (minimalism 99, code-quality 99) | Fix | Verified: this range added the accessor and switched one assertion to it. Delete it and restore direct access |
| D5-03 | `#[derive(Clone)]` on `BlockingGateway` has no caller; every clone is of `Arc<BlockingGateway>` (minimalism 99) | Fix | Verified by grep and added in this range; proof is a clean compile on all three targets without it |
| D5-04 | macOS setup builds `AppDataDir::for_app` again right after the credential initialisation built it (minimalism 95) | Fix | Verified in `main.rs` setup; added in this range. One local, with the `AppDataDir::for_app` source-scan tests kept green |

Correction: one Codex fix round resuming the Phase 2 session for D5-01 to D5-04. Closure check after it:
minimalism (D5-01 to D5-04) and code-quality (D5-02), on Codex.

## Diff review — round 6 (range origin/master..638839dc)

Correction commit `638839dc` (Codex resumes of the Phase 2 session for D5-01 to D5-04, then D5-02b).

| ID | Finding (witnesses) | Verdict | Reason |
|---|---|---|---|
| D5-02b | D5-02's premise was incomplete. `BlockingGateway::available_permits` had two callers, not one: `blocking.rs`'s own test and `resource_verification_isolated_gateway_keeps_actor_control_responsive` in `engine/process.rs`, which cannot reach the private `semaphore`. The orchestrator's source check grepped only `blocking.rs`. With the accessor deleted, the leaf replaced the exact `available_permits() == 0` assertion with a 10 ms spawn-timeout probe, which can pass on a slow runner even when the permit is free, weakening a plan obligation (R11-08, R12-04). Found by the orchestrator while reading the D5 diff before verification | Fix (correction of D5-02) | Restore the test-only accessor for the cross-module caller and the exact permit assertion; in-module `blocking.rs` tests keep direct semaphore access. The verification run on the uncorrected tree was stopped and discarded |

D5-01, D5-03 and D5-04 were accepted from the first D5 leaf as they were. The D5-02b leaf restored the accessor under `#[cfg(all(test, unix))]` with a comment naming its cross-module caller and restored the exact assertion; its revert proof dropped the permit early in `dispatch` (red, `left: 1, right: 0`) and restored it (green). Orchestrator verification on that tree before commit: `cargo fmt --check`; clippy `--all-targets -D warnings` for the native, aarch64-apple-darwin and x86_64-pc-windows-gnu targets; three full test runs (1152 passed, 1 ignored each); `pnpm gate:ensure backend-coverage` (ratchet and floors passed).

Closure check by the two lenses whose findings drove round-5 Fixes, launched directly on Codex (agy
quota exhausted), `--role sensitive`. review-code-quality's first launch failed before any tool call with
"Selected model is at capacity" (a provider capacity error, not a usage limit) and was relaunched once on
Codex with the same prompt as `lens6d-code-quality-r2`.

Raw verdicts: review-minimalism REVISE · review-code-quality (relaunch) APPROVED.

Round-5 closure results (raw): D5-01, D5-02b, D5-03, D5-04 closed (minimalism) · D5-01..D5-04 closed
(code-quality). code-quality also re-swept every earlier issue: D1-02, D2-02..D2-11, D3-01..D3-09 and
D4-01..D4-03 closed (D2-10 and D3-09 as settled skips; D2-01's copy-fallback note is the D3-09 skip), and
reports the mandate evidence for `f-20260914-31` and `f-20260914-32` intact.

| ID | Finding (witnesses) | Verdict | Reason |
|---|---|---|---|
| D6-01 | `resolve_launch` and `resolve_option_leases` repeat the authority lock, initialisation check and option-lease resolution (minimalism 96) | Fix | Verified in `engine/process.rs`; both are new in this range. Rule 11, one helper |
| D6-02 | `engine_resource` builds near-identical Unix `EngineResourceLease` literals for files and directories, and `test_file`/`test_directory` repeat them (minimalism 98) | Fix | Verified in `path_authority/mod.rs`; one Unix constructor parameterised by `is_directory`, Windows arms unchanged |
| D6-03 | `APP_OWNED_DEFAULT_ROOT_LEAVES` is written twice, once per platform, only to add `EngineLaunch`, and the macOS copy repeats a redundant element-level cfg (minimalism 99, code-quality 95) | Fix | Verified; one list with a cfg-gated sixth entry |
| D6-04 | `MaterializedFile::drop` and `EngineLaunchRoot::reclaim` reacquire the same registry guard in each branch arm (minimalism 99) | Fix | Verified; acquire once per method or per iteration |
| D6-05 | Cancellation tokens are named `operation` (`SetOption`, four `engine/process.rs` signatures, `chess.rs` `set_options`) while `operation` means `PathOperation` elsewhere and the established name is `operation_cancellation` (code-quality 93) | Fix | Verified; `origin/master` has only `operation_cancellation`, so every `operation` token name is new in this range |
| D6-06 | The macOS-enabled resource tests still describe the wire value as an inherited descriptor: the `engine/process.rs` fixture doc, and the Unix-wide `expect`/`assert_eq!` messages in `chess.rs` and `game.rs`; the macOS blocks also repeat `assert_eq!(eval, child)` before the shared assertion (code-quality 97) | Fix | Verified: those messages are in `#[cfg(unix)]` code that runs on macOS with a materialised leaf path. The procfs expectations inside `#[cfg(target_os = "linux")]` stay |
| D6-07 | The `main.rs` setup scan comment calls `AppDataDir` a descriptor; it is an application-data path value (code-quality 96) | Fix | Verified; comment added in this range |

Correction: one Codex fix round resuming the Phase 2 session for D6-01 to D6-07. Six full-range fresh
reviews have run with severity falling to naming and comment polish, so the closure check after it
(minimalism D6-01..D6-04, code-quality D6-03 and D6-05..D6-07, on Codex) covers those closures and the D6
correction diff only.

## Diff review — round 7 (range origin/master..dbcabea6)

Correction commit `dbcabea6` (Codex resume of the Phase 2 session for D6-01 to D6-07). Orchestrator
verification on that tree before commit: `cargo fmt --check`; clippy `--all-targets -D warnings` for the
native, aarch64-apple-darwin and x86_64-pc-windows-gnu targets; three full test runs (1152 passed,
1 ignored each); `pnpm gate:ensure backend-coverage` (ratchet and floors passed).

Scope: after six full-range fresh reviews with severity falling to naming and comment polish, this round
checks the D6 closures and reviews only the D6 correction commit. Lenses on Codex, `--role sensitive`:
review-minimalism (D6-01..D6-04) and review-code-quality (D6-03, D6-05..D6-07). One design point was left
to them deliberately: `EngineResourceLease::from_file` carries a `target_override` parameter used only by
the test constructors, with `let _ =` for the arguments unused off macOS.

Raw verdicts: review-minimalism APPROVED · review-code-quality APPROVED.

Round-6 closure results (raw): D6-01, D6-02, D6-03, D6-04 closed (minimalism) · D6-03, D6-05, D6-06,
D6-07 closed (code-quality). Fresh review of `dbcabea6`: no finding from either lens; minimalism judged
`target_override` justified by its four concrete callers and the preserved test-constructor behaviour.

### Closure (diff review)

Every diff-review issue D1-01 … D6-07 carries an explicit disposition above. Every adopted Fix received a
lens closure check (D1 in round 2, D2 and D2-11 in round 3, D3 in round 4, D4 in round 5, D5 with the
D5-02b correction in round 6, D6 in round 7). Deferred: D1-19 (`f-20260915-01`) and D1-20
(`f-20260915-02`). Skipped with evidence: D2-10 (settled R2-12/R2-01) and D3-09 (not a defect). No `Fix`
is open. macOS-only runtime proof for the new tests is the `rust-macos-test` job after push.

Metrics (diff review, this range): 7 rounds; unique issues D1 20, D2 11, D3 9, D4 3, D5 5 (with D5-02b),
D6 7; adopted Fix per round r1=18 r2=10 r3=8 r4=3 r5=5 r6=7 r7=0; lens relaunches: two agy failures
(empty response, provider 503) and two identified agy quota failures moved to Codex, one Codex capacity
error relaunched.

## Post-push CI — round 8 (range origin/master..98124bf1)

The range was pushed as `0f24aeb1` after the diff-review closure, the final gates (contract, fmt, check,
clippy, backend-test, backend-coverage, kit check) and a sync of `scripts/findings.py` from agent-kit
`e6d5eea` (`0f24aeb1`). The first final-gate run had been red only on `findings:kit:check`, because a
sibling agent-kit session held unpushed `findings.py` commits and the check compares against the local
kit checkout; ChessFable's copy equalled the published kit, the sibling pushed, and ChessFable synced the
published bytes.

Test run 34943952442 on `0f24aeb1`: `test`, `rust-platform` (windows x86_64-pc-windows-msvc,
macOS x86_64-apple-darwin, macOS aarch64-apple-darwin) green; `rust-macos-test` red, 1166 passed, 3 failed.
Of the 68 names checked in its log (59 new macOS-runnable tests plus the nine Unix tests of
`f-20260914-31`'s original failure list and `f-20260914-32`'s), 66 reported `ok`. The three failures were
macOS-only test code executing on a real macOS runner for the first time; locally it only compiles.

| ID | Finding (witness) | Verdict | Reason |
|---|---|---|---|
| D7-01 | `ensure_app_owned_default_dir_applies_only_declared_private_mode`: "unexpected mode for EngineLaunch", 0o700 vs expected 0o755 (CI) | Fix | `AppOwnedDefaultRoot::EngineLaunch` is declared 0o700 on macOS; the test named only `Credentials` as private |
| D7-02 | `apple_engine_launch_removes_entries_after_copy_fchmod_and_cancellation_failures`: `assert!(result.is_err())` (CI) | Fix | Verified in `MaterializedFile::create_from`: the `Copy` fault was injected only inside the `EXDEV`/`ENOTSUP` fallback, but `fclonefileat` succeeds on the runner's APFS temp directory, so the copy path never ran |
| D7-03 | `two_overlapping_engine_launches_are_bounded_to_one_success`: both 33-leaf reservations succeeded (CI) | Fix | Each thread dropped its reservation immediately after reserving; the start barrier did not keep them overlapping, so both fit under the 64-leaf cap one after the other |

Correction commit `c8aaef6c` (Codex resume of the Phase 2 session): EngineLaunch named as a private root on
macOS; the test-only `Copy` injection forces the fallback; a second barrier keeps both reservations alive
until both have tried, and the refusal must be `ResourceLimit("engine launch leaf limit reached")`.
Orchestrator verification on that tree before commit: `cargo fmt --check`; clippy `--all-targets -D warnings`
for native, aarch64-apple-darwin and x86_64-pc-windows-gnu; three full test runs (1152 passed, 1 ignored
each); `pnpm gate:ensure backend-coverage` (ratchet and floors passed). Runtime proof of the three corrected
tests is the next `rust-macos-test` run.

Review: review-tests on Codex, `--role sensitive`, scoped to `c8aaef6c`, with closure of D7-01..D7-03, a
check that D7-03 cannot hang instead of failing when a worker panics before its second barrier, and a sweep
of the other macOS-only tests for the same two defect shapes.

Raw verdict: review-tests REVISE.

Closure results (raw): D7-01 closed · D7-02 partial (the APFS bypass is fixed, but cleanup can still pass
vacuously) · D7-03 partial (reservations now overlap, but a worker panic hangs the test). The lens found no
other macOS-only test with a fault injection bypassed by a successful `fclonefileat` or with the same
reservation/barrier pattern.

| ID | Finding (witness) | Verdict | Reason |
|---|---|---|---|
| D7-03b | A worker that hits the `panic!` arm for an unexpected reservation error never reaches `attempted_barrier`, so the main thread blocks forever and `rust-macos-test` hangs instead of failing (tests 100) | Fix | Verified in source: the three-party barrier waits on both workers. Record unexpected errors as outcomes and make every worker reach the barrier |
| D7-02b | `result.is_err()` plus `leaf.remove()` passes even if `create_from` fails before any leaf exists, because `remove_instance_leaf` maps `NOENT` to `Ok` (tests 96) | Fix | Verified in source; assert the exact injected failure per case and that the leaf exists before cleanup |

Correction: one Codex fix round resuming the Phase 2 session for D7-03b and D7-02b; closure check by
review-tests scoped to that commit.

Correction commit `98124bf1` (Codex resume of the Phase 2 session for D7-03b and D7-02b): an unexpected
reservation error is recorded as an outcome, each worker runs under `catch_unwind` and still reaches the
attempt barrier if it panics first, and the main thread asserts no worker panicked; each fault case asserts
its specific injected error or cancellation and that the leaf exists before cleanup. Orchestrator
verification on that tree before commit: `cargo fmt --check`; clippy `--all-targets -D warnings` for native,
aarch64-apple-darwin and x86_64-pc-windows-gnu; three full test runs (1152 passed, 1 ignored each);
`pnpm gate:ensure backend-coverage` (ratchet and floors passed).

Closure check: review-tests on Codex, `--role sensitive`, scoped to `98124bf1`.

Raw verdict: review-tests REVISE.

Closure results (raw): D7-02b closed · D7-03b partial.

| ID | Finding (witness) | Verdict | Reason |
|---|---|---|---|
| D7-03c | No test induces a worker panic or an unexpected reservation error, so reverting D7-03b's no-hang handling would still pass (tests 97) | Skip | The invariant the test exists for is revert-distinguished: dropping the reservation overlap yields two successes and fails the exact one-success, one-`ResourceLimit` assertions. The no-hang handling guards only the test's own failure diagnostics, which matter only when the test is already failing; `reserve_leaves` returns only `Ok` or the leaf-limit `ResourceLimit` (verified in source, and cited by the lens), so no production path reaches it. Proving it would mean injecting a panic into the test's own worker thread, a test of test scaffolding with no product or verification invariant behind it |

### Closure (post-push CI round)

D7-01 closed (review-tests on `c8aaef6c`), D7-02b and D7-02 closed (review-tests on `98124bf1`), D7-03 and
D7-03b closed in substance with D7-03c skipped with evidence. No `Fix` is open. Runtime proof of the corrected
macOS tests is the `rust-macos-test` job of the next push.

## Post-push CI — round 9 (range 6b5b4dc3..6ecd1ac8)

Test run 34948563548 on `6b5b4dc3`: `test` and all three `rust-platform` jobs green; `rust-macos-test` red,
1168 passed, 1 failed. Of the 68 checked names, 67 reported `ok`; D7-01..D7-03 all passed on the runner. The
failure was `chess::tests::report_core_restores_child_resource_provenance_after_fresh_resolution`
(`src/chess.rs:2486`, `Conflict("engine is busy searching; stop or terminate it first")`), which had passed
in run 34943952442.

The orchestrator traced it to a production defect, not a flaky test. `EngineActor::next_search_line_cancellable`
raced `next_search_line(id)` against a fresh 25 ms sleep in a loop. When the sleep won and the flag was not set,
the dropped future's `NextSearch` was already queued, and the next iteration sent a second one. While serving the
first, `service_search_read` received the second on `rx` and answered it through `reject_command_during_search`
with `Conflict`, and the first read's line went to a dropped receiver. Any search silent on stdout for longer than
one poll tick (the resource fixture blocks until its `release` file exists; a real engine at depth with sparse
info output) could fail a report or lose an info or `bestmove` line. The macOS runner's timing made the silent
window exceed 25 ms; the Linux runs did not.

| ID | Finding (witness) | Verdict | Reason |
|---|---|---|---|
| D8-01 | Drop-and-resend of `NextSearch` in `next_search_line_cancellable` (CI, orchestrator trace) | Fix | Verified in source (`process.rs` select loop and `service_search_read`'s `rx` branch) |

Correction (Codex resume of the Phase 2 session): the request future is created once and pinned, and the
cancellation flag is polled on a delayed 25 ms interval. New test
`cancellable_search_read_keeps_one_pending_request_across_poll_ticks`; the leaf ran it against the unfixed
loop and it failed with the CI `Conflict`. Orchestrator verification: `cargo fmt --check`; clippy for native,
aarch64-apple-darwin and x86_64-pc-windows-gnu; three full test runs (1154 passed, 1 ignored each);
`pnpm gate:ensure backend-coverage` passed.

Review: review-engine-protocol and review-tests on Codex, `--role sensitive`, on the working-tree diff.

Raw verdicts: review-engine-protocol REVISE · review-tests APPROVED (with should-fixes).

| ID | Finding (witness) | Verdict | Reason |
|---|---|---|---|
| D8-02 | A caller dropping the whole read future leaves the queued `NextSearch` owned by the actor, which consumes the next line into a dropped receiver or rejects the caller's next read with `Conflict`; same for `next_search_line` and `wait_bestmove_cancellable` (engine-protocol 98) | Fix | Verified in source; the actor owns the request, so the fix belongs in `service_search_read` |
| D8-03 | The cancellation test sets the flag before the first tick, so the old loop also passes (engine-protocol 99, tests 99) | Fix | Verified in the test |
| D8-04 | No test drops the cancellable read after it started (tests 97) | Fix | Anchor for D8-02 |
| D8-05 | The stop-error branch of the cancellable read is untested (tests 95) | Fix | Verified: the existing failed-stop test calls `stop_current` directly |
| D8-06 | A 1 s timeout proves no cancellation latency bound; termination is untested with a pending cancellable read (tests 96, 91) | Fix | A 500 ms bound against a 25 ms poll keeps a 20x margin for slow runners |

Correction (same session): `service_search_read` returns without reading when the reply receiver is already
closed and races `reply.closed()` ahead of the read, so a departed caller never consumes a line. This relies on
`read_bounded_engine_line` being cancel-safe; it awaits only in `fill_buf` and consumes synchronously, the same
property the existing Stop and Logs preemption already relied on. Tests
`cancellation_during_a_pending_search_read_stops_and_allows_a_new_search` (cancel after 100 ms pending, then the
new search reads its own `bestmove`), `dropped_search_reader_does_not_consume_the_next_engine_line`,
`cancellation_returns_a_stop_error_and_reaps_the_actor`,
`pending_search_read_honors_cancellation_within_the_poll_bound` and
`terminating_actor_preempts_a_pending_cancellable_search_read`; the fake engine construction is routed through
one helper. The leaf reported D8-03 red on the pre-D8-01 loop and D8-04 red with the `Conflict` on D8-01-only
code.
Orchestrator verification: fmt, three clippy targets, three full test runs (1158 passed, 1 ignored each),
backend coverage passed.

Closure check: review-engine-protocol and review-tests on Codex. The tests lens failed on "Selected model is at
capacity" and was relaunched on the next revision.

Raw verdict: review-engine-protocol REVISE. Closure (raw): D8-01, D8-03, D8-05, D8-06 closed · D8-02 and D8-04
partial.

| ID | Finding (witness) | Verdict | Reason |
|---|---|---|---|
| D8-07 | `read_bounded_engine_line` kept the partial line in a local `Vec` and consumed each refill before awaiting the next, so a read dropped between refills lost the prefix and the next read returned the suffix as a UCI line. The new `reply.closed()` branch drops reads mid-line, and so did the existing Logs and Stop preemption and the search timeout (engine-protocol 99) | Fix | Verified in source; the leaf's cancel-safety claim was wrong. Pre-existing for Logs/Stop, same function and area |

Correction (same session): the partial line lives in persistent `pending_line` state owned by `ChildUciIo`,
cleared only on a complete line, EOF or error, bounded across resumed calls, and fresh for every new child. Tests
`bounded_reader_retains_a_partial_line_across_a_dropped_read` (the leaf ran it red on the local buffer) and
`bounded_reader_enforces_the_size_bound_across_resumed_reads`. Orchestrator verification: fmt, three clippy
targets, three full test runs (1160 passed, 1 ignored each), backend coverage passed.

Closure check: review-engine-protocol and review-tests on Codex.

Raw verdicts: review-engine-protocol REVISE · review-tests APPROVED (with should-fixes). Closure (raw):
engine-protocol D8-02..D8-07 closed, D8-01 partial; tests D8-01, D8-03..D8-06 closed, D8-02 and D8-07 partial.

| ID | Finding (witness) | Verdict | Reason |
|---|---|---|---|
| D8-08 | Once every actor handle is dropped, `service_search_read`'s biased `control_rx.recv()` branch is ready with `None` forever and ignored, so the actor busy-spins and never terminates the child (engine-protocol 98) | Fix | Verified in source; pre-existing, same function |
| D8-09 | With D8-02 in place, reverting D8-01's pinning still passes its test, because the dropped read ends via `reply.closed()` and the resent read gets the line (engine-protocol 97) | Fix | Needs an IO-boundary read-attempt count |
| D8-10 | D8-07's tests call the helper directly; a fresh per-call buffer at `ChildUciIo::read_line` would pass (tests 96) | Fix | Make the resumable reader its own tested type |
| D8-11 | No test asserts the concurrent live-read `Conflict` (tests 91) | Fix | Contract kept by D8-02 must stay anchored |

Correction (same session): a closed control channel inside `service_search_read` terminates the runtime,
answers `EngineDisconnected` and ends the actor, like the `rx` `None` arm; a read-attempt count at the fake IO
boundary; `ResumableLineReader` extracted and owned by `ChildUciIo` and stderr draining, with the chunked and
size-bound tests pointed at it; tests for the concurrent live-read `Conflict` and a closed queued read. The
leaf ran D8-08, D8-09 and D8-10 red before the fix. Orchestrator verification: fmt, three clippy targets, three
full test runs (1163 passed, 1 ignored each), backend coverage passed. The leaf saw one intermittent
`spawn_io_take_failures_force_kill_and_reap_child` failure (`Disconnected`) in an intermediate run.

Closure check: review-engine-protocol and review-tests on Codex.

Raw verdicts: review-engine-protocol APPROVED (D8-01..D8-11 closed, no new defect) · review-tests APPROVED
(with should-fixes; D8-09 open, D8-02 and D8-10 partial).

| ID | Finding (witness) | Verdict | Reason |
|---|---|---|---|
| D8-09 (reopened) | The read-attempt test still passes with the pinning reverted (tests 99) | Skip | Measured by the orchestrator: with the old drop-and-resend loop restored and D8-02 kept, the test fails at `process.rs:4157` with `left: 3, right: 2`; engine-protocol reached the same conclusion from source |
| D8-12 | No test reaches the pre-dispatch `reply.is_closed()` branch (tests 98) | Fix | The branch is redundant: the biased `reply.closed()` arm is immediately ready for a closed receiver; remove it instead of testing it |
| D8-13 | No behavioural test proves `ChildUciIo::read_line` delegates to `line_reader` (tests 91) | Fix | Real-child split-line test through the production path |
| D8-14 | Intermittent `Disconnected` in `spawn_io_take_failures_force_kill_and_reap_child` (leaf run) | Fix | Verified in source: `SPAWN_CHILD_OBSERVER` is one global slot that parallel tests overwrite, dropping the other test's `pid_tx`; the test came in with `1e884b2b`, inside this range |

Correction (same session): the pre-dispatch `reply.is_closed()` check is removed; a `#[cfg(unix)]` real-child
test drives a split line through `EngineRuntime` and `ChildUciIo`; the spawn-child observer registry is keyed by
command target with an RAII guard, plus a concurrent-observers test. The leaf ran D8-13 and D8-14 red against
their reverts and ran the `engine::process` tests five times (107 passed each). Orchestrator verification: fmt,
three clippy targets, three full test runs (1165 passed, 1 ignored each), backend coverage passed.

Commit `6ecd1ac8` carries D8-01..D8-14.

Closure check: review-engine-protocol and review-tests on Codex, `--role sensitive`.

Raw verdicts: review-engine-protocol APPROVED · review-tests APPROVED. Closure (raw): D8-01..D8-14 closed in both,
no new defect.

### Closure (post-push CI round 9)

D8-01..D8-08 and D8-10..D8-14 closed by both lenses; D8-09 closed, its reopening skipped on the orchestrator's
revert measurement. No `Fix` is open. Runtime proof is the `rust-macos-test` job of the next push, including
`report_core_restores_child_resource_provenance_after_fresh_resolution`.
