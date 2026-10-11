# Refreshed backend mutation isolation — reviewed planning handoff

Assigned finding: f-20260929-12, still open at build tier. Original base: b2663061a8d20d3f969c851c3ef9ce5d025b4cbb.
First refresh base: ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Refreshed execution base: d691ee8a51602aad514e9c18f26045282998bda7.
The directly coupled existing f-20261005-08 fence-record race remains planned in the same runner
contract. Neither finding is claimed or closed here.
PLAN-REFRESH stops before Preflight, implementation, ledger/decision mutations, commits or push.
The checkout was clean at NEW-BASE. There was no finished uncommitted source work to preserve.
This refresh changes only ignored plan artifacts. The original mandate and technical decisions
stand. All r1/r2 raw reports, issue history, r2 closure and the r3 drift review are retained. r4 adds
the exact requested drift review for ca0ab686..d691ee8a and its raw reports. No runtime or landed-CI
proof is claimed by these approvals.

Successor ownership: the adopting build owns implementation, runtime proof, decision recording,
ledger closure, cumulative diff review, gates, commits, required CI/install and ordinary push.
Load this complete record before review. Promote it to tracked
tasks/handoffs/2026-10-09-backend-mutation-isolation-review.md and commit it under build §4/§10
before closing the finding. Recheck volatile prerequisites during Preflight and release, including
GitHub Actions availability for this fork (cleared 2026-10-10 per drift records). Preserve all raw
verdicts and cumulative review lineage.

The complete refreshed plan follows, including fixed MANDATE, source/decision evidence, technical
choices, phase/proof commands and full numbered review history.

# Plan: Isolate backend mutation from the live checkout

## Goal

Close f-20260929-12 by preventing the backend mutation runner from injecting source or build artefacts into the checkout that push gates measure. The plan was authored at b2663061a8d20d3f969c851c3ef9ce5d025b4cbb, refreshed at ca0ab68689e0f4de8ca0b84df2be29963bcfc66c, and is now in PLAN-REFRESH at d691ee8a51602aad514e9c18f26045282998bda7. Stop after reviewed planning outputs, before Preflight, implementation, ledger mutations, commits or push.

## MANDATE

### A backend mutation run can start after the push gates' one-shot mutation guard and mutate the tree under them

* **ID:** f-20260929-12 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/run-backend-mutation.mjs` `--check-guard` (exits 0 at once when no fence exists, ~line 183) and fence acquisition (~373-384); `gates:contract:check` (guard is its first member) and every gate run after it.
* **Defect:** the guard is a point-in-time check. A `pnpm mutation:backend` started (by another session or agent) after the guard passed acquires the fence and edits tracked `src-tauri` sources in place while the push gates are still compiling and testing, so a gate can measure mutated code — or record a receipt over it if the mutant is reverted before the receipt's second sample. Pre-existing in the serial push chain; the 2026-09-29 push-gate lane runner keeps the same one-shot check.
* **Why it matters:** a green gate or receipt over a tree that briefly contained an injected mutant.
* **Open question:** should a push-gate run hold a shared "gates running" lease that the backend mutation runner refuses on (and vice versa), and where does that lease live so a crashed gate run cannot block mutation forever?
* **Found by:** Codex `review-plan` lens, round 5 of `tasks/plans/2026-09-29-push-gate-parallelism.md`, 2026-09-29.

Correction 2026-09-30 (records review): "the 2026-09-29 push-gate lane runner keeps the same one-shot check" describes a planned runner, not code at HEAD — `scripts/run-push-gates.mjs` exists only in the untracked plan `tasks/plans/2026-09-29-push-gate-parallelism.md`, and `$push` still runs its gates serially. The defect stands for the serial chain today and for the runner if it lands with the same guard.

## Threat model and non-goals

Ordinary independent agent or shell sessions on Linux start the supported runner while gates are reading the checkout. Catchable interruption, parent SIGKILL, command failure and an ordinary source edit during preparation are relevant. The Cargo executable is the existing trusted tool, not an adversary that deliberately escapes its specified workspace. Editors, Git commands, destructive external cleanup and malicious environment/configuration injection are outside the guarantee. Existing supported Linux execution and Ubuntu mutation CI are required. No claim of newly enabling mutation on macOS or Windows is made. Existing gate routes on those systems remain unchanged.

## Traced premises

* `scripts/run-backend-mutation.mjs:184` observes the fence without reserving gate ownership. `:200`, `:229`, `:341`, `:377` implement dirty-backend refusal, exclusive durable creation, marker verification and startup respectively. `:297` selects `--in-place`, and `:416` spawns without an explicit isolated cwd.
* `scripts/run-push-gates.mjs:1112` performs the one-shot guard before the schedule. `:1034` is the separate pre-review path. `scripts/gate-receipt.mjs:474` acknowledges that sampling can miss a transient change and restoration.
* `package.json:20`, `:21`, `:26`, `:27`, `:62` route direct contract gates, strict push/receipt gates and the unwrapped backend mutation runner. The installed `agent-gate` holds a machine-wide lock, but backend mutation and standalone contract calls are outside it. It is not a checkout mutation protocol.
* `src-tauri/tauri.conf.json:33`, `:42` refer to sibling sound and dist directories. `src-tauri/src/fs.rs:3851`, `:3884`, `:3917` compile sibling catalogs/signatures into tests. `src-tauri/src/infra/path_authority/mod.rs:21360` compiles the repository's mutation runner source. `src-tauri/Cargo.toml:102` includes the vendored PGN dependency. A crate-only copy is incomplete.
* Upstream cargo-mutants 27.1.0 [build directory implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/build_dir.rs) uses the Cargo workspace root for its copy. Its [copy implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/copy_tree.rs) excludes the immediate target directory and preserves symlinks. Removing `--in-place` alone neither includes sibling inputs nor guarantees independent source files. The installed CLI reports cargo-mutants 27.1.0. Installed Rust source for it is unavailable, so tagged source is supporting evidence rather than local binary provenance.
* `scripts/mutation-runner-test-harness.mjs:35` supplies detached CLI fixtures and cleanup. `scripts/run-backend-mutation-tests.mjs:148` races the parent's owner record by reading after the child shim's marker. Existing f-20261005-08 already records this defect. The same runner/record change below includes its necessary correction without inventing a new finding.
* `scripts/child-supervisor.mjs:47`, `:61` support process-group sweeping and group-aware supervision. These prove only the selected group. cargo-mutants 27.1.0 [process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87) calls [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34), which places Cargo build/test children into independent groups. Neither immediate-child exit nor outer-group disappearance proves all mutation descendants have stopped.
* The existing launcher containment artifact `/home/felixb/.claude/scripts/leaf_contain.py:47`, `:210`, `:286` provides a Linux subreaper/ECHILD lifetime model across descendant sessions. A disposable probe against that real artifact produced exit receipt 0 and no surviving `/proc` entry for a separate-session child that ignored SIGTERM after its parent exited. Result: `subreaper-probe-result.json` in RUN_TMP, 3.16 seconds. This measures the kernel/established artifact, not the future repository implementation. Linux [subreaper](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html) and [wait](https://man7.org/linux/man-pages/man2/wait.2.html) contracts support this terminal model.
* Decisions d-20260830-10, d-20260930-04 and d-20261002-01 preserve the durable fence/no-override guard, gate schedule and strict launcher. d-20261001-02's lane-selection contract survives its launcher supersession. None settles the isolation question, so Entry remains build.
* Completed locate reports are `probe-1-r1.txt` and `probe-2-r1.txt` in RUN_TMP. The worktree has no dist or build target yet. Runtime snapshot compilation is an implementation proof, not evidence available to this planner.

## Approach

### Independent mutation inputs and outputs

Authority: MANDATE's "edits tracked `src-tauri` sources in place while the push gates are still compiling and testing" and "a green gate or receipt over a tree that briefly contained an injected mutant".

The existing runner owns one private run snapshot. Snapshot the current tracked repository file set with its relative layout, plus the required existing built `dist/`. Include backend vendor/config/resources, sound, renderer catalogs/signatures and Rust source-text test inputs. Exclude Git metadata, dependency installations, source/build caches, prior mutation output and secret files. Enumerate with Git, copy independent regular files, and reject symlinks or non-directory ancestors for copied inputs. Never hardlink or symlink source, dist or resource files back to the live tree. Preserve executable modes where needed. Fail preparation with an actionable nonzero result if required inputs are absent, copying is incomplete or verification detects a source change during capture. Verify the captured input manifest and bytes before starting the baseline. This is snapshot consistency at preparation, not an editor lock across the subsequent run.

Use the existing selected package commands and cargo-mutants `--in-place` only inside that snapshot. Explicitly set Cargo's cwd, manifest, absolute mutation output and target paths. A single worktree-specific mutation-only target cache is reused across packages and successive runs, with one package/job owner at a time. Neither inherited CARGO_TARGET_DIR nor a live target alias may redirect builds to `src-tauri/target`. Keep ordinary installed app and gate build outputs independent. Existing baseline, filters, eight-package coverage, containment, minimum timeout, survivor semantics and report locations remain intact.

One runner implements snapshot ownership. No gate lease, watcher, daemon or process-control service is introduced. The zero-software route is keeping mutation and gates manually separate, which cannot protect the unattended class in MANDATE. The snapshot is owned by the existing one-shot command and disappears through that command's cleanup. Its removal path is retiring the snapshot operation and its private mutation cache after mutation is no longer used.

Proof level: execute the real runner with Cargo shims that edit and restore snapshot source while a concurrent gate fixture reads the live source and records a receipt. Assert the live bytes and metadata never change, the mutation cwd and build target are distinct, and all mutations occur only in copied files. The central assertion must fail when the runner's isolated cwd is reverted to the live checkout.

### Fence ownership and terminal cleanup

Authority: MANDATE's crash question and the frozen catchable interruption/parent-SIGKILL threat model. This retains d-20260830-10 rather than removing a protection before isolation is proven.

Keep dirty-backend refusal, exclusive durable fence acquisition and `--check-guard` behavior. Gates starting after a fence exists may still refuse conservatively. A mutation that starts after a gate's guard now changes only its snapshot. No gate-side protocol is required to preserve the live tree.

Publish the operation's snapshot/cache identity and containment-owner identity as a complete atomic durable owner record. Preserve exclusive initial creation and retain the fence if finalisation cannot establish safe terminal state. Replace truncate-then-write recording and make tests await the parent's completed record rather than the shim's spawn marker. This covers the already-filed same-file f-20261005-08, which the adopting run can close with its evidence. An absent legacy snapshot field remains recoverable under the existing procedure.

On completion, failure or catchable signal, stop/reap all owned mutation descendants before removing the owned snapshot or admitting another cache owner. Place Cargo under one invocation-owned Linux subreaper. It establishes ownership before spawning Cargo, survives the Cargo parent's exit, terminates/reaps adopted descendants across process groups/sessions, and publishes terminal evidence only after the kernel reports no unwaited children. It must not create new children after that terminal check. Identity-safe signalling must not target a reused unrelated PID. Reuse the existing Node signal/status supervision at the containment-owner boundary, but never treat its exit or an empty outer group as subtree evidence.

Use a minimal repository-contained Python 3 one-shot process wrapper for this kernel boundary, without a dependency on Felix's home directory or an agent-kit installation in CI. It owns no snapshots, caches, ledger or generic daemon state. Existing group supervision cannot perform adoption/reaping, and Node has no existing native subreaper binding here. This is the last-resort helper needed by the observed ordinary cargo-mutants group boundary, not a parallel gate service. Its removal path is replacing it with an already available command boundary that proves the same all-descendant terminal condition. Python/subreaper capability refusal occurs before any Cargo child, with actionable nonzero failure. Side-effect-free listing and guard checks remain independent of Python, including non-Linux gate callers.

Do not clear the fence on missing terminal evidence, containment-owner signal death, unreadable state or cleanup failure. If teardown cannot establish terminal state within its bounded grace, retain the private snapshot and fence and report failure instead of releasing the shared cache. Parent SIGKILL leaves the durable fence and possibly a live containment owner/private snapshot. The one-shot owner can finish its subtree without the runner, but it cannot clear the fence. Recovery first establishes no relevant mutation descendants remain, checks the live checkout for legacy markers, and removes only the recorded owned snapshot/fence. Owner death without terminal evidence is unknown, not proof of an empty subtree. Recovery in that case retains the existing explicit process inspection/termination prerequisite. It never restores the entire backend, removes the reusable cache during ordinary finalisation, or deletes an arbitrary path from malformed metadata. Unknown or malformed ownership refuses cleanup and explains the limit. No age reclamation or background sweep is added.

Proof level: owned-process fixture barriers exercise normal exit, spawn failure, cancellation, SIGKILL with a surviving descendant, cleanup refusal and a competing runner. A Cargo shim must create a separately grouped/session descendant that ignores SIGTERM, then exit before that descendant. Require its reaping and terminal evidence before snapshot/fence removal. Inject missing/failed terminal evidence and confirm another runner cannot reuse the cache. Exercise runner death and containment-owner death separately. Verify conservative fence retention and no live-source mutation. A retained fence may block subsequent work until safe recovery, as it does today.

### Integration and operational evidence

Authority: MANDATE's supported `pnpm mutation:backend` and gate/receipt interaction, plus mandatory verification of the changed execution boundary.

Keep package entry points and P0/P1/P2/pre-review schedules unchanged. Update the runner header, CLAUDE.md's mutation description, and the canonical push skill to distinguish private snapshot mutation from legacy interrupted live mutation. Backend mutation remains outside the push gate schedule. Update mutation CI caching to the actual isolated target cache while preserving its package matrix, tool version, report uploads and all job failure behavior. Match any affected operational prose to the same contract, without editing historical decisions into agreement.

Run an actual engine-protocol mutation package in the isolated repository layout after producing dist, as well as the fixture suite. Record output locations and the live checkout's unchanged source/target observations. If the real baseline fails because a compile-time sibling input was omitted, extend the snapshot's concrete input coverage and rerun. Do not lower mutation/coverage floors or skip the baseline. Exercise refusal paths with scratch inputs and retain per-assertion unique diagnostics and statuses for any changed standalone verifier. Prefer behavioral subprocess tests to additional source scanners.

## Decisions and trade-offs

The initial locate considered a shared gate lease. Further trace showed that every package-manager and descendant boundary would need lifetime participation. Source isolation removes the mechanism at its only writer and avoids a new cross-run gate protocol. This is a technical choice, not a product change. Snapshot storage and a separate persistent mutation cache are the cost. The live target is not reused because Tauri's build outputs/resources and separate Cargo build/test invocations would then need additional coordination.

Existing safety decisions stay in force. There is no claim that current gates are safe against arbitrary editors or that an interrupted run is automatically recovered. Existing unrelated gate-scripts findings stay open at their current tiers. Only the selected finding and the directly coupled fence-record defect are planned here.

## Decided autonomously

* Question: Gate lifetime lease or isolated mutation source? Chosen: an owned independent source snapshot and mutation-only target cache. Rejected: a shared lease across every gate, package manager and descendant, and a machine-wide lock-only wrapper. Reason: isolation eliminates injected source and build output from the tree being measured at the sole writer. Reversal path: replace the snapshot contract only after a simpler protocol has proved the same gate overlap, interruption and descendant cases. The adopting session records this decision with Governs f-20260929-12.
* Question: Remove existing fence and push preflight once mutation is isolated? Chosen: retain them, including dirty-backend refusal and no override. Rejected: simultaneous retirement. Reason: legacy interrupted live mutations and unknown descendant cleanup still need the established safety boundary. Reversal path: a later evidenced decision after isolation and recovery have shipped, preserving legacy marker refusal.
* Question: Acceptance and scope? Chosen: agent-owned subprocess/runtime acceptance of this tooling change, one cohesive mutation-runner phase, including the existing same-file fence record race. Rejected: browser acceptance or a redesign of gate receipts. Reason: no product UI changes and the defect is at the runner's filesystem/process boundary. The adopting session records the necessary technical calls, with no claim of a Felix decision.
* Question: How is descendant completion proved across cargo-mutants' independent groups? Chosen: one invocation-owned Linux subreaper with positive all-descendant terminal evidence and conservative retention when that evidence is absent. Rejected: treating outer-group disappearance or cargo exit as complete cleanup, and requiring a machine-specific user systemd service in Ubuntu CI. Reason: tagged cargo-mutants source and the existing containment probe show the production boundary and an available kernel solution. Reversal path: an already available boundary that proves the same cases without this wrapper. This decision is the correction to review issue I1.

## Risks / open questions

No unresolved product question. The real build and clean-cache startup are not measured in this lane. Private helper choices belong to the executor. A scratch snapshot may remain after uncatchable interruption, but it cannot corrupt the live checkout. The existing durable fence intentionally requires recovery. Linux is the runtime proof environment, not evidence of additional platform support.

## Not part of this task

Gate scheduler changes, receipt fingerprint redesign, general editor/Git exclusion, new machine-wide tooling, changed mutation packages, mutation score policy, full frontend audit, renderer/native product behavior, coverage rebaselining or release/deployment.

## Phases

One cohesive phase, because snapshot, owner record, child cleanup, tests and CI cache wiring share the same runner contract and cannot be shipped independently.

Files: `scripts/run-backend-mutation.mjs`, `scripts/run-backend-mutation-tests.mjs`, new `scripts/mutation-process-containment.py`, `scripts/mutation-runner-test-harness.mjs` only if its shared fixture API needs extension, `.github/workflows/mutation.yml`, `CLAUDE.md`, `.claude/skills/push/SKILL.md`. Snapshot implementation stays in the runner unless a demonstrated second caller warrants extraction. The subprocess fixture suite verifies the new wrapper through the real runner, so no new package command or standalone gate is introduced. No package.json, gate schedule, generated bindings or application source edit is planned.

Touches filesystem isolation, child ownership/concurrency, durable operational state and CI cache routing. Executor: Codex write leaf at sensitive role, resolved through executor-profiles and the model registry because the workflow path is sensitive. No full-history context fork. Root writes only plan/record artifacts and owns arbitration, integration, proof, scoped commits and release. Implementation and any repair remain launcher write leaves. Fresh read-only leaves run the lens review.

PROOF COMMAND, in this order after implementation, outside a concurrent gate run:

```bash
pnpm mutation:runner:test
pnpm gates:child-supervisor:test
pnpm gates:push:test
pnpm gates:receipt:test
pnpm build-vite
BACKEND_MUTATION_PACKAGE=engine-protocol pnpm mutation:backend
pnpm mutation:guard:check
pnpm checks:pre-review
pnpm gates:contract:check
```

The new fixture assertions cover each Approach obligation and a git-anchored revert of isolated source execution. Use bounded barriers and existing process teardown rather than timing repetition. The real mutation package proves Tauri's complete snapshot compile/test boundary, without requiring a whole eight-package mutation run. Existing tests continue to select all eight packages structurally. Record any altered standalone-verifier failure matrix with its artefact as required by push-review-policy §2.

The adopting build continues through cumulative diff review and repair closure before final gates. Required final command on the clean reviewed tree: `pnpm gates:push -- --rust --frontend --bindings`, because the changed workflow and mutation build/cache inputs affect toolchain execution. Review CI jobs through the canonical push skill, push ordinarily, verify landed HEAD, and satisfy its required remote jobs/installation obligations. No UI browser pass is needed for this tooling-only phase.

## Carried to diff review

None at initial revision.

## Reviews

### Round 1 — initial source-isolation plan

Candidate: plan-r1.md, base b2663061a8d20d3f969c851c3ef9ce5d025b4cbb.
All twelve plan-capable user/project lenses ran in parallel as fresh read-only Codex launcher leaves.
review-plan used review-plan role. Others used sensitive because the workflow is a sensitive path.
Source bodies were transferred unchanged after stripping YAML. Diff-only root-cause/code-quality
lenses were excluded by their canonical frontmatter. Raw reports are preserved below.

Wall elapsed through review, triage and correction: 516.18 seconds. Active review wall time:
unknown. Known non-overlapping quota/dependency/release/other waits: none observed. Parallel leaf
durations were not summed. Polling while reviewers worked is review elapsed. Completed rounds: 1.
Raw findings: 1 blocker. Unique IDs opened: I1. Plan-level adopted findings: r1=1.
Unresolved/closed issue totals: 1/0. Correction-introduced defects: none observed. I1 identifies
a pre-existing group boundary missed by the initial plan, not a newly introduced source defect.
Withdrawals, rewrites, splits and inherited review totals: none. Open obligations: I1 closure
and all three implementation Approach obligations. Downstream implementation/final-review rework:
not observed in this PLAN-ONLY lane.

Six NOT APPLICABLE exits were checked against their canonical descriptions. Chess semantics,
UCI protocol, IPC, renderer storage, PGN indexes and native Tauri security are unaffected. Platform
semantics applies to Linux process/fixture assumptions and reviewed them. Other raw verdicts are
APPROVED. Runtime limitations remain implementation obligations, not completed proof.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Issue I1 — outer group is not the complete Cargo subtree

* Witness: review-plan r1 raw finding 1, blocker, confidence 95. Raw verdict: REVISE.
* Disposition: Fix. Claim confirmed by `scripts/child-supervisor.mjs:49–52`, cargo-mutants
  27.1.0 `src/process.rs:87` and `src/process/unix.rs:34`. The latter sets a distinct process
  group for each Cargo build/test command. Outer-group disappearance can leave an ordinary
  descendant running against the private snapshot/reusable cache.
* Evidence: both tagged primary sources were opened. The existing production launcher artifact
  `~/.claude/scripts/leaf_contain.py:47`, `:210`, `:286` was then executed against a separate-session
  descendant that ignores SIGTERM and outlives its direct parent. It returned 0, wrote terminal
  receipt 0 and left no descendant `/proc` entry after 3.16 seconds. Exact command and observed
  result are retained in RUN_TMP `probe-subreaper.py` and `subreaper-probe-result.json`.
  This is evidence for the kernel/existing artifact, not proof of future repo code or binary provenance.
* Affected MANDATE obligation: preserving a safe interrupted runner that cannot admit another
  mutation owner while the previous one still uses its reusable build cache. Source isolation
  protects gates, but the claimed cleanup boundary must hold for the actual tool's descendants.
* Authority for the new containment mechanism: fixed threat model's “Catchable interruption,
  parent SIGKILL, command failure” and MANDATE's “where does that lease live so a crashed gate
  run cannot block mutation forever?” The retained mutation fence owns this terminal boundary.
* Correction revision: r2 candidate. “Fence ownership and terminal cleanup” now requires an
  invocation-owned Linux subreaper, positive terminal evidence after all descendants are reaped,
  and conservative retention on missing evidence. New one-shot Python wrapper is repository-contained
  for Ubuntu CI. It owns no source/cache/ledger state and creates no background service. Node's
  existing supervision remains at the containment-owner boundary. Listing and guard stay Python-free.
* Dependent acceptance: separate-group/session descendant ignoring TERM, outer Cargo parent exit,
  runner death, containment-owner death, missing terminal evidence, retained fence and competing
  cache owner refusal. New fixture must fail if containment is replaced by the old outer-group sweep.
* Dependencies: none. Closure: pending fresh reviewer check against actual r2 candidate.

### Raw reports — round 1

#### review-correctness

```text
No correctness defects found in the plan’s snapshot, fence ownership or CI integration contracts.

