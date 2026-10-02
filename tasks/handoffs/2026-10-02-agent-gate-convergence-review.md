# Review record: f-20260930-03 — push gate through the strict `agent-gate` (plan review, 2026-10-02)

Plan: `tasks/plans/2026-10-02-agent-gate-convergence.md` (git-ignored run artefact; this record is the durable copy of its review history).
Finding: `f-20260930-03`. Orchestrator: Claude Code (Opus 5.5), interactive PLAN session, executor Codex; plan approved under `full auto` after review closed.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### Round 3 (r3, 548 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness APPROVED · error-handling REVISE.

<details><summary>lens-plan-r3 (raw)</summary>

```text
R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r3 (raw)</summary>

```text
R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r3 (raw)</summary>

```text
R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r3 (raw)</summary>

```text
R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
```

</details>

Closures: R1-02 CLOSED (plan, tests, correctness, error-handling). R1-06 CLOSED (plan, error-handling). R2-02 CLOSED (plan, error-handling). R2-01 CLOSED by tests, correctness, error-handling; NOT CLOSED by review-plan (evidence collected outside the lock) → kept open under its ID. Lineage R1-01/R1-02 → R2-01 has now failed closure twice (R1-02 in r2, R2-01 in r3): per rule 12a the lineage stopped being patched by hand — the source path was traced (`run-push-gates.mjs:941-943` prints the run's log directory; `run-frontend-mutation.mjs:310-312` truncates each package log at start), the corrected collection was probed, and a focused fresh-context `review-plan` judgment is requested in round 4 (`lens-judgment-r4`).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Before/after listing and post-scope copies are not attributable under concurrent same-repo gates: another gate can create a log dir while M2 waits for the lock, and can truncate Stryker logs after M1 releases it | plan r3 | `agent-run:597-606` (waiting happens before the lock), `run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`; stub probe of `m2.sh` (exit passthrough 3→3, missing summary → exit 6, green copy → 0); `m1.sh` probe (copy, bad destination → exit 6) | Fix — evidence is collected inside the measuring scope (lock held): `m2.sh` copies the directory named by the scheduler's own `Push gate logs:` line, `m1.sh` copies the mutation tree before the scope ends | MANDATE re-measure (evidence must belong to the measured run) | open → r4 + judgment |
| R3-01 | Sampler counts rows but not matched node/pnpm processes; a selector that stops matching yields `unsized_rss_max_kib=0` accepted | tests r3 | probe: a run with no node/pnpm → `failed_samples=2` → `INVALID` exit 4 after the fix; first sample delayed 5 s so the measured command's node/pnpm exist (probe: `bash -c "…; node …"` → `failed_samples=0`) | Fix — each sample records `<rows> <matched> <kib>`; rows=0 or matched=0 fails the sample | MANDATE rule (b) reserve evidence | open → r4 |
| R3-02 | A later sample-append failure is unchecked | error-handling r3 | probe: sample file made read-only mid-run → sampler exits 5 on its own → `sampler_alive=0` → `INVALID` exit 4 | Fix — sampler exits on append failure; wrapper treats a sampler that ended before being killed as invalid | MANDATE rule (b) reserve evidence | open → r4 |

Round 3 counts: unique new issues 2 (R3-01, R3-02); residual 1 (R2-01); plan-level adoptions r3=3. Cumulative: r1=4 r2=4 r3=3.

### Round 4 (r4, 507 s wall, closure round + focused fresh-context judgment: review-plan, tests, error-handling, review-plan judgment)

Raw verdicts: judgment REVISE · plan REVISE · tests REVISE · error-handling REVISE.

<details><summary>lens-judgment-r4 (raw)</summary>

```text
JUDGMENT: r4 fixes the original concurrent-copy race: M2 identifies the scheduler’s own directory, and both collectors copy before releasing the lock (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:312`; launcher `agent-run:584`). R3-01 and R3-02 are CLOSED against r4: the matched-process check and append/liveness guards address their reported failures, supported by the supplied probes. R2-01 remains open because retrying with an existing destination can leave acceptance reading the previous attempt’s logs. The simplest sufficient mechanism is one fresh all-blocks measurement, collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM evidence inside the held lock into a fresh directory per attempt. The RSS sampler is unnecessary for MANDATE: rule (b) requires measured worker sizing and a recorded reason; the unchanged reserve can name the shared scheduler/receipt processes and be validated through the complete gate’s memory result. Existing producer logs supply runner evidence, though they do not supply isolated overhead RSS. Review should follow obligation scope and ordinary accidental failures; treating this scratch measurement as shipped monitoring software would exceed that scope. Limitation: the complete measurement was not independently executed under the read-only rails; conclusions rely on source and supplied probes (confidence: 90).

OBLIGATION CHANGES:

- Require fresh evidence paths for every measurement attempt; acceptance must inspect that attempt’s paths.
- Remove mandatory isolated-RSS measurement and automatic reserve resizing. Retain the unchanged allowance with an accurate shared-process rationale and whole-gate validation.
- Collect runner counts and intervals during M2; a second full mutation run is unnecessary for the mandated remeasurement.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)

VERDICT: REVISE
```

</details>

<details><summary>lens-plan-r4 (raw)</summary>

```text
R2-01 CLOSED — r4 plan:304–306 selects the scheduler’s emitted log directory; plan:323 preserves mutation logs before scope exit. Producers match these paths (`scripts/run-push-gates.mjs:610–620,943`; `scripts/run-frontend-mutation.mjs:310–312`), and the launcher retains the lock across both copies (`agent-run:584–620`). Supplied probes cover copying and failure propagation.

R3-01 CLOSED — r4 plan:269,283–286 records matched-process counts and rejects zero matches. The supplied real-scope probes distinguish a running node process from no node/pnpm processes.

R3-02 CLOSED — r4 plan:276,281–286 exits the sampler on append failure and rejects premature termination. The supplied mid-run permission probe confirms `sampler_alive=0`, `INVALID`, exit 4.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r4 (raw)</summary>

```text
R3-01 CLOSED — The plan samples `<rows> <matched> <kib>`, rejects either zero count, and delays the first sample; the supplied probes report `INVALID` when no node/pnpm process matches and zero failed samples for a valid node process (plan lines 247–286).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r4 (raw)</summary>

```text
R2-01 CLOSED — M2 copies the scheduler’s own log directory and M1 copies the mutation logs inside the lock-held scope (plan lines 243–245, 293–306; producers at `run-push-gates.mjs:941–943` and `run-frontend-mutation.mjs:310–312`).

R3-01 CLOSED — samples record both process rows and selector matches; either zero marks the sample failed. The supplied no-node probe returned `INVALID` (plan lines 263–269, 283; probe at 247–250).

R3-02 CLOSED — append failure exits the sampler, and an already-ended sampler makes the wrapper emit `INVALID`; the supplied read-only-mid-run probe returned exit 4 (plan lines 274–288; probe at 250).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)

VERDICT: REVISE
```

</details>

**Focused judgment record (rule 12a lineage escalation, R1-01/R1-02 → R2-01).** Contested invariant: Phase 2 evidence must be complete, belong to the measured run, and fail loudly otherwise. Previous answer: three one-off scripts (sampler + M2 + M1) collecting inside the scope. New evidence: source trace (`run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`, `agent-run:584-620`) and the probes above. Judgment (verbatim above): the review was being driven by obligation scope — a scratch measurement reviewed as shipped software; the simplest sufficient mechanism is one fresh all-blocks measurement collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM inside the held lock into a fresh directory per attempt; the isolated RSS sampler is not required by rule (b), which accepts a named shared-resource reason. Resulting obligation changes (adopted): fresh evidence directory per attempt; RSS sampler and automatic reserve resizing removed (reserve unchanged, named reason, validated by the whole gate); M1 folded into the single measurement M. The non-convergence comparison restarts from r4.

Closures: R3-01 CLOSED (plan, tests, error-handling) and R3-02 CLOSED (plan, error-handling) — both then **withdrawn** with the sampler (mechanism removed by the judgment; issues and evidence kept). R2-01 CLOSED by plan and error-handling, NOT CLOSED by the judgment (fixed copy destinations) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Fixed copy destinations let a retry validate the previous attempt's logs (`cp -r` into an existing dir nests the new copy) | judgment r4 | GNU `cp` destination-directory semantics (judgment cites coreutils info); new wrapper: `mktemp -d "$MEASURE_ROOT/measure-XXXXXX"` per attempt; probes: green stub collected `gate.out`, `gate-logs`, `mutation-logs` into a fresh dir; unusable root → `REFUSED` exit 3 | Fix — fresh evidence directory per attempt; acceptance reads only the printed `measure: evidence=` directory | MANDATE re-measure | open → r5 |
| J-1 | The isolated unsized-RSS sampler and conditional reserve resizing exceed MANDATE | judgment r4 (should-fix) | gate-performance intro accepts "a named shared resource" as a cap's reason; `gate-parallelism.mjs:191` subtracts the unchanged reserve | Fix — sampler and resizing removed; reserve reason = named shared processes, validated by M's `memory.peak` < `memory.max` and zero OOM kills; M1 folded into M | MANDATE "size per-step workers under rule (b)" (and rule 6d) | open → r5 |
| R4-01 | `git grep` exits 1 on no match, so the absence scan as an exit-0 proof fails on the intended clean state | tests r4 | `git grep` documented exit status 1 on no match (lens probe) | Fix — proof 1 is `! git -C … grep …` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r5 |
| R4-02 | `PIPESTATUS[0]` ignores a `tee` open failure; a stale summary in `$out` could be parsed | error-handling r4 | GNU `tee` continues when an output open fails | Fix (by withdrawal) — `tee` removed; output is redirected into the fresh evidence directory, so a failed redirect fails the command and no stale file exists | MANDATE re-measure | open → r5 |
| R4-03 | `memory.max` read unchecked | error-handling r4 (should-fix) | probe: cgroup unreadable → `INVALID — missing evidence: memory.max memory.peak memory.events` exit 4 | Fix — `memory.max` joins the evidence guard | MANDATE re-measure | open → r5 |
| R4-04 | A reserve raised after M2 would invalidate M1's sizing figures | plan r4 | — | Withdrawn mechanism — there is no reserve resizing and no separate M1 any more | — | open → r5 (confirm) |

Round 4 counts: unique new issues 5 (J-1, R4-01..R4-04); residual 1 (R2-01); withdrawals: R3-01, R3-02 (sampler), M1/M2 split; plan-level adoptions r4=4 (R2-01, J-1, R4-01, R4-03). Cumulative: r1=4 r2=4 r3=3 r4=4.

### Round 5 (r5, 1114 s wall, closure round: review-plan, tests, error-handling, minimalism)

Raw verdicts: plan APPROVED · tests REVISE · error-handling REVISE · minimalism APPROVED.

<details><summary>lens-plan-r5 (raw)</summary>

```text
R2-01 CLOSED — r5 plan:263,275–276,284–285 creates fresh destinations and restricts acceptance to this attempt’s directory. Copies match the producers’ layouts (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`) and occur inside the held lock.

J-1 CLOSED — r5 plan:109–121,282–299 removes isolated RSS sampling and reserve resizing. One measurement records observed runners and validates the unchanged reserve; `gate-performance.md:10–12` permits the named shared-resource rationale.

R4-01 CLOSED — r5 plan:235 negates the absence scan, making the supplied no-match exit status of 1 satisfy the proof.

R4-02 CLOSED — r5 plan:263,267,274 removes `tee` and parses output redirected into the fresh directory. The quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:7,11,18`.

R4-03 CLOSED — r5 plan:264,271,278 includes unreadable `memory.max` in the invalid-evidence guard; the supplied correction probe confirms exit 4.

R4-04 CLOSED — r5 plan:109,296–299 keeps the reserve unchanged and records one measurement. The post-measurement budget change that invalidated runner figures (`scripts/gate-parallelism.mjs:191`) is withdrawn.

LATE OBSERVATIONS

Limitation — Live scope behaviour and full measurement M were not independently executed under the read-only rails; closure relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r5 (raw)</summary>

```text
R2-01 CLOSED — Each attempt gets a fresh `mktemp` evidence directory, and acceptance reads only the printed path; the supplied probes cover collection and an unusable root.

J-1 CLOSED — The sampler and reserve resizing are removed. The single whole-gate measurement checks peak memory and OOM events.

R4-01 CLOSED — The `! git grep` proof handles the no-match exit status and requires no output.

R4-02 CLOSED — `tee` and its reusable summary path are removed; output goes to the fresh evidence directory, and a missing scheduler-log line is rejected.

R4-03 CLOSED — Unreadable `memory.max` is marked invalid; the supplied cgroup-read probe exits 4.

R4-04 CLOSED — There is one measurement and no reserve resizing, so separate M1/M2 measurements cannot invalidate each other.

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:290` — M accepts any `Creating <N>` line and records its value, but never checks that N follows rule (b) for the measured scope. A regression that leaves Stryker at the conservative five-runner count despite a readable 27 GiB budget would still satisfy the log, peak-memory, and OOM checks. Require comparison with the count computed from the measured scope, or capture and validate the reason for an allowed fallback. (confidence: 89)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r5 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, and acceptance reads only the printed path; the supplied probe confirms collection.

J-1 CLOSED — the sampler and reserve resizing are removed; the reserve stays fixed with a named shared-process reason, checked against whole-gate memory and OOM evidence.

R4-01 CLOSED — `! git grep` makes the no-match case exit 0 with no match output.

R4-02 CLOSED — output goes directly to `gate.out` in the fresh directory; missing scheduler logs mark evidence invalid.

R4-03 CLOSED — a failed `memory.max` read leaves the value empty and triggers the evidence guard.

R4-04 CLOSED — there is no reserve adjustment or separate M1 measurement.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:235 — `!` also turns fatal `git grep` errors into exit 0. The diagnostic remains visible, but a proof consumer checking only the exit status can treat an incomplete scan as success. (confidence: 91)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:265 — If `cut` cannot read `/proc/loadavg`, the wrapper prints an empty `loadavg=` field but never marks the evidence invalid; the enclosing `echo` succeeds, and acceptance does not require that field. Measurement M can therefore exit 0 without the load-at-start value O5 requires. (confidence: 95)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r5 (raw)</summary>

```text
R2-01 CLOSED — plan:247–250,282–285 uses a fresh evidence directory per attempt and reads only the printed directory.
J-1 CLOSED — plan:109–121,125–132 removes RSS sampling and reserve resizing; one whole-gate measurement validates the unchanged reserve.
R4-01 CLOSED — plan:235 negates `git grep` so no matches pass.
R4-02 CLOSED — plan:267 redirects output to the fresh `gate.out`; no `tee` or stale summary path remains.
R4-03 CLOSED — plan:264,271–273 checks `memory.max` and rejects missing cgroup evidence.
R4-04 CLOSED — plan:109–121,125–128 keeps the reserve fixed and uses one measurement; no separate M1 remains.
VERDICT: APPROVED
```

</details>

Closures: R2-01, J-1, R4-01, R4-02, R4-03, R4-04 CLOSED by every witness (plan, tests, error-handling, minimalism).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 | M records any observed `N`; a sizing regression to the conservative 5 runners would pass | tests r5 | `run-push-gates.mjs:921-931` (sequential mutation lane gets the scheduler's budget, CPU share 1); probe: in-scope expression prints `{"budget":28991029248,"slots":1,"runnersPerPackage":21}`; without `scripts/` → `INVALID … expected-sizing` exit 4 | Fix — the wrapper prints the in-scope expected sizing; acceptance requires `N` = expected `runnersPerPackage` and overlap ≤ expected `slots` | MANDATE "re-measure Stryker's runner count inside the gate scope" and "size per-step workers under rule (b)" | open → r6 |
| R5-02 | `! git grep` turns a fatal error (exit 128) into success | error-handling r5 (should-fix) | measured: no match → exit 1; invalid pattern → exit 128 | Fix — `…; [ $? -eq 1 ]` | MANDATE retirement proof | open → r6 |
| R5-03 | An unreadable `/proc/loadavg` leaves the load-at-start field empty without `INVALID` | error-handling r5 | script read | Fix — `loadavg` joins the evidence guard | O5 records load at start | open → r6 |

Round 5 counts: unique new issues 3; plan-level adoptions r5=3 (counted from the restart at r4: r4=4, r5=3). Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3.

### Round 6 (r6, 586 s wall, closure round: review-plan, tests, error-handling)

Raw verdicts: plan APPROVED · tests REVISE · error-handling APPROVED.

<details><summary>lens-plan-r6 (raw)</summary>

```text
R5-01 CLOSED — r6 plan:270,298–302 computes expected sizing inside the scope and requires matching observed runners and bounded overlap. The sequential lane passes that budget with CPU share 1 (`scripts/run-push-gates.mjs:921–932`); package sizing and Stryker concurrency match (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Supplied probes confirm expected sizing and missing-source refusal.

R5-02 CLOSED — r6 plan:235 accepts only `git grep` status 1. The supplied measurements distinguish no match (1) from fatal error (128), so fatal errors no longer pass.

R5-03 CLOSED — r6 plan:268,278,286 clears a failed load read, marks missing load data invalid, and converts an otherwise successful measurement to exit 4. Acceptance at :294 rejects `INVALID`; the quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:9,19,28`.

LATE OBSERVATIONS

Limitation — Live launcher behavior and full measurement M were not independently executed under the read-only rails. Review relies on inspected source and supplied probes; relevant gate sources remain unchanged since HEAD 10643303 (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r6 (raw)</summary>

```text
[blocker] R5-01 NOT CLOSED — the expected count comes from the sizing implementation under review, so a regression can make both expected and observed counts five.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:299 — M checks only that observed runners equal the count computed by `gate-parallelism.mjs`; it never requires that the computed budget reflect the readable gate scope or that the measured 27-GiB budget yields 21 runners. If sizing regresses to five for that budget, expected and observed can both be five and the overlap check still passes. The existing tests pin five at 7 GiB and eight at 90 GiB, but not this scope’s 27-GiB case. Assert the scope-derived budget/count independently, or add a regression anchor for this budget. (confidence: 96)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r6 (raw)</summary>

```text
R5-01 CLOSED — Phase 2 compares each observed runner count and package overlap with its in-scope sizing; the scheduler gives sequential mutation the full budget and CPU share 1 (`run-push-gates.mjs:921-931`).

R5-02 CLOSED — The measured no-match status is 1 and fatal status is 128; `[ $? -eq 1 ]` accepts only the no-match case.

R5-03 CLOSED — An unreadable or empty loadavg leaves `load` empty, which marks evidence invalid and returns 4 if the gate itself succeeds.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:270 — If the sizing probe fails, `2>&1` captures its diagnostic and `|| expected=` discards it. The caller gets only `expected=unavailable` and `INVALID — missing evidence: expected-sizing`, hiding the cause needed to fix the measurement (confidence: 96).

VERDICT: APPROVED
```

</details>

Closures: R5-02, R5-03 CLOSED (plan, error-handling). R5-01 CLOSED by plan and error-handling, NOT CLOSED by tests (expected and observed come from the same sizing code) → kept open under its ID (first closure failure of this lineage).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 (residual) | The expected count is computed by the code under test, so a regression could make expected and observed both 5 | tests r6 (2 findings, same defect) | independent arithmetic from the recorded constants: `max=30064771072 − 1 GiB = 28991029248`; `min(24, ⌊(28991029248 − 671088640)/1288490189⌋) = 21` (node one-liner, 2026-10-02) | Fix — acceptance also checks `expected` against the scope arithmetic (`memory.max` − 1 GiB; ⌊(budget − 640 MiB)/1.2 GiB⌋ capped at CPUs), with the atlas values written out | MANDATE "size per-step workers under rule (b) inside that one scope" | open → r7 |
| R6-01 | A failed sizing probe's diagnostic is discarded | error-handling r6 (should-fix) | probe: run outside the repo → `measure: sizing probe failed: node:internal/modules/esm/resolve:272 …` then `INVALID` exit 4 | Fix — arbiter-closed: the diagnostic is printed before the field is cleared (one-off script, executor detail; semantics and proof unchanged) | — | closed (arbiter) |

Round 6 counts: plan-level adoptions r6=1 (R5-01); 1 arbiter. Since the r4 restart: r4=4 r5=3 r6=1. Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1.

### Round 7 (r7, 709 s wall closure + 367 s first-look coverage at the same revision r7: review-plan, tests; then chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index, tauri-security, platform-semantics)

Raw verdicts: plan APPROVED · tests APPROVED · six project lenses NOT APPLICABLE/APPROVED · platform-semantics REVISE.

<details><summary>lens-plan-r7 (raw)</summary>

```text
R5-01 CLOSED — r7 plan:304–308 independently requires budget 28991029248 and 21 runners, so expected and observed both regressing to five fails acceptance. Constants and worker arithmetic match `scripts/gate-parallelism.mjs:10,17,21,253–260`; sequential mutation receives the full budget and CPU share 1 (`scripts/run-push-gates.mjs:921–932`), which reaches Stryker concurrency (`stryker.config.mjs:41–45`).

LATE OBSERVATIONS

Limitation — Live launcher behavior and measurement M were not independently executed under the read-only rails; review relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r7 (raw)</summary>

```text
R5-01 CLOSED — r7 requires checking the probe against independent scope arithmetic: the recorded atlas inputs yield 21 runners, so a fallback to 5 fails even if expected and observed counts agree.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271 — The new sizing-probe diagnostic has no planned regression assertion. Measurement M runs from the repository root, where the import succeeds; reverting this hunk to `|| expected=` would leave the planned commands green. The outside-`scripts/` probe is only a historical result at lines 255–258. Add a runnable negative probe that asserts the diagnostic and exit 4. (confidence: 93)

VERDICT: APPROVED
```

</details>

<details><summary>lens-chess-semantics-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate tooling, scripts, and documentation; none of its obligations touch an in-memory chess tree, position, or move path.

VERDICT: APPROVED
```

</details>

<details><summary>lens-engine-protocol-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan’s obligations concern gate scheduling, process placement, and documentation; none touch UCI engine supervision, protocol handling, or result routing.

VERDICT: APPROVED
```

</details>

<details><summary>lens-ipc-contract-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan’s obligations cover gate scripts, package routing, worker sizing, and documentation. Its phases explicitly exclude IPC/API contracts, and no Rust or renderer contract files are in scope.
VERDICT: APPROVED
```

</details>

<details><summary>lens-persisted-state-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan covers gate scripts, package routing, and documentation; it does not touch renderer persistence, storage keys, or tab lifecycle.
VERDICT: APPROVED
```

</details>

<details><summary>lens-pgn-index-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate launch, worker sizing, routing checks, and related documentation; it does not affect PGN scanning, indexing, encoding, storage, or search.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tauri-security-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate scripts, package configuration, and documentation; its obligations do not touch credentials, filesystem authority, signed downloads, or backend-only data.

VERDICT: APPROVED
```

</details>

<details><summary>lens-platform-semantics-r7 (raw)</summary>

```text
[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:70 — On macOS and Windows, the proposed `pnpm gate:run frontend-build` and `gate:ensure` scripts require the Linux `agent-gate`, which depends on `/proc` and `systemd-run`; they fail before the currently direct Node receipt runner starts (`package.json:26-27`, tuxedo-config `agent-run:214,559-575`). CI’s `gates:contract:check` only checks routing text, so it does not prove those commands work on either platform. (confidence: 98)

VERDICT: REVISE
```

</details>

Closures: R5-01 CLOSED (plan, tests).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R7-01 | The sizing-probe diagnostic hunk of the one-off wrapper has no runnable regression assertion | tests r7 (should-fix) | focused judgment r4: the wrapper is a never-committed scratch measurement; its failure paths were probed in this run (`measure: sizing probe failed: node:internal/modules/esm/resolve:272` → `INVALID` exit 4) | Skip — a regression assertion for a one-off scratch script is shipped-software verification the r4 judgment ruled outside MANDATE | — | closed (Skip) |
| R7-02 | `gate:ensure`/`gate:run` would fail on macOS/Windows, where `agent-gate` (`/proc`, `systemd-run`) does not exist | platform-semantics r7 (should-fix) | frozen threat model: environments that count are local Linux sessions with `agent-gate`; CI never runs the wrapped scripts (`.github/workflows/test.yml` runs the gate commands directly, probe-1-r1); `gates:push`/`checks:pre-review` have been Linux-only since K5's `bash scripts/heavy-gate.sh` (systemd-run); gate-performance (c): a missing `agent-gate` fails the gate by design | Skip — outside the frozen threat model's environments; gate-performance (c) mandates failing without the launcher | — | closed (Skip) |

Round 7 counts: plan-level adoptions r7=0; 2 Skips. Plan-level issues open after r7: none. R2-01 and J-1 (witness `judgment` r4) and R6-01 (should-fix, witness error-handling r6) still need a completed closure row by their witnessing lenses for the published evidence → r8 is an evidence-only closure check at the unchanged revision r7 (`plan-review-delta.py` → `UNCHANGED`, exit 3; no revision round is claimed).

### Round 8 (r8, 506 s wall, evidence-only closure check at the unchanged revision r7: review-plan, tests, correctness, judgment (fresh-context review-plan), error-handling)

Raw verdicts: all five APPROVED.

<details><summary>lens-plan-r8 (raw)</summary>

```text
R2-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:267,283–294` creates a fresh evidence directory, copies producer logs before scope exit, and restricts acceptance to the printed directory. Producer paths match (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`); supplied probes confirm collection and failure propagation.

J-1 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:109–121,291–313` removes isolated RSS sampling and conditional resizing. One measurement checks runners, peak memory and OOM events against the unchanged reserve (`scripts/gate-parallelism.mjs:10,191`), with the named shared-process reason permitted by `gate-performance.md:10–12`.

R6-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271` matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:11`: the diagnostic is printed before `expected` is cleared. The supplied missing-`scripts/` probe confirms the diagnostic followed by `INVALID` exit 4.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r8 (raw)</summary>

```text
R2-01 CLOSED — Phase 2 creates a fresh evidence directory per attempt, collects both log trees before the measuring scope ends, and reads only the printed directory. The supplied probes cover collection, red exit propagation, invalid evidence, and refusal for an unusable root (plan:247–294).

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r8 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, prints its path, and acceptance reads only that directory. The wrapper copies scheduler and mutation logs before the lock-held scope ends; the supplied probes confirm collection and gate-status handling.

LATE OBSERVATIONS

None.

VERDICT: APPROVED
```

</details>

<details><summary>lens-judgment-r8 (raw)</summary>

```text
R2-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:267` creates fresh evidence per attempt; `:283–285` copies the scheduler’s emitted directory and package-preserving mutation tree inside the measuring scope; `:294` restricts acceptance to the printed evidence directory. Producer paths match `scripts/run-push-gates.mjs:943` and `scripts/run-frontend-mutation.mjs:258`; launcher ownership is supported by `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:584–620` and supplied scope probes (confidence: 97).

J-1 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:109–121` retains the unchanged reserve with a named shared-process reason; `:291–317` uses one whole-gate measurement to require peak memory below the cap and zero OOM kills. Isolated RSS sampling and conditional resizing are removed. This matches `/home/felixb/.claude/references/gate-performance.md:10–14`; existing sizing subtracts the reserve at `scripts/gate-parallelism.mjs:191` (confidence: 97).

LATE OBSERVATIONS

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:291 — Verification limitation: measurement M and live routing proofs were not independently executed under the read-only rails. Closure verifies the corrected plan against inspected source and supplied probes; implementation acceptance still requires M (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r8 (raw)</summary>

```text
R6-01 CLOSED — r7 prints the sizing probe’s diagnostic before clearing `expected`, then marks the missing sizing evidence invalid and exits 4 on a green gate; the supplied probe confirms this outcome (plan lines 271, 280, 287; 255–258).

LATE OBSERVATIONS

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:250 — Runtime probes were supplied and the failure paths were source-traced, but they were not independently rerun under the read-only rails (confidence: 99).

VERDICT: APPROVED
```

</details>

Closures: R2-01 CLOSED (plan, tests, correctness, judgment); J-1 CLOSED (plan, judgment); R6-01 CLOSED (plan, error-handling) — this supersedes the r6 "arbiter" note for R6-01, whose witness was should-fix rank and therefore needed a witness closure.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R8-01 | Lenses did not execute measurement M or the live routing proofs themselves | judgment r8 (nit), error-handling r8 (nit) | read-only lens rails by contract (`review-lens-contract.md`); the plan's Phase 1 proofs and Phase 2 acceptance execute them during implementation | Skip — a stated limitation of read-only review; implementation acceptance runs M | — | closed (Skip) |

### Round 9 (r9, 281 s wall, PLAN-REFRESH drift round at the unchanged revision r7, base a580b504 → 84e697e9: review-plan, judgment (fresh-context review-plan), correctness, error-handling, minimalism, tests, chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index, platform-semantics, tauri-security)

Drift: `git diff a580b504bbbec73c5768546b6129c3c52881f0af..84e697e91a6f08fe4859362176abe7fa91c2bbd4` (drift file `drift-a580b504bbbec73c5768546b6129c3c52881f0af-84e697e91a6f08fe4859362176abe7fa91c2bbd4.diff`) changes `src-tauri/src/{chess,fs}.rs`, `src-tauri/src/engine/process.rs`, `src/bindings/generated.ts`, `src/components/engines/UpgradeEngineModal{.tsx,.test.tsx}`, `src/platform/tauri.ts`, `tasks/build-ledger.md`, `tasks/findings.md` (f-20261002-09, f-20261002-10 and annotations) and `tasks/handoffs/2026-10-01-stockfish-19-upgrade-review.md`. Of the plan's `paths`, only `tasks/findings.md` and `tasks/handoffs/` are touched, by unrelated records; no gate script, package script, skill, `CLAUDE.md` or decision the plan cites changed.

Raw verdicts: all thirteen APPROVED (four NOT APPLICABLE); no prefixed finding.

<details><summary>lens-plan-r9 (raw)</summary>

```text
No drift change invalidates O1–O6 or either phase’s proof/acceptance criteria (confidence: 95). The engine API changes do not affect gate routing, worker sizing or measurement producers.

Input limitation: the verbatim `ROUND/DELTA/REVISED/SETTLED` block was not supplied; this approval covers the supplied repository drift only (confidence: 100).

## OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — merges stale `.profraw` files, allowing false coverage passes; already tracked as f-20261002-09. This does not invalidate O5’s observed Stryker counts or scope-memory measurement.

VERDICT: APPROVED
```

</details>

<details><summary>lens-judgment-r9 (raw)</summary>

```text
No inspected drift change invalidates O1–O6 or the Phase 1/2 acceptance criteria (confidence: 96). Gate routing, sizing and measurement producers are unchanged; the engine repairs introduce no dependency on the planned launcher changes.

## OUT OF DRIFT SCOPE

tasks/plans/.plan-delta-plan-r9.diff:1 — Required verbatim r9 `ROUND/DELTA/REVISED/SETTLED` block is missing; formal re-review coverage cannot be confirmed from the unified diff alone (confidence: 100).

scripts/rust-branch-coverage.mjs:139 — Stale profiles can inflate backend coverage, already tracked by f-20261002-09; this does not invalidate O4/O5’s memory and runner-count observations.

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r9 (raw)</summary>

```text
No correctness defect in the drift invalidates O1–O6 or the Phase 1/2 proof and acceptance contracts.

Limitation: live scope placement, refusal behavior and resource measurements were not rerun in this read-only review (static assessment confidence: 95).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r9 (raw)</summary>

```text
The drift invalidates no O1–O6 obligation or Phase 1/2 failure-handling requirement.

## OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — stale `.profraw` files can mask a coverage regression and produce a successful gate result; already tracked as f-20261002-09.

VERDICT: APPROVED
```

</details>

<details><summary>lens-minimalism-r9 (raw)</summary>

```text
The drift invalidates no plan obligation within this lens. It introduces no bloat or duplication requiring changes to O1–O6 or their acceptance criteria. No files changed; no gates or tests run.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r9 (raw)</summary>

```text
The drift invalidates none of O1–O6’s verification obligations. Reverting the launcher routes fails the planned routing pins; regressing sizing to five runners fails Phase 2’s independent 21-runner assertion.

### OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — stale profiles can falsely satisfy coverage ratchets (already tracked as f-20261002-09); runtime sizing evidence remains independent.

VERDICT: APPROVED
```

</details>

<details><summary>lens-chess-semantics-r9 (raw)</summary>

```text
NOT APPLICABLE: O1–O6 concern gate launching, worker sizing and measurement. The drift changes engine-binary retirement, download validation, bindings and records; it changes no in-memory chess tree, position identity, move path or parity logic.

VERDICT: APPROVED
```

</details>

<details><summary>lens-engine-protocol-r9 (raw)</summary>

```text
No in-scope findings. The binary retirement/readmission drift does not invalidate O1–O6, the phase proof or acceptance criteria, or the traced premises within this lens.

VERDICT: APPROVED
```

</details>

<details><summary>lens-ipc-contract-r9 (raw)</summary>

```text
No IPC drift invalidates O1–O6 or either phase’s proof/acceptance criteria. `retire_engine_binary` remains Specta-registered; Rust, the generated invoke payload, facade and modal agree on `engine`, `retired` and `current`. The commit records binding regeneration. No events or capability scopes changed.

VERDICT: APPROVED
```

</details>

<details><summary>lens-persisted-state-r9 (raw)</summary>

```text
NOT APPLICABLE: O1–O6 concern gate tooling and process placement. The drift changes runtime engine retirement, archive validator typing and review records; it changes no renderer storage keys, serialization, hydration, atom families or tab lifecycle, and invalidates no plan obligation within this lens.
VERDICT: APPROVED
```

</details>

<details><summary>lens-pgn-index-r9 (raw)</summary>

```text
NOT APPLICABLE: Plan obligations O1–O6 concern gate launching, routing and resource sizing. The drift changes engine retirement, archive integrity validation and review records; no PGN scanning, indexing, encoding, storage or search path is affected.

VERDICT: APPROVED
```

</details>

<details><summary>lens-platform-semantics-r9 (raw)</summary>

```text
No platform-semantics finding in the drift invalidates O1–O6 or either phase’s proof. Gate routing, cgroup sizing and CI invocation paths remain unchanged; the launcher’s Linux-only scope remains explicit.

Read-only source review only: neither the non-Linux Unix source probe nor `pnpm rust:windows:check` was run. Windows/macOS runtime proof remains with `rust-windows-test` and `rust-macos-test`; `rust-platform` checks compilation and linting.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tauri-security-r9 (raw)</summary>

```text
No drift defect in this lens invalidates O1–O6 or Phase 1/2 acceptance.

The boxed validator still enforces signature verification before transport (`src-tauri/src/fs.rs:1322`) and digest comparison before extraction (`src-tauri/src/fs.rs:579`). Retirement changes carry opaque handles only.

Credentials and session persistence are unchanged. Review was read-only; no tests or gates ran, and the worktree remains clean.

VERDICT: APPROVED
```

</details>

Arbiter notes (no issue opened; no prefixed finding exists in this round):

* **Drift verdict:** the plan stands unchanged. Probe: the body (everything before `## Reviews`) of the current plan is byte-identical to the r7 and r8 snapshots (`python3` comparison, `True`/`True`); `plan-review-delta.py --round 9` lists only the appended `## Review summary` history section as REVISED.
* **Out of drift scope, already tracked:** error-handling, judgment, plan and tests name `scripts/rust-branch-coverage.mjs:139` (stale `.profraw` merge inflating local backend coverage). That is `f-20261002-09`, filed inside the drift itself; not re-filed. Lenses agree it does not affect M's memory and runner-count evidence. Implementation note for Phase 2: M's `rust-coverage` lane green is not evidence about coverage while `f-20261002-09` is open; M only records memory, OOM and Stryker figures.
* **Packet omission (disclosed):** the r9 prompts named the delta file but did not paste the `ROUND/DELTA/REVISED/SETTLED` stdout block (plan and judgment report it as an input limitation). No reviewer judgment depended on it: the plan body is byte-identical to the reviewed revision r7, the block's only REVISED heading is the history summary, and the drift round's required inputs (both SHAs and the drift file) were present in every prompt.

### Round 10 (r10, 218 s wall, closure round after the publication validator's `plan-changed-after-review` rejection: review-plan)

Cause: after the r9 snapshot the orchestrator rewrote the top-level `## Review summary` history section. It sat outside `## Reviews`, so `plan-review-delta.py` counted the edit as a plan revision against `plan-r9.md`. Correction (r10): the section is now `### Review summary` inside `## Reviews`, so history edits no longer touch the reviewed body. Delta r9 → r10: REVISED none; the only diff is the history section leaving the body. No obligation, phase, proof, acceptance criterion, decision or premise changed.

Raw verdict: review-plan APPROVED; no prefixed finding.

<details><summary>lens-plan-r10 (raw)</summary>

```text
r10 correction verified: the saved r9 and r10 text before `## Reviews` is byte-identical. The history summary now sits inside `## Reviews` at `tasks/plans/plan.md:1146`. No obligation, proof or acceptance criterion changed (confidence: 100).

No NEW-BASE drift invalidates O1–O6 or either phase’s proof/acceptance criteria against MANDATE (confidence: 95).

Limitation: live launcher behavior and memory figures were checked against source and supplied evidence; no gates or measurements were run under the read-only rails (confidence: 100).

## OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — merges stale `.profraw` files, allowing false coverage passes; already tracked as f-20261002-09.

VERDICT: APPROVED
```

</details>

Arbiter notes: no issue opened. The out-of-drift-scope item is `f-20261002-09` again (already tracked; not re-filed).

### Review summary (plan review closed 2026-10-02; refreshed against 84e697e9 in r9, closure r10)

* Rounds: 10 completed (r8 an evidence-only closure check at revision r7; r9 the PLAN-REFRESH drift round a580b504 → 84e697e9 at the same revision, 13 lenses, all APPROVED, no finding; r10 a review-plan closure round after the history section was moved under `## Reviews`, APPROVED). Wall time per round (s): r1 467 · r2 487 · r3 548 · r4 507 · r5 1114 · r6 586 · r7 709 + 367 (first-look coverage) · r8 506 · r9 281 · r10 218 — ≈ 1 h 43 min of review wall time; orchestrator probing and triage between rounds not included.
* `plan_adopted_per_round`: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1 r7=0 r8=0 r9=0 r10=0.
* Unique issues: 22 (R1-01..R1-06, R2-01, R2-02, R3-01, R3-02, R4-01..R4-04, J-1, R5-01..R5-03, R6-01, R7-01, R7-02, R8-01). Fix 18 (17 closed by their witness lenses, R1-05 arbiter-closed nit), Skip 4 (R1-04, R7-01, R7-02, R8-01), Defer 0. Withdrawn mechanisms: the RSS sampler (R3-01, R3-02 closed then withdrawn), the M1/M2 split and reserve resizing (R4-04), `tee` capture (R4-02). Open plan-level issues: 0.
* Lineage escalation: R1-01/R1-02 → R2-01 failed closure twice (r2, r3) → source trace + probes + focused fresh-context `review-plan` judgment (r4), which re-scoped the measurement to one in-lock run; the non-convergence comparison restarted at r4 (r4=4, r5=3, r6=1, r7=0, r8=0, r9=0, r10=0).
* Correction-introduced defects: R2-01 (from the R1-01/R1-02 corrections), R2-02 (from the R1-06 sampler), R3-01/R3-02 (sampler), R4-01 (from R1-03), R4-02/R4-03 (from R2-01's collection), R5-01..R5-03 and R6-01 (from J-1's single-measurement wrapper), R7-01 (from R6-01).
* Lens provenance: every lens and probe ran as a Codex leaf (OpenAI high tier for `review-plan` and the judgment, low tier at max for the others); the orchestrator (Claude Code, Opus 5.5) wrote the plan, ran every probe and arbitrated — disclosed.


## Evidence

### Manifest

[
  {
    "artefact": "lens-chess-semantics-r7.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r7.prompt",
    "report": "lens-chess-semantics-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)"
      }
    ],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r1.prompt",
    "report": "lens-correctness-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-correctness-r2.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)"
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)"
      }
    ],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r2.prompt",
    "report": "lens-correctness-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
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
    "artefact": "lens-correctness-r8.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r8.prompt",
    "report": "lens-correctness-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r7.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r7.prompt",
    "report": "lens-engine-protocol-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r1.prompt",
    "report": "lens-error-handling-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-error-handling-r2.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95)."
      },
      {
        "kind": "blocker",
        "text": "`tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit \"$rc\"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)"
      },
      {
        "kind": "should-fix",
        "text": "`tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r2.prompt",
    "report": "lens-error-handling-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-error-handling-r3.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> \"$samples\"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r3.prompt",
    "report": "lens-error-handling-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-error-handling-r4.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution."
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r4.prompt",
    "report": "lens-error-handling-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-error-handling-r5.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:235 — `!` also turns fatal `git grep` errors into exit 0. The diagnostic remains visible, but a proof consumer checking only the exit status can treat an incomplete scan as success. (confidence: 91)"
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:265 — If `cut` cannot read `/proc/loadavg`, the wrapper prints an empty `loadavg=` field but never marks the evidence invalid; the enclosing `echo` succeeds, and acceptance does not require that field. Measurement M can therefore exit 0 without the load-at-start value O5 requires. (confidence: 95)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r5.prompt",
    "report": "lens-error-handling-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-error-handling-r6.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:270 — If the sizing probe fails, `2>&1` captures its diagnostic and `|| expected=` discards it. The caller gets only `expected=unavailable` and `INVALID — missing evidence: expected-sizing`, hiding the cause needed to fix the measurement (confidence: 96)."
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r6.prompt",
    "report": "lens-error-handling-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r8.jsonl",
    "findings": [
      {
        "kind": "nit",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:250 — Runtime probes were supplied and the failure paths were source-traced, but they were not independently rerun under the read-only rails (confidence: 99)."
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r8.prompt",
    "report": "lens-error-handling-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r7.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r7.prompt",
    "report": "lens-ipc-contract-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-judgment-r4.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)"
      }
    ],
    "lens": "judgment",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-judgment-r4.prompt",
    "report": "lens-judgment-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-judgment-r8.jsonl",
    "findings": [
      {
        "kind": "nit",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:291 — Verification limitation: measurement M and live routing proofs were not independently executed under the read-only rails. Closure verifies the corrected plan against inspected source and supplied probes; implementation acceptance still requires M (confidence: 90)."
      }
    ],
    "lens": "judgment",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-judgment-r8.prompt",
    "report": "lens-judgment-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r1.jsonl",
    "findings": [
      {
        "kind": "nit",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)"
      }
    ],
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
    "artefact": "lens-minimalism-r5.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r5.prompt",
    "report": "lens-minimalism-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r7.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r7.prompt",
    "report": "lens-persisted-state-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r7.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r7.prompt",
    "report": "lens-pgn-index-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)"
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)"
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)"
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
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r2.prompt",
    "report": "lens-plan-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r3.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r3.prompt",
    "report": "lens-plan-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r4.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r4.prompt",
    "report": "lens-plan-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r5.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r5.prompt",
    "report": "lens-plan-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r6.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r6.prompt",
    "report": "lens-plan-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r7.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r7.prompt",
    "report": "lens-plan-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r8.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r8.prompt",
    "report": "lens-plan-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r7.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:70 — On macOS and Windows, the proposed `pnpm gate:run frontend-build` and `gate:ensure` scripts require the Linux `agent-gate`, which depends on `/proc` and `systemd-run`; they fail before the currently direct Node receipt runner starts (`package.json:26-27`, tuxedo-config `agent-run:214,559-575`). CI’s `gates:contract:check` only checks routing text, so it does not prove those commands work on either platform. (confidence: 98)"
      }
    ],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r7.prompt",
    "report": "lens-platform-semantics-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tauri-security-r7.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r7.prompt",
    "report": "lens-tauri-security-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r1.prompt",
    "report": "lens-tests-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r2.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran."
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r2.prompt",
    "report": "lens-tests-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r3.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r3.prompt",
    "report": "lens-tests-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r4.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r4.prompt",
    "report": "lens-tests-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r5.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "`tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:290` — M accepts any `Creating <N>` line and records its value, but never checks that N follows rule (b) for the measured scope. A regression that leaves Stryker at the conservative five-runner count despite a readable 27 GiB budget would still satisfy the log, peak-memory, and OOM checks. Require comparison with the count computed from the measured scope, or capture and validate the reason for an allowed fallback. (confidence: 89)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r5.prompt",
    "report": "lens-tests-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r6.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "R5-01 NOT CLOSED — the expected count comes from the sizing implementation under review, so a regression can make both expected and observed counts five."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:299 — M checks only that observed runners equal the count computed by `gate-parallelism.mjs`; it never requires that the computed budget reflect the readable gate scope or that the measured 27-GiB budget yields 21 runners. If sizing regresses to five for that budget, expected and observed can both be five and the overlap check still passes. The existing tests pin five at 7 GiB and eight at 90 GiB, but not this scope’s 27-GiB case. Assert the scope-derived budget/count independently, or add a regression anchor for this budget. (confidence: 96)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r6.prompt",
    "report": "lens-tests-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r7.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271 — The new sizing-probe diagnostic has no planned regression assertion. Measurement M runs from the repository root, where the import succeeds; reverting this hunk to `|| expected=` would leave the planned commands green. The outside-`scripts/` probe is only a historical result at lines 255–258. Add a runnable negative probe that asserts the diagnostic and exit 4. (confidence: 93)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r7.prompt",
    "report": "lens-tests-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r8.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r8.prompt",
    "report": "lens-tests-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r9.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r9.prompt",
    "report": "lens-chess-semantics-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r9.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r9.prompt",
    "report": "lens-correctness-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r9.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r9.prompt",
    "report": "lens-engine-protocol-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r9.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r9.prompt",
    "report": "lens-error-handling-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r9.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r9.prompt",
    "report": "lens-ipc-contract-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-judgment-r9.jsonl",
    "findings": [],
    "lens": "judgment",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-judgment-r9.prompt",
    "report": "lens-judgment-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r9.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r9.prompt",
    "report": "lens-minimalism-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r9.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r9.prompt",
    "report": "lens-persisted-state-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r9.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r9.prompt",
    "report": "lens-pgn-index-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r10.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r10.prompt",
    "report": "lens-plan-r10.txt",
    "round": 10,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r9.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r9.prompt",
    "report": "lens-plan-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r9.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r9.prompt",
    "report": "lens-platform-semantics-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r9.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r9.prompt",
    "report": "lens-tauri-security-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r9.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r9.prompt",
    "report": "lens-tests-r9.txt",
    "round": 9,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "M2 could reuse valid receipts and skip the measured workloads",
    "closed_round": 2,
    "correction": "Measurement runs first on the fresh post-Phase-1 tree; every receipt lane log must show `gate receipt miss:`",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R1-01",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "The runner count was never observed",
    "closed_round": 3,
    "correction": "Observed `Creating <N> test runner process(es)` per package, intervals from first timestamp to `Done in`",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R1-02",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 1
      },
      {
        "index": 1,
        "lens": "correctness",
        "round": 2
      }
    ]
  },
  {
    "claim": "Absence grep for `heavy-gate` contradicted the required `heavy-gate.lock` prose",
    "closed_round": 2,
    "correction": "Grep narrowed to retired names",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R1-03",
    "witnesses": [
      {
        "index": 3,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 1,
        "lens": "correctness",
        "round": 1
      }
    ]
  },
  {
    "claim": "Phases overlap files; consolidate into one phase",
    "dependencies": [],
    "disposition": "Skip",
    "id": "R1-04",
    "reason": "Real dependency: the measurement needs Phase 1's committed route (rule 4a); each phase ends green",
    "witnesses": [
      {
        "index": 4,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "Phase proofs repeated checks the contract gate runs",
    "closed_round": "arbiter",
    "correction": "Redundant proof lines removed",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R1-05",
    "reason": "nit-only witness; proof semantics unchanged",
    "witnesses": [
      {
        "index": 1,
        "lens": "minimalism",
        "round": 1
      }
    ]
  },
  {
    "claim": "RSS sampler failure accepted silently",
    "closed_round": 3,
    "correction": "Hardened sampler with INVALID/REFUSED exits (later withdrawn with the sampler under J-1)",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R1-06",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 1
      },
      {
        "index": 1,
        "lens": "error-handling",
        "round": 2
      },
      {
        "index": 2,
        "lens": "error-handling",
        "round": 2
      }
    ]
  },
  {
    "claim": "Measurement evidence not attributable to the measured run (layouts, lock, stale destinations)",
    "closed_round": 8,
    "correction": "All evidence collected inside the measuring scope into a fresh mktemp directory; acceptance reads only the printed directory",
    "dependencies": [
      "R1-01",
      "R1-02"
    ],
    "disposition": "Fix",
    "id": "R2-01",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 2
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 2
      },
      {
        "index": 2,
        "lens": "correctness",
        "round": 2
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 3
      },
      {
        "index": 1,
        "lens": "judgment",
        "round": 4
      }
    ]
  },
  {
    "claim": "Sampler could outlive a killed measuring shell holding the lock fd",
    "closed_round": 3,
    "correction": "Sampler closed fd 9 and exited with its parent",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R2-02",
    "reason": "sampler removed by the r4 focused judgment (J-1)",
    "withdrawn": true,
    "witnesses": [
      {
        "index": 3,
        "lens": "error-handling",
        "round": 2
      }
    ]
  },
  {
    "claim": "Sampler accepted 0 RSS when its selector stopped matching",
    "closed_round": 4,
    "correction": "Per-sample matched count",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R3-01",
    "reason": "sampler removed by the r4 focused judgment (J-1)",
    "withdrawn": true,
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 3
      }
    ]
  },
  {
    "claim": "Later sample-append failure unchecked",
    "closed_round": 4,
    "correction": "Sampler exit detection",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R3-02",
    "reason": "sampler removed by the r4 focused judgment (J-1)",
    "withdrawn": true,
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 3
      }
    ]
  },
  {
    "claim": "`git grep` exits 1 on no match, so the absence proof failed on the clean state",
    "closed_round": 5,
    "correction": "Proof accepts exactly exit status 1",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R4-01",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 4
      }
    ]
  },
  {
    "claim": "tee failure could let a stale summary be parsed",
    "closed_round": 5,
    "correction": "tee removed; output redirected into the fresh evidence directory",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R4-02",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 4
      }
    ]
  },
  {
    "claim": "memory.max read unchecked",
    "closed_round": 5,
    "correction": "memory.max joins the evidence guard",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R4-03",
    "witnesses": [
      {
        "index": 2,
        "lens": "error-handling",
        "round": 4
      }
    ]
  },
  {
    "claim": "A reserve raised after M2 would invalidate M1",
    "closed_round": 5,
    "correction": "Mechanism withdrawn: no resizing, single measurement",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R4-04",
    "reason": "reserve resizing and the M1/M2 split removed by J-1",
    "withdrawn": true,
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 4
      }
    ]
  },
  {
    "claim": "Isolated RSS profiler and reserve resizing exceeded MANDATE",
    "closed_round": 8,
    "correction": "Sampler and resizing removed; reserve unchanged with a named shared-process reason validated by the whole-gate peak/OOM; one measurement M",
    "dependencies": [],
    "disposition": "Fix",
    "id": "J-1",
    "witnesses": [
      {
        "index": 2,
        "lens": "judgment",
        "round": 4
      }
    ]
  },
  {
    "claim": "Observed runner count was not checked against rule (b) sizing independently",
    "closed_round": 7,
    "correction": "In-scope expected sizing printed; acceptance also checks it against independent scope arithmetic (budget 28991029248, 21 runners on atlas)",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R5-01",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 5
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 6
      },
      {
        "index": 2,
        "lens": "tests",
        "round": 6
      }
    ]
  },
  {
    "claim": "`! git grep` hid fatal errors",
    "closed_round": 6,
    "correction": "Proof accepts exactly exit 1",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R5-02",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 5
      }
    ]
  },
  {
    "claim": "Unreadable /proc/loadavg not guarded",
    "closed_round": 6,
    "correction": "loadavg joins the evidence guard",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R5-03",
    "witnesses": [
      {
        "index": 2,
        "lens": "error-handling",
        "round": 5
      }
    ]
  },
  {
    "claim": "Failed sizing probe's diagnostic was discarded",
    "closed_round": 8,
    "correction": "Diagnostic printed before the field is cleared",
    "dependencies": [],
    "disposition": "Fix",
    "id": "R6-01",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 6
      }
    ]
  },
  {
    "claim": "No regression assertion for the one-off wrapper's diagnostic hunk",
    "dependencies": [],
    "disposition": "Skip",
    "id": "R7-01",
    "reason": "One-off scratch measurement, never committed; failure paths probed in this run; r4 focused judgment rules shipped-software verification of it outside MANDATE",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 7
      }
    ]
  },
  {
    "claim": "gate:ensure/gate:run would fail on macOS/Windows",
    "dependencies": [],
    "disposition": "Skip",
    "id": "R7-02",
    "reason": "Outside the frozen threat model's environments (local Linux with agent-gate); CI never runs the wrapped scripts; gate-performance (c) requires failing without the launcher",
    "witnesses": [
      {
        "index": 1,
        "lens": "platform-semantics",
        "round": 7
      }
    ]
  },
  {
    "claim": "Lenses did not execute measurement M or the live proofs",
    "dependencies": [],
    "disposition": "Skip",
    "id": "R8-01",
    "reason": "Read-only lens rails by contract; implementation acceptance executes M",
    "witnesses": [
      {
        "index": 1,
        "lens": "judgment",
        "round": 8
      },
      {
        "index": 1,
        "lens": "error-handling",
        "round": 8
      }
    ]
  }
]

### delta-r10.txt

ROUND: 10
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/.plan-delta-plan-r10.diff
REVISED:
(none)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)

### delta-r2.txt

ROUND: 2
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r2.diff
REVISED:
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases

### delta-r3.txt

ROUND: 3
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r3.diff
REVISED:
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

### delta-r4.txt

ROUND: 4
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r4.diff
REVISED:
## Risks / open questions
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Not part of this task
## Phases
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

### delta-r5.txt

ROUND: 5
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r5.diff
REVISED:
## Traced premises
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O6 — Prose describes the launcher that actually runs
## Not part of this task
## Phases

### delta-r6.txt

ROUND: 6
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r6.diff
REVISED:
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases

### delta-r7.txt

ROUND: 7
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r7.diff
REVISED:
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

### delta-r8.txt

UNCHANGED

### lens-chess-semantics-r7.txt

NOT APPLICABLE: The plan changes gate tooling, scripts, and documentation; none of its obligations touch an in-memory chess tree, position, or move path.

VERDICT: APPROVED
### lens-chess-semantics-r9.txt

NOT APPLICABLE: O1–O6 concern gate launching, worker sizing and measurement. The drift changes engine-binary retirement, download validation, bindings and records; it changes no in-memory chess tree, position identity, move path or parity logic.

VERDICT: APPROVED
### lens-correctness-r1.txt

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
### lens-correctness-r2.txt

R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
### lens-correctness-r3.txt

R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
### lens-correctness-r8.txt

R2-01 CLOSED — each attempt creates a fresh evidence directory, prints its path, and acceptance reads only that directory. The wrapper copies scheduler and mutation logs before the lock-held scope ends; the supplied probes confirm collection and gate-status handling.

LATE OBSERVATIONS

None.

VERDICT: APPROVED
### lens-correctness-r9.txt

No correctness defect in the drift invalidates O1–O6 or the Phase 1/2 proof and acceptance contracts.

Limitation: live scope placement, refusal behavior and resource measurements were not rerun in this read-only review (static assessment confidence: 95).

VERDICT: APPROVED
### lens-engine-protocol-r7.txt

NOT APPLICABLE: The plan’s obligations concern gate scheduling, process placement, and documentation; none touch UCI engine supervision, protocol handling, or result routing.

VERDICT: APPROVED
### lens-engine-protocol-r9.txt

No in-scope findings. The binary retirement/readmission drift does not invalidate O1–O6, the phase proof or acceptance criteria, or the traced premises within this lens.

VERDICT: APPROVED
### lens-error-handling-r1.txt

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
### lens-error-handling-r2.txt

[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
### lens-error-handling-r3.txt

R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
### lens-error-handling-r4.txt

R2-01 CLOSED — M2 copies the scheduler’s own log directory and M1 copies the mutation logs inside the lock-held scope (plan lines 243–245, 293–306; producers at `run-push-gates.mjs:941–943` and `run-frontend-mutation.mjs:310–312`).

R3-01 CLOSED — samples record both process rows and selector matches; either zero marks the sample failed. The supplied no-node probe returned `INVALID` (plan lines 263–269, 283; probe at 247–250).

R3-02 CLOSED — append failure exits the sampler, and an already-ended sampler makes the wrapper emit `INVALID`; the supplied read-only-mid-run probe returned exit 4 (plan lines 274–288; probe at 250).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)

VERDICT: REVISE
### lens-error-handling-r5.txt

R2-01 CLOSED — each attempt creates a fresh evidence directory, and acceptance reads only the printed path; the supplied probe confirms collection.

J-1 CLOSED — the sampler and reserve resizing are removed; the reserve stays fixed with a named shared-process reason, checked against whole-gate memory and OOM evidence.

R4-01 CLOSED — `! git grep` makes the no-match case exit 0 with no match output.

R4-02 CLOSED — output goes directly to `gate.out` in the fresh directory; missing scheduler logs mark evidence invalid.

R4-03 CLOSED — a failed `memory.max` read leaves the value empty and triggers the evidence guard.

R4-04 CLOSED — there is no reserve adjustment or separate M1 measurement.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:235 — `!` also turns fatal `git grep` errors into exit 0. The diagnostic remains visible, but a proof consumer checking only the exit status can treat an incomplete scan as success. (confidence: 91)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:265 — If `cut` cannot read `/proc/loadavg`, the wrapper prints an empty `loadavg=` field but never marks the evidence invalid; the enclosing `echo` succeeds, and acceptance does not require that field. Measurement M can therefore exit 0 without the load-at-start value O5 requires. (confidence: 95)

VERDICT: REVISE
### lens-error-handling-r6.txt

R5-01 CLOSED — Phase 2 compares each observed runner count and package overlap with its in-scope sizing; the scheduler gives sequential mutation the full budget and CPU share 1 (`run-push-gates.mjs:921-931`).

R5-02 CLOSED — The measured no-match status is 1 and fatal status is 128; `[ $? -eq 1 ]` accepts only the no-match case.

R5-03 CLOSED — An unreadable or empty loadavg leaves `load` empty, which marks evidence invalid and returns 4 if the gate itself succeeds.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:270 — If the sizing probe fails, `2>&1` captures its diagnostic and `|| expected=` discards it. The caller gets only `expected=unavailable` and `INVALID — missing evidence: expected-sizing`, hiding the cause needed to fix the measurement (confidence: 96).

VERDICT: APPROVED
### lens-error-handling-r8.txt

R6-01 CLOSED — r7 prints the sizing probe’s diagnostic before clearing `expected`, then marks the missing sizing evidence invalid and exits 4 on a green gate; the supplied probe confirms this outcome (plan lines 271, 280, 287; 255–258).

LATE OBSERVATIONS

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:250 — Runtime probes were supplied and the failure paths were source-traced, but they were not independently rerun under the read-only rails (confidence: 99).

VERDICT: APPROVED
### lens-error-handling-r9.txt

The drift invalidates no O1–O6 obligation or Phase 1/2 failure-handling requirement.

## OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — stale `.profraw` files can mask a coverage regression and produce a successful gate result; already tracked as f-20261002-09.

VERDICT: APPROVED
### lens-ipc-contract-r7.txt

NOT APPLICABLE: The plan’s obligations cover gate scripts, package routing, worker sizing, and documentation. Its phases explicitly exclude IPC/API contracts, and no Rust or renderer contract files are in scope.
VERDICT: APPROVED
### lens-ipc-contract-r9.txt

No IPC drift invalidates O1–O6 or either phase’s proof/acceptance criteria. `retire_engine_binary` remains Specta-registered; Rust, the generated invoke payload, facade and modal agree on `engine`, `retired` and `current`. The commit records binding regeneration. No events or capability scopes changed.

VERDICT: APPROVED
### lens-judgment-r4.txt

JUDGMENT: r4 fixes the original concurrent-copy race: M2 identifies the scheduler’s own directory, and both collectors copy before releasing the lock (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:312`; launcher `agent-run:584`). R3-01 and R3-02 are CLOSED against r4: the matched-process check and append/liveness guards address their reported failures, supported by the supplied probes. R2-01 remains open because retrying with an existing destination can leave acceptance reading the previous attempt’s logs. The simplest sufficient mechanism is one fresh all-blocks measurement, collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM evidence inside the held lock into a fresh directory per attempt. The RSS sampler is unnecessary for MANDATE: rule (b) requires measured worker sizing and a recorded reason; the unchanged reserve can name the shared scheduler/receipt processes and be validated through the complete gate’s memory result. Existing producer logs supply runner evidence, though they do not supply isolated overhead RSS. Review should follow obligation scope and ordinary accidental failures; treating this scratch measurement as shipped monitoring software would exceed that scope. Limitation: the complete measurement was not independently executed under the read-only rails; conclusions rely on source and supplied probes (confidence: 90).

OBLIGATION CHANGES:

- Require fresh evidence paths for every measurement attempt; acceptance must inspect that attempt’s paths.
- Remove mandatory isolated-RSS measurement and automatic reserve resizing. Retain the unchanged allowance with an accurate shared-process rationale and whole-gate validation.
- Collect runner counts and intervals during M2; a second full mutation run is unnecessary for the mandated remeasurement.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)

VERDICT: REVISE
### lens-judgment-r8.txt

R2-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:267` creates fresh evidence per attempt; `:283–285` copies the scheduler’s emitted directory and package-preserving mutation tree inside the measuring scope; `:294` restricts acceptance to the printed evidence directory. Producer paths match `scripts/run-push-gates.mjs:943` and `scripts/run-frontend-mutation.mjs:258`; launcher ownership is supported by `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:584–620` and supplied scope probes (confidence: 97).

J-1 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:109–121` retains the unchanged reserve with a named shared-process reason; `:291–317` uses one whole-gate measurement to require peak memory below the cap and zero OOM kills. Isolated RSS sampling and conditional resizing are removed. This matches `/home/felixb/.claude/references/gate-performance.md:10–14`; existing sizing subtracts the reserve at `scripts/gate-parallelism.mjs:191` (confidence: 97).

LATE OBSERVATIONS

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:291 — Verification limitation: measurement M and live routing proofs were not independently executed under the read-only rails. Closure verifies the corrected plan against inspected source and supplied probes; implementation acceptance still requires M (confidence: 90).

VERDICT: APPROVED
### lens-judgment-r9.txt

No inspected drift change invalidates O1–O6 or the Phase 1/2 acceptance criteria (confidence: 96). Gate routing, sizing and measurement producers are unchanged; the engine repairs introduce no dependency on the planned launcher changes.

## OUT OF DRIFT SCOPE

tasks/plans/.plan-delta-plan-r9.diff:1 — Required verbatim r9 `ROUND/DELTA/REVISED/SETTLED` block is missing; formal re-review coverage cannot be confirmed from the unified diff alone (confidence: 100).

scripts/rust-branch-coverage.mjs:139 — Stale profiles can inflate backend coverage, already tracked by f-20261002-09; this does not invalidate O4/O5’s memory and runner-count observations.

VERDICT: APPROVED
### lens-minimalism-r1.txt

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
### lens-minimalism-r5.txt

R2-01 CLOSED — plan:247–250,282–285 uses a fresh evidence directory per attempt and reads only the printed directory.
J-1 CLOSED — plan:109–121,125–132 removes RSS sampling and reserve resizing; one whole-gate measurement validates the unchanged reserve.
R4-01 CLOSED — plan:235 negates `git grep` so no matches pass.
R4-02 CLOSED — plan:267 redirects output to the fresh `gate.out`; no `tee` or stale summary path remains.
R4-03 CLOSED — plan:264,271–273 checks `memory.max` and rejects missing cgroup evidence.
R4-04 CLOSED — plan:109–121,125–128 keeps the reserve fixed and uses one measurement; no separate M1 remains.
VERDICT: APPROVED
### lens-minimalism-r9.txt

The drift invalidates no plan obligation within this lens. It introduces no bloat or duplication requiring changes to O1–O6 or their acceptance criteria. No files changed; no gates or tests run.

VERDICT: APPROVED
### lens-persisted-state-r7.txt

NOT APPLICABLE: The plan covers gate scripts, package routing, and documentation; it does not touch renderer persistence, storage keys, or tab lifecycle.
VERDICT: APPROVED
### lens-persisted-state-r9.txt

NOT APPLICABLE: O1–O6 concern gate tooling and process placement. The drift changes runtime engine retirement, archive validator typing and review records; it changes no renderer storage keys, serialization, hydration, atom families or tab lifecycle, and invalidates no plan obligation within this lens.
VERDICT: APPROVED
### lens-pgn-index-r7.txt

NOT APPLICABLE: The plan changes gate launch, worker sizing, routing checks, and related documentation; it does not affect PGN scanning, indexing, encoding, storage, or search.

VERDICT: APPROVED
### lens-pgn-index-r9.txt

NOT APPLICABLE: Plan obligations O1–O6 concern gate launching, routing and resource sizing. The drift changes engine retirement, archive integrity validation and review records; no PGN scanning, indexing, encoding, storage or search path is affected.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
### lens-plan-r10.txt

r10 correction verified: the saved r9 and r10 text before `## Reviews` is byte-identical. The history summary now sits inside `## Reviews` at `tasks/plans/plan.md:1146`. No obligation, proof or acceptance criterion changed (confidence: 100).

No NEW-BASE drift invalidates O1–O6 or either phase’s proof/acceptance criteria against MANDATE (confidence: 95).

Limitation: live launcher behavior and memory figures were checked against source and supplied evidence; no gates or measurements were run under the read-only rails (confidence: 100).

## OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — merges stale `.profraw` files, allowing false coverage passes; already tracked as f-20261002-09.

VERDICT: APPROVED
### lens-plan-r2.txt

R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
### lens-plan-r3.txt

R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
### lens-plan-r4.txt

R2-01 CLOSED — r4 plan:304–306 selects the scheduler’s emitted log directory; plan:323 preserves mutation logs before scope exit. Producers match these paths (`scripts/run-push-gates.mjs:610–620,943`; `scripts/run-frontend-mutation.mjs:310–312`), and the launcher retains the lock across both copies (`agent-run:584–620`). Supplied probes cover copying and failure propagation.

R3-01 CLOSED — r4 plan:269,283–286 records matched-process counts and rejects zero matches. The supplied real-scope probes distinguish a running node process from no node/pnpm processes.

R3-02 CLOSED — r4 plan:276,281–286 exits the sampler on append failure and rejects premature termination. The supplied mid-run permission probe confirms `sampler_alive=0`, `INVALID`, exit 4.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)

VERDICT: REVISE
### lens-plan-r5.txt

R2-01 CLOSED — r5 plan:263,275–276,284–285 creates fresh destinations and restricts acceptance to this attempt’s directory. Copies match the producers’ layouts (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`) and occur inside the held lock.

J-1 CLOSED — r5 plan:109–121,282–299 removes isolated RSS sampling and reserve resizing. One measurement records observed runners and validates the unchanged reserve; `gate-performance.md:10–12` permits the named shared-resource rationale.

R4-01 CLOSED — r5 plan:235 negates the absence scan, making the supplied no-match exit status of 1 satisfy the proof.

R4-02 CLOSED — r5 plan:263,267,274 removes `tee` and parses output redirected into the fresh directory. The quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:7,11,18`.

R4-03 CLOSED — r5 plan:264,271,278 includes unreadable `memory.max` in the invalid-evidence guard; the supplied correction probe confirms exit 4.

R4-04 CLOSED — r5 plan:109,296–299 keeps the reserve unchanged and records one measurement. The post-measurement budget change that invalidated runner figures (`scripts/gate-parallelism.mjs:191`) is withdrawn.

LATE OBSERVATIONS

Limitation — Live scope behaviour and full measurement M were not independently executed under the read-only rails; closure relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
### lens-plan-r6.txt

R5-01 CLOSED — r6 plan:270,298–302 computes expected sizing inside the scope and requires matching observed runners and bounded overlap. The sequential lane passes that budget with CPU share 1 (`scripts/run-push-gates.mjs:921–932`); package sizing and Stryker concurrency match (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Supplied probes confirm expected sizing and missing-source refusal.

R5-02 CLOSED — r6 plan:235 accepts only `git grep` status 1. The supplied measurements distinguish no match (1) from fatal error (128), so fatal errors no longer pass.

R5-03 CLOSED — r6 plan:268,278,286 clears a failed load read, marks missing load data invalid, and converts an otherwise successful measurement to exit 4. Acceptance at :294 rejects `INVALID`; the quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:9,19,28`.

LATE OBSERVATIONS

Limitation — Live launcher behavior and full measurement M were not independently executed under the read-only rails. Review relies on inspected source and supplied probes; relevant gate sources remain unchanged since HEAD 10643303 (confidence: 90).

VERDICT: APPROVED
### lens-plan-r7.txt

R5-01 CLOSED — r7 plan:304–308 independently requires budget 28991029248 and 21 runners, so expected and observed both regressing to five fails acceptance. Constants and worker arithmetic match `scripts/gate-parallelism.mjs:10,17,21,253–260`; sequential mutation receives the full budget and CPU share 1 (`scripts/run-push-gates.mjs:921–932`), which reaches Stryker concurrency (`stryker.config.mjs:41–45`).

LATE OBSERVATIONS

Limitation — Live launcher behavior and measurement M were not independently executed under the read-only rails; review relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
### lens-plan-r8.txt

R2-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:267,283–294` creates a fresh evidence directory, copies producer logs before scope exit, and restricts acceptance to the printed directory. Producer paths match (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`); supplied probes confirm collection and failure propagation.

J-1 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:109–121,291–313` removes isolated RSS sampling and conditional resizing. One measurement checks runners, peak memory and OOM events against the unchanged reserve (`scripts/gate-parallelism.mjs:10,191`), with the named shared-process reason permitted by `gate-performance.md:10–12`.

R6-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271` matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:11`: the diagnostic is printed before `expected` is cleared. The supplied missing-`scripts/` probe confirms the diagnostic followed by `INVALID` exit 4.

VERDICT: APPROVED
### lens-plan-r9.txt

No drift change invalidates O1–O6 or either phase’s proof/acceptance criteria (confidence: 95). The engine API changes do not affect gate routing, worker sizing or measurement producers.

Input limitation: the verbatim `ROUND/DELTA/REVISED/SETTLED` block was not supplied; this approval covers the supplied repository drift only (confidence: 100).

## OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — merges stale `.profraw` files, allowing false coverage passes; already tracked as f-20261002-09. This does not invalidate O5’s observed Stryker counts or scope-memory measurement.

VERDICT: APPROVED
### lens-platform-semantics-r7.txt

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:70 — On macOS and Windows, the proposed `pnpm gate:run frontend-build` and `gate:ensure` scripts require the Linux `agent-gate`, which depends on `/proc` and `systemd-run`; they fail before the currently direct Node receipt runner starts (`package.json:26-27`, tuxedo-config `agent-run:214,559-575`). CI’s `gates:contract:check` only checks routing text, so it does not prove those commands work on either platform. (confidence: 98)

VERDICT: REVISE
### lens-platform-semantics-r9.txt

No platform-semantics finding in the drift invalidates O1–O6 or either phase’s proof. Gate routing, cgroup sizing and CI invocation paths remain unchanged; the launcher’s Linux-only scope remains explicit.

Read-only source review only: neither the non-Linux Unix source probe nor `pnpm rust:windows:check` was run. Windows/macOS runtime proof remains with `rust-windows-test` and `rust-macos-test`; `rust-platform` checks compilation and linting.

VERDICT: APPROVED
### lens-tauri-security-r7.txt

NOT APPLICABLE: The plan changes gate scripts, package configuration, and documentation; its obligations do not touch credentials, filesystem authority, signed downloads, or backend-only data.

VERDICT: APPROVED
### lens-tauri-security-r9.txt

No drift defect in this lens invalidates O1–O6 or Phase 1/2 acceptance.

The boxed validator still enforces signature verification before transport (`src-tauri/src/fs.rs:1322`) and digest comparison before extraction (`src-tauri/src/fs.rs:579`). Retirement changes carry opaque handles only.

Credentials and session persistence are unchanged. Review was read-only; no tests or gates ran, and the worktree remains clean.

VERDICT: APPROVED
### lens-tests-r1.txt

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
### lens-tests-r2.txt

R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
### lens-tests-r3.txt

R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
### lens-tests-r4.txt

R3-01 CLOSED — The plan samples `<rows> <matched> <kib>`, rejects either zero count, and delays the first sample; the supplied probes report `INVALID` when no node/pnpm process matches and zero failed samples for a valid node process (plan lines 247–286).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)

VERDICT: REVISE
### lens-tests-r5.txt

R2-01 CLOSED — Each attempt gets a fresh `mktemp` evidence directory, and acceptance reads only the printed path; the supplied probes cover collection and an unusable root.

J-1 CLOSED — The sampler and reserve resizing are removed. The single whole-gate measurement checks peak memory and OOM events.

R4-01 CLOSED — The `! git grep` proof handles the no-match exit status and requires no output.

R4-02 CLOSED — `tee` and its reusable summary path are removed; output goes to the fresh evidence directory, and a missing scheduler-log line is rejected.

R4-03 CLOSED — Unreadable `memory.max` is marked invalid; the supplied cgroup-read probe exits 4.

R4-04 CLOSED — There is one measurement and no reserve resizing, so separate M1/M2 measurements cannot invalidate each other.

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:290` — M accepts any `Creating <N>` line and records its value, but never checks that N follows rule (b) for the measured scope. A regression that leaves Stryker at the conservative five-runner count despite a readable 27 GiB budget would still satisfy the log, peak-memory, and OOM checks. Require comparison with the count computed from the measured scope, or capture and validate the reason for an allowed fallback. (confidence: 89)

VERDICT: REVISE
### lens-tests-r6.txt

[blocker] R5-01 NOT CLOSED — the expected count comes from the sizing implementation under review, so a regression can make both expected and observed counts five.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:299 — M checks only that observed runners equal the count computed by `gate-parallelism.mjs`; it never requires that the computed budget reflect the readable gate scope or that the measured 27-GiB budget yields 21 runners. If sizing regresses to five for that budget, expected and observed can both be five and the overlap check still passes. The existing tests pin five at 7 GiB and eight at 90 GiB, but not this scope’s 27-GiB case. Assert the scope-derived budget/count independently, or add a regression anchor for this budget. (confidence: 96)

VERDICT: REVISE
### lens-tests-r7.txt

R5-01 CLOSED — r7 requires checking the probe against independent scope arithmetic: the recorded atlas inputs yield 21 runners, so a fallback to 5 fails even if expected and observed counts agree.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271 — The new sizing-probe diagnostic has no planned regression assertion. Measurement M runs from the repository root, where the import succeeds; reverting this hunk to `|| expected=` would leave the planned commands green. The outside-`scripts/` probe is only a historical result at lines 255–258. Add a runnable negative probe that asserts the diagnostic and exit 4. (confidence: 93)

VERDICT: APPROVED
### lens-tests-r8.txt

R2-01 CLOSED — Phase 2 creates a fresh evidence directory per attempt, collects both log trees before the measuring scope ends, and reads only the printed directory. The supplied probes cover collection, red exit propagation, invalid evidence, and refusal for an unusable root (plan:247–294).

VERDICT: APPROVED
### lens-tests-r9.txt

The drift invalidates none of O1–O6’s verification obligations. Reverting the launcher routes fails the planned routing pins; regressing sizing to five runners fails Phase 2’s independent 21-runner assertion.

### OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — stale profiles can falsely satisfy coverage ratchets (already tracked as f-20261002-09); runtime sizing evidence remains independent.

VERDICT: APPROVED
### plan-r1.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. The one-off measurement wrapper (`$RUN_TMP/measure-gate.sh`, quoted in Phase 2) ran in the scope and printed `memory.peak=331145216 oom 0 oom_kill 0 unsized_rss_max_kib=353312` for a 300 MiB node process.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES` (value stays 1 GiB unless the
  Phase 2 measurement exceeds it). Its comment states both places it applies: in a session scope
  (plain `vitest`), the agent process (0.32 GB measured 2026-09-29); in the gate scope, the scheduler,
  per-lane `pnpm` and `gate-receipt` parents and launcher Node processes that no worker count sizes,
  with the Phase 2 measured maximum. Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". Measurement M1: the full
three-package frontend mutation through the standalone receipt route inside one gate scope, recording
the chosen slots × runners (from `strykerSlots(gateBudgetBytes())` evaluated in the same scope),
duration, scope `memory.peak`, `memory.events` `oom_kill`, and load average at start. Measurement M2:
an all-blocks `pnpm gates:push -- --rust --frontend --bindings` inside one gate scope, recording
`memory.peak`, `oom_kill`, duration and the maximum summed RSS of unsized `node`/`pnpm` processes
(the O4 reserve evidence). Both are orchestrator one-off commands (Phase 2); their figures replace the
stale 8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and ground the O4
reserve comment. The decision record carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent.
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as orchestrator one-offs, no new log lines** (rule 6d): the wrapper in Phase 2 lives
  in `$RUN_TMP`, is never committed, and reads the scope's own cgroup files before the scope ends.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is M1/M2, which the f-20260930-03 closure note
and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 M2 measurement. **Rejected:** dropping the reserve (unsized processes share the scope's
   `MemoryMax`); keeping the name `AGENT_RESERVE_BYTES` (false inside the gate scope). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. M1/M2 measure whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Another session's gate holding the lock makes M1/M2 and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `pnpm gates:routing:test && pnpm gates:routing:check && pnpm gates:parallelism:test && pnpm gates:push:test && pnpm mutation:runner:test`
  2. `git -C /home/felixb/Projekte/chessfable grep -n -e heavy-gate -e chessfable-gate -e AGENT_RESERVE_BYTES -- ':!tasks'` prints nothing.
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.
  6. `pnpm gates:contract:check` (contract gate, includes the routing pins and the shortened chain).

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)

Depends on Phase 1 (the measurements exercise its route). Order: measurements by the orchestrator,
then one `mechanical` write leaf records the figures.

* Orchestrator one-off (never committed), saved as `$RUN_TMP/measure-gate.sh`:

  ```bash
  #!/usr/bin/env bash
  # One-off: run "$@" inside the current agent-gate scope; sample unsized node/pnpm RSS; print scope peak.
  set -u
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup$cg
  echo "measure: cgroup=$cg memory.max=$(cat "$d/memory.max")"
  sample() {
    local procs total
    procs=$(paste -sd, "$d/cgroup.procs")
    total=$(ps -o rss=,args= -p "$procs" 2>/dev/null | awk '($2 ~ /(^|\/)(node|pnpm)$/ || $2 ~ /pnpm/) && $0 !~ /stryker|vitest|tsgo|oxlint|cargo|rustc/ {s+=$1} END {print s+0}')
    echo "$total"
  }
  ( while :; do echo "$(sample)"; python3 -c 'import time; time.sleep(5)'; done ) > "${MEASURE_SAMPLES:?}" &
  sampler=$!
  start=$(date +%s)
  "$@"; rc=$?
  kill "$sampler" 2>/dev/null
  echo "measure: rc=$rc seconds=$(( $(date +%s) - start )) memory.peak=$(cat "$d/memory.peak") $(grep -E '^(oom|oom_kill) ' "$d/memory.events" | tr '\n' ' ') unsized_rss_max_kib=$(sort -n "$MEASURE_SAMPLES" | tail -1)"
  exit "$rc"
  ```

  * M1: `MEASURE_SAMPLES=$RUN_TMP/m1.samples agent-gate bash $RUN_TMP/measure-gate.sh bash -c 'cat /proc/loadavg; node --input-type=module -e "import(\"./scripts/gate-parallelism.mjs\").then(m => console.log(JSON.stringify(m.strykerSlots({budgetBytes: m.gateBudgetBytes(), packageCount: 3}))))" && pnpm gate:run frontend-mutation'` from the repo root (the inner `pnpm gate:run` runs in place inside the measuring scope).
  * M2: `MEASURE_SAMPLES=$RUN_TMP/m2.samples agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`.
  * Acceptance: both `rc=0`, `oom_kill 0`, `memory.peak` < `memory.max`. Any OOM kill or red lane stops the phase (no constant tuning; report to the orchestrator's decision step).
* Write leaf (`mechanical`): record M1/M2 verbatim figures in the `UNSIZED_PROCESS_RESERVE_BYTES`
  comment (gate-scope sentence, M2 `unsized_rss_max_kib`), `CLAUDE.md` frontend-mutation paragraph
  (`:96-100`) and push skill §2 frontend-mutation bullet (`:230`), replacing the 8 GiB / five-runner /
  397.5 s statements. If M2's unsized maximum exceeds 1 GiB, the reserve value is raised to the next
  0.25 GiB above it and `gate-parallelism-tests.mjs` follows (a measured reason, not a tuning).
* Proof: `pnpm gates:parallelism:test && pnpm gates:routing:check && pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`;
  f-20260930-03 closed through `./scripts/findings.py close` naming the commits and figures.

### plan-r10.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. An early one-off wrapper read the scope's `memory.peak` and `memory.events` from inside (`memory.peak=331145216 oom 0 oom_kill 0` for a 300 MiB node process); the current wrapper and its probes are quoted in Phase 2.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES`; its value stays 1 GiB. Its comment
  states both places it applies and why: in a session scope (plain `vitest`), the agent process
  (0.32 GB measured 2026-09-29); in the gate scope, the scheduler, per-lane `pnpm` and `gate-receipt`
  parents and launcher Node processes that no worker count sizes — a named shared-resource reason
  (gate-performance intro), validated by the Phase 2 whole-gate measurement (scope `memory.peak` below
  `memory.max`, zero OOM kills). Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". One measurement M: an all-blocks
`pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh post-Phase-1 tree,
so every receipt lane executes (each lane log shows `gate receipt miss:`) and frontend mutation runs as
the gate runs it (after P2, with the scope's budget). Recorded from the producers' own output: the
**observed** Stryker runner count per package (`Creating <N> test runner process(es)` in each package's
`stryker.log`), the observed package overlap (each log's first timestamped line to its
`MutationTestExecutor … Done in` line), lane durations, and from the scope: `memory.max`,
`memory.peak`, `memory.events` `oom`/`oom_kill`, load average at start. The figures replace the stale
8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and the decision record
carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent. Its gate-scope reason is a
  named shared resource validated by the whole-gate result; no isolated RSS profiler (focused
  judgment, round 4).
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as one orchestrator one-off, no new log lines** (rule 6d): the wrapper in Phase 2
  lives in `$RUN_TMP`, is never committed, and collects every piece of evidence into a fresh
  directory inside the measuring scope, before the scope and its lock end.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is the Phase 2 measurement M, which the f-20260930-03
closure note and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 whole-gate measurement (`memory.peak` below `memory.max`, zero OOM kills). **Rejected:**
   dropping the reserve (unsized processes share the scope's `MemoryMax`); keeping the name
   `AGENT_RESERVE_BYTES` (false inside the gate scope); an isolated RSS profile of those processes
   (not required by gate-performance (b), which accepts a named shared-resource reason). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. The Phase 2 measurement shows whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Resumed Codex write leaves have no user D-Bus (agent-kit `f-20261002-15`, measured 2026-10-02 in the
  Stockfish 19 build): every `agent-gate`-wrapped script — after this change also `gate:ensure` and
  `gate:run` — refuses with exit 125 there. Fix briefs report that refusal and continue; the
  orchestrator reruns `pnpm checks:pre-review` itself (it must anyway).
* Another session's gate holding the lock makes the measurement and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'; [ $? -eq 1 ]` succeeds and prints nothing (`git grep` exits 1 on no match and 128 on a fatal error — measured; only 1 passes; the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)

Depends on Phase 1 (the measurement exercises its committed route; nothing may record a receipt on the
post-Phase-1 tree before it). Order: the measurement by the orchestrator, then one `mechanical` write
leaf records the figures.

* Orchestrator one-off (never committed), `$RUN_TMP/measure-gate.sh`. It runs the gate inside the
  measuring scope and copies every piece of evidence into a fresh `mktemp -d` directory before the
  scope (and the heavy-gate lock) ends, so neither a retry nor another gate can supply stale or foreign
  evidence. Probed 2026-10-02 inside real `agent-gate` scopes with a stub producer: green → exit 0 with
  `gate.out`, `gate-logs`, `mutation-logs` collected; red → the gate's exit 3 passes through; no
  `Push gate logs:` line → `INVALID` exit 4; cgroup files unreadable (test hook
  `MEASURE_TEST_CGROUP=/nonexistent`) → `INVALID … memory.max memory.peak memory.events` exit 4;
  unusable `MEASURE_ROOT` → `REFUSED` exit 3; outside a gate scope → `REFUSED` exit 3. With the
  in-scope sizing line added (round 5): a real scope printed
  `expected={"budget":28991029248,"slots":1,"runnersPerPackage":21}`; run from a directory without
  `scripts/` → `measure: sizing probe failed: <node diagnostic>` and `INVALID — missing evidence:
  expected-sizing …` exit 4.

  ```bash
  #!/usr/bin/env bash
  # One-off: run the push gate ("$@") inside the current agent-gate scope and collect its evidence into a fresh
  # directory before the scope (and the heavy-gate lock) ends. Exit: the gate's status, or 3 refused, 4 invalid evidence.
  set -u
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  ev=$(mktemp -d "${MEASURE_ROOT:?MEASURE_ROOT must name a directory}/measure-XXXXXX") || { echo "measure: REFUSED — cannot create an evidence directory" >&2; exit 3; }
  max=$(cat "$d/memory.max" 2>/dev/null) || max=
  load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null) || load=
  # The Stryker sizing the code computes in this scope; the sequential schedule gives the mutation lane this same budget.
  expected=$(node --input-type=module -e 'const m = await import("./scripts/gate-parallelism.mjs"); const b = m.gateBudgetBytes(); const {slots, cpuShare} = m.strykerSlots({budgetBytes: b, packageCount: 3}); console.log(JSON.stringify({budget: b, slots, runnersPerPackage: m.workerCount({perWorkerBytes: m.STRYKER_RUNNER_BYTES, baseBytes: m.STRYKER_PARENT_BYTES, budgetBytes: Math.floor(b / slots), env: {...process.env, GATE_CPU_SHARE: String(cpuShare)}})}))' 2>&1) || { echo "measure: sizing probe failed: $expected" >&2; expected=; }
  echo "measure: evidence=$ev cgroup=$cg memory.max=${max:-unreadable} loadavg=${load:-unreadable} expected=${expected:-unavailable}"
  start=$(date +%s)
  "$@" > "$ev/gate.out" 2>&1; rc=$?
  seconds=$(( $(date +%s) - start ))
  cat "$ev/gate.out"
  invalid=
  [ -n "$max" ] || invalid+=" memory.max"
  [ -n "$load" ] || invalid+=" loadavg"
  case "$expected" in '{"budget":'*) ;; *) invalid+=" expected-sizing" ;; esac
  peak=$(cat "$d/memory.peak" 2>/dev/null) || peak=; [ -n "$peak" ] || invalid+=" memory.peak"
  events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ') || events=; [ -n "$events" ] || invalid+=" memory.events"
  logs=$(sed -n 's/^Push gate logs: //p' "$ev/gate.out" | tail -1)
  { [ -n "$logs" ] && [ -d "$logs" ] && cp -r "$logs" "$ev/gate-logs"; } || invalid+=" scheduler-logs(${logs:-none printed})"
  cp -r artifacts/mutation/frontend "$ev/mutation-logs" 2>/dev/null || invalid+=" mutation-logs"
  echo "measure: rc=$rc seconds=$seconds memory.max=${max:-unreadable} memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable}"
  if [ -n "$invalid" ]; then echo "measure: INVALID — missing evidence:$invalid" >&2; [ "$rc" -eq 0 ] && rc=4; fi
  exit "$rc"
  ```

* Measurement M (immediately after the Phase 1 commit, from the repo root):
  `MEASURE_ROOT=$RUN_TMP agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`
  (the inner `pnpm gates:push` → `agent-gate` runs in place inside the measuring scope). Read only the
  evidence directory this attempt printed (`measure: evidence=…`).
  Acceptance: exit 0; no `INVALID`; `oom_kill 0`; `memory.peak` < `memory.max`; each of
  `gate-logs/{rust-test,rust-coverage,frontend-coverage,e2e,frontend-mutation}.log` contains
  `gate receipt miss:` (a `gate receipt valid:` line voids M; rerun after removing that gate's
  `.gate-receipts/<gate>.json`, which can only stem from this tree); every
  `mutation-logs/<package>/stryker.log` has a `Creating <N> test runner process(es)` line and a
  `MutationTestExecutor … Done in` line; `N` equals the printed `expected` `runnersPerPackage` and at
  most `expected` `slots` package intervals overlap at any instant (on this machine the scope budget
  is below `ONE_WAVE_BYTES`, so the mutation lane runs after P2 with exactly that budget and CPU
  share 1, `scripts/run-push-gates.mjs:921-931`). Independently of the sizing code, the printed
  `expected` must also match the scope arithmetic from the recorded constants: `budget` =
  `memory.max` − 1 GiB (the reserve), and `runnersPerPackage` = min(CPU count,
  ⌊(`budget` − 640 MiB) / 1.2 GiB⌋) at `slots` 1 — on tuxedo-atlas (`memory.max` 30064771072, 24 CPUs)
  `budget` 28991029248 and 21 runners (computed 2026-10-02); a sizing regression (e.g. the
  conservative five) fails this even when expected and observed agree.
  Recorded: `N` per package, the maximum number of packages
  whose intervals overlap, the `frontend-mutation` lane duration, total seconds, `memory.peak`,
  `memory.max`, load at start.
* Any OOM kill, red lane or `INVALID` stops the phase: no constant is tuned to make a run pass; the
  orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M's figures verbatim in the `CLAUDE.md` frontend-mutation
  paragraph (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the
  8 GiB / five-runner / 397.5 s statements; add the gate-scope validation sentence (M's `memory.peak`
  vs `memory.max`, zero OOM kills, date) to the `UNSIZED_PROCESS_RESERVE_BYTES` comment.
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and M's figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### Round 3 (r3, 548 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness APPROVED · error-handling REVISE.

<details><summary>lens-plan-r3 (raw)</summary>

```text
R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r3 (raw)</summary>

```text
R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r3 (raw)</summary>

```text
R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r3 (raw)</summary>

```text
R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
```

</details>

Closures: R1-02 CLOSED (plan, tests, correctness, error-handling). R1-06 CLOSED (plan, error-handling). R2-02 CLOSED (plan, error-handling). R2-01 CLOSED by tests, correctness, error-handling; NOT CLOSED by review-plan (evidence collected outside the lock) → kept open under its ID. Lineage R1-01/R1-02 → R2-01 has now failed closure twice (R1-02 in r2, R2-01 in r3): per rule 12a the lineage stopped being patched by hand — the source path was traced (`run-push-gates.mjs:941-943` prints the run's log directory; `run-frontend-mutation.mjs:310-312` truncates each package log at start), the corrected collection was probed, and a focused fresh-context `review-plan` judgment is requested in round 4 (`lens-judgment-r4`).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Before/after listing and post-scope copies are not attributable under concurrent same-repo gates: another gate can create a log dir while M2 waits for the lock, and can truncate Stryker logs after M1 releases it | plan r3 | `agent-run:597-606` (waiting happens before the lock), `run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`; stub probe of `m2.sh` (exit passthrough 3→3, missing summary → exit 6, green copy → 0); `m1.sh` probe (copy, bad destination → exit 6) | Fix — evidence is collected inside the measuring scope (lock held): `m2.sh` copies the directory named by the scheduler's own `Push gate logs:` line, `m1.sh` copies the mutation tree before the scope ends | MANDATE re-measure (evidence must belong to the measured run) | open → r4 + judgment |
| R3-01 | Sampler counts rows but not matched node/pnpm processes; a selector that stops matching yields `unsized_rss_max_kib=0` accepted | tests r3 | probe: a run with no node/pnpm → `failed_samples=2` → `INVALID` exit 4 after the fix; first sample delayed 5 s so the measured command's node/pnpm exist (probe: `bash -c "…; node …"` → `failed_samples=0`) | Fix — each sample records `<rows> <matched> <kib>`; rows=0 or matched=0 fails the sample | MANDATE rule (b) reserve evidence | open → r4 |
| R3-02 | A later sample-append failure is unchecked | error-handling r3 | probe: sample file made read-only mid-run → sampler exits 5 on its own → `sampler_alive=0` → `INVALID` exit 4 | Fix — sampler exits on append failure; wrapper treats a sampler that ended before being killed as invalid | MANDATE rule (b) reserve evidence | open → r4 |

Round 3 counts: unique new issues 2 (R3-01, R3-02); residual 1 (R2-01); plan-level adoptions r3=3. Cumulative: r1=4 r2=4 r3=3.

### Round 4 (r4, 507 s wall, closure round + focused fresh-context judgment: review-plan, tests, error-handling, review-plan judgment)

Raw verdicts: judgment REVISE · plan REVISE · tests REVISE · error-handling REVISE.

<details><summary>lens-judgment-r4 (raw)</summary>

```text
JUDGMENT: r4 fixes the original concurrent-copy race: M2 identifies the scheduler’s own directory, and both collectors copy before releasing the lock (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:312`; launcher `agent-run:584`). R3-01 and R3-02 are CLOSED against r4: the matched-process check and append/liveness guards address their reported failures, supported by the supplied probes. R2-01 remains open because retrying with an existing destination can leave acceptance reading the previous attempt’s logs. The simplest sufficient mechanism is one fresh all-blocks measurement, collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM evidence inside the held lock into a fresh directory per attempt. The RSS sampler is unnecessary for MANDATE: rule (b) requires measured worker sizing and a recorded reason; the unchanged reserve can name the shared scheduler/receipt processes and be validated through the complete gate’s memory result. Existing producer logs supply runner evidence, though they do not supply isolated overhead RSS. Review should follow obligation scope and ordinary accidental failures; treating this scratch measurement as shipped monitoring software would exceed that scope. Limitation: the complete measurement was not independently executed under the read-only rails; conclusions rely on source and supplied probes (confidence: 90).

OBLIGATION CHANGES:

- Require fresh evidence paths for every measurement attempt; acceptance must inspect that attempt’s paths.
- Remove mandatory isolated-RSS measurement and automatic reserve resizing. Retain the unchanged allowance with an accurate shared-process rationale and whole-gate validation.
- Collect runner counts and intervals during M2; a second full mutation run is unnecessary for the mandated remeasurement.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)

VERDICT: REVISE
```

</details>

<details><summary>lens-plan-r4 (raw)</summary>

```text
R2-01 CLOSED — r4 plan:304–306 selects the scheduler’s emitted log directory; plan:323 preserves mutation logs before scope exit. Producers match these paths (`scripts/run-push-gates.mjs:610–620,943`; `scripts/run-frontend-mutation.mjs:310–312`), and the launcher retains the lock across both copies (`agent-run:584–620`). Supplied probes cover copying and failure propagation.

R3-01 CLOSED — r4 plan:269,283–286 records matched-process counts and rejects zero matches. The supplied real-scope probes distinguish a running node process from no node/pnpm processes.

R3-02 CLOSED — r4 plan:276,281–286 exits the sampler on append failure and rejects premature termination. The supplied mid-run permission probe confirms `sampler_alive=0`, `INVALID`, exit 4.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r4 (raw)</summary>

```text
R3-01 CLOSED — The plan samples `<rows> <matched> <kib>`, rejects either zero count, and delays the first sample; the supplied probes report `INVALID` when no node/pnpm process matches and zero failed samples for a valid node process (plan lines 247–286).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r4 (raw)</summary>

```text
R2-01 CLOSED — M2 copies the scheduler’s own log directory and M1 copies the mutation logs inside the lock-held scope (plan lines 243–245, 293–306; producers at `run-push-gates.mjs:941–943` and `run-frontend-mutation.mjs:310–312`).

R3-01 CLOSED — samples record both process rows and selector matches; either zero marks the sample failed. The supplied no-node probe returned `INVALID` (plan lines 263–269, 283; probe at 247–250).

R3-02 CLOSED — append failure exits the sampler, and an already-ended sampler makes the wrapper emit `INVALID`; the supplied read-only-mid-run probe returned exit 4 (plan lines 274–288; probe at 250).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)

VERDICT: REVISE
```

</details>

**Focused judgment record (rule 12a lineage escalation, R1-01/R1-02 → R2-01).** Contested invariant: Phase 2 evidence must be complete, belong to the measured run, and fail loudly otherwise. Previous answer: three one-off scripts (sampler + M2 + M1) collecting inside the scope. New evidence: source trace (`run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`, `agent-run:584-620`) and the probes above. Judgment (verbatim above): the review was being driven by obligation scope — a scratch measurement reviewed as shipped software; the simplest sufficient mechanism is one fresh all-blocks measurement collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM inside the held lock into a fresh directory per attempt; the isolated RSS sampler is not required by rule (b), which accepts a named shared-resource reason. Resulting obligation changes (adopted): fresh evidence directory per attempt; RSS sampler and automatic reserve resizing removed (reserve unchanged, named reason, validated by the whole gate); M1 folded into the single measurement M. The non-convergence comparison restarts from r4.

Closures: R3-01 CLOSED (plan, tests, error-handling) and R3-02 CLOSED (plan, error-handling) — both then **withdrawn** with the sampler (mechanism removed by the judgment; issues and evidence kept). R2-01 CLOSED by plan and error-handling, NOT CLOSED by the judgment (fixed copy destinations) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Fixed copy destinations let a retry validate the previous attempt's logs (`cp -r` into an existing dir nests the new copy) | judgment r4 | GNU `cp` destination-directory semantics (judgment cites coreutils info); new wrapper: `mktemp -d "$MEASURE_ROOT/measure-XXXXXX"` per attempt; probes: green stub collected `gate.out`, `gate-logs`, `mutation-logs` into a fresh dir; unusable root → `REFUSED` exit 3 | Fix — fresh evidence directory per attempt; acceptance reads only the printed `measure: evidence=` directory | MANDATE re-measure | open → r5 |
| J-1 | The isolated unsized-RSS sampler and conditional reserve resizing exceed MANDATE | judgment r4 (should-fix) | gate-performance intro accepts "a named shared resource" as a cap's reason; `gate-parallelism.mjs:191` subtracts the unchanged reserve | Fix — sampler and resizing removed; reserve reason = named shared processes, validated by M's `memory.peak` < `memory.max` and zero OOM kills; M1 folded into M | MANDATE "size per-step workers under rule (b)" (and rule 6d) | open → r5 |
| R4-01 | `git grep` exits 1 on no match, so the absence scan as an exit-0 proof fails on the intended clean state | tests r4 | `git grep` documented exit status 1 on no match (lens probe) | Fix — proof 1 is `! git -C … grep …` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r5 |
| R4-02 | `PIPESTATUS[0]` ignores a `tee` open failure; a stale summary in `$out` could be parsed | error-handling r4 | GNU `tee` continues when an output open fails | Fix (by withdrawal) — `tee` removed; output is redirected into the fresh evidence directory, so a failed redirect fails the command and no stale file exists | MANDATE re-measure | open → r5 |
| R4-03 | `memory.max` read unchecked | error-handling r4 (should-fix) | probe: cgroup unreadable → `INVALID — missing evidence: memory.max memory.peak memory.events` exit 4 | Fix — `memory.max` joins the evidence guard | MANDATE re-measure | open → r5 |
| R4-04 | A reserve raised after M2 would invalidate M1's sizing figures | plan r4 | — | Withdrawn mechanism — there is no reserve resizing and no separate M1 any more | — | open → r5 (confirm) |

Round 4 counts: unique new issues 5 (J-1, R4-01..R4-04); residual 1 (R2-01); withdrawals: R3-01, R3-02 (sampler), M1/M2 split; plan-level adoptions r4=4 (R2-01, J-1, R4-01, R4-03). Cumulative: r1=4 r2=4 r3=3 r4=4.

### Round 5 (r5, 1114 s wall, closure round: review-plan, tests, error-handling, minimalism)

Raw verdicts: plan APPROVED · tests REVISE · error-handling REVISE · minimalism APPROVED.

<details><summary>lens-plan-r5 (raw)</summary>

```text
R2-01 CLOSED — r5 plan:263,275–276,284–285 creates fresh destinations and restricts acceptance to this attempt’s directory. Copies match the producers’ layouts (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`) and occur inside the held lock.

J-1 CLOSED — r5 plan:109–121,282–299 removes isolated RSS sampling and reserve resizing. One measurement records observed runners and validates the unchanged reserve; `gate-performance.md:10–12` permits the named shared-resource rationale.

R4-01 CLOSED — r5 plan:235 negates the absence scan, making the supplied no-match exit status of 1 satisfy the proof.

R4-02 CLOSED — r5 plan:263,267,274 removes `tee` and parses output redirected into the fresh directory. The quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:7,11,18`.

R4-03 CLOSED — r5 plan:264,271,278 includes unreadable `memory.max` in the invalid-evidence guard; the supplied correction probe confirms exit 4.

R4-04 CLOSED — r5 plan:109,296–299 keeps the reserve unchanged and records one measurement. The post-measurement budget change that invalidated runner figures (`scripts/gate-parallelism.mjs:191`) is withdrawn.

LATE OBSERVATIONS

Limitation — Live scope behaviour and full measurement M were not independently executed under the read-only rails; closure relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r5 (raw)</summary>

```text
R2-01 CLOSED — Each attempt gets a fresh `mktemp` evidence directory, and acceptance reads only the printed path; the supplied probes cover collection and an unusable root.

J-1 CLOSED — The sampler and reserve resizing are removed. The single whole-gate measurement checks peak memory and OOM events.

R4-01 CLOSED — The `! git grep` proof handles the no-match exit status and requires no output.

R4-02 CLOSED — `tee` and its reusable summary path are removed; output goes to the fresh evidence directory, and a missing scheduler-log line is rejected.

R4-03 CLOSED — Unreadable `memory.max` is marked invalid; the supplied cgroup-read probe exits 4.

R4-04 CLOSED — There is one measurement and no reserve resizing, so separate M1/M2 measurements cannot invalidate each other.

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:290` — M accepts any `Creating <N>` line and records its value, but never checks that N follows rule (b) for the measured scope. A regression that leaves Stryker at the conservative five-runner count despite a readable 27 GiB budget would still satisfy the log, peak-memory, and OOM checks. Require comparison with the count computed from the measured scope, or capture and validate the reason for an allowed fallback. (confidence: 89)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r5 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, and acceptance reads only the printed path; the supplied probe confirms collection.

J-1 CLOSED — the sampler and reserve resizing are removed; the reserve stays fixed with a named shared-process reason, checked against whole-gate memory and OOM evidence.

R4-01 CLOSED — `! git grep` makes the no-match case exit 0 with no match output.

R4-02 CLOSED — output goes directly to `gate.out` in the fresh directory; missing scheduler logs mark evidence invalid.

R4-03 CLOSED — a failed `memory.max` read leaves the value empty and triggers the evidence guard.

R4-04 CLOSED — there is no reserve adjustment or separate M1 measurement.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:235 — `!` also turns fatal `git grep` errors into exit 0. The diagnostic remains visible, but a proof consumer checking only the exit status can treat an incomplete scan as success. (confidence: 91)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:265 — If `cut` cannot read `/proc/loadavg`, the wrapper prints an empty `loadavg=` field but never marks the evidence invalid; the enclosing `echo` succeeds, and acceptance does not require that field. Measurement M can therefore exit 0 without the load-at-start value O5 requires. (confidence: 95)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r5 (raw)</summary>

```text
R2-01 CLOSED — plan:247–250,282–285 uses a fresh evidence directory per attempt and reads only the printed directory.
J-1 CLOSED — plan:109–121,125–132 removes RSS sampling and reserve resizing; one whole-gate measurement validates the unchanged reserve.
R4-01 CLOSED — plan:235 negates `git grep` so no matches pass.
R4-02 CLOSED — plan:267 redirects output to the fresh `gate.out`; no `tee` or stale summary path remains.
R4-03 CLOSED — plan:264,271–273 checks `memory.max` and rejects missing cgroup evidence.
R4-04 CLOSED — plan:109–121,125–128 keeps the reserve fixed and uses one measurement; no separate M1 remains.
VERDICT: APPROVED
```

</details>

Closures: R2-01, J-1, R4-01, R4-02, R4-03, R4-04 CLOSED by every witness (plan, tests, error-handling, minimalism).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 | M records any observed `N`; a sizing regression to the conservative 5 runners would pass | tests r5 | `run-push-gates.mjs:921-931` (sequential mutation lane gets the scheduler's budget, CPU share 1); probe: in-scope expression prints `{"budget":28991029248,"slots":1,"runnersPerPackage":21}`; without `scripts/` → `INVALID … expected-sizing` exit 4 | Fix — the wrapper prints the in-scope expected sizing; acceptance requires `N` = expected `runnersPerPackage` and overlap ≤ expected `slots` | MANDATE "re-measure Stryker's runner count inside the gate scope" and "size per-step workers under rule (b)" | open → r6 |
| R5-02 | `! git grep` turns a fatal error (exit 128) into success | error-handling r5 (should-fix) | measured: no match → exit 1; invalid pattern → exit 128 | Fix — `…; [ $? -eq 1 ]` | MANDATE retirement proof | open → r6 |
| R5-03 | An unreadable `/proc/loadavg` leaves the load-at-start field empty without `INVALID` | error-handling r5 | script read | Fix — `loadavg` joins the evidence guard | O5 records load at start | open → r6 |

Round 5 counts: unique new issues 3; plan-level adoptions r5=3 (counted from the restart at r4: r4=4, r5=3). Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3.

### Round 6 (r6, 586 s wall, closure round: review-plan, tests, error-handling)

Raw verdicts: plan APPROVED · tests REVISE · error-handling APPROVED.

<details><summary>lens-plan-r6 (raw)</summary>

```text
R5-01 CLOSED — r6 plan:270,298–302 computes expected sizing inside the scope and requires matching observed runners and bounded overlap. The sequential lane passes that budget with CPU share 1 (`scripts/run-push-gates.mjs:921–932`); package sizing and Stryker concurrency match (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Supplied probes confirm expected sizing and missing-source refusal.

R5-02 CLOSED — r6 plan:235 accepts only `git grep` status 1. The supplied measurements distinguish no match (1) from fatal error (128), so fatal errors no longer pass.

R5-03 CLOSED — r6 plan:268,278,286 clears a failed load read, marks missing load data invalid, and converts an otherwise successful measurement to exit 4. Acceptance at :294 rejects `INVALID`; the quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:9,19,28`.

LATE OBSERVATIONS

Limitation — Live launcher behavior and full measurement M were not independently executed under the read-only rails. Review relies on inspected source and supplied probes; relevant gate sources remain unchanged since HEAD 10643303 (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r6 (raw)</summary>

```text
[blocker] R5-01 NOT CLOSED — the expected count comes from the sizing implementation under review, so a regression can make both expected and observed counts five.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:299 — M checks only that observed runners equal the count computed by `gate-parallelism.mjs`; it never requires that the computed budget reflect the readable gate scope or that the measured 27-GiB budget yields 21 runners. If sizing regresses to five for that budget, expected and observed can both be five and the overlap check still passes. The existing tests pin five at 7 GiB and eight at 90 GiB, but not this scope’s 27-GiB case. Assert the scope-derived budget/count independently, or add a regression anchor for this budget. (confidence: 96)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r6 (raw)</summary>

```text
R5-01 CLOSED — Phase 2 compares each observed runner count and package overlap with its in-scope sizing; the scheduler gives sequential mutation the full budget and CPU share 1 (`run-push-gates.mjs:921-931`).

R5-02 CLOSED — The measured no-match status is 1 and fatal status is 128; `[ $? -eq 1 ]` accepts only the no-match case.

R5-03 CLOSED — An unreadable or empty loadavg leaves `load` empty, which marks evidence invalid and returns 4 if the gate itself succeeds.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:270 — If the sizing probe fails, `2>&1` captures its diagnostic and `|| expected=` discards it. The caller gets only `expected=unavailable` and `INVALID — missing evidence: expected-sizing`, hiding the cause needed to fix the measurement (confidence: 96).

VERDICT: APPROVED
```

</details>

Closures: R5-02, R5-03 CLOSED (plan, error-handling). R5-01 CLOSED by plan and error-handling, NOT CLOSED by tests (expected and observed come from the same sizing code) → kept open under its ID (first closure failure of this lineage).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 (residual) | The expected count is computed by the code under test, so a regression could make expected and observed both 5 | tests r6 (2 findings, same defect) | independent arithmetic from the recorded constants: `max=30064771072 − 1 GiB = 28991029248`; `min(24, ⌊(28991029248 − 671088640)/1288490189⌋) = 21` (node one-liner, 2026-10-02) | Fix — acceptance also checks `expected` against the scope arithmetic (`memory.max` − 1 GiB; ⌊(budget − 640 MiB)/1.2 GiB⌋ capped at CPUs), with the atlas values written out | MANDATE "size per-step workers under rule (b) inside that one scope" | open → r7 |
| R6-01 | A failed sizing probe's diagnostic is discarded | error-handling r6 (should-fix) | probe: run outside the repo → `measure: sizing probe failed: node:internal/modules/esm/resolve:272 …` then `INVALID` exit 4 | Fix — arbiter-closed: the diagnostic is printed before the field is cleared (one-off script, executor detail; semantics and proof unchanged) | — | closed (arbiter) |

Round 6 counts: plan-level adoptions r6=1 (R5-01); 1 arbiter. Since the r4 restart: r4=4 r5=3 r6=1. Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1.

### Round 7 (r7, 709 s wall closure + 367 s first-look coverage at the same revision r7: review-plan, tests; then chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index, tauri-security, platform-semantics)

Raw verdicts: plan APPROVED · tests APPROVED · six project lenses NOT APPLICABLE/APPROVED · platform-semantics REVISE.

<details><summary>lens-plan-r7 (raw)</summary>

```text
R5-01 CLOSED — r7 plan:304–308 independently requires budget 28991029248 and 21 runners, so expected and observed both regressing to five fails acceptance. Constants and worker arithmetic match `scripts/gate-parallelism.mjs:10,17,21,253–260`; sequential mutation receives the full budget and CPU share 1 (`scripts/run-push-gates.mjs:921–932`), which reaches Stryker concurrency (`stryker.config.mjs:41–45`).

LATE OBSERVATIONS

Limitation — Live launcher behavior and measurement M were not independently executed under the read-only rails; review relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r7 (raw)</summary>

```text
R5-01 CLOSED — r7 requires checking the probe against independent scope arithmetic: the recorded atlas inputs yield 21 runners, so a fallback to 5 fails even if expected and observed counts agree.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271 — The new sizing-probe diagnostic has no planned regression assertion. Measurement M runs from the repository root, where the import succeeds; reverting this hunk to `|| expected=` would leave the planned commands green. The outside-`scripts/` probe is only a historical result at lines 255–258. Add a runnable negative probe that asserts the diagnostic and exit 4. (confidence: 93)

VERDICT: APPROVED
```

</details>

<details><summary>lens-chess-semantics-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate tooling, scripts, and documentation; none of its obligations touch an in-memory chess tree, position, or move path.

VERDICT: APPROVED
```

</details>

<details><summary>lens-engine-protocol-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan’s obligations concern gate scheduling, process placement, and documentation; none touch UCI engine supervision, protocol handling, or result routing.

VERDICT: APPROVED
```

</details>

<details><summary>lens-ipc-contract-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan’s obligations cover gate scripts, package routing, worker sizing, and documentation. Its phases explicitly exclude IPC/API contracts, and no Rust or renderer contract files are in scope.
VERDICT: APPROVED
```

</details>

<details><summary>lens-persisted-state-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan covers gate scripts, package routing, and documentation; it does not touch renderer persistence, storage keys, or tab lifecycle.
VERDICT: APPROVED
```

</details>

<details><summary>lens-pgn-index-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate launch, worker sizing, routing checks, and related documentation; it does not affect PGN scanning, indexing, encoding, storage, or search.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tauri-security-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate scripts, package configuration, and documentation; its obligations do not touch credentials, filesystem authority, signed downloads, or backend-only data.

VERDICT: APPROVED
```

</details>

<details><summary>lens-platform-semantics-r7 (raw)</summary>

```text
[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:70 — On macOS and Windows, the proposed `pnpm gate:run frontend-build` and `gate:ensure` scripts require the Linux `agent-gate`, which depends on `/proc` and `systemd-run`; they fail before the currently direct Node receipt runner starts (`package.json:26-27`, tuxedo-config `agent-run:214,559-575`). CI’s `gates:contract:check` only checks routing text, so it does not prove those commands work on either platform. (confidence: 98)

VERDICT: REVISE
```

</details>

Closures: R5-01 CLOSED (plan, tests).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R7-01 | The sizing-probe diagnostic hunk of the one-off wrapper has no runnable regression assertion | tests r7 (should-fix) | focused judgment r4: the wrapper is a never-committed scratch measurement; its failure paths were probed in this run (`measure: sizing probe failed: node:internal/modules/esm/resolve:272` → `INVALID` exit 4) | Skip — a regression assertion for a one-off scratch script is shipped-software verification the r4 judgment ruled outside MANDATE | — | closed (Skip) |
| R7-02 | `gate:ensure`/`gate:run` would fail on macOS/Windows, where `agent-gate` (`/proc`, `systemd-run`) does not exist | platform-semantics r7 (should-fix) | frozen threat model: environments that count are local Linux sessions with `agent-gate`; CI never runs the wrapped scripts (`.github/workflows/test.yml` runs the gate commands directly, probe-1-r1); `gates:push`/`checks:pre-review` have been Linux-only since K5's `bash scripts/heavy-gate.sh` (systemd-run); gate-performance (c): a missing `agent-gate` fails the gate by design | Skip — outside the frozen threat model's environments; gate-performance (c) mandates failing without the launcher | — | closed (Skip) |

Round 7 counts: plan-level adoptions r7=0; 2 Skips. Plan-level issues open after r7: none. R2-01 and J-1 (witness `judgment` r4) and R6-01 (should-fix, witness error-handling r6) still need a completed closure row by their witnessing lenses for the published evidence → r8 is an evidence-only closure check at the unchanged revision r7 (`plan-review-delta.py` → `UNCHANGED`, exit 3; no revision round is claimed).

### Round 8 (r8, 506 s wall, evidence-only closure check at the unchanged revision r7: review-plan, tests, correctness, judgment (fresh-context review-plan), error-handling)

Raw verdicts: all five APPROVED.

<details><summary>lens-plan-r8 (raw)</summary>

```text
R2-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:267,283–294` creates a fresh evidence directory, copies producer logs before scope exit, and restricts acceptance to the printed directory. Producer paths match (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`); supplied probes confirm collection and failure propagation.

J-1 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:109–121,291–313` removes isolated RSS sampling and conditional resizing. One measurement checks runners, peak memory and OOM events against the unchanged reserve (`scripts/gate-parallelism.mjs:10,191`), with the named shared-process reason permitted by `gate-performance.md:10–12`.

R6-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271` matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:11`: the diagnostic is printed before `expected` is cleared. The supplied missing-`scripts/` probe confirms the diagnostic followed by `INVALID` exit 4.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r8 (raw)</summary>

```text
R2-01 CLOSED — Phase 2 creates a fresh evidence directory per attempt, collects both log trees before the measuring scope ends, and reads only the printed directory. The supplied probes cover collection, red exit propagation, invalid evidence, and refusal for an unusable root (plan:247–294).

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r8 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, prints its path, and acceptance reads only that directory. The wrapper copies scheduler and mutation logs before the lock-held scope ends; the supplied probes confirm collection and gate-status handling.

LATE OBSERVATIONS

None.

VERDICT: APPROVED
```

</details>

<details><summary>lens-judgment-r8 (raw)</summary>

```text
R2-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:267` creates fresh evidence per attempt; `:283–285` copies the scheduler’s emitted directory and package-preserving mutation tree inside the measuring scope; `:294` restricts acceptance to the printed evidence directory. Producer paths match `scripts/run-push-gates.mjs:943` and `scripts/run-frontend-mutation.mjs:258`; launcher ownership is supported by `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:584–620` and supplied scope probes (confidence: 97).

J-1 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:109–121` retains the unchanged reserve with a named shared-process reason; `:291–317` uses one whole-gate measurement to require peak memory below the cap and zero OOM kills. Isolated RSS sampling and conditional resizing are removed. This matches `/home/felixb/.claude/references/gate-performance.md:10–14`; existing sizing subtracts the reserve at `scripts/gate-parallelism.mjs:191` (confidence: 97).

LATE OBSERVATIONS

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:291 — Verification limitation: measurement M and live routing proofs were not independently executed under the read-only rails. Closure verifies the corrected plan against inspected source and supplied probes; implementation acceptance still requires M (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r8 (raw)</summary>

```text
R6-01 CLOSED — r7 prints the sizing probe’s diagnostic before clearing `expected`, then marks the missing sizing evidence invalid and exits 4 on a green gate; the supplied probe confirms this outcome (plan lines 271, 280, 287; 255–258).

LATE OBSERVATIONS

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:250 — Runtime probes were supplied and the failure paths were source-traced, but they were not independently rerun under the read-only rails (confidence: 99).

VERDICT: APPROVED
```

</details>

Closures: R2-01 CLOSED (plan, tests, correctness, judgment); J-1 CLOSED (plan, judgment); R6-01 CLOSED (plan, error-handling) — this supersedes the r6 "arbiter" note for R6-01, whose witness was should-fix rank and therefore needed a witness closure.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R8-01 | Lenses did not execute measurement M or the live routing proofs themselves | judgment r8 (nit), error-handling r8 (nit) | read-only lens rails by contract (`review-lens-contract.md`); the plan's Phase 1 proofs and Phase 2 acceptance execute them during implementation | Skip — a stated limitation of read-only review; implementation acceptance runs M | — | closed (Skip) |

### Round 9 (r9, 281 s wall, PLAN-REFRESH drift round at the unchanged revision r7, base a580b504 → 84e697e9: review-plan, judgment (fresh-context review-plan), correctness, error-handling, minimalism, tests, chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index, platform-semantics, tauri-security)

Drift: `git diff a580b504bbbec73c5768546b6129c3c52881f0af..84e697e91a6f08fe4859362176abe7fa91c2bbd4` (drift file `drift-a580b504bbbec73c5768546b6129c3c52881f0af-84e697e91a6f08fe4859362176abe7fa91c2bbd4.diff`) changes `src-tauri/src/{chess,fs}.rs`, `src-tauri/src/engine/process.rs`, `src/bindings/generated.ts`, `src/components/engines/UpgradeEngineModal{.tsx,.test.tsx}`, `src/platform/tauri.ts`, `tasks/build-ledger.md`, `tasks/findings.md` (f-20261002-09, f-20261002-10 and annotations) and `tasks/handoffs/2026-10-01-stockfish-19-upgrade-review.md`. Of the plan's `paths`, only `tasks/findings.md` and `tasks/handoffs/` are touched, by unrelated records; no gate script, package script, skill, `CLAUDE.md` or decision the plan cites changed.

Raw verdicts: all thirteen APPROVED (four NOT APPLICABLE); no prefixed finding.

<details><summary>lens-plan-r9 (raw)</summary>

```text
No drift change invalidates O1–O6 or either phase’s proof/acceptance criteria (confidence: 95). The engine API changes do not affect gate routing, worker sizing or measurement producers.

Input limitation: the verbatim `ROUND/DELTA/REVISED/SETTLED` block was not supplied; this approval covers the supplied repository drift only (confidence: 100).

## OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — merges stale `.profraw` files, allowing false coverage passes; already tracked as f-20261002-09. This does not invalidate O5’s observed Stryker counts or scope-memory measurement.

VERDICT: APPROVED
```

</details>

<details><summary>lens-judgment-r9 (raw)</summary>

```text
No inspected drift change invalidates O1–O6 or the Phase 1/2 acceptance criteria (confidence: 96). Gate routing, sizing and measurement producers are unchanged; the engine repairs introduce no dependency on the planned launcher changes.

## OUT OF DRIFT SCOPE

tasks/plans/.plan-delta-plan-r9.diff:1 — Required verbatim r9 `ROUND/DELTA/REVISED/SETTLED` block is missing; formal re-review coverage cannot be confirmed from the unified diff alone (confidence: 100).

scripts/rust-branch-coverage.mjs:139 — Stale profiles can inflate backend coverage, already tracked by f-20261002-09; this does not invalidate O4/O5’s memory and runner-count observations.

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r9 (raw)</summary>

```text
No correctness defect in the drift invalidates O1–O6 or the Phase 1/2 proof and acceptance contracts.

Limitation: live scope placement, refusal behavior and resource measurements were not rerun in this read-only review (static assessment confidence: 95).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r9 (raw)</summary>

```text
The drift invalidates no O1–O6 obligation or Phase 1/2 failure-handling requirement.

## OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — stale `.profraw` files can mask a coverage regression and produce a successful gate result; already tracked as f-20261002-09.

VERDICT: APPROVED
```

</details>

<details><summary>lens-minimalism-r9 (raw)</summary>

```text
The drift invalidates no plan obligation within this lens. It introduces no bloat or duplication requiring changes to O1–O6 or their acceptance criteria. No files changed; no gates or tests run.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r9 (raw)</summary>

```text
The drift invalidates none of O1–O6’s verification obligations. Reverting the launcher routes fails the planned routing pins; regressing sizing to five runners fails Phase 2’s independent 21-runner assertion.

### OUT OF DRIFT SCOPE

scripts/rust-branch-coverage.mjs:139 — stale profiles can falsely satisfy coverage ratchets (already tracked as f-20261002-09); runtime sizing evidence remains independent.

VERDICT: APPROVED
```

</details>

<details><summary>lens-chess-semantics-r9 (raw)</summary>

```text
NOT APPLICABLE: O1–O6 concern gate launching, worker sizing and measurement. The drift changes engine-binary retirement, download validation, bindings and records; it changes no in-memory chess tree, position identity, move path or parity logic.

VERDICT: APPROVED
```

</details>

<details><summary>lens-engine-protocol-r9 (raw)</summary>

```text
No in-scope findings. The binary retirement/readmission drift does not invalidate O1–O6, the phase proof or acceptance criteria, or the traced premises within this lens.

VERDICT: APPROVED
```

</details>

<details><summary>lens-ipc-contract-r9 (raw)</summary>

```text
No IPC drift invalidates O1–O6 or either phase’s proof/acceptance criteria. `retire_engine_binary` remains Specta-registered; Rust, the generated invoke payload, facade and modal agree on `engine`, `retired` and `current`. The commit records binding regeneration. No events or capability scopes changed.

VERDICT: APPROVED
```

</details>

<details><summary>lens-persisted-state-r9 (raw)</summary>

```text
NOT APPLICABLE: O1–O6 concern gate tooling and process placement. The drift changes runtime engine retirement, archive validator typing and review records; it changes no renderer storage keys, serialization, hydration, atom families or tab lifecycle, and invalidates no plan obligation within this lens.
VERDICT: APPROVED
```

</details>

<details><summary>lens-pgn-index-r9 (raw)</summary>

```text
NOT APPLICABLE: Plan obligations O1–O6 concern gate launching, routing and resource sizing. The drift changes engine retirement, archive integrity validation and review records; no PGN scanning, indexing, encoding, storage or search path is affected.

VERDICT: APPROVED
```

</details>

<details><summary>lens-platform-semantics-r9 (raw)</summary>

```text
No platform-semantics finding in the drift invalidates O1–O6 or either phase’s proof. Gate routing, cgroup sizing and CI invocation paths remain unchanged; the launcher’s Linux-only scope remains explicit.

Read-only source review only: neither the non-Linux Unix source probe nor `pnpm rust:windows:check` was run. Windows/macOS runtime proof remains with `rust-windows-test` and `rust-macos-test`; `rust-platform` checks compilation and linting.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tauri-security-r9 (raw)</summary>

```text
No drift defect in this lens invalidates O1–O6 or Phase 1/2 acceptance.

The boxed validator still enforces signature verification before transport (`src-tauri/src/fs.rs:1322`) and digest comparison before extraction (`src-tauri/src/fs.rs:579`). Retirement changes carry opaque handles only.

Credentials and session persistence are unchanged. Review was read-only; no tests or gates ran, and the worktree remains clean.

VERDICT: APPROVED
```

</details>

Arbiter notes (no issue opened; no prefixed finding exists in this round):

* **Drift verdict:** the plan stands unchanged. Probe: the body (everything before `## Reviews`) of the current plan is byte-identical to the r7 and r8 snapshots (`python3` comparison, `True`/`True`); `plan-review-delta.py --round 9` lists only the appended `## Review summary` history section as REVISED.
* **Out of drift scope, already tracked:** error-handling, judgment, plan and tests name `scripts/rust-branch-coverage.mjs:139` (stale `.profraw` merge inflating local backend coverage). That is `f-20261002-09`, filed inside the drift itself; not re-filed. Lenses agree it does not affect M's memory and runner-count evidence. Implementation note for Phase 2: M's `rust-coverage` lane green is not evidence about coverage while `f-20261002-09` is open; M only records memory, OOM and Stryker figures.
* **Packet omission (disclosed):** the r9 prompts named the delta file but did not paste the `ROUND/DELTA/REVISED/SETTLED` stdout block (plan and judgment report it as an input limitation). No reviewer judgment depended on it: the plan body is byte-identical to the reviewed revision r7, the block's only REVISED heading is the history summary, and the drift round's required inputs (both SHAs and the drift file) were present in every prompt.

### Review summary (plan review closed 2026-10-02; refreshed against 84e697e9 in r9)

* Rounds: 9 completed (r8 an evidence-only closure check at revision r7; r9 the PLAN-REFRESH drift round a580b504 → 84e697e9 at the same revision, 13 lenses, all APPROVED, no finding). Wall time per round (s): r1 467 · r2 487 · r3 548 · r4 507 · r5 1114 · r6 586 · r7 709 + 367 (first-look coverage) · r8 506 · r9 281 — ≈ 1 h 39 min of review wall time; orchestrator probing and triage between rounds not included.
* `plan_adopted_per_round`: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1 r7=0 r8=0 r9=0.
* Unique issues: 22 (R1-01..R1-06, R2-01, R2-02, R3-01, R3-02, R4-01..R4-04, J-1, R5-01..R5-03, R6-01, R7-01, R7-02, R8-01). Fix 18 (17 closed by their witness lenses, R1-05 arbiter-closed nit), Skip 4 (R1-04, R7-01, R7-02, R8-01), Defer 0. Withdrawn mechanisms: the RSS sampler (R3-01, R3-02 closed then withdrawn), the M1/M2 split and reserve resizing (R4-04), `tee` capture (R4-02). Open plan-level issues: 0.
* Lineage escalation: R1-01/R1-02 → R2-01 failed closure twice (r2, r3) → source trace + probes + focused fresh-context `review-plan` judgment (r4), which re-scoped the measurement to one in-lock run; the non-convergence comparison restarted at r4 (r4=4, r5=3, r6=1, r7=0, r8=0, r9=0).
* Correction-introduced defects: R2-01 (from the R1-01/R1-02 corrections), R2-02 (from the R1-06 sampler), R3-01/R3-02 (sampler), R4-01 (from R1-03), R4-02/R4-03 (from R2-01's collection), R5-01..R5-03 and R6-01 (from J-1's single-measurement wrapper), R7-01 (from R6-01).
* Lens provenance: every lens and probe ran as a Codex leaf (OpenAI high tier for `review-plan` and the judgment, low tier at max for the others); the orchestrator (Claude Code, Opus 5.5) wrote the plan, ran every probe and arbitrated — disclosed.

### plan-r2.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. The one-off measurement wrapper (`$RUN_TMP/measure-gate.sh`, quoted in Phase 2) ran in the scope and printed `memory.peak=331145216 oom 0 oom_kill 0 unsized_rss_max_kib=353312` for a 300 MiB node process.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES` (value stays 1 GiB unless the
  Phase 2 measurement exceeds it). Its comment states both places it applies: in a session scope
  (plain `vitest`), the agent process (0.32 GB measured 2026-09-29); in the gate scope, the scheduler,
  per-lane `pnpm` and `gate-receipt` parents and launcher Node processes that no worker count sizes,
  with the Phase 2 measured maximum. Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". Measurement M2 (first): an
all-blocks `pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh
post-Phase-1 tree, so every receipt lane executes (each lane log shows `gate receipt miss:`),
recording `memory.peak`, `oom_kill`, duration and the maximum summed RSS of unsized `node`/`pnpm`
processes (the O4 reserve evidence). Measurement M1 (second): the forced (`gate:run`) three-package
frontend mutation through the standalone receipt route inside one gate scope, recording the
**observed** runner count per package (Stryker's `Creating <N> test runner process(es)` line in
`artifacts/mutation/frontend/<package>/stryker.log`) and the observed package overlap, checked
against the count the sizing code computes in that same scope, plus duration, scope `memory.peak`,
`memory.events` `oom_kill`, and load average at start. Both are orchestrator one-off commands (Phase 2); their figures replace the
stale 8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and ground the O4
reserve comment. The decision record carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent.
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as orchestrator one-offs, no new log lines** (rule 6d): the wrapper in Phase 2 lives
  in `$RUN_TMP`, is never committed, and reads the scope's own cgroup files before the scope ends.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is M1/M2, which the f-20260930-03 closure note
and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 M2 measurement. **Rejected:** dropping the reserve (unsized processes share the scope's
   `MemoryMax`); keeping the name `AGENT_RESERVE_BYTES` (false inside the gate scope). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. M1/M2 measure whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Another session's gate holding the lock makes M1/M2 and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'` prints nothing (the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)

Depends on Phase 1 (the measurements exercise its committed route; nothing else may record a receipt
on the post-Phase-1 tree before M2). Order: M2, then M1, both by the orchestrator; then one
`mechanical` write leaf records the figures.

* Orchestrator one-off (never committed), saved as `$RUN_TMP/measure-gate.sh`. Probed 2026-10-02 in
  this run: valid case `rc=0 … samples=3 failed_samples=0 unsized_rss_max_kib=250900`; failed cgroup
  reads (test hook `MEASURE_TEST_CGROUP=/nonexistent`) → `measure: INVALID …` exit 4; outside a gate
  scope → `REFUSED` exit 3.

  ```bash
  #!/usr/bin/env bash
  # One-off: run "$@" inside the current agent-gate scope; sample unsized node/pnpm RSS; print scope peak.
  set -u
  samples=${MEASURE_SAMPLES:?MEASURE_SAMPLES must name the sample file}
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  echo "measure: cgroup=$cg memory.max=$(cat "$d/memory.max")"
  # One line per sample: "<rows> <unsized_kib>"; rows counts every process ps reported, so 0 means the sample failed.
  sample() {
    local procs
    procs=$(paste -sd, "$d/cgroup.procs" 2>/dev/null) || procs=
    if [ -z "$procs" ]; then echo "0 0"; return; fi
    ps -o rss=,args= -p "$procs" 2>/dev/null | awk '{n++} ($2 ~ /(^|\/)(node|pnpm)$/ || $2 ~ /pnpm/) && $0 !~ /stryker|vitest|tsgo|oxlint|cargo|rustc/ {s+=$1} END {print n+0, s+0}'
  }
  : > "$samples"
  ( while :; do sample >> "$samples"; python3 -c 'import time; time.sleep(5)'; done ) &
  sampler=$!
  start=$(date +%s)
  "$@"; rc=$?
  kill "$sampler" 2>/dev/null
  count=$(wc -l < "$samples"); failed=$(awk '$1 == 0' "$samples" | wc -l)
  peak=$(cat "$d/memory.peak" 2>/dev/null); events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ')
  echo "measure: rc=$rc seconds=$(( $(date +%s) - start )) memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable} samples=$count failed_samples=$failed unsized_rss_max_kib=$(awk '{print $2}' "$samples" | sort -n | tail -1)"
  if [ "$count" -eq 0 ] || [ "$failed" -ne 0 ] || [ -z "$peak" ] || [ -z "$events" ]; then
    echo "measure: INVALID — sampling or cgroup reads failed ($failed of $count samples failed; peak=${peak:-unreadable})" >&2
    [ "$rc" -eq 0 ] && rc=4
  fi
  exit "$rc"
  ```

  * M2 (first, immediately after the Phase 1 commit): `MEASURE_SAMPLES=$RUN_TMP/m2.samples agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`, then copy `artifacts/gates/*.log` to `$RUN_TMP/m2-logs/`.
    Acceptance: `rc=0`, `oom_kill 0`, `memory.peak` < `memory.max`, no `INVALID` line, and each of the
    `rust-test`, `rust-coverage`, `frontend-coverage`, `e2e`, `frontend-mutation` lane logs contains
    `gate receipt miss:` (a `gate receipt valid:` line voids M2 as a measurement; rerun only after
    removing that one gate's receipt file `.gate-receipts/<gate>.json`, which this run created).
  * M1 (second): `MEASURE_SAMPLES=$RUN_TMP/m1.samples agent-gate bash $RUN_TMP/measure-gate.sh bash -c 'cat /proc/loadavg; node --input-type=module -e "const m = await import(\"./scripts/gate-parallelism.mjs\"); const b = m.gateBudgetBytes(); const {slots, cpuShare} = m.strykerSlots({budgetBytes: b, packageCount: 3}); console.log(JSON.stringify({budget: b, slots, cpuShare, runnersPerPackage: m.workerCount({perWorkerBytes: m.STRYKER_RUNNER_BYTES, baseBytes: m.STRYKER_PARENT_BYTES, budgetBytes: Math.floor(b / slots), env: {...process.env, GATE_CPU_SHARE: String(cpuShare)}})}))" && pnpm gate:run frontend-mutation'` from the repo root (the inner `pnpm gate:run` runs in place inside the measuring scope), then copy `artifacts/mutation/frontend/*/stryker.log` to `$RUN_TMP/m1-logs/`.
    Acceptance: `rc=0`, `oom_kill 0`, `memory.peak` < `memory.max`, no `INVALID` line; every
    package's `Creating <N> test runner process(es)` line exists and `N` equals the printed
    `runnersPerPackage`; the packages' Stryker start times show at most `slots` running at once.
  * Any OOM kill, red lane, `INVALID` or count mismatch stops the phase: no constant is tuned to make a
    run pass; the orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M1/M2 verbatim figures (observed runners per package and slots,
  duration, `memory.peak`, `oom_kill`, load at start) in the `CLAUDE.md` frontend-mutation paragraph
  (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the 8 GiB /
  five-runner / 397.5 s statements; add the gate-scope sentence with M2's `unsized_rss_max_kib` to
  the `UNSIZED_PROCESS_RESERVE_BYTES` comment. If that maximum exceeds 1 GiB, the reserve value is
  raised to the next 0.25 GiB above it and `gate-parallelism-tests.mjs` follows (a measured reason,
  not a tuning).
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and the M1/M2 figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### plan-r3.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. The one-off measurement wrapper (`$RUN_TMP/measure-gate.sh`, quoted in Phase 2) ran in the scope and printed `memory.peak=331145216 oom 0 oom_kill 0 unsized_rss_max_kib=353312` for a 300 MiB node process.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES` (value stays 1 GiB unless the
  Phase 2 measurement exceeds it). Its comment states both places it applies: in a session scope
  (plain `vitest`), the agent process (0.32 GB measured 2026-09-29); in the gate scope, the scheduler,
  per-lane `pnpm` and `gate-receipt` parents and launcher Node processes that no worker count sizes,
  with the Phase 2 measured maximum. Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". Measurement M2 (first): an
all-blocks `pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh
post-Phase-1 tree, so every receipt lane executes (each lane log shows `gate receipt miss:`),
recording `memory.peak`, `oom_kill`, duration and the maximum summed RSS of unsized `node`/`pnpm`
processes (the O4 reserve evidence). Measurement M1 (second): the forced (`gate:run`) three-package
frontend mutation through the standalone receipt route inside one gate scope, recording the
**observed** runner count per package (Stryker's `Creating <N> test runner process(es)` line in
`artifacts/mutation/frontend/<package>/stryker.log`) and the observed package overlap, checked
against the count the sizing code computes in that same scope, plus duration, scope `memory.peak`,
`memory.events` `oom_kill`, and load average at start. Both are orchestrator one-off commands (Phase 2); their figures replace the
stale 8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and ground the O4
reserve comment. The decision record carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent.
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as orchestrator one-offs, no new log lines** (rule 6d): the wrapper in Phase 2 lives
  in `$RUN_TMP`, is never committed, and reads the scope's own cgroup files before the scope ends.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is M1/M2, which the f-20260930-03 closure note
and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 M2 measurement. **Rejected:** dropping the reserve (unsized processes share the scope's
   `MemoryMax`); keeping the name `AGENT_RESERVE_BYTES` (false inside the gate scope). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. M1/M2 measure whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Another session's gate holding the lock makes M1/M2 and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'` prints nothing (the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)

Depends on Phase 1 (the measurements exercise its committed route; nothing else may record a receipt
on the post-Phase-1 tree before M2). Order: M2, then M1, both by the orchestrator; then one
`mechanical` write leaf records the figures.

* Orchestrator one-off (never committed), saved as `$RUN_TMP/measure-gate.sh`. Probed 2026-10-02 in
  this run inside real `agent-gate` scopes: valid case `rc=0 … samples=2 failed_samples=0`; failed
  cgroup reads (test hook `MEASURE_TEST_CGROUP=/nonexistent`) → `measure: INVALID …` exit 4; an
  unwritable sample file → `REFUSED` exit 3 before the command starts; outside a gate scope →
  `REFUSED` exit 3; the sampler has no fd 9 (the inherited heavy-gate lock) and exited within 8 s
  after the measuring shell was SIGKILLed.

  ```bash
  #!/usr/bin/env bash
  # One-off: run "$@" inside the current agent-gate scope; sample unsized node/pnpm RSS; print scope peak.
  set -u
  samples=${MEASURE_SAMPLES:?MEASURE_SAMPLES must name the sample file}
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  if ! : > "$samples"; then echo "measure: REFUSED — cannot write the sample file $samples" >&2; exit 3; fi
  echo "measure: cgroup=$cg memory.max=$(cat "$d/memory.max")"
  # One line per sample: "<rows> <unsized_kib>"; rows counts every process ps reported, so 0 means the sample failed.
  sample() {
    local procs
    procs=$(paste -sd, "$d/cgroup.procs" 2>/dev/null) || procs=
    if [ -z "$procs" ]; then echo "0 0"; return; fi
    ps -o rss=,args= -p "$procs" 2>/dev/null | awk '{n++} ($2 ~ /(^|\/)(node|pnpm)$/ || $2 ~ /pnpm/) && $0 !~ /stryker|vitest|tsgo|oxlint|cargo|rustc/ {s+=$1} END {print n+0, s+0}'
  }
  parent=$$
  # The sampler drops the inherited heavy-gate lock descriptor (fd 9) and stops when this shell is gone,
  # so a killed measurement cannot leave a loop holding the lock inside the scope.
  ( exec 9>&-; while kill -0 "$parent" 2>/dev/null; do sample >> "$samples"; python3 -c 'import time; time.sleep(5)'; done ) &
  sampler=$!
  trap 'kill "$sampler" 2>/dev/null' EXIT
  start=$(date +%s)
  "$@"; rc=$?
  kill "$sampler" 2>/dev/null
  count=$(wc -l < "$samples" 2>/dev/null) || count=0; count=${count:-0}
  failed=$(awk '$1 == 0' "$samples" 2>/dev/null | wc -l)
  peak=$(cat "$d/memory.peak" 2>/dev/null); events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ')
  echo "measure: rc=$rc seconds=$(( $(date +%s) - start )) memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable} samples=$count failed_samples=$failed unsized_rss_max_kib=$(awk '{print $2}' "$samples" 2>/dev/null | sort -n | tail -1)"
  if [ "$count" -eq 0 ] || [ "$failed" -ne 0 ] || [ -z "$peak" ] || [ -z "$events" ]; then
    echo "measure: INVALID — sampling or cgroup reads failed ($failed of $count samples failed; peak=${peak:-unreadable})" >&2
    [ "$rc" -eq 0 ] && rc=4
  fi
  exit "$rc"
  ```

  * M2 (first, immediately after the Phase 1 commit): `MEASURE_SAMPLES=$RUN_TMP/m2.samples agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`, with `ls artifacts/gates` captured before and after; copy the one `artifacts/gates/<timestamp>-<pid>/` directory that M2 created (the scheduler's per-run log directory, `scripts/run-push-gates.mjs:610-620`; the heavy-gate lock keeps any other gate from creating one meanwhile) to `$RUN_TMP/m2-logs/`.
    Acceptance: `rc=0`, `oom_kill 0`, `memory.peak` < `memory.max`, no `INVALID` line, and each of the
    `rust-test`, `rust-coverage`, `frontend-coverage`, `e2e`, `frontend-mutation` lane logs contains
    `gate receipt miss:` (a `gate receipt valid:` line voids M2 as a measurement; rerun only after
    removing that one gate's receipt file `.gate-receipts/<gate>.json`, which this run created).
  * M1 (second): `MEASURE_SAMPLES=$RUN_TMP/m1.samples agent-gate bash $RUN_TMP/measure-gate.sh bash -c 'cat /proc/loadavg; node --input-type=module -e "const m = await import(\"./scripts/gate-parallelism.mjs\"); const b = m.gateBudgetBytes(); const {slots, cpuShare} = m.strykerSlots({budgetBytes: b, packageCount: 3}); console.log(JSON.stringify({budget: b, slots, cpuShare, runnersPerPackage: m.workerCount({perWorkerBytes: m.STRYKER_RUNNER_BYTES, baseBytes: m.STRYKER_PARENT_BYTES, budgetBytes: Math.floor(b / slots), env: {...process.env, GATE_CPU_SHARE: String(cpuShare)}})}))" && pnpm gate:run frontend-mutation'` from the repo root (the inner `pnpm gate:run` runs in place inside the measuring scope), then copy the `artifacts/mutation/frontend/` tree with its per-package directories (`cp -r artifacts/mutation/frontend $RUN_TMP/m1-logs`), so each `stryker.log` keeps its package name.
    Acceptance: `rc=0`, `oom_kill 0`, `memory.peak` < `memory.max`, no `INVALID` line; every
    package's `Creating <N> test runner process(es)` line exists and `N` equals the printed
    `runnersPerPackage`; each package's execution interval — its log's first timestamped line to its `MutationTestExecutor … Done in` line — overlaps at most `slots - 1` other packages' intervals at any instant.
  * Any OOM kill, red lane, `INVALID` or count mismatch stops the phase: no constant is tuned to make a
    run pass; the orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M1/M2 verbatim figures (observed runners per package and slots,
  duration, `memory.peak`, `oom_kill`, load at start) in the `CLAUDE.md` frontend-mutation paragraph
  (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the 8 GiB /
  five-runner / 397.5 s statements; add the gate-scope sentence with M2's `unsized_rss_max_kib` to
  the `UNSIZED_PROCESS_RESERVE_BYTES` comment. If that maximum exceeds 1 GiB, the reserve value is
  raised to the next 0.25 GiB above it and `gate-parallelism-tests.mjs` follows (a measured reason,
  not a tuning).
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and the M1/M2 figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### plan-r4.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. The one-off measurement wrapper (`$RUN_TMP/measure-gate.sh`, quoted in Phase 2) ran in the scope and printed `memory.peak=331145216 oom 0 oom_kill 0 unsized_rss_max_kib=353312` for a 300 MiB node process.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES` (value stays 1 GiB unless the
  Phase 2 measurement exceeds it). Its comment states both places it applies: in a session scope
  (plain `vitest`), the agent process (0.32 GB measured 2026-09-29); in the gate scope, the scheduler,
  per-lane `pnpm` and `gate-receipt` parents and launcher Node processes that no worker count sizes,
  with the Phase 2 measured maximum. Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". Measurement M2 (first): an
all-blocks `pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh
post-Phase-1 tree, so every receipt lane executes (each lane log shows `gate receipt miss:`),
recording `memory.peak`, `oom_kill`, duration and the maximum summed RSS of unsized `node`/`pnpm`
processes (the O4 reserve evidence). Measurement M1 (second): the forced (`gate:run`) three-package
frontend mutation through the standalone receipt route inside one gate scope, recording the
**observed** runner count per package (Stryker's `Creating <N> test runner process(es)` line in
`artifacts/mutation/frontend/<package>/stryker.log`) and the observed package overlap, checked
against the count the sizing code computes in that same scope, plus duration, scope `memory.peak`,
`memory.events` `oom_kill`, and load average at start. Both are orchestrator one-off commands (Phase 2); their figures replace the
stale 8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and ground the O4
reserve comment. The decision record carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent.
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as orchestrator one-offs, no new log lines** (rule 6d): the wrapper in Phase 2 lives
  in `$RUN_TMP`, is never committed, and reads the scope's own cgroup files before the scope ends.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is M1/M2, which the f-20260930-03 closure note
and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 M2 measurement. **Rejected:** dropping the reserve (unsized processes share the scope's
   `MemoryMax`); keeping the name `AGENT_RESERVE_BYTES` (false inside the gate scope). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. M1/M2 measure whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Resumed Codex write leaves have no user D-Bus (agent-kit `f-20261002-15`, measured 2026-10-02 in the
  Stockfish 19 build): every `agent-gate`-wrapped script — after this change also `gate:ensure` and
  `gate:run` — refuses with exit 125 there. Fix briefs report that refusal and continue; the
  orchestrator reruns `pnpm checks:pre-review` itself (it must anyway).
* Another session's gate holding the lock makes M1/M2 and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'` prints nothing (the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)

Depends on Phase 1 (the measurements exercise its committed route; nothing else may record a receipt
on the post-Phase-1 tree before M2). Order: M2, then M1, both by the orchestrator; then one
`mechanical` write leaf records the figures.

* Orchestrator one-offs (never committed), saved in `$RUN_TMP`. All evidence is collected **inside the
  measuring scope**, i.e. while the measuring run still holds the heavy-gate lock, so no other gate can
  create a scheduler log directory or truncate a Stryker log before it is copied.

  `$RUN_TMP/measure-gate.sh` — probed 2026-10-02 inside real `agent-gate` scopes: a node command
  started from `bash -c` → `samples=2 failed_samples=0 sampler_alive=1`; no node/pnpm process at all →
  `failed_samples=2` → `INVALID` exit 4; failed cgroup reads (test hook `MEASURE_TEST_CGROUP=/nonexistent`)
  → `INVALID` exit 4; sample file made read-only mid-run → `sampler_alive=0` → `INVALID` exit 4;
  unwritable sample file → `REFUSED` exit 3 before the command starts; outside a gate scope →
  `REFUSED` exit 3; the sampler has no fd 9 and exited within 8 s after the measuring shell was SIGKILLed.

  ```bash
  #!/usr/bin/env bash
  # One-off: run "$@" inside the current agent-gate scope; sample unsized node/pnpm RSS; print scope peak.
  set -u
  samples=${MEASURE_SAMPLES:?MEASURE_SAMPLES must name the sample file}
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  if ! : > "$samples"; then echo "measure: REFUSED — cannot write the sample file $samples" >&2; exit 3; fi
  echo "measure: cgroup=$cg memory.max=$(cat "$d/memory.max") loadavg=$(cut -d' ' -f1-3 /proc/loadavg)"
  # One line per sample: "<rows> <matched> <unsized_kib>". rows counts every process ps reported and matched the
  # unsized node/pnpm processes; the measured command always keeps one running, so either being 0 is a failed sample.
  sample() {
    local procs
    procs=$(paste -sd, "$d/cgroup.procs" 2>/dev/null) || procs=
    if [ -z "$procs" ]; then echo "0 0 0"; return; fi
    ps -o rss=,args= -p "$procs" 2>/dev/null | awk '{n++} ($2 ~ /(^|\/)(node|pnpm)$/ || $2 ~ /pnpm/) && $0 !~ /stryker|vitest|tsgo|oxlint|cargo|rustc/ {m++; s+=$1} END {print n+0, m+0, s+0}'
  }
  parent=$$
  # The sampler drops the inherited heavy-gate lock descriptor (fd 9) and stops when this shell is gone,
  # so a killed measurement cannot leave a loop holding the lock inside the scope.
  # A sampler that stops on its own (an append failed) is detected below: it only ever ends when killed.
  # The first sample is taken after 5 s, once the measured command has started its node/pnpm processes.
  ( exec 9>&-; while python3 -c 'import time; time.sleep(5)' && kill -0 "$parent" 2>/dev/null; do sample >> "$samples" || exit 5; done ) &
  sampler=$!
  trap 'kill "$sampler" 2>/dev/null' EXIT
  start=$(date +%s)
  "$@"; rc=$?
  if kill -0 "$sampler" 2>/dev/null; then kill "$sampler"; sampler_alive=1; else sampler_alive=0; fi
  count=$(wc -l < "$samples" 2>/dev/null) || count=0; count=${count:-0}
  failed=$(awk '$1 == 0 || $2 == 0' "$samples" 2>/dev/null | wc -l)
  peak=$(cat "$d/memory.peak" 2>/dev/null); events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ')
  echo "measure: rc=$rc seconds=$(( $(date +%s) - start )) memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable} samples=$count failed_samples=$failed sampler_alive=$sampler_alive unsized_rss_max_kib=$(awk '{print $3}' "$samples" 2>/dev/null | sort -n | tail -1)"
  if [ "$count" -eq 0 ] || [ "$failed" -ne 0 ] || [ "$sampler_alive" -ne 1 ] || [ -z "$peak" ] || [ -z "$events" ]; then
    echo "measure: INVALID — sampling or cgroup reads failed ($failed of $count samples failed; peak=${peak:-unreadable})" >&2
    [ "$rc" -eq 0 ] && rc=4
  fi
  exit "$rc"
  ```

  `$RUN_TMP/m2.sh` — the scheduler prints `Push gate logs: <dir>` in its summary on every completed run
  (`scripts/run-push-gates.mjs:941-943`); shell mechanics probed with a stub producer: exit status
  passes through `tee` (3 → 3), a missing summary line → `INVALID` exit 6, a green run copies the
  directory and exits 0.

  ```bash
  #!/usr/bin/env bash
  # One-off M2 body: runs inside the measuring agent-gate scope and copies the scheduler's own log directory
  # (named by its "Push gate logs:" summary line) while this run still holds the lock.
  set -u
  out=${M_OUT:?}; dest=${M_DEST:?}
  "$@" | tee "$out"; rc=${PIPESTATUS[0]}
  dir=$(sed -n 's/^Push gate logs: //p' "$out" | tail -1)
  if [ -n "$dir" ] && [ -d "$dir" ] && cp -r "$dir" "$dest"; then echo "m2: evidence copied from $dir"; else echo "m2: INVALID — no scheduler log directory copied (${dir:-none printed})" >&2; [ "$rc" -eq 0 ] && rc=6; fi
  exit "$rc"
  ```

  `$RUN_TMP/m1.sh` — probed outside a gate (session budget): prints
  `m1 sizing: {"budget":7516192768,"slots":1,"cpuShare":1,"runnersPerPackage":5}`, copies the three
  package directories, and an uncopyable destination → `INVALID` exit 6. Inside an `agent-gate` scope
  the same expression printed `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}`.

  ```bash
  #!/usr/bin/env bash
  # One-off M1 body: runs inside the measuring agent-gate scope. Prints the Stryker sizing the code computes in
  # this scope, runs the forced mutation gate, and copies its logs while this run still holds the lock.
  set -u
  dest=${M_DEST:?}
  node --input-type=module -e 'const m = await import("./scripts/gate-parallelism.mjs"); const b = m.gateBudgetBytes(); const {slots, cpuShare} = m.strykerSlots({budgetBytes: b, packageCount: 3}); console.log("m1 sizing: " + JSON.stringify({budget: b, slots, cpuShare, runnersPerPackage: m.workerCount({perWorkerBytes: m.STRYKER_RUNNER_BYTES, baseBytes: m.STRYKER_PARENT_BYTES, budgetBytes: Math.floor(b / slots), env: {...process.env, GATE_CPU_SHARE: String(cpuShare)}})}))' || exit 7
  "$@"; rc=$?
  if cp -r artifacts/mutation/frontend "$dest"; then echo "m1: evidence copied to $dest"; else echo "m1: INVALID — mutation logs not copied" >&2; [ "$rc" -eq 0 ] && rc=6; fi
  exit "$rc"
  ```

  * M2 (first, immediately after the Phase 1 commit, from the repo root):
    `M_OUT=$RUN_TMP/m2.out M_DEST=$RUN_TMP/m2-logs MEASURE_SAMPLES=$RUN_TMP/m2.samples agent-gate bash $RUN_TMP/measure-gate.sh bash $RUN_TMP/m2.sh pnpm gates:push -- --rust --frontend --bindings`
    (the inner `pnpm gates:push` → `agent-gate` runs in place inside the measuring scope).
    Acceptance: exit 0, `oom_kill 0`, `memory.peak` < `memory.max`, no `INVALID` line, and each of
    `$RUN_TMP/m2-logs/{rust-test,rust-coverage,frontend-coverage,e2e,frontend-mutation}.log` contains
    `gate receipt miss:` (a `gate receipt valid:` line voids M2 as a measurement; rerun only after
    removing that one gate's `.gate-receipts/<gate>.json`, which then can only stem from this tree).
  * M1 (second, from the repo root):
    `M_DEST=$RUN_TMP/m1-logs MEASURE_SAMPLES=$RUN_TMP/m1.samples agent-gate bash $RUN_TMP/measure-gate.sh bash $RUN_TMP/m1.sh pnpm gate:run frontend-mutation`.
    Acceptance: exit 0, `oom_kill 0`, `memory.peak` < `memory.max`, no `INVALID` line; every
    `$RUN_TMP/m1-logs/<package>/stryker.log` has a `Creating <N> test runner process(es)` line with `N`
    equal to the printed `runnersPerPackage`; each package's execution interval — its log's first
    timestamped line to its `MutationTestExecutor … Done in` line — overlaps at most `slots - 1` other
    packages' intervals at any instant.
  * Any OOM kill, red lane, `INVALID` or count mismatch stops the phase: no constant is tuned to make a
    run pass; the orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M1/M2 verbatim figures (observed runners per package and slots,
  duration, `memory.peak`, `oom_kill`, load at start) in the `CLAUDE.md` frontend-mutation paragraph
  (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the 8 GiB /
  five-runner / 397.5 s statements; add the gate-scope sentence with M2's `unsized_rss_max_kib` to
  the `UNSIZED_PROCESS_RESERVE_BYTES` comment. If that maximum exceeds 1 GiB, the reserve value is
  raised to the next 0.25 GiB above it and `gate-parallelism-tests.mjs` follows (a measured reason,
  not a tuning).
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and the M1/M2 figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### Round 3 (r3, 548 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness APPROVED · error-handling REVISE.

<details><summary>lens-plan-r3 (raw)</summary>

```text
R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r3 (raw)</summary>

```text
R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r3 (raw)</summary>

```text
R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r3 (raw)</summary>

```text
R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
```

</details>

Closures: R1-02 CLOSED (plan, tests, correctness, error-handling). R1-06 CLOSED (plan, error-handling). R2-02 CLOSED (plan, error-handling). R2-01 CLOSED by tests, correctness, error-handling; NOT CLOSED by review-plan (evidence collected outside the lock) → kept open under its ID. Lineage R1-01/R1-02 → R2-01 has now failed closure twice (R1-02 in r2, R2-01 in r3): per rule 12a the lineage stopped being patched by hand — the source path was traced (`run-push-gates.mjs:941-943` prints the run's log directory; `run-frontend-mutation.mjs:310-312` truncates each package log at start), the corrected collection was probed, and a focused fresh-context `review-plan` judgment is requested in round 4 (`lens-judgment-r4`).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Before/after listing and post-scope copies are not attributable under concurrent same-repo gates: another gate can create a log dir while M2 waits for the lock, and can truncate Stryker logs after M1 releases it | plan r3 | `agent-run:597-606` (waiting happens before the lock), `run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`; stub probe of `m2.sh` (exit passthrough 3→3, missing summary → exit 6, green copy → 0); `m1.sh` probe (copy, bad destination → exit 6) | Fix — evidence is collected inside the measuring scope (lock held): `m2.sh` copies the directory named by the scheduler's own `Push gate logs:` line, `m1.sh` copies the mutation tree before the scope ends | MANDATE re-measure (evidence must belong to the measured run) | open → r4 + judgment |
| R3-01 | Sampler counts rows but not matched node/pnpm processes; a selector that stops matching yields `unsized_rss_max_kib=0` accepted | tests r3 | probe: a run with no node/pnpm → `failed_samples=2` → `INVALID` exit 4 after the fix; first sample delayed 5 s so the measured command's node/pnpm exist (probe: `bash -c "…; node …"` → `failed_samples=0`) | Fix — each sample records `<rows> <matched> <kib>`; rows=0 or matched=0 fails the sample | MANDATE rule (b) reserve evidence | open → r4 |
| R3-02 | A later sample-append failure is unchecked | error-handling r3 | probe: sample file made read-only mid-run → sampler exits 5 on its own → `sampler_alive=0` → `INVALID` exit 4 | Fix — sampler exits on append failure; wrapper treats a sampler that ended before being killed as invalid | MANDATE rule (b) reserve evidence | open → r4 |

Round 3 counts: unique new issues 2 (R3-01, R3-02); residual 1 (R2-01); plan-level adoptions r3=3. Cumulative: r1=4 r2=4 r3=3.

### plan-r5.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. An early one-off wrapper read the scope's `memory.peak` and `memory.events` from inside (`memory.peak=331145216 oom 0 oom_kill 0` for a 300 MiB node process); the current wrapper and its probes are quoted in Phase 2.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES`; its value stays 1 GiB. Its comment
  states both places it applies and why: in a session scope (plain `vitest`), the agent process
  (0.32 GB measured 2026-09-29); in the gate scope, the scheduler, per-lane `pnpm` and `gate-receipt`
  parents and launcher Node processes that no worker count sizes — a named shared-resource reason
  (gate-performance intro), validated by the Phase 2 whole-gate measurement (scope `memory.peak` below
  `memory.max`, zero OOM kills). Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". One measurement M: an all-blocks
`pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh post-Phase-1 tree,
so every receipt lane executes (each lane log shows `gate receipt miss:`) and frontend mutation runs as
the gate runs it (after P2, with the scope's budget). Recorded from the producers' own output: the
**observed** Stryker runner count per package (`Creating <N> test runner process(es)` in each package's
`stryker.log`), the observed package overlap (each log's first timestamped line to its
`MutationTestExecutor … Done in` line), lane durations, and from the scope: `memory.max`,
`memory.peak`, `memory.events` `oom`/`oom_kill`, load average at start. The figures replace the stale
8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and the decision record
carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent. Its gate-scope reason is a
  named shared resource validated by the whole-gate result; no isolated RSS profiler (focused
  judgment, round 4).
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as one orchestrator one-off, no new log lines** (rule 6d): the wrapper in Phase 2
  lives in `$RUN_TMP`, is never committed, and collects every piece of evidence into a fresh
  directory inside the measuring scope, before the scope and its lock end.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is the Phase 2 measurement M, which the f-20260930-03
closure note and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 whole-gate measurement (`memory.peak` below `memory.max`, zero OOM kills). **Rejected:**
   dropping the reserve (unsized processes share the scope's `MemoryMax`); keeping the name
   `AGENT_RESERVE_BYTES` (false inside the gate scope); an isolated RSS profile of those processes
   (not required by gate-performance (b), which accepts a named shared-resource reason). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. The Phase 2 measurement shows whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Resumed Codex write leaves have no user D-Bus (agent-kit `f-20261002-15`, measured 2026-10-02 in the
  Stockfish 19 build): every `agent-gate`-wrapped script — after this change also `gate:ensure` and
  `gate:run` — refuses with exit 125 there. Fix briefs report that refusal and continue; the
  orchestrator reruns `pnpm checks:pre-review` itself (it must anyway).
* Another session's gate holding the lock makes the measurement and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `! git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'` exits 0 and prints nothing (`git grep` exits 1 on no match, hence the `!`; the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)

Depends on Phase 1 (the measurement exercises its committed route; nothing may record a receipt on the
post-Phase-1 tree before it). Order: the measurement by the orchestrator, then one `mechanical` write
leaf records the figures.

* Orchestrator one-off (never committed), `$RUN_TMP/measure-gate.sh`. It runs the gate inside the
  measuring scope and copies every piece of evidence into a fresh `mktemp -d` directory before the
  scope (and the heavy-gate lock) ends, so neither a retry nor another gate can supply stale or foreign
  evidence. Probed 2026-10-02 inside real `agent-gate` scopes with a stub producer: green → exit 0 with
  `gate.out`, `gate-logs`, `mutation-logs` collected; red → the gate's exit 3 passes through; no
  `Push gate logs:` line → `INVALID` exit 4; cgroup files unreadable (test hook
  `MEASURE_TEST_CGROUP=/nonexistent`) → `INVALID … memory.max memory.peak memory.events` exit 4;
  unusable `MEASURE_ROOT` → `REFUSED` exit 3; outside a gate scope → `REFUSED` exit 3.

  ```bash
  #!/usr/bin/env bash
  # One-off: run the push gate ("$@") inside the current agent-gate scope and collect its evidence into a fresh
  # directory before the scope (and the heavy-gate lock) ends. Exit: the gate's status, or 3 refused, 4 invalid evidence.
  set -u
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  ev=$(mktemp -d "${MEASURE_ROOT:?MEASURE_ROOT must name a directory}/measure-XXXXXX") || { echo "measure: REFUSED — cannot create an evidence directory" >&2; exit 3; }
  max=$(cat "$d/memory.max" 2>/dev/null) || max=
  echo "measure: evidence=$ev cgroup=$cg memory.max=${max:-unreadable} loadavg=$(cut -d' ' -f1-3 /proc/loadavg)"
  start=$(date +%s)
  "$@" > "$ev/gate.out" 2>&1; rc=$?
  seconds=$(( $(date +%s) - start ))
  cat "$ev/gate.out"
  invalid=
  [ -n "$max" ] || invalid+=" memory.max"
  peak=$(cat "$d/memory.peak" 2>/dev/null) || peak=; [ -n "$peak" ] || invalid+=" memory.peak"
  events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ') || events=; [ -n "$events" ] || invalid+=" memory.events"
  logs=$(sed -n 's/^Push gate logs: //p' "$ev/gate.out" | tail -1)
  { [ -n "$logs" ] && [ -d "$logs" ] && cp -r "$logs" "$ev/gate-logs"; } || invalid+=" scheduler-logs(${logs:-none printed})"
  cp -r artifacts/mutation/frontend "$ev/mutation-logs" 2>/dev/null || invalid+=" mutation-logs"
  echo "measure: rc=$rc seconds=$seconds memory.max=${max:-unreadable} memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable}"
  if [ -n "$invalid" ]; then echo "measure: INVALID — missing evidence:$invalid" >&2; [ "$rc" -eq 0 ] && rc=4; fi
  exit "$rc"
  ```

* Measurement M (immediately after the Phase 1 commit, from the repo root):
  `MEASURE_ROOT=$RUN_TMP agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`
  (the inner `pnpm gates:push` → `agent-gate` runs in place inside the measuring scope). Read only the
  evidence directory this attempt printed (`measure: evidence=…`).
  Acceptance: exit 0; no `INVALID`; `oom_kill 0`; `memory.peak` < `memory.max`; each of
  `gate-logs/{rust-test,rust-coverage,frontend-coverage,e2e,frontend-mutation}.log` contains
  `gate receipt miss:` (a `gate receipt valid:` line voids M; rerun after removing that gate's
  `.gate-receipts/<gate>.json`, which can only stem from this tree); every
  `mutation-logs/<package>/stryker.log` has a `Creating <N> test runner process(es)` line and a
  `MutationTestExecutor … Done in` line. Recorded: `N` per package, the maximum number of packages
  whose intervals overlap, the `frontend-mutation` lane duration, total seconds, `memory.peak`,
  `memory.max`, load at start.
* Any OOM kill, red lane or `INVALID` stops the phase: no constant is tuned to make a run pass; the
  orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M's figures verbatim in the `CLAUDE.md` frontend-mutation
  paragraph (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the
  8 GiB / five-runner / 397.5 s statements; add the gate-scope validation sentence (M's `memory.peak`
  vs `memory.max`, zero OOM kills, date) to the `UNSIZED_PROCESS_RESERVE_BYTES` comment.
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and M's figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### Round 3 (r3, 548 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness APPROVED · error-handling REVISE.

<details><summary>lens-plan-r3 (raw)</summary>

```text
R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r3 (raw)</summary>

```text
R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r3 (raw)</summary>

```text
R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r3 (raw)</summary>

```text
R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
```

</details>

Closures: R1-02 CLOSED (plan, tests, correctness, error-handling). R1-06 CLOSED (plan, error-handling). R2-02 CLOSED (plan, error-handling). R2-01 CLOSED by tests, correctness, error-handling; NOT CLOSED by review-plan (evidence collected outside the lock) → kept open under its ID. Lineage R1-01/R1-02 → R2-01 has now failed closure twice (R1-02 in r2, R2-01 in r3): per rule 12a the lineage stopped being patched by hand — the source path was traced (`run-push-gates.mjs:941-943` prints the run's log directory; `run-frontend-mutation.mjs:310-312` truncates each package log at start), the corrected collection was probed, and a focused fresh-context `review-plan` judgment is requested in round 4 (`lens-judgment-r4`).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Before/after listing and post-scope copies are not attributable under concurrent same-repo gates: another gate can create a log dir while M2 waits for the lock, and can truncate Stryker logs after M1 releases it | plan r3 | `agent-run:597-606` (waiting happens before the lock), `run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`; stub probe of `m2.sh` (exit passthrough 3→3, missing summary → exit 6, green copy → 0); `m1.sh` probe (copy, bad destination → exit 6) | Fix — evidence is collected inside the measuring scope (lock held): `m2.sh` copies the directory named by the scheduler's own `Push gate logs:` line, `m1.sh` copies the mutation tree before the scope ends | MANDATE re-measure (evidence must belong to the measured run) | open → r4 + judgment |
| R3-01 | Sampler counts rows but not matched node/pnpm processes; a selector that stops matching yields `unsized_rss_max_kib=0` accepted | tests r3 | probe: a run with no node/pnpm → `failed_samples=2` → `INVALID` exit 4 after the fix; first sample delayed 5 s so the measured command's node/pnpm exist (probe: `bash -c "…; node …"` → `failed_samples=0`) | Fix — each sample records `<rows> <matched> <kib>`; rows=0 or matched=0 fails the sample | MANDATE rule (b) reserve evidence | open → r4 |
| R3-02 | A later sample-append failure is unchecked | error-handling r3 | probe: sample file made read-only mid-run → sampler exits 5 on its own → `sampler_alive=0` → `INVALID` exit 4 | Fix — sampler exits on append failure; wrapper treats a sampler that ended before being killed as invalid | MANDATE rule (b) reserve evidence | open → r4 |

Round 3 counts: unique new issues 2 (R3-01, R3-02); residual 1 (R2-01); plan-level adoptions r3=3. Cumulative: r1=4 r2=4 r3=3.

### Round 4 (r4, 507 s wall, closure round + focused fresh-context judgment: review-plan, tests, error-handling, review-plan judgment)

Raw verdicts: judgment REVISE · plan REVISE · tests REVISE · error-handling REVISE.

<details><summary>lens-judgment-r4 (raw)</summary>

```text
JUDGMENT: r4 fixes the original concurrent-copy race: M2 identifies the scheduler’s own directory, and both collectors copy before releasing the lock (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:312`; launcher `agent-run:584`). R3-01 and R3-02 are CLOSED against r4: the matched-process check and append/liveness guards address their reported failures, supported by the supplied probes. R2-01 remains open because retrying with an existing destination can leave acceptance reading the previous attempt’s logs. The simplest sufficient mechanism is one fresh all-blocks measurement, collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM evidence inside the held lock into a fresh directory per attempt. The RSS sampler is unnecessary for MANDATE: rule (b) requires measured worker sizing and a recorded reason; the unchanged reserve can name the shared scheduler/receipt processes and be validated through the complete gate’s memory result. Existing producer logs supply runner evidence, though they do not supply isolated overhead RSS. Review should follow obligation scope and ordinary accidental failures; treating this scratch measurement as shipped monitoring software would exceed that scope. Limitation: the complete measurement was not independently executed under the read-only rails; conclusions rely on source and supplied probes (confidence: 90).

OBLIGATION CHANGES:

- Require fresh evidence paths for every measurement attempt; acceptance must inspect that attempt’s paths.
- Remove mandatory isolated-RSS measurement and automatic reserve resizing. Retain the unchanged allowance with an accurate shared-process rationale and whole-gate validation.
- Collect runner counts and intervals during M2; a second full mutation run is unnecessary for the mandated remeasurement.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)

VERDICT: REVISE
```

</details>

<details><summary>lens-plan-r4 (raw)</summary>

```text
R2-01 CLOSED — r4 plan:304–306 selects the scheduler’s emitted log directory; plan:323 preserves mutation logs before scope exit. Producers match these paths (`scripts/run-push-gates.mjs:610–620,943`; `scripts/run-frontend-mutation.mjs:310–312`), and the launcher retains the lock across both copies (`agent-run:584–620`). Supplied probes cover copying and failure propagation.

R3-01 CLOSED — r4 plan:269,283–286 records matched-process counts and rejects zero matches. The supplied real-scope probes distinguish a running node process from no node/pnpm processes.

R3-02 CLOSED — r4 plan:276,281–286 exits the sampler on append failure and rejects premature termination. The supplied mid-run permission probe confirms `sampler_alive=0`, `INVALID`, exit 4.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r4 (raw)</summary>

```text
R3-01 CLOSED — The plan samples `<rows> <matched> <kib>`, rejects either zero count, and delays the first sample; the supplied probes report `INVALID` when no node/pnpm process matches and zero failed samples for a valid node process (plan lines 247–286).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r4 (raw)</summary>

```text
R2-01 CLOSED — M2 copies the scheduler’s own log directory and M1 copies the mutation logs inside the lock-held scope (plan lines 243–245, 293–306; producers at `run-push-gates.mjs:941–943` and `run-frontend-mutation.mjs:310–312`).

R3-01 CLOSED — samples record both process rows and selector matches; either zero marks the sample failed. The supplied no-node probe returned `INVALID` (plan lines 263–269, 283; probe at 247–250).

R3-02 CLOSED — append failure exits the sampler, and an already-ended sampler makes the wrapper emit `INVALID`; the supplied read-only-mid-run probe returned exit 4 (plan lines 274–288; probe at 250).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)

VERDICT: REVISE
```

</details>

**Focused judgment record (rule 12a lineage escalation, R1-01/R1-02 → R2-01).** Contested invariant: Phase 2 evidence must be complete, belong to the measured run, and fail loudly otherwise. Previous answer: three one-off scripts (sampler + M2 + M1) collecting inside the scope. New evidence: source trace (`run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`, `agent-run:584-620`) and the probes above. Judgment (verbatim above): the review was being driven by obligation scope — a scratch measurement reviewed as shipped software; the simplest sufficient mechanism is one fresh all-blocks measurement collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM inside the held lock into a fresh directory per attempt; the isolated RSS sampler is not required by rule (b), which accepts a named shared-resource reason. Resulting obligation changes (adopted): fresh evidence directory per attempt; RSS sampler and automatic reserve resizing removed (reserve unchanged, named reason, validated by the whole gate); M1 folded into the single measurement M. The non-convergence comparison restarts from r4.

Closures: R3-01 CLOSED (plan, tests, error-handling) and R3-02 CLOSED (plan, error-handling) — both then **withdrawn** with the sampler (mechanism removed by the judgment; issues and evidence kept). R2-01 CLOSED by plan and error-handling, NOT CLOSED by the judgment (fixed copy destinations) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Fixed copy destinations let a retry validate the previous attempt's logs (`cp -r` into an existing dir nests the new copy) | judgment r4 | GNU `cp` destination-directory semantics (judgment cites coreutils info); new wrapper: `mktemp -d "$MEASURE_ROOT/measure-XXXXXX"` per attempt; probes: green stub collected `gate.out`, `gate-logs`, `mutation-logs` into a fresh dir; unusable root → `REFUSED` exit 3 | Fix — fresh evidence directory per attempt; acceptance reads only the printed `measure: evidence=` directory | MANDATE re-measure | open → r5 |
| J-1 | The isolated unsized-RSS sampler and conditional reserve resizing exceed MANDATE | judgment r4 (should-fix) | gate-performance intro accepts "a named shared resource" as a cap's reason; `gate-parallelism.mjs:191` subtracts the unchanged reserve | Fix — sampler and resizing removed; reserve reason = named shared processes, validated by M's `memory.peak` < `memory.max` and zero OOM kills; M1 folded into M | MANDATE "size per-step workers under rule (b)" (and rule 6d) | open → r5 |
| R4-01 | `git grep` exits 1 on no match, so the absence scan as an exit-0 proof fails on the intended clean state | tests r4 | `git grep` documented exit status 1 on no match (lens probe) | Fix — proof 1 is `! git -C … grep …` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r5 |
| R4-02 | `PIPESTATUS[0]` ignores a `tee` open failure; a stale summary in `$out` could be parsed | error-handling r4 | GNU `tee` continues when an output open fails | Fix (by withdrawal) — `tee` removed; output is redirected into the fresh evidence directory, so a failed redirect fails the command and no stale file exists | MANDATE re-measure | open → r5 |
| R4-03 | `memory.max` read unchecked | error-handling r4 (should-fix) | probe: cgroup unreadable → `INVALID — missing evidence: memory.max memory.peak memory.events` exit 4 | Fix — `memory.max` joins the evidence guard | MANDATE re-measure | open → r5 |
| R4-04 | A reserve raised after M2 would invalidate M1's sizing figures | plan r4 | — | Withdrawn mechanism — there is no reserve resizing and no separate M1 any more | — | open → r5 (confirm) |

Round 4 counts: unique new issues 5 (J-1, R4-01..R4-04); residual 1 (R2-01); withdrawals: R3-01, R3-02 (sampler), M1/M2 split; plan-level adoptions r4=4 (R2-01, J-1, R4-01, R4-03). Cumulative: r1=4 r2=4 r3=3 r4=4.

### plan-r6.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. An early one-off wrapper read the scope's `memory.peak` and `memory.events` from inside (`memory.peak=331145216 oom 0 oom_kill 0` for a 300 MiB node process); the current wrapper and its probes are quoted in Phase 2.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES`; its value stays 1 GiB. Its comment
  states both places it applies and why: in a session scope (plain `vitest`), the agent process
  (0.32 GB measured 2026-09-29); in the gate scope, the scheduler, per-lane `pnpm` and `gate-receipt`
  parents and launcher Node processes that no worker count sizes — a named shared-resource reason
  (gate-performance intro), validated by the Phase 2 whole-gate measurement (scope `memory.peak` below
  `memory.max`, zero OOM kills). Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". One measurement M: an all-blocks
`pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh post-Phase-1 tree,
so every receipt lane executes (each lane log shows `gate receipt miss:`) and frontend mutation runs as
the gate runs it (after P2, with the scope's budget). Recorded from the producers' own output: the
**observed** Stryker runner count per package (`Creating <N> test runner process(es)` in each package's
`stryker.log`), the observed package overlap (each log's first timestamped line to its
`MutationTestExecutor … Done in` line), lane durations, and from the scope: `memory.max`,
`memory.peak`, `memory.events` `oom`/`oom_kill`, load average at start. The figures replace the stale
8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and the decision record
carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent. Its gate-scope reason is a
  named shared resource validated by the whole-gate result; no isolated RSS profiler (focused
  judgment, round 4).
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as one orchestrator one-off, no new log lines** (rule 6d): the wrapper in Phase 2
  lives in `$RUN_TMP`, is never committed, and collects every piece of evidence into a fresh
  directory inside the measuring scope, before the scope and its lock end.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is the Phase 2 measurement M, which the f-20260930-03
closure note and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 whole-gate measurement (`memory.peak` below `memory.max`, zero OOM kills). **Rejected:**
   dropping the reserve (unsized processes share the scope's `MemoryMax`); keeping the name
   `AGENT_RESERVE_BYTES` (false inside the gate scope); an isolated RSS profile of those processes
   (not required by gate-performance (b), which accepts a named shared-resource reason). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. The Phase 2 measurement shows whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Resumed Codex write leaves have no user D-Bus (agent-kit `f-20261002-15`, measured 2026-10-02 in the
  Stockfish 19 build): every `agent-gate`-wrapped script — after this change also `gate:ensure` and
  `gate:run` — refuses with exit 125 there. Fix briefs report that refusal and continue; the
  orchestrator reruns `pnpm checks:pre-review` itself (it must anyway).
* Another session's gate holding the lock makes the measurement and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'; [ $? -eq 1 ]` succeeds and prints nothing (`git grep` exits 1 on no match and 128 on a fatal error — measured; only 1 passes; the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)

Depends on Phase 1 (the measurement exercises its committed route; nothing may record a receipt on the
post-Phase-1 tree before it). Order: the measurement by the orchestrator, then one `mechanical` write
leaf records the figures.

* Orchestrator one-off (never committed), `$RUN_TMP/measure-gate.sh`. It runs the gate inside the
  measuring scope and copies every piece of evidence into a fresh `mktemp -d` directory before the
  scope (and the heavy-gate lock) ends, so neither a retry nor another gate can supply stale or foreign
  evidence. Probed 2026-10-02 inside real `agent-gate` scopes with a stub producer: green → exit 0 with
  `gate.out`, `gate-logs`, `mutation-logs` collected; red → the gate's exit 3 passes through; no
  `Push gate logs:` line → `INVALID` exit 4; cgroup files unreadable (test hook
  `MEASURE_TEST_CGROUP=/nonexistent`) → `INVALID … memory.max memory.peak memory.events` exit 4;
  unusable `MEASURE_ROOT` → `REFUSED` exit 3; outside a gate scope → `REFUSED` exit 3. With the
  in-scope sizing line added (round 5): a real scope printed
  `expected={"budget":28991029248,"slots":1,"runnersPerPackage":21}`; run from a directory without
  `scripts/` → `INVALID — missing evidence: expected-sizing mutation-logs` exit 4.

  ```bash
  #!/usr/bin/env bash
  # One-off: run the push gate ("$@") inside the current agent-gate scope and collect its evidence into a fresh
  # directory before the scope (and the heavy-gate lock) ends. Exit: the gate's status, or 3 refused, 4 invalid evidence.
  set -u
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  ev=$(mktemp -d "${MEASURE_ROOT:?MEASURE_ROOT must name a directory}/measure-XXXXXX") || { echo "measure: REFUSED — cannot create an evidence directory" >&2; exit 3; }
  max=$(cat "$d/memory.max" 2>/dev/null) || max=
  load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null) || load=
  # The Stryker sizing the code computes in this scope; the sequential schedule gives the mutation lane this same budget.
  expected=$(node --input-type=module -e 'const m = await import("./scripts/gate-parallelism.mjs"); const b = m.gateBudgetBytes(); const {slots, cpuShare} = m.strykerSlots({budgetBytes: b, packageCount: 3}); console.log(JSON.stringify({budget: b, slots, runnersPerPackage: m.workerCount({perWorkerBytes: m.STRYKER_RUNNER_BYTES, baseBytes: m.STRYKER_PARENT_BYTES, budgetBytes: Math.floor(b / slots), env: {...process.env, GATE_CPU_SHARE: String(cpuShare)}})}))' 2>&1) || expected=
  echo "measure: evidence=$ev cgroup=$cg memory.max=${max:-unreadable} loadavg=${load:-unreadable} expected=${expected:-unavailable}"
  start=$(date +%s)
  "$@" > "$ev/gate.out" 2>&1; rc=$?
  seconds=$(( $(date +%s) - start ))
  cat "$ev/gate.out"
  invalid=
  [ -n "$max" ] || invalid+=" memory.max"
  [ -n "$load" ] || invalid+=" loadavg"
  case "$expected" in '{"budget":'*) ;; *) invalid+=" expected-sizing" ;; esac
  peak=$(cat "$d/memory.peak" 2>/dev/null) || peak=; [ -n "$peak" ] || invalid+=" memory.peak"
  events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ') || events=; [ -n "$events" ] || invalid+=" memory.events"
  logs=$(sed -n 's/^Push gate logs: //p' "$ev/gate.out" | tail -1)
  { [ -n "$logs" ] && [ -d "$logs" ] && cp -r "$logs" "$ev/gate-logs"; } || invalid+=" scheduler-logs(${logs:-none printed})"
  cp -r artifacts/mutation/frontend "$ev/mutation-logs" 2>/dev/null || invalid+=" mutation-logs"
  echo "measure: rc=$rc seconds=$seconds memory.max=${max:-unreadable} memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable}"
  if [ -n "$invalid" ]; then echo "measure: INVALID — missing evidence:$invalid" >&2; [ "$rc" -eq 0 ] && rc=4; fi
  exit "$rc"
  ```

* Measurement M (immediately after the Phase 1 commit, from the repo root):
  `MEASURE_ROOT=$RUN_TMP agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`
  (the inner `pnpm gates:push` → `agent-gate` runs in place inside the measuring scope). Read only the
  evidence directory this attempt printed (`measure: evidence=…`).
  Acceptance: exit 0; no `INVALID`; `oom_kill 0`; `memory.peak` < `memory.max`; each of
  `gate-logs/{rust-test,rust-coverage,frontend-coverage,e2e,frontend-mutation}.log` contains
  `gate receipt miss:` (a `gate receipt valid:` line voids M; rerun after removing that gate's
  `.gate-receipts/<gate>.json`, which can only stem from this tree); every
  `mutation-logs/<package>/stryker.log` has a `Creating <N> test runner process(es)` line and a
  `MutationTestExecutor … Done in` line; `N` equals the printed `expected` `runnersPerPackage` and at
  most `expected` `slots` package intervals overlap at any instant (on this machine the scope budget
  is below `ONE_WAVE_BYTES`, so the mutation lane runs after P2 with exactly that budget and CPU
  share 1, `scripts/run-push-gates.mjs:921-931`; a conservative-fallback run would show 5 and fail).
  Recorded: `N` per package, the maximum number of packages
  whose intervals overlap, the `frontend-mutation` lane duration, total seconds, `memory.peak`,
  `memory.max`, load at start.
* Any OOM kill, red lane or `INVALID` stops the phase: no constant is tuned to make a run pass; the
  orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M's figures verbatim in the `CLAUDE.md` frontend-mutation
  paragraph (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the
  8 GiB / five-runner / 397.5 s statements; add the gate-scope validation sentence (M's `memory.peak`
  vs `memory.max`, zero OOM kills, date) to the `UNSIZED_PROCESS_RESERVE_BYTES` comment.
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and M's figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### Round 3 (r3, 548 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness APPROVED · error-handling REVISE.

<details><summary>lens-plan-r3 (raw)</summary>

```text
R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r3 (raw)</summary>

```text
R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r3 (raw)</summary>

```text
R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r3 (raw)</summary>

```text
R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
```

</details>

Closures: R1-02 CLOSED (plan, tests, correctness, error-handling). R1-06 CLOSED (plan, error-handling). R2-02 CLOSED (plan, error-handling). R2-01 CLOSED by tests, correctness, error-handling; NOT CLOSED by review-plan (evidence collected outside the lock) → kept open under its ID. Lineage R1-01/R1-02 → R2-01 has now failed closure twice (R1-02 in r2, R2-01 in r3): per rule 12a the lineage stopped being patched by hand — the source path was traced (`run-push-gates.mjs:941-943` prints the run's log directory; `run-frontend-mutation.mjs:310-312` truncates each package log at start), the corrected collection was probed, and a focused fresh-context `review-plan` judgment is requested in round 4 (`lens-judgment-r4`).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Before/after listing and post-scope copies are not attributable under concurrent same-repo gates: another gate can create a log dir while M2 waits for the lock, and can truncate Stryker logs after M1 releases it | plan r3 | `agent-run:597-606` (waiting happens before the lock), `run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`; stub probe of `m2.sh` (exit passthrough 3→3, missing summary → exit 6, green copy → 0); `m1.sh` probe (copy, bad destination → exit 6) | Fix — evidence is collected inside the measuring scope (lock held): `m2.sh` copies the directory named by the scheduler's own `Push gate logs:` line, `m1.sh` copies the mutation tree before the scope ends | MANDATE re-measure (evidence must belong to the measured run) | open → r4 + judgment |
| R3-01 | Sampler counts rows but not matched node/pnpm processes; a selector that stops matching yields `unsized_rss_max_kib=0` accepted | tests r3 | probe: a run with no node/pnpm → `failed_samples=2` → `INVALID` exit 4 after the fix; first sample delayed 5 s so the measured command's node/pnpm exist (probe: `bash -c "…; node …"` → `failed_samples=0`) | Fix — each sample records `<rows> <matched> <kib>`; rows=0 or matched=0 fails the sample | MANDATE rule (b) reserve evidence | open → r4 |
| R3-02 | A later sample-append failure is unchecked | error-handling r3 | probe: sample file made read-only mid-run → sampler exits 5 on its own → `sampler_alive=0` → `INVALID` exit 4 | Fix — sampler exits on append failure; wrapper treats a sampler that ended before being killed as invalid | MANDATE rule (b) reserve evidence | open → r4 |

Round 3 counts: unique new issues 2 (R3-01, R3-02); residual 1 (R2-01); plan-level adoptions r3=3. Cumulative: r1=4 r2=4 r3=3.

### Round 4 (r4, 507 s wall, closure round + focused fresh-context judgment: review-plan, tests, error-handling, review-plan judgment)

Raw verdicts: judgment REVISE · plan REVISE · tests REVISE · error-handling REVISE.

<details><summary>lens-judgment-r4 (raw)</summary>

```text
JUDGMENT: r4 fixes the original concurrent-copy race: M2 identifies the scheduler’s own directory, and both collectors copy before releasing the lock (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:312`; launcher `agent-run:584`). R3-01 and R3-02 are CLOSED against r4: the matched-process check and append/liveness guards address their reported failures, supported by the supplied probes. R2-01 remains open because retrying with an existing destination can leave acceptance reading the previous attempt’s logs. The simplest sufficient mechanism is one fresh all-blocks measurement, collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM evidence inside the held lock into a fresh directory per attempt. The RSS sampler is unnecessary for MANDATE: rule (b) requires measured worker sizing and a recorded reason; the unchanged reserve can name the shared scheduler/receipt processes and be validated through the complete gate’s memory result. Existing producer logs supply runner evidence, though they do not supply isolated overhead RSS. Review should follow obligation scope and ordinary accidental failures; treating this scratch measurement as shipped monitoring software would exceed that scope. Limitation: the complete measurement was not independently executed under the read-only rails; conclusions rely on source and supplied probes (confidence: 90).

OBLIGATION CHANGES:

- Require fresh evidence paths for every measurement attempt; acceptance must inspect that attempt’s paths.
- Remove mandatory isolated-RSS measurement and automatic reserve resizing. Retain the unchanged allowance with an accurate shared-process rationale and whole-gate validation.
- Collect runner counts and intervals during M2; a second full mutation run is unnecessary for the mandated remeasurement.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)

VERDICT: REVISE
```

</details>

<details><summary>lens-plan-r4 (raw)</summary>

```text
R2-01 CLOSED — r4 plan:304–306 selects the scheduler’s emitted log directory; plan:323 preserves mutation logs before scope exit. Producers match these paths (`scripts/run-push-gates.mjs:610–620,943`; `scripts/run-frontend-mutation.mjs:310–312`), and the launcher retains the lock across both copies (`agent-run:584–620`). Supplied probes cover copying and failure propagation.

R3-01 CLOSED — r4 plan:269,283–286 records matched-process counts and rejects zero matches. The supplied real-scope probes distinguish a running node process from no node/pnpm processes.

R3-02 CLOSED — r4 plan:276,281–286 exits the sampler on append failure and rejects premature termination. The supplied mid-run permission probe confirms `sampler_alive=0`, `INVALID`, exit 4.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r4 (raw)</summary>

```text
R3-01 CLOSED — The plan samples `<rows> <matched> <kib>`, rejects either zero count, and delays the first sample; the supplied probes report `INVALID` when no node/pnpm process matches and zero failed samples for a valid node process (plan lines 247–286).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r4 (raw)</summary>

```text
R2-01 CLOSED — M2 copies the scheduler’s own log directory and M1 copies the mutation logs inside the lock-held scope (plan lines 243–245, 293–306; producers at `run-push-gates.mjs:941–943` and `run-frontend-mutation.mjs:310–312`).

R3-01 CLOSED — samples record both process rows and selector matches; either zero marks the sample failed. The supplied no-node probe returned `INVALID` (plan lines 263–269, 283; probe at 247–250).

R3-02 CLOSED — append failure exits the sampler, and an already-ended sampler makes the wrapper emit `INVALID`; the supplied read-only-mid-run probe returned exit 4 (plan lines 274–288; probe at 250).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)

VERDICT: REVISE
```

</details>

**Focused judgment record (rule 12a lineage escalation, R1-01/R1-02 → R2-01).** Contested invariant: Phase 2 evidence must be complete, belong to the measured run, and fail loudly otherwise. Previous answer: three one-off scripts (sampler + M2 + M1) collecting inside the scope. New evidence: source trace (`run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`, `agent-run:584-620`) and the probes above. Judgment (verbatim above): the review was being driven by obligation scope — a scratch measurement reviewed as shipped software; the simplest sufficient mechanism is one fresh all-blocks measurement collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM inside the held lock into a fresh directory per attempt; the isolated RSS sampler is not required by rule (b), which accepts a named shared-resource reason. Resulting obligation changes (adopted): fresh evidence directory per attempt; RSS sampler and automatic reserve resizing removed (reserve unchanged, named reason, validated by the whole gate); M1 folded into the single measurement M. The non-convergence comparison restarts from r4.

Closures: R3-01 CLOSED (plan, tests, error-handling) and R3-02 CLOSED (plan, error-handling) — both then **withdrawn** with the sampler (mechanism removed by the judgment; issues and evidence kept). R2-01 CLOSED by plan and error-handling, NOT CLOSED by the judgment (fixed copy destinations) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Fixed copy destinations let a retry validate the previous attempt's logs (`cp -r` into an existing dir nests the new copy) | judgment r4 | GNU `cp` destination-directory semantics (judgment cites coreutils info); new wrapper: `mktemp -d "$MEASURE_ROOT/measure-XXXXXX"` per attempt; probes: green stub collected `gate.out`, `gate-logs`, `mutation-logs` into a fresh dir; unusable root → `REFUSED` exit 3 | Fix — fresh evidence directory per attempt; acceptance reads only the printed `measure: evidence=` directory | MANDATE re-measure | open → r5 |
| J-1 | The isolated unsized-RSS sampler and conditional reserve resizing exceed MANDATE | judgment r4 (should-fix) | gate-performance intro accepts "a named shared resource" as a cap's reason; `gate-parallelism.mjs:191` subtracts the unchanged reserve | Fix — sampler and resizing removed; reserve reason = named shared processes, validated by M's `memory.peak` < `memory.max` and zero OOM kills; M1 folded into M | MANDATE "size per-step workers under rule (b)" (and rule 6d) | open → r5 |
| R4-01 | `git grep` exits 1 on no match, so the absence scan as an exit-0 proof fails on the intended clean state | tests r4 | `git grep` documented exit status 1 on no match (lens probe) | Fix — proof 1 is `! git -C … grep …` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r5 |
| R4-02 | `PIPESTATUS[0]` ignores a `tee` open failure; a stale summary in `$out` could be parsed | error-handling r4 | GNU `tee` continues when an output open fails | Fix (by withdrawal) — `tee` removed; output is redirected into the fresh evidence directory, so a failed redirect fails the command and no stale file exists | MANDATE re-measure | open → r5 |
| R4-03 | `memory.max` read unchecked | error-handling r4 (should-fix) | probe: cgroup unreadable → `INVALID — missing evidence: memory.max memory.peak memory.events` exit 4 | Fix — `memory.max` joins the evidence guard | MANDATE re-measure | open → r5 |
| R4-04 | A reserve raised after M2 would invalidate M1's sizing figures | plan r4 | — | Withdrawn mechanism — there is no reserve resizing and no separate M1 any more | — | open → r5 (confirm) |

Round 4 counts: unique new issues 5 (J-1, R4-01..R4-04); residual 1 (R2-01); withdrawals: R3-01, R3-02 (sampler), M1/M2 split; plan-level adoptions r4=4 (R2-01, J-1, R4-01, R4-03). Cumulative: r1=4 r2=4 r3=3 r4=4.

### Round 5 (r5, 1114 s wall, closure round: review-plan, tests, error-handling, minimalism)

Raw verdicts: plan APPROVED · tests REVISE · error-handling REVISE · minimalism APPROVED.

<details><summary>lens-plan-r5 (raw)</summary>

```text
R2-01 CLOSED — r5 plan:263,275–276,284–285 creates fresh destinations and restricts acceptance to this attempt’s directory. Copies match the producers’ layouts (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`) and occur inside the held lock.

J-1 CLOSED — r5 plan:109–121,282–299 removes isolated RSS sampling and reserve resizing. One measurement records observed runners and validates the unchanged reserve; `gate-performance.md:10–12` permits the named shared-resource rationale.

R4-01 CLOSED — r5 plan:235 negates the absence scan, making the supplied no-match exit status of 1 satisfy the proof.

R4-02 CLOSED — r5 plan:263,267,274 removes `tee` and parses output redirected into the fresh directory. The quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:7,11,18`.

R4-03 CLOSED — r5 plan:264,271,278 includes unreadable `memory.max` in the invalid-evidence guard; the supplied correction probe confirms exit 4.

R4-04 CLOSED — r5 plan:109,296–299 keeps the reserve unchanged and records one measurement. The post-measurement budget change that invalidated runner figures (`scripts/gate-parallelism.mjs:191`) is withdrawn.

LATE OBSERVATIONS

Limitation — Live scope behaviour and full measurement M were not independently executed under the read-only rails; closure relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r5 (raw)</summary>

```text
R2-01 CLOSED — Each attempt gets a fresh `mktemp` evidence directory, and acceptance reads only the printed path; the supplied probes cover collection and an unusable root.

J-1 CLOSED — The sampler and reserve resizing are removed. The single whole-gate measurement checks peak memory and OOM events.

R4-01 CLOSED — The `! git grep` proof handles the no-match exit status and requires no output.

R4-02 CLOSED — `tee` and its reusable summary path are removed; output goes to the fresh evidence directory, and a missing scheduler-log line is rejected.

R4-03 CLOSED — Unreadable `memory.max` is marked invalid; the supplied cgroup-read probe exits 4.

R4-04 CLOSED — There is one measurement and no reserve resizing, so separate M1/M2 measurements cannot invalidate each other.

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:290` — M accepts any `Creating <N>` line and records its value, but never checks that N follows rule (b) for the measured scope. A regression that leaves Stryker at the conservative five-runner count despite a readable 27 GiB budget would still satisfy the log, peak-memory, and OOM checks. Require comparison with the count computed from the measured scope, or capture and validate the reason for an allowed fallback. (confidence: 89)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r5 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, and acceptance reads only the printed path; the supplied probe confirms collection.

J-1 CLOSED — the sampler and reserve resizing are removed; the reserve stays fixed with a named shared-process reason, checked against whole-gate memory and OOM evidence.

R4-01 CLOSED — `! git grep` makes the no-match case exit 0 with no match output.

R4-02 CLOSED — output goes directly to `gate.out` in the fresh directory; missing scheduler logs mark evidence invalid.

R4-03 CLOSED — a failed `memory.max` read leaves the value empty and triggers the evidence guard.

R4-04 CLOSED — there is no reserve adjustment or separate M1 measurement.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:235 — `!` also turns fatal `git grep` errors into exit 0. The diagnostic remains visible, but a proof consumer checking only the exit status can treat an incomplete scan as success. (confidence: 91)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:265 — If `cut` cannot read `/proc/loadavg`, the wrapper prints an empty `loadavg=` field but never marks the evidence invalid; the enclosing `echo` succeeds, and acceptance does not require that field. Measurement M can therefore exit 0 without the load-at-start value O5 requires. (confidence: 95)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r5 (raw)</summary>

```text
R2-01 CLOSED — plan:247–250,282–285 uses a fresh evidence directory per attempt and reads only the printed directory.
J-1 CLOSED — plan:109–121,125–132 removes RSS sampling and reserve resizing; one whole-gate measurement validates the unchanged reserve.
R4-01 CLOSED — plan:235 negates `git grep` so no matches pass.
R4-02 CLOSED — plan:267 redirects output to the fresh `gate.out`; no `tee` or stale summary path remains.
R4-03 CLOSED — plan:264,271–273 checks `memory.max` and rejects missing cgroup evidence.
R4-04 CLOSED — plan:109–121,125–128 keeps the reserve fixed and uses one measurement; no separate M1 remains.
VERDICT: APPROVED
```

</details>

Closures: R2-01, J-1, R4-01, R4-02, R4-03, R4-04 CLOSED by every witness (plan, tests, error-handling, minimalism).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 | M records any observed `N`; a sizing regression to the conservative 5 runners would pass | tests r5 | `run-push-gates.mjs:921-931` (sequential mutation lane gets the scheduler's budget, CPU share 1); probe: in-scope expression prints `{"budget":28991029248,"slots":1,"runnersPerPackage":21}`; without `scripts/` → `INVALID … expected-sizing` exit 4 | Fix — the wrapper prints the in-scope expected sizing; acceptance requires `N` = expected `runnersPerPackage` and overlap ≤ expected `slots` | MANDATE "re-measure Stryker's runner count inside the gate scope" and "size per-step workers under rule (b)" | open → r6 |
| R5-02 | `! git grep` turns a fatal error (exit 128) into success | error-handling r5 (should-fix) | measured: no match → exit 1; invalid pattern → exit 128 | Fix — `…; [ $? -eq 1 ]` | MANDATE retirement proof | open → r6 |
| R5-03 | An unreadable `/proc/loadavg` leaves the load-at-start field empty without `INVALID` | error-handling r5 | script read | Fix — `loadavg` joins the evidence guard | O5 records load at start | open → r6 |

Round 5 counts: unique new issues 3; plan-level adoptions r5=3 (counted from the restart at r4: r4=4, r5=3). Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3.

### plan-r7.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. An early one-off wrapper read the scope's `memory.peak` and `memory.events` from inside (`memory.peak=331145216 oom 0 oom_kill 0` for a 300 MiB node process); the current wrapper and its probes are quoted in Phase 2.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES`; its value stays 1 GiB. Its comment
  states both places it applies and why: in a session scope (plain `vitest`), the agent process
  (0.32 GB measured 2026-09-29); in the gate scope, the scheduler, per-lane `pnpm` and `gate-receipt`
  parents and launcher Node processes that no worker count sizes — a named shared-resource reason
  (gate-performance intro), validated by the Phase 2 whole-gate measurement (scope `memory.peak` below
  `memory.max`, zero OOM kills). Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". One measurement M: an all-blocks
`pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh post-Phase-1 tree,
so every receipt lane executes (each lane log shows `gate receipt miss:`) and frontend mutation runs as
the gate runs it (after P2, with the scope's budget). Recorded from the producers' own output: the
**observed** Stryker runner count per package (`Creating <N> test runner process(es)` in each package's
`stryker.log`), the observed package overlap (each log's first timestamped line to its
`MutationTestExecutor … Done in` line), lane durations, and from the scope: `memory.max`,
`memory.peak`, `memory.events` `oom`/`oom_kill`, load average at start. The figures replace the stale
8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and the decision record
carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent. Its gate-scope reason is a
  named shared resource validated by the whole-gate result; no isolated RSS profiler (focused
  judgment, round 4).
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as one orchestrator one-off, no new log lines** (rule 6d): the wrapper in Phase 2
  lives in `$RUN_TMP`, is never committed, and collects every piece of evidence into a fresh
  directory inside the measuring scope, before the scope and its lock end.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is the Phase 2 measurement M, which the f-20260930-03
closure note and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 whole-gate measurement (`memory.peak` below `memory.max`, zero OOM kills). **Rejected:**
   dropping the reserve (unsized processes share the scope's `MemoryMax`); keeping the name
   `AGENT_RESERVE_BYTES` (false inside the gate scope); an isolated RSS profile of those processes
   (not required by gate-performance (b), which accepts a named shared-resource reason). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. The Phase 2 measurement shows whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Resumed Codex write leaves have no user D-Bus (agent-kit `f-20261002-15`, measured 2026-10-02 in the
  Stockfish 19 build): every `agent-gate`-wrapped script — after this change also `gate:ensure` and
  `gate:run` — refuses with exit 125 there. Fix briefs report that refusal and continue; the
  orchestrator reruns `pnpm checks:pre-review` itself (it must anyway).
* Another session's gate holding the lock makes the measurement and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'; [ $? -eq 1 ]` succeeds and prints nothing (`git grep` exits 1 on no match and 128 on a fatal error — measured; only 1 passes; the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)

Depends on Phase 1 (the measurement exercises its committed route; nothing may record a receipt on the
post-Phase-1 tree before it). Order: the measurement by the orchestrator, then one `mechanical` write
leaf records the figures.

* Orchestrator one-off (never committed), `$RUN_TMP/measure-gate.sh`. It runs the gate inside the
  measuring scope and copies every piece of evidence into a fresh `mktemp -d` directory before the
  scope (and the heavy-gate lock) ends, so neither a retry nor another gate can supply stale or foreign
  evidence. Probed 2026-10-02 inside real `agent-gate` scopes with a stub producer: green → exit 0 with
  `gate.out`, `gate-logs`, `mutation-logs` collected; red → the gate's exit 3 passes through; no
  `Push gate logs:` line → `INVALID` exit 4; cgroup files unreadable (test hook
  `MEASURE_TEST_CGROUP=/nonexistent`) → `INVALID … memory.max memory.peak memory.events` exit 4;
  unusable `MEASURE_ROOT` → `REFUSED` exit 3; outside a gate scope → `REFUSED` exit 3. With the
  in-scope sizing line added (round 5): a real scope printed
  `expected={"budget":28991029248,"slots":1,"runnersPerPackage":21}`; run from a directory without
  `scripts/` → `measure: sizing probe failed: <node diagnostic>` and `INVALID — missing evidence:
  expected-sizing …` exit 4.

  ```bash
  #!/usr/bin/env bash
  # One-off: run the push gate ("$@") inside the current agent-gate scope and collect its evidence into a fresh
  # directory before the scope (and the heavy-gate lock) ends. Exit: the gate's status, or 3 refused, 4 invalid evidence.
  set -u
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  ev=$(mktemp -d "${MEASURE_ROOT:?MEASURE_ROOT must name a directory}/measure-XXXXXX") || { echo "measure: REFUSED — cannot create an evidence directory" >&2; exit 3; }
  max=$(cat "$d/memory.max" 2>/dev/null) || max=
  load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null) || load=
  # The Stryker sizing the code computes in this scope; the sequential schedule gives the mutation lane this same budget.
  expected=$(node --input-type=module -e 'const m = await import("./scripts/gate-parallelism.mjs"); const b = m.gateBudgetBytes(); const {slots, cpuShare} = m.strykerSlots({budgetBytes: b, packageCount: 3}); console.log(JSON.stringify({budget: b, slots, runnersPerPackage: m.workerCount({perWorkerBytes: m.STRYKER_RUNNER_BYTES, baseBytes: m.STRYKER_PARENT_BYTES, budgetBytes: Math.floor(b / slots), env: {...process.env, GATE_CPU_SHARE: String(cpuShare)}})}))' 2>&1) || { echo "measure: sizing probe failed: $expected" >&2; expected=; }
  echo "measure: evidence=$ev cgroup=$cg memory.max=${max:-unreadable} loadavg=${load:-unreadable} expected=${expected:-unavailable}"
  start=$(date +%s)
  "$@" > "$ev/gate.out" 2>&1; rc=$?
  seconds=$(( $(date +%s) - start ))
  cat "$ev/gate.out"
  invalid=
  [ -n "$max" ] || invalid+=" memory.max"
  [ -n "$load" ] || invalid+=" loadavg"
  case "$expected" in '{"budget":'*) ;; *) invalid+=" expected-sizing" ;; esac
  peak=$(cat "$d/memory.peak" 2>/dev/null) || peak=; [ -n "$peak" ] || invalid+=" memory.peak"
  events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ') || events=; [ -n "$events" ] || invalid+=" memory.events"
  logs=$(sed -n 's/^Push gate logs: //p' "$ev/gate.out" | tail -1)
  { [ -n "$logs" ] && [ -d "$logs" ] && cp -r "$logs" "$ev/gate-logs"; } || invalid+=" scheduler-logs(${logs:-none printed})"
  cp -r artifacts/mutation/frontend "$ev/mutation-logs" 2>/dev/null || invalid+=" mutation-logs"
  echo "measure: rc=$rc seconds=$seconds memory.max=${max:-unreadable} memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable}"
  if [ -n "$invalid" ]; then echo "measure: INVALID — missing evidence:$invalid" >&2; [ "$rc" -eq 0 ] && rc=4; fi
  exit "$rc"
  ```

* Measurement M (immediately after the Phase 1 commit, from the repo root):
  `MEASURE_ROOT=$RUN_TMP agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`
  (the inner `pnpm gates:push` → `agent-gate` runs in place inside the measuring scope). Read only the
  evidence directory this attempt printed (`measure: evidence=…`).
  Acceptance: exit 0; no `INVALID`; `oom_kill 0`; `memory.peak` < `memory.max`; each of
  `gate-logs/{rust-test,rust-coverage,frontend-coverage,e2e,frontend-mutation}.log` contains
  `gate receipt miss:` (a `gate receipt valid:` line voids M; rerun after removing that gate's
  `.gate-receipts/<gate>.json`, which can only stem from this tree); every
  `mutation-logs/<package>/stryker.log` has a `Creating <N> test runner process(es)` line and a
  `MutationTestExecutor … Done in` line; `N` equals the printed `expected` `runnersPerPackage` and at
  most `expected` `slots` package intervals overlap at any instant (on this machine the scope budget
  is below `ONE_WAVE_BYTES`, so the mutation lane runs after P2 with exactly that budget and CPU
  share 1, `scripts/run-push-gates.mjs:921-931`). Independently of the sizing code, the printed
  `expected` must also match the scope arithmetic from the recorded constants: `budget` =
  `memory.max` − 1 GiB (the reserve), and `runnersPerPackage` = min(CPU count,
  ⌊(`budget` − 640 MiB) / 1.2 GiB⌋) at `slots` 1 — on tuxedo-atlas (`memory.max` 30064771072, 24 CPUs)
  `budget` 28991029248 and 21 runners (computed 2026-10-02); a sizing regression (e.g. the
  conservative five) fails this even when expected and observed agree.
  Recorded: `N` per package, the maximum number of packages
  whose intervals overlap, the `frontend-mutation` lane duration, total seconds, `memory.peak`,
  `memory.max`, load at start.
* Any OOM kill, red lane or `INVALID` stops the phase: no constant is tuned to make a run pass; the
  orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M's figures verbatim in the `CLAUDE.md` frontend-mutation
  paragraph (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the
  8 GiB / five-runner / 397.5 s statements; add the gate-scope validation sentence (M's `memory.peak`
  vs `memory.max`, zero OOM kills, date) to the `UNSIZED_PROCESS_RESERVE_BYTES` comment.
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and M's figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### Round 3 (r3, 548 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness APPROVED · error-handling REVISE.

<details><summary>lens-plan-r3 (raw)</summary>

```text
R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r3 (raw)</summary>

```text
R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r3 (raw)</summary>

```text
R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r3 (raw)</summary>

```text
R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
```

</details>

Closures: R1-02 CLOSED (plan, tests, correctness, error-handling). R1-06 CLOSED (plan, error-handling). R2-02 CLOSED (plan, error-handling). R2-01 CLOSED by tests, correctness, error-handling; NOT CLOSED by review-plan (evidence collected outside the lock) → kept open under its ID. Lineage R1-01/R1-02 → R2-01 has now failed closure twice (R1-02 in r2, R2-01 in r3): per rule 12a the lineage stopped being patched by hand — the source path was traced (`run-push-gates.mjs:941-943` prints the run's log directory; `run-frontend-mutation.mjs:310-312` truncates each package log at start), the corrected collection was probed, and a focused fresh-context `review-plan` judgment is requested in round 4 (`lens-judgment-r4`).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Before/after listing and post-scope copies are not attributable under concurrent same-repo gates: another gate can create a log dir while M2 waits for the lock, and can truncate Stryker logs after M1 releases it | plan r3 | `agent-run:597-606` (waiting happens before the lock), `run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`; stub probe of `m2.sh` (exit passthrough 3→3, missing summary → exit 6, green copy → 0); `m1.sh` probe (copy, bad destination → exit 6) | Fix — evidence is collected inside the measuring scope (lock held): `m2.sh` copies the directory named by the scheduler's own `Push gate logs:` line, `m1.sh` copies the mutation tree before the scope ends | MANDATE re-measure (evidence must belong to the measured run) | open → r4 + judgment |
| R3-01 | Sampler counts rows but not matched node/pnpm processes; a selector that stops matching yields `unsized_rss_max_kib=0` accepted | tests r3 | probe: a run with no node/pnpm → `failed_samples=2` → `INVALID` exit 4 after the fix; first sample delayed 5 s so the measured command's node/pnpm exist (probe: `bash -c "…; node …"` → `failed_samples=0`) | Fix — each sample records `<rows> <matched> <kib>`; rows=0 or matched=0 fails the sample | MANDATE rule (b) reserve evidence | open → r4 |
| R3-02 | A later sample-append failure is unchecked | error-handling r3 | probe: sample file made read-only mid-run → sampler exits 5 on its own → `sampler_alive=0` → `INVALID` exit 4 | Fix — sampler exits on append failure; wrapper treats a sampler that ended before being killed as invalid | MANDATE rule (b) reserve evidence | open → r4 |

Round 3 counts: unique new issues 2 (R3-01, R3-02); residual 1 (R2-01); plan-level adoptions r3=3. Cumulative: r1=4 r2=4 r3=3.

### Round 4 (r4, 507 s wall, closure round + focused fresh-context judgment: review-plan, tests, error-handling, review-plan judgment)

Raw verdicts: judgment REVISE · plan REVISE · tests REVISE · error-handling REVISE.

<details><summary>lens-judgment-r4 (raw)</summary>

```text
JUDGMENT: r4 fixes the original concurrent-copy race: M2 identifies the scheduler’s own directory, and both collectors copy before releasing the lock (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:312`; launcher `agent-run:584`). R3-01 and R3-02 are CLOSED against r4: the matched-process check and append/liveness guards address their reported failures, supported by the supplied probes. R2-01 remains open because retrying with an existing destination can leave acceptance reading the previous attempt’s logs. The simplest sufficient mechanism is one fresh all-blocks measurement, collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM evidence inside the held lock into a fresh directory per attempt. The RSS sampler is unnecessary for MANDATE: rule (b) requires measured worker sizing and a recorded reason; the unchanged reserve can name the shared scheduler/receipt processes and be validated through the complete gate’s memory result. Existing producer logs supply runner evidence, though they do not supply isolated overhead RSS. Review should follow obligation scope and ordinary accidental failures; treating this scratch measurement as shipped monitoring software would exceed that scope. Limitation: the complete measurement was not independently executed under the read-only rails; conclusions rely on source and supplied probes (confidence: 90).

OBLIGATION CHANGES:

- Require fresh evidence paths for every measurement attempt; acceptance must inspect that attempt’s paths.
- Remove mandatory isolated-RSS measurement and automatic reserve resizing. Retain the unchanged allowance with an accurate shared-process rationale and whole-gate validation.
- Collect runner counts and intervals during M2; a second full mutation run is unnecessary for the mandated remeasurement.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)

VERDICT: REVISE
```

</details>

<details><summary>lens-plan-r4 (raw)</summary>

```text
R2-01 CLOSED — r4 plan:304–306 selects the scheduler’s emitted log directory; plan:323 preserves mutation logs before scope exit. Producers match these paths (`scripts/run-push-gates.mjs:610–620,943`; `scripts/run-frontend-mutation.mjs:310–312`), and the launcher retains the lock across both copies (`agent-run:584–620`). Supplied probes cover copying and failure propagation.

R3-01 CLOSED — r4 plan:269,283–286 records matched-process counts and rejects zero matches. The supplied real-scope probes distinguish a running node process from no node/pnpm processes.

R3-02 CLOSED — r4 plan:276,281–286 exits the sampler on append failure and rejects premature termination. The supplied mid-run permission probe confirms `sampler_alive=0`, `INVALID`, exit 4.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r4 (raw)</summary>

```text
R3-01 CLOSED — The plan samples `<rows> <matched> <kib>`, rejects either zero count, and delays the first sample; the supplied probes report `INVALID` when no node/pnpm process matches and zero failed samples for a valid node process (plan lines 247–286).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r4 (raw)</summary>

```text
R2-01 CLOSED — M2 copies the scheduler’s own log directory and M1 copies the mutation logs inside the lock-held scope (plan lines 243–245, 293–306; producers at `run-push-gates.mjs:941–943` and `run-frontend-mutation.mjs:310–312`).

R3-01 CLOSED — samples record both process rows and selector matches; either zero marks the sample failed. The supplied no-node probe returned `INVALID` (plan lines 263–269, 283; probe at 247–250).

R3-02 CLOSED — append failure exits the sampler, and an already-ended sampler makes the wrapper emit `INVALID`; the supplied read-only-mid-run probe returned exit 4 (plan lines 274–288; probe at 250).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)

VERDICT: REVISE
```

</details>

**Focused judgment record (rule 12a lineage escalation, R1-01/R1-02 → R2-01).** Contested invariant: Phase 2 evidence must be complete, belong to the measured run, and fail loudly otherwise. Previous answer: three one-off scripts (sampler + M2 + M1) collecting inside the scope. New evidence: source trace (`run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`, `agent-run:584-620`) and the probes above. Judgment (verbatim above): the review was being driven by obligation scope — a scratch measurement reviewed as shipped software; the simplest sufficient mechanism is one fresh all-blocks measurement collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM inside the held lock into a fresh directory per attempt; the isolated RSS sampler is not required by rule (b), which accepts a named shared-resource reason. Resulting obligation changes (adopted): fresh evidence directory per attempt; RSS sampler and automatic reserve resizing removed (reserve unchanged, named reason, validated by the whole gate); M1 folded into the single measurement M. The non-convergence comparison restarts from r4.

Closures: R3-01 CLOSED (plan, tests, error-handling) and R3-02 CLOSED (plan, error-handling) — both then **withdrawn** with the sampler (mechanism removed by the judgment; issues and evidence kept). R2-01 CLOSED by plan and error-handling, NOT CLOSED by the judgment (fixed copy destinations) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Fixed copy destinations let a retry validate the previous attempt's logs (`cp -r` into an existing dir nests the new copy) | judgment r4 | GNU `cp` destination-directory semantics (judgment cites coreutils info); new wrapper: `mktemp -d "$MEASURE_ROOT/measure-XXXXXX"` per attempt; probes: green stub collected `gate.out`, `gate-logs`, `mutation-logs` into a fresh dir; unusable root → `REFUSED` exit 3 | Fix — fresh evidence directory per attempt; acceptance reads only the printed `measure: evidence=` directory | MANDATE re-measure | open → r5 |
| J-1 | The isolated unsized-RSS sampler and conditional reserve resizing exceed MANDATE | judgment r4 (should-fix) | gate-performance intro accepts "a named shared resource" as a cap's reason; `gate-parallelism.mjs:191` subtracts the unchanged reserve | Fix — sampler and resizing removed; reserve reason = named shared processes, validated by M's `memory.peak` < `memory.max` and zero OOM kills; M1 folded into M | MANDATE "size per-step workers under rule (b)" (and rule 6d) | open → r5 |
| R4-01 | `git grep` exits 1 on no match, so the absence scan as an exit-0 proof fails on the intended clean state | tests r4 | `git grep` documented exit status 1 on no match (lens probe) | Fix — proof 1 is `! git -C … grep …` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r5 |
| R4-02 | `PIPESTATUS[0]` ignores a `tee` open failure; a stale summary in `$out` could be parsed | error-handling r4 | GNU `tee` continues when an output open fails | Fix (by withdrawal) — `tee` removed; output is redirected into the fresh evidence directory, so a failed redirect fails the command and no stale file exists | MANDATE re-measure | open → r5 |
| R4-03 | `memory.max` read unchecked | error-handling r4 (should-fix) | probe: cgroup unreadable → `INVALID — missing evidence: memory.max memory.peak memory.events` exit 4 | Fix — `memory.max` joins the evidence guard | MANDATE re-measure | open → r5 |
| R4-04 | A reserve raised after M2 would invalidate M1's sizing figures | plan r4 | — | Withdrawn mechanism — there is no reserve resizing and no separate M1 any more | — | open → r5 (confirm) |

Round 4 counts: unique new issues 5 (J-1, R4-01..R4-04); residual 1 (R2-01); withdrawals: R3-01, R3-02 (sampler), M1/M2 split; plan-level adoptions r4=4 (R2-01, J-1, R4-01, R4-03). Cumulative: r1=4 r2=4 r3=3 r4=4.

### Round 5 (r5, 1114 s wall, closure round: review-plan, tests, error-handling, minimalism)

Raw verdicts: plan APPROVED · tests REVISE · error-handling REVISE · minimalism APPROVED.

<details><summary>lens-plan-r5 (raw)</summary>

```text
R2-01 CLOSED — r5 plan:263,275–276,284–285 creates fresh destinations and restricts acceptance to this attempt’s directory. Copies match the producers’ layouts (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`) and occur inside the held lock.

J-1 CLOSED — r5 plan:109–121,282–299 removes isolated RSS sampling and reserve resizing. One measurement records observed runners and validates the unchanged reserve; `gate-performance.md:10–12` permits the named shared-resource rationale.

R4-01 CLOSED — r5 plan:235 negates the absence scan, making the supplied no-match exit status of 1 satisfy the proof.

R4-02 CLOSED — r5 plan:263,267,274 removes `tee` and parses output redirected into the fresh directory. The quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:7,11,18`.

R4-03 CLOSED — r5 plan:264,271,278 includes unreadable `memory.max` in the invalid-evidence guard; the supplied correction probe confirms exit 4.

R4-04 CLOSED — r5 plan:109,296–299 keeps the reserve unchanged and records one measurement. The post-measurement budget change that invalidated runner figures (`scripts/gate-parallelism.mjs:191`) is withdrawn.

LATE OBSERVATIONS

Limitation — Live scope behaviour and full measurement M were not independently executed under the read-only rails; closure relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r5 (raw)</summary>

```text
R2-01 CLOSED — Each attempt gets a fresh `mktemp` evidence directory, and acceptance reads only the printed path; the supplied probes cover collection and an unusable root.

J-1 CLOSED — The sampler and reserve resizing are removed. The single whole-gate measurement checks peak memory and OOM events.

R4-01 CLOSED — The `! git grep` proof handles the no-match exit status and requires no output.

R4-02 CLOSED — `tee` and its reusable summary path are removed; output goes to the fresh evidence directory, and a missing scheduler-log line is rejected.

R4-03 CLOSED — Unreadable `memory.max` is marked invalid; the supplied cgroup-read probe exits 4.

R4-04 CLOSED — There is one measurement and no reserve resizing, so separate M1/M2 measurements cannot invalidate each other.

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:290` — M accepts any `Creating <N>` line and records its value, but never checks that N follows rule (b) for the measured scope. A regression that leaves Stryker at the conservative five-runner count despite a readable 27 GiB budget would still satisfy the log, peak-memory, and OOM checks. Require comparison with the count computed from the measured scope, or capture and validate the reason for an allowed fallback. (confidence: 89)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r5 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, and acceptance reads only the printed path; the supplied probe confirms collection.

J-1 CLOSED — the sampler and reserve resizing are removed; the reserve stays fixed with a named shared-process reason, checked against whole-gate memory and OOM evidence.

R4-01 CLOSED — `! git grep` makes the no-match case exit 0 with no match output.

R4-02 CLOSED — output goes directly to `gate.out` in the fresh directory; missing scheduler logs mark evidence invalid.

R4-03 CLOSED — a failed `memory.max` read leaves the value empty and triggers the evidence guard.

R4-04 CLOSED — there is no reserve adjustment or separate M1 measurement.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:235 — `!` also turns fatal `git grep` errors into exit 0. The diagnostic remains visible, but a proof consumer checking only the exit status can treat an incomplete scan as success. (confidence: 91)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:265 — If `cut` cannot read `/proc/loadavg`, the wrapper prints an empty `loadavg=` field but never marks the evidence invalid; the enclosing `echo` succeeds, and acceptance does not require that field. Measurement M can therefore exit 0 without the load-at-start value O5 requires. (confidence: 95)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r5 (raw)</summary>

```text
R2-01 CLOSED — plan:247–250,282–285 uses a fresh evidence directory per attempt and reads only the printed directory.
J-1 CLOSED — plan:109–121,125–132 removes RSS sampling and reserve resizing; one whole-gate measurement validates the unchanged reserve.
R4-01 CLOSED — plan:235 negates `git grep` so no matches pass.
R4-02 CLOSED — plan:267 redirects output to the fresh `gate.out`; no `tee` or stale summary path remains.
R4-03 CLOSED — plan:264,271–273 checks `memory.max` and rejects missing cgroup evidence.
R4-04 CLOSED — plan:109–121,125–128 keeps the reserve fixed and uses one measurement; no separate M1 remains.
VERDICT: APPROVED
```

</details>

Closures: R2-01, J-1, R4-01, R4-02, R4-03, R4-04 CLOSED by every witness (plan, tests, error-handling, minimalism).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 | M records any observed `N`; a sizing regression to the conservative 5 runners would pass | tests r5 | `run-push-gates.mjs:921-931` (sequential mutation lane gets the scheduler's budget, CPU share 1); probe: in-scope expression prints `{"budget":28991029248,"slots":1,"runnersPerPackage":21}`; without `scripts/` → `INVALID … expected-sizing` exit 4 | Fix — the wrapper prints the in-scope expected sizing; acceptance requires `N` = expected `runnersPerPackage` and overlap ≤ expected `slots` | MANDATE "re-measure Stryker's runner count inside the gate scope" and "size per-step workers under rule (b)" | open → r6 |
| R5-02 | `! git grep` turns a fatal error (exit 128) into success | error-handling r5 (should-fix) | measured: no match → exit 1; invalid pattern → exit 128 | Fix — `…; [ $? -eq 1 ]` | MANDATE retirement proof | open → r6 |
| R5-03 | An unreadable `/proc/loadavg` leaves the load-at-start field empty without `INVALID` | error-handling r5 | script read | Fix — `loadavg` joins the evidence guard | O5 records load at start | open → r6 |

Round 5 counts: unique new issues 3; plan-level adoptions r5=3 (counted from the restart at r4: r4=4, r5=3). Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3.

### Round 6 (r6, 586 s wall, closure round: review-plan, tests, error-handling)

Raw verdicts: plan APPROVED · tests REVISE · error-handling APPROVED.

<details><summary>lens-plan-r6 (raw)</summary>

```text
R5-01 CLOSED — r6 plan:270,298–302 computes expected sizing inside the scope and requires matching observed runners and bounded overlap. The sequential lane passes that budget with CPU share 1 (`scripts/run-push-gates.mjs:921–932`); package sizing and Stryker concurrency match (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Supplied probes confirm expected sizing and missing-source refusal.

R5-02 CLOSED — r6 plan:235 accepts only `git grep` status 1. The supplied measurements distinguish no match (1) from fatal error (128), so fatal errors no longer pass.

R5-03 CLOSED — r6 plan:268,278,286 clears a failed load read, marks missing load data invalid, and converts an otherwise successful measurement to exit 4. Acceptance at :294 rejects `INVALID`; the quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:9,19,28`.

LATE OBSERVATIONS

Limitation — Live launcher behavior and full measurement M were not independently executed under the read-only rails. Review relies on inspected source and supplied probes; relevant gate sources remain unchanged since HEAD 10643303 (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r6 (raw)</summary>

```text
[blocker] R5-01 NOT CLOSED — the expected count comes from the sizing implementation under review, so a regression can make both expected and observed counts five.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:299 — M checks only that observed runners equal the count computed by `gate-parallelism.mjs`; it never requires that the computed budget reflect the readable gate scope or that the measured 27-GiB budget yields 21 runners. If sizing regresses to five for that budget, expected and observed can both be five and the overlap check still passes. The existing tests pin five at 7 GiB and eight at 90 GiB, but not this scope’s 27-GiB case. Assert the scope-derived budget/count independently, or add a regression anchor for this budget. (confidence: 96)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r6 (raw)</summary>

```text
R5-01 CLOSED — Phase 2 compares each observed runner count and package overlap with its in-scope sizing; the scheduler gives sequential mutation the full budget and CPU share 1 (`run-push-gates.mjs:921-931`).

R5-02 CLOSED — The measured no-match status is 1 and fatal status is 128; `[ $? -eq 1 ]` accepts only the no-match case.

R5-03 CLOSED — An unreadable or empty loadavg leaves `load` empty, which marks evidence invalid and returns 4 if the gate itself succeeds.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:270 — If the sizing probe fails, `2>&1` captures its diagnostic and `|| expected=` discards it. The caller gets only `expected=unavailable` and `INVALID — missing evidence: expected-sizing`, hiding the cause needed to fix the measurement (confidence: 96).

VERDICT: APPROVED
```

</details>

Closures: R5-02, R5-03 CLOSED (plan, error-handling). R5-01 CLOSED by plan and error-handling, NOT CLOSED by tests (expected and observed come from the same sizing code) → kept open under its ID (first closure failure of this lineage).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 (residual) | The expected count is computed by the code under test, so a regression could make expected and observed both 5 | tests r6 (2 findings, same defect) | independent arithmetic from the recorded constants: `max=30064771072 − 1 GiB = 28991029248`; `min(24, ⌊(28991029248 − 671088640)/1288490189⌋) = 21` (node one-liner, 2026-10-02) | Fix — acceptance also checks `expected` against the scope arithmetic (`memory.max` − 1 GiB; ⌊(budget − 640 MiB)/1.2 GiB⌋ capped at CPUs), with the atlas values written out | MANDATE "size per-step workers under rule (b) inside that one scope" | open → r7 |
| R6-01 | A failed sizing probe's diagnostic is discarded | error-handling r6 (should-fix) | probe: run outside the repo → `measure: sizing probe failed: node:internal/modules/esm/resolve:272 …` then `INVALID` exit 4 | Fix — arbiter-closed: the diagnostic is printed before the field is cleared (one-off script, executor detail; semantics and proof unchanged) | — | closed (arbiter) |

Round 6 counts: plan-level adoptions r6=1 (R5-01); 1 arbiter. Since the r4 restart: r4=4 r5=3 r6=1. Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1.

### plan-r8.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. An early one-off wrapper read the scope's `memory.peak` and `memory.events` from inside (`memory.peak=331145216 oom 0 oom_kill 0` for a 300 MiB node process); the current wrapper and its probes are quoted in Phase 2.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES`; its value stays 1 GiB. Its comment
  states both places it applies and why: in a session scope (plain `vitest`), the agent process
  (0.32 GB measured 2026-09-29); in the gate scope, the scheduler, per-lane `pnpm` and `gate-receipt`
  parents and launcher Node processes that no worker count sizes — a named shared-resource reason
  (gate-performance intro), validated by the Phase 2 whole-gate measurement (scope `memory.peak` below
  `memory.max`, zero OOM kills). Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". One measurement M: an all-blocks
`pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh post-Phase-1 tree,
so every receipt lane executes (each lane log shows `gate receipt miss:`) and frontend mutation runs as
the gate runs it (after P2, with the scope's budget). Recorded from the producers' own output: the
**observed** Stryker runner count per package (`Creating <N> test runner process(es)` in each package's
`stryker.log`), the observed package overlap (each log's first timestamped line to its
`MutationTestExecutor … Done in` line), lane durations, and from the scope: `memory.max`,
`memory.peak`, `memory.events` `oom`/`oom_kill`, load average at start. The figures replace the stale
8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and the decision record
carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent. Its gate-scope reason is a
  named shared resource validated by the whole-gate result; no isolated RSS profiler (focused
  judgment, round 4).
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as one orchestrator one-off, no new log lines** (rule 6d): the wrapper in Phase 2
  lives in `$RUN_TMP`, is never committed, and collects every piece of evidence into a fresh
  directory inside the measuring scope, before the scope and its lock end.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is the Phase 2 measurement M, which the f-20260930-03
closure note and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 whole-gate measurement (`memory.peak` below `memory.max`, zero OOM kills). **Rejected:**
   dropping the reserve (unsized processes share the scope's `MemoryMax`); keeping the name
   `AGENT_RESERVE_BYTES` (false inside the gate scope); an isolated RSS profile of those processes
   (not required by gate-performance (b), which accepts a named shared-resource reason). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. The Phase 2 measurement shows whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Resumed Codex write leaves have no user D-Bus (agent-kit `f-20261002-15`, measured 2026-10-02 in the
  Stockfish 19 build): every `agent-gate`-wrapped script — after this change also `gate:ensure` and
  `gate:run` — refuses with exit 125 there. Fix briefs report that refusal and continue; the
  orchestrator reruns `pnpm checks:pre-review` itself (it must anyway).
* Another session's gate holding the lock makes the measurement and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'; [ $? -eq 1 ]` succeeds and prints nothing (`git grep` exits 1 on no match and 128 on a fatal error — measured; only 1 passes; the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)

Depends on Phase 1 (the measurement exercises its committed route; nothing may record a receipt on the
post-Phase-1 tree before it). Order: the measurement by the orchestrator, then one `mechanical` write
leaf records the figures.

* Orchestrator one-off (never committed), `$RUN_TMP/measure-gate.sh`. It runs the gate inside the
  measuring scope and copies every piece of evidence into a fresh `mktemp -d` directory before the
  scope (and the heavy-gate lock) ends, so neither a retry nor another gate can supply stale or foreign
  evidence. Probed 2026-10-02 inside real `agent-gate` scopes with a stub producer: green → exit 0 with
  `gate.out`, `gate-logs`, `mutation-logs` collected; red → the gate's exit 3 passes through; no
  `Push gate logs:` line → `INVALID` exit 4; cgroup files unreadable (test hook
  `MEASURE_TEST_CGROUP=/nonexistent`) → `INVALID … memory.max memory.peak memory.events` exit 4;
  unusable `MEASURE_ROOT` → `REFUSED` exit 3; outside a gate scope → `REFUSED` exit 3. With the
  in-scope sizing line added (round 5): a real scope printed
  `expected={"budget":28991029248,"slots":1,"runnersPerPackage":21}`; run from a directory without
  `scripts/` → `measure: sizing probe failed: <node diagnostic>` and `INVALID — missing evidence:
  expected-sizing …` exit 4.

  ```bash
  #!/usr/bin/env bash
  # One-off: run the push gate ("$@") inside the current agent-gate scope and collect its evidence into a fresh
  # directory before the scope (and the heavy-gate lock) ends. Exit: the gate's status, or 3 refused, 4 invalid evidence.
  set -u
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  ev=$(mktemp -d "${MEASURE_ROOT:?MEASURE_ROOT must name a directory}/measure-XXXXXX") || { echo "measure: REFUSED — cannot create an evidence directory" >&2; exit 3; }
  max=$(cat "$d/memory.max" 2>/dev/null) || max=
  load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null) || load=
  # The Stryker sizing the code computes in this scope; the sequential schedule gives the mutation lane this same budget.
  expected=$(node --input-type=module -e 'const m = await import("./scripts/gate-parallelism.mjs"); const b = m.gateBudgetBytes(); const {slots, cpuShare} = m.strykerSlots({budgetBytes: b, packageCount: 3}); console.log(JSON.stringify({budget: b, slots, runnersPerPackage: m.workerCount({perWorkerBytes: m.STRYKER_RUNNER_BYTES, baseBytes: m.STRYKER_PARENT_BYTES, budgetBytes: Math.floor(b / slots), env: {...process.env, GATE_CPU_SHARE: String(cpuShare)}})}))' 2>&1) || { echo "measure: sizing probe failed: $expected" >&2; expected=; }
  echo "measure: evidence=$ev cgroup=$cg memory.max=${max:-unreadable} loadavg=${load:-unreadable} expected=${expected:-unavailable}"
  start=$(date +%s)
  "$@" > "$ev/gate.out" 2>&1; rc=$?
  seconds=$(( $(date +%s) - start ))
  cat "$ev/gate.out"
  invalid=
  [ -n "$max" ] || invalid+=" memory.max"
  [ -n "$load" ] || invalid+=" loadavg"
  case "$expected" in '{"budget":'*) ;; *) invalid+=" expected-sizing" ;; esac
  peak=$(cat "$d/memory.peak" 2>/dev/null) || peak=; [ -n "$peak" ] || invalid+=" memory.peak"
  events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ') || events=; [ -n "$events" ] || invalid+=" memory.events"
  logs=$(sed -n 's/^Push gate logs: //p' "$ev/gate.out" | tail -1)
  { [ -n "$logs" ] && [ -d "$logs" ] && cp -r "$logs" "$ev/gate-logs"; } || invalid+=" scheduler-logs(${logs:-none printed})"
  cp -r artifacts/mutation/frontend "$ev/mutation-logs" 2>/dev/null || invalid+=" mutation-logs"
  echo "measure: rc=$rc seconds=$seconds memory.max=${max:-unreadable} memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable}"
  if [ -n "$invalid" ]; then echo "measure: INVALID — missing evidence:$invalid" >&2; [ "$rc" -eq 0 ] && rc=4; fi
  exit "$rc"
  ```

* Measurement M (immediately after the Phase 1 commit, from the repo root):
  `MEASURE_ROOT=$RUN_TMP agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`
  (the inner `pnpm gates:push` → `agent-gate` runs in place inside the measuring scope). Read only the
  evidence directory this attempt printed (`measure: evidence=…`).
  Acceptance: exit 0; no `INVALID`; `oom_kill 0`; `memory.peak` < `memory.max`; each of
  `gate-logs/{rust-test,rust-coverage,frontend-coverage,e2e,frontend-mutation}.log` contains
  `gate receipt miss:` (a `gate receipt valid:` line voids M; rerun after removing that gate's
  `.gate-receipts/<gate>.json`, which can only stem from this tree); every
  `mutation-logs/<package>/stryker.log` has a `Creating <N> test runner process(es)` line and a
  `MutationTestExecutor … Done in` line; `N` equals the printed `expected` `runnersPerPackage` and at
  most `expected` `slots` package intervals overlap at any instant (on this machine the scope budget
  is below `ONE_WAVE_BYTES`, so the mutation lane runs after P2 with exactly that budget and CPU
  share 1, `scripts/run-push-gates.mjs:921-931`). Independently of the sizing code, the printed
  `expected` must also match the scope arithmetic from the recorded constants: `budget` =
  `memory.max` − 1 GiB (the reserve), and `runnersPerPackage` = min(CPU count,
  ⌊(`budget` − 640 MiB) / 1.2 GiB⌋) at `slots` 1 — on tuxedo-atlas (`memory.max` 30064771072, 24 CPUs)
  `budget` 28991029248 and 21 runners (computed 2026-10-02); a sizing regression (e.g. the
  conservative five) fails this even when expected and observed agree.
  Recorded: `N` per package, the maximum number of packages
  whose intervals overlap, the `frontend-mutation` lane duration, total seconds, `memory.peak`,
  `memory.max`, load at start.
* Any OOM kill, red lane or `INVALID` stops the phase: no constant is tuned to make a run pass; the
  orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M's figures verbatim in the `CLAUDE.md` frontend-mutation
  paragraph (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the
  8 GiB / five-runner / 397.5 s statements; add the gate-scope validation sentence (M's `memory.peak`
  vs `memory.max`, zero OOM kills, date) to the `UNSIZED_PROCESS_RESERVE_BYTES` comment.
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and M's figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### Round 3 (r3, 548 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness APPROVED · error-handling REVISE.

<details><summary>lens-plan-r3 (raw)</summary>

```text
R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r3 (raw)</summary>

```text
R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r3 (raw)</summary>

```text
R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r3 (raw)</summary>

```text
R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
```

</details>

Closures: R1-02 CLOSED (plan, tests, correctness, error-handling). R1-06 CLOSED (plan, error-handling). R2-02 CLOSED (plan, error-handling). R2-01 CLOSED by tests, correctness, error-handling; NOT CLOSED by review-plan (evidence collected outside the lock) → kept open under its ID. Lineage R1-01/R1-02 → R2-01 has now failed closure twice (R1-02 in r2, R2-01 in r3): per rule 12a the lineage stopped being patched by hand — the source path was traced (`run-push-gates.mjs:941-943` prints the run's log directory; `run-frontend-mutation.mjs:310-312` truncates each package log at start), the corrected collection was probed, and a focused fresh-context `review-plan` judgment is requested in round 4 (`lens-judgment-r4`).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Before/after listing and post-scope copies are not attributable under concurrent same-repo gates: another gate can create a log dir while M2 waits for the lock, and can truncate Stryker logs after M1 releases it | plan r3 | `agent-run:597-606` (waiting happens before the lock), `run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`; stub probe of `m2.sh` (exit passthrough 3→3, missing summary → exit 6, green copy → 0); `m1.sh` probe (copy, bad destination → exit 6) | Fix — evidence is collected inside the measuring scope (lock held): `m2.sh` copies the directory named by the scheduler's own `Push gate logs:` line, `m1.sh` copies the mutation tree before the scope ends | MANDATE re-measure (evidence must belong to the measured run) | open → r4 + judgment |
| R3-01 | Sampler counts rows but not matched node/pnpm processes; a selector that stops matching yields `unsized_rss_max_kib=0` accepted | tests r3 | probe: a run with no node/pnpm → `failed_samples=2` → `INVALID` exit 4 after the fix; first sample delayed 5 s so the measured command's node/pnpm exist (probe: `bash -c "…; node …"` → `failed_samples=0`) | Fix — each sample records `<rows> <matched> <kib>`; rows=0 or matched=0 fails the sample | MANDATE rule (b) reserve evidence | open → r4 |
| R3-02 | A later sample-append failure is unchecked | error-handling r3 | probe: sample file made read-only mid-run → sampler exits 5 on its own → `sampler_alive=0` → `INVALID` exit 4 | Fix — sampler exits on append failure; wrapper treats a sampler that ended before being killed as invalid | MANDATE rule (b) reserve evidence | open → r4 |

Round 3 counts: unique new issues 2 (R3-01, R3-02); residual 1 (R2-01); plan-level adoptions r3=3. Cumulative: r1=4 r2=4 r3=3.

### Round 4 (r4, 507 s wall, closure round + focused fresh-context judgment: review-plan, tests, error-handling, review-plan judgment)

Raw verdicts: judgment REVISE · plan REVISE · tests REVISE · error-handling REVISE.

<details><summary>lens-judgment-r4 (raw)</summary>

```text
JUDGMENT: r4 fixes the original concurrent-copy race: M2 identifies the scheduler’s own directory, and both collectors copy before releasing the lock (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:312`; launcher `agent-run:584`). R3-01 and R3-02 are CLOSED against r4: the matched-process check and append/liveness guards address their reported failures, supported by the supplied probes. R2-01 remains open because retrying with an existing destination can leave acceptance reading the previous attempt’s logs. The simplest sufficient mechanism is one fresh all-blocks measurement, collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM evidence inside the held lock into a fresh directory per attempt. The RSS sampler is unnecessary for MANDATE: rule (b) requires measured worker sizing and a recorded reason; the unchanged reserve can name the shared scheduler/receipt processes and be validated through the complete gate’s memory result. Existing producer logs supply runner evidence, though they do not supply isolated overhead RSS. Review should follow obligation scope and ordinary accidental failures; treating this scratch measurement as shipped monitoring software would exceed that scope. Limitation: the complete measurement was not independently executed under the read-only rails; conclusions rely on source and supplied probes (confidence: 90).

OBLIGATION CHANGES:

- Require fresh evidence paths for every measurement attempt; acceptance must inspect that attempt’s paths.
- Remove mandatory isolated-RSS measurement and automatic reserve resizing. Retain the unchanged allowance with an accurate shared-process rationale and whole-gate validation.
- Collect runner counts and intervals during M2; a second full mutation run is unnecessary for the mandated remeasurement.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)

VERDICT: REVISE
```

</details>

<details><summary>lens-plan-r4 (raw)</summary>

```text
R2-01 CLOSED — r4 plan:304–306 selects the scheduler’s emitted log directory; plan:323 preserves mutation logs before scope exit. Producers match these paths (`scripts/run-push-gates.mjs:610–620,943`; `scripts/run-frontend-mutation.mjs:310–312`), and the launcher retains the lock across both copies (`agent-run:584–620`). Supplied probes cover copying and failure propagation.

R3-01 CLOSED — r4 plan:269,283–286 records matched-process counts and rejects zero matches. The supplied real-scope probes distinguish a running node process from no node/pnpm processes.

R3-02 CLOSED — r4 plan:276,281–286 exits the sampler on append failure and rejects premature termination. The supplied mid-run permission probe confirms `sampler_alive=0`, `INVALID`, exit 4.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r4 (raw)</summary>

```text
R3-01 CLOSED — The plan samples `<rows> <matched> <kib>`, rejects either zero count, and delays the first sample; the supplied probes report `INVALID` when no node/pnpm process matches and zero failed samples for a valid node process (plan lines 247–286).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r4 (raw)</summary>

```text
R2-01 CLOSED — M2 copies the scheduler’s own log directory and M1 copies the mutation logs inside the lock-held scope (plan lines 243–245, 293–306; producers at `run-push-gates.mjs:941–943` and `run-frontend-mutation.mjs:310–312`).

R3-01 CLOSED — samples record both process rows and selector matches; either zero marks the sample failed. The supplied no-node probe returned `INVALID` (plan lines 263–269, 283; probe at 247–250).

R3-02 CLOSED — append failure exits the sampler, and an already-ended sampler makes the wrapper emit `INVALID`; the supplied read-only-mid-run probe returned exit 4 (plan lines 274–288; probe at 250).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)

VERDICT: REVISE
```

</details>

**Focused judgment record (rule 12a lineage escalation, R1-01/R1-02 → R2-01).** Contested invariant: Phase 2 evidence must be complete, belong to the measured run, and fail loudly otherwise. Previous answer: three one-off scripts (sampler + M2 + M1) collecting inside the scope. New evidence: source trace (`run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`, `agent-run:584-620`) and the probes above. Judgment (verbatim above): the review was being driven by obligation scope — a scratch measurement reviewed as shipped software; the simplest sufficient mechanism is one fresh all-blocks measurement collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM inside the held lock into a fresh directory per attempt; the isolated RSS sampler is not required by rule (b), which accepts a named shared-resource reason. Resulting obligation changes (adopted): fresh evidence directory per attempt; RSS sampler and automatic reserve resizing removed (reserve unchanged, named reason, validated by the whole gate); M1 folded into the single measurement M. The non-convergence comparison restarts from r4.

Closures: R3-01 CLOSED (plan, tests, error-handling) and R3-02 CLOSED (plan, error-handling) — both then **withdrawn** with the sampler (mechanism removed by the judgment; issues and evidence kept). R2-01 CLOSED by plan and error-handling, NOT CLOSED by the judgment (fixed copy destinations) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Fixed copy destinations let a retry validate the previous attempt's logs (`cp -r` into an existing dir nests the new copy) | judgment r4 | GNU `cp` destination-directory semantics (judgment cites coreutils info); new wrapper: `mktemp -d "$MEASURE_ROOT/measure-XXXXXX"` per attempt; probes: green stub collected `gate.out`, `gate-logs`, `mutation-logs` into a fresh dir; unusable root → `REFUSED` exit 3 | Fix — fresh evidence directory per attempt; acceptance reads only the printed `measure: evidence=` directory | MANDATE re-measure | open → r5 |
| J-1 | The isolated unsized-RSS sampler and conditional reserve resizing exceed MANDATE | judgment r4 (should-fix) | gate-performance intro accepts "a named shared resource" as a cap's reason; `gate-parallelism.mjs:191` subtracts the unchanged reserve | Fix — sampler and resizing removed; reserve reason = named shared processes, validated by M's `memory.peak` < `memory.max` and zero OOM kills; M1 folded into M | MANDATE "size per-step workers under rule (b)" (and rule 6d) | open → r5 |
| R4-01 | `git grep` exits 1 on no match, so the absence scan as an exit-0 proof fails on the intended clean state | tests r4 | `git grep` documented exit status 1 on no match (lens probe) | Fix — proof 1 is `! git -C … grep …` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r5 |
| R4-02 | `PIPESTATUS[0]` ignores a `tee` open failure; a stale summary in `$out` could be parsed | error-handling r4 | GNU `tee` continues when an output open fails | Fix (by withdrawal) — `tee` removed; output is redirected into the fresh evidence directory, so a failed redirect fails the command and no stale file exists | MANDATE re-measure | open → r5 |
| R4-03 | `memory.max` read unchecked | error-handling r4 (should-fix) | probe: cgroup unreadable → `INVALID — missing evidence: memory.max memory.peak memory.events` exit 4 | Fix — `memory.max` joins the evidence guard | MANDATE re-measure | open → r5 |
| R4-04 | A reserve raised after M2 would invalidate M1's sizing figures | plan r4 | — | Withdrawn mechanism — there is no reserve resizing and no separate M1 any more | — | open → r5 (confirm) |

Round 4 counts: unique new issues 5 (J-1, R4-01..R4-04); residual 1 (R2-01); withdrawals: R3-01, R3-02 (sampler), M1/M2 split; plan-level adoptions r4=4 (R2-01, J-1, R4-01, R4-03). Cumulative: r1=4 r2=4 r3=3 r4=4.

### Round 5 (r5, 1114 s wall, closure round: review-plan, tests, error-handling, minimalism)

Raw verdicts: plan APPROVED · tests REVISE · error-handling REVISE · minimalism APPROVED.

<details><summary>lens-plan-r5 (raw)</summary>

```text
R2-01 CLOSED — r5 plan:263,275–276,284–285 creates fresh destinations and restricts acceptance to this attempt’s directory. Copies match the producers’ layouts (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`) and occur inside the held lock.

J-1 CLOSED — r5 plan:109–121,282–299 removes isolated RSS sampling and reserve resizing. One measurement records observed runners and validates the unchanged reserve; `gate-performance.md:10–12` permits the named shared-resource rationale.

R4-01 CLOSED — r5 plan:235 negates the absence scan, making the supplied no-match exit status of 1 satisfy the proof.

R4-02 CLOSED — r5 plan:263,267,274 removes `tee` and parses output redirected into the fresh directory. The quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:7,11,18`.

R4-03 CLOSED — r5 plan:264,271,278 includes unreadable `memory.max` in the invalid-evidence guard; the supplied correction probe confirms exit 4.

R4-04 CLOSED — r5 plan:109,296–299 keeps the reserve unchanged and records one measurement. The post-measurement budget change that invalidated runner figures (`scripts/gate-parallelism.mjs:191`) is withdrawn.

LATE OBSERVATIONS

Limitation — Live scope behaviour and full measurement M were not independently executed under the read-only rails; closure relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r5 (raw)</summary>

```text
R2-01 CLOSED — Each attempt gets a fresh `mktemp` evidence directory, and acceptance reads only the printed path; the supplied probes cover collection and an unusable root.

J-1 CLOSED — The sampler and reserve resizing are removed. The single whole-gate measurement checks peak memory and OOM events.

R4-01 CLOSED — The `! git grep` proof handles the no-match exit status and requires no output.

R4-02 CLOSED — `tee` and its reusable summary path are removed; output goes to the fresh evidence directory, and a missing scheduler-log line is rejected.

R4-03 CLOSED — Unreadable `memory.max` is marked invalid; the supplied cgroup-read probe exits 4.

R4-04 CLOSED — There is one measurement and no reserve resizing, so separate M1/M2 measurements cannot invalidate each other.

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:290` — M accepts any `Creating <N>` line and records its value, but never checks that N follows rule (b) for the measured scope. A regression that leaves Stryker at the conservative five-runner count despite a readable 27 GiB budget would still satisfy the log, peak-memory, and OOM checks. Require comparison with the count computed from the measured scope, or capture and validate the reason for an allowed fallback. (confidence: 89)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r5 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, and acceptance reads only the printed path; the supplied probe confirms collection.

J-1 CLOSED — the sampler and reserve resizing are removed; the reserve stays fixed with a named shared-process reason, checked against whole-gate memory and OOM evidence.

R4-01 CLOSED — `! git grep` makes the no-match case exit 0 with no match output.

R4-02 CLOSED — output goes directly to `gate.out` in the fresh directory; missing scheduler logs mark evidence invalid.

R4-03 CLOSED — a failed `memory.max` read leaves the value empty and triggers the evidence guard.

R4-04 CLOSED — there is no reserve adjustment or separate M1 measurement.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:235 — `!` also turns fatal `git grep` errors into exit 0. The diagnostic remains visible, but a proof consumer checking only the exit status can treat an incomplete scan as success. (confidence: 91)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:265 — If `cut` cannot read `/proc/loadavg`, the wrapper prints an empty `loadavg=` field but never marks the evidence invalid; the enclosing `echo` succeeds, and acceptance does not require that field. Measurement M can therefore exit 0 without the load-at-start value O5 requires. (confidence: 95)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r5 (raw)</summary>

```text
R2-01 CLOSED — plan:247–250,282–285 uses a fresh evidence directory per attempt and reads only the printed directory.
J-1 CLOSED — plan:109–121,125–132 removes RSS sampling and reserve resizing; one whole-gate measurement validates the unchanged reserve.
R4-01 CLOSED — plan:235 negates `git grep` so no matches pass.
R4-02 CLOSED — plan:267 redirects output to the fresh `gate.out`; no `tee` or stale summary path remains.
R4-03 CLOSED — plan:264,271–273 checks `memory.max` and rejects missing cgroup evidence.
R4-04 CLOSED — plan:109–121,125–128 keeps the reserve fixed and uses one measurement; no separate M1 remains.
VERDICT: APPROVED
```

</details>

Closures: R2-01, J-1, R4-01, R4-02, R4-03, R4-04 CLOSED by every witness (plan, tests, error-handling, minimalism).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 | M records any observed `N`; a sizing regression to the conservative 5 runners would pass | tests r5 | `run-push-gates.mjs:921-931` (sequential mutation lane gets the scheduler's budget, CPU share 1); probe: in-scope expression prints `{"budget":28991029248,"slots":1,"runnersPerPackage":21}`; without `scripts/` → `INVALID … expected-sizing` exit 4 | Fix — the wrapper prints the in-scope expected sizing; acceptance requires `N` = expected `runnersPerPackage` and overlap ≤ expected `slots` | MANDATE "re-measure Stryker's runner count inside the gate scope" and "size per-step workers under rule (b)" | open → r6 |
| R5-02 | `! git grep` turns a fatal error (exit 128) into success | error-handling r5 (should-fix) | measured: no match → exit 1; invalid pattern → exit 128 | Fix — `…; [ $? -eq 1 ]` | MANDATE retirement proof | open → r6 |
| R5-03 | An unreadable `/proc/loadavg` leaves the load-at-start field empty without `INVALID` | error-handling r5 | script read | Fix — `loadavg` joins the evidence guard | O5 records load at start | open → r6 |

Round 5 counts: unique new issues 3; plan-level adoptions r5=3 (counted from the restart at r4: r4=4, r5=3). Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3.

### Round 6 (r6, 586 s wall, closure round: review-plan, tests, error-handling)

Raw verdicts: plan APPROVED · tests REVISE · error-handling APPROVED.

<details><summary>lens-plan-r6 (raw)</summary>

```text
R5-01 CLOSED — r6 plan:270,298–302 computes expected sizing inside the scope and requires matching observed runners and bounded overlap. The sequential lane passes that budget with CPU share 1 (`scripts/run-push-gates.mjs:921–932`); package sizing and Stryker concurrency match (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Supplied probes confirm expected sizing and missing-source refusal.

R5-02 CLOSED — r6 plan:235 accepts only `git grep` status 1. The supplied measurements distinguish no match (1) from fatal error (128), so fatal errors no longer pass.

R5-03 CLOSED — r6 plan:268,278,286 clears a failed load read, marks missing load data invalid, and converts an otherwise successful measurement to exit 4. Acceptance at :294 rejects `INVALID`; the quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:9,19,28`.

LATE OBSERVATIONS

Limitation — Live launcher behavior and full measurement M were not independently executed under the read-only rails. Review relies on inspected source and supplied probes; relevant gate sources remain unchanged since HEAD 10643303 (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r6 (raw)</summary>

```text
[blocker] R5-01 NOT CLOSED — the expected count comes from the sizing implementation under review, so a regression can make both expected and observed counts five.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:299 — M checks only that observed runners equal the count computed by `gate-parallelism.mjs`; it never requires that the computed budget reflect the readable gate scope or that the measured 27-GiB budget yields 21 runners. If sizing regresses to five for that budget, expected and observed can both be five and the overlap check still passes. The existing tests pin five at 7 GiB and eight at 90 GiB, but not this scope’s 27-GiB case. Assert the scope-derived budget/count independently, or add a regression anchor for this budget. (confidence: 96)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r6 (raw)</summary>

```text
R5-01 CLOSED — Phase 2 compares each observed runner count and package overlap with its in-scope sizing; the scheduler gives sequential mutation the full budget and CPU share 1 (`run-push-gates.mjs:921-931`).

R5-02 CLOSED — The measured no-match status is 1 and fatal status is 128; `[ $? -eq 1 ]` accepts only the no-match case.

R5-03 CLOSED — An unreadable or empty loadavg leaves `load` empty, which marks evidence invalid and returns 4 if the gate itself succeeds.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:270 — If the sizing probe fails, `2>&1` captures its diagnostic and `|| expected=` discards it. The caller gets only `expected=unavailable` and `INVALID — missing evidence: expected-sizing`, hiding the cause needed to fix the measurement (confidence: 96).

VERDICT: APPROVED
```

</details>

Closures: R5-02, R5-03 CLOSED (plan, error-handling). R5-01 CLOSED by plan and error-handling, NOT CLOSED by tests (expected and observed come from the same sizing code) → kept open under its ID (first closure failure of this lineage).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 (residual) | The expected count is computed by the code under test, so a regression could make expected and observed both 5 | tests r6 (2 findings, same defect) | independent arithmetic from the recorded constants: `max=30064771072 − 1 GiB = 28991029248`; `min(24, ⌊(28991029248 − 671088640)/1288490189⌋) = 21` (node one-liner, 2026-10-02) | Fix — acceptance also checks `expected` against the scope arithmetic (`memory.max` − 1 GiB; ⌊(budget − 640 MiB)/1.2 GiB⌋ capped at CPUs), with the atlas values written out | MANDATE "size per-step workers under rule (b) inside that one scope" | open → r7 |
| R6-01 | A failed sizing probe's diagnostic is discarded | error-handling r6 (should-fix) | probe: run outside the repo → `measure: sizing probe failed: node:internal/modules/esm/resolve:272 …` then `INVALID` exit 4 | Fix — arbiter-closed: the diagnostic is printed before the field is cleared (one-off script, executor detail; semantics and proof unchanged) | — | closed (arbiter) |

Round 6 counts: plan-level adoptions r6=1 (R5-01); 1 arbiter. Since the r4 restart: r4=4 r5=3 r6=1. Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1.

### plan-r9.md

# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)

## Goal

Every heavy ChessFable gate invocation — the push-gate scheduler, the pre-review scheduler, and a
receipt gate started on its own — runs as `agent-gate <command>`: one machine-wide heavy-gate lock
and one `agents.slice/agent-gate-*.scope` capped at 70 % of the slice's `MemoryHigh`, owned by
tuxedo-config. The repository keeps no lock, scope launcher or placement check of its own. Worker
sizing stays rule (b) inside that one scope, with every constant carrying a reason that is true
there, and Stryker's runner count is measured inside the gate scope.

## MANDATE

Verbatim, `tasks/findings.md` entry f-20260930-03:

> * **Where:** `.claude/skills/push/SKILL.md` gate entry (`pnpm gates:push -- <blocks>`, ~59-67) and standalone receipt gate invocations; `scripts/gate-parallelism.mjs` (cgroup `memory.max` sizing).
> * **Defect:** measured 2026-09-29 (tuxedo-config f-20260929-01): Stryker was cgroup-OOM-killed in the 8G session `run-*.scope` at 12, 18 and 23 runners, and four concurrent receipt gates peaked at 6.06 GB there. tuxedo-config (commit dc95d84, f-20260929-01) now provides `agent-gate <command>`, which from a capped session starts the command in `agents.slice/agent-gate-*.scope` bound to the session, capped at 70 % of the slice's `MemoryHigh` (tower 28 GiB), `OOMPolicy=stop`, falling back to in-place execution with a warning.
> * **Why it matters:** `gate-parallelism.mjs` already sizes workers from its own cgroup's `memory.max`; inside a gate scope it reads 28 GiB instead of 8 GiB, so the push gates can use the cores without being OOM-killed.
> * **Change:** run the gate scheduler as `if command -v agent-gate >/dev/null 2>&1; then agent-gate pnpm gates:push -- …; else pnpm gates:push -- …; fi` (availability only, never exit status), and the same for standalone receipt gates the skill routes; re-measure Stryker's runner count inside the gate scope.
> * **Decision 2026-10-01 (agent-kit `agent-kit:d-20261001-05`, K1 follow-up of the 2026-09-30 drain review):** the one shared launcher for gate-performance rules (a) and (c) is tuxedo-config's `agent-gate`, made strict by tuxedo-config `f-20261001-04` (it takes the canonical heavy-gate lock, confirms its `agents.slice/agent-gate-*.scope` from inside, creates it from every caller and fails closed instead of running in place). Converge here by running the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback, size per-step workers under rule (b) inside that one scope, and retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has landed; until then the repository's existing compliant route stays, and today's `agent-gate` alone meets neither (a) nor (c). Contract: `~/.claude/references/gate-performance.md` (c).

The 2026-10-01 decision paragraph supersedes the `Change` bullet's `command -v` fallback and its
`OOMPolicy=stop` description; the strict launcher it waits for landed (tuxedo-config
`f-20261001-04`, handled 2026-10-01, commits 2d80082, 37746d1, 3c880ef).

## Threat model and non-goals

Accidental input only: agents (Claude, Codex, Grok, drain sessions) and Felix running documented
package scripts on tuxedo-atlas. The failure classes are an unplaced heavy gate (session 8G scope OOM,
2026-09-29), two heavy gates overlapping (2026-09-30, load 89), and a nested lock deadlocking against
`agent-gate`'s own lock (measured 2026-10-01, gate-performance (a)). No adversary deliberately
bypasses the launcher; an agent typing `node scripts/run-push-gates.mjs` or
`node scripts/gate-receipt.mjs ensure …` directly is out of scope. Environments that count: local
Linux sessions with `agent-gate` installed. CI (GitHub runners) never runs `gates:push`,
`checks:pre-review`, `gate:ensure` or `gate:run` and has no `agent-gate`; it only runs
`gates:contract:check`, whose routing checks are text pins.

## Traced premises

Frozen Locate citations (2026-10-02, HEAD 10643303).

* `package.json:21-22` — `gates:push` = `bash scripts/heavy-gate.sh node scripts/run-push-gates.mjs`, `checks:pre-review` = the same `--pre-review`.
* `package.json:26-28` — `gate:ensure` / `gate:run` / `gate:check` = `node scripts/gate-receipt.mjs ensure|run|check`, with no launcher.
* `package.json:20,31` — `gates:contract:check` includes `pnpm gates:heavy:test`; `gates:heavy:test` = `node --test scripts/heavy-gate-tests.mjs`.
* `scripts/heavy-gate.sh:1-143` — the repository's own `flock` on `~/.cache/agent-kit/heavy-gate.lock`, holder line, `chessfable-gate-$$.scope` via `systemd-run`, in-scope confirmation; the scope has no `MemoryMax`, so the chain minimum is `agents.slice` `MemoryHigh` (measured 2026-10-02: `MemoryHigh=42949672960`).
* `scripts/heavy-gate-tests.mjs:1-308` — its contract tests; no other file imports either.
* `scripts/check-gate-routing.mjs:19-23` — `HEAVY_GATE_RUNNER` and `GATE_RUNNER_SCRIPTS` pin exactly `gates:push` and `checks:pre-review`; `scripts/check-gate-routing-tests.mjs:18,39-48,97-123` mirror the contract chain and the two pins.
* `scripts/gate-parallelism.mjs:8-10` — `AGENT_RESERVE_BYTES` (1 GiB) justified only by "the agent process … in its 8 GiB scope"; subtracted at `:191`; used by `vitestMaxWorkers` (`:317-327`) for plain `vitest` runs in a session scope and by `run-push-gates.mjs:998` / `run-frontend-mutation.mjs:427` inside the gate.
* `scripts/gate-parallelism.mjs:33-37,194-198` — the conservative fallback (8 GiB configuration: 22 Vitest workers, 5 Stryker runners) on an unreadable chain; `scripts/gate-parallelism-tests.mjs:224-302` pin the reserve subtraction and fallback counts.
* `scripts/run-push-gates.mjs:42-44,1086-1089,1193-1200` — `ONE_WAVE_BYTES` 40 GiB: concurrent mutation needs a budget ≥ 40 GiB; today 39 GiB and under `agent-gate` 27 GiB, so mutation follows P2 in both.
* Probe arithmetic (probe-2-r1, 24 CPUs, three mutation packages): budget 39 GiB → `strykerSlots` 3 × 8 = 24 runners (today); 27 GiB → 1 × 21; 28 GiB → 2 × 11.
* `scripts/run-frontend-mutation.mjs:315,323-327,427-432` and `scripts/run-push-gates.mjs:774,943-956` — no log line prints the budget, slot count or runners per slot.
* `scripts/gate-receipt.mjs:109-118,233-260` — the receipt fingerprint holds tree, gate, command, platform and tool versions; no environment, cgroup or scope identity.
* `.claude/skills/push/SKILL.md:72-77` (lock/scope/fallback prose naming `chessfable-gate-*.scope`), `:151-163` (the receipt reference fence, the standalone receipt invocations the skill routes), `:230` (frontend-mutation measurement "397.5 s … 0 OOM kills"); `CLAUDE.md:66-71` (names `scripts/heavy-gate.sh` and `chessfable-gate-*.scope`), `CLAUDE.md:96-100` ("in the 8 GiB agent budget one package at a time with five Stryker runners").
* `.github/workflows/test.yml:148` runs `pnpm gates:contract:check`; no workflow runs `gates:push`, `checks:pre-review`, `gate:ensure` or `gate:run` (probe-1-r1, `git grep`).
* `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:197-275,573-620,662-725` — strict gate mode: refusal `agent-gate: REFUSED — …` exit 125 before anything starts; lock on fd 9 after placement checks; `MemoryMax` = 7/10 of `agents.slice` `MemoryHigh`, `MemorySwapMax=4G`, `OOMPolicy=continue`, `BindsTo`/`After` the caller session scope; a caller already in `agent-gate-*` execs in place without relocking; exports `AGENT_SLICE_ACTIVE=1`, `SSH_ASKPASS_REQUIRE=never`, and a `NODE_OPTIONS` preload that returns immediately unless the process is `next build` (`next-build-escape.cjs:10-17`). No repository script reads those variables (probe-2-r1).
* Measured 2026-10-02 from this session: `agent-gate bash -c '…'` ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7, printed `Waiting for heavy-gate lock held by: repo=chessfable …` while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in the outer scope and exited 0. An early one-off wrapper read the scope's `memory.peak` and `memory.events` from inside (`memory.peak=331145216 oom 0 oom_kill 0` for a 300 MiB node process); the current wrapper and its probes are quoted in Phase 2.

## Approach

### O1 — Every heavy entry point runs through `agent-gate`, with no fallback

MANDATE: "run the whole heavy gate as `agent-gate <gate command>` with no `command -v` fallback" and
"the same for standalone receipt gates the skill routes".

Package scripts after the change:

* `gates:push` → `agent-gate node scripts/run-push-gates.mjs`
* `checks:pre-review` → `agent-gate node scripts/run-push-gates.mjs --pre-review`
* `gate:ensure` → `agent-gate node scripts/gate-receipt.mjs ensure`
* `gate:run` → `agent-gate node scripts/gate-receipt.mjs run`
* `gate:check` unchanged (it only queries the receipt cache and never starts a gate).

Behaviour: from a session, the scheduler and any standalone `pnpm gate:ensure|gate:run <gate>` get
their own gate scope and the machine-wide lock; the scheduler's lanes call `pnpm gate:ensure|gate:run`
from inside that scope, where `agent-gate` execs in place without relocking, so lanes keep running
concurrently under one lock and one budget. A missing `agent-gate` (shell exit 127) or a launcher
refusal (exit 125, `agent-gate: REFUSED — …`) fails the command before any gate work starts; no
script falls back to running in place. A standalone receipt cache hit now waits for the machine-wide
lock like any other gate start (stated cost; the lock is what makes it a gate).

Integration boundary: the package scripts are the only spelling; skills, CLAUDE.md and the routing
checker name the package scripts, never `agent-gate` options. Verification level: the routing
checker pins all four strings (O3); the live route is proven by observation (Phase 1 proof).

### O2 — The repository's own launcher and lock are retired

MANDATE: "retire `scripts/heavy-gate.sh` and its vendored lock snippet once the strict launcher has
landed". Delete `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs`; remove the
`gates:heavy:test` package script and its member in `gates:contract:check` (and in the routing-test
fixture that mirrors that chain). The launcher's own behaviour (lock, placement, confirmation,
refusals, nested in-place) is tested in tuxedo-config (`tests/test_agent_run.py`, 84 OK at
f-20261001-04) and is not re-tested here.

### O3 — The routing checker pins the new entry points

Depends on O1, O2. `scripts/check-gate-routing.mjs` replaces `HEAVY_GATE_RUNNER` with an
`agent-gate` runner constant and extends `GATE_RUNNER_SCRIPTS` to the four package scripts of O1, so
a drifted or unwrapped entry point (including a reintroduced `bash scripts/heavy-gate.sh` or a
`command -v` fallback) fails `gates:routing:check` in CI and locally. `check-gate-routing-tests.mjs`
moves its fixture and its two package-script tests to the four new strings and keeps a red case per
script (wrong/unwrapped string → named error).

### O4 — Rule (b) constants carry reasons that are true inside the gate scope

MANDATE: "size per-step workers under rule (b) inside that one scope". gate-performance (b)/§intro:
"A cap or ordering without a written reason is a defect."

* `AGENT_RESERVE_BYTES` is renamed `UNSIZED_PROCESS_RESERVE_BYTES`; its value stays 1 GiB. Its comment
  states both places it applies and why: in a session scope (plain `vitest`), the agent process
  (0.32 GB measured 2026-09-29); in the gate scope, the scheduler, per-lane `pnpm` and `gate-receipt`
  parents and launcher Node processes that no worker count sizes — a named shared-resource reason
  (gate-performance intro), validated by the Phase 2 whole-gate measurement (scope `memory.peak` below
  `memory.max`, zero OOM kills). Every reference and test follows the rename.
* The conservative fallback (8 GiB configuration, 22 Vitest / 5 Stryker) and `ONE_WAVE_BYTES` keep
  their values and reasons: neither depends on the launcher (the fallback is the measured-safe
  minimum for an unreadable chain; the one-wave threshold is a budget rule, and at 27 GiB mutation
  keeps following P2 exactly as at 39 GiB today).
* Per-worker constants (`STRYKER_RUNNER_BYTES`, `STRYKER_PARENT_BYTES`, `VITEST_*`) are unchanged;
  the Phase 2 measurement either confirms them (no OOM kill, scope `memory.peak` below `memory.max`)
  or the phase is red and returns to the orchestrator — no constant is tuned to make a run pass.

### O5 — Stryker's runner count is measured inside the gate scope and recorded

MANDATE: "re-measure Stryker's runner count inside the gate scope". One measurement M: an all-blocks
`pnpm gates:push -- --rust --frontend --bindings` inside one gate scope on the fresh post-Phase-1 tree,
so every receipt lane executes (each lane log shows `gate receipt miss:`) and frontend mutation runs as
the gate runs it (after P2, with the scope's budget). Recorded from the producers' own output: the
**observed** Stryker runner count per package (`Creating <N> test runner process(es)` in each package's
`stryker.log`), the observed package overlap (each log's first timestamped line to its
`MutationTestExecutor … Done in` line), lane durations, and from the scope: `memory.max`,
`memory.peak`, `memory.events` `oom`/`oom_kill`, load average at start. The figures replace the stale
8 GiB / five-runner / 397.5 s statements in `CLAUDE.md` and push skill §2, and the decision record
carries them as the measurement of record.

### O6 — Prose describes the launcher that actually runs

Push skill §2 (lock/scope paragraph, `:72-77`) and `CLAUDE.md` "Gates" (`:66-71`) describe
`agent-gate`: lock and holder taken by the launcher, `agents.slice/agent-gate-*.scope` at 70 % of
the slice `MemoryHigh`, exit 125 refusal means nothing started and a retry is safe, a missing
`agent-gate` fails the gate, never wrap a gate command in another `flock` on `heavy-gate.lock`
(it deadlocks against the launcher's own lock; a nested `agent-gate` is safe). Push skill
"Exact-tree gate receipts" says `gate:ensure`/`gate:run` enter the gate scope themselves and
`gate:check` does not. Records: a new decision superseding `d-20261001-01` (placement and lock)
and naming the launcher clause of `d-20261001-02` as updated by it; f-20260930-03 closed with the
commits and measurements.

## Decisions and trade-offs

* **Wrap `gate:ensure`/`gate:run` in the package scripts rather than only in skill prose.** Prose
  (`agent-gate pnpm gate:ensure …` in the skill) is forgotten by every agent that types the package
  script; the package-level wrap places every invocation, and the scheduler's nested calls run in
  place (measured). Cost: a standalone cache hit waits for the lock.
* **Keep the outer `gates:push`/`checks:pre-review` wrap** even though receipts wrap themselves:
  without it every lane would take the lock separately and the concurrent schedule would serialise,
  and non-receipt lanes (clippy, contract, bindings, setup-rust, e2e launcher) would run unplaced.
* **Keep a 1 GiB unsized-process reserve, renamed**, instead of dropping it (rule (b) literal:
  smallest limit / per-worker): the gate scope genuinely contains processes no worker count sizes,
  and `vitest` in a session scope still shares its cgroup with the agent. Its gate-scope reason is a
  named shared resource validated by the whole-gate result; no isolated RSS profiler (focused
  judgment, round 4).
* **No textual ban on `flock`/`systemd-run` in `scripts/`.** The routing pins plus deletion retire the
  launcher; the nested-lock hazard is documented in O6 and gate-performance (a).
* **Measurement as one orchestrator one-off, no new log lines** (rule 6d): the wrapper in Phase 2
  lives in `$RUN_TMP`, is never committed, and collects every piece of evidence into a fresh
  directory inside the measuring scope, before the scope and its lock end.

## Decided autonomously

(`full auto`; the implementing session records both through `./scripts/findings.py record-decision`
before Phase 1. Decision 1's measurement of record is the Phase 2 measurement M, which the f-20260930-03
closure note and `CLAUDE.md` carry after Phase 2; the decision names that closure note rather than numbers.)

1. **Question:** How do ChessFable's heavy gate entry points reach the strict launcher? **Chosen:**
   `gates:push`, `checks:pre-review`, `gate:ensure`, `gate:run` are `agent-gate node scripts/…` with
   no fallback; `gate:check` stays plain; `scripts/heavy-gate.sh` and its tests are deleted.
   **Rejected:** a `command -v agent-gate` fallback (agent-kit `d-20261001-05`, gate-performance (c));
   wrapping only `gates:push`/`checks:pre-review` and changing the skill's standalone receipt lines
   to `agent-gate pnpm gate:ensure …` (prose-only, missed by any agent that types the package script);
   wrapping `gate:check` (never starts a gate). **Reason:** gate-performance (a)/(c) and the measured
   nested in-place behaviour. **Supersedes:** `d-20261001-01` (placement and lock); updates the
   launcher clause of `d-20261001-02`. **Reversal path:** the four package scripts and
   `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
2. **Question:** What does the gate's worker-sizing reserve cover once the gate runs in its own
   capped scope? **Chosen:** `UNSIZED_PROCESS_RESERVE_BYTES` = 1 GiB covering the agent in a session
   scope and the scheduler/`pnpm`/`gate-receipt`/launcher processes in the gate scope, grounded on the
   Phase 2 whole-gate measurement (`memory.peak` below `memory.max`, zero OOM kills). **Rejected:**
   dropping the reserve (unsized processes share the scope's `MemoryMax`); keeping the name
   `AGENT_RESERVE_BYTES` (false inside the gate scope); an isolated RSS profile of those processes
   (not required by gate-performance (b), which accepts a named shared-resource reason). **Reason:**
   gate-performance (b) and its "cap without a written reason is a defect". **Reversal path:** the
   constant and its comment in `scripts/gate-parallelism.mjs`.

## Risks / open questions

* The gate budget drops from 39 GiB (today's unbounded `chessfable-gate-*` scope under the 40 GiB
  slice) to 27 GiB (28 GiB hard `MemoryMax` minus the reserve). Mutation goes from 3 × 8 to 1 × 21
  runners; frontend coverage stays CPU-capped at 24 workers. The Phase 2 measurement shows whether this is slower;
  a slower but placed gate is the mandate, and no constant is tuned to win time back.
* The e2e container (4 GiB `--memory`) runs in `system.slice`, outside the scope; it stays
  sizing-only accounting (reserved from coverage). Hard enforcement is tuxedo-config `f-20261002-01`
  (open), not this task.
* Resumed Codex write leaves have no user D-Bus (agent-kit `f-20261002-15`, measured 2026-10-02 in the
  Stockfish 19 build): every `agent-gate`-wrapped script — after this change also `gate:ensure` and
  `gate:run` — refuses with exit 125 there. Fix briefs report that refusal and continue; the
  orchestrator reruns `pnpm checks:pre-review` itself (it must anyway).
* Another session's gate holding the lock makes the measurement and the final gates wait; that is the lock
  working. Elapsed time includes the wait; record it separately.

## Not part of this task

* `agent-gate` itself (tuxedo-config) and its out-of-scope container enforcement (tuxedo-config
  `f-20261002-01`).
* `verify-ui`'s direct `pnpm build`, `pnpm verify:app` and `pnpm test:e2e:container` — verification
  steps, not receipt gates or push-gate lanes.
* CI workflows (they never run the wrapped scripts).
* Changing per-worker constants, `ONE_WAVE_BYTES`, lane shares or the schedule.
* Printing budget/worker counts in the gate log (measurement is a one-off, O5).
* agent-kit's `references/gate-performance.md` wording (its tracking sentence remains accurate history).

## Phases

### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

* Files: `package.json`; delete `scripts/heavy-gate.sh`, `scripts/heavy-gate-tests.mjs`;
  `scripts/check-gate-routing.mjs`, `scripts/check-gate-routing-tests.mjs`;
  `scripts/gate-parallelism.mjs`, `scripts/gate-parallelism-tests.mjs`, every other importer of
  `AGENT_RESERVE_BYTES` (`git grep -n AGENT_RESERVE_BYTES`); `.claude/skills/push/SKILL.md` §2
  lock/scope paragraph and "Exact-tree gate receipts"; `CLAUDE.md` "Gates" paragraph. The renamed
  reserve keeps its existing session-scope figure in this phase; the gate-scope figure and the
  Stryker/duration statements are written in Phase 2 from the measurements.
* Touches: gate tooling and process placement; no auth, persistence, IPC or API contract.
* Role: `sensitive` (`package.json` is a Sensitive-Path glob in the push skill).
* Proof (orchestrator re-runs every line itself; each must exit 0 unless stated):
  1. `git -C /home/felixb/Projekte/chessfable grep -n -e 'scripts/heavy-gate' -e 'heavy-gate-tests' -e 'gates:heavy:test' -e 'chessfable-gate' -e 'AGENT_RESERVE_BYTES' -- ':!tasks'; [ $? -eq 1 ]` succeeds and prints nothing (`git grep` exits 1 on no match and 128 on a fatal error — measured; only 1 passes; the canonical `heavy-gate.lock` / `heavy-gate.holder` names stay allowed in O6 prose).
  2. `pnpm gates:contract:check` (includes the routing, parallelism, push-runner and mutation-runner tests and the shortened chain).
  3. `pnpm checks:pre-review` (runs through `agent-gate`).
  4. Placement observation: start `pnpm gates:push` (contract-only) detached with output to `$RUN_TMP/p1-contract.log`; while it runs, `systemctl --user list-units --type=scope --no-legend 'agent-gate-*'` lists a unit whose `systemctl --user status <unit>` tree contains `node scripts/run-push-gates.mjs`, and `~/.cache/agent-kit/heavy-gate.holder` names `repo=chessfable`; the run exits 0. Same observation for a standalone `pnpm gate:run frontend-build` (tree contains `scripts/gate-receipt.mjs run frontend-build`); `pnpm gate:check frontend-build` creates no `agent-gate-*` unit.
  5. Refusal case: with `~/.local/bin` removed from `PATH`, `pnpm gates:push` and `pnpm gate:ensure frontend-build` both exit non-zero with `agent-gate: not found` and start no lane (no `run-push-gates`/`gate-receipt` output); record the exit codes.

### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)

Depends on Phase 1 (the measurement exercises its committed route; nothing may record a receipt on the
post-Phase-1 tree before it). Order: the measurement by the orchestrator, then one `mechanical` write
leaf records the figures.

* Orchestrator one-off (never committed), `$RUN_TMP/measure-gate.sh`. It runs the gate inside the
  measuring scope and copies every piece of evidence into a fresh `mktemp -d` directory before the
  scope (and the heavy-gate lock) ends, so neither a retry nor another gate can supply stale or foreign
  evidence. Probed 2026-10-02 inside real `agent-gate` scopes with a stub producer: green → exit 0 with
  `gate.out`, `gate-logs`, `mutation-logs` collected; red → the gate's exit 3 passes through; no
  `Push gate logs:` line → `INVALID` exit 4; cgroup files unreadable (test hook
  `MEASURE_TEST_CGROUP=/nonexistent`) → `INVALID … memory.max memory.peak memory.events` exit 4;
  unusable `MEASURE_ROOT` → `REFUSED` exit 3; outside a gate scope → `REFUSED` exit 3. With the
  in-scope sizing line added (round 5): a real scope printed
  `expected={"budget":28991029248,"slots":1,"runnersPerPackage":21}`; run from a directory without
  `scripts/` → `measure: sizing probe failed: <node diagnostic>` and `INVALID — missing evidence:
  expected-sizing …` exit 4.

  ```bash
  #!/usr/bin/env bash
  # One-off: run the push gate ("$@") inside the current agent-gate scope and collect its evidence into a fresh
  # directory before the scope (and the heavy-gate lock) ends. Exit: the gate's status, or 3 refused, 4 invalid evidence.
  set -u
  cg=$(sed -n 's/^0:://p' /proc/self/cgroup); d=/sys/fs/cgroup${MEASURE_TEST_CGROUP:-$cg}
  case "$cg" in */agents.slice/agent-gate-*.scope) ;; *) echo "measure: REFUSED — not inside an agent-gate scope: $cg" >&2; exit 3 ;; esac
  ev=$(mktemp -d "${MEASURE_ROOT:?MEASURE_ROOT must name a directory}/measure-XXXXXX") || { echo "measure: REFUSED — cannot create an evidence directory" >&2; exit 3; }
  max=$(cat "$d/memory.max" 2>/dev/null) || max=
  load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null) || load=
  # The Stryker sizing the code computes in this scope; the sequential schedule gives the mutation lane this same budget.
  expected=$(node --input-type=module -e 'const m = await import("./scripts/gate-parallelism.mjs"); const b = m.gateBudgetBytes(); const {slots, cpuShare} = m.strykerSlots({budgetBytes: b, packageCount: 3}); console.log(JSON.stringify({budget: b, slots, runnersPerPackage: m.workerCount({perWorkerBytes: m.STRYKER_RUNNER_BYTES, baseBytes: m.STRYKER_PARENT_BYTES, budgetBytes: Math.floor(b / slots), env: {...process.env, GATE_CPU_SHARE: String(cpuShare)}})}))' 2>&1) || { echo "measure: sizing probe failed: $expected" >&2; expected=; }
  echo "measure: evidence=$ev cgroup=$cg memory.max=${max:-unreadable} loadavg=${load:-unreadable} expected=${expected:-unavailable}"
  start=$(date +%s)
  "$@" > "$ev/gate.out" 2>&1; rc=$?
  seconds=$(( $(date +%s) - start ))
  cat "$ev/gate.out"
  invalid=
  [ -n "$max" ] || invalid+=" memory.max"
  [ -n "$load" ] || invalid+=" loadavg"
  case "$expected" in '{"budget":'*) ;; *) invalid+=" expected-sizing" ;; esac
  peak=$(cat "$d/memory.peak" 2>/dev/null) || peak=; [ -n "$peak" ] || invalid+=" memory.peak"
  events=$(grep -E '^(oom|oom_kill) ' "$d/memory.events" 2>/dev/null | tr '\n' ' ') || events=; [ -n "$events" ] || invalid+=" memory.events"
  logs=$(sed -n 's/^Push gate logs: //p' "$ev/gate.out" | tail -1)
  { [ -n "$logs" ] && [ -d "$logs" ] && cp -r "$logs" "$ev/gate-logs"; } || invalid+=" scheduler-logs(${logs:-none printed})"
  cp -r artifacts/mutation/frontend "$ev/mutation-logs" 2>/dev/null || invalid+=" mutation-logs"
  echo "measure: rc=$rc seconds=$seconds memory.max=${max:-unreadable} memory.peak=${peak:-unreadable} ${events:-oom_events=unreadable}"
  if [ -n "$invalid" ]; then echo "measure: INVALID — missing evidence:$invalid" >&2; [ "$rc" -eq 0 ] && rc=4; fi
  exit "$rc"
  ```

* Measurement M (immediately after the Phase 1 commit, from the repo root):
  `MEASURE_ROOT=$RUN_TMP agent-gate bash $RUN_TMP/measure-gate.sh pnpm gates:push -- --rust --frontend --bindings`
  (the inner `pnpm gates:push` → `agent-gate` runs in place inside the measuring scope). Read only the
  evidence directory this attempt printed (`measure: evidence=…`).
  Acceptance: exit 0; no `INVALID`; `oom_kill 0`; `memory.peak` < `memory.max`; each of
  `gate-logs/{rust-test,rust-coverage,frontend-coverage,e2e,frontend-mutation}.log` contains
  `gate receipt miss:` (a `gate receipt valid:` line voids M; rerun after removing that gate's
  `.gate-receipts/<gate>.json`, which can only stem from this tree); every
  `mutation-logs/<package>/stryker.log` has a `Creating <N> test runner process(es)` line and a
  `MutationTestExecutor … Done in` line; `N` equals the printed `expected` `runnersPerPackage` and at
  most `expected` `slots` package intervals overlap at any instant (on this machine the scope budget
  is below `ONE_WAVE_BYTES`, so the mutation lane runs after P2 with exactly that budget and CPU
  share 1, `scripts/run-push-gates.mjs:921-931`). Independently of the sizing code, the printed
  `expected` must also match the scope arithmetic from the recorded constants: `budget` =
  `memory.max` − 1 GiB (the reserve), and `runnersPerPackage` = min(CPU count,
  ⌊(`budget` − 640 MiB) / 1.2 GiB⌋) at `slots` 1 — on tuxedo-atlas (`memory.max` 30064771072, 24 CPUs)
  `budget` 28991029248 and 21 runners (computed 2026-10-02); a sizing regression (e.g. the
  conservative five) fails this even when expected and observed agree.
  Recorded: `N` per package, the maximum number of packages
  whose intervals overlap, the `frontend-mutation` lane duration, total seconds, `memory.peak`,
  `memory.max`, load at start.
* Any OOM kill, red lane or `INVALID` stops the phase: no constant is tuned to make a run pass; the
  orchestrator decides from the evidence (a design question goes back to plan review).
* Write leaf (`mechanical`): record M's figures verbatim in the `CLAUDE.md` frontend-mutation
  paragraph (`:96-100`) and the push skill §2 frontend-mutation bullet (`:230`), replacing the
  8 GiB / five-runner / 397.5 s statements; add the gate-scope validation sentence (M's `memory.peak`
  vs `memory.max`, zero OOM kills, date) to the `UNSIZED_PROCESS_RESERVE_BYTES` comment.
* Proof: `pnpm gates:contract:check`, then `pnpm checks:pre-review`.
* Records (orchestrator, before final gates; the two `## Decided autonomously` entries were recorded
  before Phase 1, decision 1 superseding `d-20261001-01`): the review handoff
  `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
  `./scripts/findings.py close` naming the commits and M's figures.

## Reviews

### Round 1 (r1, 467 s wall, 5 lenses: review-plan at review-plan role, minimalism/correctness/error-handling/tests at sensitive; Codex leaves)

Raw verdicts: plan REVISE · minimalism APPROVED · correctness REVISE · error-handling REVISE · tests REVISE. Raw reports: `/tmp/build-f-20260930-03-2854542/lens-*-r1.txt` (verbatim copies follow).

<details><summary>lens-plan-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:260 — M2 does not guarantee fresh heavy work. The scheduler uses `gate:ensure` for expensive lanes (`scripts/run-push-gates.mjs:99,105,111,123,129`), and a valid receipt returns success without execution (`scripts/gate-receipt.mjs:350-363`). On a clean tree, M1 records the mutation receipt immediately beforehand (`scripts/gate-receipt.mjs:319-332`). M2 can therefore pass its memory acceptance while skipping workloads whose peaks it is supposed to measure. Require fresh execution and evidence that each measured lane actually ran. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1’s specified expression does not provide O5’s mandated runner count: `strykerSlots` returns only `{ slots, cpuShare }` (`scripts/gate-parallelism.mjs:314`); concurrency is calculated separately (`stryker.config.mjs:41-45`). Acceptance at plan line 261 never checks the count. Require observed runners per package, obtainable from the existing Stryker logs (`scripts/run-frontend-mutation.mjs:258,323-326`), rather than accepting successful execution and memory figures alone. (confidence: 99)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — The “prints nothing” proof rejects text O6 explicitly requires at line 139: the warning about `heavy-gate.lock`. That remains the canonical lock used by the replacement launcher (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589-590`). A faithful implementation cannot satisfy this scan. Narrow it to retired script references, the old scope prefix and the old constant; allow canonical lock documentation. (confidence: 100)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:216 — Both phases modify `gate-parallelism.mjs`, its tests, `CLAUDE.md` and the push skill (Phase 2, lines 262-266). This splits one cohesive gate change across overlapping phases, including the reserve declaration and its measured justification (`scripts/gate-parallelism.mjs:8-10`). Consolidate implementation, measurement and recording into one phase with ordered internal steps. (confidence: 98)

Limitation: live launcher behavior and memory figures were not independently re-measured under the read-only rails; the review relies on source and supplied observations. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r1 (raw)</summary>

```text
[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:224 — These five focused checks are rerun by the required `gates:contract:check` at line 229; Phase 2 similarly repeats `parallelism:test` and `routing:check` before its contract check at line 267. Remove the overlapping commands from both proof lists (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:225 — Phase 1 proof 2 searches for every `heavy-gate` match outside `tasks`, but O6 requires the updated skill and `CLAUDE.md` to document `heavy-gate.lock` at lines 139–140. That required prose makes the proof fail; narrow the search to retired launcher references or exempt the shared lock name. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:247 — `ps` errors are silenced and the `awk` end action emits `0` when no rows arrive, so a failed RSS sample can become `unsized_rss_max_kib=0`. Phase 2 can then accept the other measurements and retain the 1 GiB reserve as if M2 proved it was sufficient. Make an invalid sample fail the measurement and prevent the reserve decision (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r1 (raw)</summary>

```text
[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r1.body.md:259 — M1 prints `strykerSlots(...)`, but that function returns only `{slots, cpuShare}`; the worker count it computes is discarded. Neither the recorded output nor acceptance at line 261 asserts runners per slot or total runners. A changed runner count can leave the printed values unchanged and pass the exit, OOM, and memory checks, so the required in-scope remeasurement has no revert-sensitive anchor (confidence: 98)

VERDICT: REVISE
```

</details>

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-01 | M2 can reuse valid receipts and skip the workloads it measures | plan #1 | `scripts/gate-receipt.mjs:350-363` (`ensure` returns 0 on `gate receipt valid:`), lane logs under `artifacts/gates/<lane>.log` (`run-push-gates.mjs:611-620`) | Fix — M2 runs first on the fresh post-Phase-1 tree; acceptance requires `gate receipt miss:` in each receipt lane log; M1 uses forced `gate:run` | MANDATE "re-measure Stryker's runner count inside the gate scope" (a measurement that skips the work measures nothing) | open → r2 |
| R1-02 | M1 never observes the runner count; `strykerSlots` returns only `{slots, cpuShare}` | plan #2, tests #1 | `gate-parallelism.mjs:314`; `stryker.config.mjs:41-45`; Stryker log line `Creating 8 test runner process(es)` in `artifacts/mutation/frontend/*/stryker.log` (today's run, 3 × 8); probe of the corrected in-scope expression: `{"budget":28991029248,"slots":1,"cpuShare":1,"runnersPerPackage":21}` | Fix — observed `Creating <N>` per package must equal the in-scope computed `runnersPerPackage`; overlap ≤ `slots` | MANDATE "re-measure Stryker's runner count" | open → r2 |
| R1-03 | Phase 1 grep for `heavy-gate` contradicts O6's required `heavy-gate.lock` prose | plan #3, correctness #1 | plan O6 text; `agent-run:589-590` keeps the canonical lock name | Fix — grep narrowed to `scripts/heavy-gate`, `heavy-gate-tests`, `gates:heavy:test`, `chessfable-gate`, `AGENT_RESERVE_BYTES` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r2 |
| R1-04 | Phases overlap files; consolidate into one phase | plan #4 (should-fix) | Phase 2's measurement needs Phase 1's committed route (real dependency, rule 4a); each phase ends green and committable; the overlap is the measured figure written into prose Phase 1 changed | Skip — a real dependency is the one admissible ordering reason; one phase would force a leaf to run 25+ min of measurement that the orchestrator must re-run anyway | — | closed (Skip) |
| R1-05 | Phase proofs repeat checks the contract gate already runs | minimalism #1 (nit) | `package.json:20` chain contains routing/parallelism/push/mutation-runner tests | Fix — arbiter-closed nit: redundant lines removed from both phases | — | closed (arbiter, nit-only witness) |
| R1-06 | RSS sampler failure silently yields `unsized_rss_max_kib=0`, accepting the reserve | error-handling #1 | probe: `ps -o pid= -p 1,999999` exits 0 printing only existing pids; rewritten wrapper records `<rows> <kib>` per sample and fails `INVALID` exit 4 on any zero-row sample, unreadable peak or events (probed: valid `failed_samples=0`; `/nonexistent` → `INVALID` exit 4; outside a scope → `REFUSED` exit 3) | Fix — hardened wrapper in Phase 2 | MANDATE "size per-step workers under rule (b)" (the reserve's reason must be measured) | open → r2 |

Round 1 counts: 6 unique issues; plan-level adoptions r1=4 (R1-01, R1-02, R1-03, R1-06); 1 arbiter nit; 1 Skip.

### Round 2 (r2, 487 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness REVISE · error-handling REVISE.

<details><summary>lens-plan-r2 (raw)</summary>

```text
R1-01 CLOSED — r2 plan:275–279 requires M2 first and a receipt miss in every measured lane; `scripts/gate-receipt.mjs:350–363` confirms misses execute the gate. M1 now forces `gate:run`.

R1-02 CLOSED — r2 plan:280–283 compares observed runners against the computed count. The expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`; existing package logs contain the required `Creating <N>` line.

R1-03 CLOSED — r2 plan:227 excludes canonical lock names from the retirement scan, allowing O6’s warning; the replacement launcher retains those names at `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:589–590`.

R1-06 CLOSED — r2 plan:255–270 rejects zero-row samples and unreadable peak/events. The supplied correction probe confirms `INVALID` exit 4 for failed cgroup reads.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — The new evidence-copy instructions mismatch the producers’ layouts (lineage: R1-01/R1-02). M2 selects `artifacts/gates/*.log`, but scheduler logs are written under `artifacts/gates/<timestamp-pid>/<lane>.log` (`scripts/run-push-gates.mjs:610–620`). M1 at plan:280 sends three identically named `stryker.log` files into one destination directory; package identity exists only in their parent directories (`scripts/run-frontend-mutation.mjs:257–258`). Select M2’s actual run directory and preserve M1’s package directories so the required evidence survives collection. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r2 (raw)</summary>

```text
R1-02 CLOSED — M1 requires each observed Stryker runner count to equal the in-scope computed count and checks package overlap against `slots` (plan lines 281–283).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2’s `artifacts/gates/*.log` glob misses the lane logs, which `run-push-gates.mjs` writes under `artifacts/gates/<timestamp>/<lane>.log` (lines 610–620). The prescribed capture therefore cannot supply the per-lane `gate receipt miss:` evidence; M2 cannot establish that the measured workloads ran.

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r2 (raw)</summary>

```text
R1-01 CLOSED — M2 runs first on the fresh post-Phase-1 tree, requires a receipt miss for each lane, and M1 uses forced `gate:run`.

[blocker] R1-02 NOT CLOSED — Phase 2 at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:283` uses start times to prove overlap. With `slots=1`, three start times alone cannot show whether an earlier package finished before the next started. Require per-package execution intervals to verify the overlap bound. (confidence: 99)

R1-03 CLOSED — The grep targets retired launcher names and allows the canonical `heavy-gate.lock` prose.

R1-06 CLOSED — The wrapper marks zero-row samples and unreadable peak/events as invalid; the recorded probes cover the failure cases.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:275 — M2 copies `artifacts/gates/*.log`, but `run-push-gates.mjs` creates lane logs under `artifacts/gates/<timestamp>-<pid>/<lane>.log` (`scripts/run-push-gates.mjs:610-620`). The specified copy step therefore misses the logs needed to check receipt misses. (confidence: 99)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r2 (raw)</summary>

```text
[blocker] R1-06 NOT CLOSED — if `$samples` cannot be opened, `count` can be empty and the guard can miss the sampling failure, allowing the green gate status through without `INVALID` (confidence: 95).

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:268` — The sample-file creation at line 259 is unchecked. With only `set -u`, a failed open does not stop the script; the empty-count test can fail inside the `if` without setting `rc=4`, then `exit "$rc"` returns 0. M2 can accept a successful gate run without valid RSS samples. [Bash `set` builtin](https://www.gnu.org/s/bash/manual/html_node/The-Set-Builtin.html) (confidence: 95)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r2.body.md:260` — If the measurement shell is terminated before reaching the `kill` at line 264, its background sampler has no cleanup path and can keep looping in the gate scope. That process retains the inherited lock descriptor, so later gates can remain blocked until it exits. [Gate performance contract](</home/felixb/.claude/references/gate-performance.md>) (confidence: 86)

VERDICT: REVISE
```

</details>

Closures: R1-01 CLOSED (plan, correctness); R1-03 CLOSED (plan, correctness). R1-02 CLOSED by plan and tests, NOT CLOSED by correctness (start times cannot bound overlap) → kept open under its ID. R1-06 CLOSED by plan and correctness, NOT CLOSED by error-handling (unchecked sample-file open) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R1-02 (residual) | Start times alone cannot show the overlap bound for `slots=1` | correctness r2 | Stryker logs carry first timestamped line and `MutationTestExecutor … Done in` line (today's logs: 10:46:55 → 10:49:30) | Fix — overlap judged from per-package execution intervals (first timestamp → `Done in` line) | MANDATE "re-measure Stryker's runner count inside the gate scope" | open → r3 |
| R1-06 (residual) | Unchecked sample-file creation lets a failed open pass as green | error-handling r2 #1–#2 | probe: `MEASURE_SAMPLES=/proc/nope/x` → `measure: REFUSED — cannot write the sample file` exit 3 before the command starts; `count` defaults to 0 when unreadable | Fix — wrapper refuses before running on an unwritable sample file; count read is guarded | MANDATE rule (b) reserve evidence | open → r3 |
| R2-01 (lineage R1-01/R1-02) | Evidence copies do not match producer layouts: lane logs live in `artifacts/gates/<timestamp>-<pid>/`; three `stryker.log` copied into one dir collide | plan r2, tests r2, correctness r2 | `scripts/run-push-gates.mjs:610-620` (`makeLogDirectory`); `scripts/run-frontend-mutation.mjs:257-258` (`artifacts/mutation/frontend/<package>/stryker.log`); `ls artifacts/gates` shows `20261002T084641048Z-2845683`-style dirs | Fix — copy the one run directory M2 created (listed before/after); copy the mutation tree preserving package dirs | MANDATE re-measure (evidence must survive) | open → r3 |
| R2-02 | Sampler loop has no cleanup if the measuring shell dies; it keeps the inherited lock fd and blocks later gates | error-handling r2 #3 (should-fix) | probe: sampler `/proc/<pid>/fd/9` absent after `exec 9>&-`; after `kill -9` of the measuring shell the sampler was gone within 8 s (`kill -0 "$parent"` loop) | Fix — sampler closes fd 9 and exits when its parent is gone; EXIT trap kills it | Threat model: lock held by a stray process (2026-10-01 nested-lock class) | open → r3 |

Round 2 counts: unique new issues 2 (R2-01, R2-02); residuals 2 (R1-02, R1-06); plan-level adoptions r2=4.

### Round 3 (r3, 548 s wall, closure round: review-plan, tests, correctness, error-handling)

Raw verdicts: plan REVISE · tests REVISE · correctness APPROVED · error-handling REVISE.

<details><summary>lens-plan-r3 (raw)</summary>

```text
R1-02 CLOSED — r3 plan:287–290 requires observed runner counts and complete execution intervals. Actual package logs contain both endpoints (`artifacts/mutation/frontend/workspace-storage/stryker.log:1,1217`), and the sizing expression matches `scripts/run-frontend-mutation.mjs:427–432` and `stryker.config.mjs:41–45`.

R1-06 CLOSED — r3 plan:253 refuses an unwritable sample file before starting the command; line 271 guards the count read. The supplied real-scope probe confirms exit 3 before execution.

[blocker] R2-01 NOT CLOSED — `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:282,287` fixes the layouts but leaves evidence collection outside the lock. Another same-repository gate can create a directory while M2 waits for acquisition (`/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:597–606`), so before/after listings need not identify one new directory. After M1 releases the lock, another mutation run can truncate its shared logs before copying (`scripts/run-frontend-mutation.mjs:310–312`). Identify M2 through its emitted `Push gate logs:` path (`scripts/run-push-gates.mjs:943`) and preserve M1’s logs before leaving the measuring scope, so evidence remains attributable to the measured run. (confidence: 95)

R2-02 CLOSED — r3 plan:262–267 drops the sampler’s inherited fd 9, checks parent liveness and installs EXIT cleanup. The supplied probes confirm fd 9 is absent and the sampler disappears within eight seconds after the measuring shell is killed.

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r3 (raw)</summary>

```text
R1-02 CLOSED — M1 checks each package’s interval from its first timestamped log line through `MutationTestExecutor … Done in`; excess overlap beyond `slots` would fail.

R2-01 CLOSED — M2 identifies and copies its timestamped run directory before checking lane logs. M1 preserves package directories when copying mutation logs, so the required evidence remains available.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:260 — The sampler counts every `ps` row, but sums RSS only for arguments matching the `node`/`pnpm` selector. If that selector stops matching, samples still have rows, `failed_samples` stays zero, and M2 can accept `unsized_rss_max_kib=0`, leaving the 1 GiB reserve based on a false low measurement. Require a matched target process or nonzero RSS before accepting the measurement. (confidence: 94)

VERDICT: REVISE
```

</details>

<details><summary>lens-correctness-r3 (raw)</summary>

```text
R1-02 CLOSED — Phase 2 checks per-package intervals from the first timestamped Stryker line through `MutationTestExecutor … Done in` and limits overlap to `slots - 1` other packages (plan:290); the runner writes each package’s Stryker output to its own log (scripts/run-frontend-mutation.mjs:257-258, 321-326).

R2-01 CLOSED — M2 copies its timestamped scheduler log directory, and M1 copies the mutation tree with package directories preserved (plan:282, 287); both match the producer layouts (scripts/run-push-gates.mjs:610-620, scripts/run-frontend-mutation.mjs:257-258).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r3 (raw)</summary>

```text
R1-02 CLOSED — The r3 acceptance check uses each package log’s first timestamped line through its `MutationTestExecutor … Done in` line; the supplied probe confirms those timestamps are present.

R1-06 CLOSED — The wrapper refuses an unwritable sample file before starting the command, and an unreadable or empty sample count becomes `INVALID`; the supplied probe verifies the refusal.

R2-01 CLOSED — M2 copies its scheduler run directory, and M1 copies the mutation log tree with package directories preserved; both match the producer layouts.

R2-02 CLOSED — The sampler closes fd 9, checks whether its parent remains alive, and has an exit trap. The supplied probe confirms the lock descriptor is absent and the sampler exits after the measuring shell is killed.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r3.body.md:265 — A later `sample >> "$samples"` failure is unchecked. After an earlier valid sample, the wrapper can still report `count>0`, `failed_samples=0`, and return the gate’s `rc=0`; M2 may accept an incomplete RSS maximum without an `INVALID` line. (confidence: 91)

VERDICT: REVISE
```

</details>

Closures: R1-02 CLOSED (plan, tests, correctness, error-handling). R1-06 CLOSED (plan, error-handling). R2-02 CLOSED (plan, error-handling). R2-01 CLOSED by tests, correctness, error-handling; NOT CLOSED by review-plan (evidence collected outside the lock) → kept open under its ID. Lineage R1-01/R1-02 → R2-01 has now failed closure twice (R1-02 in r2, R2-01 in r3): per rule 12a the lineage stopped being patched by hand — the source path was traced (`run-push-gates.mjs:941-943` prints the run's log directory; `run-frontend-mutation.mjs:310-312` truncates each package log at start), the corrected collection was probed, and a focused fresh-context `review-plan` judgment is requested in round 4 (`lens-judgment-r4`).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Before/after listing and post-scope copies are not attributable under concurrent same-repo gates: another gate can create a log dir while M2 waits for the lock, and can truncate Stryker logs after M1 releases it | plan r3 | `agent-run:597-606` (waiting happens before the lock), `run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`; stub probe of `m2.sh` (exit passthrough 3→3, missing summary → exit 6, green copy → 0); `m1.sh` probe (copy, bad destination → exit 6) | Fix — evidence is collected inside the measuring scope (lock held): `m2.sh` copies the directory named by the scheduler's own `Push gate logs:` line, `m1.sh` copies the mutation tree before the scope ends | MANDATE re-measure (evidence must belong to the measured run) | open → r4 + judgment |
| R3-01 | Sampler counts rows but not matched node/pnpm processes; a selector that stops matching yields `unsized_rss_max_kib=0` accepted | tests r3 | probe: a run with no node/pnpm → `failed_samples=2` → `INVALID` exit 4 after the fix; first sample delayed 5 s so the measured command's node/pnpm exist (probe: `bash -c "…; node …"` → `failed_samples=0`) | Fix — each sample records `<rows> <matched> <kib>`; rows=0 or matched=0 fails the sample | MANDATE rule (b) reserve evidence | open → r4 |
| R3-02 | A later sample-append failure is unchecked | error-handling r3 | probe: sample file made read-only mid-run → sampler exits 5 on its own → `sampler_alive=0` → `INVALID` exit 4 | Fix — sampler exits on append failure; wrapper treats a sampler that ended before being killed as invalid | MANDATE rule (b) reserve evidence | open → r4 |

Round 3 counts: unique new issues 2 (R3-01, R3-02); residual 1 (R2-01); plan-level adoptions r3=3. Cumulative: r1=4 r2=4 r3=3.

### Round 4 (r4, 507 s wall, closure round + focused fresh-context judgment: review-plan, tests, error-handling, review-plan judgment)

Raw verdicts: judgment REVISE · plan REVISE · tests REVISE · error-handling REVISE.

<details><summary>lens-judgment-r4 (raw)</summary>

```text
JUDGMENT: r4 fixes the original concurrent-copy race: M2 identifies the scheduler’s own directory, and both collectors copy before releasing the lock (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:312`; launcher `agent-run:584`). R3-01 and R3-02 are CLOSED against r4: the matched-process check and append/liveness guards address their reported failures, supported by the supplied probes. R2-01 remains open because retrying with an existing destination can leave acceptance reading the previous attempt’s logs. The simplest sufficient mechanism is one fresh all-blocks measurement, collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM evidence inside the held lock into a fresh directory per attempt. The RSS sampler is unnecessary for MANDATE: rule (b) requires measured worker sizing and a recorded reason; the unchanged reserve can name the shared scheduler/receipt processes and be validated through the complete gate’s memory result. Existing producer logs supply runner evidence, though they do not supply isolated overhead RSS. Review should follow obligation scope and ordinary accidental failures; treating this scratch measurement as shipped monitoring software would exceed that scope. Limitation: the complete measurement was not independently executed under the read-only rails; conclusions rely on source and supplied probes (confidence: 90).

OBLIGATION CHANGES:

- Require fresh evidence paths for every measurement attempt; acceptance must inspect that attempt’s paths.
- Remove mandatory isolated-RSS measurement and automatic reserve resizing. Retain the unchanged allowance with an accurate shared-process rationale and whole-gate validation.
- Collect runner counts and intervals during M2; a second full mutation run is unnecessary for the mandated remeasurement.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:306 — R2-01 NOT CLOSED: the copy commands reuse fixed destinations (`/tmp/build-f-20260930-03-2854542/m2.sh:8`, `m1.sh:8`). On an ordinary retry after sampling failure, an existing destination receives the new source directory beneath it, leaving the previous root-level logs where acceptance at plan:331 and :337 reads them. This follows GNU Coreutils’ documented destination-directory behavior (`/usr/share/info/coreutils.info.gz`, expanded lines 7026–7029). Require a fresh destination per attempt so successful copying cannot validate stale evidence. (confidence: 99)

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:127 — O5 makes an isolated overhead profiler mandatory although MANDATE requires launcher convergence, in-scope sizing and observed Stryker runners. The producer already writes package evidence (`scripts/run-frontend-mutation.mjs:310`, :323), and sizing already subtracts the unchanged allowance (`scripts/gate-parallelism.mjs:191`). Gate-performance:10–12 permits a named shared-resource reason; it does not require isolated RSS attribution. Remove that added obligation and its sampler rather than expanding scratch-tool verification further. (confidence: 92)

VERDICT: REVISE
```

</details>

<details><summary>lens-plan-r4 (raw)</summary>

```text
R2-01 CLOSED — r4 plan:304–306 selects the scheduler’s emitted log directory; plan:323 preserves mutation logs before scope exit. Producers match these paths (`scripts/run-push-gates.mjs:610–620,943`; `scripts/run-frontend-mutation.mjs:310–312`), and the launcher retains the lock across both copies (`agent-run:584–620`). Supplied probes cover copying and failure propagation.

R3-01 CLOSED — r4 plan:269,283–286 records matched-process counts and rejects zero matches. The supplied real-scope probes distinguish a running node process from no node/pnpm processes.

R3-02 CLOSED — r4 plan:276,281–286 exits the sampler on append failure and rejects premature termination. The supplied mid-run permission probe confirms `sampler_alive=0`, `INVALID`, exit 4.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:347 — If M2 raises the reserve, M1’s sizing and observations precede that change, yet Phase 2 records those figures without repeating the measurement. The reserve changes the available budget (`scripts/gate-parallelism.mjs:191,197`), which determines package slots and runner counts (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Successful contract and pre-review checks at plan:350 do not establish the recorded count for the final reserve. Finalize the reserve before M1 and repeat affected measurements after any adjustment. (confidence: 93)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-r4 (raw)</summary>

```text
R3-01 CLOSED — The plan samples `<rows> <matched> <kib>`, rejects either zero count, and delays the first sample; the supplied probes report `INVALID` when no node/pnpm process matches and zero failed samples for a valid node process (plan lines 247–286).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:231 — Phase 1 requires this absence scan to exit 0 (line 230), but `git grep` with no matches prints nothing and exits 1; a no-match invocation returned exit 1. The intended clean state therefore fails the required proof. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r4 (raw)</summary>

```text
R2-01 CLOSED — M2 copies the scheduler’s own log directory and M1 copies the mutation logs inside the lock-held scope (plan lines 243–245, 293–306; producers at `run-push-gates.mjs:941–943` and `run-frontend-mutation.mjs:310–312`).

R3-01 CLOSED — samples record both process rows and selector matches; either zero marks the sample failed. The supplied no-node probe returned `INVALID` (plan lines 263–269, 283; probe at 247–250).

R3-02 CLOSED — append failure exits the sampler, and an already-ended sampler makes the wrapper emit `INVALID`; the supplied read-only-mid-run probe returned exit 4 (plan lines 274–288; probe at 250).

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:304 — Capturing only `PIPESTATUS[0]` ignores a `tee` failure. If `$out` contains a prior run’s summary and `tee` cannot open it, the script can parse that stale path, copy its still-existing logs, and exit 0 with producer logs misattributed to the current measurement. GNU’s [`tee` implementation](https://github.com/coreutils/coreutils/blob/master/src/tee.c) supports this failure path: it opens outputs with `O_TRUNC`, but continues to stdout when an output open fails. This defeats R2-01’s current-run attribution.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r4.body.md:262 — The `memory.max` read is unchecked and absent from the `INVALID` guard. If that read alone fails while samples, `memory.peak`, and events remain readable, the wrapper can return the gate’s exit 0 without `INVALID`; the measurement has no limit value to compare against `memory.peak`. (confidence: 88)

VERDICT: REVISE
```

</details>

**Focused judgment record (rule 12a lineage escalation, R1-01/R1-02 → R2-01).** Contested invariant: Phase 2 evidence must be complete, belong to the measured run, and fail loudly otherwise. Previous answer: three one-off scripts (sampler + M2 + M1) collecting inside the scope. New evidence: source trace (`run-push-gates.mjs:941-943`, `run-frontend-mutation.mjs:310-312`, `agent-run:584-620`) and the probes above. Judgment (verbatim above): the review was being driven by obligation scope — a scratch measurement reviewed as shipped software; the simplest sufficient mechanism is one fresh all-blocks measurement collecting receipt misses, Stryker counts and intervals, and cgroup peak/OOM inside the held lock into a fresh directory per attempt; the isolated RSS sampler is not required by rule (b), which accepts a named shared-resource reason. Resulting obligation changes (adopted): fresh evidence directory per attempt; RSS sampler and automatic reserve resizing removed (reserve unchanged, named reason, validated by the whole gate); M1 folded into the single measurement M. The non-convergence comparison restarts from r4.

Closures: R3-01 CLOSED (plan, tests, error-handling) and R3-02 CLOSED (plan, error-handling) — both then **withdrawn** with the sampler (mechanism removed by the judgment; issues and evidence kept). R2-01 CLOSED by plan and error-handling, NOT CLOSED by the judgment (fixed copy destinations) → kept open under its ID.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R2-01 (residual) | Fixed copy destinations let a retry validate the previous attempt's logs (`cp -r` into an existing dir nests the new copy) | judgment r4 | GNU `cp` destination-directory semantics (judgment cites coreutils info); new wrapper: `mktemp -d "$MEASURE_ROOT/measure-XXXXXX"` per attempt; probes: green stub collected `gate.out`, `gate-logs`, `mutation-logs` into a fresh dir; unusable root → `REFUSED` exit 3 | Fix — fresh evidence directory per attempt; acceptance reads only the printed `measure: evidence=` directory | MANDATE re-measure | open → r5 |
| J-1 | The isolated unsized-RSS sampler and conditional reserve resizing exceed MANDATE | judgment r4 (should-fix) | gate-performance intro accepts "a named shared resource" as a cap's reason; `gate-parallelism.mjs:191` subtracts the unchanged reserve | Fix — sampler and resizing removed; reserve reason = named shared processes, validated by M's `memory.peak` < `memory.max` and zero OOM kills; M1 folded into M | MANDATE "size per-step workers under rule (b)" (and rule 6d) | open → r5 |
| R4-01 | `git grep` exits 1 on no match, so the absence scan as an exit-0 proof fails on the intended clean state | tests r4 | `git grep` documented exit status 1 on no match (lens probe) | Fix — proof 1 is `! git -C … grep …` | MANDATE "retire scripts/heavy-gate.sh" (proof must be satisfiable) | open → r5 |
| R4-02 | `PIPESTATUS[0]` ignores a `tee` open failure; a stale summary in `$out` could be parsed | error-handling r4 | GNU `tee` continues when an output open fails | Fix (by withdrawal) — `tee` removed; output is redirected into the fresh evidence directory, so a failed redirect fails the command and no stale file exists | MANDATE re-measure | open → r5 |
| R4-03 | `memory.max` read unchecked | error-handling r4 (should-fix) | probe: cgroup unreadable → `INVALID — missing evidence: memory.max memory.peak memory.events` exit 4 | Fix — `memory.max` joins the evidence guard | MANDATE re-measure | open → r5 |
| R4-04 | A reserve raised after M2 would invalidate M1's sizing figures | plan r4 | — | Withdrawn mechanism — there is no reserve resizing and no separate M1 any more | — | open → r5 (confirm) |

Round 4 counts: unique new issues 5 (J-1, R4-01..R4-04); residual 1 (R2-01); withdrawals: R3-01, R3-02 (sampler), M1/M2 split; plan-level adoptions r4=4 (R2-01, J-1, R4-01, R4-03). Cumulative: r1=4 r2=4 r3=3 r4=4.

### Round 5 (r5, 1114 s wall, closure round: review-plan, tests, error-handling, minimalism)

Raw verdicts: plan APPROVED · tests REVISE · error-handling REVISE · minimalism APPROVED.

<details><summary>lens-plan-r5 (raw)</summary>

```text
R2-01 CLOSED — r5 plan:263,275–276,284–285 creates fresh destinations and restricts acceptance to this attempt’s directory. Copies match the producers’ layouts (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`) and occur inside the held lock.

J-1 CLOSED — r5 plan:109–121,282–299 removes isolated RSS sampling and reserve resizing. One measurement records observed runners and validates the unchanged reserve; `gate-performance.md:10–12` permits the named shared-resource rationale.

R4-01 CLOSED — r5 plan:235 negates the absence scan, making the supplied no-match exit status of 1 satisfy the proof.

R4-02 CLOSED — r5 plan:263,267,274 removes `tee` and parses output redirected into the fresh directory. The quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:7,11,18`.

R4-03 CLOSED — r5 plan:264,271,278 includes unreadable `memory.max` in the invalid-evidence guard; the supplied correction probe confirms exit 4.

R4-04 CLOSED — r5 plan:109,296–299 keeps the reserve unchanged and records one measurement. The post-measurement budget change that invalidated runner figures (`scripts/gate-parallelism.mjs:191`) is withdrawn.

LATE OBSERVATIONS

Limitation — Live scope behaviour and full measurement M were not independently executed under the read-only rails; closure relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r5 (raw)</summary>

```text
R2-01 CLOSED — Each attempt gets a fresh `mktemp` evidence directory, and acceptance reads only the printed path; the supplied probes cover collection and an unusable root.

J-1 CLOSED — The sampler and reserve resizing are removed. The single whole-gate measurement checks peak memory and OOM events.

R4-01 CLOSED — The `! git grep` proof handles the no-match exit status and requires no output.

R4-02 CLOSED — `tee` and its reusable summary path are removed; output goes to the fresh evidence directory, and a missing scheduler-log line is rejected.

R4-03 CLOSED — Unreadable `memory.max` is marked invalid; the supplied cgroup-read probe exits 4.

R4-04 CLOSED — There is one measurement and no reserve resizing, so separate M1/M2 measurements cannot invalidate each other.

[blocker] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:290` — M accepts any `Creating <N>` line and records its value, but never checks that N follows rule (b) for the measured scope. A regression that leaves Stryker at the conservative five-runner count despite a readable 27 GiB budget would still satisfy the log, peak-memory, and OOM checks. Require comparison with the count computed from the measured scope, or capture and validate the reason for an allowed fallback. (confidence: 89)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r5 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, and acceptance reads only the printed path; the supplied probe confirms collection.

J-1 CLOSED — the sampler and reserve resizing are removed; the reserve stays fixed with a named shared-process reason, checked against whole-gate memory and OOM evidence.

R4-01 CLOSED — `! git grep` makes the no-match case exit 0 with no match output.

R4-02 CLOSED — output goes directly to `gate.out` in the fresh directory; missing scheduler logs mark evidence invalid.

R4-03 CLOSED — a failed `memory.max` read leaves the value empty and triggers the evidence guard.

R4-04 CLOSED — there is no reserve adjustment or separate M1 measurement.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:235 — `!` also turns fatal `git grep` errors into exit 0. The diagnostic remains visible, but a proof consumer checking only the exit status can treat an incomplete scan as success. (confidence: 91)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r5.body.md:265 — If `cut` cannot read `/proc/loadavg`, the wrapper prints an empty `loadavg=` field but never marks the evidence invalid; the enclosing `echo` succeeds, and acceptance does not require that field. Measurement M can therefore exit 0 without the load-at-start value O5 requires. (confidence: 95)

VERDICT: REVISE
```

</details>

<details><summary>lens-minimalism-r5 (raw)</summary>

```text
R2-01 CLOSED — plan:247–250,282–285 uses a fresh evidence directory per attempt and reads only the printed directory.
J-1 CLOSED — plan:109–121,125–132 removes RSS sampling and reserve resizing; one whole-gate measurement validates the unchanged reserve.
R4-01 CLOSED — plan:235 negates `git grep` so no matches pass.
R4-02 CLOSED — plan:267 redirects output to the fresh `gate.out`; no `tee` or stale summary path remains.
R4-03 CLOSED — plan:264,271–273 checks `memory.max` and rejects missing cgroup evidence.
R4-04 CLOSED — plan:109–121,125–128 keeps the reserve fixed and uses one measurement; no separate M1 remains.
VERDICT: APPROVED
```

</details>

Closures: R2-01, J-1, R4-01, R4-02, R4-03, R4-04 CLOSED by every witness (plan, tests, error-handling, minimalism).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 | M records any observed `N`; a sizing regression to the conservative 5 runners would pass | tests r5 | `run-push-gates.mjs:921-931` (sequential mutation lane gets the scheduler's budget, CPU share 1); probe: in-scope expression prints `{"budget":28991029248,"slots":1,"runnersPerPackage":21}`; without `scripts/` → `INVALID … expected-sizing` exit 4 | Fix — the wrapper prints the in-scope expected sizing; acceptance requires `N` = expected `runnersPerPackage` and overlap ≤ expected `slots` | MANDATE "re-measure Stryker's runner count inside the gate scope" and "size per-step workers under rule (b)" | open → r6 |
| R5-02 | `! git grep` turns a fatal error (exit 128) into success | error-handling r5 (should-fix) | measured: no match → exit 1; invalid pattern → exit 128 | Fix — `…; [ $? -eq 1 ]` | MANDATE retirement proof | open → r6 |
| R5-03 | An unreadable `/proc/loadavg` leaves the load-at-start field empty without `INVALID` | error-handling r5 | script read | Fix — `loadavg` joins the evidence guard | O5 records load at start | open → r6 |

Round 5 counts: unique new issues 3; plan-level adoptions r5=3 (counted from the restart at r4: r4=4, r5=3). Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3.

### Round 6 (r6, 586 s wall, closure round: review-plan, tests, error-handling)

Raw verdicts: plan APPROVED · tests REVISE · error-handling APPROVED.

<details><summary>lens-plan-r6 (raw)</summary>

```text
R5-01 CLOSED — r6 plan:270,298–302 computes expected sizing inside the scope and requires matching observed runners and bounded overlap. The sequential lane passes that budget with CPU share 1 (`scripts/run-push-gates.mjs:921–932`); package sizing and Stryker concurrency match (`scripts/run-frontend-mutation.mjs:427–432`; `stryker.config.mjs:41–45`). Supplied probes confirm expected sizing and missing-source refusal.

R5-02 CLOSED — r6 plan:235 accepts only `git grep` status 1. The supplied measurements distinguish no match (1) from fatal error (128), so fatal errors no longer pass.

R5-03 CLOSED — r6 plan:268,278,286 clears a failed load read, marks missing load data invalid, and converts an otherwise successful measurement to exit 4. Acceptance at :294 rejects `INVALID`; the quoted script matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:9,19,28`.

LATE OBSERVATIONS

Limitation — Live launcher behavior and full measurement M were not independently executed under the read-only rails. Review relies on inspected source and supplied probes; relevant gate sources remain unchanged since HEAD 10643303 (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r6 (raw)</summary>

```text
[blocker] R5-01 NOT CLOSED — the expected count comes from the sizing implementation under review, so a regression can make both expected and observed counts five.

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:299 — M checks only that observed runners equal the count computed by `gate-parallelism.mjs`; it never requires that the computed budget reflect the readable gate scope or that the measured 27-GiB budget yields 21 runners. If sizing regresses to five for that budget, expected and observed can both be five and the overlap check still passes. The existing tests pin five at 7 GiB and eight at 90 GiB, but not this scope’s 27-GiB case. Assert the scope-derived budget/count independently, or add a regression anchor for this budget. (confidence: 96)

VERDICT: REVISE
```

</details>

<details><summary>lens-error-handling-r6 (raw)</summary>

```text
R5-01 CLOSED — Phase 2 compares each observed runner count and package overlap with its in-scope sizing; the scheduler gives sequential mutation the full budget and CPU share 1 (`run-push-gates.mjs:921-931`).

R5-02 CLOSED — The measured no-match status is 1 and fatal status is 128; `[ $? -eq 1 ]` accepts only the no-match case.

R5-03 CLOSED — An unreadable or empty loadavg leaves `load` empty, which marks evidence invalid and returns 4 if the gate itself succeeds.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r6.body.md:270 — If the sizing probe fails, `2>&1` captures its diagnostic and `|| expected=` discards it. The caller gets only `expected=unavailable` and `INVALID — missing evidence: expected-sizing`, hiding the cause needed to fix the measurement (confidence: 96).

VERDICT: APPROVED
```

</details>

Closures: R5-02, R5-03 CLOSED (plan, error-handling). R5-01 CLOSED by plan and error-handling, NOT CLOSED by tests (expected and observed come from the same sizing code) → kept open under its ID (first closure failure of this lineage).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R5-01 (residual) | The expected count is computed by the code under test, so a regression could make expected and observed both 5 | tests r6 (2 findings, same defect) | independent arithmetic from the recorded constants: `max=30064771072 − 1 GiB = 28991029248`; `min(24, ⌊(28991029248 − 671088640)/1288490189⌋) = 21` (node one-liner, 2026-10-02) | Fix — acceptance also checks `expected` against the scope arithmetic (`memory.max` − 1 GiB; ⌊(budget − 640 MiB)/1.2 GiB⌋ capped at CPUs), with the atlas values written out | MANDATE "size per-step workers under rule (b) inside that one scope" | open → r7 |
| R6-01 | A failed sizing probe's diagnostic is discarded | error-handling r6 (should-fix) | probe: run outside the repo → `measure: sizing probe failed: node:internal/modules/esm/resolve:272 …` then `INVALID` exit 4 | Fix — arbiter-closed: the diagnostic is printed before the field is cleared (one-off script, executor detail; semantics and proof unchanged) | — | closed (arbiter) |

Round 6 counts: plan-level adoptions r6=1 (R5-01); 1 arbiter. Since the r4 restart: r4=4 r5=3 r6=1. Cumulative: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1.

### Round 7 (r7, 709 s wall closure + 367 s first-look coverage at the same revision r7: review-plan, tests; then chess-semantics, engine-protocol, ipc-contract, persisted-state, pgn-index, tauri-security, platform-semantics)

Raw verdicts: plan APPROVED · tests APPROVED · six project lenses NOT APPLICABLE/APPROVED · platform-semantics REVISE.

<details><summary>lens-plan-r7 (raw)</summary>

```text
R5-01 CLOSED — r7 plan:304–308 independently requires budget 28991029248 and 21 runners, so expected and observed both regressing to five fails acceptance. Constants and worker arithmetic match `scripts/gate-parallelism.mjs:10,17,21,253–260`; sequential mutation receives the full budget and CPU share 1 (`scripts/run-push-gates.mjs:921–932`), which reaches Stryker concurrency (`stryker.config.mjs:41–45`).

LATE OBSERVATIONS

Limitation — Live launcher behavior and measurement M were not independently executed under the read-only rails; review relies on inspected source and supplied probes (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r7 (raw)</summary>

```text
R5-01 CLOSED — r7 requires checking the probe against independent scope arithmetic: the recorded atlas inputs yield 21 runners, so a fallback to 5 fails even if expected and observed counts agree.

[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271 — The new sizing-probe diagnostic has no planned regression assertion. Measurement M runs from the repository root, where the import succeeds; reverting this hunk to `|| expected=` would leave the planned commands green. The outside-`scripts/` probe is only a historical result at lines 255–258. Add a runnable negative probe that asserts the diagnostic and exit 4. (confidence: 93)

VERDICT: APPROVED
```

</details>

<details><summary>lens-chess-semantics-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate tooling, scripts, and documentation; none of its obligations touch an in-memory chess tree, position, or move path.

VERDICT: APPROVED
```

</details>

<details><summary>lens-engine-protocol-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan’s obligations concern gate scheduling, process placement, and documentation; none touch UCI engine supervision, protocol handling, or result routing.

VERDICT: APPROVED
```

</details>

<details><summary>lens-ipc-contract-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan’s obligations cover gate scripts, package routing, worker sizing, and documentation. Its phases explicitly exclude IPC/API contracts, and no Rust or renderer contract files are in scope.
VERDICT: APPROVED
```

</details>

<details><summary>lens-persisted-state-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan covers gate scripts, package routing, and documentation; it does not touch renderer persistence, storage keys, or tab lifecycle.
VERDICT: APPROVED
```

</details>

<details><summary>lens-pgn-index-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate launch, worker sizing, routing checks, and related documentation; it does not affect PGN scanning, indexing, encoding, storage, or search.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tauri-security-r7 (raw)</summary>

```text
NOT APPLICABLE: The plan changes gate scripts, package configuration, and documentation; its obligations do not touch credentials, filesystem authority, signed downloads, or backend-only data.

VERDICT: APPROVED
```

</details>

<details><summary>lens-platform-semantics-r7 (raw)</summary>

```text
[should-fix] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:70 — On macOS and Windows, the proposed `pnpm gate:run frontend-build` and `gate:ensure` scripts require the Linux `agent-gate`, which depends on `/proc` and `systemd-run`; they fail before the currently direct Node receipt runner starts (`package.json:26-27`, tuxedo-config `agent-run:214,559-575`). CI’s `gates:contract:check` only checks routing text, so it does not prove those commands work on either platform. (confidence: 98)

VERDICT: REVISE
```

</details>

Closures: R5-01 CLOSED (plan, tests).

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R7-01 | The sizing-probe diagnostic hunk of the one-off wrapper has no runnable regression assertion | tests r7 (should-fix) | focused judgment r4: the wrapper is a never-committed scratch measurement; its failure paths were probed in this run (`measure: sizing probe failed: node:internal/modules/esm/resolve:272` → `INVALID` exit 4) | Skip — a regression assertion for a one-off scratch script is shipped-software verification the r4 judgment ruled outside MANDATE | — | closed (Skip) |
| R7-02 | `gate:ensure`/`gate:run` would fail on macOS/Windows, where `agent-gate` (`/proc`, `systemd-run`) does not exist | platform-semantics r7 (should-fix) | frozen threat model: environments that count are local Linux sessions with `agent-gate`; CI never runs the wrapped scripts (`.github/workflows/test.yml` runs the gate commands directly, probe-1-r1); `gates:push`/`checks:pre-review` have been Linux-only since K5's `bash scripts/heavy-gate.sh` (systemd-run); gate-performance (c): a missing `agent-gate` fails the gate by design | Skip — outside the frozen threat model's environments; gate-performance (c) mandates failing without the launcher | — | closed (Skip) |

Round 7 counts: plan-level adoptions r7=0; 2 Skips. Plan-level issues open after r7: none. R2-01 and J-1 (witness `judgment` r4) and R6-01 (should-fix, witness error-handling r6) still need a completed closure row by their witnessing lenses for the published evidence → r8 is an evidence-only closure check at the unchanged revision r7 (`plan-review-delta.py` → `UNCHANGED`, exit 3; no revision round is claimed).

### Round 8 (r8, 506 s wall, evidence-only closure check at the unchanged revision r7: review-plan, tests, correctness, judgment (fresh-context review-plan), error-handling)

Raw verdicts: all five APPROVED.

<details><summary>lens-plan-r8 (raw)</summary>

```text
R2-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:267,283–294` creates a fresh evidence directory, copies producer logs before scope exit, and restricts acceptance to the printed directory. Producer paths match (`scripts/run-push-gates.mjs:943`; `scripts/run-frontend-mutation.mjs:258,312`); supplied probes confirm collection and failure propagation.

J-1 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:109–121,291–313` removes isolated RSS sampling and conditional resizing. One measurement checks runners, peak memory and OOM events against the unchanged reserve (`scripts/gate-parallelism.mjs:10,191`), with the named shared-process reason permitted by `gate-performance.md:10–12`.

R6-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:271` matches `/tmp/build-f-20260930-03-2854542/measure-gate.sh:11`: the diagnostic is printed before `expected` is cleared. The supplied missing-`scripts/` probe confirms the diagnostic followed by `INVALID` exit 4.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r8 (raw)</summary>

```text
R2-01 CLOSED — Phase 2 creates a fresh evidence directory per attempt, collects both log trees before the measuring scope ends, and reads only the printed directory. The supplied probes cover collection, red exit propagation, invalid evidence, and refusal for an unusable root (plan:247–294).

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-r8 (raw)</summary>

```text
R2-01 CLOSED — each attempt creates a fresh evidence directory, prints its path, and acceptance reads only that directory. The wrapper copies scheduler and mutation logs before the lock-held scope ends; the supplied probes confirm collection and gate-status handling.

LATE OBSERVATIONS

None.

VERDICT: APPROVED
```

</details>

<details><summary>lens-judgment-r8 (raw)</summary>

```text
R2-01 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:267` creates fresh evidence per attempt; `:283–285` copies the scheduler’s emitted directory and package-preserving mutation tree inside the measuring scope; `:294` restricts acceptance to the printed evidence directory. Producer paths match `scripts/run-push-gates.mjs:943` and `scripts/run-frontend-mutation.mjs:258`; launcher ownership is supported by `/home/felixb/Projekte/tuxedo-config/agent-slice/agent-run:584–620` and supplied scope probes (confidence: 97).

J-1 CLOSED — r7 snapshot `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:109–121` retains the unchanged reserve with a named shared-process reason; `:291–317` uses one whole-gate measurement to require peak memory below the cap and zero OOM kills. Isolated RSS sampling and conditional resizing are removed. This matches `/home/felixb/.claude/references/gate-performance.md:10–14`; existing sizing subtracts the reserve at `scripts/gate-parallelism.mjs:191` (confidence: 97).

LATE OBSERVATIONS

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:291 — Verification limitation: measurement M and live routing proofs were not independently executed under the read-only rails. Closure verifies the corrected plan against inspected source and supplied probes; implementation acceptance still requires M (confidence: 90).

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-r8 (raw)</summary>

```text
R6-01 CLOSED — r7 prints the sizing probe’s diagnostic before clearing `expected`, then marks the missing sizing evidence invalid and exits 4 on a green gate; the supplied probe confirms this outcome (plan lines 271, 280, 287; 255–258).

LATE OBSERVATIONS

[nit] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r7.body.md:250 — Runtime probes were supplied and the failure paths were source-traced, but they were not independently rerun under the read-only rails (confidence: 99).

VERDICT: APPROVED
```

</details>

Closures: R2-01 CLOSED (plan, tests, correctness, judgment); J-1 CLOSED (plan, judgment); R6-01 CLOSED (plan, error-handling) — this supersedes the r6 "arbiter" note for R6-01, whose witness was should-fix rank and therefore needed a witness closure.

| ID | Claim | Witnesses | Evidence | Disposition | Authority / MANDATE | Closure |
|---|---|---|---|---|---|---|
| R8-01 | Lenses did not execute measurement M or the live routing proofs themselves | judgment r8 (nit), error-handling r8 (nit) | read-only lens rails by contract (`review-lens-contract.md`); the plan's Phase 1 proofs and Phase 2 acceptance execute them during implementation | Skip — a stated limitation of read-only review; implementation acceptance runs M | — | closed (Skip) |

## Review summary (plan review closed 2026-10-02)

* Rounds: 8 completed (r8 an evidence-only closure check at revision r7). Wall time per round (s): r1 467 · r2 487 · r3 548 · r4 507 · r5 1114 · r6 586 · r7 709 + 367 (first-look coverage) · r8 506 — ≈ 1 h 34 min of review wall time; orchestrator probing and triage between rounds not included.
* `plan_adopted_per_round`: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1 r7=0 r8=0.
* Unique issues: 22 (R1-01..R1-06, R2-01, R2-02, R3-01, R3-02, R4-01..R4-04, J-1, R5-01..R5-03, R6-01, R7-01, R7-02, R8-01). Fix 18 (17 closed by their witness lenses, R1-05 arbiter-closed nit), Skip 4 (R1-04, R7-01, R7-02, R8-01), Defer 0. Withdrawn mechanisms: the RSS sampler (R3-01, R3-02 closed then withdrawn), the M1/M2 split and reserve resizing (R4-04), `tee` capture (R4-02). Open plan-level issues: 0.
* Lineage escalation: R1-01/R1-02 → R2-01 failed closure twice (r2, r3) → source trace + probes + focused fresh-context `review-plan` judgment (r4), which re-scoped the measurement to one in-lock run; the non-convergence comparison restarted at r4 (r4=4, r5=3, r6=1, r7=0, r8=0).
* Correction-introduced defects: R2-01 (from the R1-01/R1-02 corrections), R2-02 (from the R1-06 sampler), R3-01/R3-02 (sampler), R4-01 (from R1-03), R4-02/R4-03 (from R2-01's collection), R5-01..R5-03 and R6-01 (from J-1's single-measurement wrapper), R7-01 (from R6-01).
* Lens provenance: every lens and probe ran as a Codex leaf (OpenAI high tier for `review-plan` and the judgment, low tier at max for the others); the orchestrator (Claude Code, Opus 5.5) wrote the plan, ran every probe and arbitrated — disclosed.

### delta-r10.txt

ROUND: 10
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/.plan-delta-plan-r10.diff
REVISED:
(none)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)

### delta-r2.txt

ROUND: 2
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r2.diff
REVISED:
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases

### delta-r3.txt

ROUND: 3
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r3.diff
REVISED:
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

### delta-r4.txt

ROUND: 4
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r4.diff
REVISED:
## Risks / open questions
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve evidence, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Not part of this task
## Phases
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

### delta-r5.txt

ROUND: 5
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r5.diff
REVISED:
## Traced premises
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O6 — Prose describes the launcher that actually runs
## Not part of this task
## Phases

### delta-r6.txt

ROUND: 6
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r6.diff
REVISED:
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases

### delta-r7.txt

ROUND: 7
DELTA: /home/felixb/Projekte/chessfable/tasks/plans/.plan-delta-2026-10-02-agent-gate-convergence-r7.diff
REVISED:
## Phases > ### Phase 2 — Measure inside the gate scope and record the figures (O4 reserve validation, O5, O6 records)
SETTLED:
# Plan: run the push gate through the strict `agent-gate` and retire `scripts/heavy-gate.sh` (f-20260930-03)
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — Every heavy entry point runs through `agent-gate`, with no fallback
## Approach > ### O2 — The repository's own launcher and lock are retired
## Approach > ### O3 — The routing checker pins the new entry points
## Approach > ### O4 — Rule (b) constants carry reasons that are true inside the gate scope
## Approach > ### O5 — Stryker's runner count is measured inside the gate scope and recorded
## Approach > ### O6 — Prose describes the launcher that actually runs
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Phases > ### Phase 1 — Converge the entry points and retire the launcher (O1, O2, O3, O4 rename, O6 prose without measured figures)

### delta-r8.txt

UNCHANGED

### final.delta

--- /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/run/evidence/plan-r9.md
+++ /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/plan.md
@@ -321,11 +321,11 @@
   `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`; f-20260930-03 closed through
   `./scripts/findings.py close` naming the commits and M's figures.
 
-## Review summary (plan review closed 2026-10-02)
-
-* Rounds: 8 completed (r8 an evidence-only closure check at revision r7). Wall time per round (s): r1 467 · r2 487 · r3 548 · r4 507 · r5 1114 · r6 586 · r7 709 + 367 (first-look coverage) · r8 506 — ≈ 1 h 34 min of review wall time; orchestrator probing and triage between rounds not included.
-* `plan_adopted_per_round`: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1 r7=0 r8=0.
+## Review summary (plan review closed 2026-10-02; refreshed against 84e697e9 in r9)
+
+* Rounds: 9 completed (r8 an evidence-only closure check at revision r7; r9 the PLAN-REFRESH drift round a580b504 → 84e697e9 at the same revision, 13 lenses, all APPROVED, no finding). Wall time per round (s): r1 467 · r2 487 · r3 548 · r4 507 · r5 1114 · r6 586 · r7 709 + 367 (first-look coverage) · r8 506 · r9 281 — ≈ 1 h 39 min of review wall time; orchestrator probing and triage between rounds not included.
+* `plan_adopted_per_round`: r1=4 r2=4 r3=3 r4=4 r5=3 r6=1 r7=0 r8=0 r9=0.
 * Unique issues: 22 (R1-01..R1-06, R2-01, R2-02, R3-01, R3-02, R4-01..R4-04, J-1, R5-01..R5-03, R6-01, R7-01, R7-02, R8-01). Fix 18 (17 closed by their witness lenses, R1-05 arbiter-closed nit), Skip 4 (R1-04, R7-01, R7-02, R8-01), Defer 0. Withdrawn mechanisms: the RSS sampler (R3-01, R3-02 closed then withdrawn), the M1/M2 split and reserve resizing (R4-04), `tee` capture (R4-02). Open plan-level issues: 0.
-* Lineage escalation: R1-01/R1-02 → R2-01 failed closure twice (r2, r3) → source trace + probes + focused fresh-context `review-plan` judgment (r4), which re-scoped the measurement to one in-lock run; the non-convergence comparison restarted at r4 (r4=4, r5=3, r6=1, r7=0, r8=0).
+* Lineage escalation: R1-01/R1-02 → R2-01 failed closure twice (r2, r3) → source trace + probes + focused fresh-context `review-plan` judgment (r4), which re-scoped the measurement to one in-lock run; the non-convergence comparison restarted at r4 (r4=4, r5=3, r6=1, r7=0, r8=0, r9=0).
 * Correction-introduced defects: R2-01 (from the R1-01/R1-02 corrections), R2-02 (from the R1-06 sampler), R3-01/R3-02 (sampler), R4-01 (from R1-03), R4-02/R4-03 (from R2-01's collection), R5-01..R5-03 and R6-01 (from J-1's single-measurement wrapper), R7-01 (from R6-01).
 * Lens provenance: every lens and probe ran as a Codex leaf (OpenAI high tier for `review-plan` and the judgment, low tier at max for the others); the orchestrator (Claude Code, Opus 5.5) wrote the plan, ran every probe and arbitrated — disclosed.

## Implementation session (drain session 021d2888-c904-44b0-af74-a8f4604318bd, 2026-10-02)

The drain adopted the published plan (adoption gate `clear`, BASE 84e697e9), recorded `d-20261002-01` and `d-20261002-02` before Phase 1, and marked `d-20261001-01` superseded by `d-20261002-01`. Phase 1 landed as `c49a852c`. During Phase 2 the orchestrator's own measurement opened R11-01, which went through two more plan-review rounds before the figures were recorded (`84640f44`). The rounds below continue the numbered lineage. They are copied verbatim from the plan's `## Reviews`.

### Round 11 (r11, implementation-time closure round for R11-01: review-plan at review-plan role, tests at normal; Codex leaves; ≈ 5 min wall)

Opened during Phase 2 by the orchestrator's own measurement, after the adopted plan (r10) had been published and adopted by the drain session 021d2888-c904-44b0-af74-a8f4604318bd. Phase 1 was committed as `c49a852c`.

| ID | Claim | Witnesses | Evidence | Disposition | Authority | Closed |
|---|---|---|---|---|---|---|
| R11-01 | Phase 2's `memory.peak` < `memory.max` criterion (and O4 / Decided #2 "validated by … memory.peak below memory.max") cannot validate the reserve: cgroup-v2 `memory.peak` includes page cache | orchestrator measurement (M2, M3); review-plan r11 (should-fix on the wording), tests r11 (blocker ×2, NOT CLOSED) | M1 `$RUN_TMP/m.log`: rc=1, rust-coverage red on `lru_evicts_the_least_recently_used_idle_entry` `Conflict("database is open through another directory")` (open finding f-20261002-02; passed in the concurrent rust-test lane), `memory.peak=28240257024 oom 0 oom_kill 0` — excluded as measurement of record, receipts it recorded moved aside, rerun. M2: rc=0, 481 s, `memory.peak=30064771072` (= `memory.max`), `oom 0 oom_kill 0`. M3 (wrapper extended with four evidence lines): rc=0, 444 s, `memory.peak=30064771072`, `memory.swap.peak=0`, `memory.events=[low 0 high 0 max 401 oom 0 oom_kill 0 oom_group_kill 0 sock_throttled 0]`, post-exit `anon 753664 file 8477736960 shmem 0` | Fix (r11: criterion → `oom 0`, `oom_kill 0`, `memory.swap.peak=0`; wrapper records swap peak, all events, post-exit split; r12: claims narrowed to the observed whole-run outcome after the r11 reports) | MANDATE "size per-step workers under rule (b) inside that one scope"; gate-performance (b) "a cap … without a written reason is a defect" — the reason must be true; the measurement mechanism is the plan's own Phase 2 one-off (no new mechanism) | r12 (review-plan, tests) |

Raw verdicts r11: review-plan APPROVED (R11-01 CLOSED + one should-fix); tests REVISE (R11-01 NOT CLOSED).

<details><summary>lens-plan-r11 (raw)</summary>

```text
R11-01 CLOSED — r11’s Phase 2 acceptance at `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r11.body.md:304` is sound as whole-gate operational validation. M3 confirms every receipt lane executed, 21 runners per package ran sequentially, and the run completed with zero OOM events and zero swap use (`/tmp/build-021d2888-c904-44b0-af74-a8f4604318bd/m3.log:46`). Existing RSS measurements support the unchanged worker constants (`scripts/gate-parallelism.mjs:14`); gate-performance permits the reserve’s named shared-process reason. Discarding red M1 and rerunning with fresh receipt misses is appropriate. The correction stays inside MANDATE. (confidence: 94)

[should-fix] `tasks/plans/.plan-2026-10-02-agent-gate-convergence-r11.body.md:114` — “no worker allocation failed” and “without memory pressure” overstate the evidence. The [kernel documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files) distinguishes OOM counters from allocation failures and pressure; M3 records `max 401`, and its final anon/file split does not establish the composition at peak (`/tmp/build-021d2888-c904-44b0-af74-a8f4604318bd/m3.log:47`). State “completed without observed OOM events or swap use.” (confidence: 97)

Limitation: these criteria detect aggregate capacity failure, not every individually underestimated allowance masked by spare capacity or the CPU cap (`scripts/gate-parallelism.mjs:262`). They validate this measured workload, rather than independently bounding each constant. No new measurement was run under the read-only rails. (confidence: 100)

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r11 (raw)</summary>

```text
[blocker] R11-01 NOT CLOSED — The corrected criterion proves that M3 completed without recorded OOM events or swap use. It does not prove the stronger claims that the reserve and per-worker constants are sufficient or that workers experienced no memory pressure. (confidence: 98)

[blocker] tasks/plans/.plan-2026-10-02-agent-gate-convergence-r11.body.md:125 — “Confirms” the constants has no corresponding assertion. An underestimated allowance that causes eviction and refault of file-backed working pages can still satisfy exit 0, `oom 0`, `oom_kill 0`, and `memory.swap.peak=0`. The kernel explicitly permits direct reclaim before OOM; M3 recorded `max 401`, while the post-exit anon/file split cannot establish the working set at peak. The same gap affects O4’s “without memory pressure” claim at line 116. Narrow the claims to the observed whole-run outcome; this does not require reinstating the withdrawn RSS sampler. [Kernel cgroup-v2 semantics](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files). (confidence: 98)

M1’s rerun decision is sound: its failed coverage lane violates measurement acceptance, and M3’s copied logs establish fresh receipt misses and completed, sequential 21-runner packages.

Replacing the peak threshold stays within MANDATE. The inconsistency is the strength of the validation claims, rather than recording the revised counters.

VERDICT: REVISE
```

</details>

Arbiter notes: both reports agree that the r11 wording ("no worker allocation failed", "without memory pressure", "confirms them") claims more than OOM counters and swap peak can show. Adopted as the R11-01 residual (same ID, no new issue): r12 narrows O4 bullets 1 and 3, Decided #2 and the Phase 2 write-leaf sentence to "completed without observed OOM events or swap use", a whole-run outcome that is explicitly not an independent bound. The acceptance criterion itself is unchanged from r11. The withdrawn RSS sampler is not reinstated (both lenses: not required). M1's rerun decision upheld by both lenses.

### Round 12 (r12, closure round for the R11-01 residual: review-plan, tests; ≈ 4 min wall)

Delta r11 → r12: REVISED O4, Decided autonomously, Phase 2 (wording only, acceptance criterion unchanged).

Raw verdicts r12: review-plan APPROVED (R11-01 CLOSED); tests APPROVED (R11-01 CLOSED).

<details><summary>lens-plan-r12 (raw)</summary>

```text
R11-01 CLOSED — r12 limits the evidence to the observed whole-run outcome and explicitly disclaims independent bounds on the reserve and worker constants (`tasks/plans/.plan-2026-10-02-agent-gate-convergence-r12.body.md:114`, `:125`). M3 supports that claim: exit 0, zero OOM counters, zero swap peak, fresh receipt misses, and 21 runners per sequential package (`/tmp/build-021d2888-c904-44b0-af74-a8f4604318bd/m3.log:46`, `:47`, and its collected lane logs). The narrowed interpretation matches the [kernel’s counter and peak semantics](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files). (confidence: 98)

The correction stays inside MANDATE. Existing per-worker measurements remain recorded in `scripts/gate-parallelism.mjs:14`; the reserve names its shared processes at `:8`, as gate-performance permits. The acceptance would reject an observed OOM event, swap use, or failed run, but can still pass an underestimated allowance masked by spare capacity—now explicitly acknowledged.

Excluding M1 is sound: its Rust coverage lane failed (`/tmp/build-021d2888-c904-44b0-af74-a8f4604318bd/m.log:129`), and the rerun preserved fresh-work verification. No additional blocker found.

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-r12 (raw)</summary>

```text
R11-01 CLOSED — r12 O4 explicitly limits the proof to this workload’s whole-run outcome and acknowledges that underestimated allowances masked by spare capacity or the CPU cap would pass. It no longer claims independent bounds, absence of allocation failures, or absence of memory pressure. M3’s recorded `rc=0`, `oom 0`, `oom_kill 0`, and `memory.swap.peak=0` support the narrowed claim. (confidence: 99)

Phase 2 acceptance rejects a red lane, nonzero OOM counters, swap use, or unreadable swap evidence. Its independent arithmetic check at plan lines 315–319 would reject reverting Stryker to five runners even if the sizing probe and producer agreed. M3 logs show fresh receipt misses and three sequential packages using 21 runners.

Rejecting M1 as the measurement of record and rerunning with its receipts removed is sound: its coverage lane failed with the already-recorded database conflict. The correction preserves the mandate, constants, and schedule; gate-performance permits the named shared-resource justification. No remaining verification blocker found.

VERDICT: APPROVED
```

</details>

Arbiter notes: R11-01 closed by both witnesses at r12. Decision `d-20261002-02` (recorded before Phase 1 with the r10 parenthetical) is superseded by a corrected record carrying the M2/M3 evidence. Cumulative: 12 completed rounds (r11-r12 run by the implementing session); `plan_adopted_per_round` r11=1 r12=0 (the r12 narrowing is R11-01's residual, not a new adoption); unique issues 23 (R11-01 added, Fix, closed r12); open plan-level issues 0.

## Cumulative diff review (`84e697e9..f062be60`)

Disclosure: this context (Claude Code, Opus 5.5) wrote the plan corrections and phase briefs and arbitrated every triage. Detection ran on Codex leaves (OpenAI family) at `--role sensitive` for round d1 (the range touches `package.json`), `normal` for d2, and the records lens at `mechanical`. The writers were Codex write leaves (phase-1 `sensitive`, phase-2 `mechanical`, fix-1 `normal`).

### Diff round d1 (HEAD 84640f44; 6 code lenses over the range excluding record paths, plus the records lens over `tasks/decisions.md`)

Raw verdicts: correctness APPROVED · root-cause REVISE · tests APPROVED · minimalism REVISE · code-quality APPROVED · error-handling APPROVED · records REVISE.

| ID | Lens | Finding (short) | Verdict | Reason / evidence |
|---|---|---|---|---|
| RC1 | root-cause (blocker, 90) | `package.json:21`: DC-38 regression — `systemd-run` exiting 0 without running the scoped command now reads as passed | Skip (Defer the test gap) | Measured 2026-10-02, systemd 255.4-1ubuntu8.17: `systemd-run --user --scope … -- sh -c 'exit 7'` → 7, `-- /nonexistent-binary-xyz` → 1. The DC-38 case was only reachable with the deleted suite's fake `systemd-run`. The missing launcher regression tests are filed as tuxedo-config `f-20261002-02` |
| T1 | tests (should-fix, 97) | tuxedo-config has no test that the lock outlives the gated command while an inherited child runs (ChessFable's CR-4 test was deleted) | Defer | Different repository; filed as tuxedo-config `f-20261002-02` (together with RC1's test) |
| M1 | minimalism (should-fix, 97) | three added routing subtests duplicate the plumbing of two existing ones | Fix (`f062be60`) | rule 11 |
| Q1 | code-quality (should-fix, 96) | reserve comment names "the launcher's Node processes"; `agent-gate` is Bash and execs | Fix (`f062be60`) | `agent-run` source |
| Q2 | code-quality (nit, 99) | stale test comment ("keeps this suite green") | Fix (`f062be60`) | same file |
| E1 | error-handling (should-fix, 97) | pre-existing: `gate-receipt.mjs:285` maps every signal to 128 and drops the signal name | Fix (`f062be60`) | same area (the wrapped entry point); routed through the existing `signalExitCode`; the new test is red against the old mapping (`128 !== 143`) |
| R1 | records (should-fix, 100) | `d-20261001-02` still prescribes `scripts/heavy-gate.sh` and has no Superseded-by trailer | Fix (`f44448f2`) | `d-20261002-01` replaces its launcher clause |
| R2 | records (should-fix, 100) | `d-20261002-01` cites agent-kit's `d-20261001-05` unqualified | Skip | the parenthesis names agent-kit beside the id, the finding cites `agent-kit:d-20261001-05`, `findings.py check` passes, and editing a receipted entry breaks its effect hash |
| R3 | records (should-fix, 100) | the cited closing note and handoff do not exist yet | Skip | written by this run: this handoff before final gates, the closing note at `findings.py close` |
| R4 | records (should-fix, 100) | `tasks/decisions.md` header says rule 4c makes every decision reversible only by Felix, against the ledger contract | Defer | filed through the ChessFable inbox, area `docs-agent-config`, entry `inline` (drain merges it) |

<details><summary>lens-correctness-d1 (raw)</summary>

```text
No correctness defects found (confidence: 95). Entry points, nested calls, renamed imports and worker sizing agree with the contracts and supplied evidence.

Limitation: live launcher branches were not rerun. Test completion was blocked by `EROFS` on temporary fixtures and Vite’s config output; the 39 pure parallelism cases passed with isolation disabled (confidence: 100).

VERDICT: APPROVED
```

</details>

<details><summary>lens-root-cause-d1 (raw)</summary>

```text
[blocker] package.json:21 — Reintroduces the false-success case fixed by `d10ff95c` (DC-38): `systemd-run` exits 0 without executing the scoped command. The deleted wrapper rejected missing confirmation independently of that status. Its replacement, tuxedo-config’s `agent-run:713–725`, simply propagates the status; its confirmation check runs only inside the child that never started. All four wrapped entry points therefore lose this protection. The placement measurements cover successful launches, not this existing regression case. Preserve the protection and regression test in the shared launcher. (confidence: 90)

Limitation: both permitted test reruns exited 1 with only file-level “test failed” diagnostics. Launcher execution was prohibited, so the replacement’s regression case was assessed from source and history. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-tests-d1 (raw)</summary>

```text
[should-fix] /home/felixb/Projekte/tuxedo-config/tests/test_agent_run.py:886 — Replacement lock tests never leave an inherited child running after the gate exits. Deleting ChessFable’s CR-4 test therefore loses that assertion: releasing the lock at the main command’s exit while descendants survive would pass these tests and the supplied measurements. Restore this case in the canonical launcher suite. (confidence: 97)

VERDICT: APPROVED
```

</details>

<details><summary>lens-minimalism-d1 (raw)</summary>

```text
[should-fix] scripts/check-gate-routing-tests.mjs:123 — Three added subtests duplicate the existing cases at lines 97 and 110: create fixture, read package.json, replace one script, write it, run the checker, assert its diagnostic. Route all five cases through one table-driven test body, parameterizing the title, script, replacement command and expected diagnostic. This preserves every acceptance case while removing roughly 25–30 lines of repeated plumbing. (confidence: 97)

Limitation: both permitted test commands exited 1 with file-level `ERR_TEST_FAILURE` and no assertion diagnostics; test success could not be verified. The checkout remains clean. (confidence: 100)

VERDICT: REVISE
```

</details>

<details><summary>lens-code-quality-d1 (raw)</summary>

```text
[should-fix] scripts/gate-parallelism.mjs:10 — The reserve comment names “the launcher’s Node processes,” but the inspected `agent-gate` launcher is Bash and execs the supplied command. Name the actual processes covered; the current wording sends readers looking for nonexistent launcher-owned Node processes. (confidence: 96)

[nit] scripts/check-gate-routing-tests.mjs:306 — The comment says deleting the unresolved-command branch “keeps this suite green,” while the assertion immediately below requires that branch’s diagnostic. Describe this as the historical gap the test closes. (confidence: 99)

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-d1 (raw)</summary>

```text
[should-fix] scripts/gate-receipt.mjs:285 — Pre-existing: signal termination becomes exit 128, and the diagnostic omits `result.signal`. The caller and scheduler lose the distinction between SIGKILL and SIGTERM. Preserve the signal name and conventional signal exit status. (confidence: 97)

LIMITATION: Both permitted test commands exited 1 with only file-level “test failed” output; no passing test proof was obtained. Cause remains untraced. (confidence: 100)

VERDICT: APPROVED
```

</details>

<details><summary>lens-records-d1 (raw)</summary>

```text
[should-fix] tasks/decisions.md:4776 — d-20261001-02 remains unsuperseded while prescribing the deleted `scripts/heavy-gate.sh` at line 4772. d-20261002-01 explicitly replaces that launcher clause; the required supersession trailer is missing. (confidence: 100)

[should-fix] tasks/decisions.md:4849 — `agent-kit`’s decision is cited as unqualified `d-20261001-05`. The ledger resolver treats this as ChessFable’s unrelated database-probe decision. Use `agent-kit:d-20261001-05`, per the citation-ownership contract. (confidence: 100)

[should-fix] tasks/decisions.md:4848 — Evidence references do not resolve: f-20260930-03 remains open without the cited closing note, and the review handoff cited at lines 4850, 4860 and 4870 does not exist in the checkout or repository history. The supplied measurement logs exist, but the repository evidence pointers are incomplete. (confidence: 100)

[should-fix] tasks/decisions.md:11 — The header says only Felix may reverse any recorded decision. The referenced findings-ledger contract explicitly permits evidence-backed reversals of agent decisions and limits that restriction to Felix-attributed records. This leaves contradictory instructions standing. (confidence: 100)

Unverifiable from supplied evidence: the original 0.32 GB RSS measurement and the attribution of M2/M3 memory behavior to file-page reclamation. The logged timings, limits, peaks, OOM counters and M3 swap value match the decisions.

VERDICT: REVISE
```

</details>

### Diff round d2 (closure, `84640f44..f062be60`: minimalism, code-quality, error-handling, correctness, tests, records)

Raw verdicts: all APPROVED. M1, Q1, Q2, E1 and R1 CLOSED; no new finding. `REVIEWED_THROUGH=f062be60`. `diff_adopted_per_round`: d1=5 (M1, Q1, Q2, E1, R1), d2=0.

<details><summary>lens-minimalism-d2 (raw)</summary>

```text
M1 CLOSED — scripts/check-gate-routing-tests.mjs:97–145 routes all five wrapper cases through one table and one shared test body.

No new bloat or duplication defects found in the closure delta or surrounding code inspected.

VERDICT: APPROVED
```

</details>

<details><summary>lens-code-quality-d2 (raw)</summary>

```text
Q1 CLOSED — scripts/gate-parallelism.mjs:10–11 now names the Node scheduler, per-lane pnpm/sh parents, and gate-receipt processes.
Q2 CLOSED — scripts/check-gate-routing-tests.mjs:290–291 now describes the historical coverage gap.

No additional readability or local-consistency defects found. Review was read-only; no gates ran or files changed.

VERDICT: APPROVED
```

</details>

<details><summary>lens-error-handling-d2 (raw)</summary>

```text
E1 CLOSED — `scripts/gate-receipt.mjs:286–289` maps signals to conventional exit statuses and names them in the diagnostic. The SIGTERM regression asserts exit 143 and `signal SIGTERM`; supplied evidence confirms it failed against the old mapping.

No new error-handling defects found. Tests were inspected, not rerun, under the read-only rails.

VERDICT: APPROVED
```

</details>

<details><summary>lens-correctness-d2 (raw)</summary>

```text
M1 CLOSED — All five routing cases share one table-driven test body at scripts/check-gate-routing-tests.mjs:97–145.

Q1 CLOSED — The reserve comment names the scheduler, pnpm/sh parents, and receipt processes.

Q2 CLOSED — The comment now describes the historical gap closed by the test.

E1 CLOSED — scripts/gate-receipt.mjs:286 uses `signalExitCode()` and includes the signal name. The supplied SIGTERM proof confirms 143 instead of 128.

No correctness defects found. Limitation: runtime behavior relies on supplied evidence; no probes or gates were run under the read-only rails (confidence: 95).

VERDICT: APPROVED
```

</details>

<details><summary>lens-tests-d2 (raw)</summary>

```text
E1 CLOSED — scripts/gate-receipt-tests.mjs:175–192 exercises real SIGTERM termination and asserts status 143 plus the signal diagnostic. Reverting the fix fails these assertions; supplied evidence confirms `128 !== 143`.

No new verification gaps found. All five routing rejection assertions survive the refactor, and both affected suites remain reachable through the contract gate in CI and the push scheduler. No commands that write files were run.

VERDICT: APPROVED
```

</details>

<details><summary>lens-records-d2 (raw)</summary>

```text
R1 CLOSED — tasks/decisions.md:4776 now names d-20261002-01 as superseding; line 4850 explicitly replaces the launcher clause while preserving lane selection. The refreshed receipt hash at line 4777 matches, with operation/input identity retained.

No new findings. Read-only; no files changed.

VERDICT: APPROVED
```

</details>

## Totals and ownership

* Plan review: 12 completed rounds (r1-r10 in the PLAN sessions, r11-r12 here). `plan_adopted_per_round` r1=4 r2=4 r3=3 r4=4 r5=3 r6=1 r7=0 r8=0 r9=0 r10=0 r11=1 r12=0. Unique plan issues: 23. Fix 19, Skip 4, Defer 0, all closed. R11-01 was opened during implementation by a measurement the plan's acceptance had not anticipated.
* Diff review: two rounds, 10 findings. Fix 5, Skip 3 (RC1 measured unreachable, R2, R3), Defer 2 (T1+RC1's test gap → tuxedo-config `f-20261002-02`; R4 → ChessFable inbox).
* Successors: tuxedo-config `f-20261002-02` owns the launcher regression tests (inherited IDs T1, RC1). The ChessFable inbox entry for the `tasks/decisions.md` header owns R4. Both entries are self-contained. Load this record before reviewing either.
* The intermittent backend-test flake that reddened measurement run M1 is ChessFable `f-20261002-02` (open), recurrence noted in the f-20260930-03 closing note.
