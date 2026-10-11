---
paths:
  - "scripts/**"
  - ".github/workflows/**"
  - "package.json"
  - "pnpm-workspace.yaml"
  - "stryker.config.mjs"
  - "*coverage-*.json"
  - "bundle-budgets.json"
  - ".claude/skills/push/**"
  - "mutants.out/**"
---

# Gate tooling

> **Relevant when:** running, changing or recovering a gate, including a gate command typed before any file is opened.

## Scheduling and placement

`pnpm gates:push` and `pnpm checks:pre-review` are `agent-gate` commands (tuxedo-config's strict
launcher, `d-20261002-01`).

The push skill's §2 runs every final gate through one command,
`pnpm gates:push -- [--rust] [--frontend] [--bindings]` (`scripts/run-push-gates.mjs`; no flags is
the contract-only run). For the selected blocks, it runs the mutation guard first (always) and
`setup-rust` for Rust or bindings, then rebuilds `dist/` for every `dist/` consumer and runs
`bindings:check` with `--bindings`, then the contract, Rust lint, Rust test, Rust coverage, frontend
coverage and bundle lanes concurrently; e2e waits for bundle and every cargo lane because its
container build rewrites `dist/`, a Rust compile input, and frontend mutation runs last unless the
budget allows one wave. `agent-gate` (tuxedo-config's strict launcher) takes the machine-wide
heavy-gate lock (`~/.cache/agent-kit/heavy-gate.lock`; a waiting gate prints `heavy-gate.holder`)
and runs the whole run in its own `agents.slice/agent-gate-*.scope`, capped at 70 % of the slice's
`MemoryHigh`. It fails closed: exit 125 (`agent-gate: REFUSED — …`) means nothing started and a
retry is safe; a missing launcher fails the gate with no in-place fallback. Never wrap a gate
command in another `flock` on `heavy-gate.lock`: it deadlocks against the launcher's own lock.
A nested `agent-gate` is safe and runs in place. `gate:ensure` and `gate:run` enter the gate scope
themselves through `agent-gate` (in place when already inside one), so a standalone receipt run
is placed and locked like the scheduler; `gate:check` only reads the cache and starts no scope.
`scripts/gate-parallelism.mjs` sizes
workers from that scope's complete cgroup chain, including the `agents.slice` budget, and uses the
recorded conservative 8 GiB configuration if an ancestor limit cannot be read or no finite limit
exists. The e2e container runs with a 4 GiB limit reserved from frontend coverage and from frontend
mutation only when mutation shares its concurrent schedule. The schedule and its constants are
`d-20260930-03`, `d-20260930-04`, `d-20261002-01` (placement), and `d-20261002-03` (reserve).

## Mutation gate routing

The backend suite stays in
`.github/workflows/mutation.yml`, dispatchable and scheduled weekly, with the eight backend
packages as a matrix over the runner's `BACKEND_MUTATION_PACKAGE` selector.

## Backend mutation snapshot and recovery

`pnpm mutation:backend` runs `cargo-mutants --in-place` inside a verified private
snapshot under the system temporary directory, outside the checkout. It copies tracked
working-tree inputs and the required built `dist/` as independent files, refuses symlinks
or an inconsistent capture, and requires `pnpm build-vite` first. Cargo uses the reusable
`mutants.out/backend/cargo-target` cache, never the live `src-tauri/target`. Reports stay at
`mutants.out/backend/<package>/`. Mutation therefore cannot inject source or build output
into a checkout being read by another gate.

The runner still refuses a dirty `src-tauri` or failing Git, and holds an exclusive durable
regular-file fence at `mutants.out/backend/.mutation-in-progress`. Whole atomic owner records
name the runner, snapshot, cache and Linux Python 3 subreaper. Cleanup requires its terminal
evidence proving all descendants have been reaped across groups/sessions, then checks the live
tree for legacy cargo-mutants markers before removing the snapshot and fence. Missing evidence
or an unsafe cleanup retains owned state. The cache remains for the next run.

The next run or `pnpm mutation:guard:check`, which `$push` runs before any other gate, refuses
an existing fence and prints ordered recovery: stop every relevant mutation descendant,
restore **only** live files marked by a legacy interrupted in-place run, remove the recorded
snapshot only when its path is valid, then remove the fence.
