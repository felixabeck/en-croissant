# CI mutation startup repair during storage-size release

This is a dated checkpoint, not a completed release claim. The original storage-size source and real-product proof remain in the separate database-storage-size handoffs.

Required upstream Linux Test run38705031849, job116322220534 failed on published base45c7dd30 before these source changes. Its tree-path dry run reached the default300s limit while workspace-storage ran beside it. Both used two runners. The full downloaded primary logs are retained in this run's scratch, with decisive excerpts below. The required remote-CI refusal prevents pushing until its owning repair is demonstrated. Filed intake was merged through the supported CLI as f-20261015-08, commitc5aa0f6e. No foreign intake was present or merged. Decisiond-20261015-19 records conditional serial allocation, existing sizing/placement decisions and reversal path before source edits.

The initial full final-gate attempt push-gate.OQOiNn ended1 on the new test's direct generated-type import. Every other lane passed, including frontend mutation638.4s. A resumed sensitive worker corrected only the fixture type through the approved tauri facade, retaining exact generated-derived checking. Full contract-repair.PQsHzT then completed0. Full pre-review, cumulative repair review, clean-tree final gates, push, hosted confirmation and install are pending at this checkpoint.

A first local baseline attempt declared8GiB usable rather than CI's7GiB. It was stopped while queued, before any workload, with no proof credit. Its owned process group was verified absent. Corrected ci-baseline-exact.glLqDJ uses unmodified base in a kit-created disposable worktree with agent-gate, taskset0-3, GATE_MEMORY_BYTES7516192768 and the workflow's actual pnpm mutation:frontend. It remains queued at this checkpoint. The override controls existing sizing rather than creating a physical7GiB cgroup. CPU affinity and matching Nodev24.21.0 do not reproduce hosted hardware speed or pressure.

Plan authorship and arbitration shared one root context. Implementation uses gpt-6.1-sol/high, read-only detection gpt-6.1-sol/medium, plan lens gpt-6.1-sol/high. Detection is the same model family and model as code in fresh sessions, with no family separation.

## Diagnosis report

**Preferring fewer package slots on equal runner count is a faithful candidate, but the timeout’s cause remains unproven.** It preserves configured aggregate runner capacity, not necessarily measured throughput.

Confirmed evidence:

- Tree-path’s initial run started at 08:35:01 and timed out at 08:40:02. Workspace-storage completed its baseline in about 269 seconds, with 123.6 seconds of test durations and 145.4 seconds classified as overhead. That overhead is a residual calculation, not a transform measurement. See [job log](/tmp/build-storage-9900f4c3/upstream-test-job.log:11251) and [Stryker timing calculation](/home/felixb/Projekte/chessfable.worktrees/drain/node_modules/@stryker-mutator/core/dist/src/process/3-dry-run-executor.js:140).
- The configured default is five minutes. The timeout covers the runner’s dry-run call, including Vitest discovery and execution. Initial runner creation happens before that runner receives its baseline task. See `node_modules/@stryker-mutator/core/schema/stryker-schema.json:518`, `dist/src/test-runner/timeout-decorator.js:35`, and `dist/src/concurrent/pool.js:84`.
- Workspace-storage’s exit 143 is consistent with the scheduler terminating siblings after tree-path fails. It is not evidence of an independent workspace failure. See [failure handling](/home/felixb/Projekte/chessfable.worktrees/drain/scripts/run-frontend-mutation.mjs:455).

**What fewer slots would change**

The current [tie rule](/home/felixb/Projekte/chessfable.worktrees/drain/scripts/gate-parallelism.mjs:307) explicitly prefers more parents. A read-only calculation using the actual functions confirmed:

| Four CPUs, usable budget | One slot | Two slots | Current choice |
|---|---:|---:|---|
| 7 GiB | 4 runners | 2 × 2 runners | Two slots |
| 8 GiB | 4 runners | 2 × 2 runners | Two slots |

One slot would prevent concurrent package baselines and package bootstrap work. It also saves one parent allowance. However, **each baseline runs on one Stryker runner with one Vitest worker**, regardless of the package’s configured mutation concurrency. Increasing that package from two runners to four does not parallelize its baseline. See `node_modules/@stryker-mutator/core/dist/src/process/3-dry-run-executor.js:44` and `node_modules/@stryker-mutator/vitest-runner/dist/src/vitest-test-runner.js:47`.

Consequently, serialization could reduce contention, while also leaving less useful work active during baselines. Actual total throughput needs measurement.

**A more specific evidenced cost**

Related-test selection itself performs broad cold work:

- [Stryker configuration](/home/felixb/Projekte/chessfable.worktrees/drain/stryker.config.mjs:35) enables `related`.
- The runner passes mutated source paths into Vitest’s related filter before `ctx.start`.
- Vitest first globs candidate tests, then builds dependency graphs for **every candidate test** before selecting related tests. Its traversal requests SSR transforms and follows local static and dynamic dependencies. See `node_modules/vitest/dist/chunks/cli-api.DuT9iuvY.js:11385`, `:11457`, and `:11466`.
- [Vite configuration](/home/felixb/Projekte/chessfable.worktrees/drain/vite.config.ts:71) uses jsdom, shared setup, React and Babel plugins, and disables persistent module caching under Stryker.

Thus, a small mutation scope does **not** imply small discovery or transform work. This establishes a concrete optimization target. It does not establish how much of tree-path’s 300 seconds it consumed. Neither transform contention, memory pressure, GC, nor a particular slow test is proven by this excerpt.

**Optimal: measure the existing reproduction, then test the smallest scheduling change → I recommend that sequence.**

Minimal faithful plan and proof candidates:

1. Preserve the running reproduction. Its declared 8 GiB override means **8 GiB usable**, since overrides bypass reserve subtraction at [gateBudgetBytes](/home/felixb/Projekte/chessfable.worktrees/drain/scripts/gate-parallelism.mjs:193). It matches the scheduling shape, but not CI’s 7 GiB usable budget exactly.
2. Change only equal-runner ties to prefer fewer slots. Add a four-CPU, 7 GiB regression case. Update the existing large-budget tie expectation at [parallelism tests](/home/felixb/Projekte/chessfable.worktrees/drain/scripts/gate-parallelism-tests.mjs:387). Preserve cases where additional slots actually increase aggregate runners.
3. Compare complete cold runs under the same CPU affinity and usable budget. Record baseline durations, executed tests, package completion times, mutation results, and cleanup outcomes. One green run establishes feasibility, not causality.
4. If discovery dominates, measure `vitest.related: false` as a separate candidate. It removes the dependency-selection traversal but executes the full suite. Accept it only if complete-run results demonstrate a benefit with all tests and mutation guarantees preserved. Do not substitute a manually maintained test allowlist.

Unresolved questions are whether baseline safety or package overlap should win equal-capacity ties, whether discovery dominates execution, and whether serialization improves total completion time. No timeout, threshold, resource constant, supervision, or fence change is justified by the available evidence.

The four requested decisions remain consistent with this assessment. They preserve fallback sizing and reserves, explicitly limit memory-proof claims, and acknowledge cold-transform costs without proving this incident’s cause.

No files changed or gate runs started. The existing `src/utils/db.test.ts` modification and separate reproduction were untouched. Inspected paths were the two assigned rules, six named implementation/configuration files, requested decision entries, log excerpt, and relevant installed Stryker/Vitest code.

This diagnosis and candidate plan are mine. Plan authorship and arbitration share root context, and detection uses the same model family as the code. This is not independent cross-family validation.

## Frozen CI-R2 plan

# Required CI mutation startup repair

## Goal
Restore the required Linux Test job without weakening mutation proof.

## MANDATE
### Frontend mutation startup times out on the upstream CI runner before any tree-path mutant executes

