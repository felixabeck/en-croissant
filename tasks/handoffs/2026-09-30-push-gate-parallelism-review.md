# Handoff: ChessFable push-gate parallelism — reviewed plan and review record (2026-09-30)

Durable copy of the reviewed plan `tasks/plans/2026-09-29-push-gate-parallelism.md` (that directory
is git-ignored). The plan below is the implementation contract; its `## Reviews` section is the
complete cumulative plan-review history (30 Codex lens rounds, issues PG-01…PG-137, raw reports in
the planning session's scratch run directory, which may be gone). The implementation run loads this
file before its diff review and must confirm PG-136 and PG-137 there (see "Closure" at the end).

S0 is done and on `origin/master`: `8b97e423` fix(db) for `f-20260929-07` (planning session),
extended by a separate session's `3ed94336` (drain SQLite connections on every retirement path)
and its test commits. The findings `f-20260929-07/08/09/12` were filed by the planning session.
The implementation run starts at S1.

---

# Plan: ChessFable push gate uses the machine (2026-09-29)

## MANDATE (fixed across rounds)

Felix, in the chat of 2026-09-29 (quoting the AgentKit audit he pasted):

> Repo: ChessFable — Gate today: 12–25 min — Where the time goes: Stryker capped at 2 workers
> (7.4 min). Backend and frontend run one after the other. The Rust tests run twice, once plain
> and once for coverage. — Biggest wins: Raise Stryker to about 18 workers; run the backend and
> frontend in parallel (the reason for running everything in order was fixed on 2026-09-19);
> raise unit-test workers from 4 to all cores; drop cargo check, which clippy already covers; run
> the Rust tests once, with coverage, instead of twice. — Expected after: ~6–8 min (est.)

> Speed up this repo's push gate so it uses the 24-core / 91 GB machine. […] Measure the current
> gate wall time per step first, then implement the parallelization (test runner across cores
> with isolation for shared DB/paths, independent gate steps run concurrently, remove
> unjustified worker caps), re-measure, and push through the push skill. Record before/after
> timings in the handoff. Any cap that must stay needs a written reason next to it.

> Find out what to improve in this repository here. Plan it carefully and review the plan with
> codex. Full auto. Pause when the plan is completely approved and give me a handover prompt to
> do the implementation in a new terminal.

## Correction to the briefing (measured 2026-09-29 on tuxedo-atlas, before any change)

The audit's direction holds; four of its specifics do not survive measurement:

1. **Raising vitest workers alone gains nothing.** `vitest run --coverage.enabled`: 120.5 s at
   `maxWorkers: 4`, 121.0 s at 24. One file, `scripts/check-rust-release-surface.test.mjs`
   (286 tests, each `git init` + a `spawnSync` checker process), runs 81.8 s of the 103 s summed
   test time; vitest parallelises across files, never within one. The file is the critical path.
2. **Stryker at 18 workers is OOM-killed.** Every agent session runs inside an 8G
   `run-*.scope` (`~/Projekte/tuxedo-config/agent-slice/agent-run`, `MemoryMax=8G`). At 12, 18
   and 23 runners the kernel killed Stryker's vitest children 275 times
   (`Memory cgroup out of memory`, `oom_memcg=…agents.slice/run-r5cd4c70….scope`); wall time
   plateaued at ~300 s (23 runners: 452 s). At 8 runners: 0 kills, 291 s. Three packages in
   parallel at 4 runners each: 212 s (slowest package). Worker counts must be sized from the
   memory envelope, not the core count. Filed for tuxedo-config: `f-20260929-01` there.
3. **The 2026-09-19 fix does make receipt gates safe side by side.** `backend-test`,
   `backend-coverage`, `frontend-coverage` and `frontend-mutation` were started concurrently
   through `gate:run`; the three that passed all recorded receipts (no "tree changed" refusal),
   peak 6.06 GB anon, 0 OOM kills. The fourth failed on an unrelated flaky test (item 4).
   One exception stands: `frontend-build` and `e2e-container` both write `dist/`
   (`playwright.config.ts` `webServer.command` runs `vite build` in the mounted tree).
4. **Running the Rust tests once is rejected here** (decision to record, see S5): the two runs
   use different toolchains (stable, which ships; pinned `nightly-2025-06-01`, which only exists
   for branch coverage) and different target directories, so they run concurrently for no wall
   time. The Linux CI job runs only the nightly one.

Filed while measuring (not part of this plan): `f-20260929-07` (bound-SQLite sidecar test fails
5/30 serial runs on an idle machine — a prerequisite, see S0), `f-20260929-08` (one 21 s Rust test
bounds both backend gates), `f-20260929-09` (281 static mutants in `workspace.ts`/`tabStorage.ts`
take ~89% of the `workspace-storage` mutation time; only a state-module design change removes it).

## Baseline (warm caches, serial, one session, 2026-09-29)

| Step | Wall | Peak anon (scope) |
| --- | --- | --- |
| `pnpm gates:contract:check` | 43.8 s (36.5 s rerun) | 0.5 GB |
| `cargo fmt --check` / `cargo check` / `cargo clippy` / `rust:windows:check` | 0.8 / 5.2 / 4.6 / 4.7 s | 1.5 GB |
| `cargo test --all-targets` (backend-test) | 32.8 s (compile 9.8 s, tests 23.7 s) | 1.8 GB |
| `test:coverage:backend` + check | 38.5 + 0.8 s | 2.0 GB |
| `test:coverage` + check (frontend-coverage) | 120.5 + 0.3 s | 2.0 GB (w4), 3.2 GB (w12) |
| `build-vite` + `bundle:check` | 6.4 + 0.4 s | 1.6 GB |
| `test:e2e:container` | 46.1 s (`--workers=4`: 19.9 s, 55/55 green) | 0.1 GB (container outside scope) |
| `mutation:frontend` (concurrency 2) | 549.1 s (23 + 294 + 229 s by package) | ~1.5 GB |
| **Serial sum, all blocks** | **≈ 853 s ≈ 14.2 min** | |

## Target

All blocks affected, inside the current 8G session scope: **≈ 4.5 min** (estimate: P0–P2 ≈ 60 s,
then mutation ≈ 210 s). Rust-only push: ≈ 50 s (from ≈ 130 s). Frontend-only: ≈ 4.2 min.
The residual is dominated by mutation's static mutants (`f-20260929-09`) and the scope cap
(tuxedo-config `f-20260929-01`), both outside this plan.

## Sections (area-cohesive; order is dependency only)

### S0 — Prerequisite: `f-20260929-07` handled first (separate run)

Every section below changes `package.json`, workflows or gate scripts, so the push skill runs
**every** gate, including `backend-test`/`backend-coverage`, which today fail ~1 in 6 runs on
`pool_parent_swap_keeps_wal_and_shm_in_held_parent_and_unlinks_them_there`. The before/after
timing runs and the final gates need them reliably green. Run `/next-finding` pinned to
`f-20260929-07` to completion (its own `$push`) before S1. Not implemented by this plan.

### S1 — Shared worker-budget primitive (dependency of S2, S3, S5)

**New file `scripts/gate-parallelism.mjs`** (rule 6d: a helper; the cheap alternative — fixed
numbers per tool — is rejected because the right count differs between the 8G agent scope,
an unconfined shell and the 4-core CI runner, and fixed numbers are exactly the unexplained caps
the mandate removes). Exports, pure and injectable (filesystem and `os` passed in for tests):

* `memoryLimitBytes()` — the smallest `memory.max` along the process's cgroup-v2 path
  (`/proc/self/cgroup` `0::<path>`, then `/sys/fs/cgroup<path>/memory.max` and every ancestor;
  `max` = unlimited), bounded by `os.totalmem()`. A level whose `memory.max` does not exist
  (`ENOENT`) has no limit of its own — measured 2026-09-29: the host root `/sys/fs/cgroup` has no
  `memory.max`, while inside a container the namespace root does (`max`) — so the walk treats
  `ENOENT` for `memory.max` as unlimited and continues, **only while the level's directory
  itself exists**; if the process's own cgroup directory `/sys/fs/cgroup<path>` is absent (the
  hierarchy is not visible in this mount namespace), that is an error, not "unlimited" (PG-93,
  PG-95). On Linux, a missing `0::` line (cgroup v1), a
  missing `/proc/self/cgroup`, any other read error (e.g. `EACCES`) or an unparsable value is an
  **error** naming the path and telling the caller to set
  `GATE_MEMORY_BYTES` — never a silent fall-back to physical RAM, which inside the 8G scope would
  recreate the OOM kills this primitive exists to prevent. Non-Linux platforms (macOS, Windows
  CI; no cgroup) use `os.totalmem()`. Measured on atlas today: own scope `8589934592`,
  `agents.slice` `51539607552`.