Limitation (confidence: 95): real Cargo descendant termination and snapshot baseline compilation remain unverified. No runtime commands were run in this plan-only review.

Review used the same model family as planned implementation.

VERDICT: APPROVED
```

#### review-error-handling

```text
No error-handling defects found in the proposed obligations. Preparation failures return actionable nonzero results, uncertain termination or cleanup retains the fence, and malformed ownership refuses recovery.

Limitation: runtime failure behavior remains unverified until implementation and the specified fixtures run (confidence: 100). This review uses the same model family as the planned implementation.

VERDICT: APPROVED
```

#### review-minimalism

```text
No bloat or duplication findings. The plan keeps isolation in the existing runner, reuses process supervision and the shared fixture harness, and ties cleanup, CI caching and runtime proof to the changed execution boundary.

Limitation: helper-level duplication requires implementation diff review (confidence: 100). Detection used the same model family as planned implementation.

VERDICT: APPROVED
```

#### review-plan

```text
[blocker] tasks/plans/2026-10-09-backend-mutation-isolation.md:58 — “Fence ownership and terminal cleanup” cannot establish descendant termination through the specified group supervision alone. `scripts/child-supervisor.mjs:49–52` kills and probes only the top-level child’s process group. However, cargo-mutants 27.1.0 creates separate groups for Cargo build/test children ([process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87), [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34)). During cancellation escalation, the outer group can disappear while a separately grouped descendant survives. Clearing the fence then allows another runner to reuse the mutation cache concurrently. These are ordinary trusted-tool descendants within the stated threat model. Specify termination evidence across these group boundaries, conservative retention when that evidence is unavailable, and a behavioral fixture exercising a surviving descendant in a separate group. The generic descendant fixtures at plan:60 do not require that production boundary (confidence: 95).

Limitations: tagged source was inspected, but installed-binary provenance and runtime cleanup were not verified. No proof commands ran and no files changed (confidence: 100). Review used the same model family as the planned implementation.

VERDICT: REVISE
```

#### review-tests

```text
No plan-level verification gaps found. The proposed live-byte assertion would fail on reverting isolated execution. The fixture suite is registered in the unconditional contract gate and CI. The real engine-protocol baseline checks snapshot compile inputs.

This reviews proposed proof only. No tests ran. Detection uses the same model family as the planned implementation.

VERDICT: APPROVED
```

#### review-chess-semantics

```text
NOT APPLICABLE: The files and obligations concern filesystem snapshots, mutation-process ownership, cleanup and CI caching. No in-memory chess tree, position identity, move path, parity, variation selection or metadata round trip changes are planned.
VERDICT: APPROVED
```

#### review-engine-protocol

```text
NOT APPLICABLE: The files and obligations concern mutation-runner isolation, Cargo child ownership, fence recovery and CI caching. They do not change UCI engine supervision, protocol state or asynchronous result routing. The engine-protocol baseline exercises existing code without changing those contracts.
VERDICT: APPROVED
```

#### review-ipc-contract

```text
NOT APPLICABLE: The listed files and three Approach obligations concern mutation snapshot isolation, fence cleanup and tooling verification. They introduce no Rust↔renderer command, event, subscription or capability contract changes.
VERDICT: APPROVED
```

#### review-persisted-state

```text
NOT APPLICABLE: The listed files and three Approach obligations concern backend mutation snapshots, fence ownership, cleanup and gate integration. They do not change renderer storage, persisted atoms or tab lifecycle.
VERDICT: APPROVED
```

#### review-pgn-index

```text
NOT APPLICABLE: The plan’s files and obligations concern mutation-runner isolation, fence ownership, cleanup and CI caching. They do not change PGN scanning, byte offsets, encoding, database storage or search.
VERDICT: APPROVED
```

#### review-platform-semantics

```text
No platform-semantics findings. The plan confines mutation runtime guarantees to Linux and Ubuntu CI, consistent with the existing `/proc` identity and process-group mechanisms.

Proof remains pending. No gates, Windows compile check or non-Linux Unix source probe ran. `rust-windows-test` and `rust-macos-test` provide Rust runtime evidence only, not mutation-runner portability.

Review used the same model family as planned implementation. No files changed.

VERDICT: APPROVED
```

#### review-tauri-security

```text
NOT APPLICABLE: The files and obligations concern mutation-runner snapshots, process ownership, cleanup and gate integration. They do not change native credential/session flows, application filesystem authority, signed downloads or backend data egress. Runner snapshot cleanup falls outside this lens’s native security boundary.

VERDICT: APPROVED
```



### Round 2 — complete descendant ownership correction and I1 closure

Last actually reviewed snapshot: plan-r1.md. Candidate: plan-r2.md at the same supplied base.
Six fresh read-only Codex launcher lenses ran in parallel: review-plan, its required witness,
and minimalism/correctness/error-handling/tests/platform-semantics for the newly specified
containment process boundary. No unaffected app domain lens was rerun by default. review-plan
used review-plan role, others sensitive. Each packet carried the body-only candidate, full record
lookup, fixed verbatim MANDATE, open I1, correction evidence and exact delta-script stdout.

Wall elapsed: 181.6 seconds from prompt preparation through all reports and arbitration.
Active review wall time: unknown. Known non-overlapping quota/dependency/release/other waits: none
observed. Parallel leaf durations were not summed. Polling while reviewers worked is review
elapsed. Cumulative completed rounds: 2. Plan-level adopted findings: r1=1 r2=0.
Round-2 raw findings: 0. Unique IDs opened: none, resolved: I1. Unresolved/closed totals: 0/1.
Correction-introduced defects, withdrawals, rewrites, splits and inherited review totals: none observed.
Open implementation obligations: all three Approach obligations, owned by the adopting build.
Downstream implementation/final-review rework: not observed in this PLAN-ONLY lane.

Arbitration: all round-2 raw verdicts are APPROVED. I1 is Fix, closed in round 2 by its required
review-plan witness against the changed obligation and dependent acceptance. Additional closure
observations are retained verbatim below. They do not replace repository implementation proof.
The original round-1 REVISE is preserved. No raw verdict was rewritten. No Skip, Defer or carried
finding exists, and no approval-only revision round was invented.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Raw reports — round 2

#### review-plan

```text
I1 CLOSED — r2 at `tasks/plans/.plan-2026-10-09-backend-mutation-isolation-r2.body.md:59`, `:63` and `:65` requires subreaper ownership before Cargo spawn, positive subtree terminal evidence, conservative fence retention and fixtures covering separate sessions, TERM resistance, owner death and competing runners. This replaces the insufficient group probe at `scripts/child-supervisor.mjs:49`. The mechanism matches the [Linux adoption contract](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html), `leaf_contain.py:226` and `:293`, and the supplied `subreaper-probe-result.json:4` records successful termination with no surviving descendant (confidence: 95). Limitation: future repository implementation, snapshot baseline and installed-binary provenance remain unverified. No commands that mutate state ran. Review shares the planned implementation’s model family (confidence: 100).

VERDICT: APPROVED
```

#### review-minimalism

```text
VERDICT: APPROVED
```

#### review-correctness

```text
I1 CLOSED — Plan lines 59–65 require subreaper ownership before Cargo spawn, complete descendant reaping before snapshot/cache release, and fence retention when terminal evidence is missing. The supplied probe confirms separate-session, TERM-ignoring descendant cleanup. Closure is at the plan-contract level, with repository implementation proof still pending (confidence: 95).

VERDICT: APPROVED
```

#### review-error-handling

```text
I1 CLOSED — Lines 59–65 require subreaper adoption/reaping across sessions, positive complete-subtree terminal evidence, and fence/cache retention when evidence is missing or the owner dies. Acceptance covers separate-session descendants ignoring TERM, both owner-death cases, and competing-runner refusal. The supplied probe supports the mechanism, with repository implementation proof still required.

VERDICT: APPROVED
```

#### review-tests

```text
VERDICT: APPROVED
```

#### review-platform-semantics

```text
I1 CLOSED — Plan lines 59–65 require Linux subreaper adoption/reaping across groups and sessions, positive terminal evidence before cleanup/cache release, and fence retention on owner death or missing evidence. The supplied probe confirms the existing artifact reaped a separate-session, TERM-ignoring descendant after parent exit. Future repository code still requires the specified behavioral fixtures. Non-Linux listing and guard checks remain Python-independent.

VERDICT: APPROVED
```

### Round 3 — refresh drift review at ca0ab686

Mode: PLAN-REFRESH. Original base: b2663061a8d20d3f969c851c3ef9ce5d025b4cbb.
New base: ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Continue published rounds r1/r2, not a new investigation.
Drift: `drift-b2663061a8d20d3f969c851c3ef9ce5d025b4cbb-ca0ab68689e0f4de8ca0b84df2be29963bcfc66c.diff`, process-provided exact Git diff, SHA-256
`85f7ef4f6e836c3acea43318c24f5998f7f75fe72aa9d3e044586083810dc7e7`. Root compared its bytes with actual Git output.
Candidate: plan-r3.md. Only the Goal planner-mode/base statement changed from the reviewed body.
All three Approach obligations, implementation phase, decisions, fixed MANDATE and proof remain
unchanged. The heading delta is bookkeeping, not a replacement for the full source drift.

The drift concerns workspace initialization, operation-owned storage schemas, codec interop,
renderer/storage tests and real-app reload assertions, plus corresponding decision/finding and
completion records. Root read the changed execution paths and applicable decisions. A Git
comparison confirmed no change to the mutation runner/tests/harness, child supervisor, package
scripts, gate scheduler/receipts, mutation workflow, canonical context or push skill. The new
workspace decisions govern f-20260929-09. They neither settle nor reverse this finding's isolation
decision. The existing Actions-disabled finding received another observation. It remains an
operational prerequisite for the adopting build's ordinary Preflight/release checks, not a newly
changed mutation mechanism or proof of completed CI here.

Exactly the twelve requested REFRESH-LENSES ran in parallel through fresh read-only Codex launcher
leaves. Each received both SHAs, full drift path/hash, current body-only plan, inherited history,
closed I1, fixed mandate and exact delta stdout. review-plan used review-plan role, others sensitive.
Source lens bodies were transferred unchanged after stripping YAML. Root read every raw report
and checked each NOT APPLICABLE exit against both drift and plan obligations. The app-domain
changes do not invalidate this tooling plan's source isolation, fence/descendant ownership or
integration/proof boundary. All raw verdicts are APPROVED. No drift finding or out-of-drift defect
was reported. No issue, filing, correction or fresh design decision is manufactured from the refresh.

Round wall elapsed: 408.75 seconds through review and arbitration. Active review wall time:
unknown. Known non-overlapping quota/dependency/release/other waits: none observed. Polling while
leaves worked is review elapsed. Parallel leaf durations were not summed. Completed cumulative
rounds: 3. Adoptions: r1=1 r2=0 r3=0. Inherited elapsed: r1=516.18s, r2=181.60s.
Inherited unique issue: I1, Fix, closed by its review-plan witness in r2. This round opened/resolved
no IDs. Final unresolved/closed totals: 0/1. Inherited issue metadata and closure are byte-equivalent
JSON values, with no new witness or changed disposition. No correction-introduced defects,
withdrawals, rewrites, splits or downstream implementation/final-review rework were observed.
Open implementation obligations: all three Approach obligations, owned by the adopting build.
Runtime baseline and fixture proofs remain required there. This planner ran no implementation gate.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Raw reports — round 3

#### review-chess-semantics

```text
NOT APPLICABLE — The planned phase changes mutation-runner isolation, process containment and CI integration. Drift changes workspace initialization, validation-schema lifetimes, codec imports and reload assertions. None changes chess position identity, move-path semantics, ply parity or variation selection in a way that invalidates the plan’s independent-input, fence-cleanup or integration obligations.

VERDICT: APPROVED
```

#### review-correctness

```text
NOT APPLICABLE — Drift changes workspace hydration, storage schemas, renderer tests and real-app verification. None changes the planned runner, Cargo input layout, cache/output routing, fence ownership, descendant containment or CI integration. These changes do not invalidate a correctness obligation in the unchanged mutation-isolation plan. No open review issues remain.

VERDICT: APPROVED
```

#### review-engine-protocol

```text
NOT APPLICABLE — Drift changes workspace initialization, validation schema lifetimes, storage codec imports and reload assertions. It changes no UCI supervisor, protocol state machine or asynchronous engine result routing, and invalidates none of the plan’s mutation isolation, fence ownership or integration obligations within this lens.

VERDICT: APPROVED
```

#### review-error-handling

```text
NOT APPLICABLE — Drift changes workspace hydration, validation schema lifetimes, codec imports, reload assertions and records. None changes the mutation runner, containment boundary, CI workflow or gate integration. These changes cannot invalidate the plan’s preparation refusal, fence retention, descendant terminal evidence or failure-status obligations.

VERDICT: APPROVED
```

#### review-ipc-contract

```text
NOT APPLICABLE — The planned phase changes mutation tooling and isolation, with no Rust↔renderer IPC contract changes. The drift changes workspace hydration, validation schema lifetimes, codec interop and reload assertions. It changes no command signature, event payload, subscription or capability scope that could invalidate the plan’s isolation, cleanup or integration obligations.

VERDICT: APPROVED
```

#### review-minimalism

```text
NOT APPLICABLE — The drift changes workspace hydration, schema lifetimes, shared codec use, reload assertions, tests and records. It changes none of the planned mutation files or gate integration boundaries. These changes introduce no bloat or duplication that invalidates the unchanged snapshot isolation, fence ownership, descendant cleanup or integration proof obligations. The plan delta changes only Goal bookkeeping.

VERDICT: APPROVED
```

#### review-persisted-state

```text
NOT APPLICABLE — The drift changes workspace hydration, validation-schema lifetimes, codec imports and real-app reload assertions. None can invalidate this plan’s obligations for mutation snapshot isolation, fence ownership, descendant cleanup or runner/CI integration. Renderer persistence is explicitly outside the planned phase.

VERDICT: APPROVED
```

#### review-pgn-index

```text
NOT APPLICABLE — Planned files concern mutation isolation, process containment and CI integration. Drift changes workspace hydration, session-storage serialization and reload verification. Neither changes PGN scanning, byte-offset indexes, database move encoding or search predicates, nor invalidates a plan obligation within this lens.

VERDICT: APPROVED
```

#### review-plan

```text
No open review issues. I1 remains closed at r2.

No drift findings invalidate the three Approach obligations. Workspace and codec changes remain covered by the full tracked-file snapshot and rebuilt `dist/` requirement at plan:43 and :111. Mutation execution, descendant ownership, cache routing and gate integration dependencies are unchanged.

Limitation: future implementation, real-Cargo baseline and descendant-cleanup proof remain unverified. No runtime commands ran or files changed (confidence: 100). Review shares the planned implementation’s model family.

VERDICT: APPROVED
```

#### review-platform-semantics

```text
NOT APPLICABLE — The drift changes renderer workspace initialization, validation schemas, codec imports and reload assertions. It changes no platform mechanism or dependency that invalidates the plan’s independent snapshot/cache, Linux descendant containment, durable fence or runner/CI integration obligations. Non-Linux gate routes remain unchanged.

VERDICT: APPROVED
```

#### review-tauri-security

```text
NOT APPLICABLE — Drift changes workspace hydration, tree-schema lifetimes, codec interoperability and reload assertions. It changes no credential/session-token flow, native filesystem authority or mutation, signed-download verification, or backend diagnostic egress. None invalidates the plan’s independent snapshot/cache, durable fence/descendant cleanup, or runner/CI integration obligations within this lens.

VERDICT: APPROVED
```

#### review-tests

```text
NOT APPLICABLE — The drift changes workspace hydration, schema lifetimes, codec loading and real-app reload assertions. These do not alter the planned mutation-runner fixtures, test selectors, CI routing or Cargo baseline proof. No changed path invalidates the plan’s isolation, descendant-cleanup or integration proof obligations. Future implementation runtime evidence remains required.