* **ID:** f-PENDING · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Impact class:** tooling
* **Where:** `.github/workflows/test.yml` frontend mutation step, `scripts/run-frontend-mutation.mjs` package scheduling, `scripts/gate-parallelism.mjs` Stryker budget, and `stryker.config.mjs` per-test coverage startup. Upstream Test run 38705031849, Linux test job 116322220534, HEAD 45c7dd30c2fa42ae47fb2bde4b7fc66d622e27bc.
* **Defect:** the required upstream Linux job failed pnpm mutation:frontend. Its actual Stryker log starts the tree-path dry run at 08:35:01 UTC and reports Initial test run timed out at 08:40:02, before a mutant result. Workspace-storage was still running beside it, had two runners, and reported 2166 baseline tests taking 4m28s including about 145s overhead before cancellation by the failed sibling. Gate memory detection used the documented conservative 8 GiB fallback. The failure is the startup/coverage execution, not a mutation score failure.
* **Failure scenario:** the ordinary required Test workflow on the published base runs frontend mutation packages under the constrained hosted runner. Baseline startup reaches the existing five-minute limit, makes test red, and the remote-CI refusal blocks the next otherwise verified push.
* **Spotted outside diff:** the failure is on the already-published base of f-20261001-20, before its byte-count source changes. The red remote was discovered during that run's required release preflight.
* **Open question:** which package and worker schedule or test-startup implementation keeps the complete existing per-test mutation proof within the runner's resource and startup bounds, without relaxing coverage, mutation thresholds, tests or timeouts?
* **Proof:** reproduce the workflow's own pnpm mutation:frontend on the base with the measured hosted CPU/memory budget, retain startup timings and complete mutation results, then prove the repair under that same budget before one hosted confirmation. No threshold or timeout increase clears this finding.
* **Related:** f-20260929-09 previously addressed a different measured module-load/static-mutant cost, no common cause is yet established and its Root is -. This entry does not reopen its settled implementation without new mechanism evidence.
* **Found by:** Codex full-auto f-20261001-20 release preflight. Full upstream job log retained at /tmp/build-storage-9900f4c3/upstream-test-job.log. Plan authorship and arbitration shared one context, detection uses the same model family as the code.

## Threat model and non-goals
Ordinary hosted runners, conservative memory fallback and low CPU counts. Preserve the complete mutation manifest, related tests, perTest coverage,100%thresholds and default timeouts. No new wrapper, gate, hook, cache or allowlist. No product changes. Existing scheduler supervision and ownership are unchanged.

## Traced premises
Upstream source45c7dd30, Test38705031849/job116322220534 ran two packages with two runners each. With the real sizing functions and7GiB usable, this shape uniquely identifies4availableCPUs among1-24. One slot also supplies4runners, but strykerSlots chooses two on ties. tree-path baseline hit300s while workspace-storage still ran beside it. Logs establish a timeout and concurrent broad discovery, not the exact fraction due to transforms or memory.
Stryker runs each package baseline in one runner with one Vitest worker. Four package runners do not parallelize that baseline. Vitest related selection SSR-transforms dependency graphs for all candidate tests before selection. Fewer simultaneous package parents can remove competing discovery, but one green local run alone cannot establish incident causality.
Named local probe currently runs unmodified base with taskset0-3 and GATE_MEMORY_BYTES7516192768, the exact usable budget. GATE_MEMORY_BYTES overrides are already usable, not total cgroup limits. Agent-gate retains machine placement and locking. The earlier8GiBoverride attempt was cancelled while queued before any workload, and receives no proof credit.

## Approach
### O1. Prefer fewer parents only when aggregate runner capacity ties
Keep maximizing total configured runners. For equal capacity, choose fewer package slots. With stable CPU inputs, splitting CPU shares and charging additional parents can never increase aggregate runners. This policy therefore serializes every package plan, not just the observed four-CPU case. Keep worker constants, CPU cap and memory charge unchanged. Remove the redundant slot-search mechanism rather than retaining a misleading optimization loop. Each package gets the existing whole usable budget and caller CPU share. This removes concurrent package baselines without surrendering configured runner capacity. Actual elapsed throughput must be measured separately.
### O2. Prove resource allocation and complete mutation behavior
Extend existing parallelism tests with four-CPU7GiB serial allocation, fractionalCPUshare and large-budget CPU-count cases. No case can show multiple slots increasing capacity, that CI-R1 premise was false. Prove full-budget single-package allocation and unchanged worker caps. Existing scheduler tests assume active peers. Update scripts/run-frontend-mutation-tests.mjs and its local shim cases to observe actual serial lifecycle semantics: red package stops admission before queued work, asynchronous spawn-error admits no next package, SIGINT/SIGTERM terminate the sole active process group and descendants before fence cleanup, SIGKILL reports137 with later packages unstarted. Preserve pre-spawn owner publication, pending-spawn ownership, delayed termination, descendant reaping, refusal and cleanup failure checks. Remove only peer waits/assertions whose concurrent production scenario becomes unreachable. Do not add a test-only slot override to keep unreachable paths alive. Run existing parallelism and runner tests, format and full pre-review. New regression stays present while only production tie hunk is Git-reversed, observe failure then restoregreen.
### O3. Demonstrate bounded-runner feasibility before hosted confirmation
Retain complete baseline and candidate cold pnpm mutation:frontend runs under identical four-CPU7GiBusable sizing in owned disposable checkout. Record package baseline times/test counts, complete100%results, parent/runners schedule and cleanup. Do not claim a timing cause if base passes. Candidate must complete all packages without timeout and cannot regress proof or violate budget. If baseline already passes and matched candidate does not show a meaningful repeatable resource/startup benefit, do not land a speculative scheduling change. Instead use measured discovery/execution evidence to refine the mechanism under a new reviewed correction. No timeouts or thresholds may be raised. Locally green complete candidate is required before one pushed hosted confirmation.
### O4. Release integrated repair
Repair the existing new-test generated-type boundary violation through the public facade type. This is the separate trivial fixture correction, already implemented but uncommitted. Cumulative review covers it and schedule repair. Final clean-tree full Rust/frontend/bindings push gates, required Linux mutation confirmation and all existing platform jobs must pass. Preserve earlier native/pixel storage-size proof, since no executable product code changes in this repair. Verify push and install under project policy.

## Decisions and trade-offs
Optimal: preserve maximum runner capacity while avoiding redundant concurrent package parents on a tie → I recommend this measured candidate, conditional on O3.
This supersedes only the equal-capacity tie preference, preserving d-20261001-01 sizing, d-20261002-01 placement and d-20261002-03 reserve. d-20260930-09 cold-cache limits stand. Record a decision before implementing a selected mechanism, with reversal path to the tie condition and its test expectations. No claim that more runners speed a one-runner baseline.

## Risks / open questions
Serialization can leave more idle runners during a single baseline and can reduce package-overlap throughput despite equal configured capacity. CPU affinity reproduces sizing, not hosted hardware speed or memory pressure. Actual budget is declared for sizing within agent-gate, not a new physical7GiBcgroup. Evidence must retain these limitations. If O3 fails, return to diagnosis rather than push a speculative mitigation.

## Not part of this task
No manual test lists, ignored mutants, cache setup, runtime test timeout, resource constant, process lifecycle or product behavior change.

## Phases
One coherent gate-scheduling repair. Files scripts/gate-parallelism.mjs, scripts/gate-parallelism-tests.mjs, scripts/run-frontend-mutation-tests.mjs. scripts/mutation-runner-test-harness.mjs only if its actual shared shim requires adaptation, preserve backend consumers. Existing scripts/run-frontend-mutation.mjs may remove now-unreachable multi-slot admission orchestration if the selected mechanism lands, preserving actual asynchronous spawn/signal/fence behavior, no new abstraction. Existing stryker.config.mjs, vite.config.ts and installed runner code are read dependencies. A bounded selected-executor worker owns source/test edits and exact regression proof. Root owns controlled complete-run experiments, inspection, review, commits and release. Records in tasks/handoffs preserve raw reports and actual proof. Executor sensitive gpt-6.1-sol/high. Exact phase commands: pnpm gates:parallelism:test, pnpm mutation:runner:test, pnpm exec oxfmt --check scripts/gate-parallelism.mjs scripts/gate-parallelism-tests.mjs, git diff --check, then pnpm checks:pre-review. Complete experiment command: agent-gate taskset -c 0-3 env GATE_MEMORY_BYTES=7516192768 pnpm mutation:frontend in the owned probe checkout. A source-only reversal of the tie condition must fail the new tie regression, then restoration must pass. Root owns any Git reversal and release gates.