* `workerCount({ perWorkerBytes, baseBytes = 0, budgetBytes })` — `clamp(1, cpuCap,
  floor((budget - baseBytes) / perWorkerBytes))`, with `cpuCap = max(1,
  floor(availableParallelism() × GATE_CPU_SHARE))` (upper bound: all cores when the process runs
  alone, no reserved core). `GATE_CPU_SHARE` is set by a parent that runs several self-sizing
  children at once (S3: 1/3 per Stryker package; S5: the lane's share), is a decimal in (0, 1],
  defaults to 1, and any other set value is an error naming the variable. Children multiply
  nothing themselves; the parent passes the already-divided share, so N concurrent children
  never exceed `availableParallelism()` together **as long as there are at least N CPUs**. Below
  that, each child's floor of one worker would oversubscribe, so a parent never runs more
  self-sizing children at once than `floor(availableParallelism() × its own share)` (minimum 1):
  S3 then runs its packages in that many concurrent slots.
  where `budget` is, in order: the `budgetBytes`
  argument; else `GATE_MEMORY_BYTES` when it is a positive decimal integer (any other set value
  is an error naming the variable, never silently ignored); else
  `memoryLimitBytes() - AGENT_RESERVE_BYTES`. That selection is exported on its own as
  `gateBudgetBytes()`; every consumer — including S5's scheduling decision — uses it, never
  `memoryLimitBytes()` directly, so a set `GATE_MEMORY_BYTES` short-circuits cgroup detection
  (a Linux host with unreadable cgroup files still runs when the override is set).
  A budget below `baseBytes + perWorkerBytes` (the smallest viable single worker) is an
  **error** naming budget and minimum — never clamped up to one worker that would run over budget.
* Named constants, each with its measured reason in an adjacent comment:
  `AGENT_RESERVE_BYTES` = 1 GiB (the agent process measured 0.32 GB RSS in its scope; headroom for
  a lens leaf or shell); `STRYKER_RUNNER_BYTES` = 640 MiB (OOM-killed runners measured
  0.40–0.49 GB anon; Stryker parent on top); `VITEST_WORKER_BYTES` = 256 MiB and
  `VITEST_BASE_BYTES` = 1.5 GiB (w4 → w12 added 1.22 GB for 8 workers; w4 peak 1.95 GB).
  The implementation re-measures these and updates the constants before S3/S5 measurements.

Proof: `scripts/gate-parallelism-tests.mjs` (node:test) — limit taken as the minimum along the
path; `max` handled; a finite cgroup limit above `os.totalmem()` is bounded by totalmem;
a level without `memory.max` (ENOENT, as at the host root) is skipped as unlimited while a
lower level's limit still applies; `EACCES` on a `memory.max`, an unparsable value, a missing
`/proc/self/cgroup`, a missing own cgroup directory (every level ENOENT) — **also when an ancestor directory exists
with a finite `memory.max`** (PG-99) — and cgroup-v1 content each throw the named error on Linux
(PG-93, PG-95); non-Linux uses
totalmem; a valid `GATE_MEMORY_BYTES` wins over the cgroup; an invalid one (`abc`, `0`, `-1`,
`1.5`, and the set-but-empty string `""`) throws naming the variable; with the override set, an unreadable cgroup is never read
(no throw); a budget below `baseBytes + perWorkerBytes` throws naming both numbers; result
never < 1 nor > `availableParallelism()` (including `availableParallelism() === 1`); exact
`gateBudgetBytes()` with the override unset returns the injected cgroup limit minus
`AGENT_RESERVE_BYTES` exactly (PG-115); exact
results for a fixture (24 CPUs, budget 8 GiB, `baseBytes` 1.5 GiB, 256 MiB/worker → 24; the same
with 2 GiB/worker → 3, proving `baseBytes` is subtracted); `GATE_CPU_SHARE=1/3` on 24 CPUs caps
at 8; invalid shares (`0`, `1.5`, `x`, `""`) throw. Add `gates:parallelism:test` to `gates:contract:check` (the
routing checker requires every `*:test` script to be routed), and update the exact
`CONTRACT_CHAIN` literal in `scripts/check-gate-routing-tests.mjs` (line 17, compared at line
898) in the same commit; S5 updates the same literal again when it adds `gates:push:test`.

### S2 — Vitest suite: remove the single-file critical path, then use the budget

* Split `scripts/check-rust-release-surface.test.mjs` into test files of roughly equal measured
  duration, **each ≤ 15 s** at the current per-test cost (≈ 0.28 s/test → ≈ 6–7 files), named
  `scripts/check-rust-release-surface-<topic>.test.mjs` (matches the Vitest include
  `scripts/**/*.test.mjs`). Shared fixture/helper code (lines 1–169 today) moves to
  `scripts/rust-release-surface-fixture.mjs` — **not** `check-*.mjs` and not executable, because
  the routing checker treats `scripts/check-*.mjs` as checker files that must be routed.
  The split is a **pure move**: every test and assertion is kept verbatim. Proof beyond the
  count (JSON reporter: 286 tests, all **passed**, 0 skipped/todo, before and after — PG-131): a one-off command in the handoff (not a committed
  script, rule 6d) parses the old file at the base commit and the new files with the repository's
  installed JS parser and extracts **every statement at every nesting level except imports** —
  test calls, `describe` bodies and every declaration such as the `test.each` case tables
  (`suppressionCases` at `:828`, passed at `:840`) — normalises indentation only, and shows the
  two multisets are identical (PG-100). The only normalisation besides indentation is
  export-awareness: a helper declaration that gained an `export` modifier (or a named-export
  list) to be shared from the fixture module is compared as the bare declaration, and the new
  files' imports of those helpers are excluded like every other import (PG-127). Because the
  ≤ 15 s target splits some of the five top-level `describe` suites across files, `describe`
  wrappers are **flattened**: every non-`describe` statement (test call, `test.each` table,
  declaration, hook) is keyed by its describe path, where each path segment is the wrapper's
  **callee and arguments other than the body** — `describe` vs `describe.skip`/`.only`/`.todo`/
  `.concurrent`, the title, and any options object — so a changed execution modifier changes the
  key (PG-131); the path is written here by title (e.g. `R5 config, test-only scope, and
  physical source surface › <statement>`), and the two multisets of (title path, normalised
  source) pairs must be identical. A suite split into several files keeps every title path, so
  the proof passes for a pure move and still fails for any changed, dropped or added statement
  (PG-130); the fixture module's exports are byte-identical moves of the old
  helpers.
* Under the mutation runner (`STRYKER_MEMORY_BYTES` set), the vitest worker helper returns 1
  without reading the cgroup or `GATE_MEMORY_BYTES`: Stryker forces `maxWorkers: 1` per runner
  anyway, and this keeps `vite.config.ts` from failing inside a Stryker child on a host where
  cgroup detection fails (PG-97).
* `vite.config.ts`: replace `minWorkers: 1, maxWorkers: 4` with
  `maxWorkers: vitestMaxWorkers()` — a vitest-specific export of `gate-parallelism.mjs` that
  returns `undefined` (option unset, nothing read) when `process.env.VITEST` is not `"true"`,
  because `vite build` evaluates the same config and must never read the cgroup (PG-120;
  measured 2026-09-30 with a scratch config: Vitest's config evaluation sees `VITEST=true`, `vite
  build`'s sees it unset); returns 1 under `STRYKER_MEMORY_BYTES` (PG-97); and otherwise
  `workerCount({ perWorkerBytes: VITEST_WORKER_BYTES, baseBytes: VITEST_BASE_BYTES })` (PG-98;
  Stryker's own `concurrency` keeps its separate budgeted path in S3)
  and a one-line reason comment. (Stryker's vitest runner overrides `maxWorkers: 1` per runner —
  `@stryker-mutator/vitest-runner` `vitest-test-runner.js:47` — so this does not multiply
  Stryker's memory.) Check that `minWorkers` is still accepted by vitest 4.1 before deciding
  whether to keep it.

Proof: a **Vitest** test `scripts/vite-worker-budget.test.mjs` (Vitest loads TypeScript
natively; `node --test` cannot import `vite.config.ts` on the supported Node ≥ 20.19 floor, whose
type stripping arrived in 22.6) imports `vite.config.ts` under a fixed `GATE_MEMORY_BYTES` (set
before a dynamic import, with `vi.resetModules()`) and asserts
`test.maxWorkers === workerCount(...)` for that budget, so a revert to a literal `maxWorkers: 4`
goes red; `pnpm test` green three consecutive times; `pnpm test:coverage` + `coverage:frontend:check`
green (the frontend ratchet measures `src/**` only, so moved test files cannot change it); wall
time recorded at the derived worker count and at 4 for comparison. Expected ≈ 30–40 s.

### S3 — Frontend mutation: packages in parallel, runners sized to memory

`scripts/run-frontend-mutation.mjs`, `stryker.config.mjs`, `scripts/run-frontend-mutation-tests.mjs`.

* Run the three packages **concurrently** — at most `max(1, floor(availableParallelism() ×
  GATE_CPU_SHARE))` at a time (PG-42: on 1–2 CPUs the packages queue instead of each claiming a
  worker floor) — one Stryker child each. Failure semantics stay as today (PG-90): the first red
  package ends the run — running siblings are terminated through the fan-out below, queued
  packages are not started — and the runner exits with that package's code, naming it. A spawn
  error (no exit code) is a first failure too, diagnosed with the package name and the error
  (exit 127, PG-108). A
  package killed by a signal (`code` null, e.g. an OOM kill) exits `128 + signal number` with the
  signal named in the diagnostic, never a generic 1 (PG-92; today's runner maps it to 1).
* Per-package `tempDirName: .stryker-tmp/<package>`. **Measure before relying on it (rule 12b):**
  a sandbox of one package must not contain another package's sandbox. Probe: run two packages
  concurrently and `find .stryker-tmp/<a>/sandbox-*/ -maxdepth 2 -name '.stryker-tmp'` must be
  empty; if Stryker's default ignore does not cover the nested path, add `.stryker-tmp/**` to
  `ignorePatterns` and re-probe.
* `concurrency` in `stryker.config.mjs` = `workerCount({ perWorkerBytes: STRYKER_RUNNER_BYTES,
  baseBytes: STRYKER_PARENT_BYTES })` (PG-84: the Stryker parent process of each package is
  charged once per package; `STRYKER_PARENT_BYTES` is measured — parent RSS during a package run —
  and recorded with its constant; the slot formula below uses `STRYKER_PARENT_BYTES +
  STRYKER_RUNNER_BYTES` as the minimum per package)
  with `budgetBytes` read from **`STRYKER_MEMORY_BYTES`** (validated like `GATE_MEMORY_BYTES`;
  required, an error when absent). The runner computes its own budget with `gateBudgetBytes()`
  (which honours the value S5 hands the lane) and gives each child `STRYKER_MEMORY_BYTES =
  floor(budget / slots)` and `GATE_CPU_SHARE = inheritedShare / slots`, and **removes
  `GATE_MEMORY_BYTES` from the child's environment** (PG-86): Stryker's vitest runner evaluates
  `vite.config.ts` (`configFile`) before it forces `maxWorkers: 1`, so a per-package budget below
  vitest's 1.75 GiB minimum in `GATE_MEMORY_BYTES` would make that config throw inside every
  runner. Without the variable, `vite.config.ts` sizes from the cgroup and the value is then
  overridden by Stryker anyway,
  where `slots = max(1, min(3, floor(availableParallelism() × inheritedShare),
  floor(budget / (STRYKER_PARENT_BYTES + STRYKER_RUNNER_BYTES))))` is the number of packages
  admitted at once — bounded by
  CPU **and** memory (PG-62: at low budgets fewer slots, each fitting one parent plus one
  runner) (PG-57: with one slot a package gets the whole budget, not a third), so
  the three packages together never exceed the CPU cap the runner itself had (on the 24-core
  host alone: 8 runners each, 24 total, at most — memory permitting). Replace `concurrency: 2` and add the
  reason comment. Standalone `pnpm mutation:frontend` keeps working without S5.
* Fence: one fence for the whole run, as today. `owner.json` `child` becomes `children`
  (array of identities); `readOwner`/`refuseFence` accept and report the array, and read a
  **legacy** `{runner, child}` record (written by the runner before this change, possibly still
  live) as `children: [child]` — never as malformed, so a live legacy child is reported alive and
  no `rm -rf` recovery is printed for it (PG-105). Legacy `child: null` and the new record's
  **`spawning`** field mean *unknown*, not *none*: the runner writes `spawning: <package>` before
  each spawn and clears it only after the child's identity is recorded, closing today's
  spawn-to-record window (`run-frontend-mutation.mjs:187-196`, where a runner dying between spawn
  and record leaves `child: null` and the refusal prints `rm -rf` over a possibly live Stryker).
  While a spawn is pending (or legacy `null`), the refusal prints no recovery command and tells
  the operator to confirm no `stryker` process is running first (PG-106). A dead child **leader**
  is not proof that its work is gone — a Stryker grandchild can outlive it (the existing suite
  models exactly that, `run-frontend-mutation-tests.mjs:262`), and `identityIsLive` checks only
  the recorded PID (`process-identity.mjs:72`). Each child is spawned `detached`, so its process
  group id equals its PID; the recovery command is printed only when, for every child, the
  leader is dead **and** `process.kill(-pgid, 0)` fails with `ESRCH` (group empty). Any other
  result — success, `EPERM`, an unexpected error — withholds recovery, the conservative
  direction (a reused group id can only withhold, never wrongly grant) (PG-122); the purge of
  `.stryker-tmp` stays owner-only at start. **Signal fan-out:** today `installSignalForwarding`
  (`scripts/child-supervisor.mjs`) forwards to one supervisor and `attach()` does not retain
  earlier ones, so reusing it for N children would leave siblings running after SIGINT/SIGTERM.
  Extend `child-supervisor.mjs` with one API that tracks a set of supervisors and, on a signal,
  terminates every child's process group and awaits all of them before the runner exits; S3 and
  S5 both use it (rule 11: two callers, one primitive). `superviseChild().terminate()` can
  reject (process-group signal or sweep failure); the fan-out attempts and awaits **every**
  child's termination regardless (`Promise.allSettled` semantics), then surfaces any cleanup
  failure as a non-zero exit with the child named. A signal also **latches admission**: no queued
  package starts after it (PG-52). Every **error** exit of the runner — not only signals, e.g. an
  owner-record write failing after a spawn — terminates and awaits every started child before
  returning (PG-53). The mutation fence is removed only after
  every child is confirmed gone; if any termination failed, the fence stays (with the recovery
  message the runner already prints), so a later run cannot purge `.stryker-tmp` under a
  survivor. Tested in `mutation:runner:test` with two
  fake long-running children: after SIGTERM to the runner, both process groups are gone; and
  with one child whose termination rejects, the sibling is still terminated, the failure is
  reported, and the fence is still present afterwards; with packages queued (1 CPU injected), a
  SIGINT starts no queued package and exits 130; with the owner-record write made to fail after
  a spawn (injected), the started child is terminated and the runner exits non-zero.
* Output: each child's stdout/stderr to `artifacts/mutation/frontend/<package>/stryker.log`
  (gitignored `artifacts/`), with one progress line per package on the runner's stdout and the
  log tail printed for a failed package.

The existing foreign-owner test (`the finaliser does not remove a fence it does not own`,
`scripts/run-frontend-mutation-tests.mjs:250-259`, open finding `f-20260917-11`: CI run
35246951216 exited 0 instead of 1) is rewritten in this section because the owner format changes
under it: it waits until `owner.json` records the child (not only the child's `started` marker)
before replacing the owner and releasing the child, so the test cannot overwrite the owner before
the runner's own write (PG-102). If investigating shows the finaliser itself has a
read-after-decide race, that is fixed in `run-frontend-mutation.mjs` instead; either way
`f-20260917-11` is closed with the evidence.
Proof: `pnpm mutation:runner:test` extended — concurrent children, first-failure-ends-the-run
semantics, `children` fence round-trip and refusal message — including a dead runner with a
mixed dead/live `children` array, for which the recovery command is **not** printed; it is
printed only when the runner and every child are dead (PG-101); a live **legacy** `{runner,
child}` fence is refused as alive with no recovery command (PG-105); a fence whose runner is dead
with `spawning` set, and a legacy fence with a dead runner and `child: null`, are each refused
with no recovery command (PG-106); a fence whose runner and child leader are dead while a
grandchild in the child's process group is still alive (fake leader that spawns a long-lived
same-group grandchild and exits) is refused with no recovery command, and printed recovery only
once that grandchild has exited (PG-122); with the group probe injected to fail with `EPERM` and,
separately, with an unexpected error, recovery is withheld (PG-125); the **producer ordering** is proven deterministically at the
unit level (PG-107, PG-109): `run-frontend-mutation.mjs` gains the repository's
`isEntrypoint(import.meta.url)` guard (`scripts/entrypoint.mjs`, as `run-e2e-container.mjs:109`
uses) around its top-level `main()` call — today it runs `main()` unconditionally at import
(`:247`), which would execute the CLI inside the test (PG-126); the `--list-packages` branch (`:27`, which calls `process.exit(0)`
at module evaluation) moves inside the same guard, so **no** top-level code of the module acts on
the process when imported (PG-133); a test imports the module in a child process — once plain and
once with `--list-packages` in that child's `process.argv` — the child writes a completion
marker to a separate file (a path passed in its environment, never stdout/stderr) only *after*
`await import(...)` has resolved, and the parent requires that file
(so a module-level `process.exit(0)` cannot pass as a clean import — PG-134) — and asserts that `process.exitCode` is still `undefined` afterwards and nothing was
written to stdout/stderr — the module ends with `process.exitCode = await main()` inside a
top-level `try`, so an unguarded import always sets it (0 or 1) before the import resolves,
whatever the environment (PG-129, PG-132) — and exports its package scheduler with an
injectable `spawn` function only (the CLI passes the real one; no environment seam); the owner
record is written by the **production** writer into a temporary fence directory. The injected
`spawn` reads that real `owner.json` from disk *synchronously at the moment it is called* and
asserts `spawning` names the package (PG-116), and after the scheduler records the child the
test reads the file again and asserts `children` contains the new identity with `spawning`
cleared. The reader test
above proves a record left in the pending state is refused without recovery, so the two together
prove the window is safe. Through the same injection, `spawn` emits an `error` for one package
(PG-108, PG-111): the diagnostic names the package and the error, the runner result is exactly
127 (PG-110), the running sibling is terminated and the queued package never starts. The existing
`waitForRecordedChild` test helper (`run-frontend-mutation-tests.mjs:101-120`) and its caller
(`:178-181`) move to the new record shape (`owner.children`, not `owner.child` — PG-114); it
retries only `ENOENT` (the record is published by atomic rename, `run-frontend-mutation.mjs:142-147`,
so a partial file is never observable — measured 2026-09-30 on this checkout's ext4: one writer
doing write-temp-then-rename of a ~15 KB record 193,905 times in 8 s against two concurrent
`readFileSync`+`JSON.parse` loops, 1,727,166 reads, **0** parse errors, **0** `ENOENT`) and propagates every other error, parse errors included,
instead of ending in a bare timeout (PG-112, PG-113) — signal to all children, and each
child receiving `STRYKER_MEMORY_BYTES = floor(budget / slots)`, `GATE_CPU_SHARE` = the runner's
share divided by `slots`, and no `GATE_MEMORY_BYTES`. Expected values are **computed in the test
from the measured constants** (never hard-coded example numbers that silently assume a parent
size — PG-87): 24 CPUs with a large budget → 3 slots, thirds; 1 CPU → 1 slot with the whole
budget; and a **discriminating case** with budget `= 2 × STRYKER_RUNNER_BYTES +
STRYKER_PARENT_BYTES` on 3 CPUs, where a runner-only formula would admit 2 slots but the
parent-inclusive one admits exactly 1, asserting 1 slot and a child budget equal to the whole
budget; no child ever receives less than `STRYKER_PARENT_BYTES + STRYKER_RUNNER_BYTES`. The first
red package terminates its running siblings and starts no queued one (PG-90); fake children
that print known lines prove each child's output lands in its own
`artifacts/mutation/frontend/<package>/stryker.log`, one progress line per package appears on the
runner's stdout, and a failing child's log tail is printed (PG-103); a fake Stryker child
that kills itself with SIGKILL makes the runner exit 137 and name the signal, terminates its
running sibling and starts no queued package — with 2 CPUs injected so two packages run and the
third is queued, the kill delivered only after both running children are established (PG-92,
PG-94, PG-96); an aggregate case computes each child's `workerCount` from the environment it was
handed and asserts the sum ≤ `availableParallelism()`, for 24 CPUs and — with
`availableParallelism` injected — for 2 and 1 CPUs (packages queue: at most 2 resp. 1 child
alive at a time). A config test imports
`stryker.config.mjs` with `STRYKER_PACKAGE` and `STRYKER_MEMORY_BYTES = STRYKER_PARENT_BYTES +
3 × STRYKER_RUNNER_BYTES` and asserts `concurrency === 3` (and at `+ 1 ×` → 1); a **CPU-limited** case with ample memory
(24 CPUs injected, `GATE_CPU_SHARE = 1/3`, `STRYKER_MEMORY_BYTES` large) asserts
`concurrency === 8`, and a contrasting case (2 CPUs, share 1/2, ample memory) asserts
`concurrency === 1`, so neither a config that ignores the share nor a hard-coded cap passes
(PG-135, PG-136). The CPU count is injected test-side only — the config is imported in a child
started with `node --import <preload>` whose preload overrides `os.availableParallelism` — never
through a production seam; with `STRYKER_MEMORY_BYTES` unset, empty,
`abc` or `0` the import throws naming the variable (PG-119); so reverting to a
literal `concurrency: 2` goes red. The Vitest wiring test (S2) additionally imports
`vite.config.ts` with `GATE_MEMORY_BYTES` unset and `STRYKER_MEMORY_BYTES` set to a small
per-package value and asserts `maxWorkers === 1` without throwing — also with an unreadable
cgroup injected (PG-86, PG-97) — and two node:test cases pin the build-mode path (PG-120, PG-121): (a) the **production
config** is loaded exactly as `vite build` loads it — Vite's exported `loadConfigFromFile` on
`vite.config.ts` (Vite bundles the TypeScript itself), in a child process with `VITEST` and
`GATE_MEMORY_BYTES` unset — and `test.maxWorkers` must be `undefined`: any wiring that computes a
worker count in build mode (e.g. a direct `workerCount(...)` call, or `vitestMaxWorkers() ??
workerCount(...)`) yields a number and fails; (b) `vitestMaxWorkers()` with `VITEST` unset and
a cgroup reader injected to throw returns `undefined` without calling the reader. (a) proves the
config routes through the helper's build-mode branch, (b) proves that branch never reads the
cgroup, so an unreadable cgroup cannot break a Rust-only or bindings-only P1 build — without a
cgroup-path seam in production code.
`pnpm mutation:frontend` green; wall time and OOM-kill count (`journalctl -k | grep -c
"Killed process"` over the run) recorded; **0 kills required**. Expected ≈ 210 s in the 8G scope.

### S4 — Browser e2e: files in parallel

`playwright.config.ts`: `workers: 1` → `workers: 4` (10 spec files). Reason comment: the container
runs outside the agent's memory scope (docker daemon cgroup), measured 49 → 20 s at 4.
`fullyParallel: false` has no recorded reason, and the source does not show an in-file order
dependency (`e2e/fixtures.ts` gives each test an isolated page with cleared storage), so it is
**measured, not kept by assumption**: run the suite with `fullyParallel: true` at 4 and at the
fastest worker count. If five consecutive runs are green with no snapshot move, set
`fullyParallel: true`; if any run fails, keep `false` and record the failing test as its reason
in the adjacent comment.

Proof: `pnpm test:e2e:container` green five consecutive runs at the chosen `workers` and
`fullyParallel`; no snapshot moves. Also measure 6 and 10 workers once; keep 4 unless a larger
value is faster **and** five-times green.

### S5 — Push gate lanes (skill, runner, routing checker, CI)

**New file `scripts/run-push-gates.mjs`, package script `gates:push`** (rule 6d: a runner; the
cheap alternative — prose telling the agent to start the §2 blocks in concurrent shells — is
rejected because the memory budget must be divided between lanes, Claude, Codex, Grok and
headless drains must behave identically, and failures must stay readable).

* Arguments: `--rust`, `--frontend`, `--bindings` (any combination; tolerate a leading pnpm `--`;
  an unknown argument is a usage error, exit 2). **No flag** runs the contract-only invocation —
  P0 guard plus the `contract` lane — which is how a Markdown/planning-only push runs its
  unconditional contract gate through the same route (PG-83). **Selection (PG-78)** — the runner is literal; the push skill's path
  map decides the flags (a cross-layer change passes all three):

  | Step / lane | always | `--rust` | `--frontend` | `--bindings` |
  | --- | --- | --- | --- | --- |
  | P0 guard; `contract` lane | ✓ | | | |
  | P0 `setup-rust` | | ✓ | | ✓ |
  | P1 `frontend-build` | | ✓ | ✓ | ✓ |
  | P1 `bindings:check` | | | | ✓ |
  | `rust-lint`, `rust-test`, `rust-coverage` | | ✓ | | |
  | `bundle`, `frontend-coverage`, `e2e`, `frontend-mutation` | | | ✓ | |

* **Two ordering constraints, both measured, shape the schedule:**
  1. `dist/` is a compile input of the Rust crate (`tauri.conf.json` `frontendDist: "../dist"`
     via `generate_context!`). Measured 2026-09-29: after `pnpm build-vite`, an otherwise no-op
     `cargo check --all-targets` re-checks `chessfable`. So no step that writes `dist/` —
     `frontend-build`, and `e2e-container`, whose `webServer.command` runs `vite build` into the
     mounted tree — may overlap any cargo command (`clippy`, `rust:windows:check`, `bindings:check`,
     `backend-test`, `backend-coverage`). On a fresh checkout `dist/` must exist before any cargo
     compile (CI's Rust-only jobs `mkdir -p dist` for this reason).
  2. `bindings:check` rewrites `src/bindings/generated.ts` when it is stale, and the tracked-file
     rewriter prohibition (f-20260906-06) stays: it never runs beside a receipt-backed gate.
     The `contract` lane's `lint:ci` runs `i18next-cli extract --ci`, which is likewise a
     *conditional* writer of `src/translation/**`. Measured 2026-09-30 on a clean tree: exit 0,
     size and mtime of every tracked translation file unchanged — read-only on a green tree, the
     property f-20260906-06 established for bindings. On a stale tree it writes and `lint:ci`
     fails, so the run is red regardless; a receipt gate running beside it then refuses ("tree
     changed"), which can only add refusals to a red run, never a false green. The push skill's
     rewriter rule is restated precisely: an *unconditional* rewriter never runs beside receipts;
     a conditional one that is measured read-only on a green tree may, and its stale case is a
     red run. `bindings:check` stays in P1 anyway because it compiles against `dist/` (PG-104).
* **Schedule** (exported table: phases of serial steps, then lanes with `after` dependencies):
  * **P0, serial:** the mutation guard (`pnpm mutation:guard:check`, a contract-chain member),
    refusing everything on a live fence — a non-zero guard exit aborts before setup, P1 or any
    lane, with the guard's exit code. A failing `bash scripts/setup-rust.sh` does **not** stop the
    run: it skips only its consumers — `bindings`, `rust-lint`, `rust-test`, `rust-coverage` —
    while `contract` and the frontend lanes run (PG-76); `bash scripts/setup-rust.sh` when `--rust` or `--bindings`.
  * **P1, serial — the `dist/` and bindings producers:** with `--frontend`, `--rust` or
    `--bindings` (every consumer of `dist/`: cargo compiles and the bundle check),
    `pnpm gate:run frontend-build` (its reader `pnpm bundle:check` runs as the P2 lane `bundle`,
    so a red bundle budget does not stop independent lanes — PG-56). `gate:run`, not `ensure`: the
    receipt fingerprints tracked files only, while `dist/` is ignored, so a valid receipt
    cannot vouch that `dist/` exists or came from this tree (a deleted `dist/`, or one written by
    a build of another commit, would reach `bundle:check` and every cargo compile). The build is
    6.4 s; the push skill's fenced line changes to `gate:run` with this reason. A Rust-only run
    rebuilds `dist/` too (PG-88): an existing ignored `dist/` from another tree would otherwise
    be compiled into every cargo target — the same stale-artifact class as PG-17. Then, with
    `--bindings`, `pnpm bindings:check`.
    A red P1 step skips only what consumes its output (PG-63): a failed `frontend-build` skips `bindings`, every cargo lane and `bundle` (reported `skipped` with the
    reason). `e2e` is **not** skipped: its `webServer.command` runs its own `vite build`, so it
    does not consume P1's output and still runs once P1 has finished (PG-75); a failed `bindings:check` skips nothing else (it is a check, not an input).
    `contract`, `frontend-coverage` and `frontend-mutation` do not read `dist/` and always run.
  * The memory budget (`gateBudgetBytes()`) is computed only when a self-sizing lane is
    selected (`--frontend`); a contract-only or Rust-only run never reads the cgroup, so a host
    where cgroup detection fails still runs those gates (PG-85; tested with an unreadable cgroup
    injected into a no-flags run, a `--rust`-only run and a `--bindings`-only run, each of which
    must run green — PG-118).
  * **P2 lanes, concurrent:** `contract` (`pnpm gates:contract:check`, then
    `env -u KIT_ROOT pnpm findings:kit:check` — the push skill requires the kit-parity check on
    every push and it is not a contract-chain member); `rust-lint`
    (`cargo fmt … -- --check`, `cargo clippy … --all-targets --locked -- -D warnings`,
    `pnpm rust:windows:check`); `rust-test` (`pnpm gate:ensure backend-test`); `rust-coverage`
    (`pnpm gate:ensure backend-coverage`, own target dir `llvm-cov-target`); `frontend-coverage`
    (`pnpm gate:ensure frontend-coverage`); `bundle` (`pnpm bundle:check`, with `--frontend`).
  * **`e2e`** (`pnpm gate:ensure e2e-container`): `after` every cargo lane present in the run
    (constraint 1) and after `bundle` (which reads the `dist/` that e2e's own build rewrites); runs concurrently with whatever else is still running. Its container is
    outside the agent's memory scope (docker daemon cgroup; measured 0.08 GB in scope).
  * **`frontend-mutation`** (`pnpm gate:ensure frontend-mutation`): `after` every other P2 lane
    when `gateBudgetBytes()` < `ONE_WAVE_BYTES` **or** `availableParallelism()` < 2 (then it gets the whole budget), otherwise it
    starts with P2. `ONE_WAVE_BYTES` is a named constant whose comment records the measured sum it
    rests on (P2 lanes' concurrent peak — 6.06 GB measured for four gates — plus 8 Stryker
    runners); the implementation re-measures it.
  * `after` is **ordering only** (a resource constraint: `dist/` writes, memory), never a
    success dependency: `e2e` and `frontend-mutation` start once their predecessors have
    *finished*, green or red, so a failed cargo lane cannot hide an e2e or mutation failure.
    Only a failing P0 guard stops the whole run; P1 failures skip their consumers only (above). (Was:
    a P0/P1 failure stopped the run — everything after depends on the guard, `dist/` or the
    binding). Every lane runs to completion, so every independent failure surfaces in one round.
* **Memory:** the runner computes the budget once (S1) and hands `GATE_MEMORY_BYTES` to the two
  self-sizing lanes: `frontend-coverage` gets `P2_VITEST_SHARE` of it while cargo lanes run;
  `frontend-mutation` gets all of it when it runs after P2, `P2_MUTATION_SHARE` when it runs
  with P2. The same lanes get `GATE_CPU_SHARE` (S1): `frontend-coverage` and a
  P2-concurrent `frontend-mutation` split the cores between them; a mutation lane that runs after
  P2 gets 1. The shares are named constants set from the implementation's measurement, each with
  its reason; acceptance requires 0 OOM kills.
* **Within a lane, commands run strictly in order and the lane stops at its first failing
  command** (that command's exit code is the lane's); a lane killed by a signal is a failure.
  Output per lane to `artifacts/gates/<timestamp>/<lane>.log`; one stdout line per lane
  start/finish with duration and exit code, then a summary table and each failed lane's log tail.
  A command that cannot be spawned (`error` from the supervisor, no exit code) is a failure
  with exit code 127 and the spawn error printed (PG-55) — in P0 and P1 exactly as in lanes, and a
  P0/P1 spawn failure then follows that step's failure rule (PG-80). A command killed by a signal (`code`
  null) is a failure with exit code `128 + signal number` (SIGKILL → 137, e.g. an OOM kill), in
  P0, P1 and lanes alike (PG-65). Runner exit code: P0/P1 failure's code,
  else the first failed lane's code in table order.
  SIGINT/SIGTERM terminates every running child — P0/P1 steps as well as lanes (an interrupted
  `frontend-build` must not keep writing `dist/`) — through the multi-child API added to
  `child-supervisor.mjs` in S3, and waits for all of them. A received signal is **latched**:
  no further step or lane starts after it, even if a child exits 0 on SIGTERM or the signal
  lands between steps, and the runner exits 130 (SIGINT) / 143 (SIGTERM) — the same codes
  `run-frontend-mutation.mjs` returns today — never 0.
* **Drop `cargo check`** from the push skill's Rust block and from `.github/workflows/test.yml`
  (platform matrix step "Check all Rust targets" and the `cargo check` line of the Linux job's
  "Check and lint all Rust targets" step). `cargo clippy --all-targets` type-checks every target.
  **Measure before relying on it (rule 12b):** in a throwaway git worktree (with `mkdir -p dist`
  first, because `dist/` must exist before any cargo compile), introduce a type
  error in a `#[cfg(test)]` item of `src-tauri/src/` and show, from the worktree root,
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`
  exits non-zero naming that error (and exits 0 without it). The contract gate enforces the step today, so the same change edits
  `scripts/check-tool-version-parity.mjs` (`RUST_PLATFORM_CHECK`, finding `(5a)` at ~line 381)
  and its fixtures/cases in `scripts/check-tool-version-parity-tests.mjs` (~lines 459–480):
  the `(5a)` requirement is removed, `(5b)` clippy stays, and a test asserts a workflow without
  `cargo check` but with the exact clippy step passes. The `(5a)` rule is **inverted**, not merely
  dropped: `rust-platform` and the Linux job must not contain a `cargo check` step (clippy
  covers it), with a test that a workflow still carrying one fails — so the CI speed change has a
  regression anchor (PG-124). Two negative cases, one per location: a `cargo check` step restored
  in `rust-platform`, and a `cargo check` line restored inside the Linux job's multi-line
  "Check and lint all Rust targets" step (`test.yml:218-221`), each fail (PG-128). `d-20260914-08` (which chose both) is
  superseded, not edited (S6).
* **Push skill `.claude/skills/push/SKILL.md` §2:** the gate run is `pnpm gates:push -- <blocks>`
  for the affected blocks; the existing per-block fenced lines stay as the lane contents the
  runner executes (they are what the routing checker and CI are validated against). Replace
  "Run commands serially for readable failures" and the "receipt-backed runs run serially against
  one another" rule with: receipt-backed gates may run concurrently (evidence above, item 3);
  the tracked-file-rewriter prohibition stays verbatim; the two measured ordering constraints
  above (`dist/` is a Rust compile input; `bindings:check` is a conditional rewriter) are stated
  with their evidence so a hand-run never breaks them. Keep `pnpm gates:contract:check` fenced exactly once in the
  §2 preamble (checker invariant) and state it is also the runner's `contract` lane. Update the
  mutation paragraph's "measured 323 s on the runner" with the new measurement.
* **Routing checker `scripts/check-gate-routing.mjs`:** import the runner's schedule table and
  report any runner command that is neither an exact fenced line of the push skill nor a member
  of the `gates:contract:check` chain (the preamble fence routes those; P0's
  `pnpm mutation:guard:check` is one — PG-61), and any fenced
  line of the §2 gate subsections (the contract preamble, `### Rust/Tauri backend`,
  `### TypeScript/React frontend`, `### Cross-layer contracts`, `### Findings ledger` — not the
  `### Exact-tree gate receipts` reference block, whose fences are usage examples) that the runner
  never runs; and that §2 fences the runner invocation `pnpm gates:push` itself (a lane table
  mirrored by fences proves nothing if the skill never calls the runner — PG-67) (single source both ways, the same pattern as the existing
  `GATES` import). Tests in `check-gate-routing-tests.mjs` for both directions.
* `gates:push:test` (`scripts/run-push-gates-tests.mjs`, node:test). The tests spawn the real
  CLI (`node scripts/run-push-gates.mjs …`, the `d-20260830-13` entrypoint anchor) with the
  schedule's **production** commands, which resolve to fake `pnpm`, `cargo` and `bash`
  executables placed first on `PATH` by the test (each records its argv, timestamps and output,
  and behaves as the case needs). The runner spawns argv arrays without a shell, so `PATH` lookup
  is the only indirection — there is **no test seam in the production CLI** that a stray
  variable could use to replace real gates with fakes (PG-64). The scheduler-level cases below
  (PG-51, PG-58) use the exported scheduler with an injected spawn function instead. Cases: each block
  flag and combination selects exactly the steps of the selection table (asserted per row, so a
  frontend lane on a `--rust`-only run fails the test); leading `--` tolerated; P0/P1 run before any
  lane; a failing P0 guard (fake exit 7) starts no later command and the runner exits 7 (the guard's
  own code, PG-82); a run with no flags executes exactly the guard and the `contract` lane and an
  unknown flag exits 2 before anything runs (PG-81, PG-83); a P1 `frontend-build` whose
  executable cannot be spawned yields 127 with the spawn error and the P1 consumer skips (PG-80); per P1
  step failure, the runner exits with that step's code while independent lanes still run and
  only its consumers are skipped — failed `frontend-build` (skips `bindings`, cargo lanes and
  `bundle`; `contract`, `frontend-coverage`, `frontend-mutation` and `e2e` still run — PG-63), failed `bindings:check` (skips
  nothing), failed `setup-rust` (skips `bindings` and the three cargo lanes; `contract` and the
  frontend lanes run) (PG-75, PG-76); SIGTERM during the P0 `setup-rust` step and during a P1 step each leave no fake process alive,
start no later step, and exit 143 (a fake child that exits 0 on SIGTERM included); the
exported production schedule's P1 frontend step is exactly `pnpm gate:run frontend-build`
(pins PG-17 against a revert to `ensure`); in-lane order is strict (fake commands record start/end
  timestamps; a later command never starts before the earlier ends) and an early failure
  followed by a would-be success leaves the lane red with the early exit code; `e2e` never
  overlaps a cargo lane (timestamps); every lane runs to completion after
  another lane fails; `frontend-mutation` starts after P2 below `ONE_WAVE_BYTES` and with
  P2 at or above it (budget injected through `GATE_MEMORY_BYTES`, which the schedule reads via
  `gateBudgetBytes()`); exit-code precedence; SIGTERM
  to the runner leaves no fake lane process group alive; log files at the stated paths; each
  self-sizing lane receives the stated `GATE_MEMORY_BYTES` **and** `GATE_CPU_SHARE` (both
  mutation placements); SIGINT during a running lane exits 130; a signal delivered between two
  steps (fake step that signals the runner and exits 0) starts no later step and exits 130/143;
  a failed cargo lane still lets `e2e` and `frontend-mutation` start (ordering, not success).
  At 1 CPU with a budget above `ONE_WAVE_BYTES`, mutation still runs after P2 (never two
  self-sizing lanes on one CPU; PG-50). **Between-steps cancellation (PG-51)** is tested
  deterministically at the scheduler level: the runner module exports its scheduler with an
  injectable spawn function and a `beforeStep` hook; the test delivers the signal from that hook
  after step 1 has exited and asserts step 2 is never spawned and the result is 130/143 (the CLI
  tests keep covering signals during a running child).
  **Concurrency anchor (PG-47, PG-59):** every eligible P2 fake lane of an all-blocks run
  rendezvous through a barrier (each creates its own marker file, then waits — bounded, e.g.
  10 s — for all the others'); the run is green only if all P2 lanes were alive at once, so a
  serial scheduler or one capped below the P2 lane count fails. **CPU seam (PG-58):** the exported
  scheduler takes `availableParallelism` as an injected input (default `os.availableParallelism`);
  the 1-CPU case (mutation after P2 despite a budget above `ONE_WAVE_BYTES`) and the 1/2-CPU
  aggregate cases run through that seam. A `--bindings`-only run and a `--rust`-only run
  each run `gate:run frontend-build` in P1 before `bindings:check` / any cargo lane, also when a
  `dist/` already exists (PG-60, PG-66, PG-88). A P0 guard whose executable cannot be spawned
  exits 127 with the spawn error and starts nothing else (PG-89); a `setup-rust` whose
  executable cannot be spawned yields 127 with the spawn error, skips `bindings` and the cargo
  lanes, and still runs `contract` and the frontend lanes (PG-91). A missing executable (fake command name that does not
  exist) fails the lane with 127 and the runner non-zero (PG-55); a fake step that kills itself
  with SIGKILL in P0 (`setup-rust`), in P1 and in a lane yields 137 (PG-65, PG-77); a failing fake `bundle` lane leaves every other P2
  lane running to completion, and `e2e` and an after-P2 `frontend-mutation` still start after it
  (PG-70, PG-74); `e2e` starts only after `bundle` has finished, asserted
  with timestamps like the cargo ordering (PG-69); SIGINT during running lanes leaves no child
  process group alive, exactly like SIGTERM (PG-68); each fake command prints a distinct line,
  and the test asserts it appears in that lane's log file, that the summary names every lane
  with its status, that a failed lane's log tail is printed, and that a spawn failure prints the
  spawn error (PG-72). Routed through `gates:contract:check`.
* Check `.agents/skills/push/SKILL.md` and `.grok/rules/grok-chessfable.md` restate nothing of §2
  that changed; update only if they do.

Proof: `pnpm gates:contract:check` (includes routing + new tests) green; one full
`pnpm gates:push -- --rust --frontend --bindings` on a clean tree green with every receipt
recorded and 0 OOM kills, timed per lane; `actionlint`/`workflows:check` green.

### S6 — Records and timings

* `tasks/decisions.md` via `./scripts/findings.py` (record-decision): (a) keep both Rust test
  runs, concurrent — reason item 4; (b) drop `cargo check` — clippy superset, probe result;
  recorded with `Supersedes`-style reference to `d-20260914-08`, whose `Superseded-by:` trailer
  is then set through `findings.py`'s `set-trailer` operation (never a hand edit);
  (c) worker counts derive from the cgroup budget, constants and their measurements;
  (d) the S5 schedule (P0/P1 serial producers, P2 lanes, `e2e` after cargo, mutation after P2
  below `ONE_WAVE_BYTES`) and the two measured constraints behind it.
* `CLAUDE.md` (Gates + Repository state): mutation timing and the no-longer-true "stops the
  runner before its other two packages"; the lane runner as the way §2 runs; remove nothing else.
* `docs/coverage.md` untouched (no ratchet or baseline change anywhere in this plan).
* Handoff `tasks/handoffs/2026-09-29-push-gate-parallelism.md`: the baseline table above, the
  after table (same steps, same machine, warm caches, plus per-lane and total `gates:push` wall
  time for the all-blocks run), OOM-kill counts, and the plan-review history.

## Acceptance

1. Every section's proof above passes; `pnpm gates:contract:check` green.
2. `pnpm gates:push -- --rust --frontend --bindings` green on a clean tree, every receipt
   recorded, 0 OOM kills; wall time within the audit's estimate (≤ 8 min) in the 8G scope,
   target ≈ 4.5 min, measured against the recorded baseline.
3. No coverage floor, baseline, bundle budget or snapshot changed; no test or assertion removed
   (release-surface test count 286 before and after).
4. Every remaining numeric cap (`AGENT_RESERVE_BYTES`, per-worker bytes, `ONE_WAVE_BYTES`, the P2 shares,
   e2e `workers`, `fullyParallel: false`) has an adjacent reason comment.
5. Pushed through `$push`; CI `Test` workflow green on the pushed SHA.

## Reviews

### Round 1 — 2026-09-29, Codex leaves, snapshot `plan-r1.md`

Raw verdicts: `review-plan` REVISE · `review-correctness` REVISE · `review-minimalism` REVISE ·
`review-tests` REVISE · `review-error-handling` APPROVED (with three should-fix). Reports kept
verbatim in the run directory (`lens-*-r1.txt`).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-01 | `bindings` lane needs `dist/` and must not run beside receipt gates (stale-binding rewrite) | correctness #1, #2; plan #3 | Fix | S5 P1 serial producers; constraint 2 |
| PG-02 | `dist/` is a Rust compile input, so no `dist/` writer may overlap cargo (arbiter probe, extends PG-01) | arbiter probe 2026-09-29 (`build-vite` → `cargo check` re-checks `chessfable`) | Fix | S5 constraint 1; `e2e` after cargo lanes; `frontend-build` in P1 |
| PG-03 | `availableParallelism() - 1` cap violates "all cores"; `[1,0]` clamp at 1 CPU | correctness #3; minimalism #1; plan #4 | Fix | S1 upper bound `availableParallelism()`; test at 1 CPU |
| PG-04 | review packet lacks revision/history/open IDs | plan #1 | Skip | Round 1 has no prior history; the round-1 snapshot is the revision. Round 2 carries the full packet. |
| PG-05 | dropping CI `cargo check` reddens `check-tool-version-parity` `(5a)` and its tests | plan #2 | Fix | S5 edits checker + tests |
| PG-06 | `d-20260914-08` stays active beside the new decision | plan #5 | Fix | S6 `set-trailer` supersession |
| PG-07 | unreadable cgroup → 91 GB fallback recreates OOM | error-handling #1 | Fix | S1: error on Linux, override via env |
| PG-08 | single-supervisor signal forwarding leaves siblings running | error-handling #2 | Fix | S3 multi-child API in `child-supervisor.mjs`, tested |
| PG-09 | multi-command lane failure aggregation unspecified | error-handling #3 | Fix | S5 strict order, stop at first failure, tested |
| PG-10 | no test ties Stryker `concurrency` to `GATE_MEMORY_BYTES` | tests #1 | Fix | S3 config test |
| PG-11 | invalid `GATE_MEMORY_BYTES` untested | tests #2 | Fix | S1 tests |
| PG-12 | cgroup v1 / limit > totalmem untested | tests #3 | Fix | S1 tests |
| PG-13 | equal test count does not prove assertions preserved | tests #4 | Fix | S2 pure-move multiset proof (one-off) |
| PG-14 | `ONE_WAVE_BYTES` branch untested | tests #5 | Fix | S5 tests |
| PG-15 | in-lane sequential order untested | tests #6 | Fix | S5 timestamp tests |
| PG-16 | tests may bypass the CLI entrypoint | tests #7 | Fix | S5 tests spawn the real CLI |

Adoption gate: every Fix above is correctness or verification of an obligation already in
MANDATE (parallel gates, removed caps with reasons, drop `cargo check`, push through the push
skill); none expands scope.

### Round 2 — 2026-09-29, Codex leaves, snapshot `plan-r2.md`

Raw verdicts: `review-plan` REVISE · `review-correctness` APPROVED (1 should-fix) ·
`review-minimalism` APPROVED · `review-tests` REVISE · `review-error-handling` REVISE.
Closure checks reported: PG-01, 02, 03, 05, 06, 08, 09, 10, 11, 12, 13, 15, 16 closed (review-plan
plus the witnessing lenses); PG-07 partial (see PG-19); PG-14 open (see PG-19).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-17 | valid `frontend-build` receipt with deleted/foreign `dist/` → `bundle:check` and cargo read a wrong or absent `dist/` | correctness r2 #1; plan r2 #4 | Fix | S5 P1 uses `gate:run frontend-build` (ignored output cannot be vouched by the receipt) |
| PG-18 | budget below one viable worker is clamped to 1 and runs over budget | error-handling r2 #1 | Fix | S1 error below `baseBytes + perWorkerBytes`, tested |
| PG-19 | schedule branches on `memoryLimitBytes()`, bypassing the override (closes PG-07 partial, PG-14 open) | error-handling r2 #2; tests r2 #1 | Fix | S1 exports `gateBudgetBytes()`; S5 branches on it; test with override + unreadable cgroup |
| PG-20 | red P0 guard must abort everything, untested | error-handling r2 #3; tests r2 #2 | Fix | S5 P0 abort + CLI test |
| PG-21 | P0/P1 children not covered by signal cleanup | error-handling r2 #4 | Fix | S5 all children; P1 interruption test |
| PG-22 | multi-child terminate stops at a rejecting child | error-handling r2 #5 | Fix | S3 allSettled fan-out + test |
| PG-23 | clippy probe lacks `--manifest-path` | plan r2 #1 | Fix | S5 probe command spelled out |
| PG-24 | `CONTRACT_CHAIN` literal in routing tests not updated | plan r2 #2 | Fix | S1/S5 update the literal |
| PG-25 | undeclared `budgetBytes` in Stryker config | plan r2 #3 | Fix | S3 wording |
| PG-26 | handoff path not in FILES | plan r2 #5 | Fix | added to FILES of the round-3 packet |
| PG-27 | P1 step order untested | tests r2 #3 | Fix | S5 timestamp test |
| PG-28 | vite `maxWorkers` wiring untested | tests r2 #4 | Fix | S2 config test |
| PG-29 | Playwright `workers` literal untested | tests r2 #5 | Skip | A test asserting `workers === 4` restates the literal and proves nothing the reason comment and the recorded timing do not; unlike PG-10/PG-28 there is no computation to wire. |

Adoption gate: every Fix is correctness or verification of an existing MANDATE obligation.

### Round 3 — 2026-09-29, Codex leaves, snapshot `plan-r3.md`

Raw verdicts: `review-plan` REVISE · `review-correctness` REVISE · `review-tests` REVISE ·
`review-error-handling` REVISE. Closed per the lenses' closure lines: PG-01–03, 05–28 except
PG-17 (tests: open → PG-33), PG-21 (tests: partial → PG-34), PG-23 (correctness: partial →
PG-32). PG-29 Skip upheld by review-plan and correctness, disputed by tests (below).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-30 | a signal must latch: no later step, exit 130/143, never 0 | error-handling r3 #1 | Fix | S5 latch + tests (child exiting 0 on SIGTERM) |
| PG-31 | three Stryker children each cap at all cores → 72 workers on 24 | correctness r3 #1; plan r3 #1 | Fix | S1 `GATE_CPU_SHARE`; S3 passes 1/3; S5 lane shares; aggregate test |
| PG-32 | clippy probe worktree lacks `dist/` | correctness r3 #2 | Fix | S5 probe `mkdir -p dist` |
| PG-33 | no test pins `gate:run frontend-build` | tests r3 #1 | Fix | S5 production-table assertion |
| PG-34 | P0 `setup-rust` signal cleanup untested | tests r3 #2 | Fix | S5 test |
| PG-35 | exact `workerCount` result with non-zero `baseBytes` untested | tests r3 #4 | Fix | S1 exact fixtures |
| PG-36 | `fullyParallel: false` kept on an unproven order-dependency claim | plan r3 #2 | Fix | S4 measures `fullyParallel: true`; keep false only with a measured failure as reason |
| PG-37 | CLAUDE.md has no "stops the runner before its other two packages" statement | plan r3 #3 (nit) | Skip | It exists: `CLAUDE.md:263`–264 (line-wrapped, "which stops the runner before its other / two packages"); the lens read lines 81–86 only. |
| PG-29 | (tests r3 #3 re-disputes the Skip) | tests r3 #3 | Skip upheld | `workers` is a measured performance literal, not derived wiring; a test would restate the literal. A revert costs ~26 s and is visible in the handoff timings. review-plan and correctness both upheld the Skip. |

### Round 4 — 2026-09-29, Codex leaves, snapshot `plan-r4.md`

Raw verdicts: `review-plan` REVISE · `review-correctness` REVISE · `review-tests` REVISE ·
`review-error-handling` APPROVED (2 should-fix). Closed: PG-17, 21, 23, 32, 33, 34, 35, 36
(all witnessing lenses). Not closed: PG-30 (between-steps case, SIGINT → PG-41), PG-31 (low CPU
counts, lane shares → PG-40, PG-42). PG-29, PG-37 Skips upheld by review-plan.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-38 | `after` conflated ordering with success; a failed cargo lane would hide e2e/mutation failures | error-handling r4 #1 | Fix | S5 `after` is ordering-only; test |
| PG-39 | fence removed although a child survived a failed termination | error-handling r4 #2 | Fix | S3 fence retained until all children gone; test |
| PG-40 | lane `GATE_CPU_SHARE` wiring untested | tests r4 #1 | Fix | S5 test asserts both env values per placement |
| PG-41 | SIGINT → 130 and between-steps cancellation untested | tests r4 #2; plan r4 #2 | Fix | S5 tests |
| PG-42 | 1–2 CPUs: three children with a floor of one worker oversubscribe | correctness r4 #1; plan r4 #1 | Fix | S1 slot rule; S3 queues packages; 1/2-CPU aggregate tests |
| PG-43 | MANDATE says run the Rust tests once | correctness r4 #2 | Skip | The audit row lists suggested wins; Felix's instruction is to implement the parallelization and remove unjustified caps. Dropping the stable run removes the only Linux stable-toolchain test execution anywhere: CI's Linux job runs only `pnpm test:coverage:backend` on `nightly-2025-06-01` (`.github/workflows/test.yml:223-227`), stable tests run only on macOS/Windows. Concurrent, the second run costs no wall time. Kept with this reason recorded as a decision (S6 a). |
| PG-44 | a hard 6-min acceptance is stricter than the audit's 6–8 min estimate | correctness r4 #3 | Fix | Acceptance ≤ 8 min, target ≈ 4.5 min |
| PG-45 | extra rust-only/frontend-only timing runs exceed MANDATE | correctness r4 #4 | Fix | handoff records the all-blocks run only |
| PG-46 | node:test cannot import `vite.config.ts` on Node 20 | plan r4 #3 | Fix | S2 wiring test runs under Vitest |

### Round 5 — 2026-09-29, Codex leaves, snapshot `plan-r5.md`

Raw verdicts: `review-plan` REVISE · `review-correctness` REVISE · `review-tests` REVISE ·
`review-error-handling` APPROVED (2 should-fix). Closed: PG-38, 39, 40, 44, 45, 46; PG-30/41 closed
by tests, error-handling and correctness, open for review-plan (→ PG-51); PG-31/42 closed for S3,
open for S5 one-CPU lanes (→ PG-50). PG-29, 37, 43 Skips upheld by all lenses that commented.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-47 | no test proves P2 lanes overlap | tests r5 #1 | Fix | S5 barrier test |
| PG-48 | a backend mutation can start after the one-shot P0 guard and overlap cargo lanes | plan r5 #1 | Defer (filed) | Pre-existing: today's serial chain checks the same guard once, at the start of `gates:contract:check`, and later gates run without it; the plan neither opens nor widens the window. A lock spanning a gate run is a new design outside MANDATE; filed as `f-20260929-12`. |
| PG-49 | `findings:kit:check` is fenced in §2 but runs in no lane | plan r5 #2 | Fix | S5 `contract` lane runs it; reverse routing scoped to the gate subsections |
| PG-50 | 1 CPU: coverage + mutation lanes each claim a worker | plan r5 #3; correctness r5 #1 | Fix | S5 one-wave requires ≥ 2 CPUs; test |
| PG-51 | between-steps signal test not deterministic | plan r5 #4 | Fix | scheduler-level test with injected `beforeStep` hook |
| PG-52 | queued packages may start after a signal | error-handling r5 #1 | Fix | S3 admission latch; test |
| PG-53 | children survive a non-signal error exit | error-handling r5 #2 | Fix | S3 cleanup on every error exit; test |
| PG-54 | S0 (fix `f-20260929-07`) is outside MANDATE; a flaky gate can be rerun | correctness r5 #2 | Skip | Rerunning a red gate until it passes is the failure the push policy forbids; the mandate requires green gates and a push. S0 is done: `8b97e423`, measured 0/300 serial, 0/600 concurrent. |

### Round 6 — 2026-09-29, Codex leaves, snapshot `plan-r6.md`

Raw verdicts: `review-plan` (pending at recording) · `review-correctness` REVISE · `review-tests`
REVISE · `review-error-handling` APPROVED (1 should-fix). Closed: PG-30, 41, 31, 42 (S3), 47
(serial case), 49, 51, 52, 53; PG-54 Skip upheld. PG-50 open for tests (→ PG-58).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-55 | a spawn error has no exit code and may read as success | error-handling r6 #1 | Fix | S5 spawn error = 127 failure; test |
| PG-56 | a red `bundle:check` in P1 stops independent P2 lanes | correctness r6 #1 | Fix | `bundle` is a P2 lane; `e2e` after it |
| PG-57 | queued Stryker packages still get a third of the budget | correctness r6 #2 | Fix | S3 divides by admitted slots |
| PG-58 | no CPU-count seam for the 1-CPU lane test | tests r6 #1 | Fix | scheduler takes injected `availableParallelism` |
| PG-59 | barrier with two lanes misses a two-lane cap | tests r6 #2 | Fix | all P2 lanes rendezvous |
| PG-60 | `--bindings` alone reaches cargo without `dist/` | plan r6 #1 | Fix (test only) | Already specified: P1 creates `dist/` when `--frontend` is absent ("without it, create `dist/` only if absent"); added the bindings-only test. |
| PG-61 | P0 guard command is not a fenced line, so the forward routing check rejects it | plan r6 #2 | Fix | runner calls `pnpm mutation:guard:check`; forward check accepts contract-chain members |

review-plan r6 verdict: REVISE (PG-60, PG-61); closure lines: PG-30/41, 31/42, 47, 49, 50, 51, 52, 53 closed.

### Round 7 — 2026-09-29, Codex leaves, snapshot `plan-r7.md`

Raw verdicts: `review-plan` REVISE · `review-correctness` REVISE · `review-error-handling` REVISE ·
`review-tests` (pending at recording). Closed: PG-50, 55, 56, 58, 59, 60 (bindings), 61; PG-57
closed for its claim, residual → PG-62.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-62 | CPU-only slot count starves packages below one runner's bytes | correctness r7 #1; plan r7 #1 | Fix | S3 slots bounded by memory too; cases |
| PG-63 | a failed `frontend-build` skips independent lanes | correctness r7 #2 | Fix | S5 P1 failure skips consumers only; test |
| PG-64 | test schedule injection accepted in real runs | error-handling r7 #1 | Fix | refused outside `node --test`; refusal test |
| PG-65 | signal-killed child (`code` null) has no exit mapping | error-handling r7 #2 | Fix | 128+signo, tested in P1 and lane |
| PG-66 | `--rust`-only missing-`dist/` path untested | plan r7 #2 | Fix | test |
| PG-67 | routing check does not pin the skill's `pnpm gates:push` invocation | plan r7 #3 | Fix | checker asserts the fence |
review-tests r7 verdict REVISE; closure lines: PG-50, 55 (exit), 58, 59, 60, 61 closed; PG-56 open
(→ PG-70), PG-57 partial (→ PG-62).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-62 | (also) 3 CPUs with 1.5 GiB untested | tests r7 #1 | Fix | case added to S3 |
| PG-68 | SIGINT cleanup of children not asserted | tests r7 #2 | Fix | S5 test |
| PG-69 | `e2e`-after-`bundle` ordering not asserted | tests r7 #3 | Fix | S5 timestamp test |
| PG-70 | no test where `bundle` itself fails | tests r7 #4 | Fix | S5 test |
| PG-71 | set-but-empty env values untested | tests r7 #5 | Fix | S1 tests |
| PG-72 | log/summary/diagnostic contents unasserted | tests r7 #6 | Fix | S5 test |

### Round 8 — 2026-09-30, Codex leaves, snapshot `plan-r8.md`

Raw verdicts: `review-error-handling` REVISE · `review-tests` REVISE · `review-plan`,
`review-correctness` (pending at recording). Closed by both: PG-56, 57, 62, 65–72 (PG-63 closed
for frontend-build by tests, open for the generic case; PG-64 closed by tests, open for
error-handling).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-64 | (re-opened) `NODE_TEST_CONTEXT` presence can be inherited or set; injection still reachable | error-handling r8 #1 | Fix | CLI test seam removed; CLI tests shim `pnpm`/`cargo`/`bash` on `PATH`; argv spawn without shell |
| PG-73 | stale "a red P1 stops the run" contradicts consumer-only skipping; per-step P1 failures and exit code untested | error-handling r8 #2; tests r8 #1 | Fix | per-P1-step failure cases with exit codes |
| PG-74 | bundle failure must not stop delayed `e2e`/`frontend-mutation` | tests r8 #2 | Fix | case added |
| PG-75 | `e2e` builds its own `dist/`, so a failed P1 build must not skip it | correctness r8 #1 | Fix | `e2e` never skipped by P1; test |
| PG-76 | a failed `setup-rust` stops unrelated frontend/contract gates | correctness r8 #2 | Fix | skips Rust consumers only; test |

review-plan r8 verdict REVISE (reviewed the frozen `plan-r8.md`; it noted the live plan already
carried the PG-64/PG-73/PG-75 corrections). Closure lines: PG-56, 57, 62, 66–72 closed; PG-63, 64,
65 open against the frozen text (addressed by PG-73/75, PG-64 PATH shim, PG-77).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-77 | P0 SIGKILL mapping untested | plan r8 #4 | Fix | P0 SIGKILL case |
| PG-78 | flag → lane selection undefined; "exactly its steps" untestable | plan r8 #6 | Fix | selection table + per-row test |
| PG-79 | `scripts/vite-worker-budget.test.mjs` missing from FILES; live plan diverged from the frozen r8 candidate | plan r8 #7, #8 | Fix | round-9 packet: FILES updated, delta computed from `plan-r8.md` to the live plan |

### Round 9 — 2026-09-30, Codex leaves, snapshot `plan-r9.md`

Raw verdicts: `review-correctness` APPROVED (1 should-fix) · `review-error-handling` APPROVED
(1 should-fix) · `review-plan` REVISE · `review-tests` REVISE. Closed by every witnessing lens:
PG-63, 64, 65, 73 (exit codes), 74, 75, 76, 77, 78, 79.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-80 | P0/P1 spawn failures have no defined status | error-handling r9 #1 | Fix | 127 everywhere; P1 spawn-failure test |
| PG-81 | no-flags branch untested | tests r9 #1 | Fix | test |
| PG-82 | guard exit code propagation not proven (1 → 1) | tests r9 #2 | Fix | fake 7 → 7 |
| PG-83 | no-flags usage error leaves docs-only pushes without a runner invocation for the contract gate | plan r9 #1 | Fix | no flags = contract-only run |
| PG-84 | Stryker parent process memory not reserved per package | correctness r9 #1 | Fix | `STRYKER_PARENT_BYTES` as `baseBytes` and in the slot minimum |

### Round 10 — 2026-09-30, Codex leaves, snapshot `plan-r10.md`

Raw verdicts: `review-error-handling` APPROVED (1 should-fix) · `review-correctness` REVISE ·
`review-tests` REVISE · `review-plan` REVISE. Closed: PG-73, 78, 81, 82, 83 (all witnesses);
PG-80 closed by correctness/error-handling, open for tests/plan (→ PG-89); PG-84 open (→ PG-86,
PG-87).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-85 | contract-only run can abort on cgroup detection it never needed | error-handling r10 #1 | Fix | budget computed only with `--frontend`; test |
| PG-86 | a per-package `GATE_MEMORY_BYTES` below vitest's minimum makes `vite.config.ts` throw inside every Stryker runner | plan r10 #1 | Fix | children get `STRYKER_MEMORY_BYTES`; `GATE_MEMORY_BYTES` removed from their env; no-throw test |
| PG-87 | slot/config examples contradict the parent-inclusive formula; no discriminating test | plan r10 #2; correctness r10 #1; tests r10 #1 | Fix | expected values computed from measured constants; discriminating case |
| PG-88 | Rust-only runs compile against a possibly foreign `dist/` | plan r10 #3 | Fix | P1 `gate:run frontend-build` for every `dist/` consumer |
| PG-89 | P0 spawn failure untested | plan r10 #4; tests r10 #2 | Fix | test |
| PG-90 | "all to completion" changes mutation failure semantics without mandate | plan r10 #5 | Fix | keep first-failure-ends-the-run; siblings terminated |

### Round 11 — 2026-09-30, Codex leaves, snapshot `plan-r11.md`

Raw verdicts: `review-plan` **APPROVED** · `review-error-handling` **APPROVED** (1 should-fix) ·
`review-tests` REVISE · `review-correctness` REVISE. Closed: PG-84, 85, 86, 87, 88, 89, 90 (every
witness); PG-80 closed by review-plan, error-handling, correctness (plan level), open for tests (→
PG-91). The correctness REVISE contains no finding — the leaf looked for an implementation diff
and reported only "code closure unverified" for each ID with "plan correction present"; closed by
the arbiter as containing no plan defect (its raw verdict stays REVISE).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-91 | `setup-rust` spawn-error path untested | tests r11 #1 | Fix | test |
| PG-92 | signal-killed Stryker child surfaces as generic exit 1 | error-handling r11 #1 | Fix | 128+signo with the signal named; test |

### Round 12 — 2026-09-30, Codex leaves, snapshot `plan-r12.md`

Raw verdicts: `review-tests` **APPROVED** · `review-error-handling` **APPROVED** · `review-plan`
REVISE. Closed: PG-80, PG-91 (all witnesses), PG-92 (mapping; residual → PG-94).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-93 | S1 treated every unreadable `memory.max` as an error, but the host root has none (ENOENT) — every normal host would throw | arbiter probe 2026-09-30 (`ls /sys/fs/cgroup/memory.max` → ENOENT; per-level values; docker namespace root → `max`) | Fix | ENOENT = unlimited level; other read errors stay errors; tests |
| PG-94 | SIGKILL case does not prove first-failure fan-out/admission | plan r12 #1 | Fix | assertions added |

### Round 13 — 2026-09-30, Codex leaves, snapshot `plan-r13.md`

Raw verdicts: `review-correctness` **APPROVED** · `review-error-handling` **APPROVED** (1
should-fix) · `review-plan` REVISE · `review-tests` REVISE. Closed: PG-92, PG-93 (all witnesses),
PG-94 (plan, error-handling, correctness; tests → PG-96).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-95 | blanket ENOENT also treats an invisible hierarchy as unlimited | plan r13 #1 | Fix | ENOENT unlimited only while the level directory exists; own dir missing = error; all-ENOENT test |
| PG-96 | SIGKILL case may have nothing queued | tests r13 #1 | Fix | 2 CPUs injected, third package queued, kill after both running |
| PG-97 | Stryker child's `vite.config.ts` still reads the cgroup and can fail | error-handling r13 #1 (re-opens PG-86 for that case) | Fix | helper returns 1 under `STRYKER_MEMORY_BYTES`; test with unreadable cgroup |

### Round 14 — 2026-09-30, Codex leaves, snapshot `plan-r14.md`

Raw verdicts: `review-error-handling` **APPROVED** (1 should-fix) · `review-plan` REVISE ·
`review-tests` REVISE. Closed: PG-94, 96 (all witnesses); PG-95 (plan, error-handling; tests →
PG-99); PG-86/97 closed by plan and tests, open for error-handling (→ PG-98). PG-13 re-opened by
review-plan (→ PG-100).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-98 | `vite.config.ts` calls generic `workerCount`, so the PG-97 bypass is not wired | error-handling r14 #1 | Fix | `vitestMaxWorkers()` export |
| PG-99 | own cgroup dir missing with a finite ancestor untested | tests r14 #1 | Fix | test |
| PG-100 | pure-move proof misses `test.each` data tables (re-opens PG-13) | plan r14 #1 | Fix | compare every non-import statement at every level |
| PG-101 | mixed dead/live children recovery untested | plan r14 #2 | Fix | test |
| PG-102 | foreign-owner test is nondeterministic (open `f-20260917-11`, same file S3 rewrites) | plan r14 #3 | Fix | synchronise on the recorded owner; close `f-20260917-11` (rule 4b: same area, loaded context) |

### Round 15 — 2026-09-30, Codex leaves, snapshot `plan-r15.md`

Raw verdicts: `review-error-handling` **APPROVED** · `review-tests` **APPROVED** (1 should-fix) ·
`review-plan` REVISE. Closed by every witness: PG-13, 86, 95, 97, 98, 99, 100, 101, 102.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-103 | S3 log/progress/tail behaviour unasserted | tests r15 #1 | Fix | fake-child output test |
| PG-104 | `lint:ci`'s `i18next-cli extract --ci` can write tracked translations beside receipt gates | plan r15 #1 | Fix | measured read-only on a green tree (exit 0, metadata unchanged); stale case is a red run with no false green; skill rule restated as unconditional vs measured-conditional rewriters |
| PG-105 | legacy `{runner, child}` fences read as malformed would print `rm -rf` over a live child | plan r15 #2 | Fix | legacy records read as `children: [child]`; live legacy fence test |

### Round 16 — 2026-09-30, Codex leaves, snapshot `plan-r16.md`

Raw verdicts: `review-tests` **APPROVED** · `review-plan` REVISE. Closed: PG-103, PG-104 (both);
PG-105 closed by tests, open for review-plan (→ PG-106).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-106 | `child: null` read as "no child" prints `rm -rf` in the spawn-to-record window (pre-existing, in the code S3 rewrites) | plan r16 #1 | Fix | `spawning` marker; null/pending = unknown, never a recovery command; tests |

### Round 17 — 2026-09-30, Codex leaves, snapshot `plan-r17.md`

Raw verdicts: `review-error-handling` **APPROVED** (1 should-fix) · `review-plan` REVISE ·
`review-tests` REVISE. Closed: PG-105 (all); PG-106 closed by error-handling, open for plan and
tests (→ PG-107).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-107 | tests seed the `spawning` marker but never prove the runner writes it before spawning | plan r17 #1; tests r17 #1 | Fix | spawn-boundary test: child observes the marker; runner killed in the window; refusal withholds recovery |
| PG-108 | concurrent package spawn errors are not package-qualified | error-handling r17 #1 | Fix | package-named diagnostic, exit 127, first failure; test |

### Round 18 — 2026-09-30, Codex leaves, snapshot `plan-r18.md`

Raw verdicts: `review-error-handling` **APPROVED** (2 should-fix, 1 nit) · `review-plan` REVISE ·
`review-tests` REVISE. PG-106/107 closed by tests, open for plan and error-handling (→ PG-109);
PG-108 closed by plan, open for tests (→ PG-110) and error-handling (→ PG-111).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-109 | child-side read cannot prove the parent's write order | plan r18 #1; error-handling r18 #1 | Fix | unit-level scheduler with injected `spawn`/owner writes; call-order assertion |
| PG-110 | spawn-error exit 127 not pinned | tests r18 #1 | Fix | asserted exactly |
| PG-111 | no deterministic per-package spawn-error injection | error-handling r18 #2 | Fix | injected `spawn` emits `error` for one package; sibling/queue assertions |
| PG-112 | `waitForRecordedChild` swallows every read error into a timeout | error-handling r18 nit | Fix | retry expected pending states only, propagate others (same file S3 rewrites) |

### Round 19 — 2026-09-30, Codex leaves, snapshot `plan-r19.md`

Raw verdicts: `review-plan` REVISE · `review-tests` REVISE · `review-error-handling` REVISE.
Closed: PG-106, 108, 110, 111 (all witnesses); PG-107/109 closed by plan and error-handling, open
for tests (→ PG-116); PG-112 closed by plan, open for error-handling (→ PG-113) and tests (nit →
PG-117).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-113 | parse errors of an atomically renamed record must not be retried | error-handling r19 #1 | Fix | retry ENOENT only |
| PG-114 | `waitForRecordedChild` and its caller still read `owner.child` | plan r19 #1 | Fix | move to `owner.children` |
| PG-115 | `gateBudgetBytes()` reserve subtraction untested | tests r19 #1 | Fix | exact test |
| PG-116 | injected owner writer cannot prove the production writer persists `spawning` | tests r19 #2 | Fix | inject `spawn` only; real writer into a temp fence; read from disk |
| PG-117 | no test that the test helper propagates unexpected read errors | tests r19 nit | Skip | A test of a test helper restates that helper; its failure mode only degrades the diagnostic of a test that is already failing, and the helper is reviewed with the diff. |

### Round 20 — 2026-09-30, Codex leaves, snapshot `plan-r20.md`

Raw verdicts: `review-error-handling` **APPROVED** · `review-tests` REVISE · `review-plan` REVISE.
Closed: PG-107, 109, 112, 114, 116 (all witnesses); PG-113 closed by error-handling and tests,
open for review-plan pending measurement (now measured, above); PG-115 closed by tests and
error-handling; review-plan could not source-trace it because `gateBudgetBytes()` is new — the
assertion is the obligation, and the implementation phase's green test is its proof. PG-117 Skip
upheld by all three.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-113 | (evidence) atomic-rename premise unmeasured | plan r20 #1 | Fix (evidence) | probe result recorded in S3: 0 parse errors / 1.73 M reads |
| PG-118 | unreadable-cgroup case only for the no-flags run | tests r20 #1 | Fix | also `--rust`-only and `--bindings`-only |
| PG-119 | `STRYKER_MEMORY_BYTES` unset/invalid untested | tests r20 #2 | Fix | throw cases |

### Round 21 — 2026-09-30, Codex leaves, snapshot `plan-r21.md`

Raw verdicts: `review-tests` **APPROVED** · `review-plan` REVISE. Closed: PG-113, 115, 119 (both);
PG-118 closed by tests, open for review-plan (→ PG-120).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-120 | `vite build` (P1 on Rust-only/bindings-only runs) evaluates `vite.config.ts`, whose `vitestMaxWorkers()` would still read the cgroup | plan r21 #1 | Fix | helper returns `undefined` unless `VITEST=true` (measured: set for Vitest config evaluation, unset for `vite build`); test |

### Round 22 — 2026-09-30, Codex leaves, snapshot `plan-r22.md`

Raw verdicts: `review-tests` REVISE · `review-plan` REVISE. Both: PG-118/PG-120 open — the helper
was tested in isolation, the production config's build-mode path was not.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-121 | the production `vite.config.ts` build-mode path is unpinned | tests r22 #1; plan r22 #1 | Fix | `loadConfigFromFile` test with `VITEST` unset asserts `maxWorkers === undefined`; composed with the helper's no-read unit test |

### Round 23 — 2026-09-30, Codex leaves, snapshot `plan-r23.md`

Raw verdicts: `review-plan` **APPROVED** · `review-tests` **APPROVED**. Closed: PG-118, PG-120,
PG-121 (both). No open issue remains. Round 24 is a final coverage round for the two lenses whose
last full read predates the late revisions (`review-correctness` r13, `review-minimalism` r2).

### Round 24 — 2026-09-30, final coverage (`review-correctness`, `review-minimalism`), snapshot `plan-r24.md`

Raw verdicts: `review-minimalism` **APPROVED** (1 nit) · `review-correctness` REVISE. Correctness
confirmed closure of PG-95, 97, 98, 99, 101, 105–107, 109, 114, 116, 118, 120, 121.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-122 | recovery trusts a dead child leader although a same-group grandchild may still use `.stryker-tmp` (pre-existing, in the code S3 rewrites) | correctness r24 #1 | Fix | recovery also requires every child's process group empty (`kill(-pgid,0)` → ESRCH); test with a live grandchild |
| PG-123 | the failed-`frontend-build` scenario is specified twice | minimalism r24 nit | Fix (editorial) | merged into one case; no assertion added or removed — the union of both statements is kept, so proof semantics are unchanged |

### Round 25 — 2026-09-30, Codex leaves, snapshot `plan-r25.md`

Raw verdicts: `review-correctness` **APPROVED** · `review-tests` REVISE · `review-plan` REVISE.
Closed: PG-122 (all three, tests for the live-grandchild case), PG-123 (all three). PG-100
re-opened by review-plan (→ PG-127). (A first round-26 launch went out on an unchanged plan after
a failed edit; both leaves were killed before reporting and their artefacts deleted; round 26
below is the real one.)

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-124 | nothing forbids `cargo check` returning to CI once the checker stops requiring it | tests r25 #1 | Fix | `(5a)` inverted; failing-workflow test |
| PG-29 | (tests r25 #2 re-disputes the e2e config-literal Skip) | tests r25 #2 | Skip upheld | Same class as the upheld PG-29 (a test would restate `workers`/`fullyParallel` literals chosen by measurement); no new evidence. review-plan and correctness upheld it in rounds 3–8. |
| PG-125 | EPERM / unexpected group-probe errors untested | tests r25 #3 | Fix | injected probe failure tests |
| PG-126 | importing `run-frontend-mutation.mjs` runs `main()` | plan r25 #1 | Fix | `isEntrypoint` guard |
| PG-127 | all-statements comparison cannot match once moved helpers gain `export` (re-opens PG-100) | plan r25 #2 | Fix | export-aware normalisation |

### Round 26 — 2026-09-30, Codex leaves, snapshot `plan-r26.md`

Raw verdicts: `review-plan` REVISE · `review-tests` REVISE. Closed: PG-125, 127 (both); PG-124
and PG-126 closed by review-plan (tests → PG-128, PG-129); PG-100 closed by tests, open for
review-plan (→ PG-130).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-128 | `cargo check` prohibition needs a negative test per location | tests r26 #1 | Fix | two negative cases |
| PG-129 | nothing asserts that importing the runner starts no CLI | tests r26 #2 | Fix | import side-effect test |
| PG-130 | splitting `describe` suites across files cannot satisfy an identical-statements proof (re-opens PG-100) | plan r26 #1 | Fix | flatten `describe` wrappers; compare (title path, statement) pairs |

### Round 27 — 2026-09-30, Codex leaves, snapshot `plan-r27.md`

Raw verdicts: `review-plan` REVISE · `review-tests` REVISE. Closed: PG-124, 128 (both); PG-126,
129, 130 closed by review-plan (tests → PG-131, PG-132). PG-100 open for both (→ PG-131).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-131 | flattening drops suite modifiers such as `describe.skip` | tests r27 #1; plan r27 #1 | Fix | path segments carry callee + options; JSON count requires 286 passed, 0 skipped |
| PG-132 | import side-effect test can pass unguarded (CLI fails before spawn and cleans up) | tests r27 #2 | Fix | assert `process.exitCode` stays `undefined` and no output (unguarded top-level `await main()` always sets it) |

### Round 28 — 2026-09-30, Codex leaves, snapshot `plan-r28.md`

Raw verdicts: `review-tests` **APPROVED** · `review-plan` REVISE. Closed: PG-100, 130, 131, 132
(both); PG-126, 129 closed by tests, open for review-plan (→ PG-133).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-133 | the `--list-packages` branch still exits the process on import | plan r28 #1 | Fix | inside the entrypoint guard; import test also with `--list-packages` in argv |

### Round 29 — 2026-09-30, Codex leaves, snapshot `plan-r29.md`

Raw verdicts: `review-plan` **APPROVED** · `review-tests` REVISE. Closed: PG-126, 129 (both);
PG-133 closed by review-plan, open for tests (→ PG-134).

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-134 | a `process.exit(0)` in the `--list-packages` import case could pass as a clean import | tests r29 #1 | Fix | post-import completion marker required by the parent |
| PG-135 | production Stryker config never tested CPU-limited | tests r29 #2 | Fix | 24 CPUs, share 1/3, ample memory → 8 |

### Round 30 — 2026-09-30, Codex leaves, snapshot `plan-r30.md` — review closed

Raw verdicts: `review-plan` REVISE · `review-tests` REVISE. Closed: PG-133 (both); PG-134 closed
by tests, PG-135 closed by review-plan.

| ID | Claim | Witnesses | Disposition | Correction |
| --- | --- | --- | --- | --- |
| PG-136 | a single CPU-share point lets a hard-coded cap of 8 pass | tests r30 #1 | Fix | contrasting 2-CPU × 1/2 → 1 case; CPU injected test-side via `--import` preload |
| PG-137 | the completion marker conflicts with the "no output" assertion | plan r30 #1 | Fix | marker written to a separate file |

**Closure (2026-09-30).** Felix asked whether further rounds were sensible; the arbiter's answer,
adopted: no. The design has been stable since round 24 (last behaviour-changing corrections:
PG-120, PG-122); rounds 25–30 each added one more assertion to a test specification for code that
does not exist yet. PG-136 and PG-137 are applied above but **not closure-checked by a lens**; they
are carried into the implementation run, whose cumulative diff review runs `review-tests` and
`review-plan`-equivalent scrutiny over the real tests, and must confirm both there. Every other
issue PG-01…PG-135 is closed by its witnessing lenses or dispositioned (Skip: PG-04, 29, 37, 43,
54, 117; Defer and filed: PG-48 → `f-20260929-12`).

Final lens standing: `review-plan` APPROVED r29 (REVISE r30 on PG-137 only) · `review-tests`
APPROVED r28 (REVISE r30 on PG-136 only) · `review-correctness` APPROVED r25 · `review-error-handling`
APPROVED r20 · `review-minimalism` APPROVED r24. 30 rounds, 137 issue IDs.

---

# Implementation run (2026-09-30)

Build run, Claude Code (Opus 5.5) orchestrating, Codex (`gpt-6-luna`) write and lens leaves, `full
auto`, session `a3a230ef-7b5b-4be0-82ec-2e5fb8953292`. No further plan-review round was run (the
plan review was closed above). Sections S1-S5 landed as `756544ec`, `b3dd9659`, `49daff0c`,
`62c02b75`, `e83c9223`; cumulative-review repairs as `0d81548a`, `01e93a58`, `4d8f4933`,
`ea2cbe5c`, `e649bbda`, `315d8205`; records as `d-20260930-01` … `-06`.

## Before / after (tuxedo-atlas, 8 GiB agent scope, warm caches)

The "after" column is one all-blocks run, `pnpm gates:push -- --rust --frontend --bindings`, on the
clean tree at `315d8205`, started 2026-09-30 13:11:47 +02:00. Other agent sessions were loading the
machine throughout (load average 13.97 at start, 12.03 at the end, 20-25 over 15 minutes), so every
"after" number is an upper bound. Every receipt was recorded: the six receipt gates the run
selects wrote `.gate-receipts/*.json` between 13:11 and 13:20 (P1's `gate:run frontend-build` plus
the five `gate:ensure` lanes), and `gate:check` exited 0 for the five `gate:ensure` gates right
after the run. Peak anonymous memory in the scope was 6.72 GiB, 6.45 GiB above idle, and
`journalctl -k` counted **0 OOM kills** over the run.

| Step | Before (serial) | After (lane, wall) | Notes |
| --- | --- | --- | --- |
| `pnpm gates:contract:check` (+ `findings:kit:check` after) | 43.8 s | 74.2 s (`contract` lane) | runs beside the other lanes; now includes `gates:parallelism:test` and `gates:push:test` |
| `cargo fmt` / `cargo check` / `clippy` / `rust:windows:check` | 0.8 / 5.2 / 4.6 / 4.7 s | 46.5 s (`rust-lint` lane) | `cargo check` dropped (`d-20260930-02`); compiles contend with the cargo lanes |
| `backend-test` (`cargo test --all-targets`) | 32.8 s | 57.2 s (`rust-test` lane) | concurrent with `rust-coverage` (`d-20260930-01`) |
| `backend-coverage` + check | 38.5 + 0.8 s | 63.6 s (`rust-coverage` lane) | own target dir |
| `frontend-coverage` (`test:coverage` + check) | 120.5 + 0.3 s | 59.9 s (lane, half budget → 8 workers) | alone at 22 workers: 40.2 s, 5.25 GiB (measured after S2) |
| `build-vite` / `bundle:check` | 6.4 / 0.4 s | 8.1 s (P1 `gate:run frontend-build`) / 0.5 s (`bundle` lane) | |
| `bindings:check` | — (not in the baseline) | 38.6 s (P1, serial) | stays serial: conditional rewriter, compiles against `dist/` |
| `test:e2e:container` | 46.1 s | 20.6 s (`e2e` lane, 6 workers, fully parallel) | after `bundle` and every cargo lane |
| `mutation:frontend` | 549.1 s (concurrency 2, serial packages) | 397.5 s (last lane, 1 slot × 5 runners) | 0 OOM kills |
| **Total** | **≈ 853 s serial sum** | **528.8 s wall** | |

Phase timeline of the after-run: P0 (mutation guard 0.3 s, `setup-rust` < 0.1 s) and P1
(`frontend-build` 8.1 s, `bindings:check` 38.6 s) took ≈ 47 s; P2 ran ≈ 84 s (e2e finished last,
after `rust-coverage`); frontend mutation then ran 397.5 s on the whole 7 GiB budget.

**Acceptance #2 is not met as measured**: 528.8 s is above the audit's ≤ 8 min (480 s) and far from
the plan's ≈ 4.5 min target. The shortfall is the mutation lane (75 % of the wall time). The plan's
≈ 210 s mutation estimate assumed three packages × four runners at ~0.5 GiB each; measured
Stryker runners peak at 0.80-1.13 GiB and grow during a run (`d-20260930-03`), so the 7 GiB agent
budget admits five runners on one package at a time. What remains is outside this plan and
already filed: the 281 static mutants that dominate `workspace-storage` (`f-20260929-09`) and the
8 GiB scope cap itself (tuxedo-config `f-20260929-01`). Everything before the mutation lane now
takes ≈ 131 s instead of ≈ 304 s serially.

## Measured constants (re-measured before use, as the plan required)

* Vitest (`scripts/gate-parallelism.mjs`): `vitest run --coverage.enabled` peak anon above idle
  1.88 / 3.23 / 4.58 GiB at 4 / 12 / 20 workers → ≈ 173 MiB per worker, ≈ 1.20 GiB base;
  `VITEST_WORKER_BYTES` 256 MiB and `VITEST_BASE_BYTES` 1.5 GiB kept as headroom.
* Stryker, per-process RSS sampling: tree-path 4.98 GiB at `--concurrency 4`, 6.76 GiB at 8;
  workspace-storage 3.60 GiB at 4, 7.04 GiB at 8 (runners 0.85-1.09 GiB each); game-practice
  5.44 GiB at 8; `--maxTestRunnerReuse 40` at 8: 6.53 GiB. Parent 0.34-0.39 GiB plus a 0.11 GiB
  helper. → `STRYKER_RUNNER_BYTES` 1.2 GiB, `STRYKER_PARENT_BYTES` 640 MiB (the plan's 640 MiB
  runner figure came from runners OOM-killed before they had grown).
* `ONE_WAVE_BYTES` 40 GiB, `P2_VITEST_SHARE` 0.5, `P2_MUTATION_SHARE` 0.35 (derivation in their
  comments; `d-20260930-04`). The after-run peak of 6.45 GiB is below the 7 GiB budget.
* e2e (pinned container, load average 64-90): 4 workers 47.6-54.3 s (five runs), 6 workers
  36.7-44.1 s (seven runs), 10 workers 38.9 s; 55/55 each, no snapshot moved → `workers: 6`,
  `fullyParallel: true`.
* Clippy covers `cargo check` (rule 12b probe): a type error in the `#[cfg(test)]` fn
  `set_test_lexer_hook` made `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets
  --locked -- -D warnings` exit 101 with `E0308`; exit 0 without it.

## Deviations from the reviewed plan (orchestrator decisions, recorded)

1. **Stryker slot rule** (`d-20260930-03`): the admitted package count maximises total runners
   (ties → more packages) instead of `min(3, cpu, floor(budget / (parent + runner)))`, which with
   the measured runner size would admit three one-runner packages at 7 GiB. The plan's own cases
   are kept (24 CPUs + large budget → 3 slots; 1 CPU → 1; budget `2R + P` on 3 CPUs → 1), plus the
   regression anchor 24 CPUs / 7 GiB → 1 slot.
2. **S2 pure-move proof** (`d-20260930-05`): describe-scope declarations that a split suite repeats
   in several files are compared as a set per describe path; tests and top-level statements stay
   multisets. The first leaf split by hand, hoisted two describe-scope declarations into the
   fixture and later misplaced tests; the proof caught both. The phase was re-run from a
   partition computed from measured per-registration durations and generated from AST byte
   slices. Result: ten files, 2.8-12.4 s each alone, 286/286 before and after, proof IDENTICAL.
   One-off commands (not committed): `/tmp/build-a3a230ef/s2-generate-split.mjs` and
   `/tmp/build-a3a230ef/s2-pure-move-proof.mjs`, both run from the repository root.
3. **S4**: `workers: 6` instead of 4 (faster and five-times green, as the plan allowed).

## Cumulative diff review (`5ca46acd..e83c9223`)

Six Codex lenses at the sensitive rung (the diff touches `.github/workflows/**` and
`package.json`). Detection ran on a different model family than this orchestrator; the code was
written by Codex leaves, so detection shared the writer's family. This context wrote the briefs
and arbitrated triage.

| Lens | Verdict | Findings → disposition |
| --- | --- | --- |
| `review-correctness` | REVISE | coverage + concurrent mutation shares summed to 1.35 × budget on a frontend-only one-wave run → Fix `0d81548a`; `(5a)` missed a wrapped `cargo check` → Fix `4d8f4933`; **PG-136 CLOSED, PG-137 CLOSED** |
| `review-tests` | REVISE | signal test held one lane, so a surviving sibling went unseen → Fix `0d81548a`; no test of a frontend run with an undeterminable budget → Fix `0d81548a` (runner) and `01e93a58` (mutation runner); **PG-136 CLOSED, PG-137 CLOSED** |
| `review-error-handling` | REVISE | runner could hang when a signal-driven termination failed → Fix; nested cleanup errors dropped → Fix; log-write failure hid the child's exit → Fix (all `0d81548a`) |
| `review-root-cause` | REVISE | per-package `tempDirName` let a package copy a sibling's live sandbox (verified in Stryker 9.6.1 `project-reader.js`: `ALWAYS_IGNORE` has no `.stryker-tmp`) → Fix `01e93a58`; after-run timing not yet recorded → Fix (this record) |
| `review-minimalism` | REVISE | duplicated fence-line parser → Fix `4d8f4933`; duplicated byte-count validator → Fix `01e93a58`; duplicated CLI test launcher → Fix `0d81548a`; unused `Set` input → Fix `0d81548a`; one-caller `readFileForWiring` → Fix `e649bbda` |
| `review-code-quality` | APPROVED | three nits (dynamic `tmpdir` import, unexplained 0.25 share margin, blank-separated imports) → Fix `01e93a58`, `e649bbda` |

Found by the orchestrator and fixed in the same batch: the multi-child API's leftover
`"frontend mutation"` default label, the Playwright workers comment losing its reason, and an
unsupported claim in a constant comment. Found in the same area and handled here: `f-20260929-02`
(master's CI `test` job red on two O3.12 tests at 7.2 s) → `315d8205`, `d-20260930-06`;
`f-20260917-11` (foreign-owner test race) → closed by S3's `writeOwner` refusal plus the rewritten
test (PG-102).

**Closure of the two carried plan issues:** PG-136 (the contrasting 2-CPU × 1/2 Stryker config case,
CPU injected test-side via a `node --import` preload) and PG-137 (the import test's completion
marker in a separate file, stdout and stderr asserted empty) were each confirmed CLOSED against the
real code by both `review-tests` and `review-correctness` (`scripts/run-frontend-mutation-tests.mjs`,
config test and import side-effect test). All 137 plan issues are now closed or dispositioned.