VERDICT: APPROVED
```


### Round 4 — refresh drift review at d691ee8a

Mode: PLAN-REFRESH. Previous base: ca0ab68689e0f4de8ca0b84df2be29963bcfc66c.
New base: d691ee8a51602aad514e9c18f26045282998bda7. Continue published rounds r1–r3, not a new investigation.
Drift: `drift-ca0ab68689e0f4de8ca0b84df2be29963bcfc66c-d691ee8a51602aad514e9c18f26045282998bda7.diff`, process-provided exact Git diff
(116 files), SHA-256 `e1ef12c5b378f2c8a31e5d3a3fbfcb5098ded9de503419e2dbbd210c250710d9`. Root compared its bytes with actual Git output.
Candidate: plan-r4.md. Only the Goal planner-mode/base statement changed from the reviewed body.
All three Approach obligations, implementation phase, decisions, fixed MANDATE and proof remain
unchanged. The heading delta is bookkeeping, not a replacement for the full source drift.

The drift concerns database search/progress and SQLite hard-link admission (`src-tauri/src/db/**`,
`progress.rs`, test lock retries in `infra/fs.rs` and `infra/path_authority/mod.rs`), game-opening
renderer/UI work with e2e specs and snapshots, bundle/coverage budget files, `scripts/verify-app.mjs`,
`scripts/findings.py`, and the matching ledger, decision, build-ledger and handoff records. A Git
comparison confirmed no change to the mutation runner/tests/harness, child supervisor, package
scripts, gate scheduler/receipts, mutation workflow or CLAUDE.md. Of the planned phase files only
`.claude/skills/push/SKILL.md` changed: its ratchet paragraph now forbids blind bundle ceiling
changes and names the conscious feature-growth route (d-20261010-08). The paragraph does not touch the
mutation, guard or gate-map text the phase will edit. The traced premise
`src-tauri/src/infra/path_authority/mod.rs:21360` (include_str! of the mutation runner) now sits at
`:21362` with identical content. The frozen Traced premises block is left unchanged and the
full tracked-file snapshot covers the input either way. The drift adds no new include_str!/include_bytes!
sibling input. The previously recorded Actions-disabled operational prerequisite was cleared in drift
records (Test run 38083147123 succeeded on 2026-10-10). It stays a Preflight/release recheck, not a plan mechanism.

Exactly the twelve requested REFRESH-LENSES ran in parallel through fresh read-only Codex launcher
leaves. Each received both SHAs, full drift path/hash and changed-file list, current body-only plan,
inherited history, closed I1, fixed mandate, applicable decisions including d-20261010-08 and exact
delta stdout. review-plan used review-plan role, others sensitive. Source lens bodies were transferred
unchanged after stripping YAML. Root read every raw report and checked each NOT APPLICABLE exit against
both drift and plan obligations. Each reason names actual drift paths and is consistent with the root
comparison above. All raw verdicts are APPROVED. No drift finding or out-of-drift defect was reported.
No issue, filing, correction or fresh design decision is manufactured from the refresh.

Round wall elapsed: 294 seconds from snapshot through all reports. Arbitration followed immediately.
Active review wall time: unknown. Known non-overlapping quota/dependency/release/other waits: none
observed. Polling while leaves worked is review elapsed. Parallel leaf durations were not summed.
Completed cumulative rounds: 4. Adoptions: r1=1 r2=0 r3=0 r4=0. Inherited elapsed: r1=516.18s,
r2=181.60s, r3=408.75s. Inherited unique issue: I1, Fix, closed by its review-plan witness in r2.
This round opened/resolved no IDs. Final unresolved/closed totals: 0/1. Inherited issue metadata and
closure are byte-equivalent JSON values, with no new witness or changed disposition. No
correction-introduced defects, withdrawals, rewrites, splits or downstream implementation/final-review
rework were observed. Open implementation obligations: all three Approach obligations, owned by the
adopting build. Runtime baseline and fixture proofs remain required there. This planner ran no
implementation gate.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Raw reports — round 4

#### review-chess-semantics

```text
NOT APPLICABLE — Drift changes `src/state/store/tree.ts`, `src/utils/chess.ts`, `src/utils/chessops.ts` and `src/utils/repertoire.ts`, but the planned phase changes mutation-runner isolation and containment. Its full tracked-file snapshot obligation includes these changed sources without depending on their position identity, path, parity or variation semantics. No drift change can invalidate a plan obligation within this lens.

VERDICT: APPROVED
```

#### review-correctness

```text
NOT APPLICABLE — The drift changes no mutation runner, containment, cache routing, workflow, gate scheduler or receipt boundary. The sole changed planned file, `.claude/skills/push/SKILL.md`, revises bundle-budget policy without altering mutation integration. Changed application files remain covered by the unchanged full tracked-repository snapshot obligation. No correctness integration contract is invalidated.

VERDICT: APPROVED
```

#### review-engine-protocol

```text
NOT APPLICABLE — The planned phases supervise Cargo mutation descendants, not UCI engines. The drift changes no engine supervisor, UCI state machine, engine result listener or mutation execution boundary. The push-skill change concerns bundle budgets. None invalidates the plan’s isolation, ownership or integration obligations within this lens.

VERDICT: APPROVED
```

#### review-error-handling

```text
NOT APPLICABLE — The only drift in planned files is `.claude/skills/push/SKILL.md:148`, clarifying bundle ceiling review requirements. It does not alter mutation failure surfacing, fence retention, descendant terminal evidence, retry safety or CI failure behavior. The runner, containment boundary, workflow and gate routing are unchanged. No changed failure path invalidates an Approach obligation.

VERDICT: APPROVED
```

#### review-ipc-contract

```text
NOT APPLICABLE — No IPC change in this drift can invalidate the plan’s snapshot isolation, fence ownership, descendant cleanup or runner/CI integration obligations. The only changed planned-phase file, `.claude/skills/push/SKILL.md`, updates bundle-budget policy. Database progress and renderer changes do not alter those obligations. No open review issue remains.

VERDICT: APPROVED
```

#### review-minimalism

```text
NOT APPLICABLE — The only planned file changed in this drift is `.claude/skills/push/SKILL.md`, adding measured bundle-growth review requirements. Mutation isolation, fence ownership, descendant cleanup, runner integration and proof obligations remain unchanged. This adds no abstraction, duplication or scope to the planned mutation work.

VERDICT: APPROVED
```

#### review-persisted-state

```text
NOT APPLICABLE — Drift changes renderer persistence and tab lifecycle in `src/state/**` and `src/utils/tabs.ts`, but the plan’s obligations concern mutation snapshot isolation, fence ownership, descendant cleanup and runner/CI integration. No renderer storage contract participates in those obligations. The only changed planned file, `.claude/skills/push/SKILL.md`, updates bundle-budget policy without changing persistence or mutation integration.

VERDICT: APPROVED
```

#### review-pgn-index

```text
NOT APPLICABLE — The drift touches database encoding, storage and search, but the plan changes no PGN scanning or indexing behavior. Its full tracked-file snapshot already includes these sources. No change in this lens invalidates the independent-input, fence-ownership or runner-integration obligations.

VERDICT: APPROVED
```

#### review-plan

```text
No open issues. No drift-caused plan defects found, and no changed premise warrants reopening I1.

The existing runner-source include at `src-tauri/src/infra/path_authority/mod.rs:21362` remains covered by the planned full-repository snapshot. Drift adds no sibling compile inputs. Mutation execution, supervision, gate routing and CI wiring are unchanged. The push-skill ratchet clarification does not conflict with the plan.

Limitation (confidence: 100): snapshot compilation and descendant cleanup still require implementation proof. No runtime gates ran or files changed. Review used the planned implementation’s model family.

VERDICT: APPROVED
```

#### review-platform-semantics

```text
NOT APPLICABLE — The only drift in planned files is the bundle-budget policy paragraph in `.claude/skills/push/SKILL.md`. It does not change platform support, snapshot isolation, descendant containment or proof requirements. The Rust drift changes application code and tests without changing the mutation runner’s platform boundary or adding sibling compile-time inputs.

The plan remains Linux/Ubuntu-only for mutation execution, with non-Linux guard callers preserved. No platform-related changed premise invalidates an identified obligation. No runtime gates or cross-platform compile probes ran in this planning review.

VERDICT: APPROVED
```

#### review-tauri-security

```text
NOT APPLICABLE — No drift change invalidates a plan obligation within this native-security lens. The `infra/fs.rs` and `path_authority/mod.rs` changes only adjust test lock retries. The sole changed planned file, `.claude/skills/push/SKILL.md`, updates bundle-budget policy. Snapshot isolation, fence ownership, descendant cleanup and integration obligations remain unchanged. Runtime implementation proof remains future work.

VERDICT: APPROVED
```

#### review-tests

```text
NOT APPLICABLE — The only changed planned file, `.claude/skills/push/SKILL.md`, adds bundle-ceiling review requirements without changing mutation verification or gate routing. The runner, fixture harness, containment boundary, CI workflow and proof commands are unchanged. The plan still requires assertions that fail on reverted isolation, descendant-terminal evidence and a real-Cargo baseline. This drift does not invalidate those proof obligations.

VERDICT: APPROVED
```



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
    "artefact": "lens-correctness-r2.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r2.prompt",
    "report": "lens-correctness-r2.txt",
    "round": 2,
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
    "artefact": "lens-error-handling-r2.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r2.prompt",
    "report": "lens-error-handling-r2.txt",
    "round": 2,
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
    "artefact": "lens-minimalism-r2.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r2.prompt",
    "report": "lens-minimalism-r2.txt",
    "round": 2,
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
        "text": "tasks/plans/2026-10-09-backend-mutation-isolation.md:58 — “Fence ownership and terminal cleanup” cannot establish descendant termination through the specified group supervision alone. `scripts/child-supervisor.mjs:49–52` kills and probes only the top-level child’s process group. However, cargo-mutants 27.1.0 creates separate groups for Cargo build/test children ([process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87), [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34)). During cancellation escalation, the outer group can disappear while a separately grouped descendant survives. Clearing the fence then allows another runner to reuse the mutation cache concurrently. These are ordinary trusted-tool descendants within the stated threat model. Specify termination evidence across these group boundaries, conservative retention when that evidence is unavailable, and a behavioral fixture exercising a surviving descendant in a separate group. The generic descendant fixtures at plan:60 do not require that production boundary (confidence: 95)."
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
    "artefact": "lens-platform-semantics-r2.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r2.prompt",
    "report": "lens-platform-semantics-r2.txt",
    "round": 2,
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
    "artefact": "lens-tests-r2.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r2.prompt",
    "report": "lens-tests-r2.txt",
    "round": 2,
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
    "claim": "Outer process-group completion cannot prove Cargo descendants stopped across cargo-mutants separate groups.",
    "closed_round": 2,
    "correction": "Invocation-owned Linux subreaper, positive subtree terminal evidence before cleanup/cache release, and separate-session descendant fixtures. Preserve fence on missing evidence.",
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

### lens-chess-semantics-r1.txt

NOT APPLICABLE: The files and obligations concern filesystem snapshots, mutation-process ownership, cleanup and CI caching. No in-memory chess tree, position identity, move path, parity, variation selection or metadata round trip changes are planned.
VERDICT: APPROVED
### lens-chess-semantics-r3.txt

NOT APPLICABLE — The planned phase changes mutation-runner isolation, process containment and CI integration. Drift changes workspace initialization, validation-schema lifetimes, codec imports and reload assertions. None changes chess position identity, move-path semantics, ply parity or variation selection in a way that invalidates the plan’s independent-input, fence-cleanup or integration obligations.

VERDICT: APPROVED
### lens-chess-semantics-r4.txt

NOT APPLICABLE — Drift changes `src/state/store/tree.ts`, `src/utils/chess.ts`, `src/utils/chessops.ts` and `src/utils/repertoire.ts`, but the planned phase changes mutation-runner isolation and containment. Its full tracked-file snapshot obligation includes these changed sources without depending on their position identity, path, parity or variation semantics. No drift change can invalidate a plan obligation within this lens.

VERDICT: APPROVED
### lens-correctness-r1.txt

No correctness defects found in the plan’s snapshot, fence ownership or CI integration contracts.

Limitation (confidence: 95): real Cargo descendant termination and snapshot baseline compilation remain unverified. No runtime commands were run in this plan-only review.

Review used the same model family as planned implementation.

VERDICT: APPROVED
### lens-correctness-r2.txt

I1 CLOSED — Plan lines 59–65 require subreaper ownership before Cargo spawn, complete descendant reaping before snapshot/cache release, and fence retention when terminal evidence is missing. The supplied probe confirms separate-session, TERM-ignoring descendant cleanup. Closure is at the plan-contract level, with repository implementation proof still pending (confidence: 95).

VERDICT: APPROVED
### lens-correctness-r3.txt

NOT APPLICABLE — Drift changes workspace hydration, storage schemas, renderer tests and real-app verification. None changes the planned runner, Cargo input layout, cache/output routing, fence ownership, descendant containment or CI integration. These changes do not invalidate a correctness obligation in the unchanged mutation-isolation plan. No open review issues remain.

VERDICT: APPROVED
### lens-correctness-r4.txt

NOT APPLICABLE — The drift changes no mutation runner, containment, cache routing, workflow, gate scheduler or receipt boundary. The sole changed planned file, `.claude/skills/push/SKILL.md`, revises bundle-budget policy without altering mutation integration. Changed application files remain covered by the unchanged full tracked-repository snapshot obligation. No correctness integration contract is invalidated.

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE: The files and obligations concern mutation-runner isolation, Cargo child ownership, fence recovery and CI caching. They do not change UCI engine supervision, protocol state or asynchronous result routing. The engine-protocol baseline exercises existing code without changing those contracts.
VERDICT: APPROVED
### lens-engine-protocol-r3.txt

NOT APPLICABLE — Drift changes workspace initialization, validation schema lifetimes, storage codec imports and reload assertions. It changes no UCI supervisor, protocol state machine or asynchronous engine result routing, and invalidates none of the plan’s mutation isolation, fence ownership or integration obligations within this lens.

VERDICT: APPROVED
### lens-engine-protocol-r4.txt

NOT APPLICABLE — The planned phases supervise Cargo mutation descendants, not UCI engines. The drift changes no engine supervisor, UCI state machine, engine result listener or mutation execution boundary. The push-skill change concerns bundle budgets. None invalidates the plan’s isolation, ownership or integration obligations within this lens.

VERDICT: APPROVED
### lens-error-handling-r1.txt

No error-handling defects found in the proposed obligations. Preparation failures return actionable nonzero results, uncertain termination or cleanup retains the fence, and malformed ownership refuses recovery.

Limitation: runtime failure behavior remains unverified until implementation and the specified fixtures run (confidence: 100). This review uses the same model family as the planned implementation.

VERDICT: APPROVED
### lens-error-handling-r2.txt

I1 CLOSED — Lines 59–65 require subreaper adoption/reaping across sessions, positive complete-subtree terminal evidence, and fence/cache retention when evidence is missing or the owner dies. Acceptance covers separate-session descendants ignoring TERM, both owner-death cases, and competing-runner refusal. The supplied probe supports the mechanism, with repository implementation proof still required.

VERDICT: APPROVED
### lens-error-handling-r3.txt

NOT APPLICABLE — Drift changes workspace hydration, validation schema lifetimes, codec imports, reload assertions and records. None changes the mutation runner, containment boundary, CI workflow or gate integration. These changes cannot invalidate the plan’s preparation refusal, fence retention, descendant terminal evidence or failure-status obligations.

VERDICT: APPROVED
### lens-error-handling-r4.txt

NOT APPLICABLE — The only drift in planned files is `.claude/skills/push/SKILL.md:148`, clarifying bundle ceiling review requirements. It does not alter mutation failure surfacing, fence retention, descendant terminal evidence, retry safety or CI failure behavior. The runner, containment boundary, workflow and gate routing are unchanged. No changed failure path invalidates an Approach obligation.

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

NOT APPLICABLE: The listed files and three Approach obligations concern mutation snapshot isolation, fence cleanup and tooling verification. They introduce no Rust↔renderer command, event, subscription or capability contract changes.
VERDICT: APPROVED
### lens-ipc-contract-r3.txt

NOT APPLICABLE — The planned phase changes mutation tooling and isolation, with no Rust↔renderer IPC contract changes. The drift changes workspace hydration, validation schema lifetimes, codec interop and reload assertions. It changes no command signature, event payload, subscription or capability scope that could invalidate the plan’s isolation, cleanup or integration obligations.

VERDICT: APPROVED
### lens-ipc-contract-r4.txt

NOT APPLICABLE — No IPC change in this drift can invalidate the plan’s snapshot isolation, fence ownership, descendant cleanup or runner/CI integration obligations. The only changed planned-phase file, `.claude/skills/push/SKILL.md`, updates bundle-budget policy. Database progress and renderer changes do not alter those obligations. No open review issue remains.

VERDICT: APPROVED
### lens-minimalism-r1.txt

No bloat or duplication findings. The plan keeps isolation in the existing runner, reuses process supervision and the shared fixture harness, and ties cleanup, CI caching and runtime proof to the changed execution boundary.

Limitation: helper-level duplication requires implementation diff review (confidence: 100). Detection used the same model family as planned implementation.

VERDICT: APPROVED
### lens-minimalism-r2.txt

VERDICT: APPROVED
### lens-minimalism-r3.txt

NOT APPLICABLE — The drift changes workspace hydration, schema lifetimes, shared codec use, reload assertions, tests and records. It changes none of the planned mutation files or gate integration boundaries. These changes introduce no bloat or duplication that invalidates the unchanged snapshot isolation, fence ownership, descendant cleanup or integration proof obligations. The plan delta changes only Goal bookkeeping.

VERDICT: APPROVED
### lens-minimalism-r4.txt

NOT APPLICABLE — The only planned file changed in this drift is `.claude/skills/push/SKILL.md`, adding measured bundle-growth review requirements. Mutation isolation, fence ownership, descendant cleanup, runner integration and proof obligations remain unchanged. This adds no abstraction, duplication or scope to the planned mutation work.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: The listed files and three Approach obligations concern backend mutation snapshots, fence ownership, cleanup and gate integration. They do not change renderer storage, persisted atoms or tab lifecycle.
VERDICT: APPROVED
### lens-persisted-state-r3.txt

NOT APPLICABLE — The drift changes workspace hydration, validation-schema lifetimes, codec imports and real-app reload assertions. None can invalidate this plan’s obligations for mutation snapshot isolation, fence ownership, descendant cleanup or runner/CI integration. Renderer persistence is explicitly outside the planned phase.

VERDICT: APPROVED
### lens-persisted-state-r4.txt

NOT APPLICABLE — Drift changes renderer persistence and tab lifecycle in `src/state/**` and `src/utils/tabs.ts`, but the plan’s obligations concern mutation snapshot isolation, fence ownership, descendant cleanup and runner/CI integration. No renderer storage contract participates in those obligations. The only changed planned file, `.claude/skills/push/SKILL.md`, updates bundle-budget policy without changing persistence or mutation integration.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: The plan’s files and obligations concern mutation-runner isolation, fence ownership, cleanup and CI caching. They do not change PGN scanning, byte offsets, encoding, database storage or search.
VERDICT: APPROVED
### lens-pgn-index-r3.txt

NOT APPLICABLE — Planned files concern mutation isolation, process containment and CI integration. Drift changes workspace hydration, session-storage serialization and reload verification. Neither changes PGN scanning, byte-offset indexes, database move encoding or search predicates, nor invalidates a plan obligation within this lens.

VERDICT: APPROVED
### lens-pgn-index-r4.txt

NOT APPLICABLE — The drift touches database encoding, storage and search, but the plan changes no PGN scanning or indexing behavior. Its full tracked-file snapshot already includes these sources. No change in this lens invalidates the independent-input, fence-ownership or runner-integration obligations.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] tasks/plans/2026-10-09-backend-mutation-isolation.md:58 — “Fence ownership and terminal cleanup” cannot establish descendant termination through the specified group supervision alone. `scripts/child-supervisor.mjs:49–52` kills and probes only the top-level child’s process group. However, cargo-mutants 27.1.0 creates separate groups for Cargo build/test children ([process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87), [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34)). During cancellation escalation, the outer group can disappear while a separately grouped descendant survives. Clearing the fence then allows another runner to reuse the mutation cache concurrently. These are ordinary trusted-tool descendants within the stated threat model. Specify termination evidence across these group boundaries, conservative retention when that evidence is unavailable, and a behavioral fixture exercising a surviving descendant in a separate group. The generic descendant fixtures at plan:60 do not require that production boundary (confidence: 95).

Limitations: tagged source was inspected, but installed-binary provenance and runtime cleanup were not verified. No proof commands ran and no files changed (confidence: 100). Review used the same model family as the planned implementation.

VERDICT: REVISE
### lens-plan-r2.txt

I1 CLOSED — r2 at `tasks/plans/.plan-2026-10-09-backend-mutation-isolation-r2.body.md:59`, `:63` and `:65` requires subreaper ownership before Cargo spawn, positive subtree terminal evidence, conservative fence retention and fixtures covering separate sessions, TERM resistance, owner death and competing runners. This replaces the insufficient group probe at `scripts/child-supervisor.mjs:49`. The mechanism matches the [Linux adoption contract](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html), `leaf_contain.py:226` and `:293`, and the supplied `subreaper-probe-result.json:4` records successful termination with no surviving descendant (confidence: 95). Limitation: future repository implementation, snapshot baseline and installed-binary provenance remain unverified. No commands that mutate state ran. Review shares the planned implementation’s model family (confidence: 100).

VERDICT: APPROVED
### lens-plan-r3.txt

No open review issues. I1 remains closed at r2.

No drift findings invalidate the three Approach obligations. Workspace and codec changes remain covered by the full tracked-file snapshot and rebuilt `dist/` requirement at plan:43 and :111. Mutation execution, descendant ownership, cache routing and gate integration dependencies are unchanged.

Limitation: future implementation, real-Cargo baseline and descendant-cleanup proof remain unverified. No runtime commands ran or files changed (confidence: 100). Review shares the planned implementation’s model family.

VERDICT: APPROVED
### lens-plan-r4.txt

No open issues. No drift-caused plan defects found, and no changed premise warrants reopening I1.

The existing runner-source include at `src-tauri/src/infra/path_authority/mod.rs:21362` remains covered by the planned full-repository snapshot. Drift adds no sibling compile inputs. Mutation execution, supervision, gate routing and CI wiring are unchanged. The push-skill ratchet clarification does not conflict with the plan.

Limitation (confidence: 100): snapshot compilation and descendant cleanup still require implementation proof. No runtime gates ran or files changed. Review used the planned implementation’s model family.

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

No platform-semantics findings. The plan confines mutation runtime guarantees to Linux and Ubuntu CI, consistent with the existing `/proc` identity and process-group mechanisms.

Proof remains pending. No gates, Windows compile check or non-Linux Unix source probe ran. `rust-windows-test` and `rust-macos-test` provide Rust runtime evidence only, not mutation-runner portability.

Review used the same model family as planned implementation. No files changed.

VERDICT: APPROVED
### lens-platform-semantics-r2.txt

I1 CLOSED — Plan lines 59–65 require Linux subreaper adoption/reaping across groups and sessions, positive terminal evidence before cleanup/cache release, and fence retention on owner death or missing evidence. The supplied probe confirms the existing artifact reaped a separate-session, TERM-ignoring descendant after parent exit. Future repository code still requires the specified behavioral fixtures. Non-Linux listing and guard checks remain Python-independent.

VERDICT: APPROVED
### lens-platform-semantics-r3.txt

NOT APPLICABLE — The drift changes renderer workspace initialization, validation schemas, codec imports and reload assertions. It changes no platform mechanism or dependency that invalidates the plan’s independent snapshot/cache, Linux descendant containment, durable fence or runner/CI integration obligations. Non-Linux gate routes remain unchanged.

VERDICT: APPROVED
### lens-platform-semantics-r4.txt

NOT APPLICABLE — The only drift in planned files is the bundle-budget policy paragraph in `.claude/skills/push/SKILL.md`. It does not change platform support, snapshot isolation, descendant containment or proof requirements. The Rust drift changes application code and tests without changing the mutation runner’s platform boundary or adding sibling compile-time inputs.

The plan remains Linux/Ubuntu-only for mutation execution, with non-Linux guard callers preserved. No platform-related changed premise invalidates an identified obligation. No runtime gates or cross-platform compile probes ran in this planning review.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

NOT APPLICABLE: The files and obligations concern mutation-runner snapshots, process ownership, cleanup and gate integration. They do not change native credential/session flows, application filesystem authority, signed downloads or backend data egress. Runner snapshot cleanup falls outside this lens’s native security boundary.

VERDICT: APPROVED
### lens-tauri-security-r3.txt

NOT APPLICABLE — Drift changes workspace hydration, tree-schema lifetimes, codec interoperability and reload assertions. It changes no credential/session-token flow, native filesystem authority or mutation, signed-download verification, or backend diagnostic egress. None invalidates the plan’s independent snapshot/cache, durable fence/descendant cleanup, or runner/CI integration obligations within this lens.

VERDICT: APPROVED
### lens-tauri-security-r4.txt

NOT APPLICABLE — No drift change invalidates a plan obligation within this native-security lens. The `infra/fs.rs` and `path_authority/mod.rs` changes only adjust test lock retries. The sole changed planned file, `.claude/skills/push/SKILL.md`, updates bundle-budget policy. Snapshot isolation, fence ownership, descendant cleanup and integration obligations remain unchanged. Runtime implementation proof remains future work.

VERDICT: APPROVED
### lens-tests-r1.txt

No plan-level verification gaps found. The proposed live-byte assertion would fail on reverting isolated execution. The fixture suite is registered in the unconditional contract gate and CI. The real engine-protocol baseline checks snapshot compile inputs.

This reviews proposed proof only. No tests ran. Detection uses the same model family as the planned implementation.

VERDICT: APPROVED
### lens-tests-r2.txt

VERDICT: APPROVED
### lens-tests-r3.txt

NOT APPLICABLE — The drift changes workspace hydration, schema lifetimes, codec loading and real-app reload assertions. These do not alter the planned mutation-runner fixtures, test selectors, CI routing or Cargo baseline proof. No changed path invalidates the plan’s isolation, descendant-cleanup or integration proof obligations. Future implementation runtime evidence remains required.

VERDICT: APPROVED
### lens-tests-r4.txt

NOT APPLICABLE — The only changed planned file, `.claude/skills/push/SKILL.md`, adds bundle-ceiling review requirements without changing mutation verification or gate routing. The runner, fixture harness, containment boundary, CI workflow and proof commands are unchanged. The plan still requires assertions that fail on reverted isolation, descendant-terminal evidence and a real-Cargo baseline. This drift does not invalidate those proof obligations.

VERDICT: APPROVED
### plan-r1.md

# Plan: Isolate backend mutation from the live checkout

## Goal

Close f-20260929-12 by preventing the backend mutation runner from injecting source or build artefacts into the checkout that push gates measure. This is a PLAN-ONLY run at b2663061a8d20d3f969c851c3ef9ce5d025b4cbb. Stop after reviewed planning outputs, before Preflight, implementation, ledger mutations, commits or push.

## MANDATE

### A backend mutation run can start after the push gates' one-shot mutation guard and mutate the tree under them

* **ID:** f-20260929-12 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/run-backend-mutation.mjs` `--check-guard` (exits 0 at once when no fence exists, ~line 183) and fence acquisition (~373-384); `gates:contract:check` (guard is its first member) and every gate run after it.
* **Defect:** the guard is a point-in-time check. A `pnpm mutation:backend` started (by another session or agent) after the guard passed acquires the fence and edits tracked `src-tauri` sources in place while the push gates are still compiling and testing, so a gate can measure mutated code — or record a receipt over it if the mutant is reverted before the receipt's second sample. Pre-existing in the serial push chain; the 2026-09-29 push-gate lane runner keeps the same one-shot check.
* **Why it matters:** a green gate or receipt over a tree that briefly contained an injected mutant.
* **Open question:** should a push-gate run hold a shared "gates running" lease that the backend mutation runner refuses on (and vice versa), and where does that lease live so a crashed gate run cannot block mutation forever?
* **Found by:** Codex `review-plan` lens, round 5 of `tasks/plans/2026-09-29-push-gate-parallelism.md`, 2026-09-29.

Correction 2026-09-30 (records review): "the 2026-09-29 push-gate lane runner keeps the same one-shot check" describes a planned runner, not code at HEAD — `scripts/run-push-gates.mjs` exists only in the untracked plan `tasks/plans/2026-09-29-push-gate-parallelism.md`, and `$push` still runs its gates serially. The defect stands for the serial chain today and for the runner if it lands with the same guard.

## Threat model and non-goals

Ordinary independent agent or shell sessions on Linux start the supported runner while gates are reading the checkout. Catchable interruption, parent SIGKILL, command failure and an ordinary source edit during preparation are relevant. The Cargo executable is the existing trusted tool, not an adversary that deliberately escapes its specified workspace. Editors, Git commands, destructive external cleanup and malicious environment/configuration injection are outside the guarantee. Existing supported Linux execution and Ubuntu mutation CI are required. No claim of newly enabling mutation on macOS or Windows is made. Existing gate routes on those systems remain unchanged.

## Traced premises

* `scripts/run-backend-mutation.mjs:184` observes the fence without reserving gate ownership. `:200`, `:229`, `:341`, `:377` implement dirty-backend refusal, exclusive durable creation, marker verification and startup respectively. `:297` selects `--in-place`, and `:416` spawns without an explicit isolated cwd.
* `scripts/run-push-gates.mjs:1112` performs the one-shot guard before the schedule. `:1034` is the separate pre-review path. `scripts/gate-receipt.mjs:474` acknowledges that sampling can miss a transient change and restoration.
* `package.json:20`, `:21`, `:26`, `:27`, `:62` route direct contract gates, strict push/receipt gates and the unwrapped backend mutation runner. The installed `agent-gate` holds a machine-wide lock, but backend mutation and standalone contract calls are outside it. It is not a checkout mutation protocol.
* `src-tauri/tauri.conf.json:33`, `:42` refer to sibling sound and dist directories. `src-tauri/src/fs.rs:3851`, `:3884`, `:3917` compile sibling catalogs/signatures into tests. `src-tauri/src/infra/path_authority/mod.rs:21360` compiles the repository's mutation runner source. `src-tauri/Cargo.toml:102` includes the vendored PGN dependency. A crate-only copy is incomplete.
* Upstream cargo-mutants 27.1.0 [build directory implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/build_dir.rs) uses the Cargo workspace root for its copy. Its [copy implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/copy_tree.rs) excludes the immediate target directory and preserves symlinks. Removing `--in-place` alone neither includes sibling inputs nor guarantees independent source files. The installed CLI reports cargo-mutants 27.1.0. Installed Rust source for it is unavailable, so tagged source is supporting evidence rather than local binary provenance.
* `scripts/mutation-runner-test-harness.mjs:35` supplies detached CLI fixtures and cleanup. `scripts/run-backend-mutation-tests.mjs:148` races the parent's owner record by reading after the child shim's marker. Existing f-20261005-08 already records this defect. The same runner/record change below includes its necessary correction without inventing a new finding.
* `scripts/child-supervisor.mjs:47`, `:61` support process-group sweeping and group-aware supervision. Existing immediate-child supervision does not prove all mutation descendants have stopped.
* Decisions d-20260830-10, d-20260930-04 and d-20261002-01 preserve the durable fence/no-override guard, gate schedule and strict launcher. d-20261001-02's lane-selection contract survives its launcher supersession. None settles the isolation question, so Entry remains build.
* Completed locate reports are `probe-1-r1.txt` and `probe-2-r1.txt` in RUN_TMP. The worktree has no dist or build target yet. Runtime snapshot compilation is an implementation proof, not evidence available to this planner.

## Approach

### Independent mutation inputs and outputs

Authority: MANDATE's "edits tracked `src-tauri` sources in place while the push gates are still compiling and testing" and "a green gate or receipt over a tree that briefly contained an injected mutant".

The existing runner owns one private run snapshot. Snapshot the current tracked repository file set with its relative layout, plus the required existing built `dist/`. Include backend vendor/config/resources, sound, renderer catalogs/signatures and Rust source-text test inputs. Exclude Git metadata, dependency installations, source/build caches, prior mutation output and secret files. Enumerate with Git, copy independent regular files, and reject symlinks or non-directory ancestors for copied inputs. Never hardlink or symlink source, dist or resource files back to the live tree. Preserve executable modes where needed. Fail preparation with an actionable nonzero result if required inputs are absent, copying is incomplete or verification detects a source change during capture. Verify the captured input manifest and bytes before starting the baseline. This is snapshot consistency at preparation, not an editor lock across the subsequent run.

Use the existing selected package commands and cargo-mutants `--in-place` only inside that snapshot. Explicitly set Cargo's cwd, manifest, absolute mutation output and target paths. A single worktree-specific mutation-only target cache is reused across packages and successive runs, with one package/job owner at a time. Neither inherited CARGO_TARGET_DIR nor a live target alias may redirect builds to `src-tauri/target`. Keep ordinary installed app and gate build outputs independent. Existing baseline, filters, eight-package coverage, containment, minimum timeout, survivor semantics and report locations remain intact.

One runner implements this operation. A helper is extracted only where existing callers need the same concept. No gate lease, watcher, daemon or process-control service is introduced. The zero-software route is keeping mutation and gates manually separate, which cannot protect the unattended class in MANDATE. The snapshot is owned by the existing one-shot command and disappears through that command's cleanup. Its removal path is retiring the snapshot operation and its private mutation cache after mutation is no longer used.

Proof level: execute the real runner with Cargo shims that edit and restore snapshot source while a concurrent gate fixture reads the live source and records a receipt. Assert the live bytes and metadata never change, the mutation cwd and build target are distinct, and all mutations occur only in copied files. The central assertion must fail when the runner's isolated cwd is reverted to the live checkout.

### Fence ownership and terminal cleanup

Authority: MANDATE's crash question and the frozen catchable interruption/parent-SIGKILL threat model. This retains d-20260830-10 rather than removing a protection before isolation is proven.

Keep dirty-backend refusal, exclusive durable fence acquisition and `--check-guard` behavior. Gates starting after a fence exists may still refuse conservatively. A mutation that starts after a gate's guard now changes only its snapshot. No gate-side protocol is required to preserve the live tree.

Publish the operation's snapshot/cache identity and child identity as a complete atomic durable owner record. Preserve exclusive initial creation and retain the fence if finalisation cannot establish safe terminal state. Replace truncate-then-write recording and make tests await the parent's completed record rather than the shim's spawn marker. This covers the already-filed same-file f-20261005-08, which the adopting run can close with its evidence. An absent legacy snapshot field remains recoverable under the existing procedure.

On completion, failure or catchable signal, stop/reap all owned mutation children before removing the owned snapshot. Reuse group supervision. Do not clear the fence on unknown termination, unreadable state or cleanup failure. Parent SIGKILL leaves a durable fence and possibly a private snapshot. Recovery first establishes no relevant mutation descendants remain, checks the live checkout for legacy markers, and removes only the recorded owned snapshot/fence. It never restores the entire backend, removes the reusable cache during ordinary finalisation, or deletes an arbitrary path from malformed metadata. Unknown or malformed ownership refuses cleanup and explains the limit. No new automated sweeping or PID-age reclamation is added.

Proof level: owned-process fixture barriers exercise normal exit, spawn failure, cancellation, SIGKILL with a surviving descendant, cleanup refusal and a competing runner. Verify conservative fence retention and no live-source mutation. A retained fence may block subsequent work until safe recovery, as it does today.

### Integration and operational evidence

Authority: MANDATE's supported `pnpm mutation:backend` and gate/receipt interaction, plus mandatory verification of the changed execution boundary.

Keep package entry points and P0/P1/P2/pre-review schedules unchanged. Update the runner header, CLAUDE.md's mutation description, and the canonical push skill to distinguish private snapshot mutation from legacy interrupted live mutation. Backend mutation remains outside the push gate schedule. Update mutation CI caching to the actual isolated target cache while preserving its package matrix, tool version, report uploads and all job failure behavior. Match any affected operational prose to the same contract, without editing historical decisions into agreement.

Run an actual engine-protocol mutation package in the isolated repository layout after producing dist, as well as the fixture suite. Record output locations and the live checkout's unchanged source/target observations. If the real baseline fails because a compile-time sibling input was omitted, extend the snapshot's concrete input coverage and rerun. Do not lower mutation/coverage floors or skip the baseline. Exercise refusal paths with scratch inputs and retain per-assertion unique diagnostics and statuses for any changed standalone verifier. Prefer behavioral subprocess tests to additional source scanners.

## Decisions and trade-offs

The initial locate considered a shared gate lease. Further trace showed that every package-manager and descendant boundary would need lifetime participation. Source isolation removes the mechanism at its only writer and avoids a new cross-run gate protocol. This is a technical choice, not a product change. Snapshot storage and a separate persistent mutation cache are the cost. The live target is not reused because Tauri's build outputs/resources and separate Cargo build/test invocations would then need additional coordination.

Existing safety decisions stay in force. There is no claim that current gates are safe against arbitrary editors or that an interrupted run is automatically recovered. Existing unrelated gate-scripts findings stay open at their current tiers. Only the selected finding and the directly coupled fence-record defect are planned here.

## Decided autonomously

* Question: Gate lifetime lease or isolated mutation source? Chosen: an owned independent source snapshot and mutation-only target cache. Rejected: a shared lease across every gate, package manager and descendant, and a machine-wide lock-only wrapper. Reason: isolation eliminates injected source and build output from the tree being measured at the sole writer. Reversal path: replace the snapshot contract only after a simpler protocol has proved the same gate overlap, interruption and descendant cases. The adopting session records this decision with Governs f-20260929-12.
* Question: Remove existing fence and push preflight once mutation is isolated? Chosen: retain them, including dirty-backend refusal and no override. Rejected: simultaneous retirement. Reason: legacy interrupted live mutations and unknown descendant cleanup still need the established safety boundary. Reversal path: a later evidenced decision after isolation and recovery have shipped, preserving legacy marker refusal.
* Question: Acceptance and scope? Chosen: agent-owned subprocess/runtime acceptance of this tooling change, one cohesive mutation-runner phase, including the existing same-file fence record race. Rejected: browser acceptance or a redesign of gate receipts. Reason: no product UI changes and the defect is at the runner's filesystem/process boundary. The adopting session records the necessary technical calls, with no claim of a Felix decision.

## Risks / open questions

No unresolved product question. The real build and clean-cache startup are not measured in this lane. Private helper choices belong to the executor. A scratch snapshot may remain after uncatchable interruption, but it cannot corrupt the live checkout. The existing durable fence intentionally requires recovery. Linux is the runtime proof environment, not evidence of additional platform support.

## Not part of this task

Gate scheduler changes, receipt fingerprint redesign, general editor/Git exclusion, new machine-wide tooling, changed mutation packages, mutation score policy, full frontend audit, renderer/native product behavior, coverage rebaselining or release/deployment.

## Phases

One cohesive phase, because snapshot, owner record, child cleanup, tests and CI cache wiring share the same runner contract and cannot be shipped independently.

Files: `scripts/run-backend-mutation.mjs`, `scripts/run-backend-mutation-tests.mjs`, `scripts/mutation-runner-test-harness.mjs` only if its shared fixture API needs extension, `.github/workflows/mutation.yml`, `CLAUDE.md`, `.claude/skills/push/SKILL.md`. Snapshot implementation stays in the runner unless a demonstrated second caller warrants extraction. No package.json, gate schedule, generated bindings or application source edit is planned.

Touches filesystem isolation, child ownership/concurrency, durable operational state and CI cache routing. Executor: Codex write leaf at sensitive role, resolved through executor-profiles and the model registry because the workflow path is sensitive. No full-history context fork. Root writes only plan/record artifacts and owns arbitration, integration, proof, scoped commits and release. Implementation and any repair remain launcher write leaves. Fresh read-only leaves run the lens review.

PROOF COMMAND, in this order after implementation, outside a concurrent gate run:

```bash
pnpm mutation:runner:test
pnpm gates:child-supervisor:test
pnpm gates:push:test
pnpm gates:receipt:test
pnpm build-vite
BACKEND_MUTATION_PACKAGE=engine-protocol pnpm mutation:backend
pnpm mutation:guard:check
pnpm checks:pre-review
pnpm gates:contract:check
```

The new fixture assertions cover each Approach obligation and a git-anchored revert of isolated source execution. Use bounded barriers and existing process teardown rather than timing repetition. The real mutation package proves Tauri's complete snapshot compile/test boundary, without requiring a whole eight-package mutation run. Existing tests continue to select all eight packages structurally. Record any altered standalone-verifier failure matrix with its artefact as required by push-review-policy §2.

The adopting build continues through cumulative diff review and repair closure before final gates. Required final command on the clean reviewed tree: `pnpm gates:push -- --rust --frontend --bindings`, because the changed workflow and mutation build/cache inputs affect toolchain execution. Review CI jobs through the canonical push skill, push ordinarily, verify landed HEAD, and satisfy its required remote jobs/installation obligations. No UI browser pass is needed for this tooling-only phase.

## Carried to diff review

None at initial revision.

### plan-r2.md

# Plan: Isolate backend mutation from the live checkout

## Goal

Close f-20260929-12 by preventing the backend mutation runner from injecting source or build artefacts into the checkout that push gates measure. This is a PLAN-ONLY run at b2663061a8d20d3f969c851c3ef9ce5d025b4cbb. Stop after reviewed planning outputs, before Preflight, implementation, ledger mutations, commits or push.

## MANDATE

### A backend mutation run can start after the push gates' one-shot mutation guard and mutate the tree under them

* **ID:** f-20260929-12 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/run-backend-mutation.mjs` `--check-guard` (exits 0 at once when no fence exists, ~line 183) and fence acquisition (~373-384); `gates:contract:check` (guard is its first member) and every gate run after it.
* **Defect:** the guard is a point-in-time check. A `pnpm mutation:backend` started (by another session or agent) after the guard passed acquires the fence and edits tracked `src-tauri` sources in place while the push gates are still compiling and testing, so a gate can measure mutated code — or record a receipt over it if the mutant is reverted before the receipt's second sample. Pre-existing in the serial push chain; the 2026-09-29 push-gate lane runner keeps the same one-shot check.
* **Why it matters:** a green gate or receipt over a tree that briefly contained an injected mutant.
* **Open question:** should a push-gate run hold a shared "gates running" lease that the backend mutation runner refuses on (and vice versa), and where does that lease live so a crashed gate run cannot block mutation forever?
* **Found by:** Codex `review-plan` lens, round 5 of `tasks/plans/2026-09-29-push-gate-parallelism.md`, 2026-09-29.

Correction 2026-09-30 (records review): "the 2026-09-29 push-gate lane runner keeps the same one-shot check" describes a planned runner, not code at HEAD — `scripts/run-push-gates.mjs` exists only in the untracked plan `tasks/plans/2026-09-29-push-gate-parallelism.md`, and `$push` still runs its gates serially. The defect stands for the serial chain today and for the runner if it lands with the same guard.

## Threat model and non-goals

Ordinary independent agent or shell sessions on Linux start the supported runner while gates are reading the checkout. Catchable interruption, parent SIGKILL, command failure and an ordinary source edit during preparation are relevant. The Cargo executable is the existing trusted tool, not an adversary that deliberately escapes its specified workspace. Editors, Git commands, destructive external cleanup and malicious environment/configuration injection are outside the guarantee. Existing supported Linux execution and Ubuntu mutation CI are required. No claim of newly enabling mutation on macOS or Windows is made. Existing gate routes on those systems remain unchanged.

## Traced premises

* `scripts/run-backend-mutation.mjs:184` observes the fence without reserving gate ownership. `:200`, `:229`, `:341`, `:377` implement dirty-backend refusal, exclusive durable creation, marker verification and startup respectively. `:297` selects `--in-place`, and `:416` spawns without an explicit isolated cwd.
* `scripts/run-push-gates.mjs:1112` performs the one-shot guard before the schedule. `:1034` is the separate pre-review path. `scripts/gate-receipt.mjs:474` acknowledges that sampling can miss a transient change and restoration.
* `package.json:20`, `:21`, `:26`, `:27`, `:62` route direct contract gates, strict push/receipt gates and the unwrapped backend mutation runner. The installed `agent-gate` holds a machine-wide lock, but backend mutation and standalone contract calls are outside it. It is not a checkout mutation protocol.
* `src-tauri/tauri.conf.json:33`, `:42` refer to sibling sound and dist directories. `src-tauri/src/fs.rs:3851`, `:3884`, `:3917` compile sibling catalogs/signatures into tests. `src-tauri/src/infra/path_authority/mod.rs:21360` compiles the repository's mutation runner source. `src-tauri/Cargo.toml:102` includes the vendored PGN dependency. A crate-only copy is incomplete.
* Upstream cargo-mutants 27.1.0 [build directory implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/build_dir.rs) uses the Cargo workspace root for its copy. Its [copy implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/copy_tree.rs) excludes the immediate target directory and preserves symlinks. Removing `--in-place` alone neither includes sibling inputs nor guarantees independent source files. The installed CLI reports cargo-mutants 27.1.0. Installed Rust source for it is unavailable, so tagged source is supporting evidence rather than local binary provenance.
* `scripts/mutation-runner-test-harness.mjs:35` supplies detached CLI fixtures and cleanup. `scripts/run-backend-mutation-tests.mjs:148` races the parent's owner record by reading after the child shim's marker. Existing f-20261005-08 already records this defect. The same runner/record change below includes its necessary correction without inventing a new finding.
* `scripts/child-supervisor.mjs:47`, `:61` support process-group sweeping and group-aware supervision. These prove only the selected group. cargo-mutants 27.1.0 [process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87) calls [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34), which places Cargo build/test children into independent groups. Neither immediate-child exit nor outer-group disappearance proves all mutation descendants have stopped.
* The existing launcher containment artifact `/home/felixb/.claude/scripts/leaf_contain.py:47`, `:210`, `:286` provides a Linux subreaper/ECHILD lifetime model across descendant sessions. A disposable probe against that real artifact produced exit receipt 0 and no surviving `/proc` entry for a separate-session child that ignored SIGTERM after its parent exited. Result: `subreaper-probe-result.json` in RUN_TMP, 3.16 seconds. This measures the kernel/established artifact, not the future repository implementation. Linux [subreaper](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html) and [wait](https://man7.org/linux/man-pages/man2/wait.2.html) contracts support this terminal model.
* Decisions d-20260830-10, d-20260930-04 and d-20261002-01 preserve the durable fence/no-override guard, gate schedule and strict launcher. d-20261001-02's lane-selection contract survives its launcher supersession. None settles the isolation question, so Entry remains build.
* Completed locate reports are `probe-1-r1.txt` and `probe-2-r1.txt` in RUN_TMP. The worktree has no dist or build target yet. Runtime snapshot compilation is an implementation proof, not evidence available to this planner.

## Approach

### Independent mutation inputs and outputs

Authority: MANDATE's "edits tracked `src-tauri` sources in place while the push gates are still compiling and testing" and "a green gate or receipt over a tree that briefly contained an injected mutant".

The existing runner owns one private run snapshot. Snapshot the current tracked repository file set with its relative layout, plus the required existing built `dist/`. Include backend vendor/config/resources, sound, renderer catalogs/signatures and Rust source-text test inputs. Exclude Git metadata, dependency installations, source/build caches, prior mutation output and secret files. Enumerate with Git, copy independent regular files, and reject symlinks or non-directory ancestors for copied inputs. Never hardlink or symlink source, dist or resource files back to the live tree. Preserve executable modes where needed. Fail preparation with an actionable nonzero result if required inputs are absent, copying is incomplete or verification detects a source change during capture. Verify the captured input manifest and bytes before starting the baseline. This is snapshot consistency at preparation, not an editor lock across the subsequent run.

Use the existing selected package commands and cargo-mutants `--in-place` only inside that snapshot. Explicitly set Cargo's cwd, manifest, absolute mutation output and target paths. A single worktree-specific mutation-only target cache is reused across packages and successive runs, with one package/job owner at a time. Neither inherited CARGO_TARGET_DIR nor a live target alias may redirect builds to `src-tauri/target`. Keep ordinary installed app and gate build outputs independent. Existing baseline, filters, eight-package coverage, containment, minimum timeout, survivor semantics and report locations remain intact.

One runner implements snapshot ownership. No gate lease, watcher, daemon or process-control service is introduced. The zero-software route is keeping mutation and gates manually separate, which cannot protect the unattended class in MANDATE. The snapshot is owned by the existing one-shot command and disappears through that command's cleanup. Its removal path is retiring the snapshot operation and its private mutation cache after mutation is no longer used.

Proof level: execute the real runner with Cargo shims that edit and restore snapshot source while a concurrent gate fixture reads the live source and records a receipt. Assert the live bytes and metadata never change, the mutation cwd and build target are distinct, and all mutations occur only in copied files. The central assertion must fail when the runner's isolated cwd is reverted to the live checkout.

### Fence ownership and terminal cleanup

Authority: MANDATE's crash question and the frozen catchable interruption/parent-SIGKILL threat model. This retains d-20260830-10 rather than removing a protection before isolation is proven.

Keep dirty-backend refusal, exclusive durable fence acquisition and `--check-guard` behavior. Gates starting after a fence exists may still refuse conservatively. A mutation that starts after a gate's guard now changes only its snapshot. No gate-side protocol is required to preserve the live tree.

Publish the operation's snapshot/cache identity and containment-owner identity as a complete atomic durable owner record. Preserve exclusive initial creation and retain the fence if finalisation cannot establish safe terminal state. Replace truncate-then-write recording and make tests await the parent's completed record rather than the shim's spawn marker. This covers the already-filed same-file f-20261005-08, which the adopting run can close with its evidence. An absent legacy snapshot field remains recoverable under the existing procedure.

On completion, failure or catchable signal, stop/reap all owned mutation descendants before removing the owned snapshot or admitting another cache owner. Place Cargo under one invocation-owned Linux subreaper. It establishes ownership before spawning Cargo, survives the Cargo parent's exit, terminates/reaps adopted descendants across process groups/sessions, and publishes terminal evidence only after the kernel reports no unwaited children. It must not create new children after that terminal check. Identity-safe signalling must not target a reused unrelated PID. Reuse the existing Node signal/status supervision at the containment-owner boundary, but never treat its exit or an empty outer group as subtree evidence.

Use a minimal repository-contained Python 3 one-shot process wrapper for this kernel boundary, without a dependency on Felix's home directory or an agent-kit installation in CI. It owns no snapshots, caches, ledger or generic daemon state. Existing group supervision cannot perform adoption/reaping, and Node has no existing native subreaper binding here. This is the last-resort helper needed by the observed ordinary cargo-mutants group boundary, not a parallel gate service. Its removal path is replacing it with an already available command boundary that proves the same all-descendant terminal condition. Python/subreaper capability refusal occurs before any Cargo child, with actionable nonzero failure. Side-effect-free listing and guard checks remain independent of Python, including non-Linux gate callers.

Do not clear the fence on missing terminal evidence, containment-owner signal death, unreadable state or cleanup failure. If teardown cannot establish terminal state within its bounded grace, retain the private snapshot and fence and report failure instead of releasing the shared cache. Parent SIGKILL leaves the durable fence and possibly a live containment owner/private snapshot. The one-shot owner can finish its subtree without the runner, but it cannot clear the fence. Recovery first establishes no relevant mutation descendants remain, checks the live checkout for legacy markers, and removes only the recorded owned snapshot/fence. Owner death without terminal evidence is unknown, not proof of an empty subtree. Recovery in that case retains the existing explicit process inspection/termination prerequisite. It never restores the entire backend, removes the reusable cache during ordinary finalisation, or deletes an arbitrary path from malformed metadata. Unknown or malformed ownership refuses cleanup and explains the limit. No age reclamation or background sweep is added.

Proof level: owned-process fixture barriers exercise normal exit, spawn failure, cancellation, SIGKILL with a surviving descendant, cleanup refusal and a competing runner. A Cargo shim must create a separately grouped/session descendant that ignores SIGTERM, then exit before that descendant. Require its reaping and terminal evidence before snapshot/fence removal. Inject missing/failed terminal evidence and confirm another runner cannot reuse the cache. Exercise runner death and containment-owner death separately. Verify conservative fence retention and no live-source mutation. A retained fence may block subsequent work until safe recovery, as it does today.

### Integration and operational evidence

Authority: MANDATE's supported `pnpm mutation:backend` and gate/receipt interaction, plus mandatory verification of the changed execution boundary.

Keep package entry points and P0/P1/P2/pre-review schedules unchanged. Update the runner header, CLAUDE.md's mutation description, and the canonical push skill to distinguish private snapshot mutation from legacy interrupted live mutation. Backend mutation remains outside the push gate schedule. Update mutation CI caching to the actual isolated target cache while preserving its package matrix, tool version, report uploads and all job failure behavior. Match any affected operational prose to the same contract, without editing historical decisions into agreement.

Run an actual engine-protocol mutation package in the isolated repository layout after producing dist, as well as the fixture suite. Record output locations and the live checkout's unchanged source/target observations. If the real baseline fails because a compile-time sibling input was omitted, extend the snapshot's concrete input coverage and rerun. Do not lower mutation/coverage floors or skip the baseline. Exercise refusal paths with scratch inputs and retain per-assertion unique diagnostics and statuses for any changed standalone verifier. Prefer behavioral subprocess tests to additional source scanners.

## Decisions and trade-offs

The initial locate considered a shared gate lease. Further trace showed that every package-manager and descendant boundary would need lifetime participation. Source isolation removes the mechanism at its only writer and avoids a new cross-run gate protocol. This is a technical choice, not a product change. Snapshot storage and a separate persistent mutation cache are the cost. The live target is not reused because Tauri's build outputs/resources and separate Cargo build/test invocations would then need additional coordination.

Existing safety decisions stay in force. There is no claim that current gates are safe against arbitrary editors or that an interrupted run is automatically recovered. Existing unrelated gate-scripts findings stay open at their current tiers. Only the selected finding and the directly coupled fence-record defect are planned here.

## Decided autonomously

* Question: Gate lifetime lease or isolated mutation source? Chosen: an owned independent source snapshot and mutation-only target cache. Rejected: a shared lease across every gate, package manager and descendant, and a machine-wide lock-only wrapper. Reason: isolation eliminates injected source and build output from the tree being measured at the sole writer. Reversal path: replace the snapshot contract only after a simpler protocol has proved the same gate overlap, interruption and descendant cases. The adopting session records this decision with Governs f-20260929-12.
* Question: Remove existing fence and push preflight once mutation is isolated? Chosen: retain them, including dirty-backend refusal and no override. Rejected: simultaneous retirement. Reason: legacy interrupted live mutations and unknown descendant cleanup still need the established safety boundary. Reversal path: a later evidenced decision after isolation and recovery have shipped, preserving legacy marker refusal.
* Question: Acceptance and scope? Chosen: agent-owned subprocess/runtime acceptance of this tooling change, one cohesive mutation-runner phase, including the existing same-file fence record race. Rejected: browser acceptance or a redesign of gate receipts. Reason: no product UI changes and the defect is at the runner's filesystem/process boundary. The adopting session records the necessary technical calls, with no claim of a Felix decision.
* Question: How is descendant completion proved across cargo-mutants' independent groups? Chosen: one invocation-owned Linux subreaper with positive all-descendant terminal evidence and conservative retention when that evidence is absent. Rejected: treating outer-group disappearance or cargo exit as complete cleanup, and requiring a machine-specific user systemd service in Ubuntu CI. Reason: tagged cargo-mutants source and the existing containment probe show the production boundary and an available kernel solution. Reversal path: an already available boundary that proves the same cases without this wrapper. This decision is the correction to review issue I1.

## Risks / open questions

No unresolved product question. The real build and clean-cache startup are not measured in this lane. Private helper choices belong to the executor. A scratch snapshot may remain after uncatchable interruption, but it cannot corrupt the live checkout. The existing durable fence intentionally requires recovery. Linux is the runtime proof environment, not evidence of additional platform support.

## Not part of this task

Gate scheduler changes, receipt fingerprint redesign, general editor/Git exclusion, new machine-wide tooling, changed mutation packages, mutation score policy, full frontend audit, renderer/native product behavior, coverage rebaselining or release/deployment.

## Phases

One cohesive phase, because snapshot, owner record, child cleanup, tests and CI cache wiring share the same runner contract and cannot be shipped independently.

Files: `scripts/run-backend-mutation.mjs`, `scripts/run-backend-mutation-tests.mjs`, new `scripts/mutation-process-containment.py`, `scripts/mutation-runner-test-harness.mjs` only if its shared fixture API needs extension, `.github/workflows/mutation.yml`, `CLAUDE.md`, `.claude/skills/push/SKILL.md`. Snapshot implementation stays in the runner unless a demonstrated second caller warrants extraction. The subprocess fixture suite verifies the new wrapper through the real runner, so no new package command or standalone gate is introduced. No package.json, gate schedule, generated bindings or application source edit is planned.

Touches filesystem isolation, child ownership/concurrency, durable operational state and CI cache routing. Executor: Codex write leaf at sensitive role, resolved through executor-profiles and the model registry because the workflow path is sensitive. No full-history context fork. Root writes only plan/record artifacts and owns arbitration, integration, proof, scoped commits and release. Implementation and any repair remain launcher write leaves. Fresh read-only leaves run the lens review.

PROOF COMMAND, in this order after implementation, outside a concurrent gate run:

```bash
pnpm mutation:runner:test
pnpm gates:child-supervisor:test
pnpm gates:push:test
pnpm gates:receipt:test
pnpm build-vite
BACKEND_MUTATION_PACKAGE=engine-protocol pnpm mutation:backend
pnpm mutation:guard:check
pnpm checks:pre-review
pnpm gates:contract:check
```

The new fixture assertions cover each Approach obligation and a git-anchored revert of isolated source execution. Use bounded barriers and existing process teardown rather than timing repetition. The real mutation package proves Tauri's complete snapshot compile/test boundary, without requiring a whole eight-package mutation run. Existing tests continue to select all eight packages structurally. Record any altered standalone-verifier failure matrix with its artefact as required by push-review-policy §2.

The adopting build continues through cumulative diff review and repair closure before final gates. Required final command on the clean reviewed tree: `pnpm gates:push -- --rust --frontend --bindings`, because the changed workflow and mutation build/cache inputs affect toolchain execution. Review CI jobs through the canonical push skill, push ordinarily, verify landed HEAD, and satisfy its required remote jobs/installation obligations. No UI browser pass is needed for this tooling-only phase.

## Carried to diff review

None at initial revision.

## Reviews

### Round 1 — initial source-isolation plan

Candidate: plan-r1.md, base b2663061a8d20d3f969c851c3ef9ce5d025b4cbb.
All twelve plan-capable user/project lenses ran in parallel as fresh read-only Codex launcher leaves.
review-plan used review-plan role. Others used sensitive because the workflow is a sensitive path.
Source bodies were transferred unchanged after stripping YAML. Diff-only root-cause/code-quality
lenses were excluded by their canonical frontmatter. Raw reports are preserved below.

Wall elapsed through review, triage and correction: 516.18 seconds. Active review wall time:
unknown. Known non-overlapping quota/dependency/release/other waits: none observed. Parallel leaf
durations were not summed. Polling while reviewers worked is review elapsed. Completed rounds: 1.
Raw findings: 1 blocker. Unique IDs opened: I1. Plan-level adopted findings: r1=1.
Unresolved/closed issue totals: 1/0. Correction-introduced defects: none observed. I1 identifies
a pre-existing group boundary missed by the initial plan, not a newly introduced source defect.
Withdrawals, rewrites, splits and inherited review totals: none. Open obligations: I1 closure
and all three implementation Approach obligations. Downstream implementation/final-review rework:
not observed in this PLAN-ONLY lane.

Six NOT APPLICABLE exits were checked against their canonical descriptions. Chess semantics,
UCI protocol, IPC, renderer storage, PGN indexes and native Tauri security are unaffected. Platform
semantics applies to Linux process/fixture assumptions and reviewed them. Other raw verdicts are
APPROVED. Runtime limitations remain implementation obligations, not completed proof.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Issue I1 — outer group is not the complete Cargo subtree

* Witness: review-plan r1 raw finding 1, blocker, confidence 95. Raw verdict: REVISE.
* Disposition: Fix. Claim confirmed by `scripts/child-supervisor.mjs:49–52`, cargo-mutants
  27.1.0 `src/process.rs:87` and `src/process/unix.rs:34`. The latter sets a distinct process
  group for each Cargo build/test command. Outer-group disappearance can leave an ordinary
  descendant running against the private snapshot/reusable cache.
* Evidence: both tagged primary sources were opened. The existing production launcher artifact
  `~/.claude/scripts/leaf_contain.py:47`, `:210`, `:286` was then executed against a separate-session
  descendant that ignores SIGTERM and outlives its direct parent. It returned 0, wrote terminal
  receipt 0 and left no descendant `/proc` entry after 3.16 seconds. Exact command and observed
  result are retained in RUN_TMP `probe-subreaper.py` and `subreaper-probe-result.json`.
  This is evidence for the kernel/existing artifact, not proof of future repo code or binary provenance.
* Affected MANDATE obligation: preserving a safe interrupted runner that cannot admit another
  mutation owner while the previous one still uses its reusable build cache. Source isolation
  protects gates, but the claimed cleanup boundary must hold for the actual tool's descendants.
* Authority for the new containment mechanism: fixed threat model's “Catchable interruption,
  parent SIGKILL, command failure” and MANDATE's “where does that lease live so a crashed gate
  run cannot block mutation forever?” The retained mutation fence owns this terminal boundary.
* Correction revision: r2 candidate. “Fence ownership and terminal cleanup” now requires an
  invocation-owned Linux subreaper, positive terminal evidence after all descendants are reaped,
  and conservative retention on missing evidence. New one-shot Python wrapper is repository-contained
  for Ubuntu CI. It owns no source/cache/ledger state and creates no background service. Node's
  existing supervision remains at the containment-owner boundary. Listing and guard stay Python-free.
* Dependent acceptance: separate-group/session descendant ignoring TERM, outer Cargo parent exit,
  runner death, containment-owner death, missing terminal evidence, retained fence and competing
  cache owner refusal. New fixture must fail if containment is replaced by the old outer-group sweep.
* Dependencies: none. Closure: pending fresh reviewer check against actual r2 candidate.

### Raw reports — round 1

#### review-correctness

```text
No correctness defects found in the plan’s snapshot, fence ownership or CI integration contracts.

Limitation (confidence: 95): real Cargo descendant termination and snapshot baseline compilation remain unverified. No runtime commands were run in this plan-only review.

Review used the same model family as planned implementation.

VERDICT: APPROVED
```

#### review-error-handling

```text
No error-handling defects found in the proposed obligations. Preparation failures return actionable nonzero results, uncertain termination or cleanup retains the fence, and malformed ownership refuses recovery.

Limitation: runtime failure behavior remains unverified until implementation and the specified fixtures run (confidence: 100). This review uses the same model family as the planned implementation.

VERDICT: APPROVED
```

#### review-minimalism

```text
No bloat or duplication findings. The plan keeps isolation in the existing runner, reuses process supervision and the shared fixture harness, and ties cleanup, CI caching and runtime proof to the changed execution boundary.

Limitation: helper-level duplication requires implementation diff review (confidence: 100). Detection used the same model family as planned implementation.

VERDICT: APPROVED
```

#### review-plan

```text
[blocker] tasks/plans/2026-10-09-backend-mutation-isolation.md:58 — “Fence ownership and terminal cleanup” cannot establish descendant termination through the specified group supervision alone. `scripts/child-supervisor.mjs:49–52` kills and probes only the top-level child’s process group. However, cargo-mutants 27.1.0 creates separate groups for Cargo build/test children ([process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87), [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34)). During cancellation escalation, the outer group can disappear while a separately grouped descendant survives. Clearing the fence then allows another runner to reuse the mutation cache concurrently. These are ordinary trusted-tool descendants within the stated threat model. Specify termination evidence across these group boundaries, conservative retention when that evidence is unavailable, and a behavioral fixture exercising a surviving descendant in a separate group. The generic descendant fixtures at plan:60 do not require that production boundary (confidence: 95).

Limitations: tagged source was inspected, but installed-binary provenance and runtime cleanup were not verified. No proof commands ran and no files changed (confidence: 100). Review used the same model family as the planned implementation.

VERDICT: REVISE
```

#### review-tests

```text
No plan-level verification gaps found. The proposed live-byte assertion would fail on reverting isolated execution. The fixture suite is registered in the unconditional contract gate and CI. The real engine-protocol baseline checks snapshot compile inputs.

This reviews proposed proof only. No tests ran. Detection uses the same model family as the planned implementation.

VERDICT: APPROVED
```

#### review-chess-semantics

```text
NOT APPLICABLE: The files and obligations concern filesystem snapshots, mutation-process ownership, cleanup and CI caching. No in-memory chess tree, position identity, move path, parity, variation selection or metadata round trip changes are planned.
VERDICT: APPROVED
```

#### review-engine-protocol

```text
NOT APPLICABLE: The files and obligations concern mutation-runner isolation, Cargo child ownership, fence recovery and CI caching. They do not change UCI engine supervision, protocol state or asynchronous result routing. The engine-protocol baseline exercises existing code without changing those contracts.
VERDICT: APPROVED
```

#### review-ipc-contract

```text
NOT APPLICABLE: The listed files and three Approach obligations concern mutation snapshot isolation, fence cleanup and tooling verification. They introduce no Rust↔renderer command, event, subscription or capability contract changes.
VERDICT: APPROVED
```

#### review-persisted-state

```text
NOT APPLICABLE: The listed files and three Approach obligations concern backend mutation snapshots, fence ownership, cleanup and gate integration. They do not change renderer storage, persisted atoms or tab lifecycle.
VERDICT: APPROVED
```

#### review-pgn-index

```text
NOT APPLICABLE: The plan’s files and obligations concern mutation-runner isolation, fence ownership, cleanup and CI caching. They do not change PGN scanning, byte offsets, encoding, database storage or search.
VERDICT: APPROVED
```

#### review-platform-semantics

```text
No platform-semantics findings. The plan confines mutation runtime guarantees to Linux and Ubuntu CI, consistent with the existing `/proc` identity and process-group mechanisms.

Proof remains pending. No gates, Windows compile check or non-Linux Unix source probe ran. `rust-windows-test` and `rust-macos-test` provide Rust runtime evidence only, not mutation-runner portability.

Review used the same model family as planned implementation. No files changed.

VERDICT: APPROVED
```

#### review-tauri-security

```text
NOT APPLICABLE: The files and obligations concern mutation-runner snapshots, process ownership, cleanup and gate integration. They do not change native credential/session flows, application filesystem authority, signed downloads or backend data egress. Runner snapshot cleanup falls outside this lens’s native security boundary.

VERDICT: APPROVED
```


### plan-r3.md

# Plan: Isolate backend mutation from the live checkout

## Goal

Close f-20260929-12 by preventing the backend mutation runner from injecting source or build artefacts into the checkout that push gates measure. The plan was authored at b2663061a8d20d3f969c851c3ef9ce5d025b4cbb and is now in PLAN-REFRESH at ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Stop after reviewed planning outputs, before Preflight, implementation, ledger mutations, commits or push.

## MANDATE

### A backend mutation run can start after the push gates' one-shot mutation guard and mutate the tree under them

* **ID:** f-20260929-12 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/run-backend-mutation.mjs` `--check-guard` (exits 0 at once when no fence exists, ~line 183) and fence acquisition (~373-384); `gates:contract:check` (guard is its first member) and every gate run after it.
* **Defect:** the guard is a point-in-time check. A `pnpm mutation:backend` started (by another session or agent) after the guard passed acquires the fence and edits tracked `src-tauri` sources in place while the push gates are still compiling and testing, so a gate can measure mutated code — or record a receipt over it if the mutant is reverted before the receipt's second sample. Pre-existing in the serial push chain; the 2026-09-29 push-gate lane runner keeps the same one-shot check.
* **Why it matters:** a green gate or receipt over a tree that briefly contained an injected mutant.
* **Open question:** should a push-gate run hold a shared "gates running" lease that the backend mutation runner refuses on (and vice versa), and where does that lease live so a crashed gate run cannot block mutation forever?
* **Found by:** Codex `review-plan` lens, round 5 of `tasks/plans/2026-09-29-push-gate-parallelism.md`, 2026-09-29.

Correction 2026-09-30 (records review): "the 2026-09-29 push-gate lane runner keeps the same one-shot check" describes a planned runner, not code at HEAD — `scripts/run-push-gates.mjs` exists only in the untracked plan `tasks/plans/2026-09-29-push-gate-parallelism.md`, and `$push` still runs its gates serially. The defect stands for the serial chain today and for the runner if it lands with the same guard.

## Threat model and non-goals

Ordinary independent agent or shell sessions on Linux start the supported runner while gates are reading the checkout. Catchable interruption, parent SIGKILL, command failure and an ordinary source edit during preparation are relevant. The Cargo executable is the existing trusted tool, not an adversary that deliberately escapes its specified workspace. Editors, Git commands, destructive external cleanup and malicious environment/configuration injection are outside the guarantee. Existing supported Linux execution and Ubuntu mutation CI are required. No claim of newly enabling mutation on macOS or Windows is made. Existing gate routes on those systems remain unchanged.

## Traced premises

* `scripts/run-backend-mutation.mjs:184` observes the fence without reserving gate ownership. `:200`, `:229`, `:341`, `:377` implement dirty-backend refusal, exclusive durable creation, marker verification and startup respectively. `:297` selects `--in-place`, and `:416` spawns without an explicit isolated cwd.
* `scripts/run-push-gates.mjs:1112` performs the one-shot guard before the schedule. `:1034` is the separate pre-review path. `scripts/gate-receipt.mjs:474` acknowledges that sampling can miss a transient change and restoration.
* `package.json:20`, `:21`, `:26`, `:27`, `:62` route direct contract gates, strict push/receipt gates and the unwrapped backend mutation runner. The installed `agent-gate` holds a machine-wide lock, but backend mutation and standalone contract calls are outside it. It is not a checkout mutation protocol.
* `src-tauri/tauri.conf.json:33`, `:42` refer to sibling sound and dist directories. `src-tauri/src/fs.rs:3851`, `:3884`, `:3917` compile sibling catalogs/signatures into tests. `src-tauri/src/infra/path_authority/mod.rs:21360` compiles the repository's mutation runner source. `src-tauri/Cargo.toml:102` includes the vendored PGN dependency. A crate-only copy is incomplete.
* Upstream cargo-mutants 27.1.0 [build directory implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/build_dir.rs) uses the Cargo workspace root for its copy. Its [copy implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/copy_tree.rs) excludes the immediate target directory and preserves symlinks. Removing `--in-place` alone neither includes sibling inputs nor guarantees independent source files. The installed CLI reports cargo-mutants 27.1.0. Installed Rust source for it is unavailable, so tagged source is supporting evidence rather than local binary provenance.
* `scripts/mutation-runner-test-harness.mjs:35` supplies detached CLI fixtures and cleanup. `scripts/run-backend-mutation-tests.mjs:148` races the parent's owner record by reading after the child shim's marker. Existing f-20261005-08 already records this defect. The same runner/record change below includes its necessary correction without inventing a new finding.
* `scripts/child-supervisor.mjs:47`, `:61` support process-group sweeping and group-aware supervision. These prove only the selected group. cargo-mutants 27.1.0 [process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87) calls [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34), which places Cargo build/test children into independent groups. Neither immediate-child exit nor outer-group disappearance proves all mutation descendants have stopped.
* The existing launcher containment artifact `/home/felixb/.claude/scripts/leaf_contain.py:47`, `:210`, `:286` provides a Linux subreaper/ECHILD lifetime model across descendant sessions. A disposable probe against that real artifact produced exit receipt 0 and no surviving `/proc` entry for a separate-session child that ignored SIGTERM after its parent exited. Result: `subreaper-probe-result.json` in RUN_TMP, 3.16 seconds. This measures the kernel/established artifact, not the future repository implementation. Linux [subreaper](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html) and [wait](https://man7.org/linux/man-pages/man2/wait.2.html) contracts support this terminal model.
* Decisions d-20260830-10, d-20260930-04 and d-20261002-01 preserve the durable fence/no-override guard, gate schedule and strict launcher. d-20261001-02's lane-selection contract survives its launcher supersession. None settles the isolation question, so Entry remains build.
* Completed locate reports are `probe-1-r1.txt` and `probe-2-r1.txt` in RUN_TMP. The worktree has no dist or build target yet. Runtime snapshot compilation is an implementation proof, not evidence available to this planner.

## Approach

### Independent mutation inputs and outputs

Authority: MANDATE's "edits tracked `src-tauri` sources in place while the push gates are still compiling and testing" and "a green gate or receipt over a tree that briefly contained an injected mutant".

The existing runner owns one private run snapshot. Snapshot the current tracked repository file set with its relative layout, plus the required existing built `dist/`. Include backend vendor/config/resources, sound, renderer catalogs/signatures and Rust source-text test inputs. Exclude Git metadata, dependency installations, source/build caches, prior mutation output and secret files. Enumerate with Git, copy independent regular files, and reject symlinks or non-directory ancestors for copied inputs. Never hardlink or symlink source, dist or resource files back to the live tree. Preserve executable modes where needed. Fail preparation with an actionable nonzero result if required inputs are absent, copying is incomplete or verification detects a source change during capture. Verify the captured input manifest and bytes before starting the baseline. This is snapshot consistency at preparation, not an editor lock across the subsequent run.

Use the existing selected package commands and cargo-mutants `--in-place` only inside that snapshot. Explicitly set Cargo's cwd, manifest, absolute mutation output and target paths. A single worktree-specific mutation-only target cache is reused across packages and successive runs, with one package/job owner at a time. Neither inherited CARGO_TARGET_DIR nor a live target alias may redirect builds to `src-tauri/target`. Keep ordinary installed app and gate build outputs independent. Existing baseline, filters, eight-package coverage, containment, minimum timeout, survivor semantics and report locations remain intact.

One runner implements snapshot ownership. No gate lease, watcher, daemon or process-control service is introduced. The zero-software route is keeping mutation and gates manually separate, which cannot protect the unattended class in MANDATE. The snapshot is owned by the existing one-shot command and disappears through that command's cleanup. Its removal path is retiring the snapshot operation and its private mutation cache after mutation is no longer used.

Proof level: execute the real runner with Cargo shims that edit and restore snapshot source while a concurrent gate fixture reads the live source and records a receipt. Assert the live bytes and metadata never change, the mutation cwd and build target are distinct, and all mutations occur only in copied files. The central assertion must fail when the runner's isolated cwd is reverted to the live checkout.

### Fence ownership and terminal cleanup

Authority: MANDATE's crash question and the frozen catchable interruption/parent-SIGKILL threat model. This retains d-20260830-10 rather than removing a protection before isolation is proven.

Keep dirty-backend refusal, exclusive durable fence acquisition and `--check-guard` behavior. Gates starting after a fence exists may still refuse conservatively. A mutation that starts after a gate's guard now changes only its snapshot. No gate-side protocol is required to preserve the live tree.

Publish the operation's snapshot/cache identity and containment-owner identity as a complete atomic durable owner record. Preserve exclusive initial creation and retain the fence if finalisation cannot establish safe terminal state. Replace truncate-then-write recording and make tests await the parent's completed record rather than the shim's spawn marker. This covers the already-filed same-file f-20261005-08, which the adopting run can close with its evidence. An absent legacy snapshot field remains recoverable under the existing procedure.

On completion, failure or catchable signal, stop/reap all owned mutation descendants before removing the owned snapshot or admitting another cache owner. Place Cargo under one invocation-owned Linux subreaper. It establishes ownership before spawning Cargo, survives the Cargo parent's exit, terminates/reaps adopted descendants across process groups/sessions, and publishes terminal evidence only after the kernel reports no unwaited children. It must not create new children after that terminal check. Identity-safe signalling must not target a reused unrelated PID. Reuse the existing Node signal/status supervision at the containment-owner boundary, but never treat its exit or an empty outer group as subtree evidence.

Use a minimal repository-contained Python 3 one-shot process wrapper for this kernel boundary, without a dependency on Felix's home directory or an agent-kit installation in CI. It owns no snapshots, caches, ledger or generic daemon state. Existing group supervision cannot perform adoption/reaping, and Node has no existing native subreaper binding here. This is the last-resort helper needed by the observed ordinary cargo-mutants group boundary, not a parallel gate service. Its removal path is replacing it with an already available command boundary that proves the same all-descendant terminal condition. Python/subreaper capability refusal occurs before any Cargo child, with actionable nonzero failure. Side-effect-free listing and guard checks remain independent of Python, including non-Linux gate callers.

Do not clear the fence on missing terminal evidence, containment-owner signal death, unreadable state or cleanup failure. If teardown cannot establish terminal state within its bounded grace, retain the private snapshot and fence and report failure instead of releasing the shared cache. Parent SIGKILL leaves the durable fence and possibly a live containment owner/private snapshot. The one-shot owner can finish its subtree without the runner, but it cannot clear the fence. Recovery first establishes no relevant mutation descendants remain, checks the live checkout for legacy markers, and removes only the recorded owned snapshot/fence. Owner death without terminal evidence is unknown, not proof of an empty subtree. Recovery in that case retains the existing explicit process inspection/termination prerequisite. It never restores the entire backend, removes the reusable cache during ordinary finalisation, or deletes an arbitrary path from malformed metadata. Unknown or malformed ownership refuses cleanup and explains the limit. No age reclamation or background sweep is added.

Proof level: owned-process fixture barriers exercise normal exit, spawn failure, cancellation, SIGKILL with a surviving descendant, cleanup refusal and a competing runner. A Cargo shim must create a separately grouped/session descendant that ignores SIGTERM, then exit before that descendant. Require its reaping and terminal evidence before snapshot/fence removal. Inject missing/failed terminal evidence and confirm another runner cannot reuse the cache. Exercise runner death and containment-owner death separately. Verify conservative fence retention and no live-source mutation. A retained fence may block subsequent work until safe recovery, as it does today.

### Integration and operational evidence

Authority: MANDATE's supported `pnpm mutation:backend` and gate/receipt interaction, plus mandatory verification of the changed execution boundary.

Keep package entry points and P0/P1/P2/pre-review schedules unchanged. Update the runner header, CLAUDE.md's mutation description, and the canonical push skill to distinguish private snapshot mutation from legacy interrupted live mutation. Backend mutation remains outside the push gate schedule. Update mutation CI caching to the actual isolated target cache while preserving its package matrix, tool version, report uploads and all job failure behavior. Match any affected operational prose to the same contract, without editing historical decisions into agreement.

Run an actual engine-protocol mutation package in the isolated repository layout after producing dist, as well as the fixture suite. Record output locations and the live checkout's unchanged source/target observations. If the real baseline fails because a compile-time sibling input was omitted, extend the snapshot's concrete input coverage and rerun. Do not lower mutation/coverage floors or skip the baseline. Exercise refusal paths with scratch inputs and retain per-assertion unique diagnostics and statuses for any changed standalone verifier. Prefer behavioral subprocess tests to additional source scanners.

## Decisions and trade-offs

The initial locate considered a shared gate lease. Further trace showed that every package-manager and descendant boundary would need lifetime participation. Source isolation removes the mechanism at its only writer and avoids a new cross-run gate protocol. This is a technical choice, not a product change. Snapshot storage and a separate persistent mutation cache are the cost. The live target is not reused because Tauri's build outputs/resources and separate Cargo build/test invocations would then need additional coordination.

Existing safety decisions stay in force. There is no claim that current gates are safe against arbitrary editors or that an interrupted run is automatically recovered. Existing unrelated gate-scripts findings stay open at their current tiers. Only the selected finding and the directly coupled fence-record defect are planned here.

## Decided autonomously

* Question: Gate lifetime lease or isolated mutation source? Chosen: an owned independent source snapshot and mutation-only target cache. Rejected: a shared lease across every gate, package manager and descendant, and a machine-wide lock-only wrapper. Reason: isolation eliminates injected source and build output from the tree being measured at the sole writer. Reversal path: replace the snapshot contract only after a simpler protocol has proved the same gate overlap, interruption and descendant cases. The adopting session records this decision with Governs f-20260929-12.
* Question: Remove existing fence and push preflight once mutation is isolated? Chosen: retain them, including dirty-backend refusal and no override. Rejected: simultaneous retirement. Reason: legacy interrupted live mutations and unknown descendant cleanup still need the established safety boundary. Reversal path: a later evidenced decision after isolation and recovery have shipped, preserving legacy marker refusal.
* Question: Acceptance and scope? Chosen: agent-owned subprocess/runtime acceptance of this tooling change, one cohesive mutation-runner phase, including the existing same-file fence record race. Rejected: browser acceptance or a redesign of gate receipts. Reason: no product UI changes and the defect is at the runner's filesystem/process boundary. The adopting session records the necessary technical calls, with no claim of a Felix decision.
* Question: How is descendant completion proved across cargo-mutants' independent groups? Chosen: one invocation-owned Linux subreaper with positive all-descendant terminal evidence and conservative retention when that evidence is absent. Rejected: treating outer-group disappearance or cargo exit as complete cleanup, and requiring a machine-specific user systemd service in Ubuntu CI. Reason: tagged cargo-mutants source and the existing containment probe show the production boundary and an available kernel solution. Reversal path: an already available boundary that proves the same cases without this wrapper. This decision is the correction to review issue I1.

## Risks / open questions

No unresolved product question. The real build and clean-cache startup are not measured in this lane. Private helper choices belong to the executor. A scratch snapshot may remain after uncatchable interruption, but it cannot corrupt the live checkout. The existing durable fence intentionally requires recovery. Linux is the runtime proof environment, not evidence of additional platform support.

## Not part of this task

Gate scheduler changes, receipt fingerprint redesign, general editor/Git exclusion, new machine-wide tooling, changed mutation packages, mutation score policy, full frontend audit, renderer/native product behavior, coverage rebaselining or release/deployment.

## Phases

One cohesive phase, because snapshot, owner record, child cleanup, tests and CI cache wiring share the same runner contract and cannot be shipped independently.

Files: `scripts/run-backend-mutation.mjs`, `scripts/run-backend-mutation-tests.mjs`, new `scripts/mutation-process-containment.py`, `scripts/mutation-runner-test-harness.mjs` only if its shared fixture API needs extension, `.github/workflows/mutation.yml`, `CLAUDE.md`, `.claude/skills/push/SKILL.md`. Snapshot implementation stays in the runner unless a demonstrated second caller warrants extraction. The subprocess fixture suite verifies the new wrapper through the real runner, so no new package command or standalone gate is introduced. No package.json, gate schedule, generated bindings or application source edit is planned.

Touches filesystem isolation, child ownership/concurrency, durable operational state and CI cache routing. Executor: Codex write leaf at sensitive role, resolved through executor-profiles and the model registry because the workflow path is sensitive. No full-history context fork. Root writes only plan/record artifacts and owns arbitration, integration, proof, scoped commits and release. Implementation and any repair remain launcher write leaves. Fresh read-only leaves run the lens review.

PROOF COMMAND, in this order after implementation, outside a concurrent gate run:

```bash
pnpm mutation:runner:test
pnpm gates:child-supervisor:test
pnpm gates:push:test
pnpm gates:receipt:test
pnpm build-vite
BACKEND_MUTATION_PACKAGE=engine-protocol pnpm mutation:backend
pnpm mutation:guard:check
pnpm checks:pre-review
pnpm gates:contract:check
```

The new fixture assertions cover each Approach obligation and a git-anchored revert of isolated source execution. Use bounded barriers and existing process teardown rather than timing repetition. The real mutation package proves Tauri's complete snapshot compile/test boundary, without requiring a whole eight-package mutation run. Existing tests continue to select all eight packages structurally. Record any altered standalone-verifier failure matrix with its artefact as required by push-review-policy §2.

The adopting build continues through cumulative diff review and repair closure before final gates. Required final command on the clean reviewed tree: `pnpm gates:push -- --rust --frontend --bindings`, because the changed workflow and mutation build/cache inputs affect toolchain execution. Review CI jobs through the canonical push skill, push ordinarily, verify landed HEAD, and satisfy its required remote jobs/installation obligations. No UI browser pass is needed for this tooling-only phase.

## Carried to diff review

None at initial revision.

## Reviews

### Round 1 — initial source-isolation plan

Candidate: plan-r1.md, base b2663061a8d20d3f969c851c3ef9ce5d025b4cbb.
All twelve plan-capable user/project lenses ran in parallel as fresh read-only Codex launcher leaves.
review-plan used review-plan role. Others used sensitive because the workflow is a sensitive path.
Source bodies were transferred unchanged after stripping YAML. Diff-only root-cause/code-quality
lenses were excluded by their canonical frontmatter. Raw reports are preserved below.

Wall elapsed through review, triage and correction: 516.18 seconds. Active review wall time:
unknown. Known non-overlapping quota/dependency/release/other waits: none observed. Parallel leaf
durations were not summed. Polling while reviewers worked is review elapsed. Completed rounds: 1.
Raw findings: 1 blocker. Unique IDs opened: I1. Plan-level adopted findings: r1=1.
Unresolved/closed issue totals: 1/0. Correction-introduced defects: none observed. I1 identifies
a pre-existing group boundary missed by the initial plan, not a newly introduced source defect.
Withdrawals, rewrites, splits and inherited review totals: none. Open obligations: I1 closure
and all three implementation Approach obligations. Downstream implementation/final-review rework:
not observed in this PLAN-ONLY lane.

Six NOT APPLICABLE exits were checked against their canonical descriptions. Chess semantics,
UCI protocol, IPC, renderer storage, PGN indexes and native Tauri security are unaffected. Platform
semantics applies to Linux process/fixture assumptions and reviewed them. Other raw verdicts are
APPROVED. Runtime limitations remain implementation obligations, not completed proof.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Issue I1 — outer group is not the complete Cargo subtree

* Witness: review-plan r1 raw finding 1, blocker, confidence 95. Raw verdict: REVISE.
* Disposition: Fix. Claim confirmed by `scripts/child-supervisor.mjs:49–52`, cargo-mutants
  27.1.0 `src/process.rs:87` and `src/process/unix.rs:34`. The latter sets a distinct process
  group for each Cargo build/test command. Outer-group disappearance can leave an ordinary
  descendant running against the private snapshot/reusable cache.
* Evidence: both tagged primary sources were opened. The existing production launcher artifact
  `~/.claude/scripts/leaf_contain.py:47`, `:210`, `:286` was then executed against a separate-session
  descendant that ignores SIGTERM and outlives its direct parent. It returned 0, wrote terminal
  receipt 0 and left no descendant `/proc` entry after 3.16 seconds. Exact command and observed
  result are retained in RUN_TMP `probe-subreaper.py` and `subreaper-probe-result.json`.
  This is evidence for the kernel/existing artifact, not proof of future repo code or binary provenance.
* Affected MANDATE obligation: preserving a safe interrupted runner that cannot admit another
  mutation owner while the previous one still uses its reusable build cache. Source isolation
  protects gates, but the claimed cleanup boundary must hold for the actual tool's descendants.
* Authority for the new containment mechanism: fixed threat model's “Catchable interruption,
  parent SIGKILL, command failure” and MANDATE's “where does that lease live so a crashed gate
  run cannot block mutation forever?” The retained mutation fence owns this terminal boundary.
* Correction revision: r2 candidate. “Fence ownership and terminal cleanup” now requires an
  invocation-owned Linux subreaper, positive terminal evidence after all descendants are reaped,
  and conservative retention on missing evidence. New one-shot Python wrapper is repository-contained
  for Ubuntu CI. It owns no source/cache/ledger state and creates no background service. Node's
  existing supervision remains at the containment-owner boundary. Listing and guard stay Python-free.
* Dependent acceptance: separate-group/session descendant ignoring TERM, outer Cargo parent exit,
  runner death, containment-owner death, missing terminal evidence, retained fence and competing
  cache owner refusal. New fixture must fail if containment is replaced by the old outer-group sweep.
* Dependencies: none. Closure: pending fresh reviewer check against actual r2 candidate.

### Raw reports — round 1

#### review-correctness

```text
No correctness defects found in the plan’s snapshot, fence ownership or CI integration contracts.

Limitation (confidence: 95): real Cargo descendant termination and snapshot baseline compilation remain unverified. No runtime commands were run in this plan-only review.

Review used the same model family as planned implementation.

VERDICT: APPROVED
```

#### review-error-handling

```text
No error-handling defects found in the proposed obligations. Preparation failures return actionable nonzero results, uncertain termination or cleanup retains the fence, and malformed ownership refuses recovery.

Limitation: runtime failure behavior remains unverified until implementation and the specified fixtures run (confidence: 100). This review uses the same model family as the planned implementation.

VERDICT: APPROVED
```

#### review-minimalism

```text
No bloat or duplication findings. The plan keeps isolation in the existing runner, reuses process supervision and the shared fixture harness, and ties cleanup, CI caching and runtime proof to the changed execution boundary.

Limitation: helper-level duplication requires implementation diff review (confidence: 100). Detection used the same model family as planned implementation.

VERDICT: APPROVED
```

#### review-plan

```text
[blocker] tasks/plans/2026-10-09-backend-mutation-isolation.md:58 — “Fence ownership and terminal cleanup” cannot establish descendant termination through the specified group supervision alone. `scripts/child-supervisor.mjs:49–52` kills and probes only the top-level child’s process group. However, cargo-mutants 27.1.0 creates separate groups for Cargo build/test children ([process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87), [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34)). During cancellation escalation, the outer group can disappear while a separately grouped descendant survives. Clearing the fence then allows another runner to reuse the mutation cache concurrently. These are ordinary trusted-tool descendants within the stated threat model. Specify termination evidence across these group boundaries, conservative retention when that evidence is unavailable, and a behavioral fixture exercising a surviving descendant in a separate group. The generic descendant fixtures at plan:60 do not require that production boundary (confidence: 95).

Limitations: tagged source was inspected, but installed-binary provenance and runtime cleanup were not verified. No proof commands ran and no files changed (confidence: 100). Review used the same model family as the planned implementation.

VERDICT: REVISE
```

#### review-tests

```text
No plan-level verification gaps found. The proposed live-byte assertion would fail on reverting isolated execution. The fixture suite is registered in the unconditional contract gate and CI. The real engine-protocol baseline checks snapshot compile inputs.

This reviews proposed proof only. No tests ran. Detection uses the same model family as the planned implementation.

VERDICT: APPROVED
```

#### review-chess-semantics

```text
NOT APPLICABLE: The files and obligations concern filesystem snapshots, mutation-process ownership, cleanup and CI caching. No in-memory chess tree, position identity, move path, parity, variation selection or metadata round trip changes are planned.
VERDICT: APPROVED
```

#### review-engine-protocol

```text
NOT APPLICABLE: The files and obligations concern mutation-runner isolation, Cargo child ownership, fence recovery and CI caching. They do not change UCI engine supervision, protocol state or asynchronous result routing. The engine-protocol baseline exercises existing code without changing those contracts.
VERDICT: APPROVED
```

#### review-ipc-contract

```text
NOT APPLICABLE: The listed files and three Approach obligations concern mutation snapshot isolation, fence cleanup and tooling verification. They introduce no Rust↔renderer command, event, subscription or capability contract changes.
VERDICT: APPROVED
```

#### review-persisted-state

```text
NOT APPLICABLE: The listed files and three Approach obligations concern backend mutation snapshots, fence ownership, cleanup and gate integration. They do not change renderer storage, persisted atoms or tab lifecycle.
VERDICT: APPROVED
```

#### review-pgn-index

```text
NOT APPLICABLE: The plan’s files and obligations concern mutation-runner isolation, fence ownership, cleanup and CI caching. They do not change PGN scanning, byte offsets, encoding, database storage or search.
VERDICT: APPROVED
```

#### review-platform-semantics

```text
No platform-semantics findings. The plan confines mutation runtime guarantees to Linux and Ubuntu CI, consistent with the existing `/proc` identity and process-group mechanisms.

Proof remains pending. No gates, Windows compile check or non-Linux Unix source probe ran. `rust-windows-test` and `rust-macos-test` provide Rust runtime evidence only, not mutation-runner portability.

Review used the same model family as planned implementation. No files changed.

VERDICT: APPROVED
```

#### review-tauri-security

```text
NOT APPLICABLE: The files and obligations concern mutation-runner snapshots, process ownership, cleanup and gate integration. They do not change native credential/session flows, application filesystem authority, signed downloads or backend data egress. Runner snapshot cleanup falls outside this lens’s native security boundary.

VERDICT: APPROVED
```



### Round 2 — complete descendant ownership correction and I1 closure

Last actually reviewed snapshot: plan-r1.md. Candidate: plan-r2.md at the same supplied base.
Six fresh read-only Codex launcher lenses ran in parallel: review-plan, its required witness,
and minimalism/correctness/error-handling/tests/platform-semantics for the newly specified
containment process boundary. No unaffected app domain lens was rerun by default. review-plan
used review-plan role, others sensitive. Each packet carried the body-only candidate, full record
lookup, fixed verbatim MANDATE, open I1, correction evidence and exact delta-script stdout.

Wall elapsed: 181.6 seconds from prompt preparation through all reports and arbitration.
Active review wall time: unknown. Known non-overlapping quota/dependency/release/other waits: none
observed. Parallel leaf durations were not summed. Polling while reviewers worked is review
elapsed. Cumulative completed rounds: 2. Plan-level adopted findings: r1=1 r2=0.
Round-2 raw findings: 0. Unique IDs opened: none, resolved: I1. Unresolved/closed totals: 0/1.
Correction-introduced defects, withdrawals, rewrites, splits and inherited review totals: none observed.
Open implementation obligations: all three Approach obligations, owned by the adopting build.
Downstream implementation/final-review rework: not observed in this PLAN-ONLY lane.

Arbitration: all round-2 raw verdicts are APPROVED. I1 is Fix, closed in round 2 by its required
review-plan witness against the changed obligation and dependent acceptance. Additional closure
observations are retained verbatim below. They do not replace repository implementation proof.
The original round-1 REVISE is preserved. No raw verdict was rewritten. No Skip, Defer or carried
finding exists, and no approval-only revision round was invented.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Raw reports — round 2

#### review-plan

```text
I1 CLOSED — r2 at `tasks/plans/.plan-2026-10-09-backend-mutation-isolation-r2.body.md:59`, `:63` and `:65` requires subreaper ownership before Cargo spawn, positive subtree terminal evidence, conservative fence retention and fixtures covering separate sessions, TERM resistance, owner death and competing runners. This replaces the insufficient group probe at `scripts/child-supervisor.mjs:49`. The mechanism matches the [Linux adoption contract](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html), `leaf_contain.py:226` and `:293`, and the supplied `subreaper-probe-result.json:4` records successful termination with no surviving descendant (confidence: 95). Limitation: future repository implementation, snapshot baseline and installed-binary provenance remain unverified. No commands that mutate state ran. Review shares the planned implementation’s model family (confidence: 100).

VERDICT: APPROVED
```

#### review-minimalism

```text
VERDICT: APPROVED
```

#### review-correctness

```text
I1 CLOSED — Plan lines 59–65 require subreaper ownership before Cargo spawn, complete descendant reaping before snapshot/cache release, and fence retention when terminal evidence is missing. The supplied probe confirms separate-session, TERM-ignoring descendant cleanup. Closure is at the plan-contract level, with repository implementation proof still pending (confidence: 95).

VERDICT: APPROVED
```

#### review-error-handling

```text
I1 CLOSED — Lines 59–65 require subreaper adoption/reaping across sessions, positive complete-subtree terminal evidence, and fence/cache retention when evidence is missing or the owner dies. Acceptance covers separate-session descendants ignoring TERM, both owner-death cases, and competing-runner refusal. The supplied probe supports the mechanism, with repository implementation proof still required.

VERDICT: APPROVED
```

#### review-tests

```text
VERDICT: APPROVED
```

#### review-platform-semantics

```text
I1 CLOSED — Plan lines 59–65 require Linux subreaper adoption/reaping across groups and sessions, positive terminal evidence before cleanup/cache release, and fence retention on owner death or missing evidence. The supplied probe confirms the existing artifact reaped a separate-session, TERM-ignoring descendant after parent exit. Future repository code still requires the specified behavioral fixtures. Non-Linux listing and guard checks remain Python-independent.

VERDICT: APPROVED
```


### plan-r4.md

# Plan: Isolate backend mutation from the live checkout

## Goal

Close f-20260929-12 by preventing the backend mutation runner from injecting source or build artefacts into the checkout that push gates measure. The plan was authored at b2663061a8d20d3f969c851c3ef9ce5d025b4cbb, refreshed at ca0ab68689e0f4de8ca0b84df2be29963bcfc66c, and is now in PLAN-REFRESH at d691ee8a51602aad514e9c18f26045282998bda7. Stop after reviewed planning outputs, before Preflight, implementation, ledger mutations, commits or push.

## MANDATE

### A backend mutation run can start after the push gates' one-shot mutation guard and mutate the tree under them

* **ID:** f-20260929-12 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/run-backend-mutation.mjs` `--check-guard` (exits 0 at once when no fence exists, ~line 183) and fence acquisition (~373-384); `gates:contract:check` (guard is its first member) and every gate run after it.
* **Defect:** the guard is a point-in-time check. A `pnpm mutation:backend` started (by another session or agent) after the guard passed acquires the fence and edits tracked `src-tauri` sources in place while the push gates are still compiling and testing, so a gate can measure mutated code — or record a receipt over it if the mutant is reverted before the receipt's second sample. Pre-existing in the serial push chain; the 2026-09-29 push-gate lane runner keeps the same one-shot check.
* **Why it matters:** a green gate or receipt over a tree that briefly contained an injected mutant.
* **Open question:** should a push-gate run hold a shared "gates running" lease that the backend mutation runner refuses on (and vice versa), and where does that lease live so a crashed gate run cannot block mutation forever?
* **Found by:** Codex `review-plan` lens, round 5 of `tasks/plans/2026-09-29-push-gate-parallelism.md`, 2026-09-29.

Correction 2026-09-30 (records review): "the 2026-09-29 push-gate lane runner keeps the same one-shot check" describes a planned runner, not code at HEAD — `scripts/run-push-gates.mjs` exists only in the untracked plan `tasks/plans/2026-09-29-push-gate-parallelism.md`, and `$push` still runs its gates serially. The defect stands for the serial chain today and for the runner if it lands with the same guard.

## Threat model and non-goals

Ordinary independent agent or shell sessions on Linux start the supported runner while gates are reading the checkout. Catchable interruption, parent SIGKILL, command failure and an ordinary source edit during preparation are relevant. The Cargo executable is the existing trusted tool, not an adversary that deliberately escapes its specified workspace. Editors, Git commands, destructive external cleanup and malicious environment/configuration injection are outside the guarantee. Existing supported Linux execution and Ubuntu mutation CI are required. No claim of newly enabling mutation on macOS or Windows is made. Existing gate routes on those systems remain unchanged.

## Traced premises

* `scripts/run-backend-mutation.mjs:184` observes the fence without reserving gate ownership. `:200`, `:229`, `:341`, `:377` implement dirty-backend refusal, exclusive durable creation, marker verification and startup respectively. `:297` selects `--in-place`, and `:416` spawns without an explicit isolated cwd.
* `scripts/run-push-gates.mjs:1112` performs the one-shot guard before the schedule. `:1034` is the separate pre-review path. `scripts/gate-receipt.mjs:474` acknowledges that sampling can miss a transient change and restoration.
* `package.json:20`, `:21`, `:26`, `:27`, `:62` route direct contract gates, strict push/receipt gates and the unwrapped backend mutation runner. The installed `agent-gate` holds a machine-wide lock, but backend mutation and standalone contract calls are outside it. It is not a checkout mutation protocol.
* `src-tauri/tauri.conf.json:33`, `:42` refer to sibling sound and dist directories. `src-tauri/src/fs.rs:3851`, `:3884`, `:3917` compile sibling catalogs/signatures into tests. `src-tauri/src/infra/path_authority/mod.rs:21360` compiles the repository's mutation runner source. `src-tauri/Cargo.toml:102` includes the vendored PGN dependency. A crate-only copy is incomplete.
* Upstream cargo-mutants 27.1.0 [build directory implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/build_dir.rs) uses the Cargo workspace root for its copy. Its [copy implementation](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/copy_tree.rs) excludes the immediate target directory and preserves symlinks. Removing `--in-place` alone neither includes sibling inputs nor guarantees independent source files. The installed CLI reports cargo-mutants 27.1.0. Installed Rust source for it is unavailable, so tagged source is supporting evidence rather than local binary provenance.
* `scripts/mutation-runner-test-harness.mjs:35` supplies detached CLI fixtures and cleanup. `scripts/run-backend-mutation-tests.mjs:148` races the parent's owner record by reading after the child shim's marker. Existing f-20261005-08 already records this defect. The same runner/record change below includes its necessary correction without inventing a new finding.
* `scripts/child-supervisor.mjs:47`, `:61` support process-group sweeping and group-aware supervision. These prove only the selected group. cargo-mutants 27.1.0 [process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87) calls [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34), which places Cargo build/test children into independent groups. Neither immediate-child exit nor outer-group disappearance proves all mutation descendants have stopped.
* The existing launcher containment artifact `/home/felixb/.claude/scripts/leaf_contain.py:47`, `:210`, `:286` provides a Linux subreaper/ECHILD lifetime model across descendant sessions. A disposable probe against that real artifact produced exit receipt 0 and no surviving `/proc` entry for a separate-session child that ignored SIGTERM after its parent exited. Result: `subreaper-probe-result.json` in RUN_TMP, 3.16 seconds. This measures the kernel/established artifact, not the future repository implementation. Linux [subreaper](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html) and [wait](https://man7.org/linux/man-pages/man2/wait.2.html) contracts support this terminal model.
* Decisions d-20260830-10, d-20260930-04 and d-20261002-01 preserve the durable fence/no-override guard, gate schedule and strict launcher. d-20261001-02's lane-selection contract survives its launcher supersession. None settles the isolation question, so Entry remains build.
* Completed locate reports are `probe-1-r1.txt` and `probe-2-r1.txt` in RUN_TMP. The worktree has no dist or build target yet. Runtime snapshot compilation is an implementation proof, not evidence available to this planner.

## Approach

### Independent mutation inputs and outputs

Authority: MANDATE's "edits tracked `src-tauri` sources in place while the push gates are still compiling and testing" and "a green gate or receipt over a tree that briefly contained an injected mutant".

The existing runner owns one private run snapshot. Snapshot the current tracked repository file set with its relative layout, plus the required existing built `dist/`. Include backend vendor/config/resources, sound, renderer catalogs/signatures and Rust source-text test inputs. Exclude Git metadata, dependency installations, source/build caches, prior mutation output and secret files. Enumerate with Git, copy independent regular files, and reject symlinks or non-directory ancestors for copied inputs. Never hardlink or symlink source, dist or resource files back to the live tree. Preserve executable modes where needed. Fail preparation with an actionable nonzero result if required inputs are absent, copying is incomplete or verification detects a source change during capture. Verify the captured input manifest and bytes before starting the baseline. This is snapshot consistency at preparation, not an editor lock across the subsequent run.

Use the existing selected package commands and cargo-mutants `--in-place` only inside that snapshot. Explicitly set Cargo's cwd, manifest, absolute mutation output and target paths. A single worktree-specific mutation-only target cache is reused across packages and successive runs, with one package/job owner at a time. Neither inherited CARGO_TARGET_DIR nor a live target alias may redirect builds to `src-tauri/target`. Keep ordinary installed app and gate build outputs independent. Existing baseline, filters, eight-package coverage, containment, minimum timeout, survivor semantics and report locations remain intact.

One runner implements snapshot ownership. No gate lease, watcher, daemon or process-control service is introduced. The zero-software route is keeping mutation and gates manually separate, which cannot protect the unattended class in MANDATE. The snapshot is owned by the existing one-shot command and disappears through that command's cleanup. Its removal path is retiring the snapshot operation and its private mutation cache after mutation is no longer used.

Proof level: execute the real runner with Cargo shims that edit and restore snapshot source while a concurrent gate fixture reads the live source and records a receipt. Assert the live bytes and metadata never change, the mutation cwd and build target are distinct, and all mutations occur only in copied files. The central assertion must fail when the runner's isolated cwd is reverted to the live checkout.

### Fence ownership and terminal cleanup

Authority: MANDATE's crash question and the frozen catchable interruption/parent-SIGKILL threat model. This retains d-20260830-10 rather than removing a protection before isolation is proven.

Keep dirty-backend refusal, exclusive durable fence acquisition and `--check-guard` behavior. Gates starting after a fence exists may still refuse conservatively. A mutation that starts after a gate's guard now changes only its snapshot. No gate-side protocol is required to preserve the live tree.

Publish the operation's snapshot/cache identity and containment-owner identity as a complete atomic durable owner record. Preserve exclusive initial creation and retain the fence if finalisation cannot establish safe terminal state. Replace truncate-then-write recording and make tests await the parent's completed record rather than the shim's spawn marker. This covers the already-filed same-file f-20261005-08, which the adopting run can close with its evidence. An absent legacy snapshot field remains recoverable under the existing procedure.

On completion, failure or catchable signal, stop/reap all owned mutation descendants before removing the owned snapshot or admitting another cache owner. Place Cargo under one invocation-owned Linux subreaper. It establishes ownership before spawning Cargo, survives the Cargo parent's exit, terminates/reaps adopted descendants across process groups/sessions, and publishes terminal evidence only after the kernel reports no unwaited children. It must not create new children after that terminal check. Identity-safe signalling must not target a reused unrelated PID. Reuse the existing Node signal/status supervision at the containment-owner boundary, but never treat its exit or an empty outer group as subtree evidence.

Use a minimal repository-contained Python 3 one-shot process wrapper for this kernel boundary, without a dependency on Felix's home directory or an agent-kit installation in CI. It owns no snapshots, caches, ledger or generic daemon state. Existing group supervision cannot perform adoption/reaping, and Node has no existing native subreaper binding here. This is the last-resort helper needed by the observed ordinary cargo-mutants group boundary, not a parallel gate service. Its removal path is replacing it with an already available command boundary that proves the same all-descendant terminal condition. Python/subreaper capability refusal occurs before any Cargo child, with actionable nonzero failure. Side-effect-free listing and guard checks remain independent of Python, including non-Linux gate callers.

Do not clear the fence on missing terminal evidence, containment-owner signal death, unreadable state or cleanup failure. If teardown cannot establish terminal state within its bounded grace, retain the private snapshot and fence and report failure instead of releasing the shared cache. Parent SIGKILL leaves the durable fence and possibly a live containment owner/private snapshot. The one-shot owner can finish its subtree without the runner, but it cannot clear the fence. Recovery first establishes no relevant mutation descendants remain, checks the live checkout for legacy markers, and removes only the recorded owned snapshot/fence. Owner death without terminal evidence is unknown, not proof of an empty subtree. Recovery in that case retains the existing explicit process inspection/termination prerequisite. It never restores the entire backend, removes the reusable cache during ordinary finalisation, or deletes an arbitrary path from malformed metadata. Unknown or malformed ownership refuses cleanup and explains the limit. No age reclamation or background sweep is added.

Proof level: owned-process fixture barriers exercise normal exit, spawn failure, cancellation, SIGKILL with a surviving descendant, cleanup refusal and a competing runner. A Cargo shim must create a separately grouped/session descendant that ignores SIGTERM, then exit before that descendant. Require its reaping and terminal evidence before snapshot/fence removal. Inject missing/failed terminal evidence and confirm another runner cannot reuse the cache. Exercise runner death and containment-owner death separately. Verify conservative fence retention and no live-source mutation. A retained fence may block subsequent work until safe recovery, as it does today.

### Integration and operational evidence

Authority: MANDATE's supported `pnpm mutation:backend` and gate/receipt interaction, plus mandatory verification of the changed execution boundary.

Keep package entry points and P0/P1/P2/pre-review schedules unchanged. Update the runner header, CLAUDE.md's mutation description, and the canonical push skill to distinguish private snapshot mutation from legacy interrupted live mutation. Backend mutation remains outside the push gate schedule. Update mutation CI caching to the actual isolated target cache while preserving its package matrix, tool version, report uploads and all job failure behavior. Match any affected operational prose to the same contract, without editing historical decisions into agreement.

Run an actual engine-protocol mutation package in the isolated repository layout after producing dist, as well as the fixture suite. Record output locations and the live checkout's unchanged source/target observations. If the real baseline fails because a compile-time sibling input was omitted, extend the snapshot's concrete input coverage and rerun. Do not lower mutation/coverage floors or skip the baseline. Exercise refusal paths with scratch inputs and retain per-assertion unique diagnostics and statuses for any changed standalone verifier. Prefer behavioral subprocess tests to additional source scanners.

## Decisions and trade-offs

The initial locate considered a shared gate lease. Further trace showed that every package-manager and descendant boundary would need lifetime participation. Source isolation removes the mechanism at its only writer and avoids a new cross-run gate protocol. This is a technical choice, not a product change. Snapshot storage and a separate persistent mutation cache are the cost. The live target is not reused because Tauri's build outputs/resources and separate Cargo build/test invocations would then need additional coordination.

Existing safety decisions stay in force. There is no claim that current gates are safe against arbitrary editors or that an interrupted run is automatically recovered. Existing unrelated gate-scripts findings stay open at their current tiers. Only the selected finding and the directly coupled fence-record defect are planned here.

## Decided autonomously

* Question: Gate lifetime lease or isolated mutation source? Chosen: an owned independent source snapshot and mutation-only target cache. Rejected: a shared lease across every gate, package manager and descendant, and a machine-wide lock-only wrapper. Reason: isolation eliminates injected source and build output from the tree being measured at the sole writer. Reversal path: replace the snapshot contract only after a simpler protocol has proved the same gate overlap, interruption and descendant cases. The adopting session records this decision with Governs f-20260929-12.
* Question: Remove existing fence and push preflight once mutation is isolated? Chosen: retain them, including dirty-backend refusal and no override. Rejected: simultaneous retirement. Reason: legacy interrupted live mutations and unknown descendant cleanup still need the established safety boundary. Reversal path: a later evidenced decision after isolation and recovery have shipped, preserving legacy marker refusal.
* Question: Acceptance and scope? Chosen: agent-owned subprocess/runtime acceptance of this tooling change, one cohesive mutation-runner phase, including the existing same-file fence record race. Rejected: browser acceptance or a redesign of gate receipts. Reason: no product UI changes and the defect is at the runner's filesystem/process boundary. The adopting session records the necessary technical calls, with no claim of a Felix decision.
* Question: How is descendant completion proved across cargo-mutants' independent groups? Chosen: one invocation-owned Linux subreaper with positive all-descendant terminal evidence and conservative retention when that evidence is absent. Rejected: treating outer-group disappearance or cargo exit as complete cleanup, and requiring a machine-specific user systemd service in Ubuntu CI. Reason: tagged cargo-mutants source and the existing containment probe show the production boundary and an available kernel solution. Reversal path: an already available boundary that proves the same cases without this wrapper. This decision is the correction to review issue I1.

## Risks / open questions

No unresolved product question. The real build and clean-cache startup are not measured in this lane. Private helper choices belong to the executor. A scratch snapshot may remain after uncatchable interruption, but it cannot corrupt the live checkout. The existing durable fence intentionally requires recovery. Linux is the runtime proof environment, not evidence of additional platform support.

## Not part of this task

Gate scheduler changes, receipt fingerprint redesign, general editor/Git exclusion, new machine-wide tooling, changed mutation packages, mutation score policy, full frontend audit, renderer/native product behavior, coverage rebaselining or release/deployment.

## Phases

One cohesive phase, because snapshot, owner record, child cleanup, tests and CI cache wiring share the same runner contract and cannot be shipped independently.

Files: `scripts/run-backend-mutation.mjs`, `scripts/run-backend-mutation-tests.mjs`, new `scripts/mutation-process-containment.py`, `scripts/mutation-runner-test-harness.mjs` only if its shared fixture API needs extension, `.github/workflows/mutation.yml`, `CLAUDE.md`, `.claude/skills/push/SKILL.md`. Snapshot implementation stays in the runner unless a demonstrated second caller warrants extraction. The subprocess fixture suite verifies the new wrapper through the real runner, so no new package command or standalone gate is introduced. No package.json, gate schedule, generated bindings or application source edit is planned.

Touches filesystem isolation, child ownership/concurrency, durable operational state and CI cache routing. Executor: Codex write leaf at sensitive role, resolved through executor-profiles and the model registry because the workflow path is sensitive. No full-history context fork. Root writes only plan/record artifacts and owns arbitration, integration, proof, scoped commits and release. Implementation and any repair remain launcher write leaves. Fresh read-only leaves run the lens review.

PROOF COMMAND, in this order after implementation, outside a concurrent gate run:

```bash
pnpm mutation:runner:test
pnpm gates:child-supervisor:test
pnpm gates:push:test
pnpm gates:receipt:test
pnpm build-vite
BACKEND_MUTATION_PACKAGE=engine-protocol pnpm mutation:backend
pnpm mutation:guard:check
pnpm checks:pre-review
pnpm gates:contract:check
```

The new fixture assertions cover each Approach obligation and a git-anchored revert of isolated source execution. Use bounded barriers and existing process teardown rather than timing repetition. The real mutation package proves Tauri's complete snapshot compile/test boundary, without requiring a whole eight-package mutation run. Existing tests continue to select all eight packages structurally. Record any altered standalone-verifier failure matrix with its artefact as required by push-review-policy §2.

The adopting build continues through cumulative diff review and repair closure before final gates. Required final command on the clean reviewed tree: `pnpm gates:push -- --rust --frontend --bindings`, because the changed workflow and mutation build/cache inputs affect toolchain execution. Review CI jobs through the canonical push skill, push ordinarily, verify landed HEAD, and satisfy its required remote jobs/installation obligations. No UI browser pass is needed for this tooling-only phase.

## Carried to diff review

None at initial revision.

## Reviews

### Round 1 — initial source-isolation plan

Candidate: plan-r1.md, base b2663061a8d20d3f969c851c3ef9ce5d025b4cbb.
All twelve plan-capable user/project lenses ran in parallel as fresh read-only Codex launcher leaves.
review-plan used review-plan role. Others used sensitive because the workflow is a sensitive path.
Source bodies were transferred unchanged after stripping YAML. Diff-only root-cause/code-quality
lenses were excluded by their canonical frontmatter. Raw reports are preserved below.

Wall elapsed through review, triage and correction: 516.18 seconds. Active review wall time:
unknown. Known non-overlapping quota/dependency/release/other waits: none observed. Parallel leaf
durations were not summed. Polling while reviewers worked is review elapsed. Completed rounds: 1.
Raw findings: 1 blocker. Unique IDs opened: I1. Plan-level adopted findings: r1=1.
Unresolved/closed issue totals: 1/0. Correction-introduced defects: none observed. I1 identifies
a pre-existing group boundary missed by the initial plan, not a newly introduced source defect.
Withdrawals, rewrites, splits and inherited review totals: none. Open obligations: I1 closure
and all three implementation Approach obligations. Downstream implementation/final-review rework:
not observed in this PLAN-ONLY lane.

Six NOT APPLICABLE exits were checked against their canonical descriptions. Chess semantics,
UCI protocol, IPC, renderer storage, PGN indexes and native Tauri security are unaffected. Platform
semantics applies to Linux process/fixture assumptions and reviewed them. Other raw verdicts are
APPROVED. Runtime limitations remain implementation obligations, not completed proof.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Issue I1 — outer group is not the complete Cargo subtree

* Witness: review-plan r1 raw finding 1, blocker, confidence 95. Raw verdict: REVISE.
* Disposition: Fix. Claim confirmed by `scripts/child-supervisor.mjs:49–52`, cargo-mutants
  27.1.0 `src/process.rs:87` and `src/process/unix.rs:34`. The latter sets a distinct process
  group for each Cargo build/test command. Outer-group disappearance can leave an ordinary
  descendant running against the private snapshot/reusable cache.
* Evidence: both tagged primary sources were opened. The existing production launcher artifact
  `~/.claude/scripts/leaf_contain.py:47`, `:210`, `:286` was then executed against a separate-session
  descendant that ignores SIGTERM and outlives its direct parent. It returned 0, wrote terminal
  receipt 0 and left no descendant `/proc` entry after 3.16 seconds. Exact command and observed
  result are retained in RUN_TMP `probe-subreaper.py` and `subreaper-probe-result.json`.
  This is evidence for the kernel/existing artifact, not proof of future repo code or binary provenance.
* Affected MANDATE obligation: preserving a safe interrupted runner that cannot admit another
  mutation owner while the previous one still uses its reusable build cache. Source isolation
  protects gates, but the claimed cleanup boundary must hold for the actual tool's descendants.
* Authority for the new containment mechanism: fixed threat model's “Catchable interruption,
  parent SIGKILL, command failure” and MANDATE's “where does that lease live so a crashed gate
  run cannot block mutation forever?” The retained mutation fence owns this terminal boundary.
* Correction revision: r2 candidate. “Fence ownership and terminal cleanup” now requires an
  invocation-owned Linux subreaper, positive terminal evidence after all descendants are reaped,
  and conservative retention on missing evidence. New one-shot Python wrapper is repository-contained
  for Ubuntu CI. It owns no source/cache/ledger state and creates no background service. Node's
  existing supervision remains at the containment-owner boundary. Listing and guard stay Python-free.
* Dependent acceptance: separate-group/session descendant ignoring TERM, outer Cargo parent exit,
  runner death, containment-owner death, missing terminal evidence, retained fence and competing
  cache owner refusal. New fixture must fail if containment is replaced by the old outer-group sweep.
* Dependencies: none. Closure: pending fresh reviewer check against actual r2 candidate.

### Raw reports — round 1

#### review-correctness

```text
No correctness defects found in the plan’s snapshot, fence ownership or CI integration contracts.

Limitation (confidence: 95): real Cargo descendant termination and snapshot baseline compilation remain unverified. No runtime commands were run in this plan-only review.

Review used the same model family as planned implementation.

VERDICT: APPROVED
```

#### review-error-handling

```text
No error-handling defects found in the proposed obligations. Preparation failures return actionable nonzero results, uncertain termination or cleanup retains the fence, and malformed ownership refuses recovery.

Limitation: runtime failure behavior remains unverified until implementation and the specified fixtures run (confidence: 100). This review uses the same model family as the planned implementation.

VERDICT: APPROVED
```

#### review-minimalism

```text
No bloat or duplication findings. The plan keeps isolation in the existing runner, reuses process supervision and the shared fixture harness, and ties cleanup, CI caching and runtime proof to the changed execution boundary.

Limitation: helper-level duplication requires implementation diff review (confidence: 100). Detection used the same model family as planned implementation.

VERDICT: APPROVED
```

#### review-plan

```text
[blocker] tasks/plans/2026-10-09-backend-mutation-isolation.md:58 — “Fence ownership and terminal cleanup” cannot establish descendant termination through the specified group supervision alone. `scripts/child-supervisor.mjs:49–52` kills and probes only the top-level child’s process group. However, cargo-mutants 27.1.0 creates separate groups for Cargo build/test children ([process.rs:87](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process.rs#L87), [unix.rs:34](https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/process/unix.rs#L34)). During cancellation escalation, the outer group can disappear while a separately grouped descendant survives. Clearing the fence then allows another runner to reuse the mutation cache concurrently. These are ordinary trusted-tool descendants within the stated threat model. Specify termination evidence across these group boundaries, conservative retention when that evidence is unavailable, and a behavioral fixture exercising a surviving descendant in a separate group. The generic descendant fixtures at plan:60 do not require that production boundary (confidence: 95).

Limitations: tagged source was inspected, but installed-binary provenance and runtime cleanup were not verified. No proof commands ran and no files changed (confidence: 100). Review used the same model family as the planned implementation.

VERDICT: REVISE
```

#### review-tests

```text
No plan-level verification gaps found. The proposed live-byte assertion would fail on reverting isolated execution. The fixture suite is registered in the unconditional contract gate and CI. The real engine-protocol baseline checks snapshot compile inputs.

This reviews proposed proof only. No tests ran. Detection uses the same model family as the planned implementation.

VERDICT: APPROVED
```

#### review-chess-semantics

```text
NOT APPLICABLE: The files and obligations concern filesystem snapshots, mutation-process ownership, cleanup and CI caching. No in-memory chess tree, position identity, move path, parity, variation selection or metadata round trip changes are planned.
VERDICT: APPROVED
```

#### review-engine-protocol

```text
NOT APPLICABLE: The files and obligations concern mutation-runner isolation, Cargo child ownership, fence recovery and CI caching. They do not change UCI engine supervision, protocol state or asynchronous result routing. The engine-protocol baseline exercises existing code without changing those contracts.
VERDICT: APPROVED
```

#### review-ipc-contract

```text
NOT APPLICABLE: The listed files and three Approach obligations concern mutation snapshot isolation, fence cleanup and tooling verification. They introduce no Rust↔renderer command, event, subscription or capability contract changes.
VERDICT: APPROVED
```

#### review-persisted-state

```text
NOT APPLICABLE: The listed files and three Approach obligations concern backend mutation snapshots, fence ownership, cleanup and gate integration. They do not change renderer storage, persisted atoms or tab lifecycle.
VERDICT: APPROVED
```

#### review-pgn-index

```text
NOT APPLICABLE: The plan’s files and obligations concern mutation-runner isolation, fence ownership, cleanup and CI caching. They do not change PGN scanning, byte offsets, encoding, database storage or search.
VERDICT: APPROVED
```

#### review-platform-semantics

```text
No platform-semantics findings. The plan confines mutation runtime guarantees to Linux and Ubuntu CI, consistent with the existing `/proc` identity and process-group mechanisms.

Proof remains pending. No gates, Windows compile check or non-Linux Unix source probe ran. `rust-windows-test` and `rust-macos-test` provide Rust runtime evidence only, not mutation-runner portability.

Review used the same model family as planned implementation. No files changed.

VERDICT: APPROVED
```

#### review-tauri-security

```text
NOT APPLICABLE: The files and obligations concern mutation-runner snapshots, process ownership, cleanup and gate integration. They do not change native credential/session flows, application filesystem authority, signed downloads or backend data egress. Runner snapshot cleanup falls outside this lens’s native security boundary.

VERDICT: APPROVED
```



### Round 2 — complete descendant ownership correction and I1 closure

Last actually reviewed snapshot: plan-r1.md. Candidate: plan-r2.md at the same supplied base.
Six fresh read-only Codex launcher lenses ran in parallel: review-plan, its required witness,
and minimalism/correctness/error-handling/tests/platform-semantics for the newly specified
containment process boundary. No unaffected app domain lens was rerun by default. review-plan
used review-plan role, others sensitive. Each packet carried the body-only candidate, full record
lookup, fixed verbatim MANDATE, open I1, correction evidence and exact delta-script stdout.

Wall elapsed: 181.6 seconds from prompt preparation through all reports and arbitration.
Active review wall time: unknown. Known non-overlapping quota/dependency/release/other waits: none
observed. Parallel leaf durations were not summed. Polling while reviewers worked is review
elapsed. Cumulative completed rounds: 2. Plan-level adopted findings: r1=1 r2=0.
Round-2 raw findings: 0. Unique IDs opened: none, resolved: I1. Unresolved/closed totals: 0/1.
Correction-introduced defects, withdrawals, rewrites, splits and inherited review totals: none observed.
Open implementation obligations: all three Approach obligations, owned by the adopting build.
Downstream implementation/final-review rework: not observed in this PLAN-ONLY lane.

Arbitration: all round-2 raw verdicts are APPROVED. I1 is Fix, closed in round 2 by its required
review-plan witness against the changed obligation and dependent acceptance. Additional closure
observations are retained verbatim below. They do not replace repository implementation proof.
The original round-1 REVISE is preserved. No raw verdict was rewritten. No Skip, Defer or carried
finding exists, and no approval-only revision round was invented.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Raw reports — round 2

#### review-plan

```text
I1 CLOSED — r2 at `tasks/plans/.plan-2026-10-09-backend-mutation-isolation-r2.body.md:59`, `:63` and `:65` requires subreaper ownership before Cargo spawn, positive subtree terminal evidence, conservative fence retention and fixtures covering separate sessions, TERM resistance, owner death and competing runners. This replaces the insufficient group probe at `scripts/child-supervisor.mjs:49`. The mechanism matches the [Linux adoption contract](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html), `leaf_contain.py:226` and `:293`, and the supplied `subreaper-probe-result.json:4` records successful termination with no surviving descendant (confidence: 95). Limitation: future repository implementation, snapshot baseline and installed-binary provenance remain unverified. No commands that mutate state ran. Review shares the planned implementation’s model family (confidence: 100).

VERDICT: APPROVED
```

#### review-minimalism

```text
VERDICT: APPROVED
```

#### review-correctness

```text
I1 CLOSED — Plan lines 59–65 require subreaper ownership before Cargo spawn, complete descendant reaping before snapshot/cache release, and fence retention when terminal evidence is missing. The supplied probe confirms separate-session, TERM-ignoring descendant cleanup. Closure is at the plan-contract level, with repository implementation proof still pending (confidence: 95).

VERDICT: APPROVED
```

#### review-error-handling

```text
I1 CLOSED — Lines 59–65 require subreaper adoption/reaping across sessions, positive complete-subtree terminal evidence, and fence/cache retention when evidence is missing or the owner dies. Acceptance covers separate-session descendants ignoring TERM, both owner-death cases, and competing-runner refusal. The supplied probe supports the mechanism, with repository implementation proof still required.

VERDICT: APPROVED
```

#### review-tests

```text
VERDICT: APPROVED
```

#### review-platform-semantics

```text
I1 CLOSED — Plan lines 59–65 require Linux subreaper adoption/reaping across groups and sessions, positive terminal evidence before cleanup/cache release, and fence retention on owner death or missing evidence. The supplied probe confirms the existing artifact reaped a separate-session, TERM-ignoring descendant after parent exit. Future repository code still requires the specified behavioral fixtures. Non-Linux listing and guard checks remain Python-independent.

VERDICT: APPROVED
```

### Round 3 — refresh drift review at ca0ab686

Mode: PLAN-REFRESH. Original base: b2663061a8d20d3f969c851c3ef9ce5d025b4cbb.
New base: ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Continue published rounds r1/r2, not a new investigation.
Drift: `drift-b2663061a8d20d3f969c851c3ef9ce5d025b4cbb-ca0ab68689e0f4de8ca0b84df2be29963bcfc66c.diff`, process-provided exact Git diff, SHA-256
`85f7ef4f6e836c3acea43318c24f5998f7f75fe72aa9d3e044586083810dc7e7`. Root compared its bytes with actual Git output.
Candidate: plan-r3.md. Only the Goal planner-mode/base statement changed from the reviewed body.
All three Approach obligations, implementation phase, decisions, fixed MANDATE and proof remain
unchanged. The heading delta is bookkeeping, not a replacement for the full source drift.

The drift concerns workspace initialization, operation-owned storage schemas, codec interop,
renderer/storage tests and real-app reload assertions, plus corresponding decision/finding and
completion records. Root read the changed execution paths and applicable decisions. A Git
comparison confirmed no change to the mutation runner/tests/harness, child supervisor, package
scripts, gate scheduler/receipts, mutation workflow, canonical context or push skill. The new
workspace decisions govern f-20260929-09. They neither settle nor reverse this finding's isolation
decision. The existing Actions-disabled finding received another observation. It remains an
operational prerequisite for the adopting build's ordinary Preflight/release checks, not a newly
changed mutation mechanism or proof of completed CI here.

Exactly the twelve requested REFRESH-LENSES ran in parallel through fresh read-only Codex launcher
leaves. Each received both SHAs, full drift path/hash, current body-only plan, inherited history,
closed I1, fixed mandate and exact delta stdout. review-plan used review-plan role, others sensitive.
Source lens bodies were transferred unchanged after stripping YAML. Root read every raw report
and checked each NOT APPLICABLE exit against both drift and plan obligations. The app-domain
changes do not invalidate this tooling plan's source isolation, fence/descendant ownership or
integration/proof boundary. All raw verdicts are APPROVED. No drift finding or out-of-drift defect
was reported. No issue, filing, correction or fresh design decision is manufactured from the refresh.

Round wall elapsed: 408.75 seconds through review and arbitration. Active review wall time:
unknown. Known non-overlapping quota/dependency/release/other waits: none observed. Polling while
leaves worked is review elapsed. Parallel leaf durations were not summed. Completed cumulative
rounds: 3. Adoptions: r1=1 r2=0 r3=0. Inherited elapsed: r1=516.18s, r2=181.60s.
Inherited unique issue: I1, Fix, closed by its review-plan witness in r2. This round opened/resolved
no IDs. Final unresolved/closed totals: 0/1. Inherited issue metadata and closure are byte-equivalent
JSON values, with no new witness or changed disposition. No correction-introduced defects,
withdrawals, rewrites, splits or downstream implementation/final-review rework were observed.
Open implementation obligations: all three Approach obligations, owned by the adopting build.
Runtime baseline and fixture proofs remain required there. This planner ran no implementation gate.

Plan authorship and arbitration shared one context. Detection ran on the same model family as
planned code. Fresh contexts provide separation, not independent model families.

### Raw reports — round 3

#### review-chess-semantics

```text
NOT APPLICABLE — The planned phase changes mutation-runner isolation, process containment and CI integration. Drift changes workspace initialization, validation-schema lifetimes, codec imports and reload assertions. None changes chess position identity, move-path semantics, ply parity or variation selection in a way that invalidates the plan’s independent-input, fence-cleanup or integration obligations.

VERDICT: APPROVED
```

#### review-correctness

```text
NOT APPLICABLE — Drift changes workspace hydration, storage schemas, renderer tests and real-app verification. None changes the planned runner, Cargo input layout, cache/output routing, fence ownership, descendant containment or CI integration. These changes do not invalidate a correctness obligation in the unchanged mutation-isolation plan. No open review issues remain.

VERDICT: APPROVED
```

#### review-engine-protocol

```text
NOT APPLICABLE — Drift changes workspace initialization, validation schema lifetimes, storage codec imports and reload assertions. It changes no UCI supervisor, protocol state machine or asynchronous engine result routing, and invalidates none of the plan’s mutation isolation, fence ownership or integration obligations within this lens.

VERDICT: APPROVED
```

#### review-error-handling

```text
NOT APPLICABLE — Drift changes workspace hydration, validation schema lifetimes, codec imports, reload assertions and records. None changes the mutation runner, containment boundary, CI workflow or gate integration. These changes cannot invalidate the plan’s preparation refusal, fence retention, descendant terminal evidence or failure-status obligations.

VERDICT: APPROVED
```

#### review-ipc-contract

```text
NOT APPLICABLE — The planned phase changes mutation tooling and isolation, with no Rust↔renderer IPC contract changes. The drift changes workspace hydration, validation schema lifetimes, codec interop and reload assertions. It changes no command signature, event payload, subscription or capability scope that could invalidate the plan’s isolation, cleanup or integration obligations.

VERDICT: APPROVED
```

#### review-minimalism

```text
NOT APPLICABLE — The drift changes workspace hydration, schema lifetimes, shared codec use, reload assertions, tests and records. It changes none of the planned mutation files or gate integration boundaries. These changes introduce no bloat or duplication that invalidates the unchanged snapshot isolation, fence ownership, descendant cleanup or integration proof obligations. The plan delta changes only Goal bookkeeping.

VERDICT: APPROVED
```

#### review-persisted-state

```text
NOT APPLICABLE — The drift changes workspace hydration, validation-schema lifetimes, codec imports and real-app reload assertions. None can invalidate this plan’s obligations for mutation snapshot isolation, fence ownership, descendant cleanup or runner/CI integration. Renderer persistence is explicitly outside the planned phase.

VERDICT: APPROVED
```

#### review-pgn-index

```text
NOT APPLICABLE — Planned files concern mutation isolation, process containment and CI integration. Drift changes workspace hydration, session-storage serialization and reload verification. Neither changes PGN scanning, byte-offset indexes, database move encoding or search predicates, nor invalidates a plan obligation within this lens.

VERDICT: APPROVED
```

#### review-plan

```text
No open review issues. I1 remains closed at r2.

No drift findings invalidate the three Approach obligations. Workspace and codec changes remain covered by the full tracked-file snapshot and rebuilt `dist/` requirement at plan:43 and :111. Mutation execution, descendant ownership, cache routing and gate integration dependencies are unchanged.

Limitation: future implementation, real-Cargo baseline and descendant-cleanup proof remain unverified. No runtime commands ran or files changed (confidence: 100). Review shares the planned implementation’s model family.

VERDICT: APPROVED
```

#### review-platform-semantics

```text
NOT APPLICABLE — The drift changes renderer workspace initialization, validation schemas, codec imports and reload assertions. It changes no platform mechanism or dependency that invalidates the plan’s independent snapshot/cache, Linux descendant containment, durable fence or runner/CI integration obligations. Non-Linux gate routes remain unchanged.

VERDICT: APPROVED
```

#### review-tauri-security

```text
NOT APPLICABLE — Drift changes workspace hydration, tree-schema lifetimes, codec interoperability and reload assertions. It changes no credential/session-token flow, native filesystem authority or mutation, signed-download verification, or backend diagnostic egress. None invalidates the plan’s independent snapshot/cache, durable fence/descendant cleanup, or runner/CI integration obligations within this lens.

VERDICT: APPROVED
```

#### review-tests

```text
NOT APPLICABLE — The drift changes workspace hydration, schema lifetimes, codec loading and real-app reload assertions. These do not alter the planned mutation-runner fixtures, test selectors, CI routing or Cargo baseline proof. No changed path invalidates the plan’s isolation, descendant-cleanup or integration proof obligations. Future implementation runtime evidence remains required.

VERDICT: APPROVED
```