## Reviews
CI-R1: four lenses, plan/correctness/tests REVISE, minimalism APPROVED. Adopted CI-I1 (plan/correctness/tests): impossible greater-capacity parallel case, Fix by explicit universal serialization/invariant and removal of redundant search. Adopted CI-I2 (plan): scheduler tests depend on active peers, Fix by including consumer tests and preserving serial failure/signal/ownership guarantees. Both require closure on CI-R2. Diagnosis probe is evidence, not a lens verdict. Open issue IDs CI-I1, CI-I2. Raw reports in /tmp/build-storage-9900f4c3/lens-ci-*-r1.txt, to be copied verbatim into durable handoff before final gates.
Plan authorship and arbitration share one root context. Detection runs on the same model family as code in fresh sessions.


## Complete additional plan-review reports

### CI-R1 plan

[blocker] /tmp/build-storage-9900f4c3/ci-plan-r1.md:32 — O2 requires an impossible discriminating case where multiple slots beat one slot’s aggregate runner capacity. In scripts/gate-parallelism.mjs:263 and :295, splitting CPU share cannot increase its aggregate cap, while splitting memory charges additional parents and introduces rounding losses. One slot therefore already maximizes runners. The proposed tie preference effectively selects one slot across ordinary configurations. Correct this premise and replace the impossible acceptance case before implementation. (confidence: 99)

[blocker] /tmp/build-storage-9900f4c3/ci-plan-r1.md:49 — The two-file implementation scope omits affected scheduler tests in scripts/run-frontend-mutation-tests.mjs. The deterministic two-CPU fixture at :875 requires two packages to start before triggering SIGKILL. The proposed preference selects one slot, leaving its sibling-start wait at :894 unsatisfied. Other fixtures similarly require active peers, including :390 and :742. Include these consumers and specify how their lifecycle coverage survives the scheduling change. Merely running the existing runner suite cannot satisfy O2 as written. (confidence: 99)

Limitation: source and supplied evidence review only. No gates or probes were run, and O3’s controlled timing evidence remains pending. Detection uses the same model family as authorship and arbitration.

VERDICT: REVISE

### CI-R1 correctness

[blocker] /tmp/build-storage-9900f4c3/ci-plan-r1.md:32 — O2 requires a case where multiple slots increase aggregate runners, but the preserved allocation formula cannot produce one. Splitting the budget charges additional parents, while splitting CPU share cannot increase its aggregate cap. One slot therefore always matches or exceeds every parallel allocation. For example, 24 CPUs and 90 GiB yield 24 runners with either one slot or three. O1 consequently selects one slot for every supported allocation, leaving O2’s required discriminating case impossible. Correct this obligation and explicitly account for universal serialization at the scheduler boundary. (confidence: 99)

Limitation: O3’s controlled runs remain pending. Startup feasibility and throughput benefit are unverified. This review used source and supplied logs only, changed nothing, and shares the author’s model family. (confidence: 100)

VERDICT: REVISE

### CI-R1 minimalism

No bloat or duplication findings in CI-R1. The smallest sufficient implementation is the existing tie-condition edit plus focused regression updates. No new files, abstractions or configuration are proposed. O1–O4 remain within the CI repair and authorized release scope.

Limitation: measured benefit remains pending O3. This approves the conditional plan, not the repair’s effectiveness (confidence: 95).

Review used the same model family as the author. Plan authorship and arbitration shared one context. No files changed.

VERDICT: APPROVED

### CI-R1 tests

[blocker] /tmp/build-storage-9900f4c3/ci-plan-r1.md:32 — O2 requires a discriminating case where multiple slots increase aggregate runners, but the existing allocator cannot produce that case with stable CPU inputs. Splitting CPU shares cannot increase the total CPU cap, while splitting memory charges additional parents and cannot increase the total memory cap (`scripts/gate-parallelism.mjs:263–306`). Consequently, this proposed assertion cannot guard O1’s promise to retain higher-capacity parallel schedules. An unconditional one-slot implementation would satisfy the proposed tie assertions too. Replace the impossible case with an explicitly justified allocation invariant and acknowledge the resulting serialization. (confidence: 99)

VERDICT: REVISE

### CI-R2 plan

CI-I1 CLOSED — CI-R2 explicitly acknowledges universal serialization and replaces the impossible parallel-capacity case with full-budget allocation and unchanged-cap proofs. This matches the allocator in scripts/gate-parallelism.mjs:263 and :295. Candidate evidence: /tmp/build-storage-9900f4c3/ci-plan-r2.md:30.

CI-I2 CLOSED — CI-R2 includes scheduler consumers and replaces peer-dependent fixtures with serial admission, signal, ownership and cleanup proofs. This addresses scripts/run-frontend-mutation-tests.mjs:390, :742, :875 and :952. Candidate evidence: /tmp/build-storage-9900f4c3/ci-plan-r2.md:32 and :49.

No additional plan defects found.

Limitation: O3’s controlled complete runs remain pending. Approval covers the conditional plan, not demonstrated repair effectiveness. Source and supplied evidence were inspected read-only. No gates ran or files changed. Detection shares the authorship/arbitration model family. (confidence: 100)

VERDICT: APPROVED

### CI-R2 correctness

CI-I1 CLOSED — O1 acknowledges universal serialization, removes the redundant allocation search, and preserves full-budget allocation and worker caps. O2 removes the impossible parallel-capacity case.

CI-I2 CLOSED — O2 and Phases include scheduler consumers and replace peer-dependent scenarios with serial admission, signal, ownership and cleanup obligations.

No additional correctness defects found in CI-R2.

Limitation: O3’s complete controlled runs remain pending. Startup feasibility and throughput benefit are unverified (confidence: 100). Review was read-only, with no gates run or files changed. Detection shares the author’s model family.

VERDICT: APPROVED

### CI-R2 minimalism

No bloat or duplication findings. The smallest sufficient change removes the allocation search and updates existing scheduler fixtures for serial execution. No added files or abstractions are needed.

CI-I1 and CI-I2 are addressed at plan level through explicit serialization and replacement of peer-dependent waits with serial lifecycle proofs.

Limitation: O3’s controlled evidence remains pending. Approval is conditional on that proof (confidence: 99).

Same-family review. No files changed.

VERDICT: APPROVED

### CI-R2 tests

CI-I1 CLOSED — O1/O2 now acknowledge universal serialization and replace the impossible case with allocation and unchanged-cap assertions. Reverting production scheduling would return two slots for four CPUs/7 GiB, failing the proposed one-slot assertion.

CI-I2 CLOSED — O2 and Phases include the peer-dependent scheduler fixtures and require serial replacements covering queued admission, asynchronous spawn errors, signals, descendant cleanup and fence retention.

No new verification-plan findings. Both test suites are reachable through the contract gate run by Linux CI.

Limitation: implementation assertions, fix-revert results and O3’s complete controlled runs remain pending. This approves the conditional proof plan, not repair effectiveness. No tests were run or files changed. Review shares the author’s model family, with authorship and arbitration sharing one context. (confidence: 100)

VERDICT: APPROVED

## Arbitration

CI-I1 is Fix, witnessed by plan/correctness/tests in CI-R1. The claim is valid: splitting resources never increases aggregate runner capacity under the existing formula. CI-R2 acknowledges universal serialization and removes the redundant allocation search and impossible acceptance case. All relevant witnesses explicitly closed it.

CI-I2 is Fix, witnessed by plan in CI-R1. Existing scheduler fixtures wait for concurrent peers. CI-R2 includes those consumers and preserves serial queued-admission, spawn-error, signal, ownership, descendant cleanup and fence guarantees. CI-R2 plan explicitly closed it, and tests independently agreed. Four CI-R2 verdicts are APPROVED, conditional proof remains mandatory. No plan Skip, Defer or carried issue. Additional-plan adoption counts r1=2,r2=0. Candidate implementation is authorized by full auto. Approval alone is not evidence that it repairs the hosted timeout.


## Trial outcome and corrected mechanism, 2026-10-15

