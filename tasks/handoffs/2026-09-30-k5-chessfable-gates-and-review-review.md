# K5 ChessFable — gates and review: plan and diff review record

Build run of the ChessFable part of stream K5 of the 2026-09-30 drain review (`~/.claude/plans/2026-09-30-drain-review-plan.md`), Claude Code (Opus 5.5) orchestrating, executor Codex (`gpt-6-luna`, max on lenses and sensitive/normal phases), session `e5e98ba9-1fe9-44b9-97ee-d14fb9375a46`, 2026-09-30/10-01. The same context wrote the plan and arbitrated every finding; every lens and every write leaf ran on Codex, so detection and implementation share one model family (disclosed per push-review-policy §3).

The plan (run artefact, git-ignored) was `tasks/plans/2026-09-30-k5-chessfable-gates-and-review.md`. This record preserves its review history: stable issue IDs, witnesses, dispositions, evidence, closures, and every raw lens report.

## Outcome

- Plan review: 3 rounds (r1 5 lenses, r2 5, r3 3), `plan_adopted_per_round` r1=7 r2=3 r3=0; 22 unique issues (K5-01..K5-22): 14 Fix (7 plan-level, 7 carried as CR-1..CR-7 — six carried IDs plus K5-04's test residual), 6 Skip, 2 arbiter-closed. No open plan-level issue at closure; CR-1..CR-7 were closed by the cumulative diff review (below).
- Implementation: P1 d453e941 (1 fix round), P2 4abd9f6d (2 fix rounds: 94792df1 test shims for `ls-files -z`), P3 d5eae1a3, P4 25d7e2d1 (1 fix round, table pipe), pre-review repair 369e1148; decisions d-20261001-01..04 and the Superseded-by trailer on d-20260930-03.
- Cumulative diff review: 7 rounds (d1 7 lenses incl. records, d2 7, d3 6 + one focused judgment, d4 6, d5 6, d6 5, d7 3); repairs 9431b862, 010ba043, 811e1064, 057232e7, eb69843d, 9d7e8996, 27a43112, d10ff95c; closed with every lens APPROVED.

## Plan-review record (verbatim from the plan's `## Reviews` and `## Carried to diff review`)

### Carried to diff review

- CR-1 (T3, O3 d): tests assert that a supported Docker launch's argv carries the recorded `--memory` value and a unique `--name`, and that the container reservation is deducted from the coverage and mutation budgets.
- CR-2 (T4, O3 d): tests assert the launcher stops and removes its container on a signal and on runner abort, not only on a failed run.
- CR-3 (K5-04 residual, O3 c): a test drives a caller whose cgroup is outside `agents.slice` and asserts the scope is still created (no bypass).
- CR-4 (O3 a): a test asserts the lock stays held until the gate's heavy children have exited (a second acquirer blocks while a child still runs).
- CR-5 (O4 mutation): a test asserts a changed test file adds the production file it exercises to the mutate list.
- CR-6 (O4 selection): a test asserts an untracked-only source file selects its lane.
- CR-7 (K5-21, O1): a test asserts the `gh` query is filtered to the upstream branch derived from `@{u}` (and to the `Test` workflow), so another branch's runs cannot satisfy or fail the check.

### Reviews

Round 1 (r1, 2026-09-30 ~22:10–22:35; review-plan, minimalism, correctness, error-handling, tests; all Codex `gpt-6-luna`/max; raw reports in the run scratch, preserved in the handoff record).

| ID | Witness (lens, rank, conf) | Claim | Disposition | Evidence / Authority | Status |
|---|---|---|---|---|---|
| K5-01 | correctness blocker 94 | e2e can overlap frontend-coverage, which is sized to the full budget when mutation runs last; container memory reserved from mutation only leaves the run over budget | Fix (O3 d: reserve from every overlapping self-sizing lane) | `scripts/run-push-gates.mjs:91-106` (e2e `after` omits frontend-coverage), `:420-426` (coverage share 1 when no cargo lane and mutation serial) — read | open |
| K5-02 | error-handling should-fix 97; review-plan blocker 98 (O1 part); tests blocker 99 | O1 refusal is prose, unprovable, and silent on `gh` failure | Fix (O1: `scripts/check-remote-ci.mjs` with tests; `gh` failure/malformed/incomplete refuses) | Authority: MANDATE "Make the push skill refuse a push on any red job of the newest completed CI run"; evidence: policy §8 incident notes (17 pushes over red, 2026-09-19; unnamed `test` job, 2026-09-28) | open |
| K5-03 | error-handling should-fix 92 | O4 leaves `merge-base`/`git diff` failures unspecified | Fix (O4: any git failure stops with cause) | plan text | open |
| K5-04 | review-plan blocker 99 | O3 c skips the scope outside agents.slice, contrary to gate-performance (c) | Fix (always create the scope; no current-cgroup branch) | `~/.claude/references/gate-performance.md:95-98` read | open |
| K5-05 | review-plan blocker 99 | O4 narrows Stryker by package, MANDATE says changed files | Fix (file list, mutate narrowed per package) | `scripts/frontend-mutation-packages.mjs:1-8`, `stryker.config.mjs` mutate from package — read; MANDATE "Stryker narrowed to changed files" | open |
| K5-06 | review-plan blocker 98 | Rust-only pre-review leaves `dist/` missing/stale for Windows clippy | Fix (frontend-build step before clippy/bundle lanes) | `scripts/run-push-gates.mjs:47`, `:76` (rust lanes require frontend-build) — read | open |
| K5-07 | review-plan blocker 95 | mapping-only check misses an area with no production file | Fix (O4 mapping criteria + test) | `scripts/coverage-report.mjs:580-589` "Coverage data missing for area" — read | open |
| K5-08 | tests should-fix 98; review-plan blocker 98 (O2 part) | §1b pointer has no failing proof | Skip | The pointer is an instruction to the agent; the behaviour it names lives in kit policy §1b and is exercised by the review workflow, not by repository code. A wording pin is the prose-pinning class f-20260923-07 records as harmful; the cumulative diff review is its verification level. | closed (Skip) |
| K5-09 | tests blocker 98 | nothing proves the workflow runs pre-review after every repair and before code review | Skip + hand-over | The ordering is executed by the orchestrating agent from the push skill and the kit build skill (K1's file); no repository code sequences review. The skill text is reviewed in the diff; the kit build skill's "per-commit checks" wording gets a hand-over naming `pnpm checks:pre-review`. | closed (Skip) |
| K5-10 | tests should-fix 92; review-plan blocker 98 | no validator for the new lens's frontmatter/sections | Skip | MANDATE asks for the lens, not a lens validator; no project lens has ever been malformed; a validator is a new program (rule 6d) for a prompt whose content only review can judge. Cumulative diff review checks it against the lens contract. | closed (Skip) |
| K5-11 | tests should-fix 91 | nothing asserts no lens carries `plan-review: false` | Skip | The audit result is a recorded decision; the lens contract lets a project mark a lens later on evidence, so a test forbidding the marker would pin a policy rather than behaviour. | closed (Skip) |
| K5-12 | tests should-fix 95 | container tests do not assert `--memory`/`--name` argv or the budget deduction | Fix — carried to CR-1 | test assertions inside unchanged O3 d | carried |
| K5-13 | tests should-fix 94 | no test for container cleanup on signal/abort | Fix — carried to CR-2 | test assertions inside unchanged O3 d | carried |

minimalism: APPROVED, no findings.

Round 2 (r2, 2026-09-30 ~22:45–23:05; closure round: review-plan, correctness, error-handling, tests, minimalism). Closed: K5-01 (all witnesses), K5-03 (error-handling, review-plan), K5-04 (review-plan, minimalism, correctness; tests' NOT CLOSED is a test-assertion residual → CR-3), K5-06, K5-07 (review-plan, tests, minimalism, correctness). Not closed: K5-02 (error-handling: empty response), K5-05 (review-plan, correctness, minimalism nit: stale Decisions line).

| ID | Witness (lens, rank, conf) | Claim | Disposition | Evidence / Authority | Status |
|---|---|---|---|---|---|
| K5-02 (residual) | error-handling blocker 92 | a successful `gh` response with no runs/jobs has nothing to reject | Fix (O1: empty run/job list refuses; green needs positive evidence) | plan text | open |
| K5-05 (residual) | review-plan blocker 99; correctness blocker; minimalism nit 98 | Decisions still says package-level narrowing | Fix (Decisions line rewritten) | plan text | open |
| K5-14 | review-plan should-fix 97; correctness should-fix | reserving container memory from serial mutation caps it after e2e is gone | Fix (O3 d: mutation reserves only in the concurrent schedule) | `scripts/run-push-gates.mjs:630-634` read | open |
| K5-15 | review-plan should-fix 95 | scope creation from a caller outside agents.slice is unverified | Fix by evidence (measured premise added) | probe output in Traced premises | closed (arbiter: evidence only, no plan semantics changed) |
| K5-16 | review-plan blocker 100 | lens FILES input omitted `scripts/check-remote-ci.mjs` and tests | Fix (review packet, not plan text) | round-3 packet | closed (arbiter: packet) |
| K5-17 | tests blocker 91 | lock tests don't assert the lock is held until heavy children exit | Fix — carried to CR-4 | test assertion inside O3 a | carried |
| K5-18 | tests blocker 93 | no test that a changed test file adds its production file to mutate | Fix — carried to CR-5 | test assertion inside O4 | carried |
| K5-19 | tests blocker 87 | no test that an untracked-only file selects a lane | Fix — carried to CR-6 | test assertion inside O4 | carried |
| K5-04 (tests residual) | tests blocker | no test for an outside-slice caller | Fix — carried to CR-3 | test assertion | carried |
| K5-20 | error-handling late should-fix 100 | r2 delta file absent | Skip | `ls` shows `tasks/plans/.plan-delta-2026-09-30-k5-chessfable-gates-and-review.md-r2.diff` present; lens lookup error | closed (Skip) |

Round 3 (r3, 2026-09-30 ~23:10–23:25; closure round: review-plan, correctness, error-handling). Closed: K5-02 (error-handling, review-plan, correctness), K5-05 (review-plan, correctness; minimalism's nit closed by arbiter record — same text), K5-14 (review-plan, correctness). correctness and error-handling APPROVED.

| ID | Witness (lens, rank, conf) | Claim | Disposition | Evidence / Authority | Status |
|---|---|---|---|---|---|
| K5-21 | review-plan blocker 94 | tests don't prove the `gh` query is filtered to the upstream branch | Fix — carried to CR-7 | test assertion inside unchanged O1 ("on the upstream branch") | carried |
| K5-22 | review-plan blocker 96 | §1b does not specify a records lens for mixed ranges | Skip | Refuted by source: `~/.claude/references/push-review-policy.md:183-192` ("A mixed range … runs BOTH reviews in parallel: the §3 fan-out over a DIFF that excludes the record paths … and the records lens above over the record paths only"); the lens cited only `:120-140` | closed (Skip) |

Plan review closed after r3: no open plan-level issue; CR-1..CR-7 carried to the cumulative diff review. plan_adopted_per_round: r1=7 r2=3 r3=0. Unique issues: 22 (K5-01..K5-22); Fix 14 (7 plan-level, 7 carried as CR-1..CR-7 — six carried IDs plus K5-04's test residual), Skip 6, arbiter-closed 2.

## Raw plan-review lens reports

### lens-correctness-r1

```text
[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:77 — A `--frontend` gate can start e2e after `bundle` while `frontend-coverage` is still running; the scheduler does not make coverage an e2e dependency (`scripts/run-push-gates.mjs:91-106`). When mutation is serialized, coverage can be sized to the full budget (`:420-426`), but O3 subtracts the container’s 2.3 GiB only for frontend mutation. That leaves this reachable run over budget. Reserve the container memory from every lane that can overlap e2e, or order e2e after coverage. (confidence: 94)

VERDICT: REVISE
```

### lens-error-handling-r1

```text
[should-fix] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:60 — O1 does not say what happens if `gh run list` or `gh run view` fails or cannot establish a complete set of job results. Require the pre-push check to stop and surface the command error; otherwise an unavailable or incomplete query could leave the push without a red result to reject. (confidence: 97)

[should-fix] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:86 — O4 makes a missing upstream fatal, but leaves other `merge-base` or `git diff` failures unspecified. Require path-discovery errors to stop the command with their cause, never produce an empty change set that skips every lane. (confidence: 92)

VERDICT: APPROVED
```

### lens-minimalism-r1

```text
VERDICT: APPROVED
```

### lens-plan-r1

```text
[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:76 — The planned non-agent branch skips the transient scope, and O3’s tests would enshrine that behavior. The shared rule requires heavy steps to run in their own `agents.slice` scope, without a fallback to the current cgroup (`/home/felixb/.claude/references/gate-performance.md:95`). (confidence: 99)

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:20 — The MANDATE requires Stryker narrowed to changed files, but O4 selects entire packages. Changing only `gameSession.ts` selects both files in `game-practice` (`scripts/frontend-mutation-packages.mjs:2`), and Stryker mutates the full package list (`stryker.config.mjs:16`). (confidence: 99)

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:91 — A Rust-only change selects Windows clippy, but the build is conditioned on frontend inputs changing. That leaves `dist/` missing or stale; the existing scheduler rebuilds it for Rust changes and makes Rust lanes depend on that build (`scripts/run-push-gates.mjs:47`, `scripts/run-push-gates.mjs:76`). (confidence: 98)

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:89 — The LCOV-free mapping criteria omit an area with no measured production files. If the config and baseline both add such an area, the proposed scope check can pass, while the full report fails because that area has zero coverage files (`scripts/coverage-report.mjs:589`). The O4 test list does not cover this case (`:95`). (confidence: 95)

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:62 — O1/O2’s proof commands can pass with incorrect remote-red semantics or a missing §1b route. The bridge checker checks skill pairing and pointers (`scripts/check-skill-bridges.mjs:143`); the routing checker checks gate commands and §3 path globs (`scripts/check-gate-routing.mjs:263`). Neither checks those prose obligations, and the planned live check on green results does not exercise refusal (`/home/felixb/.claude/references/push-review-policy.md:1346`, `/home/felixb/.claude/references/push-review-policy.md:120`). (confidence: 98)

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:151 — P4’s contract-gate proof does not validate the new lens’s required frontmatter or section order. The contract chain has no lens validator (`package.json:18`), and the cited bridge checker enumerates skills, not `.claude/agents` (`scripts/check-skill-bridges.mjs:19`). (confidence: 98)

VERDICT: REVISE
```

### lens-tests-r1

```text
[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:62 — `skills:check` and `gates:routing:check` validate bridge and gate structure, not §4’s refusal on any red job’s newest completed result. The live check does not force a red job, so reverting that behavior can leave every listed proof green. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:68 — The §1b pointer and records-only/mixed-range routing are prose; the listed checks do not assert them. Removing the pointer while keeping §3’s path globs would still pass. (confidence: 98)

[should-fix] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:80 — The listed container cases do not assert that a supported Docker launch includes the measured `--memory` limit and unique `--name`, or that the limit is deducted from the concurrent budget. Omitting those behaviors can still pass the unsupported-Docker and cleanup cases, and the real-run log does not assert them. (confidence: 95)

[should-fix] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:80 — No listed test asserts that the launcher stops and removes its container on signal or runner abort. A regression that leaks the container on those paths can pass normal cleanup tests and the successful real run. (confidence: 94)

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:95 — The tests check lane selection, checker behavior, and command routing, but not that the workflow invokes pre-review checks after every repair and before code review. Running the command once on the current diff does not prove that ordering; removing it from the workflow would still pass. (confidence: 98)

[should-fix] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:151 — `gates:contract:check` has no assertion for the new lens’s required sections or Windows/macOS hunts. Removing those hunts while keeping the `CLAUDE.md` row can leave the proof green. (confidence: 92)

[should-fix] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r1.body.md:107 — The proof does not assert that none of the project lenses has `plan-review: false`; adding that marker to a lens would leave `gates:contract:check` green and silently change plan-review coverage. (confidence: 91)

VERDICT: REVISE
```

### lens-correctness-r2

```text
K5-01 CLOSED — O3(d) now reserves e2e memory from frontend coverage, which overlaps e2e when mutation runs last.

K5-02 CLOSED — O1 adds a script and tests for red jobs, newer results, and failed or incomplete `gh` responses.

K5-03 CLOSED — O4 stops on any failed Git path-discovery call.

K5-04 CLOSED — O3(c) requires a transient scope for every caller and refuses if creation or confirmation fails.

[blocker] K5-05 NOT CLOSED — O4 requires Stryker’s mutate set to contain only listed changed files, while the decision at line 113 says narrowing is package-level and per-file narrowing is rejected.

K5-06 CLOSED — O4 requires the frontend build before Windows clippy, including Rust-only changes.

K5-07 CLOSED — O4 requires failure when an area has no production files and includes that case in verification.

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:113 — This package-only mutation decision conflicts with revised O4 at line 90. For a changed file in a package with other mutation targets, the plan requires both package-level and changed-file-only mutate sets; align the decision with O4.

[should-fix] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:77 — When mutation runs last, the scheduler waits for e2e to finish before starting mutation (`scripts/run-push-gates.mjs:635`). Reserving e2e memory from mutation anyway understates its available budget; for example, with a 7 GiB override, the plan subtracts 2.3 GiB despite no overlap, reducing the Stryker budget from the full 7 GiB.

VERDICT: REVISE
```

### lens-error-handling-r2

```text
[blocker] K5-02 NOT CLOSED — O1 does not specify a refusal when the successful `gh` response contains no runs or job names.

K5-03 CLOSED — O4 says missing upstream or any failed Git path-discovery call stops with its cause, and verification covers both.

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:60 — With no returned jobs, the specified refusal check has nothing to reject and can allow a push without green remote evidence; verification at line 62 omits this case (confidence: 92).

LATE OBSERVATIONS

[should-fix] tasks/plans/.plan-delta-2026-09-30-k5-chessfable-gates-and-review-r2.diff:missing — The supplied r2 delta file is absent from the worktree, so I could not verify the exact changed hunks (confidence: 100).

VERDICT: REVISE
```

### lens-minimalism-r2

```text
K5-01 CLOSED — O3(d) now reserves e2e memory from the coverage and mutation budgets (plan:77).

K5-02 CLOSED — O1 specifies a tested remote-CI command that refuses on red, failed, malformed or incomplete results (plan:60–62).

K5-03 CLOSED — O4 refuses on any failed Git call during path discovery and tests that case (plan:86, 96).

K5-04 CLOSED — O3(c) requires a scope for every caller and refuses to run heavy steps if it cannot be created or confirmed (plan:76).

K5-05 CLOSED — O4 narrows Stryker’s mutate set to listed files and shares package selection between runners (plan:90, 96).

K5-06 CLOSED — O4 requires rebuilding `dist/` before Windows clippy, including for Rust-only changes (plan:93, 96).

K5-07 CLOSED — O4 checks for coverage areas with no production files and includes that failure in mapping-only verification (plan:89, 96).

[nit] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:113 — this trade-off still rejects per-file mutation narrowing, while O4 now requires it at line 90. Update the stale rationale so the plan does not endorse broader package-wide mutation (confidence: 98).

VERDICT: APPROVED
```

### lens-plan-r2

```text
K5-01 CLOSED — O3(d) now includes frontend coverage in the container reservation and names a budget test; the scheduler allows e2e to overlap coverage (`scripts/run-push-gates.mjs:91-106`; plan:77,80). (confidence: 97)

K5-02 CLOSED — O1 adds the remote check and tests for red, stale, malformed, and failed results, matching policy §8’s per-job rule (plan:60-62; `/home/felixb/.claude/references/push-review-policy.md:1346-1352`). (confidence: 97)

K5-03 CLOSED — O4 now refuses on any failed Git path-discovery call and includes that case in verification; the existing enumerator also fails on Git errors (`plan:86,96`; `scripts/working-tree-files.mjs:25-39`). (confidence: 96)

K5-04 CLOSED — O3(c) requires a scope under `agents.slice` for every caller and fails closed, matching gate-performance rule (c) (`plan:76`; `/home/felixb/.claude/references/gate-performance.md:95-98`). (confidence: 95)

[blocker] K5-05 NOT CLOSED — O4 requires Stryker to mutate the changed-file list (`plan:90`), while Decisions still says narrowing is package-wide and per-file narrowing is unnecessary (`plan:113`). The current config passes the entire package list to `mutate` (`stryker.config.mjs:16-18`). These instructions conflict. (confidence: 99)

K5-06 CLOSED — O4 requires rebuilding `dist/` for Rust-only changes and tests that ordering; the scheduler already makes `frontend-build` a Rust lane prerequisite (`plan:93,96`; `scripts/run-push-gates.mjs:47-52,69-77`). (confidence: 96)

K5-07 CLOSED — O4 adds the empty-production-area failure and mapping-only tests for each failure class; the full coverage check already rejects an area with no coverage data (`plan:89,96`; `scripts/coverage-report.mjs:589-592`). (confidence: 96)

[should-fix] `tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:76,141` — Felix’s terminal is a supported caller (`:33-34`), but the planned real run exercises only this agent session. The cited Korrigio helper returns without scoping callers outside `agents.slice` (`/home/felixb/Projekte/correction-app/scripts/gate_scope.sh:34-37`); terminal scope creation remains an unverified path, not evidence that the new wrapper cannot handle it. (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:77` — O3(d) reserves container memory from frontend mutation even when mutation runs last. In that schedule mutation waits for e2e to finish (`scripts/run-push-gates.mjs:631-634`), so this imposes a worker-budget cap after the container is gone. (confidence: 97)

[blocker] `tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:148` — the required FILES input omits P3’s new `scripts/check-remote-ci.mjs` and its tests, despite the phase listing them; the script registry is a separate integration point (`package.json:6-20`). The supplied file list is incomplete. (confidence: 100)

VERDICT: REVISE
```

### lens-tests-r2

```text
K5-01 CLOSED — O3 verification asserts reservation from coverage and mutation; CR-1 pins the container arguments and both deductions.
K5-02 CLOSED — O1 names refusal and pass cases; P3 runs the remote-check tests and live check.
K5-03 CLOSED — O4 tests refusal for a missing upstream and a failing Git call.
[blocker] K5-04 NOT CLOSED — O3’s tests cover scope failures, and the real run is from an agent session; neither exercises a caller outside `agents.slice`. Restoring the outside-slice bypass could pass.
K5-05 CLOSED — O4 requires an explicit file list, and the “only listed files mutated” assertion would catch mutation broadening back to a package.
K5-06 CLOSED — O4 explicitly tests a Rust-only change building the frontend before Windows clippy.
K5-07 CLOSED — O4 requires failure for an area with no production files and tests each mapping failure class.

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:80 — The lock tests don’t assert that a gate holds the lock until its heavy children exit. A regression that releases it after spawning a child could still pass the described contention test and the single real gate run, allowing two gates to overlap. (confidence: 91)
[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:96 — The verification doesn’t assert that a changed test file adds its related production file to Stryker’s mutate list. “Only listed files mutated” proves the runner honors a supplied list; omitting that test-to-production mapping could still pass. (confidence: 93)
[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r2.body.md:96 — The verification doesn’t name an untracked-only input that must select a lane. The real pre-review run can pass after tracked changes select lanes even if untracked source files are missed. (confidence: 87)

VERDICT: REVISE
```

### lens-correctness-r3

```text
K5-02 CLOSED — O1 and its verification now refuse empty run or job lists.
K5-05 CLOSED — the Decisions wording now specifies changed-file narrowing, matching O4.
K5-14 CLOSED — O3 d reserves mutation memory only when mutation can overlap e2e; the scheduler waits for e2e before serial mutation (`scripts/run-push-gates.mjs:630-634`).

Delta defects: none.
Plan blockers: none.

VERDICT: APPROVED
```

### lens-error-handling-r3

```text
K5-02 CLOSED — O1 now refuses empty run or job responses with their cause (plan:62–64).

VERDICT: APPROVED
```

### lens-plan-r3

```text
K5-02 CLOSED — O1:62–64 now refuses on empty run/job results and includes those cases in verification; policy §8 requires positive job-by-job evidence (`push-review-policy.md`:1346–1352).

K5-05 CLOSED — O4:92 and Decisions and trade-offs:115 specify changed-file mutation; the package-configured mutate set exists in `stryker.config.mjs`:9–18.

K5-14 CLOSED — O3(d):79,82 reserves container memory from mutation only when concurrent; the scheduler’s serial branch waits for e2e to finish (`run-push-gates.mjs`:630–645).

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r3.body.md:64 — O1’s injected-result cases and live check do not establish that `gh` queries the configured upstream branch. The workflow runs on all branches (`.github/workflows/test.yml`:3–9), while the current push instruction explicitly filters by branch (`.claude/skills/push/SKILL.md`:318–319); a wrong or unfiltered query could pass the planned checks. (confidence: 94)

[blocker] tasks/plans/.plan-2026-09-30-k5-chessfable-gates-and-review-r3.body.md:70 — O2 says mixed ranges run the records lens and fan-out “as §1b specifies,” but §1b assigns the records lens only when the whole diff is narrative records and says structured ledger files cancel that exemption (`push-review-policy.md`:120–140). The current §3 defines the fan-out (`.claude/skills/push/SKILL.md`:227–230); the cited policy does not specify adding a records lens for mixed ranges. (confidence: 96)

VERDICT: REVISE
```

## Cumulative diff review (push-review-policy §4a)

Round d1 (2026-10-01 ~01:20–01:45), `REVIEWED_THROUGH` 369e11489930d6c95fdd213b87a461323f5a3d7a, range c4443340..369e1148. Mixed range (§1b): code lenses correctness, root-cause, code-quality, minimalism, tests, error-handling over the diff without `tasks/findings.md`/`tasks/decisions.md` (all Codex `gpt-6-luna`/max, role sensitive for `package.json`), plus the records lens (`--role mechanical`) over those two ledgers. Carried items CR-1..CR-7: CLOSED by code-quality, error-handling and minimalism with test citations (see raw reports).

Before the review, the §2a pre-review run itself found a defect (EISDIR on a directory import in the mutation selection), repaired in 369e1148, and the contract gate found the `ls-files -z` test-shim regression of 4abd9f6d, repaired in 94792df1 (two fix rounds: round 1 left no change).

| ID | Witness (lens, rank, conf) | Claim | Disposition | Evidence |
|---|---|---|---|---|
| DC-01 | correctness blocker 99 | `pnpm mutation:frontend -- --files …` hands `--` to a parser that refuses it | Fix (fix-2) | measured in this repo: the command echo shows `node scripts/run-frontend-mutation.mjs -- --files …` and the usage error (a scratch pnpm project stripped `--`; this repo does not) |
| DC-02 | root-cause blocker 89 | e2e container cleanup starts after the run client settles; the scheduler's 2 s SIGKILL deadline can kill the launcher first | Fix (fix-2) | `scripts/run-e2e-container.mjs` cleanup after `run.done`; scheduler termination timeout 2 s |
| DC-03 | root-cause should-fix 96 | deleted test / removed import drops its former production file from mutation selection | Fix (fix-2) | `mutationFilesForChanges` queues only existing tests' current content |
| DC-04 | tests blocker 99 | remote-CI CLI exit code untested | Fix (fix-3) | tests call `checkRemoteCi` only |
| DC-05 | tests blocker 97 | nothing pins `gates:push`/`checks:pre-review` to the wrapper and `--pre-review` | Fix (fix-2, routing checker) | package.json scripts unasserted |
| DC-06 | tests should-fix 96 | no test for pre-review lanes skipped after a failed frontend build | Fix (fix-2) | existing test covers final-gate mode |
| DC-07 | code-quality should-fix 99 | coverage-report failure-matrix anchors stale | Fix (fix-4) | anchors moved with `--mapping-only` |
| DC-08 | code-quality should-fix 96 | restored "install dependencies inside the container" comment describes a route the launcher lacks | Skip | original comment restored verbatim in P1's fix round (pre-existing guidance for a manual run on another host); no behaviour claim about this launcher |
| DC-09 | code-quality should-fix 91 | P2 budget-share comments stale after the e2e reservation and Vitest floor | Fix (fix-2) | comment vs `makeLaneEnvironment` |
| DC-10 | error-handling should-fix 93 | missing root limit file yields a partial chain | Skip | measured: cgroup-v2 root exposes no `memory.max`/`memory.high` (`ls /sys/fs/cgroup/memory.max` → No such file); every non-root ancestor file is required |
| DC-11 | error-handling should-fix 94 | `docker info` preflight neither cancellable nor bounded | Fix (fix-2) | preflight supervisor not attached |
| DC-12 | minimalism should-fix 96 | launcher cancellation duplicates `installMultiChildSignalForwarding` | Fix (fix-2, rule 11) | `scripts/child-supervisor.mjs:110` read |
| DC-13 | minimalism should-fix 84 | import resolution duplicates `resolveSpecifier` in check-ipc-command-consumers | Fix (fix-2, rule 11) | `scripts/check-ipc-command-consumers.mjs:75` read |
| DC-14 | minimalism nit 94 | two-way fence comparison and schedule flattener duplicated | Fix (fix-2, rule 11) | `scripts/check-gate-routing.mjs:431-476` |
| DC-15 | minimalism nit 98 | signal exit-code helper exists three times | Fix (fix-2, rule 11) | grep: run-e2e-container:57, run-frontend-mutation:270, run-push-gates:538 |
| DC-16 | records should-fix 99 | decisions cite an untracked handoff | Fix (this record is committed before the final gates) | — |
| DC-17 | records nit 93 | a waiter may print the previous holder line | Skip | `gate-performance.md` rule (a) mandates the canonical snippet verbatim; the window is between `flock` and the holder write |

### Raw diff-review reports, round d1

#### lens-code-quality-d1

```text
[should-fix] scripts/coverage-report.mjs:37 — The failure matrix has stale source anchors after this refactor: row 3 points to :509, but its error is at :520; row 18 points to :618, but the scope mismatch is at :663; row 35 points to :1019, but the usage error is at :1071. Refresh the pointers so readers can follow the recorded failure evidence (confidence: 99).

[should-fix] scripts/run-e2e-container.mjs:197 — The comment recommends installing dependencies inside the container on macOS or Windows, but the launcher bind-mounts the project at `/work` and invokes its `node_modules/.bin/playwright`; the Windows path exits before that run and directs users to WSL or CI. The advice describes a route this launcher does not provide (confidence: 96).

[should-fix] scripts/run-push-gates.mjs:29 — The P2 comments describe coverage as receiving half or all of the budget, and say 15% of 40 GiB remains for the measured peak. The updated allocator subtracts the 4 GiB e2e reservation first and can raise coverage to `VITEST_MINIMUM_BUDGET_BYTES`. Clarify which budget the shares describe and how the floor affects them (confidence: 91).

CR-1 CLOSED — evidence ("a supported Docker launch uses the recorded limit, a unique name, and every existing flag", scripts/run-e2e-launchers-tests.mjs:142, :168, :171; "container names differ across launches from the same process", scripts/run-e2e-launchers-tests.mjs:182; "coverage and mutation receive memory and CPU shares in both placements", scripts/run-push-gates-tests.mjs:1496, :1536, :1537, :1540).

CR-2 CLOSED — evidence ("SIGINT and SIGTERM stop and remove the active container before the launcher exits", scripts/run-e2e-launchers-tests.mjs:300, :318; "an abort signal stops and removes the active container", scripts/run-e2e-launchers-tests.mjs:324, :343).

CR-3 CLOSED — evidence ("a caller outside agents.slice still creates the agents.slice scope without bypassing it", scripts/heavy-gate-tests.mjs:165, :171, :172).

CR-4 CLOSED — evidence ("fd 9 keeps the lock held after the gate exits until its inherited child exits (CR-4)", scripts/heavy-gate-tests.mjs:279, :300, :306).

CR-5 CLOSED — evidence ("a changed Vitest file adds its exercised production file to the mutation list (CR-5)", scripts/run-push-gates-tests.mjs:404, :417).

CR-6 CLOSED — evidence ("untracked-only production input selects its pre-review lanes (CR-6)", scripts/run-push-gates-tests.mjs:366, :374, :376, :379).

CR-7 CLOSED — evidence ("filters the gh query to the upstream branch and Test workflow", scripts/check-remote-ci-tests.mjs:140, :151, :157).

VERDICT: APPROVED
```

#### lens-correctness-d1

```text
[blocker] scripts/run-push-gates.mjs:521 — When a changed test imports a mapped production file, the mutation lane invokes `pnpm mutation:frontend -- --files …`. pnpm preserves the `--` separator, but `run-frontend-mutation.mjs:583` passes it unchanged to a parser that accepts only `--files <list>`, so the required pre-review lane exits before running Stryker. (confidence: 99)

CR-1 CLOSED — evidence (a supported Docker launch uses the recorded limit, a unique name, and every existing flag; scripts/run-e2e-launchers-tests.mjs:142; frontend self-sizing lane environment and P1 schedule anchor; scripts/run-push-gates-tests.mjs:1493)

CR-2 CLOSED — evidence (SIGINT/SIGTERM cleanup; scripts/run-e2e-launchers-tests.mjs:300; abort cleanup; scripts/run-e2e-launchers-tests.mjs:324)

CR-3 CLOSED — evidence (a caller outside agents.slice still creates the scope; scripts/heavy-gate-tests.mjs:165)

CR-4 CLOSED — evidence (fd 9 keeps the lock held until the inherited child exits; scripts/heavy-gate-tests.mjs:279)

CR-5 CLOSED — evidence (a changed Vitest file adds its exercised production file to the mutation list; scripts/run-push-gates-tests.mjs:404)

CR-6 CLOSED — evidence (untracked-only production input selects its pre-review lanes; scripts/run-push-gates-tests.mjs:366)

CR-7 CLOSED — evidence (filters the gh query to the upstream branch and Test workflow; scripts/check-remote-ci-tests.mjs:140)

VERDICT: REVISE
```

#### lens-error-handling-d1

```text
[should-fix] scripts/gate-parallelism.mjs:142 — If a mount-root limit file is missing while another ancestor reports a finite limit above 8 GiB, the probe uses that partial chain instead of the conservative fallback required by O3(b), potentially sizing workers too high (confidence: 93)

[should-fix] scripts/run-e2e-container.mjs:167 — The Docker memory preflight is awaited without attaching its supervisor to cancellation or setting a timeout. If `docker info` hangs, SIGINT/SIGTERM is latched but cannot stop the child, so the launcher never returns its interruption status and keeps the gate lock held (confidence: 94)

CR-1 CLOSED — “a supported Docker launch uses the recorded limit, a unique name…” [scripts/run-e2e-launchers-tests.mjs:142]; “frontend self-sizing lane environment…” checks coverage and conditional mutation reservations [scripts/run-push-gates-tests.mjs:1493].

CR-2 CLOSED — “SIGINT and SIGTERM stop and remove the active container…” [scripts/run-e2e-launchers-tests.mjs:300]; “an abort signal stops and removes the active container” [scripts/run-e2e-launchers-tests.mjs:324].

CR-3 CLOSED — “a caller outside agents.slice still creates the agents.slice scope…” [scripts/heavy-gate-tests.mjs:165].

CR-4 CLOSED — “fd 9 keeps the lock held after the gate exits until its inherited child exits” [scripts/heavy-gate-tests.mjs:279].

CR-5 CLOSED — “a changed Vitest file adds its exercised production file to the mutation list” [scripts/run-push-gates-tests.mjs:404].

CR-6 CLOSED — “untracked-only production input selects its pre-review lanes” [scripts/run-push-gates-tests.mjs:366].

CR-7 CLOSED — “filters the gh query to the upstream branch and Test workflow” [scripts/check-remote-ci-tests.mjs:140].

VERDICT: APPROVED
```

#### lens-minimalism-d1

```text
[should-fix] scripts/run-e2e-container.mjs:91 — `installLauncherCancellation` duplicates the signal listeners and child registry in `installMultiChildSignalForwarding` at `scripts/child-supervisor.mjs:110`. Extend the shared helper for abort signals and remove this local 37-line implementation. (confidence: 96)

[should-fix] scripts/run-push-gates.mjs:383 — `resolveLocalImport` independently resolves `@/` and relative imports already handled by `resolveSpecifier` in `scripts/check-ipc-command-consumers.mjs:75`. Share that path resolution, keeping extension and index-file probing as mutation-selection policy. (confidence: 84)

[nit] scripts/check-gate-routing.mjs:448 — The new validator repeats the two-way schedule-to-fence comparison in `validatePushGateSchedule` at lines 431–443; `preReviewGateScheduleCommands` also repeats the push schedule flattener. Share those routines while retaining mode-specific headings and messages; this cuts roughly 15 lines of duplicate plumbing. (confidence: 94)

[nit] scripts/run-e2e-container.mjs:56 — This three-line signal-to-exit-code helper duplicates `signalExitCode` in `scripts/run-push-gates.mjs:538` and `scripts/run-frontend-mutation.mjs:270`. Put it in a shared helper and route all three callers through it. (confidence: 98)

### Added-file counterfactuals

- `.claude/agents/review-platform-semantics.md`: the full lens is required by O5; no acceptance-bearing section can be cut.
- `scripts/check-remote-ci.mjs`: retain one checker for upstream lookup, newest completed results, validation, and refusal reporting; no smaller sufficient replacement found.
- `scripts/check-remote-ci-tests.mjs`: retain the fixture and O1 pass/refusal cases; no clear acceptance-bearing test reduction found.
- `scripts/heavy-gate.sh`: retain the lock, scope creation, and scope confirmation required by O3; no smaller sufficient wrapper found.
- `scripts/heavy-gate-tests.mjs`: retain the O3 failure-path coverage, including CR-3 and CR-4; no case is clearly removable.
- `scripts/mutation-package-selection.mjs`: retain the shared selector for the backend and frontend callers; removing it would duplicate the selection logic O4 says to share.

### Carried checks

- CR-1 CLOSED — “a supported Docker launch uses the recorded limit, a unique name, and every existing flag” (`scripts/run-e2e-launchers-tests.mjs:142`); budget reservation assertions (`scripts/run-push-gates-tests.mjs:1493`).
- CR-2 CLOSED — signal cleanup (`scripts/run-e2e-launchers-tests.mjs:300`) and abort cleanup (`:324`).
- CR-3 CLOSED — outside-slice caller still creates the scope (`scripts/heavy-gate-tests.mjs:165`).
- CR-4 CLOSED — lock stays held until an inherited child exits (`scripts/heavy-gate-tests.mjs:279`).
- CR-5 CLOSED — changed test adds its production import to mutation selection (`scripts/run-push-gates-tests.mjs:404`).
- CR-6 CLOSED — untracked-only production input selects lanes (`scripts/run-push-gates-tests.mjs:366`).
- CR-7 CLOSED — `gh` query uses the upstream branch and `Test` workflow (`scripts/check-remote-ci-tests.mjs:140`).

VERDICT: REVISE
```

#### lens-records-d1

```text
[should-fix] tasks/decisions.md:4764 — This `Review` link, repeated at lines 4775, 4786, and 4797, points to a handoff that is untracked and absent from `HEAD` and the reviewed range. Readers of the pushed decisions will not have the cited review record. (confidence: 99)

[nit] scripts/heavy-gate.sh:47 — A waiting gate can print the previous run’s holder: the new holder acquires the lock before replacing `heavy-gate.holder` at line 66. The diagnostic can therefore identify the wrong gate. (confidence: 93)

Unverifiable, not findings: tuxedo-config commit `dc95d84` and its `agent-gate` behavior are outside this repository (the commit object is absent). The prior GitHub results and underlying machine/Docker measurements cannot be independently checked without querying live services. The local K5 handoff records some measurements but is untracked. `./scripts/findings.py check` could not run because its temporary-file creation was blocked by the read-only filesystem.

VERDICT: REVISE
```

#### lens-root-cause-d1

```text
[blocker] scripts/run-e2e-container.mjs:261 — The launcher reaches `docker rm -f` only after its Docker `run` supervisor settles. In the production gate path, the outer supervisor has a two-second termination deadline and can SIGKILL the gate process group; the Docker command runs in a separate detached group. If `docker run` is slow to stop after a gate-runner signal, the launcher can be killed before cleanup, leaving the daemon-owned container running after the heavy gate scope releases its budget and lock. The direct signal and abort tests do not cover this caller chain. (confidence: 89)

[should-fix] scripts/run-push-gates.mjs:430 — A deleted changed test, or a changed test that removes its production import, is omitted from the scan because only existing test files are queued and only their current contents are read. The previously exercised production file is then absent from `mutationFiles`, so pre-review may skip its mutation lane. (confidence: 96)

Prior-fix check: no previously fixed defect was found reintroduced in the history reviewed.

CR-1 CLOSED — evidence: “a supported Docker launch uses the recorded limit, a unique name, and every existing flag” (`scripts/run-e2e-launchers-tests.mjs:142`); “frontend self-sizing lane environment and P1 schedule anchor” (`scripts/run-push-gates-tests.mjs:1493`).

CR-2 CLOSED — evidence: “SIGINT and SIGTERM stop and remove the active container before the launcher exits” and “an abort signal stops and removes the active container” (`scripts/run-e2e-launchers-tests.mjs:300`, `:324`). The blocker above concerns the outer gate-runner cancellation path.

CR-3 CLOSED — evidence: “a caller outside agents.slice still creates the agents.slice scope without bypassing it” (`scripts/heavy-gate-tests.mjs:165`).

CR-4 CLOSED — evidence: “fd 9 keeps the lock held after the gate exits until its inherited child exits” (`scripts/heavy-gate-tests.mjs:279`).

CR-5 CLOSED — evidence: “a changed Vitest file adds its exercised production file to the mutation list” (`scripts/run-push-gates-tests.mjs:404`). The finding above covers deleted tests and removed imports.

CR-6 CLOSED — evidence: “untracked-only production input selects its pre-review lanes” (`scripts/run-push-gates-tests.mjs:366`).

CR-7 CLOSED — evidence: “filters the gh query to the upstream branch and Test workflow” (`scripts/check-remote-ci-tests.mjs:140`).

VERDICT: REVISE
```

#### lens-tests-d1

```text
CR-1 CLOSED — “a supported Docker launch uses the recorded limit, a unique name, and every existing flag” (`scripts/run-e2e-launchers-tests.mjs:142`); “frontend self-sizing lane environment and P1 schedule anchor” (`scripts/run-push-gates-tests.mjs:1493`).

CR-2 CLOSED — “SIGINT and SIGTERM stop and remove the active container before the launcher exits” (`scripts/run-e2e-launchers-tests.mjs:300`); “an abort signal stops and removes the active container” (`:324`).

CR-3 CLOSED — “a caller outside agents.slice still creates the agents.slice scope without bypassing it” (`scripts/heavy-gate-tests.mjs:165`).

CR-4 CLOSED — “fd 9 keeps the lock held after the gate exits until its inherited child exits” (`scripts/heavy-gate-tests.mjs:279`).

CR-5 CLOSED — “a changed Vitest file adds its exercised production file to the mutation list” (`scripts/run-push-gates-tests.mjs:404`).

CR-6 CLOSED — “untracked-only production input selects its pre-review lanes” (`scripts/run-push-gates-tests.mjs:366`).

CR-7 CLOSED — “filters the gh query to the upstream branch and Test workflow” (`scripts/check-remote-ci-tests.mjs:140`) and “refuses with the git failure cause” (`:184`).

[blocker] scripts/check-remote-ci-tests.mjs:97 — Red-result tests assert the return from `checkRemoteCi`, but none execute the CLI and assert its process exit code. Reverting `process.exitCode = result.exitCode` in `scripts/check-remote-ci.mjs:217` would leave the tests green while `ci:remote:check` could print RED and exit 0, allowing a push. (confidence: 99)

[blocker] package.json:21 — Tests exercise the heavy-gate wrapper and scheduler separately, but do not assert that `gates:push` or `checks:pre-review` still invoke the wrapper; the pre-review scheduler test calls `runPushGates(["--pre-review"])` directly (`scripts/run-push-gates-tests.mjs:477`). Removing the wrapper from either package command—or removing `--pre-review` from line 22—would leave those tests green while real gates could bypass the lock and scope, or pre-review could run only the default contract schedule. (confidence: 97)

[should-fix] scripts/run-push-gates-tests.mjs:474 — The Rust-only pre-review test covers a successful build followed by Windows clippy. No test makes that build fail and asserts the pre-review Windows-clippy and bundle lanes are skipped. Reverting the pre-review dependency guard at `scripts/run-push-gates.mjs:957` would still pass this test; the existing build-failure test exercises the separate final-gate mode. (confidence: 96)

VERDICT: REVISE
```

### Closure round d2

`REVIEWED_THROUGH` 811e1064824892e5a7152a3083feefd1da8c0753 (repairs 9431b862, 010ba043, 811e1064 over 369e1148..811e1064; pre-review green before the round). Lenses: the six code lenses (each closing its own d1 items) plus the records lens on this handoff.

Closed: DC-01 (correctness), DC-04, DC-05, DC-06 (tests), DC-07, DC-09 (code-quality), DC-11 (error-handling, with a follow-up below), DC-12–DC-15 (minimalism). DC-03: root-cause wrote NOT CLOSED only because its sandbox could not create the test's `/tmp` fixture (EROFS) — closed by the orchestrator's run of `pnpm gates:contract:check` (includes `gates:push:test` with "pre-review scans merge-base test contents for deleted and removed imports"), exit 0.

| ID | Witness | Claim | Disposition | Evidence |
|---|---|---|---|---|
| DC-02 (residual, lineage DC-02) | root-cause blocker 86; error-handling blocker 91 | `docker rm -f` has no timeout; the 15 s lane kill can still beat cleanup | Fix (d3 repair) | `scripts/run-e2e-container.mjs` cleanupContainer unbounded — read |
| DC-18 (lineage DC-11) | error-handling blocker 94 | preflight cancellation discards rejected termination results and can hang | Fix (d3 repair) | `Promise.allSettled` without bound — read |
| DC-19 (lineage DC-03) | correctness blocker 96 | the base-version scan resolves imports in the current tree; a removed barrel re-export is missed | Fix (d3 repair: same resolver over the base tree) | read `mutationFilesForChanges` |
| DC-20 | tests blocker 99 | runPushGates' default merge-base wiring is untested | Fix (d3 repair) | selection tests pass `mergeBase` by hand — read |
| DC-21 | code-quality nit 85 | base-read failure uses the path-discovery headline | Fix (d3 repair) | — |
| DC-22 | minimalism nit 88 | `discoverPreReviewChangedPaths` wrapper has only test callers | Fix (d3 repair) | — |
| DC-23 | minimalism late should-fix 84 | pre-existing `installSignalForwarding` duplicates the multi-child helper | Fix (d3 repair, rule 11, same area) | `scripts/child-supervisor.mjs:181`, sole caller `run-backend-mutation.mjs:410` — read |
| DC-24 | records should-fix 99 | handoff summary counts did not add up (22 vs 21) | Fix (orchestrator record edit: 14 Fix, 6 Skip, 2 arbiter-closed) | recount of the r1–r3 tables |
| DC-17 (again) | records nit 97 | waiting gate can print the previous holder | Skip (unchanged premise; see d1) | — |

DC-16 closes with this file's commit (records lens confirmed the four decision `Review` links match this path).

#### Raw closure-round d2 reports

##### lens-code-quality-d2

```text
DC-07 CLOSED — evidence (scripts/coverage-report.mjs:556, 1075, 1078; “mapping-only CLI rejects each invalid mapping and stale baseline scope” and its three named subtests)

DC-09 CLOSED — evidence (scripts/run-push-gates.mjs:31; scripts/run-push-gates-tests.mjs:1654, “coverage and mutation receive memory and CPU shares in both placements”)

[nit] scripts/run-push-gates.mjs:451 — A failed `git show` while reading a changed test’s merge-base contents uses an error headline saying pre-review changed-path discovery failed; the changed paths are already known, and this step is selecting mutation inputs (confidence: 85)

VERDICT: APPROVED
```

##### lens-correctness-d2

```text
DC-01 CLOSED — evidence (scripts/run-frontend-mutation.mjs:370; scripts/run-frontend-mutation-tests.mjs:274, “frontend mutation arguments accept the pnpm-preserved separator” passed; the CLI fixture test was blocked by EROFS creating `/tmp` fixtures)

[blocker] scripts/run-push-gates.mjs:479 — A merge-base test importing a barrel can miss its former production dependency: if the base barrel re-exported `src/components/boards/gameSession.ts` and the diff removes that re-export and the test import, the scan follows the current barrel at :482, selects no mutation file, and skips Stryker. O4 requires including in-scope production files whose related tests changed. (confidence: 96)

VERDICT: REVISE
```

##### lens-error-handling-d2

```text
DC-11 CLOSED — evidence (`scripts/run-e2e-container.mjs:34,173-185`; `scripts/run-e2e-launchers-tests.mjs:256`, “docker info preflight has a bounded timeout that refuses with its cause”; `:274`, “SIGTERM cancels a hung docker info preflight without starting the container”). The focused test attempt failed before assertions with `ERR_TEST_FAILURE`, so this is source and test inspection, not a passing local run.

[blocker] scripts/run-e2e-container.mjs:184 — On preflight cancellation, `Promise.allSettled` discards rejected termination results. If the Docker child later closes, the caller gets only exit 130/143 and loses the cleanup cause; if it stays alive, this wait can hang. (confidence: 94)

[blocker] scripts/run-push-gates.mjs:665 — If `docker rm -f` remains pending during cancellation, it has no timeout (`scripts/run-e2e-container.mjs:135-149`), while the e2e lane is killed after 15 seconds. The caller then sees only gate interruption; the launcher cannot report the cleanup error or whether a retry is clean. (confidence: 91)

VERDICT: REVISE
```

##### lens-minimalism-d2

```text
DC-12 CLOSED — launcher cancellation now uses shared multi-child forwarding (`scripts/run-e2e-container.mjs:165`; tests “multi-child forwarding treats an already-aborted signal as cancellation” and “an abort signal stops and removes the active container”).

DC-13 CLOSED — both import resolvers use `importSpecifierBasePath` (`scripts/check-ipc-command-consumers.mjs:77`, `scripts/run-push-gates.mjs:392`; test “the IPC caller can preserve its broader dot-relative spelling”).

DC-14 CLOSED — schedule flattening and two-way fence comparison are shared (`scripts/run-push-gates.mjs:291`, `scripts/check-gate-routing.mjs:479`; tests “requires every scheduled push gate command to remain an exact skill fence” and “checks every pre-review runner command against the new skill block in both directions”).

DC-15 CLOSED — the three production sites share `signalExitCode` (`scripts/child-supervisor.mjs:6`; test “signal exit codes retain 128 plus signal number and default unknowns to 128”).

D2 findings:

[nit] scripts/run-push-gates.mjs:333 — `discoverPreReviewChangedPaths` only projects `.paths` from `discoverPreReviewChanges`; its three callers are tests. Update them to read `.paths` directly and remove the wrapper. (confidence: 88)

LATE OBSERVATIONS

[should-fix] scripts/child-supervisor.mjs:181 — The existing `installSignalForwarding` repeats the SIGINT/SIGTERM latch and late-child attachment behavior in `installMultiChildSignalForwarding` (line 118). Its only production caller is `run-backend-mutation.mjs:410`, which can use the shared helper’s late `attach`; remove the duplicate listener implementation. (confidence: 84)

Blockers in c4443340..HEAD: none found.

VERDICT: REVISE
```

##### lens-records-d2

```text
[should-fix] tasks/handoffs/2026-09-30-k5-chessfable-gates-and-review-review.md:9 — The summary says there are 22 unique issues, but its category totals add to 21. Counting each K5 ID once, the table shows 14 Fix, 6 Skip, and 2 arbiter-closed; the same summary is repeated at line 68. (confidence: 99)

[nit] scripts/heavy-gate.sh:46 — A waiting gate can read the previous holder’s details: it reads the persistent holder file after failing `flock`, while the new lock owner writes its details later at line 66. The handoff accurately notes this race at line 301, but it remains in the code. (confidence: 97)

The four `Review` links in `tasks/decisions.md` (lines 4764, 4775, 4786, and 4797) exactly match this handoff’s path. The handoff is still untracked, so DC-16’s stated closure condition is pending its commit.

Historical session provenance and systemd/Docker measurements could not be independently verified from Git; I did not query live services.

VERDICT: REVISE
```

##### lens-root-cause-d2

```text
[blocker] DC-02 NOT CLOSED — Cleanup now starts before the Docker run client settles, but it can still remain unconfirmed when the e2e lane reaches its 15 s kill deadline; see the blocker below. (confidence: 86)

[should-fix] DC-03 NOT CLOSED — `mutationFilesForChanges` now scans the merge-base test contents, and the test “pre-review scans merge-base test contents for deleted and removed imports” covers both cases at `scripts/run-push-gates-tests.mjs:422`. I couldn’t observe a passing-after result: the test setup failed with `EROFS` creating its `/tmp` fixture. This is a verification limitation, not evidence of a remaining code defect. (confidence: 96)

[blocker] scripts/run-push-gates.mjs:51 — The fixed 15 s grace does not bound or confirm `docker rm -f`: `cleanupContainer` starts a detached Docker command without a timeout (`scripts/run-e2e-container.mjs:72-76, 135-138`), and the launcher waits for it while the outer lane supervisor has a 15 s escalation. If removal stalls past that, the launcher can be killed before reporting cleanup failure or confirming the container was removed. The added cancellation test only delays `docker run` and lets removal return immediately; it does not cover this path. Test execution was blocked by `EROFS` creating `/tmp/e2e-launcher-*`. (confidence: 86)

VERDICT: REVISE
```

##### lens-tests-d2

```text
DC-04 CLOSED — CLI tests assert exit codes 0, 1, and 2 in `scripts/check-remote-ci-tests.mjs:344` (“CLI exits 0 when all newest completed jobs succeed”), `:354` (“CLI exits 1 and names a red job”), and `:365` (“CLI exits 2 and prints the gh failure cause”); `ci:remote:test` is in the contract gate (`package.json:17,20`).

DC-05 CLOSED — “push gate package scripts preserve the heavy-gate wrapper and pre-review mode” rejects both broken commands in `scripts/check-gate-routing-tests.mjs:97`; the routing test is in the contract gate (`package.json:19,20`).

DC-06 CLOSED — “pre-review frontend-build failure skips Windows clippy and bundle” asserts both commands are absent and both lanes are skipped after build exit 9 in `scripts/run-push-gates-tests.mjs:601`; `gates:push:test` is in the contract gate (`package.json:20,23`).

[blocker] scripts/run-push-gates-tests.mjs:453 — “pre-review mutation reads use the path-discovery git runner and merge base” calls discovery and selection separately, manually passing `mergeBase`; no test exercises `runPushGates`’ default wiring at `scripts/run-push-gates.mjs:980`. The other pre-review scheduler tests inject `discoverChangedPaths`, which leaves `mergeBase` undefined. Reverting the scheduler glue to path-only discovery while retaining both helpers would keep these tests green, but deleted or import-removed tests would stop selecting their former production files. (confidence: 99)

VERDICT: REVISE
```

### Closure round d3

`REVIEWED_THROUGH` 057232e7c447346b8722faac46186f24a00d5935 (d2 repair commit over 811e1064..057232e7; pre-review green). Six code lenses. Closed: DC-19 (correctness), DC-20 (tests), DC-21 (code-quality), DC-22, DC-23 (minimalism).

| ID | Witness | Claim | Disposition | Evidence |
|---|---|---|---|---|
| DC-02 (second failed closure, lineage DC-02) | error-handling blocker 96 | the launcher's bounded cleanup report is still lost: the scheduler closes the lane log as soon as the signal wins | Escalated (§4a rule 3): mechanism note + focused review-plan judgment → mechanism A | `scripts/run-push-gates.mjs` runCommand race and `finally closeSync` — read |
| DC-18 (second failed closure, lineage DC-11) | error-handling blocker 95 | same loss for the preflight termination report | Escalated with DC-02 | same |
| DC-25 | correctness blocker 94 | the base-tree walk selects a production file the change deletes | Fix (fix-5: keep only working-tree files) | `mutationFilesForChanges` base pass — read |
| DC-26 | tests should-fix 94 | `git ls-tree` failure branch untested | Fix (fix-5) | — |
| DC-27 | code-quality blocker 97 (naming) | `DOCKER_RUN_TERMINATION_TIMEOUT_MS` governs every docker command | Fix (fix-5: rename) | — |
| DC-28 | error-handling should-fix 86 | cleanup failure plus client-termination rejection reports only one cause | Fix (fix-5) | — |
| DC-29 | minimalism late should-fix 91 | error-cause traversal duplicated (`nestedErrorMessage`) | Fix (fix-5, rule 11) | — |

**Focused judgment (review-plan, fresh context, lineages DC-02 and DC-11):** contested invariant — a cancellation-time cleanup failure must reach the gate caller. Previous answers: start cleanup earlier (d1), bound `docker rm -f` (d2). New evidence: the loss is in the scheduler, not the launcher (runCommand closes the log on interruption). Judgment: mechanism A — keep capturing the interrupted child's output and record its exit, print the failed lane's log tail and path, keep exit 130/143; but never wait on bare `supervisor.done`, because a failed kill (EPERM) sets no escalation timer and the existing EPERM no-hang test must hold. Rejected: a side file (B: extra channel), accepting the loss (C: violates O3 d). Resulting obligation: the scheduler-level test in fix-5's brief.

#### Raw closure-round d3 reports and the judgment

##### lens-code-quality-d3

```text
DC-21 CLOSED — evidence (scripts/run-push-gates.mjs:499; scripts/run-push-gates-tests.mjs:547, “pre-review skips a test absent at merge-base and stops on other git show failures”)

No additional readability defects in the d2 diff.

[blocker] scripts/run-e2e-container.mjs:31 — `DOCKER_RUN_TERMINATION_TIMEOUT_MS` implies this grace applies only to `docker run`; `startDockerCommand` also uses it for `docker info` and `docker rm` cleanup, as shown by the cleanup-window assertion in `run-e2e-launchers-tests.mjs:509` (confidence: 97)

VERDICT: REVISE
```

##### lens-correctness-d3

```text
DC-19 (DC-03 lineage) CLOSED — evidence (scripts/run-push-gates.mjs:468-509; scripts/run-push-gates-tests.mjs:424, “pre-review scans merge-base test contents for deleted and removed imports,” and :508, “runPushGates passes discovered merge base into deleted-test mutation selection”). The focused `node --test` attempt returned `ERR_TEST_FAILURE` before subtests, so I did not observe a local pass.

[blocker] scripts/run-push-gates.mjs:449 — The d3 base-tree walk adds an imported production path even when the change deletes that file. For example, deleting `src/components/boards/gameSession.ts` and its test still selects the old import target; `runPushGates` passes the absent path to the frontend mutation runner as a Stryker mutate target. (confidence: 94)

Blockers elsewhere in c4443340..HEAD: none found.

VERDICT: REVISE
```

##### lens-error-handling-d3

```text
[blocker] DC-02 NOT CLOSED — The launcher bounds `docker rm -f`, but during gate cancellation `runCommand` returns on the signal and closes the e2e log at `scripts/run-push-gates.mjs:702, 707`. The later cleanup error is appended to that closed log at `:680`, so the gate caller sees interruption without the cleanup cause or retry status. The new test invokes the launcher directly (`scripts/run-e2e-launchers-tests.mjs:507`), so it misses this caller path. (confidence: 96)

[blocker] DC-18 NOT CLOSED — The preflight helper reports termination failures or timeouts at `scripts/run-e2e-container.mjs:221, 227`, but the gate caller has already closed the child log on cancellation (`scripts/run-push-gates.mjs:702, 707`). Its direct-launcher tests (`scripts/run-e2e-launchers-tests.mjs:294, 317`) do not verify that the gate caller receives the cause. (confidence: 95)

[should-fix] scripts/run-e2e-container.mjs:330 — If container cleanup fails while Docker-client termination also rejects, the cleanup-error branch reports only the cleanup failure and drops the distinct termination cause, which could explain why the client remains alive during retry diagnosis. (confidence: 86)

Blockers in c4443340..HEAD: DC-02 and DC-18.

VERDICT: REVISE
```

##### lens-minimalism-d3

```text
DC-22 CLOSED — evidence (scripts/run-push-gates.mjs:307; scripts/run-push-gates-tests.mjs:378, test “untracked-only production input selects its pre-review lanes”)

DC-23 CLOSED — evidence (scripts/run-backend-mutation.mjs:410; scripts/child-supervisor-tests.mjs:5, test “multi-child forwarding treats an already-aborted signal as cancellation”)

Defects introduced by the d2 diff: none found.

Blockers in c4443340..HEAD: none found.

### LATE OBSERVATIONS

[should-fix] scripts/run-e2e-container.mjs:62 — The new recursive walk over `AggregateError.errors` and `error.cause` duplicates `nestedErrorMessage` in scripts/run-push-gates.mjs:260. Share the cause traversal and pass the output formatting as a parameter (confidence: 91).

VERDICT: REVISE
```

##### lens-root-cause-d3

```text
[should-fix] scripts/run-e2e-container.mjs:141 — DC-02 NOT CLOSED: the code adds a 10-second cleanup timeout, and `scripts/run-e2e-launchers-tests.mjs:507` adds “a hung docker rm reports the named cleanup failure before the e2e lane window.” But no failing-before/passing-after result is available. My focused test attempt exited at the file level with only “test failed”; the test also starts from an already-failed `docker run`, so it does not reproduce scheduler cancellation while the run client is still terminating. (confidence: 95)

VERDICT: REVISE
```

##### lens-tests-d3

```text
DC-20 CLOSED — evidence (scripts/run-push-gates-tests.mjs:508, “runPushGates passes discovered merge base into deleted-test mutation selection”)

Defects introduced by the d2 diff:

[should-fix] scripts/run-push-gates.mjs:471 — The `git ls-tree` failure branch has no red-path assertion. The existing mutation Git-error test makes `ls-tree` succeed and fails `git show` instead; reverting this branch to continue with an empty base tree would still pass while deleted tests lose their former mutation targets (confidence: 94).

Blockers in c4443340..HEAD: none found.

VERDICT: APPROVED
```

##### lens-plan-judgment-1

```text
**Mechanism:** Choose A as the reporting path: the gate already captures child output in its per-task log, and the summary prints that log’s tail and path. B adds a side channel and log-directory plumbing; C drops information O3(d) requires the caller to receive.

[blocker] [Plan:82](/home/felixb/Projekte/chessfable/tasks/plans/2026-09-30-k5-chessfable-gates-and-review.md:82) — The proposed wait is described as bounded by `terminationTimeoutMs`, but that timeout only schedules SIGKILL after SIGTERM succeeds. If signaling fails, no escalation timer is set; `supervisor.done` can also wait indefinitely for the process-group sweep. The existing test injects `EPERM` and expects the scheduler not to wait forever. Keep A’s log open through successful child termination, but preserve a prompt path when termination fails. Evidence: [runCommand closes the log after the signal race](/home/felixb/Projekte/chessfable/scripts/run-push-gates.mjs:706), [supervisor termination](/home/felixb/Projekte/chessfable/scripts/child-supervisor.mjs:68), [process-group sweep](/home/felixb/Projekte/chessfable/scripts/child-supervisor.mjs:34), [EPERM regression test](/home/felixb/Projekte/chessfable/scripts/run-push-gates-tests.mjs:1593). (confidence: 98)

**Behavior contract**

- On interruption, keep capturing child output through shutdown and record its final exit code.
- Show the interrupted lane’s child failure, log path, and cleanup message naming the container and error, including that a clean retry is not known.
- If termination fails, report that failure without unconditionally waiting on bare `supervisor.done`.
- Keep the gate’s overall exit code at 130 for SIGINT or 143 for SIGTERM.

**Proof:** Add a scheduler-level integration test in `scripts/run-push-gates-tests.mjs`: interrupt a child that then writes a cleanup failure and exits 1; assert the summary includes the message and log path, records the child exit, and the gate exits 143. Retain the existing EPERM no-hang test. The launcher-level cleanup tests alone do not catch the scheduler closing its log early.

VERDICT: REVISE
```

### Closure round d4

`REVIEWED_THROUGH` eb69843dadb67d48d0c9a31617a23231f699da56 (repair eb69843d over 057232e7..eb69843d; pre-review green). Six code lenses. Closed: DC-25 (correctness), DC-26 (tests), DC-27 (code-quality), DC-28 (error-handling), DC-29 (minimalism); DC-02 and DC-18 CLOSED by tests and error-handling on the scheduler side.

| ID | Witness | Claim | Disposition | Evidence |
|---|---|---|---|---|
| DC-30 (lineage DC-02, third failed closure per root-cause) | root-cause blocker 98 | the launcher's cancellation path still waits on `run.done` after a rejected client termination | Fix (fix-6) — not a new mechanism: the judged contract ("never wait on bare `done` once termination failed") was applied in runCommand but not in the launcher; one shared primitive in child-supervisor now serves all waiters | `scripts/child-supervisor.mjs` terminate() sends SIGTERM synchronously before the escalation timer — read |
| DC-31 (lineage DC-11) | error-handling blocker 96 | `startDockerCommand`'s timeout path awaits `supervisor.done` after a failed kill | Fix (fix-6, same primitive) | same source |
| DC-32 | minimalism should-fix 95, 91 | child-result mapping duplicated in runCommand; outcome fields copied in runStep and runLane | Fix (fix-6) | — |
| DC-33 | code-quality nits 98; minimalism nits 97–86 | dead `interruptionSignal`, unread `terminationFailure`, unused formatter argument, two single-use helpers | Fix (fix-6) | — |
| DC-34 | error-handling should-fix 86 | check-remote-ci reports "no exit status" for a signal-killed git/gh | Fix (fix-6) | `scripts/check-remote-ci.mjs:45` — read |

Lineage guard: if the DC-02 lineage fails closure again after fix-6, it stops being patched in this run and becomes a named implementation obligation filed with this record as its history.

#### Raw closure-round d4 reports

##### lens-code-quality-d4

```text
DC-27 CLOSED — evidence (scripts/run-e2e-container.mjs:32; scripts/run-e2e-launchers-tests.mjs:551, “a hung docker rm reports the named cleanup failure before the e2e lane window”)

Defects introduced by the d2 diff: none remain; the earlier error-label nit now identifies the merge-base path at scripts/run-push-gates.mjs:498.

Readability blockers anywhere in c4443340..HEAD: none found.

### LATE OBSERVATIONS

[nit] scripts/child-supervisor.mjs:190 — `terminationFailure` is stored on the child entry but never read there; termination callers use the promise returned by `attach()`. (confidence: 98)

[nit] scripts/run-push-gates.mjs:718 — `interruptionSignal` is returned in both interruption branches but neither caller consumes it; the scheduler reads the forwarding context directly. (confidence: 98)

VERDICT: APPROVED
```

##### lens-correctness-d4

```text
DC-25 CLOSED — evidence (scripts/run-push-gates.mjs:510; scripts/run-push-gates-tests.mjs:465, “deleted production targets are not selected”)

Defects introduced by the d2 diff: none remain. The merge-base scan now reads imports from that tree (scripts/run-push-gates.mjs:503; test: “pre-review scans merge-base test contents for deleted and removed imports”, scripts/run-push-gates-tests.mjs:424).

Blockers anywhere in c4443340..HEAD: none found.

VERDICT: APPROVED
```

##### lens-error-handling-d4

```text
DC-02 CLOSED — the scheduler retains shutdown output and child exit status, then prints the lane log tail (scripts/run-push-gates.mjs:703, :969; test “interrupted lanes retain shutdown output and record the child's exit”; focused test run failed at file level before assertions).

DC-18 CLOSED — the launcher reports preflight termination failures, and the scheduler retains the output through shutdown (scripts/run-e2e-container.mjs:228; scripts/run-push-gates.mjs:703; tests “preflight cancellation reports a rejected child termination and its cause” and “interrupted lanes retain shutdown output and record the child's exit”; focused runs failed at file level before assertions).

DC-28 CLOSED — cleanup and Docker-client termination failures are reported separately (scripts/run-e2e-container.mjs:331, :335; test “cancellation reports cleanup and Docker client termination failures”; focused test run failed at file level before assertions).

Defects introduced by the d2 diff:

[blocker] scripts/run-e2e-container.mjs:105 — If an internal Docker command times out and `supervisor.terminate()` rejects, the catch only stores that error. `done` still waits on `supervisor.done` (:109), so a child that stays alive leaves `docker info` pending without a diagnostic; cleanup can likewise fail to report whether retry is safe. The termination failure occurs before the supervisor starts its escalation timer (scripts/child-supervisor.mjs:77), so the timeout does not bound this case and the gate can keep its heavy-gate lock indefinitely (confidence: 96).

[should-fix] scripts/check-remote-ci.mjs:45 — If `git` or `gh` exits by signal, `spawnSync` can return `status: null` and a signal name, but this branch reports only “no exit status.” The check refuses, yet loses the actionable signal cause required by O1 (confidence: 86).

The d2 timeout defect is the only blocker found in the full range.

VERDICT: REVISE
```

##### lens-minimalism-d4

```text
DC-29 CLOSED — evidence (scripts/child-supervisor.mjs:6; scripts/run-e2e-container.mjs:62; scripts/run-push-gates.mjs:261; scripts/child-supervisor-tests.mjs:36, test “nested errors share traversal while callers choose their formatting”)

Defects introduced by the d2 diff: none found.

Blockers anywhere in `c4443340..HEAD`: none found.

### LATE OBSERVATIONS

[should-fix] scripts/run-push-gates.mjs:724 — The interrupted path duplicates the child-result-to-command-result mapping at lines 738–742. Extract one mapper and use it in both paths (confidence: 95).

[should-fix] scripts/run-push-gates.mjs:820 — Child outcome fields are copied in both `runStep` and `runLane` (lines 820–822 and 898–900). Share the field recording so the two task paths stay in sync (confidence: 91).

[nit] scripts/run-push-gates.mjs:718 — `interruptionSignal` is returned in both branches but never read; the caller derives the exit code from `signalForwarding.requestedSignal`. Remove the unused field (confidence: 98).

[nit] scripts/child-supervisor.mjs:11 — The formatter callback receives the original error, but neither production caller uses it (`_error` in the gate formatter); remove this unused callback argument (confidence: 97).

[nit] scripts/child-supervisor.mjs:126 — `startChildTermination` has one caller at line 108 and no planned second consumer. Inline its memoization and failure notification there (confidence: 89).

[nit] scripts/run-e2e-container.mjs:166 — `waitForPreflightCancellation` has one caller at line 222 and no planned second consumer. Keep the timeout race in that branch instead of adding a single-use helper boundary (confidence: 86).

VERDICT: REVISE
```

##### lens-root-cause-d4

```text
[blocker] DC-02 NOT CLOSED — the scheduler now keeps its log open, but the launcher can still be killed before it emits the cleanup result.

Defects introduced by the d2 diff:

[blocker] scripts/run-e2e-container.mjs:318 — On cancellation, `Promise.allSettled` waits for `run.done` even after Docker client termination rejects. That rejection can occur before the supervisor installs its escalation timer (`scripts/child-supervisor.mjs:76-87`), leaving `run.done` pending. The launcher then withholds the cleanup error and retry status until the scheduler’s 15-second e2e kill ends it (`scripts/run-push-gates.mjs:50-52, 689-690`). The Docker command timeout does not bound this wait: `done` still depends on `supervisor.done` (`scripts/run-e2e-container.mjs:103-125`). The d4 scheduler test uses a synthetic child that writes output then resolves (`scripts/run-push-gates-tests.mjs:1710`, “interrupted lanes retain shutdown output and record the child's exit”); the launcher test injects a rejection while still calling the real `supervisor.terminate()` (`scripts/run-e2e-launchers-tests.mjs:463, 480`). Neither covers a pending `run.done` after termination fails. The targeted `node --test` attempt failed at file level before reporting subtests; no passing-after result was observed in this read-only leaf. (confidence: 98)

Blockers in c4443340..HEAD: DC-02 only. History check: d4 preserves the 0d81548a scheduler termination-failure escape; no other prior-fix regression found.

VERDICT: REVISE
```

##### lens-tests-d4

```text
DC-26 CLOSED — evidence (`scripts/run-push-gates-tests.mjs:516`, “pre-review stops when merge-base tree lookup fails”; wired through `package.json:20,23`)

DC-02 CLOSED — evidence (`scripts/run-push-gates-tests.mjs:1710`, “interrupted lanes retain shutdown output and record the child's exit”; EPERM no-hang coverage at `:1640`, “signal cleanup failure stops waiting on the child and reports nested termination errors”)

DC-18 CLOSED — evidence (`scripts/run-push-gates-tests.mjs:1710`, “interrupted lanes retain shutdown output and record the child's exit”; preflight cancellation coverage at `scripts/run-e2e-launchers-tests.mjs:294,317`)

Defects introduced by the d2 diff: none found.

Blockers anywhere in c4443340..HEAD: none found.

VERDICT: APPROVED
```

### Closure round d5

`REVIEWED_THROUGH` 9d7e8996a43081e8851529f71ce43f02df7a54d1 (repair 9d7e8996 over eb69843d..9d7e8996; pre-review green). Closed: DC-30 (root-cause), DC-02 and DC-18 (tests), DC-32 and DC-33 (minimalism, code-quality), DC-34 (error-handling). correctness, root-cause, tests and code-quality APPROVED.

| ID | Witness | Claim | Disposition | Evidence |
|---|---|---|---|---|
| DC-31 (residual, lineage DC-11) | error-handling blocker 94 | after a timed-out docker command whose kill fails, the live child is never released, so the launcher (and the heavy-gate lock) cannot exit | Fix (fix-7, unref the child and its pipes like terminateChildren already does; real-subprocess proof) — last patch for this lineage in this run | `scripts/child-supervisor.mjs:137` unref pattern; launcher main sets `process.exitCode` only (`run-e2e-container.mjs:401`) — read |
| DC-35 | code-quality late should-fix 86 | `settled()` reads as "the child finished" | Fix (rename) | — |
| DC-36 | minimalism nit 91 | forwarding wrapper `settled: () => supervisor.settled()` | Fix | — |
| DC-37 | minimalism late should-fix 95, 89 | duplicated EPERM override in three launcher tests; duplicated EventEmitter child fixture in three settlement tests | Fix (test helpers) | — |

#### Raw closure-round d5 reports

##### lens-code-quality-d5

```text
DC-33 CLOSED — evidence (`scripts/run-push-gates.mjs:267,273`, `scripts/child-supervisor.mjs:75,115`, `scripts/run-e2e-container.mjs:217`; tests “interrupted lanes retain shutdown output and record the child's exit” (`scripts/run-push-gates-tests.mjs:1710`), “supervisor settlement does not wait for a child after termination fails” (`scripts/child-supervisor-tests.mjs:72`), “nested errors share traversal while callers choose their formatting” (`scripts/child-supervisor-tests.mjs:98`), “preflight cancellation bounds a child that never settles” (`scripts/run-e2e-launchers-tests.mjs:320`), and “multi-child forwarding treats an already-aborted signal as cancellation” (`scripts/child-supervisor-tests.mjs:11`)).

Defects introduced by the d2 diff: none remain.

Blockers in `c4443340..HEAD`: none found.

### LATE OBSERVATIONS

[should-fix] scripts/child-supervisor.mjs:75 — `settled()` can resolve with `termination-failed` while the child is still alive; the name can read as a guarantee that the child finished. Name it to communicate that it reports either an exit or a termination failure (confidence: 86).

VERDICT: APPROVED
```

##### lens-correctness-d5

```text
Defects introduced by the d2 diff: none found.

Blockers anywhere in `c4443340..HEAD`: none found.

VERDICT: APPROVED
```

##### lens-error-handling-d5

```text
[blocker] DC-31 NOT CLOSED — the timeout path returns an error, but never calls `supervisor.unref()` for the still-live detached Docker child, so the launcher can keep waiting and hold the e2e gate lock (`scripts/run-e2e-container.mjs:78-82, 134-140`). The timeout test at `scripts/run-e2e-launchers-tests.mjs:565` uses an `EventEmitter`, not a real child; its fixture could not run here because `/tmp` is read-only. (confidence: 94)

DC-34 CLOSED — evidence (`scripts/check-remote-ci.mjs:44-51`; “reports when spawnSync terminated the command by signal” at `scripts/check-remote-ci-tests.mjs:277`, passed).

Defects introduced by the d2 diff:

[blocker] scripts/run-e2e-container.mjs:134 — A timeout followed by failed termination surfaces an error but leaves the Docker child referenced, so the launcher and gate lock may not exit. (confidence: 94)

Blockers anywhere in `c4443340..HEAD`: DC-31.

VERDICT: REVISE
```

##### lens-minimalism-d5

```text
DC-32 CLOSED — `commandResult` serves both `runCommand` branches and `recordChildOutcome` serves both task paths (`scripts/run-push-gates.mjs:267, 273, 733, 740, 818, 893`); witness test: “interrupted lanes retain shutdown output and record the child’s exit” (`scripts/run-push-gates-tests.mjs:1710`). The test file failed at file level without reporting subtest results.

DC-33 CLOSED — dead result fields and the unused formatter argument are removed; the single-use helpers are inlined (`scripts/run-push-gates.mjs:724`, `scripts/child-supervisor.mjs:11, 120, 194`, `scripts/run-e2e-container.mjs:221`). `node --test scripts/child-supervisor-tests.mjs` passed, including “supervisor settlement reports a termination failure before a later child exit” and “nested errors share traversal while callers choose their formatting.”

Defects introduced by the d2 diff: none found.

Blockers anywhere in `c4443340..HEAD`: none found.

### LATE OBSERVATIONS

[should-fix] scripts/run-e2e-launchers-tests.mjs:521 — Three new kill-failure cases copy the same `process.kill` EPERM override and restoration at lines 521, 574, and 609, varying only the diagnostic text. Extract the shared source fragment into a test helper that accepts the message (confidence: 95).

[should-fix] scripts/child-supervisor-tests.mjs:39 — The three settlement tests repeat the same `EventEmitter` child initialization (`exitCode` and `signalCode` at lines 39, 54, and 73). A shared test fixture can own that state and accept the optional `kill` behavior (confidence: 89).

[nit] scripts/run-e2e-container.mjs:144 — `settled: () => supervisor.settled()` only forwards to `supervisor.settled()`, while the returned object already exposes `supervisor`; assign the method directly to avoid a wrapper per Docker command (confidence: 91).

VERDICT: REVISE
```

##### lens-root-cause-d5

```text
DC-30 CLOSED — evidence (`scripts/child-supervisor.mjs:75`; `scripts/child-supervisor-tests.mjs:72`, “supervisor settlement does not wait for a child after termination fails,” passed with `node --test`; the scheduler and launcher use settlement at `scripts/run-push-gates.mjs:717` and `scripts/run-e2e-container.mjs:331`). The launcher regression test, “a Docker client kill failure still waits for named container cleanup,” is at `scripts/run-e2e-launchers-tests.mjs:512`; its focused test-file run failed before subtests.

Defects introduced by the d2 diff: none found. The prior `0d81548` EPERM escape remains in place, with its regression test at `scripts/run-push-gates-tests.mjs:1640`.

Blockers in `c4443340..HEAD`: none found.

VERDICT: APPROVED
```

##### lens-tests-d5

```text
DC-02 CLOSED — evidence (`scripts/run-push-gates-tests.mjs:1710`, “interrupted lanes retain shutdown output and record the child's exit” asserts exit 143, child exit 1, cleanup output and log path; `scripts/run-e2e-launchers-tests.mjs:512`, “a Docker client kill failure still waits for named container cleanup” asserts cleanup and termination failures).

DC-18 CLOSED — evidence (`scripts/run-e2e-launchers-tests.mjs:294`, “preflight cancellation reports a rejected child termination and its cause”; `:565` and `:600` cover hung Docker commands whose termination fails).

Defects introduced by the d2 diff: none found.

Blockers anywhere in `c4443340..HEAD`: none found. The d5 settlement tests are included in `gates:contract:check` (`package.json:20,24,23,82`), which CI runs at `.github/workflows/test.yml:148`.

VERDICT: APPROVED
```

### Closure round d6

`REVIEWED_THROUGH` 27a43112c8623e05059b0b46a19b72d2f0533889 (repair 27a43112 over 9d7e8996..27a43112; pre-review green). Lenses: correctness, tests, code-quality, error-handling, minimalism. Closed: DC-31 (error-handling, tests — lineage DC-11 closed), DC-35 (code-quality), DC-36, DC-37 (minimalism). code-quality, error-handling, tests APPROVED.

| ID | Witness | Claim | Disposition | Evidence |
|---|---|---|---|---|
| DC-38 | correctness blocker 90 | `scripts/heavy-gate.sh` exits 0 when systemd-run exits 0 without a scope confirmation | Fix (fix-8: non-zero status, else 1; test) | `scripts/heavy-gate.sh:134-138` `exit "${scope_status:-1}"` with `scope_status=0` — read |
| DC-39 | minimalism late should-fix 93 | duplicated outcome mapping in the scheduler test double | Fix (fix-8) | — |
| DC-40 | minimalism nits 85, 84 | single-use `entrypointOptions()` and `cleanupHeldDocker()` | Fix (fix-8) | — |
| DC-41 | tests late nit 91 | invalid `E2E_TEST_DOCKER_INFO_TIMEOUT_MS` refusal untested | Fix (fix-8) | — |

#### Raw closure-round d6 reports

##### lens-code-quality-d6

```text
DC-35 CLOSED — evidence (`scripts/child-supervisor.mjs:80`; test “supervisor outcome reports a termination failure before a later child exit” at `scripts/child-supervisor-tests.mjs:59`; `node --test scripts/child-supervisor-tests.mjs` passed).

Defects introduced by the d2 diff: none found.

Readability blockers anywhere in `c4443340..HEAD`: none found.

VERDICT: APPROVED
```

##### lens-correctness-d6

```text
Witnessed issues to close: none.

Defects introduced by the d2 diff: none remain.

Blockers in `c4443340..HEAD`:

[blocker] scripts/heavy-gate.sh:137 — If `systemd-run` exits 0 without writing the scope confirmation file, the wrapper reports confirmation failure but exits 0. The caller can then treat the gate as passed even though the heavy command was never confirmed to run; O3(c) requires an unconfirmed scope to fail nonzero. (confidence: 90)

VERDICT: REVISE
```

##### lens-error-handling-d6

```text
DC-31 CLOSED — evidence (scripts/child-supervisor.mjs:106-108; scripts/run-e2e-container.mjs:135-142; scripts/run-e2e-launchers-tests.mjs:321, “the entrypoint exits after a Docker kill failure and releases child pipes”). The supervisor unit test passed; the real-subprocess test could not reach assertions here because its harness needs writable `/tmp`.

Defects introduced by the d2 diff: none found.

Blockers anywhere in `c4443340..HEAD`: none found.

VERDICT: APPROVED
```

##### lens-minimalism-d6

```text
DC-36 CLOSED — evidence (`scripts/run-e2e-container.mjs:145,332`; `scripts/run-push-gates-tests.mjs:1710`, “interrupted lanes retain shutdown output and record the child's exit”)

DC-37 CLOSED — evidence (`scripts/run-e2e-launchers-tests.mjs:139`; “a Docker client kill failure still waits for named container cleanup,” “docker info timeout reports when a hung client cannot be terminated,” and “docker rm timeout reports when a hung cleanup client cannot be terminated”; `scripts/child-supervisor-tests.mjs:11`, the three “supervisor outcome…” tests)

Defects introduced by the d2 diff: none found.

Blockers anywhere in `c4443340..HEAD`: none found.

### LATE OBSERVATIONS

[should-fix] scripts/run-push-gates-tests.mjs:1737 — The two branches of `superviseProcess` repeat the same `exitOrTerminationFailure` mapping at :1760. Define it once and use it in both branch results (confidence: 93).

[nit] scripts/run-e2e-container.mjs:400 — `entrypointOptions()` has one caller, `main()`. Inline its single test-only environment option parser there; no second caller or planned reuse needs this helper (confidence: 85).

[nit] scripts/run-e2e-launchers-tests.mjs:156 — `cleanupHeldDocker()` has one caller in the new regression test. Inline its teardown into that test’s `finally`; no second caller or planned reuse needs the helper boundary (confidence: 84).

VERDICT: REVISE
```

##### lens-tests-d6

```text
DC-31 CLOSED — evidence (`scripts/run-e2e-launchers-tests.mjs:321,370-375`, “the entrypoint exits after a Docker kill failure and releases child pipes”): it holds a real child, injects `EPERM`, and asserts the launcher exits within three seconds with the failure diagnostic. The test is included in the contract gate (`package.json:20,82`; CI: `.github/workflows/test.yml:148`). The focused local run failed before subtests, so I observed the assertions and gate wiring, not a local pass.

Defects introduced by the d2 diff: none found.

Blockers anywhere in `c4443340..HEAD`: none found.

### LATE OBSERVATIONS

[nit] scripts/run-e2e-container.mjs:404 — No test exercises the invalid or negative `E2E_TEST_DOCKER_INFO_TIMEOUT_MS` refusal; the new entrypoint test uses `"50"`. Removing this guard would leave the suite green while malformed overrides produce a different timeout behavior (confidence: 91).

VERDICT: APPROVED
```

### Closure round d7 — review closed

`REVIEWED_THROUGH` d10ff95c (repair d10ff95c over 27a43112..d10ff95c; pre-review green). Lenses: correctness, tests, minimalism — all APPROVED. Closed: DC-38 (correctness), DC-39 and DC-40's first half (minimalism; DC-40's second half Skip — inlining `cleanupHeldDocker()` into a `finally` trips oxlint `no-unsafe-finally`, measured in fix-8 round 1), DC-41 (tests). No open finding; final gates start on HEAD == REVIEWED_THROUGH.

### Diff-review totals

Rounds d1–d7; `diff_adopted_per_round`: d1=13 d2=7 d3=5 d4=5 d5=4 d6=4 d7=0 (Fix dispositions per round, nits included). 41 IDs (DC-01..DC-41): Fix 37 (DC-40 with its second half skipped), Skip 3 (DC-08, DC-10, DC-17 — DC-17 re-raised once in d2 and kept), closed by commit 1 (DC-16). One focused review-plan judgment (lineages DC-02/DC-11, mechanism A); the lineages closed in d5 (DC-02, DC-18) and d6 (DC-31). Defects found outside lens review: the §2a pre-review run (EISDIR directory import, 369e1148) and the full contract gate (`ls-files -z` test shims, 94792df1).

#### Raw closure-round d7 reports

##### lens-correctness-d7

```text
DC-38 CLOSED — evidence (`scripts/heavy-gate.sh:135-139`; `scripts/heavy-gate-tests.mjs:272`, “a scope that cannot be confirmed refuses before execing the heavy command”)

Defects introduced by the d2 diff: none found.

Blockers anywhere in c4443340..HEAD: none found.

VERDICT: APPROVED
```

##### lens-minimalism-d7

```text
DC-39 CLOSED — evidence (scripts/run-push-gates-tests.mjs:1733, test “interrupted lanes retain shutdown output and record the child's exit”)

DC-40 first half CLOSED — evidence (scripts/run-e2e-container.mjs:400; scripts/run-e2e-launchers-tests.mjs:303, test “invalid Docker info timeout values are refused before Docker is started”). The `cleanupHeldDocker` half remains the recorded Skip; no-unsafe-finally was measured this round.

Defects introduced by the d2 diff: none remain. The current d7 diff adds no minimalism defect.

Blockers anywhere in c4443340..HEAD: none remain; DC-38 now exits 1 when scope confirmation is missing (scripts/heavy-gate.sh:134-138; test “a scope that cannot be confirmed refuses before execing the heavy command” at scripts/heavy-gate-tests.mjs:272).

VERDICT: APPROVED
```

##### lens-tests-d7

```text
DC-41 CLOSED — evidence (scripts/run-e2e-launchers-tests.mjs:303, “invalid Docker info timeout values are refused before Docker is started,” asserts exit 1, the refusal message, and zero Docker events; the valid `"50"` CLI path is exercised at :374). Both tests run through the contract gate (`package.json:20,82`; `.github/workflows/test.yml:148`).

d7 delta tests CLOSED — evidence (scripts/heavy-gate-tests.mjs:272, “a scope that cannot be confirmed refuses before execing the heavy command,” asserts exit 1 and no heavy command; scripts/run-push-gates-tests.mjs:1710, “interrupted lanes retain shutdown output and record the child's exit,” asserts exit 143, child exit 1, log tail and path; :1640 covers failed termination for SIGINT and SIGTERM). These tests run through `package.json:20,23,31` and CI’s contract gate.

Defects introduced by the d2 diff: none found.

Blockers anywhere in `c4443340..HEAD`: none found.

VERDICT: APPROVED
```