This section supersedes the earlier conditional choice and pending trial state. The serial trial will not land. Its three owned files were restored to HEAD after exact patch/hash verification. Published allocation is preserved. Only the separate public-facade fixture type correction and the corrected Stryker configuration remain as source changes.

The base experiment completed with exit 0 and all three mutation scores at 100%. Its actual workload ran from 12:50:45 to 13:01:20, 635 seconds. Package durations were 34, 604 and 599 seconds with overlap. Workspace baseline reported 2166 tests in 118 seconds, tree reported 2696 in 131 seconds. The serial trial also completed with exit 0 and all scores at 100%, from 13:04:11 to 13:17:09, 778 seconds. Package durations were 22, 472 and 282 seconds, with workspace/tree baselines of 144/118 seconds. Different concurrent heavy workloads prevent a causal comparison. The trial did not satisfy O3's meaningful repeatable benefit requirement, regardless of feasibility or reversal-test sensitivity.

The experiment wrappers were launched from the main checkout and their header SHAs identify that orchestration checkout. Their scripts explicitly entered the owned probe. Actual tested source was BASE 45c7dd30 in both arms, with exactly the saved allocation patch in the serial arm. The probe was clean before baseline, integration checked the exact patch and source hash, and the post-run allocation hash remained ad8822673a7afcd08cb936d80aff03bbe15abf8bfe95f648626cd80908c815b3. These are experiment receipts, not clean-tree release receipts. Reports are preserved in ci-baseline-reports and ci-serial-reports under this run's scratch. Both disposable mutation fences and sandboxes were cleaned by the existing runner. No new ownership mechanism was added.

Root's full pre-review ci-pre-review.uiJBsb completed 0, mutation 586.5 seconds, for the rejected serial tree. That result is not corrected-config or final-gate credit. It remains historical evidence. Source trial tests passed 44 allocation and 107 runner checks, with allocation-only reversal failing four and exact restoration green. The later cleanup restores the original 40 allocation and 106 runner checks, which also pass.

Fresh primary-source tracing distinguishes the SDK's whole-initial-suite deadline from individual test and mutant settings. The initial finding's blanket prohibition was Codex-authored before that trace, not a Felix requirement. Decision d-20261015-20, the supported d-20261015-19 supersession and explicit f-20261015-08 annotation preserve history and correct that constraint. The corrected plan keeps published scheduling and trials ten minutes for the complete initial suite. Every test, related selection, perTest coverage, 100% thresholds, individual test limits and per-mutant settings/calculation remain. Actual computed mutant deadlines still follow measured baseline durations. A stalled initial suite can take five extra minutes to abort. No speed improvement or hosted sufficiency is claimed.

The default five-minute configuration already passes locally. The primary negative is the actual hosted 300-second timeout. Stryker's emitted base reports confirm dryRunTimeoutMinutes 5, timeoutMS 5000, timeoutFactor 1.5, perTest, related true, 100% thresholds and concurrency 2 for each package. Corrected reports must show only the initial allowance changing to 10. Report test identities and original sources must match the base, alongside the initial-run result counts. The SDK's test identity map can deduplicate equal raw file/name IDs, so report-map cardinality and initial-run count are recorded separately rather than equated.

## Second diagnosis, raw report

**The serial candidate remains unproven.** It removes competing package baselines and one parent’s memory charge, but neither the hosted timeout’s cause nor a repeatable benefit has been established. O3 should remain open.

**Mechanism and measured cost**

- [Package scheduling](/home/felixb/Projekte/chessfable.worktrees/drain/scripts/run-frontend-mutation.mjs:421) divides usable memory among slots and passes each package its CPU share. The current [candidate](/home/felixb/Projekte/chessfable.worktrees/drain/scripts/gate-parallelism.mjs:270) assigns one slot the full budget. This preserves configured aggregate runner capacity for the observed allocation, not measured throughput.
- Stryker initializes runner resources before assigning work in `node_modules/@stryker-mutator/core/dist/src/concurrent/pool.js:84`. The Vitest runner’s `init()` copies its setup file and calls `createVitest`, forcing one worker at `node_modules/@stryker-mutator/vitest-runner/dist/src/vitest-test-runner.js:31`. `createVitest` creates the Vite server and context without executing tests at `node_modules/vitest/dist/chunks/cli-api.DuT9iuvY.js:14034`.
- The baseline is **one scheduled task**, regardless of package concurrency, at `core/dist/src/process/3-dry-run-executor.js:44`. Its timer starts before `testRunner.dryRun()` at line 88. The timeout decorator covers that call at `core/dist/src/test-runner/timeout-decorator.js:35`. Four configured runners therefore do not parallelize the baseline.
- `dryRun → run → ctx.start` sets related source paths and starts Vitest at `vitest-test-runner.js:69,108,132`. `ctx.start` resolves specifications before running files at `cli-api.DuT9iuvY.js:13297`.
- Related selection first globs candidates, then traverses **every candidate test’s dependency graph**, using cached SSR transform results or `ssr.transformRequest`, before selecting related tests at `cli-api.DuT9iuvY.js:11385,11439,11466`. This proves broad discovery work exists. It does not measure its cost.

Stryker calculates “overhead” as wall time minus summed test durations at `core/dist/src/process/3-dry-run-executor.js:140`. It includes work outside those durations and cannot identify transforms, imports, environments, hooks, GC or scheduling separately.

| Preserved local baseline | Baseline wall time | Test durations | Residual overhead | Package total |
|---|---:|---:|---:|---:|
| Game | 9 s | 1.94 s | 7.71 s | 34 s |
| Workspace | 118 s | 52.52 s | 65.72 s | 604 s |
| Tree | 131 s | 55.46 s | 75.67 s | 599 s |

All packages invoke the broad related-selection mechanism, yet their residuals differ substantially. **Equating the workspace’s 65.7 seconds with discovery or transforms is unsupported.** The static-mutant planner’s percentages are estimates, also not elapsed-time measurements.

The hosted workspace baseline had both higher test durations, 123.59 seconds, and higher residual overhead, 145.37 seconds. Its slowdown therefore was not confined to the residual bucket. Tree timed out without a completed breakdown.

During this inspection, the candidate workspace package completed at **13:12:26**, reporting **100% and 472 seconds**. Its baseline remained 144 seconds, slower than the preserved baseline’s 118 seconds. Tree began its new candidate baseline at **13:12:29**, so earlier tree results in that directory were stale baseline evidence. These observations do not establish either improvement or regression because the outside workloads differed.

**Cache semantics**

[Vite configuration](/home/felixb/Projekte/chessfable.worktrees/drain/vite.config.ts:78) disables persistent module caching under Stryker. Disabling it does not disable Vite’s in-memory transform results. The runner reuses its Vitest context and clears reported file state between runs at `vitest-test-runner.js:169`.

Persistent caching operates through Vitest’s `ModuleFetcher`, notably `cli-api.DuT9iuvY.js:996,1056`. Related dependency selection calls SSR transforms directly at line 11470, outside that fetch path. Enabling `fsModuleCache` is therefore **not an established remedy for the related-selection traversal**.

Ownership matters independently:

- Default cache storage is workspace `node_modules/.experimental-vitest-cache` at `cli-api.DuT9iuvY.js:623`.
- Keys include module identity, content, root and configuration at lines 711–755. Random sandbox identities produce distinct entries.
- Stryker symlinks `node_modules` at `core/dist/src/sandbox/sandbox.js:74`. I also verified the active sandbox symlink points to the probe checkout’s `node_modules`.
- Existing `.stryker-tmp` cleanup at [runner line 428](/home/felixb/Projekte/chessfable.worktrees/drain/scripts/run-frontend-mutation.mjs:428) does not collect files written through that symlink.
- Vitest clears its persistent cache on lockfile changes, without a per-run retention bound, at `cli-api.DuT9iuvY.js:784`.

A sandbox-local `experimental.fsModuleCachePath` could provide ownership through existing sandbox cleanup, using only `vite.config.ts`. That is a conditional configuration option if repeated module-fetch transforms are measured as costly. There is no such measurement here, so I do not recommend enabling it now.

**The historical static-mutant finding**

I read the complete [f-20260929-09 entry](/home/felixb/Projekte/chessfable.worktrees/drain/tasks/findings.md:12688). Its completed result was **17 tabStorage + 2 workspace = 19**, concerning module-level schemas and workspace hydration.

The actual primary `artifacts/mutation/frontend/workspace-storage/mutation.json` has **60 tabStorage + 2 workspace = 62**, matching the preserved local baseline. Its embedded sources match current files.

The locations establish an important distinction:

- Workspace’s two static mutants are literals at lines **10 and 202**.
- TabStorage has **17** static mutants in constants, the status object and a field initializer at lines **12–32, 304 and 376**.
- The other **43** are in reads, pending-count and status handling at lines **388–445, 805 and 845–857**.
- None are in the operation-owned schema factories. Workspace hydration remains lazy through `initializeWorkspace` at `src/state/atoms.ts:77`.

“Static” means executed without an active test attribution, not necessarily production module-level initialization. The runner sets and clears that attribution in hooks at `vitest-runner/dist/src/stryker-setup.js:38`. The report does not identify which collection, hook or asynchronous callback caused every extra hit.

Thus **the count difference does not establish recurrence of the handled cause**. The source and execution contexts changed. No reopening or source fix is justified. Static mutants do require broader execution plans at `core/dist/src/mutants/mutant-test-planner.js:91`, but that subsequent mutation cost cannot explain the initial baseline timeout.

**Optimal: obtain a clean scheduling comparison before changing mechanisms → I recommend that as the next experiment.**

1. Let the current candidate finish and preserve its complete reports as feasibility evidence.
2. Repeat the unchanged base and exact one-file serial candidate sequentially on a quiet machine, preferably in **A–B–B–A order**. Keep Node, dependencies, four-CPU affinity, 7 GiB usable sizing, checkout contents and starting cache policy identical. Keep unrelated heavy work absent throughout. CPU affinity alone does not reserve CPUs.
3. Use the existing full mutation command and supervision. Record baseline durations and test counts, package and whole-lane elapsed time, complete mutation results and cleanup. Judge the whole lane, since faster isolated packages can still lose package-overlap throughput.
4. Require a repeatable, practically meaningful benefit before accepting serialization. A green run alone establishes feasibility. Successful reversal tests establish test sensitivity, not performance benefit.

If that comparison does not justify serialization, the simplest separate mechanism experiment is **one change in `stryker.config.mjs`: `vitest.related: false`**. Keep scheduling fixed. This removes the evidenced graph-selection traversal and executes the full configured suite instead. It may be slower, especially for static mutants. Compare complete results without an allowlist, and verify that every former test still executes. Any improvement demonstrates the net value of removing selection, not an exact transform-time saving.

For cheaper preliminary diagnosis, Stryker’s existing `dryRunOnly` option is available at `core/schema/stryker-schema.json:329`. Apply it equally to both experimental arms and label the results diagnostic only. It cannot replace full mutation proof.

**Named limitations:** uncontrolled outside load in the existing pair, different hosted hardware, affinity without CPU reservation, a declared sizing budget rather than a dedicated 7 GiB memory limit, no phase-level timing profile, no attribution for individual static hits, and incomplete candidate tree/full-lane results at inspection. Hosted confirmation remains necessary.

No files changed, workloads started, findings filed or skills invoked. Inspected paths were the two assigned rules, named scripts/configuration and plan, requested finding and cache decision, preserved and active reports, relevant installed code/types, and narrowly related state/test source and Git history. Existing changes were untouched. Plan authorship and arbitration share root context, and detection uses the same model family as the code.

## Focused mechanism judgment J1, raw report

[blocker] O3 NOT CLOSED — `tasks/plans/2026-10-15-ci-mutation-startup.md:34` requires meaningful repeatable benefit before landing serialization when the base already passes. The preserved base completes all three packages at 100%, while the candidate comparison has uncontrolled competing workloads (`/tmp/build-storage-9900f4c3/probe-2-r1.txt:13`, `:23`, `:61`). `scripts/gate-parallelism.mjs:293` changes scheduling universally, but configured runner capacity does not establish elapsed-time benefit. The current serial candidate has **not met O3**, regardless of whether its full run subsequently finishes green. CI-I1 and CI-I2 remain closed. (confidence: 100)

[should-fix] `tasks/plans/2026-10-15-ci-mutation-startup.md:16` — the unconditional timeout prohibition conflates an operational batch deadline with test-quality constraints. Stryker’s schema defines `dryRunTimeoutMinutes` as the absolute initial-run allowance, default five minutes (`node_modules/@stryker-mutator/core/schema/stryker-schema.json:518`). The executor passes it around the complete baseline invocation (`node_modules/@stryker-mutator/core/dist/src/process/3-dry-run-executor.js:82`), and the timeout decorator enforces that boundary (`node_modules/@stryker-mutator/core/dist/src/test-runner/timeout-decorator.js:35`). This is distinct from individual test and mutant timeouts. Decision d-20260901-36 rejects raising Vitest `testTimeout` to conceal unnecessary BoardGame loading, not configuring this whole-suite allowance (`tasks/decisions.md:1368`). (confidence: 99)

The evidence supports explicitly correcting root’s assumption. Hosted workspace execution consumed roughly 124 seconds in test durations plus 145 seconds outside those durations. Tree then exceeded the batch deadline (`/tmp/build-storage-9900f4c3/upstream-test-job.log:11282`, `:11252`). This establishes substantial legitimate work and a deadline failure. It establishes neither a hang nor a specific avoidable bottleneck. The residual cannot be attributed entirely to related discovery.

**Optimal: preserve published scheduling and trial a bounded initial-suite allowance → I recommend a revised candidate changing only `dryRunTimeoutMinutes`, with ten minutes as a defensible trial cap.** That directly addresses the observed termination boundary without asserting a speed improvement. It preserves all tests, mutation scope, `perTest` analysis and 100% thresholds. Its cost is up to five additional minutes before declaring an initial-suite timeout, followed by existing recovery.

Preserve the per-mutant timeout **settings and calculation**, rather than promising identical computed durations. Stryker derives mutant deadlines from measured baseline test durations and overhead (`node_modules/@stryker-mutator/core/dist/src/mutants/mutant-test-planner.js:124`). The larger initial allowance itself is absent from that calculation.

This is a grounded operational repair candidate, not demonstrated hosted repair effectiveness. Ten minutes is neither proven sufficient nor uniquely optimal. A measured structural defect would warrant structural repair, but none supplied establishes that serialization or disabling related selection is better. `vitest.related: false` bypasses the dependency-selection traversal, while expanding executed tests, so it remains a separate experiment with uncertain net cost (`node_modules/vitest/dist/chunks/cli-api.DuT9iuvY.js:11449`).

The revised plan needs this local proof:

1. Identify the exact candidate revision and retain published allocation. Verify the actual config consumed by Stryker sets the bounded initial allowance while preserving mutation scope, related selection, thresholds and timeout settings. Existing config-import coverage is at `scripts/run-frontend-mutation-tests.mjs:1025`.
2. Run the complete existing command in the owned checkout: `agent-gate taskset -c 0-3 env GATE_MEMORY_BYTES=7516192768 pnpm mutation:frontend`. Retain all package reports, baseline test identities/counts, timings, mutation outcomes, exit status and cleanup evidence.
3. Record that the default deadline already passes locally. A green candidate proves local feasibility, not reproduction or resolution of the hosted failure. Complete required review and gates before the single hosted confirmation.

Preserve the original finding and frozen mandate verbatim. Record the newly established SDK semantics, explicitly supersede the relevant agent decision through the ledger’s locked route, and review the corrected plan. The ledger permits evidence-based reversal of agent decisions while requiring historical preservation (`/home/felixb/.claude/references/findings-ledger-contract.md:1060`). This advice does not authorize silently weakening the existing contract.

Named limitations: no completed hosted tree baseline or phase-level cost profile, and no controlled serial benefit measurement (confidence: 100). No final corrected plan or formal correction packet was supplied, so this is mechanism advice, not plan approval. Review was read-only. Detection shares the code’s model family, and plan authorship and arbitration share root context.

VERDICT: REVISE

## Corrected frozen CI-R3 plan

# Required CI mutation startup repair

## Goal
Restore the required Linux Test job with the complete existing mutation proof.

## MANDATE
### Frontend mutation startup times out on the upstream CI runner before any tree-path mutant executes

* **ID:** f-PENDING · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Impact class:** tooling
* **Where:** `.github/workflows/test.yml` frontend mutation step, `scripts/run-frontend-mutation.mjs` package scheduling, `scripts/gate-parallelism.mjs` Stryker budget, and `stryker.config.mjs` per-test coverage startup. Upstream Test run 38705031849, Linux test job 116322220534, HEAD 45c7dd30c2fa42ae47fb2bde4b7fc66d622e27bc.
* **Defect:** the required upstream Linux job failed pnpm mutation:frontend. Its actual Stryker log starts the tree-path dry run at 08:35:01 UTC and reports Initial test run timed out at 08:40:02, before a mutant result. Workspace-storage was still running beside it, had two runners, and reported 2166 baseline tests taking 4m28s including about 145s overhead before cancellation by the failed sibling. Gate memory detection used the documented conservative 8 GiB fallback. The failure is the startup/coverage execution, not a mutation score failure.
* **Failure scenario:** the ordinary required Test workflow on the published base runs frontend mutation packages under the constrained hosted runner. Baseline startup reaches the existing five-minute limit, makes test red, and the remote-CI refusal blocks the next otherwise verified push.
* **Spotted outside diff:** the failure is on the already-published base of f-20261001-20, before its byte-count source changes. The red remote was discovered during that run's required release preflight.
* **Open question:** which package and worker schedule or test-startup implementation keeps the complete existing per-test mutation proof within the runner's resource and startup bounds, without relaxing coverage, mutation thresholds, tests or timeouts?
* **Proof:** reproduce the workflow's own pnpm mutation:frontend on the base with the measured hosted CPU/memory budget, retain startup timings and complete mutation results, then prove the repair under that same budget before one hosted confirmation. No threshold or timeout increase clears this finding.
* **Related:** f-20260929-09 previously addressed a different measured module-load/static-mutant cost, no common cause is yet established and its Root is -. This entry does not reopen its settled implementation without new mechanism evidence.
* **Found by:** Codex full-auto f-20261001-20 release preflight. Full upstream job log retained at /tmp/build-storage-9900f4c3/upstream-test-job.log. Plan authorship and arbitration shared one context, detection uses the same model family as the code.

### Explicit technical scope amendment

The preceding entry is preserved verbatim as historical agent-authored scope. Its unconditional timeout prohibition is explicitly superseded by the locked technical correction below and decisiond-20261015-20. No Felix requirement changes. The user mandate remains full-auto storage-size repair through the required reviewed and verified push. AGENTS rule11 and the decisions contract authorize evidence-based correction of an agent decision. The correction is an operational whole-suite allowance, preserving all proof-quality constraints.

* **Technical correction, 2026-10-15:** decisiond-20261015-20 supersedes Codex's initial unconditional timeout prohibition and conditional serial choiced-20261015-19. This is an evidence-based correction of an agent-authored constraint, not a change to a Felix requirement. The original entry and frozen plan remain historical. Stryker9.6.1 dryRunTimeoutMinutes bounds the entire initial suite and is distinct from individual Vitest testTimeout and per-mutant timeout settings. Hosted workspace completed2166 tests in269 seconds, while tree's2696-test baseline hit300 seconds. No specific avoidable bottleneck or hang is proven. The uncommitted serial trial did not establish repeatable benefit and will not land. The corrected candidate preserves published allocation and trials a bounded10-minute initial-suite allowance, with every test, related selection, perTest coverage,100%thresholds, individual limits and per-mutant settings/calculation unchanged. Existing source, failed deadline evidence and diagnostic reports remain. Full local proof, corrected-plan review and one hosted confirmation are required before completion. No local reproduction of the hosted300-second failure is claimed. Additional failure cost is up to five minutes before aborting a stalled whole initial suite, normal execution has no added work or claimed speed benefit. Raw judgment and history are preserved in the CI startup repair handoff. Plan authorship and arbitration shared one context, detection used the same model family as code.

## Threat model and non-goals
Ordinary hosted runners, conservative memory fallback and complete cold initial suites. Retain published package scheduling, memory/CPU sizing, every configured test, related selection, perTest coverage,100%thresholds and individual test limits. Preserve per-mutant timeout settings and calculation, whose computed results naturally depend on measured baseline durations. No promise of identical computed deadlines. No performance optimization, cache, wrapper, allowlist, ignored mutant, new gate or product change.

## Traced premises
SDK9.6.1 schema defines dryRunTimeoutMinutes default5 as the absolute allowance for the entire initial invocation. The dry-run executor at node_modules/@stryker-mutator/core/dist/src/process/3-dry-run-executor.js:82 passes that budget to the existing timeout decorator. Vitest testTimeout and per-mutant timeoutMS/timeoutFactor are distinct. The mutant planner uses measured baseline durations and overhead and does not use dryRunTimeoutMinutes.
Published-base hosted workspace completed2166 tests in269s, with123.6s in test durations and145.4s residual. Tree's2696-test initial run hit300s. This proves substantial legitimate work and a whole-batch deadline failure, neither an exact avoidable bottleneck nor a hang. Related discovery traverses candidate graphs, but the residual is not a transform profile. Default five minutes is not a demonstrated proof-quality floor.
Local base4CPU7GiB-usable completed0/all3scores100, baseline118/131s and total635s. Serial trial also completed0/all100, baseline144/118s, packages22/472/282s and total778s. Different concurrent machine workloads prevent a causal speed comparison. O3's benefit criterion was not met. Retain artifacts and discard the trial. Fresh focused review-plan judgment found the trial unproven and the blanket prohibition conflated whole-suite allowance with proof quality. CI-I1/CI-I2 factual corrections remain closed.
Decisiond-20261015-20, d-20261015-19 supersession and f-20261015-08 correction were committed via supported ledger commands before new implementation. d-20260901-36 rejects raising individual Vitest testTimeout for unnecessary BoardGame loading and remains intact. No source evidence establishes such a structural defect here.

## Approach
### O1. Bound the complete initial suite
Configure Stryker dryRunTimeoutMinutes10, with a concise comment explaining the observed hosted whole-suite deadline and distinction from individual limits. Ten minutes is a defensible trial cap, not a uniquely optimal value or demonstrated hosted fix until confirmation. Failure cost is up to five extra minutes before aborting a stalled complete initial run. Normal execution adds no work and no speed improvement is claimed.
### O2. Preserve published scheduling and proof quality
Discard exactly the three owned uncommitted serial-trial files, preserving their patch and proof. Restore scripts/gate-parallelism.mjs, scripts/gate-parallelism-tests.mjs and scripts/run-frontend-mutation-tests.mjs to the published implementation in HEAD. Preserve the independent db.test.ts public-facade type correction and all other work. Change only stryker.config.mjs for the budget. Verify actual consumed configuration retains the package mutation manifest, related:true, perTest,100%thresholds and default per-mutant settings. Existing configuration-import and runner tests cover integration. Do not add a test mirroring the new numeric setting. Existing supervisor, fence, recovery and cleanup remain unchanged.
### O3. Prove local feasibility and obtain hosted confirmation
Run existing parallelism and mutation-runner suites, formatting, actual config inspection and full pre-review. In the root-owned disposable checkout, restore the serial production patch and apply only the corrected config, then run agent-gate taskset -c 0-3 env GATE_MEMORY_BYTES=7516192768 pnpm mutation:frontend. Preserve every package report, baseline counts and identities, complete mutation results, exit and cleanup. Compare test identities against the preserved base and require none omitted. The default already passes locally, so do not fabricate failing-before evidence or call a green local run resolution of the hosted failure. Primary negative evidence is the actual published hosted300s failure. Complete local proof and final review/gates precede one hosted confirmation. Hosted failure returns to diagnosis and repair before another attempt.
### O4. Release the integrated correction
Keep the separate fixture boundary correction through the public facade type. Cumulative review covers both corrections and unchanged original storage-size code as context. Final clean-tree full Rust/frontend/bindings push gates, required Linux mutation confirmation and all existing platform jobs must pass. Earlier full native app and131pixel proof remain valid because this repair changes no executable product code. Verify push HEAD=upstream and install under project policy.

## Decisions and trade-offs
Optimal: preserve published scheduling and trial a bounded allowance for the complete initial suite → I recommend this correction. d-20261015-20 supersedes the agent's prior choice and blanket constraint with source semantics and measured work. No Felix attribution is implied. The cold-cache and resource decisions remain. The larger batch deadline preserves proof but delays detection of an initial-suite hang by at most five minutes. Ten minutes remains an operational choice subject to actual hosted confirmation. The serial source/test changes will not land, regardless of their green feasibility results.

## Risks / open questions
Hosted tree did not finish, so its true duration and exact cost profile remain unknown. Local default5 already passes, affinity controls CPU availability rather than reserving CPUs, and7GiB is a sizing override rather than a new physical limit. Complete local proof does not establish hosted sufficiency. If a measured structural defect emerges, repair it rather than continuing to raise allowances. No individual-test, mutant or mutation-quality relaxation is authorized.

## Not part of this task
No scheduling optimization, cache, related-filter change, individual timeout change, source lifecycle or product behavior change.

## Phases
One exact corrected-config phase using the existing sensitive worker gpt-6.1-sol/high. Restore its three owned trial files to HEAD after patch/hash capture. Edit only stryker.config.mjs. Read scripts/run-frontend-mutation.mjs and original test/config consumers, SDK schema/executor/decorator/planner. Exact proof: pnpm gates:parallelism:test, pnpm mutation:runner:test, pnpm exec oxfmt --check stryker.config.mjs, git diff --check. Root verifies consumed config and all preserved settings, runs full pnpm checks:pre-review and the complete4CPU7GiB probe command. No numeric-mirror test or invented negative result. Root owns review, explicit path commits and release. Reversal removes the one option and returns to diagnosis, no user settings or installed data migration.

## Reviews
CI-R1: four lenses, plan/correctness/tests REVISE, minimalism APPROVED. Adopted CI-I1 (plan/correctness/tests): impossible greater-capacity parallel case, Fix by explicit universal serialization/invariant and removal of redundant search. Adopted CI-I2 (plan): scheduler tests depend on active peers, Fix by including consumer tests and preserving serial failure/signal/ownership guarantees. Both require closure on CI-R2. Diagnosis probe is evidence, not a lens verdict. Open issue IDs CI-I1, CI-I2. Raw reports in /tmp/build-storage-9900f4c3/lens-ci-*-r1.txt, to be copied verbatim into durable handoff before final gates.
Plan authorship and arbitration share one root context. Detection runs on the same model family as code in fresh sessions.


Focused judgment J1 after CI-R2 is preserved verbatim at /tmp/build-storage-9900f4c3/probe-3-r1.txt and will be copied into the durable CI repair handoff. Its VERDICT: REVISE is advisory mechanism judgment, not full CI-R3 plan approval. Adopt CI-I3 [blocker], O3 not met for serial trial, Fix by discarding rather than landing it. Adopt CI-I4 [should-fix], blanket prohibition conflates operational baseline allowance and proof-quality bounds, Fix through explicit technical amendment, decisiond-20261015-20 and corrected O1-O3. Both witnessed by focused review-plan judgment, closure pending CI-R3. CI-I1/CI-I2 remain closed, no reintroduction of their disproved premise.

Authority for CI-R3: newly traced SDK distinction, substantial complete hosted workspace work, completed local base/trial proofs without demonstrated serial benefit, and fresh-context mechanism judgment. Supported locked ledger correction explicitly supersedes the earlier agent choice and constraint. This is not an unannounced acceptance weakening, and the original finding/plan/raw reports remain unchanged historical evidence. No Skip, Defer or carried issue. Plan authorship and arbitration share root context, detection uses the same model family and model as code in fresh sessions.


## CI-R3 complete raw review reports

### CI-R3 plan

CI-I3 CLOSED — CI-R3 explicitly withdraws the unproven serial trial and requires restoring published allocation (`/tmp/build-storage-9900f4c3/ci-plan-r3.md:39`, `:55`). Published scheduling remains available in `HEAD:scripts/gate-parallelism.mjs:295`. Earlier green trial results receive no corrected-candidate proof credit.

CI-I4 CLOSED — CI-R3 explicitly amends the agent-authored prohibition while preserving individual limits and per-mutant settings/calculation (`/tmp/build-storage-9900f4c3/ci-plan-r3.md:24`, `:27`). The SDK confirms the separate whole-suite deadline at `node_modules/@stryker-mutator/core/dist/src/process/3-dry-run-executor.js:82` and mutant calculation at `node_modules/@stryker-mutator/core/dist/src/mutants/mutant-test-planner.js:124`. Decision recording, supersession and finding annotation are committed.

No additional plan defects found.

Limitation: corrected-config execution, identity comparison, final gates and hosted confirmation remain pending. Approval covers CI-R3’s plan, not demonstrated repair effectiveness (confidence: 100). Review was read-only, with no gates run or files changed. Detection shares the code’s model family and model. Plan authorship and arbitration share root context.

VERDICT: APPROVED

### CI-R3 correctness

No correctness defects found in CI-R3’s planned configuration and integration contracts. SDK source confirms the whole-suite allowance is separate from individual test and per-mutant settings.

Limitation: cleanup, corrected-config execution, test-identity comparison and hosted sufficiency remain pending proof obligations (confidence: 100). This approves the plan, not completed implementation.

Review used the same model family as the author, with fresh-session separation only.

VERDICT: APPROVED

### CI-R3 minimalism

No bloat or duplication findings.

The smallest sufficient change is the proposed single `dryRunTimeoutMinutes` option and explanatory comment in `stryker.config.mjs`, after restoring the three owned trial files. No new files, abstractions, settings infrastructure, or redundant tests are needed.

The explicit d-20261015-20 amendment grounds this technical correction without expanding product scope or discarding the original mandate.

Limitation: this approves the plan’s minimalism. Cleanup, corrected-config proof, and hosted confirmation remain outstanding. Review was read-only and shares the code author’s model family.

VERDICT: APPROVED

### CI-R3 tests

CI-I3 CLOSED — O2 discards the unproven serial candidate. O3 requires fresh full-command proof and test-identity comparison before hosted confirmation.

CI-I4 CLOSED — SDK tracing confirms separate whole-suite and per-mutant deadlines. The revised proof preserves individual limits, mutation scope and thresholds.

Named limitation (confidence: 100): existing config-import tests and locally green mutation runs would still pass if the new allowance were removed. They prove integration and feasibility. The required consumed-config inspection must detect that removal, while hosted confirmation must establish operational sufficiency. Neither corrected proof has run yet, so this approves the proposed verification, not a completed repair.

Review used fresh-session separation within the same model family. No files changed.

VERDICT: APPROVED

### CI-R3 error-handling

No error-handling defects found in CI-R3.

The SDK maps initial-suite expiry to `DryRunStatus.Timeout`, logs “Initial test run timed out!”, then throws. The runner preserves package identity, prints the diagnostic log tail, terminates siblings and returns nonzero. Hosted evidence confirms exit 1 reaches the required CI step. Cleanup failures also remain nonzero and retain the recovery fence.

O1–O4 preserve this fail-closed behavior. No retry or success fallback is introduced.

Limitation: corrected-config execution and hosted sufficiency remain pending implementation proof (confidence: 100). Review was read-only, with no files changed or gates run. Detection shares the author’s model family and model.

VERDICT: APPROVED

## CI-R3 arbitration and implementation proof

Adopted focused-judgment CI-I3 is Fix. The trial failed its conditional acceptance and is discarded. CI-I4 is Fix. The corrected operational deadline is explicitly distinguished from proof quality, with an evidence-based agent-decision supersession. Plan and tests explicitly closed both against CI-R3. All five CI-R3 verdicts are APPROVED. Earlier CI-I1 and CI-I2 remain closed factual corrections. No Skip, Defer or carried item. CI formal-round adoption counts are r1=2, r2=0, r3=0, plus two adopted findings in the separate focused judgment J1. It was advisory, not a manufactured full-plan approval.

The same sensitive worker restored exactly its three trial files after full saved-diff/hash verification. Root confirmed their diff to HEAD is empty. The new configuration diff contains only two explanatory comment lines and dryRunTimeoutMinutes 10. The independent fixture correction remains intact. Actual imports for all three packages show 10 and unchanged mutation manifests, related true, perTest and 100% thresholds. timeoutMS and timeoutFactor remain unset in the source config, retaining SDK defaults and calculation. Existing allocation tests 40 and mutation-runner tests 106 pass, formatting and diff checks pass. No mirror-number test, new gate, wrapper, cache or source lifecycle edit was added.

Corrected complete probe execution, report comparison, full pre-review, cumulative code/records review, final clean-tree gates, push, required hosted confirmation and installation remain pending at this checkpoint. The ordinary storage-size native and pixel evidence remains unchanged. Plan authorship and arbitration shared one context. Detection used the same model family and model as code in fresh sessions.


## Corrected complete local proof

This section supersedes the earlier corrected-proof pending checkpoint. gate-ci-budget-pre-review.R6cdr9 completed and was polled with exit 0. All seven lanes passed, including frontend mutation 446.6 seconds and Windows cross-target linting. gate-ci-budget-runtime.aTexcX completed and was polled with exit 0 on actual probe HEAD 45c7dd30, with only the exact corrected configuration patch. Its initial and final config SHA256 was 61236319b93bacdbf4b00fe73c955b9e6f39db808877a276a4145deaa188207d. The postconditions verified unchanged exact diff/hash, no other changed path, absent mutation fence and removed sandboxes. Published allocator remained byte-identical to BASE.

The corrected constrained workload began at 13:50:48 and ended at 14:01:36, about 648 seconds. Game completed in 29 seconds, workspace in 637 seconds and tree in 618 seconds with published overlap. Workspace baseline reported 2166 results in 114 seconds, tree 2696 in 133 seconds. All three mutation scores were 100%. There is no speed claim. The local default-five-minute baseline also passed. The actual earlier hosted failure remains the negative evidence, and hosted sufficiency remains a required release check.

The comparison reads actual emitted SDK reports, not reconstructed fixtures. The resolved configuration differs only in dryRunTimeoutMinutes, 5 to 10. Framework/dependency metadata, every retained report test identity and test source, every mutant identity and mutated source match. Initial-run counts match separately. The tree SDK report retains 2694 unique raw file/name identities while the runner reports 2696 results. Its test-coverage map deduplicates equal raw IDs, so those quantities are explicitly distinguished. No skipped proof or omitted test is inferred from that existing map behavior. Ignored counts remain unchanged, with no survivors, uncovered mutants, runtime errors or compile errors.

Exact comparison output:

```text
{"baseline_results": 291, "candidate_statuses": {"Killed": 87}, "only_config_difference": {"dryRunTimeoutMinutes": [5, 10]}, "package": "game-practice", "retained_report_test_identities": 291, "score": 100, "test_identity_sha256": "ea9d399546d4673cd45ca1711d2c59d34b99f232e393ff369b4a64bcfad58470", "unchanged_mutant_identities": 87}
{"baseline_results": 2166, "candidate_statuses": {"Ignored": 3, "Killed": 1074}, "only_config_difference": {"dryRunTimeoutMinutes": [5, 10]}, "package": "workspace-storage", "retained_report_test_identities": 2166, "score": 100, "test_identity_sha256": "0c3027cd703870b64fabd6ac9b45bcc609a124b64c6f36ab6dcc656a299a1470", "unchanged_mutant_identities": 1077}
{"baseline_results": 2696, "candidate_statuses": {"Ignored": 6, "Killed": 170, "Timeout": 6}, "only_config_difference": {"dryRunTimeoutMinutes": [5, 10]}, "package": "tree-path", "retained_report_test_identities": 2694, "score": 100, "test_identity_sha256": "5dfc0ea1ec3683794eaff3efb97907027f24dd30bdfca841362cdfb980de642f", "unchanged_mutant_identities": 182}
All report test identities and source, mutation identities and source match. Only the complete initial-suite allowance changed from5 to10 minutes.
```

Source implementation and local proof are complete. Cumulative code/records review, clean-tree final gates, push, required hosted confirmation and install remain pending. Plan authorship and arbitration shared one context. Detection used the same model family and model as code in fresh sessions.


## Cumulative code closure R3, complete raw reports

### Code R3 correctness

No correctness defects found. The fixture retains the same DTO shape and exact decimal value. Stryker converts the new allowance to 600,000 ms for the complete initial run, preserving individual test limits and mutant timeout calculation.

Limitation: hosted sufficiency remains unverified (confidence: 100). No files changed or gates run. Review shares the author’s model and family, with fresh-session separation only.

VERDICT: APPROVED

### Code R3 root-cause

No root-cause blocker or reintroduced prior defect found. The fixture removes the forbidden import directly. SDK tracing confirms the configuration changes the complete baseline allowance while preserving individual test and mutant timeout settings.

Limitation — stryker.config.mjs:42: hosted failing-before/passing-after proof remains incomplete. Both configurations pass locally, so ten minutes remains a bounded repair candidate pending hosted confirmation (confidence: 100).

Review used the same model family and model as the author, with fresh-session separation only. No files changed.

VERDICT: APPROVED

### Code R3 tests

No findings. The persistence assertions still catch decimal coercion. The report comparison asserts `dryRunTimeoutMinutes` changes from 5 to 10 and would reject freshly generated reports after reverting the option.

Named limitation (confidence: 100): local mutation runs pass with either allowance. They prove feasibility and preserved scope, not hosted sufficiency. Required hosted confirmation remains pending.

Review shares the code author’s model family, with fresh-session separation only.

VERDICT: APPROVED

### Code R3 minimalism

No bloat or duplication findings. The closure delta uses the existing public facade type and one SDK configuration option. No added code files, wrappers, extension points or redundant tests require deletion.

Hosted sufficiency remains unverified until the required CI confirmation.

VERDICT: APPROVED

### Code R3 code-quality

No readability or local-consistency defects found in the two-file closure delta. The timeout comment matches SDK behavior, and facade-derived typing follows an existing sibling convention.

Review was read-only. Detection shares the code author’s model and family, with fresh-session separation only. Hosted confirmation remains pending.

VERDICT: APPROVED

### Code R3 error-handling

No error-handling defects found.

Deadline expiry still logs “Initial test run timed out!”, propagates nonzero, terminates sibling packages and retains the recovery fence if cleanup fails. The fixture’s type-only change adds no failure path.

Limitation (confidence: 100): hosted sufficiency remains unverified. Local success does not establish it.

Read-only review. No files changed. Detection used the author’s model and family in a fresh session.

VERDICT: APPROVED

### Code R3 ipc-contract

NOT APPLICABLE: The closure delta changes only a test fixture’s type annotation and Stryker’s complete initial-suite allowance. Neither changes runtime IPC commands, payloads, events, subscriptions, capabilities or generated bindings. Previously reviewed storage implementation remains unchanged.

VERDICT: APPROVED

## Code R3 arbitration

All seven verdicts are APPROVED, with IPC correctly not applicable to the two-file repair delta. No retained code finding or unresolved Fix remains. Six lenses explicitly retain the hosted-sufficiency limitation. The exact final source consists of fixture commit 515b555d and SDK configuration commit 1b2158ba, alongside the previously reviewed storage-size implementation 6e43269e. Known proof/history records were committed as 7e2999d9. The branch was fetched and rebase reported up to date against origin/master at BASE 45c7dd30.

The primary hosted failure has not yet been confirmed repaired. Finding f-20261015-08 therefore remains open through the first source push. Its closure will follow actual hosted success through the normal records-only push route, not a premature completion claim. Local complete proof and code review permit the required repair attempt under the remote-red exception for its owning finding. Full clean-tree gates, records review, ordinary push, hosted confirmation and install remain pending. This section supersedes code-review-pending states, not those remaining release obligations.

Plan authorship and arbitration shared one context. Detection ran on the same model family and model as code in fresh sessions. No family separation is claimed.
